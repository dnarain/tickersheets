# TickerSheets

Reusable stock and options functions for Google Sheets.

Enter a ticker in `A1`, then put this formula in another cell:

```excel
=TICKERSHEETS_QUOTE(A1,"price")
```

That cell contains the formula and shows the returned price.
Other functions return fundamentals, earnings, daily history, option chains, RSI2 targets and FRED observations.
Everything runs in the spreadsheet's attached Apps Script. There is no hosted server.
TickerSheets is an independently maintained project with its own function API and provider requests.
The implementation was developed with substantial AI assistance and would benefit from wider testing and code review.

## Get started

Choose one installation method:

1. [Copy TickerSheet Demo and Tutorial](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/copy). Google copies its attached Apps Script too.
2. For your own spreadsheet, add a `TickerSheets` script file under **Extensions → Apps Script**, then paste [dist/TickerSheets.js](https://github.com/dnarain/tickersheets/blob/main/dist/TickerSheets.js) into it. Save and reload the spreadsheet.

Then enter the functions in the cells where you want their results.
The demo has two tabs. **Start here** teaches simple formulas beside their results.
**Stock analysis** shows charts, earnings, option quotes, Greeks and strategy calculations built from the same functions.
Both tabs use the ticker in **Start here!B4**.
You can [view the public tutorial](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/edit) without copying it.

[![Tutorial with copyable formulas](img/tickersheets-tutorial.png)](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/edit)

*Tutorial with copyable formulas.*

[![Stock analysis built with TickerSheets formulas](img/tickersheets-stock-analysis.png)](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/edit)

*Stock analysis with a closing-price chart, option quotes, calculators and a strategy-payoff chart.*

| What you want | Formula with the ticker in A1 |
|---|---|
| Latest available price | `=TICKERSHEETS_QUOTE(A1,"price")` |
| Regular-session price | `=TICKERSHEETS_QUOTE(A1,"regular_price")` |
| After-hours price | `=TICKERSHEETS_QUOTE(A1,"post_market_price")` |
| Trailing P/E | `=TICKERSHEETS_FUNDAMENTALS(A1,"trailing_pe")` |
| Trailing EPS | `=TICKERSHEETS_FUNDAMENTALS(A1,"eps_ttm")` |
| Daily history | `=TICKERSHEETS_HISTORY(A1,252)` |
| Option expiration dates | `=TICKERSHEETS_EXPIRATIONS(A1)` |
| Nearest-expiration option chain | `=TICKERSHEETS_OPTIONS(A1)` |

A named field returns one value in its formula's cell.
History and option functions return tables that expand into adjacent empty cells.
The functions can reuse recent cached provider responses. They do not stream continuously.
Choose **TickerSheets → Refresh data** to request new results from your installed functions.

## Options research

Use `TICKERSHEETS_EXPIRATIONS` to list published dates and `TICKERSHEETS_OPTIONS` to request a chain for a chosen expiration.
The chain includes call/put type, strikes, bid, ask, last price, implied volatility, volume and open interest.
The **Stock analysis** showcase combines those quotes with an option model and strategy calculators.

`TICKERSHEETS_OPTION_MODEL` calculates a theoretical premium, delta, gamma, theta, vega and rho from your assumptions.
Those calculated values are separate from the provider's market quotes.
`TICKERSHEETS_STRATEGY` calculates covered-call, cash-secured-put and call/put vertical results and expiration payoff.
See [FUNCTIONS.md](FUNCTIONS.md#tickersheets_expirations-and-tickersheets_options) for chain columns and [the model reference](FUNCTIONS.md#tickersheets_option_model) for units and limits.

[![Option model and strategy formulas](img/tickersheets-options.png)](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/edit#gid=1154872752&range=A302)

*Editable assumptions, model Greeks and strategy results, with each formula visible beside its result.*

## API keys

**The public tutorial contains no saved API keys and does not use the author's private keys.**
You can view its saved examples without adding keys.
Yahoo stock quotes, history, fundamentals, earnings and public option chains do not require a personal key.
Selected Finviz, Zacks and GuruFocus fields also use public pages.

FRED requires your own API key.
Choose **TickerSheets → API keys…**, enter it in **FRED**, then click **Save keys**.
The key form contains only FRED. The other supported data sources use public pages or endpoints.

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
| [SAMPLE.md](SAMPLE.md) | Learn from the tutorial and stock-analysis showcase |
| [FUNCTIONS.md](FUNCTIONS.md) | Find every function, argument, supported field, unit and limit |
| [BUILD-YOUR-OWN.md](BUILD-YOUR-OWN.md) | Copy simple formulas into your own worksheet |
| [PROVIDERS.md](PROVIDERS.md) | Review sources and dated provider checks |

Provider availability varies by ticker and field.
The function reference explains missing results, timestamps and current limits.

## Where TickerSheets started

TickerSheets started with [CacheFinance](https://github.com/demmings/cachefinance).
Thank you to its author and contributors for sharing code that we could learn from and extend.
Their work showed us what was possible inside Google Sheets and gave this project its starting point.

We found that Google's `GOOGLEFINANCE` data did not cover the research we wanted to do.
We expanded the provider requests and worksheet functions, then moved to TickerSheets' own API.
TickerSheets now fetches and caches its data directly. It no longer bundles CacheFinance or depends on `GOOGLEFINANCE`.
The GitHub repository has also left the CacheFinance fork network. Its commit history and GPL license remain intact.
CacheFinance also supports data sources beyond `GOOGLEFINANCE`.
People who want the original project can install [CacheFinance](https://github.com/demmings/cachefinance) separately.
The [installation guide](INSTALL.md#optional-use-cachefinance-alongside-tickersheets) explains how to use both in one spreadsheet.

We also drew ideas from [SMF](https://climbermel.github.io/SMF_Add-in/), an Excel add-in for financial data.
We appreciate both projects and the work their contributors shared.
See [CREDITS.md](CREDITS.md) for attribution and [MIGRATION.md](MIGRATION.md) for earlier TickerSheets formula names.

TickerSheets retains the [GNU GPL v3 license](LICENSE).
