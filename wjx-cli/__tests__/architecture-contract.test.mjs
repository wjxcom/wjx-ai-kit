import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  startFixture,
  close as closeFixture,
  installFetchSentinel,
} from "./fixtures/http-fixture.mjs";
import {
  parseArgs,
  readBaseline,
  writeBaseline,
} from "../scripts/benchmark-startup.mjs";

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

test("fixture subprocesses use the current Node executable and close idempotently", async () => {
  const fixture = await startFixture();
  const tempDir = fixture.tempDir;
  try {
    const result = await fixture.run(["--version"], { env: { PATH: "" } });
    assert.equal(result.exitCode, 0);
  } finally {
    await fixture.close();
    await fixture.close();
  }
  await assert.rejects(() => access(tempDir), /ENOENT/);
});

test("fixture start cleans up when temporary directory setup fails", async () => {
  const missingRoot = join(tmpdir(), `wjx-cli-missing-root-${process.pid}-${Date.now()}`);
  await assert.rejects(
    () => startFixture({ tempRoot: missingRoot }),
    /ENOENT|no such file/i,
  );
  await closeFixture();
});

test("fixture close removes temp files even when server close rejects", async () => {
  const rejectingServerFactory = (handler) => {
    const server = createServer(handler);
    const closeServer = server.close.bind(server);
    server.close = (callback) => closeServer(() => callback(new Error("fixture close failed")));
    return server;
  };
  const fixture = await startFixture({ serverFactory: rejectingServerFactory });
  const tempDir = fixture.tempDir;
  await assert.rejects(() => fixture.close(), /fixture close failed/);
  await assert.rejects(() => access(tempDir), /ENOENT/);
  await assert.rejects(() => fixture.close(), /fixture close failed/);
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
  const baselineBefore = readFileSync(resolve(PACKAGE_ROOT, "perf", "startup-baseline.json"), "utf8");
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
  const baselineAfter = readFileSync(resolve(PACKAGE_ROOT, "perf", "startup-baseline.json"), "utf8");
  assert.equal(baselineAfter, baselineBefore, "--report must not modify the baseline file");
});

test("startup baseline writes preserve metadata and other runner entries", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "wjx-cli-baseline-"));
  const path = join(tempDir, "startup-baseline.json");
  const original = {
    schemaVersion: 1,
    samples: 20,
    discard: 2,
    reviewedBy: "architecture",
    baselines: {
      "other-platform-node20": { deltaP95Ms: 12 },
      default: { deltaP95Ms: 15 },
    },
  };
  const report = {
    key: "win32-x64-node24",
    samples: 1,
    discard: 0,
    deltaP95Ms: 10,
  };
  try {
    await writeFile(path, `${JSON.stringify(original)}\n`);
    const beforeReport = await readFile(path, "utf8");
    await writeBaseline(report, { writeBaseline: false, writeDefault: false }, path);
    assert.equal(await readFile(path, "utf8"), beforeReport, "report-only write must not modify the file");

    await writeBaseline(report, { writeBaseline: true, writeDefault: false }, path);
    const updated = readBaseline(path);
    assert.equal(updated.reviewedBy, "architecture");
    assert.deepEqual(updated.baselines["other-platform-node20"], { deltaP95Ms: 12 });
    assert.deepEqual(updated.baselines.default, { deltaP95Ms: 15 });
    assert.deepEqual(updated.baselines[report.key], report);
    assert.deepEqual(await readdir(tempDir), ["startup-baseline.json"]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("startup benchmark rejects excessive paired samples", () => {
  assert.throws(
    () => parseArgs(["--samples", "1000", "--discard", "1"]),
    /at most|maximum|limit/i,
  );
  assert.throws(
    () => parseArgs(["--samples", "9007199254740992"]),
    /safe integer|too large/i,
  );
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
