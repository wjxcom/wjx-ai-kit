import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import { replaceTargetsAtomically } from "../dist/lib/install-transaction.js";

test("atomic installation restores earlier targets when a later replacement fails", () => {
  const root = join(tmpdir(), `wjx-install-transaction-${randomUUID()}`);
  const first = join(root, "first");
  const second = join(root, "second");
  mkdirSync(first, { recursive: true });
  writeFileSync(join(first, "content.txt"), "original", "utf8");

  try {
    assert.throws(
      () => replaceTargetsAtomically(root, [
        {
          destination: first,
          stage: (stagingPath) => {
            mkdirSync(stagingPath, { recursive: true });
            const file = join(stagingPath, "content.txt");
            writeFileSync(file, "replacement", "utf8");
            return [file];
          },
        },
        {
          destination: second,
          stage: () => [],
        },
      ]),
      /ENOENT|no such file/i,
    );
    assert.equal(readFileSync(join(first, "content.txt"), "utf8"), "original");
    assert.equal(existsSync(second), false);
    assert.deepEqual(readdirSync(root), ["first"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
