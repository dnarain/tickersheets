/*  *** DEBUG START ***
export { CFSmfProviders };
//  *** DEBUG END ***/

/** Selected public SMF recipes. Each field keeps its provider label and units. */
const CF_SMF_PROVIDER_FIELDS_ = Object.freeze({
    FINVIZ: Object.freeze([
        ["price", "Price", "currency", 4074, "Price", "positive"],
        ["earnings_date", "Earnings date", "date text", 4072, "Earnings", "date"],
        ["market_cap", "Market capitalization", "currency", 4006, "Market Cap", "positive"],
        ["trailing_pe", "P/E (trailing)", "ratio", 4001, "P/E", "number"],
        ["forward_pe", "P/E (forward)", "ratio", 4007, "Forward P/E", "number"],
        ["eps_ttm", "EPS (trailing)", "currency", 4002, "EPS (ttm)", "number"],
        ["eps_next_year", "EPS (next year)", "currency", 4008, "EPS next Y", "number"],
        ["eps_growth_next_year", "EPS growth (next year)", "fraction", 4026, "EPS next Y", "percent"],
        ["target_price", "Analyst target price", "currency", 4062, "Target Price", "positive"],
        ["volume", "Volume", "shares", 4079, "Volume", "nonnegative"],
        ["average_volume", "Average volume", "shares", 4073, "Avg Volume", "nonnegative"],
        ["forward_dividend_rate", "Forward annual dividend / share", "currency", 4036, "Dividend Est.", "dividend_rate"],
        ["forward_dividend_yield", "Forward dividend yield", "fraction", 4037, "Dividend Est.", "dividend_yield"],
        ["trailing_dividend_rate", "Trailing annual dividend / share", "currency", 4043, "Dividend TTM", "dividend_rate"],
        ["trailing_dividend_yield", "Trailing dividend yield", "fraction", 4044, "Dividend TTM", "dividend_yield"],
        ["dividend_ex_date", "Ex-dividend date", "date text", 4050, "Dividend Ex-Date", "date"],
        ["short_float", "Short interest / float", "fraction", 4016, "Short Float", "percent"],
        ["insider_ownership", "Insider ownership", "fraction", 4003, "Insider Own", "percent"],
        ["institutional_ownership", "Institutional ownership", "fraction", 4015, "Inst Own", "percent"],
        ["rsi14", "RSI (14)", "index 0-100", 4054, "RSI (14)", "rsi"],
        ["sma20_distance", "Distance from SMA20", "fraction", 4075, "SMA20", "percent"],
        ["sma50_distance", "Distance from SMA50", "fraction", 4076, "SMA50", "percent"],
        ["sma200_distance", "Distance from SMA200", "fraction", 4077, "SMA200", "percent"],
        ["return_week", "One-week price performance", "fraction", 4005, "Perf Week", "percent"],
        ["return_month", "One-month price performance", "fraction", 4011, "Perf Month", "percent"],
        ["return_quarter", "Quarter price performance", "fraction", 4017, "Perf Quarter", "percent"],
        ["return_year", "One-year price performance", "fraction", 4029, "Perf Year", "percent"],
        ["return_ytd", "Year-to-date price performance", "fraction", 4035, "Perf YTD", "percent"],
        ["gross_margin", "Gross margin", "fraction", 4047, "Gross Margin", "percent"],
        ["operating_margin", "Operating margin", "fraction", 4053, "Oper. Margin", "percent"],
        ["profit_margin", "Profit margin", "fraction", 4060, "Profit Margin", "percent"],
        ["beta", "Beta", "ratio", 4042, "Beta", "number"]
    ].map(row => Object.freeze(row))),
    ZACKS: Object.freeze([["target_price", "Average price target", "currency", 849, "Average Price Target", "positive"]].map(row => Object.freeze(row))),
    GURUFOCUS: Object.freeze([
        ["forward_dividend_yield", "Forward dividend yield", "fraction", 2727, "Dividend Yield (Forward)", "percent"],
        ["trailing_dividend_yield", "Trailing dividend yield", "fraction", null, "Dividend Yield (Trailing)", "percent"]
    ].map(row => Object.freeze(row))),
    ADVFN: Object.freeze([["year_end_date", "Latest annual year-end date", "date text", 5196, "Year End", "annual_date"]].map(row => Object.freeze(row)))
});

class CFSmfProviders {
    static provider_(value) {
        if (typeof value !== "string") return "";
        const provider = value.trim().toUpperCase();
        return provider === "GURUDIV" ? "GURUFOCUS" : Object.prototype.hasOwnProperty.call(CF_SMF_PROVIDER_FIELDS_, provider) ? provider : "";
    }

    /** These public routes cover US quote symbols. Foreign exchange prefixes are rejected. */
    static symbol_(value) {
        if (typeof value !== "string") return "";
        const symbol = value.trim().toUpperCase().replace(/^(?:NASDAQ|NYSE|NYSEARCA|NYSEAMERICAN|BATS):/, "");
        return /^[A-Z][A-Z0-9]{0,34}(?:[.-][AB])?$/.test(symbol) ? symbol : "";
    }

    /** ADVFN accepts a qualified exchange:symbol, so its prefix must survive normalization. */
    static advfnSymbol_(value) {
        if (typeof value !== "string") return "";
        const symbol = value.trim().toUpperCase();
        return /^(?:(?:NASDAQ|NYSE|AMEX|NYSEAMERICAN|NYSEARCA|BATS):)?[A-Z][A-Z0-9]{0,34}(?:[.-][AB])?$/.test(symbol) ? symbol : "";
    }

    static registry() {
        return Object.entries(CF_SMF_PROVIDER_FIELDS_).map(([provider, rows]) => ({ provider,
            label: ({ FINVIZ: "Finviz", ZACKS: "Zacks", GURUFOCUS: "GuruFocus", ADVFN: "ADVFN" })[provider],
            fields: rows.map(([id, label, unit, smfId, field]) => ({ id, label, unit, smfId, field })) }));
    }

    static resolveField(provider, field) {
        const rows = CF_SMF_PROVIDER_FIELDS_[CFSmfProviders.provider_(provider)] || [];
        const wanted = typeof field === "string" || typeof field === "number" ? String(field).trim().toLowerCase() : "";
        return rows.find(([id, _label, _unit, smfId]) => id === wanted || smfId !== null && String(smfId) === wanted)?.[0] || null;
    }

    static buildUrl(provider, ticker) {
        const type = CFSmfProviders.provider_(provider), symbol = type === "ADVFN" ? CFSmfProviders.advfnSymbol_(ticker) : CFSmfProviders.symbol_(ticker);
        if (!type || !symbol) return null;
        const urls = { FINVIZ: "https://finviz.com/quote.ashx?t=" + encodeURIComponent(symbol) + "&p=d",
            ZACKS: "https://www.zacks.com/stock/research/" + encodeURIComponent(symbol) + "/price-target-stock-forecast",
            GURUFOCUS: "https://www.gurufocus.com/stock/" + encodeURIComponent(symbol) + "/dividend",
            ADVFN: "https://www.advfn.com/p.php?pid=financials&symbol=" + symbol };
        return urls[type];
    }

    static result_(provider, ticker) {
        const type = CFSmfProviders.provider_(provider), symbol = type === "ADVFN" ? CFSmfProviders.advfnSymbol_(ticker) : CFSmfProviders.symbol_(ticker), source = CFSmfProviders.buildUrl(type, symbol) || "";
        const result = { ok: false, provider: type || "", symbol, status: type ? symbol ? "Data unavailable" : "Unsupported ticker" : "Not Supported",
            http: null, identity: "Unknown", source, retrievedAt: null, quoteTime: null, fields: {}, error: "" };
        for (const [id, label, unit, smfId, field] of CF_SMF_PROVIDER_FIELDS_[type] || []) {
            result.fields[id] = { value: null, unit, label, source, field, smfId, status: "Not available", display: "", ...(unit === "currency" ? { currency: "USD" } : {}) };
        }
        return result;
    }

    static text_(value) {
        const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", ndash: "–", mdash: "—" };
        return String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, " ")
            .replace(/<[^>]*>/g, " ").replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp|ndash|mdash);/gi, (whole, entity) => {
                if (entity[0] !== "#") return named[entity.toLowerCase()] || whole;
                const value = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
                return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : whole;
            }).replace(/\s+/g, " ").trim();
    }

    static clean_(html) { return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, " "); }

    static identity_(provider, html, symbol) {
        if (provider === "ADVFN") return CFSmfProviders.advfnIdentity_(html, symbol);
        const title = CFSmfProviders.text_(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
        const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const startsWithSymbol = new RegExp("^" + escaped + "(?:\\s*[-:]|\\s+(?:Stock|Dividend)\\b)", "i");
        const inParentheses = new RegExp("\\(" + escaped + "\\)", "i");
        if (!startsWithSymbol.test(title) && !(provider !== "FINVIZ" && inParentheses.test(title))) return false;
        for (const link of html.matchAll(/<link\b[^>]*>/gi)) {
            if (!/\brel\s*=\s*(["'])canonical\1/i.test(link[0])) continue;
            const href = link[0].match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
            if (!href) continue;
            const decoded = CFSmfProviders.text_(href);
            const path = decoded.replace(/^https:\/\/(?:www\.)?(?:finviz\.com|zacks\.com|gurufocus\.com)/i, "");
            if (provider === "FINVIZ") {
                const match = path.match(/^\/(?:stock|quote\.ashx)\?[^#]*\bt=([^&#]+)/i);
                if (!match || decodeURIComponent(match[1]).toUpperCase() !== symbol) return false;
            } else {
                const match = provider === "ZACKS" ? path.match(/^\/stock\/research\/([^/?#]+)\/price-target-stock-forecast\/?(?:[?#]|$)/i)
                    : path.match(/^\/stock\/([^/?#]+)\/dividend\/?(?:[?#]|$)/i);
                if (!match || decodeURIComponent(match[1]).toUpperCase() !== symbol) return false;
            }
        }
        const primary = html.match(/<h1\b[^>]*\bdata-ticker\s*=\s*(["'])(.*?)\1/i);
        return !primary || primary[2].trim().toUpperCase() === symbol;
    }

    static advfnIdentity_(html, wanted) {
        const parts = wanted.split(":"), wantedTicker = parts[parts.length - 1], wantedExchange = parts.length === 2 ? parts[0] : "";
        const matches = value => {
            const symbol = CFSmfProviders.advfnSymbol_(value), tokens = symbol.split(":");
            return Boolean(symbol) && tokens[tokens.length - 1] === wantedTicker && (!wantedExchange || tokens.length === 2 && tokens[0] === wantedExchange);
        };
        const primaryUrls = [];
        for (const tag of html.matchAll(/<(?:link|meta)\b[^>]*>/gi)) {
            if (/^<link/i.test(tag[0]) && /\brel\s*=\s*(["'])canonical\1/i.test(tag[0])) primaryUrls.push(tag[0].match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2] || "");
            if (/^<meta/i.test(tag[0]) && /\bproperty\s*=\s*(["'])og:url\1/i.test(tag[0])) primaryUrls.push(tag[0].match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2] || "");
        }
        for (const raw of primaryUrls) {
            const url = CFSmfProviders.text_(raw);
            const path = url.match(/^https:\/\/(?:www|ca|uk)\.advfn\.com\/stock-market\/([A-Z0-9-]+)\/([^/?#]+)\/financials\/?(?:[?#]|$)/i);
            const query = url.match(/^https:\/\/(?:www|ca|uk)\.advfn\.com\/p\.php\?([^#]*)$/i);
            if (path) { if (!matches(path[1].toUpperCase() + ":" + decodeURIComponent(path[2]).toUpperCase())) return false; }
            else if (query) {
                const params = query[1].split("&"), pid = params.find(value => /^pid=/i.test(value)), symbol = params.filter(value => /^symbol=/i.test(value));
                if (pid !== "pid=financials" || symbol.length !== 1 || !matches(decodeURIComponent(symbol[0].slice(7)).toUpperCase())) return false;
            } else return false;
        }
        const title = CFSmfProviders.text_(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
        const titleSymbol = /\bFinancial(?:s| Statements| Results)?\b/i.test(title) ?
            title.match(/\(((?:[A-Z]+:)?[A-Z][A-Z0-9.-]*)\)/i)?.[1] || title.match(/^((?:[A-Z]+:)?[A-Z][A-Z0-9.-]*)\s+(?:Financials?|Annual Reports)\b/i)?.[1] : "";
        if (titleSymbol && !matches(titleSymbol.toUpperCase()) && !(primaryUrls.length && !titleSymbol.includes(":") && titleSymbol.toUpperCase() === wantedTicker)) return false;
        // A matching primary URL identifies the instrument even when the page title has no symbol.
        return primaryUrls.length > 0 || Boolean(titleSymbol && matches(titleSymbol.toUpperCase()));
    }

    static advfnYearEnd_(text) {
        const match = text.match(/^Year End(?: Date)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,)?\s+(\d{4})$/i);
        if (!match) return null;
        const month = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(match[1].toLowerCase());
        const year = Number(match[3]), day = Number(match[2]), date = new Date(Date.UTC(year, month, day));
        return year >= 100 && date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day ? date.toISOString().slice(0, 10) : null;
    }

    static advfn_(result, html) {
        const dates = [], displays = [];
        for (const section of html.matchAll(/<div\b[^>]*\bid\s*=\s*(["'])(annualIncomeStatement|annualBalanceSheet|annualCashFlow)\1[^>]*>/gi)) {
            const tags = /<\/?div\b[^>]*>/gi; tags.lastIndex = section.index + section[0].length;
            let depth = 1, end = -1, tag;
            while ((tag = tags.exec(html))) {
                depth += /^<\//.test(tag[0]) ? -1 : 1;
                if (depth === 0) { end = tag.index; break; }
            }
            if (end < 0) continue;
            const body = html.slice(section.index + section[0].length, end);
            const header = body.match(/<(thead|tdead)\b[^>]*>([\s\S]*?)<\/\1\s*>/i)?.[2];
            if (!header) continue;
            const cells = [...header.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(cell => CFSmfProviders.text_(cell[1]));
            if (!/^Year End\b/i.test(cells[0] || "")) continue;
            const date = CFSmfProviders.advfnYearEnd_(cells[0]), years = cells.slice(1).filter(Boolean);
            if (!date || !years.length || years.some((year, index) => !/^\d{4}$/.test(year) || index > 0 && Number(year) <= Number(years[index - 1])) || Number(years[years.length - 1]) !== Number(date.slice(0, 4))) {
                result.fields.year_end_date.status = "Invalid annual header"; result.fields.year_end_date.display = "Annual date and fiscal years do not agree"; return;
            }
            dates.push(date); displays.push(cells[0]);
        }
        const field = result.fields.year_end_date;
        if (!dates.length) return;
        if (dates.some(date => date !== dates[0])) { field.status = "Conflicting values"; field.display = "Annual sections report conflicting year-end dates"; return; }
        field.value = dates[0]; field.display = displays[0]; field.status = "Available";
    }

    static number_(value, rule = "number") {
        const text = value.trim().replace(/,/g, "");
        const match = text.match(/^[\$]?([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*([KMBT])?$/i);
        if (!match) return null;
        const exponent = ({ K: 3, M: 6, B: 9, T: 12 })[(match[2] || "").toUpperCase()];
        const number = Number(match[1] + (exponent ? "e" + exponent : ""));
        return Number.isFinite(number) && (rule !== "positive" || number > 0) && (rule !== "nonnegative" || number >= 0)
            && (rule !== "rsi" || number >= 0 && number <= 100) ? number : null;
    }

    static value_(display, rule) {
        if (/^(?:|--?|—|N\/?A|None)$/i.test(display)) return null;
        if (rule === "date") {
            const match = display.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,\s*(\d{4}))?(?:\s+(?:BMO|AMC))?$/i);
            if (!match) return null;
            const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(match[1].toLowerCase());
            const days = new Date(Date.UTC(Number(match[3] || 2000), month + 1, 0)).getUTCDate();
            return Number(match[2]) >= 1 && Number(match[2]) <= days ? display : null;
        }
        if (rule === "percent") {
            const match = display.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*%$/);
            return match && Number.isFinite(Number(match[1])) ? Number(match[1]) / 100 : null;
        }
        if (rule === "dividend_rate" || rule === "dividend_yield") {
            const match = display.match(/^([\d,.]+)\s*\(\s*([\d.]+)\s*%\s*\)$/);
            if (!match) return null;
            const value = CFSmfProviders.number_(rule === "dividend_rate" ? match[1] : match[2], "nonnegative");
            return value === null ? null : rule === "dividend_rate" ? value : value / 100;
        }
        return CFSmfProviders.number_(display, rule);
    }

    static assign_(field, displays, rule) {
        const entries = displays.map(display => ({ display, value: CFSmfProviders.value_(display, rule) }));
        if (!entries.length) return;
        field.display = entries[0].display;
        const values = entries.map(entry => entry.value);
        if (values.some(value => value !== values[0])) { field.status = "Conflicting values"; field.display = "Conflicting source rows"; return; }
        field.value = values[0]; field.status = field.value === null ? "Not available" : "Available";
    }

    static finviz_(result, html) {
        const pairs = new Map();
        for (const table of html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)) {
            if (!/\bclass\s*=\s*(["'])[^"']*\bsnapshot-table2\b[^"']*\1/i.test(table[1])) continue;
            const cells = [...table[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => CFSmfProviders.text_(match[1]));
            for (let index = 0; index + 1 < cells.length; index += 2) {
                const key = cells[index].toLowerCase();
                if (!pairs.has(key)) pairs.set(key, []);
                pairs.get(key).push(cells[index + 1]);
            }
        }
        for (const [id, _label, _unit, _smfId, label, rule] of CF_SMF_PROVIDER_FIELDS_.FINVIZ) {
            let displays = pairs.get(label.toLowerCase()) || [];
            // Finviz uses the same label for next-year EPS and its growth percentage.
            if (label === "EPS next Y") displays = displays.filter(value => /%$/.test(value) === (rule === "percent"));
            CFSmfProviders.assign_(result.fields[id], displays, rule);
        }
    }

    static zacks_(result, html) {
        const prices = [];
        for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
            const rows = [...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row =>
                [...row[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(cell => CFSmfProviders.text_(cell[1])));
            for (let index = 0; index + 1 < rows.length; index++) {
                const columns = rows[index].flatMap((cell, position) => /^Average Price Target$/i.test(cell) ? [position] : []);
                if (columns.length === 1 && rows[index + 1].length === rows[index].length) prices.push(rows[index + 1][columns[0]]);
            }
        }
        CFSmfProviders.assign_(result.fields.target_price, prices, "positive");
    }

    static gurufocus_(result, html) {
        const escaped = result.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const heading = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].find(match =>
            new RegExp("(?:^" + escaped + "\\b|\\(" + escaped + "\\))", "i").test(CFSmfProviders.text_(match[1])) && /Dividend/i.test(CFSmfProviders.text_(match[1])));
        const values = { Forward: [], Trailing: [] };
        if (heading) {
            const tail = html.slice(heading.index + heading[0].length), section = tail.split(/<h2\b/i, 1)[0];
            for (const div of section.matchAll(/<div\b[^>]*>([^<>]{0,100})<\/div>/gi)) {
                const match = CFSmfProviders.text_(div[1]).match(/^([\d.]+\s*%)\s*\((Forward|Trailing)\)$/i);
                if (!match) continue;
                const following = section.slice(div.index + div[0].length, div.index + div[0].length + 600);
                const headingAfter = following.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
                if (!headingAfter || CFSmfProviders.text_(headingAfter[1]) !== "Dividend Yield") continue;
                values[/forward/i.test(match[2]) ? "Forward" : "Trailing"].push(match[1]);
            }
        }
        // The current public page also publishes both yields in a ticker-specific FAQ sentence.
        // Require its heading, requested ticker, both percentages and the exact payment wording.
        const text = CFSmfProviders.text_(html), sections = [...text.matchAll(/Frequently Asked Questions:\s*([A-Z][A-Z0-9.-]*)\s+Dividend\b/gi)];
        const sentence = new RegExp("\\(" + escaped + "\\)\\s+currently has a dividend yield of\\s+(\\d+(?:\\.\\d+)?)%,\\s+paying\\s+\\$([\\d,.]+)\\s+per share annually\\.\\s+The forward yield is\\s+(\\d+(?:\\.\\d+)?)%\\.", "gi");
        let faqPair = false;
        for (let index = 0; index < sections.length; index++) {
            const section = sections[index];
            if (section[1].toUpperCase() !== result.symbol) continue;
            const end = Math.min(sections[index + 1]?.index ?? text.length, section.index + section[0].length + 2000);
            const body = text.slice(section.index + section[0].length, end).split(/\b(?:Also check out|Research Tools|Disclaimers)\b/i, 1)[0];
            for (const match of body.matchAll(sentence)) {
                if (CFSmfProviders.number_(match[2], "nonnegative") === null) continue;
                values.Trailing.push(match[1] + "%"); values.Forward.push(match[3] + "%");
                faqPair = true;
            }
        }
        if (faqPair) {
            const first = sections.find(section => section[1].toUpperCase() === result.symbol);
            const beforeFaq = text.slice(0, first.index);
            for (const pair of beforeFaq.matchAll(/(\d+(?:\.\d+)?)%\s*\(Trailing\)\s*(\d+(?:\.\d+)?)%\s*\(Forward\)\s*Dividend Yield/gi)) {
                values.Trailing.push(pair[1] + "%"); values.Forward.push(pair[2] + "%");
            }
        }
        CFSmfProviders.assign_(result.fields.forward_dividend_yield, values.Forward, "percent");
        CFSmfProviders.assign_(result.fields.trailing_dividend_yield, values.Trailing, "percent");
        if (Object.values(result.fields).some(field => field.status === "Conflicting values")) {
            for (const field of Object.values(result.fields)) { field.value = null; field.status = "Conflicting values"; field.display = "Conflicting dividend yield values"; }
        }
    }

    static parse(provider, body, ticker) {
        const result = CFSmfProviders.result_(provider, ticker);
        if (!result.provider || !result.symbol) return result;
        if (typeof body !== "string") { result.error = "The provider returned no readable page."; return result; }
        const title = CFSmfProviders.text_(body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
        if (/^(?:Just a moment|Access Denied|Forbidden|Security Verification|Robot Check)/i.test(title)
            || /<(?:form|iframe)\b[^>]*(?:challenge-form|_Incapsula_Resource)|Request unsuccessful\. Incapsula/i.test(body)) {
            result.status = "Blocked"; result.error = "The provider returned an access challenge."; return result;
        }
        try {
            const html = CFSmfProviders.clean_(body);
            if (!CFSmfProviders.identity_(result.provider, html, result.symbol)) { result.error = "The primary page did not match the requested ticker."; return result; }
            result.identity = "Matched";
            if (result.provider === "FINVIZ") CFSmfProviders.finviz_(result, html);
            else if (result.provider === "ZACKS") CFSmfProviders.zacks_(result, html);
            else if (result.provider === "GURUFOCUS") CFSmfProviders.gurufocus_(result, html);
            else CFSmfProviders.advfn_(result, html);
            result.ok = Object.values(result.fields).some(field => field.value !== null);
            result.status = result.ok ? "Available" : "Data unavailable";
            if (!result.ok) result.error = "The matching page supplied no accepted fields.";
            return result;
        } catch { result.error = "The provider page could not be read."; return result; }
    }

    static fetch(provider, ticker, dependencies = {}) {
        const result = CFSmfProviders.result_(provider, ticker);
        if (!result.provider || !result.symbol) return result;
        const fetch = dependencies.fetch || ((url, options) => UrlFetchApp.fetch(url, options));
        const clock = dependencies.clock || (() => Date.now());
        try {
            const response = fetch(result.source, { method: "get", muteHttpExceptions: true, followRedirects: true });
            const http = response.getResponseCode();
            const retrievedAt = new Date(clock()).toISOString();
            if (http < 200 || http >= 300) return { ...result, http, retrievedAt, status: "HTTP " + http, error: "The provider did not return an accepted page." };
            return { ...CFSmfProviders.parse(result.provider, response.getContentText(), result.symbol), http, retrievedAt };
        } catch { return { ...result, status: "Request failed", error: "The public provider request could not be completed." }; }
    }

    /** URLs below have selected SMF Mac image evidence, not Google Sheets verification. */
    static imageCandidates(ticker) {
        const symbol = CFSmfProviders.symbol_(ticker);
        if (!symbol) return [];
        return [
            { provider: "StockCharts", description: "Six-month daily chart (SMF picture choice 4)", url: "https://stockcharts.com/c-sc/sc?s=" + encodeURIComponent(symbol) + "&p=D&yr=0&mn=6&dy=0&i=t94339682869&r=4806", evidence: "SMF Mac selected PNG, visibility and reopen checks passed.", status: "Not tested from Google Sheets" },
            { provider: "StockCharts", description: "Point-and-figure chart (SMF picture choice 2)", url: "https://stockcharts.com/pnf/chart?c=" + encodeURIComponent(symbol) + ",P", evidence: "SMF Mac selected native image checks passed.", status: "Not tested from Google Sheets" }
        ];
    }
}
