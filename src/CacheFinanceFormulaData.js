/*  *** DEBUG START ***
import { CFPublicData } from "./CacheFinanceResearchFunctions.js";
import { CFAnalysisData } from "./CacheFinanceAnalysisData.js";
import { GoogleWebSiteFinance, GlobeAndMail } from "./CacheFinanceWebSites.js";
export { CFFormulaData, CFEARNINGS, CFQUOTECOMPARE };
//  *** DEBUG END ***/

const CF_EARNINGS_HEADERS_ = Object.freeze({
    earnings: ["Period", "Basis", "EPS actual", "EPS estimate", "Difference", "Surprise % points", "Reported", "Period end", "Currency", "Source"],
    financials: ["Financial period", "Frequency", "Basis", "Revenue", "Net income", "Profit margin", "Currency", "Source"],
    estimates: ["Estimate period", "Basis", "EPS low", "EPS average", "EPS high", "Revenue low", "Revenue average", "Revenue high", "Currency", "Source"],
    dividends: ["Dividend date", "Amount / share", "Currency", "Source"],
    splits: ["Split date", "New shares", "Old shares", "Source"],
    calendar: ["Field", "Value", "Status", "Source"]
});
const CF_QUOTE_COMPARE_HEADERS_ = Object.freeze(["Provider", "Price", "Yield", "Currency", "Identity", "Quote time", "Retrieved at", "Status", "Source", "Note"]);

/** Public source tables used by formulas. These functions do not write to spreadsheets. */
class CFFormulaData {
    static table_(headers, rows, unavailable) {
        const values = rows.length ? rows : [[unavailable, ...headers.slice(1).map(() => null)]];
        return [headers.slice(), ...values.map(row => row.map(CFPublicData.safe))];
    }

    static earnings(ticker, section = "earnings", overrides = {}, refresh = "") {
        const part = typeof section === "string" ? section.trim().toLowerCase() : "";
        const headers = CF_EARNINGS_HEADERS_[part];
        if (!Object.prototype.hasOwnProperty.call(CF_EARNINGS_HEADERS_, part)) return "N/A: Choose earnings, financials, estimates, dividends, splits or calendar.";
        const events = ["dividends", "splits"].includes(part);
        const data = events ? CFPublicData.chart(ticker, overrides, refresh) : CFPublicData.details(ticker, overrides, refresh);
        if (!data.ok) return CFFormulaData.table_(headers, [], CFPublicData.error(data));
        const details = data.details || {}, source = data.source;
        let rows;
        if (part === "earnings") rows = (details.earnings || []).map(value => [value.period, value.basis, value.actual, value.estimate, value.difference, value.surprisePct, value.reportedDate || null, value.periodEnd || null, value.currency, value.source || source]);
        if (part === "financials") rows = (details.financials || []).map(value => [value.period, value.frequency, value.basis, value.revenue, value.netIncome, value.profitMargin, value.currency, value.source || source]);
        if (part === "estimates") rows = (details.estimates || []).map(value => [value.period, value.basis, value.epsLow, value.epsAverage, value.epsHigh, value.revenueLow, value.revenueAverage, value.revenueHigh, value.currency, value.source || source]);
        if (part === "dividends") rows = (data.chart.events?.dividends || []).map(value => [value.date || null, value.amount, data.chart.currency, source]);
        if (part === "splits") rows = (data.chart.events?.splits || []).map(value => [value.date || null, value.numerator, value.denominator, source]);
        if (part === "calendar") {
            const calendar = details.nextEarnings || {}, dates = calendar.dates || [];
            const status = calendar.estimated === true ? "Estimated" : calendar.estimated === false ? "Provider marks confirmed" : "Not specified";
            rows = [["next_earnings_date", dates[0] || null, dates.length ? "Available" : "Not available", calendar.source || source],
                ["next_earnings_dates", dates.length ? dates.join(" / ") : null, dates.length ? "Available" : "Not available", calendar.source || source],
                ["date_status", status, typeof calendar.estimated === "boolean" ? "Available" : "Not available", calendar.source || source]];
        }
        return CFFormulaData.table_(headers, rows || [], "N/A: No " + part + " data returned.");
    }

    static comparisonSource_(provider, adapter, symbol, overrides, refresh) {
        if (!symbol) return { ok: false, provider, status: "Unsupported ticker", identity: "Unknown", note: "The returned exchange has no comparison route." };
        const url = adapter.getURL(symbol, "PRICE");
        if (!url) return { ok: false, provider, status: "Unsupported ticker", identity: "Unknown", note: "This adapter does not support the selected ticker." };
        return CFPublicData.cached("quote-comparison:v1", provider + ":" + symbol, 60, deps => {
            const response = CFPublicData.request(url, deps), source = url;
            let quote = null, metadata = { identity: "Unknown", timestamp: "Unknown" }, currency = null;
            try {
                if (response.body) {
                    quote = adapter.parseResponse(response.body, symbol);
                    metadata = adapter.sourceDetails(response.body, symbol);
                    const matched = adapter === GoogleWebSiteFinance ? GoogleWebSiteFinance.extractQuote(response.body, symbol)?.[4]
                        : GlobeAndMail.readQuote(response.body, symbol)?.symbolCurrency;
                    if (typeof matched === "string" && /^[A-Z]{3}$/.test(matched)) currency = matched;
                }
            } catch { /* Changed public markup supplies no accepted comparison values. */ }
            const price = typeof quote?.stockPrice === "number" && Number.isFinite(quote.stockPrice) && quote.stockPrice > 0 ? quote.stockPrice : null;
            const yieldFraction = typeof quote?.yieldPct === "number" && Number.isFinite(quote.yieldPct) ? quote.yieldPct : null;
            return { ok: price !== null, provider, price, yieldFraction, currency, identity: metadata.identity,
                quoteTime: metadata.timestamp === "Unknown" ? null : metadata.timestamp, source,
                status: price !== null ? "Available" : response.http === 200 ? "Data unavailable" : "HTTP " + response.http,
                note: provider === "Globe & Mail" ? "Trailing stock yield or provider distribution yield." : "Provider-published yield when available." };
        }, overrides, refresh);
    }

    static compare(ticker, overrides = {}, refresh = "") {
        const normalized = CFAnalysisData.normalizeTicker(ticker), symbol = normalized.yahooSymbol;
        const chartData = CFPublicData.chart(ticker, overrides, refresh), page = CFPublicData.quotePage(ticker, overrides, refresh);
        const chart = chartData.chart || {}, quote = CFAnalysisData.selectQuote(chart, page.details || {});
        const currency = chart.currency || null, rows = [];
        const dated = session => session.source === page.source ? page.retrievedAt : chartData.retrievedAt;
        rows.push(["Yahoo regular", chartData.ok ? chart.price : null, null, currency, chartData.ok ? "Matched" : "Unknown", chartData.quoteTime, chartData.retrievedAt, chartData.status, chartData.source, "Regular-market quote. History and indicators use Yahoo daily closes."]);
        rows.push(["Yahoo Finance", page.basic?.price, page.basic?.yieldFraction, page.details?.currency, page.basic?.name ? "Name matched" : "Unknown", null, page.retrievedAt,
            page.basic?.price != null ? "Available" : page.ok ? "Data unavailable" : page.status, page.source, "Stock yield is forward yield; ETF yield follows the provider's label."]);
        for (const [part, label] of [["pre", "Yahoo pre-market"], ["post", "Yahoo after-hours"]]) {
            const session = quote[part];
            rows.push([label, session.price, null, currency, session.price !== null ? "Matched" : "Unknown", session.quoteTime, dated(session), session.status, session.source || page.source || chartData.source, "Session quote time differs from retrieval time."]);
        }
        const cacheSymbol = chart.cacheSymbol || normalized.cacheSymbol;
        for (const [provider, adapter] of [["Google Finance", GoogleWebSiteFinance], ["Globe & Mail", GlobeAndMail]]) {
            const result = CFFormulaData.comparisonSource_(provider, adapter, cacheSymbol, overrides, refresh);
            rows.push([provider, result.price, result.yieldFraction, result.currency, result.identity || "Unknown", result.quoteTime, result.retrievedAt, result.status, result.source, result.note]);
        }
        return CFFormulaData.table_(CF_QUOTE_COMPARE_HEADERS_, rows);
    }
}

/** Earnings, financials, estimates, dividends, splits or calendar with labeled columns. @customfunction */
function CFEARNINGS(ticker, section = "earnings", refresh = "") {
    try { return CFFormulaData.earnings(ticker, section, {}, refresh); }
    catch { return "N/A: Enter a supported ticker and earnings section."; }
}

/** Public quote comparisons with source identity and separate quote/retrieval times. @customfunction */
function CFQUOTECOMPARE(ticker, refresh = "") {
    try { return CFFormulaData.compare(ticker, {}, refresh); }
    catch { return "N/A: Enter a supported ticker for quote comparisons."; }
}
