/*  *** DEBUG START ***
import { CFFormulaWorkbook } from "./CacheFinanceFormulaWorkbook.js";
import { CFFunctionExamples } from "./CacheFinanceFunctionExamples.js";
import { CFFormulaWatchlist } from "./CacheFinanceFormulaWatchlist.js";
import { CFPublicData } from "./CacheFinanceResearchFunctions.js";
export { CFFormulaViews };
//  *** DEBUG END ***/

/** Author cell formulas and instructions. No provider requests or financial calculations run here. */
class CFFormulaViews {
    static core() { return CFFormulaWorkbook; }
    static buildWatchlist(book, priorInputs) { return CFFormulaWatchlist.build(book, priorInputs); }
    static buildControl(book, input) {
        const W = CFFormulaViews.core(), sheet = W.prepareSheet(book, "Analysis", "CACHEFINANCE_ANALYSIS_V1");
        W.heading(sheet, "Stock analysis", "Yellow cells are inputs. Price and company values use simple custom formulas you can copy to your own sheet.");
        sheet.setFrozenRows(8); sheet.setColumnWidth(1, 235); sheet.setColumnWidth(2, 145); sheet.setColumnWidth(3, 205); sheet.setColumnWidth(4, 155); sheet.setColumnWidth(8, 225); sheet.setColumnWidth(9, 210);
        sheet.getRange("A4").setValue("Ticker"); W.input(sheet, "B4", input.ticker);
        sheet.getRange("Z4").setValue(input.refresh).setNumberFormat("0");
        sheet.getRange("J4").setValue("Calculation date"); W.input(sheet, "K4", W.setCalculationDate(book)).setNumberFormat("@");
        sheet.getRange("J5:L6").merge().setValue("Option days and maturity targets use this date. Refresh sets it to the current date in the spreadsheet's time zone.").setWrap(true).setFontSize(9);
        sheet.getRange("G4").setValue("Status"); sheet.getRange("H4:I4").merge().setFormula('=IF(ISNUMBER(B9),"Quote loaded; see Sources","Quote loading or unavailable; see Sources")').setWrap(true);
        sheet.getRange("A5").setValue("Yahoo symbol"); sheet.getRange("B5").setFormula('=UPPER(TRIM(B4))');
        sheet.getRange("D5").setValue("Company"); sheet.getRange("E5:F5").merge().setFormula('=CFQUOTE($B$4,"name")');
        sheet.getRange("G5:I5").merge().setFormula('=IF($Z$3="","",$Z$3)').setWrap(true).setFontSize(9).setFontColor("#9C5700");
        sheet.getRange("A6").setValue("Currency"); sheet.getRange("B6").setFormula('=CFQUOTE($B$4,"currency")');
        sheet.getRange("D6").setValue("Indicators through"); sheet.getRange("E6").setFormula("='Price history'!$BL$5").setNumberFormat("@");
        sheet.getRange("G6").setValue("Price session"); sheet.getRange("H6").setFormula('=CFQUOTE($B$4,"price_session")');
        sheet.getRange("D7:I7").merge().setValue("Click a price or company result to see its CFQUOTE or CFFUNDAMENTALS formula. Quote timestamps ending Z use UTC.").setFontSize(9).setFontColor("#596579");
        W.header(sheet, "A8:C8", ["Metric", "Value", "Basis"]);
        const metrics = [
            ["Price", '=CFQUOTE($B$4,"price")', "Selected session"], ["Quote time", '=CFQUOTE($B$4,"quote_time")', "Provider observation; UTC"],
            ["1-day adjusted return", "='Price history'!$BL$14", "Adjusted close"], ["1-month adjusted return", "='Price history'!$BL$16", "21 sessions"],
            ["3-month adjusted return", "='Price history'!$BL$17", "63 sessions"], ["1-year adjusted return", "='Price history'!$BL$19", "252 sessions"],
            ["YTD adjusted return", "='Price history'!$BL$22", "Last prior-year close"], ["RSI14", "='Price history'!$BL$10", "Wilder; inspect Price history helpers"],
            ["SMA50", "='Price history'!$BL$8", "Average of 50 daily closes"], ["SMA200", "='Price history'!$BL$9", "Average of 200 daily closes"],
            ["20-day annualized volatility", "='Price history'!$BL$23", "Adjusted log returns; 252 sessions"], ["Maximum observed drawdown", "='Price history'!$BL$24", "Loaded adjusted history"],
            ["MACD", "='Price history'!$BL$11", "EMA12 minus EMA26"], ["MACD signal", "='Price history'!$BL$12", "9-period EMA of MACD"],
            ["20-day average volume", "='Price history'!$BL$26", "Daily shares"], ["History sessions", "='Price history'!$BL$27", "Published closes"]
        ];
        sheet.getRange(9, 1, metrics.length, 1).setValues(metrics.map(row => [row[0]]));
        sheet.getRange(9, 2, metrics.length, 1).setFormulas(metrics.map(row => [row[1]]));
        sheet.getRange(9, 3, metrics.length, 1).setValues(metrics.map(row => [row[2]])).setWrap(true);
        sheet.getRange("B9:B24").setNumberFormat("#,##0.00"); sheet.getRange("B10").setNumberFormat("@").setWrap(true); sheet.setRowHeights(10, 1, 34);
        sheet.getRangeList(["B11:B15", "B19:B20"]).setNumberFormat("0.00%"); sheet.getRange("B23:B24").setNumberFormat("#,##0");
        W.header(sheet, "D8:I8", ["Provider / session", "Price", "Yield", "Identity", "Quote time (UTC)", "Status"]);
        const comparison = Array.from({ length: 6 }, (_, i) => ["D", "E", "F", "H", "I", "K"].map(col => '=IF(ISBLANK(\'Quote data\'!' + col + (i + 8) + '),"N/A",\'Quote data\'!' + col + (i + 8) + ')'));
        sheet.getRange("D9:I14").setFormulas(comparison).setWrap(true); sheet.getRange("E9:E14").setNumberFormat("0.00"); sheet.getRange("F9:F14").setNumberFormat("0.00%");
        W.header(sheet, "D15:F15", ["Metric", "Value", "Basis"]);
        const company = [["Market cap", 'CFFUNDAMENTALS($B$4,"market_cap")', "Yahoo; quote currency"], ["P/E (trailing)", 'CFFUNDAMENTALS($B$4,"trailing_pe")', "Trailing 12 months"],
            ["EPS (trailing)", 'CFFUNDAMENTALS($B$4,"eps_ttm")', "Quote currency / share"], ["Dividend yield", 'CFFUNDAMENTALS($B$4,"dividend_yield")', "Forward fraction"],
            ["Analyst target", 'CFFUNDAMENTALS($B$4,"target_price")', "Provider mean target"], ["Next earnings", 'CFFUNDAMENTALS($B$4,"earnings_date")', "Provider date; see Earnings"],
            ["Loaded option contracts", 'Options!$Y$7', "Selected expiration"], ["Nearest expiration", 'IFERROR(INDEX(CFEXPIRATIONS($B$4),2,1),"N/A")', "Published date"], ["ATM IV", 'Options!$Y$4', "Same-strike call/put mean"]];
        sheet.getRange(16, 4, company.length, 1).setValues(company.map(row => [row[0]])); sheet.getRange(16, 5, company.length, 1).setFormulas(company.map(row => ['=' + row[1]])); sheet.getRange(16, 6, company.length, 1).setValues(company.map(row => [row[2]])).setWrap(true);
        sheet.getRange("E16:E24").setNumberFormat("#,##0.00"); sheet.getRange("E16").setNumberFormat('0.00,,,,"T"'); sheet.getRange("E19").setNumberFormat("0.00%"); sheet.getRange("E21:E23").setNumberFormat("@"); sheet.getRange("E24").setNumberFormat("0.00%");
        // The six-month chart reads worksheet results, including the visible moving averages.
        W.header(sheet, "O29:R29", ["Date", "Close", "SMA50", "SMA200"]);
        const rows = Array.from({ length: 126 }, (_, offset) => {
            const index = 'MAX(1,\'Price history\'!$Y$4-125)+' + offset;
            return ["A", "E", "I", "J"].map((col, j) => '=IF(AND(\'Price history\'!$Y$4>0,' + index + '<=\'Price history\'!$Y$4),IF(' + (j ? 'ISNUMBER(INDEX(\'Price history\'!$' + col + '$8:$' + col + '$517,' + index + '))' : 'INDEX(\'Price history\'!$A$8:$A$517,' + index + ')<>""') + ',' + (j ? 'INDEX(\'Price history\'!$' + col + '$8:$' + col + '$517,' + index + ')' : 'DATEVALUE(INDEX(\'Price history\'!$A$8:$A$517,' + index + '))') + ',NA()),NA())');
        });
        sheet.getRange("O30:R155").setFormulas(rows); sheet.getRange("O30:O155").setNumberFormat("yyyy-mm-dd"); sheet.getRange("P30:R155").setNumberFormat("0.00");
        const ticker = input.ticker, history = book.getSheetByName("Price history");
        if (typeof sheet.newChart === "function") {
            const chart = (source, ranges, title, row, min, max) => {
                let builder = sheet.newChart().setChartType(Charts.ChartType.LINE).setNumHeaders(1).setPosition(row, 1, 0, 0).setOption("title", ticker + " — " + title).setOption("width", 1030).setOption("height", 300).setOption("fontName", "Arial").setOption("colors", ["#17365D", "#2C8B8B", "#D99520"]);
                ranges.forEach(range => builder.addRange(source.getRange(range))); if (min !== undefined) builder = builder.setOption("vAxis", { viewWindow: { min, max } }); sheet.insertChart(builder.build());
            };
            chart(sheet, ["O29:R155"], "6-month close, SMA50 and SMA200", 28);
            chart(history, ["A7:A517", "S7:U517"], "Adjusted growth vs SPY / QQQ", 47);
            chart(history, ["A7:A517", "P7:P517", "V7:W517"], "RSI14 with 30 / 70 levels", 66, 0, 100);
        }
    }

    static selectedMetrics() {
        const W = CFFormulaViews.core(), q = W.quote, f = W.fundamental, t = W.technical;
        return [["status", 'IF(ISNUMBER(' + q("price") + '),"Available","Loading or unavailable")'], ["price", q("price")], ["currency", q("currency")],
            ["quote_time", q("quote_time")], ["retrieved_at", q("retrieved_at")], ["indicator_as_of", t("Indicator date")], ["return1d", t("1-day adjusted return")],
            ["return1m", t("1-month adjusted return")], ["return1y", t("1-year adjusted return")], ["rsi14", t("RSI14")], ["sma50", t("SMA50")], ["sma200", t("SMA200")],
            ["volatility20d", t("20-day annualized volatility")], ["trailing_pe", f("trailing_pe")], ["eps_ttm", f("eps_ttm")], ["market_cap", f("market_cap")], ["target_price", f("target_price")],
            ["next_earnings", 'IFNA(INDEX(Earnings!$AQ$8:$AQ$20,MATCH("next_earnings_date",Earnings!$AP$8:$AP$20,0)),"N/A")'], ["source", q("source")], ["price_session", q("price_session")],
            ["atm_iv", 'Options!$Y$4'], ["return3m", t("3-month adjusted return")], ["return_ytd", t("YTD adjusted return")], ["max_drawdown", t("Maximum observed drawdown")],
            ["macd", t("MACD")], ["macd_signal", t("MACD signal")], ["average_volume20", t("20-day average volume")], ["bar_count", t("Priced bar count")],
            ["previous_rsi2", 'IF(ISNUMBER($L$71),$L$71,"N/A")'], ["previous_close", t("Previous close")]];
    }

    static quoteFields() { return Object.keys(CFPublicData.quoteFields({})); }

    static fundamentalFields() {
        return [["market_cap", "quote currency"], ["enterprise_value", "quote currency"], ["trailing_pe", "ratio"], ["forward_pe", "ratio"],
            ["eps_ttm", "quote currency / share"], ["eps_forward", "quote currency / share"], ["peg_ratio", "ratio"], ["price_to_book", "ratio"],
            ["price_to_sales", "ratio"], ["ev_revenue", "ratio"], ["ev_ebitda", "ratio"], ["beta", "ratio"], ["shares_outstanding", "shares"],
            ["float_shares", "shares"], ["short_shares", "shares"], ["short_float", "fraction"], ["insider_ownership", "fraction"],
            ["institutional_ownership", "fraction"], ["short_ratio", "days"], ["forward_dividend_rate", "quote currency / share"], ["dividend_yield", "fraction"],
            ["trailing_dividend_yield", "fraction"], ["payout_ratio", "fraction"], ["total_cash", "reporting currency"], ["total_debt", "reporting currency"],
            ["total_revenue", "reporting currency"], ["ebitda", "reporting currency"], ["free_cashflow", "reporting currency"], ["operating_cashflow", "reporting currency"],
            ["gross_margin", "fraction"], ["operating_margin", "fraction"], ["net_margin", "fraction"], ["return_on_equity", "fraction"], ["return_on_assets", "fraction"],
            ["revenue_growth", "fraction"], ["earnings_growth", "fraction"], ["current_ratio", "ratio"], ["quick_ratio", "ratio"], ["debt_to_equity", "fraction"],
            ["target_low", "quote currency / share"], ["target_price", "quote currency / share"], ["target_median", "quote currency / share"], ["target_high", "quote currency / share"],
            ["analyst_count", "analysts"], ["fund_assets", "quote currency"], ["expense_ratio", "fraction"], ["fund_yield", "fraction"], ["ytd_return", "fraction"],
            ["previous_close", "quote currency / share"], ["open", "quote currency / share"], ["bid", "quote currency / share"], ["ask", "quote currency / share"],
            ["day_low", "quote currency / share"], ["day_high", "quote currency / share"], ["fifty_two_week_low", "quote currency / share"], ["fifty_two_week_high", "quote currency / share"],
            ["volume", "shares"], ["average_volume", "shares"], ["earnings_date", "date text"], ["ex_dividend_date", "date text"], ["net_assets", "quote currency"],
            ["nav", "quote currency / share"], ["inception_date", "date text"]];
    }

    static buildQuoteData(book) {
        const W = CFFormulaViews.core(), sheet = W.prepareSheet(book, "Quote data", "TICKERSHEETS_QUOTE_DATA_V1");
        W.heading(sheet, "Quote data", "Every value in column B has its own CFQUOTE formula. Column C shows that formula so you can copy it.");
        sheet.getRange("A4").setValue("Ticker"); sheet.getRange("B4").setFormula('=Analysis!B4');
        sheet.getRange("A6").setValue("Yahoo quote fields"); sheet.getRange("D6").setValue("Source comparison"); sheet.getRange("O6").setValue("Published expirations");
        W.header(sheet, "A7:C7", ["Field", "Value", "Formula"]);
        const fields = CFFormulaViews.quoteFields();
        sheet.getRange(8, 1, fields.length, 1).setValues(fields.map(field => [field]));
        sheet.getRange(8, 2, fields.length, 1).setFormulas(fields.map(field => ['=CFQUOTE($B$4,"' + field + '")']));
        sheet.getRange(8, 3, fields.length, 1).setFormulas(fields.map((_field, i) => ['=FORMULATEXT(B' + (i + 8) + ')'])).setWrap(true);
        sheet.getRange("D7").setFormula('=CFQUOTECOMPARE(Analysis!$B$4,Analysis!$Z$4)'); sheet.getRange("O7").setFormula('=CFEXPIRATIONS(Analysis!$B$4,Analysis!$Z$4,TRUE)');
        for (const address of ["D7:M7", "O7:P7"]) sheet.getRange(address).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold").setWrap(true);
        sheet.setColumnWidths(1, 15, 155); sheet.setColumnWidth(1, 220); sheet.setColumnWidth(2, 235); sheet.setColumnWidth(3, 430); sheet.getRange("B8:B65").setNumberFormat("0.########"); sheet.getRange("F8:F16").setNumberFormat("0.00%"); sheet.getRange("I8:J16").setNumberFormat("@"); sheet.getRange("O8:O207").setNumberFormat("@");
        sheet.hideColumns(16);
        fields.forEach((field, i) => { if (field.endsWith("_fraction")) sheet.getRange(i + 8, 2).setNumberFormat("0.00%"); });
        sheet.getRange("A68:L68").merge().setValue('RSI2 table starts at A70. For one value, use CFRSITARGETS with "rsi2", "buy_target" or "sell_target", as shown in Formulas. Missing targets remain N/A.').setWrap(true);
        sheet.getRange("A70").setFormula('=CFRSITARGETS(Analysis!$B$4,20,80,"all",Analysis!$Z$4)'); sheet.getRange("A70:L70").setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold"); sheet.getRange("A71:L71").setNumberFormat("0.00");
        W.header(sheet, "AA7:AB7", ["Selected-stock field", "Worksheet result"]);
        const metrics = CFFormulaViews.selectedMetrics(); sheet.getRange(8, 27, metrics.length, 1).setValues(metrics.map(row => [row[0]])); sheet.getRange(8, 28, metrics.length, 1).setFormulas(metrics.map(row => ['=' + row[1]])); sheet.setColumnWidth(27, 220); sheet.setColumnWidth(28, 235);
        sheet.getRange("AA4:AF4").merge().setValue("This shared watchlist summary references the displayed quote, fundamentals, earnings and history results.").setWrap(true);
    }

    static buildFundamentals(book) {
        const W = CFFormulaViews.core(), sheet = W.prepareSheet(book, "Fundamentals", "CACHEFINANCE_ANALYSIS_V1");
        W.heading(sheet, "Fundamentals", "Every value in column B uses CFFUNDAMENTALS. Column F shows its formula. Fractions such as 0.01 mean 1%.");
        sheet.getRange("A4").setValue("Ticker"); sheet.getRange("B4").setFormula('=Analysis!B4');
        W.header(sheet, "A7:G7", ["Field", "Value", "Unit", "Availability", "Source", "Formula", "Currency"]);
        const fields = CFFormulaViews.fundamentalFields();
        sheet.getRange(8, 1, fields.length, 1).setValues(fields.map(([field]) => [field]));
        sheet.getRange(8, 2, fields.length, 1).setFormulas(fields.map(([field]) => ['=CFFUNDAMENTALS($B$4,"' + field + '")']));
        sheet.getRange(8, 3, fields.length, 1).setValues(fields.map(([, unit]) => [unit]));
        sheet.getRange(8, 4, fields.length, 1).setFormulas(fields.map((_field, i) => ['=IF(OR(B' + (i + 8) + '="",B' + (i + 8) + '="N/A",LEFT(TO_TEXT(B' + (i + 8) + '),4)="N/A:"),"Unavailable","Returned")']));
        const metadata = (column, row) => 'IFNA(IF(INDEX($' + column + '$8:$' + column + '$200,MATCH($A' + row + ',$I$8:$I$200,0))="","N/A",INDEX($' + column + '$8:$' + column + '$200,MATCH($A' + row + ',$I$8:$I$200,0))),"N/A")';
        sheet.getRange(8, 5, fields.length, 1).setFormulas(fields.map((_field, i) => ['=' + metadata("M", i + 8)]));
        sheet.getRange(8, 6, fields.length, 1).setFormulas(fields.map((_field, i) => ['=FORMULATEXT(B' + (i + 8) + ')'])).setWrap(true);
        sheet.getRange(8, 7, fields.length, 1).setFormulas(fields.map((_field, i) => ['=' + metadata("L", i + 8)]));
        sheet.getRange("I5:M6").merge().setValue('Field metadata starts at I7. This table supplies each field\'s currency and source. Individual value formulas remain in column B.').setWrap(true);
        sheet.getRange("I7").setFormula('=CFFUNDAMENTALS($B$4,"all")'); sheet.getRange("I7:M7").setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold");
        sheet.setColumnWidth(1, 255); sheet.setColumnWidth(2, 175); sheet.setColumnWidth(3, 175); sheet.setColumnWidth(4, 145); sheet.setColumnWidth(5, 300); sheet.setColumnWidth(6, 470); sheet.setColumnWidth(7, 110); sheet.getRange("B8:B200").setNumberFormat("0.########"); sheet.getRange("E8:E200").setWrap(true);
        fields.forEach(([, unit], i) => { if (unit === "fraction") sheet.getRange(i + 8, 2).setNumberFormat("0.00%"); });
    }

    static buildFormulas(book) {
        const W = CFFormulaViews.core(), sheet = W.prepareSheet(book, "Formulas", "CACHEFINANCE_FUNCTIONS_V1");
        W.heading(sheet, "Functions and working formulas", "These examples call the custom functions directly. Copy a formula and point its ticker argument to your input cell.");
        sheet.getRange("A4").setValue("Ticker"); sheet.getRange("B4").setFormula('=Analysis!B4');
        const catalog = CFFunctionExamples.catalog().map(([name, args, result, unit]) => [name, args.replace(/,refresh\)/g, ")"), result, unit]);
        const additional = [["CFEARNINGS", 'CFEARNINGS(ticker,section)', "Reported EPS, financials, estimates, events and calendar", "One labeled table per section"], ["CFQUOTECOMPARE", 'CFQUOTECOMPARE(ticker)', "Six named provider/session comparisons", "Source values and timestamps remain separate"], ["CFWATCHROW", 'CFWATCHROW(ticker)', "One watchlist stock as labeled fields", "Selected-stock rows reuse the main source tables"]];
        W.header(sheet, "A7:D7", ["Function", "Arguments", "Result", "Units / notes"]); sheet.getRange(8, 1, catalog.length, 4).setValues(catalog).setWrap(true);
        // Keep the established result addresses and show each copyable formula beside it.
        sheet.getRange("A22:D24").clearContent();
        W.header(sheet, "A22:C22", ["Working examples", "Result", "Formula"]);
        const examples = [["Current-session price", '=CFQUOTE($B$4,"price")'], ["Trailing P/E", '=CFFUNDAMENTALS($B$4,"trailing_pe")'],
            ["Quote timestamp (UTC)", '=CFQUOTE($B$4,"quote_time")'], ["Finviz price", '=CFFIELD("FINVIZ",$B$4,"price")'],
            ["Most recent DGS10 observation (%)", '=IFERROR(INDEX(CFFRED("DGS10",1),2,2),"N/A: FRED data unavailable; check API key settings")'],
            ["First published expiration", '=IFERROR(INDEX(CFEXPIRATIONS($B$4),2,1),"N/A: option expiration data unavailable")'],
            ["Model example: 100 spot/strike, 30 days, 25% IV", '=CFOPTIONMODEL(100,100,30,0.25,0.04,0,"Call","price")'],
            ["Most recent DGS2 observation (%)", '=IFERROR(INDEX(CFFRED("DGS2",1),2,2),"N/A: FRED data unavailable; check API key settings")']];
        sheet.getRange(23, 1, examples.length, 1).setValues(examples.map(row => [row[0]])); sheet.getRange(23, 2, examples.length, 1).setFormulas(examples.map(row => [row[1]]));
        sheet.getRange(23, 3, examples.length, 1).setFormulas(examples.map((_row, i) => ['=FORMULATEXT(B' + (i + 23) + ')'])).setWrap(true);
        W.header(sheet, "G22:I22", ["Additional functions", "Result", "Formula"]);
        const extras = [["Current RSI2", '=CFRSITARGETS($B$4,20,80,"rsi2")'], ["RSI2 buy target", '=CFRSITARGETS($B$4,20,80,"buy_target")'], ["RSI2 sell target", '=CFRSITARGETS($B$4,20,80,"sell_target")'],
            ["Exact-date FRED example", '=CFFREDVALUE($K$24,$K$25)'], ["FRED weekend: expected N/A", '=CFFREDVALUE("DGS10","2026-11-07")'],
            ["Published after-hours price", '=CFQUOTE($B$4,"post_market_price")'], ["Selected price session", '=CFQUOTE($B$4,"price_session")']];
        sheet.getRange(23, 7, extras.length, 1).setValues(extras.map(row => [row[0]])); sheet.getRange(23, 8, extras.length, 1).setFormulas(extras.map(row => [row[1]])); sheet.getRange(23, 9, extras.length, 1).setFormulas(extras.map((_row, i) => ['=FORMULATEXT(H' + (i + 23) + ')'])).setWrap(true);
        sheet.getRange("J24").setValue("FRED series"); W.input(sheet, "K24", "DGS10"); sheet.getRange("J25").setValue("Observation date"); W.input(sheet, "K25", "2026-11-05").setNumberFormat("@");
        sheet.getRange("A33").setValue("One fundamental result formula"); sheet.getRange("A34").setFormula('=FORMULATEXT(Fundamentals!B8)');
        sheet.getRange("G33").setValue("Actual history source formula"); sheet.getRange("G34").setFormula('=FORMULATEXT(\'Price history\'!A7)');
        sheet.getRange("O33").setValue("Published expiration dates"); sheet.getRange("O34").setFormula('=CFEXPIRATIONS($B$4)');
        sheet.getRange("Q33").setValue("DGS2: optional multi-row table"); sheet.getRange("Q34").setFormula('=CFFRED("DGS2",12)');
        W.header(sheet, "A38:D38", ["Example", "Result", "Formula in that cell", "Where to inspect"]);
        const trace = [["Dashboard price", '=Analysis!B9', '=FORMULATEXT(Analysis!B9)', "Analysis!B9 calls CFQUOTE directly"], ["50-day moving average", '=Analysis!B17', '=FORMULATEXT(Analysis!B17)', "Price history!I57 shows an AVERAGE formula"], ["RSI14", '=Analysis!B16', '=FORMULATEXT(Analysis!B16)', "Price history!P22 shows Wilder RSI arithmetic"]];
        sheet.getRange("A39:A41").setValues(trace.map(row => [row[0]])); sheet.getRange("B39:C41").setFormulas(trace.map(row => row.slice(1, 3))).setWrap(true); sheet.getRange("D39:D41").setValues(trace.map(row => [row[3]])).setWrap(true);
        W.header(sheet, "A44:D44", ["More source functions", "Arguments", "Result", "Units / notes"]); sheet.getRange("A45:D47").setValues(additional).setWrap(true);
        sheet.setColumnWidth(1, 260); sheet.setColumnWidth(2, 260); sheet.setColumnWidth(3, 410); sheet.setColumnWidth(4, 410); sheet.setColumnWidth(7, 245); sheet.setColumnWidth(8, 175); sheet.setColumnWidth(9, 430);
        sheet.getRange("B23:B30").setNumberFormat("0.########"); sheet.getRange("B25").setNumberFormat("@"); sheet.getRange("B28").setNumberFormat("@"); sheet.getRange("H23:H28").setNumberFormat("0.00");
        sheet.getRange("A23:B30").setWrap(true); sheet.setRowHeights(23, 8, 36); sheet.getRange("A29").setWrap(true);
        return { ok: true, functions: catalog.length + additional.length, sheet: "Formulas", mode: "formulas" };
    }

    static buildGuide(book) {
        const W = CFFormulaViews.core(), sheet = W.prepareSheet(book, "Start here", "TICKERSHEETS_GUIDE_V1");
        sheet.getRange("A1:F1").merge().setValue("Learn TickerSheets by following its formulas").setFontSize(18).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2:F2").merge().setValue("Click a price or fundamental value to see a custom formula you can use in your own spreadsheet. The public sample contains no saved API keys.").setWrap(true);
        W.header(sheet, "A4:C4", ["Step", "What to do", "What you will learn"]);
        const steps = [[1, "Enter a stock in Analysis!B4. Choose Stock analysis → Refresh selected ticker.", "Choose the stock and request current data from the menu."],
            [2, "Click Analysis!B9. Copy its CFQUOTE formula to another sheet and point the ticker argument to your input cell.", "A price result can use one simple function. Quote data and Fundamentals show a formula beside each scalar result."],
            [3, "Open Price history. Click I57 for SMA50, then P22 for RSI14. Scroll right to the labeled helpers.", "Ordinary formulas calculate averages, momentum, returns and volatility from CFHISTORY results."],
            [4, "Open Earnings and Research. Inspect source anchors and comparison formulas.", "Reported data, accounting basis, periods and calculations remain separate."],
            [5, "Choose Options!B4. Inspect the CFOPTIONS formula at A7 and edit the yellow calculator inputs.", "Source quotes feed assumptions, model results and expiration payoff charts."],
            [6, "Try a strategy, add watchlist tickers, then choose Record journal snapshot after source results finish loading.", "Journal entries preserve a point-in-time record. Source refreshes do not rewrite that history."]];
        sheet.getRange("A5:C10").setValues(steps).setWrap(true); sheet.setRowHeights(5, 6, 58);
        sheet.getRange("A12:F12").merge().setValue('Try a new tab: enter NVDA in A1, then enter =CFQUOTE(A1,"price") in B1. Change A1 to research another stock.').setWrap(true); sheet.setRowHeights(12, 1, 34);
        W.header(sheet, "A13:D13", ["Example", "Value", "Formula in Analysis!B9", "Formula in Quote data!B8"]);
        sheet.getRange("A14").setValue("Selected price"); sheet.getRange("B14").setFormula('=Analysis!B9'); sheet.getRange("C14").setFormula('=FORMULATEXT(Analysis!B9)'); sheet.getRange("D14").setFormula('=FORMULATEXT(\'Quote data\'!B8)'); sheet.getRange("A14:D14").setWrap(true);
        const notes = ["Scalar results: CFQUOTE and CFFUNDAMENTALS return one value when you select a field. Each price or fundamental result contains its own custom formula. Quote data column C and Fundamentals column F show those formulas.",
            "Tables: CFHISTORY, CFOPTIONS, CFEXPIRATIONS and CFEARNINGS return rows and columns. Only the top-left cell contains the table formula; neighboring cells show its returned values.",
            "Calculations: Price history uses ordinary spreadsheet formulas for indicators and returns. The Analysis technical rows and charts reference those calculations.",
            "Refresh: choose Stock analysis → Refresh selected ticker to request current data. Repeated custom-function calls can reuse cached provider responses.",
            "Inputs: yellow cells are editable. A refresh resets option and strategy assumptions from their source formulas. Refresh before experimenting with scenarios.",
            "Missing data: N/A means unavailable, not zero. Inspect Sources and the source formula before drawing a conclusion.",
            "Keys: stock and options features use public sources without personal keys. FRED requires your own key through Data settings → API keys…. Keep a copy with personal keys private.",
            "Journal: record displayed values only after loading finishes and review Sources. Fields can have different provider timestamps. Saved observations stay fixed; change columns reference previous entries.",
            "Provider times: ISO timestamps ending Z use UTC. A retrieval time and a quote's observation time measure different things. Dates in FRED describe observation periods."];
        notes.forEach((note, i) => sheet.getRange("A" + (17 + i * 2) + ":F" + (18 + i * 2)).merge().setValue(note).setWrap(true));
        sheet.setColumnWidth(1, 120); sheet.setColumnWidth(2, 410); sheet.setColumnWidth(3, 410); sheet.setColumnWidth(4, 350); sheet.setColumnWidth(5, 90); sheet.setColumnWidth(6, 90); sheet.setFrozenRows(4);
    }
}
