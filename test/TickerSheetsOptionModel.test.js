import { describe, expect, it, vi } from "vitest";
import { TickerSheetsOptionModel as Model, TICKERSHEETS_OPTION_MODEL } from "../src/TickerSheetsOptionModel.js";

const base = { spot: 100, strike: 100, days: 365, iv: 0.2, rate: 0.05, dividendYield: 0, type: "Call" };
const price = input => Model.calculate(input).price;

describe("European option prices and units", () => {
    it("matches standard one-year Black-Scholes call and put values", () => {
        const call = Model.calculate(base), put = Model.calculate({ ...base, type: "Put" });
        expect(call.ok).toBe(true); expect(put.ok).toBe(true);
        expect(call.price).toBeCloseTo(10.4505835721856, 10);
        expect(put.price).toBeCloseTo(5.5735260222570, 10);
        expect(call.d1).toBeCloseTo(0.35, 12); expect(call.d2).toBeCloseTo(0.15, 12);
        expect(call.delta).toBeCloseTo(0.636830651175619, 11);
        expect(put.delta).toBeCloseTo(-0.363169348824381, 11);
        expect(call.gamma).toBeCloseTo(0.018762017345847, 11);
        expect(call.vega).toBeCloseTo(0.375240346916938, 11);
        expect(call.rho).toBeCloseTo(0.532324815453763, 11);
        expect(call.theta).toBeCloseTo(-6.414027546438197 / 365, 11);
        expect(put.theta).toBeCloseTo(-1.657880423934626 / 365, 11);
    });

    it.each([
        { spot: 100, strike: 110, days: 180, iv: 0.3, rate: 0.02, dividendYield: 0.01 },
        { spot: 80, strike: 100, days: 30, iv: 0.6, rate: -0.02, dividendYield: 0.03 },
        { spot: 120, strike: 90, days: 730, iv: 0.15, rate: 0, dividendYield: 0 },
        { spot: 100, strike: 100, days: 365, iv: 0, rate: 0.05, dividendYield: 0.02 }
    ])("satisfies discounted put-call parity (%#)", input => {
        const call = Model.calculate({ ...input, type: "C" }), put = Model.calculate({ ...input, type: "P" });
        expect(call.price - put.price).toBeCloseTo(input.spot * Math.exp(-input.dividendYield * input.days / 365) - input.strike * Math.exp(-input.rate * input.days / 365), 10);
    });

    it("matches zero-rate, zero-dividend reference value", () => {
        expect(price({ ...base, rate: 0 })).toBeCloseTo(7.965567455405804, 10);
    });

    it.each([[0, 0.5], [1, 0.8413447460685429], [-1, 0.15865525393145707], [2, 0.9772498680518208], [3, 0.9986501019683699], [6, 0.9999999990134123]])("matches the normal CDF at %s", (x, wanted) => {
        expect(Model.cdf_(x)).toBeCloseTo(wanted, 14);
        expect(Model.cdf_(x) + Model.cdf_(-x)).toBeCloseTo(1, 14);
    });

    it("keeps deep in/out-of-money prices finite and nonnegative", () => {
        for (const spot of [0.01, 10000]) {
            for (const type of ["Call", "Put"]) {
                const result = Model.calculate({ ...base, spot, type, days: 1 });
                expect(result.ok).toBe(true); expect(result.price).toBeGreaterThanOrEqual(0);
                expect(Object.values(result).every(value => typeof value !== "number" || Number.isFinite(value))).toBe(true);
            }
        }
    });
});

describe("option Greeks against finite differences", () => {
    it.each(["Call", "Put"])("matches %s derivatives with continuous dividend yield", type => {
        const input = { ...base, type, spot: 105, strike: 100, days: 210, iv: 0.32, rate: -0.01, dividendYield: 0.025 };
        const result = Model.calculate(input), spotStep = 0.01, rateStep = 0.00001, ivStep = 0.00001, dayStep = 0.001;
        const upSpot = price({ ...input, spot: input.spot + spotStep }), downSpot = price({ ...input, spot: input.spot - spotStep });
        expect(result.delta).toBeCloseTo((upSpot - downSpot) / (2 * spotStep), 7);
        expect(result.gamma).toBeCloseTo((upSpot - 2 * result.price + downSpot) / (spotStep * spotStep), 7);
        expect(result.vega).toBeCloseTo((price({ ...input, iv: input.iv + ivStep }) - price({ ...input, iv: input.iv - ivStep })) / (2 * ivStep) / 100, 7);
        expect(result.rho).toBeCloseTo((price({ ...input, rate: input.rate + rateStep }) - price({ ...input, rate: input.rate - rateStep })) / (2 * rateStep) / 100, 7);
        expect(result.theta).toBeCloseTo(-(price({ ...input, days: input.days + dayStep }) - price({ ...input, days: input.days - dayStep })) / (2 * dayStep), 7);
    });
});

describe("expiry and zero-volatility limits", () => {
    it.each([
        [120, "Call", 20, 1], [80, "Call", 0, 0], [100, "Call", 0, 0.5],
        [80, "Put", 20, -1], [120, "Put", 0, 0], [100, "Put", 0, -0.5]
    ])("returns expiry intrinsic value and limiting delta (%#)", (spot, type, intrinsic, delta) => {
        const data = Model.calculate({ ...base, spot, type, days: 0 });
        expect(data).toMatchObject({ ok: true, price: intrinsic, delta, gamma: null, theta: null, vega: null, rho: null, d1: null, d2: null, error: "" });
    });

    it.each(["Call", "Put"])("returns a deterministic discounted payoff at zero IV for %s", type => {
        const input = { ...base, spot: type === "Call" ? 120 : 80, type, iv: 0, dividendYield: 0.02 };
        const result = Model.calculate(input), h = 0.00001;
        const gap = input.spot * Math.exp(-0.02) - 100 * Math.exp(-0.05);
        expect(result.price).toBeCloseTo(Math.max(0, type === "Call" ? gap : -gap), 12);
        expect(result.gamma).toBe(0); expect(result.vega).toBe(0); expect(result.d1).toBeNull();
        expect(result.rho).toBeCloseTo((price({ ...input, rate: input.rate + h }) - price({ ...input, rate: input.rate - h })) / (2 * h) / 100, 7);
        expect(result.theta).toBeCloseTo(-(price({ ...input, days: input.days + h }) - price({ ...input, days: input.days - h })) / (2 * h), 7);
    });

    it("returns zero for an out-of-money deterministic call", () => {
        expect(Model.calculate({ ...base, spot: 80, iv: 0 })).toMatchObject({ ok: true, price: 0, delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 });
    });

    it("leaves Greeks unavailable at the deterministic forward-price kink", () => {
        expect(Model.calculate({ ...base, rate: 0, iv: 0 })).toMatchObject({ ok: true, price: 0, delta: null, gamma: null, theta: null, vega: null, rho: null });
    });
});

describe("option model input guards and worksheet function", () => {
    it.each(["spot", "strike", "days", "iv", "rate", "dividendYield"])("rejects missing/non-numeric %s without coercion", field => {
        for (const value of [undefined, null, "", "0", "100", true, NaN, Infinity, -Infinity, []]) {
            const result = Model.calculate({ ...base, [field]: value });
            expect(result.ok).toBe(false); expect(result.error).toBe("Enter valid option model inputs.");
            expect(result.price).toBeNull(); expect(result.delta).toBeNull();
        }
    });

    it.each([{ spot: 0 }, { spot: -1 }, { strike: 0 }, { strike: -1 }, { days: -1 }, { iv: -0.1 }, { type: "future" }, { type: null }])("rejects out-of-range or unsupported inputs (%#)", change => {
        expect(Model.calculate({ ...base, ...change }).ok).toBe(false);
    });

    it("returns fixed errors for malformed objects and numerical overflow", () => {
        for (const input of [null, [], "invalid", { ...base, spot: 1e308, days: 100000, rate: -100 }]) {
            const result = Model.calculate(input);
            expect(result.ok).toBe(false); expect(result.price).toBeNull();
        }
        const input = { ...base, get spot() { throw new Error("private input"); } };
        expect(Model.calculate(input).error).toBe("Enter valid option model inputs.");
    });

    it("returns requested metrics without network requests or script properties", () => {
        const fetch = vi.spyOn(UrlFetchApp, "fetch");
        expect(TICKERSHEETS_OPTION_MODEL(100, 100, 365, 0.2, 0.05, 0, " call ")).toBeCloseTo(10.4505835721856, 10);
        expect(TICKERSHEETS_OPTION_MODEL(100, 100, 365, 0.2, 0.05, 0, "Call", " DELTA ")).toBeCloseTo(0.636830651175619, 11);
        expect(TICKERSHEETS_OPTION_MODEL(100, 100, 0, 0.2, 0.05, 0, "Call", "gamma")).toBe("n.a.");
        expect(TICKERSHEETS_OPTION_MODEL("100", 100, 365, 0.2, 0.05, 0, "Call")).toBe("n.a.");
        expect(TICKERSHEETS_OPTION_MODEL(100, 100, 365, 0.2, 0.05, 0, "Call", "unknown")).toBe("n.a.");
        expect(TICKERSHEETS_OPTION_MODEL(100, 100, 365, 0.2, 0.05, 0, "Call", null)).toBe("n.a.");
        expect(fetch).not.toHaveBeenCalled(); fetch.mockRestore();
    });
});
