import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sheets = vi.hoisted(() => ({
    build: vi.fn(), readInput: vi.fn(), invalidate: vi.fn(), invalidateOptions: vi.fn(), status: vi.fn(), render: vi.fn(), inspect: vi.fn()
}));
vi.mock("../src/CacheFinanceAnalysisSheets.js", () => ({ CFAnalysisSheets: sheets }));

import { CFAnalysisService, CFBuildAnalysis, CFRefreshAnalysis, CFCheckAnalysisSources, CFInspectAnalysis, CFAnalysisMenu_, CFAnalysisHandleEdit_ } from "../src/CacheFinanceAnalysis.js";

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

describe("analysis spreadsheet actions", () => {
    it("builds sheets before fetching and rendering the selected ticker", () => {
        const summary = CFBuildAnalysis();
        expect(sheets.build).toHaveBeenCalledWith(book); expect(summary).toMatchObject({ ok: true, symbol: "NVDA", historyRows: 25, optionContracts: 1 });
        expect(sheets.build.mock.invocationCallOrder[0]).toBeLessThan(sheets.invalidate.mock.invocationCallOrder[0]);
        expect(sheets.render).toHaveBeenCalledOnce(); expect(sheets.render.mock.calls[0][1].symbol).toBe("NVDA");
        expect(lock.releaseLock).toHaveBeenCalledOnce();
    });

    it("invalidates old cells before requests and renders only after the second ticker check", () => {
        CFRefreshAnalysis();
        expect(sheets.invalidate.mock.invocationCallOrder[0]).toBeLessThan(fetch.mock.invocationCallOrder[0]);
        expect(sheets.readInput).toHaveBeenCalledTimes(2);
        expect(sheets.readInput.mock.invocationCallOrder[1]).toBeLessThan(sheets.render.mock.invocationCallOrder[0]);
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
