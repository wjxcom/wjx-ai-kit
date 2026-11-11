#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "manifest", "commands.json");
const { CATALOG } = await import(pathToFileURL(resolve(root, "dist/catalog/catalog.js")));
const { COMMAND_METADATA } = await import(pathToFileURL(resolve(root, "dist/lib/command-metadata.js")));

export function createManifest() {
  return {
    schemaVersion: 1,
    commands: [...CATALOG].map((entry) => ({ ...entry, metadata: COMMAND_METADATA[entry.command] ?? null }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

const output = `${JSON.stringify(createManifest(), null, 2)}\n`;
if (process.argv.includes("--check")) {
  let current;
  try { current = readFileSync(manifestPath, "utf8"); } catch { process.stderr.write(`manifest missing: ${manifestPath}\n`); process.exit(1); }
  if (current !== output) { process.stderr.write("manifest drift detected; run npm run manifest:export\n"); process.exit(1); }
} else {
  writeFileSync(manifestPath, output, "utf8");
}
