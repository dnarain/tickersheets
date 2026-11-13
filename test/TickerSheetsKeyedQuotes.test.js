import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TickerSheetsKeyedQuotes as K } from "../src/TickerSheetsKeyedQuotes.js";
import { TickerSheetsPublicData as P, TICKERSHEETS_PROVIDER_QUOTE as quote, TICKERSHEETS_QUOTE } from "../src/TickerSheetsFunctions.js";

const secret = "test-secret-not-a-real-key-123456789", now = Date.parse("2026-11-13T18:00:00Z"), epoch = now / 1000;
const hub = () => ({ c: 160, d: 0, dp: 0, h: 162, l: 158, o: 159, pc: 160, t: epoch });
const alpha = () => ({ "Global Quote": { "01. symbol": "NVDA", "02. open": "159", "03. high": "162", "04. low": "158", "05. price": "160", "06. volume": "0", "07. latest trading day": "2026-11-12", "08. previous close": "161", "09. change": "-1", "10. change percent": "-0.621118%" } });
const fx = () => ({ "Realtime Currency Exchange Rate": { "1. From_Currency Code": "USD", "2. From_Currency Name": "US Dollar", "3. To_Currency Code": "EUR", "5. Exchange Rate": "0.95", "6. Last Refreshed": "2026-11-13 17:59:00", "7. Time Zone": "UTC" } });
const twelve = () => ({ symbol: "NVDA", name: "NVIDIA Corporation", currency: "USD", close: "160", open: "159", high: "162", low: "158", previous_close: "161", volume: "0", change: "-1", percent_change: "-0.621118", timestamp: epoch - 28800, last_quote_at: epoch - 60 });
const coin = () => ({ status: { error_code: 0 }, data: [{ id: 1, symbol: "BTC", name: "Bitcoin", is_active: 1, quote: [{ symbol: "USD", price: 90000, volume_24h: 12345, percent_change_24h: 0, last_updated: "2026-11-13T17:59:00Z" }] }] });
let fetch, keyRead, cache, store, payload, http, log;
beforeEach(() => {
    payload = hub(); http = 200; store = new Map();
    cache = { get: vi.fn(key => store.get(key) ?? null), put: vi.fn((key, value) => store.set(key, value)) };
    fetch = vi.fn(() => ({ getResponseCode: () => http, getContentText: () => JSON.stringify(payload) }));
    keyRead = vi.fn(() => secret); log = vi.fn();
    vi.stubGlobal("UrlFetchApp", { fetch }); vi.stubGlobal("CacheService", { getScriptCache: () => cache });
    vi.stubGlobal("PropertiesService", { getScriptProperties: () => ({ getProperty: keyRead }) });
    vi.stubGlobal("console", { log, warn: log, error: log }); vi.spyOn(Date, "now").mockReturnValue(now);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const fields = value => Object.fromEntries(value.slice(1));

describe("explicit keyed provider selection", () => {
    it.each(["FINNHUB", "Finnhub", "ALPHA_VANTAGE", "Alpha Vantage", "alphavantage", "TWELVE_DATA", "Twelve Data", "twelvedata", "COINMARKET", "CoinMarketCap"])("normalizes provider %s", provider => expect(K.providers[K.provider(provider)]).toBeDefined());
    it.each(["NVDA?apikey=leak", "NVDA\n", "A A", "=NVDA", "https://evil.example", "UNKNOWN:NVDA", "NASDAQ:AAPL:MSFT", "", null, 123])("rejects malformed symbol without network or key reads %#", input => {
        if (input === "NVDA\n") input = "NVDA\nLEAK";
        expect(quote(input, "FINNHUB")).toMatch(/^N\/A:/); expect(fetch).not.toHaveBeenCalled(); expect(keyRead).not.toHaveBeenCalled();
    });
    it.each(["price?token=x", "unknown", [], 1])("rejects unsupported fields before key reads %#", field => {
        expect(quote("NVDA", "FINNHUB", field)).toBe("N/A: Unsupported provider quote field"); expect(keyRead).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    });
    it("rejects unsupported providers and refresh inputs without requests", () => {
        expect(quote("NVDA", "OTHER")).toMatch(/^N\/A:/); expect(quote("NVDA", "FINNHUB", "price", -1)).toContain("refresh number");
        expect(keyRead).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    });
    it.each(Object.entries(K.providers))("requires %s's original key property", (provider, metadata) => {
        keyRead.mockReturnValue("");
        expect(quote(provider === "COINMARKET" ? "BTC/USD" : "NVDA", provider)).toContain(metadata.label + " API key required");
        expect(keyRead).toHaveBeenCalledWith(metadata.property); expect(fetch).not.toHaveBeenCalled(); expect(cache.put).not.toHaveBeenCalled();
    });
    it("uses the default Yahoo quote without consulting any keyed provider", () => {
        vi.spyOn(P, "quote").mockReturnValue({ ok: true, quote: { price: 123, regular: {}, pre: {}, post: {} } });
        expect(TICKERSHEETS_QUOTE("NVDA")).toBe(123); expect(keyRead).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    });
});

describe("accepted provider quotes and observation meanings", () => {
    it("reads Finnhub price, zero change and quote timestamp without inventing currency", () => {
        const table = quote("NASDAQ:NVDA", "FINNHUB", "all"), result = fields(table);
        expect(table).toHaveLength(20); expect(table.every(row => row.length === 2)).toBe(true); expect(table[0]).toEqual(["Field", "Value"]);
        expect(table.slice(1).map(row => row[0])).toEqual(K.fields);
        expect(result).toMatchObject({ price: 160, symbol: "NVDA", change: 0, change_fraction: 0, quote_time: new Date(now).toISOString(), currency: "N/A", name: "N/A", source: "Finnhub", status: "Available" });
        expect(fetch.mock.calls[0][0]).toBe("https://finnhub.io/api/v1/quote?symbol=NVDA");
        expect(fetch.mock.calls[0][0]).not.toContain(secret);
        expect(fetch.mock.calls[0][1].headers["X-Finnhub-Token"]).toBe(secret);
    });
    it("keeps Alpha Vantage end-of-day dates distinct from an unavailable quote timestamp", () => {
        payload = alpha(); const result = fields(quote("NVDA", "ALPHAVANTAGE", "all"));
        expect(result).toMatchObject({ price: 160, quote_date: "2026-11-12", quote_time: "N/A", currency: "N/A", volume: 0, change: -1, change_period: "previous_close" });
        expect(result.change_fraction).toBeCloseTo(-0.00621118); expect(result.price_basis).toMatch(/End-of-day/);
        expect(fetch.mock.calls[0][0]).toContain("function=GLOBAL_QUOTE&symbol=NVDA&apikey=");
    });
    it("restores the existing Alpha Vantage exchange-rate path with exact pair identity", () => {
        payload = fx(); const result = fields(quote("CURRENCY:USDEUR", "ALPHA_VANTAGE", "all"));
        expect(result).toMatchObject({ price: 0.95, currency: "EUR", symbol: "USD/EUR", quote_time: "2026-11-13T17:59:00.000Z" });
        expect(fetch.mock.calls[0][0]).toContain("CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=EUR");
    });
    it("keeps Twelve Data bar-opening time distinct from last_quote_at", () => {
        payload = twelve(); const result = fields(quote("NVDA", "Twelve Data", "all"));
        expect(result).toMatchObject({ price: 160, name: "NVIDIA Corporation", currency: "USD", volume: 0, quote_time: new Date(now - 60000).toISOString(), bar_time: new Date(now - 28800000).toISOString() });
        expect(fetch.mock.calls[0][0]).toBe("https://api.twelvedata.com/quote?symbol=NVDA"); expect(fetch.mock.calls[0][1].headers.Authorization).toBe("apikey " + secret);
    });
    it("does not substitute Twelve Data's bar-opening timestamp for a missing quote time", () => {
        payload = twelve(); delete payload.last_quote_at;
        expect(quote("NVDA", "TWELVEDATA", "quote_time")).toBe("N/A"); expect(quote("NVDA", "TWELVEDATA", "bar_time")).toBe(new Date(now - 28800000).toISOString());
    });
    it("preserves explicit Twelve Data exchanges in requests and cache identities", () => {
        payload = { ...twelve(), symbol: "VOD", exchange: "NASDAQ", close: "10" };
        expect(quote("NASDAQ:VOD", "TWELVE_DATA")).toBe(10);
        expect(fetch.mock.calls[0][0]).toBe("https://api.twelvedata.com/quote?symbol=VOD&exchange=NASDAQ");
        payload = { ...payload, exchange: "NYSE", close: "20" };
        expect(quote("NYSE:VOD", "TWELVE_DATA")).toBe(20);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(cache.put.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining([expect.stringContaining("TWELVE_DATA:NASDAQ:VOD"), expect.stringContaining("TWELVE_DATA:NYSE:VOD")]));
        expect(quote("NASDAQ:VOD", "TWELVE_DATA")).toBe(10); expect(fetch).toHaveBeenCalledTimes(2);
    });
    it.each(["LSE", undefined])("rejects a Twelve Data quote whose exchange does not match the explicit input: %s", exchange => {
        payload = { ...twelve(), symbol: "VOD", exchange, currency: "GBP" };
        expect(quote("NASDAQ:VOD", "TWELVE_DATA")).toContain("another exchange"); expect(cache.put).not.toHaveBeenCalled();
    });
    it("uses current CoinMarketCap v3 arrays and the requested conversion currency", () => {
        payload = coin(); const result = fields(quote("BTC/USD", "COINMARKETCAP", "all"));
        expect(result).toMatchObject({ price: 90000, symbol: "BTC", name: "Bitcoin", currency: "USD", change_fraction: 0, change_period: "24_hours", volume: 12345, quote_time: "2026-11-13T17:59:00.000Z" });
        expect(fetch.mock.calls[0][0]).toBe("https://pro-api.coinmarketcap.com/v3/cryptocurrency/quotes/latest?symbol=BTC&convert=USD");
        expect(fetch.mock.calls[0][0]).not.toContain(secret);
        expect(fetch.mock.calls[0][1].headers["X-CMC_PRO_API_KEY"]).toBe(secret); expect(result.price_basis).toContain("quote-currency turnover");
    });
    it.each([["FINNHUB", hub], ["ALPHA_VANTAGE", alpha], ["TWELVE_DATA", twelve], ["COINMARKET", coin]])("preserves finite zero prices from %s", (provider, fixture) => {
        payload = fixture();
        if (provider === "FINNHUB") payload.c = 0;
        if (provider === "ALPHA_VANTAGE") payload["Global Quote"]["05. price"] = "0";
        if (provider === "TWELVE_DATA") payload.close = "0";
        if (provider === "COINMARKET") payload.data[0].quote[0].price = 0;
        expect(quote(provider === "COINMARKET" ? "BTC" : "NVDA", provider)).toBe(0);
    });
});

describe("rejected responses and secret handling", () => {
    it.each([401, 403, 429, 500, 302])("returns a fixed HTTP %s error without caching a response body", code => {
        http = code; payload = { message: secret + " https://private.example" };
        const result = quote("NVDA", "FINNHUB"); expect(result).toMatch(/^N\/A:/); expect(result).not.toContain(secret); expect(result).not.toContain("private.example");
        expect(cache.put).not.toHaveBeenCalled(); expect(fetch.mock.calls[0][1].followRedirects).toBe(false);
    });
    it.each([{ error: secret }, { Note: secret }, { Information: secret }, { "Error Message": secret }, { status: "error", message: secret }, { status: { error_code: 1001, error_message: secret } }])("does not expose provider errors or quotas %#", response => {
        payload = response; const result = quote("NVDA", "FINNHUB");
        expect(result).toMatch(/^N\/A:/); expect(result).not.toContain(secret); expect(cache.put).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
    });
    it("does not expose exception text or malformed JSON", () => {
        fetch.mockImplementationOnce(() => { throw new Error(secret + " https://private.example"); });
        expect(quote("NVDA", "FINNHUB")).not.toContain(secret);
        fetch.mockReturnValueOnce({ getResponseCode: () => 200, getContentText: () => secret });
        expect(quote("NVDA", "FINNHUB")).not.toContain(secret); expect(cache.put).not.toHaveBeenCalled();
    });
    it.each([null, "", "NaN", "Infinity", -1, false])("does not convert invalid prices to zero %#", value => {
        payload.c = value; expect(quote("NVDA", "FINNHUB")).toMatch(/^N\/A:/); expect(cache.put).not.toHaveBeenCalled();
    });
    it("rejects Finnhub's no-data zero timestamp", () => { payload = { c: 0, h: 0, l: 0, o: 0, pc: 0, t: 0 }; expect(quote("NVDA", "FINNHUB")).toMatch(/^N\/A:/); });
    it.each([["ALPHA_VANTAGE", alpha], ["TWELVE_DATA", twelve]])("rejects another ticker from %s", (provider, fixture) => {
        payload = fixture(); if (provider === "ALPHA_VANTAGE") payload["Global Quote"]["01. symbol"] = "AAPL"; else payload.symbol = "AAPL";
        expect(quote("NVDA", provider)).toMatch(/^N\/A:/); expect(cache.put).not.toHaveBeenCalled();
    });
    it("rejects mismatched Alpha Vantage pair currencies and unavailable time zones", () => {
        payload = fx(); payload["Realtime Currency Exchange Rate"]["3. To_Currency Code"] = "GBP";
        expect(quote("USD/EUR", "ALPHA_VANTAGE")).toMatch(/^N\/A:/);
        payload = fx(); payload["Realtime Currency Exchange Rate"]["7. Time Zone"] = "Unknown";
        expect(quote("USD/EUR", "ALPHA_VANTAGE", "quote_time")).toBe("N/A");
    });
    it.each(["duplicate", "wrong coin", "wrong currency", "inactive", "legacy object"])("rejects CoinMarketCap %s", scenario => {
        payload = coin();
        if (scenario === "duplicate") payload.data.push(structuredClone(payload.data[0]));
        if (scenario === "wrong coin") payload.data[0].symbol = "ETH";
        if (scenario === "wrong currency") payload.data[0].quote[0].symbol = "EUR";
        if (scenario === "inactive") payload.data[0].is_active = 0;
        if (scenario === "legacy object") payload.data = { BTC: payload.data[0] };
        expect(quote("BTC/USD", "COINMARKETCAP")).toMatch(/^N\/A:/); expect(cache.put).not.toHaveBeenCalled();
    });
    it("caches only whitelisted public fields and suppresses any key echo", () => {
        payload = twelve(); payload.name = "Name " + secret; payload.private = { key: secret }; payload.url = "https://private.example?apikey=" + secret;
        expect(quote("NVDA", "TWELVE_DATA", "name")).toBe("N/A");
        const stored = [...store].flat().join(" "); expect(stored).not.toContain(secret); expect(stored).not.toContain("private.example"); expect(stored).not.toContain('"private"'); expect(log).not.toHaveBeenCalled();
    });
});

describe("cache identity and refresh", () => {
    it("reuses accepted quotes across field requests and preserves the provider observation time", () => {
        expect(quote("NVDA", "FINNHUB")).toBe(160); expect(quote("NASDAQ:NVDA", "Finnhub", "quote_time")).toBe(new Date(now).toISOString()); expect(fetch).toHaveBeenCalledOnce();
        expect(cache.put.mock.calls[0][2]).toBe(60); expect(cache.put.mock.calls[0][0]).toContain("FINNHUB:NVDA");
    });
    it("separates providers, symbols and crypto conversion currencies", () => {
        quote("NVDA", "FINNHUB"); payload = alpha(); quote("NVDA", "ALPHA_VANTAGE");
        payload = hub(); quote("AAPL", "FINNHUB"); payload = coin(); quote("BTC/USD", "COINMARKET");
        payload.data[0].quote[0].symbol = "EUR"; quote("BTC/EUR", "COINMARKET"); expect(fetch).toHaveBeenCalledTimes(5);
        expect(new Set(cache.put.mock.calls.map(call => call[0])).size).toBe(5);
    });
    it("honors the existing automatic refresh token and stops using cached data after key removal", () => {
        quote("NVDA", "FINNHUB"); P.setAutomaticRefresh(17); quote("NVDA", "FINNHUB"); expect(fetch).toHaveBeenCalledTimes(2);
        keyRead.mockReturnValue(""); expect(quote("NVDA", "FINNHUB")).toContain("API key required"); expect(fetch).toHaveBeenCalledTimes(2);
    });
});
