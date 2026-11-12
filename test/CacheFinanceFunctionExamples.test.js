import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CFFunctionExamples as E, CFBuildFormulaExamples, CFRefreshFormulaExamples } from "../src/CacheFinanceFunctionExamples.js";
import { ManagedBook } from "./helpers/ManagedSheetMock.js";

let book;
beforeEach(() => { book = new ManagedBook(); });
afterEach(() => vi.unstubAllGlobals());

describe("formula example sheet", () => {
    it("creates a marked sheet with eight scalar examples and independent spill areas", () => {
        const result = E.build(book), sheet = book.getSheetByName("CF Formulas");
        expect(result).toMatchObject({ ok: true, functions: 12, sheet: "CF Formulas" });
        expect(sheet.getRange("Z1").getValue()).toBe("CACHEFINANCE_FUNCTIONS_V1"); expect(sheet.hiddenColumn).toBe(26); expect(sheet.frozenRows).toBe(4);
        expect(sheet.getRange("B4").getValue()).toBe("NVDA"); expect(sheet.getRange("E4").getValue()).toBe(1);
        expect(sheet.getRange("A23:A30").getValues().every(row => typeof row[0] === "string" && row[0])).toBe(true);
        expect(sheet.getRange("B23:B30").getValues().every(row => row[0].startsWith("="))).toBe(true);
        expect(sheet.getRange("B30").getValue()).toBe('=IFERROR(INDEX(CFFRED("DGS2",1,$E$4),2,2),"N/A: FRED data unavailable; check API key settings")');
        const expected = {
            "34:1": '=CFFUNDAMENTALS($B$4,"all",$E$4)', "34:7": '=CFHISTORY($B$4,60,$E$4)',
            "34:15": '=CFEXPIRATIONS($B$4,$E$4)', "34:17": '=CFFRED("DGS10",12,$E$4)',
            "110:1": '=IFERROR(ARRAY_CONSTRAIN(CFOPTIONS($B$4,INDEX(CFEXPIRATIONS($B$4,$E$4),2,1),$E$4),21,12),"N/A: option chain data unavailable")'
        };
        for (const [cell, formula] of Object.entries(expected)) expect(sheet.formulas.get(cell)).toBe(formula);
        // The 61-row history ends on row94. FRED uses13rows. The option sample uses21rows and12columns.
        expect(sheet.getRange("G35:M94").getValues().flat().every(value => value === "")).toBe(true);
        expect(sheet.getRange("Q35:U46").getValues().flat().every(value => value === "")).toBe(true);
        expect(sheet.getRange("A111:L130").getValues().flat().every(value => value === "")).toBe(true);
    });
    it("links the sole ticker input to the analysis sheet when it exists", () => {
        const main = book.insertSheet("CF Analysis"); main.getRange("B4").setValue("AAPL"); E.build(book);
        expect(book.getSheetByName("CF Formulas").getRange("B4").getValue()).toBe("='CF Analysis'!B4");
    });
    it("does not change an unrelated sheet or replace a conflicting name", () => {
        const other = book.insertSheet("My Notes"); other.getRange("A1").setValue("Keep");
        const conflict = book.insertSheet("CF Formulas"); conflict.getRange("A1").setValue("User data");
        expect(() => E.build(book)).toThrow(/Rename the existing CF Formulas/); expect(conflict.getRange("A1").getValue()).toBe("User data"); expect(other.getRange("A1").getValue()).toBe("Keep");
    });
    it("grows a short owned sheet before writing its lower spill examples", () => {
        const sheet = book.insertSheet("CF Formulas"); sheet.getRange("Z1").setValue("CACHEFINANCE_FUNCTIONS_V1"); sheet.maxRows = 80; sheet.maxCols = 20;
        E.build(book); expect(sheet.maxRows).toBe(160); expect(sheet.maxCols).toBe(26); expect(sheet.formulas.has("110:1")).toBe(true);
    });
    it("preserves a valid refresh number and clears previous spill output on rebuild", () => {
        E.build(book); const sheet = book.getSheetByName("CF Formulas"); sheet.getRange("E4").setValue(12); sheet.getRange("A90").setValue("Old spill"); E.build(book);
        expect(sheet.getRange("E4").getValue()).toBe(12); expect(sheet.getRange("A90").getValue()).toBe(""); expect(sheet.getRange("Z1").getValue()).toBe("CACHEFINANCE_FUNCTIONS_V1");
    });
    it.each([-1, 1.5, 2147483648, NaN, Infinity, "10", true])("resets an invalid saved refresh number on rebuild (%s)", value => {
        E.build(book); const sheet = book.getSheetByName("CF Formulas"); sheet.getRange("E4").setValue(value); E.build(book); expect(sheet.getRange("E4").getValue()).toBe(1);
    });
    it.each([0, 1, 2147483647])("preserves a bounded integer refresh number on rebuild (%i)", value => {
        E.build(book); const sheet = book.getSheetByName("CF Formulas"); sheet.getRange("E4").setValue(value); E.build(book); expect(sheet.getRange("E4").getValue()).toBe(value);
    });
    it("formats provider date text and history dates before their formulas populate", () => {
        E.build(book); const sheet = book.getSheetByName("CF Formulas");
        expect(sheet.formatAt(34, 1)).toBe("@"); expect(sheet.formatAt(35, 7)).toBe("@"); expect(sheet.formatAt(35, 15)).toBe("@"); expect(sheet.formatAt(35, 18)).toBe("0.00");
        const dateFormat = sheet.events.findIndex(event => event.kind === "format" && event.row === 34 && event.col === 7 && event.value === "@");
        const formulaWrite = sheet.events.findIndex(event => event.kind === "value" && event.row === 34 && event.col === 7 && event.value.startsWith("=CFHISTORY"));
        expect(dateFormat).toBeLessThan(formulaWrite);
    });
    it("keeps original and new custom functions in the reference catalog", () => {
        const names = E.catalog().map(row => row[0]); expect(names).toContain("CACHEFINANCE"); expect(names).toContain("CACHEFINANCES"); expect(names).toContain("CFSTRATEGY"); expect(names).toContain("CFFRED");
        expect(E.catalog().find(row => row[0] === "CFOPTIONS")[3]).toMatch(/IV fraction/);
    });
    it.each(["B27", "B28", "B30", "A110"])("keeps a missing key or source result explicit in %s instead of an INDEX error", address => {
        E.build(book); const formula = book.getSheetByName("CF Formulas").getRange(address).getValue();
        expect(formula).toMatch(/^=IFERROR\(/); expect(formula).toMatch(/,"N\/A: [^"]+"\)$/); expect(formula).not.toMatch(/,(?:0|"")\)$/);
    });
});

describe("formula refresh menu", () => {
    it("increments only the editable refresh number without rebuilding formulas", () => {
        E.build(book); const sheet = book.getSheetByName("CF Formulas"); const formulas = [...sheet.formulas];
        expect(E.refresh(book)).toEqual({ ok: true, refresh: 2 }); expect([...sheet.formulas]).toEqual(formulas); expect(sheet.getRange("E4").getValue()).toBe(2);
    });
    it.each([-1, 1.5, 2147483647, 2147483648, Infinity, "1e2", "0x10", "1.0", true, {}, ""]) ("resets malformed or exhausted refresh input (%#)", value => {
        E.build(book); book.getSheetByName("CF Formulas").getRange("E4").setValue(value); expect(E.refresh(book).refresh).toBe(1);
    });
    it("accepts integer text from a deliberately text-formatted input", () => {
        E.build(book); book.getSheetByName("CF Formulas").getRange("E4").setValue("12"); expect(E.refresh(book).refresh).toBe(13);
    });
    it("creates the examples if no marked sheet exists", () => { expect(E.refresh(book).ok).toBe(true); expect(book.getSheetByName("CF Formulas")).not.toBeNull(); });
    it("routes both menu callbacks to the active spreadsheet", () => {
        vi.stubGlobal("SpreadsheetApp", { getActiveSpreadsheet: () => book }); expect(CFBuildFormulaExamples().ok).toBe(true); expect(CFRefreshFormulaExamples().refresh).toBe(2);
    });
});
