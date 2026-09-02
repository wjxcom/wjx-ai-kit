import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = resolve(ROOT, "scripts", "check-release-artifacts.mjs");

test("release check installs the tarball and runs the published CLI smoke paths", () => {
  const output = execFileSync(process.execPath, [CHECK], {
    cwd: ROOT,
    encoding: "utf8",
    // npm must install two local tarballs while the full CLI suite may be
    // running other process-isolated tests in parallel.
    timeout: 300_000,
    env: { ...process.env, WJX_CONFIG_PATH: resolve(ROOT, "__release_eval_no_config__") },
  });
  assert.match(output, /installed package smoke passed/);
});
