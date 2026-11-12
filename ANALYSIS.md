# One-ticker stock analysis in Google Sheets

The analysis runs in the spreadsheet owner's Apps Script project.
The script creates the tabs and charts and downloads provider data when you refresh.

## Install

1. Create a private Google spreadsheet.
2. Open **Extensions → Apps Script**.
3. Replace the contents of `Code.gs` with [dist/CacheFinance.js](dist/CacheFinance.js).
4. Save the script and reload the spreadsheet.
5. Choose **Stock analysis → Build analysis sheets**.
6. Review Google's permission request. The script uses the current spreadsheet, external requests and a settings sidebar.

The same file contains the existing `CACHEFINANCE` and `CACHEFINANCES` functions.
Install the generated file once. Do not add a second copy alongside an older bundle.
If the project already has custom `onOpen` or `onEdit` functions, combine their calls with the supplied handlers.

The builder writes only its seven marked `CF` tabs.
It refuses to replace an existing tab with the same name unless that tab has its ownership marker.
It leaves other tabs alone.

## Change the stock

Enter the ticker in **CF Analysis!B4**, then choose **Stock analysis → Refresh selected ticker**.
Examples include `NVDA`, `AAPL`, `NYSE:IBM`, `TSE:RY` and `RY.TO`.
Bare US tickers use Yahoo's returned exchange before requesting comparison quotes.

Titles and chart legends follow this input.
Editing it clears the previous stock's data and charts.
The edit handler makes no external requests; the refresh menu downloads the new data.
A result from an earlier ticker is discarded if you change the ticker during a refresh.

The sheet starts with NVDA as an example.
It does not include the fixed NVIDIA archives from the Excel workbook.

## Tabs

| Tab | Contents |
|---|---|
| CF Analysis | Current quote, indicator summary, provider comparison and three trend charts. |
| CF Price history | Two-year daily OHLCV, adjusted close, moving averages, MACD, RSI14, drawdown and SPY/QQQ comparisons. |
| CF Fundamentals | Sourced valuation, financial, ownership and trading fields from the selected quote page. |
| CF Earnings | Separate GAAP and adjusted EPS results, annual/quarterly financial data, estimates, earnings dates, dividends and splits when supplied. |
| CF Options | Expiration selector, selected-expiration quotes, implied volatility, volume/open interest and an editable option calculator. |
| CF Macro | FRED series levels, observation dates and histories. |
| CF Sources | Request results, returned ticker identity, retrieval/quote times and brief calculation notes. |

`N/A` means the source or calculation did not supply a value.
A reported zero remains zero.
Times display in the spreadsheet's time zone.

## Charts and images

The script creates four native Google Sheets charts:

- Six-month close, SMA50 and SMA200.
- Two-year adjusted growth against SPY and QQQ.
- RSI14 with the 30 and 70 reference levels.
- Option payoff at expiration, when usable source quotes exist.

The saved Excel reference also has four charts.
Its IV-by-expiration chart still requires a port that downloads quotes for multiple expirations.
The current options adapter downloads one selected expiration.

The script does not insert provider images from StockCharts or Finviz.
Those image endpoints require separate Google Sheets access tests.
The downloaded tables can also support volume, MACD, earnings, FRED and selected-expiration IV charts.
Those additional charts are not implemented yet.

## Price and indicator dates

The current quote comes from Yahoo Chart metadata.
Yahoo can publish a current-day bar whose closing price is still missing.
The overview shows **Indicators through** separately and uses the latest published close for indicator summaries.
The unfinished bar remains in the history with missing close values.

SMA, EMA, MACD and Wilder RSI14 use Yahoo closing prices.
Adjusted returns, log-return volatility and drawdown use adjusted close.
Annualized volatility uses 252 trading sessions.
SPY/QQQ charts align available dates and index adjusted prices to 100.
They compare each instrument's local-currency return; the script does not convert foreign prices to USD.
Indicators with insufficient history remain unavailable.

## Options

The options adapter ports the anonymous Yahoo session used by the SMF Mac helper:

1. Obtain an anonymous Yahoo cookie from `fc.yahoo.com`.
2. Obtain the associated crumb from Yahoo's `getcrumb` endpoint.
3. Request the selected ticker's option chain with that temporary session.

This flow uses no personal Yahoo login.
Cookies and crumbs stay in server-side memory and are excluded from results, logs and worksheets.
The parser checks the underlying ticker, expiration, option type, strike and standard OCC contract identifier.
Nonstandard or mismatched contracts are excluded.

Choose an available date in **CF Options!B4**, then refresh the selected ticker.
The chain covers that expiration. Changing the date clears the old chain before the next refresh.
Underlying quote time and each contract's last-trade time have separate meanings.
The source does not establish a bid/ask timestamp.

The calculator uses European Black–Scholes prices and Greeks.
Its inputs are editable and reset on refresh.
The default days to expiration uses whole calendar days.
Same-day options require an editable fractional-day input to model remaining time.
Rates, dividend yields and implied volatility are fractions, formatted as percentages.
Theta is per calendar day; vega and rho are per one percentage point.
The default risk-free rate is an editable 4% assumption.
The standard contract multiplier is an editable 100 shares.
The expiry payoff uses premium, strike, direction, quantity and multiplier; it does not require implied volatility.

## FRED key

Choose **CacheFinance → API keys…**, enter your existing FRED key in **FRED**, then save.
If the sidebar is blank, use **CacheFinance → Enter FRED key…**.
Google's standard dialog displays the text you enter.
Blank entry preserves an existing key, and Cancel changes nothing.

The key is stored as `FRED_API_KEY` in the private project's Script Properties.
It belongs outside worksheet cells and Git commits.
People who can edit this spreadsheet or script can access its Script Properties.
Use your own private copy and key.

The macro tab uses the same official FRED observations API as the repaired SMF Mac function.
Its default series are:

| Series | Meaning | Units |
|---|---|---|
| DGS10 | 10-year Treasury yield | Percent level; daily, not seasonally adjusted. |
| FEDFUNDS | Federal funds effective rate | Percent level; monthly, not seasonally adjusted. |
| CPIAUCSL | Consumer price index | Index, 1982–1984=100; monthly, seasonally adjusted. |
| UNRATE | Unemployment rate | Percent level; monthly, seasonally adjusted. |

FRED rate values retain their published units: `4.88` means 4.88 percent.
The change column compares the latest two available observations in the series' units.
CPI is an index level here. The sheet does not label that level as an inflation rate.
FRED observation dates identify periods, not publication times. A `.` observation remains missing.

## Provider and coverage limits

The analysis uses Yahoo Chart history, Yahoo quote-page details and the existing Google/Globe comparison adapters.
Stock dividend yields can use different provider definitions, including forward and trailing yield.
The source columns retain the provider field and EPS basis.
Availability in one ticker does not establish every ticker or data field.

This builds selected stock-analysis features on CacheFinance.
It does not port every SMF function or retired source.
The SMF provider audit supplies the starting point for additional ports.
Further ports should retain their working endpoint, arguments, units and missing-data behavior.

## Local development

```sh
npm ci --ignore-scripts
npm run build
npm run build:provider-tests
npm run test:coverage
npm run build:check
npm run build:provider-tests:check
```

Local tests use controlled responses and public excerpts.
Run the builder and refresh in Google Sheets to verify provider access from Google's network.
The **Check provider data** menu fetches a safe count/status summary without writing the analysis tabs.
**Check analysis sheets** reads the rendered tables and chart titles without making provider requests.
