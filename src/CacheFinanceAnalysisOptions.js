/*  *** DEBUG START ***
export { CFAnalysisOptions };
//  *** DEBUG END ***/

/** Anonymous Yahoo cookies and crumbs live only in a server-side closure. */
class CFAnalysisOptions {
    static symbol_(value) {
        if (typeof value !== "string") return null;
        const symbol = value.trim().toUpperCase();
        return /^[A-Z0-9^][A-Z0-9.^=-]{0,19}$/.test(symbol) ? symbol : null;
    }

    static expiration_(value) {
        if (value === undefined || value === null || value === "") return { date: "", epoch: null };
        let date;
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) date = new Date(value + "T00:00:00.000Z");
        else if (typeof value === "number" && Number.isInteger(value) && value > 0) date = new Date(value * 1000);
        else return null;
        if (!Number.isFinite(date.getTime()) || date.getUTCHours() || date.getUTCMinutes() || date.getUTCSeconds()) return null;
        const iso = date.toISOString().slice(0, 10);
        if (typeof value === "string" && iso !== value) return null;
        return { date: iso, epoch: date.getTime() / 1000 };
    }

    static result_(symbol, http = 0, error = "") {
        return { ok: false, http, source: symbol ? "https://finance.yahoo.com/quote/" + encodeURIComponent(symbol) + "/options/" : "",
            symbol: symbol || "", quoteTime: "Unknown", underlyingPrice: null, expirations: [], contracts: [], rejectedContracts: 0, error };
    }

    static epoch_(value) {
        if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
        const date = new Date(value * 1000);
        return Number.isFinite(date.getTime()) ? date.toISOString() : null;
    }

    static number_(value, integer = false) {
        return typeof value === "number" && Number.isFinite(value) && value >= 0 && (!integer || Number.isInteger(value)) ? value : null;
    }

    static encode_(value) {
        return encodeURIComponent(String(value)).replace(/[!'()*]/g, character => "%" + character.charCodeAt(0).toString(16).toUpperCase());
    }

    /** This object exposes a request method, never cookie or crumb properties. */
    static createSession(fetch) {
        if (typeof fetch !== "function") return { ok: false, http: 0, error: "Yahoo request service is unavailable." };
        const cookies = new Map();
        const agent = "Mozilla/5.0 SMF-Mac/0.1";
        const options = headers => ({ method: "get", muteHttpExceptions: true, followRedirects: true, headers: { "User-Agent": agent, ...headers } });
        const receive = (response, host, requestPath) => {
            const headers = response.getAllHeaders();
            const name = Object.keys(headers || {}).find(key => key.toLowerCase() === "set-cookie");
            if (!name) return;
            const values = Array.isArray(headers[name]) ? headers[name] : [headers[name]];
            for (const header of values) {
                if (typeof header !== "string" || /[\r\n]/.test(header)) continue;
                for (const part of header.split(/,(?=\s*[!#$%&'*+.^_`|~0-9A-Za-z-]+=)/)) {
                    const attributes = part.split(";").map(item => item.trim());
                    const first = attributes.shift().match(/^([!#$%&'*+.^_`|~0-9A-Za-z-]+)=([^;]*)$/);
                    if (!first || /[^\x21-\x7e]|[,"\\]/.test(first[2])) continue;
                    const cookie = { name: first[1], value: first[2], domain: host, hostOnly: true,
                        path: requestPath.slice(0, requestPath.lastIndexOf("/") + 1) || "/", expires: null };
                    let valid = true;
                    for (const attribute of attributes) {
                        const split = attribute.indexOf("=");
                        const field = (split < 0 ? attribute : attribute.slice(0, split)).toLowerCase();
                        const value = split < 0 ? "" : attribute.slice(split + 1).trim();
                        if (field === "domain") {
                            const domain = value.replace(/^\./, "").toLowerCase();
                            if (!domain || !(host === domain || host.endsWith("." + domain)) || !(domain === "yahoo.com" || domain.endsWith(".yahoo.com"))) { valid = false; break; }
                            cookie.domain = domain; cookie.hostOnly = false;
                        } else if (field === "path" && value.startsWith("/")) cookie.path = value;
                        else if (field === "expires") { const time = Date.parse(value); if (Number.isFinite(time)) cookie.expires = time; }
                        else if (field === "max-age" && /^-?\d+$/.test(value)) cookie.maxAge = Number(value);
                    }
                    if (!valid) continue;
                    if (cookie.maxAge !== undefined) cookie.expires = Date.now() + cookie.maxAge * 1000;
                    const id = cookie.name + "|" + cookie.domain + "|" + cookie.path;
                    if (cookie.expires !== null && cookie.expires <= Date.now()) cookies.delete(id);
                    else cookies.set(id, cookie);
                }
            }
        };
        const header = path => [...cookies.values()].filter(cookie =>
            (cookie.hostOnly ? cookie.domain === "query1.finance.yahoo.com" : "query1.finance.yahoo.com" === cookie.domain || "query1.finance.yahoo.com".endsWith("." + cookie.domain))
            && (path === cookie.path || path.startsWith(cookie.path.endsWith("/") ? cookie.path : cookie.path + "/"))
            && (cookie.expires === null || cookie.expires > Date.now()))
            .map(cookie => cookie.name + "=" + cookie.value).join("; ");
        try {
            // SMF's initial cookie request may return 404 with a usable Set-Cookie.
            const first = fetch("https://fc.yahoo.com", options({}));
            receive(first, "fc.yahoo.com", "/");
            const cookie = header("/v1/test/getcrumb");
            if (!cookie) return { ok: false, http: first.getResponseCode(), error: "Yahoo anonymous session could not be established." };
            const crumbResponse = fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", options({ Cookie: cookie }));
            const http = crumbResponse.getResponseCode();
            if (http !== 200) return { ok: false, http, error: "Yahoo anonymous session could not be established." };
            receive(crumbResponse, "query1.finance.yahoo.com", "/v1/test/getcrumb");
            const crumb = crumbResponse.getContentText();
            if (typeof crumb !== "string" || !crumb || crumb.length > 100 || /[^\x21-\x7e]|[{}<>]/.test(crumb)) return { ok: false, http, error: "Yahoo anonymous session could not be established." };
            return {
                ok: true, http: 200,
                fetchChain: (symbol, expiration) => {
                    const wanted = CFAnalysisOptions.symbol_(symbol), expiry = CFAnalysisOptions.expiration_(expiration);
                    if (!wanted || !expiry) return CFAnalysisOptions.result_(wanted, 0, "Choose a valid ticker and expiration.");
                    try {
                        const path = "/v7/finance/options/" + encodeURIComponent(wanted);
                        const query = (expiry.epoch === null ? "" : "date=" + CFAnalysisOptions.encode_(expiry.epoch) + "&") + "crumb=" + CFAnalysisOptions.encode_(crumb);
                        const response = fetch("https://query1.finance.yahoo.com" + path + "?" + query, options({ Cookie: header(path) }));
                        return CFAnalysisOptions.parseChain(response.getContentText(), wanted, expiry.date, response.getResponseCode());
                    } catch (_error) { return CFAnalysisOptions.result_(wanted, 0, "Yahoo option request failed."); }
                }
            };
        } catch (_error) { return { ok: false, http: 0, error: "Yahoo anonymous session could not be established." }; }
    }

    static fetchChain(yahooSymbol, expiration, fetch, session) {
        const symbol = CFAnalysisOptions.symbol_(yahooSymbol), expiry = CFAnalysisOptions.expiration_(expiration);
        if (!symbol || !expiry) return CFAnalysisOptions.result_(symbol, 0, "Choose a valid ticker and expiration.");
        const active = session || CFAnalysisOptions.createSession(fetch);
        if (!active || active.ok !== true || typeof active.fetchChain !== "function") return CFAnalysisOptions.result_(symbol, active?.http || 0, "Yahoo anonymous session could not be established.");
        return active.fetchChain(symbol, expiry.date);
    }

    static parseChain(body, yahooSymbol, expiration, http = 200) {
        const symbol = CFAnalysisOptions.symbol_(yahooSymbol), expiry = CFAnalysisOptions.expiration_(expiration);
        const result = CFAnalysisOptions.result_(symbol, http);
        if (!symbol || !expiry) { result.error = "Choose a valid ticker and expiration."; return result; }
        if (http !== 200) { result.error = "Yahoo option request was not accepted."; return result; }
        try {
            const data = typeof body === "string" ? JSON.parse(body) : null;
            const chain = data?.optionChain?.result;
            if (data?.optionChain?.error || !Array.isArray(chain) || chain.length !== 1) { result.error = "Yahoo did not return an option chain."; return result; }
            const quote = chain[0];
            if (quote?.underlyingSymbol !== symbol || quote?.quote?.symbol !== symbol) { result.error = "Yahoo returned a different underlying ticker."; return result; }
            if (!Array.isArray(quote.expirationDates) || !Array.isArray(quote.options)) { result.error = "Yahoo returned invalid option data."; return result; }
            const dates = quote.expirationDates.map(value => CFAnalysisOptions.expiration_(value));
            if (dates.some(value => !value || !value.date)) { result.error = "Yahoo returned invalid expiration dates."; return result; }
            result.expirations = [...new Set(dates.map(value => value.date))].sort();
            if (expiry.date && !result.expirations.includes(expiry.date)) { result.error = "Yahoo did not return the requested expiration."; return result; }
            result.quoteTime = CFAnalysisOptions.epoch_(quote.quote.regularMarketTime) || "Unknown";
            const underlying = CFAnalysisOptions.number_(quote.quote.regularMarketPrice);
            result.underlyingPrice = underlying > 0 ? underlying : null;
            const root = symbol.replace(/[^A-Z0-9]/g, "");
            const seen = new Set();
            for (const block of quote.options) {
                const blockExpiry = CFAnalysisOptions.expiration_(block?.expirationDate);
                if (!blockExpiry || !blockExpiry.date || (expiry.date && blockExpiry.date !== expiry.date) || !result.expirations.includes(blockExpiry.date)) { result.error = "Yahoo returned a different option expiration."; result.contracts = []; return result; }
                for (const [field, type, code] of [["calls", "Call", "C"], ["puts", "Put", "P"]]) {
                    if (!Array.isArray(block[field])) { result.error = "Yahoo returned invalid option contracts."; result.contracts = []; return result; }
                    for (const row of block[field]) {
                        const id = typeof row?.contractSymbol === "string" ? row.contractSymbol : "";
                        const occ = id.match(/^([A-Z0-9]{1,8})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
                        const day = occ ? "20" + occ[2] + "-" + occ[3] + "-" + occ[4] : "";
                        const rowExpiry = CFAnalysisOptions.expiration_(row?.expiration);
                        if (!occ || occ[1] !== root || occ[5] !== code || day !== blockExpiry.date || !rowExpiry || rowExpiry.date !== day
                            || typeof row.strike !== "number" || !Number.isFinite(row.strike) || row.strike <= 0
                            || Math.abs(row.strike - Number(occ[6]) / 1000) > 1e-8 || row.contractSize !== "REGULAR" || seen.has(id)) { result.rejectedContracts++; continue; }
                        seen.add(id);
                        const bid = CFAnalysisOptions.number_(row.bid), ask = CFAnalysisOptions.number_(row.ask), ordered = bid !== null && ask !== null && ask >= bid;
                        result.contracts.push({ contractSymbol: id, expiration: day, type, strike: row.strike,
                            bid, ask, last: CFAnalysisOptions.number_(row.lastPrice), mid: ordered ? (bid + ask) / 2 : null,
                            spread: ordered ? ask - bid : null, volume: CFAnalysisOptions.number_(row.volume, true),
                            openInterest: CFAnalysisOptions.number_(row.openInterest, true), iv: CFAnalysisOptions.number_(row.impliedVolatility),
                            lastTrade: CFAnalysisOptions.epoch_(row.lastTradeDate), inTheMoney: typeof row.inTheMoney === "boolean" ? row.inTheMoney : null,
                            quoteStatus: bid === null || ask === null ? "Missing bid/ask" : ask < bid ? "Crossed bid/ask" : bid === 0 && ask === 0 ? "Zero bid/ask" : "Bid/ask present" });
                    }
                }
            }
            result.contracts.sort((left, right) => left.expiration.localeCompare(right.expiration) || left.strike - right.strike || left.type.localeCompare(right.type));
            if (!result.contracts.length && result.rejectedContracts) { result.error = "Yahoo returned no matching standard option contracts."; return result; }
            if (!result.contracts.length && !result.expirations.length) { result.error = "Yahoo returned no available options."; return result; }
            result.ok = true;
            return result;
        } catch (_error) { result.contracts = []; result.error = "Unable to read Yahoo option data."; return result; }
    }
}
