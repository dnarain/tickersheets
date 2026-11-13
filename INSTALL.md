# Install TickerSheets

TickerSheets supplies custom functions for Google Sheets.
The functions run in the spreadsheet's attached Apps Script and request provider data directly.
There is no hosted server.

You can copy the tutorial or install the functions in a spreadsheet that you already use.

## Option 1: Copy the tutorial

[Copy TickerSheet Demo and Tutorial](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/copy).

1. Open the copy link while signed in to your chosen Google account.
2. Click **Make a copy**.
3. Open your editable copy and reload it.
4. Enter a ticker in **Start here!B4**.
5. Choose **Data settings → Refresh formulas**.
6. Complete Google's authorization steps if prompted.

Google copies the attached Apps Script with the spreadsheet.
The tutorial has one tab, **Start here**, with working formulas and formula text beside each result.
It contains saved example results and no saved API keys.
Your private copy can request new results and use your own keys.

The script's `onOpen` function adds the **Data settings** menu.
If that menu is missing, reload your editable copy.
The public tutorial remains read-only.

## Option 2: Install the functions in your spreadsheet

No command line, local build or developer account is required.

1. Open your Google spreadsheet.
2. Choose **Extensions → Apps Script**.
3. Open the default `Code.gs` file.
4. Open [dist/TickerSheets.js on main](https://github.com/dnarain/tickersheets/blob/main/dist/TickerSheets.js).
5. Click **Copy raw file** in GitHub.
6. Replace the default contents of `Code.gs` with the copied file.
7. Save the Apps Script project.
8. Return to the spreadsheet and reload it.
9. Enter a ticker in a cell, such as `NVDA` in `A1`.
10. Enter `=CFQUOTE(A1,"price")` in another cell.

The result appears in the cell that contains the formula.
The installation adds the function library and **Data settings** menu.
You can use the functions in your existing cells without creating dashboard tabs.

Copy the bundle once into the attached project.
Do not add individual `src/` files or the provider-test bundle beside it.
Those files contain duplicate function names.
If the project already contains your own code, keep a backup before adding TickerSheets.

The [function reference](FUNCTIONS.md) lists every public function and supported field.
The [build-your-own guide](BUILD-YOUR-OWN.md) gives simple recipes.

## Authorization and refresh

Google can ask for authorization when you open **API keys…** or choose **Refresh formulas**.
Review the project name and requested permissions.
If a formula reports a permission error, choose **Data settings → Refresh formulas** and complete authorization if prompted.

Custom cell functions cannot open an authorization dialog themselves.
Google describes their limits in its [custom function guide](https://developers.google.com/apps-script/guides/sheets/functions#guidelines_for_custom_functions).
An account or administrator restriction can still block Apps Script or external requests.

Choose **Data settings → Refresh formulas** when you want another result.
Changing a ticker also recalculates formulas that use that cell.
The functions can reuse recent cached provider responses and do not stream continuously.

## Google permissions

The installed script uses these permissions:

| Permission | Purpose |
|---|---|
| `spreadsheets.currentonly` | Read and write the spreadsheet that contains the script |
| `script.container.ui` | Show the Data settings menu and API key form |
| `script.external_request` | Request data from the documented providers |

The bundle contains `@OnlyCurrentDoc`.
It does not require a Drive scope or access to every spreadsheet in your account.

For an explicit manifest:

1. Open **Project Settings** in Apps Script.
2. Enable **Show "appsscript.json" manifest file in editor**.
3. Open `appsscript.json`.
4. Replace its contents with [the supplied manifest](apps-script/provider-tests/appsscript.json).
5. Save the project and reload the spreadsheet.

The supplied manifest uses the `America/Los_Angeles` time zone.
The spreadsheet controls displayed timestamps.
Google can show a verification notice for code that you copy into your own Apps Script project.
Google Workspace administrators can also restrict scripts or external requests.

## Save API keys

Yahoo quotes, history, fundamentals, earnings and public options do not require a personal API key in this library.
FRED requires your own key.
The original `CACHEFINANCE` / `CACHEFINANCES` functions can use saved Finnhub, Alpha Vantage, Twelve Data or CoinMarketCap keys.
Those optional keys do not change `CFQUOTE`'s Yahoo source.

1. Choose **Data settings → API keys…**.
2. Enter your key in the matching provider field.
3. Click **Save keys**.
4. Check that the provider shows **Saved**.

Blank fields preserve saved keys.
Selecting **Remove saved key** deletes that provider's key after you click **Save keys**.
The form never puts saved keys back into its input fields.
**Saved** confirms storage. It does not test the key or provider connection.

The script stores keys in [Script Properties](https://developers.google.com/apps-script/guides/properties), outside worksheet cells.
Script Properties belong to the attached project and are shared by its users.
People who can edit the spreadsheet can access its script and keys.
Keep a copy with personal keys private.
Do not put keys in formulas, worksheet cells, GitHub files or issue reports.

### FRED

1. Request your own key from [FRED's API key page](https://fred.stlouisfed.org/docs/api/api_key.html).
2. Choose **Data settings → API keys…**.
3. Enter the key in **FRED** and click **Save keys**.
4. Enter a FRED formula, such as `=CFFRED("DGS10",60)`, in an empty area.

The script stores this key as `FRED_API_KEY`.
A missing key leaves FRED values unavailable.
The script preserves missing economic data as unavailable values.

### If the sidebar is blank

Google documents [Apps Script problems with multiple signed-in accounts](https://developers.google.com/apps-script/guides/support/troubleshooting#issues_with_multiple_google_accounts).
A browser profile signed in only to the spreadsheet's account can resolve this problem.

1. Open a browser profile or private window signed in only to that Google account.
2. Open your private spreadsheet copy there.
3. Choose **Data settings → API keys…** again.
4. Enter the key in its provider field.
5. Click **Save keys**.

All five keyed providers use this same form.

## Updates

The installed code does not update automatically from GitHub.

1. Open **Extensions → Apps Script** in your spreadsheet.
2. Open the file that contains TickerSheets.
3. Replace its contents with the current `dist/TickerSheets.js` contents.
4. Save the project.
5. Reload the spreadsheet.
6. Choose **Data settings → Refresh formulas**.

Do not paste a second bundle beside the old one.
Replacing the code in the same project preserves its saved keys.
Your worksheet formulas remain in their cells.
You can also copy the current public tutorial to get its latest examples.

For contributors, `CFBuildTutorial` in `src/CacheFinanceTutorial.js` creates the single-tab tutorial.
Users install `dist/TickerSheets.js` and type their own cell formulas.

## Report a problem

Include the exact formula, ticker, expected result, actual result and provider timestamp when available.
Provider pages can block requests, change format or stop supplying fields.
An API key does not automatically unlock subscription data.
The [provider guide](PROVIDERS.md) records tested sources and remaining limits.

Screenshots can contain personal data from other cells.
API keys, cookies and account credentials do not belong in reports.
For a public example, start with a separate spreadsheet and attached project that contain no personal keys.
