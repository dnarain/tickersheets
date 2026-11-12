import { describe, expect, it, vi } from "vitest";
import { CFAnalysisOptions as Options } from "../src/CacheFinanceAnalysisOptions.js";

const expiry = Date.UTC(2026, 10, 20) / 1000;
const contract = (type = "C", extra = {}) => ({ contractSymbol: "NVDA261120" + type + "00175000", expiration: expiry, strike: 175,
    contractSize: "REGULAR", bid: 4.1, ask: 4.3, lastPrice: 4.2, volume: 100, openInterest: 200,
    impliedVolatility: 0.45, lastTradeDate: 1794433140, inTheMoney: false, ...extra });
const payload = (extra = {}, blocks = [{ expirationDate: expiry, calls: [contract()], puts: [contract("P")] }]) => JSON.stringify({ optionChain: { result: [{
    underlyingSymbol: "NVDA", quote: { symbol: "NVDA", regularMarketPrice: 173.73, regularMarketTime: 1794433140 },
    expirationDates: [expiry], options: blocks, ...extra }], error: null } });
const response = (body, code = 200, headers = {}) => ({ getContentText: () => body, getResponseCode: () => code, getAllHeaders: () => headers });
const flow = (chain = payload()) => vi.fn().mockReturnValueOnce(response("not found", 404, { "Set-Cookie": "A3=anonymous-cookie; Domain=.yahoo.com; Path=/; Secure; HttpOnly" }))
    .mockReturnValueOnce(response("anonymous+/crumb"))
    .mockReturnValue(response(chain));

describe("Yahoo anonymous option sessions", () => {
    it("follows SMF's cookie, crumb and encoded options request flow even when fc returns404", () => {
        const fetch = flow();
        const result = Options.fetchChain(" nvda ", "2026-11-20", fetch);
        expect(result.ok).toBe(true); expect(result.contracts).toHaveLength(2);
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(fetch.mock.calls[0][0]).toBe("https://fc.yahoo.com");
        expect(fetch.mock.calls[1][0]).toBe("https://query1.finance.yahoo.com/v1/test/getcrumb");
        expect(fetch.mock.calls[1][1].headers.Cookie).toBe("A3=anonymous-cookie");
        expect(fetch.mock.calls[2][0]).toBe("https://query1.finance.yahoo.com/v7/finance/options/NVDA?date=" + expiry + "&crumb=anonymous%2B%2Fcrumb");
        expect(fetch.mock.calls[2][1].headers.Cookie).toBe("A3=anonymous-cookie");
        expect(JSON.stringify(result)).not.toMatch(/anonymous-cookie|anonymous\+\/crumb|crumb=|Cookie/);
        expect(result.source).toBe("https://finance.yahoo.com/quote/NVDA/options/");
    });

    it("keeps cookies and crumbs in closures and can reuse one ephemeral session", () => {
        const fetch = flow(), session = Options.createSession(fetch);
        expect(Object.keys(session).sort()).toEqual(["fetchChain", "http", "ok"]);
        expect(JSON.stringify(session)).not.toMatch(/anonymous|Cookie|crumb/);
        expect(Options.fetchChain("NVDA", undefined, fetch, session).ok).toBe(true);
        expect(Options.fetchChain("NVDA", "2026-11-20", fetch, session).ok).toBe(true);
        expect(fetch).toHaveBeenCalledTimes(4);
    });
    it("percent-encodes every reserved crumb character using SMF's encoding rule", () => {
        const fetch = vi.fn().mockReturnValueOnce(response("", 404, { "Set-Cookie": "A3=value; Domain=.yahoo.com; Path=/" }))
            .mockReturnValueOnce(response("a!'()*+/b")).mockReturnValue(response(payload()));
        expect(Options.fetchChain("NVDA", null, fetch).ok).toBe(true);
        expect(fetch.mock.calls[2][0]).toContain("crumb=a%21%27%28%29%2A%2B%2Fb");
    });

    it("handles multi-cookie headers with Expires commas and applies only Yahoo domain cookies", () => {
        const fetch = vi.fn().mockReturnValueOnce(response("", 404, { "set-cookie": [
            "hostOnly=omit; Path=/", "A3=first; Domain=.yahoo.com; Path=/; Expires=Thu, 01 Jan 2037 00:00:00 GMT, B=second; Domain=.yahoo.com; Path=/",
            "bad=omit; Domain=other.example; Path=/", "pathOnly=omit; Domain=.yahoo.com; Path=/other"
        ] })).mockReturnValueOnce(response("crumb", 200, { "Set-Cookie": "A3=renewed; Domain=.yahoo.com; Path=/" })).mockReturnValue(response(payload()));
        expect(Options.fetchChain("NVDA", null, fetch).ok).toBe(true);
        expect(fetch.mock.calls[1][1].headers.Cookie).toBe("A3=first; B=second");
        expect(fetch.mock.calls[2][1].headers.Cookie).toBe("A3=renewed; B=second");
    });

    it.each(["", "{private}", "<html>private", "line\nbreak", " ", "x".repeat(101), "nonasciié"])("rejects invalid crumb text without returning it (%#)", crumb => {
        const fetch = flow(); fetch.mockReset().mockReturnValueOnce(response("", 404, { "Set-Cookie": "A3=value; Domain=.yahoo.com; Path=/" })).mockReturnValueOnce(response(crumb));
        const result = Options.fetchChain("NVDA", null, fetch);
        expect(result.ok).toBe(false); expect(fetch).toHaveBeenCalledTimes(2);
        expect(result.error).toBe("Yahoo anonymous session could not be established.");
    });

    it.each([401, 403, 429, 500])("returns fixed failure for crumb HTTP%s without requesting options", status => {
        const fetch = vi.fn().mockReturnValueOnce(response("", 404, { "Set-Cookie": "A3=value; Domain=.yahoo.com; Path=/" })).mockReturnValueOnce(response("private error", status));
        const result = Options.fetchChain("NVDA", null, fetch);
        expect(result.ok).toBe(false); expect(result.http).toBe(status); expect(fetch).toHaveBeenCalledTimes(2);
        expect(JSON.stringify(result)).not.toContain("private error");
    });

    it("requires a usable domain cookie and rejects injected cookie headers", () => {
        for (const cookie of ["A3=value; Path=/", "A3=bad\r\nInjected: value; Domain=.yahoo.com; Path=/", "A3=gone; Domain=.yahoo.com; Path=/; Max-Age=0"]) {
            const fetch = vi.fn(() => response("", 404, { "Set-Cookie": cookie }));
            expect(Options.fetchChain("NVDA", null, fetch).ok).toBe(false); expect(fetch).toHaveBeenCalledOnce();
        }
    });

    it("never returns fetch exceptions or touches saved properties", () => {
        const fetch = vi.fn(() => { throw new Error("private-cookie-crumb"); });
        const result = Options.fetchChain("NVDA", null, fetch);
        expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain("private-cookie-crumb");
        expect(Options.createSession(null).ok).toBe(false);
    });

    it.each([["NVDA?crumb=private", null], ["NVDA", "2026-02-30"], ["NVDA", 123.45], [null, null]])("rejects bad ticker/expiration before starting a session (%#)", (symbol, date) => {
        const fetch = vi.fn(); expect(Options.fetchChain(symbol, date, fetch).ok).toBe(false); expect(fetch).not.toHaveBeenCalled();
    });
});

describe("Yahoo option chain validation", () => {
    it("returns matched contract fields, model-safe mid/spread and quote time separately", () => {
        const data = Options.parseChain(payload(), "NVDA");
        expect(data.ok).toBe(true); expect(data.expirations).toEqual(["2026-11-20"]); expect(data.underlyingPrice).toBe(173.73);
        expect(data.quoteTime).toBe(new Date(1794433140 * 1000).toISOString());
        expect(data.contracts[0]).toMatchObject({ contractSymbol: "NVDA261120C00175000", type: "Call", strike: 175, bid: 4.1, ask: 4.3, volume: 100, openInterest: 200, iv: 0.45, inTheMoney: false });
        expect(data.contracts[0].mid).toBeCloseTo(4.2);
        expect(data.contracts[0].spread).toBeCloseTo(0.2);
    });

    it.each([{ underlyingSymbol: "AAPL" }, { quote: { symbol: "AAPL", regularMarketPrice: 100 } }])("rejects underlying and quote ticker mismatches (%#)", change => {
        expect(Options.parseChain(payload(change), "NVDA")).toMatchObject({ ok: false, contracts: [], error: "Yahoo returned a different underlying ticker." });
    });

    it.each([
        { contractSymbol: "AAPL261120C00175000" }, { contractSymbol: "NVDA1261120C00175000" },
        { contractSymbol: "NVDA261127C00175000" }, { contractSymbol: "NVDA261120P00175000" },
        { contractSymbol: "NVDA261120C00180000" }, { strike: 180 }, { expiration: expiry + 86400 },
        { contractSize: "MINI" }, { contractSize: undefined }, { strike: "175" }
    ])("rejects wrong-root, adjusted, date/type/strike or nonstandard contracts (%#)", change => {
        const data = Options.parseChain(payload({}, [{ expirationDate: expiry, calls: [contract("C", change)], puts: [] }]), "NVDA");
        expect(data.ok).toBe(false); expect(data.contracts).toEqual([]); expect(data.rejectedContracts).toBe(1);
    });

    it("keeps actual zero fields and marks crossed bid/ask without computing a misleading mid", () => {
        const data = Options.parseChain(payload({}, [{ expirationDate: expiry, calls: [contract("C", { bid: 0, ask: 0, lastPrice: 0, volume: 0, openInterest: 0, impliedVolatility: 0 })], puts: [contract("P", { bid: 5, ask: 4 })] }]), "NVDA");
        expect(data.contracts[0]).toMatchObject({ bid: 0, ask: 0, mid: 0, spread: 0, last: 0, volume: 0, openInterest: 0, iv: 0, quoteStatus: "Zero bid/ask" });
        expect(data.contracts[1]).toMatchObject({ bid: 5, ask: 4, mid: null, spread: null, quoteStatus: "Crossed bid/ask" });
    });

    it("does not turn missing, negative or invalid numeric fields into zero", () => {
        const data = Options.parseChain(payload({}, [{ expirationDate: expiry, calls: [contract("C", { bid: -1, ask: undefined, lastPrice: null, volume: -1, openInterest: 1.5, impliedVolatility: "0.45", lastTradeDate: null, inTheMoney: "false" })], puts: [] }]), "NVDA");
        expect(data.contracts[0]).toMatchObject({ bid: null, ask: null, last: null, mid: null, spread: null, volume: null, openInterest: null, iv: null, lastTrade: null, inTheMoney: null });
    });

    it("does not duplicate the same contract", () => {
        const data = Options.parseChain(payload({}, [{ expirationDate: expiry, calls: [contract(), contract()], puts: [] }]), "NVDA");
        expect(data.contracts).toHaveLength(1); expect(data.rejectedContracts).toBe(1);
    });

    it("rejects missing or mismatched requested expirations", () => {
        expect(Options.parseChain(payload(), "NVDA", "2026-11-27").ok).toBe(false);
        expect(Options.parseChain(payload({}, [{ expirationDate: expiry + 86400, calls: [], puts: [] }]), "NVDA").ok).toBe(false);
        expect(Options.parseChain(payload({ expirationDates: ["not a date"] }), "NVDA").ok).toBe(false);
    });

    it("can return available expiration dates when the response has no contracts", () => {
        const data = Options.parseChain(payload({}, []), "NVDA");
        expect(data.ok).toBe(true); expect(data.contracts).toEqual([]); expect(data.expirations).toEqual(["2026-11-20"]);
        expect(Options.parseChain(payload({ expirationDates: [] }, []), "NVDA").ok).toBe(false);
    });

    it.each([401, 403, 429, 500])("omits raw error bodies on HTTP%s", http => {
        const data = Options.parseChain('{"error":"private-cookie-crumb"}', "NVDA", null, http);
        expect(data.ok).toBe(false); expect(data.http).toBe(http); expect(JSON.stringify(data)).not.toContain("private-cookie-crumb");
    });

    it.each(["not JSON private-cookie-crumb", "{}", "null", '{"optionChain":{"result":[],"error":{"description":"private-cookie-crumb"}}}'])("returns fixed parse failures without provider text (%#)", body => {
        const result = Options.parseChain(body, "NVDA");
        expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain("private-cookie-crumb");
    });
});
