#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const matrixPath = resolve(root, "capabilities", "capability-matrix.json");
const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
const allowedStatuses = new Set(["core-aligned", "intentional-gap", "cli-only"]);
const failures = [];
const rows = Array.isArray(matrix.capabilities) ? matrix.capabilities : [];
const coverage = matrix.coverage && typeof matrix.coverage === "object" ? matrix.coverage : {};

function readCoverage(surface) {
  const entries = coverage[surface];
  if (!Array.isArray(entries)) {
    failures.push(`coverage.${surface} must be an array`);
    return [];
  }
  const seen = new Set();
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || typeof entry.surface !== "string" || !entry.surface.trim()) {
      failures.push(`coverage.${surface}: every entry requires a non-empty surface`);
      return [];
    }
    const name = entry.surface.trim();
    if (seen.has(name)) failures.push(`coverage.${surface}: duplicate surface ${name}`);
    seen.add(name);
    if (typeof entry.reason !== "string" || !entry.reason.trim()) {
      failures.push(`coverage.${surface}.${name}: non-empty reason required`);
    }
    return [name];
  });
}

const explicitCliCoverage = readCoverage("cli");
const explicitMcpCoverage = readCoverage("mcp");

if (matrix.schemaVersion !== 1) failures.push(`unsupported matrix schemaVersion: ${matrix.schemaVersion}`);
const ids = new Set();
for (const row of rows) {
  if (!row || typeof row !== "object") { failures.push("matrix contains a non-object row"); continue; }
  if (!row.id || ids.has(row.id)) failures.push(`duplicate or missing capability id: ${row.id ?? "<missing>"}`);
  ids.add(row.id);
  if (!allowedStatuses.has(row.status)) failures.push(`${row.id}: invalid status ${row.status}`);
  const isGap = row.status === "intentional-gap" || row.status === "cli-only";
  if (isGap && (typeof row.reason !== "string" || !row.reason.trim())) {
    failures.push(`${row.id}: intentional gaps require a non-empty reason`);
  }
  if (row.status === "core-aligned" && (!row.catalog || !row.cli || !row.mcp || !Array.isArray(row.sdk) || row.sdk.length === 0)) {
    failures.push(`${row.id}: core-aligned rows require sdk, catalog, cli and mcp surfaces`);
  }
}

const sdkPath = resolve(root, "wjx-api-sdk", "dist", "index.js");
const cliCatalogPath = resolve(root, "wjx-cli", "dist", "catalog", "catalog.js");
const mcpDistPath = resolve(root, "wjx-mcp-server", "dist");
let sdk;
let cliCatalog;
try { sdk = await import(pathToFileURL(sdkPath)); } catch (error) { failures.push(`unable to load SDK dist: ${error.message}`); }
try { cliCatalog = await import(pathToFileURL(cliCatalogPath)); } catch (error) { failures.push(`unable to load CLI Catalog dist: ${error.message}`); }
const catalogIds = new Set((cliCatalog?.CATALOG ?? []).map((entry) => entry.id));
const catalogCommands = new Map((cliCatalog?.CATALOG ?? []).map((entry) => [entry.id, entry.command]));

function collectFiles(directory) {
  try {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(path) : [path];
    });
  } catch { return []; }
}
const mcpSource = collectFiles(mcpDistPath).filter((file) => file.endsWith(".js"))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
const mcpTools = new Set();
for (const match of mcpSource.matchAll(/registerTool\(\s*["']([^"']+)["']/g)) mcpTools.add(match[1]);

const mappedCatalogIds = new Set(rows.map((row) => row.catalog).filter(Boolean));
const mappedMcpTools = new Set(rows.map((row) => row.mcp).filter(Boolean));
for (const name of explicitCliCoverage) {
  if (mappedCatalogIds.has(name)) failures.push(`coverage.cli.${name}: already mapped by a matrix row`);
  if (!catalogIds.has(name)) failures.push(`coverage.cli.${name}: Catalog entry missing`);
  mappedCatalogIds.add(name);
}
for (const name of explicitMcpCoverage) {
  if (mappedMcpTools.has(name)) failures.push(`coverage.mcp.${name}: already mapped by a matrix row`);
  if (!mcpTools.has(name)) failures.push(`coverage.mcp.${name}: MCP tool missing`);
  mappedMcpTools.add(name);
}
for (const name of catalogIds) {
  if (!mappedCatalogIds.has(name)) failures.push(`Catalog entry is not classified in the matrix: ${name}`);
}
for (const name of mcpTools) {
  if (!mappedMcpTools.has(name)) failures.push(`MCP tool is not classified in the matrix: ${name}`);
}

for (const row of rows) {
  if (Array.isArray(row.sdk)) for (const name of row.sdk) {
    if (!sdk || typeof sdk[name] !== "function") failures.push(`${row.id}: SDK export missing: ${name}`);
  }
  if (row.catalog && !catalogIds.has(row.catalog)) {
    failures.push(`${row.id}: Catalog entry missing: ${row.catalog}`);
  } else if (row.catalog && row.cli) {
    const expectedCommand = row.cli.trim().replace(/\s+/g, ".");
    if (catalogCommands.get(row.catalog) !== expectedCommand) {
      failures.push(`${row.id}: CLI path ${row.cli} does not map to Catalog command ${catalogCommands.get(row.catalog) ?? "<missing>"}`);
    }
  }
  if (row.status === "core-aligned" && row.mcp && !mcpTools.has(row.mcp)) failures.push(`${row.id}: MCP tool missing: ${row.mcp}`);
  if (row.status === "intentional-gap" && row.mcp && !mcpTools.has(row.mcp)) failures.push(`${row.id}: declared MCP tool missing: ${row.mcp}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`capability: ${failure}`);
  process.exit(1);
}
console.log(`capability matrix passed (${rows.length} rows, ${mcpTools.size} MCP tools discovered)`);
