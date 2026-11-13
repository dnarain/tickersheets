/*  *** DEBUG START ***
export { TickerSheetsStrategies };
//  *** DEBUG END ***/

/** Expiration-only position arithmetic. All premiums are per share; cash outputs cover the whole position.
 * OIC definitions checked against the sources returned by references(). This model excludes fees,
 * taxes, dividends, financing, early exercise and changes in contract deliverables.
 */
class TickerSheetsStrategies {
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
                try { return TickerSheetsStrategies.date_(Utilities.formatDate(value, book.getSpreadsheetTimeZone(), "yyyy-MM-dd"), book); }
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
        const expiration = typeof input.expiration === "string" ? TickerSheetsStrategies.date_(input.expiration) : "";
        if (!expiration) return { error: "Enter one valid YYYY-MM-DD expiration for all option legs." };
        const spot = TickerSheetsStrategies.number_(input.spot), ks = TickerSheetsStrategies.number_(input.shortStrike), ps = TickerSheetsStrategies.number_(input.shortPremium, true);
        if (ks === null || ps === null) return { error: "Enter a positive short strike and a nonnegative short premium." };
        if (name === "Covered call" && spot === null) return { error: "Enter the stock cost basis per share." };
        const vertical = name.endsWith("vertical"), kl = vertical ? TickerSheetsStrategies.number_(input.longStrike) : null, pl = vertical ? TickerSheetsStrategies.number_(input.longPremium, true) : 0;
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
        const data = TickerSheetsStrategies.input_(input);
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
        const atZero = TickerSheetsStrategies.payoff_(data, 0), atTop = TickerSheetsStrategies.payoff_(data, high);
        if (!Number.isFinite(netPremium) || !Number.isFinite(stockCost) || !Number.isFinite(atZero) || !Number.isFinite(atTop)) return { ok: false, error: "The position amounts exceed the supported numeric range." };
        if (breakeven !== null) interval = (data.kl !== null && low > 0 && Math.abs(breakeven - low) < 1e-10 && Math.abs(TickerSheetsStrategies.payoff_(data, low)) < 1e-8)
            || (Math.abs(breakeven - high) < 1e-10 && Math.abs(atTop) < 1e-8);
        return { ok: true, strategy: data.strategy, expiration: data.expiration, initialCashflow: netPremium - stockCost, netPremium, stockCost,
            collateral: data.strategy === "Cash-secured put" ? data.ks * data.scale : 0,
            maxProfit: Math.max(atZero, atTop), maxLoss: Math.max(0, -Math.min(atZero, atTop)), breakeven,
            premiumType: netPremium > 0 ? "Net credit" : netPremium < 0 ? "Net debit" : "Zero net premium", structure,
            breakEvenNote: breakeven === null ? "No zero P/L stock price at or above zero for these inputs." : interval ? "Boundary shown; zero P/L can extend beyond this price." : "One stock price at expiration gives zero P/L.", error: "" };
    }
    static payoff(input, stockAtExpiry) {
        const data = TickerSheetsStrategies.input_(input), price = TickerSheetsStrategies.number_(stockAtExpiry, true);
        if (data.error || price === null) return null;
        const result = TickerSheetsStrategies.payoff_(data, price);
        return Number.isFinite(result) ? result : null;
    }
}
