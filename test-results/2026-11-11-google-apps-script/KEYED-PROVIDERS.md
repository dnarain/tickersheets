# Provider results after adding private API keys

All eight registered providers received live requests from Google Apps Script on November 11, 2026.
The tests used the bound Google spreadsheet and bypassed financial caches and fallback providers.
The provider adapters and normal CacheFinance bundle remain unchanged.

## Latest results

| Provider | Selected data extracted | Remaining limits |
|---|---|---|
| Yahoo Chart API | Prices and names for AAPL, NVDA, RY and XIC. | Returned symbols matched. Yield is outside this adapter's implemented fields. |
| Finnhub | AAPL and NVDA prices. | These responses supplied quote timestamps. The adapter implements price only. |
| Twelve Data | Prices and names for AAPL, NVDA and USD/CAD. | Its `timestamp` identifies interval opening, not the last price update. |
| CoinMarketCap | Prices and names for BTC/USD and ETH/USD. | Both responses supplied `quote.last_updated`. |
| Alpha Vantage | AAPL, NVDA and USD/CAD prices on the recheck. | Initial NVDA extraction failed. Stock quotes reported November 10. |
| Globe & Mail | Prices, names and yields for four stocks/ETFs and one mutual fund. | Quote times are unknown. Yield accuracy and mutual-fund identity remain unverified. |
| Yahoo Finance website | Prices and names for four stocks/ETFs. | All four yield extractions failed. Quote times are unknown. |
| Google Finance website | Names for four stocks/ETFs. | All five price cases and two yield cases failed. An invalid ticker falsely produced a name. |

`PARSED` establishes that the adapter extracted a field from its direct response.
It does not establish independent financial accuracy or complete coverage of that provider.
These tests do not establish access to options, earnings or other SMF data.

## Keyed-provider follow-up

The first keyed run made ten requests between 12:14:11 and 12:17:03 p.m. Pacific.
It extracted 14 of 15 supported fields.
Alpha Vantage returned HTTP 200 for NVDA without an accepted price.

We preserved that [initial keyed export](keyed-initial-results.json).
We did not save keys, full request URLs, raw responses or raw error messages in the report.

## Timestamp correction and Alpha Vantage recheck

Google Sheets converted Alpha Vantage's date-only and provider-local strings to Date values.
The initial export therefore contains timestamps that must not be interpreted as provider UTC times.

The diagnostic writer now formats timestamp columns as plain text before writing values.
It marks ambiguous old date conversions as unknown and requests a rerun.
It also spaces Alpha Vantage requests by at least 1.25 seconds after each previous response.
Missing JSON results can show a fixed error-message category without revealing provider text.

The [Alpha recheck](alpha-recheck.json) made three requests between 12:26:22 and 12:26:26 p.m. Pacific.
All three prices were extracted, including NVDA.
The AAPL and NVDA source dates remained the plain text `2026-11-10` in the final native export.
The FX source time remained provider-local text without an inferred UTC offset.

This rerun does not establish the cause of the initial NVDA failure.
Alpha Vantage documents end-of-day updates as the default for its quote endpoint.
See the [Alpha Vantage documentation](https://www.alphavantage.co/documentation/).

Twelve Data documents its quote `timestamp` as the opening of the requested interval.
Do not infer quote staleness from that field alone.
See the [Twelve Data timestamp clarification](https://twelvedata.com/news/feb-2025-updates).

## Evidence and versions

| Evidence | Contents |
|---|---|
| [Initial public report](README.md) | Original CSV, provider results and worksheet checks before keys were supplied. |
| [Initial keyed export](keyed-initial-results.json) | Four keyed providers, including the initial NVDA failure and timestamp warning. |
| [Alpha recheck](alpha-recheck.json) | Three new Alpha responses after the diagnostic correction. |
| [Latest keyed results](keyed-provider-results.json) | Fifteen supported keyed cases, with the three Alpha rows replaced by the recheck. |
| [Combined results](combined-provider-results.json) | Latest result for each of the 117 field cases. |

The original downloads used diagnostic commit `ba7fcef2bdc174ac0a64bf3752d2508d45124260`, source hash `460ef8263d93`.
The Alpha recheck used commit `1ecc84b64ef7552a5518a56fcc7fa9940b2108fa`, source hash `4c2a5ca3983d`.
The final sanitized report export completed at 12:27:30 p.m. Pacific.
The JSON files record bundle hashes, retrieval times and the source versions.

## Combined totals

The tests made 35 HTTP requests: 22 public requests, ten initial keyed requests and three Alpha recheck requests.
The latest combined report contains 117 field cases:

| Status | Cases |
|---|---:|
| `PARSED` | 50 |
| `MISSING_VALUE` | 11 |
| `NEGATIVE_REJECTED` | 9 |
| `NEGATIVE_FALSE_POSITIVE` | 1 |
| `UNSUPPORTED_ATTRIBUTE` | 36 |
| `UNSUPPORTED_SYMBOL` | 10 |
| Missing key, pending, running or interrupted | 0 |

The separate worksheet run remains six PASS and one FAILED.
The USD/CAD `GOOGLEFINANCE` formula returned `#N/A`.
Twelve Data and Alpha Vantage extracted that currency pair through their own APIs.
See the [worksheet evidence](worksheet-results.json).

The updated local suite passed 184 tests and the existing coverage thresholds.
The normal bundle and diagnostic bundle passed their build checks.
The timestamp correction also passed the native Alpha recheck.

API keys remain in the user's private Apps Script project.
This fork adds no hosted server or SMF functions.
