#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    isTickerSheetsBundleCurrent,
    paths,
    SOURCE_FILES,
    writeTickerSheetsBundle
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
    if (checkOnly) {
        if (isTickerSheetsBundleCurrent()) {
            // skipcq: JS-0002
            console.log(`dist/TickerSheets.js is up to date (${SOURCE_FILES.length} source files)`);
            return;
        }

        console.error("dist/TickerSheets.js is out of date. Run: npm run build");
        process.exit(1);
    }

    const result = writeTickerSheetsBundle();

    if (result.written) {
        // skipcq: JS-0002
        console.log(
            `Built ${paths.dist} (${formatBytes(result.bytes)}, ` +
            `${result.sectionCount} files, hash ${result.sourceHash})`
        );
        return;
    }

    // skipcq: JS-0002
    console.log(
        `dist/TickerSheets.js is up to date (${formatBytes(result.bytes)}, hash ${result.sourceHash})`
    );
}

const scriptPath = path.resolve(fileURLToPath(import.meta.url));

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
    main();
}
