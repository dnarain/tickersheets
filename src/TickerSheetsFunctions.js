/*  *** DEBUG START ***
import { TickerSheetsData } from "./TickerSheetsData.js";
import { TickerSheetsDetails } from "./TickerSheetsDetails.js";
import { TickerSheetsOptions } from "./TickerSheetsOptions.js";
import { TickerSheetsFred } from "./TickerSheetsFred.js";
import { TickerSheetsProviderFields } from "./TickerSheetsProviderFields.js";
import { TickerSheetsKeyedQuotes } from "./TickerSheetsKeyedQuotes.js";
export { TickerSheetsPublicData, TICKERSHEETS_QUOTE, TICKERSHEETS_PROVIDER_QUOTE, TICKERSHEETS_HISTORY, TICKERSHEETS_FUNDAMENTALS, TICKERSHEETS_OPTIONS, TICKERSHEETS_EXPIRATIONS, TICKERSHEETS_FRED, TICKERSHEETS_FIELD, TICKERSHEETS_DATA_STATUS, TICKERSHEETS_STRATEGY };
//  *** DEBUG END ***/

/** Public data only enters this cache. Keys, cookies and request URLs never enter it. */
class TickerSheetsPublicData {
    static dependencies(overrides = {}) {
        let cache = overrides.cache;
        if (cache === undefined) { try { cache = CacheService.getScriptCache(); } catch { cache = null; } }
        return { fetch: overrides.fetch || ((url, options) => UrlFetchApp.fetch(url, options)),
            clock: overrides.clock || (() => Date.now()), cache,
            fredKey: overrides.fredKey || (() => { try { return PropertiesService.getScriptProperties().getProperty("FRED_API_KEY") || ""; } catch { return ""; } }) };
    }

    static ticker(input) { return TickerSheetsData.normalizeTicker(input).yahooSymbol; }
    static keyedQuote(input, provider, overrides = {}, refresh = "") {
        const id = TickerSheetsKeyedQuotes.provider(provider), identity = TickerSheetsKeyedQuotes.identity(input, id), metadata = TickerSheetsKeyedQuotes.providers[id];
        if (refresh != null && typeof refresh !== "string" && typeof refresh !== "number" || String(refresh ?? "") !== "" && (!/^\d{1,10}$/.test(String(refresh)) || Number(refresh) > 2147483647)) return TickerSheetsPublicData.failure("Use a whole refresh number from 0 to 2147483647.", metadata.label);
        let key;
        try { key = overrides.getKey ? overrides.getKey(metadata.property) : PropertiesService.getScriptProperties().getProperty(metadata.property); } catch { key = ""; }
        if (typeof key !== "string" || !key.trim() || /[\s\x00-\x1F]/.test(key) || key.length > 512) return TickerSheetsPublicData.failure(metadata.label + " API key required. Use TickerSheets → API keys….", metadata.label);
        return TickerSheetsPublicData.cached("keyed-quote:v1", id + ":" + identity.identity, 60,
            deps => TickerSheetsKeyedQuotes.fetch(id, identity, key, deps), overrides, refresh);
    }
    static safe(value) { return typeof value === "number" && !Number.isFinite(value) ? "N/A" : typeof value === "string" && /^\s*[=+@-]/.test(value) ? "'" + value : value ?? "N/A"; }
    static failure(error, source = "") { return { ok: false, status: error, source, retrievedAt: null, cacheHit: false }; }
    static error(result) { return "N/A: " + (result?.status || result?.error || "Data unavailable"); }

    static setAutomaticRefresh(number) {
        if (!Number.isInteger(number) || number < 0 || number > 2147483647) return false;
        try { CacheService.getScriptCache().put("TickerSheetsPUBLIC:auto-refresh:v1", String(number), 21600); return true; }
        catch { return false; }
    }

    static automaticRefresh_(cache) {
        try {
            const value = cache?.get("TickerSheetsPUBLIC:auto-refresh:v1");
            if (typeof value === "string" && /^\d{1,10}$/.test(value) && Number(value) <= 2147483647) return String(Number(value));
        } catch { /* Default formulas can run without a saved automatic refresh number. */ }
        return "";
    }

    static readCache_(deps, key, ttl) {
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
        return null;
    }

    static loadCached_(deps, key, ttl, load) {
        let data;
        try { data = load(deps); } catch { return TickerSheetsPublicData.failure("Request or response unavailable."); }
        const completedAt = deps.clock(), receivedAt = Date.parse(data?.retrievedAt);
        data = { ...data, retrievedAt: Number.isFinite(receivedAt) && receivedAt <= completedAt ? data.retrievedAt : new Date(completedAt).toISOString(), cacheHit: false };
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

    static cached(kind, identity, ttl, load, overrides = {}, refresh = "") {
        const deps = TickerSheetsPublicData.dependencies(overrides);
        if (refresh != null && typeof refresh !== "string" && typeof refresh !== "number") return TickerSheetsPublicData.failure("Use a whole refresh number from 0 to 2147483647.");
        let token = String(refresh ?? "");
        if (token !== "" && (!/^\d{1,10}$/.test(token) || Number(token) > 2147483647)) return TickerSheetsPublicData.failure("Use a whole refresh number from 0 to 2147483647.");
        if (token === "") token = TickerSheetsPublicData.automaticRefresh_(deps.cache);
        const key = "TickerSheetsPUBLIC:v1:" + kind + ":" + identity + ":" + token;
        const ready = TickerSheetsPublicData.readCache_(deps, key, ttl);
        if (ready) return ready;
        // Scalar quote and fundamental formulas share these two leaf requests.
        // Other loaders can call cached() themselves, so they must not hold this lock.
        if (!deps.cache || !["chart:v2", "quote-page:v1"].includes(kind)) return TickerSheetsPublicData.loadCached_(deps, key, ttl, load);
        let lock;
        try { lock = LockService.getScriptLock(); } catch { /* Allow environments without the Apps Script lock service. */ }
        if (!lock) return TickerSheetsPublicData.loadCached_(deps, key, ttl, load);
        let acquired = false;
        try {
            try { acquired = lock.tryLock(10000); }
            catch { return TickerSheetsPublicData.failure("Request coordination unavailable. Try refreshing again."); }
            // Another formula can fill this cache while this execution waits.
            const completed = TickerSheetsPublicData.readCache_(deps, key, ttl);
            if (completed) return completed;
            if (!acquired) return TickerSheetsPublicData.failure("Another request is still loading public data. Refresh again when it finishes.");
            return TickerSheetsPublicData.loadCached_(deps, key, ttl, load);
        } finally {
            if (acquired) { try { lock.releaseLock(); } catch { /* Apps Script also releases locks when execution ends. */ } }
        }
    }

    static request(url, deps) {
        try {
            const response = deps.fetch(url, { method: "get", muteHttpExceptions: true, followRedirects: true });
            const http = response.getResponseCode();
            return { http, body: http >= 200 && http < 300 ? response.getContentText() : "" };
        } catch { return { http: 0, body: "" }; }
    }

    static chart(input, overrides = {}, refresh = "") {
        const symbol = TickerSheetsPublicData.ticker(input);
        return TickerSheetsPublicData.cached("chart:v2", symbol, 60, deps => {
            const source = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol);
            const response = TickerSheetsPublicData.request(source + "?range=2y&interval=1d&events=div%2Csplits&includeAdjustedClose=true", deps);
            const chart = TickerSheetsData.parseChart(response.body, symbol);
            return { ok: chart.ok, symbol, source, http: response.http, chart,
                status: chart.ok ? "Available" : response.http === 200 ? chart.error : "HTTP " + response.http, quoteTime: chart.quoteTime || null };
        }, overrides, refresh);
    }

    /** One parsed quote-page response serves quotes, fundamentals and earnings for one minute. */
    static quotePage(input, overrides = {}, refresh = "") {
        const symbol = TickerSheetsPublicData.ticker(input);
        return TickerSheetsPublicData.cached("quote-page:v1", symbol, 60, deps => {
            const source = "https://finance.yahoo.com/quote/" + encodeURIComponent(symbol) + "/";
            const response = TickerSheetsPublicData.request(source, deps), statistics = TickerSheetsData.parseStatistics(response.body, symbol), details = TickerSheetsDetails.parsePage(response.body, symbol);
            const fields = { ...(statistics.fields || {}) };
            for (const [id, field] of Object.entries(details.fields || {})) if (field.value != null || !fields[id]) fields[id] = field;
            const regular = details.ok === true && details.symbol === symbol && details.quoteSessions?.symbol === symbol ? details.quoteSessions.regular : null;
            const dividend = fields.dividend_yield, fundYield = fields.fund_yield;
            const validYield = field => field?.unit === "fraction" && typeof field.value === "number" && Number.isFinite(field.value) && field.value >= 0;
            const yieldField = validYield(dividend) ? dividend : validYield(fundYield) ? fundYield : null;
            const basic = {
                price: typeof regular?.price === "number" && Number.isFinite(regular.price) && regular.price > 0 ? regular.price : null,
                quoteTime: regular?.quoteTime || null,
                yieldFraction: yieldField?.value ?? null,
                yieldBasis: yieldField ? yieldField.label || (yieldField === fundYield ? "Fund yield" : "Forward dividend yield") : "Yield unavailable",
                name: details.ok === true && typeof details.name === "string" ? details.name : ""
            };
            const ok = details.ok || statistics.ok || basic.price !== null;
            return { ok, symbol, source, http: response.http, details, fields, statisticsOkay: statistics.ok === true, basic,
                quoteSessions: details.ok ? details.quoteSessions || null : null,
                status: ok ? "Available" : response.http === 200 ? "Matching quote details unavailable" : "HTTP " + response.http };
        }, overrides, refresh);
    }

    static details(input, overrides = {}, refresh = "") {
        const symbol = TickerSheetsPublicData.ticker(input);
        return TickerSheetsPublicData.cached("details:v2", symbol, 900, deps => {
            const page = TickerSheetsPublicData.quotePage(input, deps, refresh);
            const ok = page.details?.ok === true || page.statisticsOkay === true;
            return { ...page, ok, status: ok ? "Available" : page.http === 200 ? "Matching fundamentals unavailable" : page.status };
        }, overrides, refresh);
    }

    /** Session quotes read the one-minute page cache, never the fifteen-minute fundamentals cache. */
    static quote(input, overrides = {}, refresh = "") {
        const chartData = TickerSheetsPublicData.chart(input, overrides, refresh);
        if (!chartData.ok) return chartData;
        const symbol = chartData.symbol;
        const detailData = TickerSheetsPublicData.quotePage(input, overrides, refresh), sessionsOkay = detailData.details?.ok === true;
        const quote = TickerSheetsData.selectQuote(chartData.chart, { ok: sessionsOkay, symbol, quoteSessions: detailData.quoteSessions });
        return { ...chartData, quote, quoteTime: quote.quoteTime, source: quote.source === "Yahoo Chart API" ? chartData.source : quote.source || chartData.source,
            retrievedAt: sessionsOkay && quote.source === detailData.source ? detailData.retrievedAt : chartData.retrievedAt,
            cacheHit: chartData.cacheHit && detailData.cacheHit, extendedQuoteStatus: sessionsOkay ? "Available" : "Extended-session quote unavailable" };
    }

    static options(input, expiration = "", overrides = {}, refresh = "") {
        const symbol = TickerSheetsPublicData.ticker(input);
        if (expiration instanceof Date) {
            if (!Number.isFinite(expiration.getTime())) return TickerSheetsPublicData.failure("Use a valid expiration date.");
            try {
                const book = SpreadsheetApp.getActiveSpreadsheet();
                expiration = typeof Utilities !== "undefined" && typeof Utilities.formatDate === "function"
                    ? Utilities.formatDate(expiration, book.getSpreadsheetTimeZone(), "yyyy-MM-dd") : expiration.toISOString().slice(0, 10);
            } catch { return TickerSheetsPublicData.failure("The expiration date could not be read in the spreadsheet time zone."); }
        }
        const expiry = TickerSheetsOptions.expiration_(expiration);
        if (!expiry) return TickerSheetsPublicData.failure("Use an expiration in YYYY-MM-DD format.");
        return TickerSheetsPublicData.cached("options", symbol + ":" + expiry.date, 60, deps => {
            const options = TickerSheetsOptions.fetchChain(symbol, expiry.date, deps.fetch);
            return { ok: options.ok, symbol, source: options.source, http: options.http, quoteTime: options.quoteTime, options,
                status: options.ok ? "Available" : options.error };
        }, overrides, refresh);
    }

    /** FRED API definitions: https://fred.stlouisfed.org/docs/api/fred/series_observations.html */
    static fred(seriesId, count = 60, overrides = {}, refresh = "") {
        const id = typeof seriesId === "string" ? seriesId.trim().toUpperCase() : "";
        if (!/^[A-Z0-9_]{1,50}$/.test(id) || !Number.isInteger(count) || count < 1 || count > 1000) return TickerSheetsPublicData.failure("Use a FRED series ID and 1–1000 observations.");
        const deps = TickerSheetsPublicData.dependencies(overrides), key = typeof deps.fredKey === "function" ? deps.fredKey() : deps.fredKey;
        const source = "https://fred.stlouisfed.org/series/" + id;
        if (typeof key !== "string" || !/^[a-z0-9]{32}$/.test(key)) return TickerSheetsPublicData.failure("FRED API key required. Use the TickerSheets menu.", source);
        return TickerSheetsPublicData.cached("fred", id + ":" + count, 3600, services => {
            // The private URL is sent only to FRED. Raw bodies and exceptions never leave this method.
            const parameters = "?series_id=" + encodeURIComponent(id) + "&api_key=" + encodeURIComponent(key) + "&file_type=json";
            const metaResponse = TickerSheetsPublicData.request("https://api.stlouisfed.org/fred/series" + parameters, services);
            const meta = JSON.parse(metaResponse.body)?.seriess;
            if (!Array.isArray(meta) || meta.length !== 1 || meta[0]?.id !== id) return TickerSheetsPublicData.failure("FRED series metadata unavailable.", source);
            const row = meta[0], response = TickerSheetsPublicData.request("https://api.stlouisfed.org/fred/series/observations" + parameters + "&units=lin&output_type=1&sort_order=desc&limit=" + count, services);
            const payload = JSON.parse(response.body);
            if (payload?.error_code || !Array.isArray(payload?.observations) || payload.units && payload.units !== "lin") return TickerSheetsPublicData.failure("FRED observations unavailable.", source);
            const dates = new Map();
            for (const observation of payload.observations) {
                const value = TickerSheetsFred.value_(observation?.value);
                if (!TickerSheetsFred.date_(observation?.date) || !value.valid || dates.has(observation.date) && dates.get(observation.date) !== value.value) return TickerSheetsPublicData.failure("FRED returned invalid observations.", source);
                dates.set(observation.date, value.value);
            }
            return { ok: true, symbol: id, seriesId: id, source, status: "Available", http: response.http,
                label: typeof row.title === "string" ? row.title : id, unit: typeof row.units === "string" ? row.units : "Units unavailable",
                frequency: typeof row.frequency === "string" ? row.frequency : "", seasonalAdjustment: typeof row.seasonal_adjustment === "string" ? row.seasonal_adjustment : "",
                observations: [...dates].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value })) };
        }, deps, refresh);
    }

    static provider(provider, input, overrides = {}, refresh = "") {
        const symbol = TickerSheetsData.normalizeTicker(input).yahooSymbol, id = String(provider || "").trim().toUpperCase();
        if (typeof TickerSheetsProviderFields === "undefined") return TickerSheetsPublicData.failure("Provider adapter unavailable.");
        return TickerSheetsPublicData.cached("provider", id + ":" + symbol, 300, deps => TickerSheetsProviderFields.fetch(id, symbol, deps), overrides, refresh);
    }

    static fieldRows(fields, source = "") {
        return [["Field", "Value", "Unit", "Currency", "Source"], ...Object.entries(fields).map(([id, row]) => [id, row.value, row.unit || "", row.currency || "", row.source || source].map(TickerSheetsPublicData.safe))];
    }

    static quoteFields(data) {
        const chart = data.chart || {}, metrics = chart.metrics || {}, quote = data.quote || TickerSheetsData.selectQuote(chart);
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
function TICKERSHEETS_QUOTE(ticker, field = "price", refresh = "") {
    try {
        const wanted = String(field).trim().toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(TickerSheetsPublicData.quoteFields({}), wanted) && wanted !== "all") return "N/A: Unsupported quote field";
        const sessionFields = ["price", "quote_time", "price_session", "market_state", "retrieved_at", "status", "source", "all"];
        const data = sessionFields.includes(wanted) || /^(?:pre|post)_market_/.test(wanted) ? TickerSheetsPublicData.quote(ticker, {}, refresh) : TickerSheetsPublicData.chart(ticker, {}, refresh);
        if (!data.ok) return TickerSheetsPublicData.error(data);
        const fields = TickerSheetsPublicData.quoteFields(data);
        return wanted === "all" ? [["Field", "Value"], ...Object.entries(fields).map(([id, value]) => [id, TickerSheetsPublicData.safe(value)])] : TickerSheetsPublicData.safe(fields[wanted]);
    } catch { return "N/A: Enter a supported ticker and quote field"; }
}

/** Quote from an explicitly selected keyed provider. Save keys through TickerSheets → API keys…. @customfunction */
function TICKERSHEETS_PROVIDER_QUOTE(ticker, provider, field = "price", refresh = "") {
    try {
        if (typeof field !== "string") return "N/A: Unsupported provider quote field";
        const wanted = field.trim().toLowerCase();
        if (wanted !== "all" && !TickerSheetsKeyedQuotes.fields.includes(wanted)) return "N/A: Unsupported provider quote field";
        const data = TickerSheetsPublicData.keyedQuote(ticker, provider, {}, refresh);
        if (!data.ok) return TickerSheetsPublicData.error(data);
        const fields = { ...data.fields, status: data.status, retrieved_at: data.retrievedAt };
        return wanted === "all" ? [["Field", "Value"], ...TickerSheetsKeyedQuotes.fields.map(id => [id, TickerSheetsPublicData.safe(fields[id])])] : TickerSheetsPublicData.safe(fields[wanted]);
    } catch { return "N/A: Enter a supported provider, ticker and quote field"; }
}

/** Daily OHLCV and adjusted close, up to two years. @customfunction */
function TICKERSHEETS_HISTORY(ticker, sessions = 252, refresh = "") {
    try {
        if (!Number.isInteger(sessions) || sessions < 1 || sessions > 510) return "N/A: Choose 1–510 daily sessions";
        const data = TickerSheetsPublicData.chart(ticker, {}, refresh);
        if (!data.ok) return TickerSheetsPublicData.error(data);
        return [["Date", "Open", "High", "Low", "Close", "Adjusted close", "Volume"], ...data.chart.history.slice(-sessions).map(row => [row.date, row.open, row.high, row.low, row.close, row.adjustedClose, row.volume].map(TickerSheetsPublicData.safe))];
    } catch { return "N/A: Enter a supported ticker"; }
}

/** Named fundamental field, or all fields with units and source. @customfunction */
function TICKERSHEETS_FUNDAMENTALS(ticker, field = "all", refresh = "") {
    try {
        const data = TickerSheetsPublicData.details(ticker, {}, refresh);
        if (!data.ok) return TickerSheetsPublicData.error(data);
        const wanted = String(field).trim().toLowerCase();
        return wanted === "all" ? TickerSheetsPublicData.fieldRows(data.fields, data.source) : TickerSheetsPublicData.safe(data.fields[wanted]?.value);
    } catch { return "N/A: Enter a supported ticker and fundamental field"; }
}

/** Standard option contracts for one published expiration. @customfunction */
function TICKERSHEETS_OPTIONS(ticker, expiration = "", refresh = "") {
    try {
        const data = TickerSheetsPublicData.options(ticker, expiration, {}, refresh);
        if (!data.ok) return TickerSheetsPublicData.error(data);
        return [["Expiration", "Type", "Strike", "Bid", "Ask", "Mid", "Last", "IV fraction", "Volume", "Open interest", "Last trade", "Contract"],
            ...data.options.contracts.map(row => [row.expiration, row.type, row.strike, row.bid, row.ask, row.mid, row.last, row.iv, row.volume, row.openInterest, row.lastTrade, row.contractSymbol].map(TickerSheetsPublicData.safe))];
    } catch { return "N/A: Enter a ticker and optional YYYY-MM-DD expiration"; }
}

/** Published option expiration dates, optionally paired with the completed refresh number. @customfunction */
function TICKERSHEETS_EXPIRATIONS(ticker, refresh = "", includeRefresh = false) {
    try {
        const data = TickerSheetsPublicData.options(ticker, "", {}, refresh);
        if (!data.ok) return TickerSheetsPublicData.error(data);
        if (includeRefresh !== true) return [["Expiration"], ...data.options.expirations.map(value => [value])];
        const completedRefresh = refresh == null || refresh === "" ? "" : Number(refresh);
        return [["Expiration", "Refresh number"], ...data.options.expirations.map(value => [value, completedRefresh])];
    }
    catch { return "N/A: Enter a supported ticker"; }
}

/** FRED observation levels. The key comes from the private settings menu. @customfunction */
function TICKERSHEETS_FRED(seriesId, observations = 60, refresh = "") {
    try {
        const data = TickerSheetsPublicData.fred(seriesId, observations, {}, refresh);
        if (!data.ok) return TickerSheetsPublicData.error(data);
        return [["Date", "Value", "Unit", "Series", "Source"], ...data.observations.map(row => [row.date, row.value, data.unit, data.seriesId, data.source].map(TickerSheetsPublicData.safe))];
    } catch { return "N/A: FRED data unavailable"; }
}

/** Selected provider field by name or supported field identifier. @customfunction */
function TICKERSHEETS_FIELD(provider, ticker, field = "all", refresh = "") {
    try {
        const wanted = String(field).trim().toLowerCase();
        const id = typeof TickerSheetsProviderFields !== "undefined" && typeof TickerSheetsProviderFields.resolveField === "function" ? TickerSheetsProviderFields.resolveField(provider, wanted) : null;
        if (wanted !== "all" && !id) return "N/A: Unsupported provider field";
        const data = TickerSheetsPublicData.provider(provider, ticker, {}, refresh);
        if (!data.ok) return TickerSheetsPublicData.error(data);
        return wanted === "all" ? TickerSheetsPublicData.fieldRows(data.fields, data.source) : TickerSheetsPublicData.safe(data.fields[id]?.value);
    } catch { return "N/A: Enter a supported provider, ticker and field"; }
}

/** Status, retrieval time and source for the same cached dataset as the data formula. @customfunction */
function TICKERSHEETS_DATA_STATUS(ticker, dataset = "quote", argument = "", refresh = "") {
    try {
        const kind = String(dataset).trim().toLowerCase();
        const data = kind === "quote" ? TickerSheetsPublicData.quote(ticker, {}, refresh) : kind === "history" ? TickerSheetsPublicData.chart(ticker, {}, refresh)
            : kind === "fundamentals" ? TickerSheetsPublicData.details(ticker, {}, refresh)
            : kind === "options" ? TickerSheetsPublicData.options(ticker, argument, {}, refresh)
            : kind === "fred" ? TickerSheetsPublicData.fred(ticker, argument || 60, {}, refresh)
            : kind === "provider" ? TickerSheetsPublicData.provider(argument, ticker, {}, refresh) : TickerSheetsPublicData.failure("Unsupported dataset");
        return [["Status", "Retrieved at", "Quote time", "Cached", "Source"], [data.status, data.retrievedAt, data.quoteTime, data.cacheHit, data.source].map(TickerSheetsPublicData.safe)];
    } catch { return "N/A: Data status unavailable"; }
}

/** Strategy result for transparent per-share inputs and a contract multiplier. @customfunction */
function TICKERSHEETS_STRATEGY(strategy, spot, longStrike, longPremium, shortStrike, shortPremium, contracts = 1, multiplier = 100, expiration = "", metric = "maxProfit", stockAtExpiry) {
    try {
        if (typeof TickerSheetsStrategies === "undefined") return "N/A: Strategy model unavailable";
        const input = { strategy, spot, longStrike, longPremium, shortStrike, shortPremium, contracts, multiplier, expiration };
        const result = TickerSheetsStrategies.calculate(input), id = String(metric).trim().toLowerCase();
        if (!result.ok) return "N/A: " + (result.error || "Invalid strategy inputs");
        if (id === "payoff") return TickerSheetsPublicData.safe(TickerSheetsStrategies.payoff(input, stockAtExpiry));
        const field = Object.keys(result).find(name => name.toLowerCase() === id);
        return field ? TickerSheetsPublicData.safe(result[field]) : "N/A: Unsupported strategy metric";
    } catch { return "N/A: Invalid strategy inputs"; }
}
