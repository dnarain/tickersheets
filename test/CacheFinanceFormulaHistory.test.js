import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CFFormulaHistory as H } from "../src/CacheFinanceFormulaHistory.js";
import { CFFormulaWorkbook } from "../src/CacheFinanceFormulaWorkbook.js";
import { ManagedBook } from "./helpers/ManagedSheetMock.js";

let book, prepare;
beforeEach(() => {
    book = new ManagedBook();
    prepare = vi.spyOn(CFFormulaWorkbook, "prepareSheet").mockImplementation((target, name, marker) => {
        const sheet = target.getSheetByName(name) || target.insertSheet(name);
        sheet.getRange("Z1").setValue(marker);
        return sheet;
    });
    vi.stubGlobal("UrlFetchApp", { fetch: vi.fn(() => { throw new Error("Builder must not request provider data"); }) });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("formula-driven history sources", () => {
    it("writes one function per stock or benchmark history and leaves source output cells empty", () => {
        const { sheet } = H.build(book);
        expect(prepare).toHaveBeenCalledWith(book, "Price history", "CACHEFINANCE_ANALYSIS_V1");
        expect(sheet.getRange("A7").getFormula()).toBe('=CFHISTORY(Analysis!$B$4,510,Analysis!$Z$4)');
        expect(sheet.getRange("AA7").getFormula()).toBe('=CFHISTORY("SPY",510,Analysis!$Z$4)');
        expect(sheet.getRange("AI7").getFormula()).toBe('=CFHISTORY("QQQ",510,Analysis!$Z$4)');
        expect([...sheet.formulas.values()].filter(formula => /CFHISTORY\(/.test(formula))).toHaveLength(3);
        for (const address of ["A8:G517", "AA8:AG517", "AI8:AO517"]) {
            expect(sheet.getRange(address).getValues().every(row => row.every(value => value === ""))).toBe(true);
        }
        expect(UrlFetchApp.fetch).not.toHaveBeenCalled();
        expect(sheet.maxCols).toBeGreaterThanOrEqual(64);
    });

    it("keeps all calculation cells as formulas and does not read any source results during the build", () => {
        const { sheet, firstRow, lastRow } = H.build(book);
        expect([firstRow, lastRow]).toEqual([8, 517]);
        for (let row = firstRow; row <= lastRow; row++) {
            for (let column = 8; column <= 23; column++) expect(sheet.getRange(row, column).getFormula()).toMatch(/^=/);
            for (let column = 43; column <= 62; column++) expect(sheet.getRange(row, column).getFormula()).toMatch(/^=/);
        }
        expect(sheet.frozenRows).toBe(7);
        expect(sheet.hiddenColumn).toBeUndefined();
        expect(sheet.getRange("A2").getValue()).toContain("AQ:BJ show the steps");
    });

    it("returns exact labeled summary addresses used by other tabs", () => {
        const result = H.build(book), sheet = result.sheet;
        const expected = {
            "Indicator date": "BL5", "Closing price": "BL6", "SMA50": "BL8", "SMA200": "BL9", "RSI14": "BL10",
            "MACD": "BL11", "MACD signal": "BL12", "Previous close": "BL13", "1-day adjusted return": "BL14",
            "1-month adjusted return": "BL16", "3-month adjusted return": "BL17", "1-year adjusted return": "BL19",
            "YTD adjusted return": "BL22", "20-day annualized volatility": "BL23", "Maximum observed drawdown": "BL24",
            "20-day average volume": "BL26", "Priced bar count": "BL27", "Previous RSI14": "BL30",
            "First common row index": "BL33", "Stock baseline adjusted close": "BL34",
            "SPY baseline adjusted close": "BL35", "QQQ baseline adjusted close": "BL36"
        };
        for (const [label, address] of Object.entries(expected)) {
            expect(result.summary[label]).toBe("'Price history'!" + address);
            expect(sheet.getRange("BK" + address.slice(2)).getValue()).toBe(label);
            expect(sheet.getRange(address).getFormula()).toMatch(/^=/);
        }
        expect(result.latestIndex).toBe("'Price history'!Y4");
        expect(sheet.getRange("Y4").getFormula()).toBe('=IF(ISNUMBER($BL$4),$BL$4-7,0)');
    });
});

describe("visible indicator formula rules", () => {
    it("uses exact consecutive windows for SMA and seeds EMA from an SMA", () => {
        expect(H.formulas_(26)[0]).toBe('=""');
        expect(H.formulas_(27)[0]).toBe('=IF(AND(COUNT($E8:$E27)=20,MIN($E8:$E27)>0),AVERAGE($E8:$E27),"")');
        expect(H.formulas_(57)[1]).toContain('COUNT($E8:$E57)=50');
        expect(H.formulas_(207)[2]).toContain('COUNT($E8:$E207)=200');
        expect(H.formulas_(19)[3]).toContain('IF(ISNUMBER($K18),$K18+($E19-$K18)*2/(12+1)');
        expect(H.formulas_(19)[3]).toContain('COUNT($E8:$E19)=12');
        expect(H.formulas_(33)[4]).toContain('COUNT($E8:$E33)=26');
        expect(H.formulas_(41)[6]).toContain('COUNT($M33:$M41)=9');
        expect(H.formulas_(41)[6]).not.toContain('MIN(');
    });

    it("requires two adjacent positive closes for changes and uses 14 changes for Wilder seeds", () => {
        expect(H.helpers_(8)[0]).toBe('=""');
        expect(H.helpers_(9)[0]).toContain('AND(AND(ISNUMBER($E9),$E9>0),AND(ISNUMBER($E8),$E8>0))');
        expect(H.helpers_(22)[3]).toContain('COUNT($AR9:$AR22)=14');
        expect(H.helpers_(23)[3]).toContain('($AT22*13+$AR23)/14');
        expect(H.helpers_(23)[4]).toContain('($AU22*13+$AS23)/14');
        const rsi = H.formulas_(23)[8];
        expect(rsi).toContain('IF(AND($AT23=0,$AU23=0),50');
        expect(rsi).toContain('IF($AU23=0,100,100-100/(1+$AT23/$AU23))');
        expect(rsi).toContain('ISNUMBER($AT23),ISNUMBER($AU23)');
    });

    it("preserves missing adjusted closes, persistent peaks and genuine zero returns/volume", () => {
        const formulas = H.formulas_(40), helpers = H.helpers_(40);
        expect(formulas[10]).toContain('$F40/$F39-1');
        expect(formulas[10]).toContain('ISNUMBER($F39)');
        expect(helpers[5]).toContain('IF(ISNUMBER($AV39),$AV39,"")');
        expect(helpers[14]).toContain('MIN($G21:$G40)>=0');
        expect(helpers[15]).toContain('LN($F40/$F39)');
        expect(helpers[16]).toBe('=IF(COUNT($BF21:$BF40)=20,STDEV.S($BF21:$BF40)*SQRT(252),"")');
        for (const formula of [...formulas, ...helpers]) expect(formula).not.toMatch(/IFERROR\([^]*?,\s*0\)/);
    });

    it("aligns all indexed lines to the same first valid date and keeps missing matches blank", () => {
        const formulas = H.formulas_(50), helpers = H.helpers_(50);
        expect(helpers[6]).toContain('MATCH($A50,$AA$8:$AA$517,0)');
        expect(helpers[7]).toContain('MATCH($A50,$AI$8:$AI$517,0)');
        expect(helpers[8]).toContain('COUNT(INDEX($AF$8:$AF$517,$AW50))=1');
        expect(helpers[9]).toContain('COUNT(INDEX($AN$8:$AN$517,$AX50))=1');
        expect(helpers[10]).toContain('ISNUMBER($AY50),ISNUMBER($AZ50)');
        expect(formulas.slice(11, 14)).toEqual([
            '=IF($BA50<>"",$F50/$BL$34*100,"")',
            '=IF($BA50<>"",$AY50/$BL$35*100,"")',
            '=IF($BA50<>"",$AZ50/$BL$36*100,"")'
        ]);
    });

    it("guards incomplete latest rows and absent history without silently substituting zero prices", () => {
        const summary = new Map(H.summary_());
        expect(summary.get("Latest close sheet row")).toBe('=IF(COUNT($BH$8:$BH$517)>0,MAX($BH$8:$BH$517),"")');
        expect(summary.get("Previous RSI14")).toContain('$BL$4>8');
        expect(summary.get("1-month adjusted return")).toContain('$BL$4>=29');
        expect(summary.get("YTD adjusted return")).toContain('ISNUMBER($BL$21)');
        expect(summary.get("Maximum observed drawdown")).toContain('COUNTIF($F$8:INDEX($F$8:$F$517,$BL$4-7),">0")=$BL$4-7');
        expect(summary.get("Priced bar count")).toBe('=COUNT($BH$8:$BH$517)');
        expect(summary.get("Latest adjusted close")).toContain('COUNT(INDEX(');
        for (const formula of summary.values()) expect(formula).not.toMatch(/INDEX\(\$[A-Z]+:\$[A-Z]+/);
    });
});
