import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { CFSmfProviders as P } from "../src/CacheFinanceSmfProviders.js";

const fixture = name => fs.readFileSync(new URL("./fixtures/smf-" + name + ".html", import.meta.url), "utf8");
const finviz = fixture("finviz-nvda"), zacks = fixture("zacks-aapl"), guru = fixture("gurufocus-msft"), guruFaq = fixture("gurufocus-nvda-faq");
const plainFinviz = values => '<title>NVDA - NVIDIA Corp Stock Price and Quote</title><h1 data-ticker="NVDA">NVDA</h1><table class="snapshot-table2">'
    + Object.entries(values).map(([label, value]) => "<tr><td>" + label + "</td><td>" + value + "</td></tr>").join("") + "</table>";
const response = (body, http = 200) => ({ getResponseCode: () => http, getContentText: () => body });

describe("selected SMF provider registry and public URLs", () => {
    it("exposes supported named fields and selected SMF identifiers", () => {
        expect(P.registry().map(row => row.provider)).toEqual(["FINVIZ", "ZACKS", "GURUFOCUS"]);
        expect(P.resolveField("Finviz", 4074)).toBe("price");
        expect(P.resolveField("finviz", "4072")).toBe("earnings_date");
        expect(P.resolveField("zacks", 849)).toBe("target_price");
        expect(P.resolveField("GuruDiv", 2727)).toBe("forward_dividend_yield");
        expect(P.resolveField("FINVIZ", "trailing_pe")).toBe("trailing_pe");
        expect(P.resolveField("ZACKS", "4074")).toBeNull();
        expect(P.resolveField("FINVIZ", "retired_field")).toBeNull();
        expect(P.resolveField("OTHER", "price")).toBeNull();
        expect(P.resolveField("FINVIZ", {})).toBeNull();
    });

    it("returns independent registry copies", () => {
        const first = P.registry(); first[0].fields[0].label = "Changed"; first[0].fields.pop();
        expect(P.registry()[0].fields[0].label).toBe("Price");
        expect(P.registry()[0].fields.length).toBe(32);
    });

    it("keeps the repaired provider routes", () => {
        expect(P.buildUrl("Finviz", " nasdaq:nvda ")).toBe("https://finviz.com/quote.ashx?t=NVDA&p=d");
        expect(P.buildUrl("Zacks", "NYSE:IBM")).toBe("https://www.zacks.com/stock/research/IBM/price-target-stock-forecast");
        expect(P.buildUrl("GuruFocus", "MSFT")).toBe("https://www.gurufocus.com/stock/MSFT/dividend");
    });

    it.each(["", "TSE:RY", "RY.TO", "NVDA?api_key=secret", "NVDA/other", "=IMPORTXML(1)", "NVDA&x=1", "A".repeat(36), null, 123])
    ("rejects unsupported or unsafe ticker input without a request: %s", ticker => {
        const fetch = vi.fn(); const result = P.fetch("Finviz", ticker, { fetch });
        expect(result.ok).toBe(false); expect(result.status).toBe("Unsupported ticker"); expect(result.source).toBe(""); expect(fetch).not.toHaveBeenCalled();
    });

    it.each(["MSN", "Reuters", "YQL", "", null])("rejects unimplemented or retired provider names without a request: %s", provider => {
        const fetch = vi.fn(); expect(P.fetch(provider, "NVDA", { fetch }).status).toBe("Not Supported"); expect(fetch).not.toHaveBeenCalled();
    });

    it("rejects an unknown provider and numeric field without making HTTP requests", () => {
        const fetch = vi.fn();
        expect(P.resolveField("UNKNOWN_PROVIDER", "price")).toBeNull();
        expect(P.buildUrl("UNKNOWN_PROVIDER", "NASDAQ:AAPL")).toBeNull();
        expect(P.fetch("UNKNOWN_PROVIDER", "NASDAQ:AAPL", { fetch })).toMatchObject({
            ok: false, provider: "", status: "Not Supported", source: "", http: null, fields: {}
        });
        expect(fetch).not.toHaveBeenCalled();
    });

    it("allows a syntactically valid nonexistent ticker for negative provider tests", () => {
        const fetch = vi.fn(() => response("", 404));
        expect(P.fetch("FINVIZ", "ZZZZCFINVALID20261111", { fetch }).status).toBe("HTTP 404"); expect(fetch).toHaveBeenCalledOnce();
    });
});

describe("Finviz public snapshot fields", () => {
    it("reads the current public table excerpts and preserves units", () => {
        const result = P.parse("FINVIZ", finviz, "NVDA");
        expect(result.ok).toBe(true); expect(result.identity).toBe("Matched");
        expect(Object.values(result.fields).every(field => field.value !== null)).toBe(true);
        expect(result.fields.price).toMatchObject({ value: 173.73, currency: "USD", unit: "currency", smfId: 4074, field: "Price", status: "Available" });
        expect(result.fields.market_cap.value).toBe(4186890000000);
        expect(result.fields.volume.value).toBe(339233268); expect(result.fields.average_volume.value).toBe(127460000);
        expect(result.fields.trailing_pe.value).toBe(21.96); expect(result.fields.rsi14.value).toBe(28.74);
        expect(result.fields.short_float.value).toBeCloseTo(.0121);
        expect(result.fields.sma20_distance.value).toBeCloseTo(-.1476);
        expect(result.fields.forward_dividend_rate.value).toBe(.78);
        expect(result.fields.forward_dividend_yield.value).toBeCloseTo(.0045);
        expect(result.fields.trailing_dividend_yield.value).toBe(.003);
    });

    it("distinguishes next-year EPS from the same label's growth percentage", () => {
        const result = P.parse("FINVIZ", finviz, "NVDA");
        expect(result.fields.eps_next_year.value).toBe(15.79);
        expect(result.fields.eps_growth_next_year.value).toBeCloseTo(.6997);
        expect(result.fields.eps_next_year.unit).toBe("currency"); expect(result.fields.eps_growth_next_year.unit).toBe("fraction");
    });

    it("retains earnings dates as provider text without inventing a year or time zone", () => {
        const result = P.parse("FINVIZ", finviz, "NVDA");
        expect(result.fields.earnings_date).toMatchObject({ value: "Nov 17 AMC", unit: "date text" });
        expect(result.fields.dividend_ex_date.value).toBe("Sep 10, 2026"); expect(result.quoteTime).toBeNull();
    });

    it("keeps reported zero percentages and volumes, and accepts a loss per share", () => {
        const result = P.parse("FINVIZ", plainFinviz({ Price: "10.00", Volume: "0", "Dividend Est.": "0.00 (0.00%)", "Short Float": "0%", "EPS (ttm)": "-2.50" }), "NVDA");
        expect(result.fields.volume.value).toBe(0); expect(result.fields.forward_dividend_yield.value).toBe(0);
        expect(result.fields.forward_dividend_rate.value).toBe(0); expect(result.fields.short_float.value).toBe(0); expect(result.fields.eps_ttm.value).toBe(-2.5);
    });

    it("does not read a suggested stock's value outside snapshot tables", () => {
        const result = P.parse("FINVIZ", plainFinviz({ Price: "-" }) + '<table><tr><td>Price</td><td>999</td></tr></table><p>Target Price $1000</p>', "NVDA");
        expect(result.ok).toBe(false); expect(result.fields.price.value).toBeNull(); expect(result.fields.target_price.value).toBeNull();
    });

    it("ignores apparent markup inside page scripts and comments", () => {
        const html = plainFinviz({ Price: "-" });
        expect(P.parse("FINVIZ", html + "<script>" + plainFinviz({ Price: 999 }) + "</script><!--" + plainFinviz({ Price: 999 }) + "-->", "NVDA").ok).toBe(false);
    });

    it("rejects conflicting repeated prices and accepts repeated identical source values", () => {
        const first = plainFinviz({ Price: 173.73 });
        const conflict = P.parse("FINVIZ", first + plainFinviz({ Price: 999 }), "NVDA");
        expect(conflict.fields.price).toMatchObject({ value: null, status: "Conflicting values" });
        expect(P.parse("FINVIZ", first + first, "NVDA").fields.price.value).toBe(173.73);
    });

    it.each(["-", "N/A", "--", "—", "0", "-2", "1,2x", "Infinity", "=1+1", "9".repeat(400)])("does not turn invalid stock prices into a number: %s", value => {
        expect(P.parse("FINVIZ", plainFinviz({ Price: value }), "NVDA").fields.price.value).toBeNull();
    });

    it.each(["Feb 30 AMC", "Apr 31, 2026", "Feb 29, 2025", "Nov 0 AMC", "=IMPORTXML(1)", "Tomorrow", "2026-11-17"])
    ("rejects unrecognized or invalid date text: %s", value => {
        expect(P.parse("FINVIZ", plainFinviz({ Earnings: value }), "NVDA").fields.earnings_date.value).toBeNull();
    });

    it("accepts February 29 without assigning a year, and rejects RSI values outside zero to one hundred", () => {
        expect(P.parse("FINVIZ", plainFinviz({ Earnings: "Feb 29 AMC" }), "NVDA").fields.earnings_date.value).toBe("Feb 29 AMC");
        expect(P.parse("FINVIZ", plainFinviz({ "RSI (14)": 101 }), "NVDA").fields.rsi14.value).toBeNull();
        expect(P.parse("FINVIZ", plainFinviz({ "RSI (14)": 0 }), "NVDA").fields.rsi14.value).toBe(0);
    });

    it.each([
        html => html.replace("<title>NVDA", "<title>MSFT"),
        html => html.replace('data-ticker="NVDA"', 'data-ticker="MSFT"'),
        html => html.replace('href="/stock?t=NVDA"', 'href="/stock?t=MSFT"'),
        html => html.replace('href="/stock?t=NVDA"', 'href="https://finviz.com.evil.test/stock?t=NVDA"'),
        html => html.replace("<title>", "<title>Suggested NVDA in "),
        html => html.replace(/<title>[\s\S]*?<\/title>/, "")
    ])("rejects mismatched primary page identity (%#)", change => {
        const result = P.parse("FINVIZ", change(finviz), "NVDA");
        expect(result.ok).toBe(false); expect(result.identity).toBe("Unknown"); expect(Object.values(result.fields).every(field => field.value === null)).toBe(true);
    });
});

describe("repaired Zacks and GuruFocus recipes", () => {
    it("reads Zacks Average Price Target from its column rather than another price", () => {
        const result = P.parse("ZACKS", zacks, "AAPL");
        expect(result.ok).toBe(true); expect(result.fields.target_price).toMatchObject({ value: 338.68, currency: "USD", unit: "currency", smfId: 849 });
    });

    it("uses the target header position instead of assuming the first column", () => {
        const html = zacks.replace("Average Price Target</th><th scope=\"col\" class=\"align_center\">Highest Price Target", "Highest Price Target</th><th scope=\"col\" class=\"align_center\">Average Price Target");
        expect(P.parse("ZACKS", html, "AAPL").fields.target_price.value).toBe(400);
    });

    it("does not accept a target in plain text or a column with a changed label", () => {
        expect(P.parse("ZACKS", zacks.replace("Average Price Target</th>", "Average Trading Price</th>"), "AAPL").ok).toBe(false);
        expect(P.parse("ZACKS", zacks.replace(/<table>[\s\S]*?<\/table>/, "<p>Average Price Target $338.68</p>"), "AAPL").ok).toBe(false);
    });

    it("rejects conflicting repeated Zacks target tables", () => {
        expect(P.parse("ZACKS", zacks + zacks.replace("$338.68", "$100.00"), "AAPL").fields.target_price.status).toBe("Conflicting values");
    });

    it("reads forward and trailing GuruFocus percentages separately", () => {
        const result = P.parse("GURUFOCUS", guru, "MSFT");
        expect(result.ok).toBe(true); expect(result.fields.forward_dividend_yield.value).toBeCloseTo(.0078);
        expect(result.fields.trailing_dividend_yield.value).toBeCloseTo(.0071);
        expect(result.fields.forward_dividend_yield).toMatchObject({ unit: "fraction", smfId: 2727 });
    });

    it("does not substitute trailing yield when forward yield is missing", () => {
        const result = P.parse("GURUFOCUS", guru.replace("0.78% (Forward)", "- (Forward)"), "MSFT");
        expect(result.fields.forward_dividend_yield.value).toBeNull(); expect(result.fields.trailing_dividend_yield.value).toBeCloseTo(.0071);
    });

    it("requires the Dividend Yield heading and matching primary dividend section", () => {
        expect(P.parse("GURUFOCUS", guru.replace("<h4>Dividend Yield</h4>", "<h4>Yield on Cost</h4>"), "MSFT").ok).toBe(false);
        expect(P.parse("GURUFOCUS", guru.replace("<h1>MSFT Stock Historical Dividends", "<h1>NVDA Stock Historical Dividends"), "MSFT").ok).toBe(false);
    });

    it("ignores another dividend-yield card after the primary section", () => {
        const html = guru.replace("Unrelated trailing page content", "<div>99% (Forward)</div><h4>Dividend Yield</h4>");
        expect(P.parse("GURUFOCUS", html, "MSFT").fields.forward_dividend_yield.value).toBeCloseTo(.0078);
    });

    it("rejects conflicting forward yield divs and preserves zero dividends", () => {
        const conflict = guru.replace("<h4>Dividend Yield</h4>", "<div>1.00% (Forward)</div><h4>Dividend Yield</h4>");
        expect(P.parse("GURUFOCUS", conflict, "MSFT").fields.forward_dividend_yield.status).toBe("Conflicting values");
        expect(P.parse("GURUFOCUS", guru.replace("0.78% (Forward)", "0.00% (Forward)"), "MSFT").fields.forward_dividend_yield.value).toBe(0);
    });

    it.each([["ZACKS", zacks, "MSFT"], ["GURUFOCUS", guru, "AAPL"]])("rejects another requested ticker for %s", (provider, html, ticker) => {
        expect(P.parse(provider, html, ticker).ok).toBe(false);
    });
});

describe("provider access and safe status results", () => {
    it("fetches once, records public request metadata, and returns no raw HTML", () => {
        const fetch = vi.fn(() => response(finviz));
        const result = P.fetch("finviz", "NVDA", { fetch, clock: () => Date.UTC(2026, 10, 11, 20) });
        expect(fetch).toHaveBeenCalledExactlyOnceWith("https://finviz.com/quote.ashx?t=NVDA&p=d", { method: "get", muteHttpExceptions: true, followRedirects: true });
        expect(result).toMatchObject({ ok: true, status: "Available", http: 200, identity: "Matched", retrievedAt: "2026-11-11T20:00:00.000Z", quoteTime: null });
        expect(result).not.toHaveProperty("body"); expect(JSON.stringify(result)).not.toContain("<html");
    });

    it.each([401, 403, 404, 429, 500])("keeps HTTP %i explicit without inferring a subscription requirement", http => {
        const result = P.fetch("ZACKS", "NVDA", { fetch: () => response("private-url-secret", http) });
        expect(result.status).toBe("HTTP " + http); expect(result.http).toBe(http); expect(result.ok).toBe(false);
        expect(JSON.stringify(result)).not.toContain("private-url-secret");
    });

    it.each(['<title>Just a moment...</title><div>challenge token</div>', '<title>Access Denied</title>', '<iframe src="/_Incapsula_Resource?secret=hidden">Request unsuccessful. Incapsula</iframe>'])
    ("identifies access challenges without returning their private content (%#)", html => {
        const result = P.fetch("GURUFOCUS", "NVDA", { fetch: () => response(html) });
        expect(result.status).toBe("Blocked"); expect(result.ok).toBe(false); expect(result.identity).toBe("Unknown");
        expect(JSON.stringify(result)).not.toMatch(/challenge token|secret=hidden/);
    });

    it("does not expose request or content-reading exception messages", () => {
        const result = P.fetch("FINVIZ", "NVDA", { fetch: () => { throw new Error("api_key=private-value"); } });
        expect(result.status).toBe("Request failed"); expect(JSON.stringify(result)).not.toContain("private-value");
        const broken = P.fetch("FINVIZ", "NVDA", { fetch: () => ({ getResponseCode: () => 200, getContentText: () => { throw new Error("private-body"); } }) });
        expect(broken.status).toBe("Request failed"); expect(JSON.stringify(broken)).not.toContain("private-body");
    });

    it.each([null, "", "malformed", {}, '<title>Unknown quote</title>'])
    ("returns unavailable results for unreadable or unmatched pages (%#)", html => {
        const result = P.parse("FINVIZ", html, "NVDA"); expect(result.ok).toBe(false); expect(result.status).toBe("Data unavailable");
    });

    it("omits a malformed identity URL without throwing", () => {
        expect(P.parse("FINVIZ", finviz.replace("/stock?t=NVDA", "/stock?t=%zz"), "NVDA").ok).toBe(false);
    });
});

describe("current ticker-specific GuruFocus FAQ", () => {
    it("reads current native public text when the old heading/div recipe is absent", () => {
        const result = P.parse("GURUFOCUS", guruFaq, "NVDA");
        expect(result).toMatchObject({ ok: true, identity: "Matched", status: "Available" });
        expect(result.fields.trailing_dividend_yield.value).toBeCloseTo(.0026); expect(result.fields.forward_dividend_yield.value).toBeCloseTo(.0049);
        expect(result.fields.forward_dividend_yield.unit).toBe("fraction");
    });
    it.each([
        html => html.replace("Frequently Asked Questions: NVDA Dividend", "Frequently Asked Questions: MSFT Dividend"),
        html => html.replace("(NVDA) currently has", "(MSFT) currently has"),
        html => html.replace("The forward yield is 0.49%.", "The forward yield is unavailable."),
        html => html.replace("dividend yield of 0.26%, paying", "dividend yield of --, paying"),
        html => html.replace("paying $0.52 per share annually.", "paying an unavailable amount annually."),
        html => html.replace("<title>NVDA", "<title>MSFT")
    ])("requires the requested primary page, FAQ heading and complete exact answer (%#)", change => {
        const result = P.parse("GURUFOCUS", change(guruFaq), "NVDA"); expect(result.ok).toBe(false); expect(result.fields.forward_dividend_yield.value).toBeNull();
    });
    it("accepts identical duplicate FAQ answers and rejects conflicting duplicates", () => {
        const answer = "NVIDIA Corp (NVDA) currently has a dividend yield of 0.26%, paying $0.52 per share annually. The forward yield is 0.49%.";
        const duplicate = guruFaq.replace("<h2>Also check out</h2>", "<p>" + answer + "</p><h2>Also check out</h2>");
        expect(P.parse("GURUFOCUS", duplicate, "NVDA").fields.forward_dividend_yield.value).toBeCloseTo(.0049);
        const conflict = duplicate.replace("<p>" + answer + "</p><h2>Also check out", "<p>" + answer.replace("0.49%", "0.50%") + "</p><h2>Also check out");
        const result = P.parse("GURUFOCUS", conflict, "NVDA"); expect(result.ok).toBe(false); expect(Object.values(result.fields).every(field => field.value === null && field.status === "Conflicting values")).toBe(true);
    });
    it("rejects a mismatch between the visible yield pair and the FAQ", () => {
        const result = P.parse("GURUFOCUS", guruFaq.replace("0.26% (Trailing)", "0.27% (Trailing)"), "NVDA");
        expect(result.ok).toBe(false); expect(result.fields.forward_dividend_yield.status).toBe("Conflicting values");
    });
    it("keeps a published zero yield and does not turn missing text into zero", () => {
        const zero = guruFaq.replaceAll("0.26%", "0.00%").replaceAll("0.49%", "0.00%").replaceAll("$0.52", "$0.00");
        const result = P.parse("GURUFOCUS", zero, "NVDA"); expect(result.ok).toBe(true); expect(result.fields.forward_dividend_yield.value).toBe(0); expect(result.fields.trailing_dividend_yield.value).toBe(0);
    });
    it("excludes another FAQ section and recommended-ticker content after it", () => {
        const extra = "<h2>Frequently Asked Questions: AAPL Dividend</h2><p>NVIDIA Corp (NVDA) currently has a dividend yield of 99%, paying $99 per share annually. The forward yield is 99%.</p>";
        const result = P.parse("GURUFOCUS", guruFaq.replace("<h2>Also check out</h2>", extra), "NVDA"); expect(result.fields.forward_dividend_yield.value).toBeCloseTo(.0049);
    });
});

describe("SMF picture URL candidates", () => {
    it("builds only the selected StockCharts routes with prior Mac evidence", () => {
        const candidates = P.imageCandidates("NVDA");
        expect(candidates).toHaveLength(2); expect(candidates.every(row => row.provider === "StockCharts" && row.status === "Not tested from Google Sheets")).toBe(true);
        expect(candidates[0].url).toBe("https://stockcharts.com/c-sc/sc?s=NVDA&p=D&yr=0&mn=6&dy=0&i=t94339682869&r=4806");
        expect(candidates[1].url).toBe("https://stockcharts.com/pnf/chart?c=NVDA,P");
        expect(candidates.every(row => row.evidence.includes("SMF Mac"))).toBe(true);
    });

    it.each(["NVDA&other=1", "TSE:RY", "", null])("rejects unsupported image ticker input: %s", ticker => {
        expect(P.imageCandidates(ticker)).toEqual([]);
    });
});
