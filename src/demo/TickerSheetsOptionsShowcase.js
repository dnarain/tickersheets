/*  *** DEBUG START ***
import { TickerSheetsShowcase } from "./TickerSheetsShowcase.js";
export { TickerSheetsOptionsShowcase };
//  *** DEBUG END ***/

/** Option quotes and visible model, strategy and payoff formulas. */
class TickerSheetsOptionsShowcase {
    static get marker() { return "TICKERSHEETS_OPTIONS_SHOWCASE_V1"; }
    static get layoutMarker() { return "TICKERSHEETS_OPTIONS_STRATEGY_FIRST_V1"; }
    static get inputRows() { return [8, 69, 70, 71, 72, 73, 74, 12, 13, 14, 15, 16, 17, 18]; }
    static preflight(book) {
        const sheet = book.getSheetByName("Options analysis");
        if (sheet && sheet.getRange("Z1").getValue() !== TickerSheetsOptionsShowcase.marker) throw new Error("The existing Options analysis tab is not managed by TickerSheets. Rename it before building the demo.");
    }
    static savedInputs(book) {
        const existing = book.getSheetByName("Options analysis"), legacy = book.getSheetByName("Stock analysis");
        const previousRows = [8, 99, 100, 101, 102, 103, 104, 109, 110, 111, 112, 113, 114, 115], saved = {};
        if (existing && existing.getRange("Z1").getValue() === TickerSheetsOptionsShowcase.marker) {
            const rows = existing.getRange("Z2").getValue() === TickerSheetsOptionsShowcase.layoutMarker ? TickerSheetsOptionsShowcase.inputRows : previousRows;
            rows.forEach((row, index) => { saved["B" + TickerSheetsOptionsShowcase.inputRows[index]] = existing.getRange("B" + row).getValue(); });
        } else if (legacy && legacy.getRange("Z1").getValue() === TickerSheetsShowcase.marker && legacy.getRange("Z2").getValue() !== "TICKERSHEETS_STOCK_V2") {
            previousRows.forEach((row, index) => { saved["B" + TickerSheetsOptionsShowcase.inputRows[index]] = legacy.getRange("B" + (row + 206)).getValue(); });
        }
        return saved;
    }
    static sourceFormulas() {
        return {
            A81: '=ARRAY_CONSTRAIN(TICKERSHEETS_EXPIRATIONS($B$4),41,1)',
            C81: "=IFERROR({QUERY(TICKERSHEETS_OPTIONS($B$4,$B$8),\"select * where Col2 = 'Call' and Col3 >= \"&($E$8*0.8)&\" and Col3 <= \"&($E$8*1.2)&\" order by Col3 limit 40\",1);QUERY(TICKERSHEETS_OPTIONS($B$4,$B$8),\"select * where Col2 = 'Put' and Col3 >= \"&($E$8*0.8)&\" and Col3 <= \"&($E$8*1.2)&\" order by Col3 limit 40\",1)},\"N/A: Option quotes unavailable; see dataset status below\")",
            A170: '=TICKERSHEETS_DATA_STATUS($B$4,"options",$B$8)'
        };
    }
    static build(book, saved = TickerSheetsOptionsShowcase.savedInputs(book)) {
        TickerSheetsOptionsShowcase.preflight(book);
        let sheet = book.getSheetByName("Options analysis");
        if (!sheet) sheet = book.insertSheet("Options analysis");
        if (sheet.getMaxRows() < 180) sheet.insertRowsAfter(sheet.getMaxRows(), 180 - sheet.getMaxRows());
        if (sheet.getMaxColumns() < 26) sheet.insertColumnsAfter(sheet.getMaxColumns(), 26 - sheet.getMaxColumns());
        sheet.getCharts().forEach(chart => sheet.removeChart(chart));
        sheet.setFrozenRows(0); sheet.setFrozenColumns(0);
        sheet.getRange(1, 1, Math.max(180, sheet.getLastRow()), sheet.getMaxColumns()).breakApart().clear().clearDataValidations().setNumberFormat("General");
        sheet.getRange("A1:N175").setFontFamily("Arial").setFontSize(10).setVerticalAlignment("middle");
        sheet.setHiddenGridlines(true); sheet.setFrozenRows(4); sheet.setColumnWidths(1, 14, 115); sheet.setRowHeights(1, 175, 22);
        sheet.setColumnWidth(1, 205); sheet.setColumnWidth(2, 170); sheet.setColumnWidth(3, 115); sheet.setColumnWidth(14, 170);
        sheet.getRange("A1:N1").merge().setFormula('=UPPER(TRIM($B$4))&" — options analysis"').setFontSize(18).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2:N2").merge().setValue("Change the ticker on Start here. Edit the yellow strategy inputs to explore profit, loss and the payoff chart. Click any result to read its formula.").setWrap(true); sheet.setRowHeights(2, 1, 36);
        sheet.getRange("A3:N3").merge().setFormula('=HYPERLINK("#gid=' + sheet.getSheetId() + '&range=A78","Jump to option quotes and published expiration dates ↓")').setFontColor("#1155CC");
        sheet.getRange("A4").setValue("Ticker: edit Start here!B4"); sheet.getRange("B4").setFormula("='Start here'!B4").setFontWeight("bold");
        sheet.getRange("G4:N4").merge().setFormula('=HYPERLINK("https://github.com/dnarain/tickersheets","TickerSheets on GitHub")').setFontColor("#1155CC");
        TickerSheetsShowcase.section(sheet, 6, "Strategy calculator: editable example assumptions");
        sheet.getRange("A7:N7").merge().setValue("Starting examples use rounded strikes and premiums of 2 per share. Enter your contract's strikes and quoted premiums in the yellow cells. Choosing an expiration does not fill them.").setWrap(true).setFontColor("#7F6000"); sheet.setRowHeights(7, 1, 36);
        sheet.getRange("A8").setValue("Expiration (optional)");
        sheet.getRange("B8").setNumberFormat("@").setValue(typeof saved.B8 === "string" && /^\d{4}-\d{2}-\d{2}$/.test(saved.B8) ? saved.B8 : "").setBackground("#FFF2CC");
        sheet.getRange("D8").setValue("Regular price"); sheet.getRange("E8").setFormula('=TICKERSHEETS_QUOTE($B$4,"regular_price")').setNumberFormat("#,##0.00");
        sheet.getRange("F8:N8").merge().setFormula("=FORMULATEXT(E8)").setFontSize(9);
        sheet.getRange("A9:N9").merge().setValue("Leave B8 blank for the nearest available expiration, or select a published date from the list below. Clear an old date after changing ticker if needed.").setWrap(true); sheet.setRowHeights(9, 1, 36);
        if (typeof SpreadsheetApp.newDataValidation === "function") sheet.getRange("B8").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(sheet.getRange("A82:A121"), true).setAllowInvalid(true).build());
        sheet.getRange("A10").setValue("Returned chain expiration");
        sheet.getRange("B10").setFormula('=IFERROR(IF(OR(C82="",C82="N/A"),"N/A",C82),"N/A")').setNumberFormat("@");
        sheet.getRange("D11:E11").setValues([["Result", "Value"]]).setFontWeight("bold"); sheet.getRange("F11:N11").merge().setValue("Formula for reference").setFontWeight("bold");
        sheet.getRange("D12:N12").merge().setValue("Profit and loss totals include all selected contracts; breakeven is a stock price. Amounts use the quote currency.").setFontSize(9).setWrap(true);
        sheet.getRange("A12:A18").setValues([["Strategy"], ["Long strike"], ["Long premium / share"], ["Short strike"], ["Short premium / share"], ["Contracts"], ["Shares per contract"]]);
        const strategies = ["Covered call", "Cash-secured put", "Call vertical", "Put vertical"];
        sheet.getRange("B12").setValue(strategies.includes(saved.B12) ? saved.B12 : "Covered call").setBackground("#FFF2CC");
        if (typeof SpreadsheetApp.newDataValidation === "function") sheet.getRange("B12").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(strategies, true).setAllowInvalid(false).build());
        for (const [cell, factor] of [["B13", 1], ["B15", 1.05]]) {
            const input = sheet.getRange(cell).setBackground("#FFF2CC");
            if (typeof saved[cell] === "number" && Number.isFinite(saved[cell])) input.setValue(saved[cell]);
            else input.setFormula('=IF(ISNUMBER($E$8),ROUND($E$8*' + factor + ',0),"N/A")');
        }
        const defaults = { B14: 2, B16: 2, B17: 1, B18: 100, B70: 30, B71: 0.4, B72: 0.04, B73: 0, B74: "Call" };
        for (const [cell, fallback] of Object.entries(defaults)) sheet.getRange(cell).setValue(typeof fallback === "number" && typeof saved[cell] === "number" && Number.isFinite(saved[cell]) || cell === "B74" && ["Call", "Put"].includes(saved[cell]) ? saved[cell] : fallback).setBackground("#FFF2CC");
        sheet.getRange("B13:B16").setNumberFormat("#,##0.00");
        ["maxProfit", "maxLoss", "breakeven"].forEach((metric, i) => {
            const row = 13 + i; sheet.getRange("D" + row).setValue(["Maximum profit", "Maximum loss", "Breakeven price"][i]).setWrap(true);
            sheet.getRange("E" + row).setFormula(TickerSheetsOptionsShowcase.strategyFormula(metric)).setNumberFormat("#,##0.00");
            sheet.getRange("F" + row + ":N" + row).merge().setFormula("=FORMULATEXT(E" + row + ")").setFontSize(9);
        });
        sheet.getRange("D17:N18").merge().setValue("Covered call and cash-secured put use the short strike and premium. Verticals also use the long strike and premium. Profit/loss includes the premium and editable contract size; it excludes fees and early assignment.").setWrap(true);
        TickerSheetsShowcase.section(sheet, 20, "Strategy payoff at expiration");
        sheet.getRange("A21:N21").merge().setValue("Calculated from the strategy inputs above. Change a strike or premium to update the table and chart.");
        sheet.getRange("A22:B22").setValues([["Stock at expiry", "Strategy profit/loss"]]).setFontWeight("bold");
        for (let i = 0; i <= 40; i++) {
            const row = 23 + i;
            sheet.getRange("A" + row).setFormula('=IF(ISNUMBER($E$8),$E$8*' + (0.5 + i * 0.025).toFixed(3) + ',"N/A")').setNumberFormat("0.00");
            sheet.getRange("B" + row).setFormula(TickerSheetsOptionsShowcase.strategyFormula("payoff", "A" + row)).setNumberFormat("#,##0.00");
        }
        TickerSheetsShowcase.section(sheet, 66, "Option model: example assumptions and theoretical results");
        sheet.getRange("A67:N67").merge().setValue("The starting examples use 30 days, 40% volatility, 4% risk-free rate and 0% dividend yield. Yellow cells are editable assumptions; choosing an expiration does not update them.").setWrap(true).setFontColor("#7F6000"); sheet.setRowHeights(67, 1, 36);
        sheet.getRange("A68:A74").setValues([["Regular price (spot)"], ["Strike"], ["Days to expiry"], ["Volatility assumption"], ["Risk-free rate assumption"], ["Dividend yield assumption"], ["Option type"]]);
        sheet.getRange("B68").setFormula("=$E$8").setNumberFormat("#,##0.00");
        const strike = sheet.getRange("B69");
        if (typeof saved.B69 === "number" && Number.isFinite(saved.B69)) strike.setValue(saved.B69);
        else strike.setFormula('=IF(ISNUMBER($E$8),ROUND($E$8,0),"N/A")');
        sheet.getRange("B69").setBackground("#FFF2CC").setNumberFormat("#,##0.00"); sheet.getRange("B71:B73").setNumberFormat("0.0%");
        ["price", "delta", "gamma", "theta", "vega", "rho"].forEach((metric, i) => {
            const row = 68 + i; sheet.getRange("D" + row).setValue(["Theoretical price", "Delta", "Gamma", "Theta", "Vega", "Rho"][i]).setWrap(true);
            sheet.getRange("E" + row).setFormula('=TICKERSHEETS_OPTION_MODEL($B$68,$B$69,$B$70,$B$71,$B$72,$B$73,$B$74,"' + metric + '")').setNumberFormat("0.0000");
            sheet.getRange("F" + row + ":N" + row).merge().setFormula("=FORMULATEXT(E" + row + ")").setFontSize(9);
        });
        TickerSheetsShowcase.section(sheet, 78, "Option quotes and published expiration dates");
        sheet.getRange("A79:N79").merge().setValue("Provider quotes: up to 40 calls and 40 puts within 20% of regular price, sorted by strike. For the full chain, use TICKERSHEETS_OPTIONS in an empty area. Copy quoted strikes and premiums into the calculator above to analyze a contract.").setWrap(true); sheet.setRowHeights(79, 1, 36);
        sheet.getRange("A80").setValue("Available expirations"); sheet.getRange("C80:N80").merge().setFormula("=FORMULATEXT(C81)").setFontSize(9);
        TickerSheetsShowcase.section(sheet, 168, "Options dataset status: source and retrieval time");
        for (const [cell, formula] of Object.entries(TickerSheetsOptionsShowcase.sourceFormulas())) sheet.getRange(cell).setFormula(formula);
        sheet.getRange("A81:A121").setNumberFormat("@"); sheet.getRange("A170:E172").setWrap(true);
        sheet.getRange("Z1").setValue(TickerSheetsOptionsShowcase.marker); sheet.getRange("Z2").setValue(TickerSheetsOptionsShowcase.layoutMarker); sheet.hideColumns(26);
        const payoff = sheet.newChart().setChartType(Charts.ChartType.LINE).addRange(sheet.getRange("A22:B63")).setNumHeaders(1)
            .setPosition(22, 5, 0, 0).setOption("title", "Selected strategy: profit/loss at expiration").setOption("width", 950).setOption("height", 295).setOption("legend", { position: "none" }).build();
        sheet.insertChart(payoff);
        return { sheet: "Options analysis", charts: 1 };
    }
    static strategyFormula(metric, expirySpot = "") {
        return '=TICKERSHEETS_STRATEGY($B$12,$E$8,$B$13,$B$14,$B$15,$B$16,$B$17,$B$18,$B$10,"' + metric + '"' + (expirySpot ? ',' + expirySpot : '') + ')';
    }
    static inspect(book) {
        const sheet = book?.getSheetByName("Options analysis"), helper = TickerSheetsShowcase;
        const grid = sheet ? helper.readGrid(sheet) : null;
        if (!sheet || helper.readCell(sheet, "Z1", undefined, grid).value !== TickerSheetsOptionsShowcase.marker) return { ok: false, error: "Options analysis is not installed." };
        const expected = { ...TickerSheetsOptionsShowcase.sourceFormulas(), B4: "='Start here'!B4", E8: '=TICKERSHEETS_QUOTE($B$4,"regular_price")', B68: "=$E$8" };
        const rows = helper.inspectFormulas(sheet, expected, grid), value = cell => helper.readCell(sheet, cell, undefined, grid).value;
        const counts = { calls: 0, puts: 0 };
        for (const row of grid.values.slice(81, 162)) { if (row[3] === "Call") counts.calls++; if (row[3] === "Put") counts.puts++; }
        const options = { expiration: value("B10"), ...counts, model: [68, 69, 70, 71, 72, 73].map(row => value("E" + row)),
            strategy: [13, 14, 15].map(row => value("E" + row)), payoff: [23, 43, 63].map(row => value("B" + row)),
            inputs: Object.fromEntries(TickerSheetsOptionsShowcase.inputRows.map(row => ["B" + row, value("B" + row)])) };
        return { ok: rows.every(row => row.matches && !row.error && !row.pending && row.status !== "Not calculated"), rows, options,
            ticker: helper.readCell(sheet, "B4", "='Start here'!B4", grid),
            datasets: { options: helper.readCell(sheet, "A171", undefined, grid) }, charts: sheet.getCharts().length,
            unavailable: rows.filter(row => row.unavailable).map(row => row.cell) };
    }
}
