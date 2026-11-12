/*  *** DEBUG START ***
export { CFAnalysisOptionModel, CFOPTIONMODEL };
//  *** DEBUG END ***/

/** European Black-Scholes prices with continuous interest and dividend yields. */
class CFAnalysisOptionModel {
    static empty_(error) {
        return { ok: false, price: null, delta: null, gamma: null, theta: null, vega: null, rho: null, d1: null, d2: null, error };
    }

    static density_(value) { return Math.exp(-value * value / 2) / Math.sqrt(2 * Math.PI); }

    /** Positive-term normal integral series avoids alternating-term cancellation. */
    static cdf_(value) {
        if (value === 0) return 0.5;
        // Normal tail mass outside this range is below 6.3e-16.
        if (value < -8) return 0;
        if (value > 8) return 1;
        const absolute = Math.abs(value), square = absolute * absolute;
        let term = absolute, sum = term;
        for (let denominator = 3; denominator < 1000; denominator += 2) {
            term *= square / denominator;
            const next = sum + term;
            if (next === sum) break;
            sum = next;
        }
        const tail = Math.max(0, Math.min(0.5, 0.5 - sum * CFAnalysisOptionModel.density_(absolute)));
        return value < 0 ? tail : 1 - tail;
    }

    /** Theta is per calendar day; vega and rho are per one percentage point. */
    static calculate(input) {
        const invalid = CFAnalysisOptionModel.empty_("Enter valid option model inputs.");
        try {
            if (!input || typeof input !== "object" || Array.isArray(input)) return invalid;
            const { spot, strike, days, iv, rate, dividendYield } = input;
            const values = [spot, strike, days, iv, rate, dividendYield];
            if (!values.every(value => typeof value === "number" && Number.isFinite(value))
                || spot <= 0 || strike <= 0 || days < 0 || iv < 0 || typeof input.type !== "string") return invalid;
            const type = input.type.trim().toUpperCase();
            if (!["CALL", "C", "PUT", "P"].includes(type)) return invalid;
            const call = type === "CALL" || type === "C";
            const result = CFAnalysisOptionModel.empty_("");
            result.ok = true;
            if (days === 0) {
                result.price = Math.max(0, call ? spot - strike : strike - spot);
                result.delta = spot === strike ? (call ? 0.5 : -0.5) : call ? (spot > strike ? 1 : 0) : (spot < strike ? -1 : 0);
                // The remaining expiry Greeks have no smooth time/strike limit.
                return result;
            }
            const time = days / 365, rootTime = Math.sqrt(time);
            const spotDiscount = Math.exp(-dividendYield * time), strikeDiscount = Math.exp(-rate * time);
            const discountedSpot = spot * spotDiscount, discountedStrike = strike * strikeDiscount;
            if (![spotDiscount, strikeDiscount, discountedSpot, discountedStrike].every(Number.isFinite)) return CFAnalysisOptionModel.empty_("Option model results are unavailable for these inputs.");
            if (iv === 0) {
                const forwardGap = discountedSpot - discountedStrike;
                result.price = Math.max(0, call ? forwardGap : -forwardGap);
                const tolerance = 8 * Number.EPSILON * Math.max(discountedSpot, discountedStrike);
                if (Math.abs(forwardGap) <= tolerance) return result;
                const exercised = call ? forwardGap > 0 : forwardGap < 0;
                result.delta = exercised ? (call ? spotDiscount : -spotDiscount) : 0;
                result.gamma = 0; result.vega = 0;
                result.theta = exercised ? (call ? dividendYield * discountedSpot - rate * discountedStrike : rate * discountedStrike - dividendYield * discountedSpot) / 365 : 0;
                result.rho = exercised ? (call ? time * discountedStrike : -time * discountedStrike) / 100 : 0;
            } else {
                result.d1 = (Math.log(spot / strike) + (rate - dividendYield + iv * iv / 2) * time) / (iv * rootTime);
                result.d2 = result.d1 - iv * rootTime;
                const normal1 = CFAnalysisOptionModel.cdf_(result.d1), normal2 = CFAnalysisOptionModel.cdf_(result.d2);
                const negative1 = CFAnalysisOptionModel.cdf_(-result.d1), negative2 = CFAnalysisOptionModel.cdf_(-result.d2);
                const density = CFAnalysisOptionModel.density_(result.d1);
                result.price = Math.max(0, call ? discountedSpot * normal1 - discountedStrike * normal2 : discountedStrike * negative2 - discountedSpot * negative1);
                result.delta = call ? spotDiscount * normal1 : -spotDiscount * negative1;
                result.gamma = spotDiscount * density / (spot * iv * rootTime);
                result.vega = discountedSpot * density * rootTime / 100;
                result.rho = (call ? time * discountedStrike * normal2 : -time * discountedStrike * negative2) / 100;
                const decay = -discountedSpot * density * iv / (2 * rootTime);
                result.theta = (call ? decay - rate * discountedStrike * normal2 + dividendYield * discountedSpot * normal1
                    : decay + rate * discountedStrike * negative2 - dividendYield * discountedSpot * negative1) / 365;
            }
            return Object.entries(result).every(([key, value]) => key === "ok" || key === "error" || value === null || (typeof value === "number" && Number.isFinite(value)))
                ? result : CFAnalysisOptionModel.empty_("Option model results are unavailable for these inputs.");
        } catch (_error) { return invalid; }
    }
}

/**
 * Calculate a European option price or Greek from numeric assumptions.
 * @param {number} spot Underlying price.
 * @param {number} strike Exercise price.
 * @param {number} days Calendar days to expiration.
 * @param {number} iv Annual volatility as a fraction, such as 0.40.
 * @param {number} rate Continuous annual risk-free rate as a fraction.
 * @param {number} dividendYield Continuous annual dividend yield as a fraction.
 * @param {string} type Call or Put.
 * @param {string} metric price, delta, gamma, theta, vega, rho, d1 or d2.
 * @returns {number|string} Requested result, or n.a. for an unavailable result.
 * @customfunction
 */
function CFOPTIONMODEL(spot, strike, days, iv, rate, dividendYield, type, metric = "price") {
    if (typeof metric !== "string") return "n.a.";
    const name = metric.trim().toLowerCase();
    if (!["price", "delta", "gamma", "theta", "vega", "rho", "d1", "d2"].includes(name)) return "n.a.";
    const result = CFAnalysisOptionModel.calculate({ spot, strike, days, iv, rate, dividendYield, type });
    return result.ok && typeof result[name] === "number" && Number.isFinite(result[name]) ? result[name] : "n.a.";
}
