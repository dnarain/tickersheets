/*  *** DEBUG START ***
export { TickerSheetsShowcase };
//  *** DEBUG END ***/

/** Two charts and editable examples. Every financial result comes from a cell formula. */
class TickerSheetsShowcase {
    static get marker() { return "TICKERSHEETS_SHOWCASE_V1"; }
    static preflight(book) {
        const sheet = book.getSheetByName("Stock analysis");
        if (sheet && sheet.getRange("Z1").getValue() !== TickerSheetsShowcase.marker) throw new Error("The existing Stock analysis tab is not managed by TickerSheets. Rename it before building the demo.");
    }
    static section(sheet, row, label, first = "A", last = "N") {
        sheet.getRange(first + row + ":" + last + row).merge().setValue(label).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold").setWrap(true);
    }
    static scalar(sheet, row, label, formula, format = "#,##0.00") {
        sheet.getRange("A" + row).setValue(label);
        sheet.getRange("B" + row).setFormula(formula).setNumberFormat(format);
        sheet.getRange("C" + row).setFormula("=FORMULATEXT(B" + row + ")").setFontFamily("Courier New").setFontSize(9);
    }
    static sourceFormulas() {
        return {
            A52: '=TICKERSHEETS_HISTORY($B$4,120)', I52: '=TICKERSHEETS_WATCH_ROW($B$4)',
            A178: '=ARRAY_CONSTRAIN(TICKERSHEETS_EARNINGS($B$4,"earnings"),13,10)',
            A196: '=ARRAY_CONSTRAIN(TICKERSHEETS_EARNINGS($B$4,"financials"),9,8)',
            A218: '=ARRAY_CONSTRAIN(TICKERSHEETS_EXPIRATIONS($B$4),41,1)',
            C218: "=IFERROR({QUERY(TICKERSHEETS_OPTIONS($B$4,$B$214),\"select * where Col2 = 'Call' and Col3 >= \"&($B$8*0.8)&\" and Col3 <= \"&($B$8*1.2)&\" order by Col3 limit 40\",1);QUERY(TICKERSHEETS_OPTIONS($B$4,$B$214),\"select * where Col2 = 'Put' and Col3 >= \"&($B$8*0.8)&\" and Col3 <= \"&($B$8*1.2)&\" order by Col3 limit 40\",1)},\"N/A: Option quotes unavailable; see dataset status below\")",
            A326: '=ARRAY_CONSTRAIN(TICKERSHEETS_QUOTE_COMPARE($B$4),7,10)',
            A338: '=TICKERSHEETS_DATA_STATUS($B$4,"quote")',
            A342: '=TICKERSHEETS_DATA_STATUS($B$4,"fundamentals")',
            A346: '=TICKERSHEETS_DATA_STATUS($B$4,"options",$B$214)',
            A356: '=TICKERSHEETS_FRED("DGS10",12)',
            B373: '=TICKERSHEETS_FRED_VALUE("DGS10",$E$4)'
        };
    }
    static build(book) {
        TickerSheetsShowcase.preflight(book);
        let sheet = book.getSheetByName("Stock analysis");
        const saved = {};
        if (sheet) for (const cell of ["B214", "B305", "B306", "B307", "B308", "B309", "B310", "B315", "B316", "B317", "B318", "B319", "B320", "B321"]) saved[cell] = sheet.getRange(cell).getValue();
        if (!sheet) sheet = book.insertSheet("Stock analysis");
        if (sheet.getMaxRows() < 440) sheet.insertRowsAfter(sheet.getMaxRows(), 440 - sheet.getMaxRows());
        if (sheet.getMaxColumns() < 26) sheet.insertColumnsAfter(sheet.getMaxColumns(), 26 - sheet.getMaxColumns());
        if (typeof sheet.getCharts === "function") sheet.getCharts().forEach(chart => sheet.removeChart(chart));
        sheet.setFrozenRows(0); sheet.setFrozenColumns(0);
        sheet.getRange(1, 1, Math.max(440, sheet.getLastRow()), sheet.getMaxColumns()).breakApart().clear().clearDataValidations().setNumberFormat("General");
        sheet.getRange("A1:N425").setFontFamily("Arial").setFontSize(10).setVerticalAlignment("middle");
        sheet.setHiddenGridlines(true); sheet.setFrozenRows(4); sheet.setColumnWidths(1, 14, 115); sheet.setRowHeights(1, 425, 22);
        sheet.setColumnWidth(1, 205); sheet.setColumnWidth(2, 170); sheet.setColumnWidth(3, 410);
        sheet.getRange("A1:N1").merge().setFormula('=UPPER(TRIM($B$4))&" — stock analysis"').setFontSize(18).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2:N2").merge().setValue("Change the ticker on Start here. Click any result to read its formula. Tables and charts below show provider data; yellow cells are calculator inputs.").setWrap(true); sheet.setRowHeights(2, 1, 36);
        sheet.getRange("A3:N3").merge().setFormula('=HYPERLINK("#gid=' + sheet.getSheetId() + '&range=A212","Jump to options, expiration dates and strategy calculators ↓")').setFontColor("#1155CC");
        sheet.getRange("A4").setValue("Ticker: edit Start here!B4"); sheet.getRange("B4").setFormula("='Start here'!B4").setFontWeight("bold");
        sheet.getRange("D4").setValue("Calculation date"); sheet.getRange("E4").setNumberFormat("@").setValue(Utilities.formatDate(new Date(), book.getSpreadsheetTimeZone(), "yyyy-MM-dd"));
        TickerSheetsShowcase.section(sheet, 6, "Quote and fundamentals", "A", "C");
        const quotes = [["Latest price", "price"], ["Regular-session price", "regular_price"], ["After-hours price", "post_market_price"], ["Quote time (UTC)", "quote_time"], ["Currency", "currency"]];
        quotes.forEach(([label, field], i) => TickerSheetsShowcase.scalar(sheet, 7 + i, label, '=TICKERSHEETS_QUOTE($B$4,"' + field + '")', i > 2 ? "@" : "#,##0.00"));
        const fundamentals = [["P/E (trailing)", "trailing_pe"], ["EPS (trailing)", "eps_ttm"], ["Market capitalization", "market_cap"], ["Dividend yield", "dividend_yield"], ["Revenue growth", "revenue_growth"], ["Analyst target price", "target_price"], ["Next earnings date", "earnings_date"]];
        fundamentals.forEach(([label, field], i) => TickerSheetsShowcase.scalar(sheet, 12 + i, label, '=TICKERSHEETS_FUNDAMENTALS($B$4,"' + field + '")', [3, 4].includes(i) ? "0.0%" : i === 6 ? "@" : "#,##0.00"));
        TickerSheetsShowcase.scalar(sheet, 19, "52-week low", '=TICKERSHEETS_QUOTE($B$4,"fifty_two_week_low")');
        TickerSheetsShowcase.scalar(sheet, 20, "52-week high", '=TICKERSHEETS_QUOTE($B$4,"fifty_two_week_high")');
        TickerSheetsShowcase.section(sheet, 24, "Technical indicators", "A", "C");
        [["RSI14", "rsi14"], ["50-day average", "sma50"], ["200-day average", "sma200"], ["One-month return", "return1m"], ["One-year return", "return1y"], ["MACD", "macd"], ["Maximum drawdown", "max_drawdown"], ["20-day average volume", "average_volume20"]].forEach(([label, field], i) => {
            TickerSheetsShowcase.scalar(sheet, 25 + i, label, '=IFNA(INDEX($J$53:$J$82,MATCH("' + field + '",$I$53:$I$82,0)),"N/A")', [3, 4, 6].includes(i) ? "0.0%" : "#,##0.00");
        });
        [["RSI2", "rsi2"], ["RSI2 buy target (20)", "buy_target"], ["RSI2 sell target (80)", "sell_target"]].forEach(([label, field], i) => TickerSheetsShowcase.scalar(sheet, 34 + i, label, '=TICKERSHEETS_RSI_TARGETS($B$4,20,80,"' + field + '")'));
        TickerSheetsShowcase.scalar(sheet, 38, "Finviz price comparison", '=TICKERSHEETS_FIELD("FINVIZ",$B$4,"price")');
        sheet.getRange("E40:N44").merge().setValue("The price chart uses daily closes. The payoff chart uses the selected strategy inputs. RSI measures recent price momentum. RSI targets and option models describe calculations, not trade recommendations. Missing provider values appear as N/A.").setWrap(true);
        TickerSheetsShowcase.section(sheet, 50, "120 daily price bars", "A", "G");
        TickerSheetsShowcase.section(sheet, 50, "Stock snapshot and indicators", "I", "N");
        sheet.getRange("A51:G51").merge().setValue("Date, OHLC, adjusted close and volume; all rows come from the function at A52.");
        sheet.getRange("I51:N51").merge().setValue("Visible source for the technical indicators above.");
        TickerSheetsShowcase.section(sheet, 176, "Reported earnings: up to 12 periods");
        sheet.getRange("A177:N177").merge().setFormula("=FORMULATEXT(A178)").setFontSize(9);
        TickerSheetsShowcase.section(sheet, 194, "Financial results: up to 8 periods");
        sheet.getRange("A195:N195").merge().setFormula("=FORMULATEXT(A196)").setFontSize(9);
        TickerSheetsShowcase.section(sheet, 212, "Options: published dates, up to 40 calls and 40 puts");
        sheet.getRange("A214").setValue("Expiration (optional)");
        sheet.getRange("B214").setNumberFormat("@").setValue(typeof saved.B214 === "string" && /^\d{4}-\d{2}-\d{2}$/.test(saved.B214) ? saved.B214 : "").setBackground("#FFF2CC");
        sheet.getRange("A215:N215").merge().setValue("Leave B214 blank for the nearest available expiration. To choose another date, enter YYYY-MM-DD from the list below. The chain shows the up to 40 calls and 40 puts within 20% of regular price, sorted by strike. For the full chain, use TICKERSHEETS_OPTIONS in an empty area. Clear an old date after changing ticker if needed.").setWrap(true); sheet.setRowHeights(215, 1, 36);
        if (typeof SpreadsheetApp.newDataValidation === "function") sheet.getRange("B214").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(sheet.getRange("A219:A258"), true).setAllowInvalid(true).build());
        sheet.getRange("A216").setValue("Returned chain expiration");
        sheet.getRange("B216").setFormula('=IFERROR(IF(OR(C219="",C219="N/A"),"N/A",C219),"N/A")').setNumberFormat("@");
        sheet.getRange("D216:N216").merge().setValue("Provider quotes below are separate from the theoretical prices and editable assumptions in the model.").setWrap(true);
        sheet.getRange("A217").setValue("Available expirations"); sheet.getRange("C217:N217").merge().setFormula("=FORMULATEXT(C218)").setFontSize(9);
        TickerSheetsShowcase.section(sheet, 302, "Option model: editable assumptions, theoretical results");
        sheet.getRange("A303:N303").merge().setValue("The model inputs are examples, not live implied volatility. Replace the yellow cells with your assumptions or a contract's quoted values.").setWrap(true);
        sheet.getRange("A304:A310").setValues([["Regular price (spot)"], ["Strike"], ["Days to expiry"], ["Volatility fraction"], ["Risk-free rate fraction"], ["Dividend yield fraction"], ["Option type"]]);
        sheet.getRange("B304").setFormula('=TICKERSHEETS_QUOTE($B$4,"regular_price")'); const strike = sheet.getRange("B305");
        if (typeof saved.B305 === "number" && Number.isFinite(saved.B305)) strike.setValue(saved.B305);
        else strike.setFormula('=IF(ISNUMBER($B$304),ROUND($B$304,0),"N/A")');
        const defaults = { B306: 30, B307: 0.4, B308: 0.04, B309: 0, B310: "Call", B317: 2, B319: 2, B320: 1, B321: 100 };
        for (const [cell, fallback] of Object.entries(defaults)) sheet.getRange(cell).setValue(typeof fallback === "number" && typeof saved[cell] === "number" && Number.isFinite(saved[cell]) || cell === "B310" && ["Call", "Put"].includes(saved[cell]) ? saved[cell] : fallback).setBackground("#FFF2CC");
        sheet.getRange("B305").setBackground("#FFF2CC"); sheet.getRange("B307:B309").setNumberFormat("0.0%");
        ["price", "delta", "gamma", "theta", "vega", "rho"].forEach((metric, i) => {
            const row = 304 + i; sheet.getRange("D" + row).setValue(metric);
            sheet.getRange("E" + row).setFormula('=TICKERSHEETS_OPTION_MODEL($B$304,$B$305,$B$306,$B$307,$B$308,$B$309,$B$310,"' + metric + '")').setNumberFormat("0.0000");
            sheet.getRange("F" + row + ":N" + row).merge().setFormula("=FORMULATEXT(E" + row + ")").setFontSize(9);
        });
        TickerSheetsShowcase.section(sheet, 314, "Option strategies: choose a strategy and enter quoted premiums");
        sheet.getRange("A315:A321").setValues([["Strategy"], ["Long strike"], ["Long premium / share"], ["Short strike"], ["Short premium / share"], ["Contracts"], ["Shares per contract"]]);
        const strategies = ["Covered call", "Cash-secured put", "Call vertical", "Put vertical"];
        sheet.getRange("B315").setValue(strategies.includes(saved.B315) ? saved.B315 : "Covered call").setBackground("#FFF2CC");
        if (typeof SpreadsheetApp.newDataValidation === "function") sheet.getRange("B315").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(strategies, true).setAllowInvalid(false).build());
        for (const [cell, factor] of [["B316", 1], ["B318", 1.05]]) {
            const input = sheet.getRange(cell).setBackground("#FFF2CC");
            if (typeof saved[cell] === "number" && Number.isFinite(saved[cell])) input.setValue(saved[cell]);
            else input.setFormula('=IF(ISNUMBER($B$304),ROUND($B$304*' + factor + ',0),"N/A")');
        }
        ["maxProfit", "maxLoss", "breakeven"].forEach((metric, i) => {
            const row = 316 + i; sheet.getRange("D" + row).setValue(metric);
            sheet.getRange("E" + row).setFormula(TickerSheetsShowcase.strategyFormula(metric));
            sheet.getRange("F" + row + ":N" + row).merge().setFormula("=FORMULATEXT(E" + row + ")").setFontSize(9);
        });
        sheet.getRange("D320:N321").merge().setValue("Covered call and cash-secured put use the short strike and premium. Verticals also use the long strike and premium. Profit/loss includes the premium and editable contract size; it excludes fees and early assignment.").setWrap(true);
        TickerSheetsShowcase.section(sheet, 324, "Provider comparisons: prices, timestamps and availability");
        TickerSheetsShowcase.section(sheet, 336, "Dataset status: check sources and retrieval times");
        sheet.getRange("A337").setValue("Quote"); sheet.getRange("A341").setValue("Fundamentals"); sheet.getRange("A345").setValue("Options");
        TickerSheetsShowcase.section(sheet, 354, "Optional FRED data: your own API key is required");
        sheet.getRange("A355:N355").merge().setValue("Without a saved FRED key these cells return N/A. Add your key through TickerSheets → API keys…. The public demo has no saved key.");
        sheet.getRange("A372").setValue("Exact-date Treasury lookup"); sheet.getRange("A373").setValue("DGS10 on calculation date");
        sheet.getRange("C373:N373").merge().setFormula("=FORMULATEXT(B373)").setFontSize(9);
        sheet.getRange("A375:N375").merge().setValue("All financial values are cell formulas. TickerSheets → Refresh data reruns them. Quoted prices, regular closes, financial-report currencies, option premiums and theoretical model prices serve different purposes.").setWrap(true);
        for (const [cell, formula] of Object.entries(TickerSheetsShowcase.sourceFormulas())) sheet.getRange(cell).setFormula(formula);
        sheet.getRange("A52:A172").setNumberFormat("@"); sheet.getRange("B53:F172").setNumberFormat("#,##0.00"); sheet.getRange("G53:G172").setNumberFormat("#,##0");
        sheet.getRange("A218:A258").setNumberFormat("@"); sheet.getRange("A326:J332").setWrap(true); sheet.getRange("A338:E347").setWrap(true);
        TickerSheetsShowcase.section(sheet, 378, "Strategy payoff at expiration: prices and profit/loss from the selected inputs");
        sheet.getRange("A380:B380").setValues([["Stock at expiry", "Strategy profit/loss"]]).setFontWeight("bold");
        for (let i = 0; i <= 40; i++) {
            const row = 381 + i;
            sheet.getRange("A" + row).setFormula('=IF(ISNUMBER($B$304),$B$304*' + (0.5 + i * 0.025).toFixed(3) + ',"N/A")').setNumberFormat("0.00");
            sheet.getRange("B" + row).setFormula(TickerSheetsShowcase.strategyFormula("payoff", "A" + row)).setNumberFormat("#,##0.00");
        }
        sheet.getRange("Z1").setValue(TickerSheetsShowcase.marker); sheet.hideColumns(26);
        TickerSheetsShowcase.chart(sheet, "Daily closing price", "E53:E172", 7, Charts.ChartType.LINE);
        const payoff = sheet.newChart().setChartType(Charts.ChartType.LINE).addRange(sheet.getRange("A380:B421")).setNumHeaders(1)
            .setPosition(381, 5, 0, 0).setOption("title", "Selected strategy: profit/loss at expiration").setOption("width", 950).setOption("height", 295).setOption("legend", { position: "none" }).build();
        sheet.insertChart(payoff);
        return { sheet: "Stock analysis", charts: 2 };
    }
    static strategyFormula(metric, expirySpot = "") {
        return '=TICKERSHEETS_STRATEGY($B$315,$B$304,$B$316,$B$317,$B$318,$B$319,$B$320,$B$321,$B$216,"' + metric + '"' + (expirySpot ? ',' + expirySpot : '') + ')';
    }
    static chart(sheet, title, values, row, type) {
        const chart = sheet.newChart().setChartType(type).addRange(sheet.getRange("A53:A172")).addRange(sheet.getRange(values)).setNumHeaders(0)
            .setPosition(row, 5, 0, 0).setOption("title", title).setOption("width", 950).setOption("height", 295).setOption("legend", { position: "none" }).build();
        sheet.insertChart(chart);
    }
    static readGrid(sheet) {
        const range = sheet.getDataRange(), formulas = range.getFormulas(), values = range.getValues();
        const displayed = typeof range.getDisplayValues === "function" ? range.getDisplayValues() : values.map(row => row.map(String));
        return { formulas, values, displayed };
    }
    static readCell(sheet, cell, expected, grid) {
        let value, formula, displayed;
        if (grid) {
            const address = cell.match(/^([A-Z]+)([1-9]\d*)$/);
            if (!address) throw new Error("Enter a single A1 cell address.");
            const column = [...address[1]].reduce((number, letter) => number * 26 + letter.charCodeAt(0) - 64, 0) - 1, row = Number(address[2]) - 1;
            value = grid.values[row]?.[column] ?? ""; formula = grid.formulas[row]?.[column] || ""; displayed = grid.displayed[row]?.[column] ?? String(value);
        } else {
            const range = sheet.getRange(cell); value = range.getValue(); formula = range.getFormula();
            displayed = typeof range.getDisplayValue === "function" ? range.getDisplayValue() : String(value);
        }
        const pending = /^(?:Loading|Thinking)(?:\b|\.)/i.test(displayed);
        const error = /^#(?:REF!|ERROR!|VALUE!|NAME\?|DIV\/0!|NUM!|N\/A)/.test(String(value)) && !pending;
        const unavailable = value === "" || value == null || /^N\/A\b|unavailable|not available|^HTTP \d|key required/i.test(String(value));
        const status = pending ? "Loading" : error ? "Formula error" : unavailable ? "Unavailable" : typeof value === "string" && value.startsWith("=") ? "Not calculated" : "Available";
        return { cell, formula, matches: expected === undefined || formula === expected, value, status, pending, error, unavailable };
    }
    static inspect(book) {
        const sheet = book?.getSheetByName("Stock analysis");
        const grid = sheet ? TickerSheetsShowcase.readGrid(sheet) : null;
        if (!sheet || TickerSheetsShowcase.readCell(sheet, "Z1", undefined, grid).value !== TickerSheetsShowcase.marker) return { ok: false, error: "Stock analysis is not installed." };
        const expected = { ...TickerSheetsShowcase.sourceFormulas(), B4: "='Start here'!B4", B7: '=TICKERSHEETS_QUOTE($B$4,"price")' };
        const rows = Object.entries(expected).map(([cell, formula]) => TickerSheetsShowcase.readCell(sheet, cell, formula, grid));
        const seen = new Set(Object.keys(expected)), formulas = grid.formulas;
        for (let r = 0; r < formulas.length; r++) for (let c = 0; c < formulas[r].length; c++) {
            if (!formulas[r][c] || /^=FORMULATEXT\(/i.test(formulas[r][c])) continue;
            let column = "", number = c + 1;
            while (number) { number--; column = String.fromCharCode(65 + number % 26) + column; number = Math.floor(number / 26); }
            const cell = column + (r + 1);
            if (!seen.has(cell)) rows.push(TickerSheetsShowcase.readCell(sheet, cell, undefined, grid));
        }
        const datasets = Object.fromEntries(Object.entries({ quote: "A339", fundamentals: "A343", options: "A347", history: "A53", earnings: "A179", financials: "A197", fred: "A357" }).map(([name, cell]) => [name, TickerSheetsShowcase.readCell(sheet, cell, undefined, grid)]));
        const optionRows = grid.values.slice(218, 299), optionCounts = { calls: 0, puts: 0 };
        for (const row of optionRows) {
            if (row[3] === "Call") optionCounts.calls++;
            if (row[3] === "Put") optionCounts.puts++;
        }
        const value = cell => TickerSheetsShowcase.readCell(sheet, cell, undefined, grid).value;
        const options = { expiration: value("B216"), ...optionCounts, model: [304, 305, 306, 307, 308, 309].map(row => value("E" + row)),
            strategy: [316, 317, 318].map(row => value("E" + row)), payoff: [381, 401, 421].map(row => value("B" + row)) };
        return { ok: rows.every(row => row.matches && !row.error && !row.pending && row.status !== "Not calculated") && datasets.quote.status === "Available", rows, datasets, options, charts: sheet.getCharts().length,
            unavailable: rows.filter(row => row.unavailable).map(row => row.cell) };
    }
}
