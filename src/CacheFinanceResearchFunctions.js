/*  *** DEBUG START ***
import { CFAnalysisData } from "./CacheFinanceAnalysisData.js";
import { CFAnalysisDetails } from "./CacheFinanceAnalysisDetails.js";
import { CFAnalysisOptions } from "./CacheFinanceAnalysisOptions.js";
import { CFAnalysisFred } from "./CacheFinanceAnalysisFred.js";
export { CFPublicData, CFQUOTE, CFHISTORY, CFFUNDAMENTALS, CFOPTIONS, CFEXPIRATIONS, CFFRED, CFFIELD, CFDATASTATUS, CFSTRATEGY };
//  *** DEBUG END ***/

/** Public data only enters this cache. Keys, cookies and request URLs never enter it. */
class CFPublicData {
    static dependencies(overrides = {}) {
        let cache = overrides.cache;
        if (cache === undefined) { try { cache = CacheService.getScriptCache(); } catch { cache = null; } }
        return { fetch: overrides.fetch || ((url, options) => UrlFetchApp.fetch(url, options)),
            clock: overrides.clock || (() => Date.now()), cache,
            fredKey: overrides.fredKey || (() => { try { return PropertiesService.getScriptProperties().getProperty("FRED_API_KEY") || ""; } catch { return ""; } }) };
    }

    static ticker(input) { return CFAnalysisData.normalizeTicker(input).yahooSymbol; }
    static safe(value) { return typeof value === "number" && !Number.isFinite(value) ? "N/A" : typeof value === "string" && /^\s*[=+@-]/.test(value) ? "'" + value : value ?? "N/A"; }
    static failure(error, source = "") { return { ok: false, status: error, source, retrievedAt: null, cacheHit: false }; }
    static error(result) { return "N/A: " + (result?.status || result?.error || "Data unavailable"); }

    static cached(kind, identity, ttl, load, overrides = {}, refresh = "") {
        const deps = CFPublicData.dependencies(overrides);
        if (refresh != null && typeof refresh !== "string" && typeof refresh !== "number") return CFPublicData.failure("Use a whole refresh number from 0 to 2147483647.");
        const token = String(refresh ?? "");
        if (token !== "" && (!/^\d{1,10}$/.test(token) || Number(token) > 2147483647)) return CFPublicData.failure("Use a whole refresh number from 0 to 2147483647.");
        const key = "CFPUBLIC:v1:" + kind + ":" + identity + ":" + token;
        try {
            const stored = deps.cache?.get(key);
            if (stored) {
                let data = JSON.parse(stored);
                if (Object.prototype.hasOwnProperty.call(data, "cfChunks")) {
                    if (!Number.isInteger(data.cfChunks) || data.cfChunks < 1 || data.cfChunks > 20 || typeof data.prefix !== "string" || !data.prefix.startsWith(key + ":")) throw new Error("Invalid public cache entry");
                    let joined = "";
                    for (let i = 0; i < data.cfChunks; i++) { const part = deps.cache.get(data.prefix + i); if (typeof part !== "string" || !part.length) throw new Error("Partial public cache entry"); joined += part; }
                    data = JSON.parse(joined);
                }
                const age = deps.clock() - Date.parse(data.retrievedAt);
                if (data.ok === true && age >= 0 && age < ttl * 1000) return { ...data, cacheHit: true };
            }
        } catch { /* A cache miss must not block a public request. */ }
        let data;
        try { data = load(deps); } catch { return CFPublicData.failure("Request or response unavailable."); }
        data = { ...data, retrievedAt: new Date(deps.clock()).toISOString(), cacheHit: false };
        if (data.ok) {
            try {
                const json = JSON.stringify(data);
                if (json.length < 30000) deps.cache?.put(key, json, ttl);
                else if (deps.cache && json.length <= 600000) {
                    const prefix = key + ":" + deps.clock() + ":" + Math.random().toString(36).slice(2, 10) + ":", count = Math.ceil(json.length / 30000);
                    for (let i = 0; i < count; i++) deps.cache.put(prefix + i, json.slice(i * 30000, (i + 1) * 30000), ttl);
                    deps.cache.put(key, JSON.stringify({ cfChunks: count, prefix }), ttl);
                }
            } catch { /* Public results can be used without caching. */ }
        }
        return data;
    }

    static request(url, deps) {
        try {
            const response = deps.fetch(url, { method: "get", muteHttpExceptions: true, followRedirects: true });
            const http = response.getResponseCode();
            return { http, body: http >= 200 && http < 300 ? response.getContentText() : "" };
        } catch { return { http: 0, body: "" }; }
    }

    static chart(input, overrides = {}, refresh = "") {
        const symbol = CFPublicData.ticker(input);
        return CFPublicData.cached("chart:v2", symbol, 60, deps => {
            const source = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol);
            const response = CFPublicData.request(source + "?range=2y&interval=1d&events=div%2Csplits&includeAdjustedClose=true", deps);
            const chart = CFAnalysisData.parseChart(response.body, symbol);
            return { ok: chart.ok, symbol, source, http: response.http, chart,
                status: chart.ok ? "Available" : response.http === 200 ? chart.error : "HTTP " + response.http, quoteTime: chart.quoteTime || null };
        }, overrides, refresh);
    }

    static details(input, overrides = {}, refresh = "") {
        const symbol = CFPublicData.ticker(input);
        return CFPublicData.cached("details:v2", symbol, 900, deps => {
            const source = "https://finance.yahoo.com/quote/" + encodeURIComponent(symbol) + "/";
            const response = CFPublicData.request(source, deps), statistics = CFAnalysisData.parseStatistics(response.body, symbol), details = CFAnalysisDetails.parsePage(response.body, symbol);
            const fields = { ...(statistics.fields || {}) };
            for (const [id, field] of Object.entries(details.fields || {})) if (field.value != null || !fields[id]) fields[id] = field;
            const ok = details.ok || statistics.ok;
            return { ok, symbol, source, http: response.http, details, fields, status: ok ? "Available" : response.http === 200 ? "Matching fundamentals unavailable" : "HTTP " + response.http };
        }, overrides, refresh);
    }

    /** Session quotes use a separate one-minute cache, never the fifteen-minute fundamentals cache. */
    static quote(input, overrides = {}, refresh = "") {
        const chartData = CFPublicData.chart(input, overrides, refresh);
        if (!chartData.ok) return chartData;
        const symbol = chartData.symbol;
        const detailData = CFPublicData.cached("quote-sessions:v1", symbol, 60, deps => {
            const source = "https://finance.yahoo.com/quote/" + encodeURIComponent(symbol) + "/";
            const response = CFPublicData.request(source, deps), details = CFAnalysisDetails.parsePage(response.body, symbol);
            return { ok: details.ok, symbol, source, http: response.http, quoteSessions: details.quoteSessions || null,
                status: details.ok ? "Available" : "Extended-session quote unavailable" };
        }, overrides, refresh);
        const quote = CFAnalysisData.selectQuote(chartData.chart, { ok: detailData.ok, symbol, quoteSessions: detailData.quoteSessions });
        return { ...chartData, quote, quoteTime: quote.quoteTime, source: quote.source === "Yahoo Chart API" ? chartData.source : quote.source || chartData.source,
            retrievedAt: detailData.ok && quote.source === detailData.source ? detailData.retrievedAt : chartData.retrievedAt,
            cacheHit: chartData.cacheHit && detailData.cacheHit, extendedQuoteStatus: detailData.status };
    }

    static options(input, expiration = "", overrides = {}, refresh = "") {
        const symbol = CFPublicData.ticker(input);
        if (expiration instanceof Date) {
            if (!Number.isFinite(expiration.getTime())) return CFPublicData.failure("Use a valid expiration date.");
            try {
                const book = SpreadsheetApp.getActiveSpreadsheet();
                expiration = typeof Utilities !== "undefined" && typeof Utilities.formatDate === "function"
                    ? Utilities.formatDate(expiration, book.getSpreadsheetTimeZone(), "yyyy-MM-dd") : expiration.toISOString().slice(0, 10);
            } catch { return CFPublicData.failure("The expiration date could not be read in the spreadsheet time zone."); }
        }
        const expiry = CFAnalysisOptions.expiration_(expiration);
        if (!expiry) return CFPublicData.failure("Use an expiration in YYYY-MM-DD format.");
        return CFPublicData.cached("options", symbol + ":" + expiry.date, 60, deps => {
            const options = CFAnalysisOptions.fetchChain(symbol, expiry.date, deps.fetch);
            return { ok: options.ok, symbol, source: options.source, http: options.http, quoteTime: options.quoteTime, options,
                status: options.ok ? "Available" : options.error };
        }, overrides, refresh);
    }

    /** FRED API definitions: https://fred.stlouisfed.org/docs/api/fred/series_observations.html */
    static fred(seriesId, count = 60, overrides = {}, refresh = "") {
        const id = typeof seriesId === "string" ? seriesId.trim().toUpperCase() : "";
        if (!/^[A-Z0-9_]{1,50}$/.test(id) || !Number.isInteger(count) || count < 1 || count > 1000) return CFPublicData.failure("Use a FRED series ID and 1–1000 observations.");
        const deps = CFPublicData.dependencies(overrides), key = typeof deps.fredKey === "function" ? deps.fredKey() : deps.fredKey;
        const source = "https://fred.stlouisfed.org/series/" + id;
        if (typeof key !== "string" || !/^[a-z0-9]{32}$/.test(key)) return CFPublicData.failure("FRED API key required. Use the CacheFinance menu.", source);
        return CFPublicData.cached("fred", id + ":" + count, 3600, services => {
            // The private URL is sent only to FRED. Raw bodies and exceptions never leave this method.
            const parameters = "?series_id=" + encodeURIComponent(id) + "&api_key=" + encodeURIComponent(key) + "&file_type=json";
            const metaResponse = CFPublicData.request("https://api.stlouisfed.org/fred/series" + parameters, services);
            const meta = JSON.parse(metaResponse.body)?.seriess;
            if (!Array.isArray(meta) || meta.length !== 1 || meta[0]?.id !== id) return CFPublicData.failure("FRED series metadata unavailable.", source);
            const row = meta[0], response = CFPublicData.request("https://api.stlouisfed.org/fred/series/observations" + parameters + "&units=lin&output_type=1&sort_order=desc&limit=" + count, services);
            const payload = JSON.parse(response.body);
            if (payload?.error_code || !Array.isArray(payload?.observations) || payload.units && payload.units !== "lin") return CFPublicData.failure("FRED observations unavailable.", source);
            const dates = new Map();
            for (const observation of payload.observations) {
                const value = CFAnalysisFred.value_(observation?.value);
                if (!CFAnalysisFred.date_(observation?.date) || !value.valid || dates.has(observation.date) && dates.get(observation.date) !== value.value) return CFPublicData.failure("FRED returned invalid observations.", source);
                dates.set(observation.date, value.value);
            }
            return { ok: true, symbol: id, seriesId: id, source, status: "Available", http: response.http,
                label: typeof row.title === "string" ? row.title : id, unit: typeof row.units === "string" ? row.units : "Units unavailable",
                frequency: typeof row.frequency === "string" ? row.frequency : "", seasonalAdjustment: typeof row.seasonal_adjustment === "string" ? row.seasonal_adjustment : "",
                observations: [...dates].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value })) };
        }, deps, refresh);
    }

    static provider(provider, input, overrides = {}, refresh = "") {
        const symbol = CFAnalysisData.normalizeTicker(input).yahooSymbol, id = String(provider || "").trim().toUpperCase();
        if (typeof CFSmfProviders === "undefined") return CFPublicData.failure("Provider adapter unavailable.");
        return CFPublicData.cached("provider", id + ":" + symbol, 300, deps => CFSmfProviders.fetch(id, symbol, deps), overrides, refresh);
    }

    static fieldRows(fields, source = "") {
        return [["Field", "Value", "Unit", "Currency", "Source"], ...Object.entries(fields).map(([id, row]) => [id, row.value, row.unit || "", row.currency || "", row.source || source].map(CFPublicData.safe))];
    }

    static quoteFields(data) {
        const chart = data.chart || {}, metrics = chart.metrics || {}, quote = data.quote || CFAnalysisData.selectQuote(chart);
        return { price: quote.price, name: chart.name, currency: chart.currency, exchange: chart.exchange, quote_time: quote.quoteTime,
            price_session: quote.session, market_state: quote.marketState,
            regular_price: quote.regular.price, regular_time: quote.regular.quoteTime, regular_change: quote.regular.change, regular_change_fraction: quote.regular.changeFraction,
            pre_market_price: quote.pre.price, pre_market_time: quote.pre.quoteTime, pre_market_change: quote.pre.change, pre_market_change_fraction: quote.pre.changeFraction,
            post_market_price: quote.post.price, post_market_time: quote.post.quoteTime, post_market_change: quote.post.change, post_market_change_fraction: quote.post.changeFraction,
            previous_close: chart.previousClose, day_high: metrics.dayHigh, day_low: metrics.dayLow, volume: metrics.volume,
            fifty_two_week_high: metrics.fiftyTwoWeekHigh, fifty_two_week_low: metrics.fiftyTwoWeekLow, market_cap: metrics.marketCap,
            retrieved_at: data.retrievedAt, status: data.status, source: data.source };
    }
}

/** Quote field or two-column table. Refresh is an optional editable number, not NOW(). @customfunction */
function CFQUOTE(ticker, field = "price", refresh = "") {
    try {
        const wanted = String(field).trim().toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(CFPublicData.quoteFields({}), wanted) && wanted !== "all") return "N/A: Unsupported quote field";
        const sessionFields = ["price", "quote_time", "price_session", "market_state", "retrieved_at", "status", "source", "all"];
        const data = sessionFields.includes(wanted) || /^(?:pre|post)_market_/.test(wanted) ? CFPublicData.quote(ticker, {}, refresh) : CFPublicData.chart(ticker, {}, refresh);
        if (!data.ok) return CFPublicData.error(data);
        const fields = CFPublicData.quoteFields(data);
        return wanted === "all" ? [["Field", "Value"], ...Object.entries(fields).map(([id, value]) => [id, CFPublicData.safe(value)])] : CFPublicData.safe(fields[wanted]);
    } catch { return "N/A: Enter a supported ticker and quote field"; }
}

/** Daily OHLCV and adjusted close, up to two years. @customfunction */
function CFHISTORY(ticker, sessions = 252, refresh = "") {
    try {
        if (!Number.isInteger(sessions) || sessions < 1 || sessions > 510) return "N/A: Choose 1–510 daily sessions";
        const data = CFPublicData.chart(ticker, {}, refresh);
        if (!data.ok) return CFPublicData.error(data);
        return [["Date", "Open", "High", "Low", "Close", "Adjusted close", "Volume"], ...data.chart.history.slice(-sessions).map(row => [row.date, row.open, row.high, row.low, row.close, row.adjustedClose, row.volume].map(CFPublicData.safe))];
    } catch { return "N/A: Enter a supported ticker"; }
}

/** Named fundamental field, or all fields with units and source. @customfunction */
function CFFUNDAMENTALS(ticker, field = "all", refresh = "") {
    try {
        const data = CFPublicData.details(ticker, {}, refresh);
        if (!data.ok) return CFPublicData.error(data);
        const wanted = String(field).trim().toLowerCase();
        return wanted === "all" ? CFPublicData.fieldRows(data.fields, data.source) : CFPublicData.safe(data.fields[wanted]?.value);
    } catch { return "N/A: Enter a supported ticker and fundamental field"; }
}

/** Standard option contracts for one published expiration. @customfunction */
function CFOPTIONS(ticker, expiration = "", refresh = "") {
    try {
        const data = CFPublicData.options(ticker, expiration, {}, refresh);
        if (!data.ok) return CFPublicData.error(data);
        return [["Expiration", "Type", "Strike", "Bid", "Ask", "Mid", "Last", "IV fraction", "Volume", "Open interest", "Last trade", "Contract"],
            ...data.options.contracts.map(row => [row.expiration, row.type, row.strike, row.bid, row.ask, row.mid, row.last, row.iv, row.volume, row.openInterest, row.lastTrade, row.contractSymbol].map(CFPublicData.safe))];
    } catch { return "N/A: Enter a ticker and optional YYYY-MM-DD expiration"; }
}

/** Published option expiration dates. @customfunction */
function CFEXPIRATIONS(ticker, refresh = "") {
    try { const data = CFPublicData.options(ticker, "", {}, refresh); return data.ok ? [["Expiration"], ...data.options.expirations.map(value => [value])] : CFPublicData.error(data); }
    catch { return "N/A: Enter a supported ticker"; }
}

/** FRED observation levels. The key comes from the private settings menu. @customfunction */
function CFFRED(seriesId, observations = 60, refresh = "") {
    try {
        const data = CFPublicData.fred(seriesId, observations, {}, refresh);
        if (!data.ok) return CFPublicData.error(data);
        return [["Date", "Value", "Unit", "Series", "Source"], ...data.observations.map(row => [row.date, row.value, data.unit, data.seriesId, data.source].map(CFPublicData.safe))];
    } catch { return "N/A: FRED data unavailable"; }
}

/** Selected SMF provider field by name or supported SMF number. @customfunction */
function CFFIELD(provider, ticker, field = "all", refresh = "") {
    try {
        const wanted = String(field).trim().toLowerCase();
        const id = typeof CFSmfProviders !== "undefined" && typeof CFSmfProviders.resolveField === "function" ? CFSmfProviders.resolveField(provider, wanted) : null;
        if (wanted !== "all" && !id) return "N/A: Unsupported provider field";
        const data = CFPublicData.provider(provider, ticker, {}, refresh);
        if (!data.ok) return CFPublicData.error(data);
        return wanted === "all" ? CFPublicData.fieldRows(data.fields, data.source) : CFPublicData.safe(data.fields[id]?.value);
    } catch { return "N/A: Enter a supported provider, ticker and field"; }
}

/** Status, retrieval time and source for the same cached dataset as the data formula. @customfunction */
function CFDATASTATUS(ticker, dataset = "quote", argument = "", refresh = "") {
    try {
        const kind = String(dataset).trim().toLowerCase();
        const data = kind === "quote" ? CFPublicData.quote(ticker, {}, refresh) : kind === "history" ? CFPublicData.chart(ticker, {}, refresh)
            : kind === "fundamentals" ? CFPublicData.details(ticker, {}, refresh)
            : kind === "options" ? CFPublicData.options(ticker, argument, {}, refresh)
            : kind === "fred" ? CFPublicData.fred(ticker, argument || 60, {}, refresh)
            : kind === "provider" ? CFPublicData.provider(argument, ticker, {}, refresh) : CFPublicData.failure("Unsupported dataset");
        return [["Status", "Retrieved at", "Quote time", "Cached", "Source"], [data.status, data.retrievedAt, data.quoteTime, data.cacheHit, data.source].map(CFPublicData.safe)];
    } catch { return "N/A: Data status unavailable"; }
}

/** Strategy result for transparent per-share inputs and a contract multiplier. @customfunction */
function CFSTRATEGY(strategy, spot, longStrike, longPremium, shortStrike, shortPremium, contracts = 1, multiplier = 100, expiration = "", metric = "maxProfit", stockAtExpiry) {
    try {
        if (typeof CFAnalysisStrategies === "undefined") return "N/A: Strategy model unavailable";
        const input = { strategy, spot, longStrike, longPremium, shortStrike, shortPremium, contracts, multiplier, expiration };
        const result = CFAnalysisStrategies.calculate(input), id = String(metric).trim().toLowerCase();
        if (!result.ok) return "N/A: " + (result.error || "Invalid strategy inputs");
        if (id === "payoff") return CFPublicData.safe(CFAnalysisStrategies.payoff(input, stockAtExpiry));
        const field = Object.keys(result).find(name => name.toLowerCase() === id);
        return field ? CFPublicData.safe(result[field]) : "N/A: Unsupported strategy metric";
    } catch { return "N/A: Invalid strategy inputs"; }
}
