#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createManifest } from "./export-manifest.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = createManifest();
const ids = manifest.commands.map((command) => command.id);
if (new Set(ids).size !== ids.length) throw new Error("architecture: duplicate command path in catalog");
for (const command of manifest.commands) if (!command.source && !command.metadata) throw new Error(`architecture: ${command.id} has no metadata`);
for (const file of ["src/lib/runtime/input.ts", "src/lib/runtime/dry-run.ts"]) {
  const source = readFileSync(resolve(root, file), "utf8");
  if (/fetch\s*\(|sdkFn|callWjxApi/.test(source)) throw new Error(`architecture: network call in preparation module ${file}`);
}
for (const file of readdirSync(resolve(root, "src", "commands")).filter((name) => name.endsWith(".ts"))) {
  const source = readFileSync(resolve(root, "src", "commands", file), "utf8");
  if (/\bexecuteCommand\b/.test(source)) {
    throw new Error(`architecture: legacy executeCommand facade remains in ${file}; use runtime executor`);
  }
}
const helperSource = readFileSync(resolve(root, "src", "lib", "command-helpers.ts"), "utf8");
if (/export\s+(?:async\s+)?function\s+executeCommand\b/.test(helperSource)) {
  throw new Error("architecture: command-helpers must not export executeCommand");
}
process.stdout.write(`architecture contract passed (${manifest.commands.length} catalog entries)\n`);
