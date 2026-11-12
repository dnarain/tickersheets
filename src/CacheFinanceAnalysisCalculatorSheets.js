/*  *** DEBUG START ***
export { CFAnalysisCalculatorSheets };
//  *** DEBUG END ***/

/** Adds editable option assumptions beside the marked source chain. */
class CFAnalysisCalculatorSheets {
    static number_(value, zero = false) {
        return typeof value === "number" && Number.isFinite(value) && (zero ? value >= 0 : value > 0) ? value : null;
    }

    static safe_(value) { return typeof value === "string" && /^\s*[=+@-]/.test(value) ? "'" + value : value; }

    static date_(value, book) {
        if (value instanceof Date && Number.isFinite(value.getTime())) {
            if (typeof Utilities !== "undefined" && typeof Utilities.formatDate === "function") {
                try { return CFAnalysisCalculatorSheets.date_(Utilities.formatDate(value, book.getSpreadsheetTimeZone(), "yyyy-MM-dd"), book); }
                catch (_error) { return ""; }
            }
            return value.toISOString().slice(0, 10);
        }
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
        const parsed = new Date(value + "T00:00:00.000Z");
        return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : "";
    }

    static render(book, snapshot) {
        const sheet = book.getSheetByName("Options"), main = book.getSheetByName("Analysis");
        if (!sheet || sheet.getRange("Z1").getValue() !== "CACHEFINANCE_ANALYSIS_V1") throw new Error("Build the marked analysis tabs before adding the option calculator.");
        const ticker = typeof snapshot?.ticker === "string" ? snapshot.ticker.trim().toUpperCase() : "";
        if (!ticker || !main || String(main.getRange("B4").getValue()).trim().toUpperCase() !== ticker) throw new Error("The ticker changed during refresh. Refresh the current ticker again.");
        const options = snapshot.options || {}, selectedExpiry = CFAnalysisCalculatorSheets.date_(sheet.getRange("B4").getValue(), book);
        const sameSymbol = typeof options.symbol === "string" && typeof snapshot.symbol === "string" && options.symbol === snapshot.symbol;
        const optionSpot = options.ok && sameSymbol ? CFAnalysisCalculatorSheets.number_(options.underlyingPrice) : null;
        const spot = optionSpot ?? CFAnalysisCalculatorSheets.number_(snapshot.chart?.price);
        const calls = options.ok && sameSymbol && spot !== null && selectedExpiry && Array.isArray(options.contracts)
            ? options.contracts.filter(row => row && ["CALL", "C"].includes(String(row.type).toUpperCase()) && row.expiration === selectedExpiry
                && CFAnalysisCalculatorSheets.number_(row.strike) !== null && CFAnalysisCalculatorSheets.number_(row.mid) !== null
                && CFAnalysisCalculatorSheets.number_(row.bid, true) !== null && CFAnalysisCalculatorSheets.number_(row.ask) !== null && row.ask >= row.bid)
                .sort((left, right) => Math.abs(left.strike - spot) - Math.abs(right.strike - spot) || left.strike - right.strike)
            : [];
        const atm = calls[0] || null, strike = atm?.strike ?? null, premium = atm?.mid ?? null;
        const iv = CFAnalysisCalculatorSheets.number_(atm?.iv);
        const sourceYield = CFAnalysisCalculatorSheets.number_(snapshot.details?.fields?.dividend_yield?.value, true);

        sheet.getRange("O1:W60").clearContent();
        for (const chart of sheet.getCharts()) if (String(chart.getOptions().get("title") || "").endsWith(" — option payoff")) sheet.removeChart(chart);
        sheet.setColumnWidth(15, 235); sheet.setColumnWidth(16, 155); sheet.setColumnWidth(17, 25); sheet.setColumnWidth(18, 235); sheet.setColumnWidth(19, 155);
        sheet.getRange("O1").setFormula('=UPPER(TRIM(Analysis!$B$4))&" — option calculator"').setFontSize(14).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("O2").setValue("Edit yellow cells. Refresh resets assumptions.").setFontSize(9).setFontColor("#596579");
        for (const [range, values] of [["O3:P3", [["Assumption", "Value"]]], ["R3:S3", [["Model output", "Value"]]]]) {
            sheet.getRange(range).setValues(values).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold");
        }
        const labels = ["Underlying price", "Strike", "Premium / share (editable)", "Days to expiration", "Annual IV", "Risk-free rate (assumption)", "Dividend yield (0 if unavailable)", "Option type", "Contracts", "Multiplier (assumed)", "Position side"];
        sheet.getRange("O4:O14").setValues(labels.map(value => [value]));
        sheet.getRange("P4:P14").setValues([spot ?? "N/A", strike ?? "N/A", premium ?? "N/A", "N/A", iv ?? "N/A", 0.04, sourceYield ?? 0, "Call", 1, 100, "Long"].map(value => [value]))
            .setBackground("#FFF2CC").setFontColor("#0000FF").setFontWeight("bold");
        sheet.getRange("P7").setFormula('=IFERROR(MAX(0,IF(ISNUMBER($B$4),INT($B$4),DATEVALUE($B$4))-TODAY()),"N/A")');
        sheet.getRange("P4:P6").setNumberFormat("#,##0.00"); sheet.getRange("P7").setNumberFormat("0");
        sheet.getRange("P8:P10").setNumberFormat("0.00%"); sheet.getRange("P12:P13").setNumberFormat("#,##0");
        sheet.getRange("P11").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["Call", "Put"], true).setAllowInvalid(false).build());
        sheet.getRange("P14").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["Long", "Short"], true).setAllowInvalid(false).build());
        sheet.getRange("O16").setValue("Seed contract"); sheet.getRange("P16").setValue(CFAnalysisCalculatorSheets.safe_(atm?.contractSymbol || "No usable ATM call quote")).setFontSize(9);
        sheet.getRange("O17").setValue("Long-option Greeks; side changes payoff.").setFontSize(9).setFontColor("#596579");
        sheet.getRange("O18").setValue("Annual fractions: 0.40 means 40%.").setFontSize(9).setFontColor("#596579");
        sheet.getRange("O19").setValue("European exercise model; quotes can be delayed.").setFontSize(9).setFontColor("#596579");
        sheet.getRange("O20").setValue("Payoff excludes fees, taxes and financing.").setFontSize(9).setFontColor("#596579");

        const outputLabels = ["Model premium / share", "Delta / share", "Gamma / share", "Theta / calendar day", "Vega / 1 IV point", "Rho / 1 rate point", "d1", "d2", "Model − entered premium", "Breakeven at expiry", "Initial premium cash flow", "Long maximum loss", "Short maximum profit"];
        sheet.getRange("R4:R16").setValues(outputLabels.map(value => [value]));
        sheet.getRange("S4:S11").setFormulas(["price", "delta", "gamma", "theta", "vega", "rho", "d1", "d2"].map(metric => ['=CFOPTIONMODEL($P$4,$P$5,$P$7,$P$8,$P$9,$P$10,$P$11,"' + metric + '")']));
        const perShare = 'AND(ISNUMBER($P$5),$P$5>0,ISNUMBER($P$6),$P$6>=0,OR($P$11="Call",$P$11="Put"))';
        const position = perShare + ',ISNUMBER($P$12),$P$12>0,MOD($P$12,1)=0,ISNUMBER($P$13),$P$13>0,MOD($P$13,1)=0,OR($P$14="Long",$P$14="Short")';
        sheet.getRange("S12").setFormula('=IF(AND(ISNUMBER(S4),ISNUMBER($P$6),$P$6>=0),S4-$P$6,"N/A")');
        sheet.getRange("S13").setFormula('=IF(' + perShare + ',IF($P$11="Call",$P$5+$P$6,$P$5-$P$6),"N/A")');
        sheet.getRange("S14").setFormula('=IFERROR(IF(AND(' + position + '),IF($P$14="Long",-1,1)*$P$6*$P$12*$P$13,"N/A"),"N/A")');
        sheet.getRange("S15").setFormula('=IFERROR(IF(AND(' + position + ',$P$14="Long"),$P$6*$P$12*$P$13,"N/A"),"N/A")');
        sheet.getRange("S16").setFormula('=IFERROR(IF(AND(' + position + ',$P$14="Short"),$P$6*$P$12*$P$13,"N/A"),"N/A")');
        sheet.getRange("S4:S16").setNumberFormat("#,##0.0000");
        sheet.getRange("O23:P23").setValues([["Stock at expiry", "Position profit / loss"]]).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold");
        sheet.getRange("O24:P44").setFormulas(Array.from({ length: 21 }, (_value, index) => {
            const row = index + 24, scale = (50 + index * 5) / 100;
            return ['=IF(AND(ISNUMBER($P$4),$P$4>0),$P$4*' + scale + ',NA())',
                '=IFERROR(IF(AND(ISNUMBER(O' + row + '),' + position + '),IF($P$14="Short",-1,1)*(IF($P$11="Call",MAX(O' + row + '-$P$5,0),MAX($P$5-O' + row + ',0))-$P$6)*$P$12*$P$13,NA()),NA())'];
        }));
        sheet.getRange("O24:P44").setNumberFormat("#,##0.00");
        if (spot !== null && strike !== null && premium !== null) {
            sheet.insertChart(sheet.newChart().setChartType(Charts.ChartType.LINE).addRange(sheet.getRange("O23:P44")).setNumHeaders(1).setPosition(24, 18, 0, 0)
                .setOption("title", ticker + " — option payoff").setOption("width", 650).setOption("height", 340)
                .setOption("hAxis", { title: "Stock price at expiration" }).setOption("vAxis", { title: "Position profit / loss" })
                .setOption("legend", { position: "none" }).setOption("colors", ["#17365D"]).build());
        }
        return { ticker, seedContract: atm?.contractSymbol || "", hasSourcePremium: premium !== null, payoffChart: spot !== null && strike !== null && premium !== null };
    }
}
