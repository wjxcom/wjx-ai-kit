import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { test } from "node:test";

const execFileAsync = promisify(execFile);
const CLI = resolve(import.meta.dirname, "..", "dist", "index.js");

async function runHelp(args) {
  return execFileAsync(process.execPath, [CLI, ...args, "--help"], {
    env: { ...process.env, WJX_CONFIG_PATH: resolve(import.meta.dirname, "..", "__surface_no_config__") },
    encoding: "utf8",
  });
}

test("CLI exposes only survey create", async () => {
  const { stdout } = await runHelp(["survey"]);
  assert.match(stdout, /create\s+\[options\]/);
  assert.doesNotMatch(stdout, /create-by-text/);
  assert.doesNotMatch(stdout, /create-by-json/);
});
