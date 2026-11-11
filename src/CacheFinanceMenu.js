/*  *** DEBUG START ***
export { onOpen };
//  *** DEBUG END ***/

/** Add settings to the normal bundle and diagnostics when installed. */
function onOpen() {
    CFSettingsMenu_();
    if (typeof CFProviderTestMenu_ === "function") CFProviderTestMenu_();
}
