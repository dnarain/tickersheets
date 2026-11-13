# TickerSheets functions

This reference covers sixteen `TICKERSHEETS_...` worksheet functions.
All requests run in Google Apps Script. No hosted server is required.
The tables list each function's data source and API-key requirement.
The [user guide](GUIDE.md) covers installation, the example spreadsheet and writing your own formulas.

## Refresh data

The functions can reuse parsed provider data from their cache.
Google Sheets does not automatically recalculate a formula when a cache entry expires.
See the [user guide](GUIDE.md#use-the-example-spreadsheet) for the **Refresh data** command.
Google requires each custom function to return within **30 seconds**.
Google also rejects volatile arguments such as `NOW()` and `RAND()`.
These limits come from [Google's custom function guide](https://developers.google.com/apps-script/guides/sheets/functions#guidelines_for_custom_functions).

## Tickers and missing values

The Yahoo functions accept symbols and supported exchange prefixes:

| Input | Yahoo symbol |
| --- | --- |
| `NVDA` | `NVDA` |
| `NASDAQ:AAPL` | `AAPL` |
| `NYSE:IBM` | `IBM` |
| `TSE:RY` | `RY.TO` |
| `RY.TO` | `RY.TO` |
| `NYSE:BRK.B` | `BRK-B` |

Bare US tickers do not imply a particular exchange. The quote response identifies the exchange.
The selected Finviz, Zacks and GuruFocus routes support US symbols only.

The examples use `NVDA` in `B1` unless they include a ticker directly.
Each table formula needs its own empty output area.

Do not put an API key in a formula or ticker cell.
The functions can reuse recent cached results and do not stream continuously.

The functions return these text values for unavailable data:

| Result | Meaning |
| --- | --- |
| `N/A` | The response lacks this value |
| `N/A: ...` | The request, input or dataset is unavailable |
| `n.a.` from `TICKERSHEETS_OPTION_MODEL` | The requested model result is unavailable |

These results are text. They are different from the native spreadsheet error `#N/A`.
`IFNA()` does not replace these text values.
Published numeric zeros remain zero.

An individual field selector returns one value in the cell that contains the formula.
For example, `TICKERSHEETS_QUOTE(...,"price")` returns one price and `TICKERSHEETS_QUOTE(...,"all")` returns a whole quote table.
The TickerSheets functions that return tables include a header row. Google Sheets expands each table into adjacent empty cells.
An occupied output cell causes a spreadsheet error.
Only the top-left cell contains the data function. Neighboring cells contain its expanded results.
Your own spreadsheet formulas can calculate from the returned tables.

## Function list

| Function | Result | Source | Personal key |
| --- | --- | --- | --- |
| `TICKERSHEETS_QUOTE` | Quote value or quote table | Yahoo Chart and quote page | No |
| `TICKERSHEETS_PROVIDER_QUOTE` | Quote value or field table from one selected provider | Finnhub, Alpha Vantage, Twelve Data or CoinMarketCap | Matching provider key |
| `TICKERSHEETS_QUOTE_COMPARE` | Separate provider/session comparison rows | Yahoo, Finviz and GuruFocus | No |
| `TICKERSHEETS_HISTORY` | Daily OHLCV table | Yahoo Chart | No |
| `TICKERSHEETS_FUNDAMENTALS` | Fundamental value or field table | Yahoo quote page | No |
| `TICKERSHEETS_EARNINGS` | Reported EPS, financials, estimates, events or earnings calendar | Yahoo quote-page details and Chart events | No |
| `TICKERSHEETS_OPTIONS` | One expiration's option chain | Yahoo options | No |
| `TICKERSHEETS_EXPIRATIONS` | Published option expiration dates | Yahoo options | No |
| `TICKERSHEETS_FRED` | Economic series observations | FRED API | FRED key |
| `TICKERSHEETS_FRED_VALUE` | One exact-date economic observation | FRED API | FRED key |
| `TICKERSHEETS_RSI_TARGETS` | RSI2, trigger targets and regular-session quote fields | Yahoo Chart / optional Yahoo bid/ask | No |
| `TICKERSHEETS_FIELD` | Selected provider field or field table | Finviz, Zacks or GuruFocus | No |
| `TICKERSHEETS_DATA_STATUS` | Request status and timestamps | The selected request | Required for a FRED dataset |
| `TICKERSHEETS_WATCH_ROW` | Compact labeled fields for one watchlist ticker | Yahoo quote, history and fundamentals | No |
| `TICKERSHEETS_OPTION_MODEL` | Theoretical option price or Greek | European Black–Scholes calculation | No provider request |
| `TICKERSHEETS_STRATEGY` | Strategy result or expiration payoff | Calculation from your assumptions | No provider request |

## Data sources

| Provider | Data and access |
|---|---|
| Yahoo Finance | [Chart endpoint](https://query1.finance.yahoo.com/v8/finance/chart/NVDA), [quote pages](https://finance.yahoo.com/quote/NVDA/) and option endpoints supply stock and options data. Options use a temporary anonymous session. No personal Yahoo login is required. |
| Finviz | [Quote pages](https://finviz.com/quote.ashx?t=NVDA&p=d) supply 32 selected public fields for US symbols. |
| Zacks | [Price-target pages](https://www.zacks.com/stock/research/NVDA/price-target-stock-forecast) supply the average analyst target for US symbols. |
| GuruFocus | [Dividend pages](https://www.gurufocus.com/stock/NVDA/dividend) supply public forward and trailing yields for US symbols. Premium datasets are outside this adapter. |
| Finnhub | The [quote API](https://finnhub.io/docs/api/quote) supplies selected quote fields with your Finnhub key. |
| Alpha Vantage | The [quote and exchange-rate APIs](https://www.alphavantage.co/documentation/) supply selected fields with your Alpha Vantage key. The default stock quote can be end-of-day. |
| Twelve Data | The [quote API](https://twelvedata.com/docs/market-data/quote) supplies selected fields with your Twelve Data key. Bar-opening time and quote time remain separate fields. |
| CoinMarketCap | The [cryptocurrency quotes API](https://coinmarketcap.com/api/documentation/pro-api-reference/cryptocurrency#quotes-latest) supplies selected cryptocurrency fields with your CoinMarketCap key. |
| FRED | The official [series](https://fred.stlouisfed.org/docs/api/fred/series.html) and [observations](https://fred.stlouisfed.org/docs/api/fred/series_observations.html) APIs supply economic data with your FRED key. |

A website subscription does not automatically grant API access.
The Finviz, Zacks and GuruFocus functions use public pages and accept no subscription credentials.
Keyed-provider plans control symbol access, request limits and quote delays.
Provider pages can block requests, change format or omit individual fields.
An accepted response can still contain unavailable values.
A recent retrieval time does not establish a recent trade.
The function sections describe each field's meaning, units and timestamps.

## Output size

These sizes apply to successful requests. An unavailable dataset can return one explanatory text value instead of a table.

| Function or output | Rows × columns |
|---|---|
| Scalar field from `TICKERSHEETS_QUOTE`, `TICKERSHEETS_PROVIDER_QUOTE`, `TICKERSHEETS_FUNDAMENTALS`, `TICKERSHEETS_FIELD` or `TICKERSHEETS_RSI_TARGETS` | `1 × 1` |
| `TICKERSHEETS_QUOTE(...,"all",...)` | `30 × 2`, including the header |
| `TICKERSHEETS_PROVIDER_QUOTE(...,"all",...)` | `20 × 2`, including the header |
| `TICKERSHEETS_QUOTE_COMPARE` | `7 × 10`: header and six comparison rows |
| `TICKERSHEETS_HISTORY` | At most `(sessions + 1) × 7`, including the header |
| `TICKERSHEETS_FUNDAMENTALS(...,"all",...)` | `(returned fields + 1) × 5` |
| `TICKERSHEETS_EARNINGS` | Header and data rows; 10, 8, 10, 4, 4 or 4 columns, depending on section |
| `TICKERSHEETS_EXPIRATIONS` | `(expiration count + 1) × 1`; two columns with `includeRefresh=TRUE` |
| `TICKERSHEETS_OPTIONS` | `(contract count + 1) × 12` |
| `TICKERSHEETS_FRED` | At most `(observations + 1) × 5`, including the header |
| `TICKERSHEETS_FRED_VALUE`, `TICKERSHEETS_OPTION_MODEL`, `TICKERSHEETS_STRATEGY` | `1 × 1` |
| `TICKERSHEETS_RSI_TARGETS(...,"all",...)` | `2 × 12`: headers, then values |
| `TICKERSHEETS_RSI_TARGETS(...,"headers",...)` | `1 × 12`, without a provider request |
| `TICKERSHEETS_FIELD("FINVIZ",...,"all",...)` | `33 × 5` |
| `TICKERSHEETS_FIELD("ZACKS",...,"all",...)` | `2 × 5` |
| `TICKERSHEETS_FIELD("GURUFOCUS",...,"all",...)` | `3 × 5` |
| `TICKERSHEETS_DATA_STATUS` | `2 × 5`: headers, then status |
| `TICKERSHEETS_WATCH_ROW` | `31 × 2`: header and 30 labeled values |

Leave the entire output area empty before entering a table formula.

## TICKERSHEETS_QUOTE

Source: Yahoo Chart and quote pages. No personal key is required.

```text
TICKERSHEETS_QUOTE(ticker, field="price", refresh="")
```

Examples:

```excel
=TICKERSHEETS_QUOTE($B$1,"price")
=TICKERSHEETS_QUOTE("TSE:RY","currency")
=TICKERSHEETS_QUOTE($B$1,"quote_time")
=TICKERSHEETS_QUOTE($B$1,"all")
```

Use a named field such as `"price"` for one value in one cell.
Use `"all"` when you want a two-column table and have room for its expanded result.

Supported fields:

| Field | Meaning |
| --- | --- |
| `price` | Accepted price for the provider's current session, including extended hours when available |
| `name` | Company or fund name |
| `currency` | Quote currency |
| `exchange` | Exchange name or code from Yahoo |
| `quote_time` | Source timestamp for the quote |
| `price_session` | `Regular`, `Pre-market` or `After-hours` for `price` |
| `market_state` | Yahoo's reported market state |
| `regular_price`, `regular_time` | Last published regular-session price and timestamp |
| `pre_market_price`, `pre_market_time` | Last published pre-market price and timestamp |
| `post_market_price`, `post_market_time` | Last published after-hours price and timestamp |
| `regular_change`, `regular_change_fraction` | Published regular-session change and fractional change |
| `pre_market_change`, `pre_market_change_fraction` | Published pre-market change and fractional change |
| `post_market_change`, `post_market_change_fraction` | Published after-hours change and fractional change |
| `previous_close` | Explicit previous-close value, if supplied |
| `day_high`, `day_low` | Published daily high and low |
| `volume` | Published volume in shares |
| `fifty_two_week_high`, `fifty_two_week_low` | Published 52-week range |
| `market_cap` | Market capitalization, if present in quote metadata |
| `retrieved_at` | Time Apps Script retrieved the response |
| `status` | Request status |
| `source` | Public source URL |
| `all` | Two-column `Field`, `Value` table |

An absent `previous_close` remains `N/A`.
The function does not substitute the opening price of the two-year history range.
`TICKERSHEETS_FUNDAMENTALS` can supply market capitalization when quote metadata lacks it.
Change values use currency per share. Fields ending in `_change_fraction` use fractions, such as `0.025` for `2.5%`.
Quote timestamps use ISO text in UTC when the source supplies a valid time.

An extended-hours quote requires a valid price and timestamp for the matching ticker.
The session selector promotes it only when it is newer than the accepted regular quote.
`OVERNIGHT` can select the last published after-hours quote. The result remains labeled `After-hours`, with its own timestamp.
An explicit pre-market or after-hours field can describe an earlier session. Always inspect its timestamp.
The displayed quote does not change daily history, RSI inputs or closed option-market quotes.

```excel
=TICKERSHEETS_QUOTE($B$1,"price_session")
=TICKERSHEETS_QUOTE($B$1,"regular_price")
=TICKERSHEETS_QUOTE($B$1,"post_market_price")
=TICKERSHEETS_QUOTE($B$1,"post_market_time")
```

The current-session lookup can request both Yahoo Chart and the matching Yahoo quote page.
Chart data and session quotes use 60-second caches.
The quote, fundamentals and earnings functions also share a 60-second cache of parsed quote-page data.
An unavailable quote page leaves accepted Chart data available.
The function does not take session quotes from the fifteen-minute fundamentals cache.
The explicit `regular_...` fields use Chart metadata. The `all` table can merge a newer matching regular quote from the quote page.

The quote cache lasts up to 60 seconds.
Google Sheets does not automatically recalculate a formula when its cache entry expires.
Choose **TickerSheets → Refresh data** to request new results.
On your own tab, change the ticker or re-enter the formula.

## TICKERSHEETS_PROVIDER_QUOTE

Sources: Finnhub, Alpha Vantage, Twelve Data or CoinMarketCap. The selected provider requires your key.

```text
TICKERSHEETS_PROVIDER_QUOTE(ticker, provider, field="price", refresh="")
```

This function requests one selected provider directly and requires your own key for that provider.
`TICKERSHEETS_QUOTE` continues to use Yahoo without a personal key.
Saving keys does not change that default source.

Save the matching key with the [API-key instructions](GUIDE.md#save-api-keys) before using these formulas:

```excel
=TICKERSHEETS_PROVIDER_QUOTE("NVDA","FINNHUB","price")
=TICKERSHEETS_PROVIDER_QUOTE("NVDA","ALPHA_VANTAGE","price")
=TICKERSHEETS_PROVIDER_QUOTE("NVDA","TWELVE_DATA","price")
=TICKERSHEETS_PROVIDER_QUOTE("BTC","COINMARKET","price")
```

Provider names are case-insensitive. Spaces, underscores and hyphens are optional:

| Provider argument | Accepted alias | API key field |
|---|---|---|
| `FINNHUB` | — | Finnhub |
| `ALPHA_VANTAGE` | `ALPHAVANTAGE` | Alpha Vantage |
| `TWELVE_DATA` | `TWELVEDATA` | Twelve Data |
| `COINMARKET` | `COINMARKETCAP` | CoinMarketCap |

Stock requests accept symbols such as `NVDA`, `NASDAQ:NVDA` and `NYSE:IBM`.
Alpha Vantage and Twelve Data also accept pairs such as `USD/EUR` and `CURRENCY:USDEUR`.
CoinMarketCap accepts cryptocurrency symbols such as `BTC`, with USD as the default quote currency.
An explicit cryptocurrency pair can use `BTC/USD` or `CURRENCY:BTCUSD`.
The provider's plan and symbol permissions still control access.
CoinMarketCap rejects an ambiguous symbol instead of choosing one cryptocurrency silently.

The `price` field returns one value.
The `all` field returns a two-column `Field`, `Value` table:

```excel
=TICKERSHEETS_PROVIDER_QUOTE($B$1,"FINNHUB","all")
```

Supported fields:

| Field | Meaning |
|---|---|
| `price` | Provider quote price or exchange rate |
| `name`, `symbol`, `currency` | Name, symbol and quote currency, when supplied |
| `quote_time` | Provider quote timestamp in UTC, when supplied |
| `quote_date` | Published trading date, or the UTC date from `quote_time` |
| `bar_time` | Twelve Data bar opening timestamp, distinct from the quote timestamp |
| `price_basis` | Description of the provider's price and timing |
| `previous_close`, `day_open`, `day_high`, `day_low` | Reported session prices, when supplied |
| `volume` | Stock share volume, or CoinMarketCap's 24-hour turnover in the quote currency |
| `change` | Reported price change, when supplied |
| `change_fraction` | Reported percentage change as a fraction, so `0.01` means `1%` |
| `change_period` | `previous_close` for stock quotes or `24_hours` for CoinMarketCap |
| `source`, `status`, `retrieved_at` | Provider name, request status and retrieval time |

Unavailable fields remain `N/A`.
CoinMarketCap's `volume` uses different units from stock share volume.
The `change_period` field identifies the comparison period for a reported change.

The function preserves the provider's observation time or date.
Alpha Vantage's default stock quote can describe an end-of-day session and lacks an intraday UTC timestamp.
Twelve Data's bar opening time does not replace a missing quote timestamp.
A recent request does not establish a recent trade.
The function returns unavailable text for a missing key, rejected request or unavailable symbol.
It does not substitute a quote from another provider.
Accepted responses share a 60-second cache by provider and normalized symbol or currency pair.
The cache contains public quote fields and no saved API keys.
The **Refresh data** menu includes these formulas.

## TICKERSHEETS_HISTORY

Source: Yahoo Chart. No personal key is required.

```text
TICKERSHEETS_HISTORY(ticker, sessions=252, refresh="")
```

Examples:

```excel
=TICKERSHEETS_HISTORY($B$1,252)
=TICKERSHEETS_HISTORY("TSE:RY",510)
```

`sessions` accepts an integer from `1` through `510`.
The request covers approximately two years of daily history.
A recent listing can have fewer rows.
The function does not retrieve an unlimited archive.

The table contains seven columns:

| Column | Meaning |
| --- | --- |
| `Date` | UTC date of the Yahoo daily-bar timestamp, as `YYYY-MM-DD` text |
| `Open`, `High`, `Low`, `Close` | Yahoo daily prices |
| `Adjusted close` | Yahoo's separately supplied adjusted close |
| `Volume` | Shares traded |

Rows run from oldest to newest.
A current session can lack its closing price.
The missing close remains `N/A`, even when a newer live quote exists.

Use the Close column for your own closing-price calculations and indicators.
Use Adjusted close for returns that follow Yahoo's adjustments.
Keep the calculation date separate from a newer current quote.

## TICKERSHEETS_FUNDAMENTALS

Source: Yahoo quote pages. No personal key is required.

```text
TICKERSHEETS_FUNDAMENTALS(ticker, field="all", refresh="")
```

Examples:

```excel
=TICKERSHEETS_FUNDAMENTALS($B$1,"market_cap")
=TICKERSHEETS_FUNDAMENTALS($B$1,"trailing_pe")
=TICKERSHEETS_FUNDAMENTALS($B$1,"dividend_yield")
=TICKERSHEETS_FUNDAMENTALS($B$1,"all")
```

`all` returns `Field`, `Value`, `Unit`, `Currency` and `Source`.
The table contains field records found in the response. A recognized field can contain `N/A`.
Field names are case-insensitive.
An unavailable or unknown field returns `N/A`.
Availability differs between companies and funds.

The function reads labeled quote statistics and published JSON in the Yahoo quote page.
It does not calculate missing fundamental values from unrelated fields.

Supported field groups:

| Group | Field names |
| --- | --- |
| Valuation | `market_cap`, `enterprise_value`, `trailing_pe`, `forward_pe`, `peg_ratio`, `price_to_book`, `price_to_sales`, `ev_revenue`, `ev_ebitda` |
| Earnings | `eps_ttm`, `eps_forward`, `earnings_date`, `earnings_growth` |
| Ownership and short interest | `shares_outstanding`, `float_shares`, `short_shares`, `short_float`, `short_ratio`, `insider_ownership`, `institutional_ownership` |
| Dividends | `forward_dividend_rate`, `dividend_yield`, `trailing_dividend_yield`, `payout_ratio`, `ex_dividend_date` |
| Financial totals | `total_cash`, `total_debt`, `total_revenue`, `ebitda`, `free_cashflow`, `operating_cashflow` |
| Margins and returns | `gross_margin`, `operating_margin`, `net_margin`, `return_on_equity`, `return_on_assets`, `revenue_growth` |
| Balance sheet ratios | `current_ratio`, `quick_ratio`, `debt_to_equity` |
| Analyst targets | `target_low`, `target_price`, `target_median`, `target_high`, `analyst_count` |
| Quote statistics | `previous_close`, `open`, `bid`, `ask`, `day_low`, `day_high`, `fifty_two_week_low`, `fifty_two_week_high`, `volume`, `average_volume`, `beta` |
| Funds | `fund_assets`, `net_assets`, `nav`, `expense_ratio`, `fund_yield`, `ytd_return`, `inception_date` |

A `fraction` value of `0.025` means `2.5%`.
Ratios such as P/E and beta are plain numbers.
Currency values identify their currency when the source supplies it.
Financial reporting currency can differ from quote currency.

The tutorial's **Start here!B12** and **B13** use individual P/E and EPS formulas.
For field units and currencies in your own spreadsheet, use `TICKERSHEETS_FUNDAMENTALS(...,"all",...)`.
An individual field call returns only its value.

`TICKERSHEETS_EARNINGS` supplies the separate earnings, financial statement, estimate and event tables.
`TICKERSHEETS_FUNDAMENTALS` returns the scalar fields listed here.

## TICKERSHEETS_EARNINGS

Sources: Yahoo quote pages and Chart events. No personal key is required.

```text
TICKERSHEETS_EARNINGS(ticker, section="earnings", refresh="")
```

Examples:

```excel
=TICKERSHEETS_EARNINGS($B$1,"earnings")
=TICKERSHEETS_EARNINGS($B$1,"financials")
=TICKERSHEETS_EARNINGS($B$1,"estimates")
=TICKERSHEETS_EARNINGS($B$1,"calendar")
```

The function returns one table for the selected section:

| Section | Columns, in order |
|---|---|
| `earnings` | Period, Basis, EPS actual, EPS estimate, Difference, Surprise % points, Reported, Period end, Currency, Source |
| `financials` | Financial period, Frequency, Basis, Revenue, Net income, Profit margin, Currency, Source |
| `estimates` | Estimate period, Basis, EPS low, EPS average, EPS high, Revenue low, Revenue average, Revenue high, Currency, Source |
| `dividends` | Dividend date, Amount / share, Currency, Source |
| `splits` | Split date, New shares, Old shares, Source |
| `calendar` | Field, Value, Status, Source |

The calendar fields are `next_earnings_date`, `next_earnings_dates` and `date_status`.
The first field contains the first reported date. The second retains all reported dates, separated by ` / `.
`date_status` returns `Estimated`, `Provider marks confirmed` or `Not specified`.
Dates use ISO text. Provider period labels, accounting bases and currencies remain separate.
EPS uses currency per share. Revenue and net income use currency amounts.
Profit margin is a fraction. `Surprise % points` retains the provider's percentage-point value.
Missing values remain `N/A`, and reported numeric zeros remain zero.
An unavailable section returns its header and an explanatory, same-width row.

Earnings, financials, estimates and calendar sections share the quote-page details cache.
Dividends and splits share the Chart event request.
In your own comparisons, keep GAAP and adjusted results separate.
Match the financial period, frequency and currency before calculating growth.

## TICKERSHEETS_QUOTE_COMPARE

Sources: Yahoo, Finviz and GuruFocus. No personal key is required.

```text
TICKERSHEETS_QUOTE_COMPARE(ticker, refresh="")
```

```excel
=TICKERSHEETS_QUOTE_COMPARE($B$1)
```

The table contains these ten columns:

```text
Provider, Price, Yield, Currency, Identity, Quote time,
Retrieved at, Status, Source, Note
```

The six rows cover Yahoo regular, Yahoo website regular, Yahoo pre-market, Yahoo after-hours, Finviz and GuruFocus.
Finviz supplies a spot price and forward yield when available.
GuruFocus supplies forward yield only. Its Price cell remains `N/A` and its note identifies the yield-only result.
Missing forward yields remain unavailable. The function does not substitute a trailing yield.
The Zacks analyst target is excluded because it is a target price.
Each row retains its source, currency, quote time, retrieval time and status.
The note identifies a yield basis or another provider limit when available.
The table does not rank the providers or replace a missing provider value with another row's price.

## TICKERSHEETS_EXPIRATIONS and TICKERSHEETS_OPTIONS

Source: Yahoo options. No personal key is required.

```text
TICKERSHEETS_EXPIRATIONS(ticker, refresh="", includeRefresh=FALSE)
TICKERSHEETS_OPTIONS(ticker, expiration="", refresh="")
```

`TICKERSHEETS_EXPIRATIONS` returns one column with the header `Expiration`.
With `includeRefresh=TRUE`, it adds a `Refresh number` column for formulas that track an explicit refresh argument.
Each date uses `YYYY-MM-DD` text.
`TICKERSHEETS_OPTIONS` returns the chain for one published expiration.
If `expiration` is empty, the function requests the provider's default expiration.

For a formula that uses an available date:

1. Enter this formula in cell `D1`:

   ```excel
   =TICKERSHEETS_EXPIRATIONS($B$1)
   ```

2. Enter this formula in cell `F1`:

   ```excel
   =TICKERSHEETS_OPTIONS($B$1,D2)
   ```

Cell `D2` contains the first published expiration when the request succeeds.
An explicit date can use `YYYY-MM-DD` text, such as `"2027-01-15"`, or a date-valued cell.
The script interprets date-valued cells in the spreadsheet's time zone.
The date must appear in the provider's current expiration list.

The chain contains these columns:

```text
Expiration, Type, Strike, Bid, Ask, Mid, Last, IV fraction,
Volume, Open interest, Last trade, Contract
```

`Type` is `Call` or `Put`.
Strike and premiums are per share.
An IV of `0.50` means `50%` annual volatility.
Volume and open interest count contracts.
`Last trade` identifies the individual option's trade time.
It does not establish the age of its bid and ask.

Mid uses a valid, ordered bid and ask.
A missing or crossed market produces `N/A` for mid.
The standard-contract filter excludes adjusted option contracts.

The options request uses an anonymous Yahoo session.
No personal Yahoo username, password or subscription key is required by this code.
Provider restrictions can still prevent a request.
The function returns the accepted contracts for the requested expiration.
Provide enough empty rows and twelve empty columns for its returned table.

## TICKERSHEETS_FRED

Source: FRED API. Your FRED key is required.

```text
TICKERSHEETS_FRED(seriesId, observations=60, refresh="")
```

Examples:

```excel
=TICKERSHEETS_FRED("DGS10",252)
=TICKERSHEETS_FRED("UNRATE",120)
=TICKERSHEETS_FRED("CPIAUCSL",60)
```

`observations` accepts an integer from `1` through `1000`.
The function accepts FRED series IDs such as Treasury yields, unemployment and consumer prices.
It returns observations from oldest to newest.
`TICKERSHEETS_FRED` and `TICKERSHEETS_FRED_VALUE` accept series IDs with 1–50 letters, digits or underscores.
The functions trim spaces and convert the ID to uppercase.

Output columns are `Date`, `Value`, `Unit`, `Series` and `Source`.
A missing observation, including FRED's `.` marker, returns `N/A`.
Observation dates describe economic periods or sessions.
They do not necessarily identify publication dates.

The function requires your own FRED API key.
The [user guide](GUIDE.md#save-api-keys) explains how to get and save it.
The key is never a formula argument.

The returned unit controls interpretation:

| Example | Interpretation |
| --- | --- |
| `DGS10` value `4.25` | A `4.25%` yield, already in percent units |
| `UNRATE` value `4.2` | A `4.2%` unemployment rate |
| `CPIAUCSL` | A consumer price index level, not annual inflation |

Do not apply ordinary percentage formatting to a FRED percent level such as `4.25`.
Google Sheets shows `425%` with that formatting.

## TICKERSHEETS_FRED_VALUE

Source: FRED API. Your FRED key is required.

```text
TICKERSHEETS_FRED_VALUE(seriesId, date, refresh="")
```

Examples:

```excel
=TICKERSHEETS_FRED_VALUE("DGS10","2026-11-05")
=TICKERSHEETS_FRED_VALUE("DGS10",DATE(2026,11,5))
=TICKERSHEETS_FRED_VALUE($E$1,$E$2)
```

`date` accepts strict `YYYY-MM-DD` text or a date-valued cell.
The script interprets a date-valued cell in the spreadsheet's time zone.
The API request sets both observation bounds to that date.
The function never substitutes an earlier observation for a holiday, weekend or missing period.
The date identifies an observation period. This interface does not select historical data vintages.
Monthly and quarterly series require their actual observation-period date, which can differ from the publication date.
For example, an October observation can use October 1 even when FRED publishes it later.

The result is one numeric value in FRED's published units.
A percent level such as `4.88` means `4.88%`. Do not apply ordinary percentage formatting to that number.
A missing `.` observation and an absent date produce distinct explanatory `N/A` messages.
Valid zero and negative values remain numeric.
An invalid calendar date, such as `2026-02-30`, returns an input error before a provider request.

The function uses the same private `FRED_API_KEY` setting as `TICKERSHEETS_FRED`.
It caches accepted public values for up to one hour.
Missing keys, provider failures and absent observations remain explanatory text results.
This function returns one observation value. It does not return series titles, releases or other metadata selectors.

## TICKERSHEETS_RSI_TARGETS

Source: Yahoo Chart, with optional Yahoo bid/ask requests. No personal key is required.

```text
TICKERSHEETS_RSI_TARGETS(ticker, lowTrigger=20, highTrigger=80, field="all", refresh="")
```

Examples:

```excel
=TICKERSHEETS_RSI_TARGETS($B$1,20,80,"rsi2")
=TICKERSHEETS_RSI_TARGETS($B$1,20,80,"buy_target")
=TICKERSHEETS_RSI_TARGETS($B$1,20,80,"sell_target")
=TICKERSHEETS_RSI_TARGETS($B$1,20,80,"all")
=TICKERSHEETS_RSI_TARGETS($B$1,20,80,"previous_rsi2")
=TICKERSHEETS_RSI_TARGETS($B$1,20,80,"headers")
```

The function seeds Wilder's two-period averages from 21 completed sessions before the quoted regular session.
It excludes that quoted session's daily bar and applies the regular-session quote to the previous averages.
The output describes that quoted session. It does not forecast the next trading day's price.

`lowTrigger` and `highTrigger` are integers from 1 through 99.
For both targets, the low trigger must be less than the high trigger.
The function validates only the triggers required by the requested field.
RSI values use a scale from 0 through 100.
Targets and quote prices use currency per share.

| Field | Meaning |
|---|---|
| `rsi2` | RSI2 after the regular-session quote |
| `buy_target`, `sell_target` | Prices for the requested low/high triggers |
| `price` | Regular-session price used by the RSI calculation |
| `bid`, `ask` | Optional Yahoo quote-endpoint fields, when accepted |
| `open`, `low`, `high`, `volume` | Published regular-session fields |
| `previous_close`, `previous_rsi2` | Values before the quoted session |
| `all` | Twelve headers and one row of values, in the order that follows |
| `headers` | Twelve headers, without a provider request |

The twelve columns have this fixed order:

```text
Current RSI2, Buy target price, Sell target price, Last traded price,
Bid price, Ask price, Open price, Low price, High price, Volume,
Previous close, Previous RSI2
```

The buy target requires `lowTrigger <= previous_rsi2`.
The sell target requires `highTrigger >= previous_rsi2`.
The function returns `N/A` for a target that fails its condition.
An unattainable, nonpositive or undefined target also remains `N/A`.
A flat prior series has no unique finite target for an interior RSI trigger.
Missing bid/ask fields remain `N/A` while the RSI and targets can still return values.
The `bid`, `ask` and `all` outputs use a separate optional Yahoo request.
The function checks the ticker and the quoted regular-session date.
Price and bid/ask updates can have different timestamps.
Yahoo can reject this optional request, including with HTTP 401.
After-hours prices do not replace its regular-session input.
Volume counts shares. RSI values are indexes, so ordinary percentage formatting is unsuitable.

The function uses three months of daily Chart data to select the required prior closes.
It caches parsed chart facts for up to 60 seconds and shares them across fields and trigger values.
Optional bid/ask results use a separate cache of up to 60 seconds.
The function recalculates the target from the accepted snapshot after a trigger change.
Choose **TickerSheets → Refresh data** to request another snapshot.
On your own tab, re-enter the formula to recalculate it.

## TICKERSHEETS_FIELD

Sources: public Finviz, Zacks and GuruFocus pages. No personal key is required.

```text
TICKERSHEETS_FIELD(provider, ticker, field="all", refresh="")
```

Examples:

```excel
=TICKERSHEETS_FIELD("FINVIZ",$B$1,"rsi14")
=TICKERSHEETS_FIELD("ZACKS",$B$1,"target_price")
=TICKERSHEETS_FIELD("GURUFOCUS",$B$1,"forward_dividend_yield")
=TICKERSHEETS_FIELD("FINVIZ",$B$1,"all")
```

Provider names are `FINVIZ`, `ZACKS` and `GURUFOCUS`.
Provider and field names are case-insensitive.
`GURUDIV` is an alias for `GURUFOCUS`.
`field` accepts a field name or one of the numeric IDs listed below.
`all` returns the five-column field table, including unavailable values.

The three providers expose 35 selected fields. Thirty-four fields also accept a numeric ID.
GuruFocus trailing yield accepts its field name only.
For example, `=TICKERSHEETS_FIELD("FINVIZ",$B$1,4054)` is an optional shortcut for the `rsi14` example above.
These public routes do not use saved website credentials.
A blocked page, changed page or unavailable field remains unavailable.

### Finviz: 32 fields

| Field | Numeric ID | Unit |
| --- | --- | --- |
| `price` | 4074 | Currency per share |
| `earnings_date` | 4072 | Date text |
| `market_cap` | 4006 | Currency |
| `trailing_pe` | 4001 | Ratio |
| `forward_pe` | 4007 | Ratio |
| `eps_ttm` | 4002 | Currency per share |
| `eps_next_year` | 4008 | Currency per share |
| `eps_growth_next_year` | 4026 | Fraction |
| `target_price` | 4062 | Currency per share |
| `volume` | 4079 | Shares |
| `average_volume` | 4073 | Shares |
| `forward_dividend_rate` | 4036 | Annual currency per share |
| `forward_dividend_yield` | 4037 | Fraction |
| `trailing_dividend_rate` | 4043 | Annual currency per share |
| `trailing_dividend_yield` | 4044 | Fraction |
| `dividend_ex_date` | 4050 | Date text |
| `short_float` | 4016 | Fraction |
| `insider_ownership` | 4003 | Fraction |
| `institutional_ownership` | 4015 | Fraction |
| `rsi14` | 4054 | Index from 0 to 100 |
| `sma20_distance` | 4075 | Fraction |
| `sma50_distance` | 4076 | Fraction |
| `sma200_distance` | 4077 | Fraction |
| `return_week` | 4005 | Fraction |
| `return_month` | 4011 | Fraction |
| `return_quarter` | 4017 | Fraction |
| `return_year` | 4029 | Fraction |
| `return_ytd` | 4035 | Fraction |
| `gross_margin` | 4047 | Fraction |
| `operating_margin` | 4053 | Fraction |
| `profit_margin` | 4060 | Fraction |
| `beta` | 4042 | Ratio |

### Zacks: one field

| Field | Numeric ID | Unit |
| --- | --- | --- |
| `target_price` | 849 | Currency per share |

### GuruFocus: two fields

| Field | Numeric ID | Unit |
| --- | --- | --- |
| `forward_dividend_yield` | 2727 | Fraction |
| `trailing_dividend_yield` | Name only | Fraction |

## TICKERSHEETS_DATA_STATUS

Source: the selected dataset request. FRED requests require your FRED key.

```text
TICKERSHEETS_DATA_STATUS(ticker, dataset="quote", argument="", refresh="")
```

Examples:

```excel
=TICKERSHEETS_DATA_STATUS($B$1,"quote","")
=TICKERSHEETS_DATA_STATUS($B$1,"fundamentals","")
=TICKERSHEETS_DATA_STATUS($B$1,"options",D2)
=TICKERSHEETS_DATA_STATUS("DGS10","fred",252)
=TICKERSHEETS_DATA_STATUS($B$1,"provider","FINVIZ")
```

| Dataset | Meaning of `ticker` | Meaning of `argument` |
| --- | --- | --- |
| `quote` | Stock ticker, with current-session quote selection | Unused |
| `history` | Stock ticker, using Chart data only | Unused |
| `fundamentals` | Stock ticker | Unused |
| `options` | Stock ticker | Expiration date, or empty |
| `fred` | FRED series ID | Observation count, default 60 |
| `provider` | Stock ticker | Provider name |

The result has a header and one status row:

```text
Status, Retrieved at, Quote time, Cached, Source
```

Use the same ticker, dataset and request arguments as the data formula.
Different expiration dates or FRED observation counts identify different requests.
`Cached=TRUE` means Apps Script reused a public response.
It does not establish that the source quote is current.

`Retrieved at` records the request time.
`Quote time` records the source quote time when available.
Cached results retain their original retrieval time.
The source can publish delayed or unchanged data.
A provider can return some fields and leave others unavailable.
This function has no exact-date FRED or RSI2 dataset selector.
Its `fred` selector reports the recent-observation table from `TICKERSHEETS_FRED`, not a `TICKERSHEETS_FRED_VALUE` request.
For keyed quotes, use `TICKERSHEETS_PROVIDER_QUOTE(...,"status")` or its `"all"` table.
`TICKERSHEETS_DATA_STATUS` has no keyed-quote selector.
This function can request data when its cache is empty.

Successful public responses use these cache periods:

| Request | Cache period |
| --- | --- |
| Chart data and separate session quotes | 60 seconds each |
| Keyed provider quotes | 60 seconds |
| RSI2 chart facts and optional bid/ask | 60 seconds each |
| Fundamentals and earnings details | 15 minutes, with a shared 60-second parsed quote-page cache |
| Watchlist summary for one other ticker | 60 seconds |
| Option chain | 60 seconds |
| FRED recent observations and exact-date values | 1 hour |
| Finviz, Zacks and GuruFocus fields | 5 minutes |

Each field formula runs in a separate Apps Script execution.
Quote and fundamental calls share cached Chart and quote-page responses.
For an uncached response, a call can wait up to 10 seconds while another call requests public data.
If that wait ends without a result, the cell reports that another request is still loading public data.
Wait for the other formulas to finish, then request another refresh.
Google can remove cache entries, so this reuse does not guarantee exactly one provider request.

Failed requests do not enter this cache.
Google can remove a cache entry before its expiry.
The cache contains public results, without API keys or anonymous session credentials.
These periods apply to the TickerSheets functions.

## TICKERSHEETS_WATCH_ROW

Sources: Yahoo quotes, history and fundamentals. No personal key is required.

```text
TICKERSHEETS_WATCH_ROW(ticker, refresh="")
```

```excel
=TICKERSHEETS_WATCH_ROW($B$1)
```

The function returns a two-column `Field`, `Value` table for one watchlist stock.
The 30 fields appear in this order:

```text
status, price, currency, quote_time, retrieved_at, indicator_as_of,
return1d, return1m, return1y, rsi14, sma50, sma200, volatility20d,
trailing_pe, eps_ttm, market_cap, target_price, next_earnings, source,
price_session, atm_iv, return3m, return_ytd, max_drawdown, macd,
macd_signal, average_volume20, bar_count, previous_rsi2, previous_close
```

The function shares cached quote and fundamental requests with the other research functions.
It requests history and calculates the compact indicator summary inside Apps Script.
It does not request option chains or RSI2 targets. Its `atm_iv` and `previous_rsi2` fields remain `N/A`.
Returns, volatility and drawdown use fractions. RSI14 uses an index from 0 through 100.
SMA and MACD use the stock's quote currency per share.
`indicator_as_of` identifies the latest accepted daily close, which can precede the current quote.

You can use one `TICKERSHEETS_WATCH_ROW` call per ticker to build your own watchlist.
Leave two columns and enough rows empty for each returned summary.

## TICKERSHEETS_OPTION_MODEL

The function uses European Black–Scholes calculations and makes no provider request.

```text
TICKERSHEETS_OPTION_MODEL(spot, strike, days, iv, rate, dividendYield, type, metric="price")
```

Examples:

```excel
=TICKERSHEETS_OPTION_MODEL(100,100,30,0.25,0.04,0,"Call","price")
=TICKERSHEETS_OPTION_MODEL(100,100,30,0.25,0.04,0,"Put","delta")
=TICKERSHEETS_OPTION_MODEL(100,100,30,0.25,0.04,0,"Call","vega")
```

This function calculates a European Black–Scholes result from your assumptions.
It does not fetch a market price.
American-style exercise and early assignment can differ from this model.

| Input | Unit |
| --- | --- |
| `spot`, `strike` | Currency per share |
| `days` | Calendar days to expiration |
| `iv` | Annual volatility fraction, such as `0.25` for 25% |
| `rate` | Continuously compounded annual rate fraction, such as `0.04` for 4% |
| `dividendYield` | Continuous annual dividend yield fraction |
| `type` | `Call` or `Put`, also `C` or `P` |

| Metric | Result unit |
| --- | --- |
| `price` | Theoretical premium per share |
| `delta` | Premium change per unit of underlying price |
| `gamma` | Delta change per unit of underlying price |
| `theta` | Premium change per calendar day |
| `vega` | Premium change per one IV percentage point |
| `rho` | Premium change per one rate percentage point |
| `d1`, `d2` | Dimensionless model terms |

For a standard contract, multiply the premium by `100` shares.
For a position, also multiply by the number of contracts.
`spot` and `strike` must be positive numbers. `days` and `iv` must be nonnegative numbers.
The numeric arguments require numeric cells or numeric literals.
The function returns `n.a.` for an invalid input or unavailable metric.
At expiration, price equals intrinsic value and several Greeks are unavailable.

## TICKERSHEETS_STRATEGY

The function calculates from your assumptions and makes no provider request.

```text
TICKERSHEETS_STRATEGY(strategy, spot, longStrike, longPremium, shortStrike, shortPremium,
           contracts=1, multiplier=100, expiration="", metric="maxProfit", stockAtExpiry)
```

The strategy calculation uses your premiums, strikes and position size.
It does not fetch prices or submit orders.
Premium inputs are per share.
The contract multiplier converts per-share amounts to position amounts.
The default multiplier is `100` shares per contract.

Supported strategy names are `Covered call`, `Cash-secured put`, `Call vertical` and `Put vertical`.
Names are case-insensitive and accept spaces, underscores or hyphens.
Verticals use two calls or two puts with different strikes and the same expiration.
The long and short strike order determines the bull or bear position.

The inputs have these meanings:

| Input | Meaning |
| --- | --- |
| `spot` | Stock acquisition cost per share for a covered call |
| `longStrike`, `longPremium` | Long option's strike and premium paid per share |
| `shortStrike`, `shortPremium` | Short option's strike and premium received per share |
| `contracts` | Positive whole number of contracts |
| `multiplier` | Positive whole number of shares per contract |
| `expiration` | One valid `YYYY-MM-DD` date, required for all strategies |
| `stockAtExpiry` | Nonnegative scenario stock price, used only for `payoff` |

Covered calls and cash-secured puts ignore the long-leg inputs.
Those inputs can be `0` or `"N/A"` for these two strategies.
Other strategies require numeric strikes and premiums.
Zero premiums are valid.
Numeric text does not substitute for numeric inputs.
Only a covered call requires `spot` as a cost basis.
`expiration` requires date text. For a date-valued cell, use `TEXT(cell,"yyyy-mm-dd")` as that argument.

Examples use explicit assumptions and one contract of 100 shares:

```excel
=TICKERSHEETS_STRATEGY("Covered call",100,0,0,110,3,1,100,"2027-01-15","maxProfit")
=TICKERSHEETS_STRATEGY("Cash-secured put",100,0,0,100,3,1,100,"2027-01-15","collateral")
=TICKERSHEETS_STRATEGY("Call vertical",100,100,8,110,3,1,100,"2027-01-15","maxLoss")
=TICKERSHEETS_STRATEGY("Call vertical",100,100,8,110,3,1,100,"2027-01-15","payoff",107)
```

These results are `1300`, `10000`, `500` and `200`, respectively.
The date describes the model's shared expiration.
These model examples do not depend on a currently published chain.

Supported metrics:

| Metric | Meaning |
| --- | --- |
| `initialCashflow` | Net option premium, less the stock purchase cost for a covered call |
| `netPremium` | Premium received minus premium paid, for the whole position |
| `stockCost` | Covered-call stock acquisition cost, zero for other strategies |
| `collateral` | Cash-secured put strike times contracts times multiplier, zero for other strategies |
| `maxProfit` | Highest signed position profit or loss at expiration |
| `maxLoss` | Largest loss amount at expiration, expressed as a nonnegative amount |
| `breakeven` | Stock price per share that gives zero expiration profit or loss |
| `premiumType` | `Net credit`, `Net debit` or `Zero net premium` |
| `structure` | Position description, including bull or bear vertical |
| `breakEvenNote` | Explanation of an absent breakeven or a zero-payoff boundary |
| `expiration` | Validated expiration date |
| `payoff` | Whole-position profit or loss at `stockAtExpiry` |
| `strategy` | Validated strategy name |
| `ok`, `error` | `TRUE` and empty text for valid model inputs |

Cash outputs cover the whole position.
Positive cash flow means money received.
Negative cash flow means money paid.
Put collateral is separate from the premium receipt.
The model does not estimate a broker's vertical margin requirement.

`maxProfit` can be negative when unusual manual premiums make every scenario lose money.
An unattainable breakeven returns `N/A`.
The calculations exclude fees, taxes, dividends, financing, early exercise and assignment timing.
Use cell references for editable strategy assumptions in your own worksheet.

## Advanced: explicit refresh argument

The request functions accept an optional `refresh` argument.
Normal sample formulas omit this argument.
An explicit value accepts a whole number from `0` through `2147483647`, or an empty value.
A changed explicit value selects a different cache entry.
The provider can still return an older quote.
This argument does not schedule repeated requests.
Volatile functions such as `NOW()`, `RAND()` and `RANDBETWEEN()` are not supported refresh arguments.

## Keys and sharing

FRED and the four keyed quote providers require your own keys.
The attached script stores keys in these Script Properties:

| Provider | Script Property |
|---|---|
| Finnhub | `FINNHUB_API_KEY` |
| Alpha Vantage | `ALPHA_VANTAGE_API_KEY` |
| Twelve Data | `TWELVE_DATA_API_KEY` |
| CoinMarketCap | `COINMARKET_API_KEY` |
| FRED | `FRED_API_KEY` |

Keys are not formula arguments or worksheet data.
Spreadsheet editors can access the attached script and its properties.
The [user guide](GUIDE.md#save-api-keys) covers key entry, saved-key indicators and sharing.
