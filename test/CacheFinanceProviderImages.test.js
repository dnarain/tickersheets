import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CFProviderImages as Images, CFLoadProviderImages } from "../src/CacheFinanceProviderImages.js";
import { ManagedBook } from "./helpers/ManagedSheetMock.js";

let book, main, fetch;
beforeEach(() => {
    book = new ManagedBook();
    const insert = book.insertSheet.bind(book);
    book.insertSheet = name => {
        const sheet = insert(name);
        sheet.legacyImages = [];
        sheet.getImages = vi.fn(() => [...sheet.legacyImages]);
        sheet.insertImage = vi.fn(() => { throw new Error("Provider image insertion is disabled"); });
        return sheet;
    };
    main = book.insertSheet("Analysis");
    main.getRange("Z1").setValue("CACHEFINANCE_ANALYSIS_V1"); main.getRange("B4").setValue("NVDA");
    fetch = vi.fn(() => { throw new Error("Network access must not occur"); });
    vi.stubGlobal("UrlFetchApp", { fetch });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("manual provider chart links", () => {
    it("creates provider-page links without HTTP requests or image insertion", () => {
        const result = Images.load(book, fetch), sheet = book.getSheetByName("Chart links");
        expect(result).toMatchObject({ ok: true, ticker: "NVDA", mode: "manual", status: "Manual copy required", networkRequests: 0, imagesInserted: 0 });
        expect(result.results.map(row => row.url)).toEqual(["https://stockcharts.com/sc3/ui/?s=nvda", "https://finviz.com/quote.ashx?t=NVDA&p=d"]);
        expect(result.results.every(row => row.status === "Manual copy required")).toBe(true);
        expect(fetch).not.toHaveBeenCalled(); expect(sheet.insertImage).not.toHaveBeenCalled();
        expect(sheet.getRange("A1").getValue()).toBe("NVDA — provider chart links");
        expect(sheet.getRange("Z1").getValue()).toBe("CACHEFINANCE_IMAGES_V1");
        expect(sheet.getRange("F5").getValue()).toBe("https://help.stockcharts.com/learning-more/policies-and-limitations/reprint-permission-policies");
        expect(sheet.getRange("A9").getValue()).toMatch(/manual copying.*copyright.*Chart courtesy of StockCharts.com/);
    });
    it("makes no network request when called without an injected service", () => {
        Images.load(book); expect(fetch).not.toHaveBeenCalled();
    });
    it("normalizes US symbols while keeping the exchange-qualified title", () => {
        main.getRange("B4").setValue(" nasdaq:aapl ");
        const result = Images.load(book, fetch);
        expect(result.ticker).toBe("NASDAQ:AAPL");
        expect(result.results[0].url).toBe("https://stockcharts.com/sc3/ui/?s=aapl");
        expect(result.results[1].url).toContain("t=AAPL"); expect(fetch).not.toHaveBeenCalled();
    });
    it.each(["TSE:RY", "RY.TO", "LON:ULVR", "^GSPC"])("marks unsupported ticker %s without guessed links", ticker => {
        main.getRange("B4").setValue(ticker);
        const result = Images.load(book, fetch);
        expect(result).toMatchObject({ ok: false, mode: "manual", status: "Unsupported ticker" });
        expect(result.results.every(row => row.url === "" && row.status === "Unsupported ticker")).toBe(true);
        expect(fetch).not.toHaveBeenCalled();
    });
    it("checks ownership before deleting images or changing cells", () => {
        const sheet = book.insertSheet("Chart links"); sheet.getRange("Z1").setValue("other"); sheet.getRange("A1").setValue("User data");
        expect(() => Images.load(book, fetch)).toThrow(/Rename/);
        expect(sheet.getImages).not.toHaveBeenCalled(); expect(sheet.getRange("A1").getValue()).toBe("User data"); expect(fetch).not.toHaveBeenCalled();
    });
    it("requires marked analysis tabs before creating provider links", () => {
        main.getRange("Z1").setValue("other");
        expect(() => Images.load(book, fetch)).toThrow(/not managed by TickerSheets/);
        expect(book.getSheetByName("Chart links")).toBeNull(); expect(fetch).not.toHaveBeenCalled();
    });
    it("removes legacy pictures and clears their old metadata", () => {
        const sheet = book.insertSheet("Chart links"); sheet.getRange("Z1").setValue("CACHEFINANCE_IMAGES_V1");
        const remove = vi.fn(); sheet.legacyImages.push({ remove }); sheet.getRange("K20").setValue("Old image metadata");
        Images.load(book, fetch);
        expect(remove).toHaveBeenCalledOnce(); expect(sheet.getRange("K20").getValue()).toBe(""); expect(sheet.insertImage).not.toHaveBeenCalled();
    });
    it("clears old links, policy metadata and images after a ticker edit", () => {
        Images.load(book, fetch);
        const sheet = book.getSheetByName("Chart links"), remove = vi.fn(); sheet.legacyImages.push({ remove }); main.getRange("B4").setValue("AAPL");
        Images.invalidate(book);
        expect(remove).toHaveBeenCalledOnce();
        expect(sheet.getRange("D5:F6").getValues().flat().every(value => value === "")).toBe(true);
        expect(sheet.getRange("B10").getValue()).toBe("");
        expect(sheet.getRange("A1").getValue()).toBe("AAPL — provider chart links");
        expect(sheet.getRange("Z1").getValue()).toBe("CACHEFINANCE_IMAGES_V1"); expect(fetch).not.toHaveBeenCalled();
    });
    it("ignores an absent link sheet and rejects unowned invalidation", () => {
        expect(() => Images.invalidate(book)).not.toThrow();
        const sheet = book.insertSheet("Chart links"); sheet.getRange("Z1").setValue("other");
        expect(() => Images.invalidate(book)).toThrow(/Rename/); expect(sheet.getImages).not.toHaveBeenCalled();
    });
    it("rejects unsafe input before creating a provider tab", () => {
        main.getRange("B4").setValue("NVDA?private=value");
        expect(() => Images.load(book, fetch)).toThrow();
        expect(book.getSheetByName("Chart links")).toBeNull(); expect(fetch).not.toHaveBeenCalled();
    });
});
describe("legacy chart-link callback name", () => {
    it("keeps the lock and diagnostic prefix while returning manual mode", () => {
        const releaseLock = vi.fn(), log = vi.spyOn(console, "log").mockImplementation(() => {});
        vi.stubGlobal("SpreadsheetApp", { getActiveSpreadsheet: () => book });
        vi.stubGlobal("LockService", { getDocumentLock: () => ({ tryLock: () => true, releaseLock }) });
        expect(CFLoadProviderImages().mode).toBe("manual");
        expect(releaseLock).toHaveBeenCalledOnce(); expect(log.mock.calls[0][0]).toMatch(/^CF_IMAGE_CHECK /); expect(fetch).not.toHaveBeenCalled();
    });
    it("does not change sheets when another refresh holds the lock", () => {
        vi.stubGlobal("SpreadsheetApp", { getActiveSpreadsheet: () => book });
        vi.stubGlobal("LockService", { getDocumentLock: () => ({ tryLock: () => false }) });
        expect(CFLoadProviderImages().ok).toBe(false); expect(book.getSheetByName("Chart links")).toBeNull(); expect(fetch).not.toHaveBeenCalled();
    });
});
