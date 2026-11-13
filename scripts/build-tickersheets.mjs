#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    isTickerSheetsBundleCurrent,
    isDemoGeneratorBundleCurrent,
    paths,
    SOURCE_FILES,
    DEMO_SOURCE_FILES,
    writeTickerSheetsBundle,
    writeDemoGeneratorBundle
} from "./gas-source.mjs";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

/**
 * Format a byte count for CLI output.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
    return `${bytes.toLocaleString()} bytes`;
}

/**
 * Build or verify the Apps Script bundle from source modules.
 */
function main() {
    const outputs = [
        { target: paths.dist, files: SOURCE_FILES, current: isTickerSheetsBundleCurrent, write: writeTickerSheetsBundle },
        { target: paths.demo, files: DEMO_SOURCE_FILES, current: isDemoGeneratorBundleCurrent, write: writeDemoGeneratorBundle }
    ];
    if (checkOnly) {
        let stale = false;
        for (const output of outputs) {
            const name = path.relative(paths.root, output.target);
            if (output.current()) console.log(`${name} is up to date (${output.files.length} source files)`);
            else { console.error(`${name} is out of date. Run: npm run build`); stale = true; }
        }
        if (stale) process.exitCode = 1;
        return;
    }

    for (const output of outputs) {
        const result = output.write(), name = path.relative(paths.root, output.target);
        console.log(`${result.written ? "Built " : "Unchanged "}${name} (${formatBytes(result.bytes)}, ${result.sectionCount} source files, hash ${result.sourceHash})`);
    }
}

const scriptPath = path.resolve(fileURLToPath(import.meta.url));

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
    main();
}
