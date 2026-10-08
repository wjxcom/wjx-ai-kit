import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { cleanGeneratedDirectory } from "../../scripts/clean-generated-directory.mjs";

test("cleanGeneratedDirectory removes only the package dist tree", () => {
  const packageRoot = mkdtempSync(join(tmpdir(), "wjx-clean-dist-"));
  const nested = join(packageRoot, "dist", "nested");
  const retainedFile = join(packageRoot, "keep.txt");
  try {
    mkdirSync(nested, { recursive: true });
    writeFileSync(retainedFile, "keep");
    writeFileSync(join(nested, "output.js"), "generated");

    cleanGeneratedDirectory(packageRoot);

    assert.doesNotThrow(() => cleanGeneratedDirectory(packageRoot));
    assert.equal(existsSync(join(packageRoot, "dist")), false);
    assert.equal(existsSync(retainedFile), true);
  } finally {
    cleanGeneratedDirectory(packageRoot);
    if (existsSync(retainedFile)) unlinkSync(retainedFile);
    rmdirSync(packageRoot);
  }
});
