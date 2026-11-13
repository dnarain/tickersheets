/*  *** DEBUG START ***
export { TickerSheetsShowcase };
//  *** DEBUG END ***/

/** Stock research and a price chart. Every financial result comes from a cell formula. */
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
            A214: '=ARRAY_CONSTRAIN(TICKERSHEETS_QUOTE_COMPARE($B$4),7,10)',
            A226: '=TICKERSHEETS_DATA_STATUS($B$4,"quote")',
            A230: '=TICKERSHEETS_DATA_STATUS($B$4,"fundamentals")',
            A240: '=TICKERSHEETS_FRED("DGS10",12)',
            B257: '=TICKERSHEETS_FRED_VALUE("DGS10",$E$4)'
        };
    }
    static build(book) {
        TickerSheetsShowcase.preflight(book);
        let sheet = book.getSheetByName("Stock analysis");
        if (!sheet) sheet = book.insertSheet("Stock analysis");
        if (sheet.getMaxRows() < 280) sheet.insertRowsAfter(sheet.getMaxRows(), 280 - sheet.getMaxRows());
        if (sheet.getMaxColumns() < 26) sheet.insertColumnsAfter(sheet.getMaxColumns(), 26 - sheet.getMaxColumns());
        if (typeof sheet.getCharts === "function") sheet.getCharts().forEach(chart => sheet.removeChart(chart));
        sheet.setFrozenRows(0); sheet.setFrozenColumns(0);
        sheet.getRange(1, 1, Math.max(280, sheet.getLastRow()), sheet.getMaxColumns()).breakApart().clear().clearDataValidations().setNumberFormat("General");
        sheet.getRange("A1:N265").setFontFamily("Arial").setFontSize(10).setVerticalAlignment("middle");
        sheet.setHiddenGridlines(true); sheet.setFrozenRows(4); sheet.setColumnWidths(1, 14, 115); sheet.setRowHeights(1, 265, 22);
        sheet.setColumnWidth(1, 205); sheet.setColumnWidth(2, 170); sheet.setColumnWidth(3, 410);
        sheet.getRange("A1:N1").merge().setFormula('=UPPER(TRIM($B$4))&" — stock analysis"').setFontSize(18).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2:N2").merge().setValue("Change the ticker on Start here. Click any result to read its formula. Tables and charts below show provider data; Options analysis contains the option quotes and calculators.").setWrap(true); sheet.setRowHeights(2, 1, 36);
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
        sheet.getRange("E40:N44").merge().setValue("The price chart uses daily closes. RSI measures recent price momentum. RSI targets describe calculations, not trade recommendations. Missing provider values appear as N/A.").setWrap(true);
        TickerSheetsShowcase.section(sheet, 50, "120 daily price bars", "A", "G");
        TickerSheetsShowcase.section(sheet, 50, "Stock snapshot and indicators", "I", "N");
        sheet.getRange("A51:G51").merge().setValue("Date, OHLC, adjusted close and volume; all rows come from the function at A52.");
        sheet.getRange("I51:N51").merge().setValue("Visible source for the technical indicators above.");
        TickerSheetsShowcase.section(sheet, 176, "Reported earnings: up to 12 periods");
        sheet.getRange("A177:N177").merge().setFormula("=FORMULATEXT(A178)").setFontSize(9);
        TickerSheetsShowcase.section(sheet, 194, "Financial results: up to 8 periods");
        sheet.getRange("A195:N195").merge().setFormula("=FORMULATEXT(A196)").setFontSize(9);
        TickerSheetsShowcase.section(sheet, 212, "Provider comparisons: prices, timestamps and availability");
        TickerSheetsShowcase.section(sheet, 224, "Dataset status: check sources and retrieval times");
        sheet.getRange("A225").setValue("Quote"); sheet.getRange("A229").setValue("Fundamentals");
        TickerSheetsShowcase.section(sheet, 238, "Optional FRED data: your own API key is required");
        sheet.getRange("A239:N239").merge().setValue("Without a saved FRED key these cells return N/A. Add your key through TickerSheets → API keys…. The public demo has no saved key.");
        sheet.getRange("A256").setValue("Exact-date Treasury lookup"); sheet.getRange("A257").setValue("DGS10 on calculation date");
        sheet.getRange("C257:N257").merge().setFormula("=FORMULATEXT(B257)").setFontSize(9);
        sheet.getRange("A259:N259").merge().setValue("All financial values are cell formulas. TickerSheets → Refresh data reruns them. Quoted prices, regular closes and financial-report currencies serve different purposes.").setWrap(true);
        for (const [cell, formula] of Object.entries(TickerSheetsShowcase.sourceFormulas())) sheet.getRange(cell).setFormula(formula);
        sheet.getRange("A52:A172").setNumberFormat("@"); sheet.getRange("B53:F172").setNumberFormat("#,##0.00"); sheet.getRange("G53:G172").setNumberFormat("#,##0");
        sheet.getRange("A214:J220").setWrap(true); sheet.getRange("A226:E235").setWrap(true);
        sheet.getRange("Z1:Z2").setValues([[TickerSheetsShowcase.marker], ["TICKERSHEETS_STOCK_V2"]]); sheet.hideColumns(26);
        TickerSheetsShowcase.chart(sheet, "Daily closing price", "E53:E172", 7, Charts.ChartType.LINE);
        return { sheet: "Stock analysis", charts: 1 };
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
    static inspectFormulas(sheet, expected, grid) {
        const rows = Object.entries(expected).map(([cell, formula]) => TickerSheetsShowcase.readCell(sheet, cell, formula, grid));
        const seen = new Set(Object.keys(expected)), formulas = grid.formulas;
        for (let r = 0; r < formulas.length; r++) for (let c = 0; c < formulas[r].length; c++) {
            if (!formulas[r][c] || /^=FORMULATEXT\(/i.test(formulas[r][c])) continue;
            let column = "", number = c + 1;
            while (number) { number--; column = String.fromCharCode(65 + number % 26) + column; number = Math.floor(number / 26); }
            const cell = column + (r + 1);
            if (!seen.has(cell)) rows.push(TickerSheetsShowcase.readCell(sheet, cell, undefined, grid));
        }
        return rows;
    }
    static inspect(book) {
        const sheet = book?.getSheetByName("Stock analysis");
        const grid = sheet ? TickerSheetsShowcase.readGrid(sheet) : null;
        if (!sheet || TickerSheetsShowcase.readCell(sheet, "Z1", undefined, grid).value !== TickerSheetsShowcase.marker) return { ok: false, error: "Stock analysis is not installed." };
        const expected = { ...TickerSheetsShowcase.sourceFormulas(), B4: "='Start here'!B4", B7: '=TICKERSHEETS_QUOTE($B$4,"price")' };
        const rows = TickerSheetsShowcase.inspectFormulas(sheet, expected, grid);
        const datasets = Object.fromEntries(Object.entries({ quote: "A227", fundamentals: "A231", history: "A53", earnings: "A179", financials: "A197", fred: "A241" }).map(([name, cell]) => [name, TickerSheetsShowcase.readCell(sheet, cell, undefined, grid)]));
        return { ok: rows.every(row => row.matches && !row.error && !row.pending && row.status !== "Not calculated") && datasets.quote.status === "Available", rows, datasets, charts: sheet.getCharts().length,
            ticker: TickerSheetsShowcase.readCell(sheet, "B4", "='Start here'!B4", grid),
            unavailable: rows.filter(row => row.unavailable).map(row => row.cell) };
    }
}
