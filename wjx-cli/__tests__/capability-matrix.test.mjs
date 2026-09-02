import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));

test("capability matrix is explicit and passes the repository gate", () => {
  const matrix = JSON.parse(readFileSync(resolve(root, "capabilities", "capability-matrix.json"), "utf8"));
  assert.equal(matrix.schemaVersion, 1);
  assert.ok(matrix.capabilities.some((row) => row.id === "raw.call-api" && row.status === "intentional-gap"));
  assert.ok(matrix.coverage.cli.some((entry) => entry.surface === "completion.fish"));
  assert.ok(matrix.coverage.mcp.some((entry) => entry.surface === "query_contacts"));
  const output = execFileSync(process.execPath, [resolve(root, "scripts", "check-capability-matrix.mjs")], { cwd: root, encoding: "utf8" });
  assert.match(output, /capability matrix passed/);
});
