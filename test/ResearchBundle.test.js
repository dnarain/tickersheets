import fs from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { buildCacheFinanceBundle } from "../scripts/gas-source.mjs";

const chart = fs.readFileSync(new URL("./fixtures/analysis-chart-nvda.json", import.meta.url), "utf8");
const details = fs.readFileSync(new URL("./fixtures/analysis-details-nvda.html", import.meta.url), "utf8");
const finviz = fs.readFileSync(new URL("./fixtures/smf-finviz-nvda.html", import.meta.url), "utf8");
const fredKey = "b".repeat(32);
function runtime() {
    const values = new Map(), menuItems = [], logs = [], requests = [];
    const cache = { get: key => values.get(key) ?? null, put: (key, value) => values.set(key, value) };
    const reply = (body, http = 200, headers = {}) => ({ getResponseCode: () => http, getContentText: () => body, getAllHeaders: () => headers });
    const expiry = Date.UTC(2026, 10, 20) / 1000, later = Date.UTC(2026, 11, 18) / 1000;
    const contract = (type, strike) => ({ contractSymbol: "NVDA261120" + type + String(strike * 1000).padStart(8, "0"), strike, expiration: expiry, contractSize: "REGULAR", bid: 4, ask: 4.2, lastPrice: 4.1, impliedVolatility: .4, volume: 0, openInterest: 100, lastTradeDate: 1794430800 });
    const optionPayload = JSON.stringify({ optionChain: { result: [{ underlyingSymbol: "NVDA", quote: { symbol: "NVDA", regularMarketPrice: 173.73, regularMarketTime: 1794430800 }, expirationDates: [expiry, later], options: [{ expirationDate: expiry, calls: [contract("C", 175)], puts: [contract("P", 175)] }] }], error: null } });
    const fetch = vi.fn((url, options) => {
        requests.push({ url, options });
        if (url === "https://fc.yahoo.com") return reply("", 404, { "Set-Cookie": "A3=anonymous-cookie-value; Domain=.yahoo.com; Path=/; Secure" });
        if (url.includes("/v1/test/getcrumb")) return reply("anonymous-crumb-value");
        if (url.includes("/v7/finance/options/")) return reply(optionPayload);
        if (url.includes("/v8/finance/chart/")) return reply(chart);
        if (url.startsWith("https://finance.yahoo.com/quote/")) return reply(details);
        if (url.startsWith("https://finviz.com/")) return reply(finviz);
        if (url.startsWith("https://api.stlouisfed.org/fred/series/observations?")) return reply(JSON.stringify({ units: "lin", observations: [{ date: "2026-11-09", value: "3.88" }] }));
        if (url.startsWith("https://api.stlouisfed.org/fred/series?")) return reply(JSON.stringify({ seriess: [{ id: "DGS2", title: "2-year Treasury yield", units: "Percent", frequency: "Daily", seasonal_adjustment: "Not Seasonally Adjusted" }] }));
        return reply("", 404);
    });
    const menu = name => ({ addItem(label, callback) { menuItems.push({ menu: name, label, callback }); return this; }, addSeparator() { return this; }, addToUi() { return this; } });
    const globals = { console: { log: value => logs.push(value) }, Logger: { log: value => logs.push(value) }, CacheService: { getScriptCache: () => cache }, UrlFetchApp: { fetch },
        PropertiesService: { getScriptProperties: () => ({ getProperty: name => name === "FRED_API_KEY" ? fredKey : null }) },
        SpreadsheetApp: { getUi: () => ({ createMenu: menu }) } };
    const { bundle } = buildCacheFinanceBundle();
    const bindings = vm.runInNewContext(bundle + ";({ CFQUOTE, CFHISTORY, CFFUNDAMENTALS, CFOPTIONS, CFEXPIRATIONS, CFFRED, CFFREDVALUE, CFRSITARGETS, CFFIELD, CFDATASTATUS, CFSTRATEGY, CFOPTIONMODEL, CACHEFINANCE, CACHEFINANCES, CFAnalysisService, CFPublicData, CFAnalysisStrategies, CFSmfProviders, CFFunctionExamples, CFWatchlist, onOpen, hasCallback: name => typeof globalThis[name] === 'function' });", globals);
    return { bindings, values, fetch, menuItems, logs, requests, bundle };
}

describe("research features in the generated Apps Script bundle", () => {
    it("compiles all modules without test imports and resolves every menu callback", () => {
        const run = runtime();
        for (const name of ["CFQUOTE", "CFHISTORY", "CFFUNDAMENTALS", "CFOPTIONS", "CFEXPIRATIONS", "CFFRED", "CFFREDVALUE", "CFRSITARGETS", "CFFIELD", "CFDATASTATUS", "CFSTRATEGY", "CFOPTIONMODEL", "CACHEFINANCE", "CACHEFINANCES"]) expect(typeof run.bindings[name]).toBe("function");
        expect(run.bundle).toContain("@OnlyCurrentDoc"); expect(run.bundle).not.toMatch(/^\s*(?:import|export)\s/m);
        run.bindings.onOpen(); expect(run.menuItems.some(item => item.callback === "CFRefreshWatchlist")).toBe(true); expect(run.menuItems.some(item => item.callback === "CFBuildFormulaExamples")).toBe(true);
        expect(run.menuItems.every(item => run.bindings.hasCallback(item.callback))).toBe(true);
        expect(run.fetch).not.toHaveBeenCalled();
    });
    it("uses global quote, history, fundamentals and provider bindings with a shared public cache", () => {
        const { bindings: b, fetch } = runtime();
        expect(b.CFQUOTE("NVDA")).toBe(159.5405); expect(b.CFQUOTE("NVDA", "price_session")).toBe("After-hours"); expect(b.CFQUOTE("NVDA", "regular_price")).toBe(173.73);
        expect(b.CFHISTORY("NVDA", 1)[1][0]).toBe("2026-11-11"); expect(fetch).toHaveBeenCalledTimes(2);
        expect(b.CFFUNDAMENTALS("NVDA", "trailing_pe")).toBeCloseTo(21.96, 1); expect(b.CFFIELD("FINVIZ", "NVDA", 4074)).toBe(173.73);
        expect(b.CFDATASTATUS("NVDA", "provider", "FINVIZ")[1][0]).toBe("Available"); expect(fetch).toHaveBeenCalledTimes(4);
    });
    it("runs the anonymous option flow and excludes session values from returned/cached data", () => {
        const { bindings: b, values, requests, logs } = runtime();
        expect(b.CFEXPIRATIONS("NVDA")).toEqual([["Expiration"], ["2026-11-20"], ["2026-12-18"]]);
        const rows = b.CFOPTIONS("NVDA"); expect(rows).toHaveLength(3); expect(rows[1][8]).toBe(0); expect(rows[1][7]).toBe(.4);
        expect(requests).toHaveLength(3); expect(requests[2].url).toContain("crumb=anonymous-crumb-value"); expect(requests[2].options.headers.Cookie).toContain("anonymous-cookie-value");
        const saved = [...values.values()].join(""); expect(saved).not.toMatch(/anonymous-cookie-value|anonymous-crumb-value|api_key/); expect(JSON.stringify(rows)).not.toMatch(/anonymous-cookie-value|anonymous-crumb-value/); expect(logs.join("|")).not.toMatch(/anonymous-cookie-value|anonymous-crumb-value/);
    });
    it("looks up a generic FRED series with published units and keeps its private key out of outputs/cache", () => {
        const { bindings: b, values, requests, logs } = runtime();
        expect(b.CFFRED("DGS2", 1)).toEqual([["Date", "Value", "Unit", "Series", "Source"], ["2026-11-09", 3.88, "Percent", "DGS2", "https://fred.stlouisfed.org/series/DGS2"]]);
        expect(requests).toHaveLength(2); expect(requests[0].url).toContain(fredKey); expect([...values.values()].join("|")).not.toContain(fredKey); expect(logs.join("|")).not.toContain(fredKey);
    });
    it("connects exact-date FRED and RSI2 headers in the single-file Apps Script runtime", () => {
        const { bindings: b, values, requests, fetch } = runtime();
        expect(b.CFRSITARGETS("NVDA", 20, 80, "headers")[0]).toHaveLength(12); expect(fetch).not.toHaveBeenCalled();
        expect(b.CFFREDVALUE("DGS2", "2026-11-09")).toBe(3.88);
        expect(requests[1].url).toContain("observation_start=2026-11-09&observation_end=2026-11-09");
        expect([...values.values()].join("|")).not.toContain(fredKey);
    });
    it("connects the real strategy model and Black–Scholes function to public formulas", () => {
        const { bindings: b } = runtime();
        expect(b.CFSTRATEGY("Covered call", 100, "N/A", "N/A", 105, 2, 1, 100, "2026-11-20", "maxProfit")).toBe(700);
        expect(b.CFSTRATEGY("Covered call", 100, "N/A", "N/A", 105, 2, 1, 100, "2026-11-20", "maxLoss")).toBe(9800);
        expect(b.CFSTRATEGY("Cash-secured put", 100, "N/A", "N/A", 100, 3, 1, 100, "2026-11-20", "collateral")).toBe(10000);
        expect(b.CFSTRATEGY("Call vertical", 100, 100, 8, 110, 3, 1, 100, "2026-11-20", "breakeven")).toBe(105);
        expect(b.CFSTRATEGY("Put vertical", 100, 110, 8, 100, 3, 1, 100, "2026-11-20", "payoff", 105)).toBe(0);
        const premium = b.CFOPTIONMODEL(100, 100, 30, .25, .04, 0, "Call", "price"); expect(typeof premium).toBe("number"); expect(premium).toBeGreaterThan(0);
    });
    it("keeps unsupported fields and malformed refresh values out of the network path", () => {
        const { bindings: b, fetch } = runtime();
        expect(b.CFFIELD("FINVIZ", "NVDA", "unknown")).toMatch(/Unsupported provider field/); expect(b.CFQUOTE("NVDA", "price", 2147483648)).toMatch(/whole refresh number/); expect(fetch).not.toHaveBeenCalled();
        expect(b.CFFunctionExamples.catalog().map(row => row[0])).toContain("CFSTRATEGY"); expect(b.CFSmfProviders.resolveField("ZACKS", 849)).toBe("target_price");
    });
});
