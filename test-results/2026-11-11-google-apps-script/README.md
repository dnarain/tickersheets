# Google Apps Script provider results: November 11, 2026

This file records the initial public-provider run before API keys were supplied.
See [the keyed-provider follow-up](KEYED-PROVIDERS.md) for the latest results across all eight providers.

We ran the diagnostic bundle from a private Google spreadsheet with its bound Apps Script project.
The direct tests bypassed financial caches and fallback providers.
The normal CacheFinance source and bundle remained unchanged.
No hosted server or SMF function was added.

## Source and evidence

- Upstream commit: `8f84e202e0c5d56f27b2bf000bb86817c3503894`
- Diagnostic commit: `ba7fcef2bdc174ac0a64bf3752d2508d45124260`
- Diagnostic source hash: `460ef8263d93`
- Diagnostic bundle SHA-256: `62a063f54d96140085f052fddee2404d7fa6ad8d19f0bebbb06a6f09ee6d0f90`
- Run ID: `2026-11-11T19:20:54.398Z-3905e00e`
- Direct responses: November 11, 2026, 11:20:56–11:24:55 a.m. Pacific.
- [Provider CSV](provider-results.csv): downloaded through Google Sheets **File → Download**.
- [Provider JSON](provider-results.json): CSV values with source details, status totals and limitations.
- [Worksheet results](worksheet-results.json): collected by `CollectProviderWorksheetTests` at 11:39:36 a.m. Pacific.

The Apps Script report export also completed in the spreadsheet at 11:40:48 a.m. Pacific.
The spreadsheet and project remain private.
These evidence files contain public test symbols and sanitized results.

## Provider results

| Provider | Direct result | Limits |
|---|---|---|
| Yahoo Chart API | Price and name extracted for `NASDAQ:AAPL`, `NASDAQ:NVDA`, `TSE:RY` and `TSE:XIC`: 8 fields. | Returned symbols matched. Quote timestamps preceded retrieval by approximately 3–73 seconds. The adapter does not implement yield. |
| Globe & Mail | Price, name and yield extracted for the four stocks/ETFs and `CF:DYN2752`: 15 fields. | Quote timestamps are unknown. The four stock/ETF names matched. Mutual-fund identity and yield accuracy require separate checks. |
| Yahoo Finance website | Price and name extracted for all four stocks/ETFs: 8 fields. | Yield extraction failed for all four. Quote timestamps are unknown. |
| Google Finance website | Four stock/ETF names extracted. | All five price cases and both Canadian yield cases failed extraction. An invalid ticker incorrectly produced a name containing HTML. |
| Finnhub | Not tested: API key required. | Two supported field cases skipped. |
| Twelve Data | Not tested: API key required. | Six supported field cases skipped. |
| Alpha Vantage | Not tested: API key required. | Three supported field cases skipped. |
| CoinMarketCap | Not tested: API key required. | Four supported field cases skipped. |

`PARSED` means that the adapter extracted a valid field from its direct response.
It does not establish independent financial accuracy or complete provider coverage.
Prices from different requests can represent different market times.

## Problems found

Google's website adapter failed to extract each requested price despite HTTP 200 responses.
Its invalid-ticker name parser captured an HTML fragment after the page title.
Do not treat this name fallback as reliable until that parser is repaired.

Yahoo's website adapter failed to extract all four requested dividend yields.
Its price and name extraction worked for those selected requests.

Globe's parser selects the first yield marker in the page without tying that marker to the requested ticker.
Its NVDA result was `0.003`, or 0.3% under the adapter's fraction convention.
The report retains that extraction as evidence; it does not establish that the value belongs to NVDA.

The diagnostic runner detected these problems without changing the provider adapters.
It rejected prices of zero and empty, invalid or mismatched names.

## Direct test totals

The run made 22 HTTP requests and recorded 117 field cases.
Several fields shared one request.

| Status | Field cases |
|---|---:|
| `PARSED` | 35 |
| `MISSING_VALUE` | 11 |
| `NEGATIVE_REJECTED` | 9 |
| `NEGATIVE_FALSE_POSITIVE` | 1 |
| `KEY_REQUIRED` | 15 |
| `UNSUPPORTED_ATTRIBUTE` | 36 |
| `UNSUPPORTED_SYMBOL` | 10 |
| Pending, running or interrupted | 0 |

Negative cases used the deliberately invalid symbol `NASDAQ:ZZZZCFINVALID20261111`.
Yahoo Chart, Yahoo's website and Globe returned HTTP 404 for that symbol.
Google's adapter supplied no valid price and falsely extracted a name.

## Worksheet results

Six worksheet checks passed and one failed.

| Check | Result |
|---|---|
| `GOOGLEFINANCE`: AAPL price | PASS |
| `GOOGLEFINANCE`: NVDA price | PASS |
| `GOOGLEFINANCE`: RY price | PASS |
| `GOOGLEFINANCE`: USD/CAD price | FAILED: `#N/A` |
| `CACHEFINANCE`: supplied control | PASS |
| `CACHEFINANCES`: supplied control and second spill row | Both PASS |

The CacheFinance controls used synthetic symbols `CFTEST:CONTROL_A` and `CFTEST:CONTROL_B`.
Those controls establish formula execution and array output.
They do not establish provider access, financial accuracy or fallback behavior.

The failed USD/CAD worksheet result does not establish permanent unavailability.
This run recorded its actual `#N/A` result without substituting another source.

## Local checks

The local suite passed 174 tests across eight test files.
The existing coverage thresholds passed.
The normal bundle and diagnostic bundle passed their build checks.
These local tests use mocks and controlled responses.
The provider results in this report came from the separate Google Apps Script run.

## Reproduce

Follow [PROVIDER-TESTING.md](../../PROVIDER-TESTING.md).
Run `ContinueProviderTests` until no pending cases remain.
Supply provider keys in your own script properties to test the four skipped providers.
Record a new run separately because provider responses and access can change.
