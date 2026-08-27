import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
test("raw api dry-run uses catalog and does not send network", async () => {
  const result = await new Promise((done) => execFile(process.execPath, [resolve(root, "dist/index.js"), "api", "--service", "default", "--action", "1000002", "--params", '{"page_index":1}', "--dry-run"], { cwd: root, env: { ...process.env, WJX_API_KEY: "key", WJX_CONFIG_PATH: resolve(root, "missing") }, encoding: "utf8" }, (error, stdout, stderr) => done({ code: error?.code ?? 0, stdout, stderr })));
  assert.equal(result.code, 0, result.stderr);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.data.kind, "dry-run");
  assert.equal(envelope.data.plans[0].action, "1000002");
  assert.equal(result.stderr, "");
});
