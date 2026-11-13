/*  *** DEBUG START ***
import { TickerSheetsShowcase } from "./TickerSheetsShowcase.js";
export { TickerSheetsOptionsShowcase };
//  *** DEBUG END ***/

/** Option quotes and visible model, strategy and payoff formulas. */
class TickerSheetsOptionsShowcase {
    static get marker() { return "TICKERSHEETS_OPTIONS_SHOWCASE_V1"; }
    static preflight(book) {
        const sheet = book.getSheetByName("Options analysis");
        if (sheet && sheet.getRange("Z1").getValue() !== TickerSheetsOptionsShowcase.marker) throw new Error("The existing Options analysis tab is not managed by TickerSheets. Rename it before building the demo.");
    }
    static savedInputs(book) {
        const existing = book.getSheetByName("Options analysis"), legacy = book.getSheetByName("Stock analysis");
        const rows = [8, 99, 100, 101, 102, 103, 104, 109, 110, 111, 112, 113, 114, 115], saved = {};
        if (existing && existing.getRange("Z1").getValue() === TickerSheetsOptionsShowcase.marker) {
            for (const row of rows) saved["B" + row] = existing.getRange("B" + row).getValue();
        } else if (legacy && legacy.getRange("Z1").getValue() === TickerSheetsShowcase.marker && legacy.getRange("Z2").getValue() !== "TICKERSHEETS_STOCK_V2") {
            for (const row of rows) saved["B" + row] = legacy.getRange("B" + (row + 206)).getValue();
        }
        return saved;
    }
    static sourceFormulas() {
        return {
            A12: '=ARRAY_CONSTRAIN(TICKERSHEETS_EXPIRATIONS($B$4),41,1)',
            C12: "=IFERROR({QUERY(TICKERSHEETS_OPTIONS($B$4,$B$8),\"select * where Col2 = 'Call' and Col3 >= \"&($B$98*0.8)&\" and Col3 <= \"&($B$98*1.2)&\" order by Col3 limit 40\",1);QUERY(TICKERSHEETS_OPTIONS($B$4,$B$8),\"select * where Col2 = 'Put' and Col3 >= \"&($B$98*0.8)&\" and Col3 <= \"&($B$98*1.2)&\" order by Col3 limit 40\",1)},\"N/A: Option quotes unavailable; see dataset status below\")",
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
        sheet.getRange("A2:N2").merge().setValue("Change the ticker on Start here. Quotes below come from the provider; yellow cells are editable model and strategy assumptions. Click any result to read its formula.").setWrap(true); sheet.setRowHeights(2, 1, 36);
        sheet.getRange("A3:N3").merge().setFormula('=HYPERLINK("#gid=' + sheet.getSheetId() + '&range=A96","Jump to option model, strategies and payoff chart ↓")').setFontColor("#1155CC");
        sheet.getRange("A4").setValue("Ticker: edit Start here!B4"); sheet.getRange("B4").setFormula("='Start here'!B4").setFontWeight("bold");
        TickerSheetsShowcase.section(sheet, 6, "Options: published dates, up to 40 calls and 40 puts");
        sheet.getRange("A8").setValue("Expiration (optional)");
        sheet.getRange("B8").setNumberFormat("@").setValue(typeof saved.B8 === "string" && /^\d{4}-\d{2}-\d{2}$/.test(saved.B8) ? saved.B8 : "").setBackground("#FFF2CC");
        sheet.getRange("A9:N9").merge().setValue("Leave B8 blank for the nearest available expiration. To choose another date, enter YYYY-MM-DD from the list below. The chain shows up to 40 calls and 40 puts within 20% of regular price, sorted by strike. For the full chain, use TICKERSHEETS_OPTIONS in an empty area. Clear an old date after changing ticker if needed.").setWrap(true); sheet.setRowHeights(9, 1, 36);
        if (typeof SpreadsheetApp.newDataValidation === "function") sheet.getRange("B8").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(sheet.getRange("A13:A52"), true).setAllowInvalid(true).build());
        sheet.getRange("A10").setValue("Returned chain expiration");
        sheet.getRange("B10").setFormula('=IFERROR(IF(OR(C13="",C13="N/A"),"N/A",C13),"N/A")').setNumberFormat("@");
        sheet.getRange("D10:N10").merge().setValue("Provider quotes below are separate from the theoretical prices and editable assumptions in the model.").setWrap(true);
        sheet.getRange("A11").setValue("Available expirations"); sheet.getRange("C11:N11").merge().setFormula("=FORMULATEXT(C12)").setFontSize(9);
        TickerSheetsShowcase.section(sheet, 96, "Option model: editable assumptions, theoretical results");
        sheet.getRange("A97:N97").merge().setValue("The model inputs are examples, not live implied volatility. Replace the yellow cells with your assumptions or a contract's quoted values.").setWrap(true);
        sheet.getRange("A98:A104").setValues([["Regular price (spot)"], ["Strike"], ["Days to expiry"], ["Volatility fraction"], ["Risk-free rate fraction"], ["Dividend yield fraction"], ["Option type"]]);
        sheet.getRange("B98").setFormula('=TICKERSHEETS_QUOTE($B$4,"regular_price")');
        const strike = sheet.getRange("B99");
        if (typeof saved.B99 === "number" && Number.isFinite(saved.B99)) strike.setValue(saved.B99);
        else strike.setFormula('=IF(ISNUMBER($B$98),ROUND($B$98,0),"N/A")');
        const defaults = { B100: 30, B101: 0.4, B102: 0.04, B103: 0, B104: "Call", B111: 2, B113: 2, B114: 1, B115: 100 };
        for (const [cell, fallback] of Object.entries(defaults)) sheet.getRange(cell).setValue(typeof fallback === "number" && typeof saved[cell] === "number" && Number.isFinite(saved[cell]) || cell === "B104" && ["Call", "Put"].includes(saved[cell]) ? saved[cell] : fallback).setBackground("#FFF2CC");
        sheet.getRange("B99").setBackground("#FFF2CC"); sheet.getRange("B101:B103").setNumberFormat("0.0%");
        ["price", "delta", "gamma", "theta", "vega", "rho"].forEach((metric, i) => {
            const row = 98 + i; sheet.getRange("D" + row).setValue(metric);
            sheet.getRange("E" + row).setFormula('=TICKERSHEETS_OPTION_MODEL($B$98,$B$99,$B$100,$B$101,$B$102,$B$103,$B$104,"' + metric + '")').setNumberFormat("0.0000");
            sheet.getRange("F" + row + ":N" + row).merge().setFormula("=FORMULATEXT(E" + row + ")").setFontSize(9);
        });
        TickerSheetsShowcase.section(sheet, 108, "Option strategies: choose a strategy and enter quoted premiums");
        sheet.getRange("A109:A115").setValues([["Strategy"], ["Long strike"], ["Long premium / share"], ["Short strike"], ["Short premium / share"], ["Contracts"], ["Shares per contract"]]);
        const strategies = ["Covered call", "Cash-secured put", "Call vertical", "Put vertical"];
        sheet.getRange("B109").setValue(strategies.includes(saved.B109) ? saved.B109 : "Covered call").setBackground("#FFF2CC");
        if (typeof SpreadsheetApp.newDataValidation === "function") sheet.getRange("B109").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(strategies, true).setAllowInvalid(false).build());
        for (const [cell, factor] of [["B110", 1], ["B112", 1.05]]) {
            const input = sheet.getRange(cell).setBackground("#FFF2CC");
            if (typeof saved[cell] === "number" && Number.isFinite(saved[cell])) input.setValue(saved[cell]);
            else input.setFormula('=IF(ISNUMBER($B$98),ROUND($B$98*' + factor + ',0),"N/A")');
        }
        ["maxProfit", "maxLoss", "breakeven"].forEach((metric, i) => {
            const row = 110 + i; sheet.getRange("D" + row).setValue(metric);
            sheet.getRange("E" + row).setFormula(TickerSheetsOptionsShowcase.strategyFormula(metric));
            sheet.getRange("F" + row + ":N" + row).merge().setFormula("=FORMULATEXT(E" + row + ")").setFontSize(9);
        });
        sheet.getRange("D114:N115").merge().setValue("Covered call and cash-secured put use the short strike and premium. Verticals also use the long strike and premium. Profit/loss includes the premium and editable contract size; it excludes fees and early assignment.").setWrap(true);
        TickerSheetsShowcase.section(sheet, 118, "Strategy payoff at expiration: prices and profit/loss from the selected inputs");
        sheet.getRange("A120:B120").setValues([["Stock at expiry", "Strategy profit/loss"]]).setFontWeight("bold");
        for (let i = 0; i <= 40; i++) {
            const row = 121 + i;
            sheet.getRange("A" + row).setFormula('=IF(ISNUMBER($B$98),$B$98*' + (0.5 + i * 0.025).toFixed(3) + ',"N/A")').setNumberFormat("0.00");
            sheet.getRange("B" + row).setFormula(TickerSheetsOptionsShowcase.strategyFormula("payoff", "A" + row)).setNumberFormat("#,##0.00");
        }
        TickerSheetsShowcase.section(sheet, 168, "Options dataset status: source and retrieval time");
        for (const [cell, formula] of Object.entries(TickerSheetsOptionsShowcase.sourceFormulas())) sheet.getRange(cell).setFormula(formula);
        sheet.getRange("A12:A52").setNumberFormat("@"); sheet.getRange("A170:E172").setWrap(true);
        sheet.getRange("Z1").setValue(TickerSheetsOptionsShowcase.marker); sheet.hideColumns(26);
        const payoff = sheet.newChart().setChartType(Charts.ChartType.LINE).addRange(sheet.getRange("A120:B161")).setNumHeaders(1)
            .setPosition(121, 5, 0, 0).setOption("title", "Selected strategy: profit/loss at expiration").setOption("width", 950).setOption("height", 295).setOption("legend", { position: "none" }).build();
        sheet.insertChart(payoff);
        return { sheet: "Options analysis", charts: 1 };
    }
    static strategyFormula(metric, expirySpot = "") {
        return '=TICKERSHEETS_STRATEGY($B$109,$B$98,$B$110,$B$111,$B$112,$B$113,$B$114,$B$115,$B$10,"' + metric + '"' + (expirySpot ? ',' + expirySpot : '') + ')';
    }
    static inspect(book) {
        const sheet = book?.getSheetByName("Options analysis"), helper = TickerSheetsShowcase;
        const grid = sheet ? helper.readGrid(sheet) : null;
        if (!sheet || helper.readCell(sheet, "Z1", undefined, grid).value !== TickerSheetsOptionsShowcase.marker) return { ok: false, error: "Options analysis is not installed." };
        const expected = { ...TickerSheetsOptionsShowcase.sourceFormulas(), B4: "='Start here'!B4", B98: '=TICKERSHEETS_QUOTE($B$4,"regular_price")' };
        const rows = helper.inspectFormulas(sheet, expected, grid), value = cell => helper.readCell(sheet, cell, undefined, grid).value;
        const counts = { calls: 0, puts: 0 };
        for (const row of grid.values.slice(12, 93)) { if (row[3] === "Call") counts.calls++; if (row[3] === "Put") counts.puts++; }
        const options = { expiration: value("B10"), ...counts, model: [98, 99, 100, 101, 102, 103].map(row => value("E" + row)),
            strategy: [110, 111, 112].map(row => value("E" + row)), payoff: [121, 141, 161].map(row => value("B" + row)),
            inputs: Object.fromEntries([8, 99, 100, 101, 102, 103, 104, 109, 110, 111, 112, 113, 114, 115].map(row => ["B" + row, value("B" + row)])) };
        return { ok: rows.every(row => row.matches && !row.error && !row.pending && row.status !== "Not calculated"), rows, options,
            ticker: helper.readCell(sheet, "B4", "='Start here'!B4", grid),
            datasets: { options: helper.readCell(sheet, "A171", undefined, grid) }, charts: sheet.getCharts().length,
            unavailable: rows.filter(row => row.unavailable).map(row => row.cell) };
    }
}
