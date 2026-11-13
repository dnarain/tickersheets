/*  *** DEBUG START ***
import { TickerSheetsPublicData } from "./TickerSheetsFunctions.js";
export { onOpen, TickerSheetsRefreshData };
//  *** DEBUG END ***/

/** Add API-key settings and a refresh command for formulas in any cell layout. */
function onOpen() {
    TickerSheetsMenu();
}

/** Rerun existing data formulas in the user's own layout. It never creates or populates tabs. */
function TickerSheetsRefreshData() {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    if (!book) throw new Error("Open the spreadsheet before refreshing formulas.");
    const saved = [], pattern = /\b(?:TICKERSHEETS_QUOTE|TICKERSHEETS_PROVIDER_QUOTE|TICKERSHEETS_HISTORY|TICKERSHEETS_FUNDAMENTALS|TICKERSHEETS_OPTIONS|TICKERSHEETS_EXPIRATIONS|TICKERSHEETS_EARNINGS|TICKERSHEETS_FRED|TICKERSHEETS_FRED_VALUE|TICKERSHEETS_FIELD|TICKERSHEETS_RSI_TARGETS|TICKERSHEETS_WATCH_ROW|TICKERSHEETS_QUOTE_COMPARE|TICKERSHEETS_DATA_STATUS|TICKERSHEETS_STRATEGY|TICKERSHEETS_OPTION_MODEL)\s*\(/i;
    for (const sheet of book.getSheets()) {
        const formulas = sheet.getDataRange().getFormulas();
        for (let row = 0; row < formulas.length; row++) for (let col = 0; col < formulas[row].length; col++) {
            const formula = formulas[row][col];
            if (formula && !/^=FORMULATEXT\(/i.test(formula) && pattern.test(formula)) saved.push({ range: sheet.getRange(row + 1, col + 1), formula });
        }
    }
    if (saved.length) {
        TickerSheetsPublicData.setAutomaticRefresh(Date.now() % 2147483647);
        // Change the formula text briefly to make Sheets recalculate unchanged inputs.
        // Every cell keeps a valid formula even if execution is cancelled or times out.
        try { saved.forEach(item => item.range.setFormula("=(" + item.formula.slice(1) + ")")); SpreadsheetApp.flush(); }
        finally {
            let failed = false;
            for (const item of saved) { try { item.range.setFormula(item.formula); } catch { failed = true; } }
            if (failed) throw new Error("A formula could not be restored. Check cell permissions and try again.");
        }
    }
    book.toast(saved.length ? "Refreshing data. Wait for the results." : "No TickerSheets data formulas found.", "TickerSheets", 8);
    return { ok: true, recalculated: saved.length };
}
