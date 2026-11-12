# Spreadsheet functions

This reference covers 14 worksheet functions: twelve `CF...` functions, `CACHEFINANCE` and `CACHEFINANCES`.
All requests run in Google Apps Script. No hosted server is required.

See [INSTALL.md](INSTALL.md) for installation and API key settings. See [ANALYSIS.md](ANALYSIS.md) for the analysis tabs and charts.
The [build-your-own guide](BUILD-YOUR-OWN.md) combines these functions into a spreadsheet with one ticker input.

## Start with the menu

**Stock analysis → Refresh selected ticker** fetches the selected stock and updates the analysis tabs together.
The menu also supports the watchlist, financial charts and several option expirations.

Cell functions are useful for smaller tables and individual values.
Google requires each custom function to return within **30 seconds**.
Google also rejects volatile arguments such as `NOW()` and `RAND()`.
These limits come from [Google's custom function guide](https://developers.google.com/apps-script/guides/sheets/functions#guidelines_for_custom_functions).

## Tickers, refresh numbers and missing values

The research functions accept Yahoo symbols and supported exchange prefixes:

| Input | Yahoo symbol |
| --- | --- |
| `NVDA` | `NVDA` |
| `NASDAQ:AAPL` | `AAPL` |
| `NYSE:IBM` | `IBM` |
| `TSE:RY` | `RY.TO` |
| `RY.TO` | `RY.TO` |
| `NYSE:BRK.B` | `BRK-B` |

Bare US tickers do not imply a particular exchange. The quote response identifies the exchange.
The selected Finviz, Zacks, GuruFocus and ADVFN routes support US symbols only.
ADVFN preserves a supported exchange prefix, such as `NASDAQ:AAPL`, in its request.

Most request functions have an optional `refresh` argument.
This argument accepts a whole number from `0` through `2147483647`, or an empty value.
A changed number requests a different cache entry.
The provider can still return an older quote.

For the examples in this file:

1. Enter `NVDA` in cell `B1` on an empty worksheet.
2. Enter `1` in cell `B2`.
3. Put each example in a separate empty area.
4. To request new results, increase the number in `B2`.

Do not use `NOW()`, `RAND()` or `RANDBETWEEN()` as the refresh argument.
Do not put an API key in a formula, ticker cell or refresh cell.
Google Sheets recalculates a formula when its refresh-number dependency changes.
The refresh number does not schedule repeated requests.
The original `CACHEFINANCE` and `CACHEFINANCES` signatures use different arguments, described in their section.

Research functions return these values for unavailable data:

| Result | Meaning |
| --- | --- |
| `N/A` | The response lacks this value |
| `N/A: ...` | The request, input or dataset is unavailable |
| `n.a.` from `CFOPTIONMODEL` | The requested model result is unavailable |

These results are text. They are different from the native spreadsheet error `#N/A`.
`IFNA()` does not replace these text values.
Published numeric zeros remain zero.

The `CF...` functions that return tables include a header row. Google Sheets expands each table into adjacent empty cells.
An occupied output cell causes a spreadsheet error.

## Function list

| Function | Result | Source |
| --- | --- | --- |
| `CFQUOTE` | Quote value or quote table | Yahoo Chart and quote page |
| `CFHISTORY` | Daily OHLCV table | Yahoo Chart |
| `CFFUNDAMENTALS` | Fundamental value or field table | Yahoo quote page |
| `CFOPTIONS` | One expiration's option chain | Yahoo options |
| `CFEXPIRATIONS` | Published option expiration dates | Yahoo options |
| `CFFRED` | Economic series observations | FRED API, with your key |
| `CFFREDVALUE` | One exact-date economic observation | FRED API, with your key |
| `CFRSITARGETS` | RSI2, trigger targets and regular-session quote fields | Yahoo Chart / optional Yahoo bid/ask |
| `CFFIELD` | Selected provider field or field table | Finviz, Zacks, GuruFocus or ADVFN |
| `CFDATASTATUS` | Request status and timestamps | The selected request |
| `CFOPTIONMODEL` | Theoretical option price or Greek | European Black–Scholes calculation |
| `CFSTRATEGY` | Strategy result or expiration payoff | Calculation from your assumptions |
| `CACHEFINANCE` | Original single-symbol lookup | Existing CacheFinance providers and cache |
| `CACHEFINANCES` | Original range lookup | Existing CacheFinance providers and cache |

### Output size

These sizes apply to successful requests. An unavailable dataset can return one explanatory text value instead of a table.

| Function or output | Rows × columns |
|---|---|
| Scalar field from `CFQUOTE`, `CFFUNDAMENTALS`, `CFFIELD` or `CFRSITARGETS` | `1 × 1` |
| `CFQUOTE(...,"all",...)` | `30 × 2`, including the header |
| `CFHISTORY` | At most `(sessions + 1) × 7`, including the header |
| `CFFUNDAMENTALS(...,"all",...)` | `(returned fields + 1) × 5` |
| `CFEXPIRATIONS` | `(expiration count + 1) × 1` |
| `CFOPTIONS` | `(contract count + 1) × 12` |
| `CFFRED` | At most `(observations + 1) × 5`, including the header |
| `CFFREDVALUE`, `CFOPTIONMODEL`, `CFSTRATEGY` | `1 × 1` |
| `CFRSITARGETS(...,"all",...)` | `2 × 12`: headers, then values |
| `CFRSITARGETS(...,"headers",...)` | `1 × 12`, without a provider request |
| `CFFIELD("FINVIZ",...,"all",...)` | `33 × 5` |
| `CFFIELD("ZACKS",...,"all",...)` | `2 × 5` |
| `CFFIELD("GURUFOCUS",...,"all",...)` | `3 × 5` |
| `CFFIELD("ADVFN",...,"all",...)` | `2 × 5` when the provider accepts the request |
| `CFDATASTATUS` | `2 × 5`: headers, then status |
| `CACHEFINANCE` quote mode | `1 × 1` |
| `CACHEFINANCES` with a ticker column | One output column, with no header |

Leave the entire output area empty before entering a table formula.

## CFQUOTE

```text
CFQUOTE(ticker, field="price", refresh="")
```

Examples:

```excel
=CFQUOTE($B$1,"price",$B$2)
=CFQUOTE("TSE:RY","currency",$B$2)
=CFQUOTE($B$1,"quote_time",$B$2)
=CFQUOTE($B$1,"all",$B$2)
```

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
`CFFUNDAMENTALS` can supply market capitalization when quote metadata lacks it.
Change values use currency per share. Fields ending in `_change_fraction` use fractions, such as `0.025` for `2.5%`.
Quote timestamps use ISO text in UTC when the source supplies a valid time.

An extended-hours quote requires a valid price and timestamp for the matching ticker.
The session selector promotes it only when it is newer than the accepted regular quote.
`OVERNIGHT` can select the last published after-hours quote. The result remains labeled `After-hours`, with its own timestamp.
An explicit pre-market or after-hours field can describe an earlier session. Always inspect its timestamp.
The displayed quote does not change daily history, RSI inputs or closed option-market quotes.

```excel
=CFQUOTE($B$1,"price_session",$B$2)
=CFQUOTE($B$1,"regular_price",$B$2)
=CFQUOTE($B$1,"post_market_price",$B$2)
=CFQUOTE($B$1,"post_market_time",$B$2)
```

The current-session lookup can request both Yahoo Chart and the matching Yahoo quote page.
It uses separate 60-second caches for chart data and session quotes.
An unavailable quote page leaves accepted Chart data available.
The function does not take session quotes from the fifteen-minute fundamentals cache.
The explicit `regular_...` fields use Chart metadata. The `all` table can merge a newer matching regular quote from the quote page.

The quote cache lasts up to 60 seconds.
Google Sheets does not automatically recalculate a formula when its cache entry expires.
Change the refresh number or use the refresh menu to request new results.

## CFHISTORY

```text
CFHISTORY(ticker, sessions=252, refresh="")
```

Examples:

```excel
=CFHISTORY($B$1,252,$B$2)
=CFHISTORY("TSE:RY",510,$B$2)
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

The analysis menu calculates returns from adjusted close.
It calculates SMA, EMA, MACD and RSI from Yahoo close.
The overview labels the last published session as **Indicators through**.

## CFFUNDAMENTALS

```text
CFFUNDAMENTALS(ticker, field="all", refresh="")
```

Examples:

```excel
=CFFUNDAMENTALS($B$1,"market_cap",$B$2)
=CFFUNDAMENTALS($B$1,"trailing_pe",$B$2)
=CFFUNDAMENTALS($B$1,"dividend_yield",$B$2)
=CFFUNDAMENTALS($B$1,"all",$B$2)
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

The analysis tabs also show published earnings, financial statements and estimates.
`CFFUNDAMENTALS` returns the scalar fields listed here.

## CFEXPIRATIONS and CFOPTIONS

```text
CFEXPIRATIONS(ticker, refresh="")
CFOPTIONS(ticker, expiration="", refresh="")
```

`CFEXPIRATIONS` returns one column with the header `Expiration`.
Each date uses `YYYY-MM-DD` text.
`CFOPTIONS` returns the chain for one published expiration.
If `expiration` is empty, the function requests the provider's default expiration.

For a formula that uses an available date:

1. Enter this formula in cell `D1`:

   ```excel
   =CFEXPIRATIONS($B$1,$B$2)
   ```

2. Enter this formula in cell `F1`:

   ```excel
   =CFOPTIONS($B$1,D2,$B$2)
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
The menu workflow handles several expiration requests without separate cell functions for every chain.

## CFFRED

```text
CFFRED(seriesId, observations=60, refresh="")
```

Examples:

```excel
=CFFRED("DGS10",252,$B$2)
=CFFRED("UNRATE",120,$B$2)
=CFFRED("CPIAUCSL",60,$B$2)
```

`observations` accepts an integer from `1` through `1000`.
The function supports FRED series IDs beyond the four default macro charts.
It returns observations from oldest to newest.
`CFFRED` and `CFFREDVALUE` accept series IDs with 1–50 letters, digits or underscores.
The functions trim spaces and convert the ID to uppercase.

Output columns are `Date`, `Value`, `Unit`, `Series` and `Source`.
A missing observation, including FRED's `.` marker, returns `N/A`.
Observation dates describe economic periods or sessions.
They do not necessarily identify publication dates.

The function reads your `FRED_API_KEY` from Script Properties.
Use **CacheFinance → API keys…** or **CacheFinance → Enter FRED key…** to save it.
FRED requires each user to [request their own API key](https://fred.stlouisfed.org/docs/api/api_key.html).
The key is never a formula argument.

The returned unit controls interpretation:

| Example | Interpretation |
| --- | --- |
| `DGS10` value `4.25` | A `4.25%` yield, already in percent units |
| `UNRATE` value `4.2` | A `4.2%` unemployment rate |
| `CPIAUCSL` | A consumer price index level, not annual inflation |

Do not apply ordinary percentage formatting to a FRED percent level such as `4.25`.
Google Sheets shows `425%` with that formatting.

## CFFREDVALUE

```text
CFFREDVALUE(seriesId, date, refresh="")
```

Examples:

```excel
=CFFREDVALUE("DGS10","2026-11-05",$B$2)
=CFFREDVALUE("DGS10",DATE(2026,11,5),$B$2)
=CFFREDVALUE($E$1,$E$2,$B$2)
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

The function uses the same private `FRED_API_KEY` setting as `CFFRED`.
It caches accepted public values for up to one hour. The refresh number can request a new result.
Missing keys, provider failures and absent observations remain explanatory text results.
This function does not implement all metadata labels from SMF's `smfGetEconData`.

## CFRSITARGETS

```text
CFRSITARGETS(ticker, lowTrigger=20, highTrigger=80, field="all", refresh="")
```

Examples:

```excel
=CFRSITARGETS($B$1,20,80,"rsi2",$B$2)
=CFRSITARGETS($B$1,20,80,"buy_target",$B$2)
=CFRSITARGETS($B$1,20,80,"sell_target",$B$2)
=CFRSITARGETS($B$1,20,80,"all",$B$2)
=CFRSITARGETS($B$1,20,80,"previous_rsi2",$B$2)
=CFRSITARGETS($B$1,20,80,"headers",$B$2)
```

The calculation follows the repaired SMF Mac RSI2 calculation.
It seeds Wilder's two-period averages from 21 completed sessions before the quoted regular session.
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
Increase the refresh number to request another snapshot.

This interface uses named fields. It does not implement SMF's original two-digit item selectors or function name.

## CFFIELD

```text
CFFIELD(provider, ticker, field="all", refresh="")
```

Examples:

```excel
=CFFIELD("FINVIZ",$B$1,"rsi14",$B$2)
=CFFIELD("FINVIZ",$B$1,4054,$B$2)
=CFFIELD("ZACKS",$B$1,"target_price",$B$2)
=CFFIELD("GURUFOCUS",$B$1,"forward_dividend_yield",$B$2)
=CFFIELD("FINVIZ",$B$1,"all",$B$2)
```

Provider names are `FINVIZ`, `ZACKS`, `GURUFOCUS` and `ADVFN`.
Provider and field names are case-insensitive.
`GURUDIV` is an alias for `GURUFOCUS`.
`field` accepts a field name or a mapped SMF field number.
`all` returns the five-column field table, including unavailable values.

The registry in [src/CacheFinanceSmfProviders.js](src/CacheFinanceSmfProviders.js) defines 36 selected fields, including the ADVFN parser.
There are 35 numeric SMF aliases. GuruFocus trailing yield has no mapped numeric ID.
This registry does not cover every SMF field or function.
The [SMF coverage checklist](SMF-COVERAGE.md) lists the mapped IDs, partial replacements and remaining gaps.
These public routes do not use saved website credentials.
A blocked page, changed page or unavailable field remains unavailable.

### Finviz: 32 fields

| Field | SMF ID | Unit |
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

| Field | SMF ID | Unit |
| --- | --- | --- |
| `target_price` | 849 | Currency per share |

### GuruFocus: two fields

| Field | SMF ID | Unit |
| --- | --- | --- |
| `forward_dividend_yield` | 2727 | Fraction |
| `trailing_dividend_yield` | No mapped ID | Fraction |

### ADVFN: one field

| Field | SMF ID | Unit |
|---|---|---|
| `year_end_date` | 5196 | `YYYY-MM-DD` date text |

```excel
=CFFIELD("ADVFN","NASDAQ:AAPL",5196,$B$2)
=CFFIELD("ADVFN",$B$1,"year_end_date",$B$2)
```

The parser accepts only the latest annual year-end date from a matching financials page.
It validates the annual table, date and fiscal-year order.
It does not implement earlier periods, quarterly dates or other ADVFN statement fields.
The live Google Apps Script requests returned HTTP 403 from ADVFN during these checks.
The parser has controlled tests, but live data remains unavailable from this Google environment.
The function reports that provider failure and does not substitute a Yahoo date.
An HTTP 403 result does not establish that a subscription will resolve the block.

## CFDATASTATUS

```text
CFDATASTATUS(ticker, dataset="quote", argument="", refresh="")
```

Examples:

```excel
=CFDATASTATUS($B$1,"quote","",$B$2)
=CFDATASTATUS($B$1,"fundamentals","",$B$2)
=CFDATASTATUS($B$1,"options",D2,$B$2)
=CFDATASTATUS("DGS10","fred",252,$B$2)
=CFDATASTATUS($B$1,"provider","FINVIZ",$B$2)
=CFDATASTATUS("NASDAQ:AAPL","provider","ADVFN",$B$2)
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

Use the same arguments and refresh number as the data formula.
Different expiration dates or FRED observation counts identify different requests.
`Cached=TRUE` means Apps Script reused a public response.
It does not establish that the source quote is current.

`Retrieved at` records the request time.
`Quote time` records the source quote time when available.
Cached results retain their original retrieval time.
The source can publish delayed or unchanged data.
A provider can return some fields and leave others unavailable.
This function has no exact-date FRED or RSI2 dataset selector.
Its `fred` selector reports the recent-observation table from `CFFRED`, not a `CFFREDVALUE` request.

Successful public responses use these cache periods:

| Request | Cache period |
| --- | --- |
| Chart data and separate session quotes | 60 seconds each |
| RSI2 chart facts and optional bid/ask | 60 seconds each |
| Fundamentals | 15 minutes |
| Option chain | 60 seconds |
| FRED recent observations and exact-date values | 1 hour |
| Finviz, Zacks, GuruFocus and ADVFN fields | 5 minutes |

Failed requests do not enter this cache.
Google can remove a cache entry before its expiry.
The cache contains public results, without API keys or anonymous session credentials.
These periods apply to the research functions. The original CacheFinance functions use their older cache behavior.

## CFOPTIONMODEL

```text
CFOPTIONMODEL(spot, strike, days, iv, rate, dividendYield, type, metric="price")
```

Examples:

```excel
=CFOPTIONMODEL(100,100,30,0.25,0.04,0,"Call","price")
=CFOPTIONMODEL(100,100,30,0.25,0.04,0,"Put","delta")
=CFOPTIONMODEL(100,100,30,0.25,0.04,0,"Call","vega")
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

## CFSTRATEGY

```text
CFSTRATEGY(strategy, spot, longStrike, longPremium, shortStrike, shortPremium,
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
=CFSTRATEGY("Covered call",100,0,0,110,3,1,100,"2027-01-15","maxProfit")
=CFSTRATEGY("Cash-secured put",100,0,0,100,3,1,100,"2027-01-15","collateral")
=CFSTRATEGY("Call vertical",100,100,8,110,3,1,100,"2027-01-15","maxLoss")
=CFSTRATEGY("Call vertical",100,100,8,110,3,1,100,"2027-01-15","payoff",107)
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
The **CF Strategies** tab shows editable assumptions, source bid/ask values and a payoff chart.
A refresh resets those assumptions from the selected ticker and expiration.

## Original CACHEFINANCE and CACHEFINANCES

```text
CACHEFINANCE(symbol, attribute="price", googleFinanceValue="", cmdOption="",
             interval="", googleHistoryValues=[])
CACHEFINANCES(symbols, attribute="price", defaultValues=[], webSiteLookupCacheSeconds=-1)
```

Examples:

```excel
=CACHEFINANCE("NASDAQ:NVDA","price",IFERROR(GOOGLEFINANCE("NASDAQ:NVDA","price"),""))
=CACHEFINANCES(A2:A5,"price",B2:B5)
```

These original functions support `price`, `name` and `yieldpct`.
`CACHEFINANCE` handles one symbol.
`CACHEFINANCES` handles a vertical ticker range and matching default values.
It reads the first column and returns a vertical result without a header.
The functions use supplied Google results, stored values and configured provider lookups.
They can return an old stored value after a source stops working.
Their default-value arguments contain source values, not the refresh number used by the research functions.

The original missing-value behavior differs from the new research functions.
Original lookups can return zero or an empty value when no usable result exists.
A cached price can remain unchanged for a long time.
An exchange change can leave the stored quote stale.

`yieldpct` uses a fraction, such as `0.025` for `2.5%`.
The historical `CACHEFINANCE` overload stores supplied `GOOGLEFINANCE` history.
`CFHISTORY` retrieves Yahoo history directly.
The historical overload can return the supplied history table with its header.

The [original README](README.md) explains the existing cache commands and historical overload.

## Keys and sharing

The settings menu stores API keys in Script Properties, outside worksheet cells.
Blank sidebar fields preserve saved keys.
The sidebar deletes a key after you select **Remove saved key** and click **Save keys**.
The sidebar shows saved-status flags without returning saved key values.

Script Properties are accessible to editors of the bound Apps Script project.
A private spreadsheet copy separates your settings from other users' copies.
A public template must come from a separate, clean project with no saved credentials.
The [installation guide](INSTALL.md) describes this setup.
The [build-your-own guide](BUILD-YOUR-OWN.md) shows how to place scalar results and table formulas around one ticker input.
