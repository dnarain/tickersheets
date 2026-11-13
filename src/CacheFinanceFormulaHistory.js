/*  *** DEBUG START ***
import { CFFormulaWorkbook } from "./CacheFinanceFormulaWorkbook.js";
export { CFFormulaHistory };
//  *** DEBUG END ***/

/** Write source functions and inspectable worksheet calculations; never fetch or calculate prices here. */
class CFFormulaHistory {
    static get firstRow() { return 8; }
    static get lastRow() { return 517; }

    static positive_(reference) { return "AND(ISNUMBER(" + reference + ")," + reference + ">0)"; }

    static sma_(row, column, period, positive = true) {
        if (row < CFFormulaHistory.firstRow + period - 1) return '=""';
        const range = "$" + column + (row - period + 1) + ":$" + column + row;
        return '=IF(AND(COUNT(' + range + ')=' + period + ',MIN(' + range + ')' + (positive ? '>0' : '>=0') + '),AVERAGE(' + range + '),"")';
    }

    static ema_(row, input, output, period, positive = true) {
        const value = "$" + input + row, previous = "$" + output + (row - 1);
        const range = "$" + input + Math.max(CFFormulaHistory.firstRow, row - period + 1) + ":$" + input + row;
        const valid = positive ? CFFormulaHistory.positive_(value) : "ISNUMBER(" + value + ")";
        const seed = 'IF(' + (positive ? 'AND(COUNT(' + range + ')=' + period + ',MIN(' + range + ')>0)' : 'COUNT(' + range + ')=' + period)
            + ',AVERAGE(' + range + '),"")';
        return '=IF(' + valid + ',IF(ISNUMBER(' + previous + '),' + previous + '+(' + value + '-' + previous + ')*2/(' + period + '+1),' + seed + '),"")';
    }

    static wilder_(row, input, output) {
        const current = "$" + input + row, previous = "$" + output + (row - 1);
        const range = "$" + input + Math.max(CFFormulaHistory.firstRow, row - 13) + ":$" + input + row;
        return '=IF(ISNUMBER(' + current + '),IF(ISNUMBER(' + previous + '),(' + previous + '*13+' + current + ')/14,IF(COUNT(' + range + ')=14,AVERAGE(' + range + '),"")),"")';
    }

    static formulas_(row) {
        const close = "$E" + row, adjusted = "$F" + row, previousAdjusted = "$F" + (row - 1);
        return [
            CFFormulaHistory.sma_(row, "E", 20), CFFormulaHistory.sma_(row, "E", 50), CFFormulaHistory.sma_(row, "E", 200),
            CFFormulaHistory.ema_(row, "E", "K", 12), CFFormulaHistory.ema_(row, "E", "L", 26),
            '=IF(AND(ISNUMBER($K' + row + '),ISNUMBER($L' + row + ')),$K' + row + '-$L' + row + ',"")',
            CFFormulaHistory.ema_(row, "M", "N", 9, false),
            '=IF(AND(ISNUMBER($M' + row + '),ISNUMBER($N' + row + ')),$M' + row + '-$N' + row + ',"")',
            '=IF(AND(ISNUMBER($AT' + row + '),ISNUMBER($AU' + row + ')),IF(AND($AT' + row + '=0,$AU' + row + '=0),50,IF($AU' + row + '=0,100,100-100/(1+$AT' + row + '/$AU' + row + '))),"")',
            '=IF(' + CFFormulaHistory.positive_(adjusted) + ',' + adjusted + '/$AV' + row + '-1,"")',
            row === CFFormulaHistory.firstRow ? '=""' : '=IF(AND(' + CFFormulaHistory.positive_(adjusted) + ',' + CFFormulaHistory.positive_(previousAdjusted) + '),' + adjusted + '/' + previousAdjusted + '-1,"")',
            '=IF($BA' + row + '<>"",' + adjusted + '/$BL$34*100,"")',
            '=IF($BA' + row + '<>"",$AY' + row + '/$BL$35*100,"")',
            '=IF($BA' + row + '<>"",$AZ' + row + '/$BL$36*100,"")',
            '=IF($A' + row + '<>"",30,"")', '=IF($A' + row + '<>"",70,"")'
        ];
    }

    static matchedPrice_(row, matchColumn, priceColumn) {
        const match = "$" + matchColumn + row, price = 'INDEX($' + priceColumn + '$8:$' + priceColumn + '$517,' + match + ')';
        // Only a positive numeric source price can enter an indexed comparison.
        return '=IF(ISNUMBER(' + match + '),IF(COUNT(' + price + ')=1,IF(' + price + '>0,' + price + ',""),""),"")';
    }

    static helpers_(row) {
        const adjusted = "$F" + row, priorAdjusted = "$F" + (row - 1), previousPeak = "$AV" + (row - 1);
        const positive = CFFormulaHistory.positive_(adjusted);
        const change = row === CFFormulaHistory.firstRow ? '=""' : '=IF(AND(' + CFFormulaHistory.positive_("$E" + row) + ',' + CFFormulaHistory.positive_("$E" + (row - 1)) + '),$E' + row + '-$E' + (row - 1) + ',"")';
        const logRange = '$BF' + Math.max(CFFormulaHistory.firstRow, row - 19) + ':$BF' + row;
        return [
            change,
            '=IF(ISNUMBER($AQ' + row + '),MAX($AQ' + row + ',0),"")',
            '=IF(ISNUMBER($AQ' + row + '),MAX(-$AQ' + row + ',0),"")',
            CFFormulaHistory.wilder_(row, "AR", "AT"), CFFormulaHistory.wilder_(row, "AS", "AU"),
            '=IF($A' + row + '="","",IF(' + positive + ',MAX(' + adjusted + ',IF(ISNUMBER(' + previousPeak + '),' + previousPeak + ',' + adjusted + ')),IF(ISNUMBER(' + previousPeak + '),' + previousPeak + ',"")))',
            '=IF($A' + row + '="","",IFNA(MATCH($A' + row + ',$AA$8:$AA$517,0),""))',
            '=IF($A' + row + '="","",IFNA(MATCH($A' + row + ',$AI$8:$AI$517,0),""))',
            CFFormulaHistory.matchedPrice_(row, "AW", "AF"), CFFormulaHistory.matchedPrice_(row, "AX", "AN"),
            '=IF(AND(' + positive + ',ISNUMBER($AY' + row + '),ISNUMBER($AZ' + row + ')),$A' + row + ',"")',
            '=IF($BA' + row + '<>"",' + adjusted + ',"")',
            '=IF($BA' + row + '<>"",$AY' + row + ',"")',
            '=IF($BA' + row + '<>"",$AZ' + row + ',"")',
            CFFormulaHistory.sma_(row, "G", 20, false),
            row === CFFormulaHistory.firstRow ? '=""' : '=IF(AND(' + positive + ',' + CFFormulaHistory.positive_(priorAdjusted) + '),LN(' + adjusted + '/' + priorAdjusted + '),"")',
            '=IF(COUNT(' + logRange + ')=20,STDEV.S(' + logRange + ')*SQRT(252),"")',
            '=IF(' + CFFormulaHistory.positive_("$E" + row) + ',ROW($E' + row + '),"")',
            '=IF(AND($A' + row + '<>"",ISNUMBER($BL$4)),IF(LEFT($A' + row + ',4)<LEFT($BL$5,4),ROW($A' + row + '),""),"")',
            '=IF($BA' + row + '<>"",ROW($A' + row + ')-7,"")'
        ];
    }

    static latest_(column, previous = false) {
        const offset = '$BL$4-' + (previous ? 8 : 7), value = 'INDEX($' + column + '$8:$' + column + '$517,' + offset + ')';
        const result = 'IF(COUNT(' + value + ')=1,' + value + ',"N/A")';
        return '=IF(ISNUMBER($BL$4),' + (previous ? 'IF($BL$4>8,' + result + ',"N/A")' : result) + ',"N/A")';
    }

    static return_(period) {
        const last = 'INDEX($F$8:$F$517,$BL$4-7)', base = 'INDEX($F$8:$F$517,$BL$4-7-' + period + ')';
        return '=IF(ISNUMBER($BL$4),IF($BL$4>=' + (CFFormulaHistory.firstRow + period) + ',IF(AND(COUNT(' + last + ')=1,COUNT(' + base + ')=1),IF(AND(' + last + '>0,' + base + '>0),' + last + '/' + base + '-1,"N/A"),"N/A"),"N/A"),"N/A")';
    }

    static summary_() {
        const common = 'IF(COUNT($BJ$8:$BJ$517)>0,MIN($BJ$8:$BJ$517),"")';
        const priorYearRow = '=IF(COUNT($BI$8:$BI$517)>0,MAX($BI$8:$BI$517),"")';
        const currentAdjusted = 'INDEX($F$8:$F$517,$BL$4-7)', yearBase = 'INDEX($F$8:$F$517,$BL$21-7)';
        return [
            ["Latest close sheet row", '=IF(COUNT($BH$8:$BH$517)>0,MAX($BH$8:$BH$517),"")'],
            ["Indicator date", '=IF(ISNUMBER($BL$4),INDEX($A$8:$A$517,$BL$4-7),"N/A")'],
            ["Closing price", CFFormulaHistory.latest_("E")],
            ["SMA20", CFFormulaHistory.latest_("H")], ["SMA50", CFFormulaHistory.latest_("I")], ["SMA200", CFFormulaHistory.latest_("J")],
            ["RSI14", CFFormulaHistory.latest_("P")], ["MACD", CFFormulaHistory.latest_("M")], ["MACD signal", CFFormulaHistory.latest_("N")],
            ["Previous close", CFFormulaHistory.latest_("E", true)],
            ["1-day adjusted return", CFFormulaHistory.latest_("R")], ["1-week adjusted return", CFFormulaHistory.return_(5)],
            ["1-month adjusted return", CFFormulaHistory.return_(21)], ["3-month adjusted return", CFFormulaHistory.return_(63)],
            ["6-month adjusted return", CFFormulaHistory.return_(126)], ["1-year adjusted return", CFFormulaHistory.return_(252)],
            ["Return since history start", '=IF(ISNUMBER($BL$4),IF(AND(COUNT(' + currentAdjusted + ')=1,COUNT($F$8)=1),IF(AND(' + currentAdjusted + '>0,$F$8>0),' + currentAdjusted + '/$F$8-1,"N/A"),"N/A"),"N/A")'],
            ["Last prior-year sheet row", priorYearRow],
            ["YTD adjusted return", '=IF(AND(ISNUMBER($BL$4),ISNUMBER($BL$21)),IF(AND(COUNT(' + currentAdjusted + ')=1,COUNT(' + yearBase + ')=1),IF(AND(' + currentAdjusted + '>0,' + yearBase + '>0),' + currentAdjusted + '/' + yearBase + '-1,"N/A"),"N/A"),"N/A")'],
            ["20-day annualized volatility", CFFormulaHistory.latest_("BG")],
            ["Maximum observed drawdown", '=IF(ISNUMBER($BL$4),IF($BL$4>8,IF(COUNTIF($F$8:INDEX($F$8:$F$517,$BL$4-7),">0")=$BL$4-7,MIN($Q$8:INDEX($Q$8:$Q$517,$BL$4-7)),"N/A"),"N/A"),"N/A")'],
            ["Current drawdown", CFFormulaHistory.latest_("Q")], ["20-day average volume", CFFormulaHistory.latest_("BE")],
            ["Priced bar count", '=COUNT($BH$8:$BH$517)'],
            ["First history date", '=IF($A$8<>"",$A$8,"N/A")'],
            ["Latest adjusted close", CFFormulaHistory.latest_("F")],
            ["Previous RSI14", CFFormulaHistory.latest_("P", true)],
            ["Published row count", '=IF(ISNUMBER($BL$4),$BL$4-7,0)'],
            ["Latest daily volume", CFFormulaHistory.latest_("G")],
            ["First common row index", '=' + common],
            ["Stock baseline adjusted close", '=IF(ISNUMBER($BL$33),INDEX($F$8:$F$517,$BL$33),"N/A")'],
            ["SPY baseline adjusted close", '=IF(ISNUMBER($BL$33),INDEX($AY$8:$AY$517,$BL$33),"N/A")'],
            ["QQQ baseline adjusted close", '=IF(ISNUMBER($BL$33),INDEX($AZ$8:$AZ$517,$BL$33),"N/A")']
        ];
    }

    static build(book) {
        const sheet = CFFormulaWorkbook.prepareSheet(book, "Price history", "CACHEFINANCE_ANALYSIS_V1");
        if (sheet.getMaxRows() < 517) sheet.insertRowsAfter(sheet.getMaxRows(), 517 - sheet.getMaxRows());
        if (sheet.getMaxColumns() < 64) sheet.insertColumnsAfter(sheet.getMaxColumns(), 64 - sheet.getMaxColumns());
        sheet.setFrozenRows(7); sheet.setHiddenGridlines(true);
        sheet.getRange("A1:W1").merge().setFormula('=UPPER(TRIM(Analysis!$B$4))&" — price history and formulas"').setFontSize(14).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2:W2").merge().setValue("A7 downloads the stock history. H:W calculate from those cells. AQ:BJ show the steps; BK:BL summarize the results.").setWrap(true);
        sheet.getRange("A4:W4").merge().setValue("Indicators use positive raw closes. Returns use adjusted closes. Missing prices leave gaps and restart SMA, EMA and RSI warm-up periods.").setWrap(true);
        sheet.getRange("A5:W5").merge().setValue("The indexed chart starts at 100 on the first date with stock, SPY and QQQ adjusted closes. Each line uses its own local currency.").setWrap(true);
        sheet.getRange("Y2").setValue("Summary formulas are labeled in BK:BL.").setWrap(true);
        sheet.getRange("Y3").setValue("Latest priced row index").setWrap(true);
        sheet.getRange("Y4").setFormula('=IF(ISNUMBER($BL$4),$BL$4-7,0)');
        sheet.getRange("AA1:AG1").merge().setValue("SPY source table").setFontWeight("bold");
        sheet.getRange("AI1:AO1").merge().setValue("QQQ source table").setFontWeight("bold");
        sheet.getRange("AQ1:BJ1").merge().setValue("Visible calculation steps").setFontWeight("bold");
        sheet.getRange("AQ2:BJ2").merge().setValue("Wilder averages use 14 price changes. EMA starts with an SMA seed. Log-return volatility uses 20 daily changes and 252 sessions/year.").setWrap(true);
        const headers = ["SMA20", "SMA50", "SMA200", "EMA12", "EMA26", "MACD", "MACD signal", "MACD histogram", "RSI14", "Drawdown", "1d return", "Stock indexed100", "SPY indexed100", "QQQ indexed100", "RSI30", "RSI70"];
        const helpers = ["Close change", "Gain", "Loss", "Wilder avg gain14", "Wilder avg loss14", "Adjusted peak", "SPY matched row", "QQQ matched row", "SPY adjusted close", "QQQ adjusted close", "Common date", "Stock common adjusted", "SPY common adjusted", "QQQ common adjusted", "Volume average20", "Log adjusted return", "Annualized volatility20", "Priced sheet row", "Prior-year sheet row", "Common row index"];
        sheet.getRange("H7:W7").setValues([headers]); sheet.getRange("AQ7:BJ7").setValues([helpers]);
        for (const range of ["A7:W7", "AA7:AG7", "AI7:AO7", "AQ7:BJ7", "BK3:BL3"]) sheet.getRange(range).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold").setWrap(true);
        sheet.setRowHeights(7, 1, 42);
        sheet.getRange("A7").setFormula('=CFHISTORY(Analysis!$B$4,510,Analysis!$Z$4)');
        sheet.getRange("AA7").setFormula('=CFHISTORY("SPY",510,Analysis!$Z$4)');
        sheet.getRange("AI7").setFormula('=CFHISTORY("QQQ",510,Analysis!$Z$4)');
        const rows = Array.from({ length: 510 }, (_, index) => index + CFFormulaHistory.firstRow);
        sheet.getRange("H8:W517").setFormulas(rows.map(row => CFFormulaHistory.formulas_(row)));
        sheet.getRange("AQ8:BJ517").setFormulas(rows.map(row => CFFormulaHistory.helpers_(row)));
        const summary = CFFormulaHistory.summary_();
        sheet.getRange("BK1:BL1").merge().setValue("History summary formulas").setFontWeight("bold");
        sheet.getRange("BK3:BL3").setValues([["Metric", "Result"]]);
        sheet.getRange(4, 63, summary.length, 1).setValues(summary.map(row => [row[0]]));
        sheet.getRange(4, 64, summary.length, 1).setFormulas(summary.map(row => [row[1]]));
        for (const range of ["A8:A517", "AA8:AA517", "AI8:AI517", "BA8:BA517"]) sheet.getRange(range).setNumberFormat("@");
        for (const range of ["B8:W517", "AB8:AG517", "AJ8:AO517", "AQ8:BJ517", "BL4:BL36"]) sheet.getRange(range).setNumberFormat("#,##0.00");
        for (const range of ["Q8:R517", "BF8:BG517", "BL14:BL20", "BL22:BL25"]) sheet.getRange(range).setNumberFormat("0.00%");
        sheet.getRange("G8:G517").setNumberFormat("#,##0"); sheet.getRange("BE8:BE517").setNumberFormat("#,##0");
        sheet.getRange("BL4").setNumberFormat("0"); sheet.getRange("BL21").setNumberFormat("0"); sheet.getRange("BL27").setNumberFormat("0"); sheet.getRange("BL33").setNumberFormat("0");
        sheet.setColumnWidth(1, 110); sheet.setColumnWidths(2, 22, 115); sheet.setColumnWidths(27, 36, 130); sheet.setColumnWidth(63, 235); sheet.setColumnWidth(64, 150);
        return { sheet, firstRow: CFFormulaHistory.firstRow, lastRow: CFFormulaHistory.lastRow,
            summary: Object.fromEntries(summary.map(([label], index) => [label, "'Price history'!BL" + (index + 4)])),
            latestIndex: "'Price history'!Y4" };
    }
}
