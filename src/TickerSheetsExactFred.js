/*  *** DEBUG START ***
import { TickerSheetsPublicData } from "./TickerSheetsFunctions.js";
import { TickerSheetsFred } from "./TickerSheetsFred.js";
export { TickerSheetsExactFred, TICKERSHEETS_FRED_VALUE };
//  *** DEBUG END ***/

/** Exact FRED observation dates identify data periods, not release dates or earlier business days. */
class TickerSheetsExactFred {
    static date_(input) {
        let date = input;
        if (input instanceof Date) {
            if (!Number.isFinite(input.getTime())) return null;
            try {
                const zone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
                date = Utilities.formatDate(input, zone, "yyyy-MM-dd");
            } catch { return null; }
        }
        if (typeof date !== "string") return null;
        date = date.trim();
        return TickerSheetsFred.date_(date) && date.slice(0, 4) !== "0000" ? date : null;
    }

    static fetch(seriesId, date, overrides = {}, refresh = "") {
        const id = typeof seriesId === "string" ? seriesId.trim().toUpperCase() : "";
        const day = TickerSheetsExactFred.date_(date);
        if (!/^[A-Z0-9_]{1,50}$/.test(id)) return TickerSheetsPublicData.failure("Use a supported FRED series ID.");
        if (!day) return TickerSheetsPublicData.failure("Use a date-valued cell or a valid YYYY-MM-DD date.");
        const source = "https://fred.stlouisfed.org/series/" + id;
        let deps, key;
        try {
            deps = TickerSheetsPublicData.dependencies(overrides);
            key = typeof deps.fredKey === "function" ? deps.fredKey() : deps.fredKey;
        } catch { return TickerSheetsPublicData.failure("FRED API key unavailable. Use the TickerSheets menu.", source); }
        if (typeof key !== "string" || !/^[a-z0-9]{32}$/.test(key)) return TickerSheetsPublicData.failure("FRED API key required. Use the TickerSheets menu.", source);
        return TickerSheetsPublicData.cached("fred-exact", id + ":" + day, 3600, services => {
            // These private request URLs never enter a result, error message or cache record.
            const parameters = "?series_id=" + encodeURIComponent(id) + "&api_key=" + encodeURIComponent(key) + "&file_type=json";
            const metadata = TickerSheetsPublicData.request("https://api.stlouisfed.org/fred/series" + parameters, services);
            if (metadata.http !== 200 || metadata.body.includes(key)) return TickerSheetsPublicData.failure("FRED series metadata unavailable.", source);
            const meta = JSON.parse(metadata.body);
            if (!meta || typeof meta !== "object" || Array.isArray(meta) || meta.error_code !== undefined || !Array.isArray(meta.seriess)
                || meta.seriess.length !== 1 || meta.seriess[0]?.id !== id) return TickerSheetsPublicData.failure("FRED series metadata unavailable.", source);
            if (typeof meta.seriess[0].units === "string" && meta.seriess[0].units.includes(key)) return TickerSheetsPublicData.failure("FRED series metadata unavailable.", source);
            const response = TickerSheetsPublicData.request("https://api.stlouisfed.org/fred/series/observations" + parameters
                + "&observation_start=" + day + "&observation_end=" + day + "&sort_order=desc&limit=1&units=lin&output_type=1", services);
            if (response.http !== 200 || response.body.includes(key)) return TickerSheetsPublicData.failure("FRED exact-date observation unavailable.", source);
            const payload = JSON.parse(response.body);
            if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.error_code !== undefined || !Array.isArray(payload.observations)
                || payload.units !== undefined && payload.units !== "lin" || payload.output_type !== undefined && payload.output_type !== 1
                || payload.observation_start !== undefined && payload.observation_start !== day || payload.observation_end !== undefined && payload.observation_end !== day
                || payload.offset !== undefined && payload.offset !== 0) {
                return TickerSheetsPublicData.failure("FRED returned an invalid exact-date response.", source);
            }
            if (payload.count !== undefined && payload.count !== payload.observations.length) {
                const echoed = payload.observations[0];
                // Some monthly requests echo a period-start row outside the exact window while count remains zero.
                // That row never supplies the requested day's value.
                if (payload.count === 0 && payload.observations.length === 1 && payload.units === "lin" && payload.output_type === 1
                    && payload.observation_start === day && payload.observation_end === day && payload.offset === 0
                    && echoed && typeof echoed === "object" && !Array.isArray(echoed) && echoed.date !== day
                    && TickerSheetsFred.date_(echoed.date) && echoed.date.slice(0, 4) !== "0000" && TickerSheetsFred.value_(echoed.value).valid) {
                    return TickerSheetsPublicData.failure("FRED has no observation on " + day + ".", source);
                }
                return TickerSheetsPublicData.failure("FRED returned an invalid exact-date response.", source);
            }
            if (!payload.observations.length) return TickerSheetsPublicData.failure("FRED has no observation on " + day + ".", source);
            if (payload.observations.length !== 1) return TickerSheetsPublicData.failure("FRED returned multiple observations for one date.", source);
            const row = payload.observations[0];
            if (!row || typeof row !== "object" || Array.isArray(row) || row.date !== day) return TickerSheetsPublicData.failure("FRED did not return the requested observation date.", source);
            const parsed = TickerSheetsFred.value_(row.value);
            if (!parsed.valid) return TickerSheetsPublicData.failure("FRED returned an invalid observation value.", source);
            if (parsed.value === null) return TickerSheetsPublicData.failure("FRED observation missing on " + day + ".", source);
            return { ok: true, status: "Available", seriesId: id, date: day, value: parsed.value, http: response.http, source,
                unit: typeof meta.seriess[0].units === "string" && meta.seriess[0].units ? meta.seriess[0].units : "Units unavailable" };
        }, deps, refresh);
    }
}

/**
 * FRED value for one exact observation date. Missing dates never use an earlier observation.
 * Values keep FRED's published units. Save your key through TickerSheets → API keys….
 * @param {string} seriesId FRED series ID, such as DGS10.
 * @param {Date|string} date A date-valued cell or YYYY-MM-DD text.
 * @param {number} refresh Optional editable refresh number.
 * @return {number|string} Numeric value or an explanatory N/A message.
 * @customfunction
 */
function TICKERSHEETS_FRED_VALUE(seriesId, date, refresh = "") {
    try {
        const data = TickerSheetsExactFred.fetch(seriesId, date, {}, refresh);
        return data.ok ? TickerSheetsPublicData.safe(data.value) : TickerSheetsPublicData.error(data);
    } catch { return "N/A: FRED exact-date value unavailable"; }
}
