/*  *** DEBUG START ***
export { TickerSheetsKeyedQuotes };
//  *** DEBUG END ***/

/** Explicit authenticated quote adapters. Only accepted quote fields leave this class. */
class TickerSheetsKeyedQuotes {
    static get providers() {
        return {
            FINNHUB: { label: "Finnhub", property: "FINNHUB_API_KEY" },
            ALPHA_VANTAGE: { label: "Alpha Vantage", property: "ALPHA_VANTAGE_API_KEY" },
            TWELVE_DATA: { label: "Twelve Data", property: "TWELVE_DATA_API_KEY" },
            COINMARKET: { label: "CoinMarketCap", property: "COINMARKET_API_KEY" }
        };
    }
    static get fields() { return ["price", "name", "symbol", "currency", "quote_time", "quote_date", "bar_time", "price_basis", "previous_close", "day_open", "day_high", "day_low", "volume", "change", "change_fraction", "change_period", "source", "status", "retrieved_at"]; }
    static provider(value) {
        if (typeof value !== "string") throw new Error("Invalid provider");
        const id = ({ FINNHUB: "FINNHUB", ALPHAVANTAGE: "ALPHA_VANTAGE", TWELVEDATA: "TWELVE_DATA", COINMARKET: "COINMARKET", COINMARKETCAP: "COINMARKET" })[value.trim().toUpperCase().replace(/[ _-]/g, "")];
        if (!id) throw new Error("Invalid provider");
        return id;
    }
    static identity(value, provider) {
        if (typeof value !== "string" || !value.trim() || value.length > 50) throw new Error("Invalid symbol");
        let symbol = value.trim().toUpperCase();
        if (/^CURRENCY:[A-Z]{6}$/.test(symbol)) symbol = symbol.slice(9, 12) + "/" + symbol.slice(12);
        const pair = symbol.match(/^([A-Z0-9]{2,10})\/([A-Z]{3})$/);
        if (provider === "COINMARKET") {
            if (pair) return { symbol: pair[1], currency: pair[2], identity: pair[1] + "/" + pair[2], pair: true };
            if (/^[A-Z][A-Z0-9]{1,9}$/.test(symbol)) return { symbol, currency: "USD", identity: symbol + "/USD", pair: true };
            throw new Error("Invalid cryptocurrency symbol");
        }
        if (pair) {
            if (provider === "FINNHUB") throw new Error("Unsupported symbol");
            return { symbol: pair[1] + "/" + pair[2], currency: pair[2], base: pair[1], identity: pair[1] + "/" + pair[2], pair: true };
        }
        const qualified = symbol.match(/^(NASDAQ|NYSE|NYSEARCA|AMEX):(.+)$/);
        const exchange = provider === "TWELVE_DATA" && qualified ? qualified[1] : null;
        if (qualified) symbol = qualified[2];
        if (!/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(symbol) || !/[A-Z]/.test(symbol)) throw new Error("Invalid stock symbol");
        return { symbol, exchange, identity: exchange ? exchange + ":" + symbol : symbol, pair: false };
    }
    static number(value, minimum = -Infinity) {
        if (typeof value !== "number" && (typeof value !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))) return null;
        const number = Number(value);
        return Number.isFinite(number) && number >= minimum ? number : null;
    }
    static text(value) {
        return typeof value === "string" && value.length > 0 && value.length <= 160 && !/[\x00-\x1F]|https?:\/\/|(?:api[_-]?key|token|cookie)\s*[=:]/i.test(value) ? value : null;
    }
    static date(value) {
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
        const parsed = Date.parse(value + "T00:00:00Z");
        return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value ? value : null;
    }
    static time(value, epoch = false) {
        if (epoch) {
            const seconds = TickerSheetsKeyedQuotes.number(value, 1);
            return seconds !== null && seconds < 253402300800 ? new Date(seconds * 1000).toISOString() : null;
        }
        return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
    }
    static error(status, source) { return { ok: false, status, source }; }
    static fetch(provider, identity, key, deps) {
        const helper = TickerSheetsKeyedQuotes, source = helper.providers[provider].label;
        const fields = Object.fromEntries(helper.fields.filter(id => !["status", "retrieved_at"].includes(id)).map(id => [id, null]));
        Object.assign(fields, { symbol: identity.symbol, source });
        let url, headers = { Accept: "application/json" };
        if (provider === "FINNHUB") { url = "https://finnhub.io/api/v1/quote?symbol=" + encodeURIComponent(identity.symbol); headers["X-Finnhub-Token"] = key; }
        else if (provider === "ALPHA_VANTAGE") url = "https://www.alphavantage.co/query?function=" + (identity.pair ? "CURRENCY_EXCHANGE_RATE&from_currency=" + encodeURIComponent(identity.base) + "&to_currency=" + encodeURIComponent(identity.currency) : "GLOBAL_QUOTE&symbol=" + encodeURIComponent(identity.symbol)) + "&apikey=" + encodeURIComponent(key);
        else if (provider === "TWELVE_DATA") { url = "https://api.twelvedata.com/quote?symbol=" + encodeURIComponent(identity.symbol) + (identity.exchange ? "&exchange=" + encodeURIComponent(identity.exchange) : ""); headers.Authorization = "apikey " + key; }
        else { url = "https://pro-api.coinmarketcap.com/v3/cryptocurrency/quotes/latest?symbol=" + encodeURIComponent(identity.symbol) + "&convert=" + encodeURIComponent(identity.currency); headers["X-CMC_PRO_API_KEY"] = key; }
        let payload;
        try {
            const response = deps.fetch(url, { method: "get", headers, muteHttpExceptions: true, followRedirects: false }), code = response.getResponseCode();
            if (code < 200 || code >= 300) return helper.error(code === 429 ? source + " rate limit reached." : code === 401 || code === 403 ? source + " access denied; check your key and plan." : source + " request unavailable.", source);
            payload = JSON.parse(response.getContentText());
        } catch { return helper.error(source + " request or response unavailable.", source); }
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) return helper.error(source + " response unavailable.", source);
        if (payload.error || payload["Error Message"] || payload.Note || payload.Information || payload.status === "error" || payload.code || payload.status?.error_code != null && Number(payload.status.error_code) !== 0) return helper.error(source + " provider error or quota limit; check your key and plan.", source);
        const n = helper.number, t = helper.text;
        if (provider === "FINNHUB") {
            fields.quote_time = helper.time(payload.t, true);
            if (!fields.quote_time) return helper.error(source + " quote unavailable.", source);
            Object.assign(fields, { price: n(payload.c, 0), day_open: n(payload.o, 0), day_high: n(payload.h, 0), day_low: n(payload.l, 0), previous_close: n(payload.pc, 0), change: n(payload.d), change_fraction: n(payload.dp) === null ? null : n(payload.dp) / 100, change_period: "previous_close", price_basis: "Provider current quote; availability depends on entitlement" });
        } else if (provider === "ALPHA_VANTAGE") {
            if (identity.pair) {
                const row = payload["Realtime Currency Exchange Rate"];
                if (!row || row["1. From_Currency Code"] !== identity.base || row["3. To_Currency Code"] !== identity.currency) return helper.error(source + " returned another symbol.", source);
                const time = row["6. Last Refreshed"];
                fields.quote_time = row["7. Time Zone"] === "UTC" && typeof time === "string" ? helper.time(time.replace(" ", "T") + "Z") : null;
                Object.assign(fields, { price: n(row["5. Exchange Rate"], 0), currency: identity.currency, name: t(row["2. From_Currency Name"]), price_basis: "Provider currency exchange rate" });
            } else {
                const row = payload["Global Quote"];
                if (!row || row["01. symbol"] !== identity.symbol) return helper.error(source + " returned another symbol.", source);
                const percent = typeof row["10. change percent"] === "string" ? row["10. change percent"].replace(/%$/, "") : null;
                Object.assign(fields, { price: n(row["05. price"], 0), quote_date: helper.date(row["07. latest trading day"]), day_open: n(row["02. open"], 0), day_high: n(row["03. high"], 0), day_low: n(row["04. low"], 0), volume: n(row["06. volume"], 0), previous_close: n(row["08. previous close"], 0), change: n(row["09. change"]), change_fraction: n(percent) === null ? null : n(percent) / 100, change_period: "previous_close", price_basis: "End-of-day global quote; default entitlement" });
            }
        } else if (provider === "TWELVE_DATA") {
            if (payload.symbol !== identity.symbol) return helper.error(source + " returned another symbol.", source);
            if (identity.exchange && (typeof payload.exchange !== "string" || payload.exchange.toUpperCase().replace(/[ _-]/g, "") !== identity.exchange)) return helper.error(source + " returned another exchange.", source);
            const currency = t(payload.currency);
            fields.quote_time = helper.time(payload.last_quote_at, true); fields.bar_time = helper.time(payload.timestamp, true);
            Object.assign(fields, { price: n(payload.close, 0), name: t(payload.name), currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : identity.pair ? identity.currency : null,
                day_open: n(payload.open, 0), day_high: n(payload.high, 0), day_low: n(payload.low, 0), previous_close: n(payload.previous_close, 0), volume: n(payload.volume, 0), change: n(payload.change), change_fraction: n(payload.percent_change) === null ? null : n(payload.percent_change) / 100, change_period: "previous_close", price_basis: "Provider quote close; bar_time is the bar opening time" });
        } else {
            if (!Array.isArray(payload.data)) return helper.error(source + " response unavailable.", source);
            const matches = payload.data.filter(row => row?.symbol === identity.symbol && row.is_active !== 0);
            if (matches.length !== 1) return helper.error(source + " symbol unavailable or ambiguous.", source);
            const row = matches[0], quotes = Array.isArray(row.quote) ? row.quote.filter(quote => quote?.symbol === identity.currency) : [];
            if (quotes.length !== 1) return helper.error(source + " conversion quote unavailable.", source);
            const quote = quotes[0];
            Object.assign(fields, { price: n(quote.price, 0), currency: identity.currency, name: t(row.name), quote_time: helper.time(quote.last_updated), volume: n(quote.volume_24h, 0), change_fraction: n(quote.percent_change_24h) === null ? null : n(quote.percent_change_24h) / 100, change_period: "24_hours", price_basis: "Aggregated cryptocurrency market quote; volume is 24-hour quote-currency turnover" });
        }
        if (fields.price === null) return helper.error(source + " price unavailable.", source);
        if (fields.quote_time && !fields.quote_date) fields.quote_date = fields.quote_time.slice(0, 10);
        // A provider must not be able to echo the authentication key into a cached field.
        for (const [id, value] of Object.entries(fields)) if (typeof value === "string" && value.includes(key)) fields[id] = null;
        return { ok: true, status: "Available", symbol: identity.identity, source, quoteTime: fields.quote_time, fields };
    }
}
