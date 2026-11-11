/*  *** DEBUG START ***
import { FinanceWebSites } from "./CacheFinanceWebSites.js";
export { CFProviderDiagnostics, CFProviderSanitize_, CFProviderNormalizeRows_, CFProviderWrite_, CFProviderRun_, CFProviderReportJson, onOpen, RunProviderTests, ContinueProviderTests, RunProviderYahooApi, RunProviderGoogle, RunProviderGlobe, RunProviderYahoo, RunProviderFinnhub, RunProviderTwelveData, RunProviderAlphaVantage, RunProviderCoinMarket, SetupProviderWorksheetTests, CollectProviderWorksheetTests };
//  *** DEBUG END ***/

/**
 * @OnlyCurrentDoc
 * Direct provider diagnostics. No financial-value cache or fallback is read.
 * The diagnostic bundle suppresses upstream parser logging at build time.
 */
const CF_PROVIDER_INVALID_SYMBOL = "NASDAQ:ZZZZCFINVALID20261111";
const CF_PROVIDER_UPSTREAM = "8f84e202e0c5d56f27b2bf000bb86817c3503894";
const CF_PROVIDER_MARKER = "CacheFinance provider diagnostics v1";
const CF_PROVIDER_SHEET = "CF Provider tests";
const CF_WORKSHEET_SHEET = "CF Worksheet tests";
const CF_REPORT_SHEET = "CF Test report";
const CF_PROVIDER_HEADERS = ["Run ID", "Provider", "Symbol", "Attribute", "Status", "HTTP", "Elapsed ms", "Retrieved UTC", "Source timestamp", "Timestamp field", "Value", "Endpoint without query", "Identity", "Note"];
const CF_PROVIDER_KEYS = { FINNHUB: "FINNHUB_API_KEY", TWELVEDATA: "TWELVE_DATA_API_KEY", ALPHAVANTAGE: "ALPHA_VANTAGE_API_KEY", COINMARKET: "COINMARKET_API_KEY" };

function CFProviderQuietLog() { /* Intentionally omit upstream URL/body logging. */ }

function onOpen() {
    SpreadsheetApp.getUi().createMenu("CacheFinance tests")
        .addItem("Start provider tests", "RunProviderTests")
        .addItem("Continue provider tests", "ContinueProviderTests")
        .addSeparator()
        .addItem("Yahoo chart API", "RunProviderYahooApi")
        .addItem("Google Finance website", "RunProviderGoogle")
        .addItem("Globe and Mail", "RunProviderGlobe")
        .addItem("Yahoo Finance website", "RunProviderYahoo")
        .addItem("Finnhub", "RunProviderFinnhub")
        .addItem("Twelve Data", "RunProviderTwelveData")
        .addItem("Alpha Vantage", "RunProviderAlphaVantage")
        .addItem("CoinMarketCap", "RunProviderCoinMarket")
        .addSeparator()
        .addItem("Set up worksheet checks", "SetupProviderWorksheetTests")
        .addItem("Collect worksheet results", "CollectProviderWorksheetTests")
        .addItem("Export report JSON", "CFProviderReportJson")
        .addToUi();
}

function RunProviderTests() { return CFProviderRun_("", true); }
function ContinueProviderTests() { return CFProviderRun_("", false); }
function RunProviderYahooApi() { return CFProviderRun_("YAHOOAPI", false); }
function RunProviderGoogle() { return CFProviderRun_("GOOGLEWEBSITEFINANCE", false); }
function RunProviderGlobe() { return CFProviderRun_("GLOBE", false); }
function RunProviderYahoo() { return CFProviderRun_("YAHOO", false); }
function RunProviderFinnhub() { return CFProviderRun_("FINNHUB", false); }
function RunProviderTwelveData() { return CFProviderRun_("TWELVEDATA", false); }
function RunProviderAlphaVantage() { return CFProviderRun_("ALPHAVANTAGE", false); }
function RunProviderCoinMarket() { return CFProviderRun_("COINMARKET", false); }

/** Redact known keys and all URLs; exceptions and bodies are never recorded. */
function CFProviderSanitize_(value, secrets = []) {
    let safe = String(value === undefined || value === null ? "" : value);
    for (const secret of secrets) {
        if (!secret) continue;
        for (const token of [String(secret), encodeURIComponent(String(secret))]) safe = safe.split(token).join("[REDACTED]");
    }
    return safe.replace(/https?:\/\/[^\s"'<>]+/gi, "[URL]").replace(/[\u0000-\u001f]/g, " ").slice(0, 160);
}

class CFProviderDiagnostics {
    static sites() { return new FinanceWebSites().get(); }

    static symbols(provider) {
        const stocks = ["NASDAQ:AAPL", "NASDAQ:NVDA", "TSE:RY", "TSE:XIC"];
        if (provider === "GLOBE") stocks.push("CF:DYN2752");
        if (["GOOGLEWEBSITEFINANCE", "ALPHAVANTAGE", "TWELVEDATA"].includes(provider)) stocks.push("CURRENCY:USDCAD");
        if (provider === "COINMARKET") return ["CURRENCY:BTCUSD", "CURRENCY:ETHUSD", "NASDAQ:AAPL"];
        if (["YAHOOAPI", "YAHOO", "GOOGLEWEBSITEFINANCE", "GLOBE"].includes(provider)) stocks.push(CF_PROVIDER_INVALID_SYMBOL);
        return stocks;
    }

    static plan(runId, sites = CFProviderDiagnostics.sites()) {
        return sites.flatMap(site => CFProviderDiagnostics.symbols(site.siteName).flatMap(symbol =>
            ["PRICE", "NAME", "YIELDPCT"].map(attribute => [runId, site.siteName, symbol, attribute, "PENDING", "", "", "", "Unknown", "", "", "", "Unknown", "Direct download; no financial-value cache or fallback."])));
    }

    static unsupported(provider, symbol, attribute) {
        const market = FinanceWebSites.getTickerCountryCode(symbol);
        const attributes = { YAHOOAPI: ["PRICE", "NAME"], FINNHUB: ["PRICE"], ALPHAVANTAGE: ["PRICE"], TWELVEDATA: ["PRICE", "NAME"], COINMARKET: ["PRICE", "NAME"] };
        if (attributes[provider] && !attributes[provider].includes(attribute)) return "UNSUPPORTED_ATTRIBUTE";
        if (provider === "GOOGLEWEBSITEFINANCE" && ((market === "us" && attribute === "YIELDPCT") || (market === "fx" && attribute !== "PRICE"))) return "UNSUPPORTED_ATTRIBUTE";
        const markets = { YAHOOAPI: ["us", "ca"], YAHOO: ["us", "ca"], GLOBE: ["us", "ca", "mut"], FINNHUB: ["us"], ALPHAVANTAGE: ["us", "fx"], TWELVEDATA: ["us", "fx"], COINMARKET: ["fx"] };
        if (markets[provider] && !markets[provider].includes(market)) return "UNSUPPORTED_SYMBOL";
        return "";
    }

    static prepare(row, site, secrets) {
        const unsupported = CFProviderDiagnostics.unsupported(row[1], row[2], row[3]);
        if (unsupported) { row[4] = unsupported; row[13] = "Outside this adapter's implemented attributes or markets."; return null; }
        let key = "";
        try { key = site.siteObject.getApiKey(); }
        catch { row[4] = "CONFIG_ERROR"; row[13] = "Could not read provider configuration."; return null; }
        if (CF_PROVIDER_KEYS[row[1]] && (key === null || key === undefined || String(key).trim() === "")) {
            row[4] = "KEY_REQUIRED"; row[13] = "Set " + CF_PROVIDER_KEYS[row[1]] + " in this script's properties, then rerun this provider."; return null;
        }
        if (key) secrets.push(String(key));
        let url = "";
        try { url = site.siteObject.getURL(row[2], row[3], key || null); }
        catch { row[4] = "CONFIG_ERROR"; row[13] = "Provider URL construction failed."; return null; }
        if (!url) { row[4] = "UNSUPPORTED_COMBINATION"; row[13] = "The adapter did not produce a URL for this symbol and attribute."; return null; }
        if (!/^https:\/\//i.test(url)) { row[4] = "CONFIG_ERROR"; row[13] = "The diagnostic runner requires HTTPS."; return null; }
        row[11] = String(url).split(/[?#]/)[0];
        for (const secret of secrets) if (secret) row[11] = row[11].split(secret).join("[REDACTED]");
        return url;
    }

    static validValue(attribute, value) {
        if (attribute === "NAME") return typeof value === "string" && value.trim().length > 1 && !/captcha|access denied|just a moment|not found|couldn't find|javascript required/i.test(value);
        return typeof value === "number" && Number.isFinite(value) && (attribute === "PRICE" ? value > 0 : value >= 0);
    }

    static expectedName(symbol) {
        return ({ "NASDAQ:AAPL": /Apple/i, "NASDAQ:NVDA": /NVIDIA/i, "TSE:RY": /Royal\s+Bank/i, "TSE:XIC": /iShares/i, "CURRENCY:BTCUSD": /Bitcoin/i, "CURRENCY:ETHUSD": /Ethereum/i })[symbol] || null;
    }

    static sourceDetails(provider, body, symbol) {
        const result = { timestamp: "Unknown", field: "", identity: "Unknown" };
        try {
            const data = JSON.parse(body);
            let epoch;
            if (provider === "YAHOOAPI") {
                const meta = data.chart.result[0].meta;
                const wanted = symbol.startsWith("TSE:") ? symbol.split(":")[1] + ".TO" : symbol.split(":")[1];
                result.identity = meta.symbol ? (String(meta.symbol).toUpperCase() === wanted.toUpperCase() ? "Matched" : "Mismatch") : "Unknown";
                epoch = meta.regularMarketTime; result.field = epoch ? "meta.regularMarketTime" : "";
            } else if (provider === "FINNHUB") {
                epoch = data.t; result.field = epoch ? "t" : "";
            } else if (provider === "TWELVEDATA") {
                epoch = data.timestamp;
                if (epoch) result.field = "timestamp";
                else if (data.datetime) { result.timestamp = CFProviderSanitize_(data.datetime); result.field = "datetime (provider timezone)"; }
            } else if (provider === "ALPHAVANTAGE") {
                const day = data["Global Quote"]?.["07. latest trading day"];
                const time = data["Realtime Currency Exchange Rate"]?.["6. Last Refreshed"];
                if (day || time) { result.timestamp = CFProviderSanitize_(day || time); result.field = day ? "latest trading day (date only)" : "Last Refreshed (provider timezone)"; }
            } else if (provider === "COINMARKET") {
                const currency = FinanceWebSites.getCurrencyTickers(symbol);
                const key = Object.keys(data.data || {}).find(item => item.toUpperCase() === currency.fromCurrency);
                const time = key && data.data[key].quote?.[currency.toCurrency]?.last_updated;
                if (time) { result.timestamp = CFProviderSanitize_(time); result.field = "quote.last_updated"; }
            }
            if (typeof epoch === "number" && Number.isFinite(epoch) && epoch > 0) result.timestamp = new Date(epoch * 1000).toISOString();
        } catch { /* HTML sources and missing metadata stay Unknown. */ }
        return result;
    }

    static providerErrorMessagePresent(body) {
        try {
            const data = JSON.parse(body);
            if (!data || typeof data !== "object") return false;
            return ["Note", "Information", "Error Message"].some(key => typeof data[key] === "string" && data[key].trim() !== "") ||
                (String(data.status).toLowerCase() === "error" && typeof data.message === "string" && data.message.trim() !== "");
        } catch { return false; }
    }

    static parse(row, site, response, elapsed, retrieved, secrets) {
        row[5] = response.getResponseCode(); row[6] = elapsed; row[7] = retrieved;
        if (row[5] < 200 || row[5] >= 300) {
            row[4] = row[2] === CF_PROVIDER_INVALID_SYMBOL && [404, 410].includes(row[5]) ? "NEGATIVE_REJECTED" : row[5] === 429 ? "RATE_LIMITED" : "HTTP_ERROR";
            row[13] = "HTTP response failed; no value accepted. A status does not establish a subscription requirement.";
            return;
        }
        const body = response.getContentText();
        const details = CFProviderDiagnostics.sourceDetails(row[1], body, row[2]);
        row[8] = CFProviderSanitize_(details.timestamp, secrets); row[9] = details.field; row[12] = details.identity;
        if (details.identity === "Mismatch" && row[2] !== CF_PROVIDER_INVALID_SYMBOL) { row[4] = "IDENTITY_MISMATCH"; row[13] = "Returned symbol differs from requested symbol."; return; }
        try {
            const parsed = site.siteObject.parseResponse(body, row[2], row[3]);
            const value = parsed?.getValue(row[3]);
            if (row[2] === CF_PROVIDER_INVALID_SYMBOL) {
                const accepted = CFProviderDiagnostics.validValue(row[3], value);
                row[4] = accepted ? "NEGATIVE_FALSE_POSITIVE" : "NEGATIVE_REJECTED";
                row[10] = accepted ? (typeof value === "string" ? CFProviderSanitize_(value, secrets) : value) : "";
                row[13] = accepted ? "Adapter accepted a value for the deliberately invalid symbol. Inspect this parser." : "Adapter did not extract a value for the deliberately invalid symbol.";
                return;
            }
            const expectedName = CFProviderDiagnostics.expectedName(row[2]);
            const parsedName = parsed?.getValue("NAME");
            if (expectedName && CFProviderDiagnostics.validValue("NAME", parsedName)) {
                if (!expectedName.test(parsedName)) { row[4] = "IDENTITY_MISMATCH"; row[12] = "Name mismatch"; row[13] = "Parsed company name does not match the selected test ticker."; return; }
                if (row[12] === "Unknown") row[12] = "Name matched";
            }
            if (!CFProviderDiagnostics.validValue(row[3], value)) {
                row[4] = "MISSING_VALUE";
                row[13] = CFProviderDiagnostics.providerErrorMessagePresent(body) ?
                    "Provider error or limit message present; no valid value accepted." :
                    "HTTP succeeded, but the adapter did not extract a valid value.";
                return;
            }
            row[10] = typeof value === "string" ? CFProviderSanitize_(value.trim(), secrets) : value;
            row[4] = "PARSED";
            row[13] = "Direct response parsed. Freshness and financial accuracy require separate checks.";
        } catch { row[4] = "PARSE_ERROR"; row[13] = "The adapter threw while parsing the direct response."; }
    }

    /** Fetch each distinct URL once in this batch and parse its requested fields. */
    static batch(rows, sites, fetch, publish, clock = () => Date.now(), pause = ms => Utilities.sleep(ms)) {
        const secrets = [];
        const byName = new Map(sites.map(site => [site.siteName, site]));
        const groups = new Map();
        for (const row of rows) {
            if (row[4] !== "PENDING") continue;
            const site = byName.get(row[1]);
            if (!site) { row[4] = "CONFIG_ERROR"; row[13] = "Provider is absent from the current registry."; continue; }
            const url = CFProviderDiagnostics.prepare(row, site, secrets);
            if (url) {
                const groupKey = row[1] + "|" + url;
                if (!groups.has(groupKey) && groups.size >= 4) continue;
                if (!groups.has(groupKey)) groups.set(groupKey, { url, site, rows: [] });
                groups.get(groupKey).rows.push(row);
            }
        }
        publish(rows);
        const start = clock();
        let downloads = 0;
        let lastAlphaRequestEnd = null;
        for (const group of groups.values()) {
            if (clock() - start >= 180000) break;
            if (group.site.siteName === "ALPHAVANTAGE" && lastAlphaRequestEnd !== null) {
                const remaining = 1250 - (clock() - lastAlphaRequestEnd);
                if (remaining > 0) pause(remaining);
            }
            group.rows.forEach(row => { row[4] = "RUNNING"; row[13] = "Direct request in progress."; });
            publish(rows);
            const requestStart = clock();
            try {
                downloads++;
                const response = fetch(group.url, { method: "get", muteHttpExceptions: true, followRedirects: true, timeoutSeconds: 25 });
                const elapsed = clock() - requestStart;
                const retrieved = new Date(clock()).toISOString();
                group.rows.forEach(row => CFProviderDiagnostics.parse(row, group.site, response, elapsed, retrieved, secrets));
            } catch {
                group.rows.forEach(row => { row[4] = "FETCH_ERROR"; row[6] = clock() - requestStart; row[7] = new Date(clock()).toISOString(); row[13] = "Direct request failed. Exception text is omitted to protect credentials."; });
            }
            if (group.site.siteName === "ALPHAVANTAGE") lastAlphaRequestEnd = clock();
            publish(rows);
        }
        return { downloads, pending: rows.filter(row => row[4] === "PENDING" || row[4] === "RUNNING").length };
    }
}

function CFProviderSheet_(book, name) {
    const sheet = book.getSheetByName(name);
    if (sheet && sheet.getLastRow() > 0 && sheet.getRange("A1").getValue() !== CF_PROVIDER_MARKER) throw new Error("The existing " + name + " sheet is not a diagnostic sheet. Rename it before continuing.");
    return sheet || book.insertSheet(name);
}

/** Preserve original timestamp strings; old ambiguous sheet dates need a rerun. */
function CFProviderNormalizeRows_(rows) {
    return rows.map(row => {
        const values = row.slice();
        if (values[7] instanceof Date) values[7] = Number.isFinite(values[7].getTime()) ? values[7].toISOString() : "Unknown";
        if (values[8] instanceof Date) {
            if (!["meta.regularMarketTime", "t", "timestamp", "quote.last_updated"].includes(values[9]) || !Number.isFinite(values[8].getTime())) {
                values[8] = "Unknown";
                values[13] = "Prior sheet date conversion changed provider-local or date-only text. Rerun this provider to restore its source timestamp.";
            } else values[8] = values[8].toISOString();
        }
        return values;
    });
}

function CFProviderWrite_(sheet, rows) {
    if (rows.length) {
        const safeRows = CFProviderNormalizeRows_(rows).map(row => row.map(value => typeof value === "string" && /^[=+@-]/.test(value) ? "'" + value : value));
        sheet.getRange(5, 8, rows.length, 3).setNumberFormat("@");
        sheet.getRange(5, 1, safeRows.length, CF_PROVIDER_HEADERS.length).setValues(safeRows);
        sheet.getRange(5, 7, rows.length, 1).setNumberFormat("0");
    }
    SpreadsheetApp.flush();
}

/** Runs only against the current bound spreadsheet and only our marked sheets. */
function CFProviderRun_(provider, reset) {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    if (!book) throw new Error("Open the bound Google spreadsheet before running this test.");
    const lock = LockService.getDocumentLock();
    if (!lock || !lock.tryLock(1000)) throw new Error("Another provider test is running. Wait for it to finish.");
    try {
        const sheet = CFProviderSheet_(book, CF_PROVIDER_SHEET);
        let rows;
        if (reset || sheet.getLastRow() < 5) {
            const runId = new Date().toISOString() + "-" + Utilities.getUuid().slice(0, 8);
            rows = CFProviderDiagnostics.plan(runId);
            sheet.clearContents();
            sheet.getRange("A1").setValue(CF_PROVIDER_MARKER);
            sheet.getRange("A2").setValue("Run ID"); sheet.getRange("B2").setValue(runId);
            sheet.getRange("A3").setValue("Upstream"); sheet.getRange("B3").setValue(CF_PROVIDER_UPSTREAM);
            sheet.getRange(4, 1, 1, CF_PROVIDER_HEADERS.length).setValues([CF_PROVIDER_HEADERS]);
            sheet.setFrozenRows(4); sheet.getRange(4, 1, 1, CF_PROVIDER_HEADERS.length).setFontWeight("bold");
            sheet.setColumnWidth(2, 180); sheet.setColumnWidth(3, 150); sheet.setColumnWidth(5, 200); sheet.setColumnWidth(14, 440);
        } else {
            rows = sheet.getRange(5, 1, sheet.getLastRow() - 4, CF_PROVIDER_HEADERS.length).getValues();
            // Interrupted requests are not silently retried or counted as a pass.
            rows.filter(row => row[4] === "RUNNING").forEach(row => { row[4] = "INTERRUPTED"; row[13] = "The previous execution ended before recording a response. Rerun this provider."; });
            if (provider) rows.filter(row => row[1] === provider).forEach(row => {
                row.splice(4, 10, "PENDING", "", "", "", "Unknown", "", "", "", "Unknown", "Direct provider rerun; prior values cleared.");
            });
        }
        const selected = provider ? rows.filter(row => row[1] === provider) : rows;
        const result = CFProviderDiagnostics.batch(selected, CFProviderDiagnostics.sites(),
            (url, options) => UrlFetchApp.fetch(url, options), () => CFProviderWrite_(sheet, rows));
        const counts = {};
        rows.forEach(row => { counts[row[4]] = (counts[row[4]] || 0) + 1; });
        const summary = { environment: "Google Apps Script", financialCacheBypassed: true, upstream: CF_PROVIDER_UPSTREAM, runId: rows[0]?.[0], downloadsThisBatch: result.downloads, pending: rows.filter(row => row[4] === "PENDING").length, counts };
        console.log("CF_PROVIDER_SUMMARY " + JSON.stringify(summary));
        book.toast(summary.pending ? "Batch complete. Run ContinueProviderTests for the remaining rows." : "Provider tests complete. Run CFProviderReportJson to export the results.", "CacheFinance tests", 10);
        return summary;
    } finally { lock.releaseLock(); }
}

function CFProviderReportJson() {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    if (!book) throw new Error("Open the bound test spreadsheet first.");
    const source = book.getSheetByName(CF_PROVIDER_SHEET);
    if (!source || source.getRange("A1").getValue() !== CF_PROVIDER_MARKER) throw new Error("Run provider tests first.");
    const rows = source.getLastRow() >= 5 ? source.getRange(5, 1, source.getLastRow() - 4, CF_PROVIDER_HEADERS.length).getValues() : [];
    const secrets = Object.values(CF_PROVIDER_KEYS).map(key => PropertiesService.getScriptProperties().getProperty(key)).filter(Boolean);
    const safeRows = CFProviderNormalizeRows_(rows).map(row => row.map(value => typeof value === "string" ? CFProviderSanitize_(value, secrets) : value));
    const report = { environment: "Google Apps Script", financialCacheBypassed: true, upstream: CF_PROVIDER_UPSTREAM, runId: CFProviderSanitize_(source.getRange("B2").getValue(), secrets), exportedUtc: new Date().toISOString(), headers: CF_PROVIDER_HEADERS, rows: safeRows };
    const json = JSON.stringify(report);
    const sheet = CFProviderSheet_(book, CF_REPORT_SHEET);
    sheet.clearContents(); sheet.getRange("A1").setValue(CF_PROVIDER_MARKER);
    sheet.getRange("A2").setValue("JSON parts: concatenate column B from row 5 without separators.");
    sheet.getRange("A3").setValue(report.runId);
    const chunks = json.match(/[\s\S]{1,40000}/g) || [json];
    sheet.getRange(5, 1, chunks.length, 2).setValues(chunks.map((chunk, index) => [index + 1, chunk]));
    const logParts = json.match(/[\s\S]{1,3000}/g) || [json];
    logParts.forEach((chunk, index) => console.log("CF_PROVIDER_JSON " + (index + 1) + "/" + logParts.length + " " + chunk));
    console.log("CF_PROVIDER_REPORT_COMPLETE " + report.runId);
    return json;
}

/** Worksheet controls do not count as direct provider evidence. */
function SetupProviderWorksheetTests() {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    if (!book) throw new Error("Open the bound test spreadsheet first.");
    const sheet = CFProviderSheet_(book, CF_WORKSHEET_SHEET);
    sheet.clearContents(); sheet.getRange("A1").setValue(CF_PROVIDER_MARKER);
    sheet.getRange("A2").setValue("GOOGLEFINANCE rows are live worksheet checks. CACHEFINANCE rows use supplied controls and make no provider claim.");
    sheet.getRange(4, 1, 1, 6).setValues([["Function", "Symbol", "Attribute", "Result", "Expected", "Status"]]);
    const cases = [
        ["GOOGLEFINANCE", "NASDAQ:AAPL", "PRICE", '=GOOGLEFINANCE("NASDAQ:AAPL","price")', "Positive number", "WAITING"],
        ["GOOGLEFINANCE", "NASDAQ:NVDA", "PRICE", '=GOOGLEFINANCE("NASDAQ:NVDA","price")', "Positive number", "WAITING"],
        ["GOOGLEFINANCE", "TSE:RY", "PRICE", '=GOOGLEFINANCE("TSE:RY","price")', "Positive number", "WAITING"],
        ["GOOGLEFINANCE", "CURRENCY:USDCAD", "PRICE", '=GOOGLEFINANCE("CURRENCY:USDCAD","price")', "Positive number", "WAITING"],
        ["CACHEFINANCE supplied control", "CFTEST:CONTROL_A", "PRICE", '=CACHEFINANCE("CFTEST:CONTROL_A","PRICE",123.45)', 123.45, "WAITING"],
        ["CACHEFINANCES supplied controls", "CFTEST:CONTROL_A", "PRICE", '=CACHEFINANCES({"CFTEST:CONTROL_A";"CFTEST:CONTROL_B"},"PRICE",{123.45;234.56})', 123.45, "WAITING"],
        ["CACHEFINANCES spill row", "CFTEST:CONTROL_B", "PRICE", "", 234.56, "WAITING"]
    ];
    sheet.getRange(5, 1, cases.length, 6).setValues(cases);
    sheet.setFrozenRows(4); sheet.getRange(4, 1, 1, 6).setFontWeight("bold"); sheet.autoResizeColumns(1, 6);
    SpreadsheetApp.flush();
    return "Wait for worksheet formulas to finish, then run CollectProviderWorksheetTests.";
}

function CollectProviderWorksheetTests() {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = book && book.getSheetByName(CF_WORKSHEET_SHEET);
    if (!sheet || sheet.getRange("A1").getValue() !== CF_PROVIDER_MARKER) throw new Error("Run SetupProviderWorksheetTests first.");
    const rows = sheet.getRange(5, 1, 7, 6).getValues();
    const display = sheet.getRange(5, 4, 7, 1).getDisplayValues();
    const results = rows.map((row, index) => {
        const waiting = /loading|calculating/i.test(display[index][0]);
        const okay = index < 4 ? typeof row[3] === "number" && Number.isFinite(row[3]) && row[3] > 0 : row[3] === row[4];
        row[5] = waiting ? "WAITING" : okay ? "PASS" : "FAILED";
        return { function: row[0], symbol: row[1], value: row[3], status: row[5], directProviderEvidence: false };
    });
    sheet.getRange(5, 6, 7, 1).setValues(rows.map(row => [row[5]]));
    console.log("CF_WORKSHEET_RESULTS " + JSON.stringify(results));
    return results;
}
