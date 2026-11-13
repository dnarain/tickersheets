/*  *** DEBUG START ***
export { TickerSheetsData };
//  *** DEBUG END ***/

/** Pure parsers and calculations used by the one-ticker worksheet. No network or property access. */
class TickerSheetsData {
    static normalizeTicker(input = "NVDA") {
        if (typeof input !== "string") throw new Error("Enter a stock ticker, for example NVDA or TSE:RY.");
        const value = input.trim().toUpperCase();
        if (!value || value.length > 35 || !/^[A-Z0-9^][A-Z0-9.^:-]*$/.test(value)) {
            throw new Error("Enter a stock ticker, for example NVDA or TSE:RY.");
        }
        const exchanges = { NASDAQ: "", NYSE: "", NYSEARCA: "", NYSEAMERICAN: "", BATS: "", TSE: ".TO", TSX: ".TO", TSXV: ".V", CVE: ".V", NEO: ".NE", LON: ".L", ASX: ".AX" };
        let ticker = value, exchange = null, cacheSymbol = null;
        if (value.includes(":")) {
            const parts = value.split(":");
            if (parts.length !== 2 || !parts[1] || !Object.prototype.hasOwnProperty.call(exchanges, parts[0])) {
                throw new Error("Use a supported exchange:ticker or a Yahoo Finance ticker.");
            }
            exchange = ({ TSX: "TSE", CVE: "TSXV" })[parts[0]] || parts[0];
            ticker = parts[1];
            cacheSymbol = exchange + ":" + ticker;
            ticker = ticker.replace(/\./g, "-") + exchanges[parts[0]];
        } else {
            const suffix = value.match(/^(.*)\.(TO|V|NE|L|AX)$/);
            if (suffix) {
                exchange = ({ TO: "TSE", V: "TSXV", NE: "NEO", L: "LON", AX: "ASX" })[suffix[2]];
                cacheSymbol = exchange + ":" + suffix[1];
            } else if (/^[A-Z0-9]+\.[AB]$/.test(value)) {
                ticker = value.replace(".", "-");
            }
        }
        return { input: value, ticker, yahooSymbol: ticker, cacheSymbol, exchange, label: value };
    }

    static number_(value, positive = false) {
        return typeof value === "number" && Number.isFinite(value) && (!positive || value > 0) ? value : null;
    }

    static text_(value) {
        return typeof value === "string" && value.trim() && !/[<>\u0000-\u001f]/.test(value) ? value.trim() : null;
    }

    static resolveCacheSymbol_(symbol, meta) {
        const known = TickerSheetsData.normalizeTicker(symbol);
        if (known.cacheSymbol) return known.cacheSymbol;
        const exchange = ({ NMS: "NASDAQ", NGM: "NASDAQ", NCM: "NASDAQ", NASDAQ: "NASDAQ", NYQ: "NYSE", NYSE: "NYSE", PCX: "NYSEARCA", ASE: "NYSEAMERICAN", TOR: "TSE", TSX: "TSE" })[String(meta.exchangeName || "").toUpperCase()];
        return exchange ? exchange + ":" + symbol : null;
    }

    /** Extract only explicit provider quote pairs. Untimed extended prices never become current quotes. */
    static quoteSessions(meta, source = "", percentScale = 1) {
        const number = value => TickerSheetsData.number_(value && typeof value === "object" ? value.raw : value);
        const timestamp = value => {
            const epoch = number(value);
            return Number.isSafeInteger(epoch) && epoch > 0 && epoch <= 253402300799 ? new Date(epoch * 1000).toISOString() : null;
        };
        const quote = (prefix, regular = false) => {
            const price = number(meta?.[prefix + "Price"]), time = timestamp(meta?.[prefix + "Time"]);
            const accepted = price !== null && price > 0;
            const rawChange = number(meta?.[prefix + "Change"]), rawFraction = number(meta?.[prefix + "ChangePercent"]);
            return { price: accepted && (regular || time !== null) ? price : null, quoteTime: accepted ? time : null,
                change: accepted && (regular || time !== null) ? rawChange : null,
                changeFraction: accepted && (regular || time !== null) && rawFraction !== null ? rawFraction * percentScale : null,
                source, status: !accepted ? "Price unavailable" : time === null ? "Timestamp unavailable" : "Available" };
        };
        const state = typeof meta?.marketState === "string" ? meta.marketState.trim().toUpperCase() : "";
        return { symbol: typeof meta?.symbol === "string" ? meta.symbol.toUpperCase() : null, currency: TickerSheetsData.text_(meta?.currency),
            marketState: ["REGULAR", "PRE", "PREPRE", "POST", "POSTPOST", "CLOSED", "OVERNIGHT"].includes(state) ? state : null,
            regular: quote("regularMarket", true), pre: quote("preMarket"), post: quote("postMarket") };
    }

    /** Select the latest quote in the provider's stated session, while keeping regular prices separate. */
    static selectQuote(chart = {}, details = {}) {
        const base = chart.quoteSessions && chart.quoteSessions.symbol === chart.symbol ? chart.quoteSessions : TickerSheetsData.quoteSessions({ symbol: chart.symbol, currency: chart.currency,
            regularMarketPrice: chart.price, regularMarketTime: chart.quoteTime ? Date.parse(chart.quoteTime) / 1000 : null, marketState: chart.marketState }, chart.source || "Yahoo Chart API");
        const snapshots = [base];
        if (details?.ok === true && details.symbol === chart.symbol && details.quoteSessions?.symbol === chart.symbol
            && !(base.currency && details.quoteSessions.currency && base.currency !== details.quoteSessions.currency)) snapshots.push(details.quoteSessions);
        const epoch = value => typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
        const merged = {};
        for (const kind of ["regular", "pre", "post"]) {
            const rows = snapshots.map(row => row[kind]).filter(row => typeof row?.price === "number" && Number.isFinite(row.price) && row.price > 0);
            const timed = rows.filter(row => epoch(row.quoteTime) !== null).sort((a, b) => epoch(b.quoteTime) - epoch(a.quoteTime));
            const chosen = timed[0] || (kind === "regular" ? rows[0] : null);
            const conflict = chosen && timed.some(row => row.quoteTime === chosen.quoteTime && Math.abs(row.price - chosen.price) > Math.max(1e-8, chosen.price * 1e-7));
            merged[kind] = chosen && !conflict ? { ...chosen } : { price: null, quoteTime: null, change: null, changeFraction: null, source: "", status: conflict ? "Conflicting same-time quotes" : "Quote unavailable" };
        }
        const regularEpoch = epoch(merged.regular.quoteTime);
        for (const kind of ["pre", "post"]) if (regularEpoch !== null && epoch(merged[kind].quoteTime) !== null && epoch(merged[kind].quoteTime) < regularEpoch) merged[kind].status = "Older than regular quote";
        const states = snapshots.filter(row => row.marketState).map(row => ({ state: row.marketState,
            epoch: Math.max(...["regular", "pre", "post"].map(kind => epoch(row[kind]?.quoteTime) ?? -Infinity)) }))
            .filter(row => regularEpoch === null || row.epoch >= regularEpoch).sort((a, b) => b.epoch - a.epoch);
        const marketState = states.length && !states.some(row => row.epoch === states[0].epoch && row.state !== states[0].state) ? states[0].state : null;
        let selected = "regular";
        const newer = kind => regularEpoch !== null && merged[kind].price !== null && epoch(merged[kind].quoteTime) > regularEpoch;
        if (["PRE", "PREPRE"].includes(marketState) && newer("pre")) selected = "pre";
        if (["POST", "POSTPOST"].includes(marketState) && newer("post")) selected = "post";
        if (["CLOSED", "OVERNIGHT"].includes(marketState)) for (const kind of ["pre", "post"]) {
            if (newer(kind) && epoch(merged[kind].quoteTime) > (epoch(merged[selected].quoteTime) ?? -Infinity)) selected = kind;
        }
        const active = merged[selected];
        return { ...merged, marketState, price: active.price, quoteTime: active.quoteTime, change: active.change, changeFraction: active.changeFraction,
            session: ({ regular: "Regular", pre: "Pre-market", post: "After-hours" })[selected], source: active.source, selectedSession: selected };
    }

    static parseChart(body, requestedYahooSymbol) {
        const source = "Yahoo Chart API";
        const failure = message => ({ ok: false, source, symbol: null, history: [], events: { dividends: [], splits: [] }, error: message });
        try {
            const wanted = TickerSheetsData.normalizeTicker(requestedYahooSymbol).yahooSymbol;
            const payload = typeof body === "string" ? JSON.parse(body) : body;
            const result = payload?.chart?.result;
            if (payload?.chart?.error || !Array.isArray(result) || result.length !== 1) return failure("Yahoo Chart returned no quote data.");
            const chart = result[0], meta = chart.meta;
            if (!meta || typeof meta.symbol !== "string" || meta.symbol.toUpperCase() !== wanted) return failure("Yahoo Chart returned a different ticker.");
            const times = chart.timestamp, values = chart.indicators?.quote?.[0];
            if (!Array.isArray(times) || !times.length || !values || !Array.isArray(values.close) || values.close.length !== times.length) {
                return failure("Yahoo Chart history is unavailable or incomplete.");
            }
            for (const field of ["open", "high", "low", "volume"]) {
                if (values[field] !== undefined && (!Array.isArray(values[field]) || values[field].length !== times.length)) return failure("Yahoo Chart history arrays are inconsistent.");
            }
            const adjusted = chart.indicators?.adjclose?.[0]?.adjclose;
            if (adjusted !== undefined && (!Array.isArray(adjusted) || adjusted.length !== times.length)) return failure("Yahoo Chart adjusted history is inconsistent.");
            const history = [], dates = new Set();
            let prior = 0;
            for (let i = 0; i < times.length; i++) {
                const epoch = times[i];
                if (!Number.isInteger(epoch) || epoch <= prior || epoch <= 0) return failure("Yahoo Chart dates are invalid, duplicated or out of order.");
                const date = new Date(epoch * 1000);
                if (!Number.isFinite(date.getTime())) return failure("Yahoo Chart dates are invalid, duplicated or out of order.");
                const day = date.toISOString().slice(0, 10);
                if (dates.has(day)) return failure("Yahoo Chart has more than one daily bar for a date.");
                dates.add(day); prior = epoch;
                const volume = TickerSheetsData.number_(values.volume?.[i]);
                const close = TickerSheetsData.number_(values.close[i], true);
                const high = TickerSheetsData.number_(values.high?.[i], true), low = TickerSheetsData.number_(values.low?.[i], true);
                if (high !== null && low !== null && high < low) return failure("Yahoo Chart contains an invalid daily price range.");
                history.push({ date: day, epoch, open: TickerSheetsData.number_(values.open?.[i], true), high, low, close,
                    adjustedClose: close === null ? null : TickerSheetsData.number_(adjusted?.[i], true), volume: volume !== null && volume >= 0 ? volume : null });
            }
            const epoch = TickerSheetsData.number_(meta.regularMarketTime, true);
            const quoteDate = epoch === null ? null : new Date(epoch * 1000);
            const quoteSessions = TickerSheetsData.quoteSessions(meta, source, 0.01);
            const events = { dividends: [], splits: [] };
            for (const dividend of Object.values(chart.events?.dividends || {})) {
                if (TickerSheetsData.number_(dividend.date, true) !== null && TickerSheetsData.number_(dividend.amount) !== null && dividend.amount >= 0) {
                    const eventDate = new Date(dividend.date * 1000);
                    if (Number.isFinite(eventDate.getTime())) events.dividends.push({ date: eventDate.toISOString().slice(0, 10), epoch: dividend.date, amount: dividend.amount, source });
                }
            }
            for (const split of Object.values(chart.events?.splits || {})) {
                if (TickerSheetsData.number_(split.date, true) !== null && TickerSheetsData.number_(split.numerator, true) !== null && TickerSheetsData.number_(split.denominator, true) !== null) {
                    const eventDate = new Date(split.date * 1000);
                    if (Number.isFinite(eventDate.getTime())) events.splits.push({ date: eventDate.toISOString().slice(0, 10), epoch: split.date, numerator: split.numerator, denominator: split.denominator, source });
                }
            }
            events.dividends.sort((a, b) => a.epoch - b.epoch); events.splits.sort((a, b) => a.epoch - b.epoch);
            return { ok: true, source, symbol: wanted, cacheSymbol: TickerSheetsData.resolveCacheSymbol_(wanted, meta), name: TickerSheetsData.text_(meta.longName) || TickerSheetsData.text_(meta.shortName),
                currency: TickerSheetsData.text_(meta.currency), exchange: TickerSheetsData.text_(meta.fullExchangeName) || TickerSheetsData.text_(meta.exchangeName),
                exchangeCode: TickerSheetsData.text_(meta.exchangeName), timezone: TickerSheetsData.text_(meta.exchangeTimezoneName), instrumentType: TickerSheetsData.text_(meta.instrumentType),
                quoteTime: quoteDate && Number.isFinite(quoteDate.getTime()) ? quoteDate.toISOString() : null,
                price: TickerSheetsData.number_(meta.regularMarketPrice, true), regularPrice: quoteSessions.regular.price, regularQuoteTime: quoteSessions.regular.quoteTime,
                quoteSessions, previousClose: TickerSheetsData.number_(meta.previousClose, true), marketState: quoteSessions.marketState,
                metrics: { dayHigh: TickerSheetsData.number_(meta.regularMarketDayHigh, true), dayLow: TickerSheetsData.number_(meta.regularMarketDayLow, true), volume: TickerSheetsData.number_(meta.regularMarketVolume),
                    fiftyTwoWeekHigh: TickerSheetsData.number_(meta.fiftyTwoWeekHigh, true), fiftyTwoWeekLow: TickerSheetsData.number_(meta.fiftyTwoWeekLow, true), marketCap: TickerSheetsData.number_(meta.marketCap, true) },
                dateBasis: "UTC date of Yahoo daily bar", history, events,
                warnings: [history.some(row => row.close === null) ? "Some daily closing prices are missing." : null, history.some(row => row.adjustedClose === null) ? "Some adjusted closing prices are missing; affected returns remain unavailable." : null].filter(Boolean), error: null };
        } catch { return failure("Yahoo Chart response could not be read."); }
    }

    static decodeText_(value) {
        const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
        return String(value).replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (whole, entity) => {
            if (entity[0] !== "#") return named[entity.toLowerCase()] || whole;
            const number = entity[1].toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
            return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : whole;
        });
    }

    static parseNumber_(display) {
        const text = display.trim().replace(/,/g, "");
        const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*([KMBT])?$/i);
        if (!match) return null;
        const exponent = ({ K: 3, M: 6, B: 9, T: 12 })[(match[2] || "").toUpperCase()];
        const number = Number(match[1] + (exponent ? "e" + exponent : ""));
        return Number.isFinite(number) ? number : null;
    }

    static parseStatistics(html, requestedSymbol) {
        const source = "Yahoo Finance website", fields = {};
        const failure = error => ({ ok: false, source, symbol: null, fields: {}, error });
        try {
            const ticker = TickerSheetsData.normalizeTicker(requestedSymbol).yahooSymbol;
            const title = typeof html === "string" && html.match(/<title\b[^>]*>([^<]*)/i);
            const escaped = ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            if (!title || !new RegExp("^.+?\\s*\\(" + escaped + "\\)(?:\\s|$)", "i").test(TickerSheetsData.decodeText_(title[1]).trim())) {
                return failure("Yahoo Finance page does not match the requested ticker.");
            }
            const list = html.match(/<div\b[^>]*data-testid=["']quote-statistics["'][^>]*>\s*<ul\b[^>]*>([\s\S]*?)<\/ul>/i);
            if (!list) return failure("Yahoo Finance quote statistics are unavailable.");
            const numberRows = {
                "Previous Close": ["previous_close", "Previous close", "currency"], Open: ["open", "Open", "currency"],
                Volume: ["volume", "Volume", "shares"], "Avg. Volume": ["average_volume", "Average volume", "shares"],
                "Market Cap (intraday)": ["market_cap", "Market cap", "currency"], "Beta (5Y Monthly)": ["beta", "Beta (5Y monthly)", "ratio"],
                "PE Ratio (TTM)": ["trailing_pe", "P/E (TTM)", "ratio"], "EPS (TTM)": ["eps_ttm", "EPS (TTM)", "currency"],
                "1y Target Est": ["target_price", "One-year analyst target", "currency"], "Net Assets": ["net_assets", "Net assets", "currency"], NAV: ["nav", "NAV", "currency"]
            };
            const textRows = { "Earnings Date": ["earnings_date", "Earnings date"], "Ex-Dividend Date": ["ex_dividend_date", "Ex-dividend date"], "Inception Date": ["inception_date", "Inception date"] };
            const add = (id, label, value, display, unit, field) => {
                if (Object.prototype.hasOwnProperty.call(fields, id)) { fields[id].value = null; fields[id].display = "Conflicting source rows"; return; }
                fields[id] = { label, value, display, unit, source, field };
            };
            for (const row of list[1].match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) || []) {
                const heading = row.match(/<span\b[^>]*\btitle\s*=\s*(["'])(.*?)\1[^>]*>[\s\S]*?<\/span>/i);
                if (!heading) continue;
                const label = TickerSheetsData.decodeText_(heading[2]).trim();
                const display = TickerSheetsData.decodeText_(row.slice(heading.index + heading[0].length).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
                const missing = !display || /^(?:--|—|-|N\/?A|Not available)$/i.test(display);
                const spec = numberRows[label];
                if (spec) add(spec[0], spec[1], missing ? null : TickerSheetsData.parseNumber_(display), display, spec[2], label);
                if (textRows[label]) add(textRows[label][0], textRows[label][1], missing || /[<>]/.test(display) ? null : display, display, "date text", label);
                if (label === "Bid" || label === "Ask") {
                    const match = display.match(/^([\d,.]+)\s*[x×]\s*[\d,]+$/i);
                    add(label.toLowerCase(), label, match ? TickerSheetsData.parseNumber_(match[1]) : null, display, "currency", label);
                }
                if (label === "Day's Range" || label === "52 Week Range") {
                    const match = display.match(/^([\d,.]+)\s*[-–]\s*([\d,.]+)$/);
                    const prefix = label === "Day's Range" ? "day" : "fifty_two_week";
                    add(prefix + "_low", label + " low", match ? TickerSheetsData.parseNumber_(match[1]) : null, display, "currency", label);
                    add(prefix + "_high", label + " high", match ? TickerSheetsData.parseNumber_(match[2]) : null, display, "currency", label);
                }
                if (label === "Forward Dividend & Yield") {
                    const match = display.match(/^([\d,.]+)\s*\(\s*(\d+(?:\.\d+)?)\s*%\s*\)$/);
                    add("forward_dividend_rate", "Forward annual dividend", match ? TickerSheetsData.parseNumber_(match[1]) : null, display, "currency", label);
                    add("dividend_yield", "Forward dividend yield", match ? Number(match[2]) / 100 : null, display, "fraction", label);
                }
                if (["Yield", "YTD Daily Total Return", "Expense Ratio (net)"].includes(label)) {
                    const match = display.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*%$/);
                    const id = ({ Yield: "dividend_yield", "YTD Daily Total Return": "ytd_return", "Expense Ratio (net)": "expense_ratio" })[label];
                    add(id, label, match ? Number(match[1]) / 100 : null, display, "fraction", label);
                }
            }
            return { ok: true, source, symbol: ticker, fields, error: null };
        } catch { return failure("Yahoo Finance statistics could not be read."); }
    }

    static sma_(values, period) {
        const out = [], window = [];
        let sum = 0;
        for (const value of values) {
            if (TickerSheetsData.number_(value) === null) { window.length = 0; sum = 0; out.push(null); continue; }
            window.push(value); sum += value;
            if (window.length > period) sum -= window.shift();
            out.push(window.length === period ? sum / period : null);
        }
        return out;
    }

    static ema_(values, period) {
        const out = [], seed = [];
        let previous = null;
        for (const value of values) {
            if (TickerSheetsData.number_(value) === null) { seed.length = 0; previous = null; out.push(null); continue; }
            if (previous === null) {
                seed.push(value);
                if (seed.length === period) previous = seed.reduce((a, b) => a + b, 0) / period;
            } else previous += (value - previous) * 2 / (period + 1);
            out.push(previous);
        }
        return out;
    }

    static rsi_(values, period) {
        const out = [];
        let previous = null, gains = 0, losses = 0, count = 0;
        for (const value of values) {
            if (TickerSheetsData.number_(value) === null) { previous = null; gains = 0; losses = 0; count = 0; out.push(null); continue; }
            if (previous === null) { previous = value; out.push(null); continue; }
            const change = value - previous; previous = value;
            const gain = Math.max(change, 0), loss = Math.max(-change, 0);
            count++;
            if (count <= period) { gains += gain; losses += loss; }
            if (count === period) { gains /= period; losses /= period; }
            else if (count > period) { gains = (gains * (period - 1) + gain) / period; losses = (losses * (period - 1) + loss) / period; }
            out.push(count < period ? null : gains === 0 && losses === 0 ? 50 : losses === 0 ? 100 : 100 - 100 / (1 + gains / losses));
        }
        return out;
    }

    static volatility_(adjusted, period) {
        if (adjusted.length < period + 1) return null;
        const values = adjusted.slice(-period - 1);
        if (values.some(value => TickerSheetsData.number_(value, true) === null)) return null;
        const returns = values.slice(1).map((value, i) => Math.log(value / values[i]));
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        return Math.sqrt(returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1)) * Math.sqrt(252);
    }

    static calculate(history) {
        if (!Array.isArray(history)) throw new Error("History must be an array of daily bars.");
        const close = history.map(row => TickerSheetsData.number_(row.close, true));
        const adjusted = history.map(row => TickerSheetsData.number_(row.adjustedClose, true));
        const sma20 = TickerSheetsData.sma_(close, 20), sma50 = TickerSheetsData.sma_(close, 50), sma200 = TickerSheetsData.sma_(close, 200);
        const ema12 = TickerSheetsData.ema_(close, 12), ema26 = TickerSheetsData.ema_(close, 26), rsi14 = TickerSheetsData.rsi_(close, 14);
        const macd = close.map((_value, i) => ema12[i] !== null && ema26[i] !== null ? ema12[i] - ema26[i] : null);
        const signal = TickerSheetsData.ema_(macd, 9);
        let peak = null;
        const series = history.map((row, i) => {
            const price = adjusted[i];
            if (price !== null) peak = peak === null ? price : Math.max(peak, price);
            const drawdown = price !== null && peak !== null ? price / peak - 1 : null;
            return { ...row, sma20: sma20[i], sma50: sma50[i], sma200: sma200[i], ema12: ema12[i], ema26: ema26[i], macd: macd[i], macdSignal: signal[i],
                macdHistogram: macd[i] !== null && signal[i] !== null ? macd[i] - signal[i] : null, rsi14: rsi14[i], drawdown,
                return1d: i > 0 && adjusted[i] !== null && adjusted[i - 1] !== null ? adjusted[i] / adjusted[i - 1] - 1 : null };
        });
        // A live daily bar may publish OHLC/volume before its close. Keep that
        // row in history, but end indicator summaries at the latest real close.
        let publishedIndex = close.length - 1;
        while (publishedIndex >= 0 && close[publishedIndex] === null) publishedIndex--;
        const publishedHistory = history.slice(0, publishedIndex + 1);
        const publishedAdjusted = adjusted.slice(0, publishedIndex + 1);
        const latest = series[publishedIndex] || {};
        const last = publishedAdjusted[publishedAdjusted.length - 1];
        const ratio = base => TickerSheetsData.number_(last, true) !== null && TickerSheetsData.number_(base, true) !== null ? last / base - 1 : null;
        const trailingReturn = periods => publishedAdjusted.length > periods ? ratio(publishedAdjusted[publishedAdjusted.length - 1 - periods]) : null;
        const year = typeof latest.date === "string" ? latest.date.slice(0, 4) : "";
        const yearBase = publishedHistory.reduce((base, row, i) => typeof row.date === "string" && row.date.slice(0, 4) < year ? publishedAdjusted[i] : base, null);
        const volume = TickerSheetsData.sma_(publishedHistory.map(row => TickerSheetsData.number_(row.volume)), 20);
        const minimumDrawdown = series.slice(0, publishedIndex + 1).reduce((minimum, row) => row.drawdown === null ? minimum : Math.min(minimum, row.drawdown), 0);
        const summary = { barCount: publishedHistory.length, historyStart: history[0]?.date || null, historyEnd: latest.date || null, indicatorAsOf: latest.date || null,
            price: latest.close ?? null, sma20: latest.sma20 ?? null, sma50: latest.sma50 ?? null, sma200: latest.sma200 ?? null,
            rsi14: latest.rsi14 ?? null, macd: latest.macd ?? null, macdSignal: latest.macdSignal ?? null, macdHistogram: latest.macdHistogram ?? null,
            return1d: trailingReturn(1), return1w: trailingReturn(5), return1m: trailingReturn(21), return3m: trailingReturn(63), return6m: trailingReturn(126), return1y: trailingReturn(252),
            returnYtd: ratio(yearBase), returnSinceStart: publishedAdjusted.length > 1 ? ratio(publishedAdjusted[0]) : null,
            volatility20d: TickerSheetsData.volatility_(publishedAdjusted, 20), volatility63d: TickerSheetsData.volatility_(publishedAdjusted, 63), volatility252d: TickerSheetsData.volatility_(publishedAdjusted, 252),
            maxDrawdown: publishedAdjusted.length > 1 && publishedAdjusted.every(value => value !== null) ? minimumDrawdown : null,
            currentDrawdown: latest.drawdown ?? null, volumeAverage20: volume[volume.length - 1] ?? null,
            aboveSma50: latest.close != null && latest.sma50 != null ? latest.close > latest.sma50 : null,
            aboveSma200: latest.close != null && latest.sma200 != null ? latest.close > latest.sma200 : null,
            returnBasis: "Adjusted close", indicatorBasis: "Raw close", annualizationSessions: 252 };
        return { series, summary };
    }

    /** Align adjusted closes by date; only matching dates enter the indexed comparison. */
    static compare(history, benchmarkHistory) {
        const benchmark = new Map(benchmarkHistory.filter(row => TickerSheetsData.number_(row.adjustedClose, true) !== null).map(row => [row.date, row.adjustedClose]));
        const matches = history.filter(row => TickerSheetsData.number_(row.adjustedClose, true) !== null && benchmark.has(row.date));
        if (!matches.length) return { series: [], stockReturn: null, benchmarkReturn: null, relativeReturn: null, basis: "Adjusted close; matching dates only" };
        const first = matches[0], stockBase = first.adjustedClose, benchmarkBase = benchmark.get(first.date);
        const series = matches.map(row => ({ date: row.date, stockIndex: row.adjustedClose / stockBase * 100, benchmarkIndex: benchmark.get(row.date) / benchmarkBase * 100 }));
        const last = series[series.length - 1];
        const stockReturn = series.length > 1 ? last.stockIndex / 100 - 1 : null, benchmarkReturn = series.length > 1 ? last.benchmarkIndex / 100 - 1 : null;
        return { series, stockReturn, benchmarkReturn, relativeReturn: stockReturn !== null && benchmarkReturn !== null ? (1 + stockReturn) / (1 + benchmarkReturn) - 1 : null, basis: "Adjusted close; matching dates only" };
    }
}
