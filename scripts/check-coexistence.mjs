import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { buildTickerSheetsBundle, PUBLIC_FUNCTIONS } from "./gas-source.mjs";
import { CacheService, PropertiesService } from "../test/helpers/AppsScriptServices.js";

/** Check a separately downloaded upstream bundle without copying it into this repository. */
export function checkCoexistence(upstreamPath) {
    const upstream = fs.readFileSync(upstreamPath, "utf8"), ours = buildTickerSheetsBundle().bundle;
    const chart = fs.readFileSync(new URL("../test/fixtures/analysis-chart-nvda.json", import.meta.url), "utf8");
    const details = fs.readFileSync(new URL("../test/fixtures/analysis-details-nvda.html", import.meta.url), "utf8");
    const result = [];
    for (const order of ["TickerSheets first", "CacheFinance first"]) {
        CacheService.reset(); PropertiesService.reset();
        let requests = 0;
        const globals = { console: { log() {} }, Logger: { log() {} }, CacheService, PropertiesService,
            UrlFetchApp: { fetch(url) {
                requests++;
                const body = url.includes("/v8/finance/chart/") ? chart : url.startsWith("https://finance.yahoo.com/quote/") ? details : null;
                if (body === null) throw new Error("Unexpected provider request in compatibility check");
                return { getResponseCode: () => 200, getContentText: () => body };
            } } };
        const combined = order === "TickerSheets first" ? ours + "\n" + upstream : upstream + "\n" + ours;
        const api = vm.runInNewContext(combined + "\n;({ CACHEFINANCE, CACHEFINANCES, " + PUBLIC_FUNCTIONS.join(",") + " });", globals);
        for (const name of ["CACHEFINANCE", "CACHEFINANCES", ...PUBLIC_FUNCTIONS]) assert.equal(typeof api[name], "function", name);
        assert.equal(api.CACHEFINANCE("NASDAQ:AAPL", "price", 123.45), 123.45);
        assert.deepEqual(JSON.parse(JSON.stringify(api.CACHEFINANCES([["NASDAQ:AAPL"]], "price", [[123.45]]))), [[123.45]]);
        assert.equal(requests, 0, "CacheFinance should accept the supplied current quote without a request");
        assert.equal(api.TICKERSHEETS_QUOTE("NVDA", "price"), 159.5405);
        assert.equal(api.TICKERSHEETS_HISTORY("NVDA", 1)[1][0], "2026-11-11");
        assert.equal(api.TICKERSHEETS_FUNDAMENTALS("NVDA", "eps_ttm"), 7.91);
        assert.equal(requests, 2, "TickerSheets should share its chart and page cache");
        assert.equal(api.CACHEFINANCE("NASDAQ:AAPL", "price", 125), 125);
        assert.equal(requests, 2);
        result.push({ order, functions: PUBLIC_FUNCTIONS.length + 2, requests, passed: true });
    }
    return { passed: true, upstreamSha256: crypto.createHash("sha256").update(upstream).digest("hex"), cases: result };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    if (!process.argv[2]) throw new Error("Usage: npm run check:coexistence -- /path/to/separately-downloaded/CacheFinance.js");
    console.log(JSON.stringify(checkCoexistence(process.argv[2]), null, 2));
}
