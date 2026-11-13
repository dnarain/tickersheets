import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TickerSheetsRsiTargets as R, TICKERSHEETS_RSI_TARGETS } from "../src/TickerSheetsRsiTargets.js";

// Public chart facts and expected numbers come from SMF Mac's rsi_target_cases.json,
// source commit 60014079d08eadc489ed0ad01427d1807450c657. The fixtures retain no credentials.
const alternating = JSON.parse(fs.readFileSync(new URL("./fixtures/rsi2-mac-alternating.json", import.meta.url), "utf8"));
const capturedAapl = JSON.parse(fs.readFileSync(new URL("./fixtures/rsi2-mac-aapl-20261109.json", import.meta.url), "utf8"));
const copy = () => structuredClone(alternating);
const chart = body => body.chart.result[0];
const bars = body => chart(body).indicators.quote[0];
const response = (body, http = 200) => ({ getResponseCode: () => http, getContentText: () => typeof body === "string" ? body : JSON.stringify(body) });
const quoteBody = (changes = {}) => ({ quoteResponse: { error: null, result: [{ symbol: "RSITEST", regularMarketTime: chart(alternating).meta.regularMarketTime, bid: 100.9, ask: 101.1, ...changes }] } });
const values = body => R.parse(body, "RSITEST").values;
let fetch, store;
beforeEach(() => {
    const stored = new Map();
    store = { get: vi.fn(key => stored.get(key) ?? null), put: vi.fn((key, value) => stored.set(key, value)), stored };
    fetch = vi.fn(url => response(url.includes("/v7/") ? quoteBody() : alternating));
    vi.stubGlobal("CacheService", { getScriptCache: () => store });
    vi.stubGlobal("UrlFetchApp", { fetch });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("SMF RSI2 calculation reference cases", () => {
    it("matches independent alternating-series values and ignores an intraday close of 999", () => {
        const result = values(copy());
        expect(result.previous_rsi2).toBeCloseTo(33.3333969116211, 10);
        expect(result.rsi2).toBeCloseTo(55.5555979410807, 10);
        expect(result.buy_target).toBeCloseTo(98.6666603088379, 10);
        expect(result.sell_target).toBeCloseTo(104.666660308838, 10);
        expect(result.previous_close).toBe(100); expect(result.price).toBe(101);
    });
    it("matches the independently calculated captured AAPL snapshot", () => {
        const result = R.parse(capturedAapl, "AAPL").values;
        expect(result.rsi2).toBeCloseTo(77.5697568875469, 10);
        expect(result.buy_target).toBeCloseTo(336.292139164638, 9);
        expect(result.sell_target).toBeCloseTo(351.790398180543, 9);
        expect(result.previous_rsi2).toBeCloseTo(43.5298272392232, 10);
        expect(result.previous_close).toBeCloseTo(342.369995117188, 9);
    });
    it("excludes the quote-session final close too, without counting the current quote twice", () => {
        const body = copy(); bars(body).close[bars(body).close.length - 1] = 101;
        expect(values(body)).toEqual(values(alternating));
    });
    it("uses exactly 21 completed closes even when older data is invalid", () => {
        const body = copy(); chart(body).timestamp.unshift(chart(body).timestamp[0] - 86400);
        for (const [field, list] of Object.entries(bars(body))) list.unshift(field === "close" ? null : 1);
        expect(values(body)).toEqual(values(alternating));
    });
    it("works without a current daily bar and with exactly 21 prior closes", () => {
        const body = copy(); chart(body).timestamp.pop(); Object.values(bars(body)).forEach(list => list.pop());
        const result = values(body); expect(result.rsi2).toBeCloseTo(values(alternating).rsi2, 12); expect(result.open).toBeNull();
    });
    it.each([[Array.from({ length: 21 }, (_, i) => 100 + i), 121, 100, 116, null], [Array.from({ length: 21 }, (_, i) => 120 - i), 99, 0, null, 104]])
    ("preserves all-up/all-down endpoint RSI and only reachable positive targets (%#)", (closes, price, rsi, buy, sell) => {
        const body = copy(); bars(body).close = [...closes, 999]; chart(body).meta.regularMarketPrice = price;
        const result = values(body); expect(result.rsi2).toBe(rsi); expect(result.previous_rsi2).toBe(rsi); expect(result.buy_target).toBe(buy); expect(result.sell_target).toBe(sell);
    });
    it.each([[100, 50], [101, 100], [99, 0]])("handles a flat prior series with quote %s and leaves nonunique targets unavailable", (price, rsi) => {
        const body = copy(); bars(body).close = Array(22).fill(100); chart(body).meta.regularMarketPrice = price;
        const result = values(body); expect(result.rsi2).toBe(rsi); expect(result.previous_rsi2).toBe(50); expect(result.buy_target).toBeNull(); expect(result.sell_target).toBeNull();
    });
    it("reaches each requested threshold when its target becomes the current quote", () => {
        for (const [field, trigger] of [["buy_target", 20], ["sell_target", 80]]) {
            const body = copy(); chart(body).meta.regularMarketPrice = values(body)[field];
            expect(values(body).rsi2).toBeCloseTo(trigger, 10);
        }
    });
    it("rejects a mathematically zero buy target without losing the other calculated values", () => {
        const body = copy(); bars(body).close = [...Array(19).fill(1), 1.5, 2, 999]; chart(body).meta.regularMarketPrice = 3;
        const result = R.parse(body, "RSITEST", 10, 80).values;
        expect(result.buy_target).toBeNull(); expect(result.rsi2).toBe(100); expect(result.previous_close).toBe(2);
    });
});

describe("quote-session selection and public quote fields", () => {
    it("uses the provider's exchange day when a quote falls after UTC midnight", () => {
        const body = copy(); chart(body).meta.regularMarketTime = Date.UTC(2026, 10, 10, 0, 30) / 1000;
        expect(R.parse(body, "RSITEST").sessionDate).toBe("2026-11-09");
        expect(values(body).previous_close).toBe(100); expect(values(body).rsi2).toBeCloseTo(values(alternating).rsi2, 12);
    });
    it("uses IANA exchange time-zone rules when supplied, with GMT offset fallback", () => {
        const body = copy(); chart(body).meta.exchangeTimezoneName = "America/New_York";
        const result = values(body); expect(result.rsi2).toBeCloseTo(values(alternating).rsi2, 12);
        chart(body).meta.exchangeTimezoneName = "not/a/zone"; expect(values(body)).toEqual(result);
    });
    it("can identify exchange sessions from a valid IANA time zone without gmtoffset", () => {
        const body = copy(); chart(body).meta.exchangeTimezoneName = "America/New_York"; delete chart(body).meta.gmtoffset;
        expect(R.parse(body, "RSITEST").ok).toBe(true);
    });
    it("handles a weekend run against the last regular quote session", () => {
        const body = copy(); chart(body).meta.regularMarketTime = chart(body).timestamp.at(-2) + 7200;
        chart(body).timestamp.pop(); Object.values(bars(body)).forEach(list => list.pop());
        expect(R.parse(body, "RSITEST", 20, 80, "previous_close").values.previous_close).toBe(102);
    });
    it("uses same-session daily low/high/volume only when quote metadata omits them", () => {
        const body = copy(); delete chart(body).meta.regularMarketDayLow; delete chart(body).meta.regularMarketDayHigh; delete chart(body).meta.regularMarketVolume;
        const result = values(body); expect(result.low).toBe(80); expect(result.high).toBe(160); expect(result.volume).toBe(4321); expect(result.open).toBe(110);
    });
    it("preserves numeric zero volume and omits invalid optional numbers", () => {
        const body = copy(); chart(body).meta.regularMarketVolume = 0; chart(body).meta.regularMarketDayLow = "90";
        expect(values(body).volume).toBe(0); expect(values(body).low).toBe(80);
    });
    it("returns price without requiring history or unused triggers", () => {
        const body = copy(); delete chart(body).timestamp; delete chart(body).indicators;
        const result = R.parse(body, "RSITEST", -1, 100, "price"); expect(result.ok).toBe(true); expect(result.values.price).toBe(101);
    });
    it("can return current-session open without requiring the closing-price array", () => {
        const body = copy(); delete bars(body).close;
        const result = R.parse(body, "RSITEST", 0, 100, "open"); expect(result.ok).toBe(true); expect(result.values.open).toBe(110);
        chart(body).timestamp[chart(body).timestamp.length - 2] = chart(body).timestamp.at(-1);
        expect(R.parse(body, "RSITEST", 0, 100, "open").values.open).toBeNull();
    });
    it("returns a previous close from a single completed observation", () => {
        const body = copy(); chart(body).timestamp = [chart(body).timestamp[0]]; bars(body).close = [77];
        const result = R.parse(body, "RSITEST", -1, 100, "previous_close"); expect(result.ok).toBe(true); expect(result.values.previous_close).toBe(77);
    });
    it.each([null, 0, -1, "100", true, Infinity, 1e101])("rejects invalid required price %s", price => {
        const body = copy(); chart(body).meta.regularMarketPrice = price; expect(R.parse(body, "RSITEST").ok).toBe(false);
    });
    it.each(["regularMarketTime", "gmtoffset"])("rejects a missing required %s", field => {
        const body = copy(); delete chart(body).meta[field]; expect(R.parse(body, "RSITEST").ok).toBe(false);
    });
    it("rejects a mismatched ticker, malformed body and chart-level errors", () => {
        expect(R.parse(copy(), "AAPL").ok).toBe(false); expect(R.parse("{bad", "RSITEST").ok).toBe(false);
        const body = copy(); body.chart.error = { code: "Not Found" }; expect(R.parse(body, "RSITEST").ok).toBe(false);
    });
    it.each([0, -1, 1.5, 253402214401, 1e100])("rejects invalid quote epochs (%s)", stamp => {
        const body = copy(); chart(body).meta.regularMarketTime = stamp; expect(R.parse(body, "RSITEST").ok).toBe(false);
    });
    it.each([null, 0, -1, "100", true])("rejects invalid completed closes inside the 21-close window (%s)", value => {
        const body = copy(); bars(body).close[bars(body).close.length - 3] = value; expect(R.parse(body, "RSITEST").ok).toBe(false);
    });
    it("rejects insufficient prior observations", () => {
        const body = copy(); chart(body).timestamp.shift(); Object.values(bars(body)).forEach(list => list.shift());
        expect(R.parse(body, "RSITEST").ok).toBe(false);
    });
    it.each(["duplicate", "reversed", "future"])("rejects %s session data", kind => {
        const body = copy(), times = chart(body).timestamp;
        if (kind === "duplicate") times[times.length - 3] = times[times.length - 4];
        if (kind === "reversed") times[times.length - 3] = times[times.length - 1] + 86400;
        if (kind === "future") times[times.length - 1] += 86400;
        expect(R.parse(body, "RSITEST").ok).toBe(false);
    });
    it("ignores an unpublished null future bar while accepting prior completed observations", () => {
        const body = copy(); chart(body).timestamp.push(chart(body).timestamp.at(-1) + 86400); Object.values(bars(body)).forEach(list => list.push(null));
        expect(values(body).rsi2).toBeCloseTo(values(alternating).rsi2, 12);
    });
});

describe("optional Yahoo bid/ask and public worksheet output", () => {
    it("returns all twelve headers and values with accepted same-session bid/ask", () => {
        const out = TICKERSHEETS_RSI_TARGETS("RSITEST"); expect(out).toHaveLength(2); expect(out[0]).toEqual(R.headers()); expect(out[1]).toHaveLength(12);
        expect(out[1][0]).toBeCloseTo(55.5555979410807, 10); expect(out[1][4]).toBe(100.9); expect(out[1][5]).toBe(101.1); expect(fetch).toHaveBeenCalledTimes(2);
    });
    it("preserves published zero bid/ask", () => {
        fetch.mockImplementation(url => response(url.includes("/v7/") ? quoteBody({ bid: 0, ask: 0 }) : alternating));
        const out = TICKERSHEETS_RSI_TARGETS("RSITEST"); expect(out[1][4]).toBe(0); expect(out[1][5]).toBe(0);
    });
    it.each([{ symbol: "OTHER" }, { regularMarketTime: chart(alternating).meta.regularMarketTime - 86400 }, { bid: null, ask: null }, { bid: "100.9", ask: "101.1" }])
    ("keeps RSI results when bid/ask identity, date or numeric values are unavailable (%#)", changes => {
        fetch.mockImplementation(url => response(url.includes("/v7/") ? quoteBody(changes) : alternating));
        const out = TICKERSHEETS_RSI_TARGETS("RSITEST"); expect(out[1][0]).toBeCloseTo(55.5555979410807, 10); expect(out[1][4]).toBe("N/A"); expect(out[1][5]).toBe("N/A");
    });
    it("keeps core data when the optional bid/ask endpoint returns HTTP 401", () => {
        fetch.mockImplementation(url => url.includes("/v7/") ? response("private text must not escape", 401) : response(alternating));
        const out = TICKERSHEETS_RSI_TARGETS("RSITEST"); expect(out[1][0]).toBeCloseTo(55.5555979410807, 10); expect(out[1][4]).toBe("N/A");
        expect(JSON.stringify(out)).not.toContain("private text");
    });
    it("fetches optional quotes only for requested bid/ask or all output", () => {
        expect(TICKERSHEETS_RSI_TARGETS("RSITEST", 20, 80, "rsi2")).toBeCloseTo(55.5555979410807, 10);
        expect(TICKERSHEETS_RSI_TARGETS("RSITEST", 20, 80, "buy_target")).toBeCloseTo(98.6666603088379, 10);
        expect(fetch).toHaveBeenCalledOnce(); expect(fetch.mock.calls[0][0]).toContain("?range=3mo&interval=1d");
        expect(TICKERSHEETS_RSI_TARGETS("RSITEST", 20, 80, "bid")).toBe(100.9); expect(fetch).toHaveBeenCalledTimes(2);
    });
    it("does not fetch headers, unknown fields, invalid tickers or invalid requested triggers", () => {
        expect(TICKERSHEETS_RSI_TARGETS("not/a/ticker", 0, 100, "headers")).toEqual([R.headers()]);
        for (const args of [["RSITEST", 20, 80, "bogus"], ["=1+1"], ["RSITEST", 0], ["RSITEST", 20, 100], ["RSITEST", 80, 20], ["RSITEST", 20, 20], ["RSITEST", "20"], ["RSITEST", 20.1]]) expect(TICKERSHEETS_RSI_TARGETS(...args)).toMatch(/^N\/A:/);
        expect(fetch).not.toHaveBeenCalled();
    });
    it("returns a scalar unavailable target instead of a fabricated zero", () => {
        const body = copy(); bars(body).close = Array(22).fill(100); chart(body).meta.regularMarketPrice = 100; fetch.mockReturnValue(response(body));
        expect(TICKERSHEETS_RSI_TARGETS("RSITEST", 20, 80, "buy_target")).toBe("N/A");
    });
    it("shares parsed chart facts across selectors/triggers but changes cache entries with refresh", () => {
        TICKERSHEETS_RSI_TARGETS("RSITEST", 20, 80, "rsi2", 1); TICKERSHEETS_RSI_TARGETS("RSITEST", 10, 90, "sell_target", 1); expect(fetch).toHaveBeenCalledOnce();
        TICKERSHEETS_RSI_TARGETS("RSITEST", 20, 80, "rsi2", 2); expect(fetch).toHaveBeenCalledTimes(2);
        const stored = [...store.stored.values()].join(""); expect(stored).not.toContain('"chart"'); expect(stored).not.toContain('"timestamp"'); expect(stored).toContain('"averageGain"');
    });
    it("rejects a malformed refresh without requests and safely reports HTTP/parser failures", () => {
        expect(TICKERSHEETS_RSI_TARGETS("RSITEST", 20, 80, "rsi2", -1)).toMatch(/^N\/A:/); expect(fetch).not.toHaveBeenCalled();
        fetch.mockReturnValue(response("raw provider error", 403)); expect(TICKERSHEETS_RSI_TARGETS("RSITEST")).toMatch(/^N\/A:/);
        expect([...store.stored.values()]).toHaveLength(0);
    });
});
