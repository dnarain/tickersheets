/*  *** DEBUG START ***
export { TickerSheetsFred };
//  *** DEBUG END ***/

/** FRED rate values use percent units. CPI values use index points. */
const TICKERSHEETS_ANALYSIS_FRED_SERIES_ = Object.freeze([
    Object.freeze({ seriesId: "DGS10", label: "10-year Treasury yield", unit: "Percent", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", changeUnit: "percentage points" }),
    Object.freeze({ seriesId: "FEDFUNDS", label: "Federal funds effective rate", unit: "Percent", frequency: "Monthly", seasonalAdjustment: "Not seasonally adjusted", changeUnit: "percentage points" }),
    Object.freeze({ seriesId: "CPIAUCSL", label: "Consumer price index", unit: "Index 1982-1984=100", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", changeUnit: "index points" }),
    Object.freeze({ seriesId: "UNRATE", label: "Unemployment rate", unit: "Percent", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", changeUnit: "percentage points" })
]);

class TickerSheetsFred {
    static registry() { return TICKERSHEETS_ANALYSIS_FRED_SERIES_.map(series => ({ ...series })); }

    static series_(seriesId) {
        if (typeof seriesId !== "string") return null;
        return TICKERSHEETS_ANALYSIS_FRED_SERIES_.find(series => series.seriesId === seriesId.trim().toUpperCase()) || null;
    }

    /** The returned URL is for private requests only. Never log or store it. */
    static buildUrl(seriesId, key, limit = 400) {
        const series = TickerSheetsFred.series_(seriesId);
        if (!series) throw new Error("Choose a supported FRED series.");
        if (typeof key !== "string" || !/^[a-z0-9]{32}$/.test(key)) throw new Error("Enter a valid FRED API key in API key settings.");
        if (!Number.isInteger(limit) || limit < 1 || limit > 100000) throw new Error("FRED observation limit must be an integer from 1 to 100000.");
        const parameters = { series_id: series.seriesId, api_key: key, file_type: "json", sort_order: "desc", limit, units: "lin", output_type: 1 };
        return "https://api.stlouisfed.org/fred/series/observations?" + Object.entries(parameters)
            .map(([name, value]) => encodeURIComponent(name) + "=" + encodeURIComponent(String(value))).join("&");
    }

    static getRequest(seriesId, key, limit = 400) {
        return { url: TickerSheetsFred.buildUrl(seriesId, key, limit), options: { method: "get", muteHttpExceptions: true, followRedirects: true } };
    }

    static result_(series) {
        return {
            ok: false,
            seriesId: series?.seriesId || "",
            label: series?.label || "",
            unit: series?.unit || "",
            observations: [], latest: null, change: null,
            source: series ? "https://fred.stlouisfed.org/series/" + series.seriesId : "",
            periodNote: series ? series.frequency + "; " + series.seasonalAdjustment.toLowerCase()
                + ". Change is in " + series.changeUnit + " between the latest two available observations. Observation dates identify data periods; release times are unavailable."
                + (series.seriesId === "CPIAUCSL" ? " CPI values show index levels. Year-over-year inflation is unavailable." : "") : "",
            error: ""
        };
    }

    static date_(value) {
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const date = new Date(value + "T00:00:00.000Z");
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }

    static value_(value) {
        if (typeof value === "string") {
            value = value.trim();
            if (value === ".") return { valid: true, value: null };
            if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return { valid: false };
            value = Number(value);
        }
        return typeof value === "number" && Number.isFinite(value) ? { valid: true, value } : { valid: false };
    }

    /** API observations do not repeat series_id; metadata identifies the requested series. */
    static parseObservations(body, expectedSeriesId) {
        const series = TickerSheetsFred.series_(expectedSeriesId);
        const result = TickerSheetsFred.result_(series);
        if (!series) { result.error = "Choose a supported FRED series."; return result; }
        try {
            const data = typeof body === "string" ? JSON.parse(body) : null;
            if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.observations)
                || data.error_code !== undefined || (data.units !== undefined && data.units !== "lin")) {
                result.error = "FRED did not return the requested observation levels."; return result;
            }
            const dates = new Map();
            for (const row of data.observations) {
                if (!row || typeof row !== "object" || Array.isArray(row) || !TickerSheetsFred.date_(row.date)) {
                    result.error = "FRED returned an invalid observation."; return result;
                }
                const parsed = TickerSheetsFred.value_(row.value);
                if (!parsed.valid || (dates.has(row.date) && dates.get(row.date) !== parsed.value)) {
                    result.error = "FRED returned an invalid observation."; return result;
                }
                dates.set(row.date, parsed.value);
            }
            result.observations = [...dates].sort(([left], [right]) => left.localeCompare(right)).map(([date, value]) => ({ date, value }));
            const available = result.observations.filter(row => row.value !== null);
            if (!available.length) { result.error = "FRED returned no available observations."; return result; }
            result.latest = { ...available[available.length - 1] };
            if (available.length > 1) result.change = result.latest.value - available[available.length - 2].value;
            result.ok = true;
            return result;
        } catch (_error) {
            result.error = "Unable to read FRED observations."; return result;
        }
    }
}
