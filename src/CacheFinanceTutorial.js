/*  *** DEBUG START ***
import { CFPublicData } from "./CacheFinanceResearchFunctions.js";
export { CFTutorial, CFBuildTutorial, CFRefreshFormulas, CFInspectTutorial };
//  *** DEBUG END ***/

/** A small example of using the library in cells. It does not collect market data. */
class CFTutorial {
    static get marker() { return "TICKERSHEETS_GUIDE_V1"; }
    static retiredTabs() {
        const base = "CACHEFINANCE_ANALYSIS_V1";
        return { Analysis: base, "Price history": base, Fundamentals: base, Earnings: base,
            Options: base, Macro: base, Sources: base, Research: "CACHEFINANCE_RESEARCH_V1",
            Strategies: "CACHEFINANCE_STRATEGIES_V1", Formulas: "CACHEFINANCE_FUNCTIONS_V1",
            "Quote data": "TICKERSHEETS_QUOTE_DATA_V1", Watchlist: "CACHEFINANCE_WATCHLIST_V1",
            Journal: "CACHEFINANCE_JOURNAL_V1", "Watchlist data": "TICKERSHEETS_WATCHLIST_DATA_V1",
            "Chart links": "CACHEFINANCE_IMAGES_V1", "Lookup tests": "CACHEFINANCE_LOOKUP_CHECKS_V1" };
    }

    static examples() {
        return [
            ["Latest price", '=CFQUOTE($B$4,"price")', "The latest available session, including after hours when supplied."],
            ["Regular-session price", '=CFQUOTE($B$4,"regular_price")', "The provider's regular-session price."],
            ["After-hours price", '=CFQUOTE($B$4,"post_market_price")', "N/A when the provider has no after-hours quote."],
            ["Price session", '=CFQUOTE($B$4,"price_session")', "Which session supplied Latest price."],
            ["Quote time (UTC)", '=CFQUOTE($B$4,"quote_time")', "When the provider observed Latest price."],
            ["P/E (trailing)", '=CFFUNDAMENTALS($B$4,"trailing_pe")', "Price divided by trailing earnings per share."],
            ["EPS (trailing)", '=CFFUNDAMENTALS($B$4,"eps_ttm")', "Trailing earnings per share, in the quote currency."],
            ["Dividend yield", '=CFFUNDAMENTALS($B$4,"dividend_yield")', "A fraction displayed as a percentage."],
            ["Next earnings date", '=CFFUNDAMENTALS($B$4,"earnings_date")', "The provider's published date; it can change."]
        ];
    }

    static build(book) {
        if (!book || typeof book.getSheetByName !== "function") throw new Error("Open a spreadsheet first.");
        let sheet = book.getSheetByName("Start here");
        if (sheet && sheet.getRange("Z1").getValue() !== CFTutorial.marker) throw new Error("The existing Start here tab is not managed by TickerSheets. Rename it before creating the tutorial.");
        const previous = sheet?.getRange("Z2").getValue() === "TICKERSHEETS_TUTORIAL_V1"
            ? sheet.getRange("B4").getValue() : book.getSheetByName("Analysis")?.getRange("B4").getValue();
        const ticker = typeof previous === "string" && /^[A-Za-z0-9.^=:/_-]{1,40}$/.test(previous.trim()) ? previous.trim().toUpperCase() : "NVDA";
        if (!sheet) sheet = book.insertSheet("Start here");
        if (sheet.getMaxRows() < 60) sheet.insertRowsAfter(sheet.getMaxRows(), 60 - sheet.getMaxRows());
        if (sheet.getMaxColumns() < 26) sheet.insertColumnsAfter(sheet.getMaxColumns(), 26 - sheet.getMaxColumns());
        if (typeof sheet.getCharts === "function") sheet.getCharts().forEach(chart => sheet.removeChart(chart));
        sheet.getRange(1, 1, Math.max(60, sheet.getLastRow()), sheet.getMaxColumns()).breakApart().clear().clearDataValidations().setNumberFormat("General");
        sheet.setRowHeights(1, 60, 22);
        sheet.setHiddenGridlines(true); sheet.setFrozenRows(6); sheet.setFrozenColumns(0);
        sheet.getRange("A1:D40").setFontFamily("Arial").setFontSize(11).setVerticalAlignment("middle");
        sheet.getRange("A1:D1").merge().setValue("TickerSheets — functions you can use in your own sheet").setFontSize(18).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2:D2").merge().setValue("Enter a ticker below. Click a result, then copy its formula from the formula bar into a cell in your own spreadsheet. Column C shows the same formula for reference.").setWrap(true);
        sheet.setRowHeights(1, 1, 36); sheet.setRowHeights(2, 1, 36);
        sheet.getRange("A4").setValue("Try a ticker").setFontWeight("bold");
        sheet.getRange("B4").setValue(ticker).setBackground("#FFF2CC").setFontColor("#0000FF").setFontWeight("bold");
        sheet.getRange("C4:D4").merge().setValue("Change B4 to try another stock. All examples below read this one cell.").setWrap(true);
        CFTutorial.header(sheet, "A6:D6", ["Example", "Result", "Formula for reference", "What it returns"]);
        const examples = CFTutorial.examples();
        sheet.getRange("A7:A15").setValues(examples.map(row => [row[0]]));
        sheet.getRange("B7:B15").setFormulas(examples.map(row => [row[1]]));
        sheet.getRange("C7:C15").setFormulas(examples.map((_, i) => ['=FORMULATEXT(B' + (i + 7) + ')'])).setFontFamily("Courier New").setFontSize(10);
        sheet.getRange("D7:D15").setValues(examples.map(row => [row[2]]));
        sheet.getRange("A7:D15").setWrap(true); sheet.setRowHeights(7, 9, 42);
        sheet.getRange("B7:B9").setNumberFormat("#,##0.00"); sheet.getRange("B12:B13").setNumberFormat("#,##0.00");
        sheet.getRange("B14").setNumberFormat("0.0%"); sheet.getRange("B10:B11").setNumberFormat("@"); sheet.getRange("B15").setNumberFormat("@");
        sheet.getRange("A17:D17").merge().setValue("N/A means the provider did not supply that value. Quotes can be delayed. These stock examples use Yahoo Finance and do not require your own API key.").setWrap(true); sheet.setRowHeights(17, 1, 44);
        CFTutorial.header(sheet, "A19:D19", ["Set up your own spreadsheet", "", "", ""]);
        const setup = [
            "Copy this tutorial: File → Make a copy includes its attached Apps Script. Reload your editable copy to see Data settings. The public tutorial has no saved API keys.",
            "Start with a blank sheet: open Extensions → Apps Script. Paste the contents of dist/TickerSheets.js into Code.gs, save, then reload the spreadsheet. Now type a function in any cell.",
            "Optional keys: choose Data settings → API keys… and enter your own provider key. FRED requires a FRED key. Keep a copy with saved keys private; spreadsheet editors can read those keys.",
            "Get newer data: choose Data settings → Refresh formulas and wait for the results. You can use your own cell layout; the script does not need a dashboard or additional tabs."
        ];
        setup.forEach((text, i) => { const row = 20 + i * 2; sheet.getRange("A" + row + ":D" + (row + 1)).merge().setValue(text).setWrap(true); sheet.setRowHeights(row, 2, 24); });
        CFTutorial.header(sheet, "A29:D29", ["Table functions to try", "", "Formula to enter", "What it returns"]);
        const tables = [
            ["Daily prices", '=CFHISTORY($B$4,30)', "Returns a header and up to 30 daily OHLCV rows."],
            ["Option expiration dates", '=CFEXPIRATIONS($B$4)', "Returns the dates published by the provider."],
            ["Option chain", '=CFOPTIONS($B$4)', "Returns the nearest available chain; an optional second argument chooses a date."],
            ["Reported earnings", '=CFEARNINGS($B$4,"earnings")', "Returns reported EPS, estimates and the accounting basis."],
            ["FRED observations", '=CFFRED("DGS10",12)', "Requires your own FRED key; returns dates and observations."]
        ];
        sheet.getRange("A30:A34").setValues(tables.map(row => [row[0]]));
        // A leading apostrophe keeps these examples as text, so no table requests run here.
        sheet.getRange("C30:C34").setValues(tables.map(row => ["'" + row[1]])).setFontFamily("Courier New").setFontSize(10);
        sheet.getRange("D30:D34").setValues(tables.map(row => [row[2]])); sheet.getRange("A30:D34").setWrap(true); sheet.setRowHeights(30, 5, 44);
        sheet.getRange("A36:D36").merge().setValue("Table functions fill neighboring cells. Try them in an empty area or a tab you create, with room for the returned rows and columns.").setWrap(true); sheet.setRowHeights(36, 1, 42);
        sheet.getRange("A38:D38").merge().setFormula('=HYPERLINK("https://github.com/dnarain/tickersheets/blob/main/FUNCTIONS.md","Open the full function reference")').setFontColor("#1155CC");
        sheet.getRange("A39:D39").merge().setFormula('=HYPERLINK("https://github.com/dnarain/tickersheets/blob/main/INSTALL.md","Installation and API-key instructions")').setFontColor("#1155CC");
        sheet.setColumnWidth(1, 205); sheet.setColumnWidth(2, 175); sheet.setColumnWidth(3, 535); sheet.setColumnWidth(4, 420);
        sheet.getRange("Z1:Z2").setValues([[CFTutorial.marker], ["TICKERSHEETS_TUTORIAL_V1"]]); sheet.hideColumns(26);
        book.setActiveSheet(sheet);
        const removed = [];
        for (const [name, marker] of Object.entries(CFTutorial.retiredTabs())) {
            const old = book.getSheetByName(name);
            if (old && old.getRange("Z1").getValue() === marker) { book.deleteSheet(old); removed.push(name); }
        }
        if (typeof book.moveActiveSheet === "function") book.moveActiveSheet(1);
        book.toast("Tutorial ready. Enter formulas in any cells you choose.", "TickerSheets", 8);
        return { ok: true, sheet: "Start here", ticker, removed };
    }

    static header(sheet, address, values) {
        sheet.getRange(address).setValues([values]).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold").setWrap(true);
    }

    static inspect(book) {
        const sheet = book?.getSheetByName("Start here");
        if (!sheet || sheet.getRange("Z2").getValue() !== "TICKERSHEETS_TUTORIAL_V1") return { ok: false, error: "The tutorial is not installed." };
        const rows = CFTutorial.examples().map(([label, expected], i) => {
            const cell = "B" + (i + 7), range = sheet.getRange(cell), formula = range.getFormula(), value = range.getValue();
            const displayed = typeof range.getDisplayValue === "function" ? range.getDisplayValue() : String(value);
            return { label, cell, formula, value, matches: formula === expected, pending: /^(?:Loading|Thinking)(?:\b|\.)/i.test(displayed), error: /^#(?:REF!|ERROR!|VALUE!|NAME\?|DIV\/0!|NUM!)/.test(String(value)) && !/^(?:Loading|Thinking)(?:\b|\.)/i.test(displayed) };
        });
        return { ok: rows.every(row => row.matches && !row.error && !row.pending), sheets: book.getSheets().map(tab => tab.getName()), ticker: sheet.getRange("B4").getValue(), rows };
    }
}

/** Developer helper for maintaining the public tutorial. It is not a spreadsheet menu item. */
function CFBuildTutorial() { return CFTutorial.build(SpreadsheetApp.getActiveSpreadsheet()); }

/** Read the tutorial's formulas and displayed results without requesting provider data. */
function CFInspectTutorial() {
    const result = CFTutorial.inspect(SpreadsheetApp.getActiveSpreadsheet());
    console.log("CF_TUTORIAL_CHECK " + JSON.stringify(result));
    return result;
}

/** Rerun existing data formulas in the user's own layout. It never creates or populates tabs. */
function CFRefreshFormulas() {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    if (!book) throw new Error("Open the spreadsheet before refreshing formulas.");
    const saved = [], pattern = /\b(?:CFQUOTE|CFHISTORY|CFFUNDAMENTALS|CFOPTIONS|CFEXPIRATIONS|CFEARNINGS|CFFRED|CFFREDVALUE|CFFIELD|CFRSITARGETS|CFWATCHROW|CFQUOTECOMPARE|CFDATASTATUS|CACHEFINANCES?)\s*\(/i;
    for (const sheet of book.getSheets()) {
        const formulas = sheet.getDataRange().getFormulas();
        for (let row = 0; row < formulas.length; row++) for (let col = 0; col < formulas[row].length; col++) {
            const formula = formulas[row][col];
            if (formula && !/^=FORMULATEXT\(/i.test(formula) && pattern.test(formula)) saved.push({ range: sheet.getRange(row + 1, col + 1), formula });
        }
    }
    if (saved.length) {
        CFPublicData.setAutomaticRefresh(Date.now() % 2147483647);
        // Change the formula text briefly to make Sheets recalculate unchanged inputs.
        // Every cell keeps a valid formula even if execution is cancelled or times out.
        try { saved.forEach(item => item.range.setFormula("=(" + item.formula.slice(1) + ")")); SpreadsheetApp.flush(); }
        finally {
            let failed = false;
            for (const item of saved) { try { item.range.setFormula(item.formula); } catch { failed = true; } }
            if (failed) throw new Error("A formula could not be restored. Check cell permissions and try again.");
        }
    }
    book.toast(saved.length ? "Refreshing formulas. Wait for the results." : "No TickerSheets data formulas found.", "TickerSheets", 8);
    return { ok: true, recalculated: saved.length };
}
