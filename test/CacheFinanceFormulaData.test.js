import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CFFormulaData, CFEARNINGS, CFQUOTECOMPARE } from "../src/CacheFinanceFormulaData.js";
import { CFPublicData, CFQUOTE, CFFUNDAMENTALS } from "../src/CacheFinanceResearchFunctions.js";

const fixture = name => fs.readFileSync(new URL("./fixtures/" + name, import.meta.url), "utf8");
const chartBody = fixture("analysis-chart-nvda.json"), detailsBody = fixture("analysis-details-nvda.html");
const visiblePrice = '<section data-testid="quote-price"><span data-testid="qsp-price">173.74</span></section><div data-testid="quote-statistics"><ul><li title="Forward Dividend &amp; Yield">0.00 (0.00%)</li></ul></div>';
const response = (body, status = 200) => ({ getResponseCode: () => status, getContentText: () => body });
function chartEvents() {
    const payload = JSON.parse(chartBody);
    payload.chart.result[0].events = { dividends: { a: { date: 1791547200, amount: 0 } }, splits: { a: { date: 1791547200, numerator: 10, denominator: 1, splitRatio: "10:1" } } };
    return JSON.stringify(payload);
}
let values, fetch, properties;
beforeEach(() => {
    values = new Map();
    vi.stubGlobal("CacheService", { getScriptCache: () => ({ get: key => values.get(key) || null, put: (key, value) => values.set(key, value) }) });
    properties = vi.fn(() => { throw new Error("private-key-must-not-be-read"); });
    vi.stubGlobal("PropertiesService", { getScriptProperties: properties });
    fetch = vi.fn(url => {
        if (url.startsWith("https://query1.finance.yahoo.com/v8/finance/chart/")) return response(chartEvents());
        if (url.startsWith("https://finance.yahoo.com/quote/")) return response(detailsBody + visiblePrice);
        if (url.startsWith("https://www.google.com/finance/quote/")) return response(fixture("google-nvda.html"));
        if (url.startsWith("https://www.theglobeandmail.com/")) return response(fixture("globe-nvda-20261111.html"));
        throw new Error("Unexpected provider route");
    });
    vi.stubGlobal("UrlFetchApp", { fetch });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("formula earnings source sections", () => {
    it("returns the published earnings basis, periods, raw EPS and source", () => {
        const rows = CFEARNINGS("NVDA");
        expect(rows[0]).toEqual(["Period", "Basis", "EPS actual", "EPS estimate", "Difference", "Surprise % points", "Reported", "Period end", "Currency", "Source"]);
        expect(rows).toHaveLength(9); expect(rows.every(row => row.length === 10)).toBe(true);
        expect(rows[1].slice(0, 4)).toEqual(["3Q2026", "GAAP", 1.3, 1.19815]);
        expect(rows[1].slice(6)).toEqual(["2025-11-19", "2025-10-31", "USD", "https://finance.yahoo.com/quote/NVDA/"]);
        expect(rows.find(row => row[1] === "Adjusted")[3]).toBe(1.25647);
    });
    it("returns financials and estimates in the existing labeled result formats", () => {
        const financials = CFEARNINGS("NVDA", "financials"), estimates = CFEARNINGS("NVDA", "estimates");
        expect(financials[0]).toEqual(["Financial period", "Frequency", "Basis", "Revenue", "Net income", "Profit margin", "Currency", "Source"]);
        expect(financials).toHaveLength(17); expect(financials.find(row => row[0] === "2025" && row[2] === "GAAP").slice(3, 5)).toEqual([130497000000, 72880000000]);
        expect(estimates[0]).toEqual(["Estimate period", "Basis", "EPS low", "EPS average", "EPS high", "Revenue low", "Revenue average", "Revenue high", "Currency", "Source"]);
        expect(estimates.length).toBeGreaterThan(1); expect(fetch).toHaveBeenCalledOnce();
    });
    it("uses the shared chart response for dividend and split events without downloading the quote page", () => {
        const dividends = CFEARNINGS("NVDA", "dividends"), splits = CFEARNINGS("NVDA", "splits");
        expect(dividends[0]).toEqual(["Dividend date", "Amount / share", "Currency", "Source"]);
        expect(dividends[1].slice(0, 3)).toEqual(["2026-10-09", 0, "USD"]);
        expect(splits[0]).toEqual(["Split date", "New shares", "Old shares", "Source"]);
        expect(splits[1].slice(0, 3)).toEqual(["2026-10-09", 10, 1]); expect(fetch).toHaveBeenCalledOnce();
        expect(fetch.mock.calls[0][0]).toContain("/v8/finance/chart/NVDA");
    });
    it("preserves a published zero while marking unavailable numeric fields", () => {
        vi.spyOn(CFPublicData, "details").mockReturnValue({ ok: true, source: "https://finance.yahoo.com/quote/NVDA/", details: { earnings: [{ period: "1Q2026", basis: "GAAP", actual: 0, estimate: null, difference: null, surprisePct: null, currency: "USD" }] } });
        const rows = CFEARNINGS("NVDA"); expect(rows[1].slice(2, 8)).toEqual([0, "N/A", "N/A", "N/A", "N/A", "N/A"]);
    });
    it("exposes calendar dates and the provider's estimate flag separately", () => {
        const rows = CFEARNINGS("NVDA", "calendar"); expect(rows[0]).toEqual(["Field", "Value", "Status", "Source"]);
        expect(rows.find(row => row[0] === "next_earnings_date").slice(1, 3)).toEqual(["2026-11-17", "Available"]);
        expect(rows.find(row => row[0] === "date_status")[1]).toBe("Provider marks confirmed");
    });
    it("keeps an empty section visible without a fabricated zero row", () => {
        vi.spyOn(CFPublicData, "details").mockReturnValue({ ok: true, details: { financials: [] } });
        const rows = CFEARNINGS("NVDA", "financials"); expect(rows).toHaveLength(2); expect(rows[1]).toHaveLength(8);
        expect(rows[1][0]).toBe("N/A: No financials data returned."); expect(rows[1].slice(1)).toEqual(Array(7).fill("N/A"));
    });
    it("returns fixed errors without exposing request exception text or accessing keys", () => {
        fetch.mockImplementation(() => { throw new Error("private api_key=secret"); });
        const rows = CFEARNINGS("NVDA"); expect(rows[1][0]).toMatch(/^N\/A:/); expect(JSON.stringify(rows)).not.toContain("secret"); expect(properties).not.toHaveBeenCalled();
    });
    it.each(["unsupported", "__proto__", {}, null])("rejects an unsupported section before requesting data (%s)", section => {
        expect(CFEARNINGS("NVDA", section)).toMatch(/^N\/A:/); expect(fetch).not.toHaveBeenCalled();
    });
    it("escapes a formula-leading provider period", () => {
        vi.spyOn(CFPublicData, "details").mockReturnValue({ ok: true, details: { financials: [{ period: "=1+1", revenue: 0 }] } });
        expect(CFEARNINGS("NVDA", "financials")[1].slice(0, 4)).toEqual(["'=1+1", "N/A", "N/A", 0]);
    });
});

describe("shared Yahoo page data", () => {
    it.each(["quote first", "fundamentals first", "earnings first"])("shares one quote-page fetch across quote, fundamentals and earnings: %s", order => {
        const calls = { "quote first": () => CFQUOTE("NVDA", "price", 4), "fundamentals first": () => CFFUNDAMENTALS("NVDA", "trailing_pe", 4), "earnings first": () => CFEARNINGS("NVDA", "earnings", 4) };
        calls[order](); expect(CFQUOTE("NVDA", "price", 4)).toBe(159.5405);
        expect(CFFUNDAMENTALS("NVDA", "trailing_pe", 4)).toBeGreaterThan(0); expect(CFEARNINGS("NVDA", "earnings", 4)).toHaveLength(9);
        expect(fetch.mock.calls.filter(([url]) => url.startsWith("https://finance.yahoo.com/quote/"))).toHaveLength(1);
        expect(fetch.mock.calls.filter(([url]) => url.includes("/v8/finance/chart/"))).toHaveLength(1);
    });
    it("preserves the real shared page retrieval time when fundamentals adopt a cached page", () => {
        let now = Date.UTC(2026, 10, 12); const overrides = { clock: () => now };
        const page = CFPublicData.quotePage("NVDA", overrides); now += 45000;
        const details = CFPublicData.details("NVDA", overrides); expect(details.retrievedAt).toBe(page.retrievedAt); expect(fetch).toHaveBeenCalledOnce();
    });
    it("does not store raw quote-page HTML, unknown payload fields or credentials", () => {
        fetch.mockReturnValue(response(detailsBody + '<script>private_debug_cookie="do-not-store"</script>'));
        CFEARNINGS("NVDA"); const cached = [...values.values()].join("");
        expect(cached).not.toMatch(/<script|quoteSummary|private_debug_cookie|do-not-store|api_key|crumb/i); expect(properties).not.toHaveBeenCalled();
    });
});

describe("formula quote comparisons", () => {
    it("returns six identified provider/session rows with separate observation and retrieval times", () => {
        const rows = CFQUOTECOMPARE("NVDA", 3);
        expect(rows[0]).toEqual(["Provider", "Price", "Yield", "Currency", "Identity", "Quote time", "Retrieved at", "Status", "Source", "Note"]);
        expect(rows).toHaveLength(7); expect(rows.every(row => row.length === 10)).toBe(true);
        const selected = name => rows.find(row => row[0] === name);
        expect(selected("Yahoo regular").slice(1, 6)).toEqual([173.73, "N/A", "USD", "Matched", "2026-11-11T21:00:00.000Z"]);
        expect(selected("Yahoo Finance").slice(1, 6)).toEqual([173.74, 0, "USD", "Name matched", "N/A"]);
        expect(selected("Yahoo after-hours").slice(1, 6)).toEqual([159.5405, "N/A", "USD", "Matched", "2026-11-12T00:44:09.000Z"]);
        expect(selected("Yahoo pre-market")[7]).toBe("Older than regular quote");
        expect(selected("Google Finance").slice(1, 6)).toEqual([173.73, 0.0058, "USD", "Matched", "N/A"]);
        expect(selected("Globe & Mail").slice(1, 6)).toEqual([173.73, 0.003, "USD", "Matched", "2026-11-11T21:39:00.000Z"]);
        expect(fetch).toHaveBeenCalledTimes(4); expect(properties).not.toHaveBeenCalled();
        expect(CFQUOTECOMPARE("NVDA", 3)).toEqual(rows); CFQUOTE("NVDA", "price", 3); CFFUNDAMENTALS("NVDA", "trailing_pe", 3); CFEARNINGS("NVDA", "earnings", 3);
        expect(fetch).toHaveBeenCalledTimes(4);
    });
    it("does not substitute another ticker's comparison price", () => {
        const original = fetch.getMockImplementation(); fetch.mockImplementation(url => url.startsWith("https://www.google.com/") ? response(fixture("google-aapl.html")) : original(url));
        const row = CFQUOTECOMPARE("NVDA").find(value => value[0] === "Google Finance");
        expect(row[1]).toBe("N/A"); expect(row[4]).toBe("Mismatch"); expect(row[5]).toBe("N/A"); expect(row[7]).toBe("Data unavailable");
    });
    it("does not invent a Google or Globe currency when matched public markup omits it", () => {
        const original = fetch.getMockImplementation(); fetch.mockImplementation(url => {
            const value = original(url).getContentText();
            return response(url.startsWith("https://www.google.com/") ? value.replace('0,"USD",[173.73', '0,null,[173.73') : url.startsWith("https://www.theglobeandmail.com/") ? value.replaceAll('"symbolCurrency":"USD"', '"symbolCurrency":null') : value);
        });
        const rows = CFQUOTECOMPARE("NVDA"); expect(rows.find(row => row[0] === "Google Finance")[3]).toBe("N/A"); expect(rows.find(row => row[0] === "Globe & Mail")[3]).toBe("N/A");
    });
    it("reports HTTP failures without leaking response or exception bodies", () => {
        const original = fetch.getMockImplementation(); fetch.mockImplementation(url => url.startsWith("https://www.google.com/") ? response("api_key=private", 403) : original(url));
        const rows = CFQUOTECOMPARE("NVDA"), row = rows.find(value => value[0] === "Google Finance");
        expect(row[1]).toBe("N/A"); expect(row[7]).toBe("HTTP 403"); expect(JSON.stringify(rows)).not.toContain("private");
    });
    it("rejects an unsafe ticker without requesting a provider", () => {
        expect(CFQUOTECOMPARE("=1+1")).toMatch(/^N\/A:/); expect(fetch).not.toHaveBeenCalled();
    });
    it("keeps unsupported comparison routes explicit when Yahoo does not identify a supported exchange", () => {
        const payload = JSON.parse(chartEvents()); payload.chart.result[0].meta.exchangeName = "UNKNOWN";
        const original = fetch.getMockImplementation(); fetch.mockImplementation(url => url.includes("/v8/finance/chart/") ? response(JSON.stringify(payload)) : original(url));
        const rows = CFQUOTECOMPARE("NVDA"); expect(rows.find(row => row[0] === "Google Finance")[7]).toBe("Unsupported ticker"); expect(fetch).toHaveBeenCalledTimes(2);
    });
});
