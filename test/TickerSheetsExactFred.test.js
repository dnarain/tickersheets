import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TickerSheetsExactFred as F, TICKERSHEETS_FRED_VALUE } from "../src/TickerSheetsExactFred.js";

const key = "a".repeat(32), day = "2026-11-05";
const response = (data, http = 200) => ({ getResponseCode: () => http, getContentText: () => typeof data === "string" ? data : JSON.stringify(data) });
const meta = () => ({ seriess: [{ id: "DGS10", title: "10-Year Treasury", units: "Percent" }] });
const observations = (value = "-1.25", date = day) => ({ units: "lin", output_type: 1, observation_start: day, observation_end: day, count: 1, offset: 0, observations: [{ date, value }] });
let cache, fetch;
beforeEach(() => {
    const values = new Map();
    cache = { values, get: vi.fn(name => values.get(name) ?? null), put: vi.fn((name, value) => values.set(name, value)) };
    fetch = vi.fn(url => response(url.includes("/observations?") ? observations() : meta()));
    vi.stubGlobal("CacheService", { getScriptCache: () => cache });
    vi.stubGlobal("UrlFetchApp", { fetch });
    vi.stubGlobal("PropertiesService", { getScriptProperties: () => ({ getProperty: name => name === "FRED_API_KEY" ? key : null }) });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const deps = () => ({ cache, fetch, fredKey: key });
function supply({ metadata = meta(), data = observations(), metaHttp = 200, obsHttp = 200 } = {}) {
    fetch.mockImplementation(url => response(url.includes("/observations?") ? data : metadata, url.includes("/observations?") ? obsHttp : metaHttp));
}

describe("exact FRED observations", () => {
    it("requests both exact date bounds and returns the controlled SMF negative value", () => {
        expect(TICKERSHEETS_FRED_VALUE(" dgs10 ", day)).toBe(-1.25);
        expect(fetch).toHaveBeenCalledTimes(2);
        const url = new URL(fetch.mock.calls[1][0]);
        expect(url.origin + url.pathname).toBe("https://api.stlouisfed.org/fred/series/observations");
        expect(Object.fromEntries(url.searchParams)).toEqual({ series_id: "DGS10", api_key: key, file_type: "json", observation_start: day, observation_end: day, sort_order: "desc", limit: "1", units: "lin", output_type: "1" });
        expect(F.fetch("DGS10", day, deps())).toMatchObject({ ok: true, value: -1.25, date: day, unit: "Percent", cacheHit: true });
    });
    it.each(["0", 0, "-0", "1.5", ".5", "-2.7e-3", 5])("preserves the exact numeric observation %s", value => {
        supply({ data: observations(value) }); expect(TICKERSHEETS_FRED_VALUE("DGS10", day)).toBe(Number(value));
    });
    it("supports series outside the four dashboard defaults", () => {
        const metadata = meta(); metadata.seriess[0].id = "PAYEMS"; metadata.seriess[0].units = "Thousands of Persons";
        supply({ metadata, data: observations("202500") });
        expect(F.fetch("payems", day, deps())).toMatchObject({ ok: true, seriesId: "PAYEMS", value: 202500, unit: "Thousands of Persons" });
    });
    it("does not substitute an earlier observation for a holiday or weekend", () => {
        supply({ data: observations("4.88", "2026-11-04") });
        expect(TICKERSHEETS_FRED_VALUE("DGS10", day)).toMatch(/did not return the requested observation date/);
        expect(cache.put).not.toHaveBeenCalled();
    });
    it("distinguishes a missing published observation from no observation", () => {
        supply({ data: observations(".") }); expect(TICKERSHEETS_FRED_VALUE("DGS10", day)).toBe("N/A: FRED observation missing on " + day + ".");
        supply({ data: { units: "lin", count: 0, observations: [] } }); expect(TICKERSHEETS_FRED_VALUE("DGS10", day)).toBe("N/A: FRED has no observation on " + day + ".");
        expect(cache.put).not.toHaveBeenCalled();
    });
    it("rejects FRED's count-zero monthly period echo instead of returning an earlier value", () => {
        const requested = "2026-10-02", metadata = { seriess: [{ id: "UNRATE", units: "Percent" }] };
        const data = { units: "lin", output_type: 1, observation_start: requested, observation_end: requested, count: 0, offset: 0, observations: [{ date: "2026-10-01", value: "4.1" }] };
        supply({ metadata, data });
        expect(TICKERSHEETS_FRED_VALUE("UNRATE", requested)).toBe("N/A: FRED has no observation on 2026-10-02.");
        expect(cache.put).not.toHaveBeenCalled();
    });
    it.each([
        { observations: [{ date: day, value: "4.1" }] },
        { observations: [{ date: "2026-11-04", value: "not a number" }] },
        { observations: [{ date: "2026-02-30", value: "4.1" }] },
        { observations: [{ date: "2026-11-04", value: "4.1" }, { date: "2026-11-03", value: "4.2" }] },
        { observations: [null] }, { units: undefined }, { output_type: undefined }, { observation_start: undefined }, { offset: undefined }
    ])("keeps malformed count-zero responses outside the monthly-echo exception (%#)", changes => {
        supply({ data: { ...observations("4.1", "2026-11-04"), count: 0, ...changes } });
        expect(TICKERSHEETS_FRED_VALUE("DGS10", day)).toBe("N/A: FRED returned an invalid exact-date response."); expect(cache.put).not.toHaveBeenCalled();
    });
    it.each([[{ date: day, value: "1" }, { date: day, value: "1" }], [{ date: day, value: "1" }, { date: day, value: "2" }]].map(rows => [rows]))
    ("rejects repeated exact-date observations, including matching duplicates (%#)", rows => {
        supply({ data: { observations: rows } }); expect(TICKERSHEETS_FRED_VALUE("DGS10", day)).toMatch(/multiple observations/); expect(cache.put).not.toHaveBeenCalled();
    });
    it.each([null, true, "", "1,234", "NaN", "Infinity", "1e400", "=1+1", {}, []])("rejects malformed values (%#)", value => {
        supply({ data: observations(value) }); expect(TICKERSHEETS_FRED_VALUE("DGS10", day)).toMatch(/invalid observation value/); expect(cache.put).not.toHaveBeenCalled();
    });
    it.each([null, [], true, "bad JSON", { error_code: 400, observations: [] }, { observations: {} }, { observations: [null] }])
    ("rejects malformed observation responses (%#)", data => {
        supply({ data }); expect(TICKERSHEETS_FRED_VALUE("DGS10", day)).toMatch(/^N\/A:/); expect(cache.put).not.toHaveBeenCalled();
    });
    it.each([{ units: "pch" }, { output_type: 2 }, { observation_start: "2026-11-04" }, { observation_end: "2026-11-06" }, { offset: 1 }, { count: 0 }])
    ("rejects wrong bounds, transformations and response counts (%#)", changes => {
        supply({ data: { ...observations(), ...changes } }); expect(TICKERSHEETS_FRED_VALUE("DGS10", day)).toMatch(/invalid exact-date response/);
    });
    it.each([null, [], { error_code: 400, seriess: [] }, { seriess: [] }, { seriess: [{ id: "DGS2" }] }, { seriess: [{ id: "DGS10" }, { id: "DGS10" }] }])
    ("checks series metadata identity before fetching observations (%#)", metadata => {
        supply({ metadata }); expect(TICKERSHEETS_FRED_VALUE("DGS10", day)).toMatch(/metadata unavailable/); expect(fetch).toHaveBeenCalledOnce(); expect(cache.put).not.toHaveBeenCalled();
    });
    it("keeps a numeric result when the metadata omits units", () => {
        supply({ metadata: { seriess: [{ id: "DGS10" }] } }); expect(F.fetch("DGS10", day, deps())).toMatchObject({ value: -1.25, unit: "Units unavailable" });
    });
});

describe("exact-date inputs and timezone", () => {
    it.each(["2026-02-30", "2025-02-29", "2026-13-01", "2026-11-31", "0000-01-01", "11/05/2026", "Nov 5, 2026", "2026-11-05T00:00:00Z", "", null, undefined, 46331, true, {}, [[day]], new Date(NaN)])
    ("rejects invalid or ambiguous dates before HTTP (%#)", date => {
        expect(TICKERSHEETS_FRED_VALUE("DGS10", date)).toMatch(/date-valued cell or a valid YYYY-MM-DD/); expect(fetch).not.toHaveBeenCalled();
    });
    it.each(["2024-02-29", "2026-11-05", "2000-02-29", "1900-01-01"])("accepts valid calendar date %s", date => {
        expect(F.date_(date)).toBe(date);
    });
    it.each([["Asia/Tokyo", "2026-11-04T15:00:00Z"], ["America/Los_Angeles", "2026-11-05T08:00:00Z"], ["Etc/UTC", "2026-11-05T00:00:00Z"]])
    ("uses the spreadsheet timezone %s for a Sheets Date", (zone, iso) => {
        const date = new Date(iso), formatDate = vi.fn(() => day);
        vi.stubGlobal("SpreadsheetApp", { getActiveSpreadsheet: () => ({ getSpreadsheetTimeZone: () => zone }) }); vi.stubGlobal("Utilities", { formatDate });
        expect(TICKERSHEETS_FRED_VALUE("DGS10", date)).toBe(-1.25); expect(formatDate).toHaveBeenCalledWith(date, zone, "yyyy-MM-dd");
        expect(new URL(fetch.mock.calls[1][0]).searchParams.get("observation_start")).toBe(day);
    });
    it("does not silently use UTC if spreadsheet timezone conversion fails", () => {
        vi.stubGlobal("SpreadsheetApp", { getActiveSpreadsheet: () => ({ getSpreadsheetTimeZone: () => "Asia/Tokyo" }) });
        vi.stubGlobal("Utilities", { formatDate: () => { throw new Error("private-token"); } });
        expect(TICKERSHEETS_FRED_VALUE("DGS10", new Date(day + "T00:00:00Z"))).toMatch(/valid YYYY-MM-DD/); expect(fetch).not.toHaveBeenCalled();
    });
    it.each(["", "PAYEMS?api_key=bad", "=1+1", "DGS-10", "DGS.10", "x".repeat(51), 1, {}, []])("rejects malformed series IDs before HTTP (%#)", id => {
        expect(TICKERSHEETS_FRED_VALUE(id, day)).toMatch(/supported FRED series ID/); expect(fetch).not.toHaveBeenCalled();
    });
});

describe("private credentials and public cache", () => {
    it.each(["", "not-a-key", "A".repeat(32), null])("requires a valid saved key before HTTP (%#)", fredKey => {
        expect(F.fetch("DGS10", day, { ...deps(), fredKey: () => fredKey }).status).toMatch(/API key required/); expect(fetch).not.toHaveBeenCalled();
    });
    it("does not disclose a failed key getter's error", () => {
        const result = F.fetch("DGS10", day, { ...deps(), fredKey: () => { throw new Error(key); } });
        expect(result.status).toMatch(/key unavailable/); expect(JSON.stringify(result)).not.toContain(key); expect(fetch).not.toHaveBeenCalled();
    });
    it.each(["metadata", "observations"])("rejects provider output that echoes the private key in %s", location => {
        supply(location === "metadata" ? { metadata: { seriess: [{ id: "DGS10", units: key }] } } : { data: { ...observations(), error_message: key } });
        const result = TICKERSHEETS_FRED_VALUE("DGS10", day); expect(result).toMatch(/^N\/A:/); expect(result).not.toContain(key); expect(cache.put).not.toHaveBeenCalled();
    });
    it("rejects an escaped credential reflected in parsed metadata units", () => {
        const metadata = '{"seriess":[{"id":"DGS10","units":"' + "\\u0061".repeat(32) + '"}]}';
        supply({ metadata }); expect(TICKERSHEETS_FRED_VALUE("DGS10", day)).toBe("N/A: FRED series metadata unavailable."); expect(cache.put).not.toHaveBeenCalled();
    });
    it.each([401, 403, 429, 500])("returns fixed errors for HTTP %i without copying raw errors", http => {
        supply({ obsHttp: http, data: { error_message: key } }); const result = TICKERSHEETS_FRED_VALUE("DGS10", day);
        expect(result).toBe("N/A: FRED exact-date observation unavailable."); expect(result).not.toContain(key); expect(cache.put).not.toHaveBeenCalled();
    });
    it("does not return network exceptions, authentication URLs or raw error messages", () => {
        fetch.mockImplementation(() => { throw new Error("https://api.stlouisfed.org/fred/series?api_key=" + key); });
        const result = TICKERSHEETS_FRED_VALUE("DGS10", day); expect(result).toBe("N/A: FRED series metadata unavailable."); expect(result).not.toContain(key); expect(cache.put).not.toHaveBeenCalled();
    });
    it("stores only public observations and separates dates and refresh numbers", () => {
        expect(TICKERSHEETS_FRED_VALUE("DGS10", day, 1)).toBe(-1.25); expect(TICKERSHEETS_FRED_VALUE("DGS10", day, 1)).toBe(-1.25); expect(fetch).toHaveBeenCalledTimes(2);
        expect(TICKERSHEETS_FRED_VALUE("DGS10", day, 2)).toBe(-1.25); expect(fetch).toHaveBeenCalledTimes(4);
        const next = "2026-11-06"; supply({ data: { ...observations("4.88", next), observation_start: next, observation_end: next } });
        expect(TICKERSHEETS_FRED_VALUE("DGS10", next, 1)).toBe(4.88); expect(fetch).toHaveBeenCalledTimes(6);
        const saved = [...cache.values.keys(), ...cache.values.values()].join(""); expect(saved).not.toMatch(/api_key|cookie|crumb|headers/); expect(saved).not.toContain(key);
    });
    it("does not serve a cached value after the saved key is removed", () => {
        expect(TICKERSHEETS_FRED_VALUE("DGS10", day)).toBe(-1.25);
        vi.stubGlobal("PropertiesService", { getScriptProperties: () => ({ getProperty: () => "" }) });
        expect(TICKERSHEETS_FRED_VALUE("DGS10", day)).toMatch(/key required/); expect(fetch).toHaveBeenCalledTimes(2);
    });
    it("expires exact-date cache records at one hour", () => {
        let now = Date.UTC(2026, 10, 11); const overrides = { ...deps(), clock: () => now };
        expect(F.fetch("DGS10", day, overrides).cacheHit).toBe(false);
        now += 3599999; expect(F.fetch("DGS10", day, overrides).cacheHit).toBe(true);
        now++; expect(F.fetch("DGS10", day, overrides).cacheHit).toBe(false); expect(fetch).toHaveBeenCalledTimes(4);
    });
    it.each([-1, 1.5, {}, true, "1e2", 2147483648])("rejects invalid refresh inputs before HTTP (%#)", refresh => {
        expect(TICKERSHEETS_FRED_VALUE("DGS10", day, refresh)).toMatch(/refresh number/); expect(fetch).not.toHaveBeenCalled();
    });
});
