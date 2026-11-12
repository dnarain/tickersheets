/*  *** DEBUG START ***
import { CFAnalysisOptions } from './CacheFinanceAnalysisOptions.js';
export { CFAnalysisStrategies };
//  *** DEBUG END ***/

/** Expiration-only position arithmetic. All premiums are per share; cash outputs cover the whole position.
 * OIC definitions checked against the sources returned by references(). This model excludes fees,
 * taxes, dividends, financing, early exercise and changes in contract deliverables.
 */
class CFAnalysisStrategies {
    static names() { return ["Covered call", "Cash-secured put", "Call vertical", "Put vertical"]; }
    static references() { return [
        ["Covered call", "https://www.optionseducation.org/strategies/all-strategies/covered-call-buy-write"],
        ["Cash-secured put", "https://www.optionseducation.org/strategies/all-strategies/cash-secured-put"],
        ["Bull call vertical", "https://www.optionseducation.org/strategies/all-strategies/bull-call-spread-debit-call-spread"],
        ["Bear call vertical", "https://www.optionseducation.org/strategies/all-strategies/bear-call-spread-credit-call-spread"],
        ["Bull put vertical", "https://www.optionseducation.org/strategies/all-strategies/bull-put-spread-credit-put-spread"],
        ["Bear put vertical", "https://www.optionseducation.org/strategies/all-strategies/bear-put-spread"]
    ]; }
    static number_(value, zero = false) { return typeof value === "number" && Number.isFinite(value) && (zero ? value >= 0 : value > 0) ? value : null; }
    static date_(value, book) {
        if (value instanceof Date && Number.isFinite(value.getTime())) {
            if (typeof Utilities !== "undefined" && typeof Utilities.formatDate === "function") {
                try { return CFAnalysisStrategies.date_(Utilities.formatDate(value, book.getSpreadsheetTimeZone(), "yyyy-MM-dd"), book); }
                catch { return ""; }
            }
            return value.toISOString().slice(0, 10);
        }
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
        const parsed = new Date(value + "T00:00:00.000Z");
        return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : "";
    }
    static input_(input) {
        if (!input || typeof input !== "object") return { error: "Strategy inputs are required." };
        const id = typeof input.strategy === "string" ? input.strategy.toLowerCase().replace(/[ _-]/g, "") : "";
        const name = { coveredcall: "Covered call", cashsecuredput: "Cash-secured put", callvertical: "Call vertical", putvertical: "Put vertical" }[id];
        if (!name) return { error: "Choose a supported strategy." };
        if (!Number.isSafeInteger(input.contracts) || input.contracts <= 0 || !Number.isSafeInteger(input.multiplier) || input.multiplier <= 0
            || !Number.isSafeInteger(input.contracts * input.multiplier)) return { error: "Contracts and multiplier must be positive whole numbers." };
        const expiration = typeof input.expiration === "string" ? CFAnalysisStrategies.date_(input.expiration) : "";
        if (!expiration) return { error: "Enter one valid YYYY-MM-DD expiration for all option legs." };
        const spot = CFAnalysisStrategies.number_(input.spot), ks = CFAnalysisStrategies.number_(input.shortStrike), ps = CFAnalysisStrategies.number_(input.shortPremium, true);
        if (ks === null || ps === null) return { error: "Enter a positive short strike and a nonnegative short premium." };
        if (name === "Covered call" && spot === null) return { error: "Enter the stock cost basis per share." };
        const vertical = name.endsWith("vertical"), kl = vertical ? CFAnalysisStrategies.number_(input.longStrike) : null, pl = vertical ? CFAnalysisStrategies.number_(input.longPremium, true) : 0;
        if (vertical && (kl === null || pl === null || kl === ks)) return { error: "Verticals require different positive strikes and nonnegative premiums." };
        return { strategy: name, spot, kl, pl, ks, ps, expiration, scale: input.contracts * input.multiplier };
    }
    static payoff_(data, price) {
        const credit = data.ps - data.pl;
        if (data.strategy === "Covered call") return (price - data.spot + credit - Math.max(price - data.ks, 0)) * data.scale;
        if (data.strategy === "Cash-secured put") return (credit - Math.max(data.ks - price, 0)) * data.scale;
        const long = data.strategy === "Call vertical" ? Math.max(price - data.kl, 0) : Math.max(data.kl - price, 0);
        const short = data.strategy === "Call vertical" ? Math.max(price - data.ks, 0) : Math.max(data.ks - price, 0);
        return (credit + long - short) * data.scale;
    }
    static calculate(input) {
        const data = CFAnalysisStrategies.input_(input);
        if (data.error) return { ok: false, error: data.error };
        const netPremium = (data.ps - data.pl) * data.scale, stockCost = data.strategy === "Covered call" ? data.spot * data.scale : 0;
        let candidate, structure = data.strategy, interval = false;
        if (data.strategy === "Covered call") candidate = data.spot - data.ps;
        else if (data.strategy === "Cash-secured put") candidate = data.ks - data.ps;
        else if (data.strategy === "Call vertical") {
            candidate = data.kl < data.ks ? data.kl - (data.ps - data.pl) : data.ks + (data.ps - data.pl);
            structure = data.kl < data.ks ? "Bull call vertical" : "Bear call vertical";
        } else {
            candidate = data.kl > data.ks ? data.kl + (data.ps - data.pl) : data.ks - (data.ps - data.pl);
            structure = data.kl > data.ks ? "Bear put vertical" : "Bull put vertical";
        }
        const low = data.kl === null ? 0 : Math.min(data.kl, data.ks), high = data.kl === null ? data.ks : Math.max(data.kl, data.ks);
        let breakeven = candidate >= low && candidate <= high ? candidate : null;
        const atZero = CFAnalysisStrategies.payoff_(data, 0), atTop = CFAnalysisStrategies.payoff_(data, high);
        if (!Number.isFinite(netPremium) || !Number.isFinite(stockCost) || !Number.isFinite(atZero) || !Number.isFinite(atTop)) return { ok: false, error: "The position amounts exceed the supported numeric range." };
        if (breakeven !== null) interval = (data.kl !== null && low > 0 && Math.abs(breakeven - low) < 1e-10 && Math.abs(CFAnalysisStrategies.payoff_(data, low)) < 1e-8)
            || (Math.abs(breakeven - high) < 1e-10 && Math.abs(atTop) < 1e-8);
        return { ok: true, strategy: data.strategy, expiration: data.expiration, initialCashflow: netPremium - stockCost, netPremium, stockCost,
            collateral: data.strategy === "Cash-secured put" ? data.ks * data.scale : 0,
            maxProfit: Math.max(atZero, atTop), maxLoss: Math.max(0, -Math.min(atZero, atTop)), breakeven,
            premiumType: netPremium > 0 ? "Net credit" : netPremium < 0 ? "Net debit" : "Zero net premium", structure,
            breakEvenNote: breakeven === null ? "No zero P/L stock price at or above zero for these inputs." : interval ? "Boundary shown; zero P/L can extend beyond this price." : "One stock price at expiration gives zero P/L.", error: "" };
    }
    static payoff(input, stockAtExpiry) {
        const data = CFAnalysisStrategies.input_(input), price = CFAnalysisStrategies.number_(stockAtExpiry, true);
        if (data.error || price === null) return null;
        const result = CFAnalysisStrategies.payoff_(data, price);
        return Number.isFinite(result) ? result : null;
    }
    static check(book) {
        const sheet = book.getSheetByName("CF Strategies");
        if (sheet && sheet.getRange("Z1").getValue() !== "CACHEFINANCE_STRATEGIES_V1") throw new Error("The existing CF Strategies tab is not a CacheFinance strategy tab. Rename it before building the analysis.");
        return sheet;
    }
    static clear_(sheet) {
        sheet.getRange("A3:Y" + Math.max(sheet.getLastRow(), 65)).clearContent();
        for (const chart of sheet.getCharts()) sheet.removeChart(chart);
    }
    static invalidate(book, reason) {
        const sheet = CFAnalysisStrategies.check(book);
        if (!sheet) return;
        CFAnalysisStrategies.clear_(sheet);
        sheet.getRange("A2").setValue(typeof reason === "string" && !/^\s*[=+@-]/.test(reason) ? reason : "Refresh the selected ticker.");
    }
    static quoteRows_(quotes, spot) {
        const nearest = (a, b) => spot === null ? a.strike - b.strike : Math.abs(a.strike - spot) - Math.abs(b.strike - spot) || a.strike - b.strike;
        if (quotes.length > 1000) {
            const calls = quotes.filter(row => row.type === "Call").sort(nearest), puts = quotes.filter(row => row.type === "Put").sort(nearest);
            const selected = [...calls.slice(0, 500), ...puts.slice(0, 500)];
            // When one type has fewer than 500 quotes, fill spare rows with the nearest remaining strikes.
            const remainder = [...calls.slice(500), ...puts.slice(500)].sort(nearest).slice(0, 1000 - selected.length);
            quotes = [...selected, ...remainder];
        }
        return quotes.sort((a, b) => a.type.localeCompare(b.type) || a.strike - b.strike);
    }
    static render(book, snapshot) {
        let sheet = CFAnalysisStrategies.check(book);
        const main = book.getSheetByName("CF Analysis"), source = book.getSheetByName("CF Options");
        const ticker = typeof snapshot?.ticker === "string" ? snapshot.ticker.trim().toUpperCase() : "";
        if (!ticker || !main || !source || main.getRange("Z1").getValue() !== "CACHEFINANCE_ANALYSIS_V1" || source.getRange("Z1").getValue() !== "CACHEFINANCE_ANALYSIS_V1"
            || String(main.getRange("B4").getValue()).trim().toUpperCase() !== ticker) throw new Error("The ticker changed or the marked analysis tabs are missing. Refresh the current ticker again.");
        const expiration = CFAnalysisStrategies.date_(source.getRange("B4").getValue(), book), options = snapshot.options || {};
        const same = options.ok === true && options.symbol === snapshot.symbol;
        const spot = (same ? CFAnalysisStrategies.number_(options.underlyingPrice) : null) ?? CFAnalysisStrategies.number_(snapshot.chart?.price);
        const rows = CFAnalysisStrategies.quoteRows_(same && expiration && Array.isArray(options.contracts) ? options.contracts.flatMap(row => {
            const type = String(row?.type).toUpperCase(), leg = ["CALL", "PUT"].includes(type) ? CFAnalysisOptions.maturityLeg_(row, snapshot.symbol, expiration, type) : null;
            return leg && leg.mid !== null ? [{ ...leg, type: type === "CALL" ? "Call" : "Put" }] : [];
        }) : [], spot);
        const nearest = type => spot === null ? null : rows.filter(row => row.type === type).sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot) || a.strike - b.strike)[0] || null;
        const call = nearest("Call"), put = nearest("Put");
        const upper = call ? rows.find(row => row.type === "Call" && row.strike > call.strike) : null;
        const lower = put ? [...rows].reverse().find(row => row.type === "Put" && row.strike < put.strike) : null;
        if (!sheet) { sheet = book.insertSheet("CF Strategies"); sheet.getRange("Z1").setValue("CACHEFINANCE_STRATEGIES_V1"); }
        const requiredRows = 1055; // Fixed FILTER input ranges must exist even for a short option chain.
        if (sheet.getMaxRows() < requiredRows) sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
        if (sheet.getMaxColumns() < 26) sheet.insertColumnsAfter(sheet.getMaxColumns(), 26 - sheet.getMaxColumns());
        CFAnalysisStrategies.clear_(sheet);
        sheet.getRange("A1").setFormula('=UPPER(TRIM(\'CF Analysis\'!$B$4))&" — strategy calculator"').setFontSize(16).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2").setValue("Edit yellow cells. Refresh resets assumptions. Source asks seed long legs; bids seed short legs.").setWrap(true);
        for (const [address, values] of [["A3:B3", [["Assumption", "Value"]]], ["D3:E3", [["Expiry result", "Whole position / note"]]], ["A24:B24", [["Stock at expiration", "Position profit / loss"]]],
            ["A55:G55", [["Type", "Strike", "Bid / share", "Ask / share", "Option symbol", "Expiration", "Quote condition"]]], ["T4:Y4", [["Strategy", "Long strike", "Long ask", "Short strike", "Short bid", "Source selection"]]]]) {
            sheet.getRange(address).setValues(values).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold");
        }
        sheet.getRange("A4:A13").setValues(["Strategy", "Stock cost basis / scenario anchor", "Long strike / share", "Long premium paid / share", "Short strike / share", "Short premium received / share", "Contracts", "Multiplier (assumed; editable)", "Shared option expiration", "Selected scenario stock price"].map(value => [value]));
        sheet.getRange("B4:B13").setValues(["Covered call", spot ?? "N/A", "N/A", "N/A", "N/A", "N/A", 1, 100, expiration || "N/A", spot ?? "N/A"].map(value => [value]))
            .setBackground("#FFF2CC").setFontColor("#0000FF").setFontWeight("bold");
        sheet.getRange("B4").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(CFAnalysisStrategies.names(), true).setAllowInvalid(false).build());
        const seed = (name, long, short) => [name, long?.strike ?? "N/A", long?.ask ?? "N/A", short?.strike ?? "N/A", short?.bid ?? "N/A", short ? "Selected expiration; editable" : "No usable source quote"];
        sheet.getRange("T5:Y8").setValues([seed("Covered call", null, call), seed("Cash-secured put", null, put), seed("Call vertical", call, upper), seed("Put vertical", put, lower)]);
        sheet.getRange("B6").setFormula('=IFERROR(INDEX($U$5:$U$8,MATCH($B$4,$T$5:$T$8,0)),"N/A")');
        sheet.getRange("B8").setFormula('=IFERROR(INDEX($W$5:$W$8,MATCH($B$4,$T$5:$T$8,0)),"N/A")');
        const optionType = 'IF(OR($B$4="Covered call",$B$4="Call vertical"),"Call","Put")';
        sheet.getRange("B7").setFormula('=IF(OR($B$4="Covered call",$B$4="Cash-secured put"),"N/A",IFERROR(INDEX(FILTER($D$56:$D$1055,$A$56:$A$1055=' + optionType + ',$B$56:$B$1055=$B$6),1),"N/A"))');
        sheet.getRange("B9").setFormula('=IFERROR(INDEX(FILTER($C$56:$C$1055,$A$56:$A$1055=' + optionType + ',$B$56:$B$1055=$B$8),1),"N/A")');
        sheet.getRange("B12").setFormula('=IFERROR(IF(ISNUMBER(\'CF Options\'!$B$4),TEXT(\'CF Options\'!$B$4,"yyyy-mm-dd"),\'CF Options\'!$B$4),"N/A")');
        sheet.getRange("B5:B9").setNumberFormat("#,##0.00"); sheet.getRange("B10:B11").setNumberFormat("#,##0"); sheet.getRange("B13").setNumberFormat("#,##0.00");
        const metrics = [["Initial cash flow", "initialCashflow"], ["Net option premium", "netPremium"], ["Stock purchase cost", "stockCost"], ["Cash reserved for assignment", "collateral"],
            ["Maximum expiry P/L (signed)", "maxProfit"], ["Maximum loss amount", "maxLoss"], ["Expiry breakeven / share", "breakeven"], ["Premium cash flow type", "premiumType"],
            ["Breakeven note", "breakEvenNote"], ["Selected scenario P/L", "payoff"], ["Position description", "structure"]];
        const args = '$B$4,$B$5,$B$6,$B$7,$B$8,$B$9,$B$10,$B$11,$B$12';
        sheet.getRange("D4:D14").setValues(metrics.map(row => [row[0]]));
        sheet.getRange("E4:E14").setFormulas(metrics.map(row => ['=CFSTRATEGY(' + args + ',"' + row[1] + '"' + (row[1] === "payoff" ? ',$B$13' : '') + ')']));
        sheet.getRange("E4:E10").setNumberFormat("#,##0.00"); sheet.getRange("E11:E14").setWrap(true);
        const notes = ["Stock cost basis starts at the current quote. Enter your own acquisition cost for a covered call. Each contract covers the entered multiplier of shares.",
            "Positive cash flow is money received. Negative cash flow is money paid. Cash reserved for a put is separate from its premium receipt. Vertical broker margin is not estimated.",
            "These are expiration payoffs. The calculation excludes fees, taxes, dividends, financing, slippage, early exercise and assignment timing.",
            "Both vertical legs use the same expiration and multiplier. Source quote rows below show the selected expiration only. Missing quotes remain N/A.",
            "Maximum expiry P/L can be negative when manual premiums make every scenario lose money. This calculator does not recommend a position."];
        notes.forEach((value, index) => sheet.getRange("A" + (17 + index) + ":L" + (17 + index)).merge().setValue(value).setWrap(true).setFontSize(9));
        sheet.getRange("A25:B45").setFormulas(Array.from({ length: 21 }, (_value, index) => [
            '=IFERROR(IF(MAX($B$5,$B$6,$B$8)>0,MAX($B$5,$B$6,$B$8)*' + (index / 10) + ',NA()),NA())',
            '=IFERROR(VALUE(CFSTRATEGY(' + args + ',"payoff",A' + (25 + index) + ')),NA())'
        ]));
        sheet.getRange("A25:B45").setNumberFormat("#,##0.00");
        if (rows.length) sheet.getRange("A56:G" + (55 + rows.length)).setValues(rows.map(row => [row.type, row.strike, row.bid, row.ask, row.contractSymbol, row.expiration, "Ordered bid/ask; may be delayed"]));
        sheet.getRange("J4:K9").setValues(CFAnalysisStrategies.references());
        sheet.setColumnWidth(1, 260); sheet.setColumnWidth(2, 160); sheet.setColumnWidth(3, 130); sheet.setColumnWidth(4, 255); sheet.setColumnWidth(5, 250);
        const validSeed = CFAnalysisStrategies.calculate({ strategy: "Covered call", spot, shortStrike: call?.strike, shortPremium: call?.bid, contracts: 1, multiplier: 100, expiration }).ok;
        if (validSeed) sheet.insertChart(sheet.newChart().setChartType(Charts.ChartType.LINE).addRange(sheet.getRange("A24:B45")).setNumHeaders(1).setPosition(24, 4, 0, 0)
            .setOption("title", ticker + " — strategy payoff").setOption("width", 800).setOption("height", 340).setOption("legend", { position: "none" })
            .setOption("hAxis", { title: "Stock price at expiration" }).setOption("vAxis", { title: "Whole-position profit / loss" }).build());
        return { ticker, expiration, quoteRows: rows.length, payoffChart: validSeed };
    }
    static inspect(book) {
        const sheet = CFAnalysisStrategies.check(book);
        if (!sheet) return { present: false };
        const formulaErrors = [];
        for (const address of ["B4:B13", "E4:E14", "A25:B45"]) sheet.getRange(address).getValues().forEach((line, row) => line.forEach((value, column) => {
            if (typeof value === "string" && /^#(?:REF!|ERROR!|NAME\?|VALUE!|NUM!|DIV\/0!)/.test(value)) formulaErrors.push({ range: address, rowOffset: row, columnOffset: column, value });
        }));
        return { present: true, ticker: book.getSheetByName("CF Analysis")?.getRange("B4").getValue() || "", strategy: sheet.getRange("B4").getValue(), expiration: sheet.getRange("B12").getValue(),
            quoteRows: sheet.getRange("A56:G" + Math.max(sheet.getLastRow(), 56)).getValues().filter(row => ["Call", "Put"].includes(row[0]) && typeof row[1] === "number").length,
            chartTitles: sheet.getCharts().map(chart => String(chart.getOptions().get("title") || "")), formulaErrors };
    }
}
