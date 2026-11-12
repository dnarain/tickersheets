# Research expansion: November 11, 2026

We ran the expanded analysis in Google Sheets and its bound Apps Script project.
We also built a separate template project without saved API keys.
All provider requests ran in Apps Script.
The clean template remains private pending explicit sharing approval.

## Source and local checks

- Normal bundle source hash: `5b13f50d1358`.
- Normal bundle SHA-256: `1c940fdb32cdab9029895caf9249b925b3a4d7208f12a9371107c45046ed5623`.
- Source modules: 23.
- Local tests: 997 passed across 30 files.
- Line coverage: 95.63%.
- Branch coverage: 88.15%.
- Normal and diagnostic bundle checks: passed.
- [Native evidence](research-expansion-native-results.json): public values, statuses and worksheet readbacks.

The installed editor contents matched the built bundle exactly.
Earlier development checks retain their earlier source hashes in the evidence.
The evidence excludes private document IDs, API keys, anonymous cookies, crumbs and raw provider responses.

## Implemented features

| Feature | Behavior |
|---|---|
| Research charts | Volume, MACD, separate GAAP/adjusted EPS, annual/quarterly financial trends, option IV/open interest and four FRED charts. |
| Options across expirations | Up to five published dates share one anonymous Yahoo session. The table preserves each leg's strike, midpoint, spread, IV, volume and open interest. |
| Strategy calculations | Covered calls, cash-secured puts and call/put verticals use editable assumptions and source bids/asks. |
| Reusable formulas | Twelve public functions include the original CacheFinance functions, data lookups, FRED and option models. |
| Watchlist | Up to 20 ticker inputs, with quotes, returns, indicators, valuation and source times. |
| Journal | Public values and differences from the previous row for the same symbol and currency. |
| Additional providers | 32 Finviz fields, one Zacks target-price field and two GuruFocus yield fields. |
| Installation | A clean template, single-file alternative, function reference and native FRED-key prompt. |

The full NVDA and AAPL analysis produced 20 native charts with the configured FRED key.
The keyless template produced 16 charts and explicit FRED-key messages.
Chart counts depend on accepted data for the selected ticker.

## Direct provider results

These requests ran from Google Apps Script after the parser repairs.

| Provider | NVDA | AAPL | Deliberately nonexistent ticker |
|---|---|---|---|
| Finviz | HTTP 200, matched ticker, 32 fields | HTTP 200, matched ticker, 32 fields | HTTP 404, no accepted fields |
| Zacks | HTTP 200, matched ticker, average price target | HTTP 200, matched ticker, average price target | HTTP 404, no accepted fields |
| GuruFocus | HTTP 200, matched ticker, forward and trailing yields | HTTP 200, matched ticker, forward and trailing yields | HTTP 200, no matching ticker and no accepted fields |

GuruFocus initially returned matching pages without accepted yield values.
The repaired parser reads its ticker-specific FAQ and rejects conflicting or unrelated values.
Each field retains its provider and units.
No provider result silently replaces a failed field from another provider.

## Native worksheet checks

We checked the following behaviors:

- NVDA and AAPL history, fundamentals, earnings, selected option chains and five maturity comparisons.
- DGS10, FEDFUNDS, CPIAUCSL and UNRATE with the private FRED key.
- The generic `CFFRED` function with DGS2, outside the four default macro series.
- Scalar quotes, fundamentals, Finviz fields, daily-history arrays, expiration arrays and option arrays in actual cells.
- All four strategy selections, including different call/put source premiums.
- Strategy cash flows, collateral, maximum P/L, maximum loss and scenario payoff against independent arithmetic from the displayed inputs.
- Five-stock watchlists for NVDA, AAPL, MSFT, GOOGL and AMZN in both projects.
- Journal entries, ticker changes, cleared prior outputs and current-ticker chart titles.
- The keyless template, including FRED missing-key messages without spreadsheet formula errors.
- Exactly marked tab ordering and the selected ticker input after the builder completes.

The usable quote table caps 1,000 rows and retains nearby calls and puts.
Two controlled cases cover chains larger than that cap.
Source asks seed long premiums, and source bids seed short premiums.
The model reports whole-position cash amounts with an explicit multiplier.

## Native problems found and fixed

The first watchlist build tried to merge a title across a frozen-column boundary.
Google Sheets rejected that operation.
The watchlist now keeps its columns unfrozen, and the test mock rejects invalid cross-boundary merges.

The initial ticker edit cleared the ticker temporarily while it cleared the older outputs.
The simple trigger timed out after 30.169 seconds and left the input blank.
The repaired cleanup excludes both ticker and expiration inputs from clearing.
It also removes unnecessary formatting calls and source-guide rebuilding during invalidation.
The native retry preserved the input and cleared the old history, options, research charts and strategy quotes.

The overview and maturity table now use the same ATM IV checks.
Both require a same-strike call and put with positive IV, ordered bid/ask quotes and a positive ask.
A rejected leg leaves the mean unavailable.

## Provider chart images

Both old StockCharts picture URLs returned HTTP 404 from Apps Script.
StockCharts' [reprint policy](https://help.stockcharts.com/learning-more/policies-and-limitations/reprint-permission-policies) requires manual chart copying.
The final menu provides StockCharts and Finviz chart-page links with manual-copy guidance.
The final provider-links function makes zero HTTP requests and inserts zero provider images.
Controlled tests enforce both conditions.

## Limits

We tested selected symbols and dates from one Google account and browser setup.
We did not test every symbol, exchange, financial field, expiration or Google Workspace configuration.
The data retains provider timestamps and accounting bases.
We did not independently reconcile every financial value against company filings or an exchange feed.
The option models exclude early assignment, taxes, fees, financing and changes in contract deliverables.
The analysis does not implement every SMF function or retired provider.

The [installation guide](../../INSTALL.md) and [function reference](../../FUNCTIONS.md) describe the supported inputs and remaining limits.
