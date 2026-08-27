import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  startFixture,
  installFetchSentinel,
} from "./fixtures/http-fixture.mjs";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const BENCHMARK = resolve(PACKAGE_ROOT, "scripts", "benchmark-startup.mjs");

test("HTTP fixture records requests and can be closed", async () => {
  const fixture = await startFixture();
  try {
    const response = await fetch(`${fixture.baseUrl}/contract`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contract: true }),
    });

    assert.equal(response.status, 200);
    const [request] = fixture.requests();
    assert.equal(fixture.requests().length, 1);
    assert.equal(request.method, "POST");
    assert.equal(request.path, "/contract");
    assert.equal(request.headers["content-type"], "application/json");
    assert.equal(request.body, JSON.stringify({ contract: true }));
  } finally {
    await fixture.close();
  }
});

test("fetch sentinel throws and restores the original implementation", async () => {
  const originalFetch = globalThis.fetch;
  const restoreFetch = installFetchSentinel();
  try {
    await assert.rejects(
      () => fetch("http://network.invalid/should-not-be-called"),
      /network disabled by architecture contract/,
    );
  } finally {
    restoreFetch();
  }
  assert.equal(globalThis.fetch, originalFetch);
});

test("startup benchmark reports paired node and CLI samples", () => {
  const output = execFileSync("node", [
    BENCHMARK,
    "--samples",
    "1",
    "--discard",
    "0",
    "--report",
  ], { cwd: PACKAGE_ROOT, encoding: "utf8", timeout: 30_000 });
  const report = JSON.parse(output);

  assert.equal(report.samples, 1);
  assert.equal(report.discard, 0);
  assert.equal(typeof report.nodeP95Ms, "number");
  assert.equal(typeof report.cliP95Ms, "number");
  const expectedDeltaP95Ms = Math.round((report.cliP95Ms - report.nodeP95Ms) * 1000) / 1000;
  assert.equal(report.deltaP95Ms, expectedDeltaP95Ms);
  assert.equal(typeof report.nodeVersion, "string");
  assert.equal(typeof report.platform, "string");
  assert.equal(typeof report.arch, "string");
  assert.ok(report.commit === "unknown" || /^[0-9a-f]+$/.test(report.commit));
});

test("startup baseline keeps runner entries under the versioned document", () => {
  const baseline = JSON.parse(readFileSync(resolve(PACKAGE_ROOT, "perf", "startup-baseline.json"), "utf8"));
  assert.equal(baseline.schemaVersion, 1);
  assert.equal(baseline.samples, 20);
  assert.equal(baseline.discard, 2);
  assert.equal(typeof baseline.baselines, "object");
  const currentKey = `${process.platform}-${process.arch}-node${process.versions.node.split(".", 1)[0]}`;
  const selectedBaseline = baseline.baselines[currentKey] ?? baseline.baselines.default;
  assert.ok(selectedBaseline, "baseline must provide an exact runner entry or default fallback");
});

test.todo("runtime commands expose one structured success result protocol");

test.todo("runtime errors are structured JSON on stderr with a stable exit code");

test.todo("unknown commands use the structured error protocol");

test.todo("dry-run performs zero network requests and never calls global fetch");
