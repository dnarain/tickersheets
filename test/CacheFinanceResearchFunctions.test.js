import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CFPublicData as P, CFQUOTE, CFHISTORY, CFFUNDAMENTALS, CFOPTIONS, CFEXPIRATIONS, CFFRED, CFFIELD, CFDATASTATUS, CFSTRATEGY } from "../src/CacheFinanceResearchFunctions.js";
import { CFAnalysisOptions } from "../src/CacheFinanceAnalysisOptions.js";
import { CFAnalysisData } from "../src/CacheFinanceAnalysisData.js";
import { CFAnalysisDetails } from "../src/CacheFinanceAnalysisDetails.js";
import { CFSmfProviders } from "../src/CacheFinanceSmfProviders.js";

const chartBody = fs.readFileSync(new URL("./fixtures/analysis-chart-nvda.json", import.meta.url), "utf8");
const detailsBody = fs.readFileSync(new URL("./fixtures/analysis-details-nvda.html", import.meta.url), "utf8");
const finvizBody = fs.readFileSync(new URL("./fixtures/smf-finviz-nvda.html", import.meta.url), "utf8");
const response = (body, http = 200) => ({ getResponseCode: () => http, getContentText: () => body });
function quotePage(changes = {}) {
    const quote = JSON.parse(JSON.parse(detailsBody.match(/<script[^>]*>([\s\S]*)<\/script>/)[1]).body).quoteSummary.result[0];
    Object.assign(quote.price, changes);
    return '<title>NVIDIA Corporation (NVDA) Stock Price - Yahoo Finance</title><script type="application/json" data-sveltekit-fetched data-url="https://query1.finance.yahoo.com/v10/finance/quoteSummary/NVDA">'
        + JSON.stringify({ status: 200, body: JSON.stringify({ quoteSummary: { result: [quote], error: null } }) }) + '</script>';
}
function cache() { const values = new Map(); return { values, get: vi.fn(key => values.get(key) ?? null), put: vi.fn((key, value) => values.set(key, value)) }; }
let stored, fetch;
beforeEach(() => { stored = cache(); fetch = vi.fn(() => response(chartBody)); vi.stubGlobal("CacheService", { getScriptCache: () => stored }); vi.stubGlobal("UrlFetchApp", { fetch }); vi.stubGlobal("CFSmfProviders", CFSmfProviders); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("public cache lifetime and chunk handling", () => {
    it("shares fresh results, preserves zero and refreshes exactly at the lifetime boundary", () => {
        let now = Date.UTC(2026, 10, 11); const load = vi.fn(() => ({ ok: true, status: "Available", price: 0 })); const dependencies = { cache: stored, clock: () => now };
        expect(P.cached("test", "NVDA", 60, load, dependencies)).toMatchObject({ price: 0, cacheHit: false });
        now += 59999; expect(P.cached("test", "NVDA", 60, load, dependencies).cacheHit).toBe(true); expect(load).toHaveBeenCalledOnce();
        now++; expect(P.cached("test", "NVDA", 60, load, dependencies).cacheHit).toBe(false); expect(load).toHaveBeenCalledTimes(2);
    });
    it("does not accept cached results from the future or malformed JSON", () => {
        const load = vi.fn(() => ({ ok: true, value: 10 })); const now = Date.UTC(2026, 10, 11);
        stored.values.set("CFPUBLIC:v1:test:NVDA:", JSON.stringify({ ok: true, retrievedAt: new Date(now + 1).toISOString(), value: 999 }));
        expect(P.cached("test", "NVDA", 60, load, { cache: stored, clock: () => now }).value).toBe(10);
        stored.values.set("CFPUBLIC:v1:test:NVDA:", "broken"); P.cached("test", "NVDA", 60, load, { cache: stored, clock: () => now }); expect(load).toHaveBeenCalledTimes(2);
    });
    it("reassembles a large public result from bounded chunks", () => {
        const load = vi.fn(() => ({ ok: true, value: "public data ".repeat(7000) }));
        const first = P.cached("test", "NVDA", 60, load, { cache: stored });
        const manifest = JSON.parse(stored.values.get("CFPUBLIC:v1:test:NVDA:"));
        expect(manifest.cfChunks).toBeGreaterThan(1); expect(manifest.cfChunks).toBeLessThanOrEqual(20);
        expect([...stored.values].filter(([key]) => key !== "CFPUBLIC:v1:test:NVDA:").every(([, value]) => value.length <= 30000)).toBe(true);
        expect(P.cached("test", "NVDA", 60, load, { cache: stored })).toMatchObject({ value: first.value, cacheHit: true }); expect(load).toHaveBeenCalledOnce();
    });
    it.each([null, undefined, ""]) ("re-fetches when a manifest part is missing, including an empty final part (%#)", missing => {
        const key = "CFPUBLIC:v1:test:NVDA:", prefix = key + ":part:";
        stored.values.set(key, JSON.stringify({ cfChunks: 2, prefix }));
        stored.values.set(prefix + "0", JSON.stringify({ ok: true, retrievedAt: new Date().toISOString(), value: 999 }));
        stored.get.mockImplementation(name => name === prefix + "1" ? missing : stored.values.get(name) ?? null);
        const load = vi.fn(() => ({ ok: true, value: 10 }));
        expect(P.cached("test", "NVDA", 60, load, { cache: stored })).toMatchObject({ value: 10, cacheHit: false }); expect(load).toHaveBeenCalledOnce();
    });
    it.each([{ cfChunks: 0 }, { cfChunks: 21, prefix: "wrong" }, { cfChunks: 1.5, prefix: "wrong" }, { cfChunks: 1, prefix: "other-cache:" }])
    ("rejects malformed chunk manifests (%#)", manifest => {
        stored.values.set("CFPUBLIC:v1:test:NVDA:", JSON.stringify({ ...manifest, ok: true, retrievedAt: new Date().toISOString(), value: 999 }));
        expect(P.cached("test", "NVDA", 60, () => ({ ok: true, value: 10 }), { cache: stored }).value).toBe(10);
    });
    it("returns failed requests without storing exceptions or sensitive messages", () => {
        const result = P.cached("test", "NVDA", 60, () => { throw new Error("https://source.test?api_key=private-key"); }, { cache: stored });
        expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain("private-key"); expect(stored.put).not.toHaveBeenCalled();
        P.cached("test", "NVDA", 60, () => ({ ok: false, status: "HTTP 403" }), { cache: stored }); expect(stored.put).not.toHaveBeenCalled();
    });
    it("can use fresh data when cache reads or writes fail", () => {
        stored.get.mockImplementation(() => { throw new Error("Unavailable"); }); stored.put.mockImplementation(() => { throw new Error("Unavailable"); });
        expect(P.cached("test", "NVDA", 60, () => ({ ok: true, value: 10 }), { cache: stored })).toMatchObject({ value: 10, cacheHit: false });
    });
    it.each([-1, 1.5, 2147483648, NaN, Infinity, "-1", "1.0", "1e2", "0x10", "1".repeat(11), true, {}, [[1]]])
    ("rejects malformed refresh values without fetching (%#)", token => {
        const load = vi.fn(); expect(P.cached("test", "NVDA", 60, load, { cache: stored }, token).ok).toBe(false); expect(load).not.toHaveBeenCalled();
    });
    it.each([0, 1, 2147483647, "0", "2147483647", "", null])("accepts a bounded refresh value (%s)", token => {
        expect(P.cached("test", "NVDA", 60, () => ({ ok: true }), { cache: stored }, token).ok).toBe(true);
    });
    it("uses a separate public cache entry after the editable refresh value changes", () => {
        const load = vi.fn(() => ({ ok: true, value: 10 }));
        P.cached("test", "NVDA", 60, load, { cache: stored }, 1); P.cached("test", "NVDA", 60, load, { cache: stored }, 1); P.cached("test", "NVDA", 60, load, { cache: stored }, 2);
        expect(load).toHaveBeenCalledTimes(2);
    });
});

describe("quote, history and fundamental worksheet functions", () => {
    it("shares quote/history requests and returns the requested last sessions in date order", () => {
        fetch.mockImplementation(url => response(url.startsWith("https://finance.yahoo.com/quote/") ? quotePage({ marketState: "REGULAR", postMarketPrice: {}, postMarketTime: null }) : chartBody));
        expect(CFQUOTE(" nasdaq:nvda ")).toBe(173.73);
        const history = CFHISTORY("NVDA", 2); expect(history).toHaveLength(3); expect(history[0]).toEqual(["Date", "Open", "High", "Low", "Close", "Adjusted close", "Volume"]);
        expect(history[1][0]).toBe("2026-11-10"); expect(history[2][0]).toBe("2026-11-11"); expect(history[2][4]).toBeCloseTo(173.72999572753906); expect(fetch).toHaveBeenCalledTimes(2);
        const status = CFDATASTATUS("NVDA"); expect(status[1][0]).toBe("Available"); expect(status[1][3]).toBe(true); expect(status[1][4]).toBe("https://query1.finance.yahoo.com/v8/finance/chart/NVDA");
    });
    it("keeps missing closing prices distinct from a published zero volume", () => {
        const payload = JSON.parse(chartBody), result = payload.chart.result[0];
        result.indicators.quote[0].close[result.timestamp.length - 1] = null; result.indicators.quote[0].volume[result.timestamp.length - 1] = 0;
        result.meta.regularMarketVolume = 0; fetch.mockReturnValue(response(JSON.stringify(payload)));
        expect(CFQUOTE("NVDA", "volume")).toBe(0); const row = CFHISTORY("NVDA", 1)[1]; expect(row[4]).toBe("N/A"); expect(row[5]).toBe("N/A"); expect(row[6]).toBe(0);
    });
    it("escapes formula-leading quote names in scalar and table output", () => {
        const payload = JSON.parse(chartBody); payload.chart.result[0].meta.longName = "=1+1"; fetch.mockReturnValue(response(JSON.stringify(payload)));
        expect(CFQUOTE("NVDA", "name")).toBe("'=1+1"); expect(CFQUOTE("NVDA", "all").find(row => row[0] === "name")[1]).toBe("'=1+1");
    });
    it.each([0, -1, 511, 1.5, "2", [[2]]])("rejects invalid history counts without a request (%s)", count => {
        expect(CFHISTORY("NVDA", count)).toMatch(/^N\/A:/); expect(fetch).not.toHaveBeenCalled();
    });
    it("rejects unsupported quote fields and unsafe ticker input before a request", () => {
        expect(CFQUOTE("NVDA", "not_a_field")).toBe("N/A: Unsupported quote field"); expect(CFQUOTE("=1+1")).toMatch(/^N\/A:/); expect(fetch).not.toHaveBeenCalled();
    });
    it("returns source-backed fundamentals with units and a scalar selector", () => {
        fetch.mockReturnValue(response(detailsBody)); expect(CFFUNDAMENTALS("NVDA", "trailing_pe")).toBeCloseTo(21.96, 1);
        const rows = CFFUNDAMENTALS("NVDA"); expect(rows[0]).toEqual(["Field", "Value", "Unit", "Currency", "Source"]);
        expect(rows.find(row => row[0] === "market_cap").slice(2, 4)).toEqual(["currency", "USD"]); expect(fetch).toHaveBeenCalledOnce();
        expect(CFFUNDAMENTALS("NVDA", "missing_field")).toBe("N/A");
    });
    it("keeps a valid fallback fundamental when the structured field is null", () => {
        vi.spyOn(CFAnalysisData, "parseStatistics").mockReturnValue({ ok: true, fields: { target_price: { value: 100, unit: "currency" } } });
        vi.spyOn(CFAnalysisDetails, "parsePage").mockReturnValue({ ok: true, fields: { target_price: { value: null } } });
        expect(CFFUNDAMENTALS("NVDA", "target_price")).toBe(100);
    });
    it("returns fixed errors for public network failures without leaking exception text", () => {
        fetch.mockImplementation(() => { throw new Error("token=private"); }); expect(CFQUOTE("NVDA")).toMatch(/^N\/A:/); expect(CFQUOTE("NVDA")).not.toContain("private");
    });
});

describe("session-aware quote worksheet functions", () => {
    beforeEach(() => { fetch.mockImplementation(url => response(url.startsWith("https://finance.yahoo.com/quote/") ? detailsBody : chartBody)); });
    it("returns the latest accepted after-hours quote and exposes separate regular values", () => {
        expect(CFQUOTE("NVDA")).toBe(159.5405);
        expect(CFQUOTE("NVDA", "quote_time")).toBe("2026-11-12T00:44:09.000Z");
        expect(CFQUOTE("NVDA", "price_session")).toBe("After-hours"); expect(CFQUOTE("NVDA", "market_state")).toBe("POST");
        expect(CFQUOTE("NVDA", "regular_price")).toBe(173.73); expect(CFQUOTE("NVDA", "regular_time")).toBe("2026-11-11T21:00:00.000Z");
        expect(CFQUOTE("NVDA", "post_market_price")).toBe(159.5405); expect(CFQUOTE("NVDA", "post_market_change_fraction")).toBe(-0.08167559);
        expect(CFQUOTE("NVDA", "pre_market_price")).toBe(172.77); expect(fetch).toHaveBeenCalledTimes(2);
        const status = CFDATASTATUS("NVDA"); expect(status[1][2]).toBe("2026-11-12T00:44:09.000Z"); expect(status[1][4]).toBe("https://finance.yahoo.com/quote/NVDA/");
        expect(CFHISTORY("NVDA", 1)[1][4]).toBeCloseTo(173.72999572753906); expect(fetch).toHaveBeenCalledTimes(2);
    });
    it("can read regular-only fields without downloading the quote page", () => {
        expect(CFQUOTE("NVDA", "regular_price")).toBe(173.73); expect(CFQUOTE("NVDA", "regular_time")).toBe("2026-11-11T21:00:00.000Z");
        expect(CFQUOTE("NVDA", "volume")).toBeGreaterThan(0); expect(fetch).toHaveBeenCalledOnce();
        expect(fetch.mock.calls[0][0]).toContain("/v8/finance/chart/NVDA");
    });
    it("shares the one-minute parsed page without reusing fifteen-minute fundamentals for after-hours prices", () => {
        let now = Date.UTC(2026, 10, 12, 1), price = 159.5405; vi.spyOn(Date, "now").mockImplementation(() => now);
        fetch.mockImplementation(url => response(url.startsWith("https://finance.yahoo.com/quote/") ? quotePage({ postMarketPrice: { raw: price } }) : chartBody));
        expect(CFFUNDAMENTALS("NVDA", "trailing_pe")).toBeGreaterThan(0); price = 158.78;
        expect(CFQUOTE("NVDA")).toBe(159.5405); expect(fetch).toHaveBeenCalledTimes(2);
        price = 157; now += 59999; expect(CFQUOTE("NVDA")).toBe(159.5405); expect(fetch).toHaveBeenCalledTimes(2);
        now++; expect(CFQUOTE("NVDA")).toBe(157); expect(fetch).toHaveBeenCalledTimes(4);
        expect(CFFUNDAMENTALS("NVDA", "trailing_pe")).toBeGreaterThan(0); expect(fetch).toHaveBeenCalledTimes(4);
    });
    it("discards cache entries from the earlier regular-only parser", () => {
        stored.values.set("CFPUBLIC:v1:chart:NVDA:", JSON.stringify({ ok: true, retrievedAt: new Date().toISOString(), chart: { price: 999 } }));
        stored.values.set("CFPUBLIC:v1:details:NVDA:", JSON.stringify({ ok: true, retrievedAt: new Date().toISOString(), details: { price: 999 } }));
        expect(CFQUOTE("NVDA")).toBe(159.5405); expect([...stored.values.keys()].some(key => key.includes("chart:v2"))).toBe(true);
    });
    it("keeps a failed or unrelated extended quote unavailable while returning the dated regular quote", () => {
        fetch.mockImplementation(url => response(url.startsWith("https://finance.yahoo.com/quote/") ? quotePage({ symbol: "AAPL" }) : chartBody));
        const result = P.quote("NVDA"); expect(result.quote).toMatchObject({ price: 173.73, quoteTime: "2026-11-11T21:00:00.000Z", session: "Regular" });
        expect(result.quote.post.price).toBeNull(); expect(result.extendedQuoteStatus).toBe("Extended-session quote unavailable");
    });
    it("labels an OVERNIGHT source state with its latest actual after-hours quote", () => {
        fetch.mockImplementation(url => response(url.startsWith("https://finance.yahoo.com/quote/") ? quotePage({ marketState: "OVERNIGHT", postMarketPrice: { raw: 158.78 }, postMarketTime: 1794445200 }) : chartBody));
        expect(CFQUOTE("NVDA", "price_session")).toBe("After-hours"); expect(CFQUOTE("NVDA", "market_state")).toBe("OVERNIGHT"); expect(CFQUOTE("NVDA")).toBe(158.78);
    });
    it("stores only parsed public page fields, without raw page JSON or private URL parameters", () => {
        CFQUOTE("NVDA"); const record = JSON.parse([...stored.values].find(([name]) => name.includes("quote-page:v1"))[1]);
        expect(record.quoteSessions.post.price).toBe(159.5405); expect(record.details.earnings).toHaveLength(8);
        expect(JSON.stringify(record)).not.toMatch(/<script|quoteSummary|api_key|crumb|cookie|headers/);
    });
});

describe("option worksheet functions and date inputs", () => {
    const options = () => ({ ok: true, symbol: "NVDA", source: "https://finance.yahoo.com/quote/NVDA/options/", http: 200, quoteTime: "2026-11-11T20:00:00Z", expirations: ["2026-11-20", "2026-12-18"],
        contracts: [{ expiration: "2026-11-20", type: "Call", strike: 175, bid: 0, ask: 1, mid: null, last: .5, iv: .4, volume: 0, openInterest: 100, lastTrade: null, contractSymbol: "NVDA261120C00175000" }] });
    it("shares the earliest-expiration request and preserves zero bid/volume and missing quotes", () => {
        const chain = vi.spyOn(CFAnalysisOptions, "fetchChain").mockReturnValue(options());
        expect(CFEXPIRATIONS("NVDA")).toEqual([["Expiration"], ["2026-11-20"], ["2026-12-18"]]);
        const result = CFOPTIONS("NVDA"); expect(result[1].slice(3, 6)).toEqual([0, 1, "N/A"]); expect(result[1][7]).toBe(.4); expect(result[1][8]).toBe(0); expect(chain).toHaveBeenCalledOnce();
    });
    it("preserves one-column expiration output when a refresh number is supplied", () => {
        const chain = vi.spyOn(CFAnalysisOptions, "fetchChain").mockReturnValue(options());
        const dates = [["Expiration"], ["2026-11-20"], ["2026-12-18"]];
        expect(CFEXPIRATIONS("NVDA", 7)).toEqual(dates);
        expect(CFEXPIRATIONS("NVDA", 7, false)).toEqual(dates); expect(chain).toHaveBeenCalledOnce();
    });
    it.each([7, "7", 0, "0", 2147483647, "2147483647"])("pairs each published expiration with numeric refresh %s only when requested", refresh => {
        const chain = vi.spyOn(CFAnalysisOptions, "fetchChain").mockReturnValue(options());
        expect(CFEXPIRATIONS("NVDA", refresh, true)).toEqual([["Expiration", "Refresh number"], ["2026-11-20", Number(refresh)], ["2026-12-18", Number(refresh)]]);
        expect(chain).toHaveBeenCalledOnce();
    });
    it.each(["", null, undefined])("leaves the optional refresh column blank when no refresh number was supplied (%#)", refresh => {
        vi.spyOn(CFAnalysisOptions, "fetchChain").mockReturnValue(options());
        expect(CFEXPIRATIONS("NVDA", refresh, true)).toEqual([["Expiration", "Refresh number"], ["2026-11-20", ""], ["2026-12-18", ""]]);
    });
    it.each([-1, 1.5, 2147483648, "1e2", true])("returns a scalar error without requesting or exposing an invalid refresh number (%#)", refresh => {
        const chain = vi.spyOn(CFAnalysisOptions, "fetchChain");
        expect(CFEXPIRATIONS("NVDA", refresh, true)).toBe("N/A: Use a whole refresh number from 0 to 2147483647.");
        expect(chain).not.toHaveBeenCalled();
    });
    it("returns a scalar error without a completed refresh number when the expiration request fails", () => {
        const chain = vi.spyOn(CFAnalysisOptions, "fetchChain").mockReturnValue({ ok: false, error: "HTTP 403" });
        expect(CFEXPIRATIONS("NVDA", 7, true)).toBe("N/A: HTTP 403");
        chain.mockImplementation(() => { throw new Error("private"); });
        expect(CFEXPIRATIONS("NVDA", 8, true)).toBe("N/A: Request or response unavailable.");
    });
    it.each(["2026-02-30", "11/20/2026", "=1+1", new Date(NaN)])("rejects invalid expiration inputs without a request (%s)", expiry => {
        const chain = vi.spyOn(CFAnalysisOptions, "fetchChain"); expect(CFOPTIONS("NVDA", expiry)).toMatch(/^N\/A:/); expect(chain).not.toHaveBeenCalled();
    });
    it.each([["Asia/Tokyo", "2026-11-19T15:00:00Z"], ["Etc/UTC", "2026-11-20T00:00:00Z"]])
    ("converts a Date-valued expiration in spreadsheet time zone %s", (zone, iso) => {
        const date = new Date(iso), formatDate = vi.fn(() => "2026-11-20");
        vi.stubGlobal("SpreadsheetApp", { getActiveSpreadsheet: () => ({ getSpreadsheetTimeZone: () => zone }) }); vi.stubGlobal("Utilities", { formatDate });
        const chain = vi.spyOn(CFAnalysisOptions, "fetchChain").mockReturnValue(options());
        expect(CFOPTIONS("NVDA", date)).toBeInstanceOf(Array); expect(formatDate).toHaveBeenCalledWith(date, zone, "yyyy-MM-dd"); expect(chain.mock.calls[0][1]).toBe("2026-11-20");
    });
    it("does not request a Date-valued expiration if time-zone conversion fails", () => {
        vi.stubGlobal("SpreadsheetApp", { getActiveSpreadsheet: () => ({ getSpreadsheetTimeZone: () => "Asia/Tokyo" }) }); vi.stubGlobal("Utilities", { formatDate: () => { throw new Error("private"); } });
        const chain = vi.spyOn(CFAnalysisOptions, "fetchChain"); expect(CFOPTIONS("NVDA", new Date("2026-11-20T00:00:00Z"))).not.toContain("private"); expect(chain).not.toHaveBeenCalled();
    });
    it("keeps contract data public when storing the parsed result", () => {
        vi.spyOn(CFAnalysisOptions, "fetchChain").mockReturnValue(options()); CFOPTIONS("NVDA", "2026-11-20");
        const saved = [...stored.values.values()].join(""); expect(saved).not.toMatch(/cookie|crumb|api_key|headers/i);
    });
});

describe("generic FRED series and private key handling", () => {
    const key = "a".repeat(32);
    function fredFetch({ meta = { seriess: [{ id: "PAYEMS", title: "All Employees", units: "Thousands of Persons", frequency: "Monthly", seasonal_adjustment: "Seasonally Adjusted" }] }, observations = { units: "lin", observations: [{ date: "2026-10-01", value: "." }, { date: "2026-09-01", value: "0" }] } } = {}) {
        vi.stubGlobal("PropertiesService", { getScriptProperties: () => ({ getProperty: name => name === "FRED_API_KEY" ? key : null }) });
        fetch.mockImplementation(url => response(JSON.stringify(url.includes("/observations?") ? observations : meta)));
    }
    it("accepts a series outside the dashboard's four defaults and preserves published units", () => {
        fredFetch(); const result = CFFRED("payems", 2);
        expect(result[0]).toEqual(["Date", "Value", "Unit", "Series", "Source"]); expect(result[1]).toEqual(["2026-09-01", 0, "Thousands of Persons", "PAYEMS", "https://fred.stlouisfed.org/series/PAYEMS"]);
        expect(result[2][1]).toBe("N/A"); expect(fetch).toHaveBeenCalledTimes(2);
        expect(CFFRED("PAYEMS", 2)).toEqual(result); expect(fetch).toHaveBeenCalledTimes(2);
        expect([...stored.values.values()].join("")).not.toContain(key); expect(JSON.stringify(result)).not.toContain(key); expect([...stored.values.keys()].join("")).not.toContain(key);
    });
    it("requires a key without making a request", () => { expect(CFFRED("PAYEMS", 2)).toMatch(/FRED API key required/); expect(fetch).not.toHaveBeenCalled(); });
    it.each([["PAYEMS?key=x", 2], ["PAYEMS", 0], ["PAYEMS", 1001], ["PAYEMS", "2"], ["", 2]])
    ("rejects malformed FRED inputs without a request (%#)", (id, count) => { fredFetch(); expect(CFFRED(id, count)).toMatch(/^N\/A:/); expect(fetch).not.toHaveBeenCalled(); });
    it("rejects mismatched series metadata before requesting observations", () => {
        fredFetch({ meta: { seriess: [{ id: "UNRATE", title: "Wrong series" }] } }); expect(CFFRED("PAYEMS", 2)).toMatch(/metadata unavailable/); expect(fetch).toHaveBeenCalledOnce(); expect(stored.put).not.toHaveBeenCalled();
    });
    it.each([
        { units: "pc1", observations: [{ date: "2026-10-01", value: "1" }] },
        { units: "lin", observations: [{ date: "2026-02-30", value: "1" }] },
        { units: "lin", observations: [{ date: "2026-10-01", value: "1" }, { date: "2026-10-01", value: "2" }] },
        { units: "lin", observations: [{ date: "2026-10-01", value: "Infinity" }] }
    ])("rejects invalid observation units, dates or conflicts (%#)", observations => {
        fredFetch({ observations }); const result = CFFRED("PAYEMS", 2); expect(result).toMatch(/^N\/A:/); expect(JSON.stringify(result)).not.toContain(key); expect(stored.put).not.toHaveBeenCalled();
    });
    it("does not return provider metadata fields that contain key echoes", () => {
        fredFetch({ meta: { seriess: [{ id: "PAYEMS", title: "All Employees", units: "Thousands", api_key: key, request_url: "private" }] } });
        expect(JSON.stringify(CFFRED("PAYEMS", 2))).not.toContain(key); expect([...stored.values.values()].join("")).not.toContain(key);
    });
});

describe("SMF field and status worksheet functions", () => {
    it("uses the real selected-provider parser and supports SMF number aliases", () => {
        fetch.mockReturnValue(response(finvizBody)); expect(CFFIELD("FINVIZ", "NVDA", 4074)).toBe(173.73);
        const all = CFFIELD("FINVIZ", "NVDA"); expect(all.find(row => row[0] === "earnings_date")[1]).toBe("Nov 17 AMC"); expect(all.find(row => row[0] === "short_float")[2]).toBe("fraction"); expect(fetch).toHaveBeenCalledOnce();
        expect(CFDATASTATUS("NVDA", "provider", "FINVIZ")[1][0]).toBe("Available");
    });
    it("rejects unsupported fields before a request", () => {
        expect(CFFIELD("FINVIZ", "NVDA", "no_such_field")).toBe("N/A: Unsupported provider field"); expect(fetch).not.toHaveBeenCalled();
    });
    it("returns a safe missing-adapter error", () => { vi.stubGlobal("CFSmfProviders", undefined); expect(CFFIELD("FINVIZ", "NVDA")).toMatch(/adapter unavailable/); expect(fetch).not.toHaveBeenCalled(); });
    it("does not request an unsupported data-status dataset", () => {
        const status = CFDATASTATUS("NVDA", "unknown"); expect(status[1][0]).toBe("Unsupported dataset"); expect(fetch).not.toHaveBeenCalled();
    });
});

describe("strategy worksheet wrapper", () => {
    it("keeps nonfinite model values unavailable and preserves real zero", () => {
        expect(P.safe(NaN)).toBe("N/A"); expect(P.safe(Infinity)).toBe("N/A"); expect(P.safe(-Infinity)).toBe("N/A"); expect(P.safe(0)).toBe(0);
        vi.stubGlobal("CFAnalysisStrategies", { calculate: () => ({ ok: true, maxProfit: Infinity }) }); expect(CFSTRATEGY("covered_call", 100)).toBe("N/A");
    });
    it("passes transparent inputs and returns numeric zero for premium and payoff results", () => {
        const calculate = vi.fn(() => ({ ok: true, maxProfit: 500, netDebit: 0 })), payoff = vi.fn(() => 0); vi.stubGlobal("CFAnalysisStrategies", { calculate, payoff });
        expect(CFSTRATEGY("covered_call", 100, 0, 0, 105, 2, 1, 100, "2026-11-20", "MAXPROFIT")).toBe(500);
        expect(calculate.mock.calls[0][0]).toMatchObject({ strategy: "covered_call", spot: 100, shortStrike: 105, shortPremium: 2, contracts: 1, multiplier: 100, expiration: "2026-11-20" });
        expect(CFSTRATEGY("covered_call", 100, 0, 0, 105, 2, 1, 100, "2026-11-20", "netDebit")).toBe(0);
        expect(CFSTRATEGY("covered_call", 100, 0, 0, 105, 2, 1, 100, "2026-11-20", "payoff", 100)).toBe(0);
    });
    it("rejects unavailable models, invalid inputs and unsupported metrics", () => {
        vi.stubGlobal("CFAnalysisStrategies", undefined); expect(CFSTRATEGY("unknown", 1)).toMatch(/model unavailable/);
        vi.stubGlobal("CFAnalysisStrategies", { calculate: () => ({ ok: false, error: "Missing strike" }) }); expect(CFSTRATEGY("covered_call", 1)).toMatch(/Missing strike/);
        vi.stubGlobal("CFAnalysisStrategies", { calculate: () => ({ ok: true, maxProfit: 100 }) }); expect(CFSTRATEGY("covered_call", 1, 0, 0, 2, 1, 1, 100, "", "missing")).toMatch(/Unsupported strategy metric/);
    });
});
