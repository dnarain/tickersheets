import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CFFormulaWatchlist as W, CFWATCHROW } from "../src/CacheFinanceFormulaWatchlist.js";
import { CFFormulaWorkbook } from "../src/CacheFinanceFormulaWorkbook.js";
import { CFFormulaViews } from "../src/CacheFinanceFormulaViews.js";
import { CFPublicData } from "../src/CacheFinanceResearchFunctions.js";
import { CFAnalysisData } from "../src/CacheFinanceAnalysisData.js";
import { CFWatchlist } from "../src/CacheFinanceAnalysisWatchlist.js";
import { ManagedBook } from "./helpers/ManagedSheetMock.js";

let book, main, quote, details;
beforeEach(() => {
    vi.stubGlobal("SpreadsheetApp", { flush: vi.fn() });
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-12T22:00:00.000Z"));
    book = new ManagedBook(); main = book.insertSheet("Analysis");
    main.getRange("Z1").setValue("CACHEFINANCE_ANALYSIS_V1"); main.getRange("Z2").setValue("TICKERSHEETS_FORMULAS_V1");
    main.getRange("B4").setValue("NVDA"); main.getRange("Z4").setValue(5);
    book.insertSheet("Quote data").getRange("Z1").setValue("TICKERSHEETS_QUOTE_DATA_V1");
    vi.spyOn(CFFormulaWorkbook, "prepareSheet").mockImplementation((target, name, marker) => {
        const sheet = CFFormulaWorkbook.ensureSheet(target, name, marker);
        sheet.getRange(1, 1, Math.max(100, sheet.getLastRow()), sheet.getMaxColumns()).breakApart().clear();
        sheet.setFrozenRows(0); sheet.setFrozenColumns(0); sheet.getRange("Z1").setValue(marker);
        return sheet;
    });
    const history = Array.from({ length: 260 }, (_, index) => ({ date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), close: 100 + index, adjustedClose: 100 + index, volume: 1000 }));
    quote = { ok: true, symbol: "AAPL", chart: { price: 359, currency: "USD", history },
        quote: { price: 360, quoteTime: "2026-11-12T21:15:00.000Z", session: "After-hours" },
        source: "https://query1.finance.yahoo.com/v8/finance/chart/AAPL", retrievedAt: new Date().toISOString() };
    details = { ok: true, symbol: "AAPL", fields: { trailing_pe: { value: 20 }, eps_ttm: { value: 0 }, market_cap: { value: 1e9 }, target_price: { value: 400 } },
        details: { nextEarnings: { dates: ["2027-01-28"] } }, source: "https://finance.yahoo.com/quote/AAPL/", retrievedAt: new Date().toISOString() };
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const fields = table => Object.fromEntries(table.slice(1));
const services = () => {
    vi.spyOn(CFPublicData, "quote").mockImplementation(() => quote);
    vi.spyOn(CFPublicData, "details").mockImplementation(() => details);
    vi.spyOn(CFPublicData, "options").mockImplementation(() => { throw new Error("Watchlist must not fetch options"); });
};

describe("other-ticker watchlist function", () => {
    it("keeps its 30 field keys and order identical to the selected-stock worksheet summary", () => {
        expect(W.keys()).toEqual(CFFormulaViews.selectedMetrics().map(([key]) => key));
        expect(W.keys()).toHaveLength(30);
    });
    it("returns quote and fundamental values plus technical metrics without requesting options", () => {
        services(); const result = CFWATCHROW(" aapl ", 1), row = fields(result);
        expect(result).toHaveLength(31); expect(result.every(line => line.length === 2)).toBe(true);
        expect(result[0]).toEqual(["Field", "Value"]);
        expect(row).toMatchObject({ status: "Available", price: 360, currency: "USD", price_session: "After-hours", eps_ttm: 0,
            trailing_pe: 20, market_cap: 1e9, target_price: 400, next_earnings: "2027-01-28", rsi14: 100, sma50: 334.5,
            sma200: 259.5, bar_count: 260, previous_close: 358, atm_iv: "N/A", previous_rsi2: "N/A" });
        expect(row.return1d).toBeCloseTo(359 / 358 - 1);
        expect(row.return1m).toBeCloseTo(359 / 338 - 1);
        expect(CFPublicData.quote).toHaveBeenCalledWith("AAPL", expect.any(Object), 1);
        expect(CFPublicData.details).toHaveBeenCalledWith("AAPL", expect.any(Object), 1);
        expect(CFPublicData.options).not.toHaveBeenCalled();
    });
    it("caches the summarized row for repeated ticker/refresh calls and refetches for a new refresh number", () => {
        services(); const calculate = vi.spyOn(CFAnalysisData, "calculate");
        const first = CFWATCHROW("AAPL", 1), repeated = CFWATCHROW(" aapl ", 1);
        expect(repeated).toEqual(first); expect(CFPublicData.quote).toHaveBeenCalledTimes(1); expect(calculate).toHaveBeenCalledTimes(1);
        CFWATCHROW("AAPL", 2); expect(CFPublicData.quote).toHaveBeenCalledTimes(2); expect(calculate).toHaveBeenCalledTimes(2);
    });
    it("retains the source retrieval time and drops missing optional values instead of inventing zero", () => {
        services(); quote.retrievedAt = "2026-11-12T21:59:45.000Z"; quote.chart.currency = ""; details.fields.eps_ttm.value = null; details.details.nextEarnings.dates = [];
        const row = fields(CFWATCHROW("AAPL", 1));
        expect(row.retrieved_at).toBe(quote.retrievedAt); expect(row.currency).toBe("N/A"); expect(row.eps_ttm).toBe("N/A"); expect(row.next_earnings).toBe("N/A");
    });
    it("can report partial quote or fundamental availability without treating missing metrics as zero", () => {
        services(); details.ok = false;
        expect(fields(CFWATCHROW("AAPL", 1))).toMatchObject({ status: "Quote available; fundamentals unavailable", price: 360, eps_ttm: "N/A", rsi14: 100 });
        quote.ok = false; details.ok = true;
        expect(fields(CFWATCHROW("AAPL", 2))).toMatchObject({ status: "Fundamentals available; quote unavailable", price: "N/A", eps_ttm: 0, rsi14: "N/A", bar_count: 0 });
    });
    it.each(["", " ", "=NVDA", "BAD:NVDA", "A A", null, 123])("rejects unsupported ticker input before calling providers (%#)", ticker => {
        services(); const row = fields(CFWATCHROW(ticker, 1));
        expect(row.status).toBe("N/A: Enter a supported ticker."); expect(row.price).toBe("N/A");
        expect(CFPublicData.quote).not.toHaveBeenCalled(); expect(CFPublicData.details).not.toHaveBeenCalled();
    });
    it("rejects invalid refresh values and contains service exceptions without returning their text", () => {
        services();
        expect(fields(CFWATCHROW("AAPL", "NOW()"))).toMatchObject({ price: "N/A", status: "N/A: Use a whole refresh number from 0 to 2147483647." });
        expect(CFPublicData.quote).not.toHaveBeenCalled();
        CFPublicData.quote.mockImplementation(() => { throw new Error("secret-request-cookie"); });
        const result = CFWATCHROW("AAPL", 1);
        expect(fields(result).status).toBe("N/A: Request or response unavailable."); expect(JSON.stringify(result)).not.toContain("secret-request-cookie");
    });
    it("returns a fixed unavailable status when both public datasets fail", () => {
        services(); quote.ok = false; details.ok = false;
        expect(fields(CFWATCHROW("AAPL", 1))).toMatchObject({ status: "N/A: Quote and fundamentals unavailable.", price: "N/A", eps_ttm: "N/A" });
    });
});

describe("formula-driven watchlist layout and refresh", () => {
    it("uses source formulas and references the selected stock without a second custom-function call", () => {
        services(); const result = W.build(book), sheet = book.getSheetByName("Watchlist"), source = book.getSheetByName("Watchlist data");
        expect(result.sharedRefresh).toBe("Analysis!Z4"); expect(sheet.getRange("Z4").getFormula()).toBe("=Analysis!Z4");
        expect(sheet.getRange("A8:A12").getValues()).toEqual([["NVDA"], ["AAPL"], ["MSFT"], ["GOOGL"], ["AMZN"]]);
        expect(source.getRange("A7").getFormula()).toBe('=IF(Watchlist!A8="","",IF(UPPER(TRIM(Watchlist!A8))=UPPER(TRIM(Analysis!$B$4)),ARRAYFORMULA(\'Quote data\'!$AA$7:$AB$37),CFWATCHROW(Watchlist!A8,Watchlist!$Z$4)))');
        expect(source.getRange("A767").getFormula()).toContain('Watchlist!A27');
        expect(source.getRange("A8:B37").getValues().every(row => row.every(value => value === ""))).toBe(true);
        expect(sheet.getRange("C8").getFormula()).toContain('MATCH("price",\'Watchlist data\'!$A$8:$A$37,0)');
        expect(sheet.getRange("C8").getFormula()).toContain('COUNTIFS(\'Watchlist data\'!$A$8:$A$37,"price",\'Watchlist data\'!$B$8:$B$37,"<>")=0');
        expect(sheet.getRange("C8").getFormula()).toBe('=IF($A8="","",' + CFFormulaWorkbook.lookup("price", "'Watchlist data'!$A$8:$A$37", "'Watchlist data'!$B$8:$B$37") + ')');
        expect(sheet.getRange("C9").getFormula()).toContain('\'Watchlist data\'!$B$48:$B$77');
        expect(CFPublicData.quote).not.toHaveBeenCalled(); expect(CFPublicData.details).not.toHaveBeenCalled();
    });
    it("preserves ticker inputs and every saved journal record while rebuilding its own formula views", () => {
        W.build(book); const sheet = book.getSheetByName("Watchlist"), journal = book.getSheetByName("Journal");
        sheet.getRange("A8:A10").setValues([["TSE:RY"], [" aapl "], [123]]);
        journal.getRange("A8:R8").setValues([[new Date(), "TSE:RY", 100, "CAD", "2026-11-12T21:00:00Z", "2026-11-12", 0, 20, 0, 120, "2027-01-01", 0, 0, 0, 0, 0, false, 0]]);
        const before = journal.getRange("A1:R8").getValues();
        W.build(book);
        expect(sheet.getRange("A8:A10").getValues()).toEqual([["TSE:RY"], [" aapl "], [123]]);
        expect(journal.getRange("A1:R8").getValues()).toEqual(before);
    });
    it("preserves intentionally empty inputs and uses an explicit supplied input list", () => {
        W.build(book, []); expect(book.getSheetByName("Watchlist").getRange("A8:A27").getValues().every(row => row[0] === "")).toBe(true);
        W.build(book); expect(book.getSheetByName("Watchlist").getRange("A8").getValue()).toBe("");
        W.build(book, [["MSFT"]]); expect(book.getSheetByName("Watchlist").getRange("A8:A9").getValues()).toEqual([["MSFT"], [""]]);
    });
    it("uses the latest matching saved timestamp plus currency and guards blank prior values", () => {
        W.build(book); const sheet = book.getSheetByName("Watchlist");
        expect(sheet.getRange("AA8").getFormula()).toContain('MAX(FILTER(Journal!$A$8:$A');
        expect(sheet.getRange("AA8").getFormula()).toContain('Journal!$D$8:$D=$D8');
        expect(sheet.getRange("Y8").getFormula()).toContain('Journal!$A$8:$A=$AA8');
        expect(sheet.getRange("T8").getFormula()).toContain('COUNTIFS(INDIRECT("Journal!C"&$Y8),"<>")=0');
        expect(sheet.getRange("U8").getFormula()).toContain('$K8-INDIRECT("Journal!G"&$Y8)');
        expect(sheet.getRange("V8").getFormula()).toContain('$R8-INDIRECT("Journal!J"&$Y8)');
        expect(sheet.getRange("T7").getValue()).toBe("Price change since saved snapshot");
        expect(CFWatchlist.headers()[19]).toBe("Price change since prior refresh");
    });
    it("refreshes only the global control and leaves all ticker inputs, result formulas and journal rows intact", () => {
        services(); W.build(book); const sheet = book.getSheetByName("Watchlist"), journal = book.getSheetByName("Journal");
        const tickerBefore = sheet.getRange("A8:A27").getValues(), formulaBefore = sheet.getRange("C8").getFormula(), journalBefore = journal.getRange("A1:R8").getValues();
        const result = W.refresh(book);
        expect(result).toMatchObject({ ok: true, refresh: 6, sharedRefresh: "Analysis!Z4" }); expect(main.getRange("Z4").getValue()).toBe(6);
        expect(sheet.getRange("Z4").getFormula()).toBe("=Analysis!Z4"); expect(sheet.getRange("A8:A27").getValues()).toEqual(tickerBefore);
        expect(sheet.getRange("C8").getFormula()).toBe(formulaBefore); expect(journal.getRange("A1:R8").getValues()).toEqual(journalBefore);
        expect(CFPublicData.quote).not.toHaveBeenCalled(); expect(CFPublicData.details).not.toHaveBeenCalled();
    });
    it.each(["Watchlist", "Watchlist data", "Journal"])("rejects an unmarked reserved %s tab before changing another sheet", name => {
        const conflict = book.insertSheet(name); conflict.getRange("A1").setValue("My data"); const count = book.sheets.size;
        expect(() => W.build(book)).toThrow(/not managed by TickerSheets/);
        expect(conflict.getRange("A1").getValue()).toBe("My data"); expect(book.sheets.size).toBe(count); expect(CFFormulaWorkbook.prepareSheet).not.toHaveBeenCalled();
    });
    it("requires the selected-stock source tabs and does not manufacture a partial standalone workbook", () => {
        const empty = new ManagedBook(); expect(() => W.build(empty)).toThrow(/Build the formula sample/); expect(empty.sheets.size).toBe(0);
        expect(() => W.refresh(empty)).toThrow(/Build the formula sample/);
    });
});
