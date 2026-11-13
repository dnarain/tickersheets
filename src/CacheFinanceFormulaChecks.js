/*  *** DEBUG START ***
import { CFAnalysisData } from "./CacheFinanceAnalysisData.js";
import { CFFormulaWorkbook } from "./CacheFinanceFormulaWorkbook.js";
export { CFFormulaChecks, CFValidateFormulaWorkbook };
//  *** DEBUG END ***/

/** Read displayed cells and independently check worksheet calculations. Never refresh sources. */
class CFFormulaChecks {
    static missing(value) {
        return value == null || value === "" || typeof value === "string" && /^(?:N\/A(?:\b|:)|#N\/A(?:\b|:))/.test(value.trim());
    }

    static compareNumeric(actual, expected, absoluteTolerance = 1e-8, relativeTolerance = 1e-8) {
        if (typeof actual === "string" && /^(?:Loading|Thinking)(?:\b|\.)/i.test(actual.trim())) return { status: "pending", reason: "Calculation pending" };
        const actualNumber = typeof actual === "number" && Number.isFinite(actual), expectedNumber = typeof expected === "number" && Number.isFinite(expected);
        if (!expectedNumber) {
            if (CFFormulaChecks.missing(expected) && CFFormulaChecks.missing(actual)) return { status: "passed", reason: "Expected unavailable value", available: false };
            return { status: "failed", reason: "Expected unavailable value differs" };
        }
        if (!actualNumber) return { status: "failed", reason: "Expected a numeric value" };
        const difference = Math.abs(actual - expected), tolerance = absoluteTolerance + relativeTolerance * Math.max(Math.abs(actual), Math.abs(expected));
        return { status: difference <= tolerance ? "passed" : "failed", reason: difference <= tolerance ? "Numeric values match" : "Numeric values differ", available: true, difference, tolerance };
    }

    static column(number) {
        let result = "";
        for (let value = number; value > 0; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(65 + (value - 1) % 26) + result;
        return result;
    }

    static ranges() {
        // Data, ordinary formulas and chart helpers. The checker does not inspect unrelated tabs.
        return { "Analysis": [4, 155, 18], "Quote data": [4, 207, 28], "Price history": [4, 517, 64],
            "Fundamentals": [4, 200, 13], "Earnings": [4, 507, 56], "Options": [4, 2007, 31],
            "Strategies": [4, 1055, 25], "Research": [4, 1600, 100], "Macro": [7, 415, 34],
            "Sources": [7, 30, 6], "Formulas": [4, 47, 21], "Watchlist": [4, 27, 27], "Watchlist data": [4, 1000, 26] };
    }

    static validate(book) {
        if (!book || typeof book.getSheetByName !== "function") throw new Error("Open the formula analysis spreadsheet first.");
        const report = { ticker: "", mode: "formulas", passed: 0, failed: 0, pending: 0, historyRows: 0, numericComparisons: 0, expectedGaps: 0, errors: [], availability: [], sourceFormulaAddresses: [] };
        const availability = new Map(), failures = new Set(), pending = new Set(), tables = new Map(), markers = CFFormulaWorkbook.markers();
        const available = (sheet, reason, cell) => {
            const key = sheet + ":" + reason, item = availability.get(key) || { sheet, reason, count: 0, firstCell: cell };
            item.count++; availability.set(key, item);
        };
        const fail = (address, reason) => {
            const key = address + ":" + reason;
            if (failures.has(key)) return;
            failures.add(key); report.failed++;
            if (report.errors.length < 20) report.errors.push({ address, reason });
        };
        const wait = (address, reason) => {
            if (pending.has(address)) return;
            pending.add(address); report.pending++; available(address.split("!")[0], reason, address.split("!").at(-1));
        };
        const check = (address, actual, expected) => {
            const result = CFFormulaChecks.compareNumeric(actual, expected);
            if (result.status === "passed") { report.passed++; if (result.available === false) report.expectedGaps++; }
            else if (result.status === "pending") wait(address, result.reason);
            else fail(address, result.reason);
            return result;
        };
        const inspect = CFFormulaWorkbook.inspect(book);
        report.ticker = typeof inspect.ticker === "string" ? inspect.ticker.trim().slice(0, 40) : "";
        report.mode = inspect.mode;
        if (inspect.mode !== "formulas") fail("Analysis!Z2", "Workbook is not in formula mode");
        for (const error of inspect.errors) fail(error.sheet + (error.cell ? "!" + error.cell : ""), error.error === "Expected formula" || error.error === "Missing sheet" ? error.error : "Worksheet formula error");
        for (const node of inspect.formulas) if (node.formula) report.passed++;

        const sourceFunction = /\bCF(?:QUOTE|QUOTECOMPARE|HISTORY|FUNDAMENTALS|EARNINGS|OPTIONS|EXPIRATIONS|RSITARGETS|FIELD|FRED|FREDVALUE|WATCHROW)\s*\(/i;
        const fatal = /^#(?:REF!|ERROR!|VALUE!|NUM!|DIV\/?0!|NAME\?|SPILL!)(?:\s|$)/i;
        for (const [name, [firstRow, lastRow, columns]] of Object.entries(CFFormulaChecks.ranges())) {
            const sheet = book.getSheetByName(name);
            // Watchlist is optional in a single-stock workbook.
            if (!sheet) { if (!name.startsWith("Watchlist")) fail(name, "Missing sheet"); continue; }
            if (sheet.getRange("Z1").getValue() !== markers[name]) { fail(name + "!Z1", "Sheet is not managed by TickerSheets"); continue; }
            const height = Math.min(lastRow, sheet.getMaxRows(), Math.max(firstRow, sheet.getLastRow())) - firstRow + 1;
            const width = Math.min(columns, sheet.getMaxColumns());
            const range = sheet.getRange(firstRow, 1, height, width), values = range.getValues(), formulas = range.getFormulas();
            // Sheets can return #ERROR! from getValues while the user still sees Loading....
            const displayed = typeof range.getDisplayValues === "function" ? range.getDisplayValues() : null;
            tables.set(name, { firstRow, values });
            for (let r = 0; r < values.length; r++) for (let c = 0; c < values[r].length; c++) {
                const value = values[r][c], formula = formulas[r][c], cell = CFFormulaChecks.column(c + 1) + (r + firstRow), address = name + "!" + cell;
                const source = typeof formula === "string" && sourceFunction.test(formula) && !/^=FORMULATEXT\(/i.test(formula);
                if (source) report.sourceFormulaAddresses.push(address);
                const shown = displayed?.[r]?.[c], pendingText = typeof shown === "string" ? shown : value;
                if (typeof pendingText === "string" && /^(?:Loading|Thinking)(?:\b|\.)/i.test(pendingText.trim())) {
                    // Numeric comparisons below must also see the pending state instead of #ERROR!.
                    values[r][c] = pendingText.trim();
                    wait(address, source ? "Source calculation pending" : "Dependent calculation pending");
                    continue;
                }
                if (typeof shown === "string" && fatal.test(shown.trim())) { fail(address, "Worksheet formula error"); continue; }
                if (typeof value !== "string" || !value) continue;
                const text = value.trim();
                if (fatal.test(text)) fail(address, "Worksheet formula error");
                else if (CFFormulaChecks.missing(text)) available(name, /(?:FRED.*key|key.*FRED)/i.test(text) ? "FRED API key required" : source ? "Source unavailable" : "Unavailable value or expected calculation gap", cell);
            }
        }

        const cell = (name, row, column) => {
            const table = tables.get(name);
            return table ? table.values[row - table.firstRow]?.[column - 1] ?? "" : "";
        };
        const history = tables.get("Price history");
        if (history) {
            const rows = [];
            for (let row = 8; row <= 517; row++) {
                const date = cell("Price history", row, 1);
                if (date === "" || date == null) continue;
                if (typeof date === "string" && /^(?:#|N\/A|Loading|Thinking)/i.test(date)) continue;
                rows.push({ sheetRow: row, date: date instanceof Date ? date.toISOString().slice(0, 10) : String(date), open: cell("Price history", row, 2), high: cell("Price history", row, 3), low: cell("Price history", row, 4), close: cell("Price history", row, 5), adjustedClose: cell("Price history", row, 6), volume: cell("Price history", row, 7) });
            }
            report.historyRows = rows.length;
            if (!rows.length) wait("Price history!A7", "History unavailable; numeric checks pending");
            else {
                // Retain internal blank-date rows so missing data cannot shorten an indicator window.
                const first = rows[0].sheetRow, last = rows.at(-1).sheetRow, byRow = new Map(rows.map(row => [row.sheetRow, row]));
                const input = Array.from({ length: last - first + 1 }, (_value, offset) => byRow.get(first + offset) || { date: "", close: null, adjustedClose: null });
                const gold = CFAnalysisData.calculate(input);
                const keys = ["sma20", "sma50", "sma200", "ema12", "ema26", "macd", "macdSignal", "macdHistogram", "rsi14", "drawdown", "return1d"];
                for (const row of rows) keys.forEach((key, index) => {
                    const expected = gold.series[row.sheetRow - first][key];
                    if (typeof expected === "number") report.numericComparisons++;
                    check("Price history!" + CFFormulaChecks.column(index + 8) + row.sheetRow, cell("Price history", row.sheetRow, index + 8), expected);
                });
            }
        }

        const quote = tables.get("Quote data"), price = quote?.values.find(row => row[0] === "price")?.[1] ?? null;
        check("Analysis!B9 (Quote data price)", cell("Analysis", 9, 2), price);
        check("Formulas!B23 (Quote data price)", cell("Formulas", 23, 2), price);
        for (const [name, targetRow, key] of [["RSI14", 16, "RSI14"], ["SMA50", 17, "SMA50"], ["SMA200", 18, "SMA200"]]) {
            const summary = history?.values.find(row => row[62] === key)?.[63] ?? null;
            check("Analysis!B" + targetRow + " (" + name + " summary)", cell("Analysis", targetRow, 2), summary);
        }
        check("Options!Y4 (Research!Q25 ATM IV)", cell("Options", 4, 25), cell("Research", 25, 17));
        report.availability = [...availability.values()];
        report.ok = report.failed === 0 && report.pending === 0;
        return report;
    }
}

/** Read-only workbook checks. Logs counts, at most 20 errors and source cell addresses. */
function CFValidateFormulaWorkbook() {
    const report = CFFormulaChecks.validate(SpreadsheetApp.getActiveSpreadsheet());
    console.log(JSON.stringify(report));
    return report;
}
