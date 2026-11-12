# RSI2, exact-date FRED, ADVFN and session quotes

We ran these checks in Google Sheets on November 11, 2026, Pacific time.
The final installed Apps Script source hash was `a3b6d07b2943`.
The normal bundle SHA-256 was `d66ce4da17cb5d053b278f5223c1a72fd3ab155ff8d15df9f7fe131297aa2104`.

The [native evidence](lookup-quotes-native-results.json) contains the worksheet results and selected Apps Script summaries.
It also retains earlier failures and their source hashes.
The final results apply to the final source hash.
No API key values, anonymous cookies or crumbs appear in the evidence.

## Results

| Check | Result | Limits |
|---|---|---|
| Local automated suite | 1,306 passed across 34 files | Controlled responses and public fixtures, not live provider acceptance |
| Native lookup worksheet | 18 PASS, 0 FAIL, 3 BLOCKED, 0 PENDING | All three blocked cases are ADVFN HTTP 403 |
| Native NVDA session formulas | Five comparison assertions returned TRUE | Last published after-hours quote, not a streaming or overnight feed |
| Private AVGO analysis | Updated with an after-hours headline price and matching timestamp | Original user ticker preserved |
| Public NVDA template | Updated with session quotes and the new formula examples | No saved keys, so FRED remains unavailable until a user supplies a key |
| Five-symbol watchlists | Both private and public copies refreshed five symbols | A full 20-symbol run was not performed |

The local suite reported 96.06% line, 89.12% branch and 96.74% function coverage.
Both generated bundles passed their source-consistency checks.
An earlier Apps Script parser error exposed unsupported logical assignment syntax.
We replaced that syntax and added build checks for `||=`, `&&=` and `??=`.

## RSI2 target prices

`CFRSITARGETS` returns twelve fields as a two-row table, a header row, or a named scalar.
It uses Wilder RSI2 and 21 completed prior closes, with the regular-session quote.
It excludes the quoted session's daily bar from those prior closes.
The buy target requires a low trigger at or below previous RSI2.
The sell target requires a high trigger at or above previous RSI2.
Targets that fail those conditions remain unavailable.

| Native input | Current RSI2 | Buy target | Sell target | Regular-session price |
|---|---:|---:|---:|---:|
| NVDA, triggers 20/80 | 40.02714901 | N/A | 201.41595097 | 173.73 |
| AAPL, triggers 20/80 | 84.29115976 | 339.76053718 | 353.14509465 | 355.63 |

The worksheet checked the six scalar results, both full arrays and the twelve-label header array.
Bid and ask remained unavailable for both tickers.
That result does not block the RSI2 calculation.
The local RSI module has 58 tests, including repaired Mac reference fixtures.
The function does not implement the original SMF name or its two-digit item selector.

## Exact-date FRED

`CFFREDVALUE` uses the official API and the private project's saved FRED key.
It returns the observation for the exact requested date.
It does not substitute an earlier observation.

| Native formula case | Result |
|---|---|
| DGS10, `"2026-11-05"` | `4.84` |
| DGS10, `DATE(2026,11,5)` | `4.84` |
| Matching November 5 row in `CFFRED("DGS10",30,...)` | `4.84` |
| DGS10, Saturday November 7 | `N/A: FRED has no observation on 2026-11-07.` |
| Monthly UNRATE, October 2 | `N/A: FRED has no observation on 2026-10-02.` |
| Invalid date February 30 | Input error text |

FRED returned a surprising monthly response for October 2: `count: 0` with an October 1 observation row.
The first native run exposed this response as an unexpected parser error.
The final parser recognizes that narrow response and returns no observation for October 2.
It never returns October 1's value for October 2.
Other count, date and response mismatches remain rejected.
The FRED exact-date module has 108 local tests.

FRED retains its published units.
For DGS10, `4.84` means 4.84 percent, not a fraction that needs percentage formatting.
Full SMF metadata-label selectors remain outside this implementation.
The diagnostic's fixed November 5 comparison will age out of the latest 30 observations.
That future reference-window failure alone will not establish an exact-date defect.

## ADVFN remains blocked

`CFFIELD("ADVFN","NASDAQ:AAPL",5196,...)` implements the latest annual year-end lookup.
The named field is `year_end_date`.
The parser checks the financial-page identity and bounded annual-statement headers.
Its 52 controlled tests passed.

All three native worksheet cases returned `N/A: HTTP 403`:

- AAPL numeric field 5196.
- NVDA numeric field 5196.
- AAPL named field `year_end_date`.

The public `www` and `ca` financial-page probes also returned HTTP 403.
The current AAPL financials route returned HTTP 403.
We did not bypass the access challenge or add account credentials.
These results establish blocked access from Apps Script, not a subscription requirement or retirement.
A live year-end value remains unverified.

## After-hours quotes

The actual NVDA worksheet cells returned these values:

| Field | Value |
|---|---|
| `price` | `158.78` |
| `regular_price` | `173.73` |
| `post_market_price` | `158.78` |
| `regular_time` | `2026-11-11T21:00:00.000Z` |
| `post_market_time` / `quote_time` | `2026-11-12T01:00:00.000Z` |
| `price_session` | `After-hours` |
| `market_state` | `OVERNIGHT` |
| `post_market_change_fraction` | `-0.08605306` |

The five assertions checked the selected price, session, timestamp, timestamp ordering and after-hours return arithmetic.
They all returned TRUE.
The overnight market state selected the last accepted after-hours quote.
The implementation does not claim that this price describes an overnight trade.
Regular change was unavailable; its fractional change was present.

The private analysis preserved AVGO and displayed `353.36`, session `After-hours`, at `2026-11-12T00:59:55.000Z`.
Its separate regular-session price was `345.22`.
The public sample displayed NVDA's after-hours price.
Daily history and indicator inputs still use their documented regular-session prices.

Both five-symbol watchlists refreshed successfully.
The private worksheet showed NVDA `158.78`, AAPL `356.35`, MSFT `520.15`, GOOGL `294.35` and AMZN `267.33`.
Column X labeled all five as `After-hours`.
Quote timestamps remained separate from retrieval timestamps.

## Other unavailable results and test limits

The private AVGO chain contained 164 contracts, and the public NVDA chain contained 177 contracts.
Both refreshes lacked usable same-strike ATM call/put inputs for all five maturity comparisons.
Their ATM IV summaries remained unavailable.
The option calculators had no usable seed premium, so their model outputs showed `n.a.`.
The inspectors also reported 21 intentional `#N/A` gaps in each option payoff table at `P24:P44`.
Those formulas call `NA()` when the required strike or premium is unavailable.
We did not change that existing behavior or describe the entire workbook as error-free.

The new `CF Formulas` examples had no native formula errors.
The private examples returned RSI2, the exact FRED value, expected missing-date text and after-hours fields.
The clean sample correctly reported missing FRED keys and blocked ADVFN access.
Its key-presence check reported all five providers unconfigured.

These checks cover selected tickers, dates, fields and this Google account setup.
We did not test a new account's copy/authorization flow, every exchange, every option contract, or every SMF formula.
Worksheet/direct-function agreement does not independently reconcile every financial value against filings or exchange data.

## User guides

- [INSTALL.md](../../INSTALL.md): installation, authorization and API keys.
- [FUNCTIONS.md](../../FUNCTIONS.md): all 14 worksheet functions, outputs, units and limits.
- [BUILD-YOUR-OWN.md](../../BUILD-YOUR-OWN.md): custom tabs with one ticker input.
- [ANALYSIS.md](../../ANALYSIS.md): the public sample and generated workbook.
- [SMF-COVERAGE.md](../../SMF-COVERAGE.md): implemented portions and remaining SMF gaps.
