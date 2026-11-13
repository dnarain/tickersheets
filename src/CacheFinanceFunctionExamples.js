/*  *** DEBUG START ***
import { CFWorkbookNames } from "./CacheFinanceSheetNames.js";
export { CFFunctionExamples, CFBuildFormulaExamples, CFRefreshFormulaExamples };
//  *** DEBUG END ***/

class CFFunctionExamples {
    static catalog() {
        return [
            ["CFQUOTE", 'CFQUOTE(ticker,field,refresh)', 'price, name, currency, quote_time or all', "Quote currency; volumes in shares"],
            ["CFHISTORY", 'CFHISTORY(ticker,sessions,refresh)', '1–510 daily sessions; seven columns', "Adjusted close supplied separately"],
            ["CFFUNDAMENTALS", 'CFFUNDAMENTALS(ticker,field,refresh)', 'Named field or all; e.g. trailing_pe, target_price', "Fractions retain their source units"],
            ["CFOPTIONS", 'CFOPTIONS(ticker,expiration,refresh)', 'One published YYYY-MM-DD expiration', "IV fraction; standard contracts only"],
            ["CFEXPIRATIONS", 'CFEXPIRATIONS(ticker,refresh)', 'Published option expiration dates', "Date text in YYYY-MM-DD format"],
            ["CFFRED", 'CFFRED(seriesId,observations,refresh)', '1–1000 levels; key comes from settings', "Published units, dates and source"],
            ["CFFREDVALUE", 'CFFREDVALUE(seriesId,date,refresh)', 'Exact observation date; no earlier-date fallback', "Published units; key comes from settings"],
            ["CFRSITARGETS", 'CFRSITARGETS(ticker,lowTrigger,highTrigger,field,refresh)', 'RSI2 targets; named field, all or headers', "Quoted regular session; 21 completed prior closes"],
            ["CFFIELD", 'CFFIELD(provider,ticker,field,refresh)', 'Finviz, Zacks or GuruFocus; field name or numeric ID', "Selected provider fields; see CFFIELD all"],
            ["CFDATASTATUS", 'CFDATASTATUS(ticker,dataset,argument,refresh)', 'quote/history/fundamentals/options/fred/provider', "Retrieval time, quote time and cache flag"],
            ["CFOPTIONMODEL", 'CFOPTIONMODEL(spot,strike,days,iv,rate,yield,type,metric)', 'European Black–Scholes premium and Greeks', "Annual fractions; theta/day; vega/rho per point"],
            ["CFSTRATEGY", 'CFSTRATEGY(strategy,spot,longStrike,longPremium,shortStrike,shortPremium,contracts,multiplier,expiration,metric,stockAtExpiry)', 'Covered call, cash-secured put, call/put vertical', "Whole-position cash amounts"],
            ["CACHEFINANCE", 'CACHEFINANCE(symbol,attribute,googleResult)', 'Original CacheFinance scalar lookup', "Original provider and caching behavior"],
            ["CACHEFINANCES", 'CACHEFINANCES(symbols,attribute,googleResults)', 'Original CacheFinance range lookup', "Original provider and caching behavior"]
        ];
    }
    static check(book) {
        CFWorkbookNames.migrate(book);
        const sheet = book.getSheetByName("Formulas");
        if (sheet && sheet.getRange("Z1").getValue() !== "CACHEFINANCE_FUNCTIONS_V1") throw new Error("Rename the existing Formulas tab before building the examples.");
    }
    static build(book) {
        if (typeof CFFormulaWorkbook !== "undefined" && CFFormulaWorkbook.isFormulaBook(book) && typeof CFFormulaViews !== "undefined") return CFFormulaViews.buildFormulas(book);
        CFFunctionExamples.check(book);
        const existing = book.getSheetByName("Formulas"), counter = existing?.getRange("E4").getValue();
        const sheet = existing || book.insertSheet("Formulas");
        if (sheet.getMaxColumns() < 26) sheet.insertColumnsAfter(sheet.getMaxColumns(), 26 - sheet.getMaxColumns());
        if (sheet.getMaxRows() < 160) sheet.insertRowsAfter(sheet.getMaxRows(), 160 - sheet.getMaxRows());
        sheet.getRange(1, 1, sheet.getMaxRows(), 25).breakApart().clear(); sheet.setRowHeights(1, sheet.getMaxRows(), 21);
        sheet.setHiddenGridlines(true); sheet.setFrozenRows(4); sheet.setColumnWidths(1, 25, 145);
        sheet.getRange("A1:M1").merge().setValue("Spreadsheet functions and working examples").setFontSize(14).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2:M2").merge().setValue("The ticker follows Analysis!B4. Increment the yellow refresh number to request a new formula result.");
        sheet.getRange("A4").setValue("Ticker");
        if (book.getSheetByName("Analysis")) sheet.getRange("B4").setFormula("=Analysis!B4"); else sheet.getRange("B4").setValue("NVDA");
        sheet.getRange("D4").setValue("Refresh number"); sheet.getRange("E4").setValue(Number.isInteger(counter) && counter >= 0 && counter <= 2147483647 ? counter : 1).setBackground("#FFF2CC").setFontColor("#0000FF");
        sheet.getRange("A7:D7").setValues([["Function", "Arguments", "Result", "Units / notes"]]).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold");
        const catalog = CFFunctionExamples.catalog();
        sheet.getRange(8, 1, catalog.length, 4).setValues(catalog).setWrap(true); sheet.setColumnWidth(2, 400); sheet.setColumnWidth(3, 360); sheet.setColumnWidth(4, 330);
        const examples = [["Price", '=CFQUOTE($B$4,"price",$E$4)'], ["Trailing P/E", '=CFFUNDAMENTALS($B$4,"trailing_pe",$E$4)'],
            ["Quote timestamp", '=CFQUOTE($B$4,"quote_time",$E$4)'], ["Finviz price", '=CFFIELD("FINVIZ",$B$4,"price",$E$4)'],
            ["Latest DGS10 percent level", '=IFERROR(INDEX(CFFRED("DGS10",1,$E$4),2,2),"N/A: FRED data unavailable; check API key settings")'], ["First published expiration", '=IFERROR(INDEX(CFEXPIRATIONS($B$4,$E$4),2,1),"N/A: option expiration data unavailable")'],
            ["Model example: 100 spot/strike, 30 days, 25% IV", '=CFOPTIONMODEL(100,100,30,0.25,0.04,0,"Call","price")'],
            ["Latest DGS2 percent level", '=IFERROR(INDEX(CFFRED("DGS2",1,$E$4),2,2),"N/A: FRED data unavailable; check API key settings")']];
        sheet.getRange("A22:B22").setValues([["Live examples / labeled model example", "Result"]]).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold");
        sheet.getRange(23, 1, examples.length, 1).setValues(examples.map(row => [row[0]])); sheet.getRange(23, 2, examples.length, 1).setFormulas(examples.map(row => [row[1]]));
        const lookupExamples = [["Current regular-session RSI2", '=CFRSITARGETS($B$4,20,80,"rsi2",$E$4)'],
            ["RSI2 buy trigger target", '=CFRSITARGETS($B$4,20,80,"buy_target",$E$4)'], ["RSI2 sell trigger target", '=CFRSITARGETS($B$4,20,80,"sell_target",$E$4)'],
            ["FRED exact observation date", '=CFFREDVALUE($K$24,$K$25,$E$4)'],
            ["DGS10 weekend: expected N/A", '=CFFREDVALUE("DGS10","2026-11-07",$E$4)'], ["Last published after-hours price", '=CFQUOTE($B$4,"post_market_price",$E$4)'],
            ["Session for the displayed price", '=CFQUOTE($B$4,"price_session",$E$4)']];
        sheet.getRange("G22:I22").setValues([["Added lookups", "Result", "Basis"]]).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold");
        sheet.getRange(23, 7, lookupExamples.length, 1).setValues(lookupExamples.map(row => [row[0]])).setWrap(true);
        sheet.getRange(23, 8, lookupExamples.length, 1).setNumberFormat("0.00"); sheet.getRange("H29").setNumberFormat("@");
        sheet.getRange(23, 8, lookupExamples.length, 1).setFormulas(lookupExamples.map(row => [row[1]]));
        sheet.getRange(23, 9, lookupExamples.length, 1).setValues([["RSI scale 0–100"], ["Price per share; unavailable targets stay N/A"], ["Price per share; unavailable targets stay N/A"], ["Series units; date is an observation period"], ["No fallback to a prior business day"], ["Source timestamp is available through CFQUOTE"], ["Regular, pre-market or after-hours"]]).setWrap(true);
        sheet.getRange("J24").setValue("FRED series"); sheet.getRange("K24").setNumberFormat("@").setValue("DGS10").setBackground("#FFF2CC");
        sheet.getRange("J25").setValue("Observation date"); sheet.getRange("K25").setNumberFormat("@").setValue("2026-11-05").setBackground("#FFF2CC");
        for (const [cell, label] of [["A33", "Fundamentals with field names and units"], ["G33", "Most recent 60 daily bars"], ["O33", "Published expiration dates"], ["Q33", "DGS10: 12 observations"], ["A109", "First 20 standard option contracts for the earliest expiration"]]) sheet.getRange(cell).setValue(label).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A34:E100").setNumberFormat("@"); sheet.getRange("G34:M100").setNumberFormat("0.00"); sheet.getRange("G34:G100").setNumberFormat("@");
        sheet.getRange("O34:O100").setNumberFormat("@"); sheet.getRange("Q34:U100").setNumberFormat("@"); sheet.getRange("R35:R100").setNumberFormat("0.00");
        sheet.getRange("A34").setFormula('=CFFUNDAMENTALS($B$4,"all",$E$4)'); sheet.getRange("G34").setFormula('=CFHISTORY($B$4,60,$E$4)');
        sheet.getRange("O34").setFormula('=CFEXPIRATIONS($B$4,$E$4)'); sheet.getRange("Q34").setFormula('=CFFRED("DGS10",12,$E$4)');
        sheet.getRange("A110").setFormula('=IFERROR(ARRAY_CONSTRAIN(CFOPTIONS($B$4,INDEX(CFEXPIRATIONS($B$4,$E$4),2,1),$E$4),21,12),"N/A: option chain data unavailable")');
        sheet.getRange("A110:L130").setNumberFormat("0.00"); sheet.getRange("A110:B130").setNumberFormat("@"); sheet.getRange("I110:J130").setNumberFormat("#,##0"); sheet.getRange("K110:L130").setNumberFormat("@");
        sheet.getRange("A133:L133").merge().setValue("RSI2 and trigger targets for the quoted regular session; missing bid/ask or unattainable targets stay N/A").setWrap(true).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A135:L136").setNumberFormat("0.00"); sheet.getRange("A135").setFormula('=CFRSITARGETS($B$4,20,80,"all",$E$4)');
        sheet.getRange("Z1").setValue("CACHEFINANCE_FUNCTIONS_V1"); sheet.hideColumns(26);
        return { ok: true, functions: catalog.length, sheet: "Formulas" };
    }
    static refresh(book) {
        if (typeof CFFormulaWorkbook !== "undefined" && CFFormulaWorkbook.isFormulaBook(book) && typeof CFRefreshAnalysis === "function") return CFRefreshAnalysis();
        CFFunctionExamples.check(book);
        const sheet = book.getSheetByName("Formulas");
        if (!sheet) return CFFunctionExamples.build(book);
        const input = sheet.getRange("E4").getValue(), value = typeof input === "number" || typeof input === "string" && /^\d{1,10}$/.test(input) ? Number(input) : NaN;
        sheet.getRange("E4").setValue(Number.isInteger(value) && value >= 0 && value < 2147483647 ? value + 1 : 1);
        return { ok: true, refresh: sheet.getRange("E4").getValue() };
    }
}
function CFBuildFormulaExamples() { return CFFunctionExamples.build(SpreadsheetApp.getActiveSpreadsheet()); }
function CFRefreshFormulaExamples() { return CFFunctionExamples.refresh(SpreadsheetApp.getActiveSpreadsheet()); }
