# Data providers and testing

Single Stock Analysis requests data from Google Apps Script. No hosted server is required.
The table lists the fields this project reads and selected Google Sheets results from **November 11–12, 2026, Pacific time**.
Those saved results do not guarantee access today, every ticker or every feature of a provider.

See [INSTALL.md](INSTALL.md) for setup and [FUNCTIONS.md](FUNCTIONS.md) for arguments, output columns and units.

## Providers

| Provider | What the application reads | Authentication | Saved Google Sheets result and limits |
|---|---|---|---|
| Yahoo Chart | Regular-session quotes, daily history and inputs for RSI2 targets; original quote adapter | No personal key | Prices/names passed for AAPL, NVDA, RY and XIC. Research history and RSI2 checks passed for selected NVDA/AAPL inputs. Optional bid/ask values were unavailable. |
| Yahoo Finance website | Selected fundamentals, earnings, estimates, regular/pre-market/post-market quotes; original price/name/yield adapter | No personal key | Selected NVDA/AAPL tables passed. The repaired original adapter accepted price/name/yield for AAPL, NVDA, RY and XIC. Active-session NVDA checks passed. Some fields and source timestamps remain unavailable. |
| Yahoo options | Published expirations, standard option chains and up to five maturity comparisons | Temporary anonymous Yahoo session; no personal login | November 11 overnight checks lacked usable ATM pairs. November 12 market-hours checks returned all five ATM comparisons and numeric calculator results for NVDA/AVGO. Availability depends on the returned quotes. |
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
| StockCharts | Manual chart-page links | Open the page separately | The menu downloads no provider images and inserts no pictures. Native spreadsheet charts use accepted numeric tables. |
| ADVFN | Excluded | — | Our November 11 Apps Script requests received HTTP 403 from Cloudflare. This project does not include its adapter. |

The three `CFFIELD` providers expose **35 named fields**, including **34 numeric field IDs**.
The full field list appears in [FUNCTIONS.md](FUNCTIONS.md#cffield).
A successful request does not establish that every field in its response is usable.
Yields, earnings bases and timestamps can differ between providers.

### Latest research checks: November 12

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
Both workbooks and their Apps Script projects use the title **Single Stock Analysis**.
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
The [installation guide](INSTALL.md#if-the-sidebar-is-blank) explains the blank-sidebar workaround and the separate FRED prompt.

## Testing process

Local tests check parsers, calculations, caching and worksheet behavior with controlled responses.
A run inside Google Apps Script checks access from Google's network.
A successful request from a local computer cannot replace a failed Google Sheets result.

### Run the eight original adapter checks

Use a **separate private spreadsheet** for the diagnostic bundle.
Do not add it beside the normal bundle; both bundles define the same functions.

1. Create a blank Google spreadsheet and open **Extensions → Apps Script**.
2. Replace `Code.gs` with [dist/CacheFinanceProviderTests.js](dist/CacheFinanceProviderTests.js).
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

### Check research data in the normal spreadsheet

1. Install the normal bundle using [INSTALL.md](INSTALL.md).
2. Choose **Stock analysis → Refresh selected ticker**. Read **Sources** for statuses and source times.
3. Choose **Check provider data** to request a summary for the selected ticker without writing analysis tabs.
4. Choose **Check additional providers** to request Finviz, Zacks and GuruFocus fields for NVDA, AAPL and an invalid ticker.
5. Open **Extensions → Apps Script → Executions** to read those commands' sanitized summaries.
6. Choose **Build lookup checks**, wait for formulas to finish, then choose **Inspect lookup checks**.
7. Open **Lookup tests** and review each result. Missing keys and blocked requests remain **BLOCKED**.
8. Choose **Check all research sheets** to inspect rendered tables and charts without fetching provider data.

The lookup tab checks RSI2 outputs and exact-date FRED results.
Its fixed dates describe the November 2026 snapshot.
The November 5 DGS10 reference comparison will fail after that observation leaves the latest 30 rows.
That reference-window failure alone does not establish an exact-date lookup defect.

### Check cold and warm formula caches

Use an empty test tab in the normal spreadsheet.

1. Enter `NVDA` in `A1` and a new manual whole number in `A2`.
2. Enter `=CFDATASTATUS($A$1,"history","",$A$2)` in `B1`. Wait for its two-row result.
3. Immediately enter `=CFDATASTATUS($A$1,"HISTORY","",$A$2)` in `B5`.
4. Compare **Cached** and **Retrieved at**. A successful first request should show `false`; the second can show `true` and reuse the retrieval time.
5. Increase `A2` and repeat to request a new cache entry.

The uppercase dataset string makes the second formula's arguments different while selecting the same internal history cache.
Run the second call within the 60-second history cache period.
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
The **November 12, 2026** local run passed **1,277 tests in 34 files**.
Coverage was 96% of lines, 89.15% of branches and 96.74% of functions.
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
