# One-ticker analysis checks: November 11, 2026

We ran the analysis in a private Google spreadsheet and its bound Apps Script project.
All provider requests ran from Apps Script.
The analysis uses no hosted server.

The [sample guide](../../SAMPLE.md) explains installation, inputs, data sources and calculation limits.
The [native results](stock-analysis-native-results.json) contain sanitized count, status and worksheet reports.
The results contain no API keys, anonymous session values or private Google document identifiers.

The final normal bundle has source hash `f259791adb22`.
Its SHA-256 is `f78be2f5209de7a06c59f6b970ce8450b17e56a6a831c2ce1501b555b2100661`.
The installed editor content matched the built bundle exactly before the final native run.

## Live provider results

| Input | History rows | Structured fundamental fields | EPS rows | Estimate rows | Selected-expiration contracts | FRED series available |
|---|---:|---:|---:|---:|---:|---:|
| NVDA, November 13 expiration | 501 | 43 | 8 | 3 | 165 | 4 |
| AAPL, November 13 expiration | 501 | 43 | 8 | 3 | 153 | 4 |
| NVDA, November 20 expiration | 501 | 43 | 8 | 3 | 177 | 4 |
| Nonexistent ticker | 0 | 0 | 0 | 0 | 0 | 0 |

The valid-stock runs returned HTTP 200 and accepted data for all eleven provider status rows.
Those rows cover Yahoo history, Yahoo details, SPY, QQQ, Google, Globe, Yahoo options and four FRED series.
The four FRED series are DGS10, FEDFUNDS, CPIAUCSL and UNRATE.
The private FRED key remains in Script Properties.

Structured fundamental counts exclude visible quote-row fallbacks.
The rendered NVDA and AAPL tables contained 54 and 53 fields respectively.
The history retains an incomplete current-day bar with missing closing prices.
The overview uses the latest published close for its indicator summary.

## Worksheet behavior

- A ticker edit cleared previous values, option assumptions and charts before the next request.
- AAPL titles and chart legends replaced the previous NVDA labels.
- An expiration edit cleared the previous chain and calculator while preserving the price history.
- The expiration dropdown contained published dates and preserved the selected date after refresh.
- The second NVDA expiration returned 177 contracts and numeric option-model results.
- The nonexistent ticker returned two HTTP 404 status rows and no previous stock data or charts.
- The valid-stock model and payoff ranges contained no spreadsheet formula errors.
- All four native charts showed data and the current ticker in their titles.

The missing-data payoff formulas deliberately return `#N/A` when required option inputs are absent.
The nonexistent-ticker report includes these expected missing-data results.
The calculator does not draw a payoff chart for that result.

We also corrected stale header colors after refresh and date-text values that appeared as date serials.
The renderer resets managed body formatting and formats date text before it writes values.

## Local checks

All 657 tests passed across 22 files.
The coverage checks passed with 94.72% line coverage and 88.69% branch coverage.
Both generated bundles passed their build checks.
Local tests use controlled responses and spreadsheet mocks.
The live results in this report came from Google Apps Script.

## Charts still missing

The saved Excel reference has an IV-by-expiration chart.
The Google Sheets analysis currently downloads one selected expiration and does not create that chart.
The Google Sheets analysis adds an RSI14 chart.
Provider images from StockCharts and Finviz remain unimplemented and untested from Google Sheets.

The existing data can support additional volume, MACD, EPS, FRED and selected-expiration option charts.
Those charts remain unimplemented.

## Limits

We checked selected NVDA and AAPL results from one Google account and spreadsheet setup.
These checks do not establish every symbol, exchange, field, option expiration or provider subscription tier.
We did not reconcile every financial value against an independent source.
The option model uses European Black–Scholes assumptions.
The default expiration input uses whole calendar days.
Same-day time requires a manually entered fraction.
The analysis does not implement every SMF function or provider.
