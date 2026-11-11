import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { YahooFinance } from "../src/CacheFinanceWebSites.js";

const fixture = name => fs.readFileSync(new URL(`./fixtures/yahoo-${name}.html`, import.meta.url), "utf8");
const aapl = fixture("aapl");

describe("Yahoo Finance quote-page fields", () => {
    it.each([
        ["aapl", "NASDAQ:AAPL", "Apple Inc.", 355.63, 0.0031],
        ["nvda", "NASDAQ:NVDA", "NVIDIA Corporation", 173.73, 0.0059],
        ["ry-to", "TSE:RY", "Royal Bank of Canada", 290, 0.0245],
        ["xic-to", "TSE:XIC", "iShares Core S&P/TSX Capped Composite Index ETF", 58.19, 0.0198]
    ])("extracts %s price, name and yield from public HTML excerpts", (name, symbol, stockName, stockPrice, yieldPct) => {
        const result = YahooFinance.parseResponse(fixture(name), symbol);
        expect(result.stockName).toBe(stockName);
        expect(result.stockPrice).toBe(stockPrice);
        expect(result.yieldPct).toBe(yieldPct);
    });

    it("ignores another module's price and yield before the quote's own fields", () => {
        const unrelated = '<span data-testid="qsp-price">999.99</span><li><span title="Yield">Yield</span><span>88.00%</span></li>';
        const result = YahooFinance.parseResponse(unrelated + aapl, "NASDAQ:AAPL");
        expect(result.stockPrice).toBe(355.63);
        expect(result.yieldPct).toBe(0.0031);
    });

    it("does not read an unrelated yield when the quote statistics omit yield", () => {
        const noYield = aapl.replace(/<li[^>]*><span[^>]*title="Forward Dividend &amp; Yield"[\s\S]*?<\/li>/, "");
        const unrelated = '<li><span title="Yield">Yield</span><span>88.00%</span></li>';
        const result = YahooFinance.parseResponse(unrelated + noYield, "NASDAQ:AAPL");
        expect(result.stockPrice).toBe(355.63);
        expect(result.yieldPct).toBeNull();
    });

    it("leaves yield missing if its statistics container disappears", () => {
        const changed = aapl.replace('data-testid="quote-statistics"', 'data-testid="statistics-changed"');
        const unrelated = '<span title="Yield">Yield</span> <span>88.00</span>';
        const result = YahooFinance.parseResponse(unrelated + changed, "NASDAQ:AAPL");
        expect(result.stockPrice).toBe(355.63);
        expect(result.yieldPct).toBeNull();
    });

    it("does not take a related ticker's price if the primary quote-price container disappears", () => {
        const changed = aapl.replace('data-testid="quote-price"', 'data-testid="price-container-changed"');
        const unrelated = '<fin-streamer data-symbol="NVDA" data-testid="qsp-price">999.99</fin-streamer>';
        const result = YahooFinance.parseResponse(unrelated + changed, "NASDAQ:AAPL");
        expect(result.stockName).toBe("Apple Inc.");
        expect(result.stockPrice).toBeNull();
        expect(result.yieldPct).toBe(0.0031);
    });

    it("preserves an explicit zero dividend yield", () => {
        const zero = aapl.replaceAll("1.08 (0.31%)", "0.00 (0.00%)");
        const result = YahooFinance.parseResponse(zero, "NASDAQ:AAPL");
        expect(result.yieldPct).toBe(0);
        expect(result.isAttributeSet("YIELDPCT")).toBe(true);
    });

    it("leaves an unavailable yield missing instead of inventing zero", () => {
        const missing = aapl.replaceAll("1.08 (0.31%)", "--");
        const result = YahooFinance.parseResponse(missing, "NASDAQ:AAPL");
        expect(result.yieldPct).toBeNull();
        expect(result.isAttributeSet("YIELDPCT")).toBe(false);
    });

    it.each(["NASDAQ:ZZZZCFINVALID20261111", "NASDAQ:NVDA", "TSE:AAPL"])("rejects the AAPL quote page for requested %s", symbol => {
        const result = YahooFinance.parseResponse(aapl, symbol);
        expect(result.stockName).toBeNull();
        expect(result.stockPrice).toBeNull();
        expect(result.yieldPct).toBeNull();
    });

    it("matches literal ticker punctuation, including the Canadian suffix", () => {
        const wrong = fixture("ry-to").replace("(RY.TO)", "(RYXTO)");
        expect(YahooFinance.parseResponse(wrong, "TSE:RY").stockName).toBeNull();
    });

    it.each([
        '<title>Symbol Lookup from Yahoo Finance</title><span data-testid="qsp-price">100.00</span>',
        '<title>Yahoo consent page</title><span title="Yield">Yield</span> <span>99.99</span>',
        '<title>Apple <script> (AAPL)</title><span data-testid="qsp-price">100.00</span>',
        "", null
    ])("does not parse quote data from an error, consent or malformed page (%#)", html => {
        const result = YahooFinance.parseResponse(html, "NASDAQ:AAPL");
        expect(result.stockName).toBeNull();
        expect(result.stockPrice).toBeNull();
        expect(result.yieldPct).toBeNull();
    });

    it("leaves changed or nonnumeric price markup missing", () => {
        const changed = aapl.replace('data-testid="qsp-price"', 'data-testid="quote-price-changed"');
        expect(YahooFinance.parseResponse(changed, "NASDAQ:AAPL").stockPrice).toBeNull();
        const unavailable = aapl.replace('data-testid="qsp-price">355.63', 'data-testid="qsp-price">--');
        expect(YahooFinance.parseResponse(unavailable, "NASDAQ:AAPL").stockPrice).toBeNull();
    });

    it("accepts grouped price digits without matching price-change fields", () => {
        const grouped = aapl.replace('data-testid="qsp-price">355.63', 'data-testid="qsp-price">1,355.63');
        expect(YahooFinance.parseResponse(grouped, "NASDAQ:AAPL").stockPrice).toBe(1355.63);
    });
});
