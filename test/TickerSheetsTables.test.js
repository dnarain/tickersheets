import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TickerSheetsTables, TICKERSHEETS_EARNINGS, TICKERSHEETS_QUOTE_COMPARE } from "../src/TickerSheetsTables.js";
import { TickerSheetsPublicData, TICKERSHEETS_QUOTE, TICKERSHEETS_FUNDAMENTALS } from "../src/TickerSheetsFunctions.js";

const fixture = name => fs.readFileSync(new URL("./fixtures/" + name, import.meta.url), "utf8");
const chartBody = fixture("analysis-chart-nvda.json"), detailsBody = fixture("analysis-details-nvda.html");
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
        if (url.startsWith("https://finance.yahoo.com/quote/")) return response(detailsBody);
        if (url.startsWith("https://finviz.com/quote.ashx")) return response(fixture("smf-finviz-nvda.html"));
        if (url.startsWith("https://www.gurufocus.com/stock/NVDA/dividend")) return response(fixture("smf-gurufocus-nvda-faq.html"));
        throw new Error("Unexpected provider route");
    });
    vi.stubGlobal("UrlFetchApp", { fetch });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("formula earnings source sections", () => {
    it("returns the published earnings basis, periods, raw EPS and source", () => {
        const rows = TICKERSHEETS_EARNINGS("NVDA");
        expect(rows[0]).toEqual(["Period", "Basis", "EPS actual", "EPS estimate", "Difference", "Surprise % points", "Reported", "Period end", "Currency", "Source"]);
        expect(rows).toHaveLength(9); expect(rows.every(row => row.length === 10)).toBe(true);
        expect(rows[1].slice(0, 4)).toEqual(["3Q2026", "GAAP", 1.3, 1.19815]);
        expect(rows[1].slice(6)).toEqual(["2025-11-19", "2025-10-31", "USD", "https://finance.yahoo.com/quote/NVDA/"]);
        expect(rows.find(row => row[1] === "Adjusted")[3]).toBe(1.25647);
    });
    it("returns financials and estimates in the existing labeled result formats", () => {
        const financials = TICKERSHEETS_EARNINGS("NVDA", "financials"), estimates = TICKERSHEETS_EARNINGS("NVDA", "estimates");
        expect(financials[0]).toEqual(["Financial period", "Frequency", "Basis", "Revenue", "Net income", "Profit margin", "Currency", "Source"]);
        expect(financials).toHaveLength(17); expect(financials.find(row => row[0] === "2025" && row[2] === "GAAP").slice(3, 5)).toEqual([130497000000, 72880000000]);
        expect(estimates[0]).toEqual(["Estimate period", "Basis", "EPS low", "EPS average", "EPS high", "Revenue low", "Revenue average", "Revenue high", "Currency", "Source"]);
        expect(estimates.length).toBeGreaterThan(1); expect(fetch).toHaveBeenCalledOnce();
    });
    it("uses the shared chart response for dividend and split events without downloading the quote page", () => {
        const dividends = TICKERSHEETS_EARNINGS("NVDA", "dividends"), splits = TICKERSHEETS_EARNINGS("NVDA", "splits");
        expect(dividends[0]).toEqual(["Dividend date", "Amount / share", "Currency", "Source"]);
        expect(dividends[1].slice(0, 3)).toEqual(["2026-10-09", 0, "USD"]);
        expect(splits[0]).toEqual(["Split date", "New shares", "Old shares", "Source"]);
        expect(splits[1].slice(0, 3)).toEqual(["2026-10-09", 10, 1]); expect(fetch).toHaveBeenCalledOnce();
        expect(fetch.mock.calls[0][0]).toContain("/v8/finance/chart/NVDA");
    });
    it("preserves a published zero while marking unavailable numeric fields", () => {
        vi.spyOn(TickerSheetsPublicData, "details").mockReturnValue({ ok: true, source: "https://finance.yahoo.com/quote/NVDA/", details: { earnings: [{ period: "1Q2026", basis: "GAAP", actual: 0, estimate: null, difference: null, surprisePct: null, currency: "USD" }] } });
        const rows = TICKERSHEETS_EARNINGS("NVDA"); expect(rows[1].slice(2, 8)).toEqual([0, "N/A", "N/A", "N/A", "N/A", "N/A"]);
    });
    it("exposes calendar dates and the provider's estimate flag separately", () => {
        const rows = TICKERSHEETS_EARNINGS("NVDA", "calendar"); expect(rows[0]).toEqual(["Field", "Value", "Status", "Source"]);
        expect(rows.find(row => row[0] === "next_earnings_date").slice(1, 3)).toEqual(["2026-11-17", "Available"]);
        expect(rows.find(row => row[0] === "date_status")[1]).toBe("Provider marks confirmed");
    });
    it("keeps an empty section visible without a fabricated zero row", () => {
        vi.spyOn(TickerSheetsPublicData, "details").mockReturnValue({ ok: true, details: { financials: [] } });
        const rows = TICKERSHEETS_EARNINGS("NVDA", "financials"); expect(rows).toHaveLength(2); expect(rows[1]).toHaveLength(8);
        expect(rows[1][0]).toBe("N/A: No financials data returned."); expect(rows[1].slice(1)).toEqual(Array(7).fill("N/A"));
    });
    it("returns fixed errors without exposing request exception text or accessing keys", () => {
        fetch.mockImplementation(() => { throw new Error("private api_key=secret"); });
        const rows = TICKERSHEETS_EARNINGS("NVDA"); expect(rows[1][0]).toMatch(/^N\/A:/); expect(JSON.stringify(rows)).not.toContain("secret"); expect(properties).not.toHaveBeenCalled();
    });
    it.each(["unsupported", "__proto__", {}, null])("rejects an unsupported section before requesting data (%s)", section => {
        expect(TICKERSHEETS_EARNINGS("NVDA", section)).toMatch(/^N\/A:/); expect(fetch).not.toHaveBeenCalled();
    });
    it("escapes a formula-leading provider period", () => {
        vi.spyOn(TickerSheetsPublicData, "details").mockReturnValue({ ok: true, details: { financials: [{ period: "=1+1", revenue: 0 }] } });
        expect(TICKERSHEETS_EARNINGS("NVDA", "financials")[1].slice(0, 4)).toEqual(["'=1+1", "N/A", "N/A", 0]);
    });
});

describe("shared Yahoo page data", () => {
    it.each(["quote first", "fundamentals first", "earnings first"])("shares one quote-page fetch across quote, fundamentals and earnings: %s", order => {
        const calls = { "quote first": () => TICKERSHEETS_QUOTE("NVDA", "price", 4), "fundamentals first": () => TICKERSHEETS_FUNDAMENTALS("NVDA", "trailing_pe", 4), "earnings first": () => TICKERSHEETS_EARNINGS("NVDA", "earnings", 4) };
        calls[order](); expect(TICKERSHEETS_QUOTE("NVDA", "price", 4)).toBe(159.5405);
        expect(TICKERSHEETS_FUNDAMENTALS("NVDA", "trailing_pe", 4)).toBeGreaterThan(0); expect(TICKERSHEETS_EARNINGS("NVDA", "earnings", 4)).toHaveLength(9);
        expect(fetch.mock.calls.filter(([url]) => url.startsWith("https://finance.yahoo.com/quote/"))).toHaveLength(1);
        expect(fetch.mock.calls.filter(([url]) => url.includes("/v8/finance/chart/"))).toHaveLength(1);
    });
    it("preserves the real shared page retrieval time when fundamentals adopt a cached page", () => {
        let now = Date.UTC(2026, 10, 12); const overrides = { clock: () => now };
        const page = TickerSheetsPublicData.quotePage("NVDA", overrides); now += 45000;
        const details = TickerSheetsPublicData.details("NVDA", overrides); expect(details.retrievedAt).toBe(page.retrievedAt); expect(fetch).toHaveBeenCalledOnce();
    });
    it("does not store raw quote-page HTML, unknown payload fields or credentials", () => {
        fetch.mockReturnValue(response(detailsBody + '<script>private_debug_cookie="do-not-store"</script>'));
        TICKERSHEETS_EARNINGS("NVDA"); const cached = [...values.values()].join("");
        expect(cached).not.toMatch(/<script|quoteSummary|private_debug_cookie|do-not-store|api_key|crumb/i); expect(properties).not.toHaveBeenCalled();
    });
});

describe("formula quote comparisons", () => {
    it("returns six identified source/session rows with explicit yield-only and regular-session labels", () => {
        const rows = TICKERSHEETS_QUOTE_COMPARE("NVDA", 3);
        expect(rows[0]).toEqual(["Provider", "Price", "Yield", "Currency", "Identity", "Quote time", "Retrieved at", "Status", "Source", "Note"]);
        expect(rows).toHaveLength(7); expect(rows.every(row => row.length === 10)).toBe(true);
        const selected = name => rows.find(row => row[0] === name);
        expect(selected("Yahoo regular").slice(1, 6)).toEqual([173.73, "N/A", "USD", "Matched", "2026-11-11T21:00:00.000Z"]);
        expect(selected("Yahoo website regular").slice(1, 6)).toEqual([173.73, 0.0058999998, "USD", "Matched", "2026-11-11T21:00:00.000Z"]);
        expect(selected("Yahoo after-hours").slice(1, 6)).toEqual([159.5405, "N/A", "USD", "Matched", "2026-11-12T00:44:09.000Z"]);
        expect(selected("Yahoo pre-market")[7]).toBe("Older than regular quote");
        expect(selected("Finviz").slice(1, 6)).toEqual([173.73, expect.closeTo(.0045, 12), "USD", "Matched", "N/A"]);
        expect(selected("Finviz")[7]).toBe("Available");
        expect(selected("GuruFocus").slice(1, 6)).toEqual(["N/A", expect.closeTo(.0049, 12), "N/A", "Matched", "N/A"]);
        expect(selected("GuruFocus")[7]).toBe("Yield only"); expect(selected("GuruFocus")[9]).toContain("no spot price");
        expect(rows.every(row => row[0] !== "Zacks")).toBe(true);
        expect(fetch).toHaveBeenCalledTimes(4); expect(properties).not.toHaveBeenCalled();
        expect(TICKERSHEETS_QUOTE_COMPARE("NVDA", 3)).toEqual(rows);
        TICKERSHEETS_QUOTE("NVDA", "price", 3); TICKERSHEETS_FUNDAMENTALS("NVDA", "trailing_pe", 3); TICKERSHEETS_EARNINGS("NVDA", "earnings", 3);
        expect(fetch).toHaveBeenCalledTimes(4);
        expect(fetch.mock.calls.every(([url]) => ["query1.finance.yahoo.com", "finance.yahoo.com", "finviz.com", "www.gurufocus.com"].includes(new URL(url).hostname))).toBe(true);
    });
    it("does not substitute another ticker's Finviz price", () => {
        const original = fetch.getMockImplementation();
        fetch.mockImplementation(url => url.startsWith("https://finviz.com/") ? response(fixture("smf-finviz-nvda.html").replaceAll("NVDA", "AAPL")) : original(url));
        const row = TICKERSHEETS_QUOTE_COMPARE("NVDA").find(value => value[0] === "Finviz");
        expect(row[1]).toBe("N/A"); expect(row[2]).toBe("N/A"); expect(row[4]).toBe("Unknown"); expect(row[7]).toBe("Data unavailable");
    });
    it("rejects a mismatched cached provider identity without accepting its numeric fields", () => {
        vi.spyOn(TickerSheetsPublicData, "provider").mockReturnValue({ ok: true, symbol: "AAPL", identity: "Matched", status: "Available",
            fields: { price: { value: 999, unit: "currency", currency: "USD" }, forward_dividend_yield: { value: .99, unit: "fraction" } } });
        const row = TICKERSHEETS_QUOTE_COMPARE("NVDA").find(value => value[0] === "Finviz");
        expect(row.slice(1, 5)).toEqual(["N/A", "N/A", "N/A", "Mismatch"]); expect(row[7]).toBe("Ticker mismatch");
    });
    it("preserves zero forward yield and never substitutes a trailing yield or analyst target", () => {
        const actual = TickerSheetsPublicData.provider.bind(TickerSheetsPublicData);
        vi.spyOn(TickerSheetsPublicData, "provider").mockImplementation((provider, ...args) => {
            const result = actual(provider, ...args);
            if (provider === "FINVIZ") result.fields.forward_dividend_yield.value = 0;
            else { result.fields.forward_dividend_yield.value = null; result.fields.trailing_dividend_yield.value = .03; }
            return result;
        });
        const rows = TICKERSHEETS_QUOTE_COMPARE("NVDA");
        expect(rows.find(row => row[0] === "Finviz")[2]).toBe(0);
        const guru = rows.find(row => row[0] === "GuruFocus");
        expect(guru[1]).toBe("N/A"); expect(guru[2]).toBe("N/A"); expect(guru[7]).toBe("Price/yield unavailable");
        expect(guru[9]).toContain("Forward dividend yield unavailable"); expect(fetch.mock.calls.some(([url]) => /zacks/i.test(url))).toBe(false);
    });
    it("reports blocked provider access without leaking response or exception bodies", () => {
        const original = fetch.getMockImplementation();
        fetch.mockImplementation(url => url.startsWith("https://finviz.com/") ? response("api_key=private", 403) : original(url));
        const rows = TICKERSHEETS_QUOTE_COMPARE("NVDA"), row = rows.find(value => value[0] === "Finviz");
        expect(row[1]).toBe("N/A"); expect(row[7]).toBe("HTTP 403"); expect(JSON.stringify(rows)).not.toContain("private");
        expect(rows.find(value => value[0] === "GuruFocus")[7]).toBe("Yield only");
    });
    it("keeps accepted Yahoo rows when another provider throws", () => {
        vi.spyOn(TickerSheetsPublicData, "provider").mockImplementation(() => { throw Error("private request body"); });
        const rows = TICKERSHEETS_QUOTE_COMPARE("NVDA");
        expect(rows.find(row => row[0] === "Yahoo regular")[1]).toBe(173.73);
        expect(rows.find(row => row[0] === "Finviz")[7]).toBe("Request failed"); expect(JSON.stringify(rows)).not.toContain("private");
    });
    it("rejects an unsafe ticker without requesting a provider", () => {
        expect(TICKERSHEETS_QUOTE_COMPARE("=1+1")).toMatch(/^N\/A:/); expect(fetch).not.toHaveBeenCalled();
    });
    it("does not require a chart exchange alias for an independently supported US provider route", () => {
        const payload = JSON.parse(chartEvents()); payload.chart.result[0].meta.exchangeName = "UNKNOWN";
        const original = fetch.getMockImplementation(); fetch.mockImplementation(url => url.includes("/v8/finance/chart/") ? response(JSON.stringify(payload)) : original(url));
        const rows = TICKERSHEETS_QUOTE_COMPARE("NVDA");
        expect(rows.find(row => row[0] === "Finviz")[1]).toBe(173.73); expect(fetch).toHaveBeenCalledTimes(4);
    });
    it("keeps unsupported foreign provider routes explicit without requesting those pages", () => {
        const payload = JSON.parse(chartEvents()); Object.assign(payload.chart.result[0].meta, { symbol: "RY.TO", exchangeName: "TOR", currency: "CAD" });
        fetch.mockImplementation(url => response(url.includes("/v8/finance/chart/") ? JSON.stringify(payload) : detailsBody));
        const rows = TICKERSHEETS_QUOTE_COMPARE("TSE:RY");
        expect(rows.find(row => row[0] === "Finviz")[7]).toBe("Unsupported ticker");
        expect(rows.find(row => row[0] === "GuruFocus")[7]).toBe("Unsupported ticker"); expect(fetch).toHaveBeenCalledTimes(2);
    });
});
