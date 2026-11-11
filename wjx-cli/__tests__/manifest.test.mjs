import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
test("manifest is deterministic and contains unique command ids", () => {
  const path = resolve(fileURLToPath(new URL("..", import.meta.url)), "manifest", "commands.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const ids = manifest.commands.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, [...ids].sort());
});
