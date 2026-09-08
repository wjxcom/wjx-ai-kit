#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContract } from "./export-agent-contract.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const path = resolve(root, "capabilities/agent-contract.json");
const cliArtifactPath = resolve(root, "wjx-cli", "dist", "capabilities", "agent-contract.json");
const expected = `${JSON.stringify(await createContract(), null, 2)}\n`;
let actual = "";
try { actual = readFileSync(path, "utf8"); } catch { console.error(`agent contract missing: ${path}`); process.exit(1); }
if (actual !== expected) { console.error("agent contract drift detected; run npm run agent-contract:export"); process.exit(1); }
const contract = JSON.parse(actual);
const matrix = JSON.parse(readFileSync(resolve(root, "capabilities/capability-matrix.json"), "utf8"));
const capabilityIds = new Set((matrix.capabilities ?? []).map((row) => row.id));
const capabilityRows = new Map((matrix.capabilities ?? []).map((row) => [row.id, row]));
const failures = [];
let cliArtifact = "";
try { cliArtifact = readFileSync(cliArtifactPath, "utf8"); } catch { failures.push(`CLI packaged agent contract missing: ${cliArtifactPath}`); }
if (cliArtifact && cliArtifact !== actual) failures.push("CLI packaged agent contract differs from root artifact; rerun npm run agent-contract:export");
const matrixMcpTools = new Map();
for (const row of matrix.capabilities ?? []) {
  if (!row.mcp) continue;
  const ids = matrixMcpTools.get(row.mcp) ?? [];
  ids.push(row.id);
  matrixMcpTools.set(row.mcp, ids);
}
function hasSupportedSurface(id) {
  const row = capabilityRows.get(id);
  return Boolean(row && ((typeof row.cli === "string" && row.cli.trim()) || (typeof row.mcp === "string" && row.mcp.trim())));
}
if (!contract.mergeRules || typeof contract.mergeRules !== "object") {
  failures.push("mergeRules are missing; MCP annotation merge policy must be explicit");
} else {
  for (const field of ["scope", "risk", "idempotency", "confirmation"]) {
    if (typeof contract.mergeRules[field] !== "string" || !contract.mergeRules[field].trim()) {
      failures.push(`mergeRules.${field} must be a non-empty description`);
    }
  }
}
if (!contract.mcpAnnotations || typeof contract.mcpAnnotations !== "object" || Array.isArray(contract.mcpAnnotations)) {
  failures.push("mcpAnnotations must be an object generated from MCP listTools()");
}
const mcpAnnotations = contract.mcpAnnotations && typeof contract.mcpAnnotations === "object"
  ? contract.mcpAnnotations
  : {};
for (const [tool, annotations] of Object.entries(mcpAnnotations)) {
  if (!annotations || typeof annotations !== "object" || Array.isArray(annotations)) {
    failures.push(`mcpAnnotations.${tool} must be an object`);
    continue;
  }
  for (const field of ["destructiveHint", "idempotentHint"]) {
    if (typeof annotations[field] !== "boolean") failures.push(`mcpAnnotations.${tool}.${field} must be boolean`);
  }
  if (annotations.openWorldHint !== undefined && typeof annotations.openWorldHint !== "boolean") {
    failures.push(`mcpAnnotations.${tool}.openWorldHint must be boolean when present`);
  }
}
for (const [tool, idsForTool] of matrixMcpTools) {
  if (!Object.prototype.hasOwnProperty.call(mcpAnnotations, tool)) {
    failures.push(`capability matrix MCP tool is absent from contract annotations: ${tool}`);
  }
  idsForTool.sort();
}
const enumSets = {
  risk: new Set(["read", "write", "high-risk-write"]),
  ambiguousTimeout: new Set(["stop-and-report", "read-after-write"]),
};
const ids = new Set();
for (const row of contract.verificationRules ?? []) {
  if (ids.has(row.id)) failures.push(`duplicate verification rule ${row.id}`);
  ids.add(row.id);
  for (const capability of row.capabilityIds ?? []) {
    if (!capabilityIds.has(capability)) failures.push(`${row.id}: unknown capability ${capability}`);
    else if (!hasSupportedSurface(capability)) failures.push(`${row.id}: capability ${capability} has no CLI or MCP surface`);
  }
}
for (const [name, op] of Object.entries(contract.operations ?? {})) {
  if (!enumSets.risk.has(op.risk)) failures.push(`${name}: invalid risk`);
  if (!enumSets.ambiguousTimeout.has(op.ambiguousTimeout)) failures.push(`${name}: invalid ambiguousTimeout`);
  for (const field of ["confirmation", "retry", "preRead", "postVerify", "ambiguousTimeout", "maxBatch"]) if (!(field in op)) failures.push(`${name}: missing ${field}`);
  if (!op.retry || typeof op.retry !== "object") {
    failures.push(`${name}: retry facts must be an object`);
  } else {
    if (!Number.isSafeInteger(op.retry.maxRetries) || op.retry.maxRetries < 0) failures.push(`${name}: invalid retry.maxRetries`);
    if (typeof op.retry.httpRetryable !== "boolean") failures.push(`${name}: retry.httpRetryable must be boolean`);
    if (typeof op.retry.idempotent !== "boolean") failures.push(`${name}: retry.idempotent must be boolean`);
    if (op.retry.httpRetryable && !op.retry.idempotent) failures.push(`${name}: HTTP-retryable operation must be idempotent`);
  }
  for (const capability of op.capabilityIds ?? []) {
    if (!capabilityIds.has(capability)) failures.push(`${name}: unknown capability ${capability}`);
    else if (!hasSupportedSurface(capability)) failures.push(`${name}: capability ${capability} has no CLI or MCP surface`);
  }
  const operationTools = [...new Set((op.capabilityIds ?? [])
    .map((id) => capabilityRows.get(id)?.mcp)
    .filter((tool) => typeof tool === "string" && tool.trim()))].sort();
  const operationMcp = op.mcp;
  if (!operationMcp || typeof operationMcp !== "object" || Array.isArray(operationMcp)) {
    failures.push(`${name}: missing merged MCP annotation facts`);
  } else {
    const declaredTools = Array.isArray(operationMcp.tools) ? [...new Set(operationMcp.tools)].sort() : [];
    if (!Array.isArray(operationMcp.tools) || declaredTools.some((tool) => typeof tool !== "string")) {
      failures.push(`${name}: mcp.tools must be a string array`);
    } else if (JSON.stringify(declaredTools) !== JSON.stringify(operationTools)) {
      failures.push(`${name}: mcp.tools do not match capability matrix mappings`);
    }
    const mappedAnnotations = operationTools.map((tool) => mcpAnnotations[tool]).filter(Boolean);
    const expectedDestructive = mappedAnnotations.some((annotations) => annotations.destructiveHint === true);
    const expectedIdempotent = mappedAnnotations.length === 0 || mappedAnnotations.every((annotations) => annotations.idempotentHint === true);
    if (operationMcp.destructiveHint !== expectedDestructive) failures.push(`${name}: merged destructiveHint drift`);
    if (operationMcp.idempotentHint !== expectedIdempotent) failures.push(`${name}: merged idempotentHint drift`);
    if (expectedDestructive && op.risk !== "high-risk-write") failures.push(`${name}: destructive MCP annotation must promote risk`);
    if (!expectedIdempotent && op.retry?.idempotent !== false) failures.push(`${name}: non-idempotent MCP annotation must disable retries`);
    if (op.consumesQueue && !expectedDestructive) failures.push(`${name}: queue-consuming operation must retain destructive MCP annotation`);
  }
}
if (Object.keys(contract.hostRoutes ?? {}).length !== 4) failures.push("exactly four host routes required");
for (const [host, route] of Object.entries(contract.hostRoutes ?? {})) {
  if (route.protocol !== "runtime-probe") failures.push(`${host}: host routes must use runtime-probe`);
  if (!Array.isArray(route.probe) || route.probe.length !== 3 || !route.probe.includes("mcp-tools") || !route.probe.includes("shell-wjx-version")) failures.push(`${host}: incomplete runtime probe`);
  if (route.selection !== "continue-existing-or-cli-setup-mcp-business") failures.push(`${host}: invalid protocol selection rule`);
}
for (const [intent, idsForIntent] of Object.entries(contract.intentRoutes ?? {})) {
  if (!Array.isArray(idsForIntent) || idsForIntent.some((id) => !capabilityIds.has(id) || !hasSupportedSurface(id))) failures.push(`${intent}: route references unknown or unsupported capability`);
}
if (failures.length) { for (const failure of failures) console.error(`agent-contract: ${failure}`); process.exit(1); }
console.log("agent contract passed");
