import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleWebSiteFinance as Google } from "../src/CacheFinanceWebSites.js";

const fixture = name => fs.readFileSync(new URL(`./fixtures/google-${name}.html`, import.meta.url), "utf8");
const aapl = fixture("aapl");
const expectEmpty = data => {
    expect(data.stockName).toBeNull();
    expect(data.stockPrice).toBeNull();
    expect(data.yieldPct).toBeNull();
};
afterEach(() => vi.unstubAllGlobals());

describe("Google Finance current public responses", () => {
    it.each([
        ["aapl", "NASDAQ:AAPL", "Apple Inc", 355.63],
        ["nvda", "NASDAQ:NVDA", "NVIDIA Corp", 173.73],
        ["ry", "TSE:RY", "Royal Bank of Canada", 290],
        ["xic", "TSE:XIC", "iShares Core S&P/TSX Capped Composite Index ETF", 58.19],
        ["usdcad", "CURRENCY:USDCAD", "USD / CAD", 1.4251]
    ])("reads the requested %s quote without the retired data-last-price attribute", (name, symbol, expectedName, price) => {
        const html = fixture(name);
        expect(html).not.toContain("data-last-price");
        const data = Google.parseResponse(html, symbol);
        expect(data.stockName).toBe(expectedName);
        expect(data.stockPrice).toBe(price);
        expect(Google.extractStockPrice(html, symbol)).toBeCloseTo(name === "usdcad" ? 1.42506983 : price);
        expect(Google.extractStockName(html, symbol)).toBe(expectedName);
        expect(Google.sourceDetails(html, symbol)).toEqual({ identity: "Matched", timestamp: "Unknown", field: "" });
    });

    it("reads the RY overview Dividend percentage as a fraction", () => {
        expect(Google.parseResponse(fixture("ry"), "TSE:RY").yieldPct).toBe(0.0243);
    });

    it("leaves XIC yield missing because the fetched page does not publish it", () => {
        const html = fixture("xic");
        expect(html).not.toContain(">Dividend<");
        expect(Google.parseResponse(html, "TSE:XIC").yieldPct).toBeNull();
        const related = '<h2>Related assets</h2><div>Dividend</div><div>99.00%</div>';
        expect(Google.parseResponse(html.replace("</body>", related + "</body>"), "TSE:XIC").yieldPct).toBeNull();
    });

    it("ignores a Dividend decoy before the requested primary overview", () => {
        const html = '<div>Dividend</div><div>99.00%</div>' + fixture("ry");
        expect(Google.parseResponse(html, "TSE:RY").yieldPct).toBe(0.0243);
    });

    it("ignores another security's bound overview before the requested overview", () => {
        const decoy = fixture("aapl").match(/<c-wiz[\s\S]*?<\/c-wiz>/)[0];
        const html = fixture("ry").replace("</head><body>", "</head><body>" + decoy);
        expect(Google.parseResponse(html, "TSE:RY").yieldPct).toBe(0.0243);
    });

    it("leaves yield missing when the overview renderer or ticker binding changes", () => {
        expect(Google.parseResponse(fixture("ry").replace('jsrenderer="rBmozc"', 'jsrenderer="newLayout"'), "TSE:RY").yieldPct).toBeNull();
        expect(Google.parseResponse(fixture("ry").replace('&quot;RY&quot;', '&quot;OTHER&quot;'), "TSE:RY").yieldPct).toBeNull();
        expect(Google.parseResponse(fixture("ry").replaceAll('class="SwQK7"', 'class="newLabel"'), "TSE:RY").yieldPct).toBeNull();
    });

    it("leaves yield missing when responsive overview copies disagree", () => {
        expect(Google.parseResponse(fixture("ry").replace("2.43%", "99.00%"), "TSE:RY").yieldPct).toBeNull();
    });

    it("rejects the invalid ticker's real Google Finance home response", () => {
        const html = fixture("invalid");
        expectEmpty(Google.parseResponse(html, "NASDAQ:ZZZZCFINVALID20261111"));
        expect(Google.sourceDetails(html, "NASDAQ:ZZZZCFINVALID20261111").identity).toBe("Mismatch");
    });

    it("rejects unsupported-device HTML instead of extracting unrelated values", () => {
        const html = fixture("unsupported") + '<div data-last-price="99"></div><script>"NASDAQ:AAPL"</script>';
        expectEmpty(Google.parseResponse(html, "NASDAQ:AAPL"));
    });
});

describe("Google quote identity and parser boundaries", () => {
    it("ignores an unrelated quote and obsolete price before the requested quote data", () => {
        const unrelated = fixture("nvda").match(/<script[\s\S]*?<\/script>/)[0];
        const html = aapl.replace("</head><body>", `</head><body><div data-last-price="999"></div>${unrelated}`);
        expect(Google.parseResponse(html, "NASDAQ:AAPL").stockPrice).toBe(355.63);
    });

    it("does not use an unrelated legacy marker when the primary quote record is missing", () => {
        const html = aapl.replace(/<script[\s\S]*?<\/script>/, '<div data-last-price="999"></div>');
        expect(Google.parseResponse(html, "NASDAQ:AAPL").stockPrice).toBeNull();
        expect(Google.extractStockPrice(html, "NASDAQ:AAPL")).toBeNull();
    });

    it("rejects the requested ticker inside a related section of another primary page", () => {
        const html = fixture("ry").replace("</body>", aapl.match(/<script[\s\S]*?<\/script>/)[0] + "</body>");
        expectEmpty(Google.parseResponse(html, "NASDAQ:AAPL"));
    });

    it("rejects the same ticker on a different exchange", () => {
        expectEmpty(Google.parseResponse(fixture("ry").replace('href="https://www.google.com/finance/quote/RY:TSE"', 'href="https://www.google.com/finance/quote/RY:NYSE"'), "TSE:RY"));
    });

    it("never scans past the end of a generic title to find the ticker in scripts", () => {
        const html = '<title>Google Finance</title><script>Apple Inc (AAPL)</script><div data-last-price="999"></div>';
        expectEmpty(Google.parseResponse(html, "NASDAQ:AAPL"));
        expect(Google.extractStockName(html, "NASDAQ:AAPL")).toBeNull();
    });

    it("escapes dots in the ticker instead of accepting a different title", () => {
        expectEmpty(Google.parseResponse('<title>Other Company (BRKxB)</title><div data-last-price="1"></div>', "NYSE:BRK.B"));
    });

    it("decodes company-name entities without returning HTML", () => {
        const html = '<title>Black &amp; White (BW) Stock Price</title><div data-last-price="12.3"></div>';
        expect(Google.parseResponse(html, "NYSE:BW").stockName).toBe("Black & White");
        expect(Google.extractStockName(html.replace("Black &amp; White", "&lt;script&gt;"), "NYSE:BW")).toBeNull();
    });

    it("supports encoded primary URL tickers and single-quoted link attributes", () => {
        const html = aapl.replace('rel="canonical" href="https://www.google.com/finance/quote/AAPL:NASDAQ"', "href='https://www.google.com/finance/quote/AAPL%3ANASDAQ?hl=en' rel='canonical'");
        expect(Google.parseResponse(html, "NASDAQ:AAPL").stockPrice).toBe(355.63);
    });

    it("skips malformed callback JSON without executing it", () => {
        const html = aapl.replace('[355.63,', '[(()=>{throw new Error("must not execute")})(),');
        expect(Google.parseResponse(html, "NASDAQ:AAPL").stockPrice).toBeNull();
        expect(Google.parseResponse(html, "NASDAQ:AAPL").stockName).toBe("Apple Inc");
    });

    it("rejects null and non-finite quote prices instead of turning them into zero", () => {
        for (const value of ["null", "0", "-5", "1e999"]) {
            const html = aapl.replace('[355.63,', `[${value},`);
            expect(Google.parseResponse(html, "NASDAQ:AAPL").stockPrice).toBeNull();
        }
    });

    it("accepts an explicitly published zero dividend but keeps missing dividends null", () => {
        expect(Google.parseResponse(fixture("ry").replaceAll("2.43%", "0.00%"), "TSE:RY").yieldPct).toBe(0);
        expect(Google.parseResponse(fixture("ry").replaceAll("2.43%", "—"), "TSE:RY").yieldPct).toBeNull();
    });

    it("does not accept unbound legacy price and yield markers", () => {
        const html = '<title>Canadian Premium Fund(ZTL)\nDividend yield</span>2.15%</div>\ndata-last-price="18.76"';
        const data = Google.parseResponse(html, "TSE:ZTL");
        expect(data.stockPrice).toBeNull(); expect(data.yieldPct).toBeNull();
        expect(data.stockName).toBe("Canadian Premium Fund");
        expect(Google.sourceDetails(html, "TSE:ZTL").identity).toBe("Unknown");
    });

    it("keeps requests in English and avoids a request for unsupported US yield", () => {
        const fetch = vi.fn(() => ({ getContentText: () => aapl }));
        vi.stubGlobal("UrlFetchApp", { fetch });
        expect(Google.getURL("NASDAQ:AAPL", "PRICE")).toBe("https://www.google.com/finance/quote/AAPL:NASDAQ?hl=en");
        expect(Google.getURL("CURRENCY:USDCAD", "PRICE")).toBe("https://www.google.com/finance/quote/USD-CAD?hl=en");
        expectEmpty(Google.getInfo("NASDAQ:AAPL", "YIELDPCT"));
        expect(fetch).not.toHaveBeenCalled();
        expect(Google.getInfo("NASDAQ:AAPL", "PRICE").stockPrice).toBe(355.63);
        expect(fetch).toHaveBeenCalledWith("https://www.google.com/finance/quote/AAPL:NASDAQ?hl=en");
    });
});
