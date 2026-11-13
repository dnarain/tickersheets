import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
    buildTickerSheetsBundle,
    enableDebugExports,
    hashSections,
    isTickerSheetsBundleCurrent,
    paths,
    PUBLIC_FUNCTIONS,
    SOURCE_FILES,
    stripDebugBlocks,
    validateBundleContent,
    writeTickerSheetsBundle
} from "../scripts/gas-source.mjs";

describe("gas-source transforms", () => {
    it("removes DEBUG blocks from source files", () => {
        const source = `/*  *** DEBUG START ***
// import { Foo } from "./Foo.js";
// export { Bar };
//  *** DEBUG END ***/

class Bar {}`;

        expect(stripDebugBlocks(source)).toBe("class Bar {}");
    });

    it("uncomments DEBUG exports for Node tests", () => {
        const source = `/*  *** DEBUG START ***
//  Remove comments for testing in NODE
// export { Widget };
//  *** DEBUG END ***/

class Widget {}`;

        const transformed = enableDebugExports(source);
        expect(transformed).toContain("export { Widget };");
        expect(transformed).toContain("class Widget {}");
    });

    it("creates stable hashes for unchanged source sections", () => {
        const sections = ["class A {}", "class B {}"];
        expect(hashSections(sections)).toBe(hashSections([...sections]));
    });
});

describe("TickerSheets bundle", () => {
    const valid = PUBLIC_FUNCTIONS.map(name => "function " + name + "() {}").join("\n");
    it.each(["||=", "&&=", "??="])("rejects %s before upload because Apps Script rejects logical assignment", operator => {
        expect(() => validateBundleContent(valid + "\nlet value; value " + operator + " 1;")).toThrow(/logical assignment/);
    });
    it.each(["static firstRow = 8;", "static lastRow\n = 1007;"])("rejects class fields before upload: %s", field => {
        expect(() => validateBundleContent(valid + "\nclass Example { " + field + " }")).toThrow(/static class fields/);
    });
    it("accepts static getters supported by the Apps Script editor", () => {
        expect(() => validateBundleContent(valid + "\nclass Example { static get firstRow() { return 8; } }")).not.toThrow();
    });
    it("builds a valid Apps Script bundle", () => {
        const { bundle, sourceHash, sectionCount } = buildTickerSheetsBundle();

        expect(sectionCount).toBe(SOURCE_FILES.length);
        expect(paths.dist).toMatch(/\/dist\/TickerSheets\.js$/);
        expect(bundle).toContain("TickerSheets Apps Script bundle.");
        expect(sourceHash).toMatch(/^[a-f0-9]{12}$/);
        expect(bundle).toContain(`Source hash: ${sourceHash}`);
        expect(bundle).not.toMatch(/\b(?:CacheFinance|CACHEFINANCES?|CFQUOTE|CFHISTORY|StockAttributes|ThirdPartyFinance|GoogleWebSiteFinance|GlobeAndMail)\b/);
        expect(bundle).toContain("function TickerSheetsShowApiKeys");
        expect(bundle).toContain("function TICKERSHEETS_OPTION_MODEL");
        expect(bundle).toContain("function TickerSheetsBuildDemo");
        expect(bundle).toContain("function TICKERSHEETS_QUOTE");
        expect(bundle).toContain("function TICKERSHEETS_STRATEGY");
        expect(bundle).toContain("function TickerSheetsRefreshData");
        for (const name of PUBLIC_FUNCTIONS) expect(bundle).toContain("function " + name + "(");
        expect(bundle.match(/function onOpen\(/g)).toHaveLength(1);
        expect(() => validateBundleContent(bundle)).not.toThrow();
    });

    it("excludes optional Apps Script test helpers from the bundle", () => {
        const { bundle } = buildTickerSheetsBundle();

        expect(bundle).not.toContain("function testYieldPct");
        expect(bundle).not.toContain("function testCacheFinances");
        expect(bundle).not.toContain("function testUpdateMaster");
    });

    it("writes dist/TickerSheets.js only when content changes", () => {
        const first = writeTickerSheetsBundle();
        const second = writeTickerSheetsBundle();

        expect(fs.existsSync(paths.dist)).toBe(true);
        expect(first.bundle).toBe(second.bundle);
        expect(isTickerSheetsBundleCurrent()).toBe(true);
    });
});
