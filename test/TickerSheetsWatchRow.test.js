import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TickerSheetsWatchRow as W, TICKERSHEETS_WATCH_ROW } from "../src/TickerSheetsWatchRow.js";
import { TickerSheetsPublicData } from "../src/TickerSheetsFunctions.js";
import { TickerSheetsData } from "../src/TickerSheetsData.js";

let quote, details;
beforeEach(() => {
    vi.stubGlobal("SpreadsheetApp", { flush: vi.fn() });
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-12T22:00:00.000Z"));
    const history = Array.from({ length: 260 }, (_, index) => ({ date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), close: 100 + index, adjustedClose: 100 + index, volume: 1000 }));
    quote = { ok: true, symbol: "AAPL", chart: { price: 359, currency: "USD", history },
        quote: { price: 360, quoteTime: "2026-11-12T21:15:00.000Z", session: "After-hours" },
        source: "https://query1.finance.yahoo.com/v8/finance/chart/AAPL", retrievedAt: new Date().toISOString() };
    details = { ok: true, symbol: "AAPL", fields: { trailing_pe: { value: 20 }, eps_ttm: { value: 0 }, market_cap: { value: 1e9 }, target_price: { value: 400 } },
        details: { nextEarnings: { dates: ["2027-01-28"] } }, source: "https://finance.yahoo.com/quote/AAPL/", retrievedAt: new Date().toISOString() };
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const fields = table => Object.fromEntries(table.slice(1));
const services = () => {
    vi.spyOn(TickerSheetsPublicData, "quote").mockImplementation(() => quote);
    vi.spyOn(TickerSheetsPublicData, "details").mockImplementation(() => details);
    vi.spyOn(TickerSheetsPublicData, "options").mockImplementation(() => { throw new Error("Watchlist must not fetch options"); });
};

describe("other-ticker watchlist function", () => {
    it("keeps its published 30 field keys and order without a worksheet dependency", () => {
        expect(W.keys()).toEqual(["status", "price", "currency", "quote_time", "retrieved_at", "indicator_as_of", "return1d", "return1m", "return1y", "rsi14",
            "sma50", "sma200", "volatility20d", "trailing_pe", "eps_ttm", "market_cap", "target_price", "next_earnings", "source", "price_session",
            "atm_iv", "return3m", "return_ytd", "max_drawdown", "macd", "macd_signal", "average_volume20", "bar_count", "previous_rsi2", "previous_close"]);
        expect(W.keys()).toHaveLength(30);
    });
    it("returns quote and fundamental values plus technical metrics without requesting options", () => {
        services(); const result = TICKERSHEETS_WATCH_ROW(" aapl ", 1), row = fields(result);
        expect(result).toHaveLength(31); expect(result.every(line => line.length === 2)).toBe(true);
        expect(result[0]).toEqual(["Field", "Value"]);
        expect(row).toMatchObject({ status: "Available", price: 360, currency: "USD", price_session: "After-hours", eps_ttm: 0,
            trailing_pe: 20, market_cap: 1e9, target_price: 400, next_earnings: "2027-01-28", rsi14: 100, sma50: 334.5,
            sma200: 259.5, bar_count: 260, previous_close: 358, atm_iv: "N/A", previous_rsi2: "N/A" });
        expect(row.return1d).toBeCloseTo(359 / 358 - 1);
        expect(row.return1m).toBeCloseTo(359 / 338 - 1);
        expect(TickerSheetsPublicData.quote).toHaveBeenCalledWith("AAPL", expect.any(Object), 1);
        expect(TickerSheetsPublicData.details).toHaveBeenCalledWith("AAPL", expect.any(Object), 1);
        expect(TickerSheetsPublicData.options).not.toHaveBeenCalled();
    });
    it("caches the summarized row for repeated ticker/refresh calls and refetches for a new refresh number", () => {
        services(); const calculate = vi.spyOn(TickerSheetsData, "calculate");
        const first = TICKERSHEETS_WATCH_ROW("AAPL", 1), repeated = TICKERSHEETS_WATCH_ROW(" aapl ", 1);
        expect(repeated).toEqual(first); expect(TickerSheetsPublicData.quote).toHaveBeenCalledTimes(1); expect(calculate).toHaveBeenCalledTimes(1);
        TICKERSHEETS_WATCH_ROW("AAPL", 2); expect(TickerSheetsPublicData.quote).toHaveBeenCalledTimes(2); expect(calculate).toHaveBeenCalledTimes(2);
    });
    it("retains the source retrieval time and drops missing optional values instead of inventing zero", () => {
        services(); quote.retrievedAt = "2026-11-12T21:59:45.000Z"; quote.chart.currency = ""; details.fields.eps_ttm.value = null; details.details.nextEarnings.dates = [];
        const row = fields(TICKERSHEETS_WATCH_ROW("AAPL", 1));
        expect(row.retrieved_at).toBe(quote.retrievedAt); expect(row.currency).toBe("N/A"); expect(row.eps_ttm).toBe("N/A"); expect(row.next_earnings).toBe("N/A");
    });
    it("can report partial quote or fundamental availability without treating missing metrics as zero", () => {
        services(); details.ok = false;
        expect(fields(TICKERSHEETS_WATCH_ROW("AAPL", 1))).toMatchObject({ status: "Quote available; fundamentals unavailable", price: 360, eps_ttm: "N/A", rsi14: 100 });
        quote.ok = false; details.ok = true;
        expect(fields(TICKERSHEETS_WATCH_ROW("AAPL", 2))).toMatchObject({ status: "Fundamentals available; quote unavailable", price: "N/A", eps_ttm: 0, rsi14: "N/A", bar_count: 0 });
    });
    it.each(["", " ", "=NVDA", "BAD:NVDA", "A A", null, 123])("rejects unsupported ticker input before calling providers (%#)", ticker => {
        services(); const row = fields(TICKERSHEETS_WATCH_ROW(ticker, 1));
        expect(row.status).toBe("N/A: Enter a supported ticker."); expect(row.price).toBe("N/A");
        expect(TickerSheetsPublicData.quote).not.toHaveBeenCalled(); expect(TickerSheetsPublicData.details).not.toHaveBeenCalled();
    });
    it("rejects invalid refresh values and contains service exceptions without returning their text", () => {
        services();
        expect(fields(TICKERSHEETS_WATCH_ROW("AAPL", "NOW()"))).toMatchObject({ price: "N/A", status: "N/A: Use a whole refresh number from 0 to 2147483647." });
        expect(TickerSheetsPublicData.quote).not.toHaveBeenCalled();
        TickerSheetsPublicData.quote.mockImplementation(() => { throw new Error("secret-request-cookie"); });
        const result = TICKERSHEETS_WATCH_ROW("AAPL", 1);
        expect(fields(result).status).toBe("N/A: Request or response unavailable."); expect(JSON.stringify(result)).not.toContain("secret-request-cookie");
    });
    it("returns a fixed unavailable status when both public datasets fail", () => {
        services(); quote.ok = false; details.ok = false;
        expect(fields(TICKERSHEETS_WATCH_ROW("AAPL", 1))).toMatchObject({ status: "N/A: Quote and fundamentals unavailable.", price: "N/A", eps_ttm: "N/A" });
    });
});
