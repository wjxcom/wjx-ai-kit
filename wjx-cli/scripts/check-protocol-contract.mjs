#!/usr/bin/env node
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { scanProtocolConsumers } from "./lib/protocol-scan.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const findings = scanProtocolConsumers(root);
if (findings.length) { for (const finding of findings) console.error(`${finding.file}:${finding.line}: ${finding.reason}`); process.exit(1); }
console.log("protocol contract passed");
