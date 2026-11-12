# Install CacheFinance for Google Sheets

This fork runs in a spreadsheet's Google Apps Script project.
It does not require a hosted server, Excel or Windows.
Each user uses a private spreadsheet copy and their own API keys.

## Option 1: Copy the template

The clean template passed the native worksheet checks.
It remains private pending the owner's sharing approval.
The instructions in Option 2 install the same script directly from GitHub.

After a public template link becomes available:

1. Open the template while signed in to your chosen Google account.
2. Choose **File → Make a copy**.
3. Give the copy a name.
4. Open your copy.
5. Choose **Stock analysis → Refresh selected ticker**.
6. Complete Google's authorization steps for your copy.

The clean template uses a new, separate Apps Script project with no saved credentials.
Your copy does not include another user's API keys.

## Option 2: Install the single file from GitHub

This procedure starts with a blank spreadsheet.
It keeps the install separate from existing spreadsheet scripts.
No command line, local build or developer account is required.

1. Create a blank Google spreadsheet in your chosen account.
2. Choose **Extensions → Apps Script**.
3. Open the default `Code.gs` file.
4. Open [dist/CacheFinance.js on this branch](https://github.com/dnarain/cachefinance/blob/dnarain/provider-tests/dist/CacheFinance.js).
5. Click **Copy raw file** in GitHub.
6. Replace the default contents of `Code.gs` with the copied file.
7. Save the Apps Script project.
8. Return to the spreadsheet.
9. Reload the spreadsheet.
10. Choose **Stock analysis → Build analysis sheets**.
11. Complete Google's authorization steps for your copy.

The menu creates the analysis tabs and requests the initial ticker's data.
The default ticker is `NVDA`.
The first refresh can take longer than later refreshes.

Copy the bundle **once** into the project.
Do not add individual files from `src/` beside it.
Do not add `dist/CacheFinanceProviderTests.js` beside it.
Those files contain duplicate function names.
The normal `dist/CacheFinance.js` bundle includes the settings menu, research functions and sheet builders.

## Google permissions

The script uses these permissions:

| Permission | Purpose |
| --- | --- |
| `spreadsheets.currentonly` | Read and write the spreadsheet that contains this script |
| `script.container.ui` | Show menus, the API key sidebar and prompts |
| `script.external_request` | Request data from the documented providers |

The bundle contains `@OnlyCurrentDoc`.
The supplied manifest lists these three scopes.
The script does not require a Drive scope or access to every spreadsheet in your account.

For an explicit manifest:

1. Open **Project Settings** in Apps Script.
2. Enable **Show "appsscript.json" manifest file in editor**.
3. Open `appsscript.json` in the editor.
4. Replace its contents with [the supplied manifest](apps-script/provider-tests/appsscript.json).
5. Save the project.
6. Reload the spreadsheet.

The supplied manifest uses the `America/Los_Angeles` time zone.
The spreadsheet controls the displayed timestamps.

Google can show a verification notice for a script that you copy into your own project.
Google Workspace administrators can also restrict scripts or external requests.
Those account restrictions can prevent authorization.

## Set the ticker and expiration

1. Open **CF Analysis**.
2. Enter a ticker in the yellow cell `B4`.
3. Choose **Stock analysis → Refresh selected ticker**.
4. Open **CF Sources** to inspect provider statuses and timestamps.

Supported examples include `NVDA`, `NASDAQ:AAPL`, `NYSE:IBM`, `TSE:RY` and `RY.TO`.
The script updates the titles and charts for the selected ticker.
A ticker edit clears the previous ticker's outputs before a new refresh.

The builder places the managed analysis tabs first and opens **CF Analysis!B4**.
It preserves other tabs and their contents.

**Stock analysis → Provider chart links** creates an optional **CF Images** tab.
It provides public chart links and manual-copy guidance.
The menu makes no provider requests.
StockCharts' [reprint policy](https://help.stockcharts.com/learning-more/policies-and-limitations/reprint-permission-policies) requires manual copying.

For a different option expiration:

1. Open **CF Options**.
2. Choose an available date in the `B4` dropdown.
3. Choose **Stock analysis → Refresh selected ticker**.

The dropdown contains published expiration dates.
The options table covers the selected expiration.
The research charts also sample several available maturities.
Some tickers have no supported options.

## Save API keys

Yahoo quote, history, fundamentals and anonymous option requests do not require your personal API key in this script.
FRED requires your own key.
The original CacheFinance providers also support optional Finnhub, Alpha Vantage, Twelve Data and CoinMarketCap keys.

1. Choose **CacheFinance → API keys…**.
2. Enter your key in the matching provider field.
3. Click **Save keys**.
4. Check that the provider shows **Saved**.

Blank fields preserve existing keys.
**Remove saved key** deletes the selected key after you click **Save keys**.
The form never fills a saved key into the input field.

The script stores keys in Script Properties, outside worksheet cells.
Editors of the spreadsheet's bound script can access those properties.
Keep your spreadsheet private when its script contains personal keys.
Do not put keys in formulas, worksheet cells, GitHub files or issue reports.

### FRED

1. Request your own key from [FRED's API key page](https://fred.stlouisfed.org/docs/api/api_key.html).
2. Save the key in **CacheFinance → API keys…**.
3. Choose **Stock analysis → Refresh selected ticker**.

The settings menu uses the Script Property `FRED_API_KEY`.
Google Sheets does not read the Excel port's `smf-FRED-API-Key.txt` file.
A missing key leaves FRED values unavailable.
The script does not substitute zero values for missing economic data.

### If the sidebar is blank

Google documents [Apps Script problems with multiple signed-in accounts](https://developers.google.com/apps-script/guides/support/troubleshooting#issues_with_multiple_google_accounts).
A browser profile with only the spreadsheet's account can resolve this problem.

The FRED key also has a standard Google prompt:

1. Choose **CacheFinance → Enter FRED key…**.
2. Paste your existing FRED key.
3. Click **OK**.
4. Choose **Stock analysis → Refresh selected ticker**.

This standard prompt shows the text that you type.
It saves the same `FRED_API_KEY` property as the sidebar.
A blank entry preserves the existing key.

## Created tabs

The builder creates these tabs:

| Tab | Contents |
| --- | --- |
| **CF Analysis** | Ticker input, quote, indicators and company summary |
| **CF Price history** | Daily prices, adjusted returns and benchmark columns |
| **CF Fundamentals** | Published fields, units and sources |
| **CF Earnings** | Separate earnings results, financial statements, estimates and events |
| **CF Options** | Selected-expiration chain and option model |
| **CF Macro** | Four FRED series, with your key |
| **CF Sources** | Provider statuses, timestamps and usage notes |
| **CF Research** | Additional charts, earnings summary and selected SMF provider fields |
| **CF Watchlist** | Up to 20 ticker inputs and summary values |
| **CF Journal** | Public snapshots and changes between refreshes |
| **CF Formulas** | Function reference and live formula examples |
| **CF Strategies** | Editable covered call, cash-secured put and vertical payoff models |

The strategy worksheet uses the selected expiration.
Long option premiums start from source asks, and short premiums start from source bids.
Refreshes reset the editable strategy assumptions.
The displayed cash amounts cover the whole position.

The script marks each managed tab in hidden cell `Z1`.
It refuses to overwrite a same-named tab without the matching marker.
Other tabs remain available for your own work.
Rebuilding managed tabs can replace their generated contents and formatting.
The journal keeps prior public snapshots for comparisons.

For the watchlist:

1. Enter up to 20 tickers in **CF Watchlist!A8:A27**.
2. Choose **Stock analysis → Refresh watchlist**.

Watchlist refreshes request quote, history and fundamental data.
They do not run the full options and macro workflow for each row.
The journal compares earlier rows for the same symbol and currency.
The first snapshot has no prior change value.

For cell formulas:

1. Open **CF Formulas**.
2. Review the example formulas and their units.
3. To request new formula results, choose **Stock analysis → Refresh formula examples**.

The [function reference](FUNCTIONS.md) gives every public signature and its supported arguments.
Google limits each custom function to [30 seconds](https://developers.google.com/apps-script/guides/sheets/functions#return_values).
The menu workflow handles larger requests and several maturities.

## Read statuses and dates

**Retrieved** records the time that Apps Script received data.
**Quote time** records the provider's quote timestamp, when available.
**Indicators through** identifies the last published closing-price session.
These timestamps can differ.

`N/A` means that a value is unavailable.
`N/A: ...` adds a request or input explanation.
These text values differ from Google's native spreadsheet errors.
The original `CACHEFINANCE` functions retain their older cache and fallback behavior.

A successful request does not guarantee every field.
Provider pages can block Apps Script, change their format or stop publishing selected data.
**CF Sources** reports those problems separately.
API keys do not automatically unlock every website or subscription dataset.

## Updates

1. Open **Extensions → Apps Script** in your private copy.
2. Open the file that contains the installed CacheFinance bundle.
3. Replace that file's contents with the new `dist/CacheFinance.js` contents.
4. Save the project.
5. Reload the spreadsheet.
6. Choose **Stock analysis → Build analysis sheets**.

Do not paste a second copy beside the old bundle.
Your Script Properties remain separate from the code file.
Generated tabs can change during an update.

## Share a report or report a problem

A useful report includes the exact formula or menu action, ticker, expiration, actual result and expected result.
The provider status and source timestamp also help explain a result.
Screenshots can contain personal data from other tabs.
API keys, cookies and account credentials do not belong in reports.

For a public template, start with a separate blank spreadsheet and a new bound script project.
Install only the public bundle into that project.
Do not publish a copy of the private project that stores your keys.
