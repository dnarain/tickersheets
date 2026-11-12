import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CFAnalysisVisuals as V } from "../src/CacheFinanceAnalysisVisuals.js";
import { CFAnalysisDetails } from "../src/CacheFinanceAnalysisDetails.js";

const financial = (period,frequency,basis,revenue,netIncome,profitMargin,currency="USD") => ({period,frequency,basis,revenue,netIncome,profitMargin,currency,source:"https://finance.yahoo.com/quote/NVDA/"});
const eps = (period,basis,actual,estimate,currency="USD") => ({period,basis,actual,estimate,currency,reportedDate:"2026-11-01",source:"Yahoo Finance website"});

describe("earnings research arithmetic",()=>{
    it("keeps small-company amounts and losses visible instead of rounding every amount to billions",()=>{
        expect(V.moneyFormat_(150000)).toBe("#,##0.00"); expect(V.moneyFormat_(-12000000)).toBe('0.00,,"M"');
        expect(V.moneyFormat_(1200000000)).toBe('0.00,,,"B"'); expect(V.moneyFormat_(1200000000000)).toBe('0.00,,,,"T"');
    });
    it("keeps GAAP and adjusted EPS separate and selects the latest reported result",()=>{
        const r=V.summarize({earnings:[eps("4Q2025","GAAP",1,1),eps("1Q2026","GAAP",1.2,1),eps("1Q2026","Adjusted",1.5,1.1),eps("2Q2026","GAAP",null,1.4)]});
        expect(r.earnings).toHaveLength(2);expect(r.earnings.find(r=>r.basis==="GAAP")).toMatchObject({period:"1Q2026",actual:1.2,estimate:1,surprisePct:expect.closeTo(20)});
        expect(r.earnings.find(r=>r.basis==="Adjusted").actual).toBe(1.5);expect(r.earningsGroups.find(r=>r.basis==="GAAP").rows).toHaveLength(3);
    });
    it("does not invent EPS surprise when estimate is zero or unavailable",()=>{
        const r=V.summarize({earnings:[eps("Q1 2026","GAAP",0,0),eps("Q1 2026","Adjusted",1,null)]});
        expect(r.earnings.every(row=>row.surprisePct===null)).toBe(true);expect(r.earnings[0].actual).toBe(0);
    });
    it("preserves a published surprise percentage in percentage points",()=>{const row={...eps("2026Q1","GAAP",1.2,1),surprisePct:19.8};expect(V.summarize({earnings:[row]}).earnings[0].surprisePct).toBe(19.8);});
    it("calculates QoQ across a year boundary with one consistent basis and currency",()=>{
        const r=V.summarize({financials:[financial("4Q2025","Quarterly","GAAP",100,20,.2),financial("1Q2026","Quarterly","GAAP",120,30,.25)]}).financials[0];
        expect(r).toMatchObject({comparison:"QoQ",previousPeriod:"4Q2025",revenueGrowth:expect.closeTo(.2),netIncomeGrowth:expect.closeTo(.5),marginChangePp:expect.closeTo(5)});
    });
    it("calculates annual YoY without mixing quarter or adjusted results",()=>{
        const r=V.summarize({financials:[financial("2024","Annual","GAAP",100,20,.2),financial("FY2025","Annual","GAAP",140,30,.214),financial("1Q2025","Quarterly","GAAP",20,5,.25),financial("2025","Annual","Adjusted",999,888,.8)]});
        expect(r.financials.find(row=>row.basis==="GAAP"&&row.frequency==="Annual")).toMatchObject({revenueGrowth:expect.closeTo(.4),previousPeriod:"2024",comparison:"YoY"});
        expect(r.financials.find(row=>row.basis==="Adjusted").revenueGrowth).toBeNull();
    });
    it("does not call a nonconsecutive quarter QoQ or infer missing quarterly YoY",()=>{
        const r=V.summarize({financials:[financial("1Q2026","Quarterly","GAAP",100,10,.1),financial("3Q2026","Quarterly","GAAP",150,20,.13)]}).financials[0];
        expect(r.previousPeriod).toBeNull();expect(r.revenueGrowth).toBeNull();expect(r.netIncomeGrowth).toBeNull();expect(r.marginChangePp).toBeNull();
    });
    it("never compares currencies or nonpositive income bases",()=>{
        const r=V.summarize({financials:[financial("2024","Annual","GAAP",100,-10,-.1),financial("2025","Annual","GAAP",120,5,.04),financial("2024","Annual","Adjusted",100,10,.1,"CAD"),financial("2025","Annual","Adjusted",120,15,.12,"USD")]});
        expect(r.financials.find(row=>row.basis==="GAAP").netIncomeGrowth).toBeNull();expect(r.financials.filter(row=>row.basis==="Adjusted").every(row=>row.revenueGrowth===null)).toBe(true);
    });
    it("keeps conflicting duplicate EPS and financial periods out of comparisons",()=>{
        const r=V.summarize({earnings:[eps("1Q2026","GAAP",1,1),eps("1Q2026","GAAP",99,1)],financials:[financial("2025","Annual","GAAP",100,20,.2),financial("2025","Annual","GAAP",999,20,.2)]});
        expect(r.earnings).toEqual([]);expect(r.financials).toEqual([]);expect(r.notes).toHaveLength(2);
    });
    it("does not assign chronology to unrecognized periods or growth to missing currency",()=>{
        const r=V.summarize({earnings:[eps("Unknown","GAAP",1,1)],financials:[financial("2024","Annual","GAAP",100,10,.1,""),financial("2025","Annual","GAAP",120,20,.16,"")]});
        expect(r.earningsGroups).toEqual([]);expect(r.financialGroups).toEqual([]);expect(r.financials[0].revenueGrowth).toBeNull();
    });
    it("reads the captured provider fiscal and financial-chart labels without relabeling them",()=>{
        const html=fs.readFileSync(new URL("./fixtures/analysis-details-nvda.html",import.meta.url),"utf8");const details=CFAnalysisDetails.parsePage(html,"NVDA"),r=V.summarize(details);
        expect(r.earnings).toHaveLength(2);expect(r.financialGroups).toHaveLength(4);expect(r.financials.every(row=>row.previousPeriod!==null)).toBe(true);
        expect(r.financials.find(row=>row.frequency==="Quarterly"&&row.basis==="GAAP").period).toBe("2Q2026");
        expect(r.earnings.find(row=>row.basis==="GAAP").period).toBe("2Q2027");
    });
});

const col=s=>[...s].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
class Range{
    constructor(sheet,r,c,h=1,w=1){Object.assign(this,{sheet,row:r,col:c,height:h,width:w});}
    each(fn){for(let i=0;i<this.height;i++)for(let j=0;j<this.width;j++)fn(this.row+i,this.col+j);return this;}
    setValues(rows){expect(rows).toHaveLength(this.height);rows.forEach((row,i)=>{expect(row).toHaveLength(this.width);row.forEach((v,j)=>this.sheet.cells.set(`${this.row+i},${this.col+j}`,v));});return this;}
    getValues(){return Array.from({length:this.height},(_,i)=>Array.from({length:this.width},(_,j)=>this.sheet.cells.get(`${this.row+i},${this.col+j}`)??""));}
    setValue(v){return this.each((r,c)=>this.sheet.cells.set(`${r},${c}`,v));}getValue(){return this.getValues()[0][0];}
    clear(){return this.each((r,c)=>{this.sheet.cells.delete(`${r},${c}`);this.sheet.formats.delete(`${r},${c}`);});}clearContent(){return this.each((r,c)=>this.sheet.cells.delete(`${r},${c}`));}breakApart(){return this;}merge(){return this;}
    setFontFamily(){return this;}setFontSize(){return this;}setFontWeight(){return this;}setFontColor(){return this;}setBackground(){return this;}setNumberFormat(value){return this.each((r,c)=>this.sheet.formats.set(`${r},${c}`,value));}setWrap(){return this;}
}
class Sheet{
    constructor(name){this.name=name;this.cells=new Map();this.formats=new Map();this.maxRows=1000;this.maxCols=26;this.charts=[];this.hidden=[];}
    getName(){return this.name;}getMaxRows(){return this.maxRows;}getMaxColumns(){return this.maxCols;}
    getRange(a,b,h=1,w=1){if(typeof a==="number")return new Range(this,a,b,h,w);const m=a.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);return new Range(this,+m[2],col(m[1]),m[4]?+m[4]-m[2]+1:1,m[3]?col(m[3])-col(m[1])+1:1);}
    getRangeList(values){return{setNumberFormat:v=>values.forEach(a=>this.getRange(a).setNumberFormat(v))};}
    insertRowsAfter(_r,n){this.maxRows+=n;}insertColumnsAfter(_c,n){this.maxCols+=n;}setRowHeights(){}setHiddenGridlines(){}setFrozenRows(value){this.frozen=value;}setColumnWidths(){}setColumnWidth(){}hideColumns(n){this.hidden.push(n);}
    getCharts(){return [...this.charts];}removeChart(c){this.charts.splice(this.charts.indexOf(c),1);}insertChart(c){this.charts.push(c);}
    newChart(){const spec={ranges:[],options:{}};return{setChartType(v){spec.type=v;return this;},setNumHeaders(v){spec.headers=v;return this;},setPosition(...v){spec.position=v;return this;},setOption(k,v){spec.options[k]=v;return this;},addRange(v){spec.ranges.push(v);return this;},build(){return{spec,getOptions:()=>({get:k=>spec.options[k]})};}};}
}
class Book{constructor(){this.sheets=new Map();}getSheetByName(n){return this.sheets.get(n)||null;}insertSheet(n){const s=new Sheet(n);this.sheets.set(n,s);return s;}getSpreadsheetTimeZone(){return"UTC";}}
let book;
beforeEach(()=>{book=new Book();for(const name of["Analysis","Price history","Macro","Options"]){const s=book.insertSheet(name);s.getRange("Z1").setValue("CACHEFINANCE_ANALYSIS_V1");}book.getSheetByName("Analysis").getRange("B4").setValue("NVDA");book.getSheetByName("Options").getRange("B4").setValue("2026-11-20");vi.stubGlobal("Charts",{ChartType:{LINE:"LINE",COLUMN:"COLUMN",COMBO:"COMBO"}});vi.stubGlobal("Utilities",{parseDate:s=>new Date(s+"T00:00:00Z")});});
afterEach(()=>vi.unstubAllGlobals());
function snapshot(){return{ok:true,ticker:"NVDA",fetchedAt:"2026-11-11T23:00:00Z",chart:{price:100,currency:"USD"},technical:{series:Array.from({length:200},(_,i)=>({date:"2026-01-01",close:100+i,volume:1000+i,macd:i<30?null:1,macdSignal:i<39?null:.9,macdHistogram:i<39?null:.1}))},details:{nextEarnings:{dates:["2026-11-17"],estimated:true},earnings:[eps("4Q2025","GAAP",1,1),eps("1Q2026","GAAP",1.2,1),eps("4Q2025","Adjusted",1.1,1),eps("1Q2026","Adjusted",1.3,1.1)],financials:[...['GAAP','Adjusted'].flatMap(basis=>[financial("2024","Annual",basis,100,20,.2),financial("2025","Annual",basis,120,30,.25),financial("4Q2025","Quarterly",basis,20,4,.2),financial("1Q2026","Quarterly",basis,25,6,.24)])]},options:{ok:true,underlyingPrice:100,contracts:[90,100,110].flatMap(strike=>["Call","Put"].map(type=>({expiration:"2026-11-20",type,strike,bid:1,ask:2,iv:.5,openInterest:strike===90?0:20})))},optionMaturities:{rows:[{expiration:"2026-11-20",call:{iv:.5},put:{iv:.6},atmIV:.55},{expiration:"2026-12-18",call:null,put:null,atmIV:null},{expiration:"2027-01-15",call:{iv:.6},put:{iv:.7},atmIV:.65}]},fred:["DGS10","FEDFUNDS","CPIAUCSL","UNRATE"].map(seriesId=>({ok:true,seriesId,label:seriesId,unit:seriesId==="CPIAUCSL"?"Index":"Percent",observations:[{date:"2026-10-01",value:null},{date:"2026-11-01",value:4.25}]}))};}

describe("native research chart rendering",()=>{
    it("keeps the EPS table header outside the frozen context and formats IV chart axes as percentages", () => {
        V.render(book, snapshot()); const research = book.getSheetByName("Research");
        expect(research.frozen).toBe(6);
        const charts = research.charts.filter(chart => /IV by strike|ATM IV by expiration/.test(chart.spec.options.title));
        expect(charts).toHaveLength(2);
        expect(charts.every(chart => chart.spec.options.vAxis.format === "percent")).toBe(true);
        expect(charts[1].spec.ranges[0].getValues()[1][1]).toBe(.5);
        for (const chart of charts) {
            const range = chart.spec.ranges[0];
            for (let row = 1; row < range.height; row++) for (let col = 1; col < range.width; col++) {
                expect(research.formats.get(`${range.row + row},${range.col + col}`)).toBe("0.00%");
            }
            expect(research.formats.get(`${range.row + 1},${range.col}`)).not.toBe("0.00%");
        }
        const epsRange = research.charts.find(chart => chart.spec.options.title.includes("GAAP EPS")).spec.ranges[0];
        expect(research.formats.get(`${epsRange.row + 1},${epsRange.col + 1}`)).toBe("0.00");
    });
    it("invalidates all chart data without resetting formats, merges or row heights", () => {
        V.render(book, snapshot());
        const research = book.getSheetByName("Research");
        research.getRange(research.getMaxRows(), 25).setValue("Old far-end dataset");
        const clear = vi.spyOn(Range.prototype, "clear"), splits = vi.spyOn(Range.prototype, "breakApart"), heights = vi.spyOn(research, "setRowHeights");
        book.getSheetByName("Analysis").getRange("B4").setValue("AAPL");
        V.invalidate(book, "Ticker changed");
        expect(clear).not.toHaveBeenCalled(); expect(splits).not.toHaveBeenCalled(); expect(heights).not.toHaveBeenCalled();
        expect(research.getRange(research.getMaxRows(), 25).getValue()).toBe("");
        expect(research.getRange("B3").getValue()).toBe(""); expect(research.getRange("Z1").getValue()).toBe("CACHEFINANCE_RESEARCH_V1");
        expect(research.getRange("A1").getValue()).toBe("AAPL — Research charts"); expect(research.charts).toEqual([]);
        expect([...research.cells.values()]).toEqual(["CACHEFINANCE_RESEARCH_V1", "AAPL — Research charts", "Ticker changed"]);
        clear.mockRestore(); splits.mockRestore(); heights.mockRestore();
    });
    it("creates owned research charts for current-ticker source data and separate accounting bases",()=>{const r=V.render(book,snapshot());expect(r.ticker).toBe("NVDA");expect(r.summaryRows).toBe(2);expect(r.comparisonRows).toBe(4);expect(r.chartTitles).toHaveLength(15);expect(r.chartTitles.every(t=>t.startsWith("NVDA"))).toBe(true);expect(r.chartTitles.some(t=>t.includes("GAAP EPS"))).toBe(true);expect(r.chartTitles.some(t=>t.includes("Adjusted EPS"))).toBe(true);expect(book.getSheetByName("Research").getRange("Z1").getValue()).toBe("CACHEFINANCE_RESEARCH_V1");});
    it("references native volume/MACD columns and uses a histogram with separate lines",()=>{V.render(book,snapshot());const charts=book.getSheetByName("Research").charts;expect(charts[0].spec.type).toBe("COLUMN");expect(charts[0].spec.ranges.map(r=>r.col)).toEqual([1,7]);expect(charts[0].spec.ranges[0].height).toBe(126);expect(charts[1].spec.type).toBe("COMBO");expect(charts[1].spec.ranges.map(r=>r.col)).toEqual([1,13,14,15]);expect(charts[1].spec.options.series[2].type).toBe("bars");});
    it("keeps native chart ranges on Price history and generated chart ranges on Research", () => {
        V.render(book, snapshot()); const charts = book.getSheetByName("Research").charts;
        expect(charts.slice(0, 2).flatMap(chart => chart.spec.ranges).every(range => range.sheet.getName() === "Price history")).toBe(true);
        expect(charts.slice(2).flatMap(chart => chart.spec.ranges).every(range => range.sheet.getName() === "Research")).toBe(true);
    });
    it("keeps missing FRED and maturity values as chart gaps without scaling rate levels to fractions",()=>{V.render(book,snapshot());const sheet=book.getSheetByName("Research"),fred=sheet.charts.find(c=>c.spec.options.title.includes("FRED DGS10"));const range=fred.spec.ranges[0],values=range.getValues();expect(values[1][1]).toBe("");expect(values[2][1]).toBe(4.25);expect(fred.spec.options.vAxis.title).toBe("Percent");const maturity=sheet.charts.find(c=>c.spec.options.title.includes("ATM IV by expiration"));expect(maturity.spec.ranges[0].getValues()[2].slice(1)).toEqual(["","",""]);expect(maturity.spec.options.interpolateNulls).toBe(false);const rows=V.inspect(book).maturityRows;expect(rows).toHaveLength(3);expect(rows[0].callIV).toBe(.5);expect(rows[1].callIV).toBe("N/A");});
    it("rejects crossed/zero IV quotes but preserves explicit zero open interest",()=>{const o=snapshot().options;o.contracts[0].bid=3;o.contracts[0].ask=2;o.contracts[1].bid=0;o.contracts[1].ask=0;const p=V.optionPivot_(o,"2026-11-20",100);expect(p[0]).toMatchObject({strike:90,callIv:null,putIv:null,callOi:0,putOi:0});});
    it("does not merge another expiration into selected-expiry charts",()=>{const data=snapshot();data.options.contracts.push({expiration:"2027-01-15",type:"Call",strike:100,bid:1,ask:2,iv:.99,openInterest:999});const rows=V.optionPivot_(data.options,"2026-11-20",100);expect(rows[1].callIv).toBe(.5);expect(rows[1].callOi).toBe(20);});
    it("refuses a user-owned research tab before changing any data",()=>{const research=book.insertSheet("Research");research.getRange("A1").setValue("User notes");expect(()=>V.render(book,snapshot())).toThrow(/not managed/);expect(research.getRange("A1").getValue()).toBe("User notes");expect(research.charts).toEqual([]);});
    it("refuses a mismatched ticker before creating the research tab",()=>{book.getSheetByName("Analysis").getRange("B4").setValue("AAPL");expect(()=>V.render(book,snapshot())).toThrow(/ticker changed/);expect(book.getSheetByName("Research")).toBeNull();});
    it("clears all research data/charts on invalidation while preserving marker and unrelated sheets",()=>{const other=book.insertSheet("Portfolio");other.getRange("A1").setValue(123);V.render(book,snapshot());book.getSheetByName("Analysis").getRange("B4").setValue("AAPL");V.invalidate(book,"Changed ticker");const r=V.inspect(book);expect(r).toMatchObject({ticker:"",summaryRows:0,comparisonRows:0,chartTitles:[]});expect(book.getSheetByName("Research").getRange("A1").getValue()).toContain("AAPL");expect(book.getSheetByName("Research").getRange("Z1").getValue()).toBe("CACHEFINANCE_RESEARCH_V1");expect(other.getRange("A1").getValue()).toBe(123);});
    it("does not invent research charts when there is no accepted ticker data",()=>{const r=V.render(book,{ok:false,ticker:"NVDA",technical:{series:[]},details:{},fred:snapshot().fred});expect(r.chartTitles).toEqual([]);expect(r.summaryRows).toBe(0);});
    it("keeps provider statuses separate and escapes remote formula-leading text and private URL query values",()=>{const data=snapshot();data.additionalProviders=[{provider:"Finviz",ok:true,fields:{x:{label:'=HYPERLINK("https://evil.test")',value:1,unit:"ratio",status:"Available",source:"https://finviz.com/quote.ashx?token=private-key"}}},{provider:"Zacks",ok:false,status:"Blocked",fields:{},source:"https://www.zacks.com/"}];V.render(book,data);const strings=[...book.getSheetByName("Research").cells.values()].filter(v=>typeof v==='string');expect(strings).toContain("Blocked");expect(strings.some(v=>v.startsWith("'=HYPERLINK"))).toBe(true);expect(strings.some(v=>v.includes("private-key"))).toBe(false);});
});
