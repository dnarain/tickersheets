# Build your own spreadsheet

Install TickerSheets with [INSTALL.md](INSTALL.md), or [copy the tutorial](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/copy).
Then write the functions in ordinary worksheet cells.
You can arrange those cells however you want.
The examples use English function names and comma separators.

## Start with one ticker and one formula

1. Enter `NVDA` in cell `A1`.
2. Enter this formula in `B1`:

```excel
=TICKERSHEETS_QUOTE(A1,"price")
```

Cell `B1` contains the formula and shows the price.
Changing `A1` recalculates formulas that use that ticker.
Choose **TickerSheets → Refresh data** when you want to request new results.
The functions can reuse cached data and do not stream continuously.

## Add individual fields

Keep the ticker in `A1`.
Enter the labels in column A and formulas in column B at the listed rows:

| Cell | Label | Formula |
|---|---|---|
| B3 | Regular-session price | `=TICKERSHEETS_QUOTE($A$1,"regular_price")` |
| B4 | After-hours price | `=TICKERSHEETS_QUOTE($A$1,"post_market_price")` |
| B5 | Selected session | `=TICKERSHEETS_QUOTE($A$1,"price_session")` |
| B6 | Quote time | `=TICKERSHEETS_QUOTE($A$1,"quote_time")` |
| B7 | Currency | `=TICKERSHEETS_QUOTE($A$1,"currency")` |
| B8 | Trailing P/E | `=TICKERSHEETS_FUNDAMENTALS($A$1,"trailing_pe")` |
| B9 | Trailing EPS | `=TICKERSHEETS_FUNDAMENTALS($A$1,"eps_ttm")` |
| B10 | Dividend yield | `=TICKERSHEETS_FUNDAMENTALS($A$1,"dividend_yield")` |
| B11 | Market cap | `=TICKERSHEETS_FUNDAMENTALS($A$1,"market_cap")` |
| B12 | Earnings date | `=TICKERSHEETS_FUNDAMENTALS($A$1,"earnings_date")` |

Format **B10** as a percentage.
P/E is a ratio. EPS uses currency per share.
An after-hours quote does not replace the closing prices used for daily history.

To show the formula beside a result, enter `=FORMULATEXT(B3)` in **C3**.
Copy it down to show the other formulas.
The [field reference](FUNCTIONS.md) lists more selectors.

## Request a table

The following functions return several rows and columns.
Put each formula in a separate empty area.
Only the first cell contains the formula.

| Data | Formula | Output width |
|---|---|---|
| Daily history | `=TICKERSHEETS_HISTORY($A$1,252)` | 7 columns |
| Published option dates | `=TICKERSHEETS_EXPIRATIONS($A$1)` | 1 column |
| Nearest-expiration option chain | `=TICKERSHEETS_OPTIONS($A$1)` | 12 columns |
| Reported EPS | `=TICKERSHEETS_EARNINGS($A$1,"earnings")` | 10 columns |
| Provider/session comparison | `=TICKERSHEETS_QUOTE_COMPARE($A$1)` | 10 columns |

Keep the full output area empty to prevent overlap errors.
History includes a header and runs from oldest to newest.
The history fields are Date, Open, High, Low, Close, Adjusted close and Volume.
An unfinished daily bar can lack a closing price.

For another option expiration, put a published date in a separate input cell, such as `E1`.
Use `=TICKERSHEETS_OPTIONS($A$1,$E$1)` for that date.
Choose an expiration published for the current ticker.
Some stocks and funds have no supported chain.
The IV column uses fractions: `0.50` means `50%`.

Keep GAAP and adjusted EPS separate.
Financial comparisons also require the same accounting basis, frequency and currency.

## Add RSI2 targets or provider fields

These examples return individual values:

```excel
=TICKERSHEETS_RSI_TARGETS($A$1,20,80,"rsi2")
=TICKERSHEETS_RSI_TARGETS($A$1,20,80,"buy_target")
=TICKERSHEETS_RSI_TARGETS($A$1,20,80,"sell_target")
=TICKERSHEETS_FIELD("FINVIZ",$A$1,"rsi14")
=TICKERSHEETS_FIELD("ZACKS",$A$1,"target_price")
=TICKERSHEETS_FIELD("GURUFOCUS",$A$1,"forward_dividend_yield")
```

The RSI2 triggers are the low and high levels, here `20` and `80`.
A target can remain unavailable when its trigger cannot be reached in the required direction.
RSI values run from `0` to `100`.
Forward dividend yield uses a fraction.
The [function reference](FUNCTIONS.md) explains each field and its limits.

## Request a quote from a keyed provider

1. Choose **TickerSheets → API keys…**.
2. Enter your own key for Finnhub, Alpha Vantage, Twelve Data or CoinMarketCap.
3. Click **Save keys**.

With a stock ticker in `A1`, choose one provider explicitly:

```excel
=TICKERSHEETS_PROVIDER_QUOTE($A$1,"FINNHUB","price")
=TICKERSHEETS_PROVIDER_QUOTE($A$1,"ALPHA_VANTAGE","price")
=TICKERSHEETS_PROVIDER_QUOTE($A$1,"TWELVE_DATA","price")
```

CoinMarketCap uses a cryptocurrency symbol:

```excel
=TICKERSHEETS_PROVIDER_QUOTE("BTC","COINMARKET","price")
```

The formula returns one field from the selected provider.
The provider plan controls symbol access, request limits and quote delays.
The default `TICKERSHEETS_QUOTE` formula still uses Yahoo without a personal key.
See [the keyed-quote reference](FUNCTIONS.md#tickersheets_provider_quote) for fields and supported symbol formats.

## Add FRED data

1. Choose **TickerSheets → API keys…**.
2. Enter your own FRED key in **FRED**.
3. Click **Save keys**.

Keep the key out of cells and formulas.
Spreadsheet editors can access its attached script and keys, so keep this copy private.

Enter this formula in an empty five-column area for recent observations:

```excel
=TICKERSHEETS_FRED("DGS10",60)
```

For one observation on an exact date:

```excel
=TICKERSHEETS_FRED_VALUE("DGS10","2026-11-05")
```

A missing date returns `N/A`; the function does not substitute an earlier business day.
FRED retains its published units.
For DGS10, a value of `4.25` means `4.25%`, so use number formatting instead of percentage formatting.
A CPI observation is an index level.
Avoid `TODAY()`, `NOW()` and `RAND()` in custom-function inputs.
Use a typed date or `DATE(...)` instead.

## Add calculations from your own assumptions

These examples use fixed assumptions and do not request provider data:

```excel
=TICKERSHEETS_OPTION_MODEL(100,100,30,0.25,0.04,0,"Call","price")
=TICKERSHEETS_STRATEGY("Covered call",100,0,0,110,3,1,100,"2027-01-15","maxProfit")
```

The first calculates a theoretical European call premium per share.
It assumes a `100` spot and strike, 30 calendar days, `25%` IV and a `4%` annual rate.
The second calculates maximum covered-call profit for a whole position.
It assumes a `100` stock cost, `110` strike, `3` premium and one contract of 100 shares.

Replace those entered assumptions with references to your own input cells.
See [option model arguments](FUNCTIONS.md#tickersheets_option_model) and [strategy arguments](FUNCTIONS.md#tickersheets_strategy) for units and limits.

## Read the result before using it

Check the session and timestamp before comparing prices.
Check the published units before formatting a number.
Keep unavailable values visible instead of converting them to zero.
The optional `TICKERSHEETS_DATA_STATUS` function returns status and source times for its requested dataset.
A recent retrieval does not prove that the underlying quote is recent.

The full [function reference](FUNCTIONS.md) includes all sixteen TickerSheets functions, including watchlist summaries and strategy calculations.
You can use them in cells with your own layout.
