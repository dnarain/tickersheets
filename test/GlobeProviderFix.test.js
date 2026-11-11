import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { GlobeAndMail } from "../src/CacheFinanceWebSites.js";
import { UrlFetchApp } from "../src/GasMocks.js";

const fixture = name => fs.readFileSync(new URL(`./fixtures/globe-${name}-20261111.html`, import.meta.url), "utf8");
const nvda = fixture("nvda");
const aapl = fixture("aapl");
const fund = fixture("fund");
const parsed = html => GlobeAndMail.parseResponse(html, "NASDAQ:NVDA");
const quote = (symbol, name, price, rawSymbol = symbol, time = 1794433140) =>
    `<a quote='${JSON.stringify({ symbol, symbolName: name, lastPrice: price, raw: { symbol: rawSymbol, lastPrice: price, tradeTime: time } })}'></a>`;
const page = body => '<link rel="canonical" href="https://www.theglobeandmail.com/investing/markets/stocks/NVDA-Q/">' + body;
const field = (symbol, name, value) => `<barchart-field symbol="${symbol}" name="${name}" value="${value}"></barchart-field>`;

describe("Globe requested-instrument parsing", () => {
    it("extracts the captured NVDA quote and preserves the provider's own 0.30% yield", () => {
        const data = parsed(nvda);
        expect(data.stockName).toBe("Nvidia Corp");
        expect(data.stockPrice).toBe(173.73);
        expect(data.yieldPct).toBe(0.003);
        expect(GlobeAndMail.sourceDetails(nvda, "NASDAQ:NVDA")).toEqual({
            timestamp: new Date(1794433140 * 1000).toISOString(), field: "quote.raw.tradeTime", identity: "Matched"
        });
    });

    it("reads the captured AAPL quote without borrowing NVDA fields", () => {
        const data = GlobeAndMail.parseResponse(aapl, "NASDAQ:AAPL");
        expect(data.stockName).toBe("Apple Inc"); expect(data.stockPrice).toBe(355.63); expect(data.yieldPct).toBe(0.003);
        expect(parsed(aapl).stockPrice).toBe(null);
        expect(GlobeAndMail.sourceDetails(aapl, "NASDAQ:NVDA").identity).toBe("Mismatch");
    });

    it("binds the captured mutual fund quote, distribution yield and timestamp to DYN2752.CF", () => {
        const data = GlobeAndMail.parseResponse(fund, "CF:DYN2752");
        expect(data.stockName).toBe("Dynamic Ultra Short Term Bond FundFh U$");
        expect(data.stockPrice).toBe(10.4); expect(data.yieldPct).toBe(0.0201);
        expect(GlobeAndMail.sourceDetails(fund, "CF:DYN2752")).toEqual({
            timestamp: new Date(1794358800 * 1000).toISOString(), field: "quote.raw.tradeTime", identity: "Matched"
        });
    });

    it("ignores unrelated quote objects and earlier yield markers", () => {
        const decoy = quote("AAPL-Q", "Apple Inc", 999, "AAPL", 123) + field("AAPL", "dividendYieldTrailing", "88.00%");
        const data = parsed(decoy + nvda);
        expect(data.stockName).toBe("Nvidia Corp"); expect(data.stockPrice).toBe(173.73); expect(data.yieldPct).toBe(0.003);
        expect(GlobeAndMail.sourceDetails(decoy + nvda, "NASDAQ:NVDA").timestamp).toBe(new Date(1794433140 * 1000).toISOString());
    });

    it("does not borrow another stock's yield when the requested yield is absent", () => {
        const data = parsed(page(quote("NVDA-Q", "Nvidia Corp", 173.73, "NVDA") + field("AAPL", "dividendYieldTrailing", "88%")));
        expect(data.stockPrice).toBe(173.73); expect(data.yieldPct).toBe(null);
    });

    it("accepts an explicit zero yield from the selected symbol", () => {
        const data = parsed(page(quote("NVDA-Q", "Nvidia Corp", 173.73, "NVDA") + field("NVDA", "dividendYieldTrailing", "0.00%")));
        expect(data.yieldPct).toBe(0);
    });

    it.each(["", "-", "N/A", "1.23% extra", "NaN%", "Infinity%", "-1%"])("keeps an invalid or missing yield unavailable: %s", value => {
        const data = parsed(page(quote("NVDA-Q", "Nvidia Corp", 173.73, "NVDA") + field("NVDA", "dividendYieldTrailing", value)));
        expect(data.yieldPct).toBe(null);
    });

    it("does not let a yield marker borrow a following tag's value", () => {
        const body = quote("NVDA-Q", "Nvidia Corp", 173.73, "NVDA") +
            '<barchart-field symbol="NVDA" name="dividendYieldTrailing"></barchart-field>' + field("NVDA", "differentField", "92%");
        expect(parsed(page(body)).yieldPct).toBe(null);
    });

    it("rejects a matching related quote when the primary page identifies another instrument", () => {
        const wrongPage = aapl + quote("NVDA-Q", "Nvidia Corp", 173.73, "NVDA") + field("NVDA", "dividendYieldTrailing", "0.30%");
        const data = parsed(wrongPage);
        expect([data.stockName, data.stockPrice, data.yieldPct]).toEqual([null, null, null]);
        expect(GlobeAndMail.sourceDetails(wrongPage, "NASDAQ:NVDA")).toEqual({ timestamp: "Unknown", field: "", identity: "Mismatch" });
    });

    it("rejects unbound, malformed and absent quote records", () => {
        for (const html of [quote("NVDA-Q", "Nvidia Corp", 173.73), page(quote("AAPL-Q", "Apple Inc", 999)), page("<a quote='{broken}'></a>"), ""] ) {
            const data = parsed(html); expect([data.stockName, data.stockPrice, data.yieldPct]).toEqual([null, null, null]);
            expect(GlobeAndMail.sourceDetails(html, "NASDAQ:NVDA").timestamp).toBe("Unknown");
        }
        expect(GlobeAndMail.parseResponse(nvda).stockPrice).toBe(null);
    });

    it("does not borrow a price or timestamp when the matching quote lacks them", () => {
        const html = page(quote("AAPL-Q", "Apple Inc", 999, "AAPL", 123) + quote("NVDA-Q", "Nvidia Corp", undefined, "NVDA", null));
        const data = parsed(html); expect(data.stockName).toBe("Nvidia Corp"); expect(data.stockPrice).toBe(null);
        expect(GlobeAndMail.sourceDetails(html, "NASDAQ:NVDA")).toEqual({ timestamp: "Unknown", field: "", identity: "Matched" });
    });

    it.each([0, -1, "123abc", "N/A", null])("keeps invalid quote prices unavailable: %s", price => {
        expect(parsed(page(quote("NVDA-Q", "Nvidia Corp", price, "NVDA"))).stockPrice).toBe(null);
    });

    it("supports HTML-encoded quote attributes, attribute order and decoded names", () => {
        const json = JSON.stringify({ symbol: "NVDA-Q", symbolName: "Nvidia &amp; Corp", lastPrice: 173.73 });
        const html = '<link href="https://www.theglobeandmail.com/investing/markets/stocks/NVDA-Q/" rel="canonical">' +
            '<a quote="' + json.replaceAll('"', "&quot;") + '"></a>' + '<barchart-field value="0.30%" name="dividendYieldTrailing" symbol="NVDA-Q">';
        const data = parsed(html); expect(data.stockName).toBe("Nvidia & Corp"); expect(data.stockPrice).toBe(173.73); expect(data.yieldPct).toBe(0.003);
    });
    it("does not return markup hidden behind nested name entities", () => {
        expect(parsed(page(quote("NVDA-Q", "&amp;lt;script&amp;gt;", 173.73, "NVDA"))).stockName).toBeNull();
    });

    it("does not make a request for unsupported fields or malformed symbols", () => {
        for (const [symbol, attr] of [["CURRENCY:USDCAD", "PRICE"], ["NASDAQ:NVDA", "PE"], ["", "PRICE"], ["INVALID:NVDA", "PRICE"], ["NASDAQ:AAPL?secret", "PRICE"]]) {
            expect(GlobeAndMail.getURL(symbol, attr)).toBe("");
            expect(GlobeAndMail.getInfo(symbol, attr).stockPrice).toBe(null);
        }
    });

    it("uses the same bound parser through getInfo", () => {
        UrlFetchApp.mockResponse(GlobeAndMail.getURL("NASDAQ:NVDA", "PRICE"), nvda);
        expect(GlobeAndMail.getInfo("NASDAQ:NVDA", "PRICE").stockPrice).toBe(173.73);
    });
});
