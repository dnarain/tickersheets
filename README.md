# TickerSheets

Reusable stock and options functions for Google Sheets.

Enter a ticker in `A1`, then put this formula in another cell:

```excel
=CFQUOTE(A1,"price")
```

That cell contains the formula and shows the returned price.
Other functions return fundamentals, earnings, daily history, option chains, RSI2 targets and FRED observations.
Everything runs in the spreadsheet's attached Apps Script. There is no hosted server.

## Get started

Choose one installation method:

1. [Copy TickerSheet Demo and Tutorial](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/copy). Google copies its attached Apps Script too.
2. For your own spreadsheet, paste [dist/TickerSheets.js](https://github.com/dnarain/tickersheets/blob/main/dist/TickerSheets.js) into **Extensions → Apps Script → Code.gs**. Save and reload the spreadsheet.

Then enter the functions in the cells where you want their results.
The tutorial has one tab, **Start here**, with a ticker input, working examples and formula text beside each result.
You can [view the public tutorial](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/edit) without copying it.

[![Tutorial with copyable formulas](img/tickersheets-tutorial.png)](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/edit)

*Tutorial with copyable formulas.*

| What you want | Formula with the ticker in A1 |
|---|---|
| Latest available price | `=CFQUOTE(A1,"price")` |
| Regular-session price | `=CFQUOTE(A1,"regular_price")` |
| After-hours price | `=CFQUOTE(A1,"post_market_price")` |
| Trailing P/E | `=CFFUNDAMENTALS(A1,"trailing_pe")` |
| Trailing EPS | `=CFFUNDAMENTALS(A1,"eps_ttm")` |
| Daily history | `=CFHISTORY(A1,252)` |
| Option expiration dates | `=CFEXPIRATIONS(A1)` |
| Nearest-expiration option chain | `=CFOPTIONS(A1)` |

A named field returns one value in its formula's cell.
History and option functions return tables that expand into adjacent empty cells.
The functions can reuse recent cached provider responses. They do not stream continuously.
Choose **Data settings → Refresh formulas** to request new results from your installed functions.

## API keys

**The public tutorial contains no saved API keys and does not use the author's private keys.**
You can view its saved examples without adding keys.
Yahoo stock quotes, history, fundamentals, earnings and public option chains do not require a personal key.
Selected Finviz, Zacks and GuruFocus fields also use public pages.

FRED requires your own API key.
Choose **Data settings → API keys…**, enter it in **FRED**, then click **Save keys**.
The same form accepts Finnhub, Alpha Vantage, Twelve Data and CoinMarketCap keys for the original `CACHEFINANCE` / `CACHEFINANCES` functions.
Those four keys do not change `CFQUOTE`, which uses Yahoo.

Blank fields preserve saved keys. The form shows saved-status labels without revealing saved key values.
Keys stay in the attached Apps Script project's Script Properties.
Other editors of your spreadsheet can access its script and keys, so keep a copy with personal keys private.
Do not put keys in worksheet cells, formulas or GitHub reports.

If the menu is missing, reload your editable copy.
See [INSTALL.md](INSTALL.md) for authorization and the [blank-sidebar workaround](INSTALL.md#if-the-sidebar-is-blank).

## Guides

| Guide | Purpose |
|---|---|
| [INSTALL.md](INSTALL.md) | Copy the tutorial or install the functions in your own spreadsheet |
| [SAMPLE.md](SAMPLE.md) | Learn from the single-tab tutorial |
| [FUNCTIONS.md](FUNCTIONS.md) | Find every function, argument, supported field, unit and limit |
| [BUILD-YOUR-OWN.md](BUILD-YOUR-OWN.md) | Copy simple formulas into your own worksheet |
| [PROVIDERS.md](PROVIDERS.md) | Review sources and dated provider checks |

Provider availability varies by ticker and field.
The function reference explains missing results, timestamps and current limits.

## Acknowledgments

TickerSheets builds on [CacheFinance](https://github.com/demmings/cachefinance), which supplies the original caching functions and quote adapters.
See [UPSTREAM.md](UPSTREAM.md) for its attribution and preserved reference documentation.

We also used ideas from [SMF (Stock Market Functions)](https://climbermel.github.io/SMF_Add-in/) for provider lookups, research functions and spreadsheet examples.
SMF is an Excel add-in that retrieves web data into cells.
