/*  *** DEBUG START ***
import { CFWorkbookNames } from "./CacheFinanceSheetNames.js";
import { CFAnalysisSheets } from "./CacheFinanceAnalysisSheets.js";
export { CFAnalysisVisuals };
//  *** DEBUG END ***/

const CF_RESEARCH_NAME_ = "Research";
const CF_RESEARCH_MARKER_ = "CACHEFINANCE_RESEARCH_V1";

/** Earnings comparisons and charts from an already downloaded analysis snapshot. */
class CFAnalysisVisuals {
    static number_(value) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
    static moneyFormat_(value) {
        const size = Math.abs(typeof value === "number" ? value : 0);
        return size >= 1e12 ? '0.00,,,,"T"' : size >= 1e9 ? '0.00,,,"B"' : size >= 1e6 ? '0.00,,"M"' : "#,##0.00";
    }

    static period_(label, frequency) {
        if (typeof label !== "string") return null;
        const text = label.trim().toUpperCase();
        if (frequency === "Annual") {
            const match = text.match(/^(?:FY\s*)?(\d{4})$/);
            return match ? { key: Number(match[1]), year: Number(match[1]), quarter: null } : null;
        }
        const match = text.match(/^(?:([1-4])\s*Q\s*(\d{4})|Q\s*([1-4])\s*(\d{4})|(\d{4})\s*Q\s*([1-4]))$/);
        if (!match) return null;
        const year = Number(match[2] || match[4] || match[5]), quarter = Number(match[1] || match[3] || match[6]);
        return { key: year * 4 + quarter - 1, year, quarter };
    }

    static growth_(current, previous) {
        return CFAnalysisVisuals.number_(current) !== null && CFAnalysisVisuals.number_(previous) !== null && previous > 0 ? current / previous - 1 : null;
    }

    /** Comparisons stay within one published basis, frequency and currency. */
    static summarize(details = {}) {
        const earningsGroups = [], financialGroups = [], earnings = [], financials = [], notes = [];
        const groups = new Map();
        for (const row of details.earnings || []) {
            if (!["GAAP", "Adjusted"].includes(row.basis)) continue;
            const period = CFAnalysisVisuals.period_(row.fiscalPeriod || row.period, "Quarterly");
            if (!period) { notes.push("An EPS period could not be ordered; it is excluded from trend charts."); continue; }
            const key = row.basis + "|" + (row.currency || "");
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({ ...row, key: period.key });
        }
        for (const [key, raw] of groups) {
            const byPeriod = new Map(), conflicts = new Set();
            for (const row of raw) {
                const previous = byPeriod.get(row.key);
                if (previous && (previous.actual !== row.actual || previous.estimate !== row.estimate)) conflicts.add(row.key);
                else byPeriod.set(row.key, row);
            }
            const rows = [...byPeriod.values()].filter(row => !conflicts.has(row.key)).sort((a, b) => a.key - b.key);
            const [basis, currency] = key.split("|");
            if (rows.length) earningsGroups.push({ basis, currency, rows });
            const published = rows.filter(row => CFAnalysisVisuals.number_(row.actual) !== null);
            const latest = published[published.length - 1];
            if (latest) earnings.push({ ...latest, surprisePct: CFAnalysisVisuals.number_(latest.surprisePct) ?? (CFAnalysisVisuals.number_(latest.estimate) !== null && latest.estimate !== 0 ? (latest.actual - latest.estimate) / Math.abs(latest.estimate) * 100 : null) });
            if (conflicts.size) notes.push("Conflicting EPS rows were excluded from the same-period comparison.");
        }
        groups.clear();
        for (const row of details.financials || []) {
            if (!["GAAP", "Adjusted"].includes(row.basis) || !["Annual", "Quarterly"].includes(row.frequency)) continue;
            const period = CFAnalysisVisuals.period_(row.period, row.frequency);
            if (!period) { notes.push("An unrecognized financial period was excluded from growth comparisons."); continue; }
            const key = row.basis + "|" + row.frequency + "|" + (row.currency || "");
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({ ...row, key: period.key });
        }
        for (const [key, raw] of groups) {
            const byPeriod = new Map(), conflicts = new Set();
            for (const row of raw) {
                const previous = byPeriod.get(row.key);
                if (previous && ["revenue", "netIncome", "profitMargin"].some(field => previous[field] !== row[field])) conflicts.add(row.key);
                else byPeriod.set(row.key, row);
            }
            const rows = [...byPeriod.values()].filter(row => !conflicts.has(row.key)).sort((a, b) => a.key - b.key);
            const [basis, frequency, currency] = key.split("|");
            if (conflicts.size) notes.push("Conflicting financial rows were excluded from period comparisons.");
            if (!rows.length) continue;
            if (/^[A-Z]{3}$/.test(currency)) financialGroups.push({ basis, frequency, currency, rows });
            const latest = rows[rows.length - 1], previous = rows.find(row => row.key === latest.key - 1);
            const comparable = previous && /^[A-Z]{3}$/.test(currency);
            financials.push({ basis, frequency, currency, period: latest.period, previousPeriod: comparable ? previous.period : null,
                revenue: CFAnalysisVisuals.number_(latest.revenue), netIncome: CFAnalysisVisuals.number_(latest.netIncome), margin: CFAnalysisVisuals.number_(latest.profitMargin),
                revenueGrowth: comparable ? CFAnalysisVisuals.growth_(latest.revenue, previous.revenue) : null,
                netIncomeGrowth: comparable ? CFAnalysisVisuals.growth_(latest.netIncome, previous.netIncome) : null,
                marginChangePp: comparable && CFAnalysisVisuals.number_(latest.profitMargin) !== null && CFAnalysisVisuals.number_(previous.profitMargin) !== null ? (latest.profitMargin - previous.profitMargin) * 100 : null,
                comparison: frequency === "Annual" ? "YoY" : "QoQ", source: latest.source || "Yahoo Finance website",
                note: !currency ? "Currency not supplied; growth unavailable." : !previous ? "Consecutive prior period unavailable." : "Growth uses the same basis and currency; nonpositive prior values have no growth percentage." });
        }
        return { earnings, financials, earningsGroups, financialGroups, notes: [...new Set(notes)] };
    }

    static check(book, requireMain = true) {
        CFWorkbookNames.migrate(book);
        const main = book.getSheetByName("Analysis");
        if (requireMain && (!main || main.getRange("Z1").getValue() !== "CACHEFINANCE_ANALYSIS_V1")) throw new Error("Build the stock analysis tabs first.");
        const sheet = book.getSheetByName(CF_RESEARCH_NAME_);
        if (sheet && sheet.getRange("Z1").getValue() !== CF_RESEARCH_MARKER_) throw new Error("The existing Research tab is not managed by stock analysis. Rename it before refreshing.");
    }

    static clear_(sheet) {
        sheet.getRange(1, 1, sheet.getMaxRows(), 25).breakApart().clear();
        sheet.setRowHeights(1, sheet.getMaxRows(), 21);
        for (const chart of sheet.getCharts()) sheet.removeChart(chart);
    }

    static invalidate(book, reason = "Refresh the selected ticker to rebuild research charts.") {
        CFAnalysisVisuals.check(book);
        const sheet = book.getSheetByName(CF_RESEARCH_NAME_);
        if (!sheet) return;
        const ticker = String(book.getSheetByName("Analysis").getRange("B4").getValue()).trim().toUpperCase();
        sheet.getRange(1, 1, sheet.getMaxRows(), 25).clearContent();
        for (const chart of sheet.getCharts()) sheet.removeChart(chart);
        sheet.getRange("A1").setValue(CFAnalysisSheets.safe_(ticker + " — Research charts"));
        sheet.getRange("A2").setValue(CFAnalysisSheets.safe_(reason));
    }

    static dataset_(sheet, row, column, headers, values, dates = false) {
        CFAnalysisSheets.rows_(sheet, row + Math.max(values.length, 1));
        sheet.getRange(row, column, 1, headers.length).setValues([headers.map(value => CFAnalysisSheets.safe_(value))]).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold");
        if (values.length) {
            sheet.getRange(row + 1, column, values.length, headers.length).setValues(values.map(line => line.map(value => CFAnalysisSheets.safe_(value, ""))));
            if (dates) sheet.getRange(row + 1, column, values.length, 1).setNumberFormat("yyyy-mm-dd");
            if (headers.length > 1) sheet.getRange(row + 1, column + 1, values.length, headers.length - 1).setNumberFormat("0.00");
        }
        return { row, col: column, count: values.length + 1, width: headers.length };
    }

    static addChart_(sheet, source, ranges, title, index, type = "LINE", options = {}, headers = 1) {
        let chart = sheet.newChart().setChartType(Charts.ChartType[type]).setNumHeaders(headers).setPosition(35 + Math.floor(index / 2) * 18, index % 2 ? 7 : 1, 0, 0)
            .setOption("title", title).setOption("fontName", "Arial").setOption("fontSize", 10).setOption("width", 630).setOption("height", 310)
            .setOption("legend", { position: "bottom" }).setOption("interpolateNulls", false).setOption("colors", ["#17365D", "#2C8B8B", "#D99520"]);
        for (const range of ranges) chart = chart.addRange(source.getRange(range.row, range.col, range.count, range.width || 1));
        for (const [key, value] of Object.entries(options)) chart = chart.setOption(key, value);
        sheet.insertChart(chart.build());
    }

    static usableIv_(row) {
        return CFAnalysisVisuals.number_(row.iv) !== null && row.iv > 0 && CFAnalysisVisuals.number_(row.bid) !== null && CFAnalysisVisuals.number_(row.ask) !== null && row.bid >= 0 && row.ask >= row.bid && row.ask > 0 ? row.iv : null;
    }

    static optionPivot_(options, expiration, fallbackSpot) {
        if (!options?.ok) return [];
        const spot = CFAnalysisVisuals.number_(options.underlyingPrice) ?? CFAnalysisVisuals.number_(fallbackSpot);
        const contracts = (options.contracts || []).filter(row => row.expiration === expiration && CFAnalysisVisuals.number_(row.strike) !== null && row.strike > 0)
            .sort((a, b) => (spot !== null ? Math.abs(a.strike - spot) - Math.abs(b.strike - spot) : 0) || a.strike - b.strike).slice(0, 200);
        const strikes = new Map();
        for (const contract of contracts) {
            const type = String(contract.type).toUpperCase();
            if (!["CALL", "PUT"].includes(type)) continue;
            if (!strikes.has(contract.strike)) strikes.set(contract.strike, { strike: contract.strike, callIv: null, putIv: null, callOi: null, putOi: null });
            const row = strikes.get(contract.strike), prefix = type === "CALL" ? "call" : "put";
            row[prefix + "Iv"] = CFAnalysisVisuals.usableIv_(contract);
            row[prefix + "Oi"] = CFAnalysisVisuals.number_(contract.openInterest) !== null && contract.openInterest >= 0 ? contract.openInterest : null;
        }
        return [...strikes.values()].sort((a, b) => a.strike - b.strike);
    }

    static render(book, snapshot) {
        CFAnalysisVisuals.check(book);
        const ticker = String(book.getSheetByName("Analysis").getRange("B4").getValue()).trim().toUpperCase();
        if (!snapshot || String(snapshot.ticker).trim().toUpperCase() !== ticker) throw new Error("The ticker changed during refresh. Refresh research charts again.");
        for (const name of ["Price history", "Macro", "Options"]) {
            const existing = book.getSheetByName(name);
            if (existing && existing.getRange("Z1").getValue() !== "CACHEFINANCE_ANALYSIS_V1") throw new Error("Rebuild the managed analysis tabs before adding research charts.");
        }
        let sheet = book.getSheetByName(CF_RESEARCH_NAME_);
        if (!sheet) sheet = book.insertSheet(CF_RESEARCH_NAME_);
        if (sheet.getMaxColumns() < 26) sheet.insertColumnsAfter(sheet.getMaxColumns(), 26 - sheet.getMaxColumns());
        CFAnalysisVisuals.clear_(sheet);
        sheet.getRange(1, 1, 80, 25).setFontFamily("Arial").setFontSize(10);
        sheet.setHiddenGridlines(true); sheet.setFrozenRows(6); sheet.setColumnWidths(1, 25, 105);
        sheet.setColumnWidth(1, 135); sheet.setColumnWidth(3, 125); sheet.setColumnWidth(4, 125); sheet.setColumnWidth(12, 290); sheet.hideColumns(26);
        sheet.getRange("Z1").setValue(CF_RESEARCH_MARKER_);
        sheet.getRange("A1:L1").merge().setValue(CFAnalysisSheets.safe_(ticker + " — Earnings and research charts")).setFontSize(14).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2:L2").merge().setValue("Published periods and accounting bases stay separate. Missing values remain blank in chart data.").setFontColor("#596579");
        sheet.getRange("A3").setValue("Loaded ticker"); sheet.getRange("B3").setValue(CFAnalysisSheets.safe_(ticker));
        sheet.getRange("D3").setValue("Refreshed"); sheet.getRange("E3").setValue(CFAnalysisSheets.date_(snapshot.fetchedAt, book) || "N/A").setNumberFormat("mmm d, hh:mm");
        const next = snapshot.details?.nextEarnings || {}, nextDate = next.dates?.[0];
        sheet.getRange("A4").setValue("Next earnings"); sheet.getRange("B4").setValue(CFAnalysisSheets.date_(nextDate, book) || "N/A").setNumberFormat("yyyy-mm-dd");
        sheet.getRange("C4:E4").merge().setValue(next.estimated === true ? "Estimated date" : next.estimated === false ? "Provider marks confirmed" : "Date status not supplied");
        const summary = CFAnalysisVisuals.summarize(snapshot.details || {});
        CFAnalysisSheets.table_(sheet, 7, 1, ["EPS basis", "Provider fiscal period", "Actual EPS", "Estimate EPS", "Surprise % points", "Reported", "Currency"], summary.earnings.map(row => [row.basis, row.period, row.actual, row.estimate, row.surprisePct, CFAnalysisSheets.date_(row.reportedDate, book), row.currency || ""]));
        if (summary.earnings.length) { sheet.getRange(8, 3, summary.earnings.length, 3).setNumberFormat("0.00"); sheet.getRange(8, 6, summary.earnings.length, 1).setNumberFormat("yyyy-mm-dd"); }
        CFAnalysisSheets.table_(sheet, 13, 1, ["Basis", "Frequency", "Latest period", "Revenue", "Revenue growth", "Net income", "Income growth", "Net margin", "Margin Δ pp", "Compared with", "Currency", "Comparison note"], summary.financials.map(row => [row.basis, row.frequency, row.period, row.revenue, row.revenueGrowth, row.netIncome, row.netIncomeGrowth, row.margin, row.marginChangePp, row.previousPeriod, row.currency || "", row.comparison + "; " + row.note]));
        if (summary.financials.length) {
            summary.financials.forEach((row, index) => {
                sheet.getRange(index + 14, 4).setNumberFormat(CFAnalysisVisuals.moneyFormat_(row.revenue));
                sheet.getRange(index + 14, 6).setNumberFormat(CFAnalysisVisuals.moneyFormat_(row.netIncome));
            });
            sheet.getRangeList(["E14:E" + (13 + summary.financials.length), "G14:H" + (13 + summary.financials.length)]).setNumberFormat("0.00%"); sheet.getRange(14, 9, summary.financials.length, 1).setNumberFormat("0.00"); sheet.getRange(14, 12, summary.financials.length, 1).setWrap(true);
        }
        sheet.getRange("A20:L20").merge().setValue("Quarterly growth is QoQ; annual growth is YoY. Comparisons require consecutive published periods, the same basis and currency. Nonpositive prior values have no growth percentage.").setWrap(true);
        sheet.getRange("A21:L21").merge().setValue("EPS uses provider fiscal labels; financial charts retain provider financial-period labels. IV requires noncrossed quotes with a positive ask. Source data remains in the analysis tabs.").setWrap(true);
        sheet.getRange("A22:L22").merge().setValue(CFAnalysisSheets.safe_(summary.notes.join(" ") || "Comparisons use provider-reported actuals. Estimates and accounting bases stay separate.")).setWrap(true);
        const series = snapshot.technical?.series || [], history = book.getSheetByName("Price history");
        let index = 0, cursor = 7;
        const addDataChart = (headers, values, title, type = "LINE", options = {}) => {
            if (values.length < 2 || !values.some(row => row.slice(1).some(value => CFAnalysisVisuals.number_(value) !== null))) return;
            const data = CFAnalysisVisuals.dataset_(sheet, cursor, 15, headers, values);
            if (options.vAxis?.format === "percent") sheet.getRange(data.row + 1, data.col + 1, values.length, headers.length - 1).setNumberFormat("0.00%");
            cursor += values.length + 3;
            CFAnalysisVisuals.addChart_(sheet, sheet, [data], ticker + " — " + title, index++, type, options);
        };
        if (history && series.length) {
            const count = Math.min(series.length, 126), row = 8 + series.length - count;
            if (series.some(value => CFAnalysisVisuals.number_(value.volume) !== null)) CFAnalysisVisuals.addChart_(sheet, history, [{ row, col: 1, count }, { row, col: 7, count }], ticker + " — Daily volume; latest session may be partial", index++, "COLUMN", { legend: { position: "none" }, vAxis: { title: "Shares", format: "short" } }, 0);
            if (series.some(value => CFAnalysisVisuals.number_(value.macd) !== null)) CFAnalysisVisuals.addChart_(sheet, history, [1, 13, 14, 15].map(col => ({ row, col, count })), ticker + " — MACD / signal / histogram", index++, "COMBO", { series: { 0: { type: "line", labelInLegend: "MACD" }, 1: { type: "line", labelInLegend: "Signal" }, 2: { type: "bars", labelInLegend: "Histogram" } }, vAxis: { title: snapshot.chart?.currency || "Yahoo close units" } }, 0);
        }
        for (const group of summary.earningsGroups) addDataChart(["Fiscal period", "Actual EPS", "Estimate EPS"], group.rows.map(row => [row.period, row.actual, row.estimate]), group.basis + " EPS actual / estimate (" + (group.currency || "currency unknown") + ")", "COLUMN", { vAxis: { title: group.currency || "Currency not supplied" } });
        for (const group of summary.financialGroups) addDataChart(["Provider period", "Revenue", "Net income"], group.rows.map(row => [row.period, row.revenue, row.netIncome]), group.basis + " " + group.frequency.toLowerCase() + " revenue / net income (" + group.currency + ")", "COLUMN", { vAxis: { title: group.currency, format: "short" } });
        const optionSheet = book.getSheetByName("Options");
        const chosen = optionSheet?.getRange("B4").getValue();
        const expiration = typeof chosen === "string" && /^\d{4}-\d{2}-\d{2}$/.test(chosen) ? chosen : snapshot.options?.contracts?.[0]?.expiration || "";
        const pivot = CFAnalysisVisuals.optionPivot_(snapshot.options, expiration, snapshot.chart?.price);
        addDataChart(["Strike", "Call IV", "Put IV"], pivot.map(row => [row.strike, row.callIv, row.putIv]), expiration + " IV by strike; nearest 200 contracts", "LINE", { vAxis: { title: "Implied volatility", format: "percent" }, hAxis: { title: "Strike" } });
        addDataChart(["Strike", "Call open interest", "Put open interest"], pivot.map(row => [row.strike, row.callOi, row.putOi]), expiration + " open interest by strike", "COLUMN", { isStacked: true, hAxis: { title: "Strike" }, vAxis: { title: "Contracts", format: "short" } });
        const maturityRows = (snapshot.optionMaturities?.rows || []).filter(row => typeof row.expiration === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.expiration)).slice().sort((a, b) => a.expiration.localeCompare(b.expiration));
        CFAnalysisSheets.table_(sheet, 24, 1, ["Expiration", "Call strike", "Call mid", "Call spread", "Call IV", "Call OI", "Call volume", "Put strike", "Put mid", "Put spread", "Put IV", "Put OI", "Put volume", "Status"], maturityRows.map(row => [CFAnalysisSheets.date_(row.expiration, book), row.call?.strike, row.call?.mid, row.call?.spread, row.call?.iv, row.call?.openInterest, row.call?.volume, row.put?.strike, row.put?.mid, row.put?.spread, row.put?.iv, row.put?.openInterest, row.put?.volume, row.status]));
        if (maturityRows.length) {
            sheet.getRange(25, 1, maturityRows.length, 1).setNumberFormat("yyyy-mm-dd"); sheet.getRange(25, 2, maturityRows.length, 12).setNumberFormat("0.00");
            sheet.getRangeList(["E25:E" + (24 + maturityRows.length), "K25:K" + (24 + maturityRows.length)]).setNumberFormat("0.00%");
            sheet.getRangeList(["F25:G" + (24 + maturityRows.length), "L25:M" + (24 + maturityRows.length)]).setNumberFormat("#,##0");
        }
        addDataChart(["Expiration", "Call IV", "Put IV", "Same-strike ATM IV"], maturityRows.map(row => [CFAnalysisSheets.date_(row.expiration, book), row.call?.iv ?? null, row.put?.iv ?? null, row.atmIV ?? null]), "ATM IV by expiration", "LINE", { vAxis: { title: "Implied volatility", format: "percent" } });
        let fredColumn = 15;
        const fredRow = Math.max(600, cursor + 5);
        for (const fred of (snapshot.fred || []).slice(0, 4)) {
            const rows = (fred.observations || []).slice(-400);
            if (snapshot.ok !== false && fred.ok && rows.length > 1 && rows.some(row => CFAnalysisVisuals.number_(row.value) !== null)) {
                const data = CFAnalysisVisuals.dataset_(sheet, fredRow, fredColumn, [fred.label || fred.seriesId, "Level"], rows.map(row => [CFAnalysisSheets.date_(row.date, book), row.value]), true);
                CFAnalysisVisuals.addChart_(sheet, sheet, [data], ticker + " context — FRED " + fred.seriesId + " (" + fred.unit + ")", index++, "LINE", { legend: { position: "none" }, vAxis: { title: fred.unit } });
            }
            fredColumn += 2;
        }
        sheet.getRange("D3").setValue("Refreshed"); sheet.getRange("H3").setValue("Charts"); sheet.getRange("I3").setValue(index);
        if (!index) sheet.getRange("A24").setValue("No accepted chart data is available for this ticker.");
        const providerRows = [];
        for (const provider of snapshot.additionalProviders || []) {
            const fields = Object.entries(provider.fields || {});
            if (!fields.length) providerRows.push([provider.provider || provider.name || "Additional provider", "Provider request", provider.status || (provider.ok ? "Available" : "Unavailable"), null, "", "", CFAnalysisSheets.source_(provider.source)]);
            for (const [id, field] of fields) providerRows.push([provider.provider || provider.name || "Additional provider", field.label || id, field.status || (field.value == null ? "Unavailable" : "Available"), field.value, field.unit || "", field.unit === "currency" ? field.currency || "" : "", CFAnalysisSheets.source_(field.source || provider.source)]);
        }
        if (providerRows.length) {
            const row = 35 + Math.ceil(index / 2) * 18 + 5;
            CFAnalysisSheets.rows_(sheet, row + providerRows.length + 1);
            sheet.getRange(row + 1, 4, providerRows.length, 1).setNumberFormat("#,##0.00");
            const dates = providerRows.flatMap((value, i) => value[4] === "date text" ? ["D" + (row + 1 + i)] : []);
            if (dates.length) sheet.getRangeList(dates).setNumberFormat("@");
            CFAnalysisSheets.table_(sheet, row, 1, ["Additional provider", "Field", "Status", "Value", "Unit", "Currency", "Public source"], providerRows);
            const percentages = providerRows.flatMap((value, i) => value[4] === "fraction" ? ["D" + (row + 1 + i)] : []);
            if (percentages.length) sheet.getRangeList(percentages).setNumberFormat("0.00%");
            sheet.getRange(row + 1, 7, providerRows.length, 1).setWrap(false);
        }
        return CFAnalysisVisuals.inspect(book);
    }

    static inspect(book) {
        CFAnalysisVisuals.check(book);
        const sheet = book.getSheetByName(CF_RESEARCH_NAME_);
        if (!sheet) return { ticker: "", chartTitles: [], summaryRows: 0, comparisonRows: 0 };
        return { ticker: sheet.getRange("B3").getValue() || "", chartTitles: sheet.getCharts().map(chart => String(chart.getOptions().get("title") || "")),
            maturityRows: sheet.getRange("A25:N29").getValues().filter(row => row[0] instanceof Date).map(row => ({ expiration: row[0], callStrike: row[1], callIV: row[4], callOI: row[5], putStrike: row[7], putIV: row[10], putOI: row[11], status: row[13] })),
            summaryRows: sheet.getRange("A8:G11").getValues().filter(row => ["GAAP", "Adjusted"].includes(row[0])).length,
            comparisonRows: sheet.getRange("A14:L18").getValues().filter(row => ["GAAP", "Adjusted"].includes(row[0]) && ["Annual", "Quarterly"].includes(row[1])).length };
    }
}
