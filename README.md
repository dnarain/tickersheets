# TickerSheets

Stock and options research in Google Sheets, with formulas you can reuse in your own spreadsheets.
Get quotes, company financials, earnings, price history and option chains.
Everything runs in Apps Script in your Google account. There is no hosted server.

For example, this formula returns Apple's latest available price:

```excel
=TICKERSHEETS_QUOTE("AAPL","price")
```

## Start with the example spreadsheet

1. [Make your own copy](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/copy). Google includes the required script with the spreadsheet.
2. Open your copy and reload it to show the **TickerSheets** menu.
3. Change the ticker in **Start here!B4**.
4. Choose **TickerSheets → Refresh data**. If Google asks, authorize the script.

That one ticker controls all three tabs:

| Tab | What it shows |
|---|---|
| **Start here** | Simple formulas beside their results, plus setup instructions |
| **Stock analysis** | Company data, earnings, a price chart and technical indicators |
| **Options analysis** | Expiration dates, option quotes, model Greeks, strategies and a payoff chart |

Model Greeks and strategy results come from the assumptions you enter.
See the [example guide](SAMPLE.md) for a walkthrough.

![Stock analysis in Google Sheets](img/tickersheets-stock-analysis.png)

## Build your own spreadsheet

To add TickerSheets to a spreadsheet you already use, follow the [installation instructions](INSTALL.md#option-2-install-the-functions-in-your-spreadsheet).

Put a ticker such as `NVDA` in `A1`, then enter these formulas in other cells:

| Data | Formula |
|---|---|
| Latest available price | `=TICKERSHEETS_QUOTE(A1,"price")` |
| After-hours price | `=TICKERSHEETS_QUOTE(A1,"post_market_price")` |
| Trailing P/E | `=TICKERSHEETS_FUNDAMENTALS(A1,"trailing_pe")` |
| Daily price history | `=TICKERSHEETS_HISTORY(A1,252)` |
| Option expiration dates | `=TICKERSHEETS_EXPIRATIONS(A1)` |
| Option chain | `=TICKERSHEETS_OPTIONS(A1)` |

Table results need empty cells beside and below the formula.
The [function reference](FUNCTIONS.md) lists every function and field.
The [build-your-own guide](BUILD-YOUR-OWN.md) gives more examples.

## Optional API keys

- **No personal key required:** Yahoo stock quotes, fundamentals, earnings, history and option chains, plus selected Finviz, Zacks and GuruFocus fields.
- **Your own key required:** FRED economic data and quotes from Finnhub, Alpha Vantage, Twelve Data or CoinMarketCap.

Add keys through **TickerSheets → API keys…** in your private copy.
The public example does not contain any API keys.
Other spreadsheet editors can access saved keys, so keep a copy with keys private.
See [API-key instructions](INSTALL.md#save-api-keys) for details.

## Data and project status

Prices do not stream continuously. Provider data can be delayed or unavailable.
Use **TickerSheets → Refresh data** to request updated results.
The [provider guide](PROVIDERS.md) describes the sources and their limits.

This project is heavily vibe-coded. Wider testing and code review are welcome.

TickerSheets started with [CacheFinance](https://github.com/demmings/cachefinance), which showed us what was possible in Google Sheets.
[SMF](https://github.com/ClimberMel/SMF_Add-in) inspired many of the functions and examples.
Thank you to both projects and their contributors.
See [credits](CREDITS.md) and the [GPL v3 license](LICENSE).
