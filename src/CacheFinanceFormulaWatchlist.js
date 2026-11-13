/*  *** DEBUG START ***
import { CFFormulaWorkbook } from "./CacheFinanceFormulaWorkbook.js";
import { CFWatchlist } from "./CacheFinanceAnalysisWatchlist.js";
import { CFPublicData } from "./CacheFinanceResearchFunctions.js";
import { CFAnalysisData } from "./CacheFinanceAnalysisData.js";
export { CFFormulaWatchlist, CFWATCHROW };
//  *** DEBUG END ***/

/** Other watchlist stocks use one cached function. The selected stock reuses the workbook's existing formulas. */
class CFFormulaWatchlist {
    static keys() {
        return ["status", "price", "currency", "quote_time", "retrieved_at", "indicator_as_of", "return1d", "return1m", "return1y", "rsi14",
            "sma50", "sma200", "volatility20d", "trailing_pe", "eps_ttm", "market_cap", "target_price", "next_earnings", "source", "price_session",
            "atm_iv", "return3m", "return_ytd", "max_drawdown", "macd", "macd_signal", "average_volume20", "bar_count", "previous_rsi2", "previous_close"];
    }
    static unavailable_(status) {
        return { ...Object.fromEntries(CFFormulaWatchlist.keys().map(key => [key, null])), status };
    }
    static data(ticker, overrides = {}, refresh = "") {
        let symbol;
        try { symbol = CFAnalysisData.normalizeTicker(ticker).yahooSymbol; }
        catch { return CFPublicData.failure("Enter a supported ticker."); }
        return CFPublicData.cached("watch-row:v1", symbol, 60, services => {
            const quote = CFPublicData.quote(symbol, services, refresh), details = CFPublicData.details(symbol, services, refresh);
            if (!quote.ok && !details.ok) return CFPublicData.failure("Quote and fundamentals unavailable.");
            const chart = quote.chart || {}, history = quote.ok && Array.isArray(chart.history) ? chart.history : [];
            const technical = CFAnalysisData.calculate(history).summary, fields = details.fields || {};
            const selected = quote.ok ? quote.quote || CFAnalysisData.selectQuote(chart, details.details || {}) : {};
            const field = key => details.ok && Object.prototype.hasOwnProperty.call(fields, key) ? fields[key]?.value ?? null : null;
            const previous = technical.barCount > 1 ? history[technical.barCount - 2]?.close : null;
            const result = CFFormulaWatchlist.unavailable_(quote.ok && details.ok ? "Available"
                : quote.ok ? "Quote available; fundamentals unavailable" : "Fundamentals available; quote unavailable");
            Object.assign(result, {
                price: selected.price ?? null, currency: chart.currency || null, quote_time: selected.quoteTime || quote.quoteTime || null,
                retrieved_at: quote.ok ? quote.retrievedAt || null : details.retrievedAt || null,
                indicator_as_of: technical.indicatorAsOf || null, return1d: technical.return1d, return1m: technical.return1m, return1y: technical.return1y,
                rsi14: technical.rsi14, sma50: technical.sma50, sma200: technical.sma200, volatility20d: technical.volatility20d,
                trailing_pe: field("trailing_pe"), eps_ttm: field("eps_ttm"), market_cap: field("market_cap"), target_price: field("target_price"),
                next_earnings: details.ok ? details.details?.nextEarnings?.dates?.[0] || field("earnings_date") : null,
                source: quote.ok ? quote.source || null : details.source || null, price_session: selected.session || null,
                return3m: technical.return3m, return_ytd: technical.returnYtd, max_drawdown: technical.maxDrawdown,
                macd: technical.macd, macd_signal: technical.macdSignal, average_volume20: technical.volumeAverage20,
                bar_count: history.filter(row => typeof row.close === "number" && Number.isFinite(row.close) && row.close > 0).length,
                previous_close: typeof previous === "number" && Number.isFinite(previous) && previous > 0 ? previous : null
            });
            // No option-chain or RSI2 request is made for other watchlist tickers.
            return { ok: true, fields: result, retrievedAt: result.retrieved_at || undefined };
        }, overrides, refresh);
    }
    static table(ticker, refresh = "", overrides = {}) {
        let data;
        try { data = CFFormulaWatchlist.data(ticker, overrides, refresh); }
        catch { data = CFPublicData.failure("Request or response unavailable."); }
        const fields = data.ok && data.fields ? data.fields : CFFormulaWatchlist.unavailable_(CFPublicData.error(data));
        return [["Field", "Value"], ...CFFormulaWatchlist.keys().map(key => [key, CFPublicData.safe(fields[key] === "" ? null : fields[key])])];
    }
    static sourceFormula_(row) {
        return '=IF(Watchlist!A' + row + '="","",IF(UPPER(TRIM(Watchlist!A' + row + '))=UPPER(TRIM(Analysis!$B$4)),ARRAYFORMULA(\'Quote data\'!$AA$7:$AB$37),CFWATCHROW(Watchlist!A' + row + ',Watchlist!$E$4)))';
    }
    static lookup_(row, key, first) {
        const last = first + CFFormulaWatchlist.keys().length, values = '\'Watchlist data\'!$B$' + (first + 1) + ':$B$' + last;
        const keys = '\'Watchlist data\'!$A$' + (first + 1) + ':$A$' + last;
        return '=IF($A' + row + '="","",' + CFFormulaWorkbook.lookup(key, keys, values) + ')';
    }
    static journalTime_(row) {
        return '=IF($A' + row + '="","",IF(OR($D' + row + '="",$D' + row + '="N/A"),"",IFNA(MAX(FILTER(Journal!$A$8:$A,Journal!$B$8:$B=UPPER(TRIM($A' + row + ')),Journal!$D$8:$D=$D' + row + ',ISNUMBER(Journal!$A$8:$A))),"")))';
    }
    static journalRow_(row) {
        return '=IF($A' + row + '="","",IF($AA' + row + '="",0,IFNA(MAX(FILTER(ROW(Journal!$B$8:$B),Journal!$B$8:$B=UPPER(TRIM($A' + row + ')),Journal!$D$8:$D=$D' + row + ',Journal!$A$8:$A=$AA' + row + ')),0)))';
    }
    static change_(row, currentColumn, journalColumn) {
        // INDIRECT keeps this a cell reference so COUNTIFS can distinguish a blank saved cell from a saved zero.
        const prior = 'INDIRECT("Journal!' + journalColumn + '"&$Y' + row + ')', current = '$' + currentColumn + row;
        return '=IF($A' + row + '="","",IF($Y' + row + '>0,IF(COUNTIFS(' + prior + ',"<>")=0,"N/A",IF(AND(ISNUMBER(' + current + '),ISNUMBER(' + prior + ')),' + current + '-' + prior + ',"N/A")),"N/A"))';
    }
    static build(book, priorInputs) {
        const W = CFFormulaWorkbook;
        W.preflight(book);
        if (!book.getSheetByName("Analysis") || !book.getSheetByName("Quote data")) throw new Error("Build the formula sample before adding the watchlist.");
        const previous = book.getSheetByName("Watchlist");
        const initialized = previous && (previous.getRange("A7").getValue() !== "" || previous.getLastRow() >= 8);
        const saved = Array.isArray(priorInputs) ? priorInputs : initialized ? previous.getRange("A8:A27").getValues() : [["NVDA"], ["AAPL"], ["MSFT"], ["GOOGL"], ["AMZN"]];
        const inputs = Array.from({ length: 20 }, (_, i) => [Array.isArray(saved[i]) ? saved[i][0] ?? "" : ""]);
        const sheet = W.prepareSheet(book, "Watchlist", "CACHEFINANCE_WATCHLIST_V1");
        const data = W.prepareSheet(book, "Watchlist data", "TICKERSHEETS_WATCHLIST_DATA_V1");
        sheet.setFrozenRows(7); sheet.setFrozenColumns(0);
        sheet.getRange("A1:L1").merge().setValue("Stock watchlist").setFontSize(15).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2:X2").merge().setValue("Rows matching Analysis!B4 reuse its source tables. Other tickers use CFWATCHROW. Quote timestamps ending Z use UTC.").setWrap(true);
        sheet.getRange("D4").setValue("Shared refresh number"); sheet.getRange("E4").setFormula('=Analysis!E4').setBackground("#EEF2F6").setFontColor("#596579");
        sheet.getRange("A5:X5").merge().setValue("Edit the yellow tickers. Both refresh menus change Analysis!E4 and update the workbook together. Wait for source results before recording the journal.").setWrap(true);
        sheet.getRange("A6:X6").merge().setValue("Changes compare the latest saved Journal observation for the same ticker and currency. Refreshes do not create journal entries.").setWrap(true);
        const headers = CFWatchlist.headers().slice(); headers[19] = "Price change since saved snapshot"; headers[20] = "RSI change since saved snapshot"; headers[21] = "Target change since saved snapshot";
        W.header(sheet, "A7:X7", headers); W.header(sheet, "Y7", ["Journal row used"]); W.header(sheet, "AA7", ["Latest saved observation"]);
        sheet.getRange("A8:A27").setValues(inputs).setNumberFormat("@").setBackground("#FFF2CC").setFontColor("#0000FF").setFontWeight("bold");
        const fields = ["status", "price", "currency", "quote_time", "retrieved_at", "indicator_as_of", "return1d", "return1m", "return1y", "rsi14", "sma50", "sma200", "volatility20d", "trailing_pe", "eps_ttm", "market_cap", "target_price", "next_earnings", null, null, null, "source", "price_session"];
        const formulas = Array.from({ length: 20 }, (_, i) => {
            const row = i + 8, start = 7 + i * 40;
            return fields.map((key, j) => key ? CFFormulaWatchlist.lookup_(row, key, start)
                : j === 18 ? CFFormulaWatchlist.change_(row, "C", "C")
                : j === 19 ? CFFormulaWatchlist.change_(row, "K", "G") : CFFormulaWatchlist.change_(row, "R", "J"));
        });
        sheet.getRange("B8:X27").setFormulas(formulas); sheet.getRange("Y8:Y27").setFormulas(Array.from({ length: 20 }, (_, i) => [CFFormulaWatchlist.journalRow_(i + 8)]));
        sheet.getRange("AA8:AA27").setFormulas(Array.from({ length: 20 }, (_, i) => [CFFormulaWatchlist.journalTime_(i + 8)])).setNumberFormat("yyyy-mm-dd hh:mm:ss");
        sheet.getRange("C8:C27").setNumberFormat("0.00"); sheet.getRange("E8:G27").setNumberFormat("@"); sheet.getRange("H8:J27").setNumberFormat("0.00%");
        sheet.getRange("K8:M27").setNumberFormat("0.00"); sheet.getRange("N8:N27").setNumberFormat("0.00%"); sheet.getRange("O8:R27").setNumberFormat("#,##0.00");
        sheet.getRange("S8:S27").setNumberFormat("@"); sheet.getRange("T8:V27").setNumberFormat("0.00"); sheet.getRange("Y8:Y27").setNumberFormat("0");
        sheet.setColumnWidths(1, 25, 145); sheet.setColumnWidths(5, 2, 205); sheet.setColumnWidths(20, 3, 200); sheet.setColumnWidth(23, 380); sheet.setColumnWidth(27, 205);
        sheet.setRowHeights(7, 1, 64); sheet.setRowHeights(8, 20, 28); sheet.getRange("B8:Y27").setWrap(true);
        data.setFrozenRows(5); data.setColumnWidth(1, 230); data.setColumnWidth(2, 380);
        data.getRange("A1:F1").merge().setValue("Watchlist source functions").setFontSize(15).setFontWeight("bold").setFontColor("#17365D");
        data.getRange("A2:F3").merge().setValue("Each block has one source formula. The selected ticker reuses Quote data. CFWATCHROW fetches and calculates other tickers using the parsed-data cache.").setWrap(true);
        data.getRange("A4:F5").merge().setValue("Other-ticker rows make no option-chain or RSI2 request. Their ATM IV and previous RSI2 fields stay N/A. Calculations for the selected ticker are visible in Price history.").setWrap(true);
        for (let i = 0; i < 20; i++) {
            const start = 7 + i * 40, row = i + 8;
            data.getRange(start - 1, 1, 1, 2).merge().setFormula('="Watchlist row ' + row + ': "&IF(Watchlist!A' + row + '="","(empty)",UPPER(TRIM(Watchlist!A' + row + ')))').setBackground("#E8EEF5").setFontWeight("bold");
            data.getRange(start, 1).setFormula(CFFormulaWatchlist.sourceFormula_(row));
            data.getRange(start, 1, 1, 2).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold");
        }
        const journal = W.ensureSheet(book, "Journal", "CACHEFINANCE_JOURNAL_V1");
        if (journal.getLastRow() <= 1 && journal.getRange("A7").getValue() === "") {
            const fresh = W.prepareSheet(book, "Journal", "CACHEFINANCE_JOURNAL_V1");
            fresh.getRange("A1:L1").merge().setValue("Saved observations").setFontSize(15).setFontWeight("bold");
            fresh.getRange("A2:L2").merge().setValue("Record a journal snapshot after source results load. Recorded observations stay fixed when the workbook refreshes.").setWrap(true);
            fresh.getRange("A4:L4").merge().setWrap(true);
            W.header(fresh, "A7:R7", CFWatchlist.journalHeaders()); fresh.setFrozenRows(7); fresh.setColumnWidths(1, 18, 145);
        }
        // Update instructions on existing journals without rewriting saved observations.
        journal.getRange("A1").setValue("Saved observations");
        journal.getRange("A2").setValue("Recorded at uses the spreadsheet's time zone. Provider ISO timestamps ending in Z use UTC.");
        journal.getRange("A4").setValue("After source results load, choose Stock analysis → Record journal snapshot. Change columns compare the latest prior saved observation for the same ticker and currency.").setWrap(true);
        journal.getRange("M7").setValue("Price change since prior saved observation").setWrap(true);
        return { ok: true, inputs: 20, selectedSource: "'Quote data'!AA7:AB37", sharedRefresh: "Analysis!E4", journal: "Record journal snapshot" };
    }
    static refresh(book) {
        CFFormulaWorkbook.preflight(book);
        const main = book.getSheetByName("Analysis"), sheet = book.getSheetByName("Watchlist");
        if (!main || !sheet) throw new Error("Build the formula sample before refreshing the watchlist.");
        const refresh = CFFormulaWorkbook.counter(main.getRange("E4").getValue());
        main.getRange("E4").setValue(refresh);
        book.toast("Shared refresh requested. Wait for source formulas to finish before recording a journal snapshot.", "Watchlist", 8);
        return { ok: true, refresh, sharedRefresh: "Analysis!E4" };
    }
}

/** One other watchlist ticker as a labeled table. The workbook reuses its main data for the selected stock. @customfunction */
function CFWATCHROW(ticker, refresh = "") { return CFFormulaWatchlist.table(ticker, refresh); }
