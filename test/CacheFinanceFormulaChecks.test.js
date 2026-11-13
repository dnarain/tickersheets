import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CFFormulaChecks as C, CFValidateFormulaWorkbook } from "../src/CacheFinanceFormulaChecks.js";
import { CFFormulaWorkbook } from "../src/CacheFinanceFormulaWorkbook.js";
import { CFAnalysisData } from "../src/CacheFinanceAnalysisData.js";
import { ManagedBook, ManagedRange } from "./helpers/ManagedSheetMock.js";

let book, fetch, properties;
const keys = ["sma20", "sma50", "sma200", "ema12", "ema26", "macd", "macdSignal", "macdHistogram", "rsi14", "drawdown", "return1d"];
function set(sheet, address, value, formula) {
    if (formula) sheet.getRange(address).setFormula(formula);
    sheet.getRange(address).setValue(value);
}
function historyFixture(count = 240) {
    const rows = Array.from({ length: count }, (_, index) => ({ date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10), open: 100 + index, high: 105 + index, low: 95 + index, close: 100 + index / 4 + Math.sin(index) * 5, adjustedClose: 100 + index / 5 + Math.cos(index) * 4, volume: index === 30 ? 0 : 100000 + index }));
    // Missing values and zero prices must restart indicators; zero volume is valid.
    if (count > 60) { rows[40].close = null; rows[41].adjustedClose = null; rows[60].close = 0; }
    const gold = CFAnalysisData.calculate(rows), sheet = book.getSheetByName("Price history");
    sheet.getRange(8, 1, count, 7).setValues(rows.map(row => [row.date, row.open, row.high, row.low, row.close ?? "N/A", row.adjustedClose ?? "N/A", row.volume]));
    sheet.getRange(8, 8, count, 11).setValues(gold.series.map(row => keys.map(key => row[key] ?? "")));
    sheet.getRange("BK7:BL10").setValues([["SMA20", gold.summary.sma20 ?? "N/A"], ["SMA50", gold.summary.sma50 ?? "N/A"], ["SMA200", gold.summary.sma200 ?? "N/A"], ["RSI14", gold.summary.rsi14 ?? "N/A"]]);
    const main = book.getSheetByName("Analysis"); main.getRange("B16:B18").setValues([[gold.summary.rsi14 ?? "N/A"], [gold.summary.sma50 ?? "N/A"], [gold.summary.sma200 ?? "N/A"]]);
    return { rows, gold };
}
beforeEach(() => {
    ManagedRange.prototype.getFormulas = function () {
        return Array.from({ length: this.height }, (_value, r) => Array.from({ length: this.width }, (_value, c) => this.sheet.formulas.get((this.row + r) + ":" + (this.col + c)) || ""));
    };
    ManagedRange.prototype.getDisplayValues = function () {
        return this.getValues().map((row, r) => row.map((value, c) => this.sheet.displayed?.get((this.row + r) + ":" + (this.col + c)) ?? String(value)));
    };
    ManagedRange.prototype.getDisplayValue = function () { return this.getDisplayValues()[0][0]; };
    book = new ManagedBook();
    for (const [name] of Object.entries(C.ranges())) {
        const sheet = book.insertSheet(name); sheet.maxRows = 2100; sheet.maxCols = 100;
        sheet.getRange("Z1").setValue(CFFormulaWorkbook.markers()[name]);
    }
    book.getSheetByName("Analysis").getRange("B4").setValue("NVDA");
    book.getSheetByName("Analysis").getRange("Z2").setValue("TICKERSHEETS_FORMULAS_V1");
    // Cached cell values are separate from formulas in a real spreadsheet.
    const inspected = { "Analysis": ["B9", "B16", "B17", "E17"], "Formulas": ["B23", "B24", "G34"], "Quote data": ["A7", "D7", "O7"], "Price history": ["A7", "I57", "P22"], "Options": ["A7", "S4"], "Earnings": ["A7"], "Strategies": ["E4"] };
    for (const [name, addresses] of Object.entries(inspected)) for (const address of addresses) set(book.getSheetByName(name), address, "N/A", "=1");
    set(book.getSheetByName("Quote data"), "A7", "Field", '=CFQUOTE(Analysis!B4,"all",Analysis!E4)');
    set(book.getSheetByName("Quote data"), "D7", "Provider", '=CFQUOTECOMPARE(Analysis!B4,Analysis!E4)');
    set(book.getSheetByName("Quote data"), "O7", "Expiration", '=CFEXPIRATIONS(Analysis!B4,Analysis!E4)');
    set(book.getSheetByName("Price history"), "A7", "Date", '=CFHISTORY(Analysis!B4,510,Analysis!E4)');
    set(book.getSheetByName("Options"), "A7", "Contract", '=CFOPTIONS(Analysis!B4,B4,Analysis!E4)');
    set(book.getSheetByName("Earnings"), "A7", "Period", '=CFEARNINGS(Analysis!B4,"earnings",Analysis!E4)');
    book.getSheetByName("Quote data").getRange("A8:B8").setValues([["price", 123.45]]);
    book.getSheetByName("Analysis").getRange("B9").setValue(123.45); book.getSheetByName("Formulas").getRange("B23").setValue(123.45);
    book.getSheetByName("Options").getRange("Y4").setValue("N/A"); book.getSheetByName("Research").getRange("Q25").setValue("N/A");
    fetch = vi.fn(() => { throw new Error("Checker must not request providers"); }); properties = vi.fn(() => { throw new Error("Checker must not read or write keys"); });
    vi.stubGlobal("UrlFetchApp", { fetch, fetchAll: fetch }); vi.stubGlobal("PropertiesService", { getScriptProperties: properties, getUserProperties: properties });
    vi.stubGlobal("SpreadsheetApp", { getActiveSpreadsheet: () => book });
});
afterEach(() => { delete ManagedRange.prototype.getFormulas; delete ManagedRange.prototype.getDisplayValues; delete ManagedRange.prototype.getDisplayValue; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("numeric worksheet comparison", () => {
    it("accepts numeric zero and floating point rounding without coercing missing values", () => {
        expect(C.compareNumeric(0, 0)).toMatchObject({ status: "passed", available: true });
        expect(C.compareNumeric(1 / 3 + 1e-10, 1 / 3).status).toBe("passed");
        expect(C.compareNumeric(1e8 + 0.5, 1e8).status).toBe("passed");
        expect(C.compareNumeric(1e8 + 5, 1e8).status).toBe("failed");
        for (const actual of ["", null, "N/A", "#N/A", "0", NaN, Infinity]) expect(C.compareNumeric(actual, 0).status).toBe("failed");
    });
    it("accepts only explicit missing markers when the independent result is missing", () => {
        for (const actual of ["", null, undefined, "N/A", "#N/A", "N/A: no observations"]) expect(C.compareNumeric(actual, null)).toMatchObject({ status: "passed", available: false });
        for (const actual of [0, 12, "bogus", false, NaN, Infinity, "#REF!"]) expect(C.compareNumeric(actual, null).status).toBe("failed");
    });
    it("reports Loading and Thinking as pending", () => {
        expect(C.compareNumeric("Loading...", 3).status).toBe("pending");
        expect(C.compareNumeric("Thinking…", null).status).toBe("pending");
    });
});

describe("read-only formula workbook checks", () => {
    it("checks all eleven worksheet columns, gaps and dashboard links without requesting providers", () => {
        const { gold } = historyFixture();
        const before = [...book.sheets].map(([name, sheet]) => [name, sheet.events.length, [...sheet.cells], [...sheet.formulas]]);
        const report = C.validate(book);
        expect(report).toMatchObject({ ok: true, ticker: "NVDA", failed: 0, pending: 0, historyRows: 240 });
        expect(report.numericComparisons).toBe(gold.series.reduce((total, row) => total + keys.filter(key => typeof row[key] === "number").length, 0));
        expect(report.expectedGaps).toBeGreaterThan(0); expect(report.passed).toBe(240 * 11 + 6 + 17);
        expect(report.sourceFormulaAddresses).toEqual(expect.arrayContaining(["Quote data!A7", "Price history!A7", "Options!A7", "Earnings!A7"]));
        expect([...book.sheets].map(([name, sheet]) => [name, sheet.events.length, [...sheet.cells], [...sheet.formulas]])).toEqual(before);
        expect(fetch).not.toHaveBeenCalled(); expect(properties).not.toHaveBeenCalled();
    });
    it.each(keys.map((key, index) => [key, index]))("finds a wrong %s value at its worksheet column", (_key, index) => {
        historyFixture(280);
        const sheet = book.getSheetByName("Price history"), row = 287, column = index + 8;
        sheet.getRange(row, column).setValue(9999);
        const report = C.validate(book);
        expect(report.failed).toBe(1); expect(report.errors[0]).toEqual({ address: "Price history!" + C.column(column) + row, reason: "Numeric values differ" });
    });
    it("skips all empty history rows and leaves source-dependent checks pending", () => {
        const report = C.validate(book);
        expect(report.historyRows).toBe(0); expect(report.numericComparisons).toBe(0); expect(report.pending).toBe(1);
        expect(report.availability).toEqual(expect.arrayContaining([expect.objectContaining({ sheet: "Price history", reason: "History unavailable; numeric checks pending" })]));
    });
    it("reports source loading, formula errors, expected chart gaps and missing FRED keys separately", () => {
        historyFixture(30);
        set(book.getSheetByName("Macro"), "A15", "N/A: Add your FRED API key in Settings", '=CFFRED("DGS10",400,Analysis!E4)');
        set(book.getSheetByName("Quote data"), "O7", "Loading...", '=CFEXPIRATIONS(Analysis!B4,Analysis!E4)');
        book.getSheetByName("Research").getRange("R550").setValue("#N/A");
        book.getSheetByName("Strategies").getRange("B25").setValue("#DIV/0!");
        book.getSheetByName("Options").getRange("B31").setValue("#SPILL!");
        const report = C.validate(book);
        expect(report.failed).toBe(2); expect(report.pending).toBe(1);
        expect(report.errors.map(error => error.address)).toEqual(expect.arrayContaining(["Options!B31", "Strategies!B25"]));
        expect(report.availability).toEqual(expect.arrayContaining([
            expect.objectContaining({ sheet: "Macro", reason: "FRED API key required" }), expect.objectContaining({ sheet: "Quote data", reason: "Source calculation pending" }), expect.objectContaining({ sheet: "Research", reason: "Unavailable value or expected calculation gap" })
        ]));
    });
    it("checks Watchlist journal-time helpers in column AA", () => {
        historyFixture(20);
        book.getSheetByName("Watchlist").getRange("AA8").setValue("#VALUE!");
        const report = C.validate(book);
        expect(report.errors).toEqual([{ address: "Watchlist!AA8", reason: "Worksheet formula error" }]);
        expect(C.ranges().Research[1]).toBe(1600);
    });
    it("treats raw #ERROR! with visible Loading or Thinking as pending, including dependent numeric checks", () => {
        historyFixture(20);
        const options = book.getSheetByName("Options"), main = book.getSheetByName("Analysis");
        options.getRange("A7").setValue("#ERROR!"); options.displayed = new Map([["7:1", "Loading..."]]);
        main.getRange("B9").setValue("#ERROR!"); main.displayed = new Map([["9:2", "Thinking…"]]);
        const report = C.validate(book);
        expect(report.failed).toBe(0); expect(report.pending).toBeGreaterThanOrEqual(2); expect(report.ok).toBe(false);
        expect(report.availability).toEqual(expect.arrayContaining([
            expect.objectContaining({ sheet: "Options", reason: "Source calculation pending" }),
            expect.objectContaining({ sheet: "Analysis", reason: "Dependent calculation pending" })
        ]));
        expect(fetch).not.toHaveBeenCalled(); expect(properties).not.toHaveBeenCalled();
    });
    it("reports a genuine visible #ERROR! instead of treating it as pending", () => {
        historyFixture(20);
        const options = book.getSheetByName("Options"); options.getRange("A7").setValue("#ERROR!"); options.displayed = new Map([["7:1", "#ERROR!"]]);
        const report = C.validate(book);
        expect(report.errors).toEqual([{ address: "Options!A7", reason: "Worksheet formula error" }]);
        expect(report.failed).toBe(1); expect(report.pending).toBe(0);
    });
    it("detects divergent price, indicator and ATM references, including zero versus unavailable", () => {
        historyFixture(230);
        book.getSheetByName("Formulas").getRange("B23").setValue(124);
        book.getSheetByName("Analysis").getRange("B16").setValue("N/A");
        book.getSheetByName("Options").getRange("Y4").setValue(0);
        const report = C.validate(book);
        expect(report.failed).toBe(3);
        expect(report.errors.map(error => error.address)).toEqual(expect.arrayContaining(["Formulas!B23 (Quote data price)", "Analysis!B16 (RSI14 summary)", "Options!Y4 (Research!Q25 ATM IV)"]));
    });
    it("accepts matching numeric ATM IV and matching partial-unavailable ATM IV", () => {
        historyFixture(20);
        for (const value of [0.42, "N/A"]) {
            book.getSheetByName("Options").getRange("Y4").setValue(value); book.getSheetByName("Research").getRange("Q25").setValue(value);
            expect(C.validate(book).failed).toBe(0);
        }
    });
    it("limits error output and never logs formulas, provider bodies or credentials", () => {
        historyFixture(10);
        book.getSheetByName("Research").getRange("A100:A129").setValues(Array.from({ length: 30 }, () => ["#REF! private provider body secret-value"]));
        const log = vi.spyOn(console, "log").mockImplementation(() => {}), report = CFValidateFormulaWorkbook();
        expect(report.failed).toBe(30); expect(report.errors).toHaveLength(20);
        expect(log).toHaveBeenCalledTimes(1); expect(log.mock.calls[0][0]).not.toMatch(/secret-value|private provider body|CFHISTORY\(/);
        expect(fetch).not.toHaveBeenCalled(); expect(properties).not.toHaveBeenCalled();
    });
    it("does not inspect an unowned managed-name data range", () => {
        historyFixture(20);
        const sheet = book.getSheetByName("Research"); sheet.getRange("Z1").setValue("MY_PERSONAL_SHEET");
        sheet.getRange("A100").setValue("#REF!");
        const report = C.validate(book);
        expect(report.errors).toEqual([expect.objectContaining({ address: "Research!Z1", reason: "Sheet is not managed by TickerSheets" })]);
    });
});
