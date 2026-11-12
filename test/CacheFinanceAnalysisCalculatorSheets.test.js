import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CFAnalysisCalculatorSheets as Calculator } from "../src/CacheFinanceAnalysisCalculatorSheets.js";

const column = text => [...text].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0);
class Range {
    constructor(sheet, address) {
        this.sheet = sheet; this.address = address;
        const match = address.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
        this.row = Number(match[2]); this.col = column(match[1]); this.endCol = column(match[3] || match[1]); this.endRow = Number(match[4] || match[2]);
    }
    mutate(action) { this.sheet.mutations.push({ address: this.address, column: this.col, endColumn: this.endCol, action }); return this; }
    getValue() { return this.sheet.cells.get(this.row + ":" + this.col) ?? ""; }
    setValue(value) { this.mutate("value"); this.sheet.cells.set(this.row + ":" + this.col, value); return this; }
    setValues(values) { this.mutate("values"); values.forEach((line, r) => line.forEach((value, c) => this.sheet.cells.set((this.row + r) + ":" + (this.col + c), value))); return this; }
    setFormula(value) { this.setValue(value); this.sheet.formulas.set(this.address, value); return this; }
    setFormulas(values) { this.setValues(values); values.forEach((line, r) => line.forEach((value, c) => this.sheet.formulas.set((this.row + r) + ":" + (this.col + c), value))); return this; }
    clearContent() { this.mutate("clear"); for (let r = this.row; r <= this.endRow; r++) for (let c = this.col; c <= this.endCol; c++) this.sheet.cells.delete(r + ":" + c); return this; }
    setDataValidation(value) { this.mutate("validation"); this.sheet.validations.set(this.address, value); return this; }
    setFontSize() { return this.mutate("font"); } setFontWeight() { return this.mutate("font"); } setFontColor() { return this.mutate("font"); }
    setBackground() { return this.mutate("background"); } setNumberFormat(value) { this.mutate("format"); this.sheet.formats.set(this.address, value); return this; }
}
class Sheet {
    constructor() { this.cells = new Map(); this.formulas = new Map(); this.validations = new Map(); this.formats = new Map(); this.mutations = []; this.charts = []; }
    getRange(address) { return new Range(this, address); }
    setColumnWidth(column, width) { this.mutations.push({ column, endColumn: column, action: "width", width }); }
    getCharts() { return [...this.charts]; }
    removeChart(chart) { this.charts = this.charts.filter(value => value !== chart); }
    insertChart(chart) { this.charts.push(chart); }
    newChart() {
        const chart = { options: {}, ranges: [], position: null, getOptions() { return { get: name => this.options[name] }; } };
        const builder = { setChartType() { return this; }, addRange(range) { chart.ranges.push(range.address); return this; }, setNumHeaders(value) { chart.headers = value; return this; },
            setPosition(...values) { chart.position = values; return this; }, setOption(name, value) { chart.options[name] = value; return this; }, build() { return chart; } };
        return builder;
    }
}
const contract = (strike, extra = {}) => ({ type: "Call", strike, expiration: "2026-11-20", mid: 4, bid: 3.9, ask: 4.1, iv: .4, contractSymbol: "NVDA261120C" + String(strike * 1000).padStart(8, "0"), ...extra });
const snapshot = () => ({ ticker: "NVDA", symbol: "NVDA", chart: { price: 173 }, details: { fields: { dividend_yield: { value: .0059 } } },
    options: { ok: true, symbol: "NVDA", underlyingPrice: 173.73, contracts: [contract(180), contract(175), contract(170)] } });
let options, main, book;
beforeEach(() => {
    options = new Sheet(); main = new Sheet();
    options.getRange("Z1").setValue("CACHEFINANCE_ANALYSIS_V1"); options.getRange("B4").setValue("2026-11-20"); main.getRange("B4").setValue("NVDA");
    options.mutations = []; main.mutations = [];
    book = { getSheetByName: name => name === "CF Options" ? options : name === "CF Analysis" ? main : null };
    vi.stubGlobal("Charts", { ChartType: { LINE: "LINE" } });
    vi.stubGlobal("SpreadsheetApp", { newDataValidation: () => { const validation = {}; return { requireValueInList(values, dropdown) { validation.values = values; validation.dropdown = dropdown; return this; }, setAllowInvalid(value) { validation.allowInvalid = value; return this; }, build() { return validation; } }; } });
});
afterEach(() => vi.unstubAllGlobals());

describe("marked option calculator rendering", () => {
    it("requires the ownership marker before any mutation", () => {
        options.getRange("Z1").setValue("not ours"); options.mutations = [];
        expect(() => Calculator.render(book, snapshot())).toThrow("Build the marked analysis tabs");
        expect(options.mutations).toEqual([]); expect(main.mutations).toEqual([]);
    });
    it("rejects a changed ticker before any mutation", () => {
        main.getRange("B4").setValue("AAPL"); main.mutations = [];
        expect(() => Calculator.render(book, snapshot())).toThrow("ticker changed"); expect(options.mutations).toEqual([]);
    });
    it("seeds the nearest current-expiration call and keeps the source columns and marker intact", () => {
        options.getRange("A9").setValue("source chain"); options.mutations = [];
        const result = Calculator.render(book, snapshot());
        expect(result.seedContract).toBe("NVDA261120C00175000");
        expect(options.getRange("P4").getValue()).toBe(173.73); expect(options.getRange("P5").getValue()).toBe(175);
        expect(options.getRange("P6").getValue()).toBe(4); expect(options.getRange("P8").getValue()).toBe(.4);
        expect(options.getRange("P9").getValue()).toBe(.04); expect(options.getRange("P10").getValue()).toBe(.0059);
        expect(options.getRange("P11").getValue()).toBe("Call"); expect(options.getRange("P12").getValue()).toBe(1);
        expect(options.getRange("P13").getValue()).toBe(100); expect(options.getRange("P14").getValue()).toBe("Long");
        expect(options.getRange("A9").getValue()).toBe("source chain"); expect(options.getRange("B4").getValue()).toBe("2026-11-20");
        expect(options.getRange("Z1").getValue()).toBe("CACHEFINANCE_ANALYSIS_V1");
        expect(options.mutations.every(value => value.column >= 15 && value.endColumn <= 23)).toBe(true);
    });
    it("ignores another expiry, puts, crossed quotes and zero/absent mids when selecting a seed", () => {
        const data = snapshot(); data.options.contracts = [contract(173.73, { expiration: "2026-12-18" }), contract(173.73, { type: "Put" }),
            contract(173.73, { bid: 5, ask: 4 }), contract(173.73, { mid: 0 }), contract(173.73, { mid: null }), contract(175)];
        expect(Calculator.render(book, data).seedContract).toBe("NVDA261120C00175000");
    });
    it("uses the spreadsheet time zone for a Date-valued expiration east of UTC", () => {
        const date = new Date("2026-11-19T15:00:00.000Z");
        options.getRange("B4").setValue(date);
        book.getSpreadsheetTimeZone = () => "Asia/Tokyo";
        const formatDate = vi.fn(() => "2026-11-20");
        vi.stubGlobal("Utilities", { formatDate });
        expect(Calculator.render(book, snapshot()).seedContract).toBe("NVDA261120C00175000");
        expect(formatDate).toHaveBeenCalledWith(date, "Asia/Tokyo", "yyyy-MM-dd");
        expect(options.getRange("P5").getValue()).toBe(175);
    });
    it("keeps a Date-valued expiration unavailable if time-zone formatting fails", () => {
        options.getRange("B4").setValue(new Date("2026-11-20T00:00:00.000Z"));
        book.getSpreadsheetTimeZone = () => "Asia/Tokyo";
        vi.stubGlobal("Utilities", { formatDate: () => { throw new Error("Unable to format"); } });
        expect(Calculator.render(book, snapshot()).seedContract).toBe("");
        expect(options.getRange("P5").getValue()).toBe("N/A");
    });
    it("keeps missing premium, strike and IV explicit and creates no fabricated quote chart", () => {
        const data = snapshot(); data.options = { ok: false, symbol: "NVDA", contracts: [contract(175)], underlyingPrice: 999 };
        const result = Calculator.render(book, data);
        expect(options.getRange("P4").getValue()).toBe(173); expect(options.getRange("P5").getValue()).toBe("N/A");
        expect(options.getRange("P6").getValue()).toBe("N/A"); expect(options.getRange("P8").getValue()).toBe("N/A");
        expect(result.payoffChart).toBe(false); expect(options.charts).toHaveLength(0);
    });
    it("ignores another underlying's option data", () => {
        const data = snapshot(); data.options.symbol = "AAPL";
        Calculator.render(book, data); expect(options.getRange("P4").getValue()).toBe(173); expect(options.getRange("P6").getValue()).toBe("N/A");
    });
    it("keeps payoff independent of IV and creates a chart from a usable quote", () => {
        const data = snapshot(); data.options.contracts = [contract(175, { iv: null })];
        Calculator.render(book, data); expect(options.getRange("P8").getValue()).toBe("N/A");
        const payoff = options.formulas.get("24:16");
        expect(payoff).toMatch(/^=IFERROR\(/);
        expect(payoff).toContain('IF($P$14="Short",-1,1)'); expect(payoff).toContain('IF($P$11="Call"');
        expect(payoff).toContain('ISNUMBER($P$6)'); expect(payoff).toContain('MOD($P$12,1)=0'); expect(payoff).not.toMatch(/\$P\$(?:7|8|9|10)\b/);
        expect(options.charts).toHaveLength(1); expect(options.charts[0].ranges).toEqual(["O23:P44"]); expect(options.charts[0].position).toEqual([24, 18, 0, 0]);
    });
    it("writes all native custom-function formulas with the correct fraction inputs and metrics", () => {
        Calculator.render(book, snapshot());
        ["price", "delta", "gamma", "theta", "vega", "rho", "d1", "d2"].forEach((metric, index) => expect(options.formulas.get((4 + index) + ":19")).toBe('=CFOPTIONMODEL($P$4,$P$5,$P$7,$P$8,$P$9,$P$10,$P$11,"' + metric + '")'));
        expect(options.formulas.get("P7")).toContain("DATEVALUE($B$4)"); expect(options.formats.get("P8:P10")).toBe("0.00%");
        expect(options.validations.get("P11")).toMatchObject({ values: ["Call", "Put"], allowInvalid: false });
        expect(options.validations.get("P14")).toMatchObject({ values: ["Long", "Short"], allowInvalid: false });
    });
    it("replaces only its old payoff chart and resets assumptions on refresh", () => {
        const other = { getOptions: () => ({ get: () => "Other chart" }) }; options.charts.push(other);
        Calculator.render(book, snapshot()); options.getRange("P9").setValue(.8); Calculator.render(book, snapshot());
        expect(options.charts).toHaveLength(2); expect(options.charts).toContain(other); expect(options.getRange("P9").getValue()).toBe(.04);
        expect(options.getRange("O2").getValue()).toContain("Refresh resets");
    });
    it("updates the payoff title and removes old ticker seeds on a new snapshot", () => {
        Calculator.render(book, snapshot()); main.getRange("B4").setValue("AAPL");
        const data = snapshot(); data.ticker = "AAPL"; data.symbol = "AAPL"; data.options = { ok: false, symbol: "AAPL", contracts: [] };
        Calculator.render(book, data); expect(options.getRange("P16").getValue()).toBe("No usable ATM call quote");
        expect(options.charts).toEqual([]); expect(options.getRange("O1").getValue()).toBe('=UPPER(TRIM(\'CF Analysis\'!$B$4))&" — option calculator"');
    });
    it("preserves a published zero dividend and labels a missing yield's zero assumption", () => {
        for (const value of [0, null, "=IMPORTXML(1)"]) {
            const data = snapshot(); data.details.fields.dividend_yield.value = value;
            Calculator.render(book, data); expect(options.getRange("P10").getValue()).toBe(0);
            expect(options.getRange("O10").getValue()).toContain("0 if unavailable");
        }
    });
    it("does not turn invalid spot data into zero or copy formula-leading contract text", () => {
        const data = snapshot(); data.options.underlyingPrice = null; data.chart.price = "=1+1";
        Calculator.render(book, data); expect(options.getRange("P4").getValue()).toBe("N/A");
        const next = snapshot(); next.options.contracts = [contract(175, { contractSymbol: "=IMPORTXML(1)" })];
        Calculator.render(book, next); expect(options.getRange("P16").getValue()).toBe("'=IMPORTXML(1)");
    });
});
