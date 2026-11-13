import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCacheFinanceBundle } from "../scripts/gas-source.mjs";
import { ManagedBook } from "./helpers/ManagedSheetMock.js";

function enhancedBook() {
    const book = new ManagedBook(), insert = book.insertSheet.bind(book);
    book.insertSheet = name => {
        const sheet = insert(name), range = sheet.getRange.bind(sheet);
        sheet.getRange = (...args) => {
            const result = range(...args);
            result.setVerticalAlignment = value => result.event("verticalAlignment", { value });
            result.setDataValidation = value => result.event("validation", { value });
            result.getDisplayValues = () => result.getValues().map(row => row.map(value => String(value)));
            return result;
        };
        sheet.charts = [];
        const builder = options => {
            const state = { options: { ...options }, ranges: [] };
            return { setChartType(value) { state.type = value; return this; }, setNumHeaders(value) { state.headers = value; return this; },
                setPosition(...value) { state.position = value; return this; }, setOption(key, value) { state.options[key] = value; return this; }, addRange(value) { state.ranges.push(value); return this; },
                build() { return { ...state, getOptions: () => ({ get: key => state.options[key] }), modify: () => builder(state.options) }; } };
        };
        sheet.newChart = () => builder({}); sheet.insertChart = chart => { sheet.charts.push(chart); return sheet; }; sheet.getCharts = () => sheet.charts;
        sheet.removeChart = chart => { sheet.charts = sheet.charts.filter(value => value !== chart); }; sheet.updateChart = () => sheet;
        sheet.setTabColor = () => sheet; sheet.showColumns = () => sheet;
        sheet.getLastColumn = () => Math.max(1, ...[...sheet.cells.keys()].map(key => Number(key.split(":")[1])));
        return sheet;
    };
    book.setActiveSheet = sheet => { book.active = sheet; return sheet; }; book.moveActiveSheet = vi.fn();
    return book;
}

let book, api, fetch, keyRead;
beforeEach(() => {
    book = enhancedBook(); fetch = vi.fn(() => { throw new Error("A builder or refresh attempted a provider request"); }); keyRead = vi.fn(() => { throw new Error("A builder or refresh read private keys"); });
    const validation = () => ({ requireValueInList() { return this; }, requireValueInRange() { return this; }, setAllowInvalid() { return this; }, build() { return {}; } });
    const context = { console: { log: vi.fn() }, UrlFetchApp: { fetch }, PropertiesService: { getScriptProperties: keyRead }, Utilities: { formatDate: () => "2026-11-12" },
        SpreadsheetApp: { getActiveSpreadsheet: () => book, newDataValidation: validation, flush: vi.fn() }, Charts: { ChartType: { LINE: "LINE", COLUMN: "COLUMN", COMBO: "COMBO" } } };
    api = vm.runInNewContext(buildCacheFinanceBundle().bundle + '\n;({ W:CFFormulaWorkbook,V:CFFormulaViews,P:CFProviderImages,CFBuildAnalysis,CFRefreshAnalysis,CFBuildWatchlist,CFRefreshWatchlist,CFBuildFormulaExamples,CFRefreshFormulaExamples,CFRecordJournalSnapshot,CFAnalysisService,buildLegacy:()=>CFFormulaWorkbook.build(SpreadsheetApp.getActiveSpreadsheet(),CFFormulaModules_()),refreshLegacy:()=>CFFormulaWorkbook.refresh(SpreadsheetApp.getActiveSpreadsheet(),CFFormulaModules_()),handleLegacyEdit:event=>CFFormulaWorkbook.handleEdit(event,CFFormulaModules_()) });', context);
});

function readyMetrics(overrides = {}) {
    const values = { status: "Available", price: 100, currency: "USD", quote_time: "2026-11-12T21:00:00.000Z", indicator_as_of: "2026-11-12",
        rsi14: 0, trailing_pe: 20, eps_ttm: 0, target_price: 120, next_earnings: "2026-11-20", atm_iv: 0.2, ...overrides };
    const rows = api.V.selectedMetrics().map(([key]) => [key, values[key] ?? "N/A"]);
    book.getSheetByName("Quote data").getRange(8, 27, rows.length, 2).setValues(rows);
}

function savedRow(time, ticker = "NVDA", currency = "USD", overrides = {}) {
    const row = Array(18).fill("N/A");
    Object.assign(row, { 0: time, 1: ticker, 2: 90, 3: currency, 6: 0, 8: 0, 9: 110, 10: "2026-11-20", 11: 0, ...overrides });
    return row;
}

describe("legacy 15-tab formula workbook, compiled Apps Script bundle", () => {
    it("rejects every reserved name before changing an owned workbook", () => {
        const sheet = book.insertSheet("Quote data"); sheet.getRange("A1").setValue("User work");
        expect(() => api.buildLegacy()).toThrow(/not managed by TickerSheets/);
        expect([...book.sheets.keys()]).toEqual(["Quote data"]); expect(sheet.getRange("A1").getValue()).toBe("User work"); expect(fetch).not.toHaveBeenCalled();
    });

    it("builds direct custom-function examples without collecting a market snapshot", () => {
        const collect = vi.spyOn(api.CFAnalysisService, "collect"); const result = api.buildLegacy();
        expect(result.mode).toBe("formulas"); expect(api.W.isFormulaBook(book)).toBe(true);
        expect(book.getSheetByName("Analysis").getRange("B9").getFormula()).toBe('=CFQUOTE($B$4,"price")');
        expect(book.getSheetByName("Analysis").getRange("E17").getFormula()).toBe('=CFFUNDAMENTALS($B$4,"trailing_pe")');
        expect(book.getSheetByName("Analysis").getRange("E18").getFormula()).toBe('=CFFUNDAMENTALS($B$4,"eps_ttm")');
        expect(book.getSheetByName("Formulas").getRange("B23").getFormula()).toBe('=CFQUOTE($B$4,"price")');
        expect(book.getSheetByName("Quote data").getRange("A7").getValue()).toBe('Field');
        expect(book.getSheetByName("Quote data").getRange("B8").getFormula()).toBe('=CFQUOTE($B$4,"price")');
        expect(book.getSheetByName("Quote data").getRange("O7").getFormula()).toBe('=CFEXPIRATIONS(Analysis!$B$4,Analysis!$Z$4,TRUE)');
        expect(book.getSheetByName("Price history").getRange("A7").getFormula()).toBe('=CFHISTORY(Analysis!$B$4,510,Analysis!$Z$4)');
        expect(book.getSheetByName("Price history").getRange("I57").getFormula()).toContain("AVERAGE($E8:$E57)");
        expect(book.getSheetByName("Formulas").getRange("E4").getFormula()).toBe("");
        expect(book.getSheetByName("Analysis").formatAt(4, 26)).toBe("0");
        expect(book.getSheetByName("Analysis").getRange("K4").getValue()).toBe("2026-11-12");
        expect(book.getSheetByName("Analysis").getRange("K4").getFormula()).toBe("");
        expect(book.getSheetByName("Options").events.some(event => event.kind === "clearDataValidations")).toBe(true);
        expect(book.getSheetByName("Formulas").formatAt(4, 5)).toBe("General");
        expect(book.getSheetByName("Start here").getRange("D14").getFormula()).toBe("=FORMULATEXT('Quote data'!B8)");
        expect(book.getSheetByName("Formulas").getRange("A45").getValue()).toBe("CFEARNINGS");
        expect(book.getSheetByName("Formulas").getRange("B30").getFormula()).toContain('INDEX(CFFRED("DGS2",1),2,2)');
        expect(book.getSheetByName("Formulas").getRange("H23").getFormula()).toBe('=CFRSITARGETS($B$4,20,80,"rsi2")');
        expect(book.getSheetByName("Quote data").getRange("AB36").getFormula()).toBe('=IF(ISNUMBER($L$71),$L$71,"N/A")');
        expect(book.getSheetByName("Analysis").getRange("E23").getFormula()).toContain('INDEX(CFEXPIRATIONS($B$4),2,1)');
        expect(collect).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled(); expect(keyRead).not.toHaveBeenCalled();
    });

    it("preserves watchlist ticker inputs and historical journal rows", () => {
        const watch = book.insertSheet("Watchlist"); watch.getRange("Z1").setValue("CACHEFINANCE_WATCHLIST_V1"); watch.getRange("A8:A9").setValues([["CRCL"], ["AAPL"]]);
        const journal = book.insertSheet("Journal"); journal.getRange("Z1").setValue("CACHEFINANCE_JOURNAL_V1"); journal.getRange("A8:C8").setValues([["Saved observation", "NVDA", 123]]);
        api.buildLegacy();
        expect(watch.getRange("A8:A9").getValues()).toEqual([["CRCL"], ["AAPL"]]); expect(journal.getRange("A8:C8").getValues()).toEqual([["Saved observation", "NVDA", 123]]);
    });

    it("refreshes the legacy class through the hidden generation without overwriting result formulas", () => {
        api.buildLegacy(); const main = book.getSheetByName("Analysis"), formulas = book.getSheetByName("Formulas"), priceFormula = main.getRange("B9").getFormula();
        for (let iteration = 0; iteration < 3; iteration++) {
            const previous = main.getRange("Z4").getValue(); api.refreshLegacy(); expect(main.getRange("Z4").getValue()).toBe(previous + 1);
            expect(main.getRange("B9").getFormula()).toBe(priceFormula); expect(formulas.getRange("E4").getFormula()).toBe("");
        }
        api.CFBuildFormulaExamples(); api.CFBuildWatchlist();
        expect(formulas.getRange("B23").getFormula()).toBe('=CFQUOTE($B$4,"price")'); expect(fetch).not.toHaveBeenCalled(); expect(keyRead).not.toHaveBeenCalled();
    });

    it("puts a scalar custom formula in every quote and fundamental value cell with visible formula text", () => {
        api.buildLegacy(); const quote = book.getSheetByName("Quote data"), fundamentals = book.getSheetByName("Fundamentals"), examples = book.getSheetByName("Formulas");
        expect(api.V.quoteFields()).toHaveLength(29); expect(api.V.fundamentalFields()).toHaveLength(63);
        expect(quote.getRange("A8:A36").getValues()).toEqual(api.V.quoteFields().map(field => [field]));
        api.V.quoteFields().forEach((field, i) => {
            expect(quote.getRange(i + 8, 2).getFormula()).toBe('=CFQUOTE($B$4,"' + field + '")');
            expect(quote.getRange(i + 8, 3).getFormula()).toBe('=FORMULATEXT(B' + (i + 8) + ')');
        });
        expect(fundamentals.getRange("B4").getFormula()).toBe("=Analysis!B4"); expect(fundamentals.getRange("E4").getFormula()).toBe("");
        expect(fundamentals.getRange("I7").getFormula()).toBe('=CFFUNDAMENTALS($B$4,"all")');
        expect(fundamentals.getRange("G8").getFormula()).toContain('INDEX($L$8:$L$200,MATCH($A8,$I$8:$I$200,0))="","N/A"');
        expect(fundamentals.getRange("E8").getFormula()).toContain('INDEX($M$8:$M$200,MATCH($A8,$I$8:$I$200,0))');
        expect(fundamentals.getRange("A7:F7").getValues()[0]).toEqual(["Field", "Value", "Unit", "Availability", "Source", "Formula"]);
        api.V.fundamentalFields().forEach(([field, unit], i) => {
            expect(fundamentals.getRange(i + 8, 2).getFormula()).toBe('=CFFUNDAMENTALS($B$4,"' + field + '")');
            expect(fundamentals.getRange(i + 8, 3).getValue()).toBe(unit);
            expect(fundamentals.getRange(i + 8, 4).getFormula()).toContain('"Unavailable","Returned"');
            expect(fundamentals.getRange(i + 8, 5).getFormula()).toContain('INDEX($M$8:$M$200,MATCH($A' + (i + 8) + ',$I$8:$I$200,0))');
            expect(fundamentals.getRange(i + 8, 6).getFormula()).toBe('=FORMULATEXT(B' + (i + 8) + ')');
        });
        expect(examples.getRange("C23").getFormula()).toBe("=FORMULATEXT(B23)"); expect(examples.getRange("I23").getFormula()).toBe("=FORMULATEXT(H23)");
        expect(examples.getRange("O34").getFormula()).toBe('=CFEXPIRATIONS($B$4)');
        expect(book.getSheetByName("Analysis").getRange("B16").getFormula()).toBe("='Price history'!$BL$10");
        expect(fetch).not.toHaveBeenCalled(); expect(keyRead).not.toHaveBeenCalled();
    });

    it("keeps refresh controls out of the beginner views and uses two-argument scalar calls", () => {
        api.buildLegacy();
        for (const name of ["Analysis", "Quote data", "Fundamentals", "Formulas"]) {
            const sheet = book.getSheetByName(name);
            expect(sheet.getRange("D4:E4").getValues()).toEqual([["", ""]]);
            for (const value of sheet.getRange("A1:L6").getValues().flat()) expect(String(value)).not.toMatch(/refresh\s+(?:number|counter)|refresh-cell/i);
        }
        const main = book.getSheetByName("Analysis"), quote = book.getSheetByName("Quote data"), guide = book.getSheetByName("Start here");
        expect(main.getRange("Z4").getValue()).toBe(1); expect(main.hiddenColumn).toBe(26); expect(quote.hiddenColumn).toBe(16);
        for (const value of guide.cells.values()) expect(String(value)).not.toMatch(/refresh\s+(?:number|counter)|refresh arguments|refresh control|Analysis!E4/i);
        expect(book.getSheetByName("Formulas").getRange("H26").getFormula()).toBe('=CFFREDVALUE($K$24,$K$25)');
        expect(book.getSheetByName("Formulas").getRange("B26").getFormula()).toBe('=CFFIELD("FINVIZ",$B$4,"price")');
        expect(book.getSheetByName("Formulas").getRange("Q34").getFormula()).toBe('=CFFRED("DGS2",12)');
        expect(fetch).not.toHaveBeenCalled(); expect(keyRead).not.toHaveBeenCalled();
    });

    it("uses blank-aware lookups and preserves source errors instead of hiding them", () => {
        expect(api.W.quote("price")).toContain("COUNTIFS("); expect(api.W.quote("price")).toContain("IFNA("); expect(api.W.quote("price")).not.toContain("IFERROR(");
        expect(api.W.technical("20-day annualized volatility")).toContain("20-day annualized volatility");
    });

    it("does not record a partially loading workbook in Journal", () => {
        api.buildLegacy(); const data = book.getSheetByName("Quote data"), journal = book.getSheetByName("Journal");
        data.getRange("AA8:AB10").setValues([["price", 100], ["currency", "USD"], ["rsi14", "Loading..."]]);
        const last = journal.getLastRow(); expect(() => api.CFRecordJournalSnapshot()).toThrow(/Wait for source formulas/); expect(journal.getLastRow()).toBe(last);
    });

    it("compares the latest timestamp for the same ticker and currency after Journal rows are sorted", () => {
        api.buildLegacy(); readyMetrics();
        const journal = book.getSheetByName("Journal"), day = Date.UTC(2026, 10, 11), serial = (day - Date.UTC(1899, 11, 30)) / 86400000;
        const records = [savedRow(new Date(day)), savedRow(new Date(Date.UTC(2026, 9, 1))), savedRow(new Date(Date.UTC(2026, 10, 12)), "NVDA", "CAD"),
            savedRow(new Date(Date.UTC(2026, 10, 12)), "AAPL"), savedRow(serial, "NVDA", "USD", { 2: 95, 9: 0 }),
            savedRow("2026-11-13"), savedRow(new Date("invalid")), savedRow(""), savedRow(Infinity)];
        journal.getRange(8, 1, records.length, 18).setValues(records);
        const before = journal.getRange(8, 1, records.length, 18).getValues(), result = api.CFRecordJournalSnapshot();
        expect(result.row).toBe(17); expect(journal.getRange("M17").getFormula()).toContain("C17-C12");
        expect(journal.getRange("N17").getFormula()).toContain("ISNUMBER(G12)"); expect(journal.getRange("N17").getFormula()).toContain("G17-G12");
        expect(journal.getRange("O17").getFormula()).toContain("I17-I12"); expect(journal.getRange("P17").getFormula()).toContain("J17-J12");
        expect(journal.getRange("R17").getFormula()).toContain("(L17-L12)*100"); expect(journal.getRange("G17").getValue()).toBe(0);
        expect(journal.getRange("I17").getValue()).toBe(0); expect(journal.getRange("S17").getValue()).toBe(book.getSheetByName("Analysis").getRange("Z4").getValue());
        expect(journal.getRange(8, 1, records.length, 18).getValues()).toEqual(before);
        expect(fetch).not.toHaveBeenCalled(); expect(keyRead).not.toHaveBeenCalled();
    });

    it("ignores invalid timestamps and leaves the first comparable snapshot deltas unavailable", () => {
        api.buildLegacy(); readyMetrics(); const journal = book.getSheetByName("Journal");
        journal.getRange("A8:R11").setValues([savedRow("Saved observation"), savedRow(""), savedRow(new Date("invalid")), savedRow(NaN)]);
        const result = api.CFRecordJournalSnapshot(); expect(result.row).toBe(12);
        expect(journal.getRange("M12:R12").getValues()).toEqual([Array(6).fill('="N/A"')]);
        expect(fetch).not.toHaveBeenCalled(); expect(keyRead).not.toHaveBeenCalled();
    });

    it("clears stale provider chart links only for a changed ticker and makes no provider request", () => {
        api.buildLegacy(); const main = book.getSheetByName("Analysis"), options = book.getSheetByName("Options"), charts = book.insertSheet("Chart links");
        charts.getRange("Z1").setValue("CACHEFINANCE_IMAGES_V1"); charts.getRange("A5").setValue("NVDA chart link");
        const remove = vi.fn(); charts.getImages = () => [{ remove }]; const invalidate = vi.spyOn(api.P, "invalidate");
        api.handleLegacyEdit({ source: book, range: main.getRange("E4"), oldValue: "1", value: "2" });
        api.handleLegacyEdit({ source: book, range: options.getRange("B4"), oldValue: "2026-11-13", value: "2026-11-20" });
        main.getRange("B4").setValue(" nvda "); api.handleLegacyEdit({ source: book, range: main.getRange("B4"), oldValue: "NVDA", value: " nvda " });
        expect(invalidate).not.toHaveBeenCalled(); expect(charts.getRange("A5").getValue()).toBe("NVDA chart link");
        main.getRange("B4").setValue("CRCL"); api.handleLegacyEdit({ source: book, range: main.getRange("B4"), oldValue: "NVDA", value: "CRCL" });
        expect(options.getRange("B4").getFormula()).toBe('=IF(\'Quote data\'!$O$8="","",\'Quote data\'!$O$8)');
        expect(invalidate).toHaveBeenCalledTimes(1); expect(remove).toHaveBeenCalledTimes(1); expect(charts.getRange("A5").getValue()).toBe("");
        expect(charts.getRange("A1").getValue()).toBe("CRCL — provider chart links");
        expect(fetch).not.toHaveBeenCalled(); expect(keyRead).not.toHaveBeenCalled();
    });

    it("marks chart titles visibly pending on ticker edits without reading or updating charts", () => {
        api.buildLegacy(); const main = book.getSheetByName("Analysis");
        const reads = ["Analysis", "Research", "Options", "Strategies"].map(name => vi.spyOn(book.getSheetByName(name), "getCharts"));
        const writes = ["Analysis", "Research", "Options", "Strategies"].map(name => vi.spyOn(book.getSheetByName(name), "updateChart"));
        const previous = main.getRange("Z4").getValue();
        main.getRange("B4").setValue("AAPL"); api.handleLegacyEdit({ source: book, range: main.getRange("B4"), oldValue: "NVDA", value: "AAPL" });
        expect(main.getRange("Z4").getValue()).toBe(previous + 1);
        main.getRange("B4").setValue(" aapl "); api.handleLegacyEdit({ source: book, range: main.getRange("B4"), oldValue: "AAPL", value: " aapl " });
        expect(main.getRange("Z4").getValue()).toBe(previous + 1);
        expect(main.getRange("Z3").getValue()).toContain("Chart titles pending");
        expect(main.getRange("G5").getFormula()).toBe('=IF($Z$3="","",$Z$3)');
        reads.forEach(read => expect(read).not.toHaveBeenCalled()); writes.forEach(write => expect(write).not.toHaveBeenCalled());
        expect(fetch).not.toHaveBeenCalled(); expect(keyRead).not.toHaveBeenCalled();
    });

    it("updates titles before calculator inputs and source refresh, and exposes transient title failures", () => {
        api.buildLegacy(); const main = book.getSheetByName("Analysis"), research = book.getSheetByName("Research"), options = book.getSheetByName("Options");
        main.getRange("B4").setValue("AAPL"); options.getRange("P9").setValue(0.08);
        const previous = main.getRange("Z4").getValue(), update = api.W.updateChartTitles;
        const beforeSourceRefresh = vi.spyOn(api.W, "updateChartTitles").mockImplementation(target => {
            expect(main.getRange("Z4").getValue()).toBe(previous); expect(options.getRange("P9").getValue()).toBe(0.08);
            return update(target);
        });
        const failedRead = vi.spyOn(research, "getCharts").mockImplementationOnce(() => { throw new Error("Spreadsheet busy"); });
        const failedWrite = vi.spyOn(main, "updateChart").mockImplementationOnce(() => { throw new Error("Spreadsheet busy"); }).mockImplementation(() => main);
        const unchanged = vi.spyOn(options, "updateChart");
        const result = api.refreshLegacy();
        expect(result.ok).toBe(true); expect(result.chartTitles.pending).toBe(2); expect(result.chartTitles.updated).toBeGreaterThan(0);
        expect(main.getRange("Z4").getValue()).toBe(previous + 1); expect(options.getRange("P9").getValue()).toBe(0.04);
        expect(main.getRange("Z3").getValue()).toContain("Chart titles pending"); expect(book.toasts.at(-1)[0]).toContain("chart titles are pending");
        expect(unchanged).not.toHaveBeenCalled(); beforeSourceRefresh.mockRestore(); failedRead.mockRestore(); failedWrite.mockRestore();
        expect(api.refreshLegacy().chartTitles.pending).toBe(0); expect(main.getRange("Z3").getValue()).toBe("");
        expect(fetch).not.toHaveBeenCalled(); expect(keyRead).not.toHaveBeenCalled();
    });

    it("treats displayed custom-function loading as pending while retaining actual formula errors", () => {
        api.buildLegacy(); const main = book.getSheetByName("Analysis"), originalRange = main.getRange.bind(main);
        originalRange("B9").setValue("#ERROR!");
        main.getRange = (...args) => { const range = originalRange(...args); if (args[0] === "B9") range.getDisplayValue = () => "Loading..."; return range; };
        expect(api.W.inspect(book).errors).not.toContainEqual(expect.objectContaining({ sheet: "Analysis", cell: "B9" }));
        expect(api.W.inspect(book).formulas.find(item => item.sheet === "Analysis" && item.cell === "B9").value).toBe("Loading...");
        main.getRange = (...args) => { const range = originalRange(...args); if (args[0] === "B9") range.getDisplayValue = () => "#ERROR!"; return range; };
        expect(api.W.inspect(book).errors).toContainEqual({ sheet: "Analysis", cell: "B9", error: "#ERROR!" });
    });

    it("uses one script-written calculation date without volatile custom-function dependencies", () => {
        api.buildLegacy(); const main = book.getSheetByName("Analysis");
        for (const sheet of book.sheets.values()) for (const formula of sheet.formulas.values()) expect(formula).not.toMatch(/\b(?:TODAY|NOW)\s*\(/i);
        expect(main.getRange("J4").getValue()).toBe("Calculation date"); expect(main.formatAt(4, 11)).toBe("@");
        expect(book.getSheetByName("Options").getRange("P7").getFormula()).toContain('DATEVALUE(Analysis!$K$4)');
        expect(book.getSheetByName("Research").getRange("CR8").getFormula()).toContain('DATEVALUE(Analysis!$K$4)');
        main.getRange("K4").setValue("2030-12-01"); api.refreshLegacy(); expect(main.getRange("K4").getValue()).toBe("2026-11-12");
        expect(fetch).not.toHaveBeenCalled(); expect(keyRead).not.toHaveBeenCalled();
    });

    it("retains the MACD combo type and series when updating its ticker title", () => {
        api.buildLegacy(); const main = book.getSheetByName("Analysis"), research = book.getSheetByName("Research");
        main.getRange("B4").setValue("AAPL"); const update = vi.spyOn(research, "updateChart"); api.W.updateChartTitles(book);
        const macd = update.mock.calls.map(([chart]) => chart).find(chart => chart.options.title === "AAPL — MACD / signal / histogram");
        expect(macd.type).toBe("COMBO"); expect(macd.options.series).toEqual({ 0: { type: "line" }, 1: { type: "line" }, 2: { type: "bars" } });
    });

    it("gates all five option sources on the returned expiration generation and advances it before resetting dates", () => {
        api.buildLegacy(); const main = book.getSheetByName("Analysis"), options = book.getSheetByName("Options"), research = book.getSheetByName("Research");
        const selected = options.getRange("A7").getFormula();
        expect(selected).toBe('=IF(IFERROR(AND(ISNUMBER(\'Quote data\'!$P$8),\'Quote data\'!$P$8=Analysis!$Z$4),FALSE),CFOPTIONS(Analysis!$B$4,$B$4,\'Quote data\'!$P$8),"N/A: Expiration dates loading or unavailable; see Quote data!O7")');
        for (const [index, address] of ["AA600", "AQ600", "BG600", "BW600"].entries()) {
            expect(research.getRange(address).getFormula()).toBe(api.W.optionSource('$A' + (26 + index), true));
            expect(research.getRange(address).getFormula()).toContain('ISNUMBER(IFERROR(DATEVALUE($A' + (26 + index) + '),""))');
        }
        const previous = main.getRange("Z4").getValue(), original = options.getRange.bind(options); let counterWhenDateReset;
        options.getRange = (...args) => { const range = original(...args); if (args[0] === "B4") { const setFormula = range.setFormula.bind(range); range.setFormula = formula => { counterWhenDateReset = main.getRange("Z4").getValue(); return setFormula(formula); }; } return range; };
        main.getRange("B4").setValue("AAPL"); api.handleLegacyEdit({ source: book, range: main.getRange("B4"), oldValue: "NVDA", value: "AAPL" });
        expect(counterWhenDateReset).toBe(previous + 1); expect(fetch).not.toHaveBeenCalled(); expect(keyRead).not.toHaveBeenCalled();
    });
});
