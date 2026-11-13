# TickerSheet Demo and Tutorial

[View the tutorial](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/edit) or [make your own copy](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/copy).

The demo has three tabs: **Start here**, **Stock analysis** and **Options analysis**.
**Start here** shows simple custom functions and the formula text beside their results.
**Stock analysis** shows company data, earnings, technical indicators and a price chart.
**Options analysis** shows option quotes, model Greeks, strategy calculations and a payoff chart.
All three tabs use the ticker in **Start here!B4**.
The public tutorial contains saved NVDA examples and no saved API keys.

## Open your copy and its menu

1. Choose **File → Make a copy** in the public tutorial.
2. Open your editable copy and reload it.
3. Enter a ticker in the yellow **Start here!B4** cell.
4. Choose **TickerSheets → Refresh data** to request new results.
5. Complete Google's authorization steps if prompted.

Google copies the attached Apps Script with the spreadsheet.
Its `onOpen` function adds the **TickerSheets** menu.
The menu contains **API keys…** and **Refresh data**.
For a blank spreadsheet, follow [INSTALL.md](INSTALL.md) to install the same function library.

## Inspect a working formula

These cells are on **Start here**:

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
=TICKERSHEETS_QUOTE($B$4,"price")
```

Click **B7** to inspect it in the formula bar.
To use the same function on your own tab, enter a ticker in `A1` and write:

```excel
=TICKERSHEETS_QUOTE(A1,"price")
```

The functions work without the tutorial's layout.
They also work in a new spreadsheet after you install the Apps Script bundle.

## Explore Stock analysis

**Stock analysis!B4** references **Start here!B4**.
The tab contains cell formulas, their returned tables and a closing-price chart.

| Area | Where to look |
|---|---|
| Quotes and company fields | B7:B20 |
| Technical summary | B25:B36 |
| Closing-price chart | E7 |
| Daily price history | A52:G172 |
| Stock summary returned by TICKERSHEETS_WATCH_ROW | I52:J82 |
| Reported EPS | A178:J190 |
| Financial results | A196:H204 |
| Provider comparison | A214:J220 |
| Quote and fundamentals status | A226:E228 and A230:E232 |
| Optional FRED history | A240:E252 |
| Exact-date FRED value | B257 |

Click a result to inspect its formula.
Table functions start in the first cell of their displayed table.
The closing-price chart reads historical prices.
FRED examples remain unavailable until you save your own key.

## Explore Options analysis

**Options analysis!B4** also references **Start here!B4**.
Change the stock on **Start here** and the expiration or calculator assumptions on **Options analysis**.
Each result uses a visible formula. The yellow cells contain editable assumptions.

| Area | Where to look |
|---|---|
| Option expiration input | B8; blank requests the nearest available expiration |
| Published option dates | A12:A52 |
| Returned chain expiration | B10 |
| Selected option quotes | C12:N93; strikes within ±20% of regular-session price, up to 40 calls and 40 puts |
| Option model | Inputs B98:B104, results E98:E103 |
| Strategy selector | B109: covered call, cash-secured put, call vertical or put vertical |
| Strategy assumptions | B110:B115: long/short strikes and premiums, contracts and multiplier |
| Strategy results | E110:E112: maximum profit, maximum loss and breakeven |
| Strategy-payoff table and chart | A120:B161 and E121 |
| Options source status | A170:E172 |

### Option quotes and calculated values

The expiration selector chooses the chain's maturity date.
The tab filters strikes to within ±20% of regular-session price and sorts them by strike.
It shows up to 40 calls and 40 puts.
The reusable chain function returns the unfiltered chain.
The returned chain contains call/put type, strike, bid, ask, last, IV, volume and open interest.
Read each contract's last-trade time before treating its last price as current.
The underlying stock quote and the option quotes can describe different observation times.

The option model calculates a theoretical premium and Greeks from the entered spot, strike, days, volatility, rate and dividend yield.
Its premium and Greeks are model results. Bid, ask and last are provider quotes.
The strategy calculator uses its own entered assumptions to calculate position results and expiration payoff.
The payoff chart reads the strategy's calculated expiration values.
See [option model units](FUNCTIONS.md#tickersheets_option_model) and [strategy arguments](FUNCTIONS.md#tickersheets_strategy) before changing those inputs.

Use both analysis tabs as examples of arranging the functions in a larger worksheet.
The [function reference](FUNCTIONS.md) describes each field and calculation independently of this layout.

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
The **TickerSheets → API keys…** form supports Finnhub, Alpha Vantage, Twelve Data, CoinMarketCap and FRED.
Enter your own keys in the matching fields and click **Save keys**.
FRED functions require a FRED key.
`TICKERSHEETS_PROVIDER_QUOTE` requests quotes from a selected keyed provider.
The demo's Yahoo quotes do not switch providers when you save these keys.

If the form is blank, use the [browser-profile workaround](INSTALL.md#if-the-sidebar-is-blank), then open it again.
Keep copies with personal keys private. Spreadsheet editors can access the attached script and its keys.

## Refresh

Choose **TickerSheets → Refresh data** when you want another result.
The functions can reuse recent cached provider responses and do not stream continuously.
Changing the ticker also recalculates formulas that use that cell.
The demo has no hidden data tabs.
