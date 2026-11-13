import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CFFormulaOptions as O } from "../src/CacheFinanceFormulaOptions.js";
import { CFFormulaWorkbook } from "../src/CacheFinanceFormulaWorkbook.js";
import { ManagedBook, ManagedRange } from "./helpers/ManagedSheetMock.js";

let book, prepare, fetch, properties;
function enhance(sheet) {
    const range = sheet.getRange.bind(sheet);
    sheet.getRange = (...args) => {
        const result = range(...args);
        result.setDataValidation = value => result.event("validation", { value });
        return result;
    };
    sheet.charts = [];
    sheet.insertChart = chart => { sheet.charts.push(chart); return sheet; };
    sheet.newChart = () => {
        const chart = { options: {}, ranges: [] };
        const builder = {
            setChartType(value) { chart.type = value; return this; }, addRange(value) { chart.ranges.push(value); return this; }, setNumHeaders(value) { chart.headers = value; return this; },
            setPosition(...value) { chart.position = value; return this; }, setOption(key, value) { chart.options[key] = value; return this; }, build() { return chart; }
        };
        return builder;
    };
    return sheet;
}
beforeEach(() => {
    book = new ManagedBook();
    const insert = book.insertSheet.bind(book); book.insertSheet = name => enhance(insert(name));
    book.insertSheet("Analysis").getRange("B4").setValue("NVDA"); book.insertSheet("Quote data"); book.insertSheet("Fundamentals");
    prepare = vi.spyOn(CFFormulaWorkbook, "prepareSheet").mockImplementation((target, name, marker) => {
        const sheet = target.getSheetByName(name) || target.insertSheet(name);
        const previous = sheet.getRange("Z1").getValue();
        if (previous && previous !== marker) throw new Error("Not a managed sheet");
        sheet.getRange("Z1").setValue(marker); return sheet;
    });
    const validation = () => ({ requireValueInList(value) { this.options = value; return this; }, requireValueInRange(value) { this.range = value; return this; }, setAllowInvalid(value) { this.allowInvalid = value; return this; }, build() { return { options: this.options, range: this.range, allowInvalid: this.allowInvalid }; } });
    vi.stubGlobal("SpreadsheetApp", { newDataValidation: validation }); vi.stubGlobal("Charts", { ChartType: { LINE: "LINE" } });
    fetch = vi.fn(() => { throw new Error("Builders must not fetch provider data"); }); properties = vi.fn(() => { throw new Error("Builders must not access API keys"); });
    vi.stubGlobal("UrlFetchApp", { fetch }); vi.stubGlobal("PropertiesService", { getScriptProperties: properties });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("formula option source and selection", () => {
    it("exposes row bounds through Apps Script-compatible static getters", () => {
        expect(O.firstRow).toBe(8); expect(O.lastRow).toBe(1007);
        expect(Object.getOwnPropertyDescriptor(O, "firstRow").get).toBeTypeOf("function");
        expect(Object.getOwnPropertyDescriptor(O, "lastRow").get).toBeTypeOf("function");
    });
    it("writes one chain function and references the central expiration source", () => {
        const { sheet, firstRow, lastRow } = O.buildOptions(book);
        expect(prepare).toHaveBeenCalledWith(book, "Options", "CACHEFINANCE_ANALYSIS_V1"); expect([firstRow, lastRow]).toEqual([8, 1007]);
        expect(sheet.getRange("A7").getFormula()).toBe(CFFormulaWorkbook.optionSource('$B$4'));
        expect(sheet.getRange("A7").getFormula()).toContain('AND(ISNUMBER(\'Quote data\'!$P$8),\'Quote data\'!$P$8=Analysis!$E$4)');
        expect(sheet.getRange("A7").getFormula()).toContain('CFOPTIONS(Analysis!$B$4,$B$4,\'Quote data\'!$P$8)');
        expect(sheet.getRange("B4").getFormula()).toBe('=IF(\'Quote data\'!$O$8="","",\'Quote data\'!$O$8)');
        expect([...sheet.formulas.values()].filter(value => /CFOPTIONS\(/.test(value))).toHaveLength(1);
        expect([...sheet.formulas.values()].some(value => /CFQUOTE\(|CFEXPIRATIONS\(/.test(value))).toBe(false);
        expect(sheet.getRange("A8:L1007").getValues().flat().every(value => value === "")).toBe(true);
        expect(sheet.maxRows).toBeGreaterThanOrEqual(10007); expect(sheet.maxCols).toBeGreaterThanOrEqual(31); expect(sheet.frozenRows).toBe(7);
        expect(fetch).not.toHaveBeenCalled(); expect(properties).not.toHaveBeenCalled();
    });
    it.each(["2026-11-20", "2027-01-15"])("keeps a valid supplied expiration as an editable input: %s", expiration => {
        const { sheet } = O.buildOptions(book, { expiration }); expect(sheet.getRange("B4").getValue()).toBe(expiration); expect(sheet.getRange("B4").getFormula()).toBe("");
        expect(sheet.events.find(event => event.kind === "validation" && event.row === 4 && event.col === 2).value.allowInvalid).toBe(false);
    });
    it.each(["2026-02-30", "11/20/2026", "=1+1", ""])("uses the published date formula when a supplied expiration is invalid: %s", expiration => {
        const { sheet } = O.buildOptions(book, { expiration }); expect(sheet.getRange("B4").getFormula()).toBe('=IF(\'Quote data\'!$O$8="","",\'Quote data\'!$O$8)');
    });
    it("converts a date-valued saved expiration in the sheet's time zone", () => {
        const formatDate = vi.fn(() => "2026-11-20"); vi.stubGlobal("Utilities", { formatDate }); const date = new Date("2026-11-20T08:00:00Z");
        expect(O.buildOptions(book, { expiration: date }).sheet.getRange("B4").getValue()).toBe("2026-11-20");
        expect(formatDate).toHaveBeenCalledWith(date, "America/Los_Angeles", "yyyy-MM-dd");
    });
    it("keeps explicit validation and selection steps in worksheet formulas for every source row", () => {
        const { sheet } = O.buildOptions(book);
        for (const row of [8, 500, 1007]) {
            const validation = sheet.getRange("AA" + row).getFormula(); expect(validation).toContain('$A' + row + '=IF(ISNUMBER($B$4),TEXT($B$4,"yyyy-mm-dd"),$B$4)');
            expect(validation).toContain('$D' + row + '>=0'); expect(validation).toContain('$E' + row + '>0'); expect(validation).toContain('$E' + row + '>=$D' + row); expect(validation).toContain('REGEXMATCH($L' + row);
            expect(validation).toContain('OR($B' + row + '="Call",$B' + row + '="Put")');
            expect(sheet.getRange("AB" + row).getFormula()).toContain('ISNUMBER($H' + row + '),$H' + row + '>0');
            expect(sheet.getRange("AC" + row).getFormula()).not.toContain('$H' + row); // Expiry arithmetic can use a quote without IV.
            expect(validation).toContain('ABS(VALUE(RIGHT($L' + row + ',8))/1000-$C' + row + ')<1E-8');
            expect(validation).toContain('MID($L' + row + ',LEN($L' + row + ')-8,1)=IF($B' + row + '="Call","C","P")');
        }
        expect(sheet.getRange("AA7:AE7").getValues()[0]).toEqual(["Usable bid/ask", "Model call distance", "Strategy call distance", "Strategy put distance", "Quote condition"]);
        expect(sheet.getRange("Y10").getFormula()).toContain('SORT(FILTER({$AB$8:$AB$1007,$C$8:$C$1007,ROW($A$8:$A$1007)-7}');
        expect(sheet.getRange("Y10").getFormula()).toContain(',1,TRUE,2,TRUE),1,3)');
        expect(sheet.getRange("Y13").getFormula()).toBe('=IF(ISNUMBER(Research!$O$25),Research!$O$25,"N/A")');
        expect(sheet.getRange("Y4").getFormula()).toBe('=IF(ISNUMBER(Research!$Q$25),Research!$Q$25,"N/A")');
        expect(sheet.getRange("Y5").getFormula()).toContain('Research!$B$25'); expect(sheet.getRange("Y6").getFormula()).toContain('Research!$H$25');
        expect(sheet.getRange("Y7").getFormula()).toContain('COUNTIFS('); expect(sheet.getRange("Y9").getFormula()).toContain('First 1000 rows only');
        expect(sheet.getRange("A6").getFormula()).toContain('Options source not ready'); expect(sheet.getRange("A6").getFormula()).toContain('More than 1000 source contracts');
    });
    it("reserves the full raw source capacity and reports calculation limits without truncating", () => {
        const { sheet } = O.buildOptions(book);
        expect(sheet.maxRows).toBeGreaterThanOrEqual(10007);
        expect(sheet.getRange("A2").getValue()).toContain("10,000 raw contracts");
        expect(sheet.getRange("A6").getFormula()).toContain("full raw source output remains visible");
        expect(sheet.getRange("A6").getFormula()).toContain("a larger result requires more sheet rows");
        expect(sheet.getRange("A6").getFormula()).toMatch(/^=IFERROR\(/);
        expect(sheet.getRange("Y7").getFormula()).toContain("$A$8:$A$10007");
        expect(sheet.getRange("A7").getFormula()).toBe(CFFormulaWorkbook.optionSource('$B$4'));
        for (const key of sheet.formulas.keys()) {
            const [row, col] = key.split(":").map(Number);
            expect(row < 8 || row > 10007 || col > 12).toBe(true);
        }
    });
    it("seeds the model from the selected source call and keeps missing input outputs visible", () => {
        const { sheet } = O.buildOptions(book);
        expect(sheet.getRange("Y16").getFormula()).toContain('MATCH("regular_price",\'Quote data\'!$A$8:$A$65,0)');
        expect(sheet.getRange("P4").getFormula()).toBe("=$Y$16"); expect(sheet.getRange("P5").getFormula()).toContain('$C$8:$C$1007,$Y$10');
        expect(sheet.getRange("P6").getFormula()).toContain('AVERAGE(INDEX($D$8:$D$1007,$Y$10),INDEX($E$8:$E$1007,$Y$10))');
        expect(sheet.getRange("P8").getFormula()).toContain('$H$8:$H$1007,$Y$10'); expect(sheet.getRange("P16").getFormula()).toContain('$L$8:$L$1007,$Y$10');
        expect(sheet.getRange("P10").getFormula()).toContain('MATCH("dividend_yield",Fundamentals!$A$8:$A$200,0)');
        expect(sheet.getRange("P9").getValue()).toBe(0.04); expect(sheet.getRange("P13").getValue()).toBe(100);
        expect(sheet.getRange("S4").getFormula()).toBe('=CFOPTIONMODEL($P$4,$P$5,$P$7,$P$8,$P$9,$P$10,$P$11,"price")');
        expect(sheet.getRange("S7").getFormula()).toContain('"theta"'); expect(sheet.getRange("S8").getFormula()).toContain('"vega"');
        expect(sheet.getRange("S13").getFormula()).toContain('$P$5+$P$6'); expect(sheet.getRange("O24").getFormula()).toContain('NA()'); expect(sheet.getRange("P24").getFormula()).toContain('NA()');
        expect(sheet.charts).toHaveLength(1); expect(sheet.charts[0].ranges[0]).toMatchObject({ row: 23, col: 15, height: 22, width: 2 });
    });
    it("does not inspect source outputs or derive numeric quote results while building", () => {
        const original = ManagedRange.prototype.getValues;
        vi.spyOn(ManagedRange.prototype, "getValues").mockImplementation(function () { if (this.row >= 7) throw new Error("Builder tried to read calculated output"); return original.call(this); });
        expect(() => O.buildOptions(book)).not.toThrow(); expect(fetch).not.toHaveBeenCalled();
    });
});

describe("formula strategy calculator", () => {
    it("reuses the Options source through FILTER and puts all monetary results in formulas", () => {
        O.buildOptions(book); const { sheet } = O.buildStrategies(book);
        expect(prepare).toHaveBeenCalledWith(book, "Strategies", "CACHEFINANCE_STRATEGIES_V1");
        expect(sheet.getRange("A56").getFormula()).toContain('FILTER({Options!$B$8:$B$1007,Options!$C$8:$C$1007,Options!$D$8:$D$1007,Options!$E$8:$E$1007,Options!$L$8:$L$1007,Options!$A$8:$A$1007,Options!$AE$8:$AE$1007},Options!$AA$8:$AA$1007=TRUE)');
        expect(sheet.getRange("A57:G1055").getValues().flat().every(value => value === "")).toBe(true);
        for (const row of [4, 8, 9, 10, 13, 14]) expect(sheet.getRange("E" + row).getFormula()).toContain('CFSTRATEGY($B$4,$B$5,$B$6,$B$7,$B$8,$B$9,$B$10,$B$11,$B$12,');
        expect(sheet.getRange("E13").getFormula()).toContain('"payoff",$B$13)'); expect(sheet.getRange("A25:B45").getValues().flat().every(value => typeof value === "string" && value.startsWith("="))).toBe(true);
        expect(sheet.charts).toHaveLength(1); expect(sheet.charts[0].ranges[0]).toMatchObject({ row: 24, col: 1, height: 22, width: 2 });
        expect([...sheet.formulas.values()].some(value => /CFOPTIONS\(|CFQUOTE\(/.test(value))).toBe(false); expect(fetch).not.toHaveBeenCalled(); expect(properties).not.toHaveBeenCalled();
    });
    it("uses source asks for long legs, bids for short legs and a shared expiration", () => {
        O.buildOptions(book); const { sheet } = O.buildStrategies(book);
        expect(sheet.getRange("V7").getFormula()).toContain('INDEX(Options!$E$8:$E$1007,Options!$Y$11)');
        expect(sheet.getRange("X7").getFormula()).toContain('INDEX(Options!$D$8:$D$1007,Options!$Y$14)');
        expect(sheet.getRange("V8").getFormula()).toContain('INDEX(Options!$E$8:$E$1007,Options!$Y$12)');
        expect(sheet.getRange("X8").getFormula()).toContain('INDEX(Options!$D$8:$D$1007,Options!$Y$15)');
        expect(sheet.getRange("B7").getFormula()).toContain('FILTER($D$56:$D$1055'); expect(sheet.getRange("B9").getFormula()).toContain('FILTER($C$56:$C$1055');
        expect(sheet.getRange("B12").getFormula()).toContain('Options!$B$4'); expect(sheet.getRange("B5").getFormula()).toContain('MATCH("regular_price"');
    });
    it("does not read quote outputs to seed the strategy", () => {
        O.buildOptions(book); const original = ManagedRange.prototype.getValues;
        vi.spyOn(ManagedRange.prototype, "getValues").mockImplementation(function () { if (this.row >= 7) throw new Error("Builder tried to read calculated output"); return original.call(this); });
        expect(() => O.buildStrategies(book)).not.toThrow();
    });
});

describe("explicit assumption reset", () => {
    it("restores only calculator inputs without clearing source tables, expiration, journal or keys", () => {
        const options = O.buildOptions(book, { expiration: "2026-11-20" }).sheet, strategies = O.buildStrategies(book).sheet;
        options.getRange("A8:B8").setValues([["2026-11-20", "Call"]]); options.getRange("P9").setValue(0.08); strategies.getRange("B4").setValue("Call vertical"); strategies.getRange("B10").setValue(3);
        const journal = book.insertSheet("Journal"); journal.getRange("A8:B8").setValues([["saved", 12]]);
        const originalSource = options.getRange("A7").getFormula(), originalStrategySource = strategies.getRange("A56").getFormula(), optionEvents = options.events.length, strategyEvents = strategies.events.length;
        expect(O.resetInputs(book)).toEqual({ options: true, strategies: true });
        expect(options.getRange("A7").getFormula()).toBe(originalSource); expect(options.getRange("A8:B8").getValues()).toEqual([["2026-11-20", "Call"]]); expect(options.getRange("B4").getValue()).toBe("2026-11-20");
        expect(options.getRange("P9").getValue()).toBe(0.04); expect(strategies.getRange("B4").getValue()).toBe("Covered call"); expect(strategies.getRange("B10").getValue()).toBe(1); expect(strategies.getRange("A56").getFormula()).toBe(originalStrategySource);
        expect(journal.getRange("A8:B8").getValues()).toEqual([["saved", 12]]);
        expect(options.events.slice(optionEvents).every(event => event.kind === "value" && event.col === 16 && event.row >= 4 && event.row <= 14)).toBe(true);
        expect(strategies.events.slice(strategyEvents).every(event => event.kind === "value" && event.col === 2 && event.row >= 4 && event.row <= 13)).toBe(true);
        expect(fetch).not.toHaveBeenCalled(); expect(properties).not.toHaveBeenCalled();
    });
    it("preflights both ownership markers before changing either calculator", () => {
        const options = O.buildOptions(book).sheet, strategies = O.buildStrategies(book).sheet; strategies.getRange("Z1").setValue("personal sheet");
        const previous = options.events.length; expect(() => O.resetInputs(book)).toThrow(/not managed by TickerSheets/); expect(options.events.length).toBe(previous);
    });
    it("does nothing when calculator tabs do not exist", () => { expect(O.resetInputs(book)).toEqual({ options: false, strategies: false }); expect(prepare).not.toHaveBeenCalled(); });
});
