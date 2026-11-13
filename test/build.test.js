import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
    buildCacheFinanceBundle,
    enableDebugExports,
    hashSections,
    isCacheFinanceBundleCurrent,
    paths,
    SOURCE_FILES,
    stripDebugBlocks,
    validateBundleContent,
    writeCacheFinanceBundle
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
    it.each(["||=", "&&=", "??="])("rejects %s before upload because Apps Script rejects logical assignment", operator => {
        expect(() => validateBundleContent("function CACHEFINANCE() {}\nfunction CACHEFINANCES() {}\nlet value; value " + operator + " 1;")).toThrow(/logical assignment/);
    });
    it.each(["static firstRow = 8;", "static lastRow\n = 1007;"])("rejects class fields before upload: %s", field => {
        expect(() => validateBundleContent("function CACHEFINANCE() {}\nfunction CACHEFINANCES() {}\nclass Example { " + field + " }")).toThrow(/static class fields/);
    });
    it("accepts static getters supported by the Apps Script editor", () => {
        expect(() => validateBundleContent("function CACHEFINANCE() {}\nfunction CACHEFINANCES() {}\nclass Example { static get firstRow() { return 8; } }")).not.toThrow();
    });
    it("builds a valid Apps Script bundle", () => {
        const { bundle, sourceHash, sectionCount } = buildCacheFinanceBundle();

        expect(sectionCount).toBe(SOURCE_FILES.length);
        expect(paths.dist).toMatch(/\/dist\/TickerSheets\.js$/);
        expect(bundle).toContain("TickerSheets Apps Script bundle.");
        expect(sourceHash).toMatch(/^[a-f0-9]{12}$/);
        expect(bundle).toContain(`Source hash: ${sourceHash}`);
        expect(bundle).toContain("function CACHEFINANCE");
        expect(bundle).toContain("class CacheFinanceUtils");
        expect(bundle).toContain("function CFShowApiKeySettings");
        expect(bundle).toContain("function CFOPTIONMODEL");
        expect(bundle).toContain("function CFBuildAnalysis");
        expect(bundle).toContain("function CFQUOTE");
        expect(bundle).toContain("function CFSTRATEGY");
        expect(bundle).toContain("function CFRefreshWatchlist");
        expect(bundle).toContain("class CFAnalysisVisuals");
        expect(bundle.match(/function onOpen\(/g)).toHaveLength(1);
        expect(() => validateBundleContent(bundle)).not.toThrow();
    });

    it("excludes optional Apps Script test helpers from the bundle", () => {
        const { bundle } = buildCacheFinanceBundle();

        expect(bundle).not.toContain("function testYieldPct");
        expect(bundle).not.toContain("function testCacheFinances");
        expect(bundle).not.toContain("function testUpdateMaster");
    });

    it("writes dist/TickerSheets.js only when content changes", () => {
        const first = writeCacheFinanceBundle();
        const second = writeCacheFinanceBundle();

        expect(fs.existsSync(paths.dist)).toBe(true);
        expect(first.bundle).toBe(second.bundle);
        expect(isCacheFinanceBundleCurrent()).toBe(true);
    });
});
