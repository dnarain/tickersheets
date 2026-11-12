/*  *** DEBUG START ***
import { CFRSITARGETS, CFRsiTargets } from "./CacheFinanceRsiTargets.js";
import { CFFREDVALUE } from "./CacheFinanceFredValue.js";
import { CFFRED } from "./CacheFinanceResearchFunctions.js";
export { CFLookupChecks, CFBuildLookupChecks, CFInspectLookupChecks };
//  *** DEBUG END ***/

/** Actual worksheet formulas. An unavailable key or provider is BLOCKED, never a positive data PASS. */
class CFLookupChecks {
    static name() { return "CF Lookup tests"; }
    static marker() { return "CACHEFINANCE_LOOKUP_CHECKS_V1"; }
    static headers() { return ["Current RSI2", "Buy target price", "Sell target price", "Last traded price", "Bid price", "Ask price", "Open price", "Low price", "High price", "Volume", "Previous close", "Previous RSI2"]; }
    static cases() {
        const cases = [];
        for (const ticker of ["NVDA", "AAPL"]) {
            for (const [field, kind] of [["rsi2", "rsi"], ["buy_target", "target"], ["sell_target", "target"]]) cases.push({ id: "rsi_" + ticker.toLowerCase() + "_" + field, description: ticker + " " + field, kind, ticker, field,
                formula: '=CFRSITARGETS("' + ticker + '",20,80,"' + field + '",$B$4)', expected: kind === "rsi" ? "Numeric index 0–100" : "Positive price, or N/A for an unreachable target" });
        }
        cases.push({ id: "rsi_nvda_all", description: "NVDA full RSI2 array", kind: "rsiAll", ticker: "NVDA", field: "all", anchor: "A45", range: "A45:L46", formula: '=CFRSITARGETS("NVDA",20,80,"all",$B$4)', expected: "Twelve labels and twelve typed values" },
            { id: "rsi_aapl_all", description: "AAPL full RSI2 array", kind: "rsiAll", ticker: "AAPL", field: "all", anchor: "A50", range: "A50:L51", formula: '=CFRSITARGETS("AAPL",20,80,"all",$B$4)', expected: "Twelve labels and twelve typed values" },
            { id: "rsi_headers", description: "RSI2 headers without provider data", kind: "headers", ticker: "unused", field: "headers", anchor: "A55", range: "A55:L55", formula: '=CFRSITARGETS("unused",20,80,"headers",$B$4)', expected: "Exactly twelve labels" },
            { id: "fred_iso", description: "DGS10 exact date as ISO text", kind: "fred", date: "2026-11-05", formula: '=CFFREDVALUE("DGS10","2026-11-05",$B$4)', expected: "Numeric FRED observation; published percent units" },
            { id: "fred_date", description: "DGS10 exact date from DATE()", kind: "fred", date: "2026-11-05", formula: '=CFFREDVALUE("DGS10",DATE(2026,11,5),$B$4)', expected: "Same numeric observation as ISO text" },
            { id: "fred_date_match", description: "DATE() and ISO results agree", kind: "compare", dependencies: ["fred_iso", "fred_date"], expected: "TRUE, with both inputs numeric" },
            { id: "fred_recent", description: "DGS10 reference observation table", kind: "fredRecent", anchor: "N60", range: "N60:R90", formula: '=CFFRED("DGS10",30,$B$4)', expected: "Date/value/unit/series/source header plus 30 observations" },
            { id: "fred_reference", description: "Find November 5 in the recent observation table", kind: "reference", date: "2026-11-05", formula: '=IFERROR(INDEX(FILTER($O$61:$O$90,$N$61:$N$90="2026-11-05"),1,1),"N/A: DGS10 reference row unavailable")', expected: "Numeric value from the exact matching table date" },
            { id: "fred_reference_match", description: "Exact-date lookup matches the table row", kind: "compare", dependencies: ["fred_iso", "fred_reference"], expected: "TRUE, with both inputs numeric" },
            { id: "fred_weekend", description: "No earlier-day fallback for a DGS10 weekend", kind: "negative", series: "DGS10", date: "2026-11-07", formula: '=CFFREDVALUE("DGS10","2026-11-07",$B$4)', expected: "N/A: no observation for November 7" },
            { id: "fred_monthly_nonperiod", description: "Monthly UNRATE has no October 2 observation", kind: "negative", series: "UNRATE", date: "2026-10-02", formula: '=CFFREDVALUE("UNRATE","2026-10-02",$B$4)', expected: "N/A: no observation for October 2" },
            { id: "fred_invalid_date", description: "Reject an invalid calendar date", kind: "invalidDate", series: "DGS10", date: "2026-02-30", formula: '=CFFREDVALUE("DGS10","2026-02-30",$B$4)', expected: "N/A: invalid date input, without a provider lookup" });
        cases.forEach((row, i) => { row.row = i + 8; row.anchor = row.anchor || "D" + row.row; row.range = row.range || row.anchor; });
        const positions = Object.fromEntries(cases.map(row => [row.id, row.row]));
        for (const row of cases.filter(row => row.kind === "compare")) {
            const [a, b] = row.dependencies.map(id => "D" + positions[id]);
            row.formula = '=IF(AND(ISNUMBER(' + a + '),ISNUMBER(' + b + ')),' + a + '=' + b + ',"N/A: Comparison inputs unavailable")';
        }
        return cases;
    }
    static check(book) {
        const sheet = book?.getSheetByName(CFLookupChecks.name());
        if (sheet && sheet.getRange("Z1").getValue() !== CFLookupChecks.marker()) throw new Error("Rename the existing CF Lookup tests tab before building or inspecting lookup checks.");
        return sheet;
    }
    static build(book) {
        if (!book) throw new Error("Open the spreadsheet before building lookup checks.");
        const existing = CFLookupChecks.check(book), prior = existing?.getRange("B4").getValue();
        const refresh = Number.isInteger(prior) && prior >= 0 && prior < 2147483647 ? prior + 1 : 1;
        const sheet = existing || book.insertSheet(CFLookupChecks.name());
        if (sheet.getMaxColumns() < 26) sheet.insertColumnsAfter(sheet.getMaxColumns(), 26 - sheet.getMaxColumns());
        if (sheet.getMaxRows() < 100) sheet.insertRowsAfter(sheet.getMaxRows(), 100 - sheet.getMaxRows());
        sheet.getRange(1, 1, sheet.getMaxRows(), 25).breakApart().clear();
        sheet.setHiddenGridlines(true); sheet.setFrozenRows(7); sheet.setFrozenColumns(0); sheet.setColumnWidths(1, 18, 110);
        sheet.getRange("A1:R1").merge().setValue("RSI2 and exact-date FRED worksheet checks").setFontSize(14).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2:R2").merge().setValue("Run CFInspectLookupChecks after formulas finish. Missing keys or blocked providers remain BLOCKED. PASS does not independently verify financial accuracy.").setWrap(true);
        sheet.getRange("A4").setValue("Refresh number"); sheet.getRange("B4").setValue(refresh).setBackground("#FFF2CC").setFontColor("#0000FF");
        sheet.getRange("D4").setValue("Last inspection"); sheet.getRange("E4").setValue("Not inspected");
        sheet.getRange("A7:G7").setValues([["Case", "What the cell checks", "Expected", "Result / spill location", "Status", "Reason", "Formula text"]]).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold");
        const cases = CFLookupChecks.cases();
        sheet.getRange(8, 1, cases.length, 7).setWrap(true); sheet.getRange(8, 4, cases.length, 1).setNumberFormat("0.00000000");
        sheet.getRange(8, 7, cases.length, 1).setNumberFormat("@");
        for (const row of cases) {
            sheet.getRange(row.row, 1, 1, 3).setValues([[row.id, row.description, row.expected]]);
            sheet.getRange(row.row, 5, 1, 3).setValues([["PENDING", "Waiting for Google Sheets calculation and inspection", "'" + row.formula]]);
            if (row.range !== "D" + row.row) sheet.getRange(row.row, 4).setValue(row.range);
        }
        for (const [address, label] of [["A44", "NVDA: full twelve-field array"], ["A49", "AAPL: full twelve-field array"], ["A54", "Headers only; no market request"], ["N59", "DGS10: 30-observation reference table"]]) sheet.getRange(address).setValue(label).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A45:L55").setNumberFormat("0.00000000"); sheet.getRange("N60:R90").setNumberFormat("@"); sheet.getRange("O61:O90").setNumberFormat("0.00000000");
        for (const row of cases) sheet.getRange(row.anchor).setFormula(row.formula);
        sheet.setColumnWidth(1, 225); sheet.setColumnWidth(2, 315); sheet.setColumnWidth(3, 330); sheet.setColumnWidth(4, 220); sheet.setColumnWidth(5, 100); sheet.setColumnWidth(6, 450); sheet.setColumnWidth(7, 570);
        sheet.getRange("Z1").setValue(CFLookupChecks.marker()); sheet.hideColumns(26);
        const result = { ok: true, sheet: CFLookupChecks.name(), cases: cases.length, refresh, status: "PENDING" };
        console.log("CF_LOOKUP_CHECKS_BUILT " + JSON.stringify(result));
        return result;
    }
    static blocked_(value) {
        return typeof value === "string" && /API key|\bHTTP\s*\d+|\bBlocked\b|access challenge|Request failed|Request or response unavailable|could not be completed|network|timed out|FRED (?:series metadata|exact-date observation|data|exact-date value) unavailable/i.test(value);
    }
    static pending_(value, formula) { return value === "" || value == null || value === formula || typeof value === "string" && /^(?:Loading\.{0,3}|Calculating\.{0,3})$/i.test(value.trim()); }
    static number_(value, positive = false) { return typeof value === "number" && Number.isFinite(value) && (!positive || value > 0); }
    static equal_(a, b) {
        if (typeof a === "number" && typeof b === "number") return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
        if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => CFLookupChecks.equal_(value, b[i]));
        return a === b;
    }
    static date_(value) {
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) === "0000") return false;
        const date = new Date(value + "T00:00:00Z");
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }
    static safe_(value) {
        if (Array.isArray(value)) return value.map(CFLookupChecks.safe_);
        if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : "Invalid date";
        if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, CFLookupChecks.safe_(item)]));
        if (typeof value === "string") return value.replace(/([?&](?:api_key|token|crumb|cookie)=)[^&\s]+/gi, "$1[redacted]").slice(0, 240);
        return typeof value === "number" && !Number.isFinite(value) ? String(value) : value;
    }
    static inspect(book, overrides = {}) {
        const sheet = CFLookupChecks.check(book);
        if (!sheet) throw new Error("Build CF Lookup tests before inspecting lookup checks.");
        const calls = { rsi: overrides.rsi || (typeof CFRSITARGETS === "function" ? CFRSITARGETS : null), fredValue: overrides.fredValue || (typeof CFFREDVALUE === "function" ? CFFREDVALUE : null),
            fred: overrides.fred || (typeof CFFRED === "function" ? CFFRED : null) };
        const definitions = CFLookupChecks.cases(), refresh = sheet.getRange("B4").getValue(), inputs = new Map(), results = new Map();
        for (const row of definitions) inputs.set(row.id, { formula: sheet.getRange(row.anchor).getFormula(), actual: sheet.getRange(row.range).getValues() });
        const numeric = value => CFLookupChecks.number_(value), target = value => CFLookupChecks.number_(value, true) || value === "N/A";
        for (const row of definitions) {
            const input = inputs.get(row.id), actual = row.range === row.anchor ? input.actual[0][0] : input.actual, first = Array.isArray(actual) ? actual[0][0] : actual;
            let status = "PASS", reason = "Worksheet value and typed counterpart agree", counterpart, recorded = actual;
            if (input.formula !== row.formula) { status = "FAIL"; reason = "Formula changed or is missing"; recorded = "[Not recorded: formula changed]"; }
            else if (CFLookupChecks.pending_(first, row.formula)) { status = "PENDING"; reason = "Google Sheets has not returned a result"; }
            else if (CFLookupChecks.blocked_(first)) { status = "BLOCKED"; reason = first; }
            else if (typeof first === "string" && /^#(?:REF!|ERROR!|NAME\?|VALUE!|NUM!|DIV\/0!|N\/A)/.test(first)) { status = "FAIL"; reason = "Google Sheets returned a formula error"; }
            else if (["rsiAll", "headers", "fredRecent"].includes(row.kind) && typeof first === "string" && /^N\/A(?::|$)/.test(first)) { status = "FAIL"; reason = "The spill returned an unavailable result instead of the required table"; }
            else {
                try {
                    const invoke = (name, ...args) => typeof calls[name] === "function" ? calls[name](...args) : "N/A: Required test counterpart is unavailable";
                    if (["rsi", "target", "rsiAll", "headers"].includes(row.kind)) counterpart = invoke("rsi", row.ticker, 20, 80, row.field, refresh);
                    else if (["fred", "negative", "invalidDate"].includes(row.kind)) counterpart = invoke("fredValue", row.series || "DGS10", row.date, refresh);
                    else if (row.kind === "fredRecent") counterpart = invoke("fred", "DGS10", 30, refresh);
                    if (CFLookupChecks.blocked_(counterpart)) { status = "BLOCKED"; reason = "Direct counterpart: " + counterpart; }
                    else if (counterpart === "N/A: Required test counterpart is unavailable") { status = "BLOCKED"; reason = counterpart; }
                    else if (row.kind === "rsi" && !(numeric(actual) && actual >= 0 && actual <= 100)) { status = "FAIL"; reason = "Expected a numeric RSI index from 0 to 100"; }
                    else if (row.kind === "target" && !target(actual)) { status = "FAIL"; reason = "Expected a positive target or an explicit unavailable target"; }
                    else if (row.kind === "fred" && !numeric(actual)) { status = "FAIL"; reason = "Expected a numeric exact-date FRED observation"; }
                    else if (row.kind === "negative") {
                        const pattern = new RegExp("^N/A: FRED (?:has no observation|observation missing) on " + row.date.replaceAll("-", "\\-") + "\\.$");
                        if (!pattern.test(actual)) { status = "FAIL"; reason = "Expected the requested date's no-observation result, not another error"; }
                    } else if (row.kind === "invalidDate" && !(typeof actual === "string" && /^N\/A: Use a date-valued cell or a valid YYYY-MM-DD date\.$/.test(actual))) { status = "FAIL"; reason = "Expected the invalid-date input error"; }
                    else if (row.kind === "headers" && !CFLookupChecks.equal_(actual, [CFLookupChecks.headers()])) { status = "FAIL"; reason = "Header spill has the wrong labels or dimensions"; }
                    else if (row.kind === "rsiAll") {
                        const line = actual[1];
                        if (!CFLookupChecks.equal_(actual[0], CFLookupChecks.headers())) { status = "FAIL"; reason = "RSI2 spill has invalid header labels"; }
                        else if (!Array.isArray(line) || line.every(value => value === "")) { status = "PENDING"; reason = "RSI2 value row is not populated"; }
                        else if (line.length !== 12 || !numeric(line[0]) || line[0] < 0 || line[0] > 100 || !target(line[1]) || !target(line[2])
                            || !CFLookupChecks.number_(line[3], true) || !CFLookupChecks.number_(line[10], true) || !numeric(line[11]) || line[11] < 0 || line[11] > 100
                            || !line.slice(4, 10).every(value => value === "N/A" || numeric(value) && value >= 0)) { status = "FAIL"; reason = "RSI2 spill contains invalid labels, dimensions or value types"; }
                    } else if (row.kind === "fredRecent") {
                        if (!CFLookupChecks.equal_(actual[0], ["Date", "Value", "Unit", "Series", "Source"]) || actual.length !== 31
                            || !actual.slice(1).every(line => CFLookupChecks.date_(line[0]) && (numeric(line[1]) || line[1] === "N/A") && line[3] === "DGS10")) { status = "FAIL"; reason = "FRED reference spill has invalid headers, dates, series or values"; }
                    } else if (row.kind === "reference") {
                        const reference = inputs.get("fred_recent").actual, blocked = reference[0][0];
                        if (CFLookupChecks.blocked_(blocked)) { status = "BLOCKED"; reason = "Reference table: " + blocked; }
                        else if (CFLookupChecks.pending_(blocked, definitions.find(value => value.id === "fred_recent").formula)) { status = "PENDING"; reason = "Reference table has not calculated"; }
                        else {
                            const found = reference.slice(1).filter(line => line[0] === row.date);
                            if (found.length !== 1 || !numeric(actual) || !numeric(found[0][1]) || !CFLookupChecks.equal_(actual, found[0][1])) { status = "FAIL"; reason = "Expected one matching reference date and the same numeric value"; }
                        }
                    } else if (row.kind === "compare") {
                        const dependencies = row.dependencies.map(id => results.get(id));
                        if (dependencies.some(value => value.status === "BLOCKED")) { status = "BLOCKED"; reason = "A source comparison input is blocked"; }
                        else if (dependencies.some(value => value.status === "PENDING")) { status = "PENDING"; reason = "A source comparison input has not calculated"; }
                        else if (dependencies.some(value => value.status === "FAIL") || actual !== true || !dependencies.every(value => numeric(value.actual)) || !CFLookupChecks.equal_(dependencies[0].actual, dependencies[1].actual)) { status = "FAIL"; reason = "Expected TRUE and two equal numeric comparison inputs"; }
                    }
                    if (status === "PASS" && counterpart !== undefined) {
                        const checked = row.kind === "fredRecent" && Array.isArray(counterpart) ? actual.slice(0, counterpart.length) : actual;
                        if (!CFLookupChecks.equal_(checked, counterpart)) { status = "FAIL"; reason = "Worksheet result differs from its direct function counterpart; refresh if source data changed"; }
                    }
                } catch { status = "FAIL"; reason = "The typed counterpart check could not complete"; }
            }
            if (row.kind === "fredRecent" && Array.isArray(recorded)) recorded = { rows: recorded.length - 1, headers: recorded[0], firstObservation: recorded[1], requestedDateRows: recorded.slice(1).filter(line => line[0] === "2026-11-05") };
            const result = { id: row.id, formula: row.formula, range: row.range, actual: CFLookupChecks.safe_(recorded), status, reason };
            results.set(row.id, result); sheet.getRange(row.row, 5, 1, 2).setValues([[status, CFLookupChecks.safe_(reason)]]);
        }
        const cases = [...results.values()], counts = { PASS: 0, FAIL: 0, BLOCKED: 0, PENDING: 0 };
        cases.forEach(row => counts[row.status]++); sheet.getRange("E4").setValue(new Date()).setNumberFormat("yyyy-mm-dd hh:mm:ss");
        const report = { ok: counts.FAIL === 0 && counts.BLOCKED === 0 && counts.PENDING === 0, completed: counts.PENDING === 0, sheet: CFLookupChecks.name(), refresh, counts,
            scope: "Actual worksheet values and direct same-runtime function counterparts. No independent financial-data reconciliation.", cases };
        console.log("CF_LOOKUP_CHECKS " + JSON.stringify(report));
        return report;
    }
}

function CFBuildLookupChecks() { return CFLookupChecks.build(SpreadsheetApp.getActiveSpreadsheet()); }
function CFInspectLookupChecks() { return CFLookupChecks.inspect(SpreadsheetApp.getActiveSpreadsheet()); }
