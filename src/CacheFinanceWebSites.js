/*  *** DEBUG START ***
//  Remove comments for testing in NODE

import { SiteThrottle, ThresholdPeriod } from "./CacheFinanceUtils.js";
export { FinanceWebSites, FinanceWebSite, StockAttributes };
export { GlobeAndMail, YahooFinance, YahooApi, FinnHub, AlphaVantage, GoogleWebSiteFinance, TwelveData, CoinMarket };

class Logger {
    static log(msg) {
        console.log(msg);
    }
}
//  *** DEBUG END ***/

/**
 * @classdesc Concrete implementations for each finance website access.
 */
class FinanceWebSites {
    /**
     * All finance website lookup objects should be defined here.
     * All finance Website Objects must implement the method "getInfo(symbol)" 
     * The getInfo() method must return an instance of "StockAttributes"
     */
    constructor() {
        this.siteList = [
            new FinanceWebSite("YahooApi", YahooApi),
            new FinanceWebSite("GoogleWebSiteFinance", GoogleWebSiteFinance),
            new FinanceWebSite("FinnHub", FinnHub),
            new FinanceWebSite("Globe", GlobeAndMail),
            new FinanceWebSite("Yahoo", YahooFinance),
            new FinanceWebSite("TwelveData", TwelveData),
            new FinanceWebSite("AlphaVantage", AlphaVantage),
            new FinanceWebSite("CoinMarket", CoinMarket)
        ];

        /** @property {Map<String, FinanceWebSite>} */
        this.siteMap = new Map();
        for (const site of this.siteList) {
            this.siteMap.set(site.siteName, site);
        }
    }

    /**
     * 
     * @returns {FinanceWebSite[]}
     */
    get() {
        return this.siteList;
    }

    /**
     * Get info for running function to get info about a stock using a specfic service name
     * @param {String} name - Name of search to find object containing class info to make function call.
     * @returns {FinanceWebSite}
     */
    getByName(name) {
        const siteInfo = this.siteMap.get(name.toUpperCase());

        return (siteInfo === undefined) ? null : siteInfo;
    }

    /**
     * 
     * @param {String} symbol 
     * @returns {String}
     */
    static getTickerCountryCode(symbol) {
        let exchange = "";
        let countryCode = "";

        if (symbol.indexOf(":") > 0) {
            const parts = symbol.split(":");
            exchange = parts[0].toUpperCase();
        }

        switch (exchange) {
            case "NASDAQ":
            case "NYSEARCA":
            case "NYSE":
            case "NYSEAMERICAN":
            case "OPRA":
            case "OTCMKTS":
            case "BATS":
                countryCode = "us";
                break;
            case "CVE":
            case "TSE":
            case "TSX":
            case "TSXV":
            case "NEO":
                countryCode = "ca";
                break;
            case "SGX":
                countryCode = "sg";
                break;
            case "CURRENCY":
                countryCode = "fx";
                break;
            case "CF":      //  a Mutual fund
                countryCode = "mut";
                break;
            default:
                countryCode = "ca";     //  We the north!
                break;
        }

        return countryCode;
    }

    /**
    * 
    * @param {String} symbol 
    * @returns {String}
    */
    static getBaseTicker(symbol) {
        let modifiedSymbol = symbol;
        const colon = symbol.indexOf(":");

        if (colon >= 0) {
            const symbolParts = symbol.split(":");

            modifiedSymbol = symbolParts[1];
        }
        return modifiedSymbol;
    }

    /**
     * Get script property using key.  If not found, returns null.
     * @param {String} propertyKey 
     * @returns {any}
     */
    static getApiKey(propertyKey) {
        const scriptProperties = PropertiesService.getScriptProperties();

        const myData = scriptProperties.getProperty(propertyKey);

        return myData;
    }

    /**
     * 
     * @param {String} symbol 
     * @returns {Object}
     */
    static getCurrencyTickers(symbol) {
        const symbolParts = symbol.split(":");
        if (symbolParts.length !== 2 || symbolParts[1].length < 4) {
            return {};
        }

        const fromCurrency = symbolParts[1].substring(0, symbolParts[1].length - 3);
        const toCurrency = symbolParts[1].substring(symbolParts[1].length - 3);

        const currencyCodes = {
            fromCurrency,
            toCurrency
        }

        return currencyCodes;
    }
}

/**
 * @classdesc - defines an instance of an object to perform getInfo(symbol)
 */
class FinanceWebSite {
    /**
     * 
     * @param {String} siteName 
     * @param {object} webSiteJsClass - Points to class for getting finance data.
     */
    constructor(siteName, webSiteJsClass) {
        this.siteName = siteName.toUpperCase();
        this._siteObject = webSiteJsClass;
    }

    set siteName(siteName) {
        this._siteName = siteName;
    }
    get siteName() {
        return this._siteName;
    }

    set siteObject(siteObject) {
        this._siteObject = siteObject;
    }
    get siteObject() {
        return this._siteObject;
    }
}

/**
 * Get/Set data about stocks/ETFs.
 */
class StockAttributes {
    constructor() {
        this._yieldPct = null;
        this._stockName = null;
        this._stockPrice = null;
    }

    get yieldPct() {
        return this._yieldPct;
    }
    set yieldPct(value) {
        if (value !== null) {
            this._yieldPct = Math.round(value * 10000) / 10000;
        }
    }

    get stockPrice() {
        return this._stockPrice;
    }
    set stockPrice(value) {
        if (value !== null) {
            this._stockPrice = Math.round(value * 100) / 100;
        }
    }

    set exchangeRate(value) {
        //  We need 4 decimal places for currency, so setting stockPrice was 
        //  rounding to 2 places - so we have a 'special' price setter for exchange rates.
        if (value !== null) {
            this._stockPrice = Math.round(value * 10000) / 10000;
        }
    }
    get exchangeRate() {
        return this._stockPrice;
    }

    get stockName() {
        return this._stockName;
    }
    set stockName(value) {
        this._stockName = value;
    }

    /**
     * 
     * @param {String} attribute 
     * @returns {any}
     */
    getValue(attribute) {
        switch (attribute) {
            case "PRICE":
                return (this.stockPrice === null) ? '' : this.stockPrice;

            case "YIELDPCT":
                return (this.yieldPct === null) ? '' : this.yieldPct;

            case "NAME":
                return (this.stockName === null) ? '' : this.stockName;

            default:
                return '#N/A';
        }
    }

    /**
     * 
     * @param {String} attribute 
     * @returns {Boolean}
     */
    isAttributeSet(attribute) {
        switch (attribute) {
            case "PRICE":
                {
                    const retVal = this.stockPrice !== null && !Number.isNaN(this.stockPrice) && this.stockPrice !== 0;
                    return retVal;
                }

            case "YIELDPCT":
                return this.yieldPct !== null;

            case "NAME":
                return this.stockName !== null;

            default:
                return false;
        }
    }
}


/**
 * @classdesc Lookup for Yahoo site.
 */
class YahooFinance {
    /**
     * 
     * @param {String} symbol 
     * @param {String} attribute
     * @returns {StockAttributes}
     */
    static getInfo(symbol, attribute) {
        const URL = YahooFinance.getURL(symbol, attribute);

        let html = null;
        try {
            html = UrlFetchApp.fetch(URL).getContentText();
        }
        catch {
            Logger.log(`Yahoo request failed for ${symbol}`);
            return new StockAttributes();
        }

        Logger.log(`getInfo:  ${symbol}.  URL = ${URL}`);

        return YahooFinance.parseResponse(html, symbol);
    }

    /**
     * 
     * @param {String} symbol 
     * @param {String} _attribute
     * @returns {String}
     */
    static getURL(symbol, _attribute) {
        if (FinanceWebSites.getTickerCountryCode(symbol) === "fx") {
            return "";
        }

        return `https://finance.yahoo.com/quote/${YahooFinance.getTicker(symbol)}`;
    }

    /**
     * 
     * @returns {String}
     */
    static getApiKey() {
        return "";
    }

    /**
     * 
     * @param {String} html 
     * @param {String} symbol
     * @returns {StockAttributes}
     */
    static parseResponse(html, symbol) {
        const data = new StockAttributes();
        if (typeof html !== "string" || typeof symbol !== "string" || symbol === "") return data;

        const ticker = YahooFinance.getTicker(symbol);
        const escapedTicker = ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const title = html.match(/<title\b[^>]*>([^<]*)/i);
        const nameMatch = title && YahooFinance.decodeText_(title[1]).trim()
            .match(new RegExp(`^(.+?)\\s*\\(${escapedTicker}\\)(?:\\s|$)`, "i"));
        // Error/consent pages and another ticker's quote page supply no values.
        if (!nameMatch) return data;
        data.stockName = nameMatch[1].trim();

        const quotePrice = html.match(/<section\b[^>]*data-testid=["']quote-price["'][^>]*>([\s\S]*?)<\/section>/i);
        const priceMatch = quotePrice && quotePrice[1].match(/<(?:span|fin-streamer)\b[^>]*(?:data-testid=["']qsp-price["']|class=["'][^"']*\bqsp-price(?:\s[^"']*)?["'])[^>]*>\s*([\d,]+(?:\.\d+)?)/i);
        if (priceMatch) {
            const price = Number(priceMatch[1].replace(/,/g, ""));
            if (Number.isFinite(price) && price > 0) data.stockPrice = price;
        }

        // Current pages keep the requested quote's statistics in one list.
        // Ignore yield labels in recommendations and other modules outside it.
        const statistics = html.match(/<div\b[^>]*data-testid=["']quote-statistics["'][^>]*>\s*<ul\b[^>]*>([\s\S]*?)<\/ul>/i);
        if (statistics) {
            const rows = statistics[1].match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) || [];
            for (const row of rows) {
                if (!/title=["'](?:Forward Dividend (?:&amp;|&) Yield|Yield)["']/i.test(row)) continue;
                const text = YahooFinance.decodeText_(row.replace(/<[^>]*>/g, " "));
                const percent = text.match(/(?:\(|\s)(\d+(?:\.\d+)?)\s*%/);
                if (percent) {
                    const yieldFraction = Number(percent[1]) / 100;
                    if (Number.isFinite(yieldFraction)) data.yieldPct = yieldFraction;
                }
                break;
            }
        }
        return data;
    }

    static decodeText_(text) {
        return text.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#(?:39|x27);/gi, "'")
            .replace(/&nbsp;/gi, " ").replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
    }

    /**
     * 
     * @param {String} symbol 
     * @returns {String}
     */
    static getTicker(symbol) {
        let modifiedSymbol = symbol;
        const colon = symbol.indexOf(":");

        if (colon >= 0) {
            modifiedSymbol = YahooFinance.translateExchangeCode(symbol);
        }

        return modifiedSymbol;
    }

    /**
     * 
     * @param {String} symbol 
     * @returns {String}
     */
    static translateExchangeCode(symbol) {
        const [exchangeCode, stockTicker] = symbol.split(":");

        const exchageMapping = {
            TSE: "TO",
            NEO: "NE",
            BIT: "MI",
            AMS: "AS",
            NASDAQ: "",
            NYSEARCA: "",
            BATS: "",
            BCBA: "BA",
            ASX: "AX",
            VIE: "VI",
            EBR: "BR",
            CNSX: "CN",
            TSXV: "V",
            SHA: "SS",
            SHE: "SZ",
            CPH: "CO",
            HEL: "HE",
            EPA: "PA",
            FRA: "F",
            ETR: "DE",
            HKG: "HK",
            ICE: "IC",
            BOM: "BO",
            IDX: "JK",
            TLV: "TA",
            TYO: "T",
            KLSE: "KL",
            BMV: "MX",
            NZE: "NZ",
            ELI: "LS",
            SGX: "SI",
            JSE: "JO",
            KRX: "KS",
            KOSDAQ: "KQ",
            TADAWUL: "SAU",
            STO: "ST",
            SWX: "SW",
            TPE: "TW",
            BKK: "BK",
            IST: "IS",
            LON: "L"
        }

        // @ts-ignore
        const translatedExchangecode = Object.hasOwn(exchageMapping, exchangeCode) ? exchageMapping[exchangeCode] : null;
        const ticker = stockTicker.replaceAll(".", "-");

        let modifiedSymbol = `${ticker}.${exchangeCode}`;
        if (translatedExchangecode !== null) {
            if (translatedExchangecode === "") {
                modifiedSymbol = ticker;
            }
            else {
                modifiedSymbol = `${ticker}.${translatedExchangecode}`;
            }
        }

        return modifiedSymbol;
    }
    /**
     * getURL() will receive an instance of the throttling object to query if the limit would be exceeded.
     * @returns {SiteThrottle}
     */
    static getThrottleObject() {
        return null;
    }
}

class YahooApi {
    /**
     * 
     * @param {String} symbol 
     * @param {String} attribute
     * @returns {StockAttributes}
     */
    static getInfo(symbol, attribute) {
        const URL = YahooApi.getURL(symbol, attribute);

        let html = null;
        try {
            html = UrlFetchApp.fetch(URL).getContentText();
        }
        catch {
            return new StockAttributes();
        }

        Logger.log(`getInfo:  ${symbol}.  URL = ${URL}`);

        return YahooApi.parseResponse(html, symbol);
    }

    /**
     * 
     * @param {String} symbol 
     * @param {String} attribute
     * @returns {String}
     */
    static getURL(symbol, attribute) {
        if (FinanceWebSites.getTickerCountryCode(symbol) === "fx") {
            return "";
        }

        if (attribute !== "PRICE" && attribute !== "NAME") {
            return "";
        }

        return `https://query1.finance.yahoo.com/v8/finance/chart/${YahooApi.getTicker(symbol)}`;
    }

    /**
     * 
     * @returns {String}
     */
    static getApiKey() {
        return "";
    }

    /**
     * 
     * @param {String} html 
     * @param {String} symbol
     * @returns {StockAttributes}
     */
    static parseResponse(html, symbol) {
        const stockData = new StockAttributes();

        if (symbol === '') {
            return stockData;
        }

        try {
            const data = JSON.parse(html);
            if (data?.chart?.result.length > 0) {
                const regularMarketPrice = data.chart.result[0].meta.regularMarketPrice;

                stockData.stockPrice = Number.parseFloat(regularMarketPrice);

                if (Number.isNaN(stockData.stockPrice)) {
                    stockData.stockPrice = null;
                }

                stockData.stockName = data.chart.result[0].meta.longName;
            }
        }
        catch {
            Logger.log(`Failed to parse JSON: ${symbol}`);
        }

        return stockData;
    }

    /**
     * 
     * @param {String} symbol 
     * @returns {String}
     */
    static getTicker(symbol) {
        return YahooFinance.getTicker(symbol);
    }

    /**
     * getURL() will receive an instance of the throttling object to query if the limit would be exceeded.
     * @returns {SiteThrottle}
     */
    static getThrottleObject() {
        return null;
    }
}

/**
 * @classdesc Lookup for Globe and Mail website.
 */
class GlobeAndMail {
    /**
     * Only gets dividend yield.
     * @param {String} symbol 
     * @param {String} attribute
     * @returns {StockAttributes}
     */
    static getInfo(symbol, attribute) {
        const URL = GlobeAndMail.getURL(symbol, attribute);
        if (!URL) return new StockAttributes();

        Logger.log(`getInfo: GlobeAndMail ${symbol}`);

        let html = null;
        try {
            html = UrlFetchApp.fetch(URL).getContentText();
        }
        catch {
            return new StockAttributes();
        }

        return GlobeAndMail.parseResponse(html, symbol);
    }

    /**
     * 
     * @param {String} symbol 
     * @param {String} _attribute
     * @returns {String}
     */
    static getURL(symbol, attribute = "PRICE") {
        if (typeof symbol !== "string" || !["PRICE", "NAME", "YIELDPCT"].includes(String(attribute).toUpperCase())) return "";
        symbol = symbol.trim().toUpperCase();
        if (FinanceWebSites.getTickerCountryCode(symbol) === "fx") return "";
        const ticker = GlobeAndMail.getTicker(symbol);
        if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(ticker)) return "";

        //  Mutual fund
        if (FinanceWebSites.getTickerCountryCode(symbol) === "mut") {
            return `https://www.theglobeandmail.com/investing/markets/funds/${ticker}`;
        }

        return `https://www.theglobeandmail.com/investing/markets/stocks/${ticker}`;
    }

    /**
     * 
     * @returns {String}
     */
    static getApiKey() {
        return "";
    }

    /**
     * 
     * @param {String} html 
     * @param {String} symbol Requested exchange-qualified symbol.
     * @returns {StockAttributes}
     */
    static parseResponse(html, symbol) {
        const data = new StockAttributes();
        const quote = GlobeAndMail.readQuote(html, symbol);
        if (quote === null) return data;

        const name = quote.symbolName || quote.raw?.symbolName;
        const decodedName = typeof name === "string" ? GlobeAndMail.decodeEntities(name.trim()) : "";
        if (decodedName && !/[<>]/.test(decodedName)) data.stockName = decodedName;
        const price = GlobeAndMail.numericValue(quote.raw?.lastPrice ?? quote.lastPrice);
        if (price !== null && price > 0) data.stockPrice = price;

        // Fields from related instruments can appear before the requested quote.
        const symbols = new Set([String(quote.symbol).toUpperCase()]);
        if (typeof quote.raw?.symbol === "string") symbols.add(quote.raw.symbol.toUpperCase());
        const yieldNames = FinanceWebSites.getTickerCountryCode(symbol.toUpperCase()) === "mut"
            ? ["distributionYield"] : ["dividendYieldTrailing", "distributionYield"];
        const fields = [];
        for (const match of html.matchAll(/<barchart-field\b[^>]*>/gi)) {
            const attrs = GlobeAndMail.attributes(match[0], true);
            if (symbols.has(String(attrs.symbol || "").toUpperCase())) fields.push(attrs);
        }
        for (const fieldName of yieldNames) {
            const matches = fields.filter(field => field.name === fieldName);
            for (const field of matches) {
                if (typeof field.value !== "string" || !field.value.trim().endsWith("%")) continue;
                const value = GlobeAndMail.numericValue(field.value.trim().slice(0, -1));
                if (value !== null && value >= 0) { data.yieldPct = value / 100; break; }
            }
            if (data.yieldPct !== null) break;
        }
        return data;
    }

    /** Decode only HTML entities; never evaluate embedded provider scripts. */
    static decodeEntities(value) {
        const named = { "&quot;": '"', "&apos;": "'", "&#39;": "'", "&amp;": "&", "&lt;": "<", "&gt;": ">" };
        return String(value).replace(/&(?:quot|apos|amp|lt|gt|#\d+|#x[0-9a-f]+);/gi, token => {
            if (Object.prototype.hasOwnProperty.call(named, token.toLowerCase())) return named[token.toLowerCase()];
            const code = token[2].toLowerCase() === "x" ? Number.parseInt(token.slice(3, -1), 16) : Number.parseInt(token.slice(2, -1), 10);
            return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : token;
        });
    }

    static attributes(tag, escaped = false) {
        const text = escaped ? tag.replace(/\\+(['"])/g, "$1") : tag;
        const attrs = {};
        for (const match of text.matchAll(/([a-z_:][a-z0-9_:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
            attrs[match[1].toLowerCase()] = GlobeAndMail.decodeEntities(match[2] ?? match[3]);
        }
        return attrs;
    }

    static numericValue(value) {
        if (typeof value === "number") return Number.isFinite(value) ? value : null;
        if (typeof value !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
        const number = Number(value.trim());
        return Number.isFinite(number) ? number : null;
    }

    /** The primary page must identify the requested instrument, not a related quote. */
    static pageIdentity(html, symbol) {
        const expected = GlobeAndMail.getURL(symbol);
        if (!expected || typeof html !== "string") return "Unknown";
        const normalize = url => String(url).split(/[?#]/)[0].replace(/\/+$/, "").toUpperCase();
        for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
            const attrs = GlobeAndMail.attributes(match[0]);
            if (String(attrs.rel || "").toLowerCase().split(/\s+/).includes("canonical")) {
                return normalize(attrs.href || "") === normalize(expected) ? "Matched" : "Mismatch";
            }
        }
        return "Unknown";
    }

    /** Read only a quote object whose symbol matches the primary page and input. */
    static readQuote(html, symbol) {
        if (GlobeAndMail.pageIdentity(html, symbol) !== "Matched") return null;
        const ticker = GlobeAndMail.getTicker(symbol.trim().toUpperCase());
        for (const match of html.matchAll(/\bquote\s*=\s*(?:'([^']*)'|"([^"]*)")/gi)) {
            try {
                const quote = JSON.parse(GlobeAndMail.decodeEntities(match[1] ?? match[2]));
                if (quote && typeof quote.symbol === "string" && quote.symbol.toUpperCase() === ticker) return quote;
            } catch { /* Ignore unrelated or malformed attribute data. */ }
        }
        return null;
    }

    /** This is the selected quote's trade time, not a yield publication date. */
    static sourceDetails(html, symbol) {
        const result = { timestamp: "Unknown", field: "", identity: GlobeAndMail.pageIdentity(html, symbol) };
        const quote = GlobeAndMail.readQuote(html, symbol);
        if (quote === null) {
            if (result.identity === "Matched") result.identity = "Unknown";
            return result;
        }
        result.identity = "Matched";
        const epoch = quote.raw?.tradeTime;
        if (typeof epoch === "number" && Number.isFinite(epoch) && epoch > 0) {
            const date = new Date(epoch * 1000);
            if (Number.isFinite(date.getTime())) { result.timestamp = date.toISOString(); result.field = "quote.raw.tradeTime"; }
        }
        return result;
    }

    /**
     * Clean up ticker symbol for use in Globe and Mail lookups.
     * @param {String} symbol 
     * @returns {String}
     */
    static getTicker(symbol) {
        const colon = symbol.indexOf(":");

        if (colon >= 0) {
            const parts = symbol.split(":");

            switch (parts[0].toUpperCase()) {
                case "TSE":
                    symbol = parts[1];
                    if (parts[1].includes(".")) {
                        symbol = parts[1].replace(".", "-");
                    }
                    else if (parts[1].includes("-")) {
                        const prefShare = parts[1].split("-");
                        symbol = `${prefShare[0]}-PR-${prefShare[1]}`;
                    }
                    symbol = `${symbol}-T`;
                    break;
                case "NEO":
                    symbol = `${parts[1]}-NE`;
                    break;
                case "NYSEARCA":
                case "BATS":
                    symbol = `${parts[1]}-A`;
                    break;
                case "NASDAQ":
                    symbol = `${parts[1]}-Q`;
                    break;
                case "CF":
                    symbol = `${parts[1]}.CF`;
                    break;
                default:
                    symbol = '#N/A';
            }
        }

        return symbol;
    }

    /**
     * getURL() will receive an instance of the throttling object to query if the limit would be exceeded.
     * @returns {SiteThrottle}
     */
    static getThrottleObject() {
        return null;
    }
}



/**
 * @classdesc Uses FINNHUB Rest API.  Requires a script setting for the API key.
 * Set key name as FINNHUB_API_KEY
 */
class FinnHub {
    /**
     * 
     * @param {String} symbol 
     * @param {String} attribute 
     * @returns 
     */
    static getInfo(symbol, attribute = "PRICE") {
        let data = new StockAttributes();

        if (attribute !== "PRICE") {
            Logger.log(`Finnhub.  Only PRICE is supported: ${symbol}, ${attribute}`);
            return data;
        }

        const countryCode = FinanceWebSites.getTickerCountryCode(symbol);
        if (countryCode !== "us") {
            Logger.log(`FinnHub --> Only U.S. stocks: ${symbol}`);
            return data;
        }

        const URL = FinnHub.getURL(symbol, attribute, FinnHub.getApiKey());
        Logger.log(`getInfo: FinnHub ${symbol}`);

        let jsonStr = null;
        try {
            jsonStr = UrlFetchApp.fetch(URL).getContentText();
            data = FinnHub.parseResponse(jsonStr, symbol, attribute);
        }
        catch {
            return data;
        }

        return data;
    }

    /**
     * 
     * @param {String} symbol 
     * @param {String} attribute
     * @param {String} API_KEY
     * @returns {String}
     */
    static getURL(symbol, attribute, API_KEY = null) {
        if (attribute !== "PRICE") {
            return "";
        }

        const countryCode = FinanceWebSites.getTickerCountryCode(symbol);
        if (countryCode !== "us") {
            return "";
        }

        if (API_KEY === null) {
            return "";
        }

        return `https://finnhub.io/api/v1/quote?symbol=${FinanceWebSites.getBaseTicker(symbol)}&token=${API_KEY}`;
    }

    /**
     * 
     * @returns {String}
     */
    static getApiKey() {
        return FinanceWebSites.getApiKey("FINNHUB_API_KEY");
    }

    /**
     * 
     * @param {String} jsonStr 
     * @param {String} _symbol
     * @param {String} attribute
     * @returns {StockAttributes}
     */
    static parseResponse(jsonStr, _symbol, attribute) {
        const data = new StockAttributes();

        const hubData = JSON.parse(jsonStr);
        if (attribute === "PRICE")
            data.stockPrice = hubData.c;

        return data;
    }

    /**
     * getURL() will receive an instance of the throttling object to query if the limit would be exceeded.
     * @returns {SiteThrottle}
     */
    static getThrottleObject() {
        //  Basic throttle check
        const limits = [
            new ThresholdPeriod("SECOND", 30),
            new ThresholdPeriod("MINUTE", 60)
        ];

        return new SiteThrottle("FINNHUB", limits);
    }
}

class AlphaVantage {
    /**
     * 
     * @param {String} symbol 
     * @param {String} attribute 
     * @returns {StockAttributes}
     */
    static getInfo(symbol, attribute = "PRICE") {
        let data = new StockAttributes();

        if (attribute !== "PRICE") {
            Logger.log(`AlphaVantage.  Only PRICE is supported: ${symbol}, ${attribute}`);
            return data;
        }

        const countryCode = FinanceWebSites.getTickerCountryCode(symbol);
        if (!(countryCode === "us" || countryCode === "fx")) {
            Logger.log(`AlphaVantage --> Only U.S. stocks: ${symbol}`);
            return data;
        }

        const apiKey = AlphaVantage.getApiKey();
        const URL = AlphaVantage.getURL(symbol, attribute, apiKey);
        Logger.log(`getInfo: AlphaVantage ${symbol}`);

        let jsonStr = null;
        try {
            jsonStr = UrlFetchApp.fetch(URL).getContentText();
            data = AlphaVantage.parseResponse(jsonStr, symbol, attribute);
        }
        catch {
            return data;
        }

        return data;
    }

    /**
     * 
     * @param {String} symbol 
     * @param {String} attribute
     * @param {String} API_KEY
     * @returns {String}
     */
    static getURL(symbol, attribute, API_KEY = null) {
        if (API_KEY === null || attribute !== "PRICE") {
            return "";
        }

        const countryCode = FinanceWebSites.getTickerCountryCode(symbol);
        if (!(countryCode === "us" || countryCode === "fx")) {
            return "";
        }

        if (countryCode === "fx") {
            const parts = FinanceWebSites.getCurrencyTickers(symbol);

            return `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${parts.fromCurrency}&to_currency=${parts.toCurrency}&apikey=${API_KEY}`;
        }
        else {
            return `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${FinanceWebSites.getBaseTicker(symbol)}&apikey=${API_KEY}`;
        }
    }

    /**
     * 
     * @returns {String}
     */
    static getApiKey() {
        return FinanceWebSites.getApiKey("ALPHA_VANTAGE_API_KEY");
    }

    /**
     * 
     * @param {String} jsonStr 
     * @param {String} symbol
     * @param {String} _attribute
     * @returns {StockAttributes}
     */
    static parseResponse(jsonStr, symbol, _attribute) {
        const data = new StockAttributes();
        const countryCode = FinanceWebSites.getTickerCountryCode(symbol);
        const alphaVantageData = JSON.parse(jsonStr);

        try {
            if (countryCode === "fx") {
                data.exchangeRate = alphaVantageData["Realtime Currency Exchange Rate"]["5. Exchange Rate"];
            }
            else {
                data.stockPrice = alphaVantageData["Global Quote"]["05. price"];
            }

        }
        catch {
            Logger.log("AlphaVantage response did not contain the requested field.");
        }

        return data;
    }

    /**
     * getURL() will receive an instance of the throttling object to query if the limit would be exceeded.
     * @returns {SiteThrottle}
     */
    static getThrottleObject() {
        //  Basic throttle check
        const limits = [
            new ThresholdPeriod("SECOND", 1),
            new ThresholdPeriod("DAY", 25)
        ];

        return new SiteThrottle("ALPHAVANTAGE", limits);
    }
}

/**
 * @classdesc Lookup for GOOGLE Finance site.
 * weirdly, GOOGLEFINANCE() will fail for some stocks, but work on the website.
 */
class GoogleWebSiteFinance {
    static getInfo(symbol, attribute) {
        const url = GoogleWebSiteFinance.getURL(symbol, attribute);
        if (!url) return new StockAttributes();
        try {
            return GoogleWebSiteFinance.parseResponse(UrlFetchApp.fetch(url).getContentText(), symbol);
        } catch {
            return new StockAttributes();
        }
    }

    static getURL(symbol, attribute) {
        if (attribute === "YIELDPCT" && FinanceWebSites.getTickerCountryCode(symbol) === "us") return "";
        const ticker = GoogleWebSiteFinance.getTicker(symbol).split("?")[0];
        return `https://www.google.com/finance/quote/${ticker}?hl=en`;
    }

    static getApiKey() { return ""; }

    static parseResponse(html, symbol) {
        const data = new StockAttributes();
        if (!GoogleWebSiteFinance.isRequestedPage(html, symbol)) return data;
        const quote = GoogleWebSiteFinance.extractQuote(html, symbol);
        data.stockName = quote ? quote[2].trim() : GoogleWebSiteFinance.extractStockName(html, symbol);
        data.yieldPct = GoogleWebSiteFinance.extractYieldPct(html, symbol);
        const price = quote ? quote[5][0] : GoogleWebSiteFinance.extractStockPrice(html, symbol);
        if (FinanceWebSites.getTickerCountryCode(symbol) === "fx") data.exchangeRate = price;
        else data.stockPrice = price;
        return data;
    }

    /** Require the primary page URL or a bounded quote title to match the request. */
    static isRequestedPage(html, symbol) {
        if (typeof html !== "string" || typeof symbol !== "string" || !symbol.trim()) return false;
        if (/We couldn't find any match for your search\.|Your device isn(?:'|&#39;)t supported/i.test(html)) return false;
        const expected = GoogleWebSiteFinance.getTicker(symbol).split("?")[0].toUpperCase();
        for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
            const rel = tag.match(/\brel\s*=\s*["']([^"']*)["']/i);
            if (!rel || !rel[1].toLowerCase().split(/\s+/).includes("canonical")) continue;
            const href = tag.match(/\bhref\s*=\s*["']([^"']*)["']/i);
            const path = href && href[1].match(/^https:\/\/(?:www\.)?google\.com\/finance\/quote\/([^?#/]+)(?:[?#]|$)/i);
            if (!path) return false;
            try { return decodeURIComponent(path[1]).toUpperCase() === expected; }
            catch { return false; }
        }
        const title = GoogleWebSiteFinance.titleText(html);
        if (FinanceWebSites.getTickerCountryCode(symbol) === "fx") {
            const pair = expected.replace("-", "/");
            return title.toUpperCase().startsWith(pair + " ");
        }
        return GoogleWebSiteFinance.nameFromTitle(title, symbol) !== null;
    }

    /** Read JSON data only. Never execute the page's callback scripts. */
    static extractQuote(html, symbol) {
        if (!GoogleWebSiteFinance.isRequestedPage(html, symbol)) return null;
        const expected = GoogleWebSiteFinance.getTicker(symbol).split("?")[0].toUpperCase();
        const callbacks = /AF_initDataCallback\(\{\s*key:\s*['"][^'"]+['"],\s*hash:\s*['"][^'"]*['"],\s*data:([\s\S]*?),\s*sideChannel:\s*\{\s*\}\s*\}\);/g;
        let match;
        while ((match = callbacks.exec(html)) !== null) {
            let parsed;
            try { parsed = JSON.parse(match[1]); } catch { continue; }
            const pending = [parsed];
            while (pending.length) {
                const value = pending.pop();
                if (!Array.isArray(value)) continue;
                const ticker = typeof value[21] === "string" ? value[21].toUpperCase() : "";
                const identity = FinanceWebSites.getTickerCountryCode(symbol) === "fx" ? value[15] : value[1];
                const parts = expected.split(expected.includes(":") ? ":" : "-");
                if (ticker === expected && Array.isArray(identity) && identity[0] === parts[0] && identity[1] === parts[1]
                    && typeof value[2] === "string" && value[2].trim() && !/[<>]/.test(value[2])
                    && Array.isArray(value[5]) && typeof value[5][0] === "number" && Number.isFinite(value[5][0]) && value[5][0] > 0) return value;
                for (let i = value.length - 1; i >= 0; i--) if (Array.isArray(value[i])) pending.push(value[i]);
            }
        }
        return null;
    }

    /** Select the current overview widget whose data-p names the requested ticker. */
    static extractOverview(html, symbol) {
        if (!GoogleWebSiteFinance.isRequestedPage(html, symbol)) return null;
        const parts = GoogleWebSiteFinance.getTicker(symbol).split("?")[0].toUpperCase().split(":");
        if (parts.length !== 2) return null;
        const expected = "%.@.[null," + JSON.stringify(parts) + "]]";
        const openings = /<c-wiz\b[^>]*>/gi;
        let opening;
        while ((opening = openings.exec(html)) !== null) {
            if (!/\bjsrenderer\s*=\s*["']rBmozc["']/i.test(opening[0])) continue;
            const parameter = opening[0].match(/\bdata-p\s*=\s*(["'])([\s\S]*?)\1/i);
            if (!parameter || GoogleWebSiteFinance.decodeText(parameter[2]) !== expected) continue;
            const tags = /<\/?c-wiz\b[^>]*>/gi;
            tags.lastIndex = openings.lastIndex;
            let depth = 1, tag;
            while ((tag = tags.exec(html)) !== null) {
                depth += tag[0].startsWith("</") ? -1 : 1;
                if (depth === 0) return html.slice(openings.lastIndex, tag.index);
            }
            return null;
        }
        return null;
    }

    static extractYieldPct(html, symbol) {
        const overview = GoogleWebSiteFinance.extractOverview(html, symbol);
        if (overview === null) return null;
        const rows = /<div\b[^>]*class=["'][^"']*\bKxsRFb\b[^"']*["'][^>]*>\s*<div\b[^>]*class=["'][^"']*\bSwQK7\b[^"']*["'][^>]*>Dividend(?: yield)?<\/div>\s*<div\b[^>]*class=["'][^"']*\bdO6ijd\b[^"']*["'][^>]*>\s*(\d+(?:\.\d+)?)\s*%\s*<\/div>\s*<\/div>/gi;
        const values = new Set();
        let row;
        while ((row = rows.exec(overview)) !== null) values.add(Number(row[1]) / 100);
        // Desktop and mobile copies must agree. Missing or changed markup stays missing.
        return values.size === 1 ? [...values][0] : null;
    }

    static extractStockPrice(html, symbol) {
        if (!GoogleWebSiteFinance.isRequestedPage(html, symbol)) return null;
        const quote = GoogleWebSiteFinance.extractQuote(html, symbol);
        if (quote) return quote[5][0];
        // An unbound data-last-price marker can belong to a related security.
        return null;
    }

    static titleText(html) {
        // Stop at a tag or newline even when a page has an incomplete title element.
        const match = html.match(/<title\b[^>]*>([^<\r\n]*)/i);
        return match ? GoogleWebSiteFinance.decodeText(match[1]).trim() : "";
    }

    static decodeText(value) {
        const entities = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
        return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (whole, entity) => {
            if (entity[0] !== "#") return entities[entity.toLowerCase()] || whole;
            const code = entity[1].toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
            return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
        });
    }

    static nameFromTitle(title, symbol) {
        const ticker = GoogleWebSiteFinance.getTicker(symbol).split(":")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match = title.match(new RegExp("^(.+?)\\s*\\(" + ticker + "\\)(?:\\s|$)"));
        const name = match && match[1].trim();
        return name && !/[<>]/.test(name) ? name : null;
    }

    static extractStockName(html, symbol) {
        if (!GoogleWebSiteFinance.isRequestedPage(html, symbol)) return null;
        const quote = GoogleWebSiteFinance.extractQuote(html, symbol);
        return quote ? quote[2].trim() : GoogleWebSiteFinance.nameFromTitle(GoogleWebSiteFinance.titleText(html), symbol);
    }

    static sourceDetails(html, symbol) {
        const matched = GoogleWebSiteFinance.isRequestedPage(html, symbol);
        // Embedded arrays have several undocumented timestamps. Do not guess which describes this price.
        const primaryLink = (html.match(/<link\b[^>]*>/gi) || []).some(tag => /\brel\s*=\s*["']canonical["']/i.test(tag));
        const exactQuote = matched && GoogleWebSiteFinance.extractQuote(html, symbol);
        return { timestamp: "Unknown", field: "", identity: exactQuote || (primaryLink && matched) ? "Matched" : primaryLink ? "Mismatch" : "Unknown" };
    }

    static getTicker(symbol) {
        let modifiedSymbol = symbol;
        const colon = symbol.indexOf(":");
        if (colon >= 0) {
            const symbolParts = symbol.split(":");
            if (FinanceWebSites.getTickerCountryCode(symbol) === "fx") {
                modifiedSymbol = `${symbolParts[1].substring(0, 3)}-${symbolParts[1].substring(3, 6)}?hl=en`;
            } else modifiedSymbol = `${symbolParts[1]}:${symbolParts[0]}`;
        }
        return modifiedSymbol;
    }

    static getThrottleObject() { return null; }
}

class TwelveData {
    /**
     * 
     * @param {String} symbol 
     * @param {String} attribute 
     * @returns {StockAttributes}
     */
    static getInfo(symbol, attribute = "PRICE") {
        let data = new StockAttributes();

        if (attribute !== "PRICE" && attribute !== "NAME") {
            Logger.log(`TwelveData.  Only PRICE/NAME is supported: ${symbol}, ${attribute}`);
            return data;
        }

        const countryCode = FinanceWebSites.getTickerCountryCode(symbol);
        if (!(countryCode === "us" || countryCode === "fx")) {
            Logger.log(`TwelveData --> Only U.S. stocks: ${symbol}`);
            return data;
        }

        const apiKey = TwelveData.getApiKey();
        const URL = TwelveData.getURL(symbol, attribute, apiKey);
        Logger.log(`getInfo: TwelveData ${symbol}`);

        let jsonStr = null;
        try {
            jsonStr = UrlFetchApp.fetch(URL).getContentText();
            data = TwelveData.parseResponse(jsonStr, symbol, attribute);
        }
        catch {
            return data;
        }

        return data;
    }

    /**
     * 
     * @param {String} symbol 
     * @param {String} attribute
     * @param {String} API_KEY
     * @returns {String}
     */
    static getURL(symbol, attribute, API_KEY = null) {
        if (API_KEY === null) {
            return "";
        }

        if (attribute !== "PRICE" && attribute !== "NAME") {
            return "";
        }

        const countryCode = FinanceWebSites.getTickerCountryCode(symbol);
        if (!(countryCode === "us" || countryCode === "fx")) {
            return "";
        }

        let twelveDataSymbol = "";
        if (countryCode === "fx") {
            const parts = FinanceWebSites.getCurrencyTickers(symbol);

            twelveDataSymbol = `${parts.fromCurrency}/${parts.toCurrency}`;
        }
        else {
            twelveDataSymbol = FinanceWebSites.getBaseTicker(symbol);
        }

        return `https://api.twelvedata.com/quote?symbol=${twelveDataSymbol}&apikey=${API_KEY}`;
    }

    /**
     * 
     * @returns {String}
     */
    static getApiKey() {
        return FinanceWebSites.getApiKey("TWELVE_DATA_API_KEY");
    }

    /**
     * 
     * @param {String} jsonStr 
     * @param {String} symbol
     * @param {String} attribute
     * @returns {StockAttributes}
     */
    static parseResponse(jsonStr, symbol, attribute) {
        const data = new StockAttributes();
        const countryCode = FinanceWebSites.getTickerCountryCode(symbol);
        const twelveData = JSON.parse(jsonStr);

        try {
            if (Object.hasOwn(twelveData, "code") && twelveData.code === 404) {
                Logger.log("TwelveData returned a provider error response.");
            }
            else if (attribute === "NAME") {
                data.stockName = twelveData.name;
            }
            else if (attribute === "PRICE") {
                if (countryCode === "fx") {
                    data.exchangeRate = twelveData.close;
                }
                else {
                    data.stockPrice = twelveData.close;
                }
            }
        }
        catch {
            Logger.log("TwelveData response did not contain the requested field.");
        }

        return data;
    }

    /**
     * Get an instance of the throttling object to query if the web limit would be exceeded.
     * @returns {SiteThrottle}
     */
    static getThrottleObject() {
        //  Basic throttle check
        const limits = [
            new ThresholdPeriod("MINUTE", 8),
            new ThresholdPeriod("DAY", 800)
        ];

        return new SiteThrottle("TWELVEDATA", limits);
    }
}

class CoinMarket {
    /**
     * 
     * @param {String} symbol 
     * @param {String} attribute 
     * @returns {StockAttributes}
     */
    static getInfo(symbol, attribute = "PRICE") {
        let data = new StockAttributes();

        if (attribute !== "PRICE" && attribute !== "NAME") {
            Logger.log(`CoinMarket.  Only PRICE/NAME is supported: ${symbol}, ${attribute}`);
            return data;
        }

        const countryCode = FinanceWebSites.getTickerCountryCode(symbol);
        if (countryCode !== "fx") {
            Logger.log(`CoinMarket --> Only Currency: ${symbol}`);
            return data;
        }

        const apiKey = CoinMarket.getApiKey();
        const URL = CoinMarket.getURL(symbol, attribute, apiKey);
        Logger.log(`getInfo: CoinMarket ${symbol}`);

        let jsonStr = null;
        try {
            jsonStr = UrlFetchApp.fetch(URL).getContentText();
            data = CoinMarket.parseResponse(jsonStr, symbol, attribute);
        }
        catch {
            return data;
        }

        return data;
    }

    /**
     * 
     * @param {String} symbol 
     * @param {String} attribute
     * @param {String} API_KEY
     * @returns {String}
     */
    static getURL(symbol, attribute, API_KEY = null) {
        if (API_KEY === null) {
            return "";
        }

        if (attribute !== "PRICE" && attribute !== "NAME") {
            return "";
        }

        const countryCode = FinanceWebSites.getTickerCountryCode(symbol);
        if (countryCode !== "fx") {
            return "";
        }

        const currency = FinanceWebSites.getCurrencyTickers(symbol);

        return `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${currency.fromCurrency}&convert=${currency.toCurrency}&CMC_PRO_API_KEY=${API_KEY}`;
    }

    /**
     * 
     * @returns {String}
     */
    static getApiKey() {
        return FinanceWebSites.getApiKey("COINMARKET_API_KEY");
    }

    /**
     * 
     * @param {String} jsonStr 
     * @param {String} symbol
     * @param {String} _attribute
     * @returns {StockAttributes}
     */
    static parseResponse(jsonStr, symbol, _attribute) {
        const data = new StockAttributes();
        const coinMarketData = JSON.parse(jsonStr);

        try {
            const parts = FinanceWebSites.getCurrencyTickers(symbol);

            //  Symbol is upper case, but return object from CoinMarket may contain the ticker with lower case characters.
            for (const key of Object.keys(coinMarketData.data)) {
                if (key.toUpperCase() === parts.fromCurrency.toUpperCase()) {
                    parts.fromCurrency = key;
                    break;
                }
            }

            data.exchangeRate = coinMarketData.data[parts.fromCurrency].quote[parts.toCurrency].price;
            data.stockName = coinMarketData.data[parts.fromCurrency].name;

        }
        catch {
            Logger.log("CoinMarket response did not contain the requested field.");
        }

        return data;
    }

    /**
     * getURL() will receive an instance of the throttling object to query if the limit would be exceeded.
     * @returns {SiteThrottle}
     */
    static getThrottleObject() {
        //  Basic throttle check
        const limits = [
            new ThresholdPeriod("MINUTE", 30),
            new ThresholdPeriod("MONTH", 10000)
        ];

        return new SiteThrottle("COINMARKET", limits);
    }
}

