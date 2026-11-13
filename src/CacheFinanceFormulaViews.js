/*  *** DEBUG START ***
import { CFFormulaWorkbook } from "./CacheFinanceFormulaWorkbook.js";
import { CFFunctionExamples } from "./CacheFinanceFunctionExamples.js";
import { CFFormulaWatchlist } from "./CacheFinanceFormulaWatchlist.js";
export { CFFormulaViews };
//  *** DEBUG END ***/

/** Author cell formulas and instructions. No provider requests or financial calculations run here. */
class CFFormulaViews {
    static core() { return CFFormulaWorkbook; }
    static buildWatchlist(book, priorInputs) { return CFFormulaWatchlist.build(book, priorInputs); }
    static buildControl(book, input) {
        const W = CFFormulaViews.core(), sheet = W.prepareSheet(book, "Analysis", "CACHEFINANCE_ANALYSIS_V1");
        W.heading(sheet, "Stock analysis", "Yellow cells are inputs. Click a result to see its formula. Start here explains the source tables.");
        sheet.setFrozenRows(8); sheet.setColumnWidth(1, 235); sheet.setColumnWidth(2, 145); sheet.setColumnWidth(3, 205); sheet.setColumnWidth(4, 155); sheet.setColumnWidth(8, 225); sheet.setColumnWidth(9, 210);
        sheet.getRange("A4").setValue("Ticker"); W.input(sheet, "B4", input.ticker);
        sheet.getRange("D4").setValue("Refresh number"); W.input(sheet, "E4", input.refresh).setNumberFormat("0");
        sheet.getRange("J4").setValue("Calculation date"); W.input(sheet, "K4", W.setCalculationDate(book)).setNumberFormat("@");
        sheet.getRange("J5:L6").merge().setValue("Option days and maturity targets use this date. Refresh sets it to the current date in the spreadsheet's time zone.").setWrap(true).setFontSize(9);
        sheet.getRange("G4").setValue("Status"); sheet.getRange("H4:I4").merge().setFormula('=IF(ISNUMBER(B9),"Quote loaded; see Sources","Quote loading or unavailable; see Sources")').setWrap(true);
        sheet.getRange("A5").setValue("Yahoo symbol"); sheet.getRange("B5").setFormula('=UPPER(TRIM(B4))');
        sheet.getRange("D5").setValue("Company"); sheet.getRange("E5:F5").merge().setFormula('=' + W.quote("name"));
        sheet.getRange("G5:I5").merge().setFormula('=IF($Z$3="","",$Z$3)').setWrap(true).setFontSize(9).setFontColor("#9C5700");
        sheet.getRange("A6").setValue("Currency"); sheet.getRange("B6").setFormula('=' + W.metric("currency"));
        sheet.getRange("D6").setValue("Indicators through"); sheet.getRange("E6").setFormula('=' + W.metric("indicator_as_of")).setNumberFormat("@");
        sheet.getRange("G6").setValue("Price session"); sheet.getRange("H6").setFormula('=' + W.metric("price_session"));
        sheet.getRange("D7:I7").merge().setValue("Quote timestamps ending Z use UTC. Refresh changes source formulas; the dashboard references their results.").setFontSize(9).setFontColor("#596579");
        W.header(sheet, "A8:C8", ["Metric", "Value", "Basis"]);
        const metrics = [
            ["Price", "=Formulas!B23", "Selected session"], ["Quote time", "=Formulas!B25", "Provider observation; UTC"],
            ["1-day adjusted return", '=' + W.metric("return1d"), "Adjusted close"], ["1-month adjusted return", '=' + W.metric("return1m"), "21 sessions"],
            ["3-month adjusted return", '=' + W.metric("return3m"), "63 sessions"], ["1-year adjusted return", '=' + W.metric("return1y"), "252 sessions"],
            ["YTD adjusted return", '=' + W.metric("return_ytd"), "Last prior-year close"], ["RSI14", '=' + W.metric("rsi14"), "Wilder; inspect Price history helpers"],
            ["SMA50", '=' + W.metric("sma50"), "Average of 50 daily closes"], ["SMA200", '=' + W.metric("sma200"), "Average of 200 daily closes"],
            ["20-day annualized volatility", '=' + W.metric("volatility20d"), "Adjusted log returns; 252 sessions"], ["Maximum observed drawdown", '=' + W.metric("max_drawdown"), "Loaded adjusted history"],
            ["MACD", '=' + W.metric("macd"), "EMA12 minus EMA26"], ["MACD signal", '=' + W.metric("macd_signal"), "9-period EMA of MACD"],
            ["20-day average volume", '=' + W.metric("average_volume20"), "Daily shares"], ["History sessions", '=' + W.metric("bar_count"), "Published closes"]
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
        const company = [["Market cap", W.metric("market_cap"), "Yahoo; quote currency"], ["P/E (trailing)", W.metric("trailing_pe"), "Trailing 12 months"],
            ["EPS (trailing)", W.metric("eps_ttm"), "Quote currency / share"], ["Dividend yield", W.fundamental("dividend_yield"), "Forward fraction"],
            ["Analyst target", W.metric("target_price"), "Provider mean target"], ["Next earnings", W.metric("next_earnings"), "Provider calendar; see Earnings"],
            ["Loaded option contracts", 'Options!$Y$7', "Selected expiration"], ["Nearest expiration", 'Formulas!B28', "Published date"], ["ATM IV", W.metric("atm_iv"), "Same-strike call/put mean"]];
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

    static buildQuoteData(book) {
        const W = CFFormulaViews.core(), sheet = W.prepareSheet(book, "Quote data", "TICKERSHEETS_QUOTE_DATA_V1");
        W.heading(sheet, "Quote data", "Source formulas are at A7, D7, O7 and A70. The selected-stock summary at AA7 contains ordinary worksheet formulas.");
        sheet.getRange("A4").setValue("Ticker"); sheet.getRange("B4").setFormula('=Analysis!B4'); sheet.getRange("D4").setValue("Refresh number"); sheet.getRange("E4").setFormula('=Analysis!E4');
        sheet.getRange("A6").setValue("Yahoo quote fields"); sheet.getRange("D6").setValue("Source comparison"); sheet.getRange("O6").setValue("Published expirations");
        sheet.getRange("A7").setFormula('=CFQUOTE(Analysis!$B$4,"all",Analysis!$E$4)'); sheet.getRange("D7").setFormula('=CFQUOTECOMPARE(Analysis!$B$4,Analysis!$E$4)'); sheet.getRange("O7").setFormula('=CFEXPIRATIONS(Analysis!$B$4,Analysis!$E$4,TRUE)');
        for (const address of ["A7:B7", "D7:M7", "O7:P7"]) sheet.getRange(address).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold").setWrap(true);
        sheet.setColumnWidths(1, 15, 155); sheet.setColumnWidth(1, 220); sheet.setColumnWidth(2, 235); sheet.getRange("A8:B65").setNumberFormat("0.########"); sheet.getRange("F8:F16").setNumberFormat("0.00%"); sheet.getRange("I8:J16").setNumberFormat("@"); sheet.getRange("O8:O207").setNumberFormat("@");
        sheet.getRange("A68:L68").merge().setValue("RSI2 targets: one source function, reused by the Formulas examples. Missing targets remain N/A.").setWrap(true);
        sheet.getRange("A70").setFormula('=CFRSITARGETS(Analysis!$B$4,20,80,"all",Analysis!$E$4)'); sheet.getRange("A70:L70").setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold"); sheet.getRange("A71:L71").setNumberFormat("0.00");
        W.header(sheet, "AA7:AB7", ["Selected-stock field", "Worksheet result"]);
        const metrics = CFFormulaViews.selectedMetrics(); sheet.getRange(8, 27, metrics.length, 1).setValues(metrics.map(row => [row[0]])); sheet.getRange(8, 28, metrics.length, 1).setFormulas(metrics.map(row => ['=' + row[1]])); sheet.setColumnWidth(27, 220); sheet.setColumnWidth(28, 235);
        sheet.getRange("AA4:AF4").merge().setValue("These formulas reuse quote, history, fundamentals and earnings source tables. Main views do not fetch another dataset.").setWrap(true);
    }

    static buildFundamentals(book) {
        const W = CFFormulaViews.core(), sheet = W.prepareSheet(book, "Fundamentals", "CACHEFINANCE_ANALYSIS_V1");
        W.heading(sheet, "Fundamentals", "A7 contains the source function. Values keep the provider's units; a fraction of 0.01 means 1%.");
        sheet.getRange("A7").setFormula('=CFFUNDAMENTALS(Analysis!$B$4,"all",Analysis!$E$4)'); sheet.getRange("A7:E7").setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold");
        sheet.setColumnWidth(1, 255); sheet.setColumnWidth(2, 175); sheet.setColumnWidth(3, 150); sheet.setColumnWidth(4, 145); sheet.setColumnWidth(5, 420); sheet.getRange("B8:B200").setNumberFormat("0.########"); sheet.getRange("E8:E200").setWrap(true);
    }

    static buildFormulas(book) {
        const W = CFFormulaViews.core(), sheet = W.prepareSheet(book, "Formulas", "CACHEFINANCE_FUNCTIONS_V1");
        W.heading(sheet, "Functions and working formulas", "The examples reference the source tables used by Analysis. They do not fetch a second dashboard dataset.");
        sheet.getRange("A4").setValue("Ticker"); sheet.getRange("B4").setFormula('=Analysis!B4'); sheet.getRange("D4").setValue("Shared refresh number"); sheet.getRange("E4").setFormula('=Analysis!E4');
        const catalog = CFFunctionExamples.catalog();
        const additional = [["CFEARNINGS", 'CFEARNINGS(ticker,section,refresh)', "Reported EPS, financials, estimates, events and calendar", "One labeled table per section"], ["CFQUOTECOMPARE", 'CFQUOTECOMPARE(ticker,refresh)', "Six named provider/session comparisons", "Source values and timestamps remain separate"], ["CFWATCHROW", 'CFWATCHROW(ticker,refresh)', "One watchlist stock as labeled fields", "Selected-stock rows reuse the main source tables"]];
        W.header(sheet, "A7:D7", ["Function", "Arguments", "Result", "Units / notes"]); sheet.getRange(8, 1, catalog.length, 4).setValues(catalog).setWrap(true);
        // Scalar examples retain their established addresses so the price path is easy to follow.
        sheet.getRange("A22:D24").clearContent();
        W.header(sheet, "A22:B22", ["Working examples", "Result"]);
        const examples = [["Price used by Analysis!B9", '=' + W.quote("price")], ["Trailing P/E used by Analysis", '=' + W.fundamental("trailing_pe")],
            ["Quote timestamp (UTC)", '=' + W.quote("quote_time")], ["Finviz price", '=IFNA(INDEX(Research!$B$191:$B$225,MATCH("price",Research!$A$191:$A$225,0)),"N/A")'],
            ["Latest DGS10 percent level", '=Macro!D8'], ["First published expiration", '=IF(\'Quote data\'!O8="","N/A",\'Quote data\'!O8)'], ["Model example: 100 spot/strike, 30 days, 25% IV", '=CFOPTIONMODEL(100,100,30,0.25,0.04,0,"Call","price")'],
            ["Latest DGS2 percent level", '=IFERROR(IF(ISNUMBER($R$35),$R$35,"N/A: FRED data unavailable; check API key settings"),"N/A: FRED data unavailable; check API key settings")']];
        sheet.getRange(23, 1, examples.length, 1).setValues(examples.map(row => [row[0]])); sheet.getRange(23, 2, examples.length, 1).setFormulas(examples.map(row => [row[1]]));
        W.header(sheet, "G22:I22", ["Additional functions", "Result", "Where the source runs"]);
        const extras = [["Current RSI2", '=IF(ISNUMBER(\'Quote data\'!A71),\'Quote data\'!A71,"N/A")', "Quote data!A70"], ["RSI2 buy target", '=IF(ISNUMBER(\'Quote data\'!B71),\'Quote data\'!B71,"N/A")', "Quote data!A70"], ["RSI2 sell target", '=IF(ISNUMBER(\'Quote data\'!C71),\'Quote data\'!C71,"N/A")', "Quote data!A70"],
            ["Exact-date FRED example", '=CFFREDVALUE($K$24,$K$25,Analysis!$E$4)', "This cell is the source for this separate date lookup"], ["FRED weekend: expected N/A", '=CFFREDVALUE("DGS10","2026-11-07",Analysis!$E$4)', "This cell is an intentional missing-date example"],
            ["Published after-hours price", '=' + W.quote("post_market_price"), "Quote data!A7"], ["Selected price session", '=' + W.quote("price_session"), "Quote data!A7"]];
        sheet.getRange(23, 7, extras.length, 1).setValues(extras.map(row => [row[0]])); sheet.getRange(23, 8, extras.length, 1).setFormulas(extras.map(row => [row[1]])); sheet.getRange(23, 9, extras.length, 1).setValues(extras.map(row => [row[2]])).setWrap(true);
        sheet.getRange("J24").setValue("FRED series"); W.input(sheet, "K24", "DGS10"); sheet.getRange("J25").setValue("Observation date"); W.input(sheet, "K25", "2026-11-05").setNumberFormat("@");
        sheet.getRange("A33").setValue("Actual fundamentals source formula"); sheet.getRange("A34").setFormula('=FORMULATEXT(Fundamentals!A7)');
        sheet.getRange("G33").setValue("Actual history source formula"); sheet.getRange("G34").setFormula('=FORMULATEXT(\'Price history\'!A7)');
        sheet.getRange("O33").setValue("Actual expiration source formula"); sheet.getRange("O34").setFormula('=FORMULATEXT(\'Quote data\'!O7)');
        sheet.getRange("Q33").setValue("DGS2: separate economic-series example"); sheet.getRange("Q34").setFormula('=CFFRED("DGS2",12,Analysis!$E$4)');
        W.header(sheet, "A38:D38", ["Follow this result", "Displayed value", "Formula in that cell", "Source formula"]);
        const trace = [["Dashboard price", '=Analysis!B9', '=FORMULATEXT(Analysis!B9)', '=FORMULATEXT(\'Quote data\'!A7)'], ["50-day moving average", '=Analysis!B17', '=FORMULATEXT(Analysis!B17)', '=FORMULATEXT(\'Price history\'!I57)'], ["RSI14", '=Analysis!B16', '=FORMULATEXT(Analysis!B16)', '=FORMULATEXT(\'Price history\'!P22)']];
        sheet.getRange("A39:A41").setValues(trace.map(row => [row[0]])); sheet.getRange("B39:D41").setFormulas(trace.map(row => row.slice(1))).setWrap(true);
        W.header(sheet, "A44:D44", ["More source functions", "Arguments", "Result", "Units / notes"]); sheet.getRange("A45:D47").setValues(additional).setWrap(true);
        sheet.setColumnWidth(1, 260); sheet.setColumnWidth(2, 260); sheet.setColumnWidth(3, 410); sheet.setColumnWidth(4, 410); sheet.setColumnWidth(7, 245); sheet.setColumnWidth(8, 175); sheet.setColumnWidth(9, 300);
        sheet.getRange("B23:B30").setNumberFormat("0.########"); sheet.getRange("B25").setNumberFormat("@"); sheet.getRange("B28").setNumberFormat("@"); sheet.getRange("H23:H28").setNumberFormat("0.00");
        sheet.getRange("A29").setWrap(true); sheet.setRowHeights(29, 1, 36);
        return { ok: true, functions: catalog.length + additional.length, sheet: "Formulas", mode: "formulas" };
    }

    static buildGuide(book) {
        const W = CFFormulaViews.core(), sheet = W.prepareSheet(book, "Start here", "TICKERSHEETS_GUIDE_V1");
        sheet.getRange("A1:F1").merge().setValue("Learn TickerSheets by following its formulas").setFontSize(18).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2:F2").merge().setValue("The public sample contains no saved API keys. Use your own keys in a private copy. Source functions feed visible calculations and linked views.").setWrap(true);
        W.header(sheet, "A4:C4", ["Step", "What to do", "What you will learn"]);
        const steps = [[1, "Enter a stock in Analysis!B4. Choose Stock analysis → Refresh selected ticker, or increase Analysis!E4.", "All source formulas depend on the same ticker and refresh number."],
            [2, "Click Analysis!B9, then Formulas!B23, then Quote data!A7.", "The displayed price follows one source function. The dashboard does not fetch a separate price."],
            [3, "Open Price history. Click I57 for SMA50, then P22 for RSI14. Scroll right to the labeled helpers.", "Ordinary formulas calculate averages, momentum, returns and volatility from CFHISTORY results."],
            [4, "Open Earnings and Research. Inspect source anchors and comparison formulas.", "Reported data, accounting basis, periods and calculations remain separate."],
            [5, "Choose Options!B4. Inspect the CFOPTIONS formula at A7 and edit the yellow calculator inputs.", "Source quotes feed assumptions, model results and expiration payoff charts."],
            [6, "Try a strategy, add watchlist tickers, then choose Record journal snapshot after source results finish loading.", "Journal entries preserve a point-in-time record. Source refreshes do not rewrite that history."]];
        sheet.getRange("A5:C10").setValues(steps).setWrap(true); sheet.setRowHeights(5, 6, 58);
        W.header(sheet, "A13:D13", ["Live result", "Value", "Dashboard formula", "Data function"]);
        sheet.getRange("A14").setValue("Selected price"); sheet.getRange("B14").setFormula('=Analysis!B9'); sheet.getRange("C14").setFormula('=FORMULATEXT(Analysis!B9)'); sheet.getRange("D14").setFormula('=FORMULATEXT(\'Quote data\'!A7)'); sheet.getRange("A14:D14").setWrap(true);
        const notes = ["Source tables: Quote data, Fundamentals, Earnings, Options and Macro contain CF... functions. Each source function can return a whole table; only its top-left cell contains the formula.",
            "Calculations: Price history uses ordinary spreadsheet formulas. The dashboard, charts and Formulas examples reference those existing results.",
            "Refresh: the menu changes Analysis!E4. There is no second menu-driven provider collector. Google Sheets may recalculate source functions; their parsed-data cache can reuse recent responses.",
            "Inputs: yellow cells are editable. A refresh resets option and strategy assumptions from their source formulas. Refresh before experimenting with scenarios.",
            "Missing data: N/A means unavailable, not zero. Inspect Sources and the source formula before drawing a conclusion.",
            "Keys: stock and options features use public sources without personal keys. FRED requires your own key through Data settings → API keys…. Keep a copy with personal keys private.",
            "Journal: record displayed values only after loading finishes and review Sources. Fields can have different provider timestamps. Saved observations stay fixed; change columns reference previous entries.",
            "Provider times: ISO timestamps ending Z use UTC. A retrieval time and a quote's observation time measure different things. Dates in FRED describe observation periods."];
        notes.forEach((note, i) => sheet.getRange("A" + (17 + i * 2) + ":F" + (18 + i * 2)).merge().setValue(note).setWrap(true));
        sheet.setColumnWidth(1, 120); sheet.setColumnWidth(2, 410); sheet.setColumnWidth(3, 410); sheet.setColumnWidth(4, 350); sheet.setColumnWidth(5, 90); sheet.setColumnWidth(6, 90); sheet.setFrozenRows(4);
    }
}
