/*  *** DEBUG START ***
import { CFAnalysisOptions } from "./CacheFinanceAnalysisOptions.js";
export { CFAnalysisSheets };
//  *** DEBUG END ***/

const CF_ANALYSIS_SHEET_NAMES_ = Object.freeze(["CF Analysis", "CF Price history", "CF Fundamentals", "CF Earnings", "CF Options", "CF Macro", "CF Sources"]);
const CF_ANALYSIS_SHEET_MARKER_ = "CACHEFINANCE_ANALYSIS_V1";

/** Writes only marked analysis tabs. It never reads API keys or makes requests. */
class CFAnalysisSheets {
    static check_(book) {
        for (const name of CF_ANALYSIS_SHEET_NAMES_) {
            const sheet = book.getSheetByName(name);
            if (sheet && sheet.getRange("Z1").getValue() !== CF_ANALYSIS_SHEET_MARKER_) {
                throw new Error("The existing " + name + " tab is not an analysis tab. Rename it before building the analysis.");
            }
        }
    }

    static safe_(value, missing = "N/A") {
        if (value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value))) return missing;
        if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : missing;
        if (typeof value === "string") return /^\s*[=+@-]/.test(value) ? "'" + value : value;
        return typeof value === "number" || typeof value === "boolean" ? value : String(value);
    }

    static date_(value, book) {
        if (!value) return null;
        if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
        if (typeof value !== "string") return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            try {
                if (typeof Utilities !== "undefined" && typeof Utilities.parseDate === "function") return Utilities.parseDate(value, book.getSpreadsheetTimeZone(), "yyyy-MM-dd");
            } catch { return null; }
            const date = new Date(value + "T12:00:00.000Z");
            return Number.isFinite(date.getTime()) ? date : null;
        }
        if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
        const date = new Date(value);
        return Number.isFinite(date.getTime()) ? date : null;
    }

    static source_(value) {
        if (typeof value !== "string" || !/^https:\/\//i.test(value)) return CFAnalysisSheets.safe_(value);
        const match = value.match(/^(https:\/\/[^/?#\s]+)(\/[^?#\s]*)?/i);
        return match && !match[1].includes("@") ? match[1] + (match[2] || "") : "Source URL omitted";
    }

    static rows_(sheet, count) {
        if (count > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), count - sheet.getMaxRows());
    }

    static title_(sheet, ticker, subtitle, formatting = true) {
        const label = sheet.getName() === "CF Analysis" ? "Stock analysis" : sheet.getName().replace(/^CF /, "");
        const title = sheet.getRange("A1").setValue(CFAnalysisSheets.safe_(ticker + " — " + label));
        const note = sheet.getRange("A2").setValue(CFAnalysisSheets.safe_(subtitle || "Change the ticker on CF Analysis, then use Stock analysis → Refresh selected ticker."));
        if (formatting) {
            title.setFontSize(14).setFontWeight("bold").setFontColor("#17365D").setBackground(null);
            note.setFontColor("#596579").setFontSize(9);
        }
    }

    static base_(sheet, ticker, subtitle) {
        if (sheet.getMaxColumns() < 26) sheet.insertColumnsAfter(sheet.getMaxColumns(), 26 - sheet.getMaxColumns());
        sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 80), 25).setFontFamily("Arial").setFontSize(10).setVerticalAlignment("middle");
        sheet.setHiddenGridlines(true); sheet.setFrozenRows(["CF Analysis", "CF Options"].includes(sheet.getName()) ? 8 : 7); sheet.setColumnWidths(1, 25, 115);
        sheet.setColumnWidth(1, 190); sheet.setColumnWidth(2, 145);
        sheet.getRange("A1:L1").merge(); sheet.getRange("A2:L2").merge();
        sheet.getRange("Z1").setValue(CF_ANALYSIS_SHEET_MARKER_); sheet.hideColumns(26);
        CFAnalysisSheets.title_(sheet, ticker, subtitle);
    }

    static table_(sheet, row, column, headers, values) {
        CFAnalysisSheets.rows_(sheet, row + Math.max(values.length, 1));
        sheet.getRange(row, column, 1, headers.length).setValues([headers]).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold").setWrap(true);
        if (values.length) sheet.getRange(row + 1, column, values.length, headers.length).setValues(values.map(line => line.map(value => CFAnalysisSheets.safe_(value))));
        return row + values.length + 3;
    }

    static input_(sheet, cell, value) {
        sheet.getRange(cell).setValue(CFAnalysisSheets.safe_(value, "")).setBackground("#FFF2CC").setFontColor("#0000FF").setFontWeight("bold");
    }

    static build(book) {
        CFAnalysisSheets.check_(book);
        const existing = book.getSheetByName("CF Analysis");
        const ticker = existing ? String(existing.getRange("B4").getValue() || "NVDA").trim().toUpperCase() : "NVDA";
        const created = [];
        for (const name of CF_ANALYSIS_SHEET_NAMES_) {
            let sheet = book.getSheetByName(name);
            if (!sheet) { sheet = book.insertSheet(name); created.push(name); }
            CFAnalysisSheets.base_(sheet, ticker);
        }
        const main = book.getSheetByName("CF Analysis");
        main.setTabColor("#17365D"); main.getRange("A4").setValue("Ticker"); CFAnalysisSheets.input_(main, "B4", ticker);
        main.getRange("D4").setValue("Last refresh"); main.getRange("G4").setValue("Status");
        main.getRange("H4").setValue("Choose Stock analysis → Refresh selected ticker."); main.setColumnWidth(8, 260);
        const options = book.getSheetByName("CF Options"); options.getRange("A4").setValue("Expiration");
        options.getRange("B4").setBackground("#FFF2CC").setFontColor("#0000FF");
        CFAnalysisSheets.guide_(book.getSheetByName("CF Sources"), 8);
        return { sheets: [...CF_ANALYSIS_SHEET_NAMES_], created };
    }

    static readInput(book) {
        CFAnalysisSheets.check_(book);
        const main = book.getSheetByName("CF Analysis"), options = book.getSheetByName("CF Options");
        if (!main) throw new Error("Build the analysis sheet from the CacheFinance menu first.");
        const raw = main.getRange("B4").getValue();
        const expiration = options ? options.getRange("B4").getValue() : "";
        let expiry = "";
        if (typeof expiration === "string" && /^\d{4}-\d{2}-\d{2}$/.test(expiration)) {
            const date = new Date(expiration + "T00:00:00Z");
            if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === expiration) expiry = expiration;
        } else if (expiration instanceof Date && Number.isFinite(expiration.getTime())) {
            if (typeof Utilities !== "undefined" && typeof Utilities.formatDate === "function") expiry = Utilities.formatDate(expiration, book.getSpreadsheetTimeZone(), "yyyy-MM-dd");
            else expiry = expiration.toISOString().slice(0, 10);
        }
        const source = book.getSheetByName("CF Sources");
        return { ticker: typeof raw === "string" ? raw.trim().toUpperCase() : String(raw), expiration: expiry,
            loadedTicker: source ? String(source.getRange("B3").getValue() || "").trim().toUpperCase() : "" };
    }

    static clear_(sheet, formatting = false) {
        const last = Math.max(formatting ? sheet.getMaxRows() : sheet.getLastRow(), 5);
        const input = ["CF Analysis", "CF Options"].includes(sheet.getName());
        const areas = input ? ["A3:Y3", "A4", "C4:Y4", "A5:Y" + last] : ["A3:Y" + last];
        if (formatting) sheet.getRange(3, 1, last - 2, 25).breakApart();
        const list = typeof sheet.getRangeList === "function" ? sheet.getRangeList(areas) : null;
        const method = formatting ? "clear" : "clearContent";
        if (list && typeof list[method] === "function") list[method]();
        else for (const area of areas) sheet.getRange(area)[method]();
        if (formatting) sheet.setRowHeights(3, last - 2, 21);
        if (sheet.getName() === "CF Options") sheet.getRange("B4").clearDataValidations();
        for (const chart of sheet.getCharts()) sheet.removeChart(chart);
    }

    static invalidate(book, reason) {
        CFAnalysisSheets.check_(book);
        const main = book.getSheetByName("CF Analysis");
        if (!main) return;
        const input = CFAnalysisSheets.readInput(book);
        const source = book.getSheetByName("CF Sources");
        const expiration = input.loadedTicker !== input.ticker ? "" : input.expiration;
        if (source) source.getRange("B3").setValue("");
        CFAnalysisSheets.clear_(main);
        CFAnalysisSheets.title_(main, input.ticker, reason, false);
        main.getRange("A4").setValue("Ticker");
        main.getRange("G4:H4").setValues([["Status", CFAnalysisSheets.safe_(reason)]]);
        const options = book.getSheetByName("CF Options");
        if (options && input.loadedTicker !== input.ticker) options.getRange("B4").setValue(expiration);
        for (const name of CF_ANALYSIS_SHEET_NAMES_.filter(name => name !== "CF Analysis")) {
            const sheet = book.getSheetByName(name);
            if (sheet) { CFAnalysisSheets.clear_(sheet); CFAnalysisSheets.title_(sheet, input.ticker, reason, false); }
        }
        if (options) options.getRange("A4").setValue("Expiration");
        if (source) source.getRange("A3").setValue("Loaded ticker");
    }

    static invalidateOptions(book, reason) {
        CFAnalysisSheets.check_(book);
        const sheet = book.getSheetByName("CF Options");
        if (!sheet) return;
        const input = CFAnalysisSheets.readInput(book);
        CFAnalysisSheets.clear_(sheet); CFAnalysisSheets.title_(sheet, input.ticker, reason, false);
        sheet.getRange("A4").setValue("Expiration");
        sheet.getRange("A6").setValue(CFAnalysisSheets.safe_(reason));
    }

    static status(book, text) {
        CFAnalysisSheets.check_(book);
        const sheet = book.getSheetByName("CF Analysis");
        if (sheet) sheet.getRange("H4").setValue(CFAnalysisSheets.safe_(text));
    }

    static guide_(sheet, row) {
        CFAnalysisSheets.table_(sheet, row, 1, ["How to use this workbook", "Details"], [
            ["One ticker", "Edit CF Analysis!B4. Other titles and charts follow that input after Refresh selected ticker."],
            ["Refresh", "Choose Stock analysis → Refresh selected ticker. Ticker edits clear old results before the next download."],
            ["API keys", "Choose CacheFinance → API keys… . Keys stay in Script Properties, outside worksheet cells."],
            ["Unavailable data", "N/A means the provider did not supply an accepted value. Empty history cells keep chart gaps."],
            ["Return basis", "Returns, benchmark growth and volatility use adjusted close. SMA, EMA, MACD and RSI use Yahoo close."],
            ["Benchmark currencies", "Growth uses each instrument's local currency. SPY and QQQ are USD. No FX conversion is applied."],
            ["Sessions", "1 month = 21 sessions; 1 year = 252 sessions. RSI14 uses Wilder smoothing; volatility uses sample log returns × √252."],
            ["Provider yields", "Yahoo forward yield and Globe trailing yield can differ. Source labels preserve their definitions."],
            ["Options", "Choose a published expiration on CF Options!B4, then Refresh selected ticker. Missing chains remain unavailable."],
            ["Macro", "FRED requires your own key. Observation dates describe periods; they are not publication timestamps."],
            ["Scope", "This workbook shows source data and calculations. Provider extraction does not independently verify financial accuracy."]
        ]);
        sheet.setColumnWidth(2, 610); sheet.getRange(row + 1, 2, 11, 1).setWrap(true);
    }

    static growth_(history, benchmarks) {
        const maps = {};
        for (const symbol of ["SPY", "QQQ"]) {
            const rows = benchmarks?.[symbol]?.chart?.history || [];
            if (rows.some(row => typeof row.adjustedClose === "number" && row.adjustedClose > 0)) maps[symbol] = new Map(rows.filter(row => typeof row.adjustedClose === "number" && row.adjustedClose > 0).map(row => [row.date, row.adjustedClose]));
        }
        const base = history.find(row => typeof row.adjustedClose === "number" && row.adjustedClose > 0 && Object.values(maps).every(map => map.has(row.date)));
        const result = new Map();
        if (!base) return result;
        for (const row of history) {
            if (row.date < base.date) continue;
            result.set(row.date, { stock: typeof row.adjustedClose === "number" && row.adjustedClose > 0 ? row.adjustedClose / base.adjustedClose * 100 : null,
                SPY: maps.SPY?.has(row.date) ? maps.SPY.get(row.date) / maps.SPY.get(base.date) * 100 : null,
                QQQ: maps.QQQ?.has(row.date) ? maps.QQQ.get(row.date) / maps.QQQ.get(base.date) * 100 : null });
        }
        return result;
    }

    static chart_(destination, source, ranges, title, row, colors, min, max, headers = 1, labels) {
        let chart = destination.newChart().setChartType(Charts.ChartType.LINE).setNumHeaders(headers).setPosition(row, 1, 0, 0)
            .setOption("title", title).setOption("width", 1030).setOption("height", 300).setOption("fontName", "Arial")
            .setOption("legend", { position: "bottom" }).setOption("interpolateNulls", false).setOption("colors", colors);
        for (const range of ranges) chart = chart.addRange(source.getRange(range.row, range.col, range.count, 1));
        if (min !== undefined) chart = chart.setOption("vAxis", { viewWindow: { min, max } });
        if (labels) chart = chart.setOption("series", Object.fromEntries(labels.map((label, i) => [i, { labelInLegend: label }])));
        destination.insertChart(chart.build());
    }

    static render(book, snapshot) {
        CFAnalysisSheets.check_(book);
        const input = CFAnalysisSheets.readInput(book);
        if (!snapshot || String(snapshot.ticker || "").trim().toUpperCase() !== input.ticker) throw new Error("The ticker changed during refresh. Refresh the current ticker again.");
        const ticker = input.ticker, oldExpiry = input.expiration, sheets = {};
        for (const name of CF_ANALYSIS_SHEET_NAMES_) {
            const sheet = book.getSheetByName(name);
            if (!sheet) throw new Error("Build the analysis sheet before refreshing it.");
            CFAnalysisSheets.clear_(sheet, true); CFAnalysisSheets.base_(sheet, ticker, "Source times use the spreadsheet time zone. N/A means unavailable."); sheets[name] = sheet;
        }
        const main = sheets["CF Analysis"], history = sheets["CF Price history"], options = sheets["CF Options"], sources = sheets["CF Sources"];
        const chart = snapshot.chart || {}, technical = snapshot.technical || { series: [], summary: {} }, summary = technical.summary || {};
        const series = technical.series || [], growth = CFAnalysisSheets.growth_(series, snapshot.benchmarks);
        const optionData = snapshot.options || {}, expirations = (optionData.expirations || []).filter(value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)).slice().sort();
        const selectedExpiry = expirations.includes(oldExpiry) ? oldExpiry : expirations[0] || "";
        const selectedContracts = optionData.ok ? (optionData.contracts || []).filter(row => row.expiration === selectedExpiry) : [];
        const spot = typeof optionData.underlyingPrice === "number" && Number.isFinite(optionData.underlyingPrice) && optionData.underlyingPrice > 0 ? optionData.underlyingPrice
            : typeof chart.price === "number" && Number.isFinite(chart.price) && chart.price > 0 ? chart.price : null;
        const nearest = selectedContracts.slice().sort((left, right) => (spot === null ? 0 : Math.abs(left.strike - spot) - Math.abs(right.strike - spot)) || left.strike - right.strike || String(left.type).localeCompare(String(right.type)));
        const contracts = nearest.slice(0, 200).sort((left, right) => left.strike - right.strike || String(left.type).localeCompare(String(right.type)));
        const atm = CFAnalysisOptions.maturityRow_(optionData, snapshot.symbol || ticker, selectedExpiry);
        const atmIv = atm.atmIV;
        main.getRange("A4").setValue("Ticker"); CFAnalysisSheets.input_(main, "B4", ticker);
        main.getRange("D4").setValue("Last refresh"); main.getRange("E4").setValue(CFAnalysisSheets.date_(snapshot.fetchedAt, book) || "N/A").setNumberFormat("mmm d, hh:mm");
        main.getRange("G4").setValue("Status"); main.getRange("H4").setValue(snapshot.ok === false ? "No matching quote data. Check the ticker and CF Sources." : "Updated; see CF Sources for provider results."); main.setColumnWidth(8, 260);
        main.getRange("A5").setValue("Yahoo symbol"); main.getRange("B5").setValue(CFAnalysisSheets.safe_(snapshot.symbol));
        main.getRange("D5").setValue("Company"); main.getRange("E5:H5").merge().setValue(CFAnalysisSheets.safe_(chart.name || snapshot.details?.name));
        main.getRange("A6").setValue("Currency"); main.getRange("B6").setValue(CFAnalysisSheets.safe_(chart.currency));
        main.getRange("D6").setValue("Indicators through"); main.getRange("E6").setValue(CFAnalysisSheets.date_(summary.indicatorAsOf || summary.historyEnd, book) || "N/A").setNumberFormat("yyyy-mm-dd");
        const metrics = [["Price", chart.price ?? summary.price, "Yahoo Chart API"], ["Quote time", CFAnalysisSheets.date_(chart.quoteTime, book), "Yahoo regularMarketTime"],
            ["1-day adjusted return", summary.return1d, "Adjusted close"], ["1-month adjusted return", summary.return1m, "21 sessions"], ["3-month adjusted return", summary.return3m, "63 sessions"],
            ["1-year adjusted return", summary.return1y, "252 sessions"], ["YTD adjusted return", summary.returnYtd, "Last prior-year close"], ["RSI14", summary.rsi14, "Wilder; Yahoo close"],
            ["SMA50", summary.sma50, "Yahoo close"], ["SMA200", summary.sma200, "Yahoo close"], ["20-day annualized volatility", summary.volatility20d, "Adjusted log returns"],
            ["Maximum observed drawdown", summary.maxDrawdown, "Loaded adjusted history"], ["MACD", summary.macd, "EMA12 − EMA26"], ["MACD signal", summary.macdSignal, "EMA9 of MACD"],
            ["20-day average volume", summary.volumeAverage20, "Daily shares"], ["History sessions", summary.barCount, "Yahoo daily bars"]];
        CFAnalysisSheets.table_(main, 8, 1, ["Metric", "Value", "Basis"], metrics); main.setColumnWidth(3, 195);
        main.getRange(9, 2, metrics.length, 1).setNumberFormat("#,##0.00"); main.getRange("B10").setNumberFormat("yyyy-mm-dd hh:mm:ss");
        main.getRangeList(["B11:B15", "B19:B20"]).setNumberFormat("0.00%"); main.getRange("B23:B24").setNumberFormat("#,##0");
        CFAnalysisSheets.table_(main, 8, 4, ["Provider", "Price", "Yield", "Identity", "Quote time", "Status"], (snapshot.quoteSources || []).map(row => [row.provider, row.price, row.yieldFraction, row.identity, CFAnalysisSheets.date_(row.quoteTime, book), row.status]));
        if ((snapshot.quoteSources || []).length) { main.getRange(9, 5, snapshot.quoteSources.length, 1).setNumberFormat("#,##0.00"); main.getRange(9, 6, snapshot.quoteSources.length, 1).setNumberFormat("0.00%"); main.getRange(9, 8, snapshot.quoteSources.length, 1).setNumberFormat("yyyy-mm-dd hh:mm"); }
        const companyFields = { ...(snapshot.statistics?.fields || {}) };
        for (const [id, field] of Object.entries(snapshot.details?.fields || {})) if (field.value !== null && field.value !== undefined || !companyFields[id]) companyFields[id] = field;
        const currency = chart.currency || "Currency not supplied", nextEarnings = snapshot.details?.nextEarnings || {};
        const nextDate = nextEarnings.dates?.[0] || companyFields.earnings_date?.value;
        const companyRows = [
            ["Market cap", companyFields.market_cap?.value, currency],
            ["P/E (trailing)", companyFields.trailing_pe?.value, "Trailing 12 months"],
            ["EPS (trailing)", companyFields.eps_ttm?.value, currency + "; trailing 12 months"],
            ["Dividend yield", companyFields.dividend_yield?.value, companyFields.dividend_yield?.label || "Provider yield"],
            ["Analyst target", companyFields.target_price?.value, "One-year analyst target"],
            ["Next earnings", CFAnalysisSheets.date_(nextDate, book) || nextDate, nextEarnings.estimated === true ? "Estimated" : nextEarnings.estimated === false ? "Provider marks confirmed" : "Date status not supplied"],
            ["Loaded option contracts", optionData.ok ? selectedContracts.length : null, "Selected expiration; " + contracts.length + " shown"],
            ["Nearest expiration", optionData.ok ? CFAnalysisSheets.date_(expirations[0], book) : null, "Earliest published expiration"],
            ["ATM IV", atmIv, atmIv === null ? "No accepted same-strike call/put IV" : selectedExpiry + "; strike " + atm.call.strike + "; call/put mean"]
        ];
        CFAnalysisSheets.table_(main, 15, 4, ["Metric", "Value", "Basis"], companyRows); main.getRange("D16:D24").setWrap(true);
        main.getRange("E16:E24").setNumberFormat("#,##0.00"); main.getRangeList(["E19", "E24"]).setNumberFormat("0.00%");
        main.getRange("E21").setNumberFormat("yyyy-mm-dd"); main.getRange("E22").setNumberFormat("#,##0"); main.getRange("E23").setNumberFormat("yyyy-mm-dd"); main.getRange("F16:F24").setWrap(true);
        const cap = companyFields.market_cap?.value;
        if (typeof cap === "number" && Number.isFinite(cap)) main.getRange("E16").setNumberFormat(Math.abs(cap) >= 1e12 ? '0.00,,,,"T"' : Math.abs(cap) >= 1e9 ? '0.00,,,"B"' : Math.abs(cap) >= 1e6 ? '0.00,,"M"' : "#,##0.00");
        const headers = ["Date", "Open", "High", "Low", "Yahoo close", "Adjusted close", "Volume", "SMA20", "SMA50", "SMA200", "EMA12", "EMA26", "MACD", "MACD signal", "MACD histogram", "RSI14", "Drawdown", "Adjusted 1d return", ticker + " indexed 100", "SPY indexed 100", "QQQ indexed 100", "RSI 30", "RSI 70"];
        CFAnalysisSheets.table_(history, 7, 1, headers, series.map(row => { const indexed = growth.get(row.date) || {}; return [CFAnalysisSheets.date_(row.date, book), row.open, row.high, row.low, row.close, row.adjustedClose, row.volume, row.sma20, row.sma50, row.sma200, row.ema12, row.ema26, row.macd, row.macdSignal, row.macdHistogram, row.rsi14, row.drawdown, row.return1d, indexed.stock, indexed.SPY, indexed.QQQ, 30, 70].map(value => CFAnalysisSheets.safe_(value, "")); }));
        if (series.length) {
            history.getRange(8, 1, series.length, 1).setNumberFormat("yyyy-mm-dd"); history.getRange(8, 2, series.length, 22).setNumberFormat("0.00"); history.getRange(8, 7, series.length, 1).setNumberFormat("#,##0"); history.getRange(8, 17, series.length, 2).setNumberFormat("0.00%");
            const sixMonths = Math.min(126, series.length), start = 8 + series.length - sixMonths;
            CFAnalysisSheets.chart_(main, history, [1, 5, 9, 10].map(col => ({ row: start, col, count: sixMonths })), ticker + " — 6-month close, SMA50 and SMA200", 28, ["#17365D", "#2C8B8B", "#D99520"], undefined, undefined, 0, ["Yahoo close", "SMA50", "SMA200"]);
            CFAnalysisSheets.chart_(main, history, [1, 19, 20, 21].map(col => ({ row: 7, col, count: series.length + 1 })), ticker + " vs SPY / QQQ — adjusted growth" + (chart.currency !== "USD" ? " (local currencies)" : ""), 47, ["#17365D", "#2C8B8B", "#D99520"]);
            CFAnalysisSheets.chart_(main, history, [1, 16, 22, 23].map(col => ({ row: 7, col, count: series.length + 1 })), ticker + " — RSI14 with 30 / 70 levels", 66, ["#17365D", "#D99520", "#B04747"], 0, 100);
        }
        CFAnalysisSheets.fundamentals_(sheets["CF Fundamentals"], snapshot);
        CFAnalysisSheets.earnings_(sheets["CF Earnings"], snapshot, book);
        options.getRange("A4").setValue("Expiration");
        const expirationCell = options.getRange("B4").setNumberFormat("@");
        if (expirations.length) expirationCell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(expirations, true).setAllowInvalid(false).build());
        else expirationCell.clearDataValidations();
        CFAnalysisSheets.input_(options, "B4", selectedExpiry);
        options.getRange("D4").setValue("Dates available"); options.getRange("E4").setValue(expirations.length).setNumberFormat("0").setWrap(false); options.setRowHeight(4, 24);
        options.getRange("A6").setValue(CFAnalysisSheets.safe_(optionData.ok ? "Showing " + contracts.length + " of " + selectedContracts.length + " contracts for selected expiry " + (selectedExpiry || "N/A") + (spot === null ? "; underlying price unavailable." : "; nearest strikes to underlying price.") : optionData.error || "Options data is unavailable from the tested endpoint."));
        CFAnalysisSheets.table_(options, 8, 1, ["Expiration", "Type", "Strike", "Last", "Bid", "Ask", "Mid", "Spread", "IV", "Volume", "Open interest", "Last trade", "In the money"], contracts.map(row => [CFAnalysisSheets.date_(row.expiration, book), row.type, row.strike, row.last, row.bid, row.ask, row.mid, row.spread, row.iv, row.volume, row.openInterest, CFAnalysisSheets.date_(row.lastTrade, book), row.inTheMoney]));
        if (contracts.length) { options.getRange(9, 1, contracts.length, 1).setNumberFormat("yyyy-mm-dd"); options.getRange(9, 3, contracts.length, 6).setNumberFormat("0.00"); options.getRange(9, 9, contracts.length, 1).setNumberFormat("0.00%"); options.getRange(9, 10, contracts.length, 2).setNumberFormat("#,##0"); options.getRange(9, 12, contracts.length, 1).setNumberFormat("yyyy-mm-dd hh:mm"); }
        CFAnalysisSheets.macro_(sheets["CF Macro"], snapshot.fred || [], book);
        sources.getRange("A3").setValue("Loaded ticker"); sources.getRange("B3").setValue(CFAnalysisSheets.safe_(ticker));
        const sourceRows = (snapshot.sources || []).map(row => [row.provider, row.scope, row.http, row.status, row.identity, CFAnalysisSheets.date_(row.retrievedAt, book), CFAnalysisSheets.date_(row.quoteTime, book), row.note, CFAnalysisSheets.source_(row.source)]);
        CFAnalysisSheets.table_(sources, 7, 1, ["Provider", "Scope", "HTTP", "Status", "Identity", "Retrieved", "Quote time", "Note", "Public source"], sourceRows);
        if (sourceRows.length) { sources.getRange(8, 6, sourceRows.length, 2).setNumberFormat("yyyy-mm-dd hh:mm:ss"); sources.getRange(8, 2, sourceRows.length, 1).setWrap(true); sources.getRange(8, 4, sourceRows.length, 1).setWrap(true); sources.getRange(8, 8, sourceRows.length, 1).setWrap(true); sources.getRange(8, 9, sourceRows.length, 1).setWrap(false); }
        CFAnalysisSheets.guide_(sources, sourceRows.length + 11); sources.setColumnWidth(2, 210); sources.setColumnWidth(8, 410); sources.setColumnWidth(9, 340);
        sources.setColumnWidths(6, 2, 165); sources.setColumnWidth(4, 150);
        return CFAnalysisSheets.inspect(book);
    }

    static fundamentals_(sheet, snapshot) {
        const fields = { ...(snapshot.statistics?.fields || {}) };
        for (const [id, field] of Object.entries(snapshot.details?.fields || {})) if (field.value !== null && field.value !== undefined || !fields[id]) fields[id] = field;
        const rows = Object.entries(fields).map(([id, field]) => {
            const value = field.unit === "date text" && field.value != null ? typeof field.display === "string" && field.display ? field.display : typeof field.value === "string" ? field.value : field.value instanceof Date ? field.value.toISOString().slice(0, 10) : null : field.value;
            return [field.label || id, value, field.unit, field.unit === "currency" ? field.currency || snapshot.chart?.currency || "" : "", CFAnalysisSheets.source_(field.source), field.field];
        });
        if (rows.length) sheet.getRange(8, 2, rows.length, 1).setNumberFormat("#,##0.00");
        const dates = rows.flatMap((row, i) => row[2] === "date text" ? ["B" + (i + 8)] : []);
        if (dates.length) sheet.getRangeList(dates).setNumberFormat("@");
        CFAnalysisSheets.table_(sheet, 7, 1, ["Metric", "Value", "Unit", "Currency", "Source", "Source field"], rows);
        sheet.setColumnWidth(1, 260); sheet.setColumnWidth(5, 360); sheet.setColumnWidth(6, 330);
        const percent = rows.flatMap((row, i) => row[2] === "fraction" ? ["B" + (i + 8)] : []);
        if (percent.length) sheet.getRangeList(percent).setNumberFormat("0.00%");
    }

    static earnings_(sheet, snapshot, book) {
        const details = snapshot.details || {}, events = snapshot.chart?.events || {};
        sheet.getRange("A4").setValue("Next earnings"); sheet.getRange("B4").setValue(CFAnalysisSheets.safe_((details.nextEarnings?.dates || []).join(" / ") || snapshot.statistics?.fields?.earnings_date?.value || "N/A"));
        sheet.getRange("D4").setValue("Date status"); sheet.getRange("E4").setValue(details.nextEarnings?.estimated === true ? "Estimated" : details.nextEarnings?.estimated === false ? "Provider marks confirmed" : "Not specified");
        const earnings = details.earnings || [];
        let row = CFAnalysisSheets.table_(sheet, 7, 1, ["Period", "Basis", "EPS actual", "EPS estimate", "Difference", "Surprise % points", "Reported", "Period end", "Currency", "Source"], earnings.map(value => [value.period, value.basis, value.actual, value.estimate, value.difference, value.surprisePct, CFAnalysisSheets.date_(value.reportedDate, book), CFAnalysisSheets.date_(value.periodEnd, book), value.currency, CFAnalysisSheets.source_(value.source)]));
        if (earnings.length) { sheet.getRange(8, 3, earnings.length, 4).setNumberFormat("0.00"); sheet.getRange(8, 7, earnings.length, 2).setNumberFormat("yyyy-mm-dd"); }
        const financials = details.financials || [];
        row = CFAnalysisSheets.table_(sheet, row, 1, ["Financial period", "Frequency", "Basis", "Revenue", "Net income", "Profit margin", "Currency", "Source"], financials.map(value => [value.period, value.frequency, value.basis, value.revenue, value.netIncome, value.profitMargin, value.currency, CFAnalysisSheets.source_(value.source)]));
        if (financials.length) sheet.getRange(row - financials.length - 2, 6, financials.length, 1).setNumberFormat("0.00%");
        row = CFAnalysisSheets.table_(sheet, row, 1, ["Estimate period", "Basis", "EPS low", "EPS average", "EPS high", "Revenue low", "Revenue average", "Revenue high", "Currency", "Source"], (details.estimates || []).map(value => [value.period, value.basis, value.epsLow, value.epsAverage, value.epsHigh, value.revenueLow, value.revenueAverage, value.revenueHigh, value.currency, CFAnalysisSheets.source_(value.source)]));
        row = CFAnalysisSheets.table_(sheet, row, 1, ["Dividend date", "Amount / share", "Currency", "Source"], (events.dividends || []).map(value => [CFAnalysisSheets.date_(value.date, book), value.amount, snapshot.chart?.currency, CFAnalysisSheets.source_(value.source)]));
        CFAnalysisSheets.table_(sheet, row, 1, ["Split date", "New shares", "Old shares", "Source"], (events.splits || []).map(value => [CFAnalysisSheets.date_(value.date, book), value.numerator, value.denominator, CFAnalysisSheets.source_(value.source)]));
        sheet.setColumnWidth(1, 200); sheet.setColumnWidth(2, 160); sheet.setColumnWidth(10, 360); sheet.getRange(8, 10, Math.max(sheet.getLastRow() - 7, 1), 1).setWrap(false);
    }

    static macro_(sheet, fred, book) {
        CFAnalysisSheets.table_(sheet, 7, 1, ["FRED series", "Indicator", "Latest period", "Value", "Unit", "Change", "Status", "Source / notes"], fred.map(series => [series.seriesId, series.label, CFAnalysisSheets.date_(series.latest?.date, book), series.latest?.value, series.unit, series.change, series.status || (series.ok ? "Available" : "Unavailable"), series.periodNote || series.error]));
        if (fred.length) { sheet.getRange(8, 3, fred.length, 1).setNumberFormat("yyyy-mm-dd"); sheet.getRange(8, 4, fred.length, 3).setNumberFormat("0.00"); }
        let row = 15;
        for (const series of fred) {
            const points = (series.observations || []).slice(-400);
            row = CFAnalysisSheets.table_(sheet, row, 1, [series.label || series.seriesId, "Level", "Unit", "Public source"], points.map(point => [CFAnalysisSheets.date_(point.date, book), point.value, series.unit, CFAnalysisSheets.source_(series.source)]));
            if (points.length) { sheet.getRange(row - points.length - 2, 1, points.length, 1).setNumberFormat("yyyy-mm-dd"); sheet.getRange(row - points.length - 2, 2, points.length, 1).setNumberFormat("0.00"); }
        }
        sheet.setColumnWidth(2, 270); sheet.setColumnWidth(5, 170); sheet.setColumnWidth(8, 600);
    }

    static inspect(book) {
        CFAnalysisSheets.check_(book);
        const main = book.getSheetByName("CF Analysis"), sources = book.getSheetByName("CF Sources");
        const rows = name => { const sheet = book.getSheetByName(name); return sheet ? sheet.getRange(8, 1, Math.max(sheet.getLastRow() - 7, 1), Math.min(sheet.getMaxColumns(), 10)).getValues() : []; };
        const sourceRows = rows("CF Sources"), earningsRows = rows("CF Earnings");
        const earningsEnd = earningsRows.findIndex(row => row[0] === "Financial period");
        const options = book.getSheetByName("CF Options");
        const modelValues = options ? options.getRange("S4:S11").getValues().flat() : [];
        const model = Object.fromEntries(["price", "delta", "gamma", "theta", "vega", "rho", "d1", "d2"].map((name, index) => [name, modelValues[index] ?? null]));
        const formulaErrors = [];
        for (const [sheet, address] of [[main, "B9:B24"], [options, "S4:S16"], [options, "O24:P44"]]) {
            if (!sheet) continue;
            const values = sheet.getRange(address).getValues();
            values.forEach((line, row) => line.forEach((value, column) => {
                if (typeof value === "string" && /^#(?:REF!|ERROR!|NAME\?|VALUE!|NUM!|DIV\/0!|N\/A)/.test(value)) formulaErrors.push({ sheet: sheet.getName(), range: address, rowOffset: row, columnOffset: column, value });
            }));
        }
        const expiryCell = options?.getRange("B4");
        const validation = typeof expiryCell?.getDataValidation === "function" ? expiryCell.getDataValidation() : null;
        const criteria = validation ? validation.getCriteriaValues() : [];
        const availableExpirations = Array.isArray(criteria[0]) ? criteria[0].filter(value => typeof value === "string").slice(0, 40) : [];
        return { ticker: sources ? sources.getRange("B3").getValue() || "" : "", inputTicker: main ? main.getRange("B4").getValue() : "", symbol: main ? main.getRange("B5").getValue() : "",
            status: main ? main.getRange("H4").getValue() : "", selectedExpiration: options ? CFAnalysisSheets.readInput(book).expiration : "", availableExpirations, model, formulaErrors,
            historyRows: rows("CF Price history").filter(row => row[0] instanceof Date).length,
            earningsRows: earningsRows.slice(0, earningsEnd < 0 ? earningsRows.length : earningsEnd).filter(row => (row[1] === "GAAP" || row[1] === "Adjusted") && (typeof row[2] === "number" || typeof row[3] === "number")).length,
            fundamentalRows: rows("CF Fundamentals").filter(row => typeof row[0] === "string" && row[0] && row[0] !== "Metric" && row[4]).length,
            optionRows: rows("CF Options").filter(row => row[0] instanceof Date && ["CALL", "PUT"].includes(String(row[1]).toUpperCase())).length,
            chartTitles: CF_ANALYSIS_SHEET_NAMES_.flatMap(name => (book.getSheetByName(name)?.getCharts() || []).map(chart => String(chart.getOptions().get("title") || ""))),
            errors: sourceRows.filter(row => typeof row[3] === "string" && row[3] && !/^(?:OK|PASS|AVAILABLE|PARSED|COMPLETE|SUCCESS)$/i.test(row[3]) && row[0] !== "Provider").map(row => ({ provider: row[0], status: row[3], note: row[7] })) };
    }
}
