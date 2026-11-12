import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { CFSmfProviders as P } from "../src/CacheFinanceSmfProviders.js";

const fixture = fs.readFileSync(new URL("./fixtures/smf-advfn-aapl-annual.html", import.meta.url), "utf8");
const annual = (date = "September 26 2026", year = "2026", id = "annualIncomeStatement") =>
    '<div id="' + id + '"><div class="scroll"><table><thead><tr><th>Year End ' + date + '</th><th>2024</th><th>2025</th><th>' + year + '</th></tr></thead><tbody><tr><td>Year End September 27 2025</td></tr></tbody></table></div></div>';
const page = (body = annual(), symbol = "NASDAQ:AAPL") => '<title>Apple Inc (' + symbol + ') Financials - ADVFN</title>'
    + '<link rel="canonical" href="https://www.advfn.com/stock-market/' + symbol.replace(":", "/") + '/financials">' + body;
const response = (body, http = 200) => ({ getResponseCode: () => http, getContentText: () => body });
const parse = body => P.parse("ADVFN", body, "NASDAQ:AAPL");

describe("ADVFN latest annual year-end route", () => {
    it("registers field 5196 without changing the earlier providers", () => {
        expect(P.registry().map(row => row.provider)).toEqual(["FINVIZ", "ZACKS", "GURUFOCUS", "ADVFN"]);
        expect(P.registry().at(-1)).toMatchObject({ label: "ADVFN", fields: [{ id: "year_end_date", smfId: 5196, unit: "date text" }] });
        expect(P.resolveField("advfn", 5196)).toBe("year_end_date");
        expect(P.resolveField("ADVFN", "year_end_date")).toBe("year_end_date");
        expect(P.resolveField("ADVFN", 5197)).toBeNull();
        expect(P.resolveField("FINVIZ", 5196)).toBeNull();
    });

    it("preserves explicit exchange prefixes and does not guess an exchange for bare tickers", () => {
        expect(P.buildUrl("ADVFN", " nasdaq:aapl ")).toBe("https://www.advfn.com/p.php?pid=financials&symbol=NASDAQ:AAPL");
        expect(P.buildUrl("ADVFN", "AAPL")).toBe("https://www.advfn.com/p.php?pid=financials&symbol=AAPL");
        expect(P.buildUrl("ADVFN", "NYSE:BRK.B")).toContain("symbol=NYSE:BRK.B");
        expect(P.buildUrl("FINVIZ", "NASDAQ:AAPL")).toContain("?t=AAPL");
    });

    it.each(["", "TSE:RY", "RY.TO", "NASDAQ:AAPL&x=1", "AAPL/other", "NASDAQ:AAPL?date=x", "https://evil.test", "=IMPORTXML(1)", null, 3])("rejects unsupported or unsafe symbols before requests: %s", ticker => {
        const fetch = vi.fn();
        expect(P.fetch("ADVFN", ticker, { fetch })).toMatchObject({ ok: false, status: "Unsupported ticker", source: "" });
        expect(fetch).not.toHaveBeenCalled();
    });
});

describe("ADVFN annual header acceptance", () => {
    it("reads the captured year-end header as ISO text and keeps provider identity", () => {
        const result = parse(fixture);
        expect(result).toMatchObject({ ok: true, provider: "ADVFN", symbol: "NASDAQ:AAPL", identity: "Matched", status: "Available" });
        expect(result.fields.year_end_date).toMatchObject({ value: "2026-09-26", unit: "date text", smfId: 5196, field: "Year End", status: "Available" });
        expect(result.fields.year_end_date.currency).toBeUndefined();
        expect(result.source).toContain("symbol=NASDAQ:AAPL");
    });

    it("accepts a qualified primary financial URL for an unqualified ticker", () => {
        expect(P.parse("ADVFN", fixture, "AAPL").fields.year_end_date.value).toBe("2026-09-26");
    });

    it.each(["annualIncomeStatement", "annualBalanceSheet", "annualCashFlow"])("accepts a complete annual section with nested divs: %s", id => {
        expect(parse(page(annual("September 26 2026", "2026", id))).fields.year_end_date.value).toBe("2026-09-26");
    });

    it("falls back from an empty annual section to another complete annual section", () => {
        expect(parse(page('<div id="annualIncomeStatement"></div>' + annual("June 30 2026", "2026", "annualCashFlow"))).fields.year_end_date.value).toBe("2026-06-30");
    });

    it("accepts TD/TDEAD cache-normalized headers and Year End Date labels", () => {
        const html = page().replace(/<th>/g, "<td>").replace(/<\/th>/g, "</td>").replace(/thead/g, "tdead").replace("Year End September", "Year End Date September");
        expect(parse(html).fields.year_end_date.value).toBe("2026-09-26");
    });

    it("accepts a real leap day and full month/date punctuation", () => {
        const html = page(annual("February 29, 2028", "2028").replace('<th>2024</th><th>2025</th>', '<th>2026</th><th>2027</th>'));
        expect(parse(html).fields.year_end_date.value).toBe("2028-02-29");
    });

    it.each(["February 30 2026", "February 29 2026", "September 31 2026", "Foo 26 2026", "2026-09-26", "September 26 26"])("rejects an invalid or unexpected provider date: %s", date => {
        expect(parse(page(annual(date))).fields.year_end_date.value).toBeNull();
    });

    it.each(["2025", "TTM", "", "2026*", "2026 2027"])("requires the rightmost annual fiscal year to match the date: %s", year => {
        expect(parse(page(annual("September 26 2026", year))).fields.year_end_date.value).toBeNull();
    });

    it("rejects repeated or descending fiscal years", () => {
        expect(parse(page().replace('<th>2025</th>', '<th>2024</th>')).ok).toBe(false);
        expect(parse(page().replace('<th>2024</th><th>2025</th>', '<th>2025</th><th>2024</th>')).ok).toBe(false);
    });

    it("requires matching dates across all populated annual headers", () => {
        const valid = page(annual() + annual("September 26 2026", "2026", "annualBalanceSheet"));
        expect(parse(valid).ok).toBe(true);
        const conflicting = page(annual() + annual("June 30 2026", "2026", "annualBalanceSheet"));
        expect(parse(conflicting).fields.year_end_date).toMatchObject({ value: null, status: "Conflicting values" });
    });

    it.each([
        annual().replace(/annualIncomeStatement/g, "quarterlyIncomeStatement"),
        '<nav><a href="#annualIncomeStatement">Annual</a></nav><table><thead><th>Year End September 26 2026</th><th>2026</th></thead></table>',
        '<script>var annualIncomeStatement="<div id=\'annualIncomeStatement\'><table><thead><th>Year End September 26 2026</th><th>2026</th></thead></table></div>";</script>',
        '<div id="annualIncomeStatement"><table><tbody><tr><td>Year End September 26 2026</td><td>2026</td></tr></tbody></table></div>',
        annual().replace(/<\/div>/g, "")
    ])("ignores unrelated, script-only, body-only or incomplete annual markers", body => {
        expect(parse(page(body)).fields.year_end_date.value).toBeNull();
    });
});

describe("ADVFN primary ticker identity and network errors", () => {
    it.each(["NASDAQ:MSFT", "NYSE:AAPL", "NASDAQ:AAPLX"])("rejects another primary instrument: %s", primary => {
        expect(parse(page(annual(), primary))).toMatchObject({ ok: false, identity: "Unknown" });
    });

    it("does not use a related financial link as primary identity", () => {
        expect(parse('<title>ADVFN Financials</title><a href="https://www.advfn.com/stock-market/NASDAQ/AAPL/financials">AAPL</a>' + annual()).ok).toBe(false);
    });

    it("rejects mismatched canonical and og:url identity", () => {
        const html = page() + '<meta property="og:url" content="https://www.advfn.com/stock-market/NASDAQ/MSFT/financials">';
        expect(parse(html).identity).toBe("Unknown");
    });

    it("accepts matching canonical/og URLs even if the title supplies only the bare ticker", () => {
        expect(parse(page().replace('(NASDAQ:AAPL)', '(AAPL)')).ok).toBe(true);
        expect(parse(page().replace('<link rel="canonical"', '<meta property="og:url"').replace('href="', 'content="')).ok).toBe(true);
    });

    it("requires a qualified identity for qualified title-only pages", () => {
        const noLink = page().replace(/<link[^>]*>/, "");
        expect(parse(noLink).ok).toBe(true);
        expect(parse(noLink.replace('(NASDAQ:AAPL)', '(AAPL)')).ok).toBe(false);
        expect(P.parse('ADVFN', noLink.replace('(NASDAQ:AAPL)', '(AAPL)'), 'AAPL').ok).toBe(true);
    });

    it("validates the original financial query URL identity too", () => {
        const html = page().replace('https://www.advfn.com/stock-market/NASDAQ/AAPL/financials', 'https://www.advfn.com/p.php?pid=financials&amp;symbol=NASDAQ%3AAAPL');
        expect(parse(html).ok).toBe(true);
        expect(parse(html.replace('NASDAQ%3AAAPL', 'NASDAQ%3AMSFT')).ok).toBe(false);
    });

    it.each(["https://evil.test/stock-market/NASDAQ/AAPL/financials", "https://www.advfn.com.evil.test/stock-market/NASDAQ/AAPL/financials", "https://www.advfn.com/stock-market/NASDAQ/AAPL/"])("rejects unrelated primary URLs: %s", url => {
        expect(parse(page().replace('https://www.advfn.com/stock-market/NASDAQ/AAPL/financials', url)).ok).toBe(false);
    });

    it("reports challenge pages without accepted fields", () => {
        expect(parse('<title>Just a moment...</title>' + annual())).toMatchObject({ ok: false, status: "Blocked" });
    });

    it("retains the exchange and source after a successful request", () => {
        const fetch = vi.fn(() => response(fixture));
        const result = P.fetch('ADVFN', 'NASDAQ:AAPL', { fetch, clock: () => Date.UTC(2026, 10, 11) });
        expect(fetch).toHaveBeenCalledWith('https://www.advfn.com/p.php?pid=financials&symbol=NASDAQ:AAPL', { method: 'get', muteHttpExceptions: true, followRedirects: true });
        expect(result).toMatchObject({ ok: true, http: 200, retrievedAt: '2026-11-11T00:00:00.000Z', symbol: 'NASDAQ:AAPL' });
    });

    it("reports HTTP failure and request exceptions without raw provider text", () => {
        expect(P.fetch('ADVFN', 'AAPL', { fetch: () => response('private raw message', 403) })).toMatchObject({ ok: false, status: 'HTTP 403' });
        const result = P.fetch('ADVFN', 'AAPL', { fetch: () => { throw new Error('private raw message'); } });
        expect(result.status).toBe('Request failed'); expect(JSON.stringify(result)).not.toContain('private raw');
    });
});
