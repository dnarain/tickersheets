import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CFFormulaResearch as R } from "../src/CacheFinanceFormulaResearch.js";
import { CFFormulaWorkbook } from "../src/CacheFinanceFormulaWorkbook.js";
import { ManagedBook } from "./helpers/ManagedSheetMock.js";

let book;
let prepare;
const formulaAt = (sheet, address) => sheet.getRange(address).getFormula();

function charts(sheet) {
    sheet.charts = [];
    sheet.newChart = () => {
        const builder = { options: {}, ranges: [], setChartType(value) { this.type = value; return this; }, setNumHeaders(value) { this.headers = value; return this; },
            setPosition(...value) { this.position = value; return this; }, setOption(key, value) { this.options[key] = value; return this; },
            addRange(value) { this.ranges.push(value); return this; }, build() { return { type: this.type, headers: this.headers, position: this.position, options: { ...this.options }, ranges: [...this.ranges] }; } };
        return builder;
    };
    sheet.insertChart = chart => { sheet.charts.push(chart); return sheet; };
    return sheet;
}

function setup(name) { return charts(book.getSheetByName(name) || book.insertSheet(name)); }

function balanced(formula) {
    const stack = [];
    let quoted = false;
    for (let i = 0; i < formula.length; i++) {
        const char = formula[i];
        if (char === '"') {
            if (quoted && formula[i + 1] === '"') { i++; continue; }
            quoted = !quoted;
        }
        if (quoted) continue;
        if (char === "(" || char === "{") stack.push(char);
        if (char === ")" && stack.pop() !== "(") return false;
        if (char === "}" && stack.pop() !== "{") return false;
    }
    return !quoted && stack.length === 0;
}

function assertSpillClear(sheet, firstRow, lastRow, firstColumn, lastColumn) {
    const blocked = [];
    for (const key of sheet.formulas.keys()) {
        const [row, col] = key.split(":").map(Number);
        if (row >= firstRow && row <= lastRow && col >= firstColumn && col <= lastColumn) blocked.push(key);
    }
    expect(blocked, "Formulas block source output rows " + firstRow + ":" + lastRow + " and columns " + firstColumn + ":" + lastColumn).toEqual([]);
}

beforeEach(() => {
    book = new ManagedBook();
    setup("Analysis").getRange("B4").setValue("NVDA");
    book.getSheetByName("Analysis").getRange("E4").setValue(7);
    for (const name of ["Quote data", "Price history", "Options", "Fundamentals", "Macro"]) setup(name);
    prepare = vi.fn((_book, name, marker) => {
        const sheet = setup(name);
        sheet.cells.clear(); sheet.formulas.clear(); sheet.charts = [];
        sheet.maxRows = 1000; sheet.maxCols = 26;
        sheet.getRange("Z1").setValue(marker);
        return sheet;
    });
    vi.stubGlobal("CFFormulaWorkbook", { prepareSheet: prepare, optionSource: CFFormulaWorkbook.optionSource });
    vi.stubGlobal("Charts", { ChartType: { LINE: "LINE", COLUMN: "COLUMN", COMBO: "COMBO" } });
    for (const name of ["CFEARNINGS", "CFFRED", "CFOPTIONS", "CFFIELD", "CFDATASTATUS"]) vi.stubGlobal(name, vi.fn(() => { throw new Error("The sheet builder must not fetch provider data"); }));
});

afterEach(() => vi.unstubAllGlobals());

describe("formula-driven earnings sources", () => {
    it("authors six source formulas with the common ticker/refresh controls and no provider calls", () => {
        const sheet = R.buildEarnings(book);
        for (const [anchor, section] of [["A7", "earnings"], ["L7", "financials"], ["U7", "estimates"], ["AF7", "dividends"], ["AK7", "splits"], ["AP7", "calendar"]]) {
            expect(formulaAt(sheet, anchor)).toBe('=CFEARNINGS(Analysis!$B$4,"' + section + '",Analysis!$E$4)');
        }
        expect([...sheet.formulas.values()].filter(value => value.startsWith("=CFEARNINGS("))).toHaveLength(6);
        expect(globalThis.CFEARNINGS).not.toHaveBeenCalled();
        expect(formulaAt(sheet, "B4")).toContain('MATCH("next_earnings_dates",$AP$8:$AP$20,0)');
        expect(formulaAt(sheet, "E4")).toContain('MATCH("date_status",$AP$8:$AP$20,0)');
        expect(prepare).toHaveBeenCalledWith(book, "Earnings", "CACHEFINANCE_ANALYSIS_V1");
    });

    it("keeps all source expansion areas free of calculation formulas", () => {
        const sheet = R.buildEarnings(book);
        for (const [first, last] of [[1, 10], [12, 19], [21, 30], [32, 35], [37, 40], [42, 45]]) assertSpillClear(sheet, 8, 507, first, last);
    });

    it("labels period keys and distinguishes missing values from numeric zero in duplicate signatures", () => {
        const sheet = R.buildEarnings(book);
        expect(formulaAt(sheet, "AU8")).toContain("REGEXMATCH");
        expect(formulaAt(sheet, "AU8")).toContain('"[0-9]{4}"');
        expect(formulaAt(sheet, "BA507")).toContain('$M507="Annual"');
        expect(formulaAt(sheet, "BA507")).toContain('$M507="Quarterly"');
        expect(formulaAt(sheet, "AV8")).toContain('IF(ISNUMBER($C8),"N:"&TEXT($C8,"0.00000000000000E+00"),"M")');
        expect(formulaAt(sheet, "BB8")).toContain('IF(ISNUMBER($O8),"N:"&TEXT($O8,"0.00000000000000E+00"),"M")');
        expect(formulaAt(sheet, "AW8")).toContain('$I$8:$I$507,$I8');
        expect(formulaAt(sheet, "AW8")).toContain('$AV$8:$AV$507,$AV8');
        expect(formulaAt(sheet, "BC8")).toContain('$R$8:$R$507,$R8');
        expect(formulaAt(sheet, "BC8")).toContain('$BB$8:$BB$507,$BB8');
        expect(sheet.getRange("AU7:AX7").getValues()[0]).toEqual(["Fiscal period key", "EPS signature", "Accepted first record", "Reason"]);
    });
});

describe("formula-driven research calculations and charts", () => {
    it("links summary calculations to source rows with matching basis, period and currency", () => {
        const sheet = R.buildResearch(book);
        expect(formulaAt(sheet, "C8")).toContain('INDEX(Earnings!$C$8:$C$507,$D302)');
        expect(formulaAt(sheet, "D302")).toContain('(Earnings!$I$8:$I$507=$B302)');
        expect(formulaAt(sheet, "D302")).toContain('ISNUMBER(Earnings!$C$8:$C$507)');
        expect(formulaAt(sheet, "B302")).toContain('COUNTUNIQUE(');
        expect(formulaAt(sheet, "F306")).toContain('(Earnings!$BA$8:$BA$507=$D306-1)');
        expect(formulaAt(sheet, "F307")).toContain('(Earnings!$M$8:$M$507=$B307)');
        expect(formulaAt(sheet, "E14")).toContain('INDEX(Earnings!$O$8:$O$507,$F306)>0');
        expect(formulaAt(sheet, "G14")).toContain('INDEX(Earnings!$P$8:$P$507,$F306)>0');
        expect(formulaAt(sheet, "I14")).toContain('*100');
        expect(formulaAt(sheet, "E8")).toContain('D8<>0');
        expect(formulaAt(sheet, "E8")).toContain('ABS(D8)*100');
    });

    it("uses one formula per extra option maturity and reuses the selected Options source", () => {
        const sheet = R.buildResearch(book);
        expect([...sheet.formulas.values()].filter(value => value.includes('CFOPTIONS('))).toHaveLength(4);
        expect(formulaAt(sheet, "AA600")).toContain('CFOPTIONS(Analysis!$B$4,$A26,\'Quote data\'!$P$8)');
        for (const [index, anchor] of ["AA600", "AQ600", "BG600", "BW600"].entries()) {
            expect(formulaAt(sheet, anchor)).toContain('AND(ISNUMBER(\'Quote data\'!$P$8),\'Quote data\'!$P$8=Analysis!$E$4)');
            expect(formulaAt(sheet, anchor)).toContain('ISNUMBER(IFERROR(DATEVALUE($A' + (26 + index) + '),""))');
        }
        expect(formulaAt(sheet, "AQ600")).toContain('$A27');
        expect(formulaAt(sheet, "BG600")).toContain('$A28');
        expect(formulaAt(sheet, "BW600")).toContain('$A29');
        expect(formulaAt(sheet, "CM601")).toContain('Options!$B8="Call"');
        expect(formulaAt(sheet, "CN601")).toContain('COUNTIFS(Options!$B$8:$B$1007,"Put"');
        expect(formulaAt(sheet, "CN601")).not.toContain('$CM$601:$CM$1600');
        expect(formulaAt(sheet, "CO601")).toContain('Options!$B8="Call"');
        expect(formulaAt(sheet, "CP601")).toContain('Options!$B8="Put"');
        expect(formulaAt(sheet, "P25")).toContain('(Options!$C$8:$C$1007=$S25)');
        expect(formulaAt(sheet, "S25")).toContain('MIN($CP$601:$CP$1600)');
        expect(formulaAt(sheet, "R25")).toContain('MIN(FILTER(Options!$C$8:$C$1007,$CN$601:$CN$1600=MIN($CN$601:$CN$1600)))');
        expect(formulaAt(sheet, "Q25")).toBe('=IF(AND(ISNUMBER($E25),ISNUMBER($K25),$B25=$H25),AVERAGE($E25,$K25),"N/A")');
        expect(formulaAt(sheet, "A25")).toBe('=IF(Options!$B$4="","N/A",IF(ISNUMBER(Options!$B$4),TEXT(Options!$B$4,"yyyy-mm-dd"),Options!$B$4))');
        expect(formulaAt(sheet, "N25")).toContain('"Partial"');
        expect(formulaAt(sheet, "E25")).toContain('INDEX($CM$601:$CM$1600,$O25)=1');
        expect(formulaAt(sheet, "B421")).toContain('$CM$601:$CM$1600,1');
        expect(formulaAt(sheet, "D421")).not.toContain('$CM$601:$CM$1600');
        expect(formulaAt(sheet, "CS8")).toContain('COUNTIF($A$25:$A$26,$CP8)=0');
        expect(formulaAt(sheet, "CU8")).toContain('COUNTIF($A$25:$A$28,$CP8)=0');
        expect(globalThis.CFOPTIONS).not.toHaveBeenCalled();
    });

    it("keeps raw option spill ranges and earnings chart spill ranges unobstructed", () => {
        const sheet = R.buildResearch(book);
        for (const column of [27, 43, 59, 75]) assertSpillClear(sheet, 601, 10600, column, column + 11);
        for (const [first, last] of [[15, 19], [21, 25]]) assertSpillClear(sheet, 42, 540, first, last);
        for (const [first, last] of [[27, 35], [37, 45], [47, 55], [57, 65]]) assertSpillClear(sheet, 9, 507, first, last);
        expect(sheet.getMaxRows()).toBeGreaterThanOrEqual(10600);
        expect(sheet.getMaxColumns()).toBeGreaterThanOrEqual(100);
    });

    it("shows calculation and source-capacity limits without truncating option tables", () => {
        const sheet = R.buildResearch(book), warning = formulaAt(sheet, "A33");
        expect(warning).toContain("capacity for 10,000"); expect(warning).toContain("larger result requires more sheet rows");
        expect(warning).toContain('ISERROR($AA$600)'); expect(warning).toContain('ISERROR($BW$600)');
        for (const typeColumn of ["AB", "AR", "BH", "BX"]) expect(warning).toContain('$' + typeColumn + '$1601="Call"');
        expect(warning).toContain("Calculations and charts use the first 1,000"); expect(warning).toContain("full raw source output remains visible");
        for (const anchor of ["AA600", "AQ600", "BG600", "BW600"]) {
            expect(formulaAt(sheet, anchor)).toContain("CFOPTIONS("); expect(formulaAt(sheet, anchor)).not.toMatch(/ARRAY_CONSTRAIN|CHOOSEROWS|TAKE\(/);
        }
    });

    it("requests the three public field tables once and creates source-linked chart ranges", () => {
        const sheet = R.buildResearch(book);
        expect(formulaAt(sheet, "A190")).toBe('=CFFIELD("FINVIZ",Analysis!$B$4,"all",Analysis!$E$4)');
        expect(formulaAt(sheet, "G190")).toContain('"GURUFOCUS"'); expect(formulaAt(sheet, "A230")).toContain('"ZACKS"');
        expect([...sheet.formulas.values()].filter(value => value.startsWith("=CFFIELD("))).toHaveLength(3);
        expect(globalThis.CFFIELD).not.toHaveBeenCalled();
        expect(sheet.charts).toHaveLength(15);
        expect(sheet.charts.map(chart => chart.options.title)).toContain("NVDA — GAAP EPS actual / estimate (reported currency)");
        expect(sheet.charts.filter(chart => chart.ranges.some(range => range.sheet.getName() === "Macro"))).toHaveLength(4);
        expect(sheet.charts.find(chart => chart.options.title.includes("IV by expiration")).ranges.map(range => range.row)).toEqual([530]);
        expect(formulaAt(sheet, "AB531")).toBe('=IF(ISNUMBER($E25),$E25,NA())');
        const eps = sheet.charts.find(chart => chart.options.title.includes("GAAP EPS"));
        expect(eps.ranges.map(range => range.row)).toEqual([40, 40]);
    });

    it("builds the non-FRED charts when the optional Macro sheet is absent", () => {
        book.sheets.delete("Macro");
        const sheet = R.buildResearch(book);
        expect(sheet.charts).toHaveLength(11);
        expect(sheet.charts.every(chart => chart.ranges.length > 0)).toBe(true);
    });
});

describe("formula-driven economic series and source report", () => {
    it("requests each FRED series once and calculates latest/prior values without treating zero as missing", () => {
        const sheet = R.buildMacro(book);
        for (const [anchor, id] of [["A15", "DGS10"], ["G15", "FEDFUNDS"], ["M15", "CPIAUCSL"], ["S15", "UNRATE"]]) expect(formulaAt(sheet, anchor)).toBe('=CFFRED("' + id + '",400,Analysis!$E$4)');
        expect([...sheet.formulas.values()].filter(value => value.startsWith("=CFFRED("))).toHaveLength(4);
        expect(formulaAt(sheet, "AB8")).toContain('ISNUMBER($B$16:$B$415)');
        expect(formulaAt(sheet, "AB8")).toContain('MAX(FILTER(ROW(');
        expect(formulaAt(sheet, "AB8")).not.toContain('LOOKUP(');
        expect(formulaAt(sheet, "AC8")).toContain('ROW($B$16:$B$415)<$AB8');
        expect(formulaAt(sheet, "D8")).toBe('=IF($AB8=0,"N/A",INDEX($B$16:$B$415,$AB8-15))');
        expect(formulaAt(sheet, "F8")).toContain('OR($AB8=0,$AC8=0)');
        expect(formulaAt(sheet, "AD8")).toBe('=COUNT($B$16:$B$415)');
        expect(formulaAt(sheet, "AB16")).toBe('=IF(ISNUMBER($B16),$B16,NA())');
        expect(formulaAt(sheet, "G8")).toContain('LEFT(TO_TEXT($A$15),4)="N/A:"');
        expect(sheet.getRange("A13").getValue()).toContain("CPIAUCSL is an index level");
        expect(globalThis.CFFRED).not.toHaveBeenCalled();
    });

    it("keeps all FRED source expansion areas clear", () => {
        const sheet = R.buildMacro(book);
        for (const [first, last] of [[1, 5], [7, 11], [13, 17], [19, 23]]) assertSpillClear(sheet, 16, 415, first, last);
    });

    it("reports the existing source outputs without invoking diagnostic or provider functions", () => {
        for (const name of ["Earnings", "Research"]) setup(name);
        const sheet = R.buildSources(book);
        expect([...sheet.formulas.values()].every(value => !/\bCF(?:DATASTATUS|QUOTE|HISTORY|OPTIONS|FIELD|FRED|EARNINGS)\(/.test(value))).toBe(true);
        expect(globalThis.CFDATASTATUS).not.toHaveBeenCalled();
        expect(formulaAt(sheet, "B8")).toContain('HYPERLINK("#gid=');
        expect(formulaAt(sheet, "B8")).toContain('&range=A7","Quote data!A7")');
        expect(formulaAt(sheet, "C8")).toContain("IF(ISERROR('Quote data'!A7),'Quote data'!A7");
        expect(formulaAt(sheet, "C15")).toContain("COUNT('Research'!$B$191:$B$222)>0");
        expect(formulaAt(sheet, "C16")).toContain("COUNT('Research'!$H$191:$H$192)>0");
        expect(formulaAt(sheet, "C17")).toContain("COUNT('Research'!$B$231:$B$231)>0");
        expect(formulaAt(sheet, "C14")).toContain("COUNTA('Quote data'!$O$8:$O$207)>0");
        expect(formulaAt(sheet, "E11")).toBe('=IF(COUNTA(Fundamentals!$E$8)=0,"N/A",Fundamentals!$E$8)');
        expect(formulaAt(sheet, "E15")).toBe('=IF(COUNTA(Research!$E$191)=0,"N/A",Research!$E$191)');
        expect(sheet.getRange("F13").getValue()).toContain("bid/ask");
    });

    it("keeps readable source addresses if a source sheet has not yet been built", () => {
        book.sheets.delete("Options");
        const sheet = R.buildSources(book);
        expect(formulaAt(sheet, "B13")).toBe('="Options!A7"');
    });
});

describe("generated formula syntax", () => {
    it("authors balanced formula strings throughout the four views", () => {
        const sheets = [R.buildEarnings(book), R.buildMacro(book), R.buildResearch(book), R.buildSources(book)];
        for (const sheet of sheets) for (const [key, formula] of sheet.formulas) expect(balanced(formula), sheet.getName() + " " + key + " " + formula).toBe(true);
    });

    it.each([[1, "A"], [26, "Z"], [27, "AA"], [47, "AU"], [99, "CU"], [702, "ZZ"]])("converts column %i to %s and back", (number, label) => {
        expect(R.column_(number)).toBe(label); expect(R.columnNumber_(label)).toBe(number);
    });
});
