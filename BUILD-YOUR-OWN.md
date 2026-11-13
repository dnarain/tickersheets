# Build your own Google Sheets research workbook

These recipes use the TickerSheets functions in your spreadsheet's bound Apps Script project.
You write normal cell formulas after installation.
The formulas require the current bundle, including `CFRSITARGETS` and `CFFREDVALUE`.
The examples use English function names and comma separators.

1. Start with your private template copy or follow [INSTALL.md](INSTALL.md).
2. Complete the initial authorization through the spreadsheet menu.
3. Add your own tabs with the names in this guide.

For a blank spreadsheet, finish **Option 2** in [INSTALL.md](INSTALL.md) before entering these formulas.
That path installs the bundle once and authorizes it through **Stock analysis → Build analysis sheets**.
The custom tabs then use the installed functions without further script changes.
Use the custom names in this guide, including **Company fields** and **Option chain**, to keep them separate from the generated tabs.

The generated analysis tabs keep their own ticker input in **Analysis!B4**.
The custom tabs in this guide read **Setup!B2**.
To share the generated tabs' ticker, enter `='Analysis'!B4` in **Setup!B2**.

## Learn from the sample first

Open **Start here** in the sample and inspect the formula bar for these cells:

| Cell | What you can learn |
|---|---|
| Analysis!B9 | The displayed price references Formulas!B23. |
| Formulas!B23 | `INDEX` and `MATCH` find the price in the existing quote table. |
| Quote data!A7 | One `CFQUOTE(...,"all",...)` formula supplies that table. |
| Price history!I57 | `AVERAGE` calculates SMA50 from the close column. |
| Price history!P22 | A spreadsheet formula calculates Wilder RSI14 from visible average-gain/loss helpers. |

**Formulas** also contains `FORMULATEXT` examples that show the source formulas.
Each source function occupies the top-left cell of its expanded table.
Other cells can reference those results with normal Google Sheets formulas.
This pattern lets several views share one source table.

## 1. Create the controls

Create a tab named **Setup**.
Enter the following labels and values:

| Cell | Label in column A | Value in column B |
|---|---|---|
| B2 | Ticker | `AVGO` |
| B3 | Refresh number | `1` |
| B4 | Option expiration | Leave blank initially |
| B5 | FRED series | `DGS10` |
| B6 | Observation date | `=DATE(2026,11,5)` |

Format **B6** as a date.
Use a typed date or a `DATE(...)` formula for custom-function inputs.
Avoid `TODAY()`, `NOW()` and `RAND()` in their arguments or dependent input cells; Google can leave those functions on `Loading...`.
The sample uses a written date in **Analysis!K4**, which its refresh menu updates.
For an independent refresh control, keep **B3** as a manually entered whole number.
To request new results, change **B3** from `1` to `2`, then to `3` on the next refresh.
To share the sample's refresh control, enter `='Analysis'!E4` in **Setup!B3** instead.

The functions do not continuously stream prices.
After you change the refresh number, the functions request data again.
The provider can return the same published values.
`NOW()` and `RAND()` are not supported refresh arguments.
The analysis refresh menus increment **Analysis!E4**.
Your custom formulas share that refresh when **Setup!B3** references **Analysis!E4**.
**Formulas!E4** and **Watchlist!E4** already reference the shared number.

Each table formula expands into neighboring cells.
Keep its output area empty, and use separate tabs for the data types in this guide.
Before requesting a larger table, add enough empty rows for its header and data.

## 2. Build a quote summary

Create a tab named **Quote**.
Enter this source formula in **D1**:

```excel
=CFQUOTE(Setup!$B$2,"all",Setup!$B$3)
```

Keep **D1:E60** empty for its two-column field table.
Enter `Metric` in **A1** and `Value` in **B1**.
Enter each label in column A and its formula in the matching cell in column B:

| Cell | Label | Formula |
|---|---|---|
| B2 | Selected price | `=IFNA(INDEX($E$2:$E$60,MATCH("price",$D$2:$D$60,0)),"N/A")` |
| B3 | Selected session | `=IFNA(INDEX($E$2:$E$60,MATCH("price_session",$D$2:$D$60,0)),"N/A")` |
| B4 | Selected quote time | `=IFNA(INDEX($E$2:$E$60,MATCH("quote_time",$D$2:$D$60,0)),"N/A")` |
| B5 | Regular-market price | `=IFNA(INDEX($E$2:$E$60,MATCH("regular_price",$D$2:$D$60,0)),"N/A")` |
| B6 | Regular-market time | `=IFNA(INDEX($E$2:$E$60,MATCH("regular_time",$D$2:$D$60,0)),"N/A")` |
| B7 | Pre-market price | `=IFNA(INDEX($E$2:$E$60,MATCH("pre_market_price",$D$2:$D$60,0)),"N/A")` |
| B8 | Pre-market time | `=IFNA(INDEX($E$2:$E$60,MATCH("pre_market_time",$D$2:$D$60,0)),"N/A")` |
| B9 | After-hours price | `=IFNA(INDEX($E$2:$E$60,MATCH("post_market_price",$D$2:$D$60,0)),"N/A")` |
| B10 | After-hours time | `=IFNA(INDEX($E$2:$E$60,MATCH("post_market_time",$D$2:$D$60,0)),"N/A")` |
| B11 | Currency | `=IFNA(INDEX($E$2:$E$60,MATCH("currency",$D$2:$D$60,0)),"N/A")` |
| B12 | Market state | `=IFNA(INDEX($E$2:$E$60,MATCH("market_state",$D$2:$D$60,0)),"N/A")` |

`price_session` identifies the session selected for `price`.
`CFQUOTE` can select an accepted newer pre-market or after-hours quote.
If the extended-session data does not meet its checks, `CFQUOTE` keeps the regular quote.
Extended-session fields can return `N/A`.

The quote timestamp identifies the provider's price observation.
The retrieved timestamp identifies the script's request result.
A recent retrieval does not prove that the provider supplied a recent quote.
The providers can return older quotes for a specific session.
Check each session's timestamp before comparing its price.
A timestamp ending in `Z` identifies UTC.

For a separate provider comparison, create **Quote comparisons** and enter this formula in **A1**:

```excel
=CFQUOTECOMPARE(Setup!$B$2,Setup!$B$3)
```

Keep **A1:J7** empty for the header and six provider/session rows.
Each row retains its own timestamp, currency, yield basis and status.

## 3. Add history and fundamentals

Create a tab named **History**.
Enter this formula in **A1**:

```excel
=CFHISTORY(Setup!$B$2,252,Setup!$B$3)
```

The table has seven columns: Date, Open, High, Low, Close, Adjusted close and Volume.
Rows run from oldest to newest.
The function accepts `1` through `510` daily sessions within approximately two years.
A recent listing can have fewer rows.
The regular-market historical close and a current after-hours quote describe different observations.

Create a tab named **Company fields**.
Enter this formula in **A1**:

```excel
=CFFUNDAMENTALS(Setup!$B$2,"all",Setup!$B$3)
```

Keep columns **A:E** empty for the resulting field table.
The table includes each field's units, currency and source.
For a small summary, enter these labels in column H and formulas in column I:

| Cell | Label in column H | Formula |
|---|---|---|
| I2 | Market cap | `=IFNA(INDEX($B$2:$B$100,MATCH("market_cap",$A$2:$A$100,0)),"N/A")` |
| I3 | Trailing P/E | `=IFNA(INDEX($B$2:$B$100,MATCH("trailing_pe",$A$2:$A$100,0)),"N/A")` |
| I4 | Trailing EPS | `=IFNA(INDEX($B$2:$B$100,MATCH("eps_ttm",$A$2:$A$100,0)),"N/A")` |
| I5 | Dividend yield | `=IFNA(INDEX($B$2:$B$100,MATCH("dividend_yield",$A$2:$A$100,0)),"N/A")` |

Format **I5** as a percentage.
P/E is a ratio, and EPS is currency per share.
Unavailable fields remain `N/A`.

Create a tab named **Reported results** and enter this formula in **A1**:

```excel
=CFEARNINGS(Setup!$B$2,"earnings",Setup!$B$3)
```

Keep columns **A:J** clear for the earnings table.
For financial statements, use a separate tab and change `"earnings"` to `"financials"`.
Other sections are `estimates`, `dividends`, `splits` and `calendar`.
The [function reference](FUNCTIONS.md#cfearnings) lists each section's columns and units.
Keep GAAP and adjusted EPS separate. Compare growth only across consecutive periods with the same basis and currency.

## 4. Choose an option expiration

Create a tab named **Expirations**.
Enter this formula in **A1**:

```excel
=CFEXPIRATIONS(Setup!$B$2,Setup!$B$3)
```

The first row is a header.
The dates start in **A2**.

1. Copy one published date into **Setup!B4**.
2. Create a tab named **Option chain**.
3. Enter the following formula in **'Option chain'!A1**.

```excel
=CFOPTIONS(Setup!$B$2,Setup!$B$4,Setup!$B$3)
```

Keep columns **A:L** clear for the chain.
A blank expiration requests the provider's default published expiration.
After a ticker change, choose the expiration from that ticker's new list.
Some stocks and funds have no supported option chain.

The `IV fraction` column uses fractions: `0.50` means `50%` implied volatility.
Bid, ask and last can differ in freshness and availability.
A missing quote does not become zero.

## 5. Add RSI2 targets

Create a tab named **RSI2**.
Enter this formula in **A1**:

```excel
=CFRSITARGETS(Setup!$B$2,20,80,"all",Setup!$B$3)
```

The output occupies **A1:L2**: one header row and one value row.
The twelve fields cover RSI2, both target prices, quote fields, previous close and previous RSI2.
Bid and ask can remain unavailable while the RSI2 calculations return values.

For individual values, enter these labels in column A and formulas in column B:

| Cell | Label | Formula |
|---|---|---|
| B6 | Current RSI2 | `=A2` |
| B7 | Buy-trigger target | `=B2` |
| B8 | Sell-trigger target | `=C2` |
| B9 | Previous RSI2 | `=L2` |

The `20` and `80` arguments are the low and high RSI trigger levels.
They must be whole numbers from `1` through `99`, with the low trigger less than the high trigger.
RSI2 is an index from `0` to `100`.
Target prices use currency per share.

`CFRSITARGETS` uses the regular-market price and 21 completed prior closes with Wilder RSI2 smoothing.
It excludes the current quote session's daily bar from those prior closes.
The selected after-hours price from `CFQUOTE` can differ from the RSI2 price field.
RSI14 on the generated analysis tab uses a different period.

`CFRSITARGETS` compares each trigger with **previous RSI2** from the last completed prior close.
`CFRSITARGETS` applies these direction limits:

| Field | Direction and availability |
|---|---|
| `buy_target` | At or below the previous close. Available only when the low trigger is less than or equal to previous RSI2. |
| `sell_target` | At or above the previous close. Available only when the high trigger is greater than or equal to previous RSI2. |

If the low trigger exceeds previous RSI2, the buy target remains `N/A`.
If the high trigger is below previous RSI2, the sell target remains `N/A`.
If the calculated target is zero or negative, it remains `N/A`.
A flat prior gain/loss history also leaves both targets unavailable.

## 6. Add FRED observations

Save your own FRED key through **Data settings → API keys…** or **Data settings → Enter FRED key…**.
Keep the key out of cells and formulas.
The script stores saved keys in Script Properties.
Spreadsheet editors can edit its bound script and read those keys.
If the script stores your API keys, keep your copy private.

Create a tab named **FRED History**.
Enter this formula in **A1**:

```excel
=CFFRED(Setup!$B$5,60,Setup!$B$3)
```

The table includes Date, Value, Unit, Series and Source.
The function accepts `1` through `1000` recent observations.
For a monthly series, each observation identifies a month or period.

Create a tab named **FRED Exact**.
Enter `Value on requested date` in **A2** and this formula in **B2**:

```excel
=CFFREDVALUE(Setup!$B$5,Setup!$B$6,Setup!$B$3)
```

You can also specify the date directly:

```excel
=CFFREDVALUE("DGS10",DATE(2026,11,5),Setup!$B$3)
=CFFREDVALUE("DGS10","2026-11-05",Setup!$B$3)
```

`CFFREDVALUE` returns a value only for the exact requested observation date.
A weekend, holiday or absent period can return `N/A`.
It never substitutes an earlier business day's observation.
A published missing observation also returns `N/A`.
A date-valued cell uses the spreadsheet's time zone.
Observation dates identify data periods, which can differ from release dates.

FRED retains its published units.
For DGS10, a value of `4.25` means `4.25%`, so use number formatting instead of percentage formatting.
For UNRATE, `4.2` means `4.2%` unemployment.
A CPI index value is an index level.
The Unit column in **FRED History** provides the series' units.

## 7. Add selected provider fields

Create a tab named **Providers**.
Enter these labels in column A and formulas in column B:

| Cell | Label | Formula |
|---|---|---|
| B2 | Finviz price | `=CFFIELD("FINVIZ",Setup!$B$2,4074,Setup!$B$3)` |
| B3 | Zacks average price target | `=CFFIELD("ZACKS",Setup!$B$2,849,Setup!$B$3)` |
| B4 | GuruFocus forward yield | `=CFFIELD("GURUFOCUS",Setup!$B$2,2727,Setup!$B$3)` |

Format **B4** as a percentage.

Provider fields retain their own source and meaning.
An analyst target and a current price are different values.
Forward and trailing dividend yields also use different bases.
The [function reference](FUNCTIONS.md#cffield) lists the supported fields and units.
The [provider guide](PROVIDERS.md#providers) describes source access and dated test results.

## 8. Read statuses and maintain the workbook

Create a tab named **Status**.
Enter each formula in the listed cell, with the surrounding output area empty:

| Cell | Formula |
|---|---|
| A1 | `=CFDATASTATUS(Setup!$B$2,"quote","",Setup!$B$3)` |
| A5 | `=CFDATASTATUS(Setup!$B$2,"history","",Setup!$B$3)` |
| A9 | `=CFDATASTATUS(Setup!$B$2,"options",Setup!$B$4,Setup!$B$3)` |
| A13 | `=CFDATASTATUS(Setup!$B$2,"provider","FINVIZ",Setup!$B$3)` |

Each status table occupies five columns and two rows.
It shows the status, retrieval time, quote time, cache flag and source.
The generated **Sources** tab reads existing source cells and links to their formulas.
The separate `CFDATASTATUS` formulas can request data when a matching cache entry is absent.

Use these checks before calculations or comparisons:

- Check the selected session and quote timestamp before comparing prices.
- Check the units before formatting yields, FRED rates or option IV.
- Keep explanatory `N/A` results visible instead of converting them to zero.
- Keep each table's output cells empty to prevent `#REF!` overlap errors.
- When you want new requests, change the refresh number manually.
- If the script stores your API keys, keep the spreadsheet private.

The functions can reuse recent public results from the cache.
The functions use a new cache entry after you change the refresh number.
The functions retain provider timestamps, which describe the age of the underlying information.
Google limits cell functions to 30 seconds, so start with a few tables and scalar lookups.
The supplied analysis refresh menu changes the shared refresh number for the generated source formulas.

## 9. Chart the daily close

These ranges assume the 252-session History recipe in section 3, including its header.

1. Select **History!A1:A253**.
2. Choose **Insert → Chart**.
3. Double-click the chart to open its editor.
4. Open **Setup → Data range** and click its range-picker icon.
5. Set the first range to `History!A1:A253`.
6. Click **Add another range**.
7. Enter `History!E1:E253` for the Close column.
8. Click **OK**.
9. Choose **Line chart** under **Chart type**.
10. Enable **Use row 1 as headers**.
11. Check that **Date** is the X-axis and **Close** is the series.

If the table has fewer rows, use its last populated row in both ranges.
If you change the requested session count, update both ranges.
The chart follows the History table after its formulas return new values.
Google's [chart instructions](https://support.google.com/docs/answer/63824?hl=en) describe the range picker and chart editor.

## 10. Add calculations from your own assumptions

Create a separate tab named **Calculators**.
Enter these labels in column A and formulas in column B:

| Cell | Label | Formula | Expected result |
|---|---|---|---|
| B2 | Theoretical call premium per share | `=CFOPTIONMODEL(100,100,30,0.25,0.04,0,"Call","price")` | About `3.02114` |
| B4 | Covered-call maximum position profit | `=CFSTRATEGY("Covered call",100,0,0,110,3,1,100,"2027-01-15","maxProfit")` | `1300` |

The model example assumes a `100` spot price, `100` strike, 30 calendar days and `25%` annual IV.
It also assumes a `4%` continuous annual rate and zero dividend yield.
The formula supplies IV and rate as fractions: `0.25` and `0.04`.
The result is a theoretical premium per share.

The strategy example assumes a `100` stock cost per share, `110` short-call strike and `3` premium per share.
It uses one contract with a 100-share multiplier and the stated expiration date.
The result covers the whole position.
The two zero long-leg arguments are unused for a covered call.

These examples use entered assumptions and do not depend on accepted market quotes or generated calculator seeds.
Changing **Setup!B2** does not change these fixed examples.
For your own calculations, replace the entered assumptions with references to numeric input cells.
Neither function accepts the data-request refresh number.
See [option model arguments](FUNCTIONS.md#cfoptionmodel) and [strategy arguments](FUNCTIONS.md#cfstrategy) for other metrics and limitations.

See [FUNCTIONS.md](FUNCTIONS.md) for every public argument.
