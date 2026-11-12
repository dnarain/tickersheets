/*  *** DEBUG START ***
export { onOpen, onEdit };
//  *** DEBUG END ***/

/** Add the TickerSheets menus and optional provider diagnostics. */
function onOpen() {
    CFSettingsMenu_();
    if (typeof CFAnalysisMenu_ === "function") CFAnalysisMenu_();
    if (typeof CFProviderTestMenu_ === "function") CFProviderTestMenu_();
}

function onEdit(event) {
    if (typeof CFAnalysisHandleEdit_ === "function") CFAnalysisHandleEdit_(event);
}
