# SMF coverage checklist for Google Sheets

Reviewed November 11, 2026, against CacheFinance commit `8842b97` and SMF Mac source commit `60014079`.

**CacheFinance covers selected SMF tasks. It does not implement the original SMF function names or argument lists.**
An existing SMF workbook therefore requires formula changes before it can use this fork in Google Sheets.

The seven-part research build added charts, option comparisons, strategies, earnings summaries, formulas, watchlists and a copyable template.
Those features do not establish complete SMF coverage.

## Read the checklist

| File | Contents |
|---|---|
| [Function checklist](smf-coverage/functions.csv) | All 121 public VBA Functions, their replacements, gaps and separate Google Sheets/Excel evidence |
| [Numbered field checklist](smf-coverage/fields.csv) | All 11,892 effective field IDs, descriptions, providers, mappings and legacy status |
| [Source inventory](smf-coverage/inventory.json) | Function signatures, source links, counts, source hashes, retired modes and evidence |
| [Supported Sheets functions](FUNCTIONS.md) | The twelve public CacheFinance functions and their current arguments |
| [Native test report](test-results/2026-11-11-google-apps-script/RESEARCH-EXPANSION.md) | The saved Google Sheets checks and their limits |

Download a CSV file and import it into Google Sheets to filter by function, field ID, provider or status.
The CSV files contain checklist data.

## What the counts mean

- The Mac test inventory contains **121 public `.bas` Functions**, including 51 implementation or test helpers.
- That inventory excludes private functions, class members and VBA Subs. We list 28 public Subs separately in the source inventory.
- The default field loader resolves **11,892 numbered definitions** from 11,893 rows.
- **8,430 definitions are ADVFN slots for different annual or quarterly periods.** These are not 8,430 distinct metrics.
- CacheFinance maps **34 SMF IDs** through provider-qualified `CFFIELD` calls.
- CacheFinance also supplies GuruFocus trailing dividend yield without a mapped SMF ID. This produces **35 provider fields** in total.

The field count excludes arbitrary JSON paths, caller URLs, constants, settings and example-workbook formulas.
The source files include duplicate ID `13900`. The later row in `smf-elements-6.txt` wins, as in the loader.
The loader does not read the alternate `smf-elements-20-FinViz_v2.txt` filename or the `smf-elements-info.txt` index.
The CSV records the effective defaults before user overrides.

These counts cannot produce a useful percentage of completed SMF functionality.
One function can expose many providers, fields, periods and output modes.

## Function status

| Status | Meaning |
|---|---|
| Partial | A narrower task works through a CacheFinance function, analysis tab or rewritten formula. The row names the missing behavior. |
| Not ported | This fork supplies no matching public function or workflow. A native Sheets suggestion does not change this status. |
| Retired | The reviewed SMF source or retirement registry confirms the entire legacy function's source mode is retired. |
| Native alternative | Existing Sheets functions or date arithmetic can serve a similar purpose. We did not test complete SMF equivalence. |
| Excel-specific | The function controls Excel objects, add-in links, local logs or formula evaluation. A Sheets workflow can require a different interface. |
| Internal helper | The SMF entry supports transport, parsing, definitions or tests. This label does not claim a CacheFinance worksheet replacement. |

No row claims an unchanged SMF formula works in Sheets.
The function CSV includes separate Excel reference columns. An Excel PASS never establishes a Google Sheets PASS.


| Function status | Count |
|---|---|
| Partial | 18 |
| Not ported | 35 |
| Retired | 7 |
| Native alternative | 5 |
| Excel-specific | 5 |
| Internal helper | 51 |


## Useful tasks available today

| Task | Sheets entry point | Coverage and evidence |
|---|---|---|
| Current quote fields | `CFQUOTE`, `CACHEFINANCE`, `CACHEFINANCES` | Selected price/name/yield fields under different APIs. Native scalar/range checks exist. No old Yahoo quote-code interface. |
| Daily prices | `CFHISTORY` | Seven columns, oldest first, up to 510 sessions from about two years. Native NVDA/AAPL arrays passed. No arbitrary dates or weekly/monthly API. |
| Fundamentals and earnings | `CFFUNDAMENTALS`; CF Earnings / CF Research | Selected Yahoo fields and separate accounting bases. Native NVDA/AAPL tables passed. No arbitrary Yahoo JSON module/path API. |
| Dividends and splits | CF Earnings | Events within the loaded Yahoo history window. The code and local fixtures cover events. No separate native assertion verifies every event value. |
| Options | `CFEXPIRATIONS`, `CFOPTIONS`; CF Options / CF Research | Published dates, one selected chain and up to five maturity comparisons. Native NVDA/AAPL checks passed. No full SMF item-code/source/relative-strike interface. |
| Option models and strategies | `CFOPTIONMODEL`, `CFSTRATEGY`; CF Strategies | Black–Scholes values and four expiration payoff models. Native selections and independent position arithmetic passed. These do not expand SMF provider coverage. |
| FRED | `CFFRED` | Latest 1–1000 observations, units and source. Native checks cover the four default series and DGS2. Exact-date and full metadata selectors remain missing. |
| Selected numbered fields | `CFFIELD` | 34 mapped IDs plus one additional yield field. Direct Apps Script adapters returned all 35 fields for NVDA/AAPL. Actual worksheet cells checked Finviz price. |
| Trends and indicators | CF Analysis / CF Price history / CF Research | Fixed RSI14, moving averages and MACD. No generic `SMFTech` interface or RSI2 target prices. |
| Watchlists and saved changes | CF Watchlist / CF Journal | Up to 20 inputs. Native checks covered five US stocks. This does not implement arbitrary SMF download tables. |
| Pictures | CF Images | Manual StockCharts/Finviz page links. The function downloads zero provider images. Native numeric charts use worksheet data. |

The [native report](test-results/2026-11-11-google-apps-script/RESEARCH-EXPANSION.md) records 997 local tests and selected Google Sheets checks.
Those checks establish accepted outputs for their saved inputs. We did not reconcile every financial value against filings or an exchange feed.

## Important differences

- **MACD:** SMF's `SMFTech` code uses simple averages. CacheFinance uses seeded exponential averages for MACD and its signal.
- **RSI targets:** RSI14 in the analysis does not implement `smfRSITargetPrices`, which calculates RSI2 triggers and target prices.
- **History:** The public Sheets table has a finite daily window. SMF supports more date, interval, event, column and layout arguments.
- **FRED:** `CFFRED` returns recent observations. `smfGetEconData` also accepts exact dates and metadata labels.
- **Financial statements:** Selected Yahoo tables do not establish complete ADVFN, GuruFocus or Morningstar catalogs.
- **Units:** CacheFinance field units control interpretation. A numeric alias does not guarantee identical legacy scaling or formatting.
- **Errors:** Research functions return explanatory `N/A: ...` text. This differs from native spreadsheet `#N/A` and SMF caller-supplied error values.

## Numbered fields

Coverage and legacy status are independent columns in the field CSV.
An unmapped field can be a usable future candidate, an explicitly obsolete definition or an unverified legacy recipe.
An existing recipe does not prove that its provider still publishes data.


| CacheFinance ID coverage | Count |
|---|---|
| Not ported | 11858 |
| Mapped field | 34 |




| SMF default definition status | Count |
|---|---|
| Definition present; availability unverified | 11527 |
| Explicitly retired default | 288 |
| Confirmed retired mode dependency | 73 |
| Legacy warning; availability unverified | 4 |


The 73 retired-mode dependencies use the confirmed retired optionsXpress mode.
They are separate from the 288 definitions that explicitly return an obsolete marker.
Four other warning literals remain unverified, because their text does not prove retirement.

CacheFinance does not load the Mac retirement registry or these recipe files.
Unsupported `CFFIELD` arguments use the CacheFinance adapter's validation.
The checklist does not claim the Mac `#N/A`/status-table/no-network retirement behavior exists for every old Sheets formula.

### All mapped field IDs

Use the provider and numeric ID together, for example `=CFFIELD("FINVIZ","NVDA",4074)`.
Named fields also work. The [function reference](FUNCTIONS.md#cffield) gives their arguments and units.


| SMF ID | Provider | CacheFinance field | Unit |
|---|---|---|---|
| 4074 | FINVIZ | `price` | currency |
| 4072 | FINVIZ | `earnings_date` | date text |
| 4006 | FINVIZ | `market_cap` | currency |
| 4001 | FINVIZ | `trailing_pe` | ratio |
| 4007 | FINVIZ | `forward_pe` | ratio |
| 4002 | FINVIZ | `eps_ttm` | currency |
| 4008 | FINVIZ | `eps_next_year` | currency |
| 4026 | FINVIZ | `eps_growth_next_year` | fraction |
| 4062 | FINVIZ | `target_price` | currency |
| 4079 | FINVIZ | `volume` | shares |
| 4073 | FINVIZ | `average_volume` | shares |
| 4036 | FINVIZ | `forward_dividend_rate` | currency |
| 4037 | FINVIZ | `forward_dividend_yield` | fraction |
| 4043 | FINVIZ | `trailing_dividend_rate` | currency |
| 4044 | FINVIZ | `trailing_dividend_yield` | fraction |
| 4050 | FINVIZ | `dividend_ex_date` | date text |
| 4016 | FINVIZ | `short_float` | fraction |
| 4003 | FINVIZ | `insider_ownership` | fraction |
| 4015 | FINVIZ | `institutional_ownership` | fraction |
| 4054 | FINVIZ | `rsi14` | index 0-100 |
| 4075 | FINVIZ | `sma20_distance` | fraction |
| 4076 | FINVIZ | `sma50_distance` | fraction |
| 4077 | FINVIZ | `sma200_distance` | fraction |
| 4005 | FINVIZ | `return_week` | fraction |
| 4011 | FINVIZ | `return_month` | fraction |
| 4017 | FINVIZ | `return_quarter` | fraction |
| 4029 | FINVIZ | `return_year` | fraction |
| 4035 | FINVIZ | `return_ytd` | fraction |
| 4047 | FINVIZ | `gross_margin` | fraction |
| 4053 | FINVIZ | `operating_margin` | fraction |
| 4060 | FINVIZ | `profit_margin` | fraction |
| 4042 | FINVIZ | `beta` | ratio |
| 849 | ZACKS | `target_price` | currency |
| 2727 | GURUFOCUS | `forward_dividend_yield` | fraction |


GuruFocus `trailing_dividend_yield` has no mapped ID and remains outside this table.
Fourteen other Finviz definitions have related Yahoo fields in the CSV.
Those rows remain unmapped. Their provider, units and reporting basis require separate review.

### Every numbered definition group

These 51 labels are SMF recipe groups. They do not represent 51 separate websites.
The full CSV lists each ID and description within the groups.


| SMF recipe group | Effective IDs | Mapped IDs | Explicitly retired defaults | Retired-mode dependencies |
|---|---|---|---|---|
| AdvFN-A | 2810 |  |  |  |
| AdvFN-Q | 5620 |  |  |  |
| BarChart | 21 |  |  |  |
| BarChartMM | 97 |  | 16 |  |
| BarChartTech | 80 |  |  |  |
| Calculated | 14 |  |  |  |
| ETFOutlookHL | 10 |  |  |  |
| ETFOutlookMB | 5 |  |  |  |
| ETFOutlookMV | 5 |  |  |  |
| ETFOutlookPB | 9 |  |  |  |
| ETFOutlookVB | 9 |  |  |  |
| ETFScreen | 59 |  |  |  |
| Earnings | 111 |  | 111 |  |
| FinViz | 81 | 32 |  |  |
| Google | 1234 |  |  |  |
| GuruDiv | 2 | 1 |  |  |
| IBD | 116 |  | 1 |  |
| IBDQ | 45 |  |  |  |
| MSN or whatever | 1 |  |  |  |
| NetFlix | 6 |  |  |  |
| OptionsXPress | 73 |  |  | 73 |
| ReutersRat | 220 |  | 49 |  |
| Scouter | 11 |  |  |  |
| StockCharts | 3 |  | 3 |  |
| StockScores | 54 |  | 11 |  |
| Test | 4 |  |  |  |
| Yahoo | 1 |  |  |  |
| YahooABS | 52 |  |  |  |
| YahooAE | 153 |  | 12 |  |
| YahooAIS | 40 |  |  |  |
| YahooAP | 1 |  |  |  |
| YahooCE | 7 |  |  |  |
| YahooDKS | 8 |  |  |  |
| YahooFD | 3 |  |  |  |
| YahooH | 2 |  |  |  |
| YahooIN | 5 |  | 3 |  |
| YahooIS | 5 |  |  |  |
| YahooKS | 73 |  | 2 |  |
| YahooPer | 277 |  | 39 |  |
| YahooPrice | 50 |  |  |  |
| YahooPro | 32 |  | 11 |  |
| YahooQBS | 102 |  | 16 |  |
| YahooQIS | 61 |  | 4 |  |
| YahooQT | 6 |  |  |  |
| YahooSD | 14 |  |  |  |
| YahooSum | 1 |  |  |  |
| YahooTIS | 9 |  |  |  |
| YahooTop | 79 |  | 10 |  |
| ZackEA | 1 |  |  |  |
| Zacks | 95 | 1 |  |  |
| ZacksEA | 115 |  |  |  |


## Provider coverage beyond numbered aliases

Yahoo and FRED have useful Sheets functions outside the numbered alias list.
This table separates those functions from the older provider recipes.

| Source or mode | Google Sheets coverage | Remaining work |
|---|---|---|
| Yahoo Chart | Partial, native quote/history checks | Date/interval controls, full event API and SMF output selectors |
| Yahoo fundamentals / JSON | Partial, selected fields and earnings tables | Arbitrary modules, paths, full catalogs and historical statement selectors |
| Yahoo options | Partial, native chains/dates/strategies | Full item codes, direct contract interface, relative strikes and alternate-provider modes |
| FRED official API | Partial, native observations and units | Exact-date and full metadata-label interfaces |
| Finviz | Partial, 32 of 81 numbered definitions mapped | 49 IDs without aliases, plus field-by-field meaning and source checks |
| Zacks | Partial, target-price consensus ID 849 | Other quote, earnings and estimate recipes |
| GuruFocus | Partial, two yield fields | Data/Item/CSV catalogs, history and required provider permissions |
| Google Finance website | Partial, repaired CacheFinance quote adapter | SMF numbered recipes and historical CSV interface remain unported |
| Globe & Mail | Native CacheFinance quote/name/yield checks | This additional provider does not establish SMF ID coverage |
| Finnhub / Alpha Vantage / Twelve Data / CoinMarketCap | Selected keyed CacheFinance quote fields passed earlier native checks | Their broader provider APIs remain outside the implemented adapters |
| ADVFN, including regional hosts | Not ported | Annual/quarterly financials and latest annual year-end lookup |
| Morningstar | Not ported | History/provider interface and live access checks |
| Barchart / BigCharts / MarketWatch / Nasdaq | Not ported | Direct Apps Script access and quote/option parsers |
| FreeRealtime | Not ported | Direct Apps Script access and selected recipes |
| IBD / StockScores / Reuters / ETFScreen / ETF Investment Outlook | Not ported | Direct Apps Script access and selected recipes |
| TD Ameritrade research / MSN history / Netflix recipes | Not ported | Provider-specific access and a scope decision. HTTP failures alone do not prove retirement. |
| StockCharts / old image hosts | Manual links only for StockCharts | No automatic pictures, comment pictures, image tables or chart-image downloads |
| SMF definition downloads | Not ported | This fork installs one Apps Script bundle. It does not load remote SMF definition files. |

The Mac provider results remain reference evidence for future work.
We did not use Mac HTTP status codes to classify a provider as working or blocked from Google Sheets.

### Confirmed retired source modes

The following six entries come from the reviewed Mac retirement registry.
Retirement applies to the listed mode, not every service offered by the provider.


| Mode | Affected SMF functions | Reason |
|---|---|---|
| MSN option quotes | `smfGetMSNOptionQuote`, `smfGetOptionQuotes` | SMF marks the MSN option quote function obsolete. |
| OX, OX2, OX3 quotes; OX expirations/strikes | `smfGetOXOptionQuote`, `smfGetOX2OptionQuote`, `smfGetOX3OptionQuote`, `smfGetOptionQuotes`, `smfGetOptionExpirations`, `smfGetOptionStrikes` | SMF records that optionsXpress is no longer a valid data source. |
| Ticker/quote-code mode with nonempty pItems | `RCHGetYahooQuotes` | SMF explicitly marks the old ticker/quote-code CSV mode obsolete. |
| All YQL feeds A-F | `smfYahooAPIData` | Yahoo retired query.yahooapis.com YQL on 2019-01-03, as recorded in the SMF change log. |
| G/GOOGLE legacy option chain | `smfGetGoogleOptionQuote`, `smfGetOptionQuotes`, `smfGetOptionExpirations`, `smfGetOptionStrikes` | The SMF option-strike manual explicitly labels the Google option source obsolete. |
| 8/888 legacy oic_adv_options.j path | `smfGet888OptionQuote`, `smfGetOptionQuotes`, `smfGetOptionExpirations`, `smfGetOptionStrikes` | The SMF option-strike manual explicitly labels source 8 obsolete; these calls use that same legacy endpoint. |


The obsolete Google option chain is separate from the current Google Finance quote adapter.
The old Yahoo ticker/quote-code CSV mode is separate from `RCHGetYahooQuotes` with empty `pItems` and a supplied CSV URL.
The generic CSV-URL mode remains unported.

## Full function checklist

Each function name links to its source at the reviewed SMF commit.
The CSV and JSON preserve signatures and separate Excel reference results.



### CSV import


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`smfGetCSVFile`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetCSVFile.bas#L2) | Download a CSV URL with delimiter and output-size controls. | Not ported | `Google Sheets IMPORTDATA for basic CSV/TSV`. Native IMPORTDATA is an alternative, not an implemented SMF parser or custom-delimiter/padding replacement. |


### Chart HTML


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`RCHImageTable`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modPictureTable.bas#L2) | Build an HTML table containing provider chart-image tags for multiple tickers. | Not ported | `CF Images manual provider links`. No HTML image-table output or automatic provider-image insertion. StockCharts manual-copy policy applies. |


### Date utilities


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`smfDate2Unix`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L484) | Convert an Excel date serial to UNIX seconds. | Native alternative | `Google Sheets date arithmetic`. Use(date-DATE(1970,1,1))*86400 with explicit timezone assumptions; no alias or general timezone parity claim. |
| [`smfUnix2Date`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L492) | Convert UNIX seconds to an Excel date serial. | Native alternative | `Google Sheets date arithmetic`. UseDATE(1970,1,1)+seconds/86400 with explicit timezone assumptions; no alias. |
| [`smfUnix2DateStr`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L500) | Convert UNIX seconds to a formatted date string. | Native alternative | `Google Sheets TEXT plus date arithmetic`. Excel and Sheets format strings can differ; no SMF alias or timezone parity claim. |


### Derived history


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`DateOfHigh`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modZAdditional.bas#L4) | Return the date of a high in a recent calendar-day range. | Not ported | `CFHISTORY plus worksheet formulas`. No direct date-of-high function; source history has a two-year/510-session limit. |
| [`SMFHighBetween`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modZAdditional.bas#L19) | Return high price/date and endpoint prices for a requested date range. | Not ported | `CFHISTORY plus worksheet formulas`. No date-range high summary or matching endpoint/adjustment semantics. |
| [`smfLastPrice`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modZAdditional.bas#L65) | Return the last adjusted price on or before a specified date. | Not ported | `CFHISTORY plus worksheet formulas`. No on-or-before date-lookup function; finite daily archive only. |
| [`SMFLowBetween`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modZAdditional.bas#L42) | Return low price/date and endpoint prices for a requested date range. | Not ported | `CFHISTORY plus worksheet formulas`. No date-range low summary or matching endpoint/adjustment semantics. |
| [`smfPricesBetween`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfPricesBetween_.bas#L2) | Summarize date-range open/high/low/close/volume/return/CAGR/drawdown fields. | Partial | `CF Analysis returns/drawdown and CFHISTORY`. Only preset lookbacks and loaded-history drawdown. No13-item arbitrary date-range summary or CAGR. |
| [`smfPricesByDates`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfPricesByDates_.bas#L2) | Return prices on or before several requested historical dates. | Not ported | `CFHISTORY plus worksheet formulas`. No variadic/range date lookup or SMF fallback semantics. |


### Economic series


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`smfGetEconData`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetEconData.bas#L8) | Read a FRED exact-date observation or requested series metadata label. | Partial | `CFFRED`. Latest 1–1000 observations and units/source available; no exact-date argument or full metadata-label interface. |


### Excel charts


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`smfInCellChart`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modInCellChart.bas#L2) | Draw line, bar or regression-slope pictures inside the calling Excel cell. | Excel-specific | `Google Sheets SPARKLINE and native charts`. No SMF drawing-object/size/color/slope interface. Native equivalents require new formulas. |


### Excel comments and images


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`RCHCreateComment`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfCreateComment_.bas#L2) | Create an Excel cell comment containing text or a chart image. | Excel-specific | `Native Google Sheets charts; CF Images links`. No Excel comment-object API or automatic provider-image insertion. Current template uses native numeric charts and manual links. |


### Excel formula evaluation


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`smfEval`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L405) | Evaluate a text expression through Excel's formula evaluator. | Excel-specific | No public Apps Script arbitrary formula-evaluation wrapper. |
| [`smfEvaluateTwice`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L413) | Evaluate a text expression twice through Excel. | Excel-specific | No public repeated formula-evaluation wrapper. |


### Excel logging


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`smfLogInternetCalls`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L14) | Enable, reset or delete a local CSV log of URL requests. | Excel-specific | `Apps Script execution logs and CF Sources`. No local smf-log.csv interface or exposed log-control formula. |


### HTML extraction


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`RCHExtractData`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modExtractData.bas#L2) | Extract one HTML table cell from fetched text using markers and offsets. | Not ported | No public marker/row/cell extractor. |
| [`RCHGetHTMLTable`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetHTMLTable.bas#L3) | Download an HTML table selected by text markers and direction. | Not ported | `Google Sheets IMPORTHTML for numbered tables`. No SMF marker/direction/row-only/output-size interface. Native table-index import is a different interface. |
| [`RCHGetTableCell`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetTableCell.bas#L2) | Download and extract one table cell by text markers, row and cell offsets. | Not ported | No generic table-cell recipe function. Provider-specific parsers only. |
| [`smfGetTagContent`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetTagContent.bas#L2) | Download an HTML tag's content selected by markers and occurrence. | Not ported | `Google Sheets IMPORTXML for XPath use cases`. No SMF tag/marker/occurrence/conversion interface or arbitrary source support. |
| [`smfHTMLDecode`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L532) | Decode SMF's supported HTML entities in text. | Not ported | No public entity-decoding formula; internal parsers cover only their own selected inputs. |
| [`smfStripHTML`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L470) | Strip HTML tags and decode selected entities. | Not ported | Internal provider text cleaning is not a public strip-HTML formula. |


### JSON extraction


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`smfJSONExtractField`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modJSONExtract.bas#L104) | Extract a path from raw JSON text. | Not ported | No public JSON-text/path extraction formula. Internal JSON.parse/Object.keys use does not implement the SMF worksheet interface. |
| [`smfJSONExtractField_x64`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modJSONExtract.bas#L139) | Extract a path from raw JSON with the64-bit-compatible parser. | Not ported | No public JSON-text/path extraction formula. Internal JSON.parse/Object.keys use does not implement the SMF worksheet interface. |
| [`smfJSONExtractKeys`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modJSONExtract.bas#L219) | List keys under a path in raw JSON. | Not ported | No public JSON-text/path extraction formula. Internal JSON.parse/Object.keys use does not implement the SMF worksheet interface. |


### Legacy Yahoo YQL


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`smfYahooAPIData`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modYahooAPIData.bas#L3) | Read old Yahoo YQL feed fields. | Retired | `CFQUOTE / CFFUNDAMENTALS / CFOPTIONS`. All YQL feeds A–F are confirmed retired; selected replacement fields use different APIs. |


### Legacy options


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`smfGet888OptionQuote`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetOptionQuotes.bas#L255) | Read one quote from the legacy OIC/iVolatility option endpoint. | Retired | `CFOPTIONS for Yahoo quotes`. Legacy source 8 is confirmed retired; Yahoo output is a separate source. |
| [`smfGetGoogleOptionQuote`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetOptionQuotes.bas#L607) | Read a contract field from the legacy Google option chain. | Retired | `CFOPTIONS for Yahoo quotes`. Legacy Google option chain is confirmed retired. |
| [`smfGetMSNOptionQuote`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetOptionQuotes.bas#L700) | Read an MSN contract field. | Retired | `CFOPTIONS for Yahoo quotes`. SMF marks this MSN option quote function obsolete. |
| [`smfGetOX2OptionQuote`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetOptionQuotes.bas#L1196) | Read a second optionsXpress quote format. | Retired | `CFOPTIONS for Yahoo quotes`. optionsXpress option source is confirmed retired. |
| [`smfGetOX3OptionQuote`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetOptionQuotes.bas#L1291) | Read a third optionsXpress quote format. | Retired | `CFOPTIONS for Yahoo quotes`. optionsXpress option source is confirmed retired. |
| [`smfGetOXOptionQuote`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetOptionQuotes.bas#L1082) | Read an optionsXpress contract field. | Retired | `CFOPTIONS for Yahoo quotes`. optionsXpress option source is confirmed retired. |


### Legacy quote CSV


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`RCHGetYahooQuotes`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetYahooQuotes.bas#L2) | Read old Yahoo ticker/quote codes, or a caller-supplied CSV URL when items are empty. | Partial | `CFQUOTE / CACHEFINANCE / CACHEFINANCES`. Ticker/quote-code mode is confirmed retired. Empty-items generic CSV URL mode remains separate and unported. |


### Numbered provider fields


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`RCHGetElementNumber`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetElementNumber.bas#L17) | Read a numbered field from SMF recipe files. | Partial | `CFFIELD`. Only selected Finviz/Zacks/GuruFocus IDs; no arbitrary recipe file, metadata fields, constants or general recipe interpreter. |


### Options


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`smfGetBarChartOptionQuote`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetOptionQuotes.bas#L407) | Read a Barchart contract field. | Not ported | No Barchart adapter. Not classified as confirmed retired from HTTP failures alone. |
| [`smfGetBigChartsOptionQuote`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetOptionQuotes.bas#L495) | Read a BigCharts contract field or history value. | Not ported | No BigCharts adapter or option-history field. |
| [`smfGetMWOptionQuote`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetOptionQuotes.bas#L960) | Read a MarketWatch contract field. | Not ported | No MarketWatch option adapter. |
| [`smfGetNASDAQOptionQuote`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetOptionQuotes.bas#L842) | Read a Nasdaq contract field or history value. | Not ported | No Nasdaq option adapter or option-history field. |
| [`smfGetOptionExpirations`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetOptionExpirations.bas#L3) | List published option expiration dates from a selected source. | Partial | `CFEXPIRATIONS`. Yahoo dates available; no SMF source/put-call/strike/period/output-dimension controls. Legacy modes retired separately. |
| [`smfGetOptionQuotes`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetOptionQuotes.bas#L3) | Return requested option fields for multiple contracts and selected sources. | Partial | `CFOPTIONS`. Yahoo chain table available for one expiration; no SMF item-code dispatcher, relative strikes or alternate-source interface. |
| [`smfGetOptionStrikes`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetOptionStrikes.bas#L3) | List option strikes or contract symbols for an expiration and source. | Partial | `CFOPTIONS plus UNIQUE/FILTER`. Strike/symbol columns available; no dedicated function or SMF source/relative-expiry/output controls. |
| [`smfGetYahooOptionQuote`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetOptionQuotes.bas#L1388) | Read a selected field for one Yahoo option contract. | Partial | `CFOPTIONS plus FILTER/INDEX`. Chain supplies bid/ask/last/IV/volume/OI/strike/date/symbol; no direct single-contract SMF item-code function or all quote-change fields. |
| [`smfGetYahooOptionQuote1`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetOptionQuotes.bas#L1475) | Read a selected Yahoo contract field through the older compatibility entry. | Partial | `CFOPTIONS plus FILTER/INDEX`. Mac delegates to smfGetYahooOptionQuote; Apps Script has no alias or complete item-code interface. |
| [`smfGetYahooOptionQuote2`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetOptionQuotes.bas#L1568) | Read Yahoo chain fields and relative-strike selections from HTML. | Partial | `CFOPTIONS plus FILTER/INDEX`. No relative-strike syntax, contract/day ranges or complete legacy item-code interface. |


### Options calendar


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`smfGetOptionExpiry`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetOptionExpiry.bas#L3) | Calculate weekly, monthly or quarterly calendar expiration dates. | Not ported | `CFEXPIRATIONS lists published dates`. Published ticker-specific dates do not implement calendar W1–W7/M1–M5/Q calculations or holidays. |


### Price history


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`RCHGetYahooHistory`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetYahooHistory.bas#L2) | Return Yahoo history with explicit dates, intervals, item columns and adjustment controls. | Partial | `CFHISTORY`. Daily history only, approximately two years and maximum510 sessions; no requested dates, weekly/monthly modes, arbitrary items or adjustment/resort controls. |
| [`RCHGetYahooHistory2`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetYahooHistory.bas#L103) | Return the alternative Yahoo history table and selected columns. | Partial | `CFHISTORY`. Same fixed daily seven-column table and510-session/two-year cap; SMF date/interval/adjustment/resort controls absent. |
| [`smfGetGoogleHistoryCSV`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfGetGoogleHistoryCSV_.bas#L4) | Download a legacy Google historical-price CSV table. | Not ported | `CFHISTORY for Yahoo daily history`. No Google CSV source or date/interval controls. A malformed legacy URL was repaired in the Mac port; this source is not declared retired by the registry. |
| [`smfGetMorningstarHistoryCSV`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfGetMorningStarCSV_.bas#L4) | Download a Morningstar historical-price CSV table. | Not ported | `CFHISTORY for Yahoo daily history`. No Morningstar provider or matching date/interval/output controls. Not declared retired by the reviewed registry. |
| [`smfGetMSNHistory`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetMSNHistory.bas#L2) | Download historical OHLCV rows from MSN. | Not ported | `CFHISTORY for Yahoo daily history`. MSN source and date/period/field controls are absent. Not classified as confirmed retired by the reviewed registry. |
| [`smfGetYahooHistory`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfGetYahooHistory_.bas#L7) | Return Yahoo history, dividends or splits with date/interval/item controls. | Partial | `CFHISTORY`. Fixed seven-column daily price table,510sessions/two-year cap; no event table/date bounds/weekly-monthly/resort/item selection. |
| [`smfGetYahooHistoryCSV`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfGetYahooHistoryCSV_.bas#L4) | Download Yahoo history, dividend or split CSV rows with requested dates and interval. | Partial | `CFHISTORY`. Daily OHLC/adjusted-close/volume table only; no CSV text export, date bounds, intervals or public dividend/split history table. |


### Provider fundamentals


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`smfGetADVFNElement`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetAdvFNElement.bas#L3) | Read an ADVFN annual or quarterly financial-statement element. | Not ported | No ADVFN provider or year-end lookup. Yahoo financial charts do not reproduce ADVFN fields. |
| [`smfGetGuruFocusCSVItem`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfGetGuruFocusCSVItem_.bas#L3) | Read a named field and period from GuruFocus's financial CSV export. | Not ported | No GuruFocus financial CSV export,30-year annual/120-quarter catalog or subscription authentication. |
| [`smfGetGuruFocusData`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetGuruFocusData.bas#L4) | Read a numbered GuruFocus valuation/quality item and historical offset. | Not ported | Two GuruFocus yield fields in CFFIELD do not implement this separate item catalog or offsets. |
| [`smfGetGuruFocusItem`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetGuruFocusItem.bas#L4) | Read a GuruFocus financial-statement item for TTM, annual or quarterly periods. | Not ported | No GuruFocus statement catalog, historical offset or premium-data support. |


### Quote-code metadata


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`smfYahooCodeDesc`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetYahooQuotes.bas#L236) | Describe legacy Yahoo CSV quote item codes. | Not ported | No legacy-code description table. Quote CSV source retirement does not require preserving code metadata. |


### Technical calculations


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`smfRSITargetPrices`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modRSITargetPrices.bas#L3) | Calculate current/previous RSI2 and low/high-trigger target prices with quote fields. | Not ported | RSI14 in the analysis is a different period and does not supply RSI2 buy/sell targets or the12-item output. |
| [`SMFTech`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modTechnicalAnalysis.bas#L9) | Calculate ADL, ATR, CCI, EMA, MACD, OBV, ROC, RSI, SMA or stochastic tables. | Partial | `CF Price history / CF Analysis / CF Research`. Only fixed RSI14/SMA20,50,200/EMA12,26/MACD12,26,9 in generated sheets. SMF MACD uses simple averages; CacheFinance uses exponential averages. No generic indicator formula or ADL/ATR/CCI/OBV/ROC/STO. |


### Text and number utilities


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`smfCDec`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L240) | Convert a string to a decimal-compatible numeric value. | Not ported | `Google Sheets VALUE / NUMBERVALUE`. Native conversion alternatives do not implement the SMF error/type semantics; internal Number use is not formula parity. |
| [`smfConvertData`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfConvertData_.bas#L2) | Convert scraped text according to a numbered conversion mode. | Not ported | Provider parsers have internal conversions, not a public SMF conversion-mode formula. |
| [`smfJoin`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L422) | Join range values with a delimiter. | Native alternative | `Google Sheets TEXTJOIN`. Native formula can join values. No smfJoin alias; blank/error/range semantics need a rewritten formula and separate checks. |
| [`smfStrExtr`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L368) | Extract text between start/end markers, with optional conversion. | Not ported | `Google Sheets REGEXEXTRACT / TEXT functions`. Native formulas can cover selected inputs; no SMF marker and conversion compatibility wrapper. |
| [`smfWord`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L433) | Return a selected delimited word, optionally reverse and convert it. | Native alternative | `Google Sheets SPLIT / INDEX`. No direct occurrence/reverse/conversion wrapper; equivalent formulas need explicit empty-token handling. |


### Web extraction


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`RCHGetWebData`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetWebData.bas#L2) | Download cached page text or a requested substring. | Not ported | No public raw-page/position/substring function. UrlFetchApp exists only inside the implementation. |
| [`smfGetWebPage`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L261) | Download/cache a full page with optional HTML conversion. | Not ported | No public raw-page/cache/conversion formula; provider parsers request only supported endpoints. |


### Yahoo fields


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`smfGetYahooJSONData`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetYahooJSONData.bas#L61) | Read Yahoo quote or financial time-series fields with period and raw/formatted processing. | Partial | `CFFUNDAMENTALS and CF Earnings/CF Research`. Selected current fields and worksheet earnings/financial charts; no arbitrary module/time-series field/period/raw-fmt-num arguments. |
| [`smfGetYahooJSONField`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetYahooJSONData.bas#L2) | Read a field from an arbitrary Yahoo module or caller-supplied JSON URL. | Partial | `CFQUOTE / CFFUNDAMENTALS`. Selected parsed fields only; no arbitrary module, JSON URL, field path or start-position interface. |


### Yahoo portfolio fields


| SMF function | Purpose | Coverage | Sheets replacement and remaining gap |
|---|---|---|---|
| [`smfGetYahooPortfolioView`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfGetYahooPortfolio_.bas#L3) | Return a multi-ticker Yahoo portfolio table with up to91 item codes. | Partial | `CF Watchlist / CFQUOTE / CFFUNDAMENTALS / CACHEFINANCES`. Watchlist20ticker cap and selected fields; no91-code order, duplicate-ticker and numeric-format interface. |


<details>
<summary>Implementation and test helpers: 51 functions</summary>



| SMF function | Purpose | Coverage |
|---|---|---|
| [`ConvertToIso`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/JsonConverter.bas#L1039) | Format a local VBA Date as an ISO8601 UTC string. | Internal helper; no public SMF alias |
| [`ConvertToJson`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/JsonConverter.bas#L205) | Serialize VBA values to JSON text. | Internal helper; no public SMF alias |
| [`ConvertToUtc`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/JsonConverter.bas#L932) | Convert a local VBA Date to UTC. | Internal helper; no public SMF alias |
| [`DecodeJsonString`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modJSONExtract.bas#L25) | Parse JSON through the Mac parser or Windows script engine. | Internal helper; no public SMF alias |
| [`fnWait`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L360) | Wait for a specified number of seconds. | Internal helper; no public SMF alias |
| [`GetKeys`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modJSONExtract.bas#L63) | List the property names or array indices of a parsed JSON node. | Internal helper; no public SMF alias |
| [`GetObjectProperty`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modJSONExtract.bas#L48) | Return an object or array property of a parsed JSON node. | Internal helper; no public SMF alias |
| [`GetProperty`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modJSONExtract.bas#L33) | Return a scalar or object property of a parsed JSON node. | Internal helper; no public SMF alias |
| [`ParseIso`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/JsonConverter.bas#L961) | Parse an ISO8601 string into a local VBA Date. | Internal helper; no public SMF alias |
| [`ParseJson`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/JsonConverter.bas#L172) | Parse a JSON string into VBA dictionaries and collections. | Internal helper; no public SMF alias |
| [`ParseUtc`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/JsonConverter.bas#L903) | Convert a UTC VBA Date to local time. | Internal helper; no public SMF alias |
| [`RCHGetURLData`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L195) | Dispatch a URL request to the configured transport and cache. | Internal helper; no public SMF alias |
| [`RCHGetURLData1`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L90) | Fetch a URL through the primary platform-specific transport. | Internal helper; no public SMF alias |
| [`RCHGetURLData1Mac`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacCode.bas#L18) | Fetch a URL through the macOS transport bridge. | Internal helper; no public SMF alias |
| [`RCHGetURLData2`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L131) | Fetch a URL through the alternate Windows transport. | Internal helper; no public SMF alias |
| [`RCHGetURLData3`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L174) | Fetch a URL through a third Windows transport. | Internal helper; no public SMF alias |
| [`RCHGetURLData4`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L551) | Fetch Yahoo data with its session-cookie/crumb transport. | Internal helper; no public SMF alias |
| [`smfBuildYahooTimeSeriesURL`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetYahooJSONData.bas#L129) | Construct a Yahoo financial time-series request URL. | Internal helper; no public SMF alias |
| [`smfChkJSONFieldType`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modJSONExtract.bas#L201) | Return the VBA type of a JSON field. | Internal helper; no public SMF alias |
| [`smfConvertYahooTicker`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfConvertYahooTicker_.bas#L2) | Convert a Yahoo ticker for another named provider. | Internal helper; no public SMF alias |
| [`smfGetAConstants`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetElementNumber.bas#L861) | Read the loaded numbered-field constant array. | Internal helper; no public SMF alias |
| [`smfGetAData`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L339) | Read the cached raw webpage data array. | Internal helper; no public SMF alias |
| [`smfGetaFiles`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetElementNumber.bas#L868) | Read the loaded numbered-field filename array. | Internal helper; no public SMF alias |
| [`smfGetAParms`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetElementNumber.bas#L857) | Read the loaded numbered-field parameter array. | Internal helper; no public SMF alias |
| [`smfGetYahooHistoryCSVData`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfGetYahooHistoryCSV_.bas#L98) | Fetch and cache Yahoo history CSV content from a supplied download URL. | Internal helper; no public SMF alias |
| [`SMFMacElementsSelfTest`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetElementNumber.bas#L774) | Run built-in checks for Mac element-definition loading and extraction. | Internal helper; no public SMF alias |
| [`SMFMacEmptyRecipeSelfTest`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetElementNumber.bas#L987) | Run built-in checks for empty numbered-field recipes. | Internal helper; no public SMF alias |
| [`smfMacFetch`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacCode.bas#L27) | Fetch a URL with a GET or other supported HTTP method through the Mac helper. | Internal helper; no public SMF alias |
| [`SMFMacHistoryCSVSelfTest`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfGetYahooHistoryCSV_.bas#L284) | Run built-in checks for Yahoo Chart JSON conversion to CSV. | Internal helper; no public SMF alias |
| [`smfMacHTMLSelfTest`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacHTML.bas#L414) | Run built-in checks for Mac HTML text and entity parsing. | Internal helper; no public SMF alias |
| [`SMFMacHTTPStatus`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacCode.bas#L225) | Return the most recent Mac HTTP status. | Internal helper; no public SMF alias |
| [`SMFMacIntegrationSelfTest`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacIntegrationTests.bas#L4) | Run built-in checks for Mac extraction integration. | Internal helper; no public SMF alias |
| [`SMFMacJSONSelfTest`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacJSONTests.bas#L8) | Run built-in checks for JSON parsing and path extraction on Mac. | Internal helper; no public SMF alias |
| [`SMFMacLastError`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacCode.bas#L229) | Return the most recent Mac transport error. | Internal helper; no public SMF alias |
| [`SMFMacLastFileError`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacCode.bas#L587) | Return the most recent Mac element-file error. | Internal helper; no public SMF alias |
| [`SMFMacLastURL`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacCode.bas#L233) | Return the most recent redacted Mac request URL. | Internal helper; no public SMF alias |
| [`SMFMacNestedRecipeSelfTest`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacIntegrationTests.bas#L245) | Run built-in checks for nested extraction recipes. | Internal helper; no public SMF alias |
| [`smfMacReadElementLocation`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacCode.bas#L591) | Read the configured Mac element-definition location. | Internal helper; no public SMF alias |
| [`smfMacReadElementText`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacCode.bas#L573) | Read an element-definition text file through the Mac file bridge. | Internal helper; no public SMF alias |
| [`smfMacReadResponse`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacCode.bas#L189) | Read the Mac transport response file and enforce size/type guards. | Internal helper; no public SMF alias |
| [`SMFMacRecipeSelfTest`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacIntegrationTests.bas#L24) | Run built-in checks for tag-content recipes. | Internal helper; no public SMF alias |
| [`smfMacStripHTML`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacHTML.bas#L20) | Strip HTML with the Mac-compatible parser. | Internal helper; no public SMF alias |
| [`SMFMacTableGuardSelfTest`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetElementNumber.bas#L920) | Run built-in checks for Mac table-cell extraction guards. | Internal helper; no public SMF alias |
| [`SMFMacTableRecipeSelfTest`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacIntegrationTests.bas#L101) | Run built-in checks for table-cell recipes. | Internal helper; no public SMF alias |
| [`SMFMacTransportSelfTest`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacCode.bas#L605) | Run built-in checks for Mac URL transport. | Internal helper; no public SMF alias |
| [`smfMacTryNestedRecipe`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacCode.bas#L347) | Interpret supported nested numbered-field recipe expressions. | Internal helper; no public SMF alias |
| [`smfMacTryTableCellRecipe`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacCode.bas#L292) | Interpret a table-cell expression from a numbered-field recipe. | Internal helper; no public SMF alias |
| [`smfMacTryTagContentRecipe`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMacCode.bas#L247) | Interpret a tag-content expression from a numbered-field recipe. | Internal helper; no public SMF alias |
| [`smfMacYahooChartCSV`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfGetYahooHistoryCSV_.bas#L208) | Convert accepted Yahoo Chart JSON into history/dividend/split CSV. | Internal helper; no public SMF alias |
| [`smfMacYahooDownloadCSV`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfGetYahooHistoryCSV_.bas#L164) | Translate a Yahoo download request to a supported Mac history fetch. | Internal helper; no public SMF alias |
| [`smfMacYahooDownloadURL`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfGetYahooHistoryCSV_.bas#L151) | Recognize a supported Yahoo history download URL. | Internal helper; no public SMF alias |


</details>



## Macros outside the 121-function count

The source inventory lists all 28 public Subs, including definition loaders and development commands.
The following user-facing commands require separate treatment.


| SMF macro | Coverage | Sheets behavior or remaining gap |
|---|---|---|
| [`smfShowSourceStatus`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetElementNumber.bas#L1248) | Partial | CF Sources/CFDATASTATUS cover current implemented requests; no SMF retirement-registry compatibility layer. |
| [`Auto_Open`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMenu.bas#L183) | Equivalent menu purpose | onOpen creates CacheFinance and Stock analysis menus in the bound Google Sheet. |
| [`Auto_Close`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modMenu.bas#L191) | Excel-specific | No add-in unload operation in a bound Google Sheet. |
| [`RCHInsertPicture`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modPictureInsert.bas#L2) | Excel-specific | CF Images supplies manual provider links; no image-insertion equivalent. |
| [`RCHTogglePicture`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modPictureToggle.bas#L2) | Excel-specific | No Excel drawing-object toggling. |
| [`smfToggleCommentPicture`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfCreateComment_.bas#L322) | Excel-specific | No Excel picture-comment equivalent. |
| [`smfUpdateDownloadTable`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfDownloadTable_.bas#L2) | Not ported | CF Watchlist is a fixed20-row/selected-column report; no arbitrary per-column SMF formula/recipe table. |
| [`smfOpenLogFile`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L35) | Excel-specific | Apps Script execution logs are available; no local file UI. |
| [`smfForceRecalculation`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L60) | Partial | Stock analysis refresh commands and formula refresh counters serve selected refresh purposes; no Excel full-rebuild macro. |
| [`smfASyncOn`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L82) | Internal helper | No Windows transport to toggle. |
| [`smfASyncOff`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L86) | Internal helper | No Windows transport to toggle. |
| [`smfFixLinks`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfUtilities_.bas#L343) | Excel-specific | No Excel external add-in links in a bound Apps Script copy. |
| [`UpdateStockDatabase`](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/smfxDatabaseUpdate_.bas#L2) | Not ported | No all-fields/provider-sheet database updater. |


## Next implementation checklist

These tasks remain open. The order favors data and functions that already have useful Mac reference cases.
Effort labels describe implementation with tests, assuming the provider accepts requests from Apps Script.
Provider access can prevent a repair regardless of coding effort.
Small tasks extend an existing parser or API.
Medium tasks add selectors, calculations or a new provider parser.
Large tasks add general extraction engines or many compatibility arguments.

| Done | Task | Effort | Evidence required before closing |
|---|---|---|---|
| [ ] | Add RSI2 target-price calculations and selectors | Medium | Port the existing controlled Mac cases. Compare trigger targets and quote fields in Sheets. |
| [ ] | Add exact-date FRED lookup and selected metadata selectors | Small–medium | Match exact dates, missing observations, units and caller errors with a private key. |
| [ ] | Add ADVFN latest annual year-end lookup | Small parser, access unverified | First obtain a matching live response from Apps Script. Then port the year-end fixtures and regional-host cases. |
| [ ] | Expand Yahoo history date/interval/event controls | Medium–large | Compare ordering, dates, adjusted close, dividends, splits and weekly/monthly periods. |
| [ ] | Add generic HTML table/cell/tag and CSV/JSON extraction | Large | Define public arguments, port parsing fixtures and test actual worksheet results and blocked pages. |
| [ ] | Add a generic technical-indicator function | Medium | Port RSI/ATR/CCI/OBV/ROC/STO cases. Make the requested MACD calculation explicit. |
| [ ] | Expand option item codes and direct contract lookups | Medium–large | Test expired, missing, crossed, zero, adjusted and nonstandard contracts. Preserve provider timestamps. |
| [ ] | Expand numbered-field aliases by provider | Small per simple field, variable access | Map the exact metric and units. Require fixtures, invalid-ticker rejection and a direct Apps Script check. |
| [ ] | Decide whether to add original SMF names and argument lists | Large, separate project | Import representative SMF examples and compare each rewritten or compatible formula. |
| [ ] | Test the template from a new account and a full 20-ticker watchlist | Medium | Complete copying, authorization, key isolation, cold/warm refreshes and runtime checks. |

## Sources and update rules

The comparison uses the following fixed sources:



- [SMF source commit](https://github.com/dnarain/SMF_Add-in/tree/60014079d08eadc489ed0ad01427d1807450c657).

- [Public function inventory](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/mac/test-results/0.7-dev-20261109-final/full/function-inventory.json).

- [Mac reference results](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/mac/test-results/0.7-dev-20261109-final/full/function-status.csv).

- [Retirement registry](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/mac/not_supported.json).

- [Default field loader](https://github.com/dnarain/SMF_Add-in/blob/60014079d08eadc489ed0ad01427d1807450c657/code/modGetElementNumber.bas#L230).

- [CacheFinance source commit](https://github.com/dnarain/cachefinance/tree/8842b97f474ae56c52431665bf2c3bbdbb858b86).

- [SMF documentation index](https://climbermel.github.io/SMF_Add-in/Documentation/).


This checklist records a source comparison and existing evidence. It adds no provider or compatibility function.

1. Record the source commits before changing a status.
2. Keep function coverage separate from provider availability and legacy retirement.
3. Add a source link and a relevant test before marking a task available.
4. Identify whether the evidence came from local fixtures, Excel or Google Sheets.
5. Keep failed provider requests, absent values and confirmed retirement separate.
6. Recalculate counts from the CSV and JSON after editing their records.
