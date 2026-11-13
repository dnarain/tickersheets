/*  *** DEBUG START ***
export { CFFormulaResearch };
//  *** DEBUG END ***/

/** Source functions return tables. The cells below calculate the views and chart data. */
class CFFormulaResearch {
    static prepare_(book, name, marker, subtitle, rows = 1200, columns = 100) {
        const sheet = CFFormulaWorkbook.prepareSheet(book, name, marker);
        if (sheet.getMaxRows() < rows) sheet.insertRowsAfter(sheet.getMaxRows(), rows - sheet.getMaxRows());
        if (sheet.getMaxColumns() < columns) sheet.insertColumnsAfter(sheet.getMaxColumns(), columns - sheet.getMaxColumns());
        sheet.setFrozenRows(6); sheet.setColumnWidths(1, columns, 110);
        sheet.getRange("A1:N1").merge().setFormula('=UPPER(TRIM(Analysis!$B$4))&" — ' + name + '"').setFontSize(14).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2:N2").merge().setValue(subtitle).setWrap(true).setFontColor("#596579");
        sheet.getRange("A3").setValue("Ticker"); sheet.getRange("B3").setFormula("=UPPER(TRIM(Analysis!$B$4))");
        return sheet;
    }

    static header_(sheet, row, column, values) {
        sheet.getRange(row, column, 1, values.length).setValues([values]).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold").setWrap(true);
    }

    static column_(number) {
        let result = "";
        while (number) { number--; result = String.fromCharCode(65 + number % 26) + result; number = Math.floor(number / 26); }
        return result;
    }

    static rows_(sheet, row, column, count, width, formulas) {
        sheet.getRange(row, column, count, width).setFormulas(Array.from({ length: count }, (_value, i) => formulas(row + i, i)));
    }

    static period_(cell, frequency) {
        const text = 'UPPER(TRIM(TO_TEXT(' + cell + ')))';
        const quarter = 'IF(REGEXMATCH(' + text + ',"^(?:[1-4]\\s*Q\\s*[0-9]{4}|Q\\s*[1-4]\\s*[0-9]{4}|[0-9]{4}\\s*Q\\s*[1-4])$"),VALUE(REGEXEXTRACT(' + text + ',"[0-9]{4}"))*4+VALUE(REGEXEXTRACT(REGEXREPLACE(' + text + ',"[0-9]{4}",""),"[1-4]"))-1,"")';
        if (!frequency) return '=IFERROR(' + quarter + ',"")';
        const annual = 'IF(REGEXMATCH(' + text + ',"^(FY\\s*)?[0-9]{4}$"),VALUE(REGEXEXTRACT(' + text + ',"[0-9]{4}")),"")';
        return '=IFERROR(IF(' + frequency + '="Annual",' + annual + ',IF(' + frequency + '="Quarterly",' + quarter + ',"")),"")';
    }

    static numericSignature_(cells) {
        return '=' + cells.map(cell => 'IF(ISNUMBER(' + cell + '),"N:"&TEXT(' + cell + ',"0.00000000000000E+00"),"M")').join('&"|"&');
    }

    static buildEarnings(book) {
        const sheet = CFFormulaResearch.prepare_(book, "Earnings", "CACHEFINANCE_ANALYSIS_V1", "Each source block starts with CFEARNINGS. AU:AX and BA:BD explain period ordering and duplicate checks.");
        sheet.getRange("A4").setValue("Next earnings");
        sheet.getRange("B4").setFormula('=IFNA(INDEX($AQ$8:$AQ$20,MATCH("next_earnings_dates",$AP$8:$AP$20,0)),"N/A")');
        sheet.getRange("D4").setValue("Date status");
        sheet.getRange("E4").setFormula('=IFNA(INDEX($AQ$8:$AQ$20,MATCH("date_status",$AP$8:$AP$20,0)),"N/A")');
        for (const [anchor, section] of [["A7", "earnings"], ["L7", "financials"], ["U7", "estimates"], ["AF7", "dividends"], ["AK7", "splits"], ["AP7", "calendar"]]) {
            sheet.getRange(anchor).setFormula('=CFEARNINGS(Analysis!$B$4,"' + section + '",Analysis!$Z$4)');
        }
        for (const range of ["A7:J7", "L7:S7", "U7:AD7", "AF7:AI7", "AK7:AN7", "AP7:AS7"]) sheet.getRange(range).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold").setWrap(true);
        sheet.getRange("C8:F507").setNumberFormat("0.00"); sheet.getRange("O8:P507").setNumberFormat('#,##0.00'); sheet.getRange("Q8:Q507").setNumberFormat("0.00%");
        sheet.getRange("A8:B507").setNumberFormat("@"); sheet.getRange("G8:J507").setNumberFormat("@");
        sheet.setColumnWidth(1, 170); sheet.setColumnWidth(10, 330); sheet.setColumnWidth(12, 165); sheet.setColumnWidth(19, 330);
        CFFormulaResearch.header_(sheet, 7, 47, ["Fiscal period key", "EPS signature", "Accepted first record", "Reason"]);
        CFFormulaResearch.rows_(sheet, 8, 47, 500, 4, row => {
            const group = '$AU$8:$AU$507,$AU' + row + ',$B$8:$B$507,$B' + row + ',$I$8:$I$507,$I' + row;
            const matches = 'COUNTIFS(' + group + ')', same = 'COUNTIFS(' + group + ',$AV$8:$AV$507,$AV' + row + ')';
            const first = 'COUNTIFS($AU$8:$AU' + row + ',$AU' + row + ',$B$8:$B' + row + ',$B' + row + ',$I$8:$I' + row + ',$I' + row + ')=1';
            return [CFFormulaResearch.period_('$A' + row), CFFormulaResearch.numericSignature_(['$C' + row, '$D' + row]),
                '=IF(AND(ISNUMBER($AU' + row + '),OR($B' + row + '="GAAP",$B' + row + '="Adjusted"),REGEXMATCH(TO_TEXT($I' + row + '),"^[A-Z]{3}$")) ,IF(' + matches + '=' + same + ',IF(' + first + ',1,0),0),0)',
                '=IF($A' + row + '="","",IF($AU' + row + '="","Unrecognized fiscal period",IF($AW' + row + '=1,"Accepted",IF(' + matches + '>1,"Duplicate period: excluded or repeated","Basis or currency unavailable"))))'];
        });
        CFFormulaResearch.header_(sheet, 7, 53, ["Financial period key", "Financial signature", "Accepted first record", "Reason"]);
        CFFormulaResearch.rows_(sheet, 8, 53, 500, 4, row => {
            const group = '$BA$8:$BA$507,$BA' + row + ',$M$8:$M$507,$M' + row + ',$N$8:$N$507,$N' + row + ',$R$8:$R$507,$R' + row;
            const matches = 'COUNTIFS(' + group + ')', same = 'COUNTIFS(' + group + ',$BB$8:$BB$507,$BB' + row + ')';
            const first = 'COUNTIFS($BA$8:$BA' + row + ',$BA' + row + ',$M$8:$M' + row + ',$M' + row + ',$N$8:$N' + row + ',$N' + row + ',$R$8:$R' + row + ',$R' + row + ')=1';
            return [CFFormulaResearch.period_('$L' + row, '$M' + row), CFFormulaResearch.numericSignature_(['$O' + row, '$P' + row, '$Q' + row]),
                '=IF(AND(ISNUMBER($BA' + row + '),OR($N' + row + '="GAAP",$N' + row + '="Adjusted"),OR($M' + row + '="Annual",$M' + row + '="Quarterly"),REGEXMATCH(TO_TEXT($R' + row + '),"^[A-Z]{3}$")),IF(' + matches + '=' + same + ',IF(' + first + ',1,0),0),0)',
                '=IF($L' + row + '="","",IF($BA' + row + '="","Unrecognized financial period",IF($BC' + row + '=1,"Accepted",IF(' + matches + '>1,"Duplicate period: excluded or repeated","Basis, frequency or currency unavailable"))))'];
        });
        sheet.getRange("AU3:BD4").merge().setValue("Numeric keys put fiscal periods in order. Signatures distinguish a missing value from zero. Conflicting duplicate periods are excluded; identical duplicates count once.").setWrap(true);
        return sheet;
    }

    static chart_(book, sheet, source, ranges, title, index, type = "LINE", options = {}) {
        const ticker = String(book.getSheetByName("Analysis")?.getRange("B4").getValue() || "Selected stock").trim().toUpperCase();
        let chart = sheet.newChart().setChartType(Charts.ChartType[type]).setNumHeaders(1).setPosition(35 + Math.floor(index / 2) * 18, index % 2 ? 7 : 1, 0, 0)
            .setOption("title", ticker + " — " + title).setOption("fontName", "Arial").setOption("fontSize", 10).setOption("width", 630).setOption("height", 310)
            .setOption("legend", { position: "bottom" }).setOption("interpolateNulls", false).setOption("colors", ["#17365D", "#2C8B8B", "#D99520"]);
        for (const range of ranges) chart = chart.addRange(source.getRange(range));
        for (const [key, value] of Object.entries(options)) chart = chart.setOption(key, value);
        sheet.insertChart(chart.build());
    }

    static buildResearch(book) {
        // Row 600 holds each extra-expiration header; the next 10,000 rows remain clear for raw contracts.
        const sheet = CFFormulaResearch.prepare_(book, "Research", "CACHEFINANCE_RESEARCH_V1", "Summary cells reference Earnings and Options. Source formulas and chart helpers stay visible to the right and below the charts.", 10600);
        sheet.getRange("A4").setValue("Next earnings"); sheet.getRange("B4").setFormula("=Earnings!B4"); sheet.getRange("C4").setFormula("=Earnings!E4");
        CFFormulaResearch.header_(sheet, 7, 1, ["EPS basis", "Provider fiscal period", "Actual EPS", "Estimate EPS", "Surprise % points", "Reported", "Currency"]);
        CFFormulaResearch.header_(sheet, 13, 1, ["Basis", "Frequency", "Latest period", "Revenue", "Revenue growth", "Net income", "Income growth", "Net margin", "Margin Δ pp", "Compared with", "Currency", "Comparison note"]);
        CFFormulaResearch.header_(sheet, 301, 1, ["EPS basis", "Latest currency", "Latest period key", "Source row index", "Explanation"]);
        for (const [i, basis] of ["GAAP", "Adjusted"].entries()) {
            const helper = 302 + i, row = 8 + i;
            sheet.getRange(helper, 1).setValue(basis);
            sheet.getRange(helper, 3).setFormula('=IFERROR(MAX(FILTER(Earnings!$AU$8:$AU$507,Earnings!$B$8:$B$507=$A' + helper + ',Earnings!$AW$8:$AW$507=1,ISNUMBER(Earnings!$C$8:$C$507))),"N/A")');
            const currency = 'FILTER(Earnings!$I$8:$I$507,Earnings!$B$8:$B$507=$A' + helper + ',Earnings!$AW$8:$AW$507=1,Earnings!$AU$8:$AU$507=$C' + helper + ',ISNUMBER(Earnings!$C$8:$C$507))';
            sheet.getRange(helper, 2).setFormula('=IFERROR(IF(COUNTUNIQUE(' + currency + ')=1,INDEX(' + currency + ',1),"N/A"),"N/A")');
            sheet.getRange(helper, 4).setFormula('=IFERROR(MATCH(1,INDEX((Earnings!$B$8:$B$507=$A' + helper + ')*(Earnings!$I$8:$I$507=$B' + helper + ')*(Earnings!$AU$8:$AU$507=$C' + helper + ')*(Earnings!$AW$8:$AW$507=1)*ISNUMBER(Earnings!$C$8:$C$507),0),0),"")');
            sheet.getRange(helper, 5).setValue("Latest numeric actual, recognized fiscal period and one reporting currency.");
            const from = column => '=IF($D' + helper + '="","N/A",INDEX(Earnings!$' + column + '$8:$' + column + '$507,$D' + helper + '))';
            sheet.getRange(row, 1).setValue(basis); sheet.getRange(row, 2).setFormula(from("A")); sheet.getRange(row, 3).setFormula(from("C")); sheet.getRange(row, 4).setFormula(from("D"));
            sheet.getRange(row, 5).setFormula('=IF($D' + helper + '="","N/A",IF(ISNUMBER(INDEX(Earnings!$F$8:$F$507,$D' + helper + ')),INDEX(Earnings!$F$8:$F$507,$D' + helper + '),IF(AND(ISNUMBER(C' + row + '),ISNUMBER(D' + row + '),D' + row + '<>0),(C' + row + '-D' + row + ')/ABS(D' + row + ')*100,"N/A")))');
            sheet.getRange(row, 6).setFormula(from("G")); sheet.getRange(row, 7).setFormula('=$B' + helper);
            const col = i ? 21 : 15;
            CFFormulaResearch.header_(sheet, 40, col, ["Period key", "Fiscal period", "EPS basis", "Actual EPS", "Estimate EPS"]);
            sheet.getRange(41, col).setFormula('=IFNA(SORT(FILTER({Earnings!$AU$8:$AU$507,Earnings!$A$8:$D$507},Earnings!$B$8:$B$507=$A' + helper + ',Earnings!$I$8:$I$507=$B' + helper + ',Earnings!$AW$8:$AW$507=1),1,TRUE),"")');
            sheet.getRange(41, col + 3, 500, 2).setNumberFormat("0.00");
            CFFormulaResearch.chart_(book, sheet, sheet, [CFFormulaResearch.column_(col + 1) + "40:" + CFFormulaResearch.column_(col + 1) + "540", CFFormulaResearch.column_(col + 3) + "40:" + CFFormulaResearch.column_(col + 4) + "540"], basis + " EPS actual / estimate (reported currency)", i + 2, "COLUMN");
        }
        CFFormulaResearch.header_(sheet, 305, 1, ["Financial basis", "Frequency", "Latest currency", "Latest period key", "Latest source row", "Prior source row"]);
        const groups = [["GAAP", "Annual", 27], ["GAAP", "Quarterly", 37], ["Adjusted", "Annual", 47], ["Adjusted", "Quarterly", 57]];
        for (const [i, [basis, frequency, col]] of groups.entries()) {
            const helper = 306 + i, row = 14 + i;
            sheet.getRange(helper, 1, 1, 2).setValues([[basis, frequency]]);
            const criteria = 'Earnings!$N$8:$N$507=$A' + helper + ',Earnings!$M$8:$M$507=$B' + helper + ',Earnings!$BC$8:$BC$507=1';
            sheet.getRange(helper, 4).setFormula('=IFERROR(MAX(FILTER(Earnings!$BA$8:$BA$507,' + criteria + ')),"N/A")');
            const currencies = 'FILTER(Earnings!$R$8:$R$507,' + criteria + ',Earnings!$BA$8:$BA$507=$D' + helper + ')';
            sheet.getRange(helper, 3).setFormula('=IFERROR(IF(COUNTUNIQUE(' + currencies + ')=1,INDEX(' + currencies + ',1),"N/A"),"N/A")');
            const sourceMatch = key => '=IFERROR(MATCH(1,INDEX((Earnings!$N$8:$N$507=$A' + helper + ')*(Earnings!$M$8:$M$507=$B' + helper + ')*(Earnings!$R$8:$R$507=$C' + helper + ')*(Earnings!$BA$8:$BA$507=' + key + ')*(Earnings!$BC$8:$BC$507=1),0),0),"")';
            sheet.getRange(helper, 5).setFormula(sourceMatch('$D' + helper)); sheet.getRange(helper, 6).setFormula(sourceMatch('$D' + helper + '-1'));
            const value = (column, previous = false) => 'INDEX(Earnings!$' + column + '$8:$' + column + '$507,$' + (previous ? "F" : "E") + helper + ')';
            const current = column => '=IF($E' + helper + '="","N/A",' + value(column) + ')';
            const growth = column => '=IF(OR($E' + helper + '="",$F' + helper + '=""),"N/A",IF(AND(ISNUMBER(' + value(column) + '),ISNUMBER(' + value(column, true) + '),' + value(column, true) + '>0),' + value(column) + '/' + value(column, true) + '-1,"N/A"))';
            sheet.getRange(row, 1, 1, 2).setValues([[basis, frequency]]);
            sheet.getRange(row, 3).setFormula(current("L")); sheet.getRange(row, 4).setFormula(current("O")); sheet.getRange(row, 5).setFormula(growth("O"));
            sheet.getRange(row, 6).setFormula(current("P")); sheet.getRange(row, 7).setFormula(growth("P")); sheet.getRange(row, 8).setFormula(current("Q"));
            sheet.getRange(row, 9).setFormula('=IF(OR($E' + helper + '="",$F' + helper + '=""),"N/A",IF(AND(ISNUMBER(' + value("Q") + '),ISNUMBER(' + value("Q", true) + ')),(' + value("Q") + '-' + value("Q", true) + ')*100,"N/A"))');
            sheet.getRange(row, 10).setFormula('=IF($F' + helper + '="","N/A",' + value("L", true) + ')'); sheet.getRange(row, 11).setFormula('=$C' + helper);
            sheet.getRange(row, 12).setFormula('=IF($E' + helper + '="","No unique latest period/currency",IF($F' + helper + '="","Consecutive prior period unavailable","' + (frequency === "Annual" ? "YoY" : "QoQ") + ': same basis, frequency and currency. Growth requires a positive prior value."))');
            CFFormulaResearch.header_(sheet, 7, col, ["Period key", "Financial period", "Frequency", "Basis", "Revenue", "Net income", "Net margin", "Currency", "Source"]);
            sheet.getRange(8, col).setFormula('=IFNA(SORT(FILTER({Earnings!$BA$8:$BA$507,Earnings!$L$8:$S$507},' + criteria + ',Earnings!$R$8:$R$507=$C' + helper + '),1,TRUE),"")');
            sheet.getRange(8, col + 4, 500, 2).setNumberFormat('#,##0,,"M"');
            CFFormulaResearch.chart_(book, sheet, sheet, [CFFormulaResearch.column_(col + 1) + "7:" + CFFormulaResearch.column_(col + 1) + "507", CFFormulaResearch.column_(col + 4) + "7:" + CFFormulaResearch.column_(col + 5) + "507"], basis + " " + frequency.toLowerCase() + " revenue / net income (reported currency)", i + 4, "COLUMN", { vAxis: { format: "short" } });
        }
        sheet.getRange("C8:E9").setNumberFormat("0.00"); sheet.getRange("D14:D17").setNumberFormat('#,##0,,"M"'); sheet.getRange("F14:F17").setNumberFormat('#,##0,,"M"');
        sheet.getRangeList(["E14:E17", "G14:H17"]).setNumberFormat("0.00%"); sheet.getRange("I14:I17").setNumberFormat("0.00"); sheet.getRange("L14:L17").setWrap(true); sheet.setColumnWidth(12, 310);
        sheet.getRange("A20:N20").merge().setValue("Quarterly comparisons use consecutive quarters. Annual comparisons use consecutive years. Accounting bases and currencies stay separate.").setWrap(true);
        sheet.getRange("A21:N21").merge().setValue("EPS chart helpers start at O40. Financial chart helpers start at AA7. Summary helpers start at A301. Earnings period keys and duplicate checks are visible at Earnings!AU7:BD507.").setWrap(true);
        CFFormulaResearch.buildMaturities_(book, sheet);
        CFFormulaResearch.buildChartHelpers_(book, sheet);
        sheet.getRange("A189").setValue("Finviz source formula"); sheet.getRange("A190").setFormula('=CFFIELD("FINVIZ",Analysis!$B$4,"all",Analysis!$Z$4)');
        sheet.getRange("G189").setValue("GuruFocus source formula"); sheet.getRange("G190").setFormula('=CFFIELD("GURUFOCUS",Analysis!$B$4,"all",Analysis!$Z$4)');
        sheet.getRange("A229").setValue("Zacks source formula"); sheet.getRange("A230").setFormula('=CFFIELD("ZACKS",Analysis!$B$4,"all",Analysis!$Z$4)');
        sheet.getRange("A299:L299").merge().setValue("These helper formulas select one reporting currency at the latest accepted period. Missing periods and conflicting records remain unavailable.").setWrap(true);
        return sheet;
    }

    static buildMaturities_(book, sheet) {
        CFFormulaResearch.header_(sheet, 24, 1, ["Expiration", "Call strike", "Call mid", "Call spread", "Call IV", "Call OI", "Call volume", "Put strike", "Put mid", "Put spread", "Put IV", "Put OI", "Put volume", "Status", "Call source index", "Put source index", "Same-strike ATM IV", "Chosen call strike", "Chosen put strike"]);
        sheet.getRange("A25").setFormula('=IF(Options!$B$4="","N/A",IF(ISNUMBER(Options!$B$4),TEXT(Options!$B$4,"yyyy-mm-dd"),Options!$B$4))');
        CFFormulaResearch.header_(sheet, 7, 94, ["Published expiration", "Date serial", "Distance 30 days", "Distance 90 days", "Distance 180 days", "Distance 365 days"]);
        CFFormulaResearch.rows_(sheet, 8, 94, 200, 6, row => {
            const formulas = ['=IF(\'Quote data\'!$O' + row + '="","",\'Quote data\'!$O' + row + ')', '=IFERROR(DATEVALUE($CP' + row + '),"")'];
            for (const [i, target] of [30, 90, 180, 365].entries()) formulas.push('=IF(AND(ISNUMBER($CQ' + row + '),$CQ' + row + '>=DATEVALUE(Analysis!$K$4),COUNTIF($A$25:$A$' + (25 + i) + ',$CP' + row + ')=0),ABS($CQ' + row + '-DATEVALUE(Analysis!$K$4)-' + target + '),1E99)');
            return formulas;
        });
        for (let i = 0; i < 4; i++) {
            const column = CFFormulaResearch.column_(96 + i), range = '$' + column + '$8:$' + column + '$207';
            sheet.getRange(26 + i, 1).setFormula('=IF(MIN(' + range + ')>=1E99,"N/A",INDEX($CP$8:$CP$207,MATCH(MIN(' + range + '),' + range + ',0)))');
        }
        const blocks = [{ sheet: "Options", col: 1, first: 8, last: 1007, valid: "CM", distance: "CN", helperFirst: 601, helperLast: 1600, anchor: "Options!$A$7" },
            ...[27, 43, 59, 75].map(col => ({ sheet: "Research", col, first: 601, last: 1600, valid: CFFormulaResearch.column_(col + 12), distance: CFFormulaResearch.column_(col + 13), helperFirst: 601, helperLast: 1600, anchor: "Research!$" + CFFormulaResearch.column_(col) + "$600" }))]
            .map(block => ({ ...block, callDistance: CFFormulaResearch.column_(CFFormulaResearch.columnNumber_(block.valid) + 2), putDistance: CFFormulaResearch.column_(CFFormulaResearch.columnNumber_(block.valid) + 3) }));
        for (const [i, block] of blocks.entries()) {
            const row = 25 + i, sourcePrefix = block.sheet === "Options" ? "Options!" : "";
            const source = offset => sourcePrefix + "$" + CFFormulaResearch.column_(block.col + offset - 1) + "$" + block.first + ":$" + CFFormulaResearch.column_(block.col + offset - 1) + "$" + block.last;
            const validity = '$' + block.valid + '$' + block.helperFirst + ':$' + block.valid + '$' + block.helperLast;
            const distance = '$' + block.distance + '$' + block.helperFirst + ':$' + block.distance + '$' + block.helperLast;
            const callDistance = '$' + block.callDistance + '$' + block.helperFirst + ':$' + block.callDistance + '$' + block.helperLast;
            const putDistance = '$' + block.putDistance + '$' + block.helperFirst + ':$' + block.putDistance + '$' + block.helperLast;
            if (i) sheet.getRange(600, block.col).setFormula(CFFormulaWorkbook.optionSource('$A' + row, true));
            CFFormulaResearch.header_(sheet, 600, CFFormulaResearch.columnNumber_(block.valid), [i ? "Usable IV" : "Selected expiry usable IV", "Common-strike call distance", "Call distance", "Put distance"]);
            CFFormulaResearch.rows_(sheet, block.helperFirst, CFFormulaResearch.columnNumber_(block.valid), 1000, 4, (_helperRow, index) => {
                const dataRow = block.first + index, cell = offset => sourcePrefix + "$" + CFFormulaResearch.column_(block.col + offset - 1) + dataRow;
                const valid = '=IF(AND(OR(' + cell(2) + '="Call",' + cell(2) + '="Put"),ISNUMBER(' + cell(3) + '),' + cell(3) + '>0,ISNUMBER(' + cell(4) + '),' + cell(4) + '>=0,ISNUMBER(' + cell(5) + '),' + cell(5) + '>0,' + cell(5) + '>=' + cell(4) + ',ISNUMBER(' + cell(8) + '),' + cell(8) + '>0),1,0)';
                const common = '=IF(AND(' + cell(2) + '="Call",ISNUMBER(' + cell(3) + '),' + cell(3) + '>0,COUNTIFS(' + source(2) + ',"Call",' + source(3) + ',' + cell(3) + ')=1,COUNTIFS(' + source(2) + ',"Put",' + source(3) + ',' + cell(3) + ')=1,ISNUMBER(Analysis!$B$9)),ABS(' + cell(3) + '-Analysis!$B$9),1E99)';
                const independent = kind => '=IF(AND(' + cell(2) + '="' + kind + '",ISNUMBER(' + cell(3) + '),' + cell(3) + '>0,COUNTIFS(' + source(2) + ',"' + kind + '",' + source(3) + ',' + cell(3) + ')=1,ISNUMBER(Analysis!$B$9)),ABS(' + cell(3) + '-Analysis!$B$9),1E99)';
                return [valid, common, independent("Call"), independent("Put")];
            });
            const chosenStrike = scores => 'MIN(FILTER(' + source(3) + ',' + scores + '=MIN(' + scores + ')))';
            sheet.getRange(row, 18).setFormula('=IF(MIN(' + distance + ')<1E99,' + chosenStrike(distance) + ',IF(MIN(' + callDistance + ')<1E99,' + chosenStrike(callDistance) + ',"N/A"))');
            sheet.getRange(row, 19).setFormula('=IF(MIN(' + distance + ')<1E99,$R' + row + ',IF(MIN(' + putDistance + ')<1E99,' + chosenStrike(putDistance) + ',"N/A"))');
            sheet.getRange(row, 15).setFormula('=IF(ISNUMBER($R' + row + '),MATCH(1,INDEX((' + source(2) + '="Call")*(' + source(3) + '=$R' + row + '),0),0),"")');
            sheet.getRange(row, 2).setFormula('=IF($O' + row + '="","N/A",INDEX(' + source(3) + ',$O' + row + '))');
            sheet.getRange(row, 16).setFormula('=IF(ISNUMBER($S' + row + '),MATCH(1,INDEX((' + source(2) + '="Put")*(' + source(3) + '=$S' + row + '),0),0),"")');
            const indexed = (field, kind) => 'INDEX(' + source(field) + ',$' + (kind === "Call" ? "O" : "P") + row + ')';
            for (const [kind, start] of [["Call", 2], ["Put", 8]]) {
                const index = '$' + (kind === "Call" ? "O" : "P") + row;
                const usableQuote = 'AND(ISNUMBER(' + indexed(4, kind) + '),ISNUMBER(' + indexed(5, kind) + '),' + indexed(4, kind) + '>=0,' + indexed(5, kind) + '>0,' + indexed(5, kind) + '>=' + indexed(4, kind) + ')';
                const values = [3, 6, null, 8, 10, 9].map(field => field === null
                    ? '=IF(' + index + '="","N/A",IF(' + usableQuote + ',' + indexed(5, kind) + '-' + indexed(4, kind) + ',"N/A"))'
                    : field === 8 ? '=IF(' + index + '="","N/A",IF(INDEX(' + validity + ',' + index + ')=1,' + indexed(field, kind) + ',"N/A"))'
                    : field === 6 ? '=IF(' + index + '="","N/A",IF(' + usableQuote + ',' + indexed(field, kind) + ',"N/A"))'
                    : '=IF(' + index + '="","N/A",' + indexed(field, kind) + ')');
                sheet.getRange(row, start, 1, 6).setFormulas([values]);
            }
            sheet.getRange(row, 14).setFormula('=IF(ISNUMBER($Q' + row + '),"Available",IF(OR(ISNUMBER($C' + row + '),ISNUMBER($I' + row + ')),"Partial",IF(LEFT(TO_TEXT(' + block.anchor + '),4)="N/A:",' + block.anchor + ',"Unavailable")))');
            sheet.getRange(row, 17).setFormula('=IF(AND(ISNUMBER($E' + row + '),ISNUMBER($K' + row + '),$B' + row + '=$H' + row + '),AVERAGE($E' + row + ',$K' + row + '),"N/A")');
        }
        sheet.getRange("B25:M29").setNumberFormat("0.00"); sheet.getRangeList(["E25:E29", "K25:K29", "Q25:Q29"]).setNumberFormat("0.00%"); sheet.getRangeList(["F25:G29", "L25:M29"]).setNumberFormat("#,##0");
        sheet.getRange("A31:N32").merge().setValue("The selected expiry reuses Options!A7. Extra sources start at AA600, AQ600, BG600 and BW600. Selection uses the nearest common strike, or nearest individual legs if no common strike exists. Ties use the lower strike. Mean ATM IV requires usable quotes at one strike.").setWrap(true);
        sheet.getRange("A33:N34").merge().setFormula('=IF(OR(ISERROR($AA$600),ISERROR($AQ$600),ISERROR($BG$600),ISERROR($BW$600)),"Option source error: inspect AA600, AQ600, BG600 and BW600. Each extra source has capacity for 10,000 contracts; a larger result requires more sheet rows.",IF(OR(Options!$B$1008="Call",Options!$B$1008="Put",$AB$1601="Call",$AB$1601="Put",$AR$1601="Call",$AR$1601="Put",$BH$1601="Call",$BH$1601="Put",$BX$1601="Call",$BX$1601="Put"),"More than 1,000 contracts returned for an expiry. Calculations and charts use the first 1,000; full raw source output remains visible. Each extra source has capacity for 10,000 contracts.","Calculations and charts use up to 1,000 contracts per expiry. Each extra source has capacity for 10,000 raw contracts; larger results require more sheet rows."))').setWrap(true).setFontSize(9);
        CFFormulaResearch.header_(sheet, 530, 27, ["Expiration", "Call IV", "Put IV", "Same-strike ATM IV"]);
        CFFormulaResearch.rows_(sheet, 531, 27, 5, 4, (_row, index) => {
            const sourceRow = 25 + index;
            return ['=IFERROR(DATEVALUE($A' + sourceRow + '),NA())', ...["E", "K", "Q"].map(column => '=IF(ISNUMBER($' + column + sourceRow + '),$' + column + sourceRow + ',NA())')];
        });
        sheet.getRange("AA531:AA535").setNumberFormat("yyyy-mm-dd"); sheet.getRange("AB531:AD535").setNumberFormat("0.00%");
        CFFormulaResearch.chart_(book, sheet, sheet, ["AA530:AD535"], "ATM IV by expiration", 10, "LINE", { vAxis: { format: "percent" } });
    }

    static columnNumber_(value) { return [...value].reduce((result, letter) => result * 26 + letter.charCodeAt(0) - 64, 0); }

    static buildChartHelpers_(book, sheet) {
        CFFormulaResearch.header_(sheet, 420, 1, ["Strike", "Call IV", "Put IV", "Call open interest", "Put open interest"]);
        sheet.getRange("A421").setFormula('=IFNA(SORT(UNIQUE(FILTER(Options!$C$8:$C$1007,ISNUMBER(Options!$C$8:$C$1007),Options!$C$8:$C$1007>0))),"")');
        CFFormulaResearch.rows_(sheet, 421, 2, 1000, 4, row => [["Call", "H"], ["Put", "H"], ["Call", "J"], ["Put", "J"]].map(([kind, field]) => {
            const usable = field === "H" ? ',$CM$601:$CM$1600=1' : "", countUsable = field === "H" ? ',$CM$601:$CM$1600,1' : "";
            const value = 'INDEX(FILTER(Options!$' + field + '$8:$' + field + '$1007,Options!$B$8:$B$1007="' + kind + '",Options!$C$8:$C$1007=$A' + row + usable + '),1)';
            return '=IF(ISNUMBER($A' + row + '),IF(COUNTIFS(Options!$B$8:$B$1007,"' + kind + '",Options!$C$8:$C$1007,$A' + row + countUsable + ')=1,IF(ISNUMBER(' + value + '),' + value + ',NA()),NA()),NA())';
        }));
        sheet.getRange("B421:C1420").setNumberFormat("0.00%"); sheet.getRange("D421:E1420").setNumberFormat("#,##0");
        CFFormulaResearch.chart_(book, sheet, sheet, ["A420:C1420"], "selected expiry IV by strike", 8, "LINE", { vAxis: { format: "percent" }, hAxis: { title: "Strike" } });
        CFFormulaResearch.chart_(book, sheet, sheet, ["A420:A1420", "D420:E1420"], "selected expiry open interest by strike", 9, "COLUMN", { isStacked: true, hAxis: { title: "Strike" }, vAxis: { title: "Contracts", format: "short" } });
        CFFormulaResearch.header_(sheet, 550, 15, ["Date", "Daily volume"]); CFFormulaResearch.header_(sheet, 550, 18, ["Date", "MACD", "Signal", "Histogram"]);
        const recent = (column, index) => {
            const value = 'INDEX(\'Price history\'!$' + column + '$8:$' + column + '$517,MAX(1,COUNTA(\'Price history\'!$A$8:$A$517)-125)+' + index + ')';
            return '=IF(' + (index + 1) + '<=COUNTA(\'Price history\'!$A$8:$A$517),' + (column === "A" ? 'IFERROR(DATEVALUE(' + value + '),NA())' : 'IF(ISNUMBER(' + value + '),' + value + ',NA())') + ',NA())';
        };
        CFFormulaResearch.rows_(sheet, 551, 15, 126, 2, (_row, index) => ["A", "G"].map(column => recent(column, index)));
        CFFormulaResearch.rows_(sheet, 551, 18, 126, 4, (_row, index) => ["A", "M", "N", "O"].map(column => recent(column, index)));
        sheet.getRangeList(["O551:O676", "R551:R676"]).setNumberFormat("yyyy-mm-dd");
        CFFormulaResearch.chart_(book, sheet, sheet, ["O550:P676"], "Daily volume; latest session may be partial", 0, "COLUMN", { legend: { position: "none" }, vAxis: { title: "Shares", format: "short" } });
        CFFormulaResearch.chart_(book, sheet, sheet, ["R550:U676"], "MACD / signal / histogram", 1, "COMBO", { series: { 0: { type: "line" }, 1: { type: "line" }, 2: { type: "bars" } } });
        const macro = book.getSheetByName("Macro");
        if (macro) ["AA15:AB415", "AC15:AD415", "AE15:AF415", "AG15:AH415"].forEach((range, i) => CFFormulaResearch.chart_(book, sheet, macro, [range], "FRED " + ["DGS10", "FEDFUNDS", "CPIAUCSL", "UNRATE"][i] + " (published units)", 11 + i, "LINE", { legend: { position: "none" } }));
    }

    static buildMacro(book) {
        const sheet = CFFormulaResearch.prepare_(book, "Macro", "CACHEFINANCE_ANALYSIS_V1", "Each source block calls CFFRED once. Summary formulas use the last two numeric observations. FRED requires your own key.");
        CFFormulaResearch.header_(sheet, 7, 1, ["FRED series", "Indicator", "Latest period", "Value", "Unit", "Change", "Status", "Source / notes"]);
        CFFormulaResearch.header_(sheet, 7, 27, ["Series", "Last numeric row", "Previous numeric row", "Numeric observations"]);
        const series = [["DGS10", "10-year Treasury yield", 1], ["FEDFUNDS", "Federal funds effective rate", 7], ["CPIAUCSL", "Consumer price index", 13], ["UNRATE", "Unemployment rate", 19]];
        for (const [i, [id, label, column]] of series.entries()) {
            const row = 8 + i, date = CFFormulaResearch.column_(column), value = CFFormulaResearch.column_(column + 1), unit = CFFormulaResearch.column_(column + 2), level = '$' + value + '$16:$' + value + '$415';
            sheet.getRange(15, column).setFormula('=CFFRED("' + id + '",400,Analysis!$Z$4)'); sheet.getRange(15, column, 1, 5).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold");
            sheet.getRange(16, column + 1, 400, 1).setNumberFormat("0.00");
            sheet.getRange(row, 27).setValue(id); sheet.getRange(row, 28).setFormula('=IFNA(MAX(FILTER(ROW(' + level + '),ISNUMBER(' + level + '))),0)');
            sheet.getRange(row, 29).setFormula('=IFNA(MAX(FILTER(ROW(' + level + '),ISNUMBER(' + level + '),ROW(' + level + ')<$AB' + row + ')),0)'); sheet.getRange(row, 30).setFormula('=COUNT(' + level + ')');
            sheet.getRange(row, 1, 1, 2).setValues([[id, label]]);
            sheet.getRange(row, 3).setFormula('=IF($AB' + row + '=0,"N/A",INDEX($' + date + '$16:$' + date + '$415,$AB' + row + '-15))');
            sheet.getRange(row, 4).setFormula('=IF($AB' + row + '=0,"N/A",INDEX(' + level + ',$AB' + row + '-15))');
            sheet.getRange(row, 5).setFormula('=IF($AB' + row + '=0,"N/A",INDEX($' + unit + '$16:$' + unit + '$415,$AB' + row + '-15))');
            sheet.getRange(row, 6).setFormula('=IF(OR($AB' + row + '=0,$AC' + row + '=0),"N/A",INDEX(' + level + ',$AB' + row + '-15)-INDEX(' + level + ',$AC' + row + '-15))');
            sheet.getRange(row, 7).setFormula('=IF($AD' + row + '>0,"Available",IF(LEFT(TO_TEXT($' + date + '$15),4)="N/A:",$' + date + '$15,"No numeric observations"))');
            sheet.getRange(row, 8).setValue("https://fred.stlouisfed.org/series/" + id);
            const chartColumn = 27 + i * 2;
            CFFormulaResearch.header_(sheet, 15, chartColumn, [id + " observation period", "Level"]);
            CFFormulaResearch.rows_(sheet, 16, chartColumn, 400, 2, sourceRow => ['=IFERROR(DATEVALUE($' + date + sourceRow + '),NA())', '=IF(ISNUMBER($' + value + sourceRow + '),$' + value + sourceRow + ',NA())']);
            sheet.getRange(16, chartColumn, 400, 1).setNumberFormat("yyyy-mm-dd"); sheet.getRange(16, chartColumn + 1, 400, 1).setNumberFormat("0.00");
        }
        sheet.getRange("D8:F11").setNumberFormat("0.00"); sheet.getRange("G8:G11").setWrap(true); sheet.setColumnWidth(2, 270); sheet.setColumnWidth(8, 350);
        if (typeof sheet.autoResizeRows === "function") sheet.autoResizeRows(8, 4);
        sheet.getRange("A13:W13").merge().setValue("Dates identify observation periods, not publication times. Rates retain percent levels. CPIAUCSL is an index level, not an inflation rate. A missing observation stays unavailable.").setWrap(true);
        return sheet;
    }

    static sourceStatus_(sheetName, anchor, firstData, rows, numericColumn) {
        const prefix = "'" + sheetName + "'!", first = prefix + firstData, start = Number(firstData.match(/[0-9]+$/)[0]), keyColumn = firstData.match(/^[A-Z]+/)[0], keys = prefix + '$' + keyColumn + '$' + start + ':$' + keyColumn + '$' + (start + rows - 1);
        const counts = numericColumn ? 'COUNT(' + prefix + '$' + numericColumn + '$' + start + ':$' + numericColumn + '$' + (start + rows - 1) + ')>0' : 'COUNTA(' + keys + ')>0';
        return '=IF(ISERROR(' + prefix + anchor + '),' + prefix + anchor + ',IF(ISERROR(' + first + '),' + first + ',IF(LEFT(TO_TEXT(' + prefix + anchor + '),4)="N/A:",' + prefix + anchor + ',IF(LEFT(TO_TEXT(' + first + '),4)="N/A:",' + first + ',IF(' + counts + ',"Rows returned","No numeric data returned")))))';
    }

    static buildSources(book) {
        const sheet = CFFormulaResearch.prepare_(book, "Sources", "CACHEFINANCE_ANALYSIS_V1", "These formulas inspect existing source tables. They do not call providers again. Open a source cell to inspect its data-returning formula.");
        CFFormulaResearch.header_(sheet, 7, 1, ["Dataset", "Source formula cell", "Result", "Observation / quote time", "Public source", "Meaning"]);
        const rows = [
            ["Selected quote", "Quote data", "B8", "A8", 58, "B", '=IFNA(INDEX(\'Quote data\'!$B$8:$B$65,MATCH("quote_time",\'Quote data\'!$A$8:$A$65,0)),"N/A")', '=IFNA(INDEX(\'Quote data\'!$B$8:$B$65,MATCH("source",\'Quote data\'!$A$8:$A$65,0)),"N/A")', "Each value in column B has its own CFQUOTE formula. Column C shows the formula text."],
            ["Comparison quotes", "Quote data", "D7", "D8", 9, "E", '="See Quote data comparison rows"', '="Provider URLs are in Quote data column L"', "Each provider keeps its own timestamp and yield definition."],
            ["Daily history", "Price history", "A7", "A8", 510, "E", "='Price history'!$BL$5", '="Yahoo Chart via CFHISTORY"', "This is the last priced indicator date. A current-day bar can have a missing close."],
            ["Fundamentals", "Fundamentals", "B8", "A8", 193, "B", '="Publication time not supplied"', '=IF(COUNTA(Fundamentals!$E$8)=0,"N/A",Fundamentals!$E$8)', "Each value in column B has its own CFFUNDAMENTALS formula. Column F shows the formula text."],
            ["Earnings", "Earnings", "A7", "A8", 500, "C", '=Research!F8', '=IF(COUNTA(Earnings!$J$8)=0,"N/A",Earnings!$J$8)', "The reported date and fiscal period have separate meanings."],
            ["Selected option chain", "Options", "A7", "A8", 1000, "C", '="Each contract has its own last-trade time"', '="Yahoo options via CFOPTIONS"', "The source does not establish a timestamp for bid/ask quotes."],
            ["Published expirations", "Quote data", "O7", "O8", 200, "", '="Published expiration dates"', '="Yahoo options via CFEXPIRATIONS"', "The selected chain and extra maturity sources use these dates."],
            ["Finviz fields", "Research", "A190", "A191", 32, "B", '="Publication time not supplied"', '=IF(COUNTA(Research!$E$191)=0,"N/A",Research!$E$191)', "Selected public fields only."],
            ["GuruFocus fields", "Research", "G190", "G191", 2, "H", '="Publication time not supplied"', '=IF(COUNTA(Research!$K$191)=0,"N/A",Research!$K$191)', "Public forward and trailing dividend yields."],
            ["Zacks field", "Research", "A230", "A231", 1, "B", '="Publication time not supplied"', '=IF(COUNTA(Research!$E$231)=0,"N/A",Research!$E$231)', "Average price target only."]
        ];
        for (const [i, [id, column]] of [["DGS10", "A"], ["FEDFUNDS", "G"], ["CPIAUCSL", "M"], ["UNRATE", "S"]].entries()) rows.push(["FRED " + id, "Macro", column + "15", column + "16", 400, CFFormulaResearch.column_(CFFormulaResearch.columnNumber_(column) + 1), '=Macro!C' + (8 + i), '="https://fred.stlouisfed.org/series/' + id + '"', "Requires your own FRED key. Observation dates are periods."]);
        rows.forEach(([label, sourceSheet, anchor, first, count, numeric, time, source, note], i) => {
            const row = i + 8, target = book.getSheetByName(sourceSheet), id = target?.getSheetId();
            sheet.getRange(row, 1).setValue(label);
            sheet.getRange(row, 2).setFormula(id == null ? '="' + sourceSheet + '!' + anchor + '"' : '=HYPERLINK("#gid=' + id + '&range=' + anchor + '","' + sourceSheet + '!' + anchor + '")');
            sheet.getRange(row, 3).setFormula(CFFormulaResearch.sourceStatus_(sourceSheet, anchor, first, count, numeric)); sheet.getRange(row, 4).setFormula(time); sheet.getRange(row, 5).setFormula(source); sheet.getRange(row, 6).setValue(note);
        });
        sheet.setColumnWidth(1, 190); sheet.setColumnWidth(2, 210); sheet.setColumnWidth(3, 330); sheet.setColumnWidth(4, 250); sheet.setColumnWidth(5, 330); sheet.setColumnWidth(6, 440); sheet.getRange(8, 3, rows.length, 4).setWrap(true);
        sheet.getRange("A25:F26").merge().setValue("A returned table is not an independent check of financial accuracy. N/A stays unavailable. Use each source's units, reporting basis and timestamps when comparing values.").setWrap(true);
        return sheet;
    }
}
