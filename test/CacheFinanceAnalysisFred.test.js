import { afterEach, describe, expect, it, vi } from "vitest";
import { CFAnalysisFred as Fred } from "../src/CacheFinanceAnalysisFred.js";

const key = "a".repeat(32);
const response = observations => JSON.stringify({ units: "lin", observations });
afterEach(() => vi.unstubAllGlobals());

describe("FRED requests and series definitions", () => {
    it("defines the four requested economic series with the source units", () => {
        const series = Fred.registry();
        expect(series.map(row => row.seriesId)).toEqual(["DGS10", "FEDFUNDS", "CPIAUCSL", "UNRATE"]);
        expect(series[0]).toMatchObject({ unit: "Percent", frequency: "Daily" });
        expect(series[1]).toMatchObject({ frequency: "Monthly", seasonalAdjustment: "Not seasonally adjusted" });
        expect(series[2]).toMatchObject({ unit: "Index 1982-1984=100", frequency: "Monthly" });
        expect(series[3]).toMatchObject({ unit: "Percent", seasonalAdjustment: "Seasonally adjusted" });
        series[0].label = "changed";
        expect(Fred.registry()[0].label).toBe("10-year Treasury yield");
    });

    it("builds only the official HTTPS levels endpoint and requests latest observations first", () => {
        const request = Fred.getRequest(" dgs10 ", key);
        const url = new URL(request.url);
        expect(url.origin).toBe("https://api.stlouisfed.org");
        expect(url.pathname).toBe("/fred/series/observations");
        expect(Object.fromEntries(url.searchParams)).toEqual({ series_id: "DGS10", api_key: key, file_type: "json", sort_order: "desc", limit: "400", units: "lin", output_type: "1" });
        expect(request.options).toEqual({ method: "get", muteHttpExceptions: true, followRedirects: true });
        expect(new URL(Fred.buildUrl("UNRATE", key, 36)).searchParams.get("limit")).toBe("36");
    });

    it.each([undefined, null, "", "UNSUPPORTED", "DGS10&api_key=private"])("rejects unsupported series without including input in errors (%#)", series => {
        expect(() => Fred.buildUrl(series, key)).toThrow("Choose a supported FRED series.");
        expect(Fred.parseObservations(response([]), series)).toMatchObject({ ok: false, seriesId: "", source: "" });
    });

    it.each([undefined, null, "", "placeholder", "a".repeat(31), "A".repeat(32), "a".repeat(31) + "\n"])("rejects an invalid key with fixed text (%#)", value => {
        expect(() => Fred.buildUrl("DGS10", value)).toThrow("Enter a valid FRED API key in API key settings.");
    });

    it.each([0, -1, 1.5, 100001, NaN, Infinity, "36", null])("rejects an invalid observation limit (%#)", limit => {
        expect(() => Fred.buildUrl("DGS10", key, limit)).toThrow("FRED observation limit must be an integer from 1 to 100000.");
    });

    it("does not read properties, fetch data or log inputs", () => {
        const fail = vi.fn(() => { throw new Error("Must not access services"); });
        vi.stubGlobal("PropertiesService", { getScriptProperties: fail });
        vi.stubGlobal("UrlFetchApp", { fetch: fail });
        vi.stubGlobal("Logger", { log: fail });
        Fred.getRequest("DGS10", key);
        Fred.parseObservations(response([{ date: "2026-11-09", value: "4.88" }]), "DGS10");
        expect(fail).not.toHaveBeenCalled();
    });
});

describe("FRED observation parsing", () => {
    it("sorts descending responses chronologically and preserves unavailable periods", () => {
        const data = Fred.parseObservations(response([
            { date: "2026-11-11", value: "." }, { date: "2026-11-09", value: "4.88" },
            { date: "2026-11-06", value: "4.86" }, { date: "2026-11-10", value: "." }
        ]), "DGS10");
        expect(data.ok).toBe(true);
        expect(data.observations).toEqual([
            { date: "2026-11-06", value: 4.86 }, { date: "2026-11-09", value: 4.88 },
            { date: "2026-11-10", value: null }, { date: "2026-11-11", value: null }
        ]);
        expect(data.latest).toEqual({ date: "2026-11-09", value: 4.88 });
        expect(data.change).toBeCloseTo(0.02);
        expect(data.unit).toBe("Percent");
        expect(data.source).toBe("https://fred.stlouisfed.org/series/DGS10");
        expect(data.periodNote).toContain("percentage points");
        expect(data.periodNote).toContain("release times are unavailable");
    });

    it("preserves actual zero and negative values without treating them as missing", () => {
        const data = Fred.parseObservations(response([{ date: "2026-01-01", value: "-0.1" }, { date: "2026-01-02", value: "0" }]), "DGS10");
        expect(data.latest.value).toBe(0); expect(data.change).toBeCloseTo(0.1);
    });

    it("labels CPI as an index level and calculates only index-point change", () => {
        const data = Fred.parseObservations(response([{ date: "2026-10-01", value: "337.476" }, { date: "2026-09-01", value: "336.298" }]), "CPIAUCSL");
        expect(data.latest.value).toBe(337.476); expect(data.change).toBeCloseTo(1.178);
        expect(data.unit).toBe("Index 1982-1984=100");
        expect(data.periodNote).toContain("Year-over-year inflation is unavailable");
    });

    it("uses monthly averages for FEDFUNDS and monthly periods for UNRATE", () => {
        for (const id of ["FEDFUNDS", "UNRATE"]) {
            const data = Fred.parseObservations(response([{ date: "2026-10-01", value: "4.1" }]), id);
            expect(data.ok).toBe(true); expect(data.periodNote).toContain("Monthly"); expect(data.change).toBeNull();
        }
    });

    it("deduplicates identical observations but rejects conflicting values for one date", () => {
        const first = { date: "2026-11-09", value: "4.88" };
        expect(Fred.parseObservations(response([first, first]), "DGS10").observations).toHaveLength(1);
        expect(Fred.parseObservations(response([first, { ...first, value: "4.89" }]), "DGS10").ok).toBe(false);
    });

    it.each(["2026-02-30", "2026-13-01", "2025-02-29", "26-01-01", "2026-1-01", "2026-01-01T00:00:00Z", null, 20260101])("rejects invalid dates without normalizing them to a different day (%#)", date => {
        const data = Fred.parseObservations(response([{ date, value: "4.88" }]), "DGS10");
        expect(data.ok).toBe(false); expect(data.observations).toEqual([]);
    });

    it("accepts leap days and finite numeric values", () => {
        expect(Fred.parseObservations(response([{ date: "2024-02-29", value: 4.88 }]), "DGS10").latest).toEqual({ date: "2024-02-29", value: 4.88 });
    });

    it.each(["", " ", "NaN", "Infinity", "1,234", "4.88%", "4.88 extra", "1e999", null, true, {}, []])("rejects invalid value types or text instead of turning them into zero (%#)", value => {
        expect(Fred.parseObservations(response([{ date: "2026-11-09", value }]), "DGS10").ok).toBe(false);
    });

    it("returns no latest observation for an empty or wholly missing series", () => {
        for (const observations of [[], [{ date: "2026-11-09", value: "." }]]) {
            const data = Fred.parseObservations(response(observations), "DGS10");
            expect(data.ok).toBe(false); expect(data.latest).toBeNull(); expect(data.change).toBeNull();
            expect(data.error).toBe("FRED returned no available observations.");
        }
    });

    it.each([null, [], {}, { observations: null }, { observations: [null] }, { observations: [[]] }, { units: "pc1", observations: [{ date: "2026-11-09", value: "4.88" }] }])("rejects malformed or transformed response data (%#)", body => {
        expect(Fred.parseObservations(JSON.stringify(body), "DGS10").ok).toBe(false);
    });

    it("never returns raw provider errors, invalid JSON or API key text", () => {
        const privateText = "private-key-do-not-return";
        for (const body of ['{"error_code":400,"error_message":"' + privateText + '"}', '<html>' + privateText, privateText]) {
            const result = Fred.parseObservations(body, "DGS10");
            expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain(privateText);
        }
    });
});
