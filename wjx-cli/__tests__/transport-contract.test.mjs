import { test } from "node:test";
import assert from "node:assert/strict";
import { collectPages } from "../dist/lib/runtime/pagination.js";
import { normalizeRetryPolicy } from "../dist/lib/runtime/retry.js";
import { writeAtomic, safeOutputPath } from "../dist/lib/runtime/fileio.js";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("pagination aggregates bounded pages and cancellation is predictable", async () => {
  let calls = 0;
  const result = await collectPages({
    initial: { page_index: 1 },
    fetch: async () => ({ items: [++calls], nextToken: String(calls), complete: calls >= 3 }),
    next: (_page, page) => ({ page_index: calls + 1, next_token: page.nextToken }),
  }, { pageAll: true, pageLimit: 5 });
  assert.deepEqual(result.items, [1, 2, 3]);
  assert.equal(result.meta.complete, true);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => collectPages({ initial: {}, fetch: async () => ({ items: [] }) }, { signal: controller.signal }), /cancelled/i);
});

test("retry and atomic file helpers enforce bounded behavior", () => {
  assert.deepEqual(normalizeRetryPolicy({ retryBudget: 2 }), { retryBudget: 2, maxRetries: 2 });
  assert.throws(() => normalizeRetryPolicy({ retryBudget: 11_000 }), /between/);
  const dir = mkdtempSync(join(tmpdir(), "wjx-transport-"));
  try { const path = join(dir, "out.txt"); writeAtomic(path, "ok"); assert.equal(readFileSync(path, "utf8"), "ok"); assert.throws(() => safeOutputPath("../out.txt", dir), /escapes/); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});
