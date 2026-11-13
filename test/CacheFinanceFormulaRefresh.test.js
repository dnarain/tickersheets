import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CFFormulaWorkbook } from "../src/CacheFinanceFormulaWorkbook.js";
import { ManagedBook } from "./helpers/ManagedSheetMock.js";

let book, flush;
beforeEach(() => { book = new ManagedBook(); flush = vi.fn(); vi.stubGlobal("SpreadsheetApp", { flush }); });
afterEach(() => vi.unstubAllGlobals());

describe("refreshing ordinary custom-function formulas", () => {
    it("recalculates copied formulas on custom tabs while preserving inputs, calculations and saved values", () => {
        const sheet = book.insertSheet("My own research");
        sheet.getRange("A1").setValue("NVDA");
        sheet.getRange("B1").setFormula('=CFQUOTE(A1,"price")'); sheet.getRange("B1").setValue(167.84);
        sheet.getRange("B2").setFormula('=cffundamentals(A1,"eps_ttm")');
        sheet.getRange("C1").setFormula("=B1*2"); sheet.getRange("A5").setValue("Saved observation"); sheet.getRange("B5").setValue(160);
        sheet.getRange("D1").setFormula("=FORMULATEXT(B1)"); sheet.getRange("A7").setValue('Try =CFQUOTE(A1,"price")');
        const expected = sheet.getRange("B1:B2").getValues();
        flush.mockImplementation(() => { expect(sheet.getRange("B1").getFormula()).toBe(""); expect(sheet.getRange("B2").getFormula()).toBe(""); });
        expect(CFFormulaWorkbook.recalculateDataFunctions(book)).toBe(2);
        expect(sheet.getRange("B1:B2").getValues()).toEqual([['=CFQUOTE(A1,"price")'], ['=cffundamentals(A1,"eps_ttm")']]);
        expect(expected[0][0]).toBe(167.84); expect(sheet.getRange("C1").getFormula()).toBe("=B1*2");
        expect(sheet.getRange("A1").getValue()).toBe("NVDA"); expect(sheet.getRange("B5").getValue()).toBe(160);
        expect(sheet.getRange("D1").getFormula()).toBe("=FORMULATEXT(B1)"); expect(flush).toHaveBeenCalledOnce();
    });
    it("restores every source formula when the spreadsheet flush fails", () => {
        const sheet = book.insertSheet("Research"); sheet.getRange("A1").setFormula('=CFHISTORY("NVDA",252)'); sheet.getRange("D1").setFormula('=CFEXPIRATIONS("NVDA")');
        flush.mockImplementation(() => { throw new Error("Spreadsheet write failed"); });
        expect(() => CFFormulaWorkbook.recalculateDataFunctions(book)).toThrow("Spreadsheet write failed");
        expect(sheet.getRange("A1").getFormula()).toBe('=CFHISTORY("NVDA",252)'); expect(sheet.getRange("D1").getFormula()).toBe('=CFEXPIRATIONS("NVDA")');
    });
    it("continues restoring other sheets if one source range rejects a write", () => {
        const first = book.insertSheet("First"), second = book.insertSheet("Second"); first.getRange("A1").setFormula('=CFQUOTE("NVDA")'); second.getRange("A1").setFormula('=CFQUOTE("AAPL")');
        const original = first.getRange.bind(first);
        first.getRange = (...args) => { const range = original(...args); range.setFormulas = () => { throw new Error("Range is protected"); }; return range; };
        expect(() => CFFormulaWorkbook.recalculateDataFunctions(book)).toThrow("Unable to restore a data formula");
        expect(second.getRange("A1").getFormula()).toBe('=CFQUOTE("AAPL")');
    });
});
