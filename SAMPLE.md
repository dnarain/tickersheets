# TickerSheet Demo and Tutorial

[View the tutorial](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/edit) or [make your own copy](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/copy).

The tutorial has one tab: **Start here**.
It shows simple custom functions and the formula text beside their results.
The public tutorial contains saved NVDA examples and no saved API keys.

## Open your copy and its menu

1. Choose **File → Make a copy** in the public tutorial.
2. Open your editable copy and reload it.
3. Enter a ticker in the yellow **B4** cell.
4. Choose **Data settings → Refresh formulas** to request new results.
5. Complete Google's authorization steps if prompted.

Google copies the attached Apps Script with the spreadsheet.
Its `onOpen` function adds the **Data settings** menu.
The menu contains **API keys…** and **Refresh formulas**.
For a blank spreadsheet, follow [INSTALL.md](INSTALL.md) to install the same function library.

## Inspect a working formula

| Cell | Result |
|---|---|
| B4 | Editable ticker, initially `NVDA` |
| B7 | Latest available stock price |
| B8 | Regular-session price |
| B9 | After-hours price |
| B10 | Session selected for the latest price |
| B11 | Quote timestamp |
| B12 | Trailing P/E |
| B13 | Trailing EPS |
| B14 | Dividend yield |
| B15 | Earnings date, when available |

Each result in **B7:B15** contains its own custom formula.
**C7:C15** shows those formulas as text.
For example, **B7** contains:

```excel
=CFQUOTE($B$4,"price")
```

Click **B7** to inspect it in the formula bar.
To use the same function on your own tab, enter a ticker in `A1` and write:

```excel
=CFQUOTE(A1,"price")
```

The functions work without the tutorial's layout.
They also work in a new spreadsheet after you install the Apps Script bundle.

## Prices, timestamps and missing data

The latest price can use a newer accepted pre-market or after-hours quote.
The regular-session price remains a separate field.
Read the selected session and quote timestamp before comparing prices.
An extended-session quote can describe an earlier trading session.
A recent request does not prove that the provider supplied a recent trade.

`N/A` means that the source or calculation did not supply a value.
A reported numeric zero remains zero.
Provider timestamps ending in `Z` use UTC.
Dividend yields use fractions: `0.01` means `1%`.

## Tables and other functions

The text examples below the working values show other available functions.
History, earnings, expiration dates, option chains and FRED histories return tables.
Only the first cell of a returned table contains the custom function.
Google Sheets fills the neighboring cells with the returned rows and columns.
Keep those output cells empty.

The library also includes RSI2 targets, provider-field lookups, watchlist summaries, option models and strategy calculations.
You can use them in your own cells without adding dashboard tabs.
See [BUILD-YOUR-OWN.md](BUILD-YOUR-OWN.md) for recipes and [FUNCTIONS.md](FUNCTIONS.md) for all arguments and units.

## API keys

Public Yahoo stock and option functions do not require personal API keys.
FRED requires your own key.
Choose **Data settings → API keys…**, enter it in **FRED**, then click **Save keys**.
The same form accepts Finnhub, Alpha Vantage, Twelve Data and CoinMarketCap keys for the original `CACHEFINANCE` functions.
Those optional provider keys do not change `CFQUOTE`'s Yahoo source.

If the form is blank, use the [browser-profile workaround](INSTALL.md#if-the-sidebar-is-blank), then open it again.
Keep copies with personal keys private. Spreadsheet editors can access the attached script and its keys.

## Refresh

Choose **Data settings → Refresh formulas** when you want another result.
The functions can reuse recent cached provider responses and do not stream continuously.
Changing the ticker also recalculates formulas that use that cell.
The tutorial contains no hidden data tabs.
