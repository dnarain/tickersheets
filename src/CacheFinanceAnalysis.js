/*  *** DEBUG START ***
import { CFAnalysisData } from "./CacheFinanceAnalysisData.js";
import { CFAnalysisDetails } from "./CacheFinanceAnalysisDetails.js";
import { CFAnalysisFred } from "./CacheFinanceAnalysisFred.js";
import { CFAnalysisOptions } from "./CacheFinanceAnalysisOptions.js";
import { CFAnalysisSheets } from "./CacheFinanceAnalysisSheets.js";
import { GoogleWebSiteFinance, GlobeAndMail, YahooFinance } from "./CacheFinanceWebSites.js";
export { CFAnalysisService, CFBuildAnalysis, CFRefreshAnalysis, CFCheckAnalysisSources, CFInspectAnalysis, CFInspectWorkspace, CFCheckTemplateKeys, CFCheckExpandedSources, CFAnalysisMenu_, CFAnalysisHandleEdit_ };
//  *** DEBUG END ***/

/** Menu-driven requests have Apps Script's normal execution limit, not a custom function's 30 seconds. */
class CFAnalysisService {
    /** Put owned research tabs first without changing the order or contents of other tabs. */
    static arrange(book) {
        if (!book || typeof book.getSheetByName !== "function" || typeof book.setActiveSheet !== "function" || typeof book.moveActiveSheet !== "function") return [];
        const base = "CACHEFINANCE_ANALYSIS_V1";
        const order = [
            ["Analysis", base], ["Research", "CACHEFINANCE_RESEARCH_V1"], ["Options", base],
            ["Strategies", "CACHEFINANCE_STRATEGIES_V1"], ["Watchlist", "CACHEFINANCE_WATCHLIST_V1"],
            ["Journal", "CACHEFINANCE_JOURNAL_V1"], ["Fundamentals", base], ["Earnings", base],
            ["Macro", base], ["Formulas", "CACHEFINANCE_FUNCTIONS_V1"], ["Price history", base],
            ["Sources", base], ["Chart links", "CACHEFINANCE_IMAGES_V1"]
        ];
        const owned = order.flatMap(([name, marker]) => {
            const sheet = book.getSheetByName(name);
            return sheet && sheet.getRange("Z1").getValue() === marker ? [{ name, sheet }] : [];
        });
        owned.forEach(({ sheet }, index) => { book.setActiveSheet(sheet); book.moveActiveSheet(index + 1); });
        const main = owned.find(row => row.name === "Analysis");
        if (main) {
            book.setActiveSheet(main.sheet);
            const input = main.sheet.getRange("B4");
            if (typeof input.activate === "function") input.activate();
        }
        return owned.map(row => row.name);
    }

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
            technical, statistics, details, benchmarks: {}, quoteSources: [], options: { ok: false, symbol, http: null, expirations: [], contracts: [], error: "No option data returned." }, optionMaturities: { ok: false, symbol, rows: [] }, additionalProviders: [], fred: [], sources };
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

        let optionSession;
        try {
            optionSession = CFAnalysisOptions.createSession(fetch);
            snapshot.options = CFAnalysisOptions.fetchChain(symbol, expiration || null, fetch, optionSession);
        }
        catch { snapshot.options = { ok: false, symbol, http: null, expirations: [], contracts: [], error: "Yahoo options request could not be completed." }; }
        if (snapshot.options.ok && dependencies.includeMaturities !== false && typeof CFAnalysisOptions.fetchMaturities === "function") {
            try { snapshot.optionMaturities = CFAnalysisOptions.fetchMaturities(symbol, snapshot.options, fetch, optionSession, { asOf: new Date(clock()).toISOString().slice(0, 10), count: 5 }); }
            catch { snapshot.optionMaturities = { ok: false, symbol, rows: [], error: "Options maturity comparison unavailable." }; }
        }
        sources.push({ provider: "Yahoo options", scope: "Expiration dates and selected option chain", http: snapshot.options.http ?? null,
            status: snapshot.options.ok ? "Available" : "Data unavailable", identity: snapshot.options.ok ? "Matched" : "Unknown",
            retrievedAt: new Date(clock()).toISOString(), quoteTime: snapshot.options.quoteTime || null,
            note: snapshot.options.ok ? "Anonymous Yahoo session; no personal login required." : snapshot.options.error,
            source: "https://query1.finance.yahoo.com/v7/finance/options/" + encodeURIComponent(symbol) });

        const loadedExpiry = snapshot.options.contracts?.[0]?.expiration;
        for (const row of snapshot.optionMaturities.rows || []) {
            if (row.expiration === loadedExpiry) continue;
            sources.push({ provider: "Yahoo options", scope: "ATM comparison: " + row.expiration, http: row.http ?? null,
                status: row.status || "Data unavailable", identity: row.status === "Available" ? "Matched" : "Unknown",
                retrievedAt: new Date(clock()).toISOString(), quoteTime: row.quoteTime === "Unknown" ? null : row.quoteTime,
                note: row.error || "One shared anonymous Yahoo session; missing legs and IV remain unavailable.", source: row.source });
        }

        if (dependencies.includeProviders !== false && typeof CFSmfProviders !== "undefined") {
            for (const provider of CFSmfProviders.registry()) {
                const data = CFSmfProviders.fetch(provider.provider, symbol, { fetch, clock });
                snapshot.additionalProviders.push(data);
                sources.push({ provider: provider.label, scope: "Selected provider fields", http: data.http, status: data.status, identity: data.identity,
                    retrievedAt: data.retrievedAt, quoteTime: data.quoteTime, note: data.error || "Fields keep their provider units and labels.", source: data.source });
            }
        }

        const fredKey = typeof dependencies.fredKey === "string" ? dependencies.fredKey.trim() : "";
        for (const series of CFAnalysisFred.registry()) {
            if (!fredKey) {
                snapshot.fred.push({ ok: false, ...series, latest: null, change: null, observations: [], status: "API key required", error: "Enter your FRED key through Data settings → API keys…", source: "https://fred.stlouisfed.org/series/" + series.seriesId, retrievedAt: null });
                sources.push({ provider: "FRED", scope: series.seriesId + " observations", status: "API key required", http: null, identity: "Requested series", retrievedAt: null, quoteTime: null, source: "https://fred.stlouisfed.org/series/" + series.seriesId, note: "Enter your FRED key through Data settings → API keys…" });
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
            displayedQuote: CFAnalysisData.selectQuote(snapshot.chart, snapshot.details),
            fundamentalFields: Object.keys(snapshot.details.fields || {}).length, earningsRows: snapshot.details.earnings?.length || 0,
            estimateRows: snapshot.details.estimates?.length || 0, optionContracts: snapshot.options.contracts?.length || 0,
            optionMaturities: (snapshot.optionMaturities?.rows || []).map(row => ({ expiration: row.expiration, status: row.status, http: row.http, atmIV: row.atmIV })),
            additionalProviders: (snapshot.additionalProviders || []).map(row => ({ provider: row.provider, status: row.status, http: row.http, availableFields: Object.values(row.fields || {}).filter(field => field.value !== null && field.value !== undefined).length })),
            fredAvailable: snapshot.fred.filter(row => row.ok).map(row => row.seriesId),
            sources: snapshot.sources.map(row => ({ provider: row.provider, scope: row.scope, status: row.status, http: row.http })) };
    }
}

function CFAnalysisMenu_() {
    SpreadsheetApp.getUi().createMenu("Stock analysis")
        .addItem("Build analysis sheets", "CFBuildAnalysis")
        .addItem("Refresh selected ticker", "CFRefreshAnalysis")
        .addSeparator().addItem("Build watchlist", "CFBuildWatchlist").addItem("Refresh watchlist", "CFRefreshWatchlist")
        .addItem("Build formula examples", "CFBuildFormulaExamples").addItem("Refresh formula examples", "CFRefreshFormulaExamples")
        .addItem("Provider chart links", "CFLoadProviderImages")
        .addSeparator().addItem("Check provider data", "CFCheckAnalysisSources")
        .addItem("Check additional providers", "CFCheckExpandedSources")
        .addItem("Build lookup checks", "CFBuildLookupChecks").addItem("Inspect lookup checks", "CFInspectLookupChecks")
        .addItem("Check analysis sheets", "CFInspectAnalysis").addItem("Check all research sheets", "CFInspectWorkspace").addToUi();
}

function CFBuildAnalysis() {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    if (!book) throw new Error("Open the spreadsheet before building the analysis.");
    if (typeof CFAnalysisSheets.check_ === "function") CFAnalysisSheets.check_(book);
    if (typeof CFAnalysisVisuals !== "undefined") CFAnalysisVisuals.check(book, false);
    if (typeof CFAnalysisStrategies !== "undefined") CFAnalysisStrategies.check(book);
    if (typeof CFWatchlist !== "undefined") CFWatchlist.check(book);
    if (typeof CFFunctionExamples !== "undefined") CFFunctionExamples.check(book);
    CFAnalysisSheets.build(book);
    if (typeof CFWatchlist !== "undefined") CFWatchlist.build(book);
    if (typeof CFFunctionExamples !== "undefined") CFFunctionExamples.build(book);
    const result = CFRefreshAnalysis();
    CFAnalysisService.arrange(book);
    return result;
}

function CFRefreshAnalysis() {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    if (!book) throw new Error("Open the analysis spreadsheet first.");
    const lock = LockService.getDocumentLock();
    if (!lock || !lock.tryLock(1000)) { book.toast("Another refresh is running. Wait for it to finish.", "Stock analysis", 8); return { ok: false, error: "Another refresh is running." }; }
    let phase = "read inputs";
    try {
        const input = CFAnalysisSheets.readInput(book);
        if (typeof CFAnalysisVisuals !== "undefined") CFAnalysisVisuals.check(book);
        if (typeof CFAnalysisStrategies !== "undefined") CFAnalysisStrategies.check(book);
        if (typeof CFWatchlist !== "undefined") CFWatchlist.check(book);
        const requestedExpiration = input.loadedTicker !== undefined && input.loadedTicker !== input.ticker ? "" : input.expiration;
        phase = "clear prior data";
        CFAnalysisSheets.invalidate(book, "Refreshing " + String(input.ticker).trim().toUpperCase() + "…");
        if (typeof CFAnalysisVisuals !== "undefined") CFAnalysisVisuals.invalidate(book, "Refreshing selected ticker…");
        if (typeof CFAnalysisStrategies !== "undefined") CFAnalysisStrategies.invalidate(book, "Refreshing selected ticker…");
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
        if (typeof CFAnalysisVisuals !== "undefined") CFAnalysisVisuals.render(book, snapshot);
        if (typeof CFAnalysisStrategies !== "undefined") CFAnalysisStrategies.render(book, snapshot);
        if (typeof CFWatchlist !== "undefined") CFWatchlist.record(book, snapshot);
        SpreadsheetApp.flush();
        const summary = CFAnalysisService.summary(snapshot);
        console.log("CF_ANALYSIS_REFRESH " + JSON.stringify(summary));
        book.toast(snapshot.ok ? "Analysis updated. See Sources for availability and quote times." : "No matching quote data returned. Check the ticker and Sources.", "Stock analysis", 10);
        return summary;
    } catch (_error) {
        console.log("CF_ANALYSIS_ERROR " + JSON.stringify({ phase }));
        CFAnalysisSheets.status(book, "Unable to refresh. Check the ticker and try again.");
        return { ok: false, error: "Unable to refresh. Check the ticker and try again." };
    } finally { lock.releaseLock(); }
}

function CFCheckAnalysisSources() {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    const input = book?.getSheetByName("Analysis") ? CFAnalysisSheets.readInput(book) : { ticker: "NVDA", expiration: "" };
    const result = CFAnalysisService.collect(input.ticker, input.expiration,
        { fredKey: PropertiesService.getScriptProperties().getProperty("FRED_API_KEY") || "" });
    const summary = CFAnalysisService.summary(result);
    console.log("CF_ANALYSIS_PROVIDERS " + JSON.stringify(summary));
    return summary;
}

function CFInspectAnalysis() {
    const report = CFAnalysisSheets.inspect(SpreadsheetApp.getActiveSpreadsheet());
    const book = SpreadsheetApp.getActiveSpreadsheet();
    if (typeof CFAnalysisVisuals !== "undefined") report.research = CFAnalysisVisuals.inspect(book);
    if (typeof CFAnalysisStrategies !== "undefined" && typeof CFAnalysisStrategies.inspect === "function") report.strategies = CFAnalysisStrategies.inspect(book);
    console.log("CF_ANALYSIS_CHECK " + JSON.stringify(report));
    return report;
}

/** Direct public-source probes. No saved credentials are read and no provider bodies are logged. */
function CFCheckExpandedSources() {
    const rows = [];
    if (typeof CFSmfProviders !== "undefined") for (const ticker of ["NVDA", "AAPL", "ZZZZCFINVALID20261111"]) {
        for (const provider of CFSmfProviders.registry()) {
            const result = CFSmfProviders.fetch(provider.provider, ticker, { fetch: (url, options) => UrlFetchApp.fetch(url, options), clock: Date.now });
            rows.push({ ticker, provider: result.provider, ok: result.ok, status: result.status, http: result.http, identity: result.identity,
                fields: Object.entries(result.fields).filter(([, field]) => field.value !== null && field.value !== undefined).map(([id, field]) => ({ id, value: field.value, unit: field.unit })) });
        }
    }
    console.log("CF_EXPANDED_SOURCES " + JSON.stringify(rows));
    return rows;
}

/** Read actual worksheet results after custom functions finish. This method sends no requests. */
function CFInspectWorkspace() {
    const book = SpreadsheetApp.getActiveSpreadsheet(), analysis = CFAnalysisSheets.inspect(book);
    const report = { analysis, functions: null, watchlist: [], journalRows: 0, images: 0, formulaErrors: [] };
    if (typeof CFAnalysisVisuals !== "undefined") report.research = CFAnalysisVisuals.inspect(book);
    if (typeof CFAnalysisStrategies !== "undefined" && typeof CFAnalysisStrategies.inspect === "function") report.strategies = CFAnalysisStrategies.inspect(book);
    const formulas = book.getSheetByName("Formulas");
    if (formulas && formulas.getRange("Z1").getValue() === "CACHEFINANCE_FUNCTIONS_V1") {
        report.functions = { ticker: formulas.getRange("B4").getValue(), refresh: formulas.getRange("E4").getValue(), samples: formulas.getRange("A23:B30").getValues(),
            lookupSamples: formulas.getRange("G23:H29").getValues(), rsiTargets: formulas.getRange("A135:L136").getValues(),
            firstHistory: formulas.getRange("G35:M35").getValues()[0], firstExpiration: formulas.getRange("O35").getValue(),
            firstOption: formulas.getRange("A111:L111").getValues()[0], firstFred: formulas.getRange("Q35:U35").getValues()[0] };
        for (const address of ["B23:B30", "H23:H29", "A135:L136", "A34:E100", "G34:M100", "O34:O100", "Q34:U100", "A110:L130"]) {
            formulas.getRange(address).getValues().forEach((line, row) => line.forEach((value, col) => {
                if (typeof value === "string" && /^#(?:REF!|ERROR!|NAME\?|VALUE!|NUM!|DIV\/0!|N\/A)/.test(value)) report.formulaErrors.push({ sheet: "Formulas", range: address, row, col, value });
            }));
        }
    }
    const watch = book.getSheetByName("Watchlist"), journal = book.getSheetByName("Journal"), images = book.getSheetByName("Chart links");
    if (watch?.getRange("Z1").getValue() === "CACHEFINANCE_WATCHLIST_V1") report.watchlist = watch.getRange("A8:D27").getValues().filter(row => row[0]).map(row => ({ ticker: row[0], status: row[1], price: row[2], currency: row[3] }));
    if (journal?.getRange("Z1").getValue() === "CACHEFINANCE_JOURNAL_V1") report.journalRows = Math.max(0, journal.getLastRow() - 7);
    if (images?.getRange("Z1").getValue() === "CACHEFINANCE_IMAGES_V1") report.images = images.getImages().length;
    console.log("CF_WORKSPACE_CHECK " + JSON.stringify(report)); return report;
}

/** Presence flags only. The clean distribution template must contain no saved provider keys. */
function CFCheckTemplateKeys() {
    const status = CFGetApiKeyStatus();
    const result = { ok: status.ok === true && status.providers.length === 5 && status.providers.every(row => row.configured === false),
        providers: status.ok ? status.providers.map(row => ({ provider: row.id, configured: row.configured })) : [],
        error: status.ok ? "" : "Unable to check provider key settings" };
    console.log("CF_TEMPLATE_KEY_CHECK " + JSON.stringify(result)); return result;
}

/** Simple onEdit only clears stale data; menu refresh performs authorized requests. */
function CFAnalysisHandleEdit_(event) {
    if (!event?.range) return;
    if (typeof CFWatchlist !== "undefined") CFWatchlist.edit(event);
    const range = event.range;
    const sheet = range.getSheet();
    if (range.getRow() > 4 || range.getLastRow() < 4 || range.getColumn() > 2 || range.getLastColumn() < 2) return;
    if (sheet.getName() === "Analysis") {
        CFAnalysisSheets.invalidate(event.source, "Ticker changed. Choose Stock analysis → Refresh selected ticker.");
        if (typeof CFAnalysisVisuals !== "undefined") CFAnalysisVisuals.invalidate(event.source, "Ticker changed. Refresh the selected ticker.");
        if (typeof CFAnalysisStrategies !== "undefined") CFAnalysisStrategies.invalidate(event.source, "Ticker changed. Refresh the selected ticker.");
        if (typeof CFProviderImages !== "undefined") CFProviderImages.invalidate(event.source);
    } else if (sheet.getName() === "Options" && typeof CFAnalysisSheets.invalidateOptions === "function") {
        CFAnalysisSheets.invalidateOptions(event.source, "Expiration changed. Refresh the selected ticker.");
        if (typeof CFAnalysisVisuals !== "undefined") CFAnalysisVisuals.invalidate(event.source, "Expiration changed. Refresh the selected ticker.");
        if (typeof CFAnalysisStrategies !== "undefined") CFAnalysisStrategies.invalidate(event.source, "Expiration changed. Refresh the selected ticker.");
    }
}
