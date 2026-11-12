/*  *** DEBUG START ***
import { CFAnalysisData } from "./CacheFinanceAnalysisData.js";
import { CFPublicData } from "./CacheFinanceResearchFunctions.js";
export { CFWatchlist, CFBuildWatchlist, CFRefreshWatchlist };
//  *** DEBUG END ***/

/** User ticker inputs and public snapshots. No keys or raw provider pages enter these tabs. */
class CFWatchlist {
    static names() { return { "CF Watchlist": "CACHEFINANCE_WATCHLIST_V1", "CF Journal": "CACHEFINANCE_JOURNAL_V1" }; }
    static safe(value) { return CFPublicData.safe(value); }
    static number(value) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
    static date(value) {
        if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
        const date = new Date(value); return Number.isFinite(date.getTime()) ? date : null;
    }
    static check(book) {
        for (const [name, marker] of Object.entries(CFWatchlist.names())) {
            const sheet = book.getSheetByName(name);
            if (sheet && sheet.getRange("Z1").getValue() !== marker) throw new Error("Rename the existing " + name + " tab before building the watchlist.");
        }
    }
    static headers() { return ["Ticker", "Status", "Price", "Currency", "Quote time", "Retrieved", "Indicators through", "1-day return", "1-month return", "1-year return", "RSI14", "SMA50", "SMA200", "20-day annual volatility", "P/E", "EPS (trailing)", "Market cap", "Analyst target", "Next earnings", "Price change since prior refresh", "RSI change", "Target change", "Public source", "Price session"]; }
    static journalHeaders() { return ["Recorded at", "Ticker", "Price", "Currency", "Quote time", "Indicators through", "RSI14", "P/E", "EPS (trailing)", "Analyst target", "Next earnings", "ATM IV", "Price change since prior refresh", "RSI change", "EPS change", "Target change", "Earnings date changed", "IV change (percentage points)"]; }
    static decorate(sheet, title, columns) {
        if (sheet.getMaxColumns() < 26) sheet.insertColumnsAfter(sheet.getMaxColumns(), 26 - sheet.getMaxColumns());
        // Header titles span columns, so no column boundary can be frozen inside them.
        sheet.setHiddenGridlines(true); sheet.setFrozenRows(7); sheet.setFrozenColumns(0); sheet.setColumnWidths(1, columns, 145);
        sheet.getRange(1, 1, Math.max(80, sheet.getLastRow()), columns).setFontFamily("Arial").setFontSize(10);
        sheet.getRange("A1:L1").merge().setValue(title).setFontSize(14).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2:L2").merge().setValue("Source times use the spreadsheet time zone. N/A means unavailable.").setFontColor("#596579");
        sheet.hideColumns(26);
    }
    static build(book) {
        CFWatchlist.check(book);
        for (const [name, marker] of Object.entries(CFWatchlist.names())) {
            const existing = book.getSheetByName(name), sheet = existing || book.insertSheet(name);
            sheet.getRange("Z1").setValue(marker);
            const headers = name === "CF Watchlist" ? CFWatchlist.headers() : CFWatchlist.journalHeaders();
            CFWatchlist.decorate(sheet, name === "CF Watchlist" ? "Stock watchlist" : "Changes between refreshes", headers.length);
            sheet.getRange(7, 1, 1, headers.length).setValues([headers]).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold").setWrap(true);
            if (name === "CF Watchlist") {
                sheet.getRange("A2:L2").setValue("Prices use the latest accepted session quote. Returns and indicators use regular daily closes. Source times use the spreadsheet time zone.");
                sheet.getRange("A4:L4").merge().setValue("Edit up to 20 yellow ticker cells, then choose Stock analysis → Refresh watchlist.");
                sheet.getRange("A8:A27").setBackground("#FFF2CC").setFontColor("#0000FF").setFontWeight("bold").setNumberFormat("@");
                sheet.setColumnWidths(5, 2, 175); sheet.setColumnWidths(20, 3, 185); sheet.setColumnWidth(23, 360);
                if (!existing) sheet.getRange("A8:A12").setValues([["NVDA"], ["AAPL"], ["MSFT"], ["GOOGL"], ["AMZN"]]);
            } else {
                sheet.getRange("A4:L4").merge().setValue("Selected-stock and watchlist refreshes append public values. Changes compare the previous row for the same symbol and currency.");
                sheet.setColumnWidth(1, 175); sheet.setColumnWidth(5, 175); sheet.setColumnWidth(17, 240);
            }
        }
        return { ok: true, sheets: Object.keys(CFWatchlist.names()) };
    }
    static inputs(book) {
        CFWatchlist.check(book);
        const sheet = book.getSheetByName("CF Watchlist");
        if (!sheet) throw new Error("Build the watchlist first.");
        return sheet.getRange("A8:A27").getValues().map((row, index) => ({ row: index + 8, input: typeof row[0] === "string" ? row[0].trim().toUpperCase() : row[0] })).filter(row => row.input !== "");
    }
    static clearRows(book, first = 8, count = 20) {
        CFWatchlist.check(book);
        const sheet = book.getSheetByName("CF Watchlist");
        const start = Math.max(8, first), height = Math.min(28, first + count) - start;
        if (sheet && Number.isInteger(start) && Number.isInteger(height) && height > 0) sheet.getRange(start, 2, height, CFWatchlist.headers().length - 1).clearContent();
    }
    static metrics(snapshot) {
        const chart = snapshot.chart || {}, summary = snapshot.technical?.summary || {}, fields = { ...(snapshot.statistics?.fields || {}) };
        for (const [id, field] of Object.entries(snapshot.details?.fields || {})) if (field.value != null || !fields[id]) fields[id] = field;
        const options = snapshot.options || {}, spot = CFWatchlist.number(options.underlyingPrice);
        const usable = options.ok && spot !== null ? (options.contracts || []).filter(row => CFWatchlist.number(row.iv) !== null && row.iv >= 0 && CFWatchlist.number(row.mid) !== null && row.mid > 0).sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot)) : [];
        const sameStrike = usable.length ? usable.filter(row => row.strike === usable[0].strike && row.expiration === usable[0].expiration) : [];
        const quote = snapshot.displayQuote || CFAnalysisData.selectQuote(chart, snapshot.details || {});
        return { symbol: snapshot.symbol || snapshot.ticker, price: CFWatchlist.number(quote.price), currency: chart.currency || "", quoteTime: quote.quoteTime || "", priceSession: quote.session,
            indicatorAsOf: summary.indicatorAsOf || summary.historyEnd || "", rsi14: CFWatchlist.number(summary.rsi14), pe: CFWatchlist.number(fields.trailing_pe?.value),
            eps: CFWatchlist.number(fields.eps_ttm?.value), target: CFWatchlist.number(fields.target_price?.value), nextEarnings: snapshot.details?.nextEarnings?.dates?.[0] || fields.earnings_date?.value || "",
            atmIV: sameStrike.length ? sameStrike.reduce((sum, row) => sum + row.iv, 0) / sameStrike.length : null };
    }
    static change(current, prior) { return CFWatchlist.number(current) !== null && CFWatchlist.number(prior) !== null ? current - prior : null; }
    static record(book, snapshot) {
        if (!snapshot?.ok) return null;
        CFWatchlist.check(book);
        if (!book.getSheetByName("CF Journal")) CFWatchlist.build(book);
        const sheet = book.getSheetByName("CF Journal"), metric = CFWatchlist.metrics(snapshot), last = sheet.getLastRow();
        const rows = last >= 8 ? sheet.getRange(8, 1, last - 7, 18).getValues() : [];
        const previous = rows.slice().reverse().find(row => row[1] === metric.symbol && row[3] === metric.currency);
        const delta = { price: previous ? CFWatchlist.change(metric.price, previous[2]) : null, rsi14: previous ? CFWatchlist.change(metric.rsi14, previous[6]) : null,
            eps: previous ? CFWatchlist.change(metric.eps, previous[8]) : null, target: previous ? CFWatchlist.change(metric.target, previous[9]) : null,
            earningsChanged: previous && metric.nextEarnings && typeof previous[10] === "string" && previous[10] !== "N/A" ? metric.nextEarnings !== previous[10] : null,
            ivPoints: previous && CFWatchlist.change(metric.atmIV, previous[11]) !== null ? CFWatchlist.change(metric.atmIV, previous[11]) * 100 : null };
        const row = Math.max(8, last + 1);
        if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), row - sheet.getMaxRows());
        sheet.getRange(row, 6).setNumberFormat("@"); sheet.getRange(row, 11).setNumberFormat("@");
        sheet.getRange(row, 1, 1, 18).setValues([[CFWatchlist.date(snapshot.fetchedAt) || new Date(), metric.symbol, metric.price, metric.currency, CFWatchlist.date(metric.quoteTime), metric.indicatorAsOf,
            metric.rsi14, metric.pe, metric.eps, metric.target, metric.nextEarnings, metric.atmIV, delta.price, delta.rsi14, delta.eps, delta.target, delta.earningsChanged, delta.ivPoints].map(CFWatchlist.safe)]);
        sheet.getRange(row, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss"); sheet.getRange(row, 5).setNumberFormat("yyyy-mm-dd hh:mm:ss"); sheet.getRange(row, 3).setNumberFormat("0.00");
        sheet.getRange(row, 7, 1, 4).setNumberFormat("0.00"); sheet.getRange(row, 12).setNumberFormat("0.00%"); sheet.getRange(row, 13, 1, 4).setNumberFormat("0.00"); sheet.getRange(row, 18).setNumberFormat("0.00");
        return { row, symbol: metric.symbol, delta };
    }
    static refresh(book, dependencies = {}) {
        CFWatchlist.build(book);
        const initial = CFWatchlist.inputs(book), sheet = book.getSheetByName("CF Watchlist"), results = [];
        CFWatchlist.clearRows(book);
        sheet.getRange("E8:F27").setNumberFormat("yyyy-mm-dd hh:mm:ss"); sheet.getRange("G8:G27").setNumberFormat("@"); sheet.getRange("S8:S27").setNumberFormat("@");
        for (const input of initial) {
            let data, detail;
            try {
                const quote = CFPublicData.quote(input.input, dependencies), fundamentals = CFPublicData.details(input.input, dependencies);
                const snapshot = { ok: quote.ok || fundamentals.ok, ticker: String(input.input), symbol: quote.symbol || fundamentals.symbol,
                    chart: quote.chart || {}, displayQuote: quote.quote, technical: CFAnalysisData.calculate(quote.chart?.history || []), details: fundamentals.details || {}, statistics: { fields: fundamentals.fields || {} }, fetchedAt: new Date((dependencies.clock || Date.now)()).toISOString() };
                const now = sheet.getRange(input.row, 1).getValue();
                if (typeof now !== "string" || now.trim().toUpperCase() !== input.input) { results.push({ ticker: String(input.input), status: "Ticker changed during refresh" }); continue; }
                const journal = CFWatchlist.record(book, snapshot), metric = CFWatchlist.metrics(snapshot), summary = snapshot.technical.summary;
                const status = quote.ok && fundamentals.ok ? "Available" : quote.ok ? "Quote available; fundamentals unavailable" : fundamentals.ok ? "Fundamentals available; quote unavailable" : quote.status;
                data = [status, metric.price, metric.currency, CFWatchlist.date(metric.quoteTime), CFWatchlist.date(quote.retrievedAt || fundamentals.retrievedAt), metric.indicatorAsOf,
                    summary.return1d, summary.return1m, summary.return1y, metric.rsi14, summary.sma50, summary.sma200, summary.volatility20d,
                    metric.pe, metric.eps, snapshot.statistics.fields.market_cap?.value, metric.target, metric.nextEarnings, journal?.delta.price, journal?.delta.rsi14, journal?.delta.target, quote.source, metric.priceSession];
                detail = { ticker: input.input, status, quote: quote.ok, fundamentals: fundamentals.ok, cacheHit: quote.cacheHit, journalRow: journal?.row || null };
            } catch { data = ["Invalid ticker or unavailable request", ...Array(CFWatchlist.headers().length - 2).fill(null)]; detail = { ticker: String(input.input), status: data[0] }; }
            const current = sheet.getRange(input.row, 1).getValue();
            if (typeof current !== "string" || current.trim().toUpperCase() !== input.input) { results.push({ ticker: String(input.input), status: "Ticker changed during refresh" }); continue; }
            if (data) sheet.getRange(input.row, 2, 1, CFWatchlist.headers().length - 1).setValues([data.map(CFWatchlist.safe)]);
            results.push(detail);
        }
        sheet.getRange("C8:C27").setNumberFormat("#,##0.00"); sheet.getRange("H8:J27").setNumberFormat("0.00%"); sheet.getRange("K8:M27").setNumberFormat("0.00"); sheet.getRange("N8:N27").setNumberFormat("0.00%");
        sheet.getRange("O8:R27").setNumberFormat("#,##0.00"); sheet.getRange("T8:V27").setNumberFormat("0.00");
        sheet.getRange("A5").setValue("Last refresh"); sheet.getRange("B5").setValue(new Date()).setNumberFormat("yyyy-mm-dd hh:mm:ss");
        return { ok: true, tickers: results.length, results };
    }
    static edit(event) {
        if (!event?.range || event.range.getSheet().getName() !== "CF Watchlist" || event.range.getColumn() > 1 || event.range.getLastColumn() < 1 || event.range.getLastRow() < 8 || event.range.getRow() > 27) return;
        CFWatchlist.clearRows(event.source, event.range.getRow(), event.range.getLastRow() - event.range.getRow() + 1);
    }
}

function CFBuildWatchlist() { return CFWatchlist.build(SpreadsheetApp.getActiveSpreadsheet()); }
function CFRefreshWatchlist() {
    const book = SpreadsheetApp.getActiveSpreadsheet(), lock = LockService.getDocumentLock();
    if (!lock?.tryLock(1000)) { book.toast("Another refresh is running.", "Watchlist", 8); return { ok: false, error: "Another refresh is running" }; }
    try { const result = CFWatchlist.refresh(book); SpreadsheetApp.flush(); console.log("CF_WATCHLIST_CHECK " + JSON.stringify(result)); book.toast("Watchlist updated. See CF Journal for changes.", "Watchlist", 8); return result; }
    finally { lock.releaseLock(); }
}
