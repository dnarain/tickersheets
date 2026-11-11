import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import * as runner from "../src/CacheFinanceProviderTests.js";
import { CFProviderDiagnostics as D } from "../src/CacheFinanceProviderTests.js";
import { PropertiesService } from "../src/GasMocks.js";
import { FinanceWebSites } from "../src/CacheFinanceWebSites.js";

const upstream = "8f84e202e0c5d56f27b2bf000bb86817c3503894";
const marker = "CacheFinance provider diagnostics v1";
const row = (provider = "YAHOOAPI", symbol = "NASDAQ:AAPL", attribute = "PRICE") => ["test-run", provider, symbol, attribute, "PENDING", "", "", "", "Unknown", "", "", "", "Unknown", ""];
const response = (body = "{}", code = 200) => ({ getResponseCode: () => code, getContentText: () => body });
const site = (name = "YAHOOAPI", value = 12.34, extra = {}) => ({ siteName: name, siteObject: {
    getApiKey: () => "", getURL: symbol => "https://example.test/quote/" + symbol,
    parseResponse: () => ({ getValue: () => value }), ...extra
} });

class Sheet {
    constructor(name) { this.name = name; this.values = []; this.events = []; }
    getRange(a, b, h = 1, w = 1) {
        let r = a, c = b;
        if (typeof a === "string") {
            const m = a.match(/^([A-Z]+)(\d+)$/); r = Number(m[2]); c = [...m[1]].reduce((n, char) => n * 26 + char.charCodeAt(0) - 64, 0);
        }
        const sheet = this;
        const api = {
            setValues(values) { sheet.events.push({ method: "setValues", r, c, h, w }); values.forEach((line, i) => line.forEach((value, j) => { sheet.values[r - 1 + i] ||= []; sheet.values[r - 1 + i][c - 1 + j] = value; })); return api; },
            getValues() { return Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => sheet.values[r - 1 + i]?.[c - 1 + j] ?? "")); },
            getDisplayValues() { return api.getValues().map(line => line.map(String)); },
            setValue(value) { return api.setValues([[value]]); }, getValue() { return api.getValues()[0][0]; },
            setNumberFormat(format) { sheet.events.push({ method: "setNumberFormat", r, c, h, w, format }); return api; }, setFontWeight() { return api; }
        };
        return api;
    }
    clearContents() { this.values = []; }
    getLastRow() { return this.values.length; }
    setFrozenRows() {}
    setColumnWidth() {}
    autoResizeColumns() {}
}

let sheets, book, lock, fetch, log;
beforeEach(() => {
    sheets = new Map();
    book = { getSheetByName: name => sheets.get(name), insertSheet: name => { const sheet = new Sheet(name); sheets.set(name, sheet); return sheet; }, toast: vi.fn() };
    lock = { tryLock: vi.fn(() => true), releaseLock: vi.fn() };
    fetch = vi.fn(() => response());
    globalThis.SpreadsheetApp = { getActiveSpreadsheet: () => book, flush: vi.fn(), getUi: () => ({ createMenu: () => menu }) };
    globalThis.LockService = { getDocumentLock: () => lock };
    globalThis.Utilities = { getUuid: () => "01234567-abcdef", sleep: vi.fn() };
    globalThis.UrlFetchApp = { fetch };
    log = vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
const menu = { addItem() { return this; }, addSeparator() { return this; }, addToUi: vi.fn() };

function runRows(rows, provider = site(), fetched = response(), publish = vi.fn()) {
    const directFetch = vi.fn(() => fetched);
    const result = D.batch(rows, [provider], directFetch, publish, () => 100000);
    return { result, directFetch, publish };
}

describe("direct provider evidence", () => {
    it("downloads a shared provider URL once for price and name without using financial caches", () => {
        const rows = [row(), row("YAHOOAPI", "NASDAQ:AAPL", "NAME")];
        const provider = site("YAHOOAPI", null, { parseResponse: () => ({ getValue: attr => attr === "PRICE" ? 123.45 : "Apple Inc." }) });
        const { result, directFetch, publish } = runRows(rows, provider);
        expect(result.downloads).toBe(1); expect(directFetch).toHaveBeenCalledTimes(1);
        expect(rows.map(item => item[4])).toEqual(["PARSED", "PARSED"]);
        expect(rows.map(item => item[10])).toEqual([123.45, "Apple Inc."]);
        expect(publish).toHaveBeenCalled();
    });
    it("stops after four distinct URLs and leaves the next URL pending", () => {
        const rows = Array.from({ length: 5 }, (_, i) => row("YAHOOAPI", "NASDAQ:S" + i));
        const { result } = runRows(rows);
        expect(result).toEqual({ downloads: 4, pending: 1 }); expect(rows[4][4]).toBe("PENDING");
    });
    it("skips missing API keys before issuing requests and distinguishes unsupported fields", () => {
        const rows = [row("FINNHUB"), row("FINNHUB", "NASDAQ:AAPL", "NAME"), row("FINNHUB", "TSE:RY")];
        const { directFetch } = runRows(rows, site("FINNHUB"));
        expect(directFetch).not.toHaveBeenCalled();
        expect(rows.map(item => item[4])).toEqual(["KEY_REQUIRED", "UNSUPPORTED_ATTRIBUTE", "UNSUPPORTED_SYMBOL"]);
    });
    it("uses a supplied key only in the private request, excluding it from output and logs", () => {
        const rows = [row("FINNHUB")];
        const secret = "secret-key-123";
        const provider = site("FINNHUB", "Apple " + secret, { getApiKey: () => secret, getURL: () => "https://example.test/quote?token=" + secret, parseResponse: () => ({ getValue: () => 12.34 }) });
        const { directFetch } = runRows(rows, provider);
        expect(directFetch.mock.calls[0][0]).toContain(secret);
        expect(rows[0][11]).toBe("https://example.test/quote"); expect(JSON.stringify(rows)).not.toContain(secret);
        expect(log.mock.calls.flat().join("")).not.toContain(secret);
    });
    it.each([401, 403, 404, 500])("does not accept HTTP %s even when its body includes a price", code => {
        const parser = vi.fn(() => ({ getValue: () => 123 })); const rows = [row()];
        runRows(rows, site("YAHOOAPI", null, { parseResponse: parser }), response('{"price":123}', code));
        expect(rows[0][4]).toBe("HTTP_ERROR"); expect(rows[0][5]).toBe(code); expect(parser).not.toHaveBeenCalled();
    });
    it("separately reports HTTP429 and malformed parser results", () => {
        const rows = [row()]; runRows(rows, site(), response("", 429)); expect(rows[0][4]).toBe("RATE_LIMITED");
        const bad = [row()]; runRows(bad, site("YAHOOAPI", null, { parseResponse: () => { throw new Error("key=private"); } }));
        expect(bad[0][4]).toBe("PARSE_ERROR"); expect(JSON.stringify(bad)).not.toContain("private");
    });
    it("does not treat HTTP200 with missing data as a working provider", () => {
        const rows = [row()]; runRows(rows, site("YAHOOAPI", null));
        expect(rows[0][4]).toBe("MISSING_VALUE");
    });
    it.each([NaN, Infinity, 0, -1, "123", undefined, null])("rejects an invalid price %s", value => expect(D.validValue("PRICE", value)).toBe(false));
    it.each([undefined, null, "", " ", "Access denied", "Just a moment", "Google Finance</title><script>", "<div>Apple Inc.</div>"]) ("rejects invalid company name %s", value => expect(D.validValue("NAME", value)).toBe(false));
    it("accepts an explicit zero yield but rejects missing and NaN yields", () => {
        expect(D.validValue("YIELDPCT", 0)).toBe(true); expect(D.validValue("YIELDPCT", null)).toBe(false); expect(D.validValue("YIELDPCT", NaN)).toBe(false);
    });
    it("bounds each direct request to twenty-five seconds", () => {
        const { directFetch } = runRows([row()]);
        expect(directFetch.mock.calls[0][1]).toMatchObject({ timeoutSeconds: 25, muteHttpExceptions: true });
    });
    it("checks invalid tickers without accepting unrelated generic data", () => {
        const invalid = "NASDAQ:ZZZZCFINVALID20261111";
        const positive = [row("YAHOOAPI", invalid)]; runRows(positive);
        expect(positive[0][4]).toBe("NEGATIVE_FALSE_POSITIVE");
        const missing = [row("YAHOOAPI", invalid)]; runRows(missing, site("YAHOOAPI", null));
        expect(missing[0][4]).toBe("NEGATIVE_REJECTED");
        const rejected = [row("YAHOOAPI", invalid)]; runRows(rejected, site(), response("", 404));
        expect(rejected[0][4]).toBe("NEGATIVE_REJECTED");
        const blocked = [row("YAHOOAPI", invalid)]; runRows(blocked, site(), response("", 403));
        expect(blocked[0][4]).toBe("HTTP_ERROR");
    });
    it("rejects the wrong company name and records a matching parsed name", () => {
        const wrong = [row("GOOGLEWEBSITEFINANCE", "NASDAQ:AAPL", "NAME")];
        runRows(wrong, site("GOOGLEWEBSITEFINANCE", null, { parseResponse: () => ({ getValue: () => "Microsoft Corporation" }) }));
        expect(wrong[0][4]).toBe("IDENTITY_MISMATCH"); expect(wrong[0][12]).toBe("Name mismatch");
        const right = [row("GOOGLEWEBSITEFINANCE", "NASDAQ:AAPL", "NAME")];
        runRows(right, site("GOOGLEWEBSITEFINANCE", null, { parseResponse: () => ({ getValue: () => "Apple Inc." }) }));
        expect(right[0][4]).toBe("PARSED"); expect(right[0][12]).toBe("Name matched");
    });
    it("marks Google currency name and yield as unsupported without network", () => {
        const rows = [row("GOOGLEWEBSITEFINANCE", "CURRENCY:USDCAD", "NAME"), row("GOOGLEWEBSITEFINANCE", "CURRENCY:USDCAD", "YIELDPCT")];
        const { directFetch } = runRows(rows, site("GOOGLEWEBSITEFINANCE"));
        expect(rows.every(item => item[4] === "UNSUPPORTED_ATTRIBUTE")).toBe(true); expect(directFetch).not.toHaveBeenCalled();
    });
    it("paces only distinct Alpha Vantage requests and does not repeat shared field downloads", () => {
        const rows = [row("ALPHAVANTAGE"), row("ALPHAVANTAGE", "NASDAQ:NVDA"), row("ALPHAVANTAGE", "CURRENCY:USDCAD")];
        const provider = site("ALPHAVANTAGE", 12.34, { getApiKey: () => "test-key" });
        let now = 0; const starts = []; const pauses = [];
        D.batch(rows, [provider], () => { starts.push(now); return response(); }, () => {}, () => now, ms => { pauses.push(ms); now += ms; });
        expect(starts).toEqual([0, 1250, 2500]); expect(pauses).toEqual([1250, 1250]);
        const publicPause = vi.fn();
        D.batch([row(), row("YAHOOAPI", "NASDAQ:NVDA")], [site()], () => response(), () => {}, () => 0, publicPause);
        expect(publicPause).not.toHaveBeenCalled();
    });
    it("does not add Alpha pacing after another provider already consumed the gap", () => {
        const rows = [row("ALPHAVANTAGE"), row(), row("ALPHAVANTAGE", "NASDAQ:NVDA")];
        let now = 0; const pauses = vi.fn();
        const alpha = site("ALPHAVANTAGE", 1, { getApiKey: () => "test-key" });
        D.batch(rows, [alpha, site()], () => { now += 2000; return response(); }, () => {}, () => now, pauses);
        expect(pauses).not.toHaveBeenCalled();
    });
    it.each([
        '{"Note":"secret-token https://example.test?apikey=secret-token"}',
        '{"Information":"private account limit text"}',
        '{"Error Message":"private provider error"}',
        '{"status":"error","message":"private provider error"}'
    ])("records a fixed safe note for a JSON provider message", body => {
        const rows = [row("ALPHAVANTAGE")];
        runRows(rows, site("ALPHAVANTAGE", null, { getApiKey: () => "secret-token" }), response(body));
        expect(rows[0][4]).toBe("MISSING_VALUE");
        expect(rows[0][13]).toBe("Provider error or limit message present; no valid value accepted.");
        expect(JSON.stringify(rows)).not.toMatch(/secret-token|private provider error|private account limit/);
        expect(log.mock.calls.flat().join("")).not.toContain("secret-token");
    });
    it("does not classify a normal JSON message or HTML body as a provider error message", () => {
        for (const body of ['{"status":"ok","message":"Thank you"}', "<html>Information</html>", "null"]) {
            expect(D.providerErrorMessagePresent(body)).toBe(false);
        }
        const rows = [row("ALPHAVANTAGE")];
        runRows(rows, site("ALPHAVANTAGE", 123, { getApiKey: () => "test-key" }), response('{"Information":"informational response"}'));
        expect(rows[0][4]).toBe("PARSED");
    });
    it("records only safe categorical text for fetch exceptions", () => {
        const rows = [row()]; D.batch(rows, [site()], () => { throw new Error("https://secret.test/?token=abc"); }, () => {}, () => 100000);
        expect(rows[0][4]).toBe("FETCH_ERROR"); expect(JSON.stringify(rows)).not.toContain("secret.test"); expect(rows[0][7]).toBe("1970-01-01T00:01:40.000Z");
    });
    it("rejects a returned Yahoo symbol mismatch", () => {
        const rows = [row()]; runRows(rows, site(), response('{"chart":{"result":[{"meta":{"symbol":"MSFT","regularMarketTime":100}}]}}'));
        expect(rows[0][4]).toBe("IDENTITY_MISMATCH"); expect(rows[0][12]).toBe("Mismatch"); expect(rows[0][10]).toBe("");
    });
    it("retains matched Yahoo quote time separately from retrieval time", () => {
        const rows = [row()]; runRows(rows, site(), response('{"chart":{"result":[{"meta":{"symbol":"AAPL","regularMarketTime":100}}]}}'));
        expect(rows[0][12]).toBe("Matched"); expect(rows[0][8]).toBe("1970-01-01T00:01:40.000Z"); expect(rows[0][7]).toBe("1970-01-01T00:01:40.000Z");
        expect(rows[0][9]).toBe("meta.regularMarketTime");
    });
    it("leaves unavailable HTML quote time and identity Unknown", () => {
        const rows = [row("YAHOO")]; runRows(rows, site("YAHOO"), response("<html>Apple</html>"));
        expect(rows[0][4]).toBe("PARSED"); expect(rows[0][8]).toBe("Unknown"); expect(rows[0][12]).toBe("Unknown");
    });
    it("classifies empty URLs, configuration errors and unknown registry entries without requests", () => {
        const rows = [row()]; const { directFetch } = runRows(rows, site("YAHOOAPI", 1, { getURL: () => "" }));
        expect(rows[0][4]).toBe("UNSUPPORTED_COMBINATION"); expect(directFetch).not.toHaveBeenCalled();
        for (const extra of [{ getURL: () => { throw new Error("secret"); } }, { getURL: () => "http://invalid.test" }, { getApiKey: () => { throw new Error("secret"); } }]) {
            const bad = [row()]; runRows(bad, site("YAHOOAPI", 1, extra)); expect(bad[0][4]).toBe("CONFIG_ERROR");
        }
        const unknown = [row("OTHER")]; runRows(unknown); expect(unknown[0][4]).toBe("CONFIG_ERROR");
    });
    it("stops starting requests after its three-minute batch budget", () => {
        const rows = [row(), row("YAHOOAPI", "NASDAQ:NVDA")]; let calls = 0;
        const download = vi.fn(() => response());
        D.batch(rows, [site()], download, () => {}, () => calls++ === 0 ? 0 : 180000);
        expect(download).not.toHaveBeenCalled(); expect(rows.every(item => item[4] === "PENDING")).toBe(true);
    });
});

describe("metadata and secret handling", () => {
    it.each([
        ["GOOGLEWEBSITEFINANCE", "google-ry.html", "TSE:RY", "PRICE", "PARSED", 290, "Matched"],
        ["GOOGLEWEBSITEFINANCE", "google-ry.html", "TSE:RY", "YIELDPCT", "PARSED", 0.0243, "Matched"],
        ["GOOGLEWEBSITEFINANCE", "google-usdcad.html", "CURRENCY:USDCAD", "PRICE", "PARSED", 1.4251, "Matched"],
        ["GOOGLEWEBSITEFINANCE", "google-xic.html", "TSE:XIC", "YIELDPCT", "MISSING_VALUE", "", "Matched"],
        ["GOOGLEWEBSITEFINANCE", "google-invalid.html", "NASDAQ:ZZZZCFINVALID20261111", "NAME", "NEGATIVE_REJECTED", "", "Mismatch"],
        ["YAHOO", "yahoo-ry-to.html", "TSE:RY", "YIELDPCT", "PARSED", 0.0245, "Name matched"]
    ])("classifies the repaired %s %s field through the diagnostic writer", (provider, file, symbol, attribute, status, value, identity) => {
        const item = row(provider, symbol, attribute);
        const html = fs.readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8");
        D.parse(item, new FinanceWebSites().getByName(provider), response(html), 10, "2026-11-11T20:00:00Z", []);
        expect(item[4]).toBe(status); expect(item[10]).toBe(value); expect(item[12]).toBe(identity);
    });
    it("redacts plain and percent-encoded API keys and removes URLs", () => {
        const secret = "private+key";
        expect(runner.CFProviderSanitize_(secret + " " + encodeURIComponent(secret) + " https://example.test?k=x", [secret])).toBe("[REDACTED] [REDACTED] [URL]");
    });
    it.each([
        ["FINNHUB", '{"t":100}', "NASDAQ:AAPL", "1970-01-01T00:01:40.000Z", "t"],
        ["TWELVEDATA", '{"datetime":"2026-11-11 12:00:00"}', "NASDAQ:AAPL", "2026-11-11 12:00:00", "datetime (provider timezone)"],
        ["ALPHAVANTAGE", '{"Global Quote":{"07. latest trading day":"2026-11-11"}}', "NASDAQ:AAPL", "2026-11-11", "latest trading day (date only)"],
        ["ALPHAVANTAGE", '{"Realtime Currency Exchange Rate":{"6. Last Refreshed":"2026-11-11 12:00"}}', "CURRENCY:USDCAD", "2026-11-11 12:00", "Last Refreshed (provider timezone)"],
        ["COINMARKET", '{"data":{"BTC":{"quote":{"USD":{"last_updated":"2026-11-11T12:00:00Z"}}}}}', "CURRENCY:BTCUSD", "2026-11-11T12:00:00Z", "quote.last_updated"]
    ])("extracts %s timestamp without treating it as retrieval time", (provider, body, symbol, timestamp, field) => {
        expect(D.sourceDetails(provider, body, symbol)).toMatchObject({ timestamp, field });
    });
    it("tests all eight registered adapters without claiming unsupported attributes work", () => {
        const plan = D.plan("test"); expect(new Set(plan.map(item => item[1])).size).toBe(8);
        expect(plan.some(item => item[2] === "CF:DYN2752")).toBe(true); expect(plan.some(item => item[2] === "CURRENCY:BTCUSD")).toBe(true);
        expect(D.unsupported("GOOGLEWEBSITEFINANCE", "NASDAQ:AAPL", "YIELDPCT")).toBe("UNSUPPORTED_ATTRIBUTE");
    });
    it("builds a standalone current-document diagnostic bundle with no upstream raw logging", () => {
        const bundle = fs.readFileSync(new URL("../dist/CacheFinanceProviderTests.js", import.meta.url), "utf8");
        expect(bundle).toContain("@OnlyCurrentDoc"); expect(bundle).toContain("function RunProviderTests()"); expect(bundle).toContain(upstream);
        expect(bundle).not.toMatch(/\bLogger\.log\(/); expect(bundle).not.toMatch(/^\s*(import|export)\s/m);
        expect(bundle).not.toContain("SpreadsheetApp.create("); expect(bundle).not.toContain("DriveApp");
    });
});

describe("bound-sheet execution and report", () => {
    it("refuses standalone context and concurrent test runs", () => {
        globalThis.SpreadsheetApp.getActiveSpreadsheet = () => null;
        expect(() => runner.RunProviderTests()).toThrow("bound Google spreadsheet");
        globalThis.SpreadsheetApp.getActiveSpreadsheet = () => book; lock.tryLock.mockReturnValue(false);
        expect(() => runner.RunProviderTests()).toThrow("Another provider test"); expect(fetch).not.toHaveBeenCalled();
    });
    it("does not overwrite a user's unrelated same-name sheet", () => {
        const existing = book.insertSheet("CF Provider tests"); existing.getRange("A1").setValue("User data");
        expect(() => runner.RunProviderTests()).toThrow("not a diagnostic sheet"); expect(existing.getRange("A1").getValue()).toBe("User data"); expect(lock.releaseLock).toHaveBeenCalled();
    });
    it("persists direct outcomes, exports valid JSON, and keeps API keys out of report and logs", () => {
        vi.spyOn(D, "sites").mockReturnValue([site()]);
        const summary = runner.RunProviderTests(); expect(summary.environment).toBe("Google Apps Script"); expect(summary.financialCacheBypassed).toBe(true);
        const source = sheets.get("CF Provider tests"); expect(source.getRange("A1").getValue()).toBe(marker); expect(source.getRange("B3").getValue()).toBe(upstream);
        PropertiesService.getScriptProperties().setProperty("FINNHUB_API_KEY", "test-secret"); source.getRange("N5").setValue("test-secret https://private.test/?token=test-secret");
        const json = runner.CFProviderReportJson(); expect(() => JSON.parse(json)).not.toThrow(); expect(json).not.toContain("test-secret"); expect(json).not.toContain("private.test");
        expect(log.mock.calls.flat().join("")).not.toContain("test-secret"); expect(sheets.get("CF Test report").getRange("B5").getValue()).toBe(json);
    });
    it("marks interrupted requests and reruns only the selected provider", () => {
        vi.spyOn(D, "sites").mockReturnValue([site(), site("YAHOO")]); runner.RunProviderTests();
        const source = sheets.get("CF Provider tests"); source.getRange("E5").setValue("RUNNING");
        runner.ContinueProviderTests(); expect(source.getRange("E5").getValue()).toBe("INTERRUPTED");
        fetch.mockClear(); runner.RunProviderYahooApi(); expect(source.getRange("E5").getValue()).toBe("PARSED");
        expect(fetch.mock.calls.every(call => call[0].startsWith("https://example.test/quote/"))).toBe(true);
    });
    it.each([
        ["RunProviderGoogle", "GOOGLEWEBSITEFINANCE"], ["RunProviderGlobe", "GLOBE"], ["RunProviderYahoo", "YAHOO"],
        ["RunProviderFinnhub", "FINNHUB"], ["RunProviderTwelveData", "TWELVEDATA"], ["RunProviderAlphaVantage", "ALPHAVANTAGE"], ["RunProviderCoinMarket", "COINMARKET"]
    ])("routes %s to its provider", (entry, name) => {
        vi.spyOn(D, "sites").mockReturnValue([site(name)]); const summary = runner[entry](); expect(summary.runId).toBeTruthy();
        const source = sheets.get("CF Provider tests"); expect(source.getRange("B5").getValue()).toBe(name);
    });
    it("adds menu and keeps worksheet control results separate from direct provider evidence", () => {
        runner.CFProviderTestMenu_(); expect(menu.addToUi).toHaveBeenCalled(); runner.SetupProviderWorksheetTests();
        const sheet = sheets.get("CF Worksheet tests"); expect(sheet.getRange("D9").getValue()).toBe('=CACHEFINANCE("CFTEST:CONTROL_A","PRICE",123.45)');
        [123, "Loading...", "#N/A", 1.4, 123.45, 123.45, 234.56].forEach((value, index) => sheet.getRange(5 + index, 4).setValue(value));
        const results = runner.CollectProviderWorksheetTests(); expect(results.map(item => item.status)).toEqual(["PASS", "WAITING", "FAILED", "PASS", "PASS", "PASS", "PASS"]);
        expect(results.every(item => item.directProviderEvidence === false)).toBe(true); expect(fetch).not.toHaveBeenCalled();
    });
    it("sets timestamp columns to plain text before writing original provider date strings", () => {
        const sheet = new Sheet("CF Provider tests"); const rows = [row("ALPHAVANTAGE"), row("ALPHAVANTAGE", "CURRENCY:USDCAD")];
        rows[0][7] = "2026-11-11T20:14:54.000Z"; rows[0][8] = "2026-11-10"; rows[0][9] = "latest trading day (date only)";
        rows[1][7] = "2026-11-11T20:14:54.000Z"; rows[1][8] = "2026-11-11 20:14:54"; rows[1][9] = "Last Refreshed (provider timezone)";
        runner.CFProviderWrite_(sheet, rows);
        expect(sheet.events[0]).toEqual({ method: "setNumberFormat", r: 5, c: 8, h: 2, w: 3, format: "@" });
        expect(sheet.events[1].method).toBe("setValues");
        expect(sheet.getRange(5, 8, 2, 3).getValues()).toEqual(rows.map(item => item.slice(7, 10)));
        expect(rows[0][8]).toBe("2026-11-10"); expect(rows[1][8]).toBe("2026-11-11 20:14:54");
    });
    it("normalizes only unambiguous legacy Date timestamps and flags provider-local dates for rerun", () => {
        const retrieved = new Date("2026-11-11T20:14:54.000Z");
        const rows = [row("FINNHUB"), row("ALPHAVANTAGE"), row("ALPHAVANTAGE", "CURRENCY:USDCAD"), row("YAHOO")];
        rows.forEach(item => { item[7] = retrieved; item[8] = new Date("2026-11-10T08:00:00.000Z"); });
        rows[0][9] = "t"; rows[1][9] = "latest trading day (date only)"; rows[2][9] = "Last Refreshed (provider timezone)";
        const normalized = runner.CFProviderNormalizeRows_(rows);
        expect(normalized.every(item => item[7] === retrieved.toISOString())).toBe(true);
        expect(normalized[0][8]).toBe("2026-11-10T08:00:00.000Z");
        expect(normalized.slice(1).every(item => item[8] === "Unknown" && item[13].includes("Rerun this provider"))).toBe(true);
        expect(rows[1][8]).toBeInstanceOf(Date);
    });
    it("preserves Globe's explicit Unix trade time if Sheets previously converted it to a Date", () => {
        const item = row("GLOBE");
        item[8] = new Date("2026-11-11T20:14:54.000Z"); item[9] = "quote.raw.tradeTime";
        expect(runner.CFProviderNormalizeRows_([item])[0][8]).toBe("2026-11-11T20:14:54.000Z");
    });
    it("exports legacy Dates without inventing UTC times for Alpha date-only or naive timestamps", () => {
        vi.spyOn(D, "sites").mockReturnValue([site()]); runner.RunProviderTests();
        const source = sheets.get("CF Provider tests");
        source.getRange("H5").setValue(new Date("2026-11-11T20:14:54.000Z"));
        source.getRange("I5").setValue(new Date("2026-11-10T08:00:00.000Z"));
        source.getRange("J5").setValue("latest trading day (date only)");
        const report = JSON.parse(runner.CFProviderReportJson());
        expect(report.rows[0][7]).toBe("2026-11-11T20:14:54.000Z"); expect(report.rows[0][8]).toBe("Unknown");
        expect(report.rows[0][13]).toContain("Rerun this provider");
    });
    it("requires initialized worksheets and provider results before export", () => {
        expect(() => runner.CFProviderReportJson()).toThrow("Run provider tests first"); expect(() => runner.CollectProviderWorksheetTests()).toThrow("Run SetupProviderWorksheetTests first");
    });
});
