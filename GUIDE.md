# Use TickerSheets

[View the public example](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/edit) to inspect its saved results.
Make your own copy to change the ticker, refresh data or save API keys.

## Start with the example spreadsheet

1. Open the [copy link](https://docs.google.com/spreadsheets/d/1HpA7L6hImHHaC7GECxYiBZpMvRiWTcMI5x1o10hDQ24/copy) and click **Make a copy** in your Google account.
2. Open your copy and reload it to show the **TickerSheets** menu.
3. Change the ticker in **Start here!B4**.
4. Choose **TickerSheets → Refresh data**. If Google asks, authorize the script.

Google includes the required Apps Script when it copies the spreadsheet.
The public example is read-only and contains no API keys.
Most stock and options examples work without a personal key.

## Use the example spreadsheet

All three tabs use the ticker in **Start here!B4**:

| Tab | What to do |
|---|---|
| **Start here** | Change the ticker and inspect simple formulas beside their results |
| **Stock analysis** | Review quotes, company financials, earnings, price history and technical indicators |
| **Options analysis** | Review expiration dates and option quotes, then change the model and strategy assumptions |

Click a result to read its formula in the formula bar.
**Start here!C7:C15** also shows the formulas as text.

On **Options analysis**, leave **B8** blank for the nearest available expiration or select a published date.
**B10** shows the expiration returned by the provider.
The displayed chain contains up to 40 calls and 40 puts, with strikes within 20% of regular-session price.

Yellow cells contain editable assumptions for the option model and strategy calculator.
These assumptions remain when you change the ticker.
Review the expiration, strikes, premiums, volatility and days-to-expiry inputs for the new stock.
The model's days-to-expiry input is separate from **B8**.
Model Greeks and strategy results come from these assumptions. Bid, ask and last prices come from the provider.

## Add TickerSheets to an existing spreadsheet

These steps add the functions and menu to a spreadsheet you already use.
You copy one file: **dist/TickerSheets.js**. It contains all the code needed to use TickerSheets.
If TickerSheets is already installed, [update its existing code](#updates).

1. Open your spreadsheet and choose **Extensions → Apps Script**.
2. Click **+ → Script** and name the file `TickerSheets`.
3. Open [dist/TickerSheets.js](https://github.com/dnarain/tickersheets/blob/main/dist/TickerSheets.js) and click **Copy raw file**.
4. Replace the default contents of the new `TickerSheets.gs` file with that code.
5. Save the project and reload your spreadsheet.
6. Enter `NVDA` in `A1` and `=TICKERSHEETS_QUOTE(A1,"price")` in `B1`.
7. Choose **TickerSheets → Refresh data** and complete authorization if prompted.

Keep your existing script files. Add TickerSheets only once.
If an `onOpen` function existed before installation, add `TickerSheetsMenu();` to it and remove `onOpen` from the pasted code.

## Write your own formulas

Put a ticker in `A1`. Enter each formula in a separate empty area:

| Data | Formula |
|---|---|
| Latest available price | `=TICKERSHEETS_QUOTE(A1,"price")` |
| After-hours price | `=TICKERSHEETS_QUOTE(A1,"post_market_price")` |
| Trailing P/E | `=TICKERSHEETS_FUNDAMENTALS(A1,"trailing_pe")` |
| Daily history | `=TICKERSHEETS_HISTORY(A1,252)` |
| Reported earnings | `=TICKERSHEETS_EARNINGS(A1,"earnings")` |
| Option expiration dates | `=TICKERSHEETS_EXPIRATIONS(A1)` |
| Option chain | `=TICKERSHEETS_OPTIONS(A1)` |

Table functions fill neighboring cells. Keep their output areas empty.
Only the upper-left cell contains the function.
For a specific option expiration, put a published date in `D1` and use `=TICKERSHEETS_OPTIONS(A1,D1)`.

After saving a FRED key, try these formulas in separate empty areas:

```excel
=TICKERSHEETS_FRED("DGS10",60)
=TICKERSHEETS_FRED_VALUE("DGS10","2026-11-05")
```

FRED preserves published units. A DGS10 value of `4.25` means `4.25%`, so format it as a number.
Use typed dates or `DATE(...)` in custom-function inputs. Google rejects volatile inputs such as `NOW()`.
See [FUNCTIONS.md](FUNCTIONS.md) for every function, provider, field, argument and unit.

## Save API keys

FRED and quotes from Finnhub, Alpha Vantage, Twelve Data or CoinMarketCap require your own keys.

1. Choose **TickerSheets → API keys…** in your private copy.
2. Enter your keys in the matching provider fields.
3. Click **Save keys**.

Saved fields show **•••••••• — saved key** in gray. Empty fields show **Enter API key**.
Leaving a field blank keeps its saved key.
To delete one, select **Remove saved key** and click **Save keys**.
**Saved** means the key was stored. Run a formula for that provider to check access.

Get a FRED key from [FRED's API key page](https://fred.stlouisfed.org/docs/api/api_key.html).
For an optional Finnhub quote, use `=TICKERSHEETS_PROVIDER_QUOTE(A1,"FINNHUB","price")` after saving its key.
Saving provider keys does not change the source used by `TICKERSHEETS_QUOTE`.

Spreadsheet editors can access the attached script and its keys. Keep copies with keys private.
Keep keys out of worksheet cells, formulas and issue reports.

## Troubleshooting

- **Missing menu:** Reload your editable copy. The public example remains read-only.
- **Permission error:** Choose **TickerSheets → Refresh data** and complete Google's authorization steps.
- **Table overlap error:** Clear the cells where the returned table needs space.
- **Unavailable data:** Read the source status and timestamp. A missing value is different from zero.

Prices do not stream continuously. Provider data can be delayed, cached or unavailable.

### If the sidebar is blank

Open your copy in a browser profile or private window signed in to only one Google account.
Choose **TickerSheets → API keys…** again.
Google documents this [multiple-account issue](https://developers.google.com/apps-script/guides/support/troubleshooting#issues_with_multiple_google_accounts).

## Updates

Installed code does not update automatically from GitHub.

1. Open **Extensions → Apps Script** in your spreadsheet.
2. Open the file that contains TickerSheets.
3. Replace its contents with the current [TickerSheets.js](https://github.com/dnarain/tickersheets/blob/main/dist/TickerSheets.js) code.
4. Save the project and reload the spreadsheet.
5. Choose **TickerSheets → Refresh data**.

Updating the existing script preserves its saved keys and your worksheet formulas.
To get the latest example layout, make a new copy of the example spreadsheet.
