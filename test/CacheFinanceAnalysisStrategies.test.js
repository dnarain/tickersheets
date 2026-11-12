import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CFAnalysisStrategies as Strategies } from "../src/CacheFinanceAnalysisStrategies.js";

const base = extra => ({ strategy: "Covered call", spot: 100, longStrike: "N/A", longPremium: "N/A", shortStrike: 110, shortPremium: 3, contracts: 1, multiplier: 100, expiration: "2026-11-20", ...extra });
describe("expiration strategy arithmetic", () => {
    it("includes stock purchase cost in covered-call cash flow and P/L", () => {
        expect(Strategies.calculate(base())).toMatchObject({ ok: true, netPremium: 300, stockCost: 10000, initialCashflow: -9700, collateral: 0, maxProfit: 1300, maxLoss: 9700, breakeven: 97 });
        [0, 100, 110, 150].forEach((stock, index) => expect(Strategies.payoff(base(), stock)).toBe([-9700, 300, 1300, 1300][index]));
    });
    it("separates put premium from cash reserved for assignment", () => {
        const input = base({ strategy: "Cash-secured put", spot: null, shortStrike: 100 });
        expect(Strategies.calculate(input)).toMatchObject({ ok: true, initialCashflow: 300, netPremium: 300, stockCost: 0, collateral: 10000, maxProfit: 300, maxLoss: 9700, breakeven: 97 });
        expect(Strategies.payoff(input, 0)).toBe(-9700); expect(Strategies.payoff(input, 97)).toBe(0); expect(Strategies.payoff(input, 200)).toBe(300);
    });
    it.each([
        ["Call vertical", 100, 8, 110, 3, "Bull call vertical", -500],
        ["Call vertical", 110, 3, 100, 8, "Bear call vertical", 500],
        ["Put vertical", 110, 8, 100, 3, "Bear put vertical", -500],
        ["Put vertical", 100, 3, 110, 8, "Bull put vertical", 500]
    ])("calculates bounded %s %s/%s and %s/%s", (strategy, longStrike, longPremium, shortStrike, shortPremium, structure, cashflow) => {
        const input = base({ strategy, longStrike, longPremium, shortStrike, shortPremium });
        expect(Strategies.calculate(input)).toMatchObject({ ok: true, structure, netPremium: cashflow, initialCashflow: cashflow, maxProfit: 500, maxLoss: 500, breakeven: 105, stockCost: 0, collateral: 0 });
        expect(Strategies.payoff(input, 105)).toBe(0);
        const outcomes = [0, 90, 100, 105, 110, 120, 10000].map(stock => Strategies.payoff(input, stock));
        expect(Math.max(...outcomes)).toBe(500); expect(Math.min(...outcomes)).toBe(-500);
    });
    it("scales cash values with editable quantity and multiplier", () => {
        const data = Strategies.calculate(base({ contracts: 2, multiplier: 10 }));
        expect(data).toMatchObject({ netPremium: 60, stockCost: 2000, maxProfit: 260, maxLoss: 1940, breakeven: 97 });
        expect(Strategies.payoff(base({ contracts: 2, multiplier: 10 }), 110)).toBe(260);
    });
    it("accepts zero option premiums without converting missing values to zero", () => {
        expect(Strategies.calculate(base({ shortPremium: 0 }))).toMatchObject({ ok: true, netPremium: 0, premiumType: "Zero net premium", maxProfit: 1000, maxLoss: 10000, breakeven: 100 });
        for (const shortPremium of [null, undefined, "0", "3", NaN, Infinity, -1]) expect(Strategies.calculate(base({ shortPremium })).ok).toBe(false);
    });
    it("requires valid dates, integer quantities and distinct vertical strikes", () => {
        for (const patch of [{ expiration: "2026-02-30" }, { expiration: "2026-2-03" }, { expiration: "" }, { expiration: new Date() }, { contracts: 0 }, { contracts: 1.5 }, { contracts: "1" }, { multiplier: null }, { multiplier: -100 }, { spot: "100" }, { shortStrike: 0 }]) expect(Strategies.calculate(base(patch)).ok).toBe(false);
        for (const patch of [{ longStrike: 110, longPremium: 3 }, { longStrike: 100, longPremium: null }, { longStrike: 100, longPremium: "0" }]) expect(Strategies.calculate(base({ strategy: "Call vertical", ...patch })).ok).toBe(false);
        expect(Strategies.calculate(base({ expiration: "2024-02-29" })).ok).toBe(true);
        expect(Strategies.calculate(base({ strategy: "unknown" })).ok).toBe(false);
    });
    it("returns no breakeven when every attainable stock price profits or loses", () => {
        expect(Strategies.calculate(base({ shortPremium: 200 }))).toMatchObject({ ok: true, maxLoss: 0, breakeven: null });
        expect(Strategies.calculate(base({ strategy: "Call vertical", longStrike: 100, longPremium: 20, shortStrike: 110, shortPremium: 0 })))
            .toMatchObject({ ok: true, maxProfit: -1000, maxLoss: 2000, breakeven: null });
        expect(Strategies.calculate(base({ strategy: "Cash-secured put", shortStrike: 100, shortPremium: 110 }))).toMatchObject({ ok: true, maxLoss: 0, breakeven: null });
    });
    it("labels zero-P/L intervals at spread boundaries", () => {
        const result = Strategies.calculate(base({ strategy: "Call vertical", longStrike: 100, longPremium: 3, shortStrike: 110, shortPremium: 3 }));
        expect(result.breakeven).toBe(100); expect(result.breakEvenNote).toContain("Boundary");
        expect(Strategies.payoff(base({ strategy: "Call vertical", longStrike: 100, longPremium: 3, shortStrike: 110, shortPremium: 3 }), 0)).toBe(0);
    });
    it("rejects invalid stock scenarios and numeric overflow", () => {
        for (const stock of [null, undefined, "100", -1, NaN, Infinity]) expect(Strategies.payoff(base(), stock)).toBeNull();
        expect(Strategies.calculate(base({ spot: Number.MAX_VALUE })).ok).toBe(false);
        expect(Strategies.calculate(base({ contracts: Number.MAX_SAFE_INTEGER, multiplier: 100 })).ok).toBe(false);
        expect(Strategies.calculate(null).ok).toBe(false);
    });
    it("accepts simple programmatic aliases and lists primary OIC references", () => {
        expect(Strategies.calculate(base({ strategy: "covered_call" })).ok).toBe(true);
        expect(Strategies.calculate(base({ strategy: "cash-secured-put" })).strategy).toBe("Cash-secured put");
        expect(Strategies.references()).toHaveLength(6); expect(Strategies.references().every(row => row[1].startsWith("https://www.optionseducation.org/strategies/"))).toBe(true);
    });
});

const column = text => [...text].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0);
class Range {
    constructor(sheet, address) { this.sheet = sheet; this.address = address; const match = address.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/); this.row = +match[2]; this.col = column(match[1]); this.endCol = column(match[3] || match[1]); this.endRow = +(match[4] || match[2]); }
    setValue(value) { this.sheet.mutations++; this.sheet.cells.set(this.row + ":" + this.col, value); return this; }
    getValue() { return this.sheet.cells.get(this.row + ":" + this.col) ?? ""; }
    setValues(values) { this.sheet.mutations++; values.forEach((line, r) => line.forEach((value, c) => this.sheet.cells.set((this.row + r) + ":" + (this.col + c), value))); return this; }
    getValues() { return Array.from({ length: this.endRow - this.row + 1 }, (_v, r) => Array.from({ length: this.endCol - this.col + 1 }, (_w, c) => this.sheet.cells.get((this.row + r) + ":" + (this.col + c)) ?? "")); }
    setFormula(value) { this.sheet.formulas.set(this.address, value); return this.setValue(value); }
    setFormulas(values) { values.forEach((line, r) => line.forEach((value, c) => this.sheet.formulas.set((this.row + r) + ":" + (this.col + c), value))); return this.setValues(values); }
    clearContent() { this.sheet.mutations++; for (const key of this.sheet.cells.keys()) { const [row, col] = key.split(":").map(Number); if (row >= this.row && row <= this.endRow && col >= this.col && col <= this.endCol) this.sheet.cells.delete(key); } return this; }
    setDataValidation(value) { this.sheet.validations.set(this.address, value); return this; }
    setBackground() { return this; } setFontColor() { return this; } setFontWeight() { return this; } setFontSize() { return this; } setNumberFormat() { return this; } setWrap() { return this; } merge() { return this; }
}
class Sheet {
    constructor(name) { this.name = name; this.cells = new Map(); this.formulas = new Map(); this.validations = new Map(); this.mutations = 0; this.charts = []; this.maxRows = 1000; this.maxColumns = 26; }
    getRange(address) { return new Range(this, address); } getName() { return this.name; }
    getLastRow() { return Math.max(1, ...[...this.cells.keys()].map(key => Number(key.split(":")[0]))); }
    getMaxRows() { return this.maxRows; } getMaxColumns() { return this.maxColumns; }
    insertRowsAfter(_after, count) { this.maxRows += count; } insertColumnsAfter(_after, count) { this.maxColumns += count; }
    getCharts() { return [...this.charts]; } removeChart(chart) { this.charts = this.charts.filter(item => item !== chart); } insertChart(chart) { this.charts.push(chart); }
    setColumnWidth() {}
    newChart() { const chart = { options: {}, ranges: [], getOptions() { return { get: name => this.options[name] }; } }; return { setChartType() { return this; }, addRange(range) { chart.ranges.push(range.address); return this; }, setNumHeaders() { return this; }, setPosition() { return this; }, setOption(name, value) { chart.options[name] = value; return this; }, build() { return chart; } }; }
}
const quote = (type, strike, extra = {}) => ({ type, strike, expiration: "2026-11-20", bid: 3, ask: 4, iv: .4, contractSymbol: "NVDA261120" + (type === "Call" ? "C" : "P") + String(strike * 1000).padStart(8, "0"), ...extra });
const snapshot = () => ({ ticker: "NVDA", symbol: "NVDA", chart: { price: 99 }, options: { ok: true, symbol: "NVDA", underlyingPrice: 100, contracts: [quote("Call", 100), quote("Call", 110), quote("Put", 90), quote("Put", 100)] } });
let sheets, book;
beforeEach(() => {
    sheets = new Map(["CF Analysis", "CF Options"].map(name => [name, new Sheet(name)]));
    for (const sheet of sheets.values()) { sheet.getRange("Z1").setValue("CACHEFINANCE_ANALYSIS_V1"); sheet.mutations = 0; }
    sheets.get("CF Analysis").getRange("B4").setValue("NVDA"); sheets.get("CF Options").getRange("B4").setValue("2026-11-20");
    book = { getSheetByName: name => sheets.get(name), insertSheet: name => { const sheet = new Sheet(name); sheets.set(name, sheet); return sheet; }, getSpreadsheetTimeZone: () => "America/Los_Angeles" };
    vi.stubGlobal("Charts", { ChartType: { LINE: "LINE" } });
    vi.stubGlobal("SpreadsheetApp", { newDataValidation: () => { const data = {}; return { requireValueInList(values) { data.values = values; return this; }, setAllowInvalid(value) { data.allowInvalid = value; return this; }, build() { return data; } }; } });
});
afterEach(() => vi.unstubAllGlobals());
describe("editable strategy tab", () => {
    it("rejects an unmarked user tab and a changed ticker before writes", () => {
        const own = new Sheet("CF Strategies"); own.getRange("A1").setValue("personal sheet"); own.mutations = 0; sheets.set("CF Strategies", own);
        expect(() => Strategies.render(book, snapshot())).toThrow("not a CacheFinance"); expect(own.mutations).toBe(0);
        expect(() => Strategies.invalidate(book, "changed")).toThrow("not a CacheFinance"); expect(own.getRange("A1").getValue()).toBe("personal sheet");
        sheets.delete("CF Strategies"); sheets.get("CF Analysis").getRange("B4").setValue("AAPL");
        expect(() => Strategies.render(book, snapshot())).toThrow("ticker changed"); expect(sheets.has("CF Strategies")).toBe(false);
    });
    it("creates only its own marked tab and uses actual asks for longs and bids for shorts", () => {
        const result = Strategies.render(book, snapshot()), sheet = sheets.get("CF Strategies");
        expect(result).toMatchObject({ ticker: "NVDA", quoteRows: 4, expiration: "2026-11-20", payoffChart: true });
        expect(sheet.getRange("Z1").getValue()).toBe("CACHEFINANCE_STRATEGIES_V1"); expect(sheet.maxRows).toBe(1055);
        expect(sheet.getRange("B5").getValue()).toBe(100); expect(sheet.getRange("B10").getValue()).toBe(1); expect(sheet.getRange("B11").getValue()).toBe(100);
        expect(sheet.getRange("T5:Y8").getValues()).toEqual([
            ["Covered call", "N/A", "N/A", 100, 3, "Selected expiration; editable"],
            ["Cash-secured put", "N/A", "N/A", 100, 3, "Selected expiration; editable"],
            ["Call vertical", 100, 4, 110, 3, "Selected expiration; editable"],
            ["Put vertical", 100, 4, 90, 3, "Selected expiration; editable"]
        ]);
        expect(sheet.formulas.get("B7")).toContain("FILTER($D$56:$D$1055"); expect(sheet.formulas.get("B9")).toContain("FILTER($C$56:$C$1055");
        for (const address of ["B7", "B9"]) { expect(sheet.formulas.get(address)).toContain('"Call","Put"'); expect(sheet.formulas.get(address)).toContain('"N/A"'); }
        expect(sheet.formulas.get("A1")).toContain("'CF Analysis'!$B$4");
        expect(sheet.charts[0].options.title).toBe("NVDA — strategy payoff");
        expect(sheet.formulas.get("25:2")).toContain('"payoff",A25');
        expect(sheet.formulas.get("4:5")).toBe('=CFSTRATEGY($B$4,$B$5,$B$6,$B$7,$B$8,$B$9,$B$10,$B$11,$B$12,"initialCashflow")');
        expect(sheet.validations.get("B4")).toMatchObject({ values: Strategies.names(), allowInvalid: false });
        expect(sheets.get("CF Options").getRange("Z1").getValue()).toBe("CACHEFINANCE_ANALYSIS_V1");
    });
    it("never seeds mismatched symbols, dates, OCC identifiers or crossed quotes", () => {
        const data = snapshot(); data.options.contracts = [quote("Call", 100, { bid: 5, ask: 4 }), quote("Call", 100, { expiration: "2026-12-18" }), quote("Call", 100, { contractSymbol: "=IMPORTXML(1)" }), quote("Put", 100, { contractSymbol: "AAPL261120P00100000" })];
        expect(Strategies.render(book, data)).toMatchObject({ quoteRows: 0, payoffChart: false });
        const sheet = sheets.get("CF Strategies"); expect(sheet.getRange("W5").getValue()).toBe("N/A"); expect(sheet.charts).toEqual([]);
        data.options.symbol = "AAPL"; expect(Strategies.render(book, data).quoteRows).toBe(0); expect(sheet.getRange("B5").getValue()).toBe(99);
    });
    it.each([[1200, 500, 500], [3, 997, 3]])("retains nearest calls and puts in a chain with 1200 calls and %s puts", (putCount, expectedCalls, expectedPuts) => {
        const data = snapshot(); data.options.underlyingPrice = 900;
        data.options.contracts = [...Array.from({ length: 1200 }, (_value, index) => quote("Call", index + 1)),
            ...Array.from({ length: putCount }, (_value, index) => quote("Put", putCount === 3 ? 899 + index : index + 1))];
        expect(Strategies.render(book, data).quoteRows).toBe(1000);
        const sheet = sheets.get("CF Strategies"), rows = sheet.getRange("A56:G1055").getValues();
        expect(rows.filter(row => row[0] === "Call")).toHaveLength(expectedCalls);
        expect(rows.filter(row => row[0] === "Put")).toHaveLength(expectedPuts);
        for (const type of ["Call", "Put"]) expect(rows.some(row => row[0] === type && row[1] === 900)).toBe(true);
        expect(sheet.getRange("T5:Y8").getValues().map(row => row.slice(0, 5))).toEqual([
            ["Covered call", "N/A", "N/A", 900, 3], ["Cash-secured put", "N/A", "N/A", 900, 3],
            ["Call vertical", 900, 4, 901, 3], ["Put vertical", 900, 4, 899, 3]
        ]);
        const calls = rows.filter(row => row[0] === "Call").map(row => row[1]);
        expect(calls).toEqual([...calls].sort((a, b) => a - b));
        expect(Math.min(...calls)).toBeGreaterThan(1); // The cap must preserve near-ATM strikes instead of the first 1000 strikes.
    });
    it("preserves actual zero bids and converts Date expiration in the spreadsheet time zone", () => {
        const data = snapshot(); data.options.contracts[0].bid = 0;
        const date = new Date("2026-11-19T15:00:00.000Z"); sheets.get("CF Options").getRange("B4").setValue(date);
        book.getSpreadsheetTimeZone = () => "Asia/Tokyo"; vi.stubGlobal("Utilities", { formatDate: vi.fn(() => "2026-11-20") });
        expect(Strategies.render(book, data).quoteRows).toBe(4); expect(sheets.get("CF Strategies").getRange("X5").getValue()).toBe(0);
        expect(Utilities.formatDate).toHaveBeenCalledWith(date, "Asia/Tokyo", "yyyy-MM-dd");
    });
    it("removes all old quotes, payoffs and charts on ticker/expiry invalidation", () => {
        Strategies.render(book, snapshot()); const sheet = sheets.get("CF Strategies");
        Strategies.invalidate(book, "Ticker changed. Refresh the selected ticker.");
        expect(sheet.getRange("B4").getValue()).toBe(""); expect(sheet.getRange("A56").getValue()).toBe(""); expect(sheet.charts).toEqual([]);
        expect(sheet.getRange("Z1").getValue()).toBe("CACHEFINANCE_STRATEGIES_V1"); expect(sheet.getRange("A1").getValue()).toContain("'CF Analysis'!$B$4");
        expect(sheet.getRange("A2").getValue()).toContain("Ticker changed");
        expect(Strategies.inspect(book)).toMatchObject({ present: true, quoteRows: 0, chartTitles: [], formulaErrors: [] });
    });
    it("inspects quote counts and real formula errors without treating NA chart gaps as defects", () => {
        expect(Strategies.inspect(book)).toEqual({ present: false }); Strategies.render(book, snapshot()); const sheet = sheets.get("CF Strategies");
        sheet.getRange("E4").setValue("#REF!"); sheet.getRange("B25").setValue("#N/A");
        const result = Strategies.inspect(book); expect(result.quoteRows).toBe(4); expect(result.formulaErrors).toHaveLength(1); expect(result.formulaErrors[0].value).toBe("#REF!");
    });
});
