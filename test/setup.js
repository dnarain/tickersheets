import { beforeEach } from "vitest";
import { CacheService, PropertiesService, SpreadsheetApp, UrlFetchApp } from "./helpers/AppsScriptServices.js";

globalThis.CacheService = CacheService;
globalThis.PropertiesService = PropertiesService;
globalThis.UrlFetchApp = UrlFetchApp;
globalThis.SpreadsheetApp = SpreadsheetApp;
globalThis.Logger = {
    log(_message) {
        return;
    }
};

beforeEach(() => {
    CacheService.reset();
    PropertiesService.reset();
    UrlFetchApp.reset();
});
