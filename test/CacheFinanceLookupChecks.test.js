import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CFLookupChecks as C, CFBuildLookupChecks, CFInspectLookupChecks } from "../src/CacheFinanceLookupChecks.js";
import { ManagedBook } from "./helpers/ManagedSheetMock.js";

class LookupBook extends ManagedBook {
    insertSheet(name) {
        const sheet = super.insertSheet(name), original = sheet.getRange.bind(sheet);
        sheet.getRange = (...args) => {
            const range = original(...args);
            range.getFormula = () => sheet.formulas.get(range.row + ":" + range.col) || "";
            return range;
        };
        return sheet;
    }
}
const makeFred = (value = 4.25) => [["Date", "Value", "Unit", "Series", "Source"], ...Array.from({ length: 30 }, (_, i) => [new Date(Date.UTC(2026, 9, 13 + i)).toISOString().slice(0, 10), value, "Percent", "DGS10", "https://fred.stlouisfed.org/series/DGS10"])];
const rsiLine = () => [55, 95, 110, 101, "N/A", "N/A", 100, 95, 105, 0, 100, 40];
function counterparts() {
    return {
        rsi: vi.fn((_ticker, _low, _high, field) => field === "headers" ? [C.headers()] : field === "all" ? [C.headers(), rsiLine()] : ({ rsi2: 55, buy_target: 95, sell_target: 110 })[field]),
        fredValue: vi.fn((_series, date) => date === "2026-11-05" ? 4.25 : date === "2026-02-30" ? "N/A: Use a date-valued cell or a valid YYYY-MM-DD date." : "N/A: FRED has no observation on " + date + "."),
        fred: vi.fn(() => makeFred())
    };
}
function storeComputed(sheet, definition, value) {
    const range = sheet.getRange(definition.range), matrix = range.height === 1 && range.width === 1 ? [[value]] : value;
    for (let r = 0; r < range.height; r++) for (let c = 0; c < range.width; c++) sheet.cells.set((range.row + r) + ":" + (range.col + c), matrix?.[r]?.[c] ?? "");
}
function populate(book, calls) {
    const sheet = book.getSheetByName(C.name());
    for (const row of C.cases()) {
        let value;
        if (["rsi", "target", "rsiAll", "headers"].includes(row.kind)) value = calls.rsi(row.ticker, 20, 80, row.field, 1);
        else if (["fred", "negative", "invalidDate"].includes(row.kind)) value = calls.fredValue(row.series || "DGS10", row.date, 1);
        else if (row.kind === "fredRecent") value = calls.fred("DGS10", 30, 1);
        else value = row.kind === "compare" ? true : 4.25;
        storeComputed(sheet, row, value);
    }
    Object.values(calls).forEach(fn => fn.mockClear());
    return sheet;
}
const definition = id => C.cases().find(row => row.id === id);
const result = (report, id) => report.cases.find(row => row.id === id);
let book, calls, log;
beforeEach(() => { book = new LookupBook(); calls = counterparts(); log = vi.spyOn(console, "log").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("lookup worksheet builder", () => {
    it("builds actual formulas and separated spills with a marker and pending statuses", () => {
        expect(C.build(book)).toMatchObject({ ok: true, cases: 18, refresh: 1, status: "PENDING" });
        const sheet = book.getSheetByName(C.name()); expect(sheet.getRange("Z1").getValue()).toBe(C.marker()); expect(sheet.hiddenColumn).toBe(26); expect(sheet.frozenRows).toBe(7); expect(sheet.frozenColumns).toBe(0);
        for (const row of C.cases()) {
            expect(sheet.getRange(row.anchor).getFormula()).toBe(row.formula);
            expect(sheet.getRange(row.row, 5).getValue()).toBe("PENDING"); expect(sheet.getRange(row.row, 7).getValue()).toBe("'" + row.formula);
            if (row.range !== "D" + row.row) expect(sheet.getRange(row.row, 4).getValue()).toBe(row.range);
        }
        expect(sheet.getRange("A45").getFormula()).toContain('CFRSITARGETS("NVDA"'); expect(sheet.getRange("A50").getFormula()).toContain('CFRSITARGETS("AAPL"'); expect(sheet.getRange("A55").getFormula()).toContain('"headers"');
        expect(sheet.getRange("N60").getFormula()).toBe('=CFFRED("DGS10",30,$B$4)');
        expect(sheet.getRange(definition("fred_date").anchor).getFormula()).toContain("DATE(2026,11,5)");
        expect(C.cases().every(row => /^(?:rsi_|fred_)/.test(row.id))).toBe(true);
    });
    it("preserves other worksheets and refuses a same-named foreign sheet before changing it", () => {
        const notes = book.insertSheet("Notes"); notes.getRange("A1").setValue("Keep");
        const foreign = book.insertSheet(C.name()); foreign.getRange("A1").setValue("User data"); const events = [...foreign.events];
        expect(() => C.build(book)).toThrow(/Rename/); expect(foreign.events).toEqual(events); expect(notes.getRange("A1").getValue()).toBe("Keep");
        expect(() => C.inspect(book, calls)).toThrow(/Rename/);
    });
    it("increments the refresh input and removes old results only in its marked tab", () => {
        C.build(book); const sheet = populate(book, calls); sheet.getRange("A95").setValue("Old");
        sheet.getRange("A26:G28").setValue("Previous checks"); sheet.getRange("D26").setFormula('="Previous formula"'); C.build(book);
        expect(sheet.getRange("B4").getValue()).toBe(2); expect(sheet.getRange("A95").getValue()).toBe(""); expect(sheet.getRange(definition("fred_iso").row, 5).getValue()).toBe("PENDING");
        expect(sheet.getRange("A26:G28").getValues().flat().every(value => value === "")).toBe(true); expect(sheet.getRange("D26").getFormula()).toBe("");
    });
    it.each([-1, 1.5, "2", true, 2147483647])("resets malformed or exhausted saved refresh input (%s)", value => {
        C.build(book); book.getSheetByName(C.name()).getRange("B4").setValue(value); expect(C.build(book).refresh).toBe(1);
    });
    it("formats reference dates as text before writing the table formula", () => {
        C.build(book); const sheet = book.getSheetByName(C.name()); expect(sheet.formatAt(61, 14)).toBe("@");
        expect(sheet.formatAt(61, 15)).toBe("0.00000000");
        const format = sheet.events.findIndex(event => event.kind === "format" && event.row === 60 && event.col === 14 && event.value === "@");
        const formula = sheet.events.findIndex(event => event.kind === "value" && event.row === 60 && event.col === 14 && event.value.startsWith("=CFFRED"));
        expect(format).toBeLessThan(formula);
    });
    it("grows a short owned test sheet and requires an active spreadsheet", () => {
        const sheet = book.insertSheet(C.name()); sheet.getRange("Z1").setValue(C.marker()); sheet.maxRows = 80; sheet.maxCols = 20;
        C.build(book); expect(sheet.maxRows).toBe(100); expect(sheet.maxCols).toBe(26); expect(() => C.build(null)).toThrow(/Open the spreadsheet/);
    });
});

describe("typed native-result classification", () => {
    it("passes all 18 completed cases and records formula, values, statuses and reasons", () => {
        C.build(book); const sheet = populate(book, calls); const report = C.inspect(book, calls);
        expect(report).toMatchObject({ ok: true, completed: true, counts: { PASS: 18, FAIL: 0, BLOCKED: 0, PENDING: 0 } });
        expect(report.cases.every(row => row.formula.startsWith("=") && row.status === "PASS" && row.reason)).toBe(true);
        expect(result(report, "fred_recent").actual).toMatchObject({ rows: 30, requestedDateRows: [["2026-11-05", 4.25, "Percent", "DGS10", "https://fred.stlouisfed.org/series/DGS10"]] });
        expect(sheet.getRange("E4").getValue()).toBeInstanceOf(Date);
        expect(log.mock.calls.at(-1)[0]).toMatch(/^CF_LOOKUP_CHECKS /); expect(log.mock.calls.at(-1)[0].length).toBeLessThan(8500);
    });
    it("keeps uncalculated formulas pending and does not call providers through counterparts", () => {
        C.build(book); const report = C.inspect(book, calls); expect(report.counts.PENDING).toBe(18); expect(report.ok).toBe(false); expect(report.completed).toBe(false);
        Object.values(calls).forEach(fn => expect(fn).not.toHaveBeenCalled());
    });
    it.each(["Loading...", "Calculating", "", null])("keeps unfinished scalar results pending (%s)", value => {
        C.build(book); const sheet = populate(book, calls); storeComputed(sheet, definition("rsi_nvda_rsi2"), value);
        expect(result(C.inspect(book, calls), "rsi_nvda_rsi2").status).toBe("PENDING");
    });
    it.each(["N/A: HTTP 403", "N/A: Blocked"])("keeps blocked FRED access out of passing exact-date results (%s)", value => {
        C.build(book); const sheet = populate(book, calls); storeComputed(sheet, definition("fred_iso"), value);
        const report = C.inspect(book, calls); expect(result(report, "fred_iso").status).toBe("BLOCKED"); expect(result(report, "fred_date_match").status).toBe("BLOCKED"); expect(report.ok).toBe(false);
    });
    it("never counts a missing FRED key as a successful expected-N/A case", () => {
        C.build(book); const sheet = populate(book, calls);
        for (const row of C.cases().filter(row => ["fred", "negative", "fredRecent"].includes(row.kind))) storeComputed(sheet, row, row.kind === "fredRecent" ? [["N/A: FRED API key required. Use the CacheFinance menu."]] : "N/A: FRED API key required. Use the CacheFinance menu.");
        const report = C.inspect(book, calls);
        for (const id of ["fred_iso", "fred_date", "fred_recent", "fred_weekend", "fred_monthly_nonperiod", "fred_reference", "fred_date_match", "fred_reference_match"]) expect(result(report, id).status).toBe("BLOCKED");
        expect(result(report, "fred_invalid_date").status).toBe("PASS");
    });
    it("rejects unrelated N/A errors for no-observation and invalid-date tests", () => {
        C.build(book); const sheet = populate(book, calls); storeComputed(sheet, definition("fred_weekend"), "N/A: Unsupported provider field"); storeComputed(sheet, definition("fred_invalid_date"), "N/A");
        const report = C.inspect(book, calls); expect(result(report, "fred_weekend").status).toBe("FAIL"); expect(result(report, "fred_invalid_date").status).toBe("FAIL");
    });
    it.each(["#REF!", "#VALUE!", "#ERROR!", "#N/A", "#NAME?"])("records native formula errors as failures (%s)", value => {
        C.build(book); const sheet = populate(book, calls); storeComputed(sheet, definition("rsi_nvda_rsi2"), value);
        expect(result(C.inspect(book, calls), "rsi_nvda_rsi2").status).toBe("FAIL");
    });
    it.each(["55", -1, 101, true, NaN, Infinity])("rejects nonnumeric or out-of-range RSI (%s)", value => {
        C.build(book); const sheet = populate(book, calls); storeComputed(sheet, definition("rsi_nvda_rsi2"), value); expect(result(C.inspect(book, calls), "rsi_nvda_rsi2").status).toBe("FAIL");
    });
    it("accepts a justified unavailable target and rejects a fabricated zero target", () => {
        C.build(book); const sheet = populate(book, calls); const original = calls.rsi.getMockImplementation();
        calls.rsi.mockImplementation((...args) => args[3] === "buy_target" ? "N/A" : original(...args));
        storeComputed(sheet, definition("rsi_nvda_buy_target"), "N/A"); storeComputed(sheet, definition("rsi_aapl_buy_target"), 0);
        const report = C.inspect(book, calls); expect(result(report, "rsi_nvda_buy_target").status).toBe("PASS"); expect(result(report, "rsi_aapl_buy_target").status).toBe("FAIL");
    });
    it("detects a direct counterpart mismatch without treating it as financial reconciliation", () => {
        C.build(book); populate(book, calls); calls.rsi.mockImplementation(() => 66); const report = C.inspect(book, calls);
        expect(result(report, "rsi_nvda_rsi2")).toMatchObject({ status: "FAIL", reason: expect.stringContaining("direct function counterpart") }); expect(report.scope).toMatch(/No independent/);
    });
    it("keeps direct-call provider failures blocked even if an older worksheet value is numeric", () => {
        C.build(book); populate(book, calls); calls.fredValue.mockReturnValue("N/A: FRED exact-date observation unavailable.");
        expect(result(C.inspect(book, calls), "fred_iso").status).toBe("BLOCKED");
    });
    it("checks spill headers and value types rather than counting a populated anchor as a pass", () => {
        C.build(book); const sheet = populate(book, calls); const bad = [C.headers(), rsiLine()]; bad[1][3] = 0; storeComputed(sheet, definition("rsi_nvda_all"), bad);
        const headers = [C.headers()]; headers[0][0] = "Wrong"; storeComputed(sheet, definition("rsi_headers"), headers);
        const report = C.inspect(book, calls); expect(result(report, "rsi_nvda_all").status).toBe("FAIL"); expect(result(report, "rsi_headers").status).toBe("FAIL");
    });
    it("keeps an unpopulated RSI value row pending", () => {
        C.build(book); const sheet = populate(book, calls); storeComputed(sheet, definition("rsi_nvda_all"), [C.headers(), Array(12).fill("")]);
        expect(result(C.inspect(book, calls), "rsi_nvda_all").status).toBe("PENDING");
    });
    it("marks a completed unavailable RSI spill as failed, rather than indefinitely pending", () => {
        C.build(book); const sheet = populate(book, calls); storeComputed(sheet, definition("rsi_nvda_all"), [["N/A: A completed prior close is missing or invalid"]]);
        expect(result(C.inspect(book, calls), "rsi_nvda_all").status).toBe("FAIL");
        const headers = C.headers(); headers[0] = "Wrong"; storeComputed(sheet, definition("rsi_nvda_all"), [headers, Array(12).fill("")]);
        expect(result(C.inspect(book, calls), "rsi_nvda_all").status).toBe("FAIL");
    });
    it("detects a wrong FRED reference date and blocks comparison passes when inputs fail", () => {
        C.build(book); const sheet = populate(book, calls); const table = makeFred(); table.find(line => line[0] === "2026-11-05")[0] = "2026-11-04"; storeComputed(sheet, definition("fred_recent"), table);
        const report = C.inspect(book, calls); expect(result(report, "fred_reference").status).toBe("FAIL"); expect(result(report, "fred_reference_match").status).toBe("FAIL");
    });
    it("requires exact typed boolean comparisons, not truthy text", () => {
        C.build(book); const sheet = populate(book, calls); storeComputed(sheet, definition("fred_date_match"), "TRUE");
        expect(result(C.inspect(book, calls), "fred_date_match").status).toBe("FAIL");
    });
    it.each(["2026-02-30", "2026-99-99", "2026-1-25", 46317, new Date("2026-01-25T00:00:00Z")])("requires valid ISO text dates in the reference table (%s)", value => {
        C.build(book); const sheet = populate(book, calls), table = makeFred(); table[1][0] = value; storeComputed(sheet, definition("fred_recent"), table);
        expect(result(C.inspect(book, calls), "fred_recent").status).toBe("FAIL");
    });
    it("does not log an edited formula cell's arbitrary contents", () => {
        C.build(book); const sheet = populate(book, calls), row = definition("fred_iso"); sheet.formulas.delete(row.row + ":4"); storeComputed(sheet, row, "not-public-user-content");
        const report = C.inspect(book, calls); expect(result(report, "fred_iso")).toMatchObject({ status: "FAIL", actual: "[Not recorded: formula changed]" }); expect(JSON.stringify(report)).not.toContain("not-public-user-content");
    });
    it("returns a clear failure if a typed counterpart throws", () => {
        C.build(book); populate(book, calls); calls.rsi.mockImplementation(() => { throw new Error("private provider exception"); }); const report = C.inspect(book, calls);
        expect(result(report, "rsi_nvda_rsi2").status).toBe("FAIL"); expect(JSON.stringify(report)).not.toContain("private provider exception");
    });
    it("requires a marked test tab and sanitizes unexpected public result details", () => {
        expect(() => C.inspect(book, calls)).toThrow(/Build CF Lookup tests/);
        expect(C.safe_({ nested: [NaN, new Date("bad"), "https://example.test?api_key=private-value&x=1"] })).toEqual({ nested: ["NaN", "Invalid date", "https://example.test?api_key=[redacted]&x=1"] });
    });
    it("binds the public build and inspect functions to the active spreadsheet", () => {
        vi.stubGlobal("SpreadsheetApp", { getActiveSpreadsheet: () => book }); expect(CFBuildLookupChecks().ok).toBe(true);
        expect(CFInspectLookupChecks().counts.PENDING).toBe(18);
    });
});
