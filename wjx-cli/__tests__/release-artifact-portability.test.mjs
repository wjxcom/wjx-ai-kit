import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = resolve(ROOT, "scripts", "check-release-artifacts.mjs");

test("release check invokes tar with relative archive names from the output directory", () => {
  const source = readFileSync(CHECK, "utf8");
  assert.match(source, /execFileSync\("tar", \["-tf", tarballName\], \{ cwd: outputStage/);
  assert.match(source, /execFileSync\("tar", \["-xOf", tarballName, "package\/package\.json"\], \{ cwd: outputStage/);
  assert.doesNotMatch(source, /execFileSync\("tar", \[[^\]]*tarballPath/);
});
