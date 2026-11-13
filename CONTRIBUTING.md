# Contribute to TickerSheets

The [user guide](GUIDE.md) covers installation and spreadsheet use.
The [function reference](FUNCTIONS.md) lists supported data, sources, fields and units.
This document covers code changes and testing.

## Build and test locally

Use Node.js 22 or later and npm. From a fresh checkout:

```sh
npm ci --ignore-scripts
npm run build:check
npm run test:coverage
```

`package.json` defines the build and test commands.
`package-lock.json` pins their dependencies.
`vitest.config.js` configures the tests and enables the source exports used by Node.js.
Spreadsheet users do not need these tools to use the supplied script.

After source changes, regenerate the Apps Script bundle and run the checks:

```sh
npm run build
npm run build:check
npm run test:coverage
```

Edit the files in [src/](src/).
The build command generates [dist/TickerSheets.js](dist/TickerSheets.js).
Commit source changes, tests and the generated bundle together.
GitHub Actions checks the bundle and runs the unit tests with coverage.

## Tests and fixtures

Tests use controlled responses in [test/](test/).
Keep fixtures public and remove credentials, authenticated URLs, cookies and personal data before committing them.
Keep generated results in the ignored `test-results/` directory.
The local suite does not establish current access from Google's network.

For a provider change, cover:

- Accepted responses with matching symbols, exchanges, currencies and observation times.
- Missing fields, valid numeric zeros and unavailable symbols.
- Provider errors, blocked requests, exhausted quotas and malformed responses.
- Missing keys that return before any network request.
- Cache entries and errors that contain no keys or raw authenticated responses.

For options, cover expiration and contract identity, adjusted contracts, missing IV and partial or crossed bid/ask pairs.
For FRED, cover a published zero, missing observations, absent exact dates and invalid dates.
For calculations, compare fixed examples with independently calculated expected results.

## Check the example spreadsheet

Use a private copy of the example with your own keys.

1. Enter `NVDA` in **Start here!B4**.
2. Choose **TickerSheets → Refresh data** and wait for the formulas to finish.
3. Inspect the values and formulas on all three tabs.
4. Change the ticker to `AAPL` and confirm that both analysis tabs use it.
5. Change an option expiration and strategy assumption. Confirm that quotes, results and the payoff chart update.
6. Try an invalid ticker and an unavailable field. Missing values must not become numeric zeros.
7. Restore the original inputs.

Check table outputs for blocked cells and unexpected `#REF!`, `#VALUE!`, circular-reference or other formula errors.
Keep intended `N/A` text distinct from a spreadsheet error.
Read provider timestamps before comparing prices or earnings periods.
Agreement between worksheet formulas does not independently reconcile the data with exchange records or company filings.

The developer helper `TickerSheetsInspectDemo` reads formulas and results from the managed example tabs.
It reports ticker links, pending or incorrect formulas, chart counts, option counts, model results and calculator inputs.
Use `TickerSheetsBuildDemo` only to rebuild those example tabs.
It preserves their editable calculator inputs and rejects unrelated tabs with the same reserved names.

## Check provider access

Put each formula in a separate empty area of a private spreadsheet.
Use the [function reference](FUNCTIONS.md#function-list) for request arguments and output sizes.

| Dataset | What to check |
|---|---|
| Stock quotes | Session, price, currency, source timestamp and unavailable fields |
| History | Seven columns, chronological rows, raw and adjusted closes, volume and missing values |
| Earnings and financials | Reporting periods, accounting basis, currency and missing values |
| Options | Published expirations, matching contracts, quote times, bid/ask, IV, volume and open interest |
| Finviz, Zacks and GuruFocus | Each supported field, its unit and an invalid US ticker |
| Keyed quotes | The selected provider, symbol, exchange, quote currency, timing and plan restrictions |
| FRED | Published units, exact observation dates, missing periods and numeric zeros |

Test each keyed quote provider separately with its matching key.
Use `"all"` in `TICKERSHEETS_PROVIDER_QUOTE` to inspect returned metadata.
Compare the formula with that provider's response for the same symbol and observation time.
Include explicit Twelve Data exchanges to check that one listing cannot reuse another listing's response or cache entry.
Do not treat saved-key status as proof of provider access.

Public example data and local fixtures do not establish authenticated access for another user's plan.
Requests can fail differently from Google Apps Script and a local computer.

## Check caches and refresh

1. Choose a ticker that this project did not recently request and enter it in `A1`.
2. Enter `=TICKERSHEETS_DATA_STATUS($A$1,"history")` in `B1`.
3. Enter `=TICKERSHEETS_DATA_STATUS($A$1,"HISTORY")` in `B5`.
4. Compare **Cached** and **Retrieved at**.
5. Choose **TickerSheets → Refresh data** and confirm that existing formulas remain in their original cells.

The two dataset arguments select the same internal cache through different worksheet formulas.
A cache hit retains its retrieval time.
Both requests can already be cached if the project recently requested that ticker.
Google can [remove cache entries early](https://developers.google.com/apps-script/reference/cache/cache).
A repeated miss does not establish a provider defect, and a cache hit does not establish a fresh trade.

## Check use alongside CacheFinance

Download CacheFinance separately from its [original repository](https://github.com/demmings/cachefinance).
Then run:

```sh
npm run check:coexistence -- /path/to/CacheFinance.js
```

The command loads the two bundles in both orders and exercises their separate worksheet functions.
It does not download or bundle CacheFinance with TickerSheets.

## Report a problem

Include the exact formula, ticker or series, expected and actual result, observation time and request date.
For source problems, distinguish an unavailable field, a blocked request and a spreadsheet error.
For cache problems, identify whether the request used a cold or warm cache.
Exclude keys, cookies, authenticated URLs and personal data from reports and screenshots.
