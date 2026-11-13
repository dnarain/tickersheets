import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TickerSheetsStrategies as Strategies } from "../src/TickerSheetsStrategies.js";

const base = extra => ({ strategy: "Covered call", spot: 100, longStrike: "N/A", longPremium: "N/A", shortStrike: 110, shortPremium: 3, contracts: 1, multiplier: 100, expiration: "2026-11-20", ...extra });
describe("expiration strategy arithmetic", () => {
    it("includes stock purchase cost in covered-call cash flow and P/L", () => {
        expect(Strategies.calculate(base())).toMatchObject({ ok: true, netPremium: 300, stockCost: 10000, initialCashflow: -9700, collateral: 0, maxProfit: 1300, maxLoss: 9700, breakeven: 97 });
        [0, 100, 110, 150].forEach((stock, index) => expect(Strategies.payoff(base(), stock)).toBe([-9700, 300, 1300, 1300][index]));
    });
    it("separates put premium from cash reserved for assignment", () => {
        const input = base({ strategy: "Cash-secured put", spot: null, shortStrike: 100 });
        expect(Strategies.calculate(input)).toMatchObject({ ok: true, initialCashflow: 300, netPremium: 300, stockCost: 0, collateral: 10000, maxProfit: 300, maxLoss: 9700, breakeven: 97 });
        expect(Strategies.payoff(input, 0)).toBe(-9700); expect(Strategies.payoff(input, 97)).toBe(0); expect(Strategies.payoff(input, 200)).toBe(300);
    });
    it.each([
        ["Call vertical", 100, 8, 110, 3, "Bull call vertical", -500],
        ["Call vertical", 110, 3, 100, 8, "Bear call vertical", 500],
        ["Put vertical", 110, 8, 100, 3, "Bear put vertical", -500],
        ["Put vertical", 100, 3, 110, 8, "Bull put vertical", 500]
    ])("calculates bounded %s %s/%s and %s/%s", (strategy, longStrike, longPremium, shortStrike, shortPremium, structure, cashflow) => {
        const input = base({ strategy, longStrike, longPremium, shortStrike, shortPremium });
        expect(Strategies.calculate(input)).toMatchObject({ ok: true, structure, netPremium: cashflow, initialCashflow: cashflow, maxProfit: 500, maxLoss: 500, breakeven: 105, stockCost: 0, collateral: 0 });
        expect(Strategies.payoff(input, 105)).toBe(0);
        const outcomes = [0, 90, 100, 105, 110, 120, 10000].map(stock => Strategies.payoff(input, stock));
        expect(Math.max(...outcomes)).toBe(500); expect(Math.min(...outcomes)).toBe(-500);
    });
    it("scales cash values with editable quantity and multiplier", () => {
        const data = Strategies.calculate(base({ contracts: 2, multiplier: 10 }));
        expect(data).toMatchObject({ netPremium: 60, stockCost: 2000, maxProfit: 260, maxLoss: 1940, breakeven: 97 });
        expect(Strategies.payoff(base({ contracts: 2, multiplier: 10 }), 110)).toBe(260);
    });
    it("accepts zero option premiums without converting missing values to zero", () => {
        expect(Strategies.calculate(base({ shortPremium: 0 }))).toMatchObject({ ok: true, netPremium: 0, premiumType: "Zero net premium", maxProfit: 1000, maxLoss: 10000, breakeven: 100 });
        for (const shortPremium of [null, undefined, "0", "3", NaN, Infinity, -1]) expect(Strategies.calculate(base({ shortPremium })).ok).toBe(false);
    });
    it("requires valid dates, integer quantities and distinct vertical strikes", () => {
        for (const patch of [{ expiration: "2026-02-30" }, { expiration: "2026-2-03" }, { expiration: "" }, { expiration: new Date() }, { contracts: 0 }, { contracts: 1.5 }, { contracts: "1" }, { multiplier: null }, { multiplier: -100 }, { spot: "100" }, { shortStrike: 0 }]) expect(Strategies.calculate(base(patch)).ok).toBe(false);
        for (const patch of [{ longStrike: 110, longPremium: 3 }, { longStrike: 100, longPremium: null }, { longStrike: 100, longPremium: "0" }]) expect(Strategies.calculate(base({ strategy: "Call vertical", ...patch })).ok).toBe(false);
        expect(Strategies.calculate(base({ expiration: "2024-02-29" })).ok).toBe(true);
        expect(Strategies.calculate(base({ strategy: "unknown" })).ok).toBe(false);
    });
    it("returns no breakeven when every attainable stock price profits or loses", () => {
        expect(Strategies.calculate(base({ shortPremium: 200 }))).toMatchObject({ ok: true, maxLoss: 0, breakeven: null });
        expect(Strategies.calculate(base({ strategy: "Call vertical", longStrike: 100, longPremium: 20, shortStrike: 110, shortPremium: 0 })))
            .toMatchObject({ ok: true, maxProfit: -1000, maxLoss: 2000, breakeven: null });
        expect(Strategies.calculate(base({ strategy: "Cash-secured put", shortStrike: 100, shortPremium: 110 }))).toMatchObject({ ok: true, maxLoss: 0, breakeven: null });
    });
    it("labels zero-P/L intervals at spread boundaries", () => {
        const result = Strategies.calculate(base({ strategy: "Call vertical", longStrike: 100, longPremium: 3, shortStrike: 110, shortPremium: 3 }));
        expect(result.breakeven).toBe(100); expect(result.breakEvenNote).toContain("Boundary");
        expect(Strategies.payoff(base({ strategy: "Call vertical", longStrike: 100, longPremium: 3, shortStrike: 110, shortPremium: 3 }), 0)).toBe(0);
    });
    it("rejects invalid stock scenarios and numeric overflow", () => {
        for (const stock of [null, undefined, "100", -1, NaN, Infinity]) expect(Strategies.payoff(base(), stock)).toBeNull();
        expect(Strategies.calculate(base({ spot: Number.MAX_VALUE })).ok).toBe(false);
        expect(Strategies.calculate(base({ contracts: Number.MAX_SAFE_INTEGER, multiplier: 100 })).ok).toBe(false);
        expect(Strategies.calculate(null).ok).toBe(false);
    });
    it("accepts simple programmatic aliases and lists primary OIC references", () => {
        expect(Strategies.calculate(base({ strategy: "covered_call" })).ok).toBe(true);
        expect(Strategies.calculate(base({ strategy: "cash-secured-put" })).strategy).toBe("Cash-secured put");
        expect(Strategies.references()).toHaveLength(6); expect(Strategies.references().every(row => row[1].startsWith("https://www.optionseducation.org/strategies/"))).toBe(true);
    });
});

const column = text => [...text].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0);
