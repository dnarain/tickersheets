import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { TickerSheetsDetails as Details } from "../src/TickerSheetsDetails.js";

const fixture = name => fs.readFileSync(new URL(`./fixtures/analysis-details-${name}.html`, import.meta.url), "utf8");
const nvda = fixture("nvda");
const payload = () => JSON.parse(JSON.parse(nvda.match(/<script[^>]*>([\s\S]*)<\/script>/)[1]).body).quoteSummary.result[0];
const page = (quote, requested = "NVDA", query = "") => '<script type="application/json" data-sveltekit-fetched data-url="https://query1.finance.yahoo.com/v10/finance/quoteSummary/' + requested + query + '">' + JSON.stringify({ status: 200, body: JSON.stringify({ quoteSummary: { result: [quote], error: null } }) }) + '</script>';

describe("public Yahoo quote details", () => {
    it("reads explicit regular, pre-market and after-hours quote pairs from the matching price module", () => {
        const result = Details.parsePage(nvda, "NVDA");
        expect(result.quoteSessions).toMatchObject({ symbol: "NVDA", currency: "USD", marketState: "POST",
            regular: { price: 173.73, quoteTime: "2026-11-11T21:00:00.000Z" },
            pre: { price: 172.77, quoteTime: "2026-11-11T14:29:59.000Z" },
            post: { price: 159.5405, quoteTime: "2026-11-12T00:44:09.000Z", change: -14.189499, changeFraction: -0.08167559 } });
    });
    it("does not select an untimed after-hours price or use related-ticker price fields", () => {
        const q = payload(); delete q.price.postMarketTime; q.relatedQuote = { symbol: "MSFT", postMarketPrice: { raw: 999 }, postMarketTime: 1794445200 };
        const result = Details.parsePage(page(q), "NVDA"); expect(result.quoteSessions.post.price).toBeNull();
        expect(result.quoteSessions.regular.price).toBe(173.73);
    });
    it("does not choose the first of duplicated matching primary price objects", () => {
        const q = payload(), duplicate = payload(); duplicate.price.postMarketPrice.raw = 999;
        const html = page(q).replace(JSON.stringify({ quoteSummary: { result: [q], error: null } }).replaceAll('"','\\"'), JSON.stringify({ quoteSummary: { result: [q, duplicate], error: null } }).replaceAll('"','\\"'));
        expect(Details.parsePage(html, "NVDA").ok).toBe(false);
    });
    it("reads the captured ticker's financial metrics with raw units and source fields", () => {
        const result = Details.parsePage(nvda, "NVDA");
        expect(result.ok).toBe(true); expect(result.name).toBe("NVIDIA Corporation");
        expect(result.fields.market_cap.value).toBeGreaterThan(4e12);
        expect(result.fields.market_cap).toMatchObject({ unit: "currency", currency: "USD", field: "price.marketCap.raw", source: "https://finance.yahoo.com/quote/NVDA/" });
        expect(result.fields.trailing_pe.value).toBeCloseTo(21.96, 1);
        expect(result.fields.eps_ttm.value).toBe(7.91);
        expect(result.fields.gross_margin.value).toBeGreaterThan(0.5);
        expect(result.fields.target_price.value).toBeGreaterThan(0);
    });

    it("keeps GAAP and adjusted EPS rows distinct and preserves fiscal period labels", () => {
        const result = Details.parsePage(nvda, "NVDA");
        expect(result.earnings).toHaveLength(8);
        const gaap = result.earnings.find(row => row.basis === "GAAP" && row.period === "3Q2026");
        const adjusted = result.earnings.find(row => row.basis === "Adjusted" && row.period === "3Q2026");
        expect(gaap).toMatchObject({ fiscalPeriod: "3Q2026", calendarPeriod: "3Q2025", periodEnd: "2025-10-31", reportedDate: "2025-11-19", actual: 1.3, estimate: 1.19815, surprisePct: 8.5, field: "earningsGaap.earningsChart.quarterly" });
        expect(adjusted).toMatchObject({ actual: 1.3, estimate: 1.25647, surprisePct: 3.46, field: "earningsNonGaap.earningsChart.quarterly" });
        expect(gaap.difference).toBeCloseTo(1.3 - 1.19815, 8);
    });

    it("returns source-backed annual and quarterly revenue/net-income schedules", () => {
        const result = Details.parsePage(nvda, "NVDA");
        expect(result.financials).toHaveLength(16);
        expect(result.financials.find(row => row.period === "2025" && row.basis === "GAAP")).toMatchObject({ frequency: "Annual", revenue: 130497000000, netIncome: 72880000000, currency: "USD" });
        expect(result.financials.some(row => row.frequency === "Quarterly" && row.basis === "Adjusted")).toBe(true);
    });

    it("returns the next earnings date, source estimate flag and separate consensus ranges", () => {
        const result = Details.parsePage(nvda, "NVDA");
        expect(result.nextEarnings).toMatchObject({ dates: ["2026-11-17"], estimated: false });
        expect(result.estimates.find(row => row.basis === "GAAP")).toMatchObject({ period: "3Q2027", epsAverage: 2.49834 });
        expect(result.estimates.find(row => row.basis === "Adjusted")).toMatchObject({ period: "3Q2027", epsAverage: 2.47461 });
        expect(result.estimates.find(row => row.basis === "Provider consensus")).toMatchObject({ epsLow: 2.34, epsAverage: 2.47461, epsHigh: 2.7, revenueAverage: 109006829530 });
    });

    it("returns ETF metrics without fabricating company earnings", () => {
        const result = Details.parsePage(fixture("xic-to"), "XIC.TO");
        expect(result.ok).toBe(true);
        expect(result.fields.fund_assets.value).toBeGreaterThan(0);
        expect(result.fields.expense_ratio).toBeUndefined();
        expect(result.earnings).toEqual([]); expect(result.financials).toEqual([]); expect(result.estimates).toEqual([]);
        expect(result.nextEarnings.dates).toEqual([]);
    });
});

describe("quote details identity and safe failures", () => {
    it("ignores an unrelated block before the requested payload", () => {
        const other = payload(); other.price.symbol = "MSFT"; other.price.marketCap = { raw: 1 };
        const result = Details.parsePage(page(other, "MSFT") + nvda, "NVDA");
        expect(result.ok).toBe(true); expect(result.fields.market_cap.value).toBeGreaterThan(4e12);
    });
    it("rejects a requested related payload inside another ticker's primary page", () => {
        const html = nvda.replace(/<title>[^<]*<\/title>/, '<title>Apple Inc. (AAPL) Stock Price - Yahoo Finance</title>');
        expect(Details.parsePage(html, "NVDA").ok).toBe(false);
    });

    it.each([
        html => html.replaceAll('/quoteSummary/NVDA', '/quoteSummary/MSFT'),
        html => { const q = payload(); q.price.symbol = "MSFT"; return page(q); },
        html => html.replace('query1.finance.yahoo.com', 'untrusted.example'),
        html => html.replace('application/json', 'text/javascript'),
        html => html.replace('data-sveltekit-fetched', 'unrelated-data')
    ])("requires both the matching source URL and embedded quote symbol (%#)", change => {
        const result = Details.parsePage(change(nvda), "NVDA");
        expect(result.ok).toBe(false); expect(result.fields).toEqual({}); expect(result.earnings).toEqual([]);
    });

    it.each(["", null, '<title>Consent required</title>', '<script type="application/json" data-sveltekit-fetched data-url="https://query1.finance.yahoo.com/v10/finance/quoteSummary/NVDA">{broken}</script>'])
    ("returns a fixed unavailable result for absent or malformed JSON (%#)", html => {
        const result = Details.parsePage(html, "NVDA");
        expect(result.ok).toBe(false); expect(result.error).toBe("Public quote details are unavailable.");
    });

    it("ignores HTTP errors embedded in an otherwise successful HTML page", () => {
        const html = page(payload()).replace('"status":200', '"status":401');
        expect(Details.parsePage(html, "NVDA").ok).toBe(false);
    });

    it("ignores provider error objects without exposing their messages", () => {
        const html = '<script type="application/json" data-sveltekit-fetched data-url="https://query1.finance.yahoo.com/v10/finance/quoteSummary/NVDA">' + JSON.stringify({ status: 200, body: JSON.stringify({ quoteSummary: { result: [payload()], error: { description: "private-error-text" } } }) }) + '</script>';
        const result = Details.parsePage(html, "NVDA");
        expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain("private-error-text");
    });

    it("does not return raw auth URLs, response bodies or unlisted private properties", () => {
        const q = payload(); q.privateToken = "synthetic-private-token";
        const result = Details.parsePage(page(q, "NVDA", '?crumb=synthetic-private-token&amp;token=synthetic-auth'), "NVDA");
        expect(result.ok).toBe(true);
        expect(JSON.stringify(result)).not.toMatch(/synthetic-private|synthetic-auth|crumb=|quoteSummary.*body/);
        expect(result.source).toBe("https://finance.yahoo.com/quote/NVDA/");
    });

    it.each(["NVDA?secret=1", "NASDAQ:NVDA", "<script>", "", undefined])("rejects invalid Yahoo-symbol input %s", symbol => {
        expect(Details.parsePage(nvda, symbol).ok).toBe(false);
    });

    it("keeps missing numeric fields absent and preserves an explicit zero", () => {
        const q = { price: { symbol: "NVDA", marketCap: { raw: 0 } }, summaryDetail: { trailingPE: {}, beta: { raw: null } } };
        const result = Details.parsePage(page(q), "NVDA");
        expect(result.fields.market_cap.value).toBe(0);
        expect(result.fields.trailing_pe).toBeUndefined(); expect(result.fields.beta).toBeUndefined();
    });

    it("normalizes Yahoo's debt/equity percentage-points to a fraction", () => {
        const q = { price: { symbol: "NVDA", currency: "USD" }, financialData: { debtToEquity: { raw: 125, fmt: "125.00" }, totalDebt: { raw: 4 }, financialCurrency: "EUR" } };
        const result = Details.parsePage(page(q), "NVDA");
        expect(result.fields.debt_to_equity).toMatchObject({ value: 1.25, unit: "fraction" });
        expect(result.fields.total_debt.currency).toBe("EUR");
    });

    it("calculates missing EPS surprise from raw values and an absolute negative estimate", () => {
        const q = { price: { symbol: "NVDA" }, earningsGaap: { earningsChart: { quarterly: [{ date: "1Q2026", actual: { raw: -0.5 }, estimate: { raw: -1 } }, { date: "2Q2026", actual: { raw: 0.5 }, estimate: { raw: 0 } }] } } };
        const rows = Details.parsePage(page(q), "NVDA").earnings;
        expect(rows[0].surprisePct).toBe(50); expect(rows[1].surprisePct).toBeNull();
    });

    it("does not label a generic earnings module as GAAP without a stated basis", () => {
        const q = payload(); delete q.earningsGaap; delete q.earningsNonGaap; q.earnings.defaultMethodology = "unknown";
        expect(Details.parsePage(page(q), "NVDA").earnings).toEqual([]);
        q.earnings.defaultMethodology = "nongaap";
        expect(Details.parsePage(page(q), "NVDA").earnings.every(row => row.basis === "Adjusted")).toBe(true);
    });

    it("does not throw on changed earnings array types or missing calendar flags", () => {
        const q = { price: { symbol: "NVDA" }, earningsGaap: { earningsChart: { quarterly: {} }, financialsChart: { yearly: "changed" } }, calendarEvents: { earnings: { earningsDate: [null, { fmt: "2026-02-30" }] } } };
        const result = Details.parsePage(page(q), "NVDA");
        expect(result.ok).toBe(true); expect(result.earnings).toEqual([]); expect(result.financials).toEqual([]);
        expect(result.nextEarnings).toMatchObject({ dates: [], estimated: null });
    });

    it("reads published future-quarter analyst estimates separately from actual earnings", () => {
        const q = { price: { symbol: "NVDA", currency: "USD" }, earningsTrend: { trend: [{ period: "+1q", endDate: "2027-01-31", growth: { raw: 0.1 }, earningsEstimate: { avg: { raw: 2 }, low: { raw: 1 }, high: { raw: 3 }, numberOfAnalysts: { raw: 8 } }, revenueEstimate: { avg: { raw: 100 }, numberOfAnalysts: { raw: 6 } } }] } };
        const result = Details.parsePage(page(q), "NVDA");
        expect(result.earnings).toEqual([]);
        expect(result.estimates[0]).toMatchObject({ period: "+1q", periodEnd: "2027-01-31", epsAverage: 2, epsAnalysts: 8, revenueAverage: 100, revenueAnalysts: 6, growth: 0.1 });
    });
});
