/*  *** DEBUG START ***
import { CFAnalysisData } from "./CacheFinanceAnalysisData.js";
import { CFAnalysisDetails } from "./CacheFinanceAnalysisDetails.js";
import { CFAnalysisFred } from "./CacheFinanceAnalysisFred.js";
import { CFAnalysisOptions } from "./CacheFinanceAnalysisOptions.js";
import { CFAnalysisSheets } from "./CacheFinanceAnalysisSheets.js";
import { GoogleWebSiteFinance, GlobeAndMail, YahooFinance } from "./CacheFinanceWebSites.js";
export { CFAnalysisService, CFBuildAnalysis, CFRefreshAnalysis, CFCheckAnalysisSources, CFInspectAnalysis, CFAnalysisMenu_, CFAnalysisHandleEdit_ };
//  *** DEBUG END ***/

/** Menu-driven requests have Apps Script's normal execution limit, not a custom function's 30 seconds. */
class CFAnalysisService {
    static chartUrl(symbol) {
        return "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol)
            + "?range=2y&interval=1d&events=div%2Csplits&includeAdjustedClose=true";
    }

    static collect(input, expiration = "", dependencies = {}) {
        const fetch = dependencies.fetch || ((url, options) => UrlFetchApp.fetch(url, options));
        const clock = dependencies.clock || (() => Date.now());
        const normalized = CFAnalysisData.normalizeTicker(input);
        const symbol = normalized.yahooSymbol;
        const quoteUrl = "https://finance.yahoo.com/quote/" + encodeURIComponent(symbol) + "/";
        const sources = [];
        const request = (provider, scope, url, publicSource = url.split("?")[0]) => {
            const row = { provider, scope, http: null, status: "Unavailable", identity: "Unknown", retrievedAt: new Date(clock()).toISOString(), quoteTime: null, note: "", source: publicSource };
            sources.push(row);
            try {
                const response = fetch(url, { method: "get", muteHttpExceptions: true, followRedirects: true });
                row.http = response.getResponseCode(); row.retrievedAt = new Date(clock()).toISOString();
                if (row.http < 200 || row.http >= 300) { row.status = "HTTP " + row.http; row.note = "The provider did not return accepted data."; return { row, body: "" }; }
                return { row, body: response.getContentText() };
            } catch { row.status = "Request failed"; row.note = "The request could not be completed."; return { row, body: "" }; }
        };
        const parsedStatus = (requestResult, parsed, identity = "Matched") => {
            if (parsed.ok) { requestResult.row.status = "Available"; requestResult.row.identity = identity; }
            else if (requestResult.body) { requestResult.row.status = "Data unavailable"; requestResult.row.note = parsed.error || "The response did not supply the requested fields."; }
            return parsed;
        };

        const chartRequest = request("Yahoo Chart", "Quote and two-year daily history", CFAnalysisService.chartUrl(symbol));
        const chart = parsedStatus(chartRequest, CFAnalysisData.parseChart(chartRequest.body, symbol));
        chartRequest.row.quoteTime = chart.quoteTime || null;
        const pageRequest = request("Yahoo Finance", "Fundamentals, earnings and estimates", quoteUrl);
        const statistics = CFAnalysisData.parseStatistics(pageRequest.body, symbol);
        const details = CFAnalysisDetails.parsePage(pageRequest.body, symbol);
        parsedStatus(pageRequest, details.ok ? details : statistics);
        if (details.ok && !statistics.ok) pageRequest.row.note = "Embedded quote details supplied the data; visible statistics were unavailable.";
        const technical = CFAnalysisData.calculate(chart.history || []);
        const snapshot = { ok: chart.ok || details.ok || statistics.ok, ticker: normalized.input, symbol,
            cacheSymbol: chart.cacheSymbol || normalized.cacheSymbol || null, fetchedAt: new Date(clock()).toISOString(), chart,
            technical, statistics, details, benchmarks: {}, quoteSources: [], options: { ok: false, symbol, http: null, expirations: [], contracts: [], error: "No option data returned." }, fred: [], sources };
        if (!snapshot.ok) return snapshot;

        snapshot.quoteSources.push({ provider: "Yahoo Chart", price: chart.price ?? null, yieldFraction: null,
            identity: chart.ok ? "Matched" : "Unknown", quoteTime: chart.quoteTime || null, retrievedAt: chartRequest.row.retrievedAt,
            status: chartRequest.row.status, note: "Regular-market quote. History and indicators use Yahoo daily closes.", source: chartRequest.row.source });
        const basicQuote = pageRequest.body ? YahooFinance.parseResponse(pageRequest.body, symbol) : null;
        snapshot.quoteSources.push({ provider: "Yahoo Finance", price: basicQuote?.stockPrice ?? null, yieldFraction: basicQuote?.yieldPct ?? null,
            identity: basicQuote?.stockName ? "Name matched" : "Unknown", quoteTime: null, retrievedAt: pageRequest.row.retrievedAt,
            status: basicQuote?.stockPrice !== null && basicQuote?.stockPrice !== undefined ? "Available" : "Data unavailable",
            note: "Stock yield is forward yield; ETF yield follows the provider's label.", source: quoteUrl });

        for (const benchmark of ["SPY", "QQQ"]) {
            const response = request("Yahoo Chart", benchmark + " benchmark history", CFAnalysisService.chartUrl(benchmark));
            const parsed = parsedStatus(response, CFAnalysisData.parseChart(response.body, benchmark));
            response.row.quoteTime = parsed.quoteTime || null;
            snapshot.benchmarks[benchmark] = { chart: parsed, comparison: CFAnalysisData.compare(chart.history || [], parsed.history || []) };
        }

        if (snapshot.cacheSymbol) {
            for (const [provider, adapter] of [["Google Finance", GoogleWebSiteFinance], ["Globe & Mail", GlobeAndMail]]) {
                const url = adapter.getURL(snapshot.cacheSymbol, "PRICE");
                if (!url) { sources.push({ provider, scope: "Comparison quote", status: "Unsupported ticker", http: null, identity: "Unknown", retrievedAt: null, quoteTime: null, source: "", note: "This adapter does not support the selected ticker." }); continue; }
                const response = request(provider, "Comparison quote", url);
                let parsed = null, metadata = { identity: "Unknown", timestamp: "Unknown" };
                try { if (response.body) { parsed = adapter.parseResponse(response.body, snapshot.cacheSymbol); metadata = adapter.sourceDetails(response.body, snapshot.cacheSymbol); } } catch { /* Keep this source unavailable. */ }
                const okay = typeof parsed?.stockPrice === "number" && Number.isFinite(parsed.stockPrice) && parsed.stockPrice > 0;
                if (response.body) response.row.status = okay ? "Available" : "Data unavailable";
                response.row.identity = metadata.identity; response.row.quoteTime = metadata.timestamp === "Unknown" ? null : metadata.timestamp;
                snapshot.quoteSources.push({ provider, price: okay ? parsed.stockPrice : null, yieldFraction: parsed?.yieldPct ?? null,
                    identity: response.row.identity, quoteTime: response.row.quoteTime, retrievedAt: response.row.retrievedAt,
                    status: response.row.status, source: response.row.source, note: provider === "Globe & Mail" ? "Trailing stock yield or provider distribution yield." : "Provider-published yield when available." });
            }
        }

        try { snapshot.options = CFAnalysisOptions.fetchChain(symbol, expiration || null, fetch); }
        catch { snapshot.options = { ok: false, symbol, http: null, expirations: [], contracts: [], error: "Yahoo options request could not be completed." }; }
        sources.push({ provider: "Yahoo options", scope: "Expiration dates and selected option chain", http: snapshot.options.http ?? null,
            status: snapshot.options.ok ? "Available" : "Data unavailable", identity: snapshot.options.ok ? "Matched" : "Unknown",
            retrievedAt: new Date(clock()).toISOString(), quoteTime: snapshot.options.quoteTime || null,
            note: snapshot.options.ok ? "Anonymous Yahoo session, as used by the SMF Mac port." : snapshot.options.error,
            source: "https://query1.finance.yahoo.com/v7/finance/options/" + encodeURIComponent(symbol) });

        const fredKey = typeof dependencies.fredKey === "string" ? dependencies.fredKey.trim() : "";
        for (const series of CFAnalysisFred.registry()) {
            if (!fredKey) {
                snapshot.fred.push({ ok: false, ...series, latest: null, change: null, observations: [], status: "API key required", error: "Enter your FRED key through CacheFinance → API keys…", source: "https://fred.stlouisfed.org/series/" + series.seriesId, retrievedAt: null });
                sources.push({ provider: "FRED", scope: series.seriesId + " observations", status: "API key required", http: null, identity: "Requested series", retrievedAt: null, quoteTime: null, source: "https://fred.stlouisfed.org/series/" + series.seriesId, note: "Enter your FRED key through CacheFinance → API keys…" });
                continue;
            }
            try {
                const url = CFAnalysisFred.buildUrl(series.seriesId, fredKey, 400);
                const response = request("FRED", series.seriesId + " observations", url, "https://fred.stlouisfed.org/series/" + series.seriesId);
                const parsed = parsedStatus(response, CFAnalysisFred.parseObservations(response.body, series.seriesId), "Requested series");
                response.row.quoteTime = parsed.latest?.date || null;
                snapshot.fred.push({ ...parsed, status: response.row.status, retrievedAt: response.row.retrievedAt });
            } catch {
                snapshot.fred.push({ ok: false, ...series, latest: null, change: null, observations: [], status: "Check API key", error: "Check your FRED API key in the settings menu.", source: "https://fred.stlouisfed.org/series/" + series.seriesId, retrievedAt: null });
            }
        }
        snapshot.fetchedAt = new Date(clock()).toISOString();
        return snapshot;
    }

    static summary(snapshot) {
        return { ok: snapshot.ok, ticker: snapshot.ticker, symbol: snapshot.symbol, historyRows: snapshot.chart.history?.length || 0,
            fundamentalFields: Object.keys(snapshot.details.fields || {}).length, earningsRows: snapshot.details.earnings?.length || 0,
            estimateRows: snapshot.details.estimates?.length || 0, optionContracts: snapshot.options.contracts?.length || 0,
            fredAvailable: snapshot.fred.filter(row => row.ok).map(row => row.seriesId),
            sources: snapshot.sources.map(row => ({ provider: row.provider, scope: row.scope, status: row.status, http: row.http })) };
    }
}

function CFAnalysisMenu_() {
    SpreadsheetApp.getUi().createMenu("Stock analysis")
        .addItem("Build analysis sheets", "CFBuildAnalysis")
        .addItem("Refresh selected ticker", "CFRefreshAnalysis")
        .addSeparator().addItem("Check provider data", "CFCheckAnalysisSources")
        .addItem("Check analysis sheets", "CFInspectAnalysis").addToUi();
}

function CFBuildAnalysis() {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    if (!book) throw new Error("Open the spreadsheet before building the analysis.");
    CFAnalysisSheets.build(book);
    return CFRefreshAnalysis();
}

function CFRefreshAnalysis() {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    if (!book) throw new Error("Open the analysis spreadsheet first.");
    const lock = LockService.getDocumentLock();
    if (!lock || !lock.tryLock(1000)) { book.toast("Another refresh is running. Wait for it to finish.", "Stock analysis", 8); return { ok: false, error: "Another refresh is running." }; }
    let phase = "read inputs";
    try {
        const input = CFAnalysisSheets.readInput(book);
        const requestedExpiration = input.loadedTicker !== undefined && input.loadedTicker !== input.ticker ? "" : input.expiration;
        phase = "clear prior data";
        CFAnalysisSheets.invalidate(book, "Refreshing " + String(input.ticker).trim().toUpperCase() + "…");
        SpreadsheetApp.flush();
        phase = "fetch data";
        const snapshot = CFAnalysisService.collect(input.ticker, requestedExpiration,
            { fredKey: PropertiesService.getScriptProperties().getProperty("FRED_API_KEY") || "" });
        const current = CFAnalysisSheets.readInput(book);
        if (String(current.ticker).trim().toUpperCase() !== String(input.ticker).trim().toUpperCase()) {
            CFAnalysisSheets.status(book, "Ticker changed during refresh. Refresh the selected ticker again.");
            return { ok: false, error: "Ticker changed during refresh." };
        }
        if (String(current.expiration || "") !== String(requestedExpiration || "")) {
            CFAnalysisSheets.status(book, "Expiration changed during refresh. Refresh the selected ticker again.");
            return { ok: false, error: "Expiration changed during refresh." };
        }
        phase = "write analysis";
        CFAnalysisSheets.render(book, snapshot);
        if (typeof CFAnalysisCalculatorSheets !== "undefined") CFAnalysisCalculatorSheets.render(book, snapshot);
        SpreadsheetApp.flush();
        const summary = CFAnalysisService.summary(snapshot);
        console.log("CF_ANALYSIS_REFRESH " + JSON.stringify(summary));
        book.toast(snapshot.ok ? "Analysis updated. See CF Sources for availability and quote times." : "No matching quote data returned. Check the ticker and CF Sources.", "Stock analysis", 10);
        return summary;
    } catch (_error) {
        console.log("CF_ANALYSIS_ERROR " + JSON.stringify({ phase }));
        CFAnalysisSheets.status(book, "Unable to refresh. Check the ticker and try again.");
        return { ok: false, error: "Unable to refresh. Check the ticker and try again." };
    } finally { lock.releaseLock(); }
}

function CFCheckAnalysisSources() {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    const input = book?.getSheetByName("CF Analysis") ? CFAnalysisSheets.readInput(book) : { ticker: "NVDA", expiration: "" };
    const result = CFAnalysisService.collect(input.ticker, input.expiration,
        { fredKey: PropertiesService.getScriptProperties().getProperty("FRED_API_KEY") || "" });
    const summary = CFAnalysisService.summary(result);
    console.log("CF_ANALYSIS_PROVIDERS " + JSON.stringify(summary));
    return summary;
}

function CFInspectAnalysis() {
    const report = CFAnalysisSheets.inspect(SpreadsheetApp.getActiveSpreadsheet());
    console.log("CF_ANALYSIS_CHECK " + JSON.stringify(report));
    return report;
}

/** Simple onEdit only clears stale data; menu refresh performs authorized requests. */
function CFAnalysisHandleEdit_(event) {
    if (!event?.range) return;
    const range = event.range;
    const sheet = range.getSheet();
    if (range.getRow() > 4 || range.getLastRow() < 4 || range.getColumn() > 2 || range.getLastColumn() < 2) return;
    if (sheet.getName() === "CF Analysis") CFAnalysisSheets.invalidate(event.source, "Ticker changed. Choose Stock analysis → Refresh selected ticker.");
    else if (sheet.getName() === "CF Options" && typeof CFAnalysisSheets.invalidateOptions === "function") CFAnalysisSheets.invalidateOptions(event.source, "Expiration changed. Refresh the selected ticker.");
}
