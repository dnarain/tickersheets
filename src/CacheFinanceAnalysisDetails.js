/*  *** DEBUG START ***
export { CFAnalysisDetails };
//  *** DEBUG END ***/

/** Read public quote-page JSON. No page scripts or authenticated API URLs run. */
class CFAnalysisDetails {
    static parsePage(html, yahooSymbol) {
        const symbol = typeof yahooSymbol === "string" ? yahooSymbol.trim().toUpperCase() : "";
        const valid = /^[A-Z0-9^][A-Z0-9.^=-]{0,24}$/.test(symbol);
        const source = valid ? "https://finance.yahoo.com/quote/" + encodeURIComponent(symbol) + "/" : "";
        const result = { ok: false, symbol, name: "", source, fields: {}, earnings: [], financials: [], estimates: [], nextEarnings: { dates: [], estimated: null, source, field: "calendarEvents.earnings" }, error: "Public quote details are unavailable." };
        if (!valid || typeof html !== "string") return result;
        const title = html.match(/<title\b[^>]*>([^<]*)/i);
        const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (title && !new RegExp("\\(" + escapedSymbol + "\\)(?:\\s|$)", "i").test(CFAnalysisDetails.decode_(title[1]))) return result;
        let quote = null;
        for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
            if (!/\bdata-sveltekit-fetched(?:\s|=|$)/i.test(script[1]) || !/\btype\s*=\s*["']application\/json["']/i.test(script[1])) continue;
            const attribute = script[1].match(/\bdata-url\s*=\s*(["'])([\s\S]*?)\1/i);
            if (!attribute) continue;
            const path = CFAnalysisDetails.decode_(attribute[2]).match(/^https:\/\/query[12]\.finance\.yahoo\.com\/v10\/finance\/quoteSummary\/([^/?#]+)(?:[?#]|$)/i);
            if (!path) continue;
            let requested;
            try { requested = decodeURIComponent(path[1]).toUpperCase(); } catch { continue; }
            if (requested !== symbol) continue;
            try {
                const envelope = JSON.parse(script[2]);
                if (envelope.status !== 200 || typeof envelope.body !== "string") continue;
                const payload = JSON.parse(envelope.body);
                if (payload.quoteSummary?.error || !Array.isArray(payload.quoteSummary?.result)) continue;
                quote = payload.quoteSummary.result.find(item => item && typeof item.price?.symbol === "string" && item.price.symbol.toUpperCase() === symbol) || null;
                if (quote) break;
            } catch { /* A changed or unrelated JSON block supplies no details. */ }
        }
        if (!quote) return result;
        result.ok = true; result.error = "";
        result.name = CFAnalysisDetails.text_(quote.price.longName || quote.price.shortName);
        const currency = CFAnalysisDetails.text_(quote.price.currency);
        const financialCurrency = CFAnalysisDetails.text_(quote.financialData?.financialCurrency) || currency;
        const definitions = [
            ["market_cap", "Market capitalization", "price.marketCap", "currency"],
            ["enterprise_value", "Enterprise value", "defaultKeyStatistics.enterpriseValue", "currency"],
            ["trailing_pe", "P/E (trailing)", "summaryDetail.trailingPE", "ratio"],
            ["forward_pe", "P/E (forward)", "defaultKeyStatistics.forwardPE", "ratio"],
            ["eps_ttm", "EPS (trailing)", "defaultKeyStatistics.trailingEps", "currency"],
            ["eps_forward", "EPS (forward)", "defaultKeyStatistics.forwardEps", "currency"],
            ["peg_ratio", "PEG ratio", "defaultKeyStatistics.pegRatio", "ratio"],
            ["price_to_book", "Price / book", "defaultKeyStatistics.priceToBook", "ratio"],
            ["price_to_sales", "Price / sales (trailing)", "defaultKeyStatistics.priceToSalesTrailing12Months", "ratio"],
            ["ev_revenue", "Enterprise value / revenue", "defaultKeyStatistics.enterpriseToRevenue", "ratio"],
            ["ev_ebitda", "Enterprise value / EBITDA", "defaultKeyStatistics.enterpriseToEbitda", "ratio"],
            ["beta", "Beta (5-year monthly)", "summaryDetail.beta", "ratio"],
            ["shares_outstanding", "Shares outstanding", "defaultKeyStatistics.sharesOutstanding", "shares"],
            ["float_shares", "Float shares", "defaultKeyStatistics.floatShares", "shares"],
            ["short_shares", "Shares short", "defaultKeyStatistics.sharesShort", "shares"],
            ["short_float", "Short interest / float", "defaultKeyStatistics.shortPercentOfFloat", "fraction"],
            ["insider_ownership", "Insider ownership", "defaultKeyStatistics.heldPercentInsiders", "fraction"],
            ["institutional_ownership", "Institutional ownership", "defaultKeyStatistics.heldPercentInstitutions", "fraction"],
            ["short_ratio", "Short ratio (days)", "defaultKeyStatistics.shortRatio", "number"],
            ["forward_dividend_rate", "Forward annual dividend / share", "summaryDetail.dividendRate", "currency"],
            ["dividend_yield", "Forward dividend yield", "summaryDetail.dividendYield", "fraction"],
            ["trailing_dividend_yield", "Trailing dividend yield", "summaryDetail.trailingAnnualDividendYield", "fraction"],
            ["payout_ratio", "Dividend payout ratio", "summaryDetail.payoutRatio", "fraction"],
            ["total_cash", "Total cash", "financialData.totalCash", "financial_currency"],
            ["total_debt", "Total debt", "financialData.totalDebt", "financial_currency"],
            ["total_revenue", "Revenue (trailing)", "financialData.totalRevenue", "financial_currency"],
            ["ebitda", "EBITDA", "financialData.ebitda", "financial_currency"],
            ["free_cashflow", "Free cash flow", "financialData.freeCashflow", "financial_currency"],
            ["operating_cashflow", "Operating cash flow", "financialData.operatingCashflow", "financial_currency"],
            ["gross_margin", "Gross margin", "financialData.grossMargins", "fraction"],
            ["operating_margin", "Operating margin", "financialData.operatingMargins", "fraction"],
            ["net_margin", "Net profit margin", "financialData.profitMargins", "fraction"],
            ["return_on_equity", "Return on equity", "financialData.returnOnEquity", "fraction"],
            ["return_on_assets", "Return on assets", "financialData.returnOnAssets", "fraction"],
            ["revenue_growth", "Revenue growth", "financialData.revenueGrowth", "fraction"],
            ["earnings_growth", "Earnings growth", "financialData.earningsGrowth", "fraction"],
            ["current_ratio", "Current ratio", "financialData.currentRatio", "ratio"],
            ["quick_ratio", "Quick ratio", "financialData.quickRatio", "ratio"],
            ["debt_to_equity", "Debt / equity", "financialData.debtToEquity", "fraction", 0.01],
            ["target_low", "Analyst target: low", "financialData.targetLowPrice", "currency"],
            ["target_price", "Analyst target: mean", "financialData.targetMeanPrice", "currency"],
            ["target_median", "Analyst target: median", "financialData.targetMedianPrice", "currency"],
            ["target_high", "Analyst target: high", "financialData.targetHighPrice", "currency"],
            ["analyst_count", "Analysts providing targets", "financialData.numberOfAnalystOpinions", "number"],
            ["fund_assets", "Fund total assets", "defaultKeyStatistics.totalAssets", "currency"],
            ["expense_ratio", "Fund annual expense ratio", "defaultKeyStatistics.annualReportExpenseRatio", "fraction"],
            ["fund_yield", "Fund yield", "defaultKeyStatistics.yield", "fraction"],
            ["ytd_return", "Fund YTD return", "defaultKeyStatistics.ytdReturn", "fraction"]
        ];
        for (const [id, label, path, unit, scale = 1] of definitions) {
            const datum = path.split(".").reduce((object, key) => object?.[key], quote);
            const raw = CFAnalysisDetails.number_(datum);
            if (raw === null) continue;
            const value = raw * scale;
            const money = unit === "currency" || unit === "financial_currency";
            result.fields[id] = { label, value, display: scale === 1 ? CFAnalysisDetails.text_(datum?.fmt) || String(value) : String(value), unit: money ? "currency" : unit, ...(money ? { currency: unit === "financial_currency" ? financialCurrency : currency } : {}), source, field: path + ".raw" };
        }
        const methods = [["earningsGaap", "GAAP"], ["earningsNonGaap", "Adjusted"]];
        if (!quote.earningsGaap && !quote.earningsNonGaap && quote.earnings) {
            const basis = String(quote.earnings.defaultMethodology || "").toLowerCase();
            if (["gaap", "nongaap"].includes(basis)) methods.push(["earnings", basis === "gaap" ? "GAAP" : "Adjusted"]);
        }
        for (const [module, basis] of methods) {
            const earnings = quote[module];
            if (!earnings || typeof earnings !== "object") continue;
            const earningsCurrency = CFAnalysisDetails.text_(earnings.financialCurrency) || financialCurrency;
            for (const row of CFAnalysisDetails.array_(earnings.earningsChart?.quarterly)) {
                if (!row || typeof row !== "object") continue;
                const actual = CFAnalysisDetails.number_(row.actual), estimate = CFAnalysisDetails.number_(row.estimate);
                const period = CFAnalysisDetails.text_(row.fiscalQuarter || row.date);
                if (!period || (actual === null && estimate === null)) continue;
                const published = CFAnalysisDetails.decimal_(row.surprisePct);
                const calculated = actual !== null && estimate !== null && estimate !== 0 ? (actual - estimate) / Math.abs(estimate) * 100 : null;
                result.earnings.push({ period, fiscalPeriod: CFAnalysisDetails.text_(row.fiscalQuarter), calendarPeriod: CFAnalysisDetails.text_(row.calendarQuarter || row.date), periodEnd: CFAnalysisDetails.date_(row.periodEndDate), reportedDate: CFAnalysisDetails.date_(row.reportedDate), basis, actual, estimate, difference: actual !== null && estimate !== null ? actual - estimate : null, surprisePct: published ?? calculated, currency: earningsCurrency, source, field: module + ".earningsChart.quarterly" });
            }
            for (const [key, frequency] of [["yearly", "Annual"], ["quarterly", "Quarterly"]]) {
                for (const row of CFAnalysisDetails.array_(earnings.financialsChart?.[key])) {
                    if (!row || typeof row !== "object") continue;
                    const revenue = CFAnalysisDetails.number_(row.revenue), netIncome = CFAnalysisDetails.number_(row.earnings);
                    const period = CFAnalysisDetails.text_(String(row.date ?? ""));
                    if (!period || (revenue === null && netIncome === null)) continue;
                    result.financials.push({ period, frequency, basis, revenue, netIncome, profitMargin: CFAnalysisDetails.number_(row.profitMargin), currency: earningsCurrency, source, field: module + ".financialsChart." + key });
                }
            }
            const chart = earnings.earningsChart;
            if (chart && CFAnalysisDetails.number_(chart.currentQuarterEstimate) !== null) {
                result.estimates.push({ period: CFAnalysisDetails.text_(chart.currentFiscalQuarter || chart.currentCalendarQuarter || chart.currentQuarterEstimateDate), periodEnd: CFAnalysisDetails.date_(chart.currentPeriodEndDate), basis, growth: null, epsLow: null, epsAverage: CFAnalysisDetails.number_(chart.currentQuarterEstimate), epsHigh: null, epsAnalysts: null, revenueLow: null, revenueAverage: null, revenueHigh: null, revenueAnalysts: null, currency: earningsCurrency, source, field: module + ".earningsChart.currentQuarterEstimate" });
            }
        }
        const calendar = quote.calendarEvents?.earnings;
        if (calendar && typeof calendar === "object") {
            result.nextEarnings = { dates: (Array.isArray(calendar.earningsDate) ? calendar.earningsDate : []).map(CFAnalysisDetails.date_).filter(Boolean), estimated: typeof calendar.isEarningsDateEstimate === "boolean" ? calendar.isEarningsDateEstimate : null, source, field: "calendarEvents.earnings" };
            if ([calendar.earningsAverage, calendar.revenueAverage].some(value => CFAnalysisDetails.number_(value) !== null)) {
                result.estimates.push({ period: "Next earnings consensus", periodEnd: "", basis: "Provider consensus", growth: null, epsLow: CFAnalysisDetails.number_(calendar.earningsLow), epsAverage: CFAnalysisDetails.number_(calendar.earningsAverage), epsHigh: CFAnalysisDetails.number_(calendar.earningsHigh), epsAnalysts: null, revenueLow: CFAnalysisDetails.number_(calendar.revenueLow), revenueAverage: CFAnalysisDetails.number_(calendar.revenueAverage), revenueHigh: CFAnalysisDetails.number_(calendar.revenueHigh), revenueAnalysts: null, currency: financialCurrency, source, field: "calendarEvents.earnings" });
            }
        }
        for (const row of CFAnalysisDetails.array_(quote.earningsTrend?.trend)) {
            if (!row || typeof row !== "object") continue;
            const period = CFAnalysisDetails.text_(row.period);
            const eps = row.earningsEstimate, revenue = row.revenueEstimate;
            if (!period || [eps?.avg, revenue?.avg].every(value => CFAnalysisDetails.number_(value) === null)) continue;
            result.estimates.push({ period, periodEnd: CFAnalysisDetails.date_(row.endDate), basis: "Provider consensus", growth: CFAnalysisDetails.number_(row.growth), epsLow: CFAnalysisDetails.number_(eps?.low), epsAverage: CFAnalysisDetails.number_(eps?.avg), epsHigh: CFAnalysisDetails.number_(eps?.high), epsAnalysts: CFAnalysisDetails.number_(eps?.numberOfAnalysts), revenueLow: CFAnalysisDetails.number_(revenue?.low), revenueAverage: CFAnalysisDetails.number_(revenue?.avg), revenueHigh: CFAnalysisDetails.number_(revenue?.high), revenueAnalysts: CFAnalysisDetails.number_(revenue?.numberOfAnalysts), currency: financialCurrency, source, field: "earningsTrend.trend" });
        }
        return result;
    }

    static array_(value) { return Array.isArray(value) ? value : []; }

    static number_(datum) {
        const value = datum && typeof datum === "object" ? datum.raw : datum;
        return typeof value === "number" && Number.isFinite(value) ? value : null;
    }

    static decimal_(value) {
        if (typeof value === "number") return Number.isFinite(value) ? value : null;
        return typeof value === "string" && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) && Number.isFinite(Number(value)) ? Number(value) : null;
    }

    static date_(datum) {
        const formatted = typeof datum === "string" ? datum : datum?.fmt;
        if (typeof formatted === "string" && /^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
            const parsed = new Date(formatted + "T00:00:00Z");
            if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === formatted) return formatted;
        }
        const raw = CFAnalysisDetails.number_(datum);
        if (raw === null || raw <= 0) return "";
        const date = new Date(raw * 1000);
        return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "";
    }

    static text_(value) {
        return typeof value === "string" && !/[<>\u0000-\u001f]/.test(value) ? value.trim().slice(0, 1000) : "";
    }

    static decode_(value) {
        return value.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#(?:39|x27);/gi, "'").replace(/&#(\d+);/g, (_token, code) => String.fromCharCode(Number(code)));
    }
}
