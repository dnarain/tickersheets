/*  *** DEBUG START ***
import { TickerSheetsShowcase } from "./TickerSheetsShowcase.js";
import { TickerSheetsOptionsShowcase } from "./TickerSheetsOptionsShowcase.js";
export { TickerSheetsDemoGenerator, TickerSheetsBuildDemo, TickerSheetsInspectDemo };
//  *** DEBUG END ***/

/** Build and inspect the optional example spreadsheet using cell formulas. */
class TickerSheetsDemoGenerator {
    static get marker() { return "TICKERSHEETS_GUIDE_V1"; }
    static examples() {
        return [
            ["Latest price", '=TICKERSHEETS_QUOTE($B$4,"price")', "The latest available session, including after hours when supplied."],
            ["Regular-session price", '=TICKERSHEETS_QUOTE($B$4,"regular_price")', "The provider's regular-session price."],
            ["After-hours price", '=TICKERSHEETS_QUOTE($B$4,"post_market_price")', "N/A when the provider has no after-hours quote."],
            ["Price session", '=TICKERSHEETS_QUOTE($B$4,"price_session")', "Which session supplied Latest price."],
            ["Quote time (UTC)", '=TICKERSHEETS_QUOTE($B$4,"quote_time")', "When the provider observed Latest price."],
            ["P/E (trailing)", '=TICKERSHEETS_FUNDAMENTALS($B$4,"trailing_pe")', "Price divided by trailing earnings per share."],
            ["EPS (trailing)", '=TICKERSHEETS_FUNDAMENTALS($B$4,"eps_ttm")', "Trailing earnings per share, in the quote currency."],
            ["Dividend yield", '=TICKERSHEETS_FUNDAMENTALS($B$4,"dividend_yield")', "A fraction displayed as a percentage."],
            ["Next earnings date", '=TICKERSHEETS_FUNDAMENTALS($B$4,"earnings_date")', "The provider's published date; it can change."]
        ];
    }

    static build(book) {
        if (!book || typeof book.getSheetByName !== "function") throw new Error("Open a spreadsheet first.");
        TickerSheetsShowcase.preflight(book);
        TickerSheetsOptionsShowcase.preflight(book);
        let sheet = book.getSheetByName("Start here");
        if (sheet && sheet.getRange("Z1").getValue() !== TickerSheetsDemoGenerator.marker) throw new Error("The existing Start here tab is not managed by TickerSheets. Rename it before creating the tutorial.");
        const optionInputs = TickerSheetsOptionsShowcase.savedInputs(book);
        const previous = sheet?.getRange("Z2").getValue() === "TICKERSHEETS_TUTORIAL_V1"
            ? sheet.getRange("B4").getValue() : undefined;
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
        sheet.getRange("A3:D3").merge().setFormula('=HYPERLINK("https://github.com/dnarain/tickersheets","TickerSheets on GitHub — code, guide and updates")').setFontColor("#1155CC");
        sheet.getRange("A4").setValue("Try a ticker").setFontWeight("bold");
        sheet.getRange("B4").setValue(ticker).setBackground("#FFF2CC").setFontColor("#0000FF").setFontWeight("bold");
        sheet.getRange("C4:D4").merge().setValue("Change B4 to try another stock. All examples below read this one cell.").setWrap(true);
        TickerSheetsDemoGenerator.header(sheet, "A6:D6", ["Example", "Result", "Formula for reference", "What it returns"]);
        const examples = TickerSheetsDemoGenerator.examples();
        sheet.getRange("A7:A15").setValues(examples.map(row => [row[0]]));
        sheet.getRange("B7:B15").setFormulas(examples.map(row => [row[1]]));
        sheet.getRange("C7:C15").setFormulas(examples.map((_, i) => ['=FORMULATEXT(B' + (i + 7) + ')'])).setFontFamily("Courier New").setFontSize(10);
        sheet.getRange("D7:D15").setValues(examples.map(row => [row[2]]));
        sheet.getRange("A7:D15").setWrap(true); sheet.setRowHeights(7, 9, 42);
        sheet.getRange("B7:B9").setNumberFormat("#,##0.00"); sheet.getRange("B12:B13").setNumberFormat("#,##0.00");
        sheet.getRange("B14").setNumberFormat("0.0%"); sheet.getRange("B10:B11").setNumberFormat("@"); sheet.getRange("B15").setNumberFormat("@");
        sheet.getRange("A17:D17").merge().setValue("N/A means the provider did not supply that value. Quotes can be delayed. These stock examples use Yahoo Finance and do not require your own API key.").setWrap(true); sheet.setRowHeights(17, 1, 44);
        TickerSheetsDemoGenerator.header(sheet, "A19:D19", ["Set up your own spreadsheet", "", "", ""]);
        const setup = [
            "Copy this example: File → Make a copy includes its attached Apps Script. Reload your editable copy to see the TickerSheets menu. The public example has no saved API keys.",
            "Start with a blank sheet: open Extensions → Apps Script and add a script file named TickerSheets. Paste dist/TickerSheets.js into that file, save and reload the spreadsheet. Keep any existing script files.",
            "Optional keys: choose TickerSheets → API keys… and enter your own provider key. FRED requires a FRED key. Keep a copy with saved keys private; spreadsheet editors can read those keys.",
            "Get newer data: choose TickerSheets → Refresh data and wait for the results. Stock analysis shows company research; Options analysis shows option quotes and calculators. You can also type the functions in your own cell layout."
        ];
        setup.forEach((text, i) => { const row = 20 + i * 2; sheet.getRange("A" + row + ":D" + (row + 1)).merge().setValue(text).setWrap(true); sheet.setRowHeights(row, 2, 24); });
        TickerSheetsDemoGenerator.header(sheet, "A29:D29", ["More functions to try", "", "Formula to enter", "What it returns"]);
        const tables = [
            ["Daily prices", '=TICKERSHEETS_HISTORY($B$4,30)', "Returns a header and up to 30 daily OHLCV rows."],
            ["Option expiration dates", '=TICKERSHEETS_EXPIRATIONS($B$4)', "Returns the dates published by the provider."],
            ["Option chain", '=TICKERSHEETS_OPTIONS($B$4)', "Returns the nearest available chain; an optional second argument chooses a date."],
            ["Reported earnings", '=TICKERSHEETS_EARNINGS($B$4,"earnings")', "Returns reported EPS, estimates and the accounting basis."],
            ["FRED observations", '=TICKERSHEETS_FRED("DGS10",12)', "Requires your own FRED key; returns dates and observations."],
            ["Optional keyed quote", '=TICKERSHEETS_PROVIDER_QUOTE($B$4,"FINNHUB","price")', "Requires your own provider key. Choose Finnhub, Alpha Vantage, Twelve Data or CoinMarketCap explicitly."]
        ];
        sheet.getRange("A30:A35").setValues(tables.map(row => [row[0]]));
        // A leading apostrophe keeps these examples as text, so no table requests run here.
        sheet.getRange("C30:C35").setValues(tables.map(row => ["'" + row[1]])).setFontFamily("Courier New").setFontSize(10);
        sheet.getRange("D30:D35").setValues(tables.map(row => [row[2]])); sheet.getRange("A30:D35").setWrap(true); sheet.setRowHeights(30, 6, 44);
        sheet.getRange("A36:D36").merge().setValue("Table functions fill neighboring cells. Try them in an empty area or a tab you create, with room for the returned rows and columns.").setWrap(true); sheet.setRowHeights(36, 1, 42);
        sheet.getRange("A38:D38").merge().setFormula('=HYPERLINK("https://github.com/dnarain/tickersheets/blob/main/FUNCTIONS.md","Open the full function reference")').setFontColor("#1155CC");
        sheet.getRange("A39:D39").merge().setFormula('=HYPERLINK("https://github.com/dnarain/tickersheets/blob/main/GUIDE.md","User guide: setup, formulas and API keys")').setFontColor("#1155CC");
        sheet.setColumnWidth(1, 205); sheet.setColumnWidth(2, 175); sheet.setColumnWidth(3, 535); sheet.setColumnWidth(4, 420);
        sheet.getRange("Z1:Z2").setValues([[TickerSheetsDemoGenerator.marker], ["TICKERSHEETS_TUTORIAL_V1"]]); sheet.hideColumns(26);
        TickerSheetsOptionsShowcase.build(book, optionInputs);
        TickerSheetsShowcase.build(book);
        const stock = book.getSheetByName("Stock analysis"), options = book.getSheetByName("Options analysis");
        stock.getRange("A3:N3").merge().setFormula('=HYPERLINK("#gid=' + options.getSheetId() + '&range=A6","Open Options analysis: quotes, expirations and strategy calculators →")').setFontColor("#1155CC");
        if (typeof book.moveActiveSheet === "function") {
            book.setActiveSheet(sheet); book.moveActiveSheet(1);
            book.setActiveSheet(stock); book.moveActiveSheet(2);
            book.setActiveSheet(options); book.moveActiveSheet(3);
        }
        book.setActiveSheet(sheet);
        book.toast("Demo ready. Start here teaches formulas; Stock analysis and Options analysis show the research examples.", "TickerSheets", 8);
        return { ok: true, sheets: ["Start here", "Stock analysis", "Options analysis"], ticker };
    }

    static header(sheet, address, values) {
        sheet.getRange(address).setValues([values]).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold").setWrap(true);
    }

    static inspect(book) {
        const sheet = book?.getSheetByName("Start here");
        const grid = sheet ? TickerSheetsShowcase.readGrid(sheet) : null;
        if (!sheet || TickerSheetsShowcase.readCell(sheet, "Z2", undefined, grid).value !== "TICKERSHEETS_TUTORIAL_V1") return { ok: false, error: "The demo is not installed." };
        const rows = TickerSheetsDemoGenerator.examples().map(([label, expected], i) => ({ label, ...TickerSheetsShowcase.readCell(sheet, "B" + (i + 7), expected, grid) }));
        const showcase = TickerSheetsShowcase.inspect(book);
        const options = TickerSheetsOptionsShowcase.inspect(book);
        return { ok: rows.every(row => row.matches && !row.error && !row.pending && row.status !== "Not calculated") && typeof rows[0].value === "number" && Number.isFinite(rows[0].value) && rows[0].value > 0 && showcase.ok && options.ok, showcase, options, sheets: book.getSheets().map(tab => tab.getName()), ticker: TickerSheetsShowcase.readCell(sheet, "B4", undefined, grid).value, rows };
    }
}

/** Optional developer helper for rebuilding the example spreadsheet. */
function TickerSheetsBuildDemo() { return TickerSheetsDemoGenerator.build(SpreadsheetApp.getActiveSpreadsheet()); }

/** Read the example's formulas and displayed results without requesting provider data. */
function TickerSheetsInspectDemo() {
    const result = TickerSheetsDemoGenerator.inspect(SpreadsheetApp.getActiveSpreadsheet());
    const summarize = rows => ({ checked: rows.length, available: rows.filter(row => row.status === "Available").length,
        errors: rows.filter(row => row.error).map(row => row.cell), pending: rows.filter(row => row.pending).map(row => row.cell),
        unavailable: rows.filter(row => row.unavailable).map(row => row.cell), mismatched: rows.filter(row => !row.matches).map(row => row.cell),
        uncalculated: rows.filter(row => row.status === "Not calculated").map(row => row.cell) });
    const summary = { ok: result.ok, ticker: result.ticker, sheets: result.sheets,
        tutorial: summarize(result.rows || []), showcase: summarize(result.showcase?.rows || []), optionsTab: summarize(result.options?.rows || []),
        charts: { stock: result.showcase?.charts, options: result.options?.charts },
        tickers: { tutorial: result.ticker, stock: result.showcase?.ticker, options: result.options?.ticker }, options: result.options?.options };
    if (result.error) summary.error = result.error;
    console.log("TICKERSHEETS_TUTORIAL_CHECK " + JSON.stringify(summary));
    return result;
}
