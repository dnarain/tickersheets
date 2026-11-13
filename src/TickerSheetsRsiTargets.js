/*  *** DEBUG START ***
import { TickerSheetsPublicData } from "./TickerSheetsFunctions.js";
export { TickerSheetsRsiTargets, TICKERSHEETS_RSI_TARGETS };
//  *** DEBUG END ***/

/** RSI(2) follows the repaired SMF Mac 21-prior-close window and Wilder smoothing. */
class TickerSheetsRsiTargets {
    static fields() { return ["rsi2", "buy_target", "sell_target", "price", "bid", "ask", "open", "low", "high", "volume", "previous_close", "previous_rsi2"]; }
    static headers() { return ["Current RSI2", "Buy target price", "Sell target price", "Last traded price", "Bid price", "Ask price", "Open price", "Low price", "High price", "Volume", "Previous close", "Previous RSI2"]; }
    static number_(value, positive = false) {
        return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1e100 && (positive ? value > 0 : value >= 0) ? value : null;
    }
    static ratio_(gain, loss) { return gain + loss === 0 ? 50 : 100 * gain / (gain + loss); }
    static failure_(message, source = "") { return TickerSheetsPublicData.failure(message, source); }
    static field_(value) { return typeof value === "string" ? value.trim().toLowerCase() : ""; }
    static needs_(field) {
        return { rsi: ["all", "rsi2", "buy_target", "sell_target", "previous_rsi2"].includes(field),
            buy: ["all", "buy_target"].includes(field), sell: ["all", "sell_target"].includes(field),
            previous: ["all", "previous_close"].includes(field), bidAsk: ["all", "bid", "ask"].includes(field) };
    }
    static validate_(field, lowTrigger, highTrigger) {
        if (![...TickerSheetsRsiTargets.fields(), "all", "headers"].includes(field)) return "Unsupported RSI2 field";
        const need = TickerSheetsRsiTargets.needs_(field);
        if (need.buy && (!Number.isInteger(lowTrigger) || lowTrigger <= 0 || lowTrigger >= 100)) return "Use a whole buy trigger from 1 to 99";
        if (need.sell && (!Number.isInteger(highTrigger) || highTrigger <= 0 || highTrigger >= 100)) return "Use a whole sell trigger from 1 to 99";
        if (need.buy && need.sell && lowTrigger >= highTrigger) return "The buy trigger must be less than the sell trigger";
        return "";
    }
    static dateConfig_(meta) {
        const offset = typeof meta.gmtoffset === "number" && Number.isInteger(meta.gmtoffset) && Math.abs(meta.gmtoffset) <= 86400 ? meta.gmtoffset : null;
        let timeZone = null;
        if (typeof meta.exchangeTimezoneName === "string" && meta.exchangeTimezoneName.trim()) {
            try { new Intl.DateTimeFormat("en-CA", { timeZone: meta.exchangeTimezoneName }).format(new Date(0)); timeZone = meta.exchangeTimezoneName; } catch { /* A valid provider GMT offset can still identify the session. */ }
        }
        return timeZone || offset !== null ? { timeZone, offset } : null;
    }
    static day_(stamp, config) {
        if (typeof stamp !== "number" || !Number.isInteger(stamp) || stamp <= 0 || stamp > 253402214400 || !config) return null;
        if (config.timeZone) {
            try {
                const parts = new Intl.DateTimeFormat("en-CA", { timeZone: config.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(stamp * 1000));
                const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
                const iso = values.year + "-" + values.month + "-" + values.day;
                if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
            } catch { /* Fall back to the explicit Yahoo offset when the runtime lacks time-zone formatting. */ }
        }
        if (config.offset === null) return null;
        const iso = new Date((stamp + config.offset) * 1000).toISOString().slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
    }
    static history_(chart, quoteDay, config) {
        const result = { previousClose: null, averageGain: null, averageLoss: null, currentBar: -1, error: "RSI2 requires 21 completed prior closes" };
        const times = chart.timestamp, bars = chart.indicators?.quote?.[0];
        if (!Array.isArray(times) || times.length < 1 || times.length > 500 || !bars) return result;
        if (!Array.isArray(bars.close) || bars.close.length !== times.length) {
            let prior = "";
            for (let i = 0; i < times.length; i++) {
                const day = TickerSheetsRsiTargets.day_(times[i], config);
                if (!day || day <= prior) { result.currentBar = -1; result.error = "Daily session dates are invalid, duplicated or out of order"; return result; }
                prior = day;
                if (day === quoteDay) result.currentBar = i;
            }
            return result;
        }
        const closes = [];
        let later = "9999-12-31";
        for (let i = times.length - 1; i >= 0; i--) {
            const day = TickerSheetsRsiTargets.day_(times[i], config);
            if (!day || day >= later) { result.error = "Daily session dates are invalid, duplicated or out of order"; return result; }
            later = day;
            if (day === quoteDay) result.currentBar = i;
            if (day > quoteDay) {
                if (TickerSheetsRsiTargets.number_(bars.close[i], true) !== null) { result.previousClose = null; result.error = "Daily history is newer than the quoted session"; return result; }
            } else if (day < quoteDay) {
                const close = TickerSheetsRsiTargets.number_(bars.close[i], true);
                if (close === null) { result.error = "A completed prior close is missing or invalid"; return result; }
                closes.push(close);
                if (result.previousClose === null) result.previousClose = close;
                if (closes.length === 21) break;
            }
        }
        if (closes.length < 21) return result;
        const chronological = closes.reverse();
        let gain = 0, loss = 0;
        for (let i = 1; i <= 2; i++) {
            const change = chronological[i] - chronological[i - 1];
            gain += Math.max(change, 0) / 2; loss += Math.max(-change, 0) / 2;
        }
        for (let i = 3; i < chronological.length; i++) {
            const change = chronological[i] - chronological[i - 1];
            gain = (gain + Math.max(change, 0)) / 2; loss = (loss + Math.max(-change, 0)) / 2;
        }
        result.averageGain = gain; result.averageLoss = loss; result.error = "";
        return result;
    }
    static snapshot(body, requestedSymbol) {
        const source = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(requestedSymbol);
        try {
            const payload = typeof body === "string" ? JSON.parse(body) : body, rows = payload?.chart?.result;
            if (payload?.chart?.error || !Array.isArray(rows) || rows.length !== 1) return TickerSheetsRsiTargets.failure_("Yahoo RSI2 chart is unavailable", source);
            const chart = rows[0], meta = chart?.meta;
            if (!meta || typeof meta.symbol !== "string" || meta.symbol.toUpperCase() !== requestedSymbol) return TickerSheetsRsiTargets.failure_("Yahoo RSI2 chart returned a different ticker", source);
            const price = TickerSheetsRsiTargets.number_(meta.regularMarketPrice, true), config = TickerSheetsRsiTargets.dateConfig_(meta), sessionDate = TickerSheetsRsiTargets.day_(meta.regularMarketTime, config);
            if (price === null || !sessionDate) return TickerSheetsRsiTargets.failure_("Yahoo quote price, time or exchange session is unavailable", source);
            const history = TickerSheetsRsiTargets.history_(chart, sessionDate, config), bars = chart.indicators?.quote?.[0] || {}, index = history.currentBar;
            const bar = (field, positive = false) => Array.isArray(bars[field]) && index >= 0 ? TickerSheetsRsiTargets.number_(bars[field][index], positive) : null;
            return { ok: true, status: history.error ? "Quote available; RSI2 history unavailable" : "Available", symbol: requestedSymbol, source,
                quoteTime: new Date(meta.regularMarketTime * 1000).toISOString(), sessionDate, dateConfig: config,
                price, open: bar("open", true), low: TickerSheetsRsiTargets.number_(meta.regularMarketDayLow, true) ?? bar("low", true),
                high: TickerSheetsRsiTargets.number_(meta.regularMarketDayHigh, true) ?? bar("high", true), volume: TickerSheetsRsiTargets.number_(meta.regularMarketVolume) ?? bar("volume"),
                previousClose: history.previousClose, averageGain: history.averageGain, averageLoss: history.averageLoss, historyError: history.error };
        } catch { return TickerSheetsRsiTargets.failure_("Yahoo RSI2 chart could not be parsed", source); }
    }
    static calculate(snapshot, lowTrigger = 20, highTrigger = 80, field = "all") {
        const wanted = TickerSheetsRsiTargets.field_(field), error = TickerSheetsRsiTargets.validate_(wanted, lowTrigger, highTrigger);
        if (error) return TickerSheetsRsiTargets.failure_(error);
        if (!snapshot?.ok) return snapshot || TickerSheetsRsiTargets.failure_("Yahoo RSI2 chart is unavailable");
        const need = TickerSheetsRsiTargets.needs_(wanted);
        if (need.rsi && snapshot.historyError) return TickerSheetsRsiTargets.failure_(snapshot.historyError, snapshot.source);
        if (need.previous && snapshot.previousClose === null) return TickerSheetsRsiTargets.failure_("A completed prior close is unavailable", snapshot.source);
        const values = { rsi2: null, buy_target: null, sell_target: null, price: snapshot.price, bid: null, ask: null,
            open: snapshot.open, low: snapshot.low, high: snapshot.high, volume: snapshot.volume, previous_close: snapshot.previousClose, previous_rsi2: null };
        if (need.rsi) {
            const gain = snapshot.averageGain, loss = snapshot.averageLoss, change = snapshot.price - snapshot.previousClose;
            values.previous_rsi2 = TickerSheetsRsiTargets.ratio_(gain, loss);
            values.rsi2 = TickerSheetsRsiTargets.ratio_((gain + Math.max(change, 0)) / 2, (loss + Math.max(-change, 0)) / 2);
            if (gain + loss > 0) {
                if (need.buy && lowTrigger <= values.previous_rsi2) {
                    const target = snapshot.previousClose + loss - gain * (100 - lowTrigger) / lowTrigger;
                    values.buy_target = target > 0 && Number.isFinite(target) ? target : null;
                }
                if (need.sell && highTrigger >= values.previous_rsi2) {
                    const target = snapshot.previousClose - gain + loss * highTrigger / (100 - highTrigger);
                    values.sell_target = target > 0 && Number.isFinite(target) ? target : null;
                }
            }
        }
        return { ok: true, status: "Available", symbol: snapshot.symbol, source: snapshot.source, quoteTime: snapshot.quoteTime, sessionDate: snapshot.sessionDate, values };
    }
    static parse(body, symbol, lowTrigger = 20, highTrigger = 80, field = "all") { return TickerSheetsRsiTargets.calculate(TickerSheetsRsiTargets.snapshot(body, symbol), lowTrigger, highTrigger, field); }
    static bidAsk(body, symbol, sessionDate, config) {
        try {
            const payload = typeof body === "string" ? JSON.parse(body) : body, rows = payload?.quoteResponse?.result;
            if (payload?.quoteResponse?.error || !Array.isArray(rows) || rows.length !== 1) return TickerSheetsRsiTargets.failure_("Bid/ask quotes are unavailable");
            const row = rows[0];
            if (typeof row.symbol !== "string" || row.symbol.toUpperCase() !== symbol || TickerSheetsRsiTargets.day_(row.regularMarketTime, config) !== sessionDate) return TickerSheetsRsiTargets.failure_("Matching-session bid/ask quotes are unavailable");
            const bid = TickerSheetsRsiTargets.number_(row.bid), ask = TickerSheetsRsiTargets.number_(row.ask);
            return { ok: bid !== null || ask !== null, status: bid !== null && ask !== null ? "Available" : "Bid/ask partially unavailable", bid, ask, quoteTime: new Date(row.regularMarketTime * 1000).toISOString() };
        } catch { return TickerSheetsRsiTargets.failure_("Bid/ask quotes could not be parsed"); }
    }
    static fetch(ticker, lowTrigger = 20, highTrigger = 80, field = "all", overrides = {}, refresh = "") {
        const wanted = TickerSheetsRsiTargets.field_(field), error = TickerSheetsRsiTargets.validate_(wanted, lowTrigger, highTrigger);
        if (error) return TickerSheetsRsiTargets.failure_(error);
        if (wanted === "headers") return { ok: true, headers: TickerSheetsRsiTargets.headers() };
        let symbol;
        try { symbol = TickerSheetsPublicData.ticker(ticker); } catch { return TickerSheetsRsiTargets.failure_("Enter a supported RSI2 ticker"); }
        const source = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol);
        const snapshot = TickerSheetsPublicData.cached("rsi2-chart", symbol, 60, deps => {
            const response = TickerSheetsPublicData.request(source + "?range=3mo&interval=1d&events=div%2Csplits&includeAdjustedClose=true", deps);
            return { ...TickerSheetsRsiTargets.snapshot(response.body, symbol), http: response.http };
        }, overrides, refresh);
        const result = TickerSheetsRsiTargets.calculate(snapshot, lowTrigger, highTrigger, wanted);
        if (!result?.ok) return result;
        result.retrievedAt = snapshot.retrievedAt; result.cacheHit = snapshot.cacheHit; result.http = snapshot.http;
        if (TickerSheetsRsiTargets.needs_(wanted).bidAsk) {
            const quotes = TickerSheetsPublicData.cached("rsi2-bidask", symbol + ":" + snapshot.sessionDate, 60, deps => {
                const url = "https://query1.finance.yahoo.com/v7/finance/quote?fields=symbol,regularMarketTime,bid,ask&formatted=false&symbols=" + encodeURIComponent(symbol);
                const response = TickerSheetsPublicData.request(url, deps);
                return { ...TickerSheetsRsiTargets.bidAsk(response.body, symbol, snapshot.sessionDate, snapshot.dateConfig), http: response.http };
            }, overrides, refresh);
            result.values.bid = quotes.bid ?? null; result.values.ask = quotes.ask ?? null;
            result.bidAskStatus = quotes.status; result.bidAskQuoteTime = quotes.quoteTime || null;
            if (!quotes.ok || quotes.bid === null || quotes.ask === null) result.status = "RSI2 available; bid/ask partially unavailable";
        }
        return result;
    }
}

/** RSI(2) trigger targets and quote fields. Missing targets remain N/A. @customfunction */
function TICKERSHEETS_RSI_TARGETS(ticker, lowTrigger = 20, highTrigger = 80, field = "all", refresh = "") {
    try {
        const wanted = TickerSheetsRsiTargets.field_(field), result = TickerSheetsRsiTargets.fetch(ticker, lowTrigger, highTrigger, wanted, {}, refresh);
        if (!result?.ok) return TickerSheetsPublicData.error(result);
        if (wanted === "headers") return [result.headers];
        return wanted === "all" ? [TickerSheetsRsiTargets.headers(), TickerSheetsRsiTargets.fields().map(name => TickerSheetsPublicData.safe(result.values[name]))] : TickerSheetsPublicData.safe(result.values[wanted]);
    } catch { return "N/A: RSI2 targets are unavailable"; }
}
