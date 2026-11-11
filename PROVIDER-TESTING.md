# Test providers from Google Sheets

This fork first tests the existing CacheFinance providers from Google Apps Script.
It does not add SMF functions or require a hosted server.
Each user runs the script in their own Google account.

The upstream source starts at commit `8f84e202e0c5d56f27b2bf000bb86817c3503894`.
Both bundles include the **CacheFinance → API keys…** menu.
The separate test bundle disables upstream diagnostic logging, which can include API keys and response bodies.

## Install the test runner

1. Create a new, private Google spreadsheet for the tests.
2. Open **Extensions → Apps Script**.
3. Copy [dist/CacheFinanceProviderTests.js](dist/CacheFinanceProviderTests.js) into `Code.gs`.
4. Open **Project Settings**.
5. Enable **Show "appsscript.json" manifest file in editor**.
6. Replace the manifest with [apps-script/provider-tests/appsscript.json](apps-script/provider-tests/appsscript.json).
7. Save the project.
8. Select `RunProviderTests` in the function list.
9. Click **Run**.
10. Review the requested permissions before authorization.

The manifest requests access to the current spreadsheet, external HTTP requests and a sidebar in the spreadsheet.
It does not request Drive access or access to other spreadsheets.
The runner writes its report into dedicated tabs in this spreadsheet.

## Run the tests

1. Run `RunProviderTests` to start a new report.
2. Run `ContinueProviderTests` until the report marks the run complete.
3. To restart one provider, select its `RunProvider...` function.
4. After a provider restart, run `ContinueProviderTests` until no pending rows remain.
5. Run `SetupProviderWorksheetTests` to add worksheet checks.
6. Wait for Google Sheets to finish calculating.
7. Run `CollectProviderWorksheetTests` to record the worksheet results.
8. Run `CFProviderReportJson` to produce a sanitized JSON report.

The runner tests each adapter directly.
It bypasses CacheFinance caches and fallback providers.
Several attributes can share one HTTP request.
The runner records the HTTP result and each parsed attribute separately.
Each batch makes at most four requests, with a 25-second timeout per request.
Each provider restart clears its previous results.

The worksheet checks exercise the installed formulas separately.
A cached result or a successful fallback does not establish a direct provider result.
Synthetic symbols hold the supplied control prices, so the checks cannot overwrite cached prices for real stocks.

## Supply optional API keys

The public providers can run without API keys.
The runner skips a keyed provider when its key is missing.

Reload the spreadsheet after installing the script.
Open **CacheFinance → API keys…**.
Enter each key in its provider's password field, then click **Save keys**.
You do not need to reopen Apps Script to enter or change keys.

The sidebar shows **Saved** or **Not set** for each provider.
It never loads a saved key into the browser.
A blank field keeps the existing key.
A new value replaces the existing key.
Select **Remove saved key** and click **Save keys** to delete a key.

The sidebar stores keys in these Script Properties, which the existing providers read:

| Provider | Property |
|---|---|
| Finnhub | `FINNHUB_API_KEY` |
| Twelve Data | `TWELVE_DATA_API_KEY` |
| Alpha Vantage | `ALPHA_VANTAGE_API_KEY` |
| CoinMarketCap | `COINMARKET_API_KEY` |

Each user supplies keys in their own copy.
Script editors can access that script's properties.
The sidebar does not make keys private from other editors of the same script.
Keep keys out of worksheet cells, Git commits, screenshots and issue reports.

The settings menu sends no requests to financial providers.
Run the provider checks separately after saving keys.

If the sidebar opens blank, try a browser profile or private window signed in to only the spreadsheet's Google account.
Google documents [Apps Script problems with multiple signed-in accounts](https://developers.google.com/apps-script/guides/support/troubleshooting#issues_with_multiple_google_accounts).

## Read the report

The report distinguishes valid parsed fields, unsupported cases, missing keys, HTTP errors and parsing errors.
A missing key means that the provider remains untested.
An HTTP response alone does not establish that the requested field works.

| Status | Meaning |
|---|---|
| `PARSED` | The direct response supplied a valid field. Financial accuracy and freshness require separate checks. |
| `KEY_REQUIRED` | The provider was skipped because its API key is missing. |
| `UNSUPPORTED_ATTRIBUTE`, `UNSUPPORTED_SYMBOL`, `UNSUPPORTED_COMBINATION` | The adapter does not implement this request. |
| `HTTP_ERROR`, `RATE_LIMITED`, `FETCH_ERROR` | The request did not supply an accepted response. |
| `MISSING_VALUE`, `PARSE_ERROR`, `IDENTITY_MISMATCH` | The response did not supply a valid field for this test ticker. |
| `NEGATIVE_REJECTED` | The provider rejected the deliberate invalid ticker. |
| `NEGATIVE_FALSE_POSITIVE` | The provider returned an accepted value for the deliberate invalid ticker. |
| `PENDING`, `RUNNING`, `INTERRUPTED` | The test does not have a completed result. |

The report records retrieval time separately from quote time.
When a response does not supply a quote time, the report states that the quote time is unknown.
A parsed value without a quote time does not establish freshness.
The runner stores timestamp columns as plain text to preserve date-only and provider-local strings.
Alpha Vantage requests have a minimum 1.25-second gap after each previous Alpha response.

The runner tests selected symbols and fields.
A passing result does not establish every ticker or every feature of that provider.
Record the test date, source commit and exact cases with each shared report.

## Develop locally

```sh
npm ci --ignore-scripts
npm test
npm run build:check
npm run build:provider-tests
npm run build:provider-tests:check
```

Local tests use mocks and controlled responses.
Only a run inside Google Apps Script establishes access from Google's network.
Do not replace failed Google results with successful requests from a local computer.

## Results

The [November 11 Google Apps Script results](test-results/2026-11-11-google-apps-script/README.md) contain the first live run.
The report includes direct provider cases and separate worksheet checks.
The [keyed-provider follow-up](test-results/2026-11-11-google-apps-script/KEYED-PROVIDERS.md) includes the remaining four providers and an Alpha Vantage recheck.
The [API-key settings checks](test-results/2026-11-11-google-apps-script/API-KEY-SETTINGS.md) record local passes and the user's successful display and blank-save checks.
