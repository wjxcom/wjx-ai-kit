import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMMAND_METADATA, getAgentExecutionFacts } from "../dist/lib/command-metadata.js";

const root = resolve(import.meta.dirname, "../.. ".trim());
const contractPath = resolve(root, "capabilities/agent-contract.json");

test("generated agent contract exposes the complete execution protocol", () => {
  const contract = JSON.parse(readFileSync(contractPath, "utf8"));
  for (const key of ["schemaVersion", "generatedFrom", "intentRoutes", "operations", "hostRoutes", "verificationRules", "stopConditions"]) {
    assert.ok(key in contract, `missing ${key}`);
  }
  for (const operation of ["read", "create", "submit", "modify", "update-settings", "publish/status", "delete", "clear", "realtime", "async-download", "shortlink"]) {
    const row = contract.operations[operation];
    assert.ok(row, `missing operation ${operation}`);
    for (const field of ["risk", "confirmation", "retry", "preRead", "postVerify", "ambiguousTimeout", "maxBatch"]) {
      assert.ok(field in row, `${operation} missing ${field}`);
    }
  }
  assert.deepEqual(Object.keys(contract.hostRoutes).sort(), ["codex-work", "cowork", "qianwen-work", "workbuddy"]);
  for (const route of Object.values(contract.hostRoutes)) {
    assert.equal(route.protocol, "runtime-probe");
    assert.deepEqual(route.probe, ["mcp-tools", "mcp-resources", "shell-wjx-version"]);
    assert.equal(route.selection, "continue-existing-or-cli-setup-mcp-business");
  }
  assert.deepEqual(contract.intentRoutes.setup, ["cli.init", "cli.diagnostics", "cli.schema-reference"]);
});

test("generated retry facts are endpoint-specific and fail closed by default", () => {
  const { operations } = JSON.parse(readFileSync(contractPath, "utf8"));
  assert.deepEqual(operations.realtime.retry, {
    maxRetries: 0,
    httpRetryable: false,
    idempotent: false,
  });
  assert.equal(operations.realtime.ambiguousTimeout, "stop-and-report");
  assert.deepEqual(operations["async-download"].retry, {
    maxRetries: 0,
    httpRetryable: false,
    idempotent: false,
  });
  assert.equal(operations["async-download"].ambiguousTimeout, "stop-and-report");
  assert.equal(operations.report.ambiguousTimeout, "stop-and-report");
  assert.equal(operations["360-report"].ambiguousTimeout, "stop-and-report");
});

test("verification facts describe the implemented CLI lifecycle", () => {
  const { operations } = JSON.parse(readFileSync(contractPath, "utf8"));
  assert.equal(operations.create.preRead, false);
  assert.equal(operations.create.postVerify, true);
  assert.equal(operations.create.ambiguousTimeout, "stop-and-report");
  assert.equal(operations.submit.preRead, true);
  assert.equal(operations.submit.postVerify, false);
  assert.equal(operations.submit.ambiguousTimeout, "stop-and-report");
  assert.equal(operations.modify.risk, "high-risk-write");
  assert.equal(operations.modify.confirmation, "required");
  assert.deepEqual(operations.modify.retry, {
    maxRetries: 0,
    httpRetryable: false,
    idempotent: false,
  });
  assert.equal(operations.modify.preRead, true);
  assert.equal(operations.modify.postVerify, true);
  assert.equal(operations.modify.ambiguousTimeout, "stop-and-report");
  assert.equal(operations["publish/status"].preRead, true);
  assert.equal(operations["publish/status"].postVerify, true);
  assert.equal(operations["publish/status"].ambiguousTimeout, "stop-and-report");
  assert.deepEqual(operations.shortlink.retry, {
    maxRetries: 0,
    httpRetryable: false,
    idempotent: true,
  });
  assert.equal(operations.shortlink.confirmation, "not-required");
  // Short-link generation is a read-only request with no post-state that can
  // prove an ambiguous response. The Agent must stop and report instead of
  // describing a write verification flow that does not exist.
  assert.equal(operations.shortlink.ambiguousTimeout, "stop-and-report");
  assert.deepEqual(JSON.parse(readFileSync(contractPath, "utf8")).intentRoutes.publish, [
    "survey.status",
    "survey.url",
    "survey.preview-url",
    "survey.shortlink",
  ]);
  assert.deepEqual(JSON.parse(readFileSync(contractPath, "utf8")).intentRoutes.admin, [
    "survey.delete",
    "survey.update-settings",
    "response.modify",
    "response.clear",
    "survey.clear-bin",
  ]);
});

test("MCP listTools annotations are present and merged fail-closed", () => {
  const contract = JSON.parse(readFileSync(contractPath, "utf8"));
  assert.ok(contract.generatedFrom.includes("wjx-mcp-server/src/modules/response/tools.ts"));
  assert.match(contract.mergeRules.scope, /Agent contract safety policy/i);
  assert.match(contract.mergeRules.scope, /does not change CLI metadata or exit codes/i);
  assert.match(contract.mergeRules.idempotency, /false/i);

  const matrix = JSON.parse(readFileSync(resolve(root, "capabilities/capability-matrix.json"), "utf8"));
  for (const row of matrix.capabilities) {
    if (row.mcp) assert.ok(contract.mcpAnnotations[row.mcp], `${row.id} is missing MCP annotation facts`);
  }
  const rowsById = new Map(matrix.capabilities.map((row) => [row.id, row]));
  for (const [name, operation] of Object.entries(contract.operations)) {
    const expectedTools = [...new Set(operation.capabilityIds
      .map((id) => rowsById.get(id)?.mcp)
      .filter((tool) => typeof tool === "string"))].sort();
    assert.deepEqual(operation.mcp.tools, expectedTools, `${name} MCP mapping drifted from capability matrix`);
  }

  const realtime = contract.operations.realtime;
  assert.deepEqual(realtime.mcp, {
    tools: ["query_responses_realtime"],
    destructiveHint: true,
    idempotentHint: false,
  });
  assert.equal(realtime.risk, "high-risk-write");
  assert.equal(realtime.confirmation, "required");
  assert.equal(realtime.retry.idempotent, false);
  assert.equal(
    readFileSync(resolve(root, "wjx-cli", "dist", "capabilities", "agent-contract.json"), "utf8"),
    readFileSync(contractPath, "utf8"),
    "CLI packaged contract must match the generated root artifact",
  );
});

test("local analytics metadata declares replay-safe execution explicitly", () => {
  for (const id of [
    "analytics.decode",
    "analytics.nps",
    "analytics.csat",
    "analytics.anomalies",
    "analytics.compare",
    "analytics.decode-push",
  ]) {
    const facts = getAgentExecutionFacts(COMMAND_METADATA[id]);
    assert.equal(facts.httpRetryable, false, id);
    assert.equal(facts.idempotent, true, id);
  }
});
