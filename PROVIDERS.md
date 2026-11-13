# Data providers and testing

TickerSheets requests data from Google Apps Script. No hosted server is required.
The table lists the fields this project reads and selected Google Sheets results from **November 11–12, 2026, Pacific time**.
Those saved results do not guarantee access today, every ticker or every feature of a provider.
The current public tutorial has one **Start here** tab.
The historical workbook checks in this file used a former multi-tab layout.

See [INSTALL.md](INSTALL.md) for setup and [FUNCTIONS.md](FUNCTIONS.md) for arguments, output columns and units.

## Providers

| Provider | Available requests or former workbook use | Authentication | Saved Google Sheets result and limits |
|---|---|---|---|
| Yahoo Chart | Regular-session quotes, daily history and inputs for RSI2 targets; original quote adapter | No personal key | Prices/names passed for AAPL, NVDA, RY and XIC. Research history and RSI2 checks passed for selected NVDA/AAPL inputs. Optional bid/ask values were unavailable. |
| Yahoo Finance website | Selected fundamentals, earnings, estimates, regular/pre-market/post-market quotes; original price/name/yield adapter | No personal key | Selected NVDA/AAPL tables passed. The repaired original adapter accepted price/name/yield for AAPL, NVDA, RY and XIC. Active-session NVDA checks passed. Some fields and source timestamps remain unavailable. |
| Yahoo options | Published expirations and standard option chains | Temporary anonymous Yahoo session; no personal login | November 11 overnight checks lacked usable ATM pairs. The former workbook's November 12 market-hours checks returned all five ATM comparisons and numeric calculator results for NVDA/AVGO. Availability depends on the returned quotes. |
| Google Finance website | Comparison price, name and selected yields; original quote adapter | No key | AAPL, NVDA, RY, XIC and USD/CAD prices passed after repairs. XIC yield remained missing. Website results do not establish Google's separate `GOOGLEFINANCE` worksheet results. |
| Globe & Mail | Comparison price, name and yield; original quote adapter | No stored login | Selected fields passed for AAPL, NVDA, RY, XIC and DYN2752. The repaired parser matched quote identifiers and recorded trade time. Stock yield uses the provider's trailing basis. |
| Finnhub | Price through the original adapter | Your API key | AAPL/NVDA prices and quote timestamps passed. This adapter does not implement Finnhub's broader API. |
| Twelve Data | Price and name through the original adapter | Your API key | AAPL, NVDA and USD/CAD passed. The recorded timestamp describes interval opening, not necessarily the last price update. |
| Alpha Vantage | Price through the original adapter | Your API key | AAPL, NVDA and USD/CAD passed on recheck. Stock quotes carried November 10 dates. Provider-local FX time was preserved without an assumed UTC offset. |
| CoinMarketCap | Cryptocurrency price and name through the original adapter | Your API key | BTC/USD and ETH/USD passed with `quote.last_updated`. This adapter does not supply stock fundamentals or options. |
| FRED | Recent observations with `CFFRED`; exact-date values with `CFFREDVALUE` | Your FRED API key | DGS10, FEDFUNDS, CPIAUCSL, UNRATE and DGS2 passed selected checks. Exact ISO/date-cell lookups agreed; missing dates returned explanatory text without substituting earlier values. Published units remain unchanged. |
| Finviz | 32 selected fields through `CFFIELD` | No stored login | All 32 fields returned accepted values for NVDA/AAPL. The deliberate invalid ticker returned no fields. Broader Finviz data and account features are outside this adapter. |
| Zacks | Average price target through `CFFIELD` | No stored login | The selected field passed for NVDA/AAPL. The deliberate invalid ticker returned no fields. Other Zacks fields are outside this adapter. |
| GuruFocus | Public forward/trailing dividend yields through `CFFIELD` | No stored login | Both fields passed for NVDA/AAPL after the parser repair. An invalid ticker returned no accepted fields. Premium datasets and subscription credentials are outside this adapter. |
| StockCharts | Manual chart-page links in the former workbook | Open the page separately | The former workbook downloaded no provider images and inserted no pictures. Its native charts used accepted numeric tables. |
| ADVFN | Excluded | — | Our November 11 Apps Script requests received HTTP 403 from Cloudflare. This project does not include its adapter. |

The three `CFFIELD` providers expose **35 named fields**, including **34 numeric field IDs**.
The full field list appears in [FUNCTIONS.md](FUNCTIONS.md#cffield).
A successful request does not establish that every field in its response is usable.
Yields, earnings bases and timestamps can differ between providers.

### Historical checks of the former workbook: November 12

These checks used the former multi-tab analysis workbook.
They describe that layout and its available sources. The current tutorial requires separate checks.

The private AVGO workbook and public NVDA sample loaded quotes, history, fundamentals, earnings and option chains.
Both accepted all five sampled option maturities and produced numeric option-model results.
Finviz, Zacks and GuruFocus returned all 35 selected fields for both tickers.
The private workbook loaded its four default FRED series.
The public sample contained no saved keys and correctly reported that FRED required a key.
Both five-ticker watchlists refreshed. One initial private-workbook request failed, then passed on retry.

The final lookup worksheet run passed **18 cases**, with **0 failures, blocked cases or pending cases**.
An earlier run reported one AAPL comparison mismatch. A fresh snapshot passed all 18 cases.
Live quotes can change between worksheet calculation and a later direct comparison.
Inspect a mismatch and its source times before deciding whether the calculation or the data changed.
Worksheet/function agreement does not independently reconcile financial values against exchange data or company filings.

We also verified the November 12 upgrade of 14 application tabs in the private workbook and 13 in the public sample.
Both workbooks used the title **Single Stock Analysis** during those checks. The maintained sample is now **TickerSheet Demo and Tutorial**.
Ticker/expiration inputs, strategy assumptions, watchlist tickers and journal rows remained unchanged during the rename.
Both workbook inspections reported zero formula errors and retained their charts and models.
We have not verified installation and authorization from a new Google account.

### API keys

Choose **Data settings → API keys…** in your private spreadsheet copy.
Blank fields preserve saved keys; **Remove saved key** deletes a key when you save.
The **Saved** label confirms that a property exists. It does not test provider access.

| Provider | Script Property |
|---|---|
| Finnhub | `FINNHUB_API_KEY` |
| Alpha Vantage | `ALPHA_VANTAGE_API_KEY` |
| Twelve Data | `TWELVE_DATA_API_KEY` |
| CoinMarketCap | `COINMARKET_API_KEY` |
| FRED | `FRED_API_KEY` |

FRED requires [each user to supply their own key](https://fred.stlouisfed.org/docs/api/api_key.html).
The script stores keys in [Script Properties](https://developers.google.com/apps-script/guides/properties), outside worksheet cells.
Other spreadsheet editors can access the bound script and its properties. Keep copies with personal keys private.
Do not share keys, authenticated request URLs, cookies or raw response bodies in reports.
The [installation guide](INSTALL.md#if-the-sidebar-is-blank) explains the blank-sidebar workaround.
All five keyed providers use **Data settings → API keys…**.

## Testing process

Local tests check parsers, calculations, caching and worksheet behavior with controlled responses.
A run inside Google Apps Script checks access from Google's network.
A successful request from a local computer cannot replace a failed Google Sheets result.

### Check the current tutorial

Use a private copy of the tutorial with the normal bundle from [INSTALL.md](INSTALL.md).

1. Enter `NVDA` in **Start here!B4** and wait for **B7:B15** to finish.
2. Inspect **B7**, **B8** and **B9** for the latest, regular-session and after-hours price formulas.
3. Check that **C7:C15** shows the formula text from the corresponding result cells.
4. Choose **Data settings → Refresh formulas**, then wait for its results.
5. Change **B4** to `AAPL` and inspect the formulas and returned values again.
6. Try an invalid ticker. Unavailable prices and fields must not become numeric zeros.
7. Restore the intended ticker after the checks.

An unavailable after-hours price or fundamental field can remain `N/A`.
Inspect the selected session and quote timestamp before comparing prices.
These checks exercise the installed functions in ordinary cells.

For a developer readback, open Apps Script and run `CFInspectTutorial`.
It compares the nine result formulas with their expected formulas, reads their values and reports loading or spreadsheet errors.
It reads the actual worksheet cells and makes no provider requests.
The report does not independently establish the accuracy of a financial value.

The single-tab update was checked in Google Sheets with `NVDA` and `AAPL`.
All nine result formulas matched their expected text, with no spreadsheet errors or pending calculations.
The unavailable AAPL earnings date remained `N/A`.
A separate `=CFQUOTE(F1,"price")` call returned the AAPL price from a ticker in `F1`, independently of the tutorial's input cell.
The public tutorial retained only **Start here**, and all five saved-key presence flags were false.

### Check the library functions

Use separate empty areas in a private worksheet for these calls.
Only the first cell of each returned table contains its formula.

| Area | Formula or assertion |
|---|---|
| Daily history | `=CFHISTORY("NVDA",252)`: seven columns, a header and chronological rows. Preserve missing closing prices and real zeros. |
| Expiration dates | `=CFEXPIRATIONS("NVDA")`: a header and published dates in one column. |
| Option chain | `=CFOPTIONS("NVDA")`: twelve columns for the default published expiration. Check ticker, expiration, option type, strike and units. |
| Earnings | `=CFEARNINGS("NVDA","earnings")`: retain reported periods, EPS basis, currency and missing values. |
| Other earnings sections | Repeat with `financials`, `estimates`, `dividends`, `splits` and `calendar` in separate empty areas. |
| Recent FRED data | With your own saved key, `=CFFRED("DGS10",60)`: five columns with the published units and observation dates. |
| Exact-date FRED | `=CFFREDVALUE("DGS10","2026-11-05")`: compare with that exact observation. Missing dates must not substitute an earlier business day. |
| FRED missing values | Missing keys and published gaps remain unavailable. Preserve a numeric zero. |
| Option and strategy models | Use fixed assumptions from [FUNCTIONS.md](FUNCTIONS.md) and compare with known results independently of live quotes. |
| Formula errors | Report unexpected `#REF!`, `#VALUE!`, circular references or blocked table outputs. |

For source status, put `=CFDATASTATUS("NVDA","quote")` in an empty five-column area.
It returns status, retrieval time, quote time, cache status and source.
Use the same ticker and request arguments when comparing it with a data formula.
`CFDATASTATUS` can request data if its cache is empty.
Its result does not prove that the provider's quote is current.

Local tests inspect parsers, formula text and controlled results.
A Google Sheets run must separately check current provider access, returned tables and loading behavior.

### Historical checks of the former formula workbook

These results predate the single-tab tutorial and do not establish a pass for its current layout.

The **November 12, 2026 formula-workbook checks** included:

- AAPL: **5,534 checks passed**, including **5,102 numerical comparisons**, with no formula failures or pending calculations.
- The former public sample passed **5,534 checks** for AAPL and again after switching back to NVDA. No formula failures or pending calculations remained. All five option tables waited for the current expiration response before requesting their chains.
- **26 controlled worksheet cases passed** for conflicting and repeated earnings records, missing periods, zero denominators, same-strike option pairs, partial IV, and FRED gaps and zeros.
- All five AAPL maturities returned quotes and IV after removing volatile date dependencies. Option prices and Greeks recalculated after changing the selected expiration.
- All nine invalid-ticker assertions passed. Missing prices, RSI targets and expiration dates stayed unavailable, with no false zeros or 1899 dates.
- That public template's five provider-key settings were all empty.

These checks used public stock and option sources.
That run checked FRED's worksheet calculations with controlled observations and did not use a live FRED key.
The former workbook used a written calculation date in **Analysis!K4** because custom functions require deterministic inputs.
See [Google's argument rules](https://developers.google.com/apps-script/guides/sheets/functions#arguments).

The **November 12 direct-field sample update** passed **5,535 worksheet checks** for the former public NVDA sample.
No failed or pending checks remained after its normal Refresh action.
Its value columns contained **29 `CFQUOTE` formulas** and **63 `CFFUNDAMENTALS` formulas**.
Five copied AAPL formulas also passed on a separate tab with only a ticker cell and no refresh argument.
That version exposed no refresh-number controls and contained no saved provider keys.

### Run the eight original adapter checks

Use a **separate private spreadsheet** for the diagnostic bundle.
Do not add it beside the normal bundle; both bundles define the same functions.

1. Create a blank Google spreadsheet and open **Extensions → Apps Script**.
2. Replace `Code.gs` with [dist/TickerSheetsProviderTests.js](dist/TickerSheetsProviderTests.js).
3. Save the project. Use the [supplied manifest](apps-script/provider-tests/appsscript.json) if setting scopes explicitly.
4. Select `RunProviderTests` in Apps Script and click **Run**. Complete Google's authorization steps.
5. Reload the spreadsheet. Save any provider keys through **Data settings → API keys…**.
6. Choose **Provider tests → Start provider tests** to create a new report.
7. Choose **Continue provider tests** until no pending rows remain.
8. To rerun one provider, choose its entry in **Provider tests**, then continue any remaining rows.
9. Choose **Set up worksheet checks**, wait for calculation, then choose **Collect worksheet results**.
10. Choose **Export report JSON** for a sanitized report in **Test report**.

The eight adapters are Yahoo Chart, Google Finance website, Globe & Mail, Yahoo Finance website, Finnhub, Twelve Data, Alpha Vantage and CoinMarketCap.
The runner bypasses financial caches and fallback providers. Each batch makes at most four distinct requests.
Missing keys leave the corresponding cases untested.
A provider rerun clears that provider's prior results.

The saved November 11 adapter report contained 60 parsed fields, 10 invalid-ticker rejections and one missing field across 117 cases.
The remaining cases were unsupported attributes or symbols. No false positive or pending case remained.
Separate worksheet controls returned six passes and one failure: built-in `GOOGLEFINANCE` returned `#N/A` for USD/CAD.
That failure did not affect the repaired website adapter's direct USD/CAD result.
These historical results cover selected cases and have not established every provider feature.

### Run developer provider probes

The normal bundle retains these Apps Script functions for contributors.
Open **Extensions → Apps Script**, select a function, click **Run** and read its execution log.

- `CFCheckExpandedSources` requests Finviz, Zacks and GuruFocus fields for `NVDA`, `AAPL` and a deliberately invalid ticker.
- `CFCheckAnalysisSources` runs the former analysis collector and prints its summary. It reads an existing `Analysis` tab's inputs when present. Otherwise, it uses `NVDA` and a blank expiration. It does not read **Start here!B4**.
- `CFInspectTutorial` reads the current tutorial's actual formulas and results without requesting provider data.

The first two functions request providers directly.
Keep their results separate from worksheet results and record the ticker that each function actually used.

### Check cold and warm formula caches

Use an empty area in a private spreadsheet with the normal bundle.

1. Enter a supported ticker that this project did not recently request in `A1`.
2. Enter `=CFDATASTATUS($A$1,"history")` in `B1`. Wait for its two-row result.
3. Immediately enter `=CFDATASTATUS($A$1,"HISTORY")` in `B5`.
4. Compare **Cached** and **Retrieved at**. An uncached first result shows `false`; a cached second result retains its retrieval time.

The uppercase dataset string makes the second formula's arguments different while selecting the same internal history cache.
Run the second call within the 60-second history cache period.
If the first call finds an existing cache entry, both results can show `true`.
Google can [remove cache entries early](https://developers.google.com/apps-script/reference/cache/cache), so a repeated miss alone does not establish a provider failure.
A cache hit does not establish a fresh trade. Compare **Quote time** with **Retrieved at**.
The original `CACHEFINANCE` functions have separate caches and fallback behavior, described in [FUNCTIONS.md](FUNCTIONS.md#original-cachefinance-and-cachefinances).

### Run local checks

Use Node.js 22 or later and npm. From a fresh checkout:

```sh
npm ci --ignore-scripts
npm test
npm run build:check
npm run build:provider-tests:check
```

Edit modules in `src/`; the build removes their Node.js import blocks from the Apps Script bundles.
After source changes, regenerate both bundles and run the contributor checks:

```sh
npm run build
npm run build:provider-tests
npm run validate
npm run build:provider-tests:check
```

Commit the relevant source, test and generated `dist/` changes together.
The tests and public fixtures remain in [test/](test/).
Use `npm run test:watch` while editing, or `npm run test:coverage` for the coverage report in `coverage/index.html`.
The local run for the single-tab tutorial passed **1,481 tests in 43 files**.
Coverage was 91.33% of lines, 88.66% of branches and 94.16% of functions.
The former workbook's visible history formulas also passed 29,363 numerical comparisons against the existing indicator calculations.
Those comparisons included missing prices, flat prices, moving-average warm-up periods, RSI, MACD, returns and volatility.
Those numbers describe controlled local tests, separate from the dated Google Sheets results above.

### Read and share results

| Result | Meaning |
|---|---|
| `PARSED` | A direct provider response supplied an accepted field; financial accuracy needs separate checks |
| `KEY_REQUIRED` | The case did not run because its key was missing |
| `UNSUPPORTED_*` | This adapter does not implement the requested attribute, symbol or combination |
| `HTTP_ERROR`, `RATE_LIMITED`, `FETCH_ERROR` | No accepted response; the code does not infer a subscription requirement |
| `MISSING_VALUE`, `PARSE_ERROR`, `IDENTITY_MISMATCH` | The response did not supply an accepted field for the requested ticker |
| `NEGATIVE_REJECTED` | The parser accepted no value for the deliberate invalid ticker |
| `NEGATIVE_FALSE_POSITIVE` | The parser incorrectly accepted a value for the invalid ticker |
| `PENDING`, `RUNNING`, `INTERRUPTED` | The test has no completed result |
| Lookup `PASS` / `FAIL` | The worksheet passed or failed its stated assertion |
| Lookup `BLOCKED` | A missing key or unavailable provider prevented the comparison |

Report the date, installed version, ticker, formula or menu command, expected result, actual result and provider timestamp.
Keep cold-cache, warm-cache, direct-provider and worksheet results separate.
Use the sanitized export for a shareable summary; review it for personal data before sharing.
Generated reports stay local in the ignored `test-results/` folder. The current branch does not track them.
Test code and public fixtures remain tracked so contributors can reproduce the checks.
Earlier commits still contain the previously published reports.
