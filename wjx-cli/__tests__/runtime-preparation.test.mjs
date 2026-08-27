import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startFixture } from "./fixtures/http-fixture.mjs";

import {
  normalizeInput,
  mergeInputSources,
} from "../dist/lib/runtime/input.js";
import { buildRequestPlan } from "../dist/lib/runtime/request-plan.js";
import { renderDryRun } from "../dist/lib/runtime/dry-run.js";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = resolve(PACKAGE_ROOT, "dist", "index.js");

test("normalize input receives data-only context and never a network-capable dependency", () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network sentinel");
  };
  try {
    const context = Object.freeze({
      values: { page: "2", page_size: 5 },
      defaults: { page: 1 },
      source: { page: "cli", page_size: "stdin" },
    });
    const normalized = normalizeInput(context);
    assert.deepEqual(normalized.values, { page: "2", page_size: 5 });
    assert.equal("fetch" in context, false);
    assert.equal("sdkFn" in context, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("stdin values are overridden only by explicit CLI values", () => {
  const merged = mergeInputSources(
    { page: 1, page_size: 10, name_like: "from stdin" },
    { page: 2, page_size: 20, name_like: "from cli", status: 1 },
    new Set(["page", "name_like"]),
  );
  assert.deepEqual(merged, {
    page: 2,
    page_size: 10,
    name_like: "from cli",
    status: 1,
  });
});

test("request plan is pure, POST-only, and masks authorization", () => {
  const plan = buildRequestPlan({
    service: "default",
    action: "1001001",
    url: "https://www.wjx.cn/openapi/default.aspx",
    apiKey: "secret-api-key",
    body: { vid: 7, submitdata: "1$yes" },
  });
  assert.equal(plan.method, "POST");
  assert.equal(plan.service, "default");
  assert.equal(plan.action, "1001001");
  assert.equal(plan.headers.Authorization, "Bearer ****");
  assert.deepEqual(JSON.parse(plan.body), { vid: 7, submitdata: "1$yes" });
  assert.equal(typeof plan.fetch, "undefined");
  assert.equal(typeof plan.sdkFn, "undefined");
});

test("submit dry-run emits an unresolved version without fetching survey metadata", async () => {
  const fixture = await startFixture({ env: { WJX_API_KEY: "secret-api-key" } });
  try {
    const result = await fixture.run([
      "response", "submit", "--vid", "7", "--inputcosttime", "3", "--submitdata", "1$yes", "--dry-run",
    ]);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
    assert.equal(fixture.requests().length, 0);
    assert.equal(readFileSync(resolve(PACKAGE_ROOT, "dist/lib/runtime/dry-run.js"), "utf8").includes("fetch("), false);
    assert.match(result.stderr, /dry_run/);
    assert.match(result.stderr, /jpmversion/);
  } finally {
    await fixture.close();
  }
});

test("dry-run renderer keeps plans separate from diagnostics", () => {
  const rendered = renderDryRun([
    buildRequestPlan({ action: "1000002", apiKey: "secret", body: { page_index: 1 } }),
  ]);
  assert.equal(rendered.dry_run, true);
  assert.equal(rendered.plans.length, 1);
  assert.equal(rendered.plans[0].headers.Authorization, "Bearer ****");
});
