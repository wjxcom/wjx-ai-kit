import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { test } from "node:test";

const run = promisify(execFile);
const CLI = resolve(import.meta.dirname, "..", "dist", "index.js");
const ENV = { ...process.env, WJX_CONFIG_PATH: resolve(import.meta.dirname, "..", "__dsl_no_config__") };
const DSL = 'wjx-dsl 1; questionnaire { attr "Title" = "CLI 测试"; };';

test("CLI exposes the planned DSL commands", async () => {
  const { stdout } = await run(process.execPath, [CLI, "dsl", "--help"], { env: ENV, encoding: "utf8" });
  assert.match(stdout, /query/);
  assert.match(stdout, /generate/);
  assert.match(stdout, /create/);
  assert.match(stdout, /update/);
});

test("dsl generate validates AI-generated DSL without authentication", async () => {
  const { stdout } = await run(process.execPath, [CLI, "dsl", "generate", "--dsl", DSL], { env: ENV, encoding: "utf8" });
  assert.match(stdout, /wjx-dsl 1/);
  assert.match(stdout, /questionnaire/);
});
