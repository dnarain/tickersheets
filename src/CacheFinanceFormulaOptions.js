/*  *** DEBUG START ***
import { CFFormulaWorkbook } from "./CacheFinanceFormulaWorkbook.js";
import { CFAnalysisStrategies } from "./CacheFinanceAnalysisStrategies.js";
export { CFFormulaOptions };
//  *** DEBUG END ***/

/** Source option tables, visible selection formulas and editable expiry calculators. */
class CFFormulaOptions {
    static get firstRow() { return 8; }
    static get lastRow() { return 1007; }

    static header_(sheet, address, values) {
        return sheet.getRange(address).setValues([values]).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold").setWrap(true);
    }

    static date_(value, book) {
        if (value instanceof Date && Number.isFinite(value.getTime())) {
            try { value = Utilities.formatDate(value, book.getSpreadsheetTimeZone(), "yyyy-MM-dd"); }
            catch { return ""; }
        }
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
        const date = new Date(value + "T00:00:00Z");
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
    }

    static helperFormulas_(row) {
        const a = "$A" + row, b = "$B" + row, c = "$C" + row, d = "$D" + row, e = "$E" + row, h = "$H" + row;
        const date = 'IF(ISNUMBER($B$4),TEXT($B$4,"yyyy-mm-dd"),$B$4)';
        const valid = 'IFERROR(AND(' + a + '=' + date + ',OR(' + b + '="Call",' + b + '="Put"),ISNUMBER(' + c + '),' + c + '>0,ISNUMBER(' + d + '),' + d + '>=0,ISNUMBER(' + e + '),' + e + '>0,' + e + '>=' + d + ',REGEXMATCH($L' + row + ',"^[A-Z0-9]{1,8}[0-9]{6}[CP][0-9]{8}$"),MID($L' + row + ',LEN($L' + row + ')-8,1)=IF(' + b + '="Call","C","P"),MID($L' + row + ',LEN($L' + row + ')-14,6)=TEXT(IF(ISNUMBER($B$4),$B$4,DATEVALUE($B$4)),"yymmdd"),ABS(VALUE(RIGHT($L' + row + ',8))/1000-' + c + ')<1E-8),FALSE)';
        const distance = type => 'IF(AND($AA' + row + ',' + b + '="' + type + '",ISNUMBER($Y$16),$Y$16>0),ABS(' + c + '-$Y$16),"")';
        return [
            '=' + valid,
            '=IF(AND($AA' + row + ',' + b + '="Call",ISNUMBER(' + h + '),' + h + '>0,ISNUMBER($Y$16),$Y$16>0),ABS(' + c + '-$Y$16),"")',
            '=' + distance("Call"), '=' + distance("Put"),
            '=IF($AA' + row + ',"Ordered bid/ask; may be delayed","")'
        ];
    }

    static nearest_(distanceColumn) {
        const distance = '$' + distanceColumn + '$8:$' + distanceColumn + '$1007';
        return '=IFNA(INDEX(SORT(FILTER({' + distance + ',$C$8:$C$1007,ROW($A$8:$A$1007)-7},ISNUMBER(' + distance + ')),1,TRUE,2,TRUE),1,3),"N/A")';
    }

    static selected_(column, selector) {
        return '=IF(ISNUMBER($' + selector + '),INDEX($' + column + '$8:$' + column + '$1007,$' + selector + '),"N/A")';
    }

    static buildOptions(book, { expiration = "" } = {}) {
        const sheet = CFFormulaWorkbook.prepareSheet(book, "Options", "CACHEFINANCE_ANALYSIS_V1");
        if (sheet.getMaxRows() < 10007) sheet.insertRowsAfter(sheet.getMaxRows(), 10007 - sheet.getMaxRows());
        if (sheet.getMaxColumns() < 31) sheet.insertColumnsAfter(sheet.getMaxColumns(), 31 - sheet.getMaxColumns());
        sheet.setHiddenGridlines(true); sheet.setFrozenRows(7);
        sheet.getRange("A1:L1").merge().setFormula('=UPPER(TRIM(Analysis!$B$4))&" — option source and formulas"').setFontSize(15).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2:L2").merge().setValue("A7 downloads the full selected chain into space for 10,000 raw contracts. AA:AE calculate with the first 1,000 source rows. Yellow cells are editable assumptions.").setWrap(true);
        sheet.getRange("A4").setValue("Expiration");
        const saved = CFFormulaOptions.date_(expiration, book);
        if (saved) sheet.getRange("B4").setValue(saved);
        else sheet.getRange("B4").setFormula('=IF(\'Quote data\'!$O$8="","",\'Quote data\'!$O$8)');
        sheet.getRange("B4").setNumberFormat("@").setBackground("#FFF2CC").setFontColor("#0000FF").setFontWeight("bold");
        const dates = book.getSheetByName("Quote data");
        if (dates) sheet.getRange("B4").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(dates.getRange("O8:O207"), true).setAllowInvalid(false).build());
        sheet.getRange("D4").setValue("Counted source contracts").setWrap(true); sheet.setRowHeights(4, 1, 40); sheet.getRange("E4").setFormula("=$Y$7").setNumberFormat("#,##0");
        sheet.getRange("A6:L6").merge().setFormula('=IFERROR(IF($A$7<>"Expiration","Options source not ready. See A7.",IF(OR($B$1008="Call",$B$1008="Put"),"More than 1000 source contracts. Calculations use the first 1000 rows; full raw source output remains visible below.",IF($Y$7=0,"No accepted contracts returned.","Source quote times and bid/ask timestamps are different. Bid/ask timestamps are unavailable."))),"Options source error: inspect A7. This sheet has capacity for 10,000 raw contracts; a larger result requires more sheet rows.")').setWrap(true);
        sheet.getRange("A7").setFormula(CFFormulaWorkbook.optionSource('$B$4'));
        sheet.getRange("A7:L7").setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold").setWrap(true);
        sheet.getRange("A8:B10007").setNumberFormat("@"); sheet.getRange("C8:H10007").setNumberFormat("0.00");
        sheet.getRange("H8:H10007").setNumberFormat("0.00%"); sheet.getRange("I8:J10007").setNumberFormat("#,##0"); sheet.getRange("K8:L10007").setNumberFormat("@");
        CFFormulaOptions.header_(sheet, "X3:Y3", ["Source selection", "Result"]);
        const labels = ["Same-strike ATM IV", "ATM call strike", "ATM put strike", "Counted source contracts", "Usable bid/ask rows", "Helper coverage", "Model call row index", "Strategy call row index", "Strategy put row index", "Same-strike pair row index", "Higher call row index", "Lower put row index", "Regular-session underlying"];
        sheet.getRange("X4:X16").setValues(labels.map(value => [value]));
        sheet.getRange("Y4").setFormula('=IF(ISNUMBER(Research!$Q$25),Research!$Q$25,"N/A")');
        sheet.getRange("Y5").setFormula('=IF(ISNUMBER(Research!$B$25),Research!$B$25,"N/A")'); sheet.getRange("Y6").setFormula('=IF(ISNUMBER(Research!$H$25),Research!$H$25,"N/A")');
        sheet.getRange("Y7").setFormula('=COUNTIFS($A$8:$A$10007,IF(ISNUMBER($B$4),TEXT($B$4,"yyyy-mm-dd"),$B$4),$B$8:$B$10007,"Call")+COUNTIFS($A$8:$A$10007,IF(ISNUMBER($B$4),TEXT($B$4,"yyyy-mm-dd"),$B$4),$B$8:$B$10007,"Put")');
        sheet.getRange("Y8").setFormula('=COUNTIF($AA$8:$AA$1007,TRUE)');
        sheet.getRange("Y9").setFormula('=IF(OR($B$1008="Call",$B$1008="Put"),"First 1000 rows only","Within 1000-row calculation range")');
        for (const [target, column] of [["Y10", "AB"], ["Y11", "AC"], ["Y12", "AD"]]) sheet.getRange(target).setFormula(CFFormulaOptions.nearest_(column));
        sheet.getRange("Y13").setFormula('=IF(ISNUMBER(Research!$O$25),Research!$O$25,"N/A")');
        sheet.getRange("Y14").setFormula('=IFNA(INDEX(SORT(FILTER({$C$8:$C$1007,ROW($A$8:$A$1007)-7},$AA$8:$AA$1007=TRUE,$B$8:$B$1007="Call",$C$8:$C$1007>IF(ISNUMBER($Y$11),INDEX($C$8:$C$1007,$Y$11),1E99)),1,TRUE),1,2),"N/A")');
        sheet.getRange("Y15").setFormula('=IFNA(INDEX(SORT(FILTER({$C$8:$C$1007,ROW($A$8:$A$1007)-7},$AA$8:$AA$1007=TRUE,$B$8:$B$1007="Put",$C$8:$C$1007<IF(ISNUMBER($Y$12),INDEX($C$8:$C$1007,$Y$12),0)),1,FALSE),1,2),"N/A")');
        sheet.getRange("Y16").setFormula("=" + CFFormulaWorkbook.quote("regular_price"));
        sheet.getRange("Y4").setNumberFormat("0.00%"); sheet.getRange("Y5:Y6").setNumberFormat("0.00"); sheet.getRange("Y7:Y8").setNumberFormat("#,##0");
        sheet.getRange("AA1:AE1").merge().setValue("Visible option selection steps").setFontWeight("bold");
        sheet.getRange("AA2:AE2").merge().setValue("Model calls require positive IV and ordered bid/ask quotes. The selected ATM pair is calculated once on Research, including partial quotes.").setWrap(true);
        CFFormulaOptions.header_(sheet, "AA7:AE7", ["Usable bid/ask", "Model call distance", "Strategy call distance", "Strategy put distance", "Quote condition"]);
        sheet.getRange("AA8:AE1007").setFormulas(Array.from({ length: 1000 }, (_, i) => CFFormulaOptions.helperFormulas_(i + 8)));
        sheet.getRange("O1:S1").merge().setFormula('=UPPER(TRIM(Analysis!$B$4))&" — option calculator"').setFontSize(14).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("O2:S2").merge().setValue("Edit yellow cells. Refresh resets assumptions.").setWrap(true);
        CFFormulaOptions.header_(sheet, "O3:P3", ["Assumption", "Value"]); CFFormulaOptions.header_(sheet, "R3:S3", ["Model output", "Value"]);
        sheet.getRange("O4:O14").setValues(["Underlying price", "Strike", "Premium / share (editable)", "Days to expiration", "Annual IV", "Risk-free rate (assumption)", "Dividend yield (0 if unavailable)", "Option type", "Contracts", "Multiplier (assumed)", "Position side"].map(value => [value]));
        sheet.getRange("P4:P14").setBackground("#FFF2CC").setFontColor("#0000FF").setFontWeight("bold");
        CFFormulaOptions.optionInputs_(sheet);
        sheet.getRange("P4:P6").setNumberFormat("0.00"); sheet.getRange("P7").setNumberFormat("0"); sheet.getRange("P8:P10").setNumberFormat("0.00%"); sheet.getRange("P12:P13").setNumberFormat("#,##0");
        for (const [address, options] of [["P11", ["Call", "Put"]], ["P14", ["Long", "Short"]]]) sheet.getRange(address).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(options, true).setAllowInvalid(false).build());
        sheet.getRange("O16").setValue("Seed contract"); sheet.getRange("P16").setFormula(CFFormulaOptions.selected_("L", "Y$10"));
        sheet.getRange("O17:S17").merge().setValue("European exercise model. Long-option Greeks; position side changes payoff.").setWrap(true).setFontSize(9);
        sheet.getRange("O18:S18").merge().setValue("Annual fractions: 0.40 means 40%. Payoff excludes fees, taxes, financing and early assignment.").setWrap(true).setFontSize(9);
        const model = ["price", "delta", "gamma", "theta", "vega", "rho", "d1", "d2"];
        sheet.getRange("R4:R16").setValues(["Model premium / share", "Delta / share", "Gamma / share", "Theta / calendar day", "Vega / 1 IV point", "Rho / 1 rate point", "d1", "d2", "Model − entered premium", "Breakeven at expiry", "Initial premium cash flow", "Long maximum loss", "Short maximum profit"].map(value => [value]));
        sheet.getRange("S4:S11").setFormulas(model.map(metric => ['=CFOPTIONMODEL($P$4,$P$5,$P$7,$P$8,$P$9,$P$10,$P$11,"' + metric + '")']));
        const perShare = 'AND(ISNUMBER($P$5),$P$5>0,ISNUMBER($P$6),$P$6>=0,OR($P$11="Call",$P$11="Put"))';
        const position = perShare + ',ISNUMBER($P$12),$P$12>0,MOD($P$12,1)=0,ISNUMBER($P$13),$P$13>0,MOD($P$13,1)=0,OR($P$14="Long",$P$14="Short")';
        sheet.getRange("S12").setFormula('=IF(AND(ISNUMBER(S4),ISNUMBER($P$6),$P$6>=0),S4-$P$6,"N/A")');
        sheet.getRange("S13").setFormula('=IF(' + perShare + ',IF($P$11="Call",$P$5+$P$6,$P$5-$P$6),"N/A")');
        sheet.getRange("S14").setFormula('=IFERROR(IF(AND(' + position + '),IF($P$14="Long",-1,1)*$P$6*$P$12*$P$13,"N/A"),"N/A")');
        sheet.getRange("S15").setFormula('=IFERROR(IF(AND(' + position + ',$P$14="Long"),$P$6*$P$12*$P$13,"N/A"),"N/A")');
        sheet.getRange("S16").setFormula('=IFERROR(IF(AND(' + position + ',$P$14="Short"),$P$6*$P$12*$P$13,"N/A"),"N/A")');
        sheet.getRange("S4:S16").setNumberFormat("0.0000");
        CFFormulaOptions.header_(sheet, "O23:P23", ["Stock at expiry", "Position profit / loss"]);
        sheet.getRange("O24:P44").setFormulas(Array.from({ length: 21 }, (_, index) => {
            const row = index + 24, scale = (50 + index * 5) / 100;
            return ['=IF(AND(ISNUMBER($P$4),$P$4>0),$P$4*' + scale + ',NA())', '=IFERROR(IF(AND(ISNUMBER(O' + row + '),' + position + '),IF($P$14="Short",-1,1)*(IF($P$11="Call",MAX(O' + row + '-$P$5,0),MAX($P$5-O' + row + ',0))-$P$6)*$P$12*$P$13,NA()),NA())'];
        }));
        sheet.getRange("O24:P44").setNumberFormat("0.00");
        sheet.insertChart(sheet.newChart().setChartType(Charts.ChartType.LINE).addRange(sheet.getRange("O23:P44")).setNumHeaders(1).setPosition(24, 18, 0, 0).setOption("title", "Option payoff at expiration").setOption("width", 650).setOption("height", 340).setOption("legend", { position: "none" }).setOption("hAxis", { title: "Stock price at expiration" }).setOption("vAxis", { title: "Position profit / loss" }).build());
        sheet.setColumnWidths(1, 12, 115); sheet.setColumnWidth(12, 220); sheet.setColumnWidth(15, 235); sheet.setColumnWidth(16, 155); sheet.setColumnWidth(17, 25); sheet.setColumnWidth(18, 235); sheet.setColumnWidth(19, 155); sheet.setColumnWidth(24, 235); sheet.setColumnWidth(25, 180); sheet.setColumnWidths(27, 5, 170);
        return { sheet, firstRow: 8, lastRow: 1007, atmIV: "Options!Y4", optionCount: "Options!Y7" };
    }

    static optionInputs_(sheet) {
        sheet.getRange("P4").setFormula("=$Y$16"); sheet.getRange("P5").setFormula(CFFormulaOptions.selected_("C", "Y$10"));
        sheet.getRange("P6").setFormula('=IF(ISNUMBER($Y$10),AVERAGE(INDEX($D$8:$D$1007,$Y$10),INDEX($E$8:$E$1007,$Y$10)),"N/A")');
        sheet.getRange("P7").setFormula('=IFERROR(MAX(0,IF(ISNUMBER($B$4),INT($B$4),DATEVALUE($B$4))-DATEVALUE(Analysis!$K$4)),"N/A")');
        sheet.getRange("P8").setFormula(CFFormulaOptions.selected_("H", "Y$10")); sheet.getRange("P9").setValue(0.04);
        const dividend = CFFormulaWorkbook.fundamental("dividend_yield"); sheet.getRange("P10").setFormula('=IF(ISNUMBER(' + dividend + '),' + dividend + ',0)');
        sheet.getRange("P11").setValue("Call"); sheet.getRange("P12").setValue(1); sheet.getRange("P13").setValue(100); sheet.getRange("P14").setValue("Long");
    }

    static strategyInputs_(sheet) {
        sheet.getRange("B4").setValue("Covered call"); sheet.getRange("B5").setFormula("=" + CFFormulaWorkbook.quote("regular_price"));
        sheet.getRange("B6").setFormula('=IFNA(INDEX($U$5:$U$8,MATCH($B$4,$T$5:$T$8,0)),"N/A")'); sheet.getRange("B8").setFormula('=IFNA(INDEX($W$5:$W$8,MATCH($B$4,$T$5:$T$8,0)),"N/A")');
        const optionType = 'IF(OR($B$4="Covered call",$B$4="Call vertical"),"Call","Put")';
        sheet.getRange("B7").setFormula('=IF(OR($B$4="Covered call",$B$4="Cash-secured put"),"N/A",IFNA(INDEX(FILTER($D$56:$D$1055,$A$56:$A$1055=' + optionType + ',$B$56:$B$1055=$B$6),1),"N/A"))');
        sheet.getRange("B9").setFormula('=IFNA(INDEX(FILTER($C$56:$C$1055,$A$56:$A$1055=' + optionType + ',$B$56:$B$1055=$B$8),1),"N/A")');
        sheet.getRange("B10").setValue(1); sheet.getRange("B11").setValue(100);
        sheet.getRange("B12").setFormula('=IF(ISNUMBER(Options!$B$4),TEXT(Options!$B$4,"yyyy-mm-dd"),Options!$B$4)');
        sheet.getRange("B13").setFormula("=" + CFFormulaWorkbook.quote("regular_price"));
    }

    static buildStrategies(book) {
        const sheet = CFFormulaWorkbook.prepareSheet(book, "Strategies", "CACHEFINANCE_STRATEGIES_V1");
        if (sheet.getMaxRows() < 1055) sheet.insertRowsAfter(sheet.getMaxRows(), 1055 - sheet.getMaxRows());
        sheet.setHiddenGridlines(true); sheet.setFrozenRows(3);
        sheet.getRange("A1:L1").merge().setFormula('=UPPER(TRIM(Analysis!$B$4))&" — strategy calculator"').setFontSize(15).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2:L2").merge().setValue("Edit yellow cells. Refresh resets assumptions. Source quotes below reference the Options table.").setWrap(true);
        CFFormulaOptions.header_(sheet, "A3:B3", ["Assumption", "Value"]); CFFormulaOptions.header_(sheet, "D3:E3", ["Expiry result", "Whole position / note"]);
        CFFormulaOptions.header_(sheet, "A24:B24", ["Stock at expiration", "Position profit / loss"]); CFFormulaOptions.header_(sheet, "A55:G55", ["Type", "Strike", "Bid / share", "Ask / share", "Option symbol", "Expiration", "Quote condition"]);
        CFFormulaOptions.header_(sheet, "T4:Y4", ["Strategy", "Long strike", "Long ask", "Short strike", "Short bid", "Source selection"]);
        sheet.getRange("A4:A13").setValues(["Strategy", "Stock cost basis / scenario anchor", "Long strike / share", "Long premium paid / share", "Short strike / share", "Short premium received / share", "Contracts", "Multiplier (assumed; editable)", "Shared option expiration", "Selected scenario stock price"].map(value => [value]));
        sheet.getRange("B4:B13").setBackground("#FFF2CC").setFontColor("#0000FF").setFontWeight("bold");
        sheet.getRange("B4").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(CFAnalysisStrategies.names(), true).setAllowInvalid(false).build());
        sheet.getRange("A56").setFormula('=IFNA(FILTER({Options!$B$8:$B$1007,Options!$C$8:$C$1007,Options!$D$8:$D$1007,Options!$E$8:$E$1007,Options!$L$8:$L$1007,Options!$A$8:$A$1007,Options!$AE$8:$AE$1007},Options!$AA$8:$AA$1007=TRUE),"N/A")');
        sheet.getRange("T5:T8").setValues(CFAnalysisStrategies.names().map(value => [value]));
        const selected = (column, row) => '=IF(ISNUMBER(Options!$Y$' + row + '),INDEX(Options!$' + column + '$8:$' + column + '$1007,Options!$Y$' + row + '),"N/A")';
        for (const [row, long, short] of [[5, null, 11], [6, null, 12], [7, 11, 14], [8, 12, 15]]) {
            for (const [column, sourceColumn, index] of [["U", "C", long], ["V", "E", long], ["W", "C", short], ["X", "D", short]]) sheet.getRange(column + row).setFormula(index === null ? '="N/A"' : selected(sourceColumn, index));
            sheet.getRange("Y" + row).setFormula('=IF(ISNUMBER(W' + row + '),"Selected expiration; editable","No usable source quote")');
        }
        CFFormulaOptions.strategyInputs_(sheet);
        sheet.getRange("B5:B9").setNumberFormat("0.00"); sheet.getRange("B10:B11").setNumberFormat("#,##0"); sheet.getRange("B13").setNumberFormat("0.00");
        const metrics = [["Initial cash flow", "initialCashflow"], ["Net option premium", "netPremium"], ["Stock purchase cost", "stockCost"], ["Cash reserved for assignment", "collateral"], ["Maximum expiry P/L (signed)", "maxProfit"], ["Maximum loss amount", "maxLoss"], ["Expiry breakeven / share", "breakeven"], ["Premium cash flow type", "premiumType"], ["Breakeven note", "breakEvenNote"], ["Selected scenario P/L", "payoff"], ["Position description", "structure"]];
        const args = '$B$4,$B$5,$B$6,$B$7,$B$8,$B$9,$B$10,$B$11,$B$12';
        sheet.getRange("D4:D14").setValues(metrics.map(row => [row[0]])); sheet.getRange("E4:E14").setFormulas(metrics.map(row => ['=CFSTRATEGY(' + args + ',"' + row[1] + '"' + (row[1] === "payoff" ? ',$B$13' : '') + ')']));
        sheet.getRange("E4:E10").setNumberFormat("0.00"); sheet.getRange("E11:E14").setWrap(true);
        const notes = ["Stock cost basis starts at the regular quote. Enter your own acquisition cost for a covered call. Each contract uses the entered multiplier.", "These are expiration payoffs. They exclude fees, taxes, dividends, financing, slippage, early exercise and assignment timing.", "Source asks seed long legs and bids seed short legs. Both vertical legs use the same expiration. Missing quotes remain N/A."];
        notes.forEach((text, i) => sheet.getRange("A" + (17 + i) + ":L" + (17 + i)).merge().setValue(text).setWrap(true).setFontSize(9));
        sheet.getRange("A25:B45").setFormulas(Array.from({ length: 21 }, (_, index) => ['=IFERROR(IF(MAX($B$5,$B$6,$B$8)>0,MAX($B$5,$B$6,$B$8)*' + index / 10 + ',NA()),NA())', '=IFERROR(VALUE(CFSTRATEGY(' + args + ',"payoff",A' + (25 + index) + ')),NA())']));
        sheet.getRange("A25:B45").setNumberFormat("0.00"); sheet.getRange("J4:K9").setValues(CFAnalysisStrategies.references());
        sheet.insertChart(sheet.newChart().setChartType(Charts.ChartType.LINE).addRange(sheet.getRange("A24:B45")).setNumHeaders(1).setPosition(24, 4, 0, 0).setOption("title", "Strategy payoff at expiration").setOption("width", 800).setOption("height", 340).setOption("legend", { position: "none" }).setOption("hAxis", { title: "Stock price at expiration" }).setOption("vAxis", { title: "Whole-position profit / loss" }).build());
        sheet.setColumnWidth(1, 260); sheet.setColumnWidth(2, 160); sheet.setColumnWidth(3, 130); sheet.setColumnWidth(4, 255); sheet.setColumnWidth(5, 250); sheet.setColumnWidths(20, 6, 170);
        return { sheet };
    }

    static resetInputs(book) {
        const options = book.getSheetByName("Options"), strategies = book.getSheetByName("Strategies");
        for (const [sheet, marker] of [[options, "CACHEFINANCE_ANALYSIS_V1"], [strategies, "CACHEFINANCE_STRATEGIES_V1"]]) if (sheet && sheet.getRange("Z1").getValue() !== marker) throw new Error("The existing " + sheet.getName() + " tab is not managed by TickerSheets.");
        if (options) CFFormulaOptions.optionInputs_(options);
        if (strategies) CFFormulaOptions.strategyInputs_(strategies);
        return { options: Boolean(options), strategies: Boolean(strategies) };
    }
}
