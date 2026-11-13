import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TickerSheetsOptionsShowcase } from "../src/demo/TickerSheetsOptionsShowcase.js";
import { TickerSheetsShowcase } from "../src/demo/TickerSheetsShowcase.js";
import { TickerSheetsDemoGenerator, TickerSheetsBuildDemo, TickerSheetsInspectDemo } from "../src/demo/TickerSheetsDemoGenerator.js";
import { TickerSheetsRefreshData } from "../src/TickerSheetsMenu.js";
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
const optionInputCells = [["B8", "B8"], ["B99", "B69"], ["B100", "B70"], ["B101", "B71"], ["B102", "B72"], ["B103", "B73"], ["B104", "B74"], ["B109", "B12"], ["B110", "B13"], ["B111", "B14"], ["B112", "B15"], ["B113", "B16"], ["B114", "B17"], ["B115", "B18"]];
const chosenOptionInputs = { B8: "2027-01-15", B99: 152, B100: 45, B101: 0.52, B102: 0.035, B103: 0, B104: "Put", B109: "Put vertical", B110: 155, B111: 4.5, B112: 150, B113: 2.3, B114: 3, B115: 100 };

describe("Stock analysis and Options analysis showcases", () => {
    it("shows all 15 APIs as cell formulas on separate analysis tabs and one shared ticker", () => {
        const sheet = build(), names = new Set();
        for (const tab of book.getSheets()) for (const formula of tab.formulas.values()) {
            for (const match of formula.matchAll(/\b(TICKERSHEETS_[A-Z_]+)\s*\(/g)) names.add(match[1]);
            expect(formula).not.toMatch(/\b(?:CF[A-Z]+|CACHEFINANCES?|TICKERSHEET_[A-Z_]+)\s*\(/);
            expect(formula).not.toMatch(/\b(?:TODAY|NOW)\s*\(/);
        }
        expect([...book.sheets.keys()]).toEqual(["Start here", "Stock analysis", "Options analysis"]);
        expect([...names].sort()).toEqual(["QUOTE", "HISTORY", "FUNDAMENTALS", "OPTIONS", "EXPIRATIONS", "FRED", "FIELD", "DATA_STATUS", "STRATEGY", "EARNINGS", "QUOTE_COMPARE", "RSI_TARGETS", "FRED_VALUE", "OPTION_MODEL", "WATCH_ROW"].map(name => "TICKERSHEETS_" + name).sort());
        expect(sheet.getRange("B4").getFormula()).toBe("='Start here'!B4"); expect(sheet.getRange("B7").getFormula()).toBe('=TICKERSHEETS_QUOTE($B$4,"price")');
        expect(sheet.getRange("E4").getValue()).toBe("2026-11-13");
        expect(sheet.getCharts().map(chart => [chart.type, chart.options.title])).toEqual([["LINE", "Daily closing price"]]);
        expect(sheet.getCharts()[0].ranges.map(range => [range.row, range.col, range.height, range.width])).toEqual([[53, 1, 120, 1], [53, 5, 120, 1]]);
        const options = book.getSheetByName("Options analysis");
        expect(options.getRange("B4").getFormula()).toBe("='Start here'!B4");
        expect(options.getCharts().map(chart => chart.options.title)).toEqual(["Selected strategy: profit/loss at expiration"]);
        expect([...sheet.formulas.values()].join("\n")).not.toMatch(/TICKERSHEETS_(?:OPTIONS|EXPIRATIONS|OPTION_MODEL|STRATEGY)\(/);
        expect(sheet.getRange("A3").getFormula()).toContain('#gid=' + options.getSheetId() + '&range=A6');
        expect(sheet.hideSheet).not.toHaveBeenCalled(); noRequests();
    });
    it("leaves every bounded source spill clear of other formulas and labels", () => {
        const sheet = build();
        const rectangles = [[52, 1, 121, 7], [52, 9, 31, 2], [178, 1, 13, 10], [196, 1, 9, 8], [214, 1, 7, 10], [226, 1, 2, 5], [230, 1, 2, 5], [240, 1, 13, 5]];
        const options = book.getSheetByName("Options analysis");
        for (const [target, areas] of [[sheet, rectangles], [options, [[81, 1, 41, 1], [81, 3, 82, 12], [170, 1, 2, 5]]]]) for (const [row, col, height, width] of areas) {
            const blocked = [...target.cells].filter(([key, value]) => {
                const [r, c] = key.split(":").map(Number);
                return value !== "" && r >= row && r < row + height && c >= col && c < col + width && !(r === row && c === col);
            });
            expect(blocked).toEqual([]);
        }
        const chain = book.getSheetByName("Options analysis").getRange("C81").getFormula();
        expect(chain.match(/TICKERSHEETS_OPTIONS\(/g)).toHaveLength(2);
        expect(chain).toContain("where Col2 = 'Call' and Col3 >= ");
        expect(chain).toContain("where Col2 = 'Put' and Col3 >= ");
        expect(chain).toContain('($E$8*0.8)'); expect(chain).toContain('($E$8*1.2)');
        expect(chain.match(/order by Col3 limit 40/g)).toHaveLength(2);
        expect(chain).not.toMatch(/\bLET\(/); noRequests();
    });
    it("checks both reserved tab names before changing any user sheet", () => {
        const user = book.insertSheet("Stock analysis"); user.getRange("A1").setValue("My research");
        const guide = book.insertSheet("Start here"); guide.getRange("Z1").setValue(TickerSheetsDemoGenerator.marker); guide.getRange("B4").setValue("AAPL");
        const events = [user.events.length, guide.events.length];
        expect(() => TickerSheetsBuildDemo()).toThrow(/Stock analysis.*not managed/);
        expect(user.getRange("A1").getValue()).toBe("My research"); expect(guide.getRange("B4").getValue()).toBe("AAPL");
        expect([user.events.length, guide.events.length]).toEqual(events); expect(book.deleted).toEqual([]); noRequests();
    });
    it("keeps chosen calculator inputs and replaces the options chart when rebuilding", () => {
        build(); const sheet = book.getSheetByName("Options analysis");
        for (const [oldCell, cell] of optionInputCells) sheet.getRange(cell).setValue(chosenOptionInputs[oldCell]);
        book.getSheetByName("Start here").getRange("B4").setValue("AAPL"); TickerSheetsBuildDemo();
        expect(book.getSheetByName("Options analysis")).toBe(sheet); expect(sheet.getCharts()).toHaveLength(1);
        for (const [oldCell, cell] of optionInputCells) expect(sheet.getRange(cell).getValue()).toBe(chosenOptionInputs[oldCell]);
        expect(sheet.getRange("Z2").getValue()).toBe("TICKERSHEETS_OPTIONS_STRATEGY_FIRST_V1"); noRequests();
    });
    it("moves every existing option input to the strategy-first layout without editing other tabs", () => {
        const sheet = book.insertSheet("Options analysis"); sheet.getRange("Z1").setValue(TickerSheetsOptionsShowcase.marker);
        for (const [cell, value] of Object.entries(chosenOptionInputs)) sheet.getRange(cell).setValue(value);
        const notes = book.insertSheet("Notes"); notes.getRange("A1").setValue("Keep my research"); notes.getRange("B1").setFormula("=42");
        const before = { cells: [...notes.cells], formulas: [...notes.formulas], events: notes.events.length };
        TickerSheetsOptionsShowcase.build(book);
        for (const [oldCell, cell] of optionInputCells) expect(sheet.getRange(cell).getValue()).toBe(chosenOptionInputs[oldCell]);
        expect(sheet.getRange("Z2").getValue()).toBe("TICKERSHEETS_OPTIONS_STRATEGY_FIRST_V1");
        expect(sheet.getCharts()).toHaveLength(1);
        expect([...notes.cells]).toEqual(before.cells); expect([...notes.formulas]).toEqual(before.formulas); expect(notes.events).toHaveLength(before.events);
        expect(book.deleted).toEqual([]); noRequests();
    });
    it("labels example premiums and model assumptions without filling them from a chosen expiration", () => {
        build(); const sheet = book.getSheetByName("Options analysis");
        expect(sheet.getRange("A6").getValue()).toMatch(/Strategy calculator.*example assumptions/);
        expect(sheet.getRange("A7").getValue()).toMatch(/examples.*strikes.*premiums of 2 per share/);
        expect(sheet.getRange("A7").getValue()).toMatch(/Choosing an expiration does not fill them/);
        expect(sheet.getRange("A66").getValue()).toMatch(/Option model.*example assumptions/);
        expect(sheet.getRange("A67").getValue()).toMatch(/examples.*30 days.*40% volatility.*4% risk-free rate.*0% dividend yield/);
        expect(sheet.getRange("A67").getValue()).toMatch(/choosing an expiration does not update them/);
        const assumptions = { B14: 2, B16: 2, B70: 30, B71: .4, B72: .04, B73: 0 };
        sheet.getRange("B8").setValue("2027-01-15"); TickerSheetsOptionsShowcase.build(book);
        expect(sheet.getRange("B8").getValue()).toBe("2027-01-15");
        for (const [cell, value] of Object.entries(assumptions)) {
            expect(sheet.getRange(cell).getValue()).toBe(value); expect(sheet.getRange(cell).getFormula()).toBe("");
        }
        noRequests();
    });
    it("refreshes source and model formulas without overwriting calculator inputs", () => {
        build(); const sheet = book.getSheetByName("Options analysis"); sheet.getRange("B71").setValue(0.52); sheet.getRange("B8").setValue("2027-01-15");
        const before = [...sheet.formulas], charts = sheet.getCharts();
        const result = TickerSheetsRefreshData();
        expect(result.recalculated).toBeGreaterThan(30); expect([...sheet.formulas].sort()).toEqual(before.sort());
        expect(sheet.getRange("B71").getValue()).toBe(0.52); expect(sheet.getRange("B8").getValue()).toBe("2027-01-15");
        expect(sheet.getCharts()).toEqual(charts); noRequests();
    });
    it("connects all four strategies and the payoff chart to the returned contract expiration", () => {
        build(); const sheet = book.getSheetByName("Options analysis");
        const selector = sheet.events.find(event => event.kind === "validation" && event.row === 12 && event.col === 2);
        expect(selector.value.values).toEqual(["Covered call", "Cash-secured put", "Call vertical", "Put vertical"]);
        expect(sheet.getRange("B10").getFormula()).toContain("C82");
        for (const [i, metric] of ["maxProfit", "maxLoss", "breakeven"].entries()) {
            expect(sheet.getRange(13 + i, 5).getFormula()).toBe('=TICKERSHEETS_STRATEGY($B$12,$E$8,$B$13,$B$14,$B$15,$B$16,$B$17,$B$18,$B$10,"' + metric + '")');
        }
        expect(sheet.getRange("B23").getFormula()).toContain('$B$18,$B$10,"payoff",A23)');
        expect(sheet.getRange("B63").getFormula()).toContain('"payoff",A63)');
        const payoff = sheet.getCharts()[0];
        expect(payoff.ranges.map(range => [range.row, range.col, range.height, range.width])).toEqual([[22, 1, 42, 2]]);
        expect(payoff.position[0]).toBeLessThan(40);
        expect(sheet.getRange("A3").getFormula()).toContain("range=A78");
        expect(sheet.getRange("B71").getFormula()).toBe(""); expect(sheet.getRange("B71").getValue()).toBe(0.4);
        expect(sheet.getRange("B72").getFormula()).toBe(""); expect(sheet.getRange("B72").getValue()).toBe(0.04);
        expect(sheet.getRange("E8").getFormula()).toBe('=TICKERSHEETS_QUOTE($B$4,"regular_price")');
        expect(sheet.getRange("B68").getFormula()).toBe("=$E$8");
        for (const [i, metric] of ["price", "delta", "gamma", "theta", "vega", "rho"].entries()) {
            expect(sheet.getRange(68 + i, 5).getFormula()).toBe('=TICKERSHEETS_OPTION_MODEL($B$68,$B$69,$B$70,$B$71,$B$72,$B$73,$B$74,"' + metric + '")');
        }
        noRequests();
    });
    it("reports missing installations and includes all three tab reports", () => {
        expect(TickerSheetsShowcase.inspect(book)).toEqual({ ok: false, error: "Stock analysis is not installed." });
        expect(TickerSheetsOptionsShowcase.inspect(book)).toEqual({ ok: false, error: "Options analysis is not installed." });
        expect(TickerSheetsDemoGenerator.inspect(book)).toEqual({ ok: false, error: "The demo is not installed." });
        build(); const report = TickerSheetsInspectDemo();
        expect(report.sheets).toEqual(["Start here", "Stock analysis", "Options analysis"]); expect(report.showcase.charts).toBe(1); expect(report.options.charts).toBe(1); expect(report.ok).toBe(false); noRequests();
    });
    it("reports source errors, loading and missing keys separately", () => {
        const sheet = build();
        sheet.cells.set("52:1", "#REF!"); book.getSheetByName("Options analysis").cells.set("81:3", "Loading..."); sheet.cells.set("240:1", "N/A: FRED API key required");
        const result = TickerSheetsShowcase.inspect(book);
        expect(result.ok).toBe(false);
        expect(result.rows.find(row => row.cell === "A52").error).toBe(true);
        expect(TickerSheetsOptionsShowcase.inspect(book).rows.find(row => row.cell === "C81").pending).toBe(true);
        expect(result.unavailable).toContain("A240"); noRequests();
    });
    it("checks calculator errors as well as source anchors", () => {
        build(); const sheet = book.getSheetByName("Options analysis"); sheet.cells.set("68:5", "#VALUE!");
        const report = TickerSheetsOptionsShowcase.inspect(book);
        expect(report.ok).toBe(false); expect(report.rows.find(row => row.cell === "E68").status).toBe("Formula error");
        expect(report.rows.find(row => row.cell === "E8").status).toBe("Not calculated"); noRequests();
    });
    it("reports calculated results and optional missing FRED data without accepting a missing stock quote", () => {
        const sheet = build();
        for (const tab of book.getSheets()) for (const cell of tab.formulas.keys()) tab.cells.set(cell, 160);
        sheet.cells.set("227:1", "Available"); sheet.cells.set("240:1", "N/A: FRED API key required");
        sheet.cells.set("241:1", "N/A: FRED API key required"); sheet.cells.set("257:2", "N/A: FRED API key required");
        const report = TickerSheetsInspectDemo();
        expect(report.ok).toBe(true); expect(report.showcase.unavailable).toEqual(expect.arrayContaining(["A240", "B257"]));
        expect(report.showcase.datasets.fred.status).toBe("Unavailable");
        sheet.cells.set("227:1", "HTTP 403"); expect(TickerSheetsInspectDemo().ok).toBe(false);
        sheet.cells.set("227:1", "Available"); book.getSheetByName("Start here").cells.set("7:2", "N/A: Quote unavailable");
        expect(TickerSheetsInspectDemo().ok).toBe(false); noRequests();
    });
    it("reads each tab in three batches and keeps displayed loading distinct from raw errors", () => {
        build(); const batches = [];
        for (const sheet of book.getSheets()) {
            const range = sheet.getDataRange(), formulas = range.getFormulas(), values = range.getValues(), displayed = range.getDisplayValues();
            if (sheet.getName() === "Options analysis") { values[80][2] = "#ERROR!"; displayed[80][2] = "Loading..."; }
            range.getFormulas = vi.fn(() => formulas); range.getValues = vi.fn(() => values); range.getDisplayValues = vi.fn(() => displayed);
            sheet.getDataRange = vi.fn(() => range);
            sheet.getRange = vi.fn(() => { throw new Error("Inspection should use the batched cells"); });
            batches.push({ sheet, range });
        }
        const result = TickerSheetsInspectDemo();
        expect(result.options.rows.find(row => row.cell === "C81")).toMatchObject({ pending: true, error: false, status: "Loading" });
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
        build(); const sheet = book.getSheetByName("Options analysis");
        sheet.cells.set("10:2", "2026-11-20"); sheet.cells.set("82:4", "Call"); sheet.cells.set("83:4", "Put"); sheet.cells.set("84:4", "Put");
        [68, 69, 70, 71, 72, 73].forEach((row, i) => sheet.cells.set(row + ":5", i / 10));
        [13, 14, 15].forEach((row, i) => sheet.cells.set(row + ":5", i + 100));
        [23, 43, 63].forEach((row, i) => sheet.cells.set(row + ":2", i * 100 - 100));
        const report = TickerSheetsInspectDemo(), logged = console.log.mock.calls.at(-1)[0];
        expect(logged.length).toBeLessThan(6000);
        const summary = JSON.parse(logged.slice("TICKERSHEETS_TUTORIAL_CHECK ".length));
        expect(summary.options).toMatchObject({ expiration: "2026-11-20", calls: 1, puts: 2, model: [0, 0.1, 0.2, 0.3, 0.4, 0.5], strategy: [100, 101, 102], payoff: [-100, 0, 100] });
        expect(summary.showcase.checked).toBe(report.showcase.rows.length); expect(summary.tutorial.checked).toBe(9);
        expect(summary.optionsTab.checked).toBe(report.options.rows.length); expect(summary.charts).toEqual({ stock: 1, options: 1 });
        expect(summary.tickers.options.formula).toBe("='Start here'!B4"); expect(summary.options.inputs.B71).toBe(0.4);
        expect(logged).not.toContain("TICKERSHEETS_QUOTE("); expect(report.showcase.rows.find(row => row.cell === "B7").formula).toBe('=TICKERSHEETS_QUOTE($B$4,"price")');
        noRequests();
    });
    it("rejects an unrelated Options analysis tab before changing the tutorial or stock", () => {
        const guide = book.insertSheet("Start here"); guide.getRange("Z1").setValue(TickerSheetsDemoGenerator.marker);
        const stock = book.insertSheet("Stock analysis"); stock.getRange("Z1").setValue(TickerSheetsShowcase.marker);
        const options = book.insertSheet("Options analysis"); options.getRange("A1").setValue("My own options");
        const before = book.getSheets().map(sheet => [sheet, [...sheet.cells], sheet.events.length]);
        expect(() => TickerSheetsBuildDemo()).toThrow(/Options analysis.*not managed/);
        for (const [sheet, cells, events] of before) { expect([...sheet.cells]).toEqual(cells); expect(sheet.events).toHaveLength(events); }
        expect(book.deleted).toEqual([]); noRequests();
    });
    it("migrates all legacy option inputs before clearing the old stock layout", () => {
        const stock = book.insertSheet("Stock analysis"); stock.getRange("Z1").setValue(TickerSheetsShowcase.marker);
        const saved = chosenOptionInputs;
        for (const [cell, value] of Object.entries(saved)) stock.getRange("B" + (Number(cell.slice(1)) + 206)).setValue(value);
        TickerSheetsBuildDemo(); const options = book.getSheetByName("Options analysis");
        for (const [oldCell, cell] of optionInputCells) expect(options.getRange(cell).getValue()).toBe(saved[oldCell]);
        expect(stock.getRange("B307").getValue()).toBe(""); expect(stock.getRange("B315").getValue()).toBe("");
        expect(stock.getRange("Z2").getValue()).toBe("TICKERSHEETS_STOCK_V2"); expect(stock.getCharts()).toHaveLength(1); noRequests();
    });
    it("retains migrated inputs if rebuilding stock is interrupted and then retried", () => {
        const stock = book.insertSheet("Stock analysis"); stock.getRange("Z1").setValue(TickerSheetsShowcase.marker); stock.getRange("B307").setValue(0.57);
        const interrupted = vi.spyOn(TickerSheetsShowcase, "build").mockImplementationOnce(() => { throw new Error("Interrupted stock build"); });
        expect(() => TickerSheetsBuildDemo()).toThrow("Interrupted stock build");
        expect(book.getSheetByName("Options analysis").getRange("B71").getValue()).toBe(0.57);
        interrupted.mockRestore(); TickerSheetsBuildDemo();
        expect(book.getSheetByName("Options analysis").getRange("B71").getValue()).toBe(0.57); noRequests();
    });
    it("orders managed tabs together while preserving unrelated tabs and cross-tab references", () => {
        const options = book.insertSheet("Options analysis"); options.getRange("Z1").setValue(TickerSheetsOptionsShowcase.marker);
        const notes = book.insertSheet("Notes"); notes.getRange("A1").setValue("Keep me");
        const stock = book.insertSheet("Stock analysis"); stock.getRange("Z1").setValue(TickerSheetsShowcase.marker);
        const personal = book.insertSheet("Portfolio"); personal.getRange("B1").setFormula("=42");
        const guide = book.insertSheet("Start here"); guide.getRange("Z1").setValue(TickerSheetsDemoGenerator.marker);
        TickerSheetsBuildDemo();
        expect(book.getSheets().map(sheet => sheet.getName())).toEqual(["Start here", "Stock analysis", "Options analysis", "Notes", "Portfolio"]);
        expect(notes.getRange("A1").getValue()).toBe("Keep me"); expect(personal.getRange("B1").getFormula()).toBe("=42");
        expect(book.active).toBe(guide);
        for (const tab of [stock, options]) for (const formula of tab.formulas.values()) {
            expect(formula).not.toContain("#REF!");
            for (const match of formula.matchAll(/'([^']+)'!\$?[A-Z]+\$?\d/g)) expect(book.getSheetByName(match[1])).not.toBeNull();
        }
        noRequests();
    });
});
