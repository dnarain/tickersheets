/*  *** DEBUG START ***
export { CFWorkbookNames, CFUpgradeSheetNames };
//  *** DEBUG END ***/

const CF_WORKBOOK_TAB_NAMES_ = Object.freeze([
    ["CF Analysis", "Analysis", "CACHEFINANCE_ANALYSIS_V1"],
    ["CF Price history", "Price history", "CACHEFINANCE_ANALYSIS_V1"],
    ["CF Fundamentals", "Fundamentals", "CACHEFINANCE_ANALYSIS_V1"],
    ["CF Earnings", "Earnings", "CACHEFINANCE_ANALYSIS_V1"],
    ["CF Options", "Options", "CACHEFINANCE_ANALYSIS_V1"],
    ["CF Macro", "Macro", "CACHEFINANCE_ANALYSIS_V1"],
    ["CF Sources", "Sources", "CACHEFINANCE_ANALYSIS_V1"],
    ["CF Research", "Research", "CACHEFINANCE_RESEARCH_V1"],
    ["CF Strategies", "Strategies", "CACHEFINANCE_STRATEGIES_V1"],
    ["CF Watchlist", "Watchlist", "CACHEFINANCE_WATCHLIST_V1"],
    ["CF Journal", "Journal", "CACHEFINANCE_JOURNAL_V1"],
    ["CF Formulas", "Formulas", "CACHEFINANCE_FUNCTIONS_V1"],
    ["CF Images", "Chart links", "CACHEFINANCE_IMAGES_V1"],
    ["CF Lookup tests", "Lookup tests", "CACHEFINANCE_LOOKUP_CHECKS_V1"],
    ["CF Provider tests", "Provider tests", "CacheFinance provider diagnostics v1", "A1"],
    ["CF Worksheet tests", "Worksheet tests", "CacheFinance provider diagnostics v1", "A1"],
    ["CF Test report", "Test report", "CacheFinance provider diagnostics v1", "A1"]
].map(row => Object.freeze(row)));

/** Rename existing owned tabs. Google Sheets updates references when Sheet.setName runs. */
class CFWorkbookNames {
    static textEdits_(sheets) {
        const replacements = new Map([...CF_WORKBOOK_TAB_NAMES_.map(([from, to]) => [from, to]),
            ["CacheFinance →", "Data settings →"], ["CacheFinance menu", "Data settings menu"]]);
        const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = "(?:" + [...replacements.keys()].map(value => "\\b" + escape(value) + (/\w$/.test(value) ? "\\b" : "")).join("|") + ")", edits = [];
        for (const sheet of sheets) {
            if (typeof sheet.createTextFinder !== "function") continue;
            const cells = sheet.createTextFinder(pattern).useRegularExpression(true).matchCase(true).matchFormulaText(false).findAll();
            for (const cell of cells) {
                if (cell.getFormula()) continue;
                const value = cell.getValue();
                if (typeof value !== "string") continue;
                const updated = value.replace(new RegExp(pattern, "g"), name => replacements.get(name));
                if (updated !== value) edits.push({ cell, value: /^\s*[=+@-]/.test(updated) ? "'" + updated : updated });
            }
        }
        return edits;
    }

    static migrate(book, refreshLabels = false) {
        if (!book || typeof book.getSheetByName !== "function") throw new Error("Open the spreadsheet before upgrading its tab names.");
        const pending = [], sheets = [];
        for (const [from, to, marker, markerCell = "Z1"] of CF_WORKBOOK_TAB_NAMES_) {
            const previous = book.getSheetByName(from), current = book.getSheetByName(to);
            if (previous && current && previous !== current) throw new Error("Both " + from + " and " + to + " tabs exist. Rename one before upgrading the tabs.");
            for (const sheet of [previous, current]) {
                if (sheet && sheet.getRange(markerCell).getValue() !== marker) throw new Error("The existing " + sheet.getName() + " tab is not managed by Single Stock Analysis. Rename it before upgrading the tabs.");
            }
            if (previous || current) sheets.push(previous || current);
            if (previous) pending.push({ from, to, sheet: previous });
        }
        // Check every reserved name before changing any sheet name.
        const edits = pending.length || refreshLabels === true ? CFWorkbookNames.textEdits_(sheets) : [];
        for (const { to, sheet } of pending) sheet.setName(to);
        for (const { cell, value } of edits) cell.setValue(value);
        return { ok: true, renamed: pending.map(({ from, to }) => ({ from, to })) };
    }
}

/** Rename tabs and their written references without refreshing or rebuilding the workbook. */
function CFUpgradeSheetNames() {
    const result = CFWorkbookNames.migrate(SpreadsheetApp.getActiveSpreadsheet(), true);
    console.log("CF_SHEET_NAMES " + JSON.stringify(result));
    return result;
}
