# Provider repairs: November 11, 2026

We repaired the Google Finance website, Yahoo Finance website and Globe & Mail parsers.
We reran all 51 cases for those three providers from the bound Google Apps Script project.
The 17 HTTP requests bypassed financial caches and fallback providers.

Ten previously missing fields now return values.
Google's invalid-ticker name now returns no value, instead of an HTML fragment.
The one remaining missing provider field is Google's XIC dividend yield.

## Native results

| Provider | Requests | Parsed fields | Invalid-ticker rejections | Missing fields | Unsupported cases |
|---|---:|---:|---:|---:|---:|
| Google Finance website | 6 | 10 | 2 | 1 | 5 |
| Yahoo Finance website | 5 | 12 | 3 | 0 | 0 |
| Globe & Mail | 6 | 15 | 3 | 0 | 0 |
| Total | 17 | 37 | 8 | 1 | 5 |

The selected stocks and ETFs were AAPL, NVDA, RY and XIC.
Google also received USD/CAD; Globe also received the DYN2752 mutual fund.
Each provider received a deliberate invalid ticker.

`PARSED` means that the direct response supplied an accepted field.
We did not independently verify financial accuracy or every ticker that these providers support.

### Google Finance website

Prices now return for AAPL, NVDA, RY, XIC and USD/CAD.
RY's published dividend yield now returns `0.0243`, or 2.43%.
The four company names continue to return.
The invalid ticker supplies neither a price nor a name.

`GoogleWebSiteFinance` reads the requested ticker's embedded JSON quote instead of the obsolete `data-last-price` marker.
It checks the primary page URL and quote identifier.
It reads dividend yield only inside the requested ticker's overview widget.
It rejects conflicting desktop and mobile yield values.
URLs now request English labels with `hl=en`.

Google's fetched XIC page omits dividend yield.
The adapter leaves that field missing so another provider can supply it.
It does not invent a zero or classify the ticker as permanently unsupported.

### Yahoo Finance website

Dividend yields now return for all four selected stocks and ETFs.
Prices and names continue to return, and the invalid ticker remains rejected.

`YahooFinance.parseResponse` checks the requested ticker in the page title.
It reads price from `quote-price` and yield from `quote-statistics`.
It accepts both stock **Forward Dividend & Yield** rows and ETF **Yield** rows.
Unrelated page modules cannot supply a fallback price or yield.

### Globe & Mail

All 15 selected price, name and yield fields return.
The four stocks/ETFs and DYN2752 now have explicit matching quote identifiers.
The report also records the matching quote's `raw.tradeTime`.

`GlobeAndMail.parseResponse` requires the requested primary page URL and matching quote object.
Yield tags must match that quote's outer or raw symbol.
Related quotes cannot supply its price, name, yield or timestamp.

The fetched NVDA page itself reports 0.30%, consistent with the previous `0.003` fraction.
We repaired field selection; we did not establish that this provider-reported number was incorrect.

Yahoo stock rows use forward dividend yield; Globe stock rows use trailing dividend yield.
ETF and mutual-fund rows use their providers' yield or distribution fields.
These labels matter when comparing values across providers.

## Worksheet results and remaining limits

The separate worksheet rerun still has six PASS results and one FAILED result.
The failed formula is `=GOOGLEFINANCE("CURRENCY:USDCAD","price")`, which returns `#N/A`.
The repaired Google website adapter returned USD/CAD directly from Apps Script.
The built-in worksheet function is controlled by Google.

Google and Yahoo HTML quote times remain unknown.
Globe's recorded trade time describes its quote, not the publication time of its yield.
The diagnostics do not establish options, earnings or other SMF functionality.

## Latest combined snapshot

The [latest report](provider-fixes-results.json) contains all 117 cases:

| Status | Cases |
|---|---:|
| `PARSED` | 60 |
| `NEGATIVE_REJECTED` | 10 |
| `MISSING_VALUE` | 1 |
| `UNSUPPORTED_ATTRIBUTE` | 36 |
| `UNSUPPORTED_SYMBOL` | 10 |
| False positive, HTTP/parser error, missing key or pending | 0 |

We reran 51 cases for the three repaired providers.
The other 66 cases carry forward from the earlier combined report.
Their saved response values, statuses and timestamps match that report.
The JSON export redacts endpoint URLs.

Provider-specific reruns reuse the report's original run ID.
The `Retrieved UTC` fields identify the new responses, from 23:03:21 to 23:05:21 UTC.
The sanitized report was exported at 23:05:44 UTC on November 11, 2026.
The [worksheet report](provider-fixes-worksheet.json) records the separate formula checks.

## Code and local checks

- Source commit: `0b3f3307c6dc5f95defa46c54907f030ecbd16b4`.
- Normal bundle source hash: `a4cb2a70ff47`.
- Diagnostic source hash: `db6345b3216d`.
- Diagnostic bundle SHA-256: `96a16e3e30e14b439fdb6e4298269920dc315f3ff055926dab40d1c4c5258d03`.

All 337 local tests passed, including 73 new provider regression cases.
Line coverage was 92.81%; branch coverage was 89.67%.
Both generated-bundle checks and `git diff --check` passed.

The public HTML fixtures retain quote fields and the containers needed to test them.
Tests include unrelated quotes, wrong primary pages, changed markup, missing fields and explicit zero yields.
The parsers use `JSON.parse` and never execute provider scripts.
The diagnostic name validator also rejects HTML fragments.

We installed the generated diagnostic bundle through the Apps Script editor.
We copied the editor contents back and verified exact equality before running the tests.
The normal bundle includes the same parser changes.
API keys remain in the private project's Script Properties.
We added no hosted server or SMF functions.
