/*  *** DEBUG START ***
import { CFWorkbookNames } from "./CacheFinanceSheetNames.js";
import { CFPublicData } from "./CacheFinanceResearchFunctions.js";
export { CFFormulaWorkbook, CFRecordJournalSnapshot, CFInspectFormulaWorkbook };
//  *** DEBUG END ***/

/** Layout and refresh controls. Provider requests run only through cell functions. */
class CFFormulaWorkbook {
    static markers() {
        const result = Object.fromEntries(["Analysis", "Price history", "Fundamentals", "Earnings", "Options", "Macro", "Sources"].map(name => [name, "CACHEFINANCE_ANALYSIS_V1"]));
        return { ...result, "Research": "CACHEFINANCE_RESEARCH_V1", "Strategies": "CACHEFINANCE_STRATEGIES_V1",
            "Formulas": "CACHEFINANCE_FUNCTIONS_V1", "Quote data": "TICKERSHEETS_QUOTE_DATA_V1", "Start here": "TICKERSHEETS_GUIDE_V1",
            "Watchlist": "CACHEFINANCE_WATCHLIST_V1", "Journal": "CACHEFINANCE_JOURNAL_V1", "Watchlist data": "TICKERSHEETS_WATCHLIST_DATA_V1" };
    }
    static isFormulaBook(book) { return book?.getSheetByName("Analysis")?.getRange("Z2").getValue() === "TICKERSHEETS_FORMULAS_V1"; }
    static preflight(book) {
        if (!book || typeof book.getSheetByName !== "function") throw new Error("Open a spreadsheet first.");
        CFWorkbookNames.migrate(book);
        for (const [name, marker] of Object.entries(CFFormulaWorkbook.markers())) {
            const sheet = book.getSheetByName(name);
            if (sheet && sheet.getRange("Z1").getValue() !== marker) throw new Error("The existing " + name + " tab is not managed by TickerSheets. Rename it before building the sample.");
        }
    }
    static ensureSheet(book, name, marker) {
        let sheet = book.getSheetByName(name);
        if (sheet && sheet.getRange("Z1").getValue() !== marker) throw new Error("The existing " + name + " tab is not managed by TickerSheets.");
        if (!sheet) sheet = book.insertSheet(name);
        if (sheet.getMaxRows() < 1200) sheet.insertRowsAfter(sheet.getMaxRows(), 1200 - sheet.getMaxRows());
        if (sheet.getMaxColumns() < 100) sheet.insertColumnsAfter(sheet.getMaxColumns(), 100 - sheet.getMaxColumns());
        sheet.getRange("Z1").setValue(marker);
        return sheet;
    }
    static prepareSheet(book, name, marker) {
        const sheet = CFFormulaWorkbook.ensureSheet(book, name, marker);
        const height = Math.max(100, sheet.getLastRow());
        if (typeof sheet.getCharts === "function") sheet.getCharts().forEach(chart => sheet.removeChart(chart));
        sheet.getRange(1, 1, height, sheet.getMaxColumns()).breakApart().clear().clearDataValidations().setNumberFormat("General");
        sheet.setFrozenRows(0); sheet.setFrozenColumns(0);
        sheet.setHiddenGridlines(true); sheet.setColumnWidths(1, 25, 120);
        sheet.getRange(1, 1, height, 25).setFontFamily("Arial").setFontSize(10).setVerticalAlignment("middle");
        sheet.getRange("Z1").setValue(marker);
        if (name === "Earnings" && typeof sheet.showColumns === "function") sheet.showColumns(26);
        else sheet.hideColumns(26);
        return sheet;
    }
    static heading(sheet, label, note = "Click a result cell to inspect its formula. Source tables are separate from calculations.") {
        sheet.getRange("A1:L1").merge().setFormula('=UPPER(TRIM(Analysis!$B$4))&" — ' + label.replace(/"/g, '""') + '"').setFontSize(15).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2:L2").merge().setValue(note).setWrap(true).setFontColor("#596579").setFontSize(9);
        sheet.setFrozenRows(7);
    }
    static header(sheet, address, values) { return sheet.getRange(address).setValues([values]).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold").setWrap(true); }
    static input(sheet, address, value) { return sheet.getRange(address).setValue(value).setBackground("#FFF2CC").setFontColor("#0000FF").setFontWeight("bold"); }
    static lookup(key, labels, values) {
        const quoted = '"' + key.replace(/"/g, '""') + '"';
        const cell = 'INDEX(' + values + ',MATCH(' + quoted + ',' + labels + ',0))';
        return 'IFNA(IF(OR(COUNTIFS(' + labels + ',' + quoted + ',' + values + ',"<>")=0,LEN(' + cell + '&"")=0),"N/A",' + cell + '),"N/A")';
    }
    static quote(key) { return CFFormulaWorkbook.lookup(key, "'Quote data'!$A$8:$A$65", "'Quote data'!$B$8:$B$65"); }
    static fundamental(key) { return CFFormulaWorkbook.lookup(key, 'Fundamentals!$A$8:$A$200', 'Fundamentals!$B$8:$B$200'); }
    static technical(label) { return CFFormulaWorkbook.lookup(label, "'Price history'!$BK$4:$BK$40", "'Price history'!$BL$4:$BL$40"); }
    static metric(key) { return CFFormulaWorkbook.lookup(key, "'Quote data'!$AA$8:$AA$40", "'Quote data'!$AB$8:$AB$40"); }
    static optionSource(expiration, requireDate = false) {
        const generation = "'Quote data'!$P$8", ready = 'IFERROR(AND(ISNUMBER(' + generation + '),' + generation + '=Analysis!$Z$4),FALSE)';
        const request = 'CFOPTIONS(Analysis!$B$4,' + expiration + ',' + generation + ')';
        const result = requireDate ? 'IF(AND(' + expiration + '<>"",ISNUMBER(IFERROR(DATEVALUE(' + expiration + '),""))),' + request + ',"N/A: No additional expiration")' : request;
        return '=IF(' + ready + ',' + result + ',"N/A: Expiration dates loading or unavailable; see Quote data!O7")';
    }
    static counter(value) { return Number.isInteger(value) && value >= 0 && value < 2147483647 ? value + 1 : 1; }
    static recalculateDataFunctions(book) {
        const pattern = /\bCF(?:QUOTE|QUOTECOMPARE|HISTORY|FUNDAMENTALS|EARNINGS|OPTIONS|EXPIRATIONS|RSITARGETS|FIELD|FRED|FREDVALUE|WATCHROW)\s*\(/i;
        const sheets = typeof book.getSheets === "function" ? book.getSheets() : Object.keys(CFFormulaWorkbook.markers()).map(name => book.getSheetByName(name)).filter(Boolean);
        const saved = [];
        for (const sheet of sheets) {
            const matrix = sheet.getDataRange().getFormulas();
            const runs = [];
            for (let r = 0; r < matrix.length; r++) for (let c = 0; c < matrix[r].length; c++) {
                const formula = matrix[r][c];
                if (formula && pattern.test(formula) && !/^=FORMULATEXT\(/i.test(formula)) runs.push({ row: r + 1, column: c + 1, formulas: [[formula]] });
            }
            runs.sort((a, b) => a.column - b.column || a.row - b.row);
            const groups = [];
            for (const run of runs) {
                const prior = groups.at(-1);
                if (prior && prior.column === run.column && prior.row + prior.formulas.length === run.row) prior.formulas.push(run.formulas[0]);
                else groups.push(run);
            }
            for (const group of groups) saved.push({ range: sheet.getRange(group.row, group.column, group.formulas.length, 1), formulas: group.formulas });
        }
        // Clearing and restoring the formulas makes Sheets run unchanged two-argument calls again.
        // Preserve the exact formulas, formatting, validation and returned-table boundaries.
        try {
            for (const item of saved) item.range.clearContent();
            SpreadsheetApp.flush();
        } finally {
            let failed = false;
            for (const item of saved) { try { item.range.setFormulas(item.formulas); } catch { failed = true; } }
            if (failed) throw new Error("Unable to restore a data formula. Check sheet permissions before refreshing again.");
        }
        return saved.reduce((count, item) => count + item.formulas.length, 0);
    }
    static setCalculationDate(book) {
        const date = Utilities.formatDate(new Date(), book.getSpreadsheetTimeZone(), "yyyy-MM-dd");
        book.getSheetByName("Analysis").getRange("K4").setNumberFormat("@").setValue(date);
        return date;
    }
    static journalTimestamp_(value) {
        const time = Object.prototype.toString.call(value) === "[object Date]" ? value.getTime()
            : typeof value === "number" && Number.isFinite(value) ? Date.UTC(1899, 11, 30) + value * 86400000 : NaN;
        return Number.isFinite(time) && Math.abs(time) <= 8640000000000000 ? Math.round(time) : null;
    }
    static build(book, modules) {
        if (!modules?.views || !modules.history || !modules.research || !modules.options) throw new Error("The complete TickerSheets bundle is required.");
        CFFormulaWorkbook.preflight(book);
        const existing = book.getSheetByName("Analysis"), ticker = String(existing?.getRange("B4").getValue() || "NVDA").trim().toUpperCase();
        const previousCounter = CFFormulaWorkbook.isFormulaBook(book) ? existing.getRange("Z4").getValue() : 0;
        const expiration = book.getSheetByName("Options")?.getRange("B4").getValue() || "";
        const watchlist = book.getSheetByName("Watchlist")?.getRange("A8:A27").getValues();
        // Every referenced tab exists before any source formula is installed.
        for (const [name, marker] of Object.entries(CFFormulaWorkbook.markers())) CFFormulaWorkbook.ensureSheet(book, name, marker);
        const refresh = CFFormulaWorkbook.counter(previousCounter);
        CFPublicData.setAutomaticRefresh(refresh);
        modules.views.buildControl(book, { ticker, refresh });
        modules.views.buildQuoteData(book);
        modules.views.buildFundamentals(book);
        modules.history.build(book);
        modules.options.buildOptions(book, { expiration });
        modules.options.buildStrategies(book);
        modules.research.buildEarnings(book);
        modules.research.buildMacro(book);
        modules.research.buildResearch(book);
        modules.research.buildSources(book);
        modules.views.buildFormulas(book);
        modules.views.buildWatchlist(book, watchlist);
        modules.views.buildGuide(book);
        book.getSheetByName("Analysis").getRange("Z2").setValue("TICKERSHEETS_FORMULAS_V1");
        CFFormulaWorkbook.updateChartTitles(book);
        if (typeof book.setActiveSheet === "function") {
            const order = ["Start here", "Analysis", "Research", "Options", "Strategies", "Watchlist", "Journal", "Fundamentals", "Earnings", "Macro", "Formulas", "Price history", "Quote data", "Sources", "Watchlist data"];
            order.forEach((name, index) => { book.setActiveSheet(book.getSheetByName(name)); if (typeof book.moveActiveSheet === "function") book.moveActiveSheet(index + 1); });
            book.setActiveSheet(book.getSheetByName("Start here"));
        }
        book.toast("Formula sample built. Source functions are loading. Start here explains the data flow.", "TickerSheets", 10);
        return { ok: true, mode: "formulas", ticker, sheets: Object.keys(CFFormulaWorkbook.markers()) };
    }
    static refresh(book, modules) {
        if (!CFFormulaWorkbook.isFormulaBook(book)) return CFFormulaWorkbook.build(book, modules);
        CFFormulaWorkbook.preflight(book);
        const main = book.getSheetByName("Analysis"), value = CFFormulaWorkbook.counter(main.getRange("Z4").getValue());
        const chartTitles = CFFormulaWorkbook.updateChartTitles(book);
        CFFormulaWorkbook.setCalculationDate(book);
        modules.options.resetInputs(book);
        CFPublicData.setAutomaticRefresh(value);
        main.getRange("Z4").setValue(value);
        const recalculated = CFFormulaWorkbook.recalculateDataFunctions(book);
        book.toast(chartTitles.pending ? "Refresh requested. Some chart titles are pending; refresh again after data loads to retry." : "Refresh requested. Wait for source formulas to finish. Record a journal snapshot after the results load.", "TickerSheets", 10);
        return { ok: true, mode: "formulas", refresh: value, recalculated, chartTitles };
    }
    static updateChartTitles(book) {
        const main = book.getSheetByName("Analysis"), ticker = String(main?.getRange("B4").getValue() || "").trim().toUpperCase().replace(/[\r\n]/g, " ").slice(0, 60);
        const result = { updated: 0, pending: 0 };
        for (const name of ["Analysis", "Research", "Options", "Strategies"]) {
            let sheet, charts;
            try {
                sheet = book.getSheetByName(name);
                if (!sheet || typeof sheet.getCharts !== "function") continue;
                charts = sheet.getCharts();
            } catch { result.pending++; continue; }
            for (const chart of charts) {
                try {
                    const title = String(chart.getOptions().get("title") || "");
                    if (!title.includes(" — ")) continue;
                    const next = ticker + " — " + title.split(" — ").slice(1).join(" — ");
                    if (next !== title) {
                        let builder = chart.modify();
                        if (title.endsWith(" — MACD / signal / histogram")) builder = builder.setChartType(Charts.ChartType.COMBO).setOption("series", { 0: { type: "line" }, 1: { type: "line" }, 2: { type: "bars" } });
                        sheet.updateChart(builder.setOption("title", next).build()); result.updated++;
                    }
                } catch { result.pending++; }
            }
        }
        main?.getRange("Z3").setValue(result.pending ? "Chart titles pending. Choose Refresh selected ticker to retry." : "");
        return result;
    }
    static handleEdit(event, modules) {
        if (!event?.range || !CFFormulaWorkbook.isFormulaBook(event.source)) return;
        const range = event.range, name = range.getSheet().getName();
        if (name === "Analysis" && range.getRow() <= 4 && range.getLastRow() >= 4 && range.getColumn() <= 2 && range.getLastColumn() >= 2) {
            const main = event.source.getSheetByName("Analysis"), ticker = String(main.getRange("B4").getValue() || "").trim().toUpperCase();
            const changed = event.oldValue === undefined || ticker !== String(event.oldValue).trim().toUpperCase();
            if (changed) {
                const refresh = CFFormulaWorkbook.counter(main.getRange("Z4").getValue());
                main.getRange("Z4").setValue(refresh); CFPublicData.setAutomaticRefresh(refresh);
            }
            event.source.getSheetByName("Options").getRange("B4").setFormula('=IF(\'Quote data\'!$O$8="","",\'Quote data\'!$O$8)');
            modules.options.resetInputs(event.source);
            if (changed) {
                event.source.getSheetByName("Analysis").getRange("Z3").setValue("Chart titles pending. Choose Refresh selected ticker to update them.");
                event.source.toast("Ticker changed. Choose Refresh selected ticker to update chart titles.", "TickerSheets", 8);
                modules.images?.invalidate(event.source);
            }
        } else if (name === "Options" && range.getRow() <= 4 && range.getLastRow() >= 4 && range.getColumn() <= 2 && range.getLastColumn() >= 2) modules.options.resetInputs(event.source);
    }
    static inspect(book) {
        const main = book.getSheetByName("Analysis"), errors = [], formulas = [];
        // Older copies use A7 for a whole table. New copies put each value's formula in column B.
        const fieldCell = name => /^=CF(?:QUOTE|FUNDAMENTALS)\(/i.test(book.getSheetByName(name)?.getRange("A7").getFormula() || "") ? "A7" : "B8";
        for (const [name, cells] of Object.entries({ "Analysis": ["B9", "B16", "B17", "E17"], "Formulas": ["B23", "B24", "G34"], "Quote data": [fieldCell("Quote data"), "D7", "O7"], "Fundamentals": [fieldCell("Fundamentals")], "Price history": ["A7", "I57", "P22"], "Options": ["A7", "S4"], "Earnings": ["A7"], "Strategies": ["E4"] })) {
            const sheet = book.getSheetByName(name);
            if (!sheet) { errors.push({ sheet: name, error: "Missing sheet" }); continue; }
            for (const cell of cells) {
                const range = sheet.getRange(cell), formula = range.getFormula();
                let value = range.getValue();
                if (value === "#ERROR!" && typeof range.getDisplayValue === "function") {
                    const displayed = range.getDisplayValue();
                    if (/^(?:Loading|Thinking)(?:\b|\.)/i.test(displayed.trim())) value = displayed;
                }
                formulas.push({ sheet: name, cell, formula, value });
                if (!formula) errors.push({ sheet: name, cell, error: "Expected formula" });
                if (typeof value === "string" && /^#(?:REF!|ERROR!|NAME\?|VALUE!|NUM!|DIV\/0!)/.test(value)) errors.push({ sheet: name, cell, error: value });
            }
        }
        return { ok: errors.length === 0, mode: CFFormulaWorkbook.isFormulaBook(book) ? "formulas" : "legacy", ticker: main?.getRange("B4").getValue(), refresh: main?.getRange("Z4").getValue(), formulas, errors };
    }
}

/** Save currently displayed public values. It does not request provider data. */
function CFRecordJournalSnapshot() {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    if (!CFFormulaWorkbook.isFormulaBook(book)) throw new Error("Build the formula sample first.");
    const main = book.getSheetByName("Analysis"), sheet = book.getSheetByName("Journal");
    const displayed = book.getSheetByName("Quote data").getRange("AA8:AB40").getValues();
    const metric = key => displayed.find(row => row[0] === key)?.[1] ?? "N/A";
    const price = metric("price"), symbol = String(main.getRange("B4").getValue()).trim().toUpperCase(), currency = metric("currency");
    if (typeof price !== "number" || !Number.isFinite(price) || displayed.some(row => typeof row[1] === "string" && /^(?:#|Loading|Thinking)/i.test(row[1]))) throw new Error("Wait for source formulas to finish before recording the journal.");
    for (const [name, cell] of [["Quote data", "B8"], ["Price history", "A7"], ["Fundamentals", "B8"], ["Options", "A7"]]) {
        const value = book.getSheetByName(name).getRange(cell).getValue();
        if (typeof value === "string" && /^(?:#|Loading|Thinking)/i.test(value)) throw new Error("Wait for source formulas to finish before recording the journal.");
    }
    const last = sheet.getLastRow(), records = last >= 8 ? sheet.getRange(8, 1, last - 7, 18).getValues() : [];
    let previous = null, previousTime = -Infinity;
    records.forEach((row, index) => {
        const time = CFFormulaWorkbook.journalTimestamp_(row[0]);
        if (row[1] === symbol && row[3] === currency && time !== null && time >= previousTime) {
            previous = index + 8; previousTime = time;
        }
    });
    const row = Math.max(8, last + 1);
    if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), row - sheet.getMaxRows());
    sheet.getRange(row, 1, 1, 12).setValues([[new Date(), symbol, price, currency, metric("quote_time"), metric("indicator_as_of"), metric("rsi14"), metric("trailing_pe"), metric("eps_ttm"), metric("target_price"), metric("next_earnings"), metric("atm_iv")]]);
    for (const [column, source] of [[13, "C"], [14, "G"], [15, "I"], [16, "J"], [18, "L"]]) sheet.getRange(row, column).setFormula(previous === null ? '="N/A"' : '=IF(AND(ISNUMBER(' + source + row + '),ISNUMBER(' + source + previous + ')),(' + source + row + '-' + source + previous + ')' + (column === 18 ? '*100' : '') + ',"N/A")');
    sheet.getRange(row, 17).setFormula(previous === null ? '="N/A"' : '=IF(OR(K' + row + '="",K' + previous + '="",K' + row + '="N/A",K' + previous + '="N/A"),"N/A",K' + row + '<>K' + previous + ')');
    sheet.hideColumns(19); sheet.getRange(row, 19).setValue(main.getRange("Z4").getValue());
    sheet.getRange(row, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss"); sheet.getRange(row, 3).setNumberFormat("0.00"); sheet.getRange(row, 7, 1, 4).setNumberFormat("0.00"); sheet.getRange(row, 12).setNumberFormat("0.00%");
    book.toast("Recorded the displayed values. Journal entries remain fixed when source formulas refresh.", "Journal", 8);
    return { ok: true, row, ticker: symbol };
}

/** Read formulas and results without making a provider request. */
function CFInspectFormulaWorkbook() {
    const result = CFFormulaWorkbook.inspect(SpreadsheetApp.getActiveSpreadsheet());
    console.log("CF_FORMULA_WORKBOOK " + JSON.stringify(result)); return result;
}
