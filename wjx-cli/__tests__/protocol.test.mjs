import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = resolve(ROOT, "dist", "index.js");

function run(args) {
  return new Promise((resolveResult) => execFile(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    env: { ...process.env, WJX_CONFIG_PATH: resolve(ROOT, "__missing__"), WJX_API_KEY: "" },
    encoding: "utf8",
  }, (error, stdout, stderr) => resolveResult({ code: error?.code ?? 0, stdout, stderr })));
}

test("default structured output is an ok/data envelope", async () => {
  const result = await run(["survey", "url", "--mode", "create"]);
  assert.equal(result.code, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.ok(parsed.data.url);
});

test("format aliases and record formats preserve data", async () => {
  const json = JSON.parse((await run(["survey", "url", "--format", "json"])).stdout);
  const alias = JSON.parse((await run(["survey", "url", "--json"])).stdout);
  assert.deepEqual(alias.data, json.data);
  const ndjson = (await run(["survey", "url", "--format", "ndjson"])).stdout.trim().split("\n");
  assert.equal(JSON.parse(ndjson[0]).url, json.data.url);
});

test("errors are ProblemEnvelope on stderr and stdout remains empty", async () => {
  const result = await run(["survey", "get"]);
  assert.notEqual(result.code, 0);
  assert.equal(result.stdout, "");
  const parsed = JSON.parse(result.stderr);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.type, "validation");
});
