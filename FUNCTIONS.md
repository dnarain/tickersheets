# Spreadsheet functions

This branch adds research functions to CacheFinance. All requests run in Google Apps Script. No hosted server is required.

See [INSTALL.md](INSTALL.md) for installation and API key settings. See [ANALYSIS.md](ANALYSIS.md) for the analysis tabs and charts.

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
The selected Finviz, Zacks and GuruFocus routes support US symbols only.

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
The refresh number is a worksheet dependency, not a schedule.

Research functions return these values for unavailable data:

| Result | Meaning |
| --- | --- |
| `N/A` | The response lacks this value |
| `N/A: ...` | The request, input or dataset is unavailable |
| `n.a.` from `CFOPTIONMODEL` | The requested model result is unavailable |

These results are text. They are different from the native spreadsheet error `#N/A`.
`IFNA()` does not replace these text values.
Published numeric zeros remain zero.

Functions that return tables include a header row. Google Sheets expands each table into adjacent empty cells.
An occupied output cell causes a spreadsheet error.

## Function list

| Function | Result | Source |
| --- | --- | --- |
| `CFQUOTE` | Quote value or quote table | Yahoo Chart |
| `CFHISTORY` | Daily OHLCV table | Yahoo Chart |
| `CFFUNDAMENTALS` | Fundamental value or field table | Yahoo quote page |
| `CFOPTIONS` | One expiration's option chain | Yahoo options |
| `CFEXPIRATIONS` | Published option expiration dates | Yahoo options |
| `CFFRED` | Economic series observations | FRED API, with your key |
| `CFFIELD` | Selected provider field or field table | Finviz, Zacks or GuruFocus |
| `CFDATASTATUS` | Request status and timestamps | The selected request |
| `CFOPTIONMODEL` | Theoretical option price or Greek | European Black–Scholes calculation |
| `CFSTRATEGY` | Strategy result or expiration payoff | Calculation from your assumptions |
| `CACHEFINANCE` | Original single-symbol lookup | Existing CacheFinance providers and cache |
| `CACHEFINANCES` | Original range lookup | Existing CacheFinance providers and cache |

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
| `price` | Latest price in the response |
| `name` | Company or fund name |
| `currency` | Quote currency |
| `exchange` | Exchange name or code from Yahoo |
| `quote_time` | Source timestamp for the quote |
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
| `Date` | Session date as `YYYY-MM-DD` text |
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
An empty expiration requests the provider's default expiration.

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
A displayed mid is not an execution guarantee.
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

Provider names are `FINVIZ`, `ZACKS` and `GURUFOCUS`.
`GURUDIV` is an alias for `GURUFOCUS`.
`field` accepts a field name or a mapped SMF field number.
`all` returns the five-column field table, including unavailable values.

The registry in [src/CacheFinanceSmfProviders.js](src/CacheFinanceSmfProviders.js) defines these 35 selected fields.
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
```

| Dataset | Meaning of `ticker` | Meaning of `argument` |
| --- | --- | --- |
| `quote`, `history` | Stock ticker | Unused |
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
The source can publish delayed or unchanged data.
The request can succeed while individual fields remain unavailable.

Successful public responses use these cache periods:

| Request | Cache period |
| --- | --- |
| Quote and daily history | 60 seconds |
| Fundamentals | 15 minutes |
| Option chain | 60 seconds |
| FRED | 1 hour |
| Finviz, Zacks and GuruFocus fields | 5 minutes |

Failed requests do not enter this cache.
Google can remove a cache entry before its expiry.
The cache contains public results, without API keys or anonymous session credentials.

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
`CACHEFINANCES` handles a range of symbols and matching default values.
The functions use supplied Google results, stored values and configured provider lookups.
They can return an old stored value after a source stops working.

The original missing-value behavior differs from the new research functions.
Original lookups can return zero or an empty value when no usable result exists.
A cached price can remain unchanged for a long time.
An exchange change can leave the stored quote stale.

`yieldpct` uses a fraction, such as `0.025` for `2.5%`.
The historical `CACHEFINANCE` overload stores supplied `GOOGLEFINANCE` history.
`CFHISTORY` retrieves Yahoo history directly.

The [original README](README.md) explains the existing cache commands and historical overload.

## Keys and sharing

The settings menu stores API keys in Script Properties, outside worksheet cells.
Blank sidebar fields preserve saved keys.
An explicit **Remove saved key** selection deletes that key after **Save keys**.
The sidebar shows saved-status flags without returning saved key values.

Script Properties are accessible to editors of the bound Apps Script project.
A private spreadsheet copy separates your settings from other users' copies.
A public template must come from a separate, clean project with no saved credentials.
The [installation guide](INSTALL.md) describes this setup.
