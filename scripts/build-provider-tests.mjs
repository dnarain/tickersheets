#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCacheFinanceBundle, stripDebugBlocks, hashSections } from "./gas-source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = stripDebugBlocks(fs.readFileSync(path.join(root, "src/CacheFinanceProviderTests.js"), "utf8"));
// Provider parsers contain URL/body logging. Diagnostics must never emit those values.
const upstream = buildCacheFinanceBundle().bundle.replace(/\bLogger\.log\(/g, "CFProviderQuietLog(");
const hash = hashSections([upstream, source]);
const result = "/**\n * @OnlyCurrentDoc\n * CacheFinance direct provider diagnostic bundle.\n * Generated from upstream modules and src/CacheFinanceProviderTests.js.\n * Upstream parser logging is suppressed to protect API keys and response bodies.\n * Diagnostic source hash: " + hash + "\n */\n" + upstream + "\n\n" + source + "\n";
const destination = path.join(root, "dist/CacheFinanceProviderTests.js");
if (process.argv.includes("--check")) {
    if (!fs.existsSync(destination) || fs.readFileSync(destination, "utf8") !== result) throw new Error("Provider test bundle is out of date. Run npm run build:provider-tests.");
    console.log("Provider test bundle is up to date: " + hash);
} else {
    fs.writeFileSync(destination, result, "utf8");
    console.log("Built dist/CacheFinanceProviderTests.js: " + hash + " (" + Buffer.byteLength(result) + " bytes)");
}
