import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sheets = vi.hoisted(() => ({
    build: vi.fn(), readInput: vi.fn(), invalidate: vi.fn(), invalidateOptions: vi.fn(), status: vi.fn(), render: vi.fn(), inspect: vi.fn()
}));
vi.mock("../src/CacheFinanceAnalysisSheets.js", () => ({ CFAnalysisSheets: sheets }));

import { CFAnalysisService, CFBuildAnalysis, CFRefreshAnalysis, CFCheckAnalysisSources, CFInspectAnalysis, CFInspectWorkspace, CFCheckTemplateKeys, CFAnalysisMenu_, CFAnalysisHandleEdit_ } from "../src/CacheFinanceAnalysis.js";
import { CFAnalysisOptions } from "../src/CacheFinanceAnalysisOptions.js";
import { ManagedBook } from "./helpers/ManagedSheetMock.js";

const fixture = name => fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const capturedChart = JSON.parse(fixture("analysis-chart-nvda.json"));
const quotePage = fixture("yahoo-nvda.html") + fixture("analysis-details-nvda.html");
const googlePage = fixture("google-nvda.html"), globePage = fixture("globe-nvda-20261111.html");
const response = (body, code = 200, headers = {}) => ({ getContentText: () => typeof body === "string" ? body : JSON.stringify(body), getResponseCode: () => code, getAllHeaders: () => headers });
const syntheticKey = "a".repeat(32), syntheticCookie = "synthetic-anonymous-cookie", syntheticCrumb = "synthetic+/crumb";
const expiry = Date.UTC(2026, 10, 20) / 1000;
const optionPayload = symbol => ({ optionChain: { error: null, result: [{ underlyingSymbol: symbol,
    quote: { symbol, regularMarketPrice: 173.73, regularMarketTime: 1794433140 }, expirationDates: [expiry],
    options: [{ expirationDate: expiry, calls: [{ contractSymbol: symbol + "261120C00175000", expiration: expiry, strike: 175, contractSize: "REGULAR", bid: 4.1, ask: 4.3, lastPrice: 4.2, volume: 10, openInterest: 20, impliedVolatility: 0.45, lastTradeDate: 1794433140 }], puts: [] }] }] } });
const chart = (symbol = "NVDA", exchange = "NMS") => {
    const data = structuredClone(capturedChart);
    data.chart.result[0].meta.symbol = symbol; data.chart.result[0].meta.exchangeName = exchange;
    return data;
};

function network(overrides = {}) {
    return vi.fn((url, options) => {
        const parsed = new URL(url);
        if (overrides.request) {
            const overridden = overrides.request(url, options);
            if (overridden !== undefined) return overridden;
        }
        if (parsed.pathname.startsWith("/v8/finance/chart/")) {
            const symbol = decodeURIComponent(parsed.pathname.split("/").at(-1));
            return response(chart(symbol));
        }
        if (parsed.hostname === "finance.yahoo.com" && parsed.pathname.startsWith("/quote/")) return response(quotePage);
        if (parsed.hostname === "www.google.com") return response(googlePage);
        if (parsed.hostname === "www.theglobeandmail.com") return response(globePage);
        if (parsed.hostname === "fc.yahoo.com") return response("Not found", 404, { "Set-Cookie": "A3=" + syntheticCookie + "; Domain=.yahoo.com; Path=/; Secure; HttpOnly" });
        if (parsed.pathname === "/v1/test/getcrumb") return response(syntheticCrumb);
        if (parsed.pathname.startsWith("/v7/finance/options/")) return response(optionPayload(decodeURIComponent(parsed.pathname.split("/").at(-1))));
        if (parsed.hostname === "api.stlouisfed.org") return response({ units: "lin", observations: [{ date: "2026-11-10", value: "4.1" }, { date: "2026-11-11", value: "4.2" }] });
        throw new Error("Unexpected synthetic URL: " + url);
    });
}

let fetch, lock, book, log, property;
beforeEach(() => {
    Object.values(sheets).forEach(mock => mock.mockReset());
    sheets.readInput.mockReturnValue({ ticker: "NVDA", expiration: "2026-11-20" });
    sheets.inspect.mockReturnValue({ ok: true, ticker: "NVDA", sheets: [] });
    fetch = network(); lock = { tryLock: vi.fn(() => true), releaseLock: vi.fn() };
    book = { toast: vi.fn() }; property = vi.fn(() => "");
    vi.stubGlobal("SpreadsheetApp", { getActiveSpreadsheet: vi.fn(() => book), flush: vi.fn(), getUi: vi.fn() });
    vi.stubGlobal("LockService", { getDocumentLock: vi.fn(() => lock) });
    vi.stubGlobal("PropertiesService", { getScriptProperties: () => ({ getProperty: property }) });
    vi.stubGlobal("UrlFetchApp", { fetch });
    log = vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("one-ticker analysis collection", () => {
    it("keeps the selected option chain if the maturity comparison fails", () => {
        vi.spyOn(CFAnalysisOptions, "fetchMaturities").mockImplementation(() => { throw new Error("private-session-exception"); });
        const data = CFAnalysisService.collect("NVDA", "2026-11-20", { fetch });
        expect(data.options.ok).toBe(true); expect(data.options.contracts).toHaveLength(1);
        expect(data.optionMaturities).toMatchObject({ ok: false, rows: [] });
        expect(JSON.stringify(data)).not.toContain("private-session-exception");
    });

    it("can skip maturity requests while preserving the selected chain", () => {
        const maturities = vi.spyOn(CFAnalysisOptions, "fetchMaturities");
        const data = CFAnalysisService.collect("NVDA", "2026-11-20", { fetch, includeMaturities: false });
        expect(data.options.ok).toBe(true); expect(maturities).not.toHaveBeenCalled();
        expect(fetch.mock.calls.filter(([url]) => url.includes("/v7/finance/options/"))).toHaveLength(1);
    });

    it("records each extra maturity's status without duplicating the loaded chain's source row", () => {
        vi.spyOn(CFAnalysisOptions, "fetchMaturities").mockReturnValue({ ok: true, symbol: "NVDA", rows: [
            { expiration: "2026-11-20", status: "Available", http: 200, atmIV: .4 },
            { expiration: "2026-12-18", status: "Available", http: 200, atmIV: .5, quoteTime: "2026-11-11T20:00:00Z", source: "https://finance.yahoo.com/quote/NVDA/options/" },
            { expiration: "2027-01-15", status: "Unavailable", http: 403, atmIV: null, error: "Request unavailable" }
        ] });
        const data = CFAnalysisService.collect("NVDA", "2026-11-20", { fetch });
        const sources = data.sources.filter(row => row.scope.startsWith("ATM comparison"));
        expect(sources).toHaveLength(2); expect(sources.map(row => row.status)).toEqual(["Available", "Unavailable"]);
        expect(CFAnalysisService.summary(data).optionMaturities).toHaveLength(3);
    });

    it("keeps added provider results separate and reports blocked access without substituting Yahoo fields", () => {
        const fetchProvider = vi.fn(provider => ({ provider, symbol: "NVDA", ok: provider === "FINVIZ", http: provider === "FINVIZ" ? 200 : 403,
            status: provider === "FINVIZ" ? "Available" : "Access challenge", identity: provider === "FINVIZ" ? "Matched" : "Unknown", source: "https://provider.test/quote/NVDA", fields: { price: { value: provider === "FINVIZ" ? 174 : null } } }));
        vi.stubGlobal("CFSmfProviders", { registry: () => [{ provider: "FINVIZ", label: "Finviz" }, { provider: "ZACKS", label: "Zacks" }], fetch: fetchProvider });
        const data = CFAnalysisService.collect("NVDA", "2026-11-20", { fetch });
        expect(data.additionalProviders).toHaveLength(2); expect(data.additionalProviders[1].fields.price.value).toBeNull();
        expect(data.sources.find(row => row.provider === "Zacks")).toMatchObject({ status: "Access challenge", http: 403 });
        expect(CFAnalysisService.summary(data).additionalProviders.map(row => row.availableFields)).toEqual([1, 0]);
        fetchProvider.mockClear(); CFAnalysisService.collect("NVDA", "", { fetch, includeProviders: false }); expect(fetchProvider).not.toHaveBeenCalled();
    });
    it("collects history, fundamentals, separate earnings bases, benchmarks and actual option rows", () => {
        const snapshot = CFAnalysisService.collect("NVDA", "2026-11-20", { fetch, clock: () => 1794438000000 });
        expect(snapshot.ok).toBe(true); expect(snapshot.symbol).toBe("NVDA");
        expect(snapshot.chart.history).toHaveLength(25); expect(snapshot.technical.summary.rsi14).toBeGreaterThanOrEqual(0);
        expect(snapshot.technical.summary.sma200).toBeNull();
        expect(snapshot.details.fields.market_cap.value).toBeGreaterThan(4e12);
        expect(new Set(snapshot.details.earnings.map(row => row.basis))).toEqual(new Set(["GAAP", "Adjusted"]));
        expect(snapshot.details.financials.length).toBeGreaterThan(0); expect(snapshot.details.nextEarnings.dates).toContain("2026-11-17");
        expect(snapshot.benchmarks.SPY.chart.symbol).toBe("SPY"); expect(snapshot.benchmarks.QQQ.chart.symbol).toBe("QQQ");
        expect(snapshot.options.ok).toBe(true); expect(snapshot.options.contracts).toHaveLength(1);
        expect(snapshot.options.contracts[0]).toMatchObject({ expiration: "2026-11-20", strike: 175, iv: 0.45 });
        expect(snapshot.quoteSources.find(row => row.provider === "Globe & Mail")).toMatchObject({ identity: "Matched", status: "Available" });
    });

    it("uses returned exchange metadata for a bare NYSE ticker before building comparison URLs", () => {
        const requests = network({ request: url => {
            if (url.includes("/chart/IBM?")) return response(chart("IBM", "NYQ"));
            if (url.includes("finance.yahoo.com/quote/IBM/")) return response("<title>Unavailable details</title>");
        } });
        const snapshot = CFAnalysisService.collect("IBM", "", { fetch: requests });
        expect(snapshot.cacheSymbol).toBe("NYSE:IBM");
        expect(requests.mock.calls.some(([url]) => url.startsWith("https://www.google.com/finance/quote/IBM:NYSE?"))).toBe(true);
        expect(requests.mock.calls.some(([url]) => url.includes("IBM:NASDAQ"))).toBe(false);
        expect(snapshot.sources.find(row => row.provider === "Globe & Mail").status).toBe("Unsupported ticker");
    });

    it("rejects another ticker's chart and page rather than populating a false analysis", () => {
        const requests = network({ request: url => url.includes("/chart/NVDA?") ? response(chart("MSFT")) : url.includes("finance.yahoo.com/quote/NVDA/") ? response("<title>Microsoft (MSFT)</title>") : undefined });
        const snapshot = CFAnalysisService.collect("NVDA", "", { fetch: requests });
        expect(snapshot.ok).toBe(false); expect(snapshot.chart.ok).toBe(false); expect(snapshot.chart.history).toEqual([]);
        expect(snapshot.details.fields).toEqual({}); expect(snapshot.options.contracts).toEqual([]);
        expect(requests).toHaveBeenCalledTimes(2);
    });

    it.each([
        [404, ""],
        [200, '<title>Symbol lookup from Yahoo Finance</title><div>Related assets</div>'],
        [200, "{malformed JSON"],
        [200, JSON.stringify({ chart: { result: null, error: { description: "synthetic-private-provider-error" } } })]
    ])("returns an empty analysis for a well-formed nonexistent ticker when providers return HTTP %s (%#)", (http, body) => {
        const requests = vi.fn(() => response(body, http));
        const snapshot = CFAnalysisService.collect("ZZZZCFINVALID20261111", "", { fetch: requests, fredKey: syntheticKey });
        expect(snapshot.ok).toBe(false); expect(snapshot.symbol).toBe("ZZZZCFINVALID20261111");
        expect(snapshot.chart.history).toEqual([]); expect(snapshot.details.fields).toEqual({}); expect(snapshot.details.earnings).toEqual([]);
        expect(snapshot.options.contracts).toEqual([]); expect(snapshot.benchmarks).toEqual({});
        expect(requests).toHaveBeenCalledTimes(2);
        expect(requests.mock.calls.some(([url]) => /stlouisfed|fc\.yahoo/.test(url))).toBe(false);
        expect(CFAnalysisService.summary(snapshot)).toMatchObject({ ok: false, historyRows: 0, fundamentalFields: 0, earningsRows: 0, optionContracts: 0 });
        expect(JSON.stringify(snapshot)).not.toContain("synthetic-private-provider-error"); expect(JSON.stringify(snapshot)).not.toContain(syntheticKey);
    });

    it("keeps all-source request failures structured and omits exception text", () => {
        const requests = vi.fn(() => { throw new Error("synthetic-private-request-error"); });
        const snapshot = CFAnalysisService.collect("ZZZZCFINVALID20261111", "", { fetch: requests });
        expect(snapshot.ok).toBe(false); expect(snapshot.sources.map(row => row.status)).toEqual(["Request failed", "Request failed"]);
        expect(JSON.stringify(snapshot)).not.toContain("synthetic-private-request-error");
    });

    it("retains useful history when fundamentals, comparison pages and options fail", () => {
        const requests = network({ request: url => {
            if (url.includes("finance.yahoo.com/quote/") || url.includes("www.google.com") || url.includes("www.theglobeandmail.com")) return response("private-provider-error", 403);
            if (url.includes("fc.yahoo.com")) return response("private-session-error", 401);
        } });
        const snapshot = CFAnalysisService.collect("NVDA", "", { fetch: requests });
        expect(snapshot.ok).toBe(true); expect(snapshot.chart.history).toHaveLength(25);
        expect(snapshot.details.ok).toBe(false); expect(snapshot.details.fields).toEqual({}); expect(snapshot.options.ok).toBe(false);
        expect(snapshot.quoteSources.find(row => row.provider === "Google Finance").price).toBeNull();
        expect(JSON.stringify(snapshot)).not.toContain("private-provider-error"); expect(JSON.stringify(snapshot)).not.toContain("private-session-error");
    });

    it("retains fundamentals with empty history and null indicators when the chart fails", () => {
        const requests = network({ request: url => url.includes("/chart/NVDA?") ? response("private-chart-error", 500) : undefined });
        const snapshot = CFAnalysisService.collect("NVDA", "", { fetch: requests });
        expect(snapshot.ok).toBe(true); expect(snapshot.chart.history).toEqual([]); expect(snapshot.details.ok).toBe(true);
        expect(snapshot.technical.summary.price).toBeNull(); expect(snapshot.technical.summary.rsi14).toBeNull();
        expect(snapshot.quoteSources.find(row => row.provider === "Yahoo Chart").price).toBeNull();
    });

    it("does not invent missing detail fields or turn them into zero", () => {
        const empty = '<script type="application/json" data-sveltekit-fetched data-url="https://query1.finance.yahoo.com/v10/finance/quoteSummary/NVDA">' + JSON.stringify({ status: 200, body: JSON.stringify({ quoteSummary: { result: [{ price: { symbol: "NVDA" } }], error: null } }) }) + '</script>';
        const requests = network({ request: url => url.includes("finance.yahoo.com/quote/NVDA/") ? response(empty) : undefined });
        const snapshot = CFAnalysisService.collect("NVDA", "", { fetch: requests });
        expect(snapshot.details.fields).toEqual({}); expect(snapshot.details.earnings).toEqual([]);
        expect(snapshot.details.nextEarnings.dates).toEqual([]);
        expect(snapshot.quoteSources.find(row => row.provider === "Yahoo Finance").yieldFraction).toBeNull();
    });

    it("skips every FRED request when no key is configured", () => {
        const snapshot = CFAnalysisService.collect("NVDA", "", { fetch });
        expect(snapshot.fred).toHaveLength(4); expect(snapshot.fred.every(row => row.status === "API key required" && row.latest === null)).toBe(true);
        expect(fetch.mock.calls.some(([url]) => url.includes("stlouisfed.org"))).toBe(false);
    });

    it("uses a synthetic FRED key only in private requests, excluding keys and anonymous session values from results", () => {
        const snapshot = CFAnalysisService.collect("NVDA", "2026-11-20", { fetch, fredKey: syntheticKey });
        expect(snapshot.fred.filter(row => row.ok)).toHaveLength(4);
        expect(fetch.mock.calls.filter(([url]) => url.includes("api.stlouisfed.org"))).toHaveLength(4);
        expect(fetch.mock.calls.some(([url]) => url.includes("api_key=" + syntheticKey))).toBe(true);
        expect(fetch.mock.calls.some(([url]) => url.includes("crumb=" + encodeURIComponent(syntheticCrumb)))).toBe(true);
        const publicText = JSON.stringify([snapshot, CFAnalysisService.summary(snapshot), log.mock.calls]);
        expect(publicText).not.toContain(syntheticKey); expect(publicText).not.toContain(syntheticCookie); expect(publicText).not.toContain(syntheticCrumb);
        expect(publicText).not.toMatch(/api_key=|crumb=|"Cookie"/);
    });

    it("returns safe provider errors if requests throw credential-bearing exceptions", () => {
        const requests = network({ request: url => {
            if (url.includes("stlouisfed.org")) throw new Error("secret-FRED-key=" + syntheticKey);
            if (url.includes("fc.yahoo.com")) throw new Error("cookie=" + syntheticCookie);
        } });
        const snapshot = CFAnalysisService.collect("NVDA", "", { fetch: requests, fredKey: syntheticKey });
        expect(snapshot.ok).toBe(true); expect(snapshot.fred.every(row => !row.ok)).toBe(true);
        expect(JSON.stringify(snapshot)).not.toContain(syntheticKey); expect(JSON.stringify(snapshot)).not.toContain(syntheticCookie);
    });

    it("rejects a malformed ticker before sending requests", () => {
        expect(() => CFAnalysisService.collect("NVDA?token=private", "", { fetch })).toThrow();
        expect(fetch).not.toHaveBeenCalled();
    });
});

describe("research tab order", () => {
    const markers = {
        "CF Analysis": "CACHEFINANCE_ANALYSIS_V1", "CF Research": "CACHEFINANCE_RESEARCH_V1",
        "CF Options": "CACHEFINANCE_ANALYSIS_V1", "CF Strategies": "CACHEFINANCE_STRATEGIES_V1",
        "CF Watchlist": "CACHEFINANCE_WATCHLIST_V1", "CF Journal": "CACHEFINANCE_JOURNAL_V1",
        "CF Fundamentals": "CACHEFINANCE_ANALYSIS_V1", "CF Earnings": "CACHEFINANCE_ANALYSIS_V1",
        "CF Macro": "CACHEFINANCE_ANALYSIS_V1", "CF Formulas": "CACHEFINANCE_FUNCTIONS_V1",
        "CF Price history": "CACHEFINANCE_ANALYSIS_V1", "CF Sources": "CACHEFINANCE_ANALYSIS_V1",
        "CF Images": "CACHEFINANCE_IMAGES_V1"
    };
    function sortableBook(entries, withActivation = true) {
        const target = new ManagedBook(), order = [];
        const state = { target, order, active: null, selection: null };
        for (const [name, marker] of entries) {
            const sheet = target.insertSheet(name); order.push(sheet);
            sheet.getRange("Z1").setValue(marker); sheet.getRange("C6").setValue("Preserve " + name);
            if (withActivation) {
                const getRange = sheet.getRange.bind(sheet);
                sheet.getRange = address => {
                    const range = getRange(address);
                    range.activate = () => { state.selection = { name, address }; return range; };
                    return range;
                };
            }
        }
        target.setActiveSheet = vi.fn(sheet => { state.active = sheet; return target; });
        target.moveActiveSheet = vi.fn(position => {
            const previous = order.indexOf(state.active);
            if (previous < 0 || position < 1 || position > order.length) throw Error("Invalid tab movement");
            order.splice(previous, 1); order.splice(position - 1, 0, state.active); return target;
        });
        return state;
    }
    const contents = target => [...target.sheets].map(([name, sheet]) => [name, [...sheet.cells], [...sheet.formulas]]);

    it("puts all marked tabs in reading order and keeps user tabs and their contents", () => {
        const entries = [["Sheet1", ""], ...Object.entries(markers).reverse(), ["Portfolio", ""], ["Notes", ""]];
        const state = sortableBook(entries), before = contents(state.target);
        expect(CFAnalysisService.arrange(state.target)).toEqual(Object.keys(markers));
        expect(state.order.map(sheet => sheet.getName())).toEqual([...Object.keys(markers), "Sheet1", "Portfolio", "Notes"]);
        expect(contents(state.target)).toEqual(before);
        expect(state.target.moveActiveSheet).toHaveBeenCalledTimes(13);
        expect(state.active.getName()).toBe("CF Analysis");
        expect(state.selection).toEqual({ name: "CF Analysis", address: "B4" });
        expect(fetch).not.toHaveBeenCalled();
    });

    it("moves only known names with the exact marker for that name", () => {
        const state = sortableBook([
            ["Portfolio", markers["CF Analysis"]], ["CF Research", markers["CF Analysis"]],
            ["CF Options", markers["CF Options"]], ["CF Analysis", markers["CF Analysis"]],
            ["CF Images", ""], ["Scratch", ""], ["CF Journal", markers["CF Journal"]]
        ]), before = contents(state.target);
        expect(CFAnalysisService.arrange(state.target)).toEqual(["CF Analysis", "CF Options", "CF Journal"]);
        expect(state.order.map(sheet => sheet.getName())).toEqual(["CF Analysis", "CF Options", "CF Journal", "Portfolio", "CF Research", "CF Images", "Scratch"]);
        expect(state.target.setActiveSheet.mock.calls.every(([sheet]) => ["CF Analysis", "CF Options", "CF Journal"].includes(sheet.getName()))).toBe(true);
        expect(contents(state.target)).toEqual(before);
    });

    it("supports old mocks without movement or range activation methods", () => {
        expect(CFAnalysisService.arrange(book)).toEqual([]);
        const state = sortableBook([["CF Analysis", markers["CF Analysis"]]], false);
        expect(CFAnalysisService.arrange(state.target)).toEqual(["CF Analysis"]);
        expect(state.active.getName()).toBe("CF Analysis"); expect(state.selection).toBeNull();
    });
});

describe("analysis spreadsheet actions", () => {
    it("preflights formula-tab ownership before changing any core worksheet", () => {
        vi.stubGlobal("CFFunctionExamples", { check: () => { throw Error("Unmanaged CF Formulas"); } });
        expect(() => CFBuildAnalysis()).toThrow("Unmanaged CF Formulas"); expect(sheets.build).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    });
    it("requires five empty provider key flags for the clean-template check and logs no extra fields", () => {
        const flags = ["FINNHUB", "ALPHA_VANTAGE", "TWELVE_DATA", "COINMARKET", "FRED"].map(id => ({ id, configured: false, secret: "synthetic-key-value" }));
        const status = vi.fn(() => ({ ok: true, providers: flags })); vi.stubGlobal("CFGetApiKeyStatus", status);
        expect(CFCheckTemplateKeys().ok).toBe(true);
        flags[4].configured = true; expect(CFCheckTemplateKeys().ok).toBe(false);
        status.mockReturnValue({ ok: true, providers: [] }); expect(CFCheckTemplateKeys().ok).toBe(false);
        expect(JSON.stringify(log.mock.calls)).not.toContain("synthetic-key-value"); expect(fetch).not.toHaveBeenCalled();
    });
    it("builds sheets before fetching and rendering the selected ticker", () => {
        const arrange = vi.spyOn(CFAnalysisService, "arrange");
        const summary = CFBuildAnalysis();
        expect(sheets.build).toHaveBeenCalledWith(book); expect(summary).toMatchObject({ ok: true, symbol: "NVDA", historyRows: 25, optionContracts: 1 });
        expect(sheets.build.mock.invocationCallOrder[0]).toBeLessThan(sheets.invalidate.mock.invocationCallOrder[0]);
        expect(sheets.render).toHaveBeenCalledOnce(); expect(sheets.render.mock.calls[0][1].symbol).toBe("NVDA");
        expect(arrange).toHaveBeenCalledWith(book);
        expect(arrange.mock.invocationCallOrder[0]).toBeGreaterThan(sheets.render.mock.invocationCallOrder[0]);
        expect(lock.releaseLock).toHaveBeenCalledOnce();
    });

    it("invalidates old cells before requests and renders only after the second ticker check", () => {
        const arrange = vi.spyOn(CFAnalysisService, "arrange");
        CFRefreshAnalysis();
        expect(sheets.invalidate.mock.invocationCallOrder[0]).toBeLessThan(fetch.mock.invocationCallOrder[0]);
        expect(sheets.readInput).toHaveBeenCalledTimes(2);
        expect(sheets.readInput.mock.invocationCallOrder[1]).toBeLessThan(sheets.render.mock.invocationCallOrder[0]);
        expect(arrange).not.toHaveBeenCalled();
    });

    it("does not write an old snapshot if the ticker changes during requests", () => {
        sheets.readInput.mockReturnValueOnce({ ticker: "NVDA", expiration: "" }).mockReturnValue({ ticker: "AAPL", expiration: "" });
        const result = CFRefreshAnalysis();
        expect(result).toEqual({ ok: false, error: "Ticker changed during refresh." });
        expect(sheets.render).not.toHaveBeenCalled();
        expect(sheets.status).toHaveBeenCalledWith(book, "Ticker changed during refresh. Refresh the selected ticker again.");
        expect(lock.releaseLock).toHaveBeenCalledOnce();
    });

    it("does not overwrite a newly selected expiration with the old chain", () => {
        sheets.readInput.mockReturnValueOnce({ ticker: "NVDA", expiration: "2026-11-20", loadedTicker: "NVDA" })
            .mockReturnValue({ ticker: "NVDA", expiration: "2026-12-18", loadedTicker: "" });
        const result = CFRefreshAnalysis();
        expect(result).toEqual({ ok: false, error: "Expiration changed during refresh." });
        expect(sheets.render).not.toHaveBeenCalled();
        expect(sheets.status).toHaveBeenCalledWith(book, "Expiration changed during refresh. Refresh the selected ticker again.");
        expect(lock.releaseLock).toHaveBeenCalledOnce();
    });

    it("drops an old ticker's loaded expiration before requesting a new ticker", () => {
        sheets.readInput.mockReturnValueOnce({ ticker: "NVDA", expiration: "2026-12-18", loadedTicker: "AAPL" })
            .mockReturnValue({ ticker: "NVDA", expiration: "", loadedTicker: "" });
        const collect = vi.spyOn(CFAnalysisService, "collect");
        expect(CFRefreshAnalysis().ok).toBe(true);
        expect(collect).toHaveBeenCalledWith("NVDA", "", expect.objectContaining({ fredKey: "" }));
        expect(sheets.render).toHaveBeenCalledOnce();
    });

    it("logs only a safe count/status summary after an authorized refresh", () => {
        property.mockReturnValue(syntheticKey);
        const summary = CFRefreshAnalysis();
        expect(summary.fredAvailable).toHaveLength(4);
        expect(log).toHaveBeenCalledWith(expect.stringContaining("CF_ANALYSIS_REFRESH "));
        const text = JSON.stringify([summary, log.mock.calls, book.toast.mock.calls]);
        expect(text).not.toContain(syntheticKey); expect(text).not.toContain(syntheticCookie); expect(text).not.toContain(syntheticCrumb);
    });

    it("does not refresh or release a lock that another execution holds", () => {
        lock.tryLock.mockReturnValue(false);
        expect(CFRefreshAnalysis()).toEqual({ ok: false, error: "Another refresh is running." });
        expect(fetch).not.toHaveBeenCalled(); expect(sheets.render).not.toHaveBeenCalled(); expect(lock.releaseLock).not.toHaveBeenCalled();
    });

    it("returns fixed failure text and releases its lock if collection fails", () => {
        vi.spyOn(CFAnalysisService, "collect").mockImplementation(() => { throw new Error("private-key=" + syntheticKey); });
        const result = CFRefreshAnalysis();
        expect(result).toEqual({ ok: false, error: "Unable to refresh. Check the ticker and try again." });
        expect(sheets.render).not.toHaveBeenCalled(); expect(lock.releaseLock).toHaveBeenCalledOnce();
        expect(JSON.stringify([result, log.mock.calls, sheets.status.mock.calls])).not.toContain(syntheticKey);
    });

    it("renders an unavailable-source result for a nonexistent ticker without reporting an internal fetch error", () => {
        sheets.readInput.mockReturnValue({ ticker: "ZZZZCFINVALID20261111", expiration: "", loadedTicker: "ZZZZCFINVALID20261111" });
        fetch.mockImplementation(() => response("", 404));
        const summary = CFRefreshAnalysis();
        expect(summary).toMatchObject({ ok: false, symbol: "ZZZZCFINVALID20261111", historyRows: 0, fundamentalFields: 0 });
        expect(sheets.render).toHaveBeenCalledWith(book, expect.objectContaining({ ok: false }));
        expect(log.mock.calls.some(([message]) => message.startsWith("CF_ANALYSIS_REFRESH "))).toBe(true);
        expect(log.mock.calls.some(([message]) => message.startsWith("CF_ANALYSIS_ERROR "))).toBe(false);
        expect(book.toast).toHaveBeenCalledWith("No matching quote data returned. Check the ticker and CF Sources.", "Stock analysis", 10);
        expect(lock.releaseLock).toHaveBeenCalledOnce();
    });

    it("requires an open spreadsheet before building or refreshing", () => {
        SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(null);
        expect(() => CFBuildAnalysis()).toThrow("Open the spreadsheet"); expect(() => CFRefreshAnalysis()).toThrow("Open the analysis spreadsheet");
        expect(fetch).not.toHaveBeenCalled();
    });

    it("runs inspection without financial requests", () => {
        expect(CFInspectAnalysis()).toEqual({ ok: true, ticker: "NVDA", sheets: [] });
        expect(sheets.inspect).toHaveBeenCalledWith(book); expect(fetch).not.toHaveBeenCalled();
    });

    it("reads actual formula and watchlist cells without requests or credential reads", () => {
        const workspace = new ManagedBook(), formulas = workspace.insertSheet("CF Formulas"), watch = workspace.insertSheet("CF Watchlist"), journal = workspace.insertSheet("CF Journal");
        formulas.getRange("Z1").setValue("CACHEFINANCE_FUNCTIONS_V1"); formulas.getRange("B4").setValue("AAPL");
        formulas.getRange("B23").setValue(205); formulas.getRange("B24").setValue("#REF!"); formulas.getRange("B30").setValue(4.2);
        watch.getRange("Z1").setValue("CACHEFINANCE_WATCHLIST_V1"); watch.getRange("A8:D8").setValues([["AAPL", "Available", 205, "USD"]]);
        journal.getRange("Z1").setValue("CACHEFINANCE_JOURNAL_V1"); journal.getRange("A8").setValue(new Date());
        SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(workspace);
        const result = CFInspectWorkspace();
        expect(result.functions.ticker).toBe("AAPL"); expect(result.functions.samples[0][1]).toBe(205); expect(result.functions.samples[7][1]).toBe(4.2);
        expect(result.formulaErrors).toEqual([{ sheet: "CF Formulas", range: "B23:B30", row: 1, col: 0, value: "#REF!" }]);
        expect(result.watchlist).toEqual([{ ticker: "AAPL", status: "Available", price: 205, currency: "USD" }]); expect(result.journalRows).toBe(1);
        expect(fetch).not.toHaveBeenCalled(); expect(property).not.toHaveBeenCalled();
    });

    it("checks provider sources without building, clearing or writing any worksheet", () => {
        book.getSheetByName = vi.fn(() => ({}));
        const summary = CFCheckAnalysisSources();
        expect(summary).toMatchObject({ ok: true, symbol: "NVDA", historyRows: 25 });
        for (const action of ["build", "invalidate", "invalidateOptions", "status", "render"]) expect(sheets[action]).not.toHaveBeenCalled();
        expect(log).toHaveBeenCalledWith(expect.stringContaining("CF_ANALYSIS_PROVIDERS "));
    });

    it("can probe default NVDA providers before the analysis sheets exist", () => {
        SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(null);
        const summary = CFCheckAnalysisSources();
        expect(summary).toMatchObject({ ok: true, symbol: "NVDA" });
        expect(sheets.readInput).not.toHaveBeenCalled(); expect(sheets.render).not.toHaveBeenCalled();
    });

    it("adds menu callbacks without making requests", () => {
        const menu = { addItem: vi.fn(function () { return this; }), addSeparator: vi.fn(function () { return this; }), addToUi: vi.fn() };
        SpreadsheetApp.getUi.mockReturnValue({ createMenu: vi.fn(() => menu) });
        CFAnalysisMenu_();
        expect(menu.addItem).toHaveBeenCalledWith("Build analysis sheets", "CFBuildAnalysis");
        expect(menu.addItem).toHaveBeenCalledWith("Refresh selected ticker", "CFRefreshAnalysis");
        expect(menu.addToUi).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
    });
});

const edit = (name = "CF Analysis", row = 4, column = 2, lastRow = row, lastColumn = column) => ({ source: book,
    range: { getSheet: () => ({ getName: () => name }), getRow: () => row, getLastRow: () => lastRow, getColumn: () => column, getLastColumn: () => lastColumn } });

describe("simple onEdit safety", () => {
    it("clears every derived chart and strategy after ticker edits without requesting data", () => {
        const visuals = { invalidate: vi.fn() }, strategies = { invalidate: vi.fn() }, images = { invalidate: vi.fn() };
        vi.stubGlobal("CFAnalysisVisuals", visuals); vi.stubGlobal("CFAnalysisStrategies", strategies); vi.stubGlobal("CFProviderImages", images);
        CFAnalysisHandleEdit_(edit());
        expect(visuals.invalidate).toHaveBeenCalledWith(book, expect.stringContaining("Ticker changed"));
        expect(strategies.invalidate).toHaveBeenCalledWith(book, expect.stringContaining("Ticker changed"));
        expect(images.invalidate).toHaveBeenCalledWith(book); expect(fetch).not.toHaveBeenCalled(); expect(property).not.toHaveBeenCalled();
    });
    it("clears stale analysis for a ticker edit without any network or key reads", () => {
        CFAnalysisHandleEdit_(edit());
        expect(sheets.invalidate).toHaveBeenCalledWith(book, "Ticker changed. Choose Stock analysis → Refresh selected ticker.");
        expect(fetch).not.toHaveBeenCalled(); expect(property).not.toHaveBeenCalled();
    });
    it("clears stale option data for an expiration edit without requests", () => {
        CFAnalysisHandleEdit_(edit("CF Options"));
        expect(sheets.invalidateOptions).toHaveBeenCalledWith(book, "Expiration changed. Refresh the selected ticker.");
        expect(fetch).not.toHaveBeenCalled(); expect(sheets.invalidate).not.toHaveBeenCalled();
    });
    it("recognizes a multi-cell paste overlapping the ticker input", () => {
        CFAnalysisHandleEdit_(edit("CF Analysis", 3, 1, 5, 3));
        expect(sheets.invalidate).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
    });
    it.each([["CF Analysis", 5, 2], ["CF Analysis", 4, 3], ["CF Analysis", 3, 2], ["Other", 4, 2]])("ignores an unrelated %s edit at %s:%s", (name, row, column) => {
        CFAnalysisHandleEdit_(edit(name, row, column));
        expect(sheets.invalidate).not.toHaveBeenCalled(); expect(sheets.invalidateOptions).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    });
    it("ignores missing event data", () => {
        CFAnalysisHandleEdit_(); CFAnalysisHandleEdit_({});
        expect(sheets.invalidate).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    });
});
