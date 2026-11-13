# Data providers and testing

TickerSheets requests data from Apps Script in your Google account.
It uses public Yahoo Finance, Finviz, Zacks and GuruFocus data.
Optional keyed functions request Finnhub, Alpha Vantage, Twelve Data, CoinMarketCap and FRED.
It requires no hosted server.

## Providers

| Source | Functions and data | Personal key |
|---|---|---|
| Yahoo Finance | Quotes, available pre-market/after-hours prices, daily history, fundamentals, earnings, events, expiration dates and standard option chains | No |
| Finviz | 32 selected fields through `TICKERSHEETS_FIELD`; spot price and forward yield in quote comparisons | No |
| Zacks | Average analyst price target through `TICKERSHEETS_FIELD` | No |
| GuruFocus | Public forward and trailing dividend yields through `TICKERSHEETS_FIELD`; forward yield only in quote comparisons | No |
| Finnhub | Selected quote fields through `TICKERSHEETS_PROVIDER_QUOTE` | Your Finnhub API key |
| Alpha Vantage | Selected quote fields through `TICKERSHEETS_PROVIDER_QUOTE` | Your Alpha Vantage API key |
| Twelve Data | Selected quote fields through `TICKERSHEETS_PROVIDER_QUOTE` | Your Twelve Data API key |
| CoinMarketCap | Selected cryptocurrency quote fields through `TICKERSHEETS_PROVIDER_QUOTE` | Your CoinMarketCap API key |
| FRED | Recent economic observations and exact-date observation values | Your FRED API key |

Yahoo requests use its [Chart endpoint](https://query1.finance.yahoo.com/v8/finance/chart/NVDA), [quote pages](https://finance.yahoo.com/quote/NVDA/) and option endpoints.
Options use a temporary anonymous session.
The script does not ask for a personal Yahoo login.

The field adapters read [Finviz quote pages](https://finviz.com/quote.ashx?t=NVDA&p=d), [Zacks price-target pages](https://www.zacks.com/stock/research/NVDA/price-target-stock-forecast) and [GuruFocus dividend pages](https://www.gurufocus.com/stock/NVDA/dividend).
FRED requests use the official [series](https://fred.stlouisfed.org/docs/api/fred/series.html) and [observations](https://fred.stlouisfed.org/docs/api/fred/series_observations.html) APIs.

The three field adapters expose **35 named fields**, including **34 numeric field IDs**.
The [function reference](FUNCTIONS.md#tickersheets_field) lists them and their units.
A subscription on a provider's website does not automatically grant this script access.
The current adapters use public data and accept no subscription credentials.

### Comparison rows and missing values

`TICKERSHEETS_QUOTE_COMPARE` returns separate Yahoo regular, Yahoo website regular, pre-market, after-hours, Finviz and GuruFocus rows.
Each row retains its own source, status, timestamp and data meaning.
The GuruFocus row contains forward yield only. Its price remains unavailable.
The Zacks analyst target is not a spot price and is excluded from that table.
A missing forward yield does not silently become trailing yield.

An accepted response can still lack individual fields.
Yahoo can omit an after-hours price, an option leg or a company statistic.
A recent request does not establish a recent trade.
Keep unavailable values distinct from numeric zeros.

### API keys

Choose **TickerSheets → API keys…** and enter your own keys in the matching provider fields.
Click **Save keys**.
The form supports Finnhub, Alpha Vantage, Twelve Data, CoinMarketCap and FRED.
The script stores keys in Script Properties and never returns saved key values to the browser.
A **Saved** label confirms storage and does not test provider access.
The [function reference](FUNCTIONS.md#keys-and-sharing) lists the property names.

`TICKERSHEETS_PROVIDER_QUOTE` requests only the provider selected in its formula.
The function requires that provider's key. Your plan controls access, request limits and quote delays.
These keys do not change the Yahoo source used by `TICKERSHEETS_QUOTE`.

Keep copies with keys private. Spreadsheet editors can access the attached script and its properties.
Do not include keys, authenticated request URLs, cookies or raw response bodies in reports.
See [INSTALL.md](INSTALL.md#if-the-sidebar-is-blank) if the key form appears blank.

## Historical provider observations

These observations came from selected Google Sheets runs on **November 11–12, 2026, Pacific time**, before the 2.0 API rename and cleanup.
They describe those source requests and do not establish that every field or the current release works today.

| Source | Recorded observations and limits |
|---|---|
| Yahoo | Selected NVDA/AAPL quotes, history, fundamentals, earnings and RSI2 requests returned accepted data. Some fields and source timestamps were missing. Optional bid/ask requests remained unavailable. |
| Yahoo options | Overnight checks lacked usable ATM pairs. Later market-hours requests returned five sampled maturities for NVDA/AVGO with usable quotes and model inputs. Results depended on the returned contracts. |
| Finviz | All 32 selected fields returned accepted values for NVDA/AAPL. A deliberately invalid ticker returned no fields. Broader website features were outside the adapter. |
| Zacks | The selected average-target field returned accepted values for NVDA/AAPL. An invalid ticker returned no fields. |
| GuruFocus | Both public yield fields returned accepted values for NVDA/AAPL after a parser repair. An invalid ticker returned no accepted fields. Premium datasets were outside the adapter. |
| FRED | Selected DGS10, FEDFUNDS, CPIAUCSL, UNRATE and DGS2 requests returned observations. Exact ISO/date-cell lookups agreed. Missing dates remained unavailable and published units remained unchanged. |

Worksheet agreement does not independently reconcile prices with exchange records or earnings with company filings.
Current release checks must separately confirm access from Google's network.

## Test the current library

1. Install the normal bundle with [INSTALL.md](INSTALL.md), or use a private demo copy.
2. Enter `NVDA` in **Start here!B4**.
3. Wait for the nine values in **B7:B15** and inspect their formula text in **C7:C15**.
4. Choose **TickerSheets → Refresh data** and wait for the results.
5. Change the ticker to `AAPL` and inspect the returned values again.
6. Try a deliberately invalid ticker. Missing prices must not become numeric zeros.
7. Restore the intended ticker.

Read the selected session and quote timestamp before comparing prices.
An unavailable field can remain `N/A` without a spreadsheet syntax error.
The **Stock analysis** and **Options analysis** tabs use the same functions.
Check the formulas behind their results and chart ranges separately.

### Test keyed quotes

The restored keyed adapters require separate checks with your own keys in a private copy.
The public demo has no saved keys and does not establish access to these four quote APIs.

1. Save your key through **TickerSheets → API keys…**.
2. Enter a formula for that provider in an empty cell.
3. Compare its result with the provider's response for the same symbol and observation time.
4. Read the returned timestamp or observation date before comparing providers.

```excel
=TICKERSHEETS_PROVIDER_QUOTE("NVDA","FINNHUB","price")
=TICKERSHEETS_PROVIDER_QUOTE("NVDA","ALPHA_VANTAGE","price")
=TICKERSHEETS_PROVIDER_QUOTE("NVDA","TWELVE_DATA","price")
=TICKERSHEETS_PROVIDER_QUOTE("BTC","COINMARKET","price")
```

Use `"all"` for the field argument to inspect the provider's returned fields in a two-column table.
Missing keys, blocked requests, exhausted quotas and unavailable symbols must remain unavailable results.
The adapters do not silently substitute Yahoo quotes for a failed keyed request.

### Exercise each dataset

Put each table formula in a separate empty area of a private worksheet.

| Dataset | Example and checks |
|---|---|
| History | `=TICKERSHEETS_HISTORY("NVDA",252)`: seven columns, chronological rows, valid zeros and missing prices |
| Expirations | `=TICKERSHEETS_EXPIRATIONS("NVDA")`: published dates in one column |
| Options | `=TICKERSHEETS_OPTIONS("NVDA")`: twelve columns with matching ticker, expiration, type, strike and standard contract identifier |
| Earnings | `=TICKERSHEETS_EARNINGS("NVDA","earnings")`: retain reported periods, accounting basis, currency and missing values |
| Other reported data | Repeat earnings requests with `financials`, `estimates`, `dividends`, `splits` and `calendar` |
| Finviz | `=TICKERSHEETS_FIELD("FINVIZ","NVDA","rsi14")` |
| Zacks | `=TICKERSHEETS_FIELD("ZACKS","NVDA","target_price")` |
| GuruFocus | `=TICKERSHEETS_FIELD("GURUFOCUS","NVDA","forward_dividend_yield")` |
| FRED history | With your own saved key, `=TICKERSHEETS_FRED("DGS10",60)`: retain published units and observation dates |
| Exact-date FRED | `=TICKERSHEETS_FRED_VALUE("DGS10","2026-11-05")`: use that exact date and preserve missing observations |
| Models | Compare fixed examples from [FUNCTIONS.md](FUNCTIONS.md) with known results independently of live quotes |

For source status, use `=TICKERSHEETS_DATA_STATUS("NVDA","quote")` in an empty five-column area.
For a field provider, use `=TICKERSHEETS_DATA_STATUS("NVDA","provider","FINVIZ")`.
Status calls can request data when their matching cache is empty.

Include an unsupported ticker and unavailable field in each relevant set of checks.
For FRED, test a published zero, a missing observation, an absent exact date and a missing key.
For options, check partial and crossed bid/ask pairs, missing IV and mismatched contract identities.
Report unexpected `#REF!`, `#VALUE!`, circular references or blocked table outputs.

### Check the caches

Use an empty area in a private spreadsheet.

1. Enter a supported ticker that this project did not recently request in `A1`.
2. Enter `=TICKERSHEETS_DATA_STATUS($A$1,"history")` in `B1`.
3. Immediately enter `=TICKERSHEETS_DATA_STATUS($A$1,"HISTORY")` in `B5`.
4. Compare **Cached** and **Retrieved at**.

The uppercase dataset argument selects the same internal history cache through a different worksheet formula.
A cache hit retains its retrieval time.
Both results can already be cached if the project recently requested that ticker.
Google can [remove cache entries early](https://developers.google.com/apps-script/reference/cache/cache), so a repeated miss does not establish a provider defect.
A cache hit does not establish a fresh quote.

### Run local checks

Use Node.js 22 or later and npm. From a fresh checkout:

```sh
npm ci --ignore-scripts
npm test
npm run build:check
```

After source changes, regenerate the bundle and run the checks:

```sh
npm run build
npm run build:check
npm run test:coverage
```

Commit the source changes, tests and generated bundle together.
Public fixtures and tests stay in [test/](test/).
Local tests use controlled responses. They cannot establish current provider access from Google Apps Script.
Do the native worksheet checks separately and record their date, ticker and actual result.

## Report results

Include the exact formula, ticker, expected result, actual result, observation time and request date.
Distinguish an unavailable field, a blocked request and a spreadsheet error.
Keep cold-cache, warm-cache and direct-provider comparisons separate.
Review reports for keys and personal data before sharing them.
