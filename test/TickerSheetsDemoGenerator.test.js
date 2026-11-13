import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TickerSheetsDemoGenerator, TickerSheetsBuildDemo } from "../src/demo/TickerSheetsDemoGenerator.js";
import { onOpen, TickerSheetsRefreshData } from "../src/TickerSheetsMenu.js";
import { TickerSheetsMenu } from "../src/TickerSheetsSettings.js";
import { tutorialBook } from "./helpers/TickerSheetsDemoMock.js";


let book, api, fetch, keyRead, menus, flush;
beforeEach(() => {
    book = tutorialBook(); menus = [];
    fetch = vi.fn(() => { throw new Error("Demo code attempted a provider request"); });
    keyRead = vi.fn(() => { throw new Error("Demo code attempted to read private keys"); });
    flush = vi.fn();
    const ui = { createMenu: name => {
        const menu = { name, items: [], addItem(label, callback) { this.items.push([label, callback]); return this; }, addToUi() { menus.push(this); return this; } };
        return menu;
    } };
    const cache = new Map();
    const context = {
        console: { log: vi.fn() },
        UrlFetchApp: { fetch }, PropertiesService: { getScriptProperties: keyRead },
        CacheService: { getScriptCache: () => ({ get: key => cache.get(key) ?? null, put: (key, value) => cache.set(key, value) }) },
        Utilities: { formatDate: () => "2026-11-12" },
        SpreadsheetApp: { getActiveSpreadsheet: () => book, getUi: () => ui, flush },
        Charts: { ChartType: { LINE: "LINE", COLUMN: "COLUMN", COMBO: "COMBO" } }
    };
    Object.entries(context).forEach(([key, value]) => vi.stubGlobal(key, value));
    vi.stubGlobal("TickerSheetsMenu", TickerSheetsMenu);
    api = { T: TickerSheetsDemoGenerator, TickerSheetsBuildDemo, TickerSheetsRefreshData, onOpen,
        externalMarkers: () => ({ Analysis: "OTHER_ANALYSIS", Options: "OTHER_OPTIONS" }) };
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function formulasIn(sheet) { return [...sheet.formulas].sort(([a], [b]) => a.localeCompare(b)); }
function noProviderOrKeyAccess() { expect(fetch).not.toHaveBeenCalled(); expect(keyRead).not.toHaveBeenCalled(); }

describe("three-tab demo, imported Apps Script source", () => {
    it("creates Start here, Stock analysis and Options analysis and teaches direct scalar formulas beside their formula text", () => {
        api.TickerSheetsBuildDemo();
        expect([...book.sheets.keys()]).toEqual(["Start here", "Stock analysis", "Options analysis"]);
        const sheet = book.getSheetByName("Start here");
        expect(sheet.getRange("Z1").getValue()).toBe("TICKERSHEETS_GUIDE_V1");
        expect(sheet.getRange("Z2").getValue()).toBe("TICKERSHEETS_TUTORIAL_V1");
        expect(sheet.getRange("B4").getValue()).toBe("NVDA");
        const expected = [
            '=TICKERSHEETS_QUOTE($B$4,"price")', '=TICKERSHEETS_QUOTE($B$4,"regular_price")', '=TICKERSHEETS_QUOTE($B$4,"post_market_price")',
            '=TICKERSHEETS_QUOTE($B$4,"price_session")', '=TICKERSHEETS_QUOTE($B$4,"quote_time")',
            '=TICKERSHEETS_FUNDAMENTALS($B$4,"trailing_pe")', '=TICKERSHEETS_FUNDAMENTALS($B$4,"eps_ttm")',
            '=TICKERSHEETS_FUNDAMENTALS($B$4,"dividend_yield")', '=TICKERSHEETS_FUNDAMENTALS($B$4,"earnings_date")'
        ];
        expect(sheet.getRange("B7:B15").getFormulas().flat()).toEqual(expected);
        expect(sheet.getRange("C7:C15").getFormulas().flat()).toEqual(expected.map((_, index) => "=FORMULATEXT(B" + (index + 7) + ")"));
        expect(sheet.getRange("B30:B34").getFormulas().flat()).toEqual(Array(5).fill(""));
        expect(sheet.getRange("C30:C34").getFormulas().flat()).toEqual(Array(5).fill(""));
        expect(sheet.getRange("C30:C34").getValues().flat().every(value => value.startsWith("'="))).toBe(true);
        expect(sheet.getRange("C35").getValue()).toBe('\'=TICKERSHEETS_PROVIDER_QUOTE($B$4,"FINNHUB","price")');
        expect(sheet.getRange("C35").getFormula()).toBe("");
        expect(sheet.hideSheet).not.toHaveBeenCalled();
        noProviderOrKeyAccess();
    });

    it("links every example tab to the repository and preserves those links during refresh", () => {
        api.TickerSheetsBuildDemo();
        const guide = book.getSheetByName("Start here"), stock = book.getSheetByName("Stock analysis"), options = book.getSheetByName("Options analysis");
        const expected = [
            [guide, "A3", '=HYPERLINK("https://github.com/dnarain/tickersheets","TickerSheets on GitHub — code, guide and updates")'],
            [stock, "G4", '=HYPERLINK("https://github.com/dnarain/tickersheets","TickerSheets on GitHub")'],
            [options, "G4", '=HYPERLINK("https://github.com/dnarain/tickersheets","TickerSheets on GitHub")']
        ];
        for (const [sheet, cell, formula] of expected) expect(sheet.getRange(cell).getFormula()).toBe(formula);
        expect(stock.getRange("E4").getValue()).toBe("2026-11-12");
        expect(stock.getRange("B4").getFormula()).toBe("='Start here'!B4");
        expect(options.getRange("B4").getFormula()).toBe("='Start here'!B4");
        api.TickerSheetsRefreshData();
        for (const [sheet, cell, formula] of expected) expect(sheet.getRange(cell).getFormula()).toBe(formula);
        noProviderOrKeyAccess();
    });

    it("preserves every unrelated sheet, marker and formula", () => {
        const analysis = book.insertSheet("Analysis"); analysis.getRange("Z1").setValue("OTHER_ANALYSIS"); analysis.getRange("B4").setValue("AAPL");
        const personal = book.insertSheet("My portfolio");
        personal.getRange("A1:B1").setValues([["Keep me", 123]]); personal.getRange("C1").setFormula("=B1*2");
        api.TickerSheetsBuildDemo();
        expect([...book.sheets.keys()]).toEqual(["Start here", "Stock analysis", "Options analysis", "Analysis", "My portfolio"]);
        expect(book.deleted).toEqual([]); expect(analysis.getRange("Z1").getValue()).toBe("OTHER_ANALYSIS");
        expect(analysis.getRange("B4").getValue()).toBe("AAPL"); expect(book.getSheetByName("Start here").getRange("B4").getValue()).toBe("NVDA");
        expect(personal.getRange("A1:B1").getValues()).toEqual([["Keep me", 123]]); expect(personal.getRange("C1").getFormula()).toBe("=B1*2");
        noProviderOrKeyAccess();
    });

    it("preserves an old sample name when its sheet is user-owned", () => {
        const sheet = book.insertSheet("Analysis"); sheet.getRange("B4").setValue("User-owned analysis");
        const defaultSheet = book.insertSheet("Sheet1"); defaultSheet.getRange("A1").setValue("My data");
        api.TickerSheetsBuildDemo();
        expect(book.getSheetByName("Analysis")).toBe(sheet);
        expect(sheet.getRange("B4").getValue()).toBe("User-owned analysis"); expect(book.deleted).toEqual([]);
        expect(book.getSheetByName("Sheet1")).toBe(defaultSheet); expect(defaultSheet.getRange("A1").getValue()).toBe("My data");
        noProviderOrKeyAccess();
    });

    it("preserves blank unmarked tabs and retains the ticker when rebuilding the tutorial", () => {
        const defaultSheet = book.insertSheet("Sheet1"), notes = book.insertSheet("Notes");
        notes.drawings = [{ label: "Keep this drawing" }]; notes.notes = new Map([["A1", "Keep this note"]]);
        expect(defaultSheet.getLastRow()).toBe(0); expect(notes.getLastRow()).toBe(0);
        api.TickerSheetsBuildDemo();
        const guide = book.getSheetByName("Start here"); guide.getRange("B4").setValue(" aapl ");
        api.TickerSheetsBuildDemo();
        expect([...book.sheets.keys()]).toEqual(["Start here", "Stock analysis", "Options analysis", "Sheet1", "Notes"]); expect(book.getSheetByName("Start here")).toBe(guide);
        expect(book.getSheetByName("Sheet1")).toBe(defaultSheet); expect(book.getSheetByName("Notes")).toBe(notes);
        expect(defaultSheet.events).toEqual([]); expect(notes.events).toEqual([]); expect(book.deleted).toEqual([]);
        expect(notes.drawings).toEqual([{ label: "Keep this drawing" }]); expect(notes.notes.get("A1")).toBe("Keep this note");
        expect(guide.getRange("B4").getValue()).toBe("AAPL"); noProviderOrKeyAccess();
    });

    it("rejects an unowned Start here tab before deleting or changing any old sheet", () => {
        const legacy = book.insertSheet("Options"); legacy.getRange("Z1").setValue(api.externalMarkers().Options);
        legacy.getRange("B4").setValue("2026-12-18");
        const guide = book.insertSheet("Start here"); guide.getRange("A1").setValue("My tutorial");
        const before = book.getSheets().map(sheet => ({ sheet, cells: [...sheet.cells], formulas: formulasIn(sheet), events: sheet.events.length }));
        expect(() => api.TickerSheetsBuildDemo()).toThrow(/Start here|not managed|rename/i);
        expect(book.deleted).toEqual([]);
        before.forEach(value => {
            expect(book.getSheetByName(value.sheet.getName())).toBe(value.sheet);
            expect([...value.sheet.cells]).toEqual(value.cells); expect(formulasIn(value.sheet)).toEqual(value.formulas);
            expect(value.sheet.events).toHaveLength(value.events);
        });
        noProviderOrKeyAccess();
    });

    it("authors formulas without deleted-tab references or visible refresh counters", () => {
        api.TickerSheetsBuildDemo();
        const guide = book.getSheetByName("Start here"), broken = [];
        for (const [cell, formula] of guide.formulas) {
            if (formula.includes("#REF!")) broken.push([cell, formula]);
            for (const match of formula.matchAll(/(?:'([^']+)'|([A-Za-z_]\w*))!\$?[A-Z]+\$?\d/g)) {
                if (!book.getSheetByName(match[1] || match[2])) broken.push([cell, formula]);
            }
        }
        expect(broken).toEqual([]);
        expect([...guide.cells.values()].map(String).filter(value => !value.startsWith("="))).not.toEqual(expect.arrayContaining([expect.stringMatching(/refresh\s+(?:number|counter)/i)]));
        noProviderOrKeyAccess();
    });

    it("refreshes existing formulas without creating a tutorial or any other tab", () => {
        const sheet = book.insertSheet("My research");
        sheet.getRange("A1").setValue("AAPL");
        sheet.getRange("B1").setFormula('=TICKERSHEETS_QUOTE(A1,"price")').setNumberFormat("0.00");
        sheet.getRange("C1").setFormula("=B1*2");
        sheet.getRange("D1").setFormula("=FORMULATEXT(B1)");
        sheet.getRange("E1").setFormula('=CACHEFINANCE(A1,"PRICE")');
        sheet.getRange("F1").setFormula('=CACHEFINANCES(A1:A3,"PRICE")');
        sheet.getRange("A8").setFormula('=TICKERSHEETS_HISTORY(A1,30)');
        const before = formulasIn(sheet), start = sheet.events.length;
        const dataCells = new Set(["1:2", "8:1"]);
        flush.mockImplementationOnce(() => {
            expect(formulasIn(sheet)).toEqual(before.map(([cell, formula]) => [cell, dataCells.has(cell) ? "=(" + formula.slice(1) + ")" : formula]));
        });
        expect(api.TickerSheetsRefreshData()).toEqual({ ok: true, recalculated: 2 });
        expect(flush).toHaveBeenCalledOnce();
        expect([...book.sheets.keys()]).toEqual(["My research"]); expect(book.deleted).toEqual([]);
        expect(formulasIn(sheet)).toEqual(before); expect(sheet.getRange("A1").getValue()).toBe("AAPL");
        expect(sheet.formatAt(1, 2)).toBe("0.00");
        expect(sheet.events.slice(start).filter(event => event.kind === "clearContent")).toEqual([]);
        noProviderOrKeyAccess();
    });

    it("keeps the ticker and every direct tutorial formula during refresh", () => {
        api.TickerSheetsBuildDemo();
        const guide = book.getSheetByName("Start here"); guide.getRange("B4").setValue("AAPL");
        const formulas = formulasIn(guide);
        api.TickerSheetsRefreshData();
        expect([...book.sheets.keys()]).toEqual(["Start here", "Stock analysis", "Options analysis"]); expect(guide.getRange("B4").getValue()).toBe("AAPL");
        expect(formulasIn(guide)).toEqual(formulas); noProviderOrKeyAccess();
    });

    it("restores every exact formula when Sheets fails while evaluating temporary formulas", () => {
        api.TickerSheetsBuildDemo(); const guide = book.getSheetByName("Start here"), before = formulasIn(guide), start = guide.events.length;
        const originals = guide.getRange("B7:B15").getFormulas();
        flush.mockImplementationOnce(() => {
            expect(guide.getRange("B7:B15").getFormulas()).toEqual(originals.map(([formula]) => ["=(" + formula.slice(1) + ")"]));
            throw new Error("Spreadsheet flush failed");
        });
        expect(() => api.TickerSheetsRefreshData()).toThrow("Spreadsheet flush failed");
        expect(formulasIn(guide)).toEqual(before); expect(guide.getRange("B4").getValue()).toBe("NVDA");
        expect(guide.events.slice(start).filter(event => event.kind === "clearContent")).toEqual([]);
        noProviderOrKeyAccess();
    });

    it("retains a valid temporary formula when one original formula cannot be restored", () => {
        api.TickerSheetsBuildDemo(); const guide = book.getSheetByName("Start here"), before = formulasIn(guide), start = guide.events.length;
        const original = guide.getRange("B7").getFormula(), getRange = guide.getRange.bind(guide), restoreFailure = vi.fn();
        guide.getRange = (...args) => {
            const range = getRange(...args), setFormula = range.setFormula.bind(range);
            if (range.row === 7 && range.col === 2) range.setFormula = formula => {
                if (formula === original) { restoreFailure(); throw new Error("Cell temporarily unavailable"); }
                return setFormula(formula);
            };
            return range;
        };
        expect(() => api.TickerSheetsRefreshData()).toThrow(/could not be restored/);
        expect(restoreFailure).toHaveBeenCalledOnce();
        expect(formulasIn(guide)).toEqual(before.map(([cell, formula]) => [cell, cell === "7:2" ? "=(" + original.slice(1) + ")" : formula]));
        expect(guide.getRange("B4").getValue()).toBe("NVDA");
        expect(guide.events.slice(start).filter(event => event.kind === "clearContent")).toEqual([]);
        noProviderOrKeyAccess();
    });

    it("does not create any tabs when refreshing an empty spreadsheet", () => {
        expect(api.TickerSheetsRefreshData()).toEqual({ ok: true, recalculated: 0 });
        expect(book.getSheets()).toEqual([]); noProviderOrKeyAccess();
    });

    it("opens only TickerSheets with API keys and Refresh data", () => {
        api.onOpen();
        expect(menus.map(menu => menu.name)).toEqual(["TickerSheets"]);
        expect(menus[0].items).toEqual([["API keys…", "TickerSheetsShowApiKeys"], ["Refresh data", "TickerSheetsRefreshData"]]);
        expect(book.getSheets()).toHaveLength(0); noProviderOrKeyAccess();
    });
});
