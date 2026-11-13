/*  *** DEBUG START ***
import { TickerSheetsPublicData } from "./TickerSheetsFunctions.js";
import { TickerSheetsData } from "./TickerSheetsData.js";
import { TickerSheetsProviderFields } from "./TickerSheetsProviderFields.js";
export { TickerSheetsTables, TICKERSHEETS_EARNINGS, TICKERSHEETS_QUOTE_COMPARE };
//  *** DEBUG END ***/

const TICKERSHEETS_EARNINGS_HEADERS_ = Object.freeze({
    earnings: ["Period", "Basis", "EPS actual", "EPS estimate", "Difference", "Surprise % points", "Reported", "Period end", "Currency", "Source"],
    financials: ["Financial period", "Frequency", "Basis", "Revenue", "Net income", "Profit margin", "Currency", "Source"],
    estimates: ["Estimate period", "Basis", "EPS low", "EPS average", "EPS high", "Revenue low", "Revenue average", "Revenue high", "Currency", "Source"],
    dividends: ["Dividend date", "Amount / share", "Currency", "Source"],
    splits: ["Split date", "New shares", "Old shares", "Source"],
    calendar: ["Field", "Value", "Status", "Source"]
});
const TICKERSHEETS_QUOTE_COMPARE_HEADERS_ = Object.freeze(["Provider", "Price", "Yield", "Currency", "Identity", "Quote time", "Retrieved at", "Status", "Source", "Note"]);

/** Public source tables used by formulas. These functions do not write to spreadsheets. */
class TickerSheetsTables {
    static table_(headers, rows, unavailable) {
        const values = rows.length ? rows : [[unavailable, ...headers.slice(1).map(() => null)]];
        return [headers.slice(), ...values.map(row => row.map(TickerSheetsPublicData.safe))];
    }

    static earnings(ticker, section = "earnings", overrides = {}, refresh = "") {
        const part = typeof section === "string" ? section.trim().toLowerCase() : "";
        const headers = TICKERSHEETS_EARNINGS_HEADERS_[part];
        if (!Object.prototype.hasOwnProperty.call(TICKERSHEETS_EARNINGS_HEADERS_, part)) return "N/A: Choose earnings, financials, estimates, dividends, splits or calendar.";
        const events = ["dividends", "splits"].includes(part);
        const data = events ? TickerSheetsPublicData.chart(ticker, overrides, refresh) : TickerSheetsPublicData.details(ticker, overrides, refresh);
        if (!data.ok) return TickerSheetsTables.table_(headers, [], TickerSheetsPublicData.error(data));
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
        return TickerSheetsTables.table_(headers, rows || [], "N/A: No " + part + " data returned.");
    }

    static comparisonSource_(provider, symbol, overrides, refresh) {
        let result;
        try { result = TickerSheetsPublicData.provider(provider, symbol, overrides, refresh); }
        catch { return { status: "Request failed", identity: "Unknown", note: "Provider comparison unavailable." }; }
        const matched = result.symbol === symbol && result.identity === "Matched";
        const fields = result.ok && matched ? result.fields || {} : {};
        const finite = field => typeof field?.value === "number" && Number.isFinite(field.value);
        const priceField = fields.price, yieldField = fields.forward_dividend_yield;
        const price = priceField?.unit === "currency" && finite(priceField) && priceField.value > 0 ? priceField.value : null;
        const yieldFraction = yieldField?.unit === "fraction" && finite(yieldField) && yieldField.value >= 0 ? yieldField.value : null;
        const status = result.ok && !matched ? "Ticker mismatch" : !result.ok ? result.status || "Data unavailable"
            : price !== null ? "Available" : yieldFraction !== null ? "Yield only" : "Price/yield unavailable";
        return { price, yieldFraction, currency: price !== null && /^[A-Z]{3}$/.test(priceField.currency || "") ? priceField.currency : null,
            identity: result.ok && !matched ? "Mismatch" : result.identity || "Unknown", quoteTime: result.quoteTime || null,
            retrievedAt: result.retrievedAt, source: result.source, status,
            note: (provider === "GURUFOCUS" ? "Dividend route supplies no spot price. " : "Provider-published spot price. ")
                + (yieldFraction !== null ? "Forward dividend yield." : "Forward dividend yield unavailable.") };
    }

    static compare(ticker, overrides = {}, refresh = "") {
        const normalized = TickerSheetsData.normalizeTicker(ticker), symbol = normalized.yahooSymbol;
        const chartData = TickerSheetsPublicData.chart(ticker, overrides, refresh), page = TickerSheetsPublicData.quotePage(ticker, overrides, refresh);
        const chart = chartData.chart || {}, quote = TickerSheetsData.selectQuote(chart, page.details || {});
        const currency = chart.currency || null, rows = [];
        const dated = session => session.source === page.source ? page.retrievedAt : chartData.retrievedAt;
        rows.push(["Yahoo regular", chartData.ok ? chart.price : null, null, currency, chartData.ok ? "Matched" : "Unknown", chartData.quoteTime, chartData.retrievedAt, chartData.status, chartData.source, "Regular-market quote. History and indicators use Yahoo daily closes."]);
        rows.push(["Yahoo website regular", page.basic?.price, page.basic?.yieldFraction, page.details?.currency, page.details?.ok ? "Matched" : "Unknown", page.basic?.quoteTime, page.retrievedAt,
            page.basic?.price != null ? "Available" : page.ok ? "Price unavailable" : page.status, page.source, "Structured regular-session quote; " + (page.basic?.yieldBasis || "yield unavailable") + "."]);
        for (const [part, label] of [["pre", "Yahoo pre-market"], ["post", "Yahoo after-hours"]]) {
            const session = quote[part];
            rows.push([label, session.price, null, currency, session.price !== null ? "Matched" : "Unknown", session.quoteTime, dated(session), session.status, session.source || page.source || chartData.source, "Session quote time differs from retrieval time."]);
        }
        for (const provider of TickerSheetsProviderFields.registry().filter(row => row.fields.some(field => ["price", "forward_dividend_yield"].includes(field.id)))) {
            const result = TickerSheetsTables.comparisonSource_(provider.provider, symbol, overrides, refresh);
            rows.push([provider.label, result.price, result.yieldFraction, result.currency, result.identity || "Unknown", result.quoteTime, result.retrievedAt, result.status, result.source, result.note]);
        }
        return TickerSheetsTables.table_(TICKERSHEETS_QUOTE_COMPARE_HEADERS_, rows);
    }
}

/** Earnings, financials, estimates, dividends, splits or calendar with labeled columns. @customfunction */
function TICKERSHEETS_EARNINGS(ticker, section = "earnings", refresh = "") {
    try { return TickerSheetsTables.earnings(ticker, section, {}, refresh); }
    catch { return "N/A: Enter a supported ticker and earnings section."; }
}

/** Public quote comparisons with source identity and separate quote/retrieval times. @customfunction */
function TICKERSHEETS_QUOTE_COMPARE(ticker, refresh = "") {
    try { return TickerSheetsTables.compare(ticker, {}, refresh); }
    catch { return "N/A: Enter a supported ticker for quote comparisons."; }
}
