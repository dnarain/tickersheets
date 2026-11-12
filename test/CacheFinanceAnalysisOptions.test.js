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

describe("option maturity comparisons", () => {
    const published = ["2026-11-13", "2026-11-20", "2026-12-18", "2027-02-19", "2027-05-21", "2027-11-19"];
    const dates = ["2026-11-20", "2026-12-18", "2027-02-19", "2027-05-21", "2027-11-19"];
    const epoch = date => Date.parse(date + "T00:00:00.000Z") / 1000;
    const raw = (date, call = {}, put = {}) => payload({ expirationDates: published.map(epoch) }, [{ expirationDate: epoch(date),
        calls: [contract("C", { contractSymbol: "NVDA" + date.slice(2).replaceAll("-", "") + "C00175000", expiration: epoch(date), ...call })],
        puts: [contract("P", { contractSymbol: "NVDA" + date.slice(2).replaceAll("-", "") + "P00175000", expiration: epoch(date), ...put })] }]);
    const chain = (date = "2026-11-20", call, put) => Options.parseChain(raw(date, call, put), "NVDA", date);
    const config = { asOf: "2026-11-11" };
    const session = () => ({ ok: true, http: 200, fetchChain: vi.fn((_symbol, date) => chain(date)) });

    it("compares five stratified published dates and reuses the selected chain", () => {
        const active = session(), result = Options.fetchMaturities("NVDA", chain(), vi.fn(), active, config);
        expect(result.ok).toBe(true); expect(result.rows.map(row => row.expiration)).toEqual(dates);
        expect(active.fetchChain).toHaveBeenCalledTimes(4);
        expect(active.fetchChain.mock.calls.map(call => call[1])).not.toContain("2026-11-20");
        expect(result.rows[0]).toMatchObject({ underlyingPrice: 173.73, http: 200, status: "Available", atmIV: .45,
            call: { strike: 175, bid: 4.1, ask: 4.3, iv: .45, openInterest: 200, volume: 100 }, put: { strike: 175, iv: .45 } });
        expect(result.rows[0].call.mid).toBeCloseTo(4.2); expect(result.rows[0].call.spread).toBeCloseTo(.2);
    });

    it("makes one anonymous bootstrap for all option requests", () => {
        const fetch = vi.fn((url) => {
            if (url === "https://fc.yahoo.com") return response("", 404, { "Set-Cookie": "A3=private-cookie; Domain=.yahoo.com; Path=/" });
            if (url.includes("getcrumb")) return response("private-crumb");
            const date = new Date(Number(new URL(url).searchParams.get("date")) * 1000).toISOString().slice(0, 10);
            return response(raw(date));
        });
        const active = Options.createSession(fetch), selected = Options.fetchChain("NVDA", "2026-11-20", fetch, active);
        const result = Options.fetchMaturities("NVDA", selected, fetch, active, config);
        expect(result.ok).toBe(true); expect(fetch).toHaveBeenCalledTimes(7);
        expect(fetch.mock.calls.filter(call => call[0] === "https://fc.yahoo.com")).toHaveLength(1);
        expect(fetch.mock.calls.filter(call => call[0].includes("getcrumb"))).toHaveLength(1);
        expect(JSON.stringify(result)).not.toMatch(/private-cookie|private-crumb|crumb=|Cookie/);
    });

    it("can bootstrap once when a caller supplies only the selected safe chain", () => {
        const fetch = vi.fn(url => url === "https://fc.yahoo.com" ? response("", 404, { "Set-Cookie": "A3=value; Domain=.yahoo.com; Path=/" })
            : url.includes("getcrumb") ? response("crumb") : response(raw(new Date(Number(new URL(url).searchParams.get("date")) * 1000).toISOString().slice(0, 10))));
        expect(Options.fetchMaturities("NVDA", chain(), fetch, undefined, config).rows).toHaveLength(5);
        expect(fetch).toHaveBeenCalledTimes(6);
    });

    it("preserves one failed maturity separately without exposing provider error text", () => {
        const active = session(); active.fetchChain.mockImplementation((_symbol, date) => date === "2026-12-18" ? { ok: false, symbol: "NVDA", http: 401, error: "private-cookie-crumb" } : chain(date));
        const result = Options.fetchMaturities("NVDA", chain(), vi.fn(), active, config);
        expect(result.ok).toBe(true); expect(result.rows[1]).toMatchObject({ status: "Unavailable", http: 401, call: null, put: null, atmIV: null });
        expect(result.rows.filter(row => row.status === "Available")).toHaveLength(4);
        expect(JSON.stringify(result)).not.toContain("private-cookie-crumb");
    });

    it("leaves crossed, zero or missing-IV quotes out of mean ATM IV", () => {
        for (const call of [{ bid: 5, ask: 4 }, { bid: 0, ask: 0, impliedVolatility: 0 }, { impliedVolatility: 0 }, { impliedVolatility: null }]) {
            const result = Options.fetchMaturities("NVDA", chain("2026-11-20", call, { volume: 0, openInterest: 0 }), vi.fn(), session(), config);
            const selected = result.rows[0];
            expect(selected.atmIV).toBeNull(); expect(selected.status).toBe("Partial"); expect(selected.call.iv).toBeNull();
            expect(selected.put.volume).toBe(0); expect(selected.put.openInterest).toBe(0);
            if (call.bid === 5 || call.bid === 0) { expect(selected.call.mid).toBeNull(); expect(selected.call.spread).toBeNull(); }
        }
    });

    it("does not average call and put IV from different strikes", () => {
        const selected = chain("2026-11-20", {}, { strike: 180, contractSymbol: "NVDA261120P00180000" });
        const row = Options.fetchMaturities("NVDA", selected, vi.fn(), session(), config).rows[0];
        expect(row.call.strike).toBe(175); expect(row.put.strike).toBe(180); expect(row.atmIV).toBeNull(); expect(row.status).toBe("Partial");
        expect(row.error).toContain("different strikes");
    });

    it("chooses the closest common strike rather than mixing separate ATM strikes", () => {
        const selected = chain(); selected.underlyingPrice = 178;
        selected.contracts.push({ ...selected.contracts.find(row => row.type === "Call"), strike: 180, contractSymbol: "NVDA261120C00180000" });
        const row = Options.fetchMaturities("NVDA", selected, vi.fn(), session(), config).rows[0];
        expect(row.call.strike).toBe(175); expect(row.put.strike).toBe(175); expect(row.status).toBe("Available");
    });

    it("rejects another ticker's selected data before any request", () => {
        const fetch = vi.fn(), active = session(), selected = chain(); selected.symbol = "AAPL";
        expect(Options.fetchMaturities("NVDA", selected, fetch, active, config).ok).toBe(false);
        expect(fetch).not.toHaveBeenCalled(); expect(active.fetchChain).not.toHaveBeenCalled();
    });

    it("rejects wrong OCC contract identity even in a supplied selected snapshot", () => {
        const selected = chain(); selected.contracts.forEach(row => { row.contractSymbol = row.contractSymbol.replace("NVDA", "AAPL"); });
        const row = Options.fetchMaturities("NVDA", selected, vi.fn(), session(), config).rows[0];
        expect(row.call).toBeNull(); expect(row.put).toBeNull(); expect(row.status).toBe("Unavailable");
    });

    it("does not derive an ATM strike without a positive underlying price", () => {
        const selected = chain(); selected.underlyingPrice = null;
        const row = Options.fetchMaturities("NVDA", selected, vi.fn(), session(), config).rows[0];
        expect(row.status).toBe("Unavailable"); expect(row.underlyingPrice).toBeNull(); expect(row.atmIV).toBeNull();
    });

    it("uses every available date when fewer than five are published", () => {
        const selected = chain(); selected.expirations = ["2026-11-20"];
        const fetch = vi.fn(), active = session(), result = Options.fetchMaturities("NVDA", selected, fetch, active, config);
        expect(result.rows).toHaveLength(1); expect(active.fetchChain).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    });

    it.each([3, 4, 5])("honors the bounded %s-maturity comparison", count => {
        const result = Options.fetchMaturities("NVDA", chain(), vi.fn(), session(), { ...config, count });
        expect(result.rows).toHaveLength(count); expect(result.rows.some(row => row.expiration === "2026-11-20")).toBe(true);
    });

    it.each([{ count: 2 }, { count: 6 }, { count: "5" }, { asOf: "2026-02-30" }, null])("rejects invalid comparison settings without requests (%#)", config => {
        const active = session(), fetch = vi.fn();
        expect(Options.fetchMaturities("NVDA", chain(), fetch, active, config).ok).toBe(false);
        expect(active.fetchChain).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    });

    it("rejects invalid expiration metadata without requests", () => {
        const active = session(), selected = chain(); selected.expirations = ["2026-02-30"];
        expect(Options.fetchMaturities("NVDA", selected, vi.fn(), active, config).ok).toBe(false); expect(active.fetchChain).not.toHaveBeenCalled();
    });

    it("returns fixed errors for session failures and leaves usable selected data intact", () => {
        const result = Options.fetchMaturities("NVDA", chain(), vi.fn(), { ok: false, http: 403, error: "private-session-error" }, config);
        expect(result.ok).toBe(true); expect(result.rows.filter(row => row.status === "Unavailable")).toHaveLength(4);
        expect(result.rows[1].http).toBe(403); expect(JSON.stringify(result)).not.toContain("private-session-error");
    });
});
