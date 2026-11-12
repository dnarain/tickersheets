import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CFAnalysisSheets as S } from "../src/CacheFinanceAnalysisSheets.js";
import { CFAnalysisData } from "../src/CacheFinanceAnalysisData.js";

const names=["CF Analysis","CF Price history","CF Fundamentals","CF Earnings","CF Options","CF Macro","CF Sources"];
const marker="CACHEFINANCE_ANALYSIS_V1";
const column = text => [...text].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
class Range {
    constructor(sheet,row,col,height=1,width=1){Object.assign(this,{sheet,row,col,height,width});}
    each(fn){for(let i=0;i<this.height;i++)for(let j=0;j<this.width;j++)fn(this.row+i,this.col+j);return this;}
    setValues(values){expect(values).toHaveLength(this.height);values.forEach(row=>expect(row).toHaveLength(this.width));values.forEach((row,i)=>row.forEach((v,j)=>this.sheet.cells.set(`${this.row+i},${this.col+j}`,v)));this.sheet.events.push({kind:"values",row:this.row,col:this.col,height:this.height,width:this.width});return this;}
    getValues(){return Array.from({length:this.height},(_,i)=>Array.from({length:this.width},(_,j)=>this.sheet.cells.get(`${this.row+i},${this.col+j}`)??""));}
    setValue(value){this.each((r,c)=>this.sheet.cells.set(`${r},${c}`,value));this.sheet.onValue?.(this,value);return this;}
    getValue(){return this.getValues()[0][0];}
    clear(){this.each((r,c)=>{this.sheet.cells.delete(`${r},${c}`);this.sheet.styles.delete(`${r},${c}`);});this.sheet.onClear?.(this);return this;}
    clearContent(){this.each((r,c)=>this.sheet.cells.delete(`${r},${c}`));this.sheet.onClear?.(this);return this;}
    setDataValidation(rule){return this.each((r,c)=>this.sheet.validations.set(`${r},${c}`,rule));}
    getDataValidation(){return this.sheet.validations.get(`${this.row},${this.col}`)||null;}
    clearDataValidations(){return this.each((r,c)=>this.sheet.validations.delete(`${r},${c}`));}
    breakApart(){return this;}
    merge(){return this;}
    setNumberFormat(value){const spec={row:this.row,col:this.col,height:this.height,width:this.width,value};this.sheet.formats.push(spec);this.sheet.events.push({kind:"format",...spec});return this;}
    style(key,value){return this.each((r,c)=>{const id=`${r},${c}`;this.sheet.styles.set(id,{...(this.sheet.styles.get(id)||{}),[key]:value});});}
    setFontFamily(){return this;}setFontSize(){return this;}setVerticalAlignment(){return this;}setFontWeight(value){return this.style("weight",value);}setFontColor(value){return this.style("color",value);}setBackground(value){return this.style("background",value);}setWrap(value){return this.style("wrap",value);}
}
class Sheet {
    constructor(name){this.name=name;this.cells=new Map();this.charts=[];this.formats=[];this.events=[];this.styles=new Map();this.validations=new Map();this.rowHeights=new Map();this.maxRows=1000;this.maxCols=26;this.hidden=[];this.insertedRows=0;}
    getName(){return this.name;}getMaxRows(){return this.maxRows;}getMaxColumns(){return this.maxCols;}
    getLastRow(){return Math.max(0,...[...this.cells].filter(([,v])=>v!=="").map(([key])=>Number(key.split(",")[0])));}
    getRange(a,b,h=1,w=1){if(typeof a==="number")return new Range(this,a,b,h,w);const m=a.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);if(!m)throw new Error("Unsupported test range:"+a);return new Range(this,Number(m[2]),column(m[1]),m[4]?Number(m[4])-Number(m[2])+1:1,m[3]?column(m[3])-column(m[1])+1:1);}
    getRangeList(ranges){return {setNumberFormat:value=>ranges.forEach(range=>this.getRange(range).setNumberFormat(value)),clear:()=>ranges.forEach(range=>this.getRange(range).clear()),clearContent:()=>ranges.forEach(range=>this.getRange(range).clearContent())};}
    insertRowsAfter(_row,count){this.maxRows+=count;this.insertedRows+=count;return this;}
    insertColumnsAfter(_column,count){this.maxCols+=count;return this;}
    setHiddenGridlines(value){this.gridHidden=value;return this;}setFrozenRows(value){this.frozen=value;return this;}
    setColumnWidths(){return this;}setColumnWidth(){return this;}setTabColor(){return this;}
    setRowHeight(row,height){this.rowHeights.set(row,height);return this;}
    setRowHeights(start,count,height){for(let i=0;i<count;i++)this.rowHeights.set(start+i,height);return this;}
    hideColumns(value){this.hidden.push(value);return this;}
    getCharts(){return [...this.charts];}removeChart(chart){this.charts.splice(this.charts.indexOf(chart),1);}
    newChart(){const spec={ranges:[],options:{}};const builder={setChartType(v){spec.type=v;return this;},setNumHeaders(v){spec.headers=v;return this;},setPosition(...v){spec.position=v;return this;},setOption(k,v){spec.options[k]=v;return this;},addRange(range){spec.ranges.push(range);return this;},build(){return {spec,getOptions:()=>({get:k=>spec.options[k]})};}};return builder;}
    insertChart(chart){this.charts.push(chart);}
}
class Book {
    constructor(){this.sheets=new Map();this.inserted=[];}
    getSheetByName(name){return this.sheets.get(name)||null;}
    insertSheet(name){const sheet=new Sheet(name);this.sheets.set(name,sheet);this.inserted.push(name);return sheet;}
    getSpreadsheetTimeZone(){return "UTC";}
}
let book;
beforeEach(()=>{book=new Book();vi.stubGlobal("Charts",{ChartType:{LINE:"LINE"}});vi.stubGlobal("Utilities",{parseDate:value=>new Date(value+"T00:00:00Z"),formatDate:value=>value.toISOString().slice(0,10)});vi.stubGlobal("SpreadsheetApp",{newDataValidation:()=>{const spec={};return {requireValueInList(values,dropdown){spec.values=[...values];spec.dropdown=dropdown;return this;},setAllowInvalid(value){spec.allowInvalid=value;return this;},build(){return {...spec,getCriteriaValues:()=>[spec.values],getCriteriaType:()=>"VALUE_IN_LIST"};}};}});});
afterEach(()=>vi.unstubAllGlobals());
function snapshot(ticker="NVDA",length=260){const series=Array.from({length},(_,i)=>({date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),close:100+i,adjustedClose:100+i,open:99+i,high:102+i,low:98+i,volume:1000+i,sma50:i>=49?100+i-24.5:null,sma200:i>=199?100+i-99.5:null,rsi14:i>14?55:null}));return {ticker,symbol:ticker,cacheSymbol:"NASDAQ:"+ticker,fetchedAt:"2026-11-11T23:00:00Z",chart:{name:ticker+" Corporation",currency:"USD",price:359,quoteTime:"2026-11-11T22:00:00Z",history:series,events:{dividends:[{date:"2026-01-01",amount:.01,source:"Yahoo Chart API"}],splits:[]}},technical:{series,summary:{historyEnd:series.at(-1)?.date,price:359,barCount:length,rsi14:55,return1d:.01,sma50:334.5,sma200:259.5}},benchmarks:{SPY:{chart:{history:series.map(r=>({...r,adjustedClose:r.adjustedClose*2}))}},QQQ:{chart:{history:series.map(r=>({...r,adjustedClose:r.adjustedClose*3}))}}},statistics:{fields:{trailing_pe:{label:"P/E",value:20,unit:"ratio",source:"Yahoo Finance website",field:"PE Ratio (TTM)"},dividend_yield:{label:"Yield",value:.01,unit:"fraction",source:"Yahoo Finance website",field:"Yield"}}},details:{name:ticker+" Corp",fields:{market_cap:{label:"Market cap",value:1e12,unit:"currency",source:"https://finance.yahoo.com/quote/"+ticker+"/",field:"price.marketCap.raw"}},earnings:[{period:"Q1 2026",basis:"GAAP",actual:1.25,estimate:1,reportedDate:"2026-02-01",periodEnd:"2026-01-31",currency:"USD",source:"Yahoo Finance website"}],financials:[{period:"2025",frequency:"Annual",basis:"GAAP",revenue:1000,netIncome:200,profitMargin:.2,currency:"USD",source:"Yahoo Finance website"}],estimates:[{period:"Next quarter",basis:"GAAP",epsAverage:1.5,currency:"USD",source:"Yahoo Finance website"}],nextEarnings:{dates:["2026-11-17"],estimated:true}},quoteSources:[{provider:"Google",price:359,yieldFraction:.01,identity:"Matched",quoteTime:null,status:"Available"}],options:{ok:false,error:"Public options endpoint returned HTTP 401.",expirations:[],contracts:[]},fred:[{seriesId:"DGS10",label:"10-year Treasury yield",unit:"Percent",ok:false,status:"KEY_REQUIRED",error:"FRED key required.",observations:[]}],sources:[{provider:"Yahoo Chart",scope:"History",http:200,status:"Available",identity:"Matched",retrievedAt:"2026-11-11T23:00:00Z",quoteTime:"2026-11-11T22:00:00Z",source:"https://query1.finance.yahoo.com/v8/finance/chart/"+ticker,note:"Selected ticker"},{provider:"Options",scope:"Chain",http:401,status:"HTTP_ERROR",note:"No accepted chain.",source:"https://query2.finance.yahoo.com/v7/finance/options/"+ticker}]};}

describe("managed analysis tabs",()=>{
    it("displays the timed after-hours price while retaining regular daily history and indicators", () => {
        S.build(book); const data = snapshot();
        Object.assign(data.chart, { symbol: "NVDA", price: 173.73, quoteTime: "2026-11-11T21:00:00.000Z" });
        Object.assign(data.details, { ok: true, symbol: "NVDA", quoteSessions: CFAnalysisData.quoteSessions({ symbol: "NVDA", currency: "USD", marketState: "OVERNIGHT",
            regularMarketPrice: 173.73, regularMarketTime: 1794430800, postMarketPrice: 158.78, postMarketTime: 1794445200,
            postMarketChange: -14.95, postMarketChangePercent: -.08605306 }, "https://finance.yahoo.com/quote/NVDA/") });
        S.render(book, data); const main = book.getSheetByName("CF Analysis");
        expect(main.getRange("B9").getValue()).toBe(158.78); expect(main.getRange("H6").getValue()).toBe("After-hours");
        expect(main.getRange("B10").getValue().toISOString()).toBe("2026-11-12T01:00:00.000Z");
        expect(main.getRange("H7").getValue()).toBe(-14.95); expect(main.getRange("I7").getValue()).toBeCloseTo(-.08605306);
        expect(main.getRange("D9:I14").getValues().find(row => row[0] === "Yahoo after-hours")[1]).toBe(158.78);
        expect(main.getRange("B16").getValue()).toBe(55); expect(book.getSheetByName("CF Price history").getRange("E8").getValue()).toBe(100);
        expect(S.inspect(book)).toMatchObject({ displayedPrice: 158.78, displayedSession: "After-hours", historyRows: 260 });
    });
    it("never clears either editable B4 during content or formatting cleanup", () => {
        S.build(book);
        const main = book.getSheetByName("CF Analysis"), options = book.getSheetByName("CF Options");
        main.getRange("B4").setValue("AAPL"); options.getRange("B4").setValue("2026-12-18");
        const observed = [];
        for (const sheet of [main, options]) sheet.onClear = () => {
            observed.push([main.getRange("B4").getValue(), options.getRange("B4").getValue()]);
            expect(observed.at(-1)).toEqual(["AAPL", "2026-12-18"]);
        };
        for (const formatting of [false, true]) for (const sheet of [main, options]) S.clear_(sheet, formatting);
        expect(observed).toHaveLength(16);
        expect(main.getRange("Z1").getValue()).toBe(marker); expect(options.getRange("Z1").getValue()).toBe(marker);
    });
    it("clears the loaded ticker first and resets an old expiration only once before clearing other tabs", () => {
        S.build(book); S.render(book, snapshot());
        const main = book.getSheetByName("CF Analysis"), options = book.getSheetByName("CF Options"), source = book.getSheetByName("CF Sources");
        options.getRange("B4").setValue("2026-12-18"); main.getRange("B4").setValue("AAPL");
        const writes = [], states = [], guide = vi.spyOn(S, "guide_");
        options.onValue = (range, value) => { if (range.row === 4 && range.col === 2) writes.push(value); };
        for (const name of names) book.getSheetByName(name).onClear = () => {
            expect(main.getRange("B4").getValue()).toBe("AAPL"); expect(source.getRange("B3").getValue()).toBe("");
            if (name !== "CF Analysis") expect(main.getRange("H4").getValue()).toBe("Ticker changed");
            states.push({ name, expiration: options.getRange("B4").getValue() });
        };
        S.invalidate(book, "Ticker changed");
        expect(writes).toEqual([""]); expect(states.filter(row => row.name === "CF Analysis").every(row => row.expiration === "2026-12-18")).toBe(true);
        expect(states.filter(row => row.name !== "CF Analysis").every(row => row.expiration === "")).toBe(true);
        expect(guide).not.toHaveBeenCalled(); guide.mockRestore();
        expect(S.inspect(book)).toMatchObject({ ticker: "", inputTicker: "AAPL", historyRows: 0, earningsRows: 0, fundamentalRows: 0, optionRows: 0, chartTitles: [] });
    });
    it("preserves the same ticker's selected expiration throughout both invalidation paths", () => {
        S.build(book); S.render(book, snapshot());
        const main = book.getSheetByName("CF Analysis"), options = book.getSheetByName("CF Options");
        options.getRange("B4").setValue("2026-12-18");
        const writes = [];
        options.onValue = (range, value) => { if (range.row === 4 && range.col === 2) writes.push(value); };
        for (const name of names) book.getSheetByName(name).onClear = () => {
            expect(main.getRange("B4").getValue()).toBe("NVDA"); expect(options.getRange("B4").getValue()).toBe("2026-12-18");
        };
        S.invalidate(book, "Refreshing"); S.invalidateOptions(book, "Expiration changed");
        expect(writes).toEqual([]); expect(options.charts).toEqual([]);
    });
    it("creates seven marked tabs, one ticker input and only hides column Z",()=>{const r=S.build(book);expect(r.created).toEqual(names);for(const name of names){const sheet=book.getSheetByName(name);expect(sheet.getRange("Z1").getValue()).toBe(marker);expect(sheet.hidden).toEqual([26]);expect(sheet.gridHidden).toBe(true);}expect(S.readInput(book)).toEqual({ticker:"NVDA",expiration:"",loadedTicker:""});});
    it("preflights every conflicting name before creating or changing any tab",()=>{const user=book.insertSheet("CF Macro");user.getRange("A1").setValue("User data");const initial=[...book.inserted];expect(()=>S.build(book)).toThrow(/not an analysis tab/);expect(book.inserted).toEqual(initial);expect(user.getRange("A1").getValue()).toBe("User data");});
    it("never changes an unrelated sheet",()=>{const user=book.insertSheet("Portfolio");user.getRange("A1").setValue("Private values");S.build(book);S.render(book,snapshot());S.invalidate(book,"Refresh");expect(user.getRange("A1").getValue()).toBe("Private values");expect(user.charts).toEqual([]);});
    it("retains a ticker through rebuild and validates expiration calendar dates",()=>{S.build(book);book.getSheetByName("CF Analysis").getRange("B4").setValue(" aapl ");const option=book.getSheetByName("CF Options");option.getRange("B4").setValue("2026-02-30");expect(S.readInput(book)).toEqual({ticker:"AAPL",expiration:"",loadedTicker:""});option.getRange("B4").setValue("2026-11-20");S.build(book);expect(S.readInput(book)).toEqual({ticker:"AAPL",expiration:"2026-11-20",loadedTicker:""});});
    it("refuses a stale snapshot before clearing current data",()=>{S.build(book);const main=book.getSheetByName("CF Analysis");main.getRange("B4").setValue("AAPL");main.getRange("B9").setValue(123);expect(()=>S.render(book,snapshot("NVDA"))).toThrow(/ticker changed/);expect(main.getRange("B9").getValue()).toBe(123);});
});

function atmOptions(legs = [{ type: "Call", iv: .4 }, { type: "Put", iv: .6 }]) {
    return { ok: true, symbol: "NVDA", underlyingPrice: 359, expirations: ["2026-11-20", "2026-12-18"], contracts: legs.map(leg => {
        const expiration = leg.expiration || "2026-11-20", strike = leg.strike ?? 360;
        return { expiration, type: leg.type, strike, bid: 1, ask: 2,
            contractSymbol: "NVDA" + expiration.slice(2).replace(/-/g, "") + (leg.type.toUpperCase() === "CALL" ? "C" : "P") + String(strike * 1000).padStart(8, "0"), ...leg };
    }) };
}

describe("analysis rendering",()=>{
    it.each([
        ["zero IV", [{ type: "Call", iv: 0 }, { type: "Put", iv: .6 }]],
        ["crossed bid/ask", [{ type: "Call", iv: .4, bid: 3, ask: 2 }, { type: "Put", iv: .6 }]],
        ["zero ask", [{ type: "Call", iv: .4, bid: 0, ask: 0 }, { type: "Put", iv: .6 }]],
        ["missing bid", [{ type: "Call", iv: .4, bid: null }, { type: "Put", iv: .6 }]],
        ["missing put", [{ type: "Call", iv: .4 }]],
        ["different strikes", [{ type: "Call", iv: .4 }, { type: "Put", strike: 365, iv: .6 }]],
        ["different expiration", [{ type: "Call", iv: .4 }, { type: "Put", expiration: "2026-12-18", iv: .6 }]],
        ["wrong contract identity", [{ type: "Call", iv: .4, contractSymbol: "AAPL261120C00360000" }, { type: "Put", iv: .6 }]]
    ])("keeps overview ATM IV unavailable for %s", (_reason, legs) => {
        S.build(book); const data = snapshot(); data.options = atmOptions(legs); S.render(book, data);
        const main = book.getSheetByName("CF Analysis");
        expect(main.getRange("E24").getValue()).toBe("N/A");
        expect(main.getRange("F24").getValue()).toBe("No accepted same-strike call/put IV");
    });
    it("accepts positive paired IV with zero bid and positive ask", () => {
        S.build(book); const data = snapshot();
        data.options = atmOptions([{ type: "Call", iv: .4, bid: 0, ask: 1 }, { type: "Put", iv: .6 }]);
        S.render(book, data);
        expect(book.getSheetByName("CF Analysis").getRange("E24").getValue()).toBe(.5);
        expect(book.getSheetByName("CF Analysis").getRange("F24").getValue()).toBe("2026-11-20; strike 360; call/put mean");
    });
    it("does not substitute a stock quote when the option underlying price is unavailable", () => {
        S.build(book); const data = snapshot(); data.options = atmOptions(); data.options.underlyingPrice = null;
        S.render(book, data);
        expect(book.getSheetByName("CF Analysis").getRange("E24").getValue()).toBe("N/A");
    });
    it("shows a failed quote refresh without a success status", () => {
        S.build(book);
        const data = snapshot(); data.ok = false;
        S.render(book, data);
        expect(book.getSheetByName("CF Analysis").getRange("H4").getValue()).toBe("No matching quote data. Check the ticker and CF Sources.");
    });
    it("reports native model formula errors separately from unavailable source values", () => {
        S.build(book); S.render(book, snapshot());
        const options = book.getSheetByName("CF Options");
        options.getRange("S4").setValue("#REF!"); options.getRange("S5").setValue("N/A");
        const report = S.inspect(book);
        expect(report.model.price).toBe("#REF!");
        expect(report.formulaErrors).toEqual([{ sheet: "CF Options", range: "S4:S16", rowOffset: 0, columnOffset: 0, value: "#REF!" }]);
    });
    it("writes typed data, three current-ticker charts and independently counted sections",()=>{S.build(book);const result=S.render(book,snapshot());expect(result).toMatchObject({ticker:"NVDA",symbol:"NVDA",historyRows:260,earningsRows:1,fundamentalRows:3,optionRows:0});expect(result.chartTitles).toHaveLength(3);expect(result.chartTitles.every(title=>title.includes("NVDA"))).toBe(true);expect(result.errors).toEqual([{provider:"Options",status:"HTTP_ERROR",note:"No accepted chain."}]);const h=book.getSheetByName("CF Price history");expect(h.getRange("A8").getValue()).toBeInstanceOf(Date);expect(h.getRange("E8").getValue()).toBe(100);expect(h.getRange("I8").getValue()).toBe("");expect(book.getSheetByName("CF Analysis").getRange("B9").getValue()).toBe(359);});
    it("charts exactly126recentbars without treating the first bar as a header",()=>{S.build(book);S.render(book,snapshot());const first=book.getSheetByName("CF Analysis").charts[0].spec;expect(first.headers).toBe(0);expect(first.ranges.every(range=>range.height===126)).toBe(true);expect(first.options.series[0].labelInLegend).toBe("Yahoo close");expect(first.options.interpolateNulls).toBe(false);});
    it("updates all visible sheet titles and chart titles when switching ticker",()=>{S.build(book);S.render(book,snapshot());book.getSheetByName("CF Analysis").getRange("B4").setValue("AAPL");S.invalidate(book,"Ticker changed");expect(S.inspect(book)).toMatchObject({ticker:"",inputTicker:"AAPL",historyRows:0,earningsRows:0,fundamentalRows:0,optionRows:0,chartTitles:[]});for(const name of names)expect(book.getSheetByName(name).getRange("A1").getValue()).toContain("AAPL");const result=S.render(book,snapshot("AAPL"));expect(result.chartTitles.every(title=>title.includes("AAPL")&&!title.includes("NVDA"))).toBe(true);});
    it("clears failed-refresh values instead of retaining the previous ticker's numbers",()=>{S.build(book);S.render(book,snapshot());S.invalidate(book,"Refreshing…");const failure=snapshot();failure.chart={ok:false,error:"Missing"};failure.technical={series:[],summary:{}};failure.details={fields:{},earnings:[],financials:[],estimates:[]};failure.statistics={fields:{}};const r=S.render(book,failure);expect(r.historyRows).toBe(0);expect(r.chartTitles).toEqual([]);expect(book.getSheetByName("CF Analysis").getRange("B9").getValue()).toBe("N/A");});
    it("escapes remote formula-leading strings and never writes authenticated source URLs",()=>{S.build(book);const data=snapshot();data.chart.name='=IMPORTXML("https://evil.test")';data.details.earnings[0].period="+1+1";data.details.nextEarnings.dates=["=1+1"];data.details.fields.market_cap.source="https://provider.test/path?api_key=secret-key#fragment";data.sources[0].source="https://user:password@provider.test/path";S.render(book,data);expect(book.getSheetByName("CF Analysis").getRange("E5").getValue()).toBe("'"+data.chart.name);expect(book.getSheetByName("CF Earnings").getRange("A8").getValue()).toBe("'+1+1");expect(book.getSheetByName("CF Earnings").getRange("B4").getValue()).toBe("'=1+1");const cells=[...book.sheets.values()].flatMap(s=>[...s.cells.values()]).filter(v=>typeof v==='string');expect(cells.some(s=>s.includes("secret-key")||s.includes("password"))).toBe(false);});
    it("merges structured fundamentals over quote-row fallback without replacing a valid fallback with null",()=>{S.build(book);const data=snapshot();data.details.fields.trailing_pe={label:"Structured PE",value:22,unit:"ratio",source:"Yahoo",field:"trailingPE.raw"};data.details.fields.dividend_yield={label:"No rich yield",value:null};data.details.fields.market_cap.currency="EUR";S.render(book,data);const rows=book.getSheetByName("CF Fundamentals").getRange(8,1,3,6).getValues();expect(rows[0].slice(0,2)).toEqual(["Structured PE",22]);expect(rows[1].slice(0,2)).toEqual(["Yield",.01]);expect(rows[0][3]).toBe("");expect(rows[1][3]).toBe("");expect(rows[2][3]).toBe("EUR");});
    it("keeps one-expiration options and refreshes only its generated data on expiry change",()=>{S.build(book);const data=snapshot();data.options={ok:true,expirations:["2026-11-20","2026-12-18"],contracts:[{expiration:"2026-11-20",type:"Call",strike:100,bid:1,ask:2,mid:1.5,iv:.5,volume:0,openInterest:20,lastTrade:"2026-11-11T20:00:00Z",inTheMoney:true}]};S.render(book,data);expect(S.inspect(book).optionRows).toBe(1);const sheet=book.getSheetByName("CF Options");sheet.getRange("B4").setValue("2026-12-18");S.invalidateOptions(book,"Refresh options");expect(S.readInput(book).expiration).toBe("2026-12-18");expect(S.inspect(book).optionRows).toBe(0);expect(S.inspect(book).historyRows).toBe(260);});
    it("resets an old ticker's selected expiration immediately",()=>{S.build(book);S.render(book,snapshot());book.getSheetByName("CF Options").getRange("B4").setValue("2026-11-20");book.getSheetByName("CF Analysis").getRange("B4").setValue("AAPL");S.invalidate(book,"Changed ticker");expect(S.readInput(book).expiration).toBe("");});
    it("preserves a valid selected expiration during a same-ticker refresh",()=>{S.build(book);S.render(book,snapshot());book.getSheetByName("CF Options").getRange("B4").setValue("2026-11-20");S.invalidate(book,"Refreshing");expect(S.readInput(book).expiration).toBe("2026-11-20");});
    it("clears a leftover expiry after a failed refresh leaves no loaded ticker",()=>{S.build(book);book.getSheetByName("CF Options").getRange("B4").setValue("2026-11-20");expect(S.readInput(book).loadedTicker).toBe("");S.invalidate(book,"Retrying failed refresh");expect(S.readInput(book).expiration).toBe("");});
    it("leaves missing FRED observations blank and keeps rate levels as published percentages",()=>{S.build(book);const data=snapshot();data.fred=[{seriesId:"DGS10",label:"10-year Treasury yield",unit:"Percent",ok:true,status:"Available",latest:{date:"2026-11-10",value:4.25},change:.02,observations:[{date:"2026-11-09",value:null},{date:"2026-11-10",value:4.25}],source:"https://fred.stlouisfed.org/series/DGS10"}];S.render(book,data);const macro=book.getSheetByName("CF Macro");expect(macro.getRange("D8").getValue()).toBe(4.25);expect(macro.getRange("B16").getValue()).toBe("N/A");expect(macro.getRange("B17").getValue()).toBe(4.25);});
    it("grows source sheets for four macro histories without touching ownership markers",()=>{S.build(book);const data=snapshot();data.fred=Array.from({length:4},(_,i)=>({seriesId:String(i),label:"Series "+i,unit:"Index",observations:Array.from({length:400},()=>({date:"2026-01-01",value:1}))}));S.render(book,data);const macro=book.getSheetByName("CF Macro");expect(macro.insertedRows).toBeGreaterThan(0);expect(macro.getRange("Z1").getValue()).toBe(marker);});
    it("reports status without reading keys or requesting any external service",()=>{S.build(book);S.status(book,"Waiting");expect(book.getSheetByName("CF Analysis").getRange("H4").getValue()).toBe("Waiting");});
    it("shows company fields, an estimated earnings date and same-strike mean ATM IV without inventing missing metrics",()=>{S.build(book);const data=snapshot();data.options=atmOptions([{type:"Call",strike:360,iv:.4},{type:"Put",strike:360,iv:.6},{type:"Call",strike:100,iv:.99}]);S.render(book,data);const main=book.getSheetByName("CF Analysis");expect(main.getRange("E16").getValue()).toBe(1e12);expect(main.getRange("E17").getValue()).toBe(20);expect(main.getRange("E18").getValue()).toBe("N/A");expect(main.getRange("E19").getValue()).toBe(.01);expect(main.getRange("E20").getValue()).toBe("N/A");expect(main.getRange("E21").getValue()).toBeInstanceOf(Date);expect(main.getRange("F21").getValue()).toBe("Estimated");expect(main.getRange("E22").getValue()).toBe(3);expect(main.getRange("E23").getValue()).toBeInstanceOf(Date);expect(main.getRange("E24").getValue()).toBe(.5);expect(main.formats.some(f=>f.row===4&&f.col===5&&f.value==="mmm d, hh:mm")).toBe(true);});
    it("selects the nearest two hundred contracts, then displays them in strike order for one expiry",()=>{S.build(book);const data=snapshot();data.options={ok:true,underlyingPrice:300,expirations:["2026-11-20","2026-12-18"],contracts:[...Array.from({length:400},(_,i)=>({expiration:"2026-11-20",type:i%2?"Call":"Put",strike:i+1,iv:.5})),{expiration:"2026-12-18",type:"Call",strike:300,iv:.99}]};S.render(book,data);const option=book.getSheetByName("CF Options");const strikes=option.getRange(9,3,200,1).getValues().flat();expect(strikes[0]).toBe(200);expect(strikes.at(-1)).toBe(399);expect(strikes).toEqual([...strikes].sort((a,b)=>a-b));expect(option.getRange("A6").getValue()).toContain("Showing 200 of 400 contracts for selected expiry 2026-11-20");expect(book.getSheetByName("CF Analysis").getRange("E22").getValue()).toBe(400);expect(S.inspect(book).optionRows).toBe(200);});
    it("keeps ATM IV missing when the nearest strike has no IV and labels local-currency benchmark growth",()=>{S.build(book);const data=snapshot();data.chart.currency="CAD";data.options=atmOptions([{type:"Call",strike:360,iv:null},{type:"Put",strike:360,iv:.6},{type:"Call",strike:100,iv:.9},{type:"Put",strike:100,iv:.9}]);const result=S.render(book,data);expect(book.getSheetByName("CF Analysis").getRange("E24").getValue()).toBe("N/A");expect(result.chartTitles.some(title=>title.includes("adjusted growth (local currencies)"))).toBe(true);expect([...book.getSheetByName("CF Sources").cells.values()].some(value=>typeof value==="string"&&value.includes("No FX conversion is applied"))).toBe(true);});
    it("publishes an actual expiration dropdown, preserves the selected date and keeps row four compact",()=>{S.build(book);const data=snapshot();const dates=["2026-11-20","2026-12-18"];data.options={ok:true,expirations:dates,contracts:[]};const options=book.getSheetByName("CF Options");options.getRange("B4").setValue(dates[1]);S.render(book,data);const cell=options.getRange("B4"),rule=cell.getDataValidation();expect(rule.getCriteriaValues()).toEqual([dates]);expect(rule.getCriteriaType()).toBe("VALUE_IN_LIST");expect(rule.dropdown).toBe(true);expect(rule.allowInvalid).toBe(false);expect(cell.getValue()).toBe(dates[1]);expect(options.getRange("D4").getValue()).toBe("Dates available");expect(options.getRange("E4").getValue()).toBe(2);expect(options.rowHeights.get(4)).toBe(24);expect(options.formats.some(f=>f.row===4&&f.col===2&&f.value==="@")).toBe(true);});
    it("clears stale expiration validation when no dates are available or ticker data is invalidated",()=>{S.build(book);const data=snapshot();data.options={ok:true,expirations:["2026-11-20"],contracts:[]};S.render(book,data);const cell=book.getSheetByName("CF Options").getRange("B4");expect(cell.getDataValidation()).not.toBeNull();S.invalidateOptions(book,"Changed expiry");expect(cell.getDataValidation()).toBeNull();S.render(book,data);expect(cell.getDataValidation()).not.toBeNull();data.options={ok:false,expirations:[],contracts:[]};S.render(book,data);expect(cell.getDataValidation()).toBeNull();expect(cell.getValue()).toBe("");});
    it("removes old moving headers and tall rows after invalidation shrinks the populated range",()=>{S.build(book);const empty=snapshot();empty.details={fields:{},earnings:[],financials:[],estimates:[]};empty.chart.events={dividends:[],splits:[]};S.render(book,empty);const earnings=book.getSheetByName("CF Earnings");expect(earnings.styles.get("10,1").background).toBe("#17365D");earnings.setRowHeight(10,60);S.invalidate(book,"Retry");expect(earnings.getLastRow()).toBe(2);const data=snapshot();data.details.earnings=Array.from({length:8},(_,i)=>({...data.details.earnings[0],period:"Q"+i}));S.render(book,data);expect(earnings.getRange("A10").getValue()).toBe("Q2");expect(earnings.styles.get("10,1")?.background).not.toBe("#17365D");expect(earnings.styles.get("10,1")?.color).not.toBe("#FFFFFF");expect(earnings.styles.get("10,1")?.weight).not.toBe("bold");expect(earnings.rowHeights.get(10)).toBe(21);expect(earnings.getRange("Z1").getValue()).toBe(marker);expect(book.getSheetByName("CF Options").frozen).toBe(8);expect(book.getSheetByName("CF Analysis").frozen).toBe(8);});
    it("formats published date-text fields as text before writing their values",()=>{S.build(book);const data=snapshot();data.statistics.fields.earnings_date={label:"Earnings date",value:"2026-11-17",display:"Nov 17, 2026",unit:"date text",source:"Yahoo Finance website",field:"Earnings Date"};S.render(book,data);const sheet=book.getSheetByName("CF Fundamentals");const row=sheet.getRange(8,1,10,6).getValues().findIndex(values=>values[0]==="Earnings date")+8;expect(sheet.getRange(row,2).getValue()).toBe("Nov 17, 2026");const textIndex=sheet.events.findIndex(event=>event.kind==="format"&&event.row===row&&event.col===2&&event.value==="@");const writeIndex=sheet.events.findIndex(event=>event.kind==="values"&&event.row===8&&event.col===1);expect(textIndex).toBeGreaterThanOrEqual(0);expect(textIndex).toBeLessThan(writeIndex);const laterNumberFormat=sheet.events.slice(textIndex+1).some(event=>event.kind==="format"&&event.col===2&&event.row<=row&&event.row+event.height>row&&event.value!=="@");expect(laterNumberFormat).toBe(false);});
});
