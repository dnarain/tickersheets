# Install TickerSheets

TickerSheets runs in a spreadsheet's Google Apps Script project.
Apps Script requests the provider data directly, without a hosted server.
Each user uses a private spreadsheet copy and their own API keys.

This guide installs the script and generated analysis tabs.
The [function reference](FUNCTIONS.md) describes the formulas, arguments and units.
The [build-your-own guide](BUILD-YOUR-OWN.md) gives cell locations and formulas for your own tabs.

## Option 1: Copy the template

[Copy the Single Stock Analysis sample](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/copy).

1. Open the copy link while signed in to your chosen Google account.
2. Click **Make a copy** in Google's copy dialog.
3. Open your copy.
4. Choose **Stock analysis → Refresh selected ticker**.
5. Complete Google's authorization steps for your copy.
6. If the refresh does not run after authorization, choose **Refresh selected ticker** again.
7. Wait for the source formulas to finish.
8. Open **Start here** for the formula walkthrough.

The public template is read-only.
Google copies its attached Apps Script into your spreadsheet.
The template contains saved example values from its test run.
A refresh requests new data for your copy.

If **Data settings** and **Stock analysis** are missing, reload your copy once.
The menus appear in an editable copy of the spreadsheet.

The clean template uses a new, separate Apps Script project with no saved credentials.
The public template contains no saved API keys.
Save your own keys after copying it.

## Option 2: Install the single file from GitHub

This procedure starts with a blank spreadsheet.
It keeps the install separate from existing spreadsheet scripts.
No command line, local build or developer account is required.

1. Create a blank Google spreadsheet in your chosen account.
2. Choose **Extensions → Apps Script**.
3. Open the default `Code.gs` file.
4. Open [dist/TickerSheets.js on main](https://github.com/dnarain/tickersheets/blob/main/dist/TickerSheets.js).
5. Click **Copy raw file** in GitHub.
6. Replace the default contents of `Code.gs` with the copied file.
7. Save the Apps Script project.
8. Return to the spreadsheet.
9. Reload the spreadsheet.
10. Choose **Stock analysis → Build analysis sheets**.
11. Complete Google's authorization steps for your copy.
12. If the build does not run after authorization, choose **Build analysis sheets** again.

The menu creates the analysis tabs, source formulas and charts.
Google Sheets calculates the source formulas and their dependent cells.
The default ticker is `NVDA`.
The first refresh can take longer than later refreshes.

Copy the bundle **once** into the project.
Do not add individual files from `src/` beside it.
Do not add `dist/TickerSheetsProviderTests.js` beside it.
Those files contain duplicate function names.
The normal `dist/TickerSheets.js` bundle includes the settings menu, research functions and sheet builders.

## Initial authorization

Google's authorization dialog belongs to the account that runs your private copy.
Review the project name and requested permissions before authorizing it.
The permissions for this bundle are listed in the next section.

Custom cell functions do not open an authorization dialog.
The installation procedures use a menu command to request authorization first.
Google describes this distinction in its [custom function guide](https://developers.google.com/apps-script/guides/sheets/functions#advanced).

If a cell reports a permission error:

1. Return to the spreadsheet.
2. Choose **Stock analysis → Refresh selected ticker**.
3. Complete authorization for your copy.
4. Run the menu command again if necessary.

If the permission error remains, report the exact formula and error message.
An account or administrator restriction can still block an Apps Script project or external requests.

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

1. Open **Analysis**.
2. Enter a ticker in the yellow cell `B4`.
3. Choose **Stock analysis → Refresh selected ticker**.
4. Wait for the source formulas to finish.
5. Open **Sources** to inspect provider results and timestamps.

Supported examples include `NVDA`, `NASDAQ:AAPL`, `NYSE:IBM`, `TSE:RY` and `RY.TO`.
The script updates the titles and charts for the selected ticker.
A ticker edit updates the source formulas that depend on **Analysis!B4**.

The builder places the managed analysis tabs first and opens **Start here**.
It preserves other tabs and their contents.

**Stock analysis → Provider chart links** creates an optional **Chart links** tab.
It provides public chart links and manual-copy guidance.
The menu makes no provider requests.
StockCharts' [reprint policy](https://help.stockcharts.com/learning-more/policies-and-limitations/reprint-permission-policies) requires manual copying.

For a different option expiration:

1. Open **Options**.
2. Choose an available date in the `B4` dropdown.
3. Choose **Stock analysis → Refresh selected ticker**.

The dropdown contains published expiration dates.
The options table covers the selected expiration.
The research charts also sample several available maturities.
The generated option calculations cover up to 1,000 contracts and warn when the source returns more rows.
Some tickers have no supported options.
A returned chain can also lack usable ATM quotes, implied volatility or premiums.
Without valid calculator inputs, the model shows `n.a.` and the payoff table uses intentional `#N/A` gaps.
The [sample spreadsheet guide](SAMPLE.md#options) explains these inputs and limits.

## Save API keys

Yahoo quote, history, fundamentals and anonymous option requests do not require your personal API key in this script.
FRED requires your own key.
To use Finnhub, Alpha Vantage, Twelve Data or CoinMarketCap, save that provider's key.

1. Choose **Data settings → API keys…**.
2. Enter your key in the matching provider field.
3. Click **Save keys**.
4. Check that the provider shows **Saved**.

Blank fields preserve existing keys.
**Remove saved key** deletes the selected key after you click **Save keys**.
The form never fills a saved key into the input field.

The script stores keys in [Script Properties](https://developers.google.com/apps-script/guides/properties), outside worksheet cells.
Script Properties belong to the script project and are shared by its users.
These keys are not separate settings for each person who opens the same spreadsheet.
People who can edit the spreadsheet can also edit its bound script and access its keys.
Keep your spreadsheet private when its script contains personal keys.
Do not put keys in formulas, worksheet cells, GitHub files or issue reports.

The sidebar's **Saved** label confirms that a property exists.
It does not test the key or the provider connection.

### FRED

1. Request your own key from [FRED's API key page](https://fred.stlouisfed.org/docs/api/api_key.html).
2. Save the key in **Data settings → API keys…**.
3. Choose **Stock analysis → Refresh selected ticker**.

The settings menu uses the Script Property `FRED_API_KEY`.
A missing key leaves FRED values unavailable.
The script does not substitute zero values for missing economic data.

### If the sidebar is blank

Google documents [Apps Script problems with multiple signed-in accounts](https://developers.google.com/apps-script/guides/support/troubleshooting#issues_with_multiple_google_accounts).
A browser profile with only the spreadsheet's account can resolve this problem.

The FRED key also has a standard Google prompt:

1. Choose **Data settings → Enter FRED key…**.
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
| **Start here** | Formula walkthrough, source-cell trace and workbook controls |
| **Analysis** | Ticker input, quote, indicators and company summary |
| **Quote data** | Shared quote, comparison, expiration and RSI2 source formulas |
| **Price history** | Daily-price source table, visible indicator formulas, helpers and benchmark tables |
| **Fundamentals** | Published fields, units and sources |
| **Earnings** | Separate earnings results, financial statements, estimates and events |
| **Options** | Selected-expiration chain and option model |
| **Macro** | Four FRED series, with your key |
| **Sources** | Links to source formula cells, returned-data statuses and timestamps |
| **Research** | Additional charts, earnings summary and selected Finviz, Zacks and GuruFocus fields |
| **Watchlist** | Up to 20 ticker inputs and summary values |
| **Watchlist data** | One source table per other ticker; the selected ticker reuses its existing sources |
| **Journal** | Explicitly recorded observations and formulas for changes between entries |
| **Formulas** | Function reference, linked examples and formula-text examples |
| **Strategies** | Editable covered call, cash-secured put and vertical payoff models |

The strategy worksheet uses the selected expiration.
Long option premiums start from source asks, and short premiums start from source bids.
Refreshes reset the editable strategy assumptions.
The displayed cash amounts cover the whole position.

The script marks each managed tab in hidden cell `Z1`.
It refuses to overwrite a same-named tab without the matching marker.
Other tabs remain available for your own work.
Rebuilding managed tabs can replace their generated contents and formatting.
The journal keeps prior public snapshots for comparisons.
An upgrade from an older workbook can rebuild the managed tabs to install this formula layout.
Other tabs, saved keys, watchlist ticker inputs and prior journal rows remain available.

For the watchlist:

1. Enter up to 20 tickers in **Watchlist!A8:A27**.
2. Choose **Stock analysis → Refresh watchlist**.

Watchlist formulas request quote, history and fundamental data for the other tickers.
The selected stock's row references its existing source tables.
`CFWATCHROW` calculates compact indicators for the other tickers inside Apps Script.
The journal compares earlier rows for the same symbol and currency.
The first snapshot has no prior change value.
After the source formulas finish, choose **Stock analysis → Record journal snapshot** to save the displayed observations.
Refreshes do not append journal rows automatically.

For cell formulas:

1. Open **Formulas**.
2. Review the example formulas and their units.
3. Inspect **Analysis!B9**, **Formulas!B23** and **Quote data!A7** to follow the displayed price.
4. To request new results, choose **Stock analysis → Refresh formula examples**.

The [function reference](FUNCTIONS.md) gives every public signature and its supported arguments.
The [build-your-own guide](BUILD-YOUR-OWN.md) gives cell locations and copyable formulas for custom tabs.
Google limits each custom function to [30 seconds](https://developers.google.com/apps-script/guides/sheets/functions#return_values).
Each source function returns its own table. Ordinary spreadsheet formulas read those tables.

The functions cache results. They do not stream prices continuously or refresh your custom tabs on a schedule.
All generated source formulas share **Analysis!E4** as their refresh number.
The refresh menus increment that number and reset the generated calculator assumptions.
**Formulas!E4** and **Watchlist!E4** reference **Analysis!E4**.
A custom tab can reference that cell or use its own manual refresh number.
The [build-your-own guide](BUILD-YOUR-OWN.md#1-create-the-controls) explains this input.

## Check the added lookups

1. Choose **Stock analysis → Build lookup checks**.
2. Open the new **Lookup tests** tab.
3. Wait for its formulas to finish calculating.
4. Choose **Stock analysis → Inspect lookup checks**.

The inspector distinguishes passing results, failed assertions, pending calculations and blocked providers.
Missing FRED keys and blocked providers remain **BLOCKED**.
A passing calculation does not independently verify a financial value against another source.

The diagnostic dates describe the November 2026 test snapshot.
Its reference comparison requires `2026-11-05` to remain in the latest 30 DGS10 observations.
After that date leaves the window, a failed reference comparison does not establish an exact-date lookup defect.
The fixed weekend and monthly-period cases also refer to their documented dates.

The [provider guide](PROVIDERS.md#testing-process) explains the tests, statuses and limits.

## Read statuses and dates

**Retrieved** records the time that Apps Script received data.
**Quote time** records the provider's quote timestamp, when available.
**Price session** identifies regular, pre-market or after-hours pricing.
An explicit extended-session quote can belong to an earlier session. Check its timestamp.
**Indicators through** identifies the last published closing-price session.
These timestamps can differ.

`N/A` means that a value is unavailable.
`N/A: ...` adds a request or input explanation.
These text values differ from Google's native spreadsheet errors.
The original `CACHEFINANCE` functions retain their older cache and fallback behavior.

A successful request does not guarantee every field.
Provider pages can block Apps Script, change their format or stop publishing selected data.
**Sources** reports those problems separately.
API keys do not automatically unlock every website or subscription dataset.

## Updates

The installed Apps Script copy does not update automatically from GitHub.
Replace the code inside the existing bound project to keep its Script Properties and current workbook contents.

1. Open **Extensions → Apps Script** in your private copy.
2. Open the file that contains the installed application bundle.
3. Replace that file's contents with the new `dist/TickerSheets.js` contents.
4. Save the project.
5. Reload the spreadsheet.
6. Choose **Stock analysis → Refresh selected ticker**.

Do not paste a second copy beside the old bundle.

The refresh first renames the application's older tabs to the names in this guide.
It keeps the same sheets, so Google Sheets updates their formula references and preserves their data during the rename.
The rename also preserves watchlist inputs, journal rows and the project's saved API keys.
If both an older tab and its new name exist, the script stops before renaming any tabs.
An unrelated tab with one of these names also blocks the upgrade.
Resolve the name conflict, then run the refresh again. Do not delete your older tabs to upgrade their names.

Replacing the code file keeps the saved keys in the same project's Script Properties.
The first refresh of an older layout rebuilds the managed tabs with source formulas and formula-driven views.
Later refreshes preserve that layout and increment **Analysis!E4**.
Custom tabs remain separate, and the journal keeps its prior snapshots.
Keep custom notes and formulas on your own tabs.

For the added formula examples, choose **Stock analysis → Build formula examples**.
That command replaces the generated contents of **Formulas**.
For the added diagnostics, choose **Stock analysis → Build lookup checks**.
That command replaces **Lookup tests**.

If an update requires new analysis layouts, choose **Stock analysis → Build analysis sheets**.
The builder preserves other tabs and keeps watchlist ticker inputs and prior journal rows.
It can replace generated analysis contents, example formulas, formatting and strategy assumptions.
Keep custom notes and formulas on your own tabs before rebuilding managed tabs.

## Share a report or report a problem

A useful report includes the exact formula or menu action, ticker, expiration, actual result and expected result.
The provider status and source timestamp also help explain a result.
Screenshots can contain personal data from other tabs.
API keys, cookies and account credentials do not belong in reports.

For a public template, start with a separate blank spreadsheet and a new bound script project.
Install only the public bundle into that project.
Do not publish a copy of the private project that stores your keys.
