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
5. Choose **TickerSheets → Refresh data**.
6. Complete Google's authorization steps if prompted.

Google copies the attached Apps Script with the spreadsheet.
**Start here** contains working formulas and formula text beside each result.
**Stock analysis** shows company data, earnings, technical indicators and a price chart.
**Options analysis** shows expiration dates, call/put quotes, model Greeks, strategies and a payoff chart.
All three tabs use the ticker in **Start here!B4**.
The demo contains saved example results and no saved API keys.
Your private copy can request new results and use your own keys.

The script's `onOpen` function adds the **TickerSheets** menu.
If that menu is missing, reload your editable copy.
The public tutorial remains read-only.

## Option 2: Install the functions in your spreadsheet

No command line, local build or developer account is required.

1. Open your Google spreadsheet.
2. Choose **Extensions → Apps Script**.
3. Click **+ → Script** and name the new file `TickerSheets`.
4. Open [dist/TickerSheets.js on main](https://github.com/dnarain/tickersheets/blob/main/dist/TickerSheets.js).
5. Click **Copy raw file** in GitHub.
6. Replace the default contents of the new `TickerSheets.gs` file with the copied code.
7. Save the Apps Script project.
8. Return to the spreadsheet and reload it.
9. Enter a ticker in a cell, such as `NVDA` in `A1`.
10. Enter `=TICKERSHEETS_QUOTE(A1,"price")` in another cell.

The result appears in the cell that contains the formula.
The installation adds the function library and **TickerSheets** menu.
You can use the functions in your existing cells without creating dashboard tabs.

Copy the bundle once into the attached project.
Do not add individual `src/` files beside it. The bundle already contains those functions.
If the project already contains your own code, keep a backup before adding TickerSheets.
Keep the existing files. If TickerSheets is already installed, update its existing file instead of adding a second copy.

The [function reference](FUNCTIONS.md) lists every public function and supported field.
The [build-your-own guide](BUILD-YOUR-OWN.md) gives simple recipes.

## Optional: use CacheFinance alongside TickerSheets

TickerSheets does not include CacheFinance. Get it separately from the [original CacheFinance project](https://github.com/demmings/cachefinance).

1. Keep the TickerSheets bundle in its own `TickerSheets.gs` file.
2. Follow CacheFinance's installation instructions and paste its bundle into a separate `CacheFinance.gs` file in the same spreadsheet's Apps Script project.
3. Save the project and reload the spreadsheet.

Use `TICKERSHEETS_…` for this library and `CACHEFINANCE` / `CACHEFINANCES` for the original library.
TickerSheets' **Refresh data** command leaves CacheFinance formulas unchanged.
Configure CacheFinance through its own instructions. The TickerSheets key form supports Finnhub, Alpha Vantage, Twelve Data, CoinMarketCap and FRED.

Both load orders were checked with a separately downloaded CacheFinance bundle.
Contributors can repeat the check with `npm run check:coexistence -- /path/to/CacheFinance.js`.
The check does not download or bundle CacheFinance with TickerSheets.

If your project already has an `onOpen` function, add `TickerSheetsMenu();` to it and keep only one `onOpen` definition.

## Authorization and refresh

Google can ask for authorization when you open **API keys…** or choose **Refresh data**.
Review the project name and requested permissions.
If a formula reports a permission error, choose **TickerSheets → Refresh data** and complete authorization if prompted.

Custom cell functions cannot open an authorization dialog themselves.
Google describes their limits in its [custom function guide](https://developers.google.com/apps-script/guides/sheets/functions#guidelines_for_custom_functions).
An account or administrator restriction can still block Apps Script or external requests.

Choose **TickerSheets → Refresh data** when you want another result.
Changing a ticker also recalculates formulas that use that cell.
The functions can reuse recent cached provider responses and do not stream continuously.

## Google permissions

The installed script uses these permissions:

| Permission | Purpose |
|---|---|
| `spreadsheets.currentonly` | Read and write the spreadsheet that contains the script |
| `script.container.ui` | Show the TickerSheets menu and API key form |
| `script.external_request` | Request data from the documented providers |

The bundle contains `@OnlyCurrentDoc`.
It does not require a Drive scope or access to every spreadsheet in your account.

For an explicit manifest:

1. Open **Project Settings** in Apps Script.
2. Enable **Show "appsscript.json" manifest file in editor**.
3. Open `appsscript.json`.
4. Replace its contents with [the supplied manifest](apps-script/appsscript.json).
5. Save the project and reload the spreadsheet.

The supplied manifest uses the `America/Los_Angeles` time zone.
The spreadsheet controls displayed timestamps.
Google can show a verification notice for code that you copy into your own Apps Script project.
Google Workspace administrators can also restrict scripts or external requests.

## Save API keys

Yahoo quotes, history, fundamentals, earnings and public options do not require a personal API key in this library.
Finviz, Zacks and GuruFocus field lookups also use public pages without personal keys.
The API key form supports Finnhub, Alpha Vantage, Twelve Data, CoinMarketCap and FRED.
Each keyed provider requires your own key for its requests.

1. Choose **TickerSheets → API keys…**.
2. Enter your own keys in the matching provider fields.
3. Click **Save keys**.
4. Check that the provider shows **Saved**.

Leaving a field blank preserves its saved key.
Selecting **Remove saved key** deletes that provider's key after you click **Save keys**.
The form never puts saved keys back into its input fields.
Configured fields show the gray placeholder **•••••••• — saved key**. Empty fields show **Enter API key**.
These placeholders do not contain the saved key.
**Saved** confirms storage. It does not test the key or provider connection.

The script stores keys in [Script Properties](https://developers.google.com/apps-script/guides/properties), outside worksheet cells.
Script Properties belong to the attached project and are shared by its users.
People who can edit the spreadsheet can access its script and keys.
Keep a copy with personal keys private.
Do not put keys in formulas, worksheet cells, GitHub files or issue reports.

### Quotes from keyed providers

Save the matching key before you enter one of these formulas:

```excel
=TICKERSHEETS_PROVIDER_QUOTE("NVDA","FINNHUB","price")
=TICKERSHEETS_PROVIDER_QUOTE("NVDA","ALPHA_VANTAGE","price")
=TICKERSHEETS_PROVIDER_QUOTE("NVDA","TWELVE_DATA","price")
=TICKERSHEETS_PROVIDER_QUOTE("BTC","COINMARKET","price")
```

Each formula requests the named provider directly.
`TICKERSHEETS_QUOTE` continues to use Yahoo and requires no personal key.
Your provider plan controls symbol access, request limits and quote delays.
See [FUNCTIONS.md](FUNCTIONS.md#tickersheets_provider_quote) for fields and supported symbols.

### FRED

1. Request your own key from [FRED's API key page](https://fred.stlouisfed.org/docs/api/api_key.html).
2. Choose **TickerSheets → API keys…**.
3. Enter the key in **FRED** and click **Save keys**.
4. Enter a FRED formula, such as `=TICKERSHEETS_FRED("DGS10",60)`, in an empty area.

The script stores this key as `FRED_API_KEY`.
A missing key leaves FRED values unavailable.
The script preserves missing economic data as unavailable values.

### If the sidebar is blank

Google documents [Apps Script problems with multiple signed-in accounts](https://developers.google.com/apps-script/guides/support/troubleshooting#issues_with_multiple_google_accounts).
A browser profile signed in only to the spreadsheet's account can resolve this problem.

1. Open a browser profile or private window signed in only to that Google account.
2. Open your private spreadsheet copy there.
3. Choose **TickerSheets → API keys…** again.
4. Enter your keys in the matching provider fields.
5. Click **Save keys**.

All five keyed providers use this same form.

## Updates

The installed code does not update automatically from GitHub.

1. Open **Extensions → Apps Script** in your spreadsheet.
2. Open the file that contains TickerSheets.
3. Replace its contents with the current `dist/TickerSheets.js` contents.
4. Save the project.
5. Reload the spreadsheet.
6. Choose **TickerSheets → Refresh data**.

Do not paste a second bundle beside the old one.
Replacing the code in the same project preserves its saved keys.
Your worksheet formulas remain in their cells.
You can also copy the current public tutorial to get its latest examples.

## Report a problem

Include the exact formula, ticker, expected result, actual result and provider timestamp when available.
Provider pages can block requests, change format or stop supplying fields.
An API key does not automatically unlock subscription data.
The [provider guide](PROVIDERS.md) records tested sources and remaining limits.

Screenshots can contain personal data from other cells.
API keys, cookies and account credentials do not belong in reports.
For a public example, start with a separate spreadsheet and attached project that contain no personal keys.
