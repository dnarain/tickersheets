import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { TickerSheetsData as D } from "../src/TickerSheetsData.js";

const captured = JSON.parse(fs.readFileSync(new URL("./fixtures/analysis-chart-nvda.json", import.meta.url), "utf8"));
const clone = () => structuredClone(captured);
const bars = (values, adjusted = values) => values.map((close, i) => ({ date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10), epoch: 1735689600 + i * 86400, close, adjustedClose: adjusted[i], volume: 100 + i }));
const statisticPage = (ticker, rows) => `<title>Example Company (${ticker}) Stock Price - Yahoo Finance</title><div data-testid="quote-statistics"><ul>${rows.map(([label,value]) => `<li><span title="${label}">${label}</span><span>${value}</span></li>`).join("")}</ul></div>`;

describe("analysis ticker controls", () => {
    it("defaults to NVDA without inventing its exchange", () => {
        expect(D.normalizeTicker()).toMatchObject({ yahooSymbol: "NVDA", cacheSymbol: null, exchange: null });
    });
    it.each([
        [" nvda ", "NVDA", null], ["NASDAQ:AAPL", "AAPL", "NASDAQ:AAPL"], ["NYSE:BRK.B", "BRK-B", "NYSE:BRK.B"],
        ["TSE:RY", "RY.TO", "TSE:RY"], ["TSX:XIC", "XIC.TO", "TSE:XIC"], ["RY.TO", "RY.TO", "TSE:RY"],
        ["BRK.B", "BRK-B", null], ["TSXV:ABC", "ABC.V", "TSXV:ABC"], ["LON:VOD", "VOD.L", "LON:VOD"]
    ])("normalizes %s", (input,yahooSymbol,cacheSymbol) => expect(D.normalizeTicker(input)).toMatchObject({ yahooSymbol,cacheSymbol }));
    it.each(["", "  ", "=NVDA", "NVDA?token=x", "NASDAQ:AAPL:MSFT", "UNKNOWN:AAPL", "NASDAQ:", "A A", null, 123])("rejects invalid ticker input %#", input => {
        expect(() => D.normalizeTicker(input)).toThrow();
    });
});

describe("Yahoo chart analysis data", () => {
    it("reads captured metadata and consecutive OHLCV bars with ticker identity", () => {
        const result=D.parseChart(captured,"NVDA");
        expect(result.ok).toBe(true); expect(result.symbol).toBe("NVDA"); expect(result.cacheSymbol).toBe("NASDAQ:NVDA");
        expect(result.history).toHaveLength(25); expect(result.price).toBe(173.73); expect(result.name).toBe("NVIDIA Corporation");
        expect(result.quoteTime).toBe(new Date(1794430800*1000).toISOString());
        expect(result.history.at(-1).close).toBeCloseTo(173.72999572753906); expect(result.history.at(-1).volume).toBeGreaterThan(0);
        expect(result.previousClose).toBeNull(); // chartPreviousClose describes the start of this two-year request.
        expect(result.warnings).toEqual([]);
    });
    it("also accepts response text", () => expect(D.parseChart(JSON.stringify(captured),"NVDA").ok).toBe(true));
    it("rejects an unrelated returned symbol", () => {
        expect(D.parseChart(captured,"AAPL")).toMatchObject({ok:false,history:[]});
    });
    it.each(["not JSON", {chart:{error:{code:"Not Found",description:"untrusted private content"},result:null}}, {chart:{result:[]}}])("returns fixed errors without provider messages %#", payload => {
        const result=D.parseChart(payload,"NVDA"); expect(result.ok).toBe(false); expect(result.error).not.toContain("private"); expect(result.history).toEqual([]);
    });
    it.each([
        r=>r.timestamp[2]=r.timestamp[1], r=>r.timestamp[2]=r.timestamp[1]-100, r=>r.timestamp[2]=null,
        r=>r.timestamp[2]=r.timestamp[1]+1, r=>r.indicators.quote[0].close.pop(), r=>r.indicators.quote[0].open.pop(),
        r=>r.indicators.adjclose[0].adjclose.pop()
    ])("rejects invalid daily dates and inconsistent arrays %#", change => {
        const payload=clone(); change(payload.chart.result[0]); expect(D.parseChart(payload,"NVDA").ok).toBe(false);
    });
    it("preserves missing OHLCV and adjusted prices instead of converting them to zero", () => {
        const payload=clone(),r=payload.chart.result[0];
        r.indicators.quote[0].close[3]=null; r.indicators.quote[0].volume[4]=-1;
        const result=D.parseChart(payload,"NVDA"); expect(result.ok).toBe(true); expect(result.history[3].close).toBeNull();
        expect(result.history[3].adjustedClose).toBeNull(); expect(result.history[4].volume).toBeNull(); expect(result.warnings).toHaveLength(2);
    });
    it("rejects a daily high below the daily low", () => {
        const payload=clone(); payload.chart.result[0].indicators.quote[0].high[0]=1;
        expect(D.parseChart(payload,"NVDA").ok).toBe(false);
    });
    it("resolves cache exchange from metadata instead of assuming NASDAQ", () => {
        const payload=clone(); payload.chart.result[0].meta.symbol="IBM"; payload.chart.result[0].meta.exchangeName="NYQ";
        expect(D.parseChart(payload,"IBM").cacheSymbol).toBe("NYSE:IBM");
        payload.chart.result[0].meta.exchangeName="UNKNOWN"; expect(D.parseChart(payload,"IBM").cacheSymbol).toBeNull();
    });
    it("keeps valid zero dividends and filters invalid events", () => {
        const payload=clone(); payload.chart.result[0].events={dividends:{a:{date:100,amount:0},b:{date:200,amount:1},c:{date:300,amount:null}},splits:{a:{date:100,numerator:10,denominator:1},b:{date:200,numerator:0,denominator:1}}};
        const result=D.parseChart(payload,"NVDA"); expect(result.events.dividends.map(r=>r.amount)).toEqual([0,1]); expect(result.events.splits).toHaveLength(1);
    });
});

describe("quote-statistics fallback fields", () => {
    it("reads captured market cap, earnings date, beta, PE, EPS and forward yield", () => {
        const html=fs.readFileSync(new URL("./fixtures/yahoo-nvda.html", import.meta.url),"utf8");
        const r=D.parseStatistics(html,"NVDA"); expect(r.ok).toBe(true); expect(r.fields.market_cap.value).toBe(4.195e12);
        expect(r.fields.trailing_pe.value).toBe(21.96); expect(r.fields.eps_ttm.value).toBe(7.91); expect(r.fields.beta.value).toBe(2.25);
        expect(r.fields.earnings_date.value).toBe("Nov 17, 2026"); expect(r.fields.dividend_yield.value).toBe(0.0059);
        expect(r.fields.day_low.value).toBe(170.77); expect(r.fields.fifty_two_week_high.value).toBe(243.37);
        expect(r.fields.market_cap).toMatchObject({source:"Yahoo Finance website",field:"Market Cap (intraday)",unit:"currency"});
    });
    it("binds Canadian suffixes to the exact requested ticker", () => {
        const html=fs.readFileSync(new URL("./fixtures/yahoo-ry-to.html", import.meta.url),"utf8");
        expect(D.parseStatistics(html,"TSE:RY").ok).toBe(true); expect(D.parseStatistics(html,"RY").ok).toBe(false);
    });
    it("ignores unrelated rows and preserves published missing markers", () => {
        const outside='<li><span title="Market Cap (intraday)">Market Cap</span><span>999T</span></li>';
        const result=D.parseStatistics(outside+statisticPage("NVDA",[["Market Cap (intraday)","--"],["EPS (TTM)","-1.50"],["Yield","0.00%"]]),"NVDA");
        expect(result.fields.market_cap.value).toBeNull(); expect(result.fields.eps_ttm.value).toBe(-1.5); expect(result.fields.dividend_yield.value).toBe(0);
    });
    it("rejects contradictory repeated fields", () => {
        const result=D.parseStatistics(statisticPage("NVDA",[["PE Ratio (TTM)","20"],["PE Ratio (TTM)","99"]]),"NVDA");
        expect(result.fields.trailing_pe.value).toBeNull(); expect(result.fields.trailing_pe.display).toBe("Conflicting source rows");
    });
    it.each(["",'<title>Yahoo Finance</title>',statisticPage("AAPL",[["Volume","123"]]),null])("does not accept another ticker or an error page %#", html => {
        expect(D.parseStatistics(html,"NVDA")).toMatchObject({ok:false,fields:{}});
    });
    it("converts K/M/B/T units and leaves malformed numeric rows missing", () => {
        const result=D.parseStatistics(statisticPage("NVDA",[["Market Cap (intraday)","4.5T"],["Net Assets","3.25B"],["Volume","12.5M"],["Avg. Volume","12K"],["Open","100abc"]]),"NVDA");
        expect(result.fields.market_cap.value).toBe(4.5e12); expect(result.fields.net_assets.value).toBe(3.25e9); expect(result.fields.volume.value).toBe(12.5e6); expect(result.fields.average_volume.value).toBe(12000); expect(result.fields.open.value).toBeNull();
    });
});

describe("regular and extended-session quotes", () => {
    const regularTime = 1794430800, postTime = regularTime + 3600;
    const sessions = (changes = {}, source = "Public quote page") => D.quoteSessions({ symbol: "NVDA", currency: "USD", marketState: "POST", regularMarketPrice: 173.73, regularMarketTime: regularTime,
        postMarketPrice: { raw: 158.78 }, postMarketTime: postTime, postMarketChange: { raw: -14.949997 }, postMarketChangePercent: { raw: -0.08605306 }, ...changes }, source);
    const chart = (changes = {}) => ({ ok: true, symbol: "NVDA", currency: "USD", price: 173.73, quoteTime: new Date(regularTime * 1000).toISOString(), quoteSessions: sessions({ marketState: null, postMarketPrice: null }, "Yahoo Chart API"), ...changes });
    const details = (changes = {}) => ({ ok: true, symbol: "NVDA", quoteSessions: sessions(changes) });
    it("keeps the chart's price and history regular even when explicit extended quotes exist", () => {
        const data = clone(); Object.assign(data.chart.result[0].meta, { marketState: "POST", postMarketPrice: 158.78, postMarketTime: postTime, postMarketChangePercent: -8.605306 });
        const parsed = D.parseChart(data, "NVDA");
        expect(parsed.price).toBe(173.73); expect(parsed.regularPrice).toBe(173.73); expect(parsed.regularQuoteTime).toBe(parsed.quoteTime);
        expect(parsed.history).toEqual(D.parseChart(captured, "NVDA").history);
        expect(parsed.quoteSessions.post).toMatchObject({ price: 158.78, quoteTime: new Date(postTime * 1000).toISOString(), changeFraction: -0.08605306 });
        expect(D.selectQuote(parsed).session).toBe("After-hours");
    });
    it("does not treat untimed fulldayPrice as an extended-session quote", () => {
        const parsed = D.parseChart(captured, "NVDA"); expect(parsed.quoteSessions.post.price).toBeNull(); expect(D.selectQuote(parsed)).toMatchObject({ price: 173.73, session: "Regular" });
    });
    it.each(["POST", "POSTPOST", "OVERNIGHT", "CLOSED"])("selects the latest published post quote for provider state %s", marketState => {
        const result = D.selectQuote(chart(), details({ marketState }));
        expect(result).toMatchObject({ price: 158.78, session: "After-hours", selectedSession: "post", marketState, changeFraction: -0.08605306 });
        expect(result.regular.price).toBe(173.73); expect(result.quoteTime).toBe(new Date(postTime * 1000).toISOString());
    });
    it.each(["PRE", "PREPRE"])("selects a newer pre-market quote for provider state %s", marketState => {
        const result = D.selectQuote(chart(), details({ marketState, preMarketPrice: 174, preMarketTime: postTime + 86400 }));
        expect(result).toMatchObject({ price: 174, session: "Pre-market", marketState });
    });
    it("keeps regular quotes during the regular session and unknown states", () => {
        for (const marketState of ["REGULAR", "UNRECOGNIZED", "=1+1", null]) expect(D.selectQuote(chart(), details({ marketState }))).toMatchObject({ price: 173.73, session: "Regular" });
    });
    it("does not promote an old after-hours quote after a newer regular session", () => {
        const result = D.selectQuote(chart(), details({ postMarketTime: regularTime - 3600, regularMarketTime: regularTime - 86400 }));
        expect(result).toMatchObject({ price: 173.73, session: "Regular", marketState: null });
        expect(result.post).toMatchObject({ price: 158.78, status: "Older than regular quote" });
    });
    it.each([null, "1794434400", 0, -1, 1.5, Infinity, 253402300800])("does not accept extended prices with missing or malformed timestamps (%s)", postMarketTime => {
        const result = D.selectQuote(chart(), details({ postMarketTime })); expect(result.post.price).toBeNull(); expect(result).toMatchObject({ price: 173.73, session: "Regular" });
    });
    it.each([null, 0, -1, Infinity, "158.78", { fmt: "158.78" }])("does not convert missing or malformed extended prices to zero (%#)", postMarketPrice => {
        const result = D.selectQuote(chart(), details({ postMarketPrice })); expect(result.post.price).toBeNull(); expect(result.session).toBe("Regular");
    });
    it("preserves zero extended-session changes", () => {
        const result = D.selectQuote(chart(), details({ postMarketPrice: 173.73, postMarketChange: { raw: 0 }, postMarketChangePercent: { raw: 0 } }));
        expect(result).toMatchObject({ price: 173.73, change: 0, changeFraction: 0 });
    });
    it("rejects another ticker or currency while preserving the matching regular quote", () => {
        const other = details(); other.symbol = "AAPL"; expect(D.selectQuote(chart(), other).session).toBe("Regular");
        other.symbol = "NVDA"; other.quoteSessions.symbol = "AAPL"; expect(D.selectQuote(chart(), other).session).toBe("Regular");
        other.quoteSessions.symbol = "NVDA"; other.quoteSessions.currency = "CAD"; expect(D.selectQuote(chart(), other).session).toBe("Regular");
    });
    it("rejects conflicting same-time regular prices and extended state declarations", () => {
        const base = chart(), conflicting = details({ regularMarketPrice: 190 });
        expect(D.selectQuote(base, conflicting).regular.status).toBe("Conflicting same-time quotes");
        base.quoteSessions = sessions({ marketState: "REGULAR" });
        expect(D.selectQuote(base, details()).marketState).toBeNull(); expect(D.selectQuote(base, details()).session).toBe("Regular");
    });
    it("allows float-rounding noise without accepting materially different prices", () => {
        expect(D.selectQuote(chart(), details({ regularMarketPrice: 173.72999572753906 })).regular.price).toBe(173.73);
    });
    it("retains an explicit regular price when its time is unavailable, without promoting an extended quote", () => {
        const base = chart({ quoteTime: null }); delete base.quoteSessions;
        expect(D.selectQuote(base, details({ regularMarketTime: null }))).toMatchObject({ price: 173.73, quoteTime: null, session: "Regular" });
    });
});

describe("price indicators and adjusted returns", () => {
    it("starts SMA values only after their full warm-up windows", () => {
        const result=D.calculate(bars(Array.from({length:210},(_,i)=>i+1)));
        expect(result.series[18].sma20).toBeNull(); expect(result.series[19].sma20).toBe(10.5);
        expect(result.series[49].sma50).toBe(25.5); expect(result.series[199].sma200).toBe(100.5);
        expect(result.summary.sma200).toBe(110.5); expect(result.summary.rsi14).toBe(100);
        expect(result.series[25].macd).toBeCloseTo(7); expect(result.series[32].macdSignal).toBeNull(); expect(result.series[33].macdSignal).toBeCloseTo(7);
    });
    it("matches Wilder's published fourteen-period RSI seed and smoothing example", () => {
        const close=[44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28,46.00,46.03];
        const rows=D.calculate(bars(close)).series;
        expect(rows[13].rsi14).toBeNull(); expect(rows[14].rsi14).toBeCloseTo(70.464135,5);
        expect(rows[15].rsi14).toBeCloseTo(66.249619,5); expect(rows[16].rsi14).toBeCloseTo(66.480942,5);
    });
    it("uses RSI50 for a flat series and RSI0 for a falling series", () => {
        expect(D.calculate(bars(Array(30).fill(100))).summary.rsi14).toBe(50);
        expect(D.calculate(bars(Array.from({length:30},(_,i)=>100-i))).summary.rsi14).toBe(0);
    });
    it("separates adjusted returns from raw-close indicators across a split", () => {
        const result=D.calculate(bars([100,102,51,52],[50,51,51,52]));
        expect(result.summary.returnSinceStart).toBeCloseTo(.04); expect(result.series[2].return1d).toBe(0);
        expect(result.summary.maxDrawdown).toBe(0); expect(result.summary.returnBasis).toBe("Adjusted close"); expect(result.summary.indicatorBasis).toBe("Raw close");
    });
    it("calculates sample log-return volatility and observed adjusted max drawdown", () => {
        const prices=Array.from({length:21},(_,i)=>Math.exp((i%2)*.01+i*.001));
        const logs=prices.slice(1).map((p,i)=>Math.log(p/prices[i])); const mean=logs.reduce((a,b)=>a+b)/20;
        const expected=Math.sqrt(logs.reduce((a,b)=>a+(b-mean)**2,0)/19)*Math.sqrt(252);
        expect(D.calculate(bars(prices)).summary.volatility20d).toBeCloseTo(expected,12);
        expect(D.calculate(bars([100,120,90,110])).summary.maxDrawdown).toBeCloseTo(-.25);
    });
    it("resets raw indicator warmups across missing data and keeps returns missing", () => {
        const values=Array(40).fill(100); values[25]=null;
        const result=D.calculate(bars(values)); expect(result.series[25].sma20).toBeNull(); expect(result.series[26].rsi14).toBeNull(); expect(result.summary.sma20).toBeNull();
        expect(result.series[25].return1d).toBeNull(); expect(result.series[26].return1d).toBeNull(); expect(result.summary.maxDrawdown).toBeNull(); expect(result.summary.volatility20d).toBeNull();
    });
    it("summarizes captured history through its latest published close while retaining an incomplete current bar", () => {
        const history = D.parseChart(captured,"NVDA").history;
        const before = D.calculate(history);
        const prior = history.at(-1);
        const nextDate = new Date((prior.epoch + 86400) * 1000).toISOString().slice(0,10);
        const incomplete = { ...prior, date:nextDate, epoch:prior.epoch+86400, open:180, high:190, low:175, close:null, adjustedClose:null, volume:999999999 };
        const after = D.calculate([...history,incomplete]);
        expect(after.summary).toEqual(before.summary);
        expect(after.summary.historyEnd).toBe(prior.date); expect(after.summary.indicatorAsOf).toBe(prior.date);
        expect(after.summary.rsi14).not.toBeNull(); expect(after.summary.sma20).not.toBeNull(); expect(after.summary.return1d).not.toBeNull();
        expect(after.series).toHaveLength(history.length+1); expect(after.series.at(-1)).toMatchObject({date:nextDate,close:null,adjustedClose:null,rsi14:null,sma20:null,volume:999999999});
        expect(after.series.slice(0,-1)).toEqual(before.series);
    });
    it("keeps an interior missing close missing even when a trailing incomplete bar is excluded", () => {
        const values=Array(40).fill(100); values[25]=null;
        const before=D.calculate(bars(values));
        const after=D.calculate([...bars(values),{date:"2025-02-10",close:null,adjustedClose:null,volume:5000}]);
        expect(after.summary).toEqual(before.summary); expect(after.summary.sma20).toBeNull(); expect(after.summary.maxDrawdown).toBeNull(); expect(after.summary.volatility20d).toBeNull();
    });
    it("has no published indicator date when every close is unavailable", () => {
        const result=D.calculate(bars([null,null],[null,null]));
        expect(result.summary).toMatchObject({barCount:0,historyEnd:null,indicatorAsOf:null,price:null,return1d:null,maxDrawdown:null}); expect(result.series).toHaveLength(2);
    });
    it("does not substitute raw prices when adjusted values are absent", () => {
        const result=D.calculate(bars([100,101,102],[null,null,null]));
        expect(result.summary.return1d).toBeNull(); expect(result.summary.returnSinceStart).toBeNull(); expect(result.summary.maxDrawdown).toBeNull();
    });
    it("uses the last prior-year adjusted close for YTD", () => {
        const history=[{date:"2025-12-30",close:80,adjustedClose:80},{date:"2025-12-31",close:100,adjustedClose:100},{date:"2026-01-02",close:110,adjustedClose:110}];
        expect(D.calculate(history).summary.returnYtd).toBeCloseTo(.1);
    });
    it("returns empty summaries without inventing a price or zero performance", () => {
        const result=D.calculate([]); expect(result.series).toEqual([]); expect(result.summary.price).toBeNull(); expect(result.summary.returnSinceStart).toBeNull(); expect(result.summary.maxDrawdown).toBeNull();
        expect(()=>D.calculate(null)).toThrow();
    });
    it("aligns benchmark observations by matching dates and adjusted prices", () => {
        const a=bars([10,12,15]),b=bars([20,22,24]); b.splice(1,1);
        const result=D.compare(a,b); expect(result.series).toHaveLength(2); expect(result.stockReturn).toBeCloseTo(.5); expect(result.benchmarkReturn).toBeCloseTo(.2); expect(result.relativeReturn).toBeCloseTo(.25);
        expect(D.compare(a,[])).toMatchObject({series:[],stockReturn:null,benchmarkReturn:null,relativeReturn:null});
    });
});
