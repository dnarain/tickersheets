# TickerSheets

Open-source stock and options research for Google Sheets.

TickerSheets is our Google Sheets application for researching one stock, its options and economic context.
It creates analysis tabs, charts, earnings tables, a watchlist and reusable formulas in your spreadsheet's Apps Script project.
It requires no hosted server.

[View the sample spreadsheet](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/edit) or [make your own copy](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/copy).
The **Single Stock Analysis** sample demonstrates one-ticker research tabs, charts, earnings, option chains and a watchlist.
You can also create your own spreadsheet with the same functions.

| Guide | Purpose |
|---|---|
| [SAMPLE.md](SAMPLE.md) | Explore the sample spreadsheet and its controls, tabs and charts |
| [INSTALL.md](INSTALL.md) | Copy the template or install the script, authorize requests and save API keys |
| [FUNCTIONS.md](FUNCTIONS.md) | Find formula arguments, output columns, units, sources and limits |
| [BUILD-YOUR-OWN.md](BUILD-YOUR-OWN.md) | Create custom tabs with one ticker input and copyable formulas |
| [PROVIDERS.md](PROVIDERS.md) | Review data sources, API keys, dated results and testing instructions |

Quotes can include regular, pre-market and after-hours prices, each with its own timestamp.
Data updates when you request a refresh. The functions do not stream prices continuously.
Provider availability varies by ticker and field. The function reference explains the current limits.

FRED requires your own API key. Finnhub, Alpha Vantage, Twelve Data and CoinMarketCap also accept provider keys.
Choose **Data settings → API keys…** in your private copy to save them outside worksheet cells.
Blank fields preserve existing keys. The form shows whether a key is saved and never displays its value.
Other editors of the same spreadsheet can access its script settings, so keep copies with personal keys private.

[PROVIDERS.md](PROVIDERS.md) lists the providers, dated results, API key requirements and testing instructions.

This application builds on [CacheFinance](https://github.com/demmings/cachefinance), which supplies the original caching functions and quote adapters.
See [UPSTREAM.md](UPSTREAM.md) for its attribution and preserved reference documentation.
