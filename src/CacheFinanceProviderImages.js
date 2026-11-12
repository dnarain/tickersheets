/*  *** DEBUG START ***
import { CFWorkbookNames } from "./CacheFinanceSheetNames.js";
import { CFSmfProviders } from "./CacheFinanceSmfProviders.js";
import { CFAnalysisData } from "./CacheFinanceAnalysisData.js";
export { CFProviderImages, CFLoadProviderImages };
//  *** DEBUG END ***/

/** Provider chart pages open separately. This module makes no requests and copies no charts. */
class CFProviderImages {
    static check(book) {
        CFWorkbookNames.migrate(book);
        const sheet = book.getSheetByName("Chart links");
        if (sheet && sheet.getRange("Z1").getValue() !== "CACHEFINANCE_IMAGES_V1") throw new Error("Rename the existing Chart links tab before building provider chart links.");
    }
    static invalidate(book) {
        CFProviderImages.check(book);
        const sheet = book.getSheetByName("Chart links");
        if (!sheet) return;
        for (const image of sheet.getImages()) image.remove();
        sheet.getRange(3, 1, Math.max(sheet.getLastRow() - 2, 1), 25).clearContent();
        const value = String(book.getSheetByName("Analysis")?.getRange("B4").getValue() || "").trim().toUpperCase();
        sheet.getRange("A1").setValue((/^[=+@-]/.test(value) ? "'" : "") + value + " — provider chart links");
        sheet.getRange("A2").setValue("Ticker changed. Choose Stock analysis → Provider chart links.");
    }
    static load(book, _unusedFetch) {
        CFProviderImages.check(book);
        const main = book.getSheetByName("Analysis");
        if (!main || main.getRange("Z1").getValue() !== "CACHEFINANCE_ANALYSIS_V1") throw new Error("Build the marked stock analysis tabs before adding provider chart links.");
        const input = String(main.getRange("B4").getValue() || "").trim().toUpperCase();
        const symbol = CFAnalysisData.normalizeTicker(input).yahooSymbol;
        const supported = Boolean(CFSmfProviders.buildUrl("FINVIZ", symbol));
        const policyUrl = "https://help.stockcharts.com/learning-more/policies-and-limitations/reprint-permission-policies";
        const results = [
            { provider: "StockCharts", description: "SharpCharts workbench", url: supported ? "https://stockcharts.com/sc3/ui/?s=" + encodeURIComponent(symbol.toLowerCase()) : "",
                status: supported ? "Manual copy required" : "Unsupported ticker", policyUrl,
                instruction: "Open the chart page and copy manually. Keep the copyright notice and add Chart courtesy of StockCharts.com." },
            { provider: "Finviz", description: "Quote page and chart", url: supported ? CFSmfProviders.buildUrl("FINVIZ", symbol) : "",
                status: supported ? "Manual copy required" : "Unsupported ticker", policyUrl: "", instruction: "Open the quote page to view its chart." }
        ];
        let sheet = book.getSheetByName("Chart links");
        if (!sheet) sheet = book.insertSheet("Chart links");
        if (sheet.getMaxColumns() < 26) sheet.insertColumnsAfter(sheet.getMaxColumns(), 26 - sheet.getMaxColumns());
        for (const image of sheet.getImages()) image.remove();
        sheet.getRange(1, 1, sheet.getMaxRows(), 25).breakApart().clear();
        sheet.getRange("Z1").setValue("CACHEFINANCE_IMAGES_V1"); sheet.hideColumns(26);
        sheet.setHiddenGridlines(true); sheet.setFrozenRows(2); sheet.setColumnWidths(1, 12, 115);
        sheet.getRange("A1:L1").merge().setValue(input + " — provider chart links").setFontSize(14).setFontWeight("bold").setFontColor("#17365D");
        sheet.getRange("A2:L2").merge().setValue("Open a provider page to view or manually copy its chart. This sheet downloads no provider images.");
        sheet.getRange("A4:F4").setValues([["Provider", "Chart page", "Status", "Public URL", "Copy instructions", "Policy"]]).setBackground("#17365D").setFontColor("#FFFFFF").setFontWeight("bold");
        sheet.getRange(5, 1, results.length, 6).setValues(results.map(row => [row.provider, row.description, row.status, row.url, row.instruction, row.policyUrl]));
        sheet.getRange("A9:L9").merge().setValue("StockCharts requires manual copying, its visible copyright notice and nearby attribution: Chart courtesy of StockCharts.com.").setWrap(true);
        sheet.getRange("A10").setValue("StockCharts reprint policy"); sheet.getRange("B10").setValue(policyUrl);
        sheet.setColumnWidth(2, 260); sheet.setColumnWidth(3, 190); sheet.setColumnWidth(4, 500); sheet.setColumnWidth(5, 620); sheet.setColumnWidth(6, 500);
        sheet.getRange("E5:E6").setWrap(true);
        return { ok: supported, ticker: input, mode: "manual", status: supported ? "Manual copy required" : "Unsupported ticker", networkRequests: 0, imagesInserted: 0, results };
    }
}
function CFLoadProviderImages() {
    const book = SpreadsheetApp.getActiveSpreadsheet(), lock = LockService.getDocumentLock();
    if (!lock?.tryLock(1000)) { book.toast("Another refresh is running.", "Provider chart links", 8); return { ok: false, error: "Another refresh is running" }; }
    try { const result = CFProviderImages.load(book); console.log("CF_IMAGE_CHECK " + JSON.stringify(result)); return result; }
    finally { lock.releaseLock(); }
}
