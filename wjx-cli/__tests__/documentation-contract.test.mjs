import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "../..");

test("active documentation and AI consumers satisfy the current contract", () => {
  const output = execFileSync(process.execPath, [resolve(root, "scripts", "check-documentation-contract.mjs")], {
    cwd: root,
    encoding: "utf8",
  });
  assert.match(output, /Documentation consumer contract passed/);
});
