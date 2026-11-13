/*  *** DEBUG START ***
import { TickerSheetsPublicData } from "./TickerSheetsFunctions.js";
import { TickerSheetsData } from "./TickerSheetsData.js";
export { TickerSheetsWatchRow, TICKERSHEETS_WATCH_ROW };
//  *** DEBUG END ***/

/** One ticker's public quote, fundamentals and calculated indicators as a labeled table. */
class TickerSheetsWatchRow {
    static keys() {
        return ["status", "price", "currency", "quote_time", "retrieved_at", "indicator_as_of", "return1d", "return1m", "return1y", "rsi14",
            "sma50", "sma200", "volatility20d", "trailing_pe", "eps_ttm", "market_cap", "target_price", "next_earnings", "source", "price_session",
            "atm_iv", "return3m", "return_ytd", "max_drawdown", "macd", "macd_signal", "average_volume20", "bar_count", "previous_rsi2", "previous_close"];
    }
    static unavailable_(status) {
        return { ...Object.fromEntries(TickerSheetsWatchRow.keys().map(key => [key, null])), status };
    }
    static data(ticker, overrides = {}, refresh = "") {
        let symbol;
        try { symbol = TickerSheetsData.normalizeTicker(ticker).yahooSymbol; }
        catch { return TickerSheetsPublicData.failure("Enter a supported ticker."); }
        return TickerSheetsPublicData.cached("watch-row:v1", symbol, 60, services => {
            const quote = TickerSheetsPublicData.quote(symbol, services, refresh), details = TickerSheetsPublicData.details(symbol, services, refresh);
            if (!quote.ok && !details.ok) return TickerSheetsPublicData.failure("Quote and fundamentals unavailable.");
            const chart = quote.chart || {}, history = quote.ok && Array.isArray(chart.history) ? chart.history : [];
            const technical = TickerSheetsData.calculate(history).summary, fields = details.fields || {};
            const selected = quote.ok ? quote.quote || TickerSheetsData.selectQuote(chart, details.details || {}) : {};
            const field = key => details.ok && Object.prototype.hasOwnProperty.call(fields, key) ? fields[key]?.value ?? null : null;
            const previous = technical.barCount > 1 ? history[technical.barCount - 2]?.close : null;
            const result = TickerSheetsWatchRow.unavailable_(quote.ok && details.ok ? "Available"
                : quote.ok ? "Quote available; fundamentals unavailable" : "Fundamentals available; quote unavailable");
            Object.assign(result, {
                price: selected.price ?? null, currency: chart.currency || null, quote_time: selected.quoteTime || quote.quoteTime || null,
                retrieved_at: quote.ok ? quote.retrievedAt || null : details.retrievedAt || null,
                indicator_as_of: technical.indicatorAsOf || null, return1d: technical.return1d, return1m: technical.return1m, return1y: technical.return1y,
                rsi14: technical.rsi14, sma50: technical.sma50, sma200: technical.sma200, volatility20d: technical.volatility20d,
                trailing_pe: field("trailing_pe"), eps_ttm: field("eps_ttm"), market_cap: field("market_cap"), target_price: field("target_price"),
                next_earnings: details.ok ? details.details?.nextEarnings?.dates?.[0] || field("earnings_date") : null,
                source: quote.ok ? quote.source || null : details.source || null, price_session: selected.session || null,
                return3m: technical.return3m, return_ytd: technical.returnYtd, max_drawdown: technical.maxDrawdown,
                macd: technical.macd, macd_signal: technical.macdSignal, average_volume20: technical.volumeAverage20,
                bar_count: history.filter(row => typeof row.close === "number" && Number.isFinite(row.close) && row.close > 0).length,
                previous_close: typeof previous === "number" && Number.isFinite(previous) && previous > 0 ? previous : null
            });
            // No option-chain or RSI2 request is made for other watchlist tickers.
            return { ok: true, fields: result, retrievedAt: result.retrieved_at || undefined };
        }, overrides, refresh);
    }
    static table(ticker, refresh = "", overrides = {}) {
        let data;
        try { data = TickerSheetsWatchRow.data(ticker, overrides, refresh); }
        catch { data = TickerSheetsPublicData.failure("Request or response unavailable."); }
        const fields = data.ok && data.fields ? data.fields : TickerSheetsWatchRow.unavailable_(TickerSheetsPublicData.error(data));
        return [["Field", "Value"], ...TickerSheetsWatchRow.keys().map(key => [key, TickerSheetsPublicData.safe(fields[key] === "" ? null : fields[key])])];
    }
}

/** Stock snapshot and technical indicators as a labeled table. @customfunction */
function TICKERSHEETS_WATCH_ROW(ticker, refresh = "") { return TickerSheetsWatchRow.table(ticker, refresh); }
