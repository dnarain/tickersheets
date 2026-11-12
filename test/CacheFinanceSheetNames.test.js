import { afterEach, describe, expect, it, vi } from "vitest";
import { CFWorkbookNames as Names, CFUpgradeSheetNames } from "../src/CacheFinanceSheetNames.js";
import { CFAnalysisSheets } from "../src/CacheFinanceAnalysisSheets.js";
import { ManagedBook } from "./helpers/ManagedSheetMock.js";

const pairs = [
    ...["Analysis", "Price history", "Fundamentals", "Earnings", "Options", "Macro", "Sources"].map(name => ["CF " + name, name, "CACHEFINANCE_ANALYSIS_V1"]),
    ["CF Research", "Research", "CACHEFINANCE_RESEARCH_V1"],
    ["CF Strategies", "Strategies", "CACHEFINANCE_STRATEGIES_V1"],
    ["CF Watchlist", "Watchlist", "CACHEFINANCE_WATCHLIST_V1"],
    ["CF Journal", "Journal", "CACHEFINANCE_JOURNAL_V1"],
    ["CF Formulas", "Formulas", "CACHEFINANCE_FUNCTIONS_V1"],
    ["CF Images", "Chart links", "CACHEFINANCE_IMAGES_V1"],
    ["CF Lookup tests", "Lookup tests", "CACHEFINANCE_LOOKUP_CHECKS_V1"],
    ...["Provider tests", "Worksheet tests", "Test report"].map(name => ["CF " + name, name, "CacheFinance provider diagnostics v1", "A1"])
];
function owned(book, name, marker, markerCell = "Z1") {
    const sheet = book.insertSheet(name); sheet.getRange(markerCell).setValue(marker); return sheet;
}
const before = book => [...book.sheets].map(([name, sheet]) => [name, sheet, [...sheet.cells], [...sheet.formulas], [...sheet.events]]);
afterEach(() => vi.unstubAllGlobals());

describe("managed tab name upgrade", () => {
    it("renames all owned tabs while preserving sheet IDs, cells, custom formulas, journal rows and charts", () => {
        const book = new ManagedBook(), originals = [];
        for (const [from, to, marker, markerCell] of pairs) {
            const sheet = owned(book, from, marker, markerCell), chart = { chartId: sheet.getSheetId() + 100 };
            sheet.getRange("B4").setValue(from === "CF Analysis" ? "AVGO" : from === "CF Options" ? "2027-01-15" : "User input");
            sheet.getRange("A8:D8").setValues([["AVGO", "2026-11-12", 352.5, "Preserve this journal entry"]]);
            sheet.getRange("K12").setFormula("=SUM(A20:A25)"); sheet.charts = [chart];
            originals.push({ from, to, sheet, id: sheet.getSheetId(), chart, cells: [...sheet.cells], formulas: [...sheet.formulas] });
        }
        const notes = book.insertSheet("My notes"); notes.getRange("A1").setValue("Private notes");
        const result = Names.migrate(book);
        expect(result).toEqual({ ok: true, renamed: pairs.map(([from, to]) => ({ from, to })) });
        for (const entry of originals) {
            expect(book.getSheetByName(entry.from)).toBeNull(); expect(book.getSheetByName(entry.to)).toBe(entry.sheet);
            expect(entry.sheet.getSheetId()).toBe(entry.id); expect(entry.sheet.charts[0]).toBe(entry.chart);
            expect([...entry.sheet.cells]).toEqual(entry.cells); expect([...entry.sheet.formulas]).toEqual(entry.formulas);
            expect(entry.sheet.events.filter(row => row.kind === "rename")).toHaveLength(1);
        }
        expect(book.getSheetByName("My notes")).toBe(notes); expect(notes.getRange("A1").getValue()).toBe("Private notes");
        const unchanged = before(book); expect(Names.migrate(book)).toEqual({ ok: true, renamed: [] }); expect(before(book)).toEqual(unchanged);
    });

    it("checks a conflict in the last mapped pair before renaming the first valid tab", () => {
        const book = new ManagedBook(); owned(book, "CF Analysis", "CACHEFINANCE_ANALYSIS_V1");
        owned(book, "CF Test report", "CacheFinance provider diagnostics v1", "A1");
        owned(book, "Test report", "CacheFinance provider diagnostics v1", "A1");
        const unchanged = before(book);
        expect(() => Names.migrate(book)).toThrow("Both CF Test report and Test report tabs exist");
        expect(before(book)).toEqual(unchanged); expect(book.getSheetByName("Analysis")).toBeNull();
    });

    it.each([["CF Journal", "Z1"], ["Journal", "Z1"], ["CF Test report", "A1"], ["Test report", "A1"]])
    ("refuses an unmarked %s tab before any other rename", (name, markerCell) => {
        const book = new ManagedBook(); owned(book, "CF Analysis", "CACHEFINANCE_ANALYSIS_V1");
        book.insertSheet(name).getRange(markerCell).setValue("User content"); const unchanged = before(book);
        expect(() => Names.migrate(book)).toThrow("The existing " + name + " tab is not managed by Single Stock Analysis");
        expect(before(book)).toEqual(unchanged);
    });

    it("rejects the wrong ownership marker even when another managed tab uses that marker", () => {
        const book = new ManagedBook(); owned(book, "CF Research", "CACHEFINANCE_ANALYSIS_V1"); const unchanged = before(book);
        expect(() => Names.migrate(book)).toThrow(/not managed by Single Stock Analysis/); expect(before(book)).toEqual(unchanged);
    });

    it("leaves an empty workbook and unrelated tabs unchanged", () => {
        const book = new ManagedBook(); expect(Names.migrate(book)).toEqual({ ok: true, renamed: [] });
        const notes = book.insertSheet("Notes"); notes.getRange("A1").setValue("Keep"); const unchanged = before(book);
        expect(Names.migrate(book)).toEqual({ ok: true, renamed: [] }); expect(before(book)).toEqual(unchanged);
    });

    it("migrates existing analysis inputs before readInput looks up the new names", () => {
        const book = new ManagedBook(), marker = "CACHEFINANCE_ANALYSIS_V1";
        owned(book, "CF Analysis", marker).getRange("B4").setValue("AVGO");
        owned(book, "CF Options", marker).getRange("B4").setValue("2027-01-15");
        owned(book, "CF Sources", marker).getRange("B3").setValue("AVGO");
        expect(CFAnalysisSheets.readInput(book)).toEqual({ ticker: "AVGO", expiration: "2027-01-15", loadedTicker: "AVGO" });
    });

    it("updates written tab references only on owned tabs and skips actual formulas and ordinary values", () => {
        const book = new ManagedBook(), main = owned(book, "CF Analysis", "CACHEFINANCE_ANALYSIS_V1");
        const formulas = owned(book, "CF Formulas", "CACHEFINANCE_FUNCTIONS_V1"), notes = book.insertSheet("My notes");
        main.getRange("H4").setValue("See CF Sources; choose CF Options!B4."); main.getRange("B4").setValue("AVGO");
        formulas.getRange("A2").setValue("The ticker follows CF Analysis!B4.");
        formulas.getRange("B8").setFormula("='CF Analysis'!B4");
        formulas.getRange("C8").setValue("='CF Analysis'!B4"); formulas.getRange("C9").setValue("+CF Analysis");
        formulas.getRange("C10").setValue("-CF Analysis"); formulas.getRange("C11").setValue("@CF Analysis");
        formulas.getRange("D8").setValue(352.5); notes.getRange("A1").setValue("Keep CF Analysis in my own notes");
        Names.migrate(book);
        expect(main.getRange("H4").getValue()).toBe("See Sources; choose Options!B4."); expect(main.getRange("B4").getValue()).toBe("AVGO");
        expect(formulas.getRange("A2").getValue()).toBe("The ticker follows Analysis!B4.");
        expect(formulas.getRange("B8").getFormula()).toBe("='CF Analysis'!B4");
        // The mock does not emulate Google's automatic formula-reference update during Sheet.setName.
        expect(formulas.events.filter(row => row.kind === "value" && row.row === 8 && row.col === 2)).toHaveLength(1);
        expect(formulas.getRange("C8").getValue()).toBe("'='Analysis'!B4");
        expect(formulas.getRange("C9:C11").getValues()).toEqual([["'+Analysis"], ["'-Analysis"], ["'@Analysis"]]);
        expect(formulas.getRange("D8").getValue()).toBe(352.5); expect(notes.getRange("A1").getValue()).toBe("Keep CF Analysis in my own notes");
    });

    it("exposes a manual upgrade that logs only renamed tab names and makes no requests", () => {
        const book = new ManagedBook(); owned(book, "CF Analysis", "CACHEFINANCE_ANALYSIS_V1").getRange("B4").setValue("Private cell content");
        const fetch = vi.fn(), getProperties = vi.fn(), log = vi.spyOn(console, "log").mockImplementation(() => {});
        vi.stubGlobal("SpreadsheetApp", { getActiveSpreadsheet: () => book }); vi.stubGlobal("UrlFetchApp", { fetch });
        vi.stubGlobal("PropertiesService", { getScriptProperties: getProperties });
        try {
            expect(CFUpgradeSheetNames()).toEqual({ ok: true, renamed: [{ from: "CF Analysis", to: "Analysis" }] });
            expect(fetch).not.toHaveBeenCalled(); expect(getProperties).not.toHaveBeenCalled();
            expect(log).toHaveBeenCalledWith('CF_SHEET_NAMES {"ok":true,"renamed":[{"from":"CF Analysis","to":"Analysis"}]}');
        } finally { log.mockRestore(); }
    });

    it("refreshes old help labels on already-renamed tabs without resetting inputs or actual formulas", () => {
        const book = new ManagedBook(), marker = "CACHEFINANCE_ANALYSIS_V1";
        const main = owned(book, "Analysis", marker), options = owned(book, "Options", marker);
        const formulas = owned(book, "Formulas", "CACHEFINANCE_FUNCTIONS_V1"), journal = owned(book, "Journal", "CACHEFINANCE_JOURNAL_V1");
        main.getRange("B4").setValue("AVGO"); options.getRange("B4").setValue("2027-01-15");
        main.getRange("H4").setValue("Choose CacheFinance → API keys…");
        formulas.getRange("A2").setValue("Use the CacheFinance menu; the ticker follows CF Analysis!B4.");
        formulas.getRange("B8").setFormula('="CacheFinance menu"');
        journal.getRange("A8:C8").setValues([["AVGO", 352.5, "Keep this journal row"]]);
        const chart = { chartId: 321 }; main.charts = [chart];
        expect(Names.migrate(book)).toEqual({ ok: true, renamed: [] });
        expect(main.getRange("H4").getValue()).toBe("Choose CacheFinance → API keys…");
        const log = vi.spyOn(console, "log").mockImplementation(() => {});
        vi.stubGlobal("SpreadsheetApp", { getActiveSpreadsheet: () => book });
        try {
            expect(CFUpgradeSheetNames()).toEqual({ ok: true, renamed: [] });
            expect(main.getRange("H4").getValue()).toBe("Choose Data settings → API keys…");
            expect(formulas.getRange("A2").getValue()).toBe("Use the Data settings menu; the ticker follows Analysis!B4.");
            expect(formulas.getRange("B8").getFormula()).toBe('="CacheFinance menu"');
            expect(main.getRange("B4").getValue()).toBe("AVGO"); expect(options.getRange("B4").getValue()).toBe("2027-01-15");
            expect(journal.getRange("A8:C8").getValues()).toEqual([["AVGO", 352.5, "Keep this journal row"]]); expect(main.charts[0]).toBe(chart);
            const unchanged = before(book); expect(Names.migrate(book, true)).toEqual({ ok: true, renamed: [] }); expect(before(book)).toEqual(unchanged);
        } finally { log.mockRestore(); }
    });

    it.each([null, undefined, {}])("rejects a missing workbook before any operation", book => {
        expect(() => Names.migrate(book)).toThrow(/Open the spreadsheet/);
    });
});
