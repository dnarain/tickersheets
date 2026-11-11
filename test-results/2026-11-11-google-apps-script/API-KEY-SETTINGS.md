# API-key settings checks, November 11, 2026

Source commit: `9a55d7329d9aa0a352a09e9a664a06aac63483e9`.
Diagnostic source hash: `8c0cf4f89a02`.
Diagnostic bundle SHA-256: `fc61632fa1a7032678380e5d4f0eb42f9ae42e914bfa13a9b154dd18736d9adf`.

## Local passes

All 255 tests passed. Coverage thresholds and both generated-bundle checks passed.
Line coverage was 91.62%; branch coverage was 88.37%.

The 55 settings tests cover blank-field retention, replacement, explicit removal, validation before writes, script locks and fixed errors.
They check that responses contain only provider IDs, labels and saved/not-set flags.
They also check empty password fields, disabled pending controls and cleared inputs after a successful save.
The tests use synthetic keys. They do not use real credentials or contact providers.

Two menu tests cover the normal and diagnostic bundles.
Fourteen provider logging tests check that request URLs, API keys, response bodies and raw provider errors do not reach the changed log calls.
They also check that requests and parsed values remain unchanged.

## Live passes

- Installed the diagnostic bundle in the existing private Google Sheets test project.
- Copied the editor contents back through the UI and verified exact equality with the committed bundle.
- Saved the manifest with the additional `script.container.ui` permission.
- Authorized the sidebar permission in Google's consent screen.
- Reloaded the spreadsheet and confirmed both **CacheFinance** and **CacheFinance tests** menus.
- Selected **CacheFinance → API keys…** and confirmed that the sidebar container opened.

## Initial sidebar display problem

The sidebar content remained blank. Its iframe contained no rendered body elements.
A temporary sidebar containing only one paragraph also remained blank.
This excludes the settings form's JavaScript and property-status request as the cause of that probe's blank display.

The full committed bundle was restored and saved after the probe.
Editor contents again matched the committed bundle exactly.
No real key was read, entered, replaced or removed during these checks.
No live save was attempted, and no provider tests were rerun.

The browser has multiple signed-in Google accounts.
Google documents [Apps Script problems with multiple signed-in accounts](https://developers.google.com/apps-script/guides/support/troubleshooting#issues_with_multiple_google_accounts).
That is a possible cause.

## User display and blank-save checks

The user reported that the form appears after being asked to open the spreadsheet in a single-account browser session.
This confirms the display check through the user's report.
The browser session available to automation still opens a blank sidebar, so automation has not independently verified that display.

The user then left every key field blank and every removal box unchecked, clicked **Save keys**, and reported a successful save with all four providers still marked **Saved**.
The live display, configured-status and blank-save checks therefore passed through the user's reports.
Automation did not independently observe the save in the working browser session.

Real-key replacement and removal remain deliberately untested in the private project; local tests cover those operations with synthetic values.
