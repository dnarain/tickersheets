# TickerSheet Demo and Tutorial

This guide explains [TickerSheet Demo and Tutorial](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/edit), the TickerSheets sample workbook.
You can view the public sample without editing it.
[Make your own copy](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/copy) to change the ticker and refresh its data.

The sample starts with `NVDA` and contains saved results from a test run.
It contains no saved API keys.
Your copy requests new data when you run a refresh.
FRED requires your own key in your copy.

The analysis runs in the spreadsheet owner's Apps Script project.
The script creates the tabs, source formulas and charts.
Cell functions request individual provider fields or tables.
Other spreadsheet formulas calculate indicators, comparisons and summaries from those results.
The [installation guide](INSTALL.md) includes the template workflow.
The [function reference](FUNCTIONS.md) lists reusable formulas and supported provider fields.
The [build-your-own guide](BUILD-YOUR-OWN.md) explains how to create custom tabs from those formulas.

## What the sample demonstrates

- One ticker input updates the company name, prices, tables and chart titles.
- Price history and numeric charts show trends, returns and indicators.
- Earnings, fundamentals and published option chains provide more detail when their providers supply it.
- A watchlist, option calculators and economic series show other ways to use the functions.

## Copy a formula from a result cell

Open **Start here** for the walkthrough inside the workbook.
Click each of these cells and inspect the formula bar:

| Cell | What it contains |
|---|---|
| Analysis!B9 | `=CFQUOTE($B$4,"price")`, the price formula and its result in one cell |
| Formulas!B23 | A direct `CFQUOTE` price example with the local ticker cell |
| Quote data!B8 | A direct `CFQUOTE` price formula, with its text visible in C8 |
| Fundamentals, column B | An individual `CFFUNDAMENTALS` formula for each field |
| Price history!A7 | `CFHISTORY`, the source for daily prices and volume |
| Price history!I57 | A visible SMA50 formula |
| Price history!P22 | A visible Wilder RSI14 formula |

The quote and fundamental value cells each contain their own formula.
For example, enter `NVDA` in `A1` on your own tab and use `=CFQUOTE(A1,"price")` in another cell.
The simplest formula needs only the ticker and field name.
Choose **Stock analysis → Refresh selected ticker** to request new results for the sample.

**Fundamentals!F8:F70** shows each value formula as text.
Column G retains the provider's currency code for each field when available.
The metadata table at **Fundamentals!I7** supplies units and currencies for these labels.
The value cells in **B8:B70** still contain individual `CFFUNDAMENTALS` formulas.

History, earnings, expirations, option chains and economic histories return whole tables.
Only the first cell of each returned table contains its formula.
Google Sheets fills the neighboring cells with that formula's results.
The indicator columns contain ordinary spreadsheet formulas, with labeled helpers to the right.
Options and strategy results use cell formulas that call `CFOPTIONMODEL` and `CFSTRATEGY`.

The **Refresh selected ticker** menu requests new source results and resets calculator assumptions.
Google Sheets then recalculates the dependent formulas.
The dashboard and examples use direct field functions where those functions return individual values.
The functions can reuse recent parsed provider data from their cache.
**Analysis!K4** holds the calculation date for option days and maturity selection.
The refresh menu resets this date to the current date in the spreadsheet's time zone.

## Try the sample

1. Make your own copy with the link at the top of this page.
2. Choose **Stock analysis → Refresh selected ticker** in your copy.
3. Complete Google's authorization steps for your copy.
4. If the refresh does not start, choose **Refresh selected ticker** again.

The [installation guide](INSTALL.md) covers permissions, API keys and installation into a blank spreadsheet.
The sample's generated tabs show one possible workbook layout.
You can add your own tabs with the formulas in [BUILD-YOUR-OWN.md](BUILD-YOUR-OWN.md).

## Change the stock

Enter the ticker in **Analysis!B4**, then choose **Stock analysis → Refresh selected ticker**.
Examples include `NVDA`, `AAPL`, `NYSE:IBM`, `TSE:RY` and `RY.TO`.
Bare US tickers use Yahoo's returned exchange before requesting comparison quotes.

Titles, source formulas and charts follow this input.
Cell headings update immediately. **Refresh selected ticker** updates chart titles before requesting fresh source data.
If Google cannot update a chart title, a message beside the ticker asks you to refresh again after the data loads.
Wait for source functions to finish before reading the results or recording a journal entry.
Use **Sources** to inspect unavailable data and source timestamps.

## Tabs

| Tab | Contents |
|---|---|
| Start here | A short walkthrough, copyable formulas and controls for learning from the workbook. |
| Analysis | Current quote, indicator summary, provider comparison and three trend charts. |
| Price history | A CFHISTORY source table, visible moving-average/RSI/MACD/return formulas, helpers and SPY/QQQ source tables. |
| Quote data | One CFQUOTE formula per field, visible formula text, and separate comparison, expiration and RSI2 tables. |
| Fundamentals | Individual CFFUNDAMENTALS value formulas, formula text, units, availability, source and currency codes. A separate metadata table supplies units and currencies. |
| Earnings | Separate GAAP and adjusted EPS results, annual/quarterly financial data, estimates, earnings dates, dividends and splits when supplied. |
| Options | Expiration selector, selected-expiration quotes, implied volatility, volume/open interest and an editable option calculator. |
| Macro | FRED series levels, observation dates and histories. |
| Sources | Links to source formula cells, returned-data statuses, observation times and notes. This tab does not request providers again. |
| Research | Earnings comparisons, financial growth, additional provider fields and up to 15 further charts. |
| Strategies | Editable covered-call, cash-secured-put and call/put vertical calculations, source bids/asks and payoff chart. |
| Watchlist | Up to 20 ticker inputs, quotes, returns, indicators, valuation and changes since the latest saved journal observation. |
| Journal | Saved observations recorded explicitly after formulas finish, plus formulas for changes between entries. |
| Formulas | Function reference, direct field examples and FORMULATEXT examples for learning and copying. |
| Watchlist data | One CFWATCHROW source for each other ticker. The selected stock reuses Quote data. |
| Chart links | Provider chart links and manual-copy guidance, created by **Provider chart links**. |

The sample's optional **Notes** tab is for your own notes; the script leaves it unchanged during refresh.

`N/A` means the source or calculation did not supply a value.
A reported zero remains zero.
Provider timestamps ending in `Z` remain in UTC.
Saved Journal observation times display in the spreadsheet's time zone.

## Charts and images

The overview and option calculator create four native Google Sheets charts:

- Six-month close, SMA50 and SMA200.
- Two-year adjusted growth against SPY and QQQ.
- RSI14 with the 30 and 70 reference levels.
- Option payoff at expiration, when usable source quotes exist.

The research tab adds volume, MACD, EPS actual/estimate, revenue/net-income, IV-by-strike, open-interest and IV-by-expiration charts.
It also adds separate charts for the four FRED series.
Charts use numeric formula results. Missing results create gaps.
FRED charts remain empty until your copy can access FRED with your own key.
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
It shows the selected session and its quote timestamp.
The comparison table also shows separate regular, pre-market and after-hours rows.
The quote timestamp can precede the latest retrieval time.
Yahoo can publish a current-day bar whose closing price is still missing.
The overview shows **Indicators through** separately and uses the latest published close for indicator summaries.
The unfinished bar remains in the history with missing close values.

Visible formulas in **Price history** calculate SMA, EMA, MACD and Wilder RSI14 from Yahoo closing prices.
Other formulas calculate adjusted returns, log-return volatility and drawdown from adjusted close.
Annualized volatility uses 252 trading sessions.
SPY/QQQ charts align available dates and index adjusted prices to 100.
They compare each instrument's local-currency return; the script does not convert foreign prices to USD.
Indicators with insufficient history remain unavailable.

## Options

The sample requests published Yahoo option chains through an anonymous session.
It requires no personal Yahoo login.
The parser checks the underlying ticker, expiration, option type, strike and standard OCC contract identifier.
Nonstandard or mismatched contracts are excluded.

Choose an available date in **Options!B4**, then refresh the selected ticker.
The full chain covers that expiration. Its source formula depends on the selected date.
The generated option calculations cover up to 1,000 returned contracts and show a warning for a larger chain.
The research comparison also requests up to four additional published dates through the same anonymous Yahoo session.
It targets approximately 30, 90, 180 and 365 calendar days, plus the selected expiration.
The source tables retain each leg's strike, bid, ask, midpoint, IV, volume and open interest.
Research formulas select the nearest common call/put strike. Ties use the lower strike.
If no common strike exists, the table retains the nearest individual legs and leaves mean ATM IV unavailable.
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

Enter up to 20 tickers in the yellow cells on **Watchlist**.
Choose **Stock analysis → Refresh watchlist** to load the table.
Ticker edits update the corresponding source formula. Wait for its result before reading the row.
The watchlist uses Yahoo history and fundamentals, with no option-chain request for every stock.
The selected stock's watchlist row references its existing formula results.
Other tickers use `CFWATCHROW`; that function calculates their compact indicator summaries in Apps Script.

After the source formulas finish, choose **Stock analysis → Record journal snapshot** to append displayed values to **Journal**.
Refresh requests do not append journal rows automatically.
The saved observation columns deliberately contain fixed values; the change columns contain formulas.
The journal compares the previous row for the same underlying symbol and currency.
It records price, RSI, earnings dates, EPS, analyst targets and available ATM IV.
Missing values remain unavailable and do not create zero changes.
Watchlist tickers remain separate from the single-stock ticker input.

## Reusable functions

`CFQUOTE`, `CFHISTORY`, `CFFUNDAMENTALS`, `CFEARNINGS`, `CFQUOTECOMPARE`, `CFOPTIONS`, `CFEXPIRATIONS`, `CFFRED`, `CFFREDVALUE`, `CFRSITARGETS`, `CFFIELD` and `CFWATCHROW` work in user worksheets.
The formula tab includes RSI2 targets, exact-date FRED examples and separate regular-session and after-hours quotes.
The [build-your-own guide](BUILD-YOUR-OWN.md) gives recipes for separate custom tabs.
`CFDATASTATUS` returns source times and cache status for the corresponding dataset.
`CFOPTIONMODEL` and `CFSTRATEGY` calculate from their entered assumptions.
The original `CACHEFINANCE` and `CACHEFINANCES` functions remain available.

The sample's refresh menu requests new results for its generated tabs.
Individual quote and fundamental examples use direct field calls.
History, earnings and option calculations read their returned tables.
The formula cache stores public parsed data and retrieval times.
It excludes API keys, anonymous Yahoo cookies, crumbs and raw provider pages.
The function reference lists cache periods and text missing-data results.

The main formulas occupy these cells:

| Data | Formula cells |
|---|---|
| Selected quote and sessions | Quote data, column B — one `CFQUOTE` formula per field |
| Provider/session comparison | Quote data!D7 — `CFQUOTECOMPARE` |
| Published option expirations | Quote data!O7 — `CFEXPIRATIONS` |
| RSI2 trigger targets | Quote data!A70 — `CFRSITARGETS` |
| Daily prices and volume | Price history!A7 — `CFHISTORY` |
| SPY and QQQ history | Price history!AA7 and AI7 — `CFHISTORY` |
| Fundamental fields | Fundamentals, column B — one `CFFUNDAMENTALS` formula per field |
| Fundamental units and currencies | Fundamentals!I7 — `CFFUNDAMENTALS` metadata table |
| EPS, financials, estimates, dividends, splits, calendar | Earnings!A7, L7, U7, AF7, AK7 and AP7 — `CFEARNINGS` |
| Selected-expiration contracts | Options!A7 — `CFOPTIONS` |
| Additional provider fields | Research!A190, G190 and A230 — `CFFIELD` for Finviz, GuruFocus and Zacks |
| Four economic histories | Macro!A15, G15, M15 and S15 — `CFFRED`, 400 observations each |

Changing a source formula can affect several tabs that reference its table.
The refresh menu preserves this layout. **Build analysis sheets** regenerates its managed tabs.

## FRED key

Choose **Data settings → API keys…**, enter your existing FRED key in **FRED**, then save.
If the sidebar is blank, use **Data settings → Enter FRED key…**.
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
**Formulas!B27** and **B30** show the most recent returned FRED observation, which can be `N/A`.
The Macro summary uses the latest numeric observation, so its date can precede a newer missing observation.

## Provider and coverage limits

The analysis uses Yahoo Chart history, Yahoo quote-page details and the existing Google/Globe comparison adapters.
The additional adapters cover 32 Finviz fields, the Zacks average price target and two GuruFocus dividend-yield fields.
Each field keeps its source and units.
The source tables retain blocked or missing provider results.
**Sources** links to those tables and reads their existing results without additional provider requests.
Stock dividend yields can use different provider definitions, including forward and trailing yield.
The source columns retain the provider field and EPS basis.
Availability in one ticker does not establish every ticker or data field.
The [provider guide](PROVIDERS.md#providers) records the dated checks and remaining gaps.

The **Check provider data** menu fetches a safe count/status summary without writing the analysis tabs.
**Check formula workbook** reads the source cells, formulas and charts without making provider requests.
