# Sample stock research spreadsheet

This guide explains the [CacheFinance Research Template sample spreadsheet](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/edit).
You can view the public sample without editing it.
[Make your own copy](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/copy) to change the ticker and refresh its data.

The sample starts with `NVDA` and contains saved results from a test run.
It contains no saved API keys.
Your copy requests new data when you run a refresh.
FRED requires your own key in your copy.

The analysis runs in the spreadsheet owner's Apps Script project.
The script creates the tabs and charts and downloads provider data when you refresh.
The [installation guide](INSTALL.md) includes the template workflow.
The [function reference](FUNCTIONS.md) lists reusable formulas and supported provider fields.
The [build-your-own guide](BUILD-YOUR-OWN.md) explains how to create custom tabs from those formulas.

## What the sample demonstrates

- One ticker input updates the company name, prices, tables and chart titles.
- Price history and numeric charts show trends, returns and indicators.
- Earnings, fundamentals and published option chains provide more detail when their providers supply it.
- A watchlist, option calculators and economic series show other ways to use the functions.

## Try the sample

1. Make your own copy with the link at the top of this page.
2. Choose **Stock analysis → Refresh selected ticker** in your copy.
3. Complete Google's authorization steps for your copy.
4. If the refresh does not start, choose **Refresh selected ticker** again.

The [installation guide](INSTALL.md) covers permissions, API keys and installation into a blank spreadsheet.
The sample's generated tabs show one possible workbook layout.
You can add your own tabs with the formulas in [BUILD-YOUR-OWN.md](BUILD-YOUR-OWN.md).

## Change the stock

Enter the ticker in **CF Analysis!B4**, then choose **Stock analysis → Refresh selected ticker**.
Examples include `NVDA`, `AAPL`, `NYSE:IBM`, `TSE:RY` and `RY.TO`.
Bare US tickers use Yahoo's returned exchange before requesting comparison quotes.

Titles and chart legends follow this input.
Editing it clears the previous stock's data and charts.
The edit handler makes no external requests; the refresh menu downloads the new data.
The formula examples can recalculate separately when their ticker input changes.
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
| CF Research | Earnings comparisons, financial growth, additional provider fields and up to 15 further charts. |
| CF Strategies | Editable covered-call, cash-secured-put and call/put vertical calculations, source bids/asks and payoff chart. |
| CF Watchlist | Up to 20 ticker inputs, quotes, returns, indicators, valuation and changes since the previous refresh. |
| CF Journal | Public values and changes recorded by selected-stock and watchlist refreshes. |
| CF Formulas | Function reference and live examples that follow the selected ticker. |
| CF Images | Provider chart links and manual-copy guidance, created by **Provider chart links**. |

`N/A` means the source or calculation did not supply a value.
A reported zero remains zero.
Times display in the spreadsheet's time zone.

## Charts and images

The overview and option calculator create four native Google Sheets charts:

- Six-month close, SMA50 and SMA200.
- Two-year adjusted growth against SPY and QQQ.
- RSI14 with the 30 and 70 reference levels.
- Option payoff at expiration, when usable source quotes exist.

The research tab adds volume, MACD, EPS actual/estimate, revenue/net-income, IV-by-strike, open-interest and IV-by-expiration charts.
It also adds separate charts for the four FRED series.
Each chart requires accepted data, so the chart count varies by ticker and provider access.
GAAP and adjusted results have separate charts.
Annual and quarterly financial periods also stay separate.

**Provider chart links** creates links to StockCharts and Finviz for supported US symbols.
The tab includes manual-copy guidance and clears previous links when the ticker changes.
The menu makes no provider requests and inserts no provider images.
Both old StockCharts picture routes returned HTTP 404 in the November 11 Apps Script checks.
StockCharts' [reprint policy](https://help.stockcharts.com/learning-more/policies-and-limitations/reprint-permission-policies) also requires manual chart copying.

## Price and indicator dates

The current quote combines matching Yahoo Chart metadata and Yahoo quote-page session fields.
The overview selects an accepted newer pre-market or after-hours quote for the provider's reported session.
It shows the selected session, its timestamp and its published change.
The comparison table also shows separate regular, pre-market and after-hours rows.
The quote timestamp can precede the latest retrieval time.
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

The sample requests published Yahoo option chains through an anonymous session.
It requires no personal Yahoo login.
The parser checks the underlying ticker, expiration, option type, strike and standard OCC contract identifier.
Nonstandard or mismatched contracts are excluded.

Choose an available date in **CF Options!B4**, then refresh the selected ticker.
The full chain covers that expiration. Changing the date clears the old chain before the next refresh.
The research comparison also requests up to four additional published dates through the same anonymous Yahoo session.
It targets approximately 30, 90, 180 and 365 calendar days, plus the selected expiration.
The table retains each leg's strike, bid, ask, midpoint, IV, volume and open interest.
Mean ATM IV requires a call and put at the same strike.
The overview and maturity comparison use the same rule.
Both legs require positive IV and an ordered bid/ask pair with a positive ask.
Missing or crossed quotes leave gaps.
Underlying quote time and each contract's last-trade time have separate meanings.
The source does not establish a bid/ask timestamp.

The calculator uses European Black–Scholes prices and Greeks.
Its inputs are editable and reset on refresh.
If the provider supplies no usable call quote, the calculator leaves its strike and premium unavailable.
Its model outputs then show `n.a.`, and the payoff table uses `#N/A` gaps until the inputs contain valid numbers.
The default days to expiration uses whole calendar days.
Same-day options require an editable fractional-day input to model remaining time.
Rates, dividend yields and implied volatility are fractions, formatted as percentages.
Theta is per calendar day; vega and rho are per one percentage point.
The default risk-free rate is an editable 4% assumption.
The standard contract multiplier is an editable 100 shares.
The expiry payoff uses premium, strike, direction, quantity and multiplier; it does not require implied volatility.

The strategies tab uses source asks for long-option premiums and source bids for short-option premiums.
The covered-call stock input represents cost basis per share.
Strategy cash values cover the whole position and use the entered contract multiplier.
The tab shows the OIC references beside the assumptions.
The calculations describe expiration payoff and exclude fees, taxes, early assignment and financing costs.

## Earnings comparisons

The research tab shows the latest reported EPS result separately for each accounting basis.
It compares consecutive quarterly financial periods for QoQ growth and consecutive annual periods for YoY growth.
The comparison requires the same accounting basis and currency.
Missing periods and nonpositive prior values have no growth percentage.
Provider fiscal EPS labels and provider financial-period labels remain unchanged.

## Watchlist and journal

Enter up to 20 tickers in the yellow cells on **CF Watchlist**.
Choose **Stock analysis → Refresh watchlist** to load the table.
Ticker edits clear the affected row before the next refresh.
The watchlist uses Yahoo history and fundamentals, with no option-chain request for every stock.

Selected-stock and watchlist refreshes append public values to **CF Journal**.
The journal compares the previous row for the same underlying symbol and currency.
It records price, RSI, earnings dates, EPS, analyst targets and available ATM IV.
Missing values remain unavailable and do not create zero changes.
Watchlist tickers remain separate from the single-stock ticker input.

## Reusable functions

`CFQUOTE`, `CFHISTORY`, `CFFUNDAMENTALS`, `CFOPTIONS`, `CFEXPIRATIONS`, `CFFRED`, `CFFREDVALUE`, `CFRSITARGETS` and `CFFIELD` work in user worksheets.
The formula tab includes RSI2 targets, exact-date FRED examples and separate regular-session and after-hours quotes.
The [build-your-own guide](BUILD-YOUR-OWN.md) gives recipes for separate custom tabs.
`CFDATASTATUS` returns source times and cache status for the corresponding dataset.
`CFOPTIONMODEL` and `CFSTRATEGY` calculate from their entered assumptions.
The original `CACHEFINANCE` and `CACHEFINANCES` functions remain available.

The formula examples include an editable refresh number.
Incrementing that number requests a new result without a volatile `NOW()` argument.
The formula cache stores public parsed data and retrieval times.
It excludes API keys, anonymous Yahoo cookies, crumbs and raw provider pages.
The function reference lists cache periods and text missing-data results.

## FRED key

Choose **CacheFinance → API keys…**, enter your existing FRED key in **FRED**, then save.
If the sidebar is blank, use **CacheFinance → Enter FRED key…**.
Google's standard dialog displays the text you enter.
Blank entry preserves an existing key, and Cancel changes nothing.

The key is stored as `FRED_API_KEY` in the private project's Script Properties.
It belongs outside worksheet cells and Git commits.
People who can edit this spreadsheet or script can access its Script Properties.
Use your own private copy and key.

The macro tab requests economic series from the official FRED observations API.
The reusable `CFFRED` function also accepts other FRED series IDs and validates their metadata before it returns observations.
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
The additional adapters cover 32 Finviz fields, the Zacks average price target and two GuruFocus dividend-yield fields.
Each field keeps its source and units.
The source table reports blocked or missing provider results without replacing them with another provider's value.
Stock dividend yields can use different provider definitions, including forward and trailing yield.
The source columns retain the provider field and EPS basis.
Availability in one ticker does not establish every ticker or data field.
The [provider guide](PROVIDERS.md#providers) records the dated checks and remaining gaps.

The **Check provider data** menu fetches a safe count/status summary without writing the analysis tabs.
**Check analysis sheets** reads the rendered tables and chart titles without making provider requests.
