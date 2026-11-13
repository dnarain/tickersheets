# Migrate earlier TickerSheets formulas

TickerSheets 2.0 uses the `TICKERSHEETS_` function prefix.
It supplies its own financial function library and provider requests.
The earlier function names are not aliases in the new bundle.

## Update an existing spreadsheet

1. Keep a copy of your spreadsheet before changing its script or formulas.
2. Replace the installed bundle with the current `dist/TickerSheets.js` contents.
3. Update the function names in your formulas with the map below.
4. Save the Apps Script project and reload the spreadsheet.
5. Choose **TickerSheets → Refresh data** and inspect the results.

For the renamed functions, the existing arguments retain their meanings.
Simple formulas can omit the optional refresh argument.
Your existing FRED key remains in the same project's `FRED_API_KEY` property.

| Earlier TickerSheets name | Current name |
|---|---|
| `CFQUOTE` | `TICKERSHEETS_QUOTE` |
| `CFHISTORY` | `TICKERSHEETS_HISTORY` |
| `CFFUNDAMENTALS` | `TICKERSHEETS_FUNDAMENTALS` |
| `CFOPTIONS` | `TICKERSHEETS_OPTIONS` |
| `CFEXPIRATIONS` | `TICKERSHEETS_EXPIRATIONS` |
| `CFFRED` | `TICKERSHEETS_FRED` |
| `CFFIELD` | `TICKERSHEETS_FIELD` |
| `CFDATASTATUS` | `TICKERSHEETS_DATA_STATUS` |
| `CFSTRATEGY` | `TICKERSHEETS_STRATEGY` |
| `CFEARNINGS` | `TICKERSHEETS_EARNINGS` |
| `CFQUOTECOMPARE` | `TICKERSHEETS_QUOTE_COMPARE` |
| `CFRSITARGETS` | `TICKERSHEETS_RSI_TARGETS` |
| `CFFREDVALUE` | `TICKERSHEETS_FRED_VALUE` |
| `CFOPTIONMODEL` | `TICKERSHEETS_OPTION_MODEL` |
| `CFWATCHROW` | `TICKERSHEETS_WATCH_ROW` |
| `CACHEFINANCE` | No direct replacement; use the original project separately if needed |
| `CACHEFINANCES` | No direct replacement; use the original project separately if needed |

An updated price formula is:

```excel
=TICKERSHEETS_QUOTE(A1,"price")
```

The menu is now **TickerSheets**. Use **API keys…** for your provider keys and **Refresh data** for new results.
The same form contains Finnhub, Alpha Vantage, Twelve Data, CoinMarketCap and FRED.
Existing key property names remain unchanged. Saved keys show a gray masked hint in their fields.

## Original CacheFinance functions

The original project's two general lookup functions are not part of the TickerSheets 2.0 bundle.
Their fallback, currency, cryptocurrency and provider-specific behavior has no automatic one-to-one replacement.
Use the current TickerSheets functions for the supported data listed in [FUNCTIONS.md](FUNCTIONS.md).

If you need those original functions, install [CacheFinance](https://github.com/demmings/cachefinance) separately.
TickerSheets retains its own names so the current API can develop independently.

## Changed comparison providers

`TICKERSHEETS_QUOTE_COMPARE` keeps ten columns and six data rows.
The comparison now uses four Yahoo session/page rows, a Finviz spot-price/forward-yield row and a GuruFocus forward-yield row.
The GuruFocus price stays unavailable. Analyst price targets remain separate from spot-price comparisons.

See [CREDITS.md](CREDITS.md) for the project's origins and license.
