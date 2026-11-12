import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CFWatchlist as W, CFBuildWatchlist, CFRefreshWatchlist } from "../src/CacheFinanceAnalysisWatchlist.js";
import { CFPublicData } from "../src/CacheFinanceResearchFunctions.js";
import { ManagedBook } from "./helpers/ManagedSheetMock.js";

let book;
const snapshot = (extra = {}) => ({ ok: true, ticker: "NVDA", symbol: "NVDA", fetchedAt: "2026-11-11T22:00:00Z",
    chart: { price: 100, currency: "USD", quoteTime: "2026-11-11T21:00:00Z" }, technical: { summary: { rsi14: 55, indicatorAsOf: "2026-11-10" } },
    statistics: { fields: { trailing_pe: { value: 20 }, eps_ttm: { value: 2 }, target_price: { value: 110 } } }, details: { fields: {}, nextEarnings: { dates: ["2026-11-17"] } },
    options: { ok: true, underlyingPrice: 100, contracts: [{ strike: 100, expiration: "2026-11-20", mid: 1, iv: .4 }] }, ...extra });
function singleTicker(value = "NVDA") { W.build(book); const sheet = book.getSheetByName("Watchlist"); sheet.getRange("A8:A27").clearContent(); sheet.getRange("A8").setValue(value); return sheet; }
function mockData() {
    const history = Array.from({ length: 260 }, (_, index) => ({ date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), close: 100 + index, adjustedClose: 100 + index, volume: 1000 }));
    vi.spyOn(CFPublicData, "chart").mockReturnValue({ ok: true, symbol: "NVDA", chart: { price: 100, currency: "USD", quoteTime: "2026-11-11T21:00:00Z", history }, retrievedAt: "2026-11-11T22:00:00Z", source: "https://query1.finance.yahoo.com/v8/finance/chart/NVDA", cacheHit: false });
    vi.spyOn(CFPublicData, "details").mockReturnValue({ ok: true, symbol: "NVDA", fields: { trailing_pe: { value: 20 }, eps_ttm: { value: 0 }, market_cap: { value: 1e9 }, target_price: { value: 110 } },
        details: { fields: { trailing_pe: { value: null } }, nextEarnings: { dates: ["2026-11-17"] } } });
}
beforeEach(() => { book = new ManagedBook(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("watchlist tab ownership and ticker inputs", () => {
    it("creates marked tabs, preserves user ticker inputs on rebuild and leaves unrelated sheets alone", () => {
        const other = book.insertSheet("Personal Notes"); other.getRange("A1").setValue("Keep this");
        W.build(book); const sheet = book.getSheetByName("Watchlist"); sheet.getRange("A8").setValue("TSE:RY"); W.build(book);
        expect(sheet.getRange("A8").getValue()).toBe("TSE:RY"); expect(other.getRange("A1").getValue()).toBe("Keep this");
        expect(sheet.getRange("Z1").getValue()).toBe("CACHEFINANCE_WATCHLIST_V1"); expect(book.getSheetByName("Journal").getRange("Z1").getValue()).toBe("CACHEFINANCE_JOURNAL_V1");
        expect(sheet.frozenColumns).toBe(0); expect(sheet.hiddenColumn).toBe(26);
    });
    it.each(["Watchlist", "Journal"])("checks ownership before mutating any tab when %s exists", name => {
        const conflict = book.insertSheet(name); conflict.getRange("A1").setValue("User data"); const count = book.sheets.size;
        expect(() => W.build(book)).toThrow(/not managed by TickerSheets/); expect(conflict.getRange("A1").getValue()).toBe("User data"); expect(book.sheets.size).toBe(count);
    });
    it("normalizes ticker text and preserves non-string invalid inputs for explicit errors", () => {
        singleTicker(" aapl "); book.getSheetByName("Watchlist").getRange("A9").setValue(123);
        expect(W.inputs(book)).toEqual([{ row: 8, input: "AAPL" }, { row: 9, input: 123 }]);
    });
    it("refuses to read inputs from a missing watchlist", () => { expect(() => W.inputs(book)).toThrow(/Build the watchlist first/); });
    it("clears only edited result rows and keeps ticker inputs and other results", () => {
        const sheet = singleTicker(); sheet.getRange("B8").setValue("Old"); sheet.getRange("B9").setValue("Other");
        W.edit({ source: book, range: sheet.getRange("A8") }); expect(sheet.getRange("A8").getValue()).toBe("NVDA"); expect(sheet.getRange("B8").getValue()).toBe(""); expect(sheet.getRange("B9").getValue()).toBe("Other");
    });
    it.each([[28, 1], [8, 0], [8, -1], [7, 1]])("does not issue a zero-height clear range for row %i/count %i", (first, count) => {
        const sheet = singleTicker(); sheet.getRange("B8").setValue("Keep"); expect(() => W.clearRows(book, first, count)).not.toThrow(); expect(sheet.getRange("B8").getValue()).toBe("Keep");
    });
    it("clips edits that include headers to the twenty input rows", () => {
        const sheet = singleTicker(); sheet.getRange("B8:B10").setValues([[1], [2], [3]]); W.edit({ source: book, range: sheet.getRange("A6:A9") });
        expect(sheet.getRange("B8:B10").getValues()).toEqual([[""], [""], [3]]); expect(sheet.getRange("A7").getValue()).toBe("Ticker");
    });
    it("ignores edits to output columns, unrelated sheets or rows outside the inputs", () => {
        const sheet = singleTicker(); sheet.getRange("B8").setValue("Keep"); const other = book.insertSheet("Other");
        for (const range of [sheet.getRange("B8"), sheet.getRange("A28"), sheet.getRange("A1"), other.getRange("A8")]) W.edit({ source: book, range });
        W.edit(null); expect(sheet.getRange("B8").getValue()).toBe("Keep");
    });
});

describe("watchlist values and change journal", () => {
    it("preserves valid fallback fundamentals and permits explicit zero values", () => {
        const data = snapshot(); data.details.fields = { trailing_pe: { value: null }, eps_ttm: { value: 0 } };
        expect(W.metrics(data)).toMatchObject({ pe: 20, eps: 0, target: 110 }); expect(W.change(0, 0)).toBe(0); expect(W.change(null, 0)).toBeNull(); expect(W.change(1, "N/A")).toBeNull();
    });
    it("compares only the latest prior observation for the same symbol and currency", () => {
        W.record(book, snapshot());
        W.record(book, snapshot({ chart: { price: 1000, currency: "CAD" } }));
        W.record(book, snapshot({ ticker: "AAPL", symbol: "AAPL" }));
        const data = snapshot(); data.chart.price = 103; data.technical.summary.rsi14 = 50; data.statistics.fields.eps_ttm.value = 2.5; data.statistics.fields.target_price.value = 120;
        data.details.nextEarnings.dates = ["2026-11-18"]; data.options.contracts[0].iv = .45;
        const result = W.record(book, data);
        expect(result).toMatchObject({ row: 11, symbol: "NVDA", delta: { price: 3, rsi14: -5, eps: .5, target: 10, earningsChanged: true } }); expect(result.delta.ivPoints).toBeCloseTo(5);
    });
    it("keeps a missing previous value missing instead of comparing it with zero", () => {
        const first = snapshot(); first.statistics.fields.eps_ttm.value = null; W.record(book, first);
        const result = W.record(book, snapshot()); expect(result.delta.eps).toBeNull();
    });
    it("stores actual Date values for timestamp columns and text for earnings/indicator dates", () => {
        W.record(book, snapshot()); const journal = book.getSheetByName("Journal");
        expect(journal.getRange("A8").getValue()).toEqual(new Date("2026-11-11T22:00:00Z")); expect(journal.getRange("E8").getValue()).toEqual(new Date("2026-11-11T21:00:00Z"));
        expect(journal.getRange("F8").getValue()).toBe("2026-11-10"); expect(journal.getRange("K8").getValue()).toBe("2026-11-17"); expect(journal.formatAt(8, 5)).toBe("yyyy-mm-dd hh:mm:ss"); expect(journal.formatAt(8, 6)).toBe("@"); expect(journal.formatAt(8, 11)).toBe("@");
        const write = journal.events.findIndex(event => event.kind === "values" && event.row === 8);
        expect(journal.events.findIndex(event => event.kind === "format" && event.row === 8 && event.col === 11 && event.value === "@")).toBeLessThan(write);
    });
    it("ignores unsuccessful snapshots and does not put keys, pages or exception content in cells", () => {
        expect(W.record(book, { ok: false, error: "private" })).toBeNull(); expect(book.sheets.size).toBe(0);
        const data = snapshot({ fredKey: "private-key", body: "private-page", session: "private-cookie" }); data.details.nextEarnings.dates = ["=IMPORTXML(1)"];
        W.record(book, data); const cells = [...book.sheets.values()].flatMap(sheet => [...sheet.cells.values()]); expect(cells.join("|")).not.toMatch(/private-key|private-page|private-cookie/);
        expect(book.getSheetByName("Journal").getRange("K8").getValue()).toBe("'=IMPORTXML(1)");
    });
    it("grows a full journal before appending a new row", () => {
        W.build(book); const sheet = book.getSheetByName("Journal"); sheet.maxRows = 8; sheet.getRange("A8").setValue("Existing");
        expect(W.record(book, snapshot()).row).toBe(9); expect(sheet.maxRows).toBe(9);
    });
});

describe("watchlist refresh and ticker changes during requests", () => {
    it("uses the active extended quote and timestamp while keeping regular-close indicators", () => {
        const sheet = singleTicker(); mockData();
        const base = CFPublicData.chart("NVDA"), before = [...base.chart.history];
        vi.spyOn(CFPublicData, "quote").mockReturnValue({ ...base, source: "https://finance.yahoo.com/quote/NVDA/", quote: { price: 158.78, quoteTime: "2026-11-12T01:00:00Z", session: "After-hours" } });
        W.refresh(book);
        expect(sheet.getRange("C8").getValue()).toBe(158.78); expect(sheet.getRange("E8").getValue()).toEqual(new Date("2026-11-12T01:00:00Z")); expect(sheet.getRange("X8").getValue()).toBe("After-hours");
        expect(sheet.getRange("G8").getValue()).toBe(before.at(-1).date); expect(base.chart.history).toEqual(before);
        expect(book.getSheetByName("Journal").getRange("C8").getValue()).toBe(158.78);
        W.clearRows(book); expect(sheet.getRange("X8").getValue()).toBe("");
    });
    it("writes current data with units, Date timestamps and source while preserving ticker inputs", () => {
        const sheet = singleTicker(); mockData(); const result = W.refresh(book, { clock: () => Date.UTC(2026, 10, 11, 22) });
        expect(result).toMatchObject({ ok: true, tickers: 1 }); expect(sheet.getRange("A8").getValue()).toBe("NVDA"); expect(sheet.getRange("B8").getValue()).toBe("Available"); expect(sheet.getRange("C8").getValue()).toBe(100);
        expect(sheet.getRange("E8").getValue()).toEqual(new Date("2026-11-11T21:00:00Z")); expect(sheet.getRange("F8").getValue()).toEqual(new Date("2026-11-11T22:00:00Z"));
        expect(sheet.getRange("O8").getValue()).toBe(20); expect(sheet.getRange("P8").getValue()).toBe(0); expect(sheet.getRange("S8").getValue()).toBe("2026-11-17");
        expect(sheet.formatAt(8, 5)).toBe("yyyy-mm-dd hh:mm:ss"); expect(sheet.formatAt(8, 7)).toBe("@"); expect(sheet.formatAt(8, 19)).toBe("@");
        const write = sheet.events.findIndex(event => event.kind === "values" && event.row === 8 && event.col === 2);
        expect(sheet.events.findIndex(event => event.kind === "format" && event.col === 19 && event.value === "@")).toBeLessThan(write);
    });
    it("clears previous results before a failed source response and records no successful snapshot", () => {
        const sheet = singleTicker(); sheet.getRange("C8").setValue(999); mockData();
        CFPublicData.chart.mockReturnValue({ ok: false, status: "HTTP 404" }); CFPublicData.details.mockReturnValue({ ok: false });
        W.refresh(book); expect(sheet.getRange("C8").getValue()).toBe("N/A"); expect(sheet.getRange("B8").getValue()).toBe("HTTP 404"); expect(book.getSheetByName("Journal").getLastRow()).toBe(7);
    });
    it("does not write a fetched old ticker after the user edits that input", () => {
        const sheet = singleTicker(); mockData(); CFPublicData.details.mockImplementation(() => { sheet.getRange("A8").setValue("AAPL"); return { ok: true, fields: {}, details: {} }; });
        const result = W.refresh(book); expect(result.results[0].status).toBe("Ticker changed during refresh"); expect(sheet.getRange("A8").getValue()).toBe("AAPL"); expect(sheet.getRange("B8").getValue()).toBe(""); expect(book.getSheetByName("Journal").getLastRow()).toBe(7);
    });
    it("also checks current ticker before writing an exception result", () => {
        const sheet = singleTicker(); mockData(); CFPublicData.chart.mockImplementation(() => { sheet.getRange("A8").setValue("AAPL"); throw new Error("secret-request-url"); });
        const result = W.refresh(book); expect(result.results[0].status).toBe("Ticker changed during refresh"); expect(sheet.getRange("B8").getValue()).toBe(""); expect(JSON.stringify(result)).not.toContain("secret-request-url");
    });
    it("shows a safe error for an invalid unchanged ticker", () => {
        const sheet = singleTicker("=1+1"); mockData(); CFPublicData.chart.mockImplementation(() => { throw new Error("private"); });
        const result = W.refresh(book); expect(result.results[0].status).toBe("Invalid ticker or unavailable request"); expect(sheet.getRange("B8").getValue()).toBe("Invalid ticker or unavailable request"); expect(JSON.stringify(result)).not.toContain("private");
    });
    it("reports partial source availability without inventing a quote", () => {
        const sheet = singleTicker(); mockData(); CFPublicData.chart.mockReturnValue({ ok: false, symbol: "NVDA", status: "HTTP 429", source: "https://source.test" });
        W.refresh(book); expect(sheet.getRange("B8").getValue()).toBe("Fundamentals available; quote unavailable"); expect(sheet.getRange("C8").getValue()).toBe("N/A"); expect(sheet.getRange("O8").getValue()).toBe(20);
    });
});

describe("watchlist menu callbacks", () => {
    it("builds against the active spreadsheet and refuses a competing refresh", () => {
        vi.stubGlobal("SpreadsheetApp", { getActiveSpreadsheet: () => book }); expect(CFBuildWatchlist().ok).toBe(true);
        vi.stubGlobal("LockService", { getDocumentLock: () => ({ tryLock: () => false }) }); expect(CFRefreshWatchlist().ok).toBe(false); expect(book.toasts.at(-1)[0]).toBe("Another refresh is running.");
    });
    it("releases the document lock after an unexpected refresh error", () => {
        const releaseLock = vi.fn(); vi.stubGlobal("SpreadsheetApp", { getActiveSpreadsheet: () => book, flush: vi.fn() }); vi.stubGlobal("LockService", { getDocumentLock: () => ({ tryLock: () => true, releaseLock }) });
        vi.spyOn(W, "refresh").mockImplementation(() => { throw new Error("Unexpected"); }); expect(() => CFRefreshWatchlist()).toThrow("Unexpected"); expect(releaseLock).toHaveBeenCalledOnce();
    });
});
