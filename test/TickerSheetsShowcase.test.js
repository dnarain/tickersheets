import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TickerSheetsShowcase } from "../src/TickerSheetsShowcase.js";
import { TickerSheetsTutorial, TickerSheetsBuildDemo, TickerSheetsRefreshData, TickerSheetsInspectDemo } from "../src/TickerSheetsTutorial.js";
import { tutorialBook } from "./helpers/TickerSheetsDemoMock.js";
let book, fetch, keyRead;
beforeEach(() => {
    book = tutorialBook(); fetch = vi.fn(() => { throw new Error("No provider requests in the builder"); });
    keyRead = vi.fn(() => { throw new Error("No key reads in the builder"); });
    vi.stubGlobal("UrlFetchApp", { fetch, fetchAll: fetch });
    vi.stubGlobal("PropertiesService", { getScriptProperties: keyRead, getUserProperties: keyRead });
    vi.stubGlobal("SpreadsheetApp", { getActiveSpreadsheet: () => book, flush: vi.fn(), newDataValidation: () => ({ requireValueInRange(range) { this.range = range; return this; }, requireValueInList(values) { this.values = values; return this; }, setAllowInvalid(value) { this.allowInvalid = value; return this; }, build() { return this; } }) });
    vi.stubGlobal("Utilities", { formatDate: () => "2026-11-13" });
    vi.stubGlobal("Charts", { ChartType: { LINE: "LINE", COLUMN: "COLUMN" } });
    vi.stubGlobal("console", { log: vi.fn() });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function noRequests() { expect(fetch).not.toHaveBeenCalled(); expect(keyRead).not.toHaveBeenCalled(); }
function build() { TickerSheetsBuildDemo(); return book.getSheetByName("Stock analysis"); }

describe("Stock analysis showcase", () => {
    it("shows all 15 APIs as cell formulas with two charts and one shared ticker", () => {
        const sheet = build(), names = new Set();
        for (const tab of book.getSheets()) for (const formula of tab.formulas.values()) {
            for (const match of formula.matchAll(/\b(TICKERSHEETS_[A-Z_]+)\s*\(/g)) names.add(match[1]);
            expect(formula).not.toMatch(/\b(?:CF[A-Z]+|CACHEFINANCES?|TICKERSHEET_[A-Z_]+)\s*\(/);
            expect(formula).not.toMatch(/\b(?:TODAY|NOW)\s*\(/);
        }
        expect([...book.sheets.keys()]).toEqual(["Start here", "Stock analysis"]);
        expect([...names].sort()).toEqual(["QUOTE", "HISTORY", "FUNDAMENTALS", "OPTIONS", "EXPIRATIONS", "FRED", "FIELD", "DATA_STATUS", "STRATEGY", "EARNINGS", "QUOTE_COMPARE", "RSI_TARGETS", "FRED_VALUE", "OPTION_MODEL", "WATCH_ROW"].map(name => "TICKERSHEETS_" + name).sort());
        expect(sheet.getRange("B4").getFormula()).toBe("='Start here'!B4"); expect(sheet.getRange("B7").getFormula()).toBe('=TICKERSHEETS_QUOTE($B$4,"price")');
        expect(sheet.getRange("B214").getValue()).toBe(""); expect(sheet.getRange("E4").getValue()).toBe("2026-11-13");
        expect(sheet.getCharts().map(chart => [chart.type, chart.options.title])).toEqual([["LINE", "Daily closing price"], ["LINE", "Selected strategy: profit/loss at expiration"]]);
        expect(sheet.getCharts()[0].ranges.map(range => [range.row, range.col, range.height, range.width])).toEqual([[53, 1, 120, 1], [53, 5, 120, 1]]);
        expect(sheet.hideSheet).not.toHaveBeenCalled(); noRequests();
    });
    it("leaves every bounded source spill clear of other formulas and labels", () => {
        const sheet = build();
        const rectangles = [[52, 1, 121, 7], [52, 9, 31, 2], [178, 1, 13, 10], [196, 1, 9, 8], [218, 1, 41, 1], [218, 3, 82, 12], [326, 1, 7, 10], [338, 1, 2, 5], [342, 1, 2, 5], [346, 1, 2, 5], [356, 1, 13, 5]];
        for (const [row, col, height, width] of rectangles) {
            const blocked = [...sheet.cells].filter(([key, value]) => {
                const [r, c] = key.split(":").map(Number);
                return value !== "" && r >= row && r < row + height && c >= col && c < col + width && !(r === row && c === col);
            });
            expect(blocked).toEqual([]);
        }
        const chain = sheet.getRange("C218").getFormula();
        expect(chain.match(/TICKERSHEETS_OPTIONS\(/g)).toHaveLength(2);
        expect(chain).toContain("where Col2 = 'Call' and Col3 >= ");
        expect(chain).toContain("where Col2 = 'Put' and Col3 >= ");
        expect(chain).toContain('($B$8*0.8)'); expect(chain).toContain('($B$8*1.2)');
        expect(chain.match(/order by Col3 limit 40/g)).toHaveLength(2);
        expect(chain).not.toMatch(/\bLET\(/); noRequests();
    });
    it("checks both reserved tab names before changing any user sheet", () => {
        const user = book.insertSheet("Stock analysis"); user.getRange("A1").setValue("My research");
        const guide = book.insertSheet("Start here"); guide.getRange("Z1").setValue(TickerSheetsTutorial.marker); guide.getRange("B4").setValue("AAPL");
        const events = [user.events.length, guide.events.length];
        expect(() => TickerSheetsBuildDemo()).toThrow(/Stock analysis.*not managed/);
        expect(user.getRange("A1").getValue()).toBe("My research"); expect(guide.getRange("B4").getValue()).toBe("AAPL");
        expect([user.events.length, guide.events.length]).toEqual(events); expect(book.deleted).toEqual([]); noRequests();
    });
    it("keeps chosen calculator inputs and replaces the two charts when rebuilding", () => {
        const sheet = build();
        sheet.getRange("B214").setValue("2027-01-15"); sheet.getRange("B307").setValue(0.52); sheet.getRange("B310").setValue("Put"); sheet.getRange("B317").setValue(4.5);
        book.getSheetByName("Start here").getRange("B4").setValue("AAPL"); TickerSheetsBuildDemo();
        expect(book.getSheetByName("Stock analysis")).toBe(sheet); expect(sheet.getCharts()).toHaveLength(2);
        expect(sheet.getRange("B214").getValue()).toBe("2027-01-15"); expect(sheet.getRange("B307").getValue()).toBe(0.52);
        expect(sheet.getRange("B310").getValue()).toBe("Put"); expect(sheet.getRange("B317").getValue()).toBe(4.5); noRequests();
    });
    it("refreshes source and model formulas without overwriting calculator inputs", () => {
        const sheet = build(); sheet.getRange("B307").setValue(0.52); sheet.getRange("B214").setValue("2027-01-15");
        const before = [...sheet.formulas], charts = sheet.getCharts();
        const result = TickerSheetsRefreshData();
        expect(result.recalculated).toBeGreaterThan(30); expect([...sheet.formulas].sort()).toEqual(before.sort());
        expect(sheet.getRange("B307").getValue()).toBe(0.52); expect(sheet.getRange("B214").getValue()).toBe("2027-01-15");
        expect(sheet.getCharts()).toEqual(charts); noRequests();
    });
    it("connects all four strategies and the payoff chart to the returned contract expiration", () => {
        const sheet = build();
        const selector = sheet.events.find(event => event.kind === "validation" && event.row === 315 && event.col === 2);
        expect(selector.value.values).toEqual(["Covered call", "Cash-secured put", "Call vertical", "Put vertical"]);
        expect(sheet.getRange("B216").getFormula()).toContain("C219");
        for (const [i, metric] of ["maxProfit", "maxLoss", "breakeven"].entries()) {
            expect(sheet.getRange(316 + i, 5).getFormula()).toBe('=TICKERSHEETS_STRATEGY($B$315,$B$304,$B$316,$B$317,$B$318,$B$319,$B$320,$B$321,$B$216,"' + metric + '")');
        }
        expect(sheet.getRange("B381").getFormula()).toContain('$B$321,$B$216,"payoff",A381)');
        expect(sheet.getRange("B421").getFormula()).toContain('"payoff",A421)');
        const payoff = sheet.getCharts()[1];
        expect(payoff.ranges.map(range => [range.row, range.col, range.height, range.width])).toEqual([[380, 1, 42, 2]]);
        expect(sheet.getRange("A3").getFormula()).toContain("range=A212");
        expect(sheet.getRange("B307").getFormula()).toBe(""); expect(sheet.getRange("B307").getValue()).toBe(0.4);
        expect(sheet.getRange("B308").getFormula()).toBe(""); expect(sheet.getRange("B308").getValue()).toBe(0.04);
        noRequests();
    });
    it("reports missing installations and includes both tab reports", () => {
        expect(TickerSheetsShowcase.inspect(book)).toEqual({ ok: false, error: "Stock analysis is not installed." });
        expect(TickerSheetsTutorial.inspect(book)).toEqual({ ok: false, error: "The tutorial is not installed." });
        build(); const report = TickerSheetsInspectDemo();
        expect(report.sheets).toEqual(["Start here", "Stock analysis"]); expect(report.showcase.charts).toBe(2); expect(report.ok).toBe(false); noRequests();
    });
    it("reports source errors, loading and missing keys separately", () => {
        const sheet = build();
        sheet.cells.set("52:1", "#REF!"); sheet.cells.set("218:3", "Loading..."); sheet.cells.set("356:1", "N/A: FRED API key required");
        const result = TickerSheetsShowcase.inspect(book);
        expect(result.ok).toBe(false);
        expect(result.rows.find(row => row.cell === "A52").error).toBe(true);
        expect(result.rows.find(row => row.cell === "C218").pending).toBe(true);
        expect(result.unavailable).toContain("A356"); noRequests();
    });
    it("checks calculator errors as well as source anchors", () => {
        const sheet = build(); sheet.cells.set("304:5", "#VALUE!");
        const report = TickerSheetsShowcase.inspect(book);
        expect(report.ok).toBe(false); expect(report.rows.find(row => row.cell === "E304").status).toBe("Formula error");
        expect(report.rows.find(row => row.cell === "B7").status).toBe("Not calculated"); noRequests();
    });
    it("reports calculated results and optional missing FRED data without accepting a missing stock quote", () => {
        const sheet = build();
        for (const tab of book.getSheets()) for (const cell of tab.formulas.keys()) tab.cells.set(cell, 160);
        sheet.cells.set("339:1", "Available"); sheet.cells.set("356:1", "N/A: FRED API key required");
        sheet.cells.set("357:1", "N/A: FRED API key required"); sheet.cells.set("373:2", "N/A: FRED API key required");
        const report = TickerSheetsInspectDemo();
        expect(report.ok).toBe(true); expect(report.showcase.unavailable).toEqual(expect.arrayContaining(["A356", "B373"]));
        expect(report.showcase.datasets.fred.status).toBe("Unavailable");
        sheet.cells.set("339:1", "HTTP 403"); expect(TickerSheetsInspectDemo().ok).toBe(false);
        sheet.cells.set("339:1", "Available"); book.getSheetByName("Start here").cells.set("7:2", "N/A: Quote unavailable");
        expect(TickerSheetsInspectDemo().ok).toBe(false); noRequests();
    });
    it("reads each tab in three batches and keeps displayed loading distinct from raw errors", () => {
        build(); const batches = [];
        for (const sheet of book.getSheets()) {
            const range = sheet.getDataRange(), formulas = range.getFormulas(), values = range.getValues(), displayed = range.getDisplayValues();
            if (sheet.getName() === "Stock analysis") { values[217][2] = "#ERROR!"; displayed[217][2] = "Loading..."; }
            range.getFormulas = vi.fn(() => formulas); range.getValues = vi.fn(() => values); range.getDisplayValues = vi.fn(() => displayed);
            sheet.getDataRange = vi.fn(() => range);
            sheet.getRange = vi.fn(() => { throw new Error("Inspection should use the batched cells"); });
            batches.push({ sheet, range });
        }
        const result = TickerSheetsInspectDemo();
        expect(result.showcase.rows.find(row => row.cell === "C218")).toMatchObject({ pending: true, error: false, status: "Loading" });
        for (const { sheet, range } of batches) {
            expect(sheet.getDataRange).toHaveBeenCalledOnce(); expect(sheet.getRange).not.toHaveBeenCalled();
            expect(range.getFormulas).toHaveBeenCalledOnce(); expect(range.getValues).toHaveBeenCalledOnce(); expect(range.getDisplayValues).toHaveBeenCalledOnce();
        }
        noRequests();
    });
    it("keeps direct cell reads and mocks without display methods working", () => {
        const range = { getValue: () => 0, getFormula: () => "=0" }, sheet = { getRange: vi.fn(() => range) };
        expect(TickerSheetsShowcase.readCell(sheet, "A1", "=0")).toMatchObject({ value: 0, matches: true, status: "Available" });
        range.getValue = () => "#ERROR!"; range.getDisplayValue = () => "Loading...";
        expect(TickerSheetsShowcase.readCell(sheet, "A1")).toMatchObject({ pending: true, error: false });
        const grid = TickerSheetsShowcase.readGrid({ getDataRange: () => ({ getValues: () => [[false, 0]], getFormulas: () => [["=FALSE", "=0"]] }) });
        expect(TickerSheetsShowcase.readCell(null, "B1", "=0", grid)).toMatchObject({ value: 0, matches: true, status: "Available" });
        expect(TickerSheetsShowcase.readCell(null, "AA2", undefined, grid).value).toBe("");
        expect(() => TickerSheetsShowcase.readCell(null, "A0", undefined, grid)).toThrow(/single A1 cell/);
    });
    it("logs a compact actual-results summary while returning the complete report", () => {
        const sheet = build();
        sheet.cells.set("216:2", "2026-11-20"); sheet.cells.set("219:4", "Call"); sheet.cells.set("220:4", "Put"); sheet.cells.set("221:4", "Put");
        [304, 305, 306, 307, 308, 309].forEach((row, i) => sheet.cells.set(row + ":5", i / 10));
        [316, 317, 318].forEach((row, i) => sheet.cells.set(row + ":5", i + 100));
        [381, 401, 421].forEach((row, i) => sheet.cells.set(row + ":2", i * 100 - 100));
        const report = TickerSheetsInspectDemo(), logged = console.log.mock.calls.at(-1)[0];
        expect(logged.length).toBeLessThan(6000);
        const summary = JSON.parse(logged.slice("TICKERSHEETS_TUTORIAL_CHECK ".length));
        expect(summary.options).toEqual({ expiration: "2026-11-20", calls: 1, puts: 2, model: [0, 0.1, 0.2, 0.3, 0.4, 0.5], strategy: [100, 101, 102], payoff: [-100, 0, 100] });
        expect(summary.showcase.checked).toBe(report.showcase.rows.length); expect(summary.tutorial.checked).toBe(9);
        expect(logged).not.toContain("TICKERSHEETS_QUOTE("); expect(report.showcase.rows.find(row => row.cell === "B7").formula).toBe('=TICKERSHEETS_QUOTE($B$4,"price")');
        noRequests();
    });
});
