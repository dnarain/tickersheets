/*  *** DEBUG START ***
export { onOpen };
//  *** DEBUG END ***/

/** Add API-key settings and a refresh command for formulas in any cell layout. */
function onOpen() {
    CFSettingsMenu_();
    if (typeof CFProviderTestMenu_ === "function") CFProviderTestMenu_();
}
