import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    AlphaVantage,
    CoinMarket,
    FinnHub,
    StockAttributes,
    TwelveData,
    YahooFinance
} from "../src/CacheFinanceWebSites.js";
import { FinanceWebsiteSearch, StockWebURL } from "../src/CacheFinance3rdParty.js";
import { PropertiesService, UrlFetchApp } from "../src/GasMocks.js";

const key = "unit-key-do-not-log-123";
const bodyMarker = "RAW_PROVIDER_BODY_DO_NOT_LOG";
const nameMarker = "PROVIDER_NAME_DO_NOT_LOG";
let log;

beforeEach(() => {
    log = vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function expectNoSensitiveLogs() {
    const messages = log.mock.calls.flat().join("\n");
    expect(messages).not.toContain(key);
    expect(messages).not.toContain(bodyMarker);
    expect(messages).not.toContain(nameMarker);
    expect(messages).not.toMatch(/https?:\/\//);
}

describe("provider logging", () => {
    it.each([
        [FinnHub, "FINNHUB_API_KEY", "NASDAQ:AAPL", "PRICE", { c: 123.456, debug: bodyMarker }, 123.46],
        [AlphaVantage, "ALPHA_VANTAGE_API_KEY", "NASDAQ:AAPL", "PRICE", { "Global Quote": { "05. price": "123.456" }, debug: bodyMarker }, 123.46],
        [AlphaVantage, "ALPHA_VANTAGE_API_KEY", "CURRENCY:USDCAD", "PRICE", { "Realtime Currency Exchange Rate": { "5. Exchange Rate": "1.23456" }, debug: bodyMarker }, 1.2346],
        [TwelveData, "TWELVE_DATA_API_KEY", "NASDAQ:AAPL", "NAME", { name: nameMarker, close: "123.456", debug: bodyMarker }, nameMarker],
        [CoinMarket, "COINMARKET_API_KEY", "CURRENCY:BTCUSD", "NAME", { data: { BTC: { name: nameMarker, quote: { USD: { price: 123.45678 } } } }, debug: bodyMarker }, nameMarker]
    ])("keeps %s request and response data out of logs without changing parsed results", (provider, property, symbol, attribute, body, expected) => {
        PropertiesService.getScriptProperties().setProperty(property, key);
        const url = provider.getURL(symbol, attribute, key);
        expect(url).toContain(key);
        UrlFetchApp.mockResponse(url, JSON.stringify(body));
        const fetch = vi.spyOn(UrlFetchApp, "fetch");

        const result = provider.getInfo(symbol, attribute);

        expect(fetch).toHaveBeenCalledWith(url);
        expect(result.getValue(attribute)).toBe(expected);
        expectNoSensitiveLogs();
    });

    it.each([
        [AlphaVantage, "NASDAQ:AAPL", "PRICE", { debug: bodyMarker }],
        [TwelveData, "NASDAQ:AAPL", "PRICE", { code: 404, message: `${bodyMarker} https://example.test?apikey=${key}` }],
        [CoinMarket, "CURRENCY:BTCUSD", "PRICE", { data: null, debug: bodyMarker }]
    ])("omits %s raw provider errors", (provider, symbol, attribute, body) => {
        const result = provider.parseResponse(JSON.stringify(body), symbol, attribute);
        expect(result.getValue(attribute)).toBe("");
        expectNoSensitiveLogs();
    });

    it.each([
        [FinnHub, "FINNHUB_API_KEY", "NASDAQ:AAPL"],
        [AlphaVantage, "ALPHA_VANTAGE_API_KEY", "NASDAQ:AAPL"],
        [TwelveData, "TWELVE_DATA_API_KEY", "NASDAQ:AAPL"],
        [CoinMarket, "COINMARKET_API_KEY", "CURRENCY:BTCUSD"]
    ])("omits %s fetch exceptions that contain request credentials", (provider, property, symbol) => {
        PropertiesService.getScriptProperties().setProperty(property, key);
        const url = provider.getURL(symbol, "PRICE", key);
        vi.spyOn(UrlFetchApp, "fetch").mockImplementation(() => { throw new Error(`${bodyMarker} ${url}`); });

        expect(provider.getInfo(symbol, "PRICE").stockPrice).toBe(null);
        expectNoSensitiveLogs();
    });

    it("omits response and URL text from Yahoo fetch exceptions", () => {
        vi.spyOn(UrlFetchApp, "fetch").mockImplementation(() => { throw new Error(`${bodyMarker} https://example.test?token=${key}`); });
        expect(YahooFinance.getInfo("NASDAQ:AAPL", "PRICE").stockPrice).toBe(null);
        expectNoSensitiveLogs();
    });

    it("logs the batch size without logging credential-bearing URLs", () => {
        const url = `https://example.test/quote?apikey=${key}`;
        const stock = new StockWebURL("NASDAQ:AAPL");
        stock.addSiteURL("TEST", "", "", url, () => {
            const result = new StockAttributes(); result.stockPrice = 123.45; return result;
        }, null);
        vi.spyOn(FinanceWebsiteSearch, "getAllStockWebSiteFunctions").mockReturnValue([stock]);
        UrlFetchApp.mockResponse(url, bodyMarker);

        const result = FinanceWebsiteSearch.getAll(["NASDAQ:AAPL"], "PRICE");

        expect(result[0].stockPrice).toBe(123.45);
        expect(log.mock.calls.flat().join("\n")).toContain("Batch=1. Requests=1");
        expectNoSensitiveLogs();
    });
});
