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
import { Command } from "commander";
import { executeRuntimeAction } from "../dist/lib/runtime/executor.js";
import { executeRuntimeCommand } from "../dist/lib/runtime/executor.js";
import { createRuntimeContext } from "../dist/lib/runtime/context.js";
import { createCapturingFetch, printDryRunPreview } from "../dist/lib/command-helpers.js";
import { WjxAmbiguousOutcomeError } from "wjx-api-sdk";

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

test("request plan keeps raw body data for execution and redacts only dry-run rendering", () => {
  const plan = buildRequestPlan({
    action: "1001001",
    body: { submitdata: "secret-answer", apiKey: "secret-api-key" },
  });
  assert.deepEqual(JSON.parse(plan.body), {
    submitdata: "secret-answer",
    apiKey: "secret-api-key",
  });

  const rendered = renderDryRun([plan]);
  assert.deepEqual(JSON.parse(rendered.plans[0].body), {
    submitdata: "secret-answer",
    apiKey: "****",
  });
});

test("captured requests stay raw until printDryRunPreview renders them", async () => {
  const { fetchImpl, getCapturedRequest } = createCapturingFetch();
  await fetchImpl("https://example.test/openapi/default.aspx", {
    method: "POST",
    headers: { Authorization: "Bearer raw-secret" },
    body: JSON.stringify({ apiKey: "raw-secret", answer: "keep-me" }),
  });
  const captured = getCapturedRequest();
  assert.equal(captured?.body, JSON.stringify({ apiKey: "raw-secret", answer: "keep-me" }));

  // The public renderer remains the only boundary that emits a masked body.
  const originalWrite = process.stdout.write;
  let output = "";
  process.stdout.write = ((chunk) => { output += String(chunk); return true; });
  try {
    printDryRunPreview(captured);
  } finally {
    process.stdout.write = originalWrite;
  }
  const rendered = JSON.parse(output).data.plans[0];
  assert.doesNotMatch(JSON.stringify(rendered), /raw-secret/);
  assert.deepEqual(JSON.parse(rendered.body), {
    apiKey: "****",
    answer: "keep-me",
  });
});

test("submit dry-run emits an unresolved version without fetching survey metadata", async () => {
  const fixture = await startFixture({ env: { WJX_API_KEY: "secret-api-key" } });
  try {
    const result = await fixture.run([
      "response", "submit", "--vid", "7", "--inputcosttime", "3", "--submitdata", "1$yes", "--dry-run",
    ]);
    assert.equal(result.exitCode, 0);
    const envelope = JSON.parse(result.stdout);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.kind, "dry-run");
    assert.equal(envelope.data.plans.length, 1);
    assert.equal(fixture.requests().length, 0);
    assert.equal(readFileSync(resolve(PACKAGE_ROOT, "dist/lib/runtime/dry-run.js"), "utf8").includes("fetch("), false);
    assert.equal(result.stderr, "");
    assert.deepEqual(envelope.data.plans[0].unresolved, ["jpmversion"]);
  } finally {
    await fixture.close();
  }
});

test("runtime dry-run does not require credentials", async () => {
  const fixture = await startFixture();
  try {
    const result = await fixture.run(["survey", "list", "--dry-run"]);
    assert.equal(result.exitCode, 0);
    const envelope = JSON.parse(result.stdout);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.kind, "dry-run");
    assert.equal(fixture.requests().length, 0);
    assert.equal(result.stderr, "");
  } finally {
    await fixture.close();
  }
});

test("single-request create shortcuts share credential-free dry-run", async () => {
  const fixture = await startFixture();
  try {
    const jsonl = [
      JSON.stringify({ qtype: "问卷基础信息", title: "测试问卷" }),
      JSON.stringify({ qtype: "单选", title: "性别", select: ["男", "女"] }),
    ].join("\n");
    const result = await fixture.run(["survey", "create", "--jsonl", jsonl, "--dry-run"]);
    assert.equal(result.exitCode, 0);
    const envelope = JSON.parse(result.stdout);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.kind, "dry-run");
    assert.equal(fixture.requests().length, 0);
    assert.equal(result.stderr, "");
  } finally {
    await fixture.close();
  }
});

test("runtime action dry-run does not require credentials", async () => {
  const fixture = await startFixture();
  try {
    const result = await fixture.run(["survey", "get", "--vid", "7", "--dry-run"]);
    assert.equal(result.exitCode, 0);
    const envelope = JSON.parse(result.stdout);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.kind, "dry-run");
    assert.equal(fixture.requests().length, 0);
    assert.equal(result.stderr, "");
  } finally {
    await fixture.close();
  }
});

test("runtime action skips execution-only input transforms during dry-run", async () => {
  const program = new Command("wjx");
  program.option("--dry-run").option("--api-key <apiKey>");
  program.setOptionValue("dryRun", true);
  program.setOptionValue("apiKey", "test-key");
  const command = program.command("probe");
  command.setOptionValue("value", "original");
  let transformCalled = false;

  await executeRuntimeAction(
    program,
    command,
    async (input) => ({ result: true, data: input }),
    (merged) => ({ value: merged.value }),
    {
      transformInput: async () => {
        transformCalled = true;
        throw new Error("network prefetch must not run in dry-run");
      },
    },
  );

  assert.equal(transformCalled, false);
});

test("runtime context forwards transport options only to execute", async () => {
  const program = new Command("wjx");
  program.option("--api-key <apiKey>");
  program.setOptionValue("apiKey", "test-key");
  const command = program.command("probe");
  let received;

  await executeRuntimeCommand(program, command, {
    buildPlans: () => [],
    execute: async (_input, _credentials, requestOptions) => {
      received = requestOptions;
      return { result: true, data: { ok: true } };
    },
    context: createRuntimeContext({ requestOptions: { retryBudget: 0, timeoutMs: 1234 } }),
  });

  assert.deepEqual(received, { retryBudget: 0, timeoutMs: 1234 });
});

test("runtime command carries pre-read state through preparation and post-verification", async () => {
  const program = new Command("wjx");
  program.option("--yes");
  program.setOptionValue("yes", true);
  const command = program.command("probe");
  const calls = [];
  const originalWrite = process.stdout.write;
  let output = "";
  process.stdout.write = ((chunk) => { output += String(chunk); return true; });
  try {
    await executeRuntimeCommand(program, command, {
      buildPlans: () => [],
      context: createRuntimeContext({ credentials: { apiKey: "test-key" } }),
      preRead: async () => {
        calls.push("pre-read");
        return { version: 7 };
      },
      prepareExecute: async (input, _credentials, _requestOptions, snapshot) => {
        calls.push(["prepare", snapshot]);
        return { ...input, version: snapshot.version };
      },
      execute: async (input) => {
        calls.push(["execute", input]);
        return { result: true, data: { accepted: true } };
      },
      requiredVerification: ["structure", "status"],
      postVerify: async (_result, _input, _credentials, snapshot) => {
        calls.push(["verify", snapshot]);
        return {
          outcome: "verified",
          verification: { structure: snapshot.version === 7, status: true, link: false },
          warnings: [],
        };
      },
    });
  } finally {
    process.stdout.write = originalWrite;
    process.exitCode = 0;
  }

  assert.deepEqual(calls, [
    "pre-read",
    ["prepare", { version: 7 }],
    ["execute", { version: 7 }],
    ["verify", { version: 7 }],
  ]);
  const envelope = JSON.parse(output.trim());
  assert.equal(envelope.ok, true);
  assert.equal(envelope.data.accepted, true);
  assert.equal(envelope.data.outcome, "verified");
  assert.equal(envelope.data.verification.structure, true);
});

test("runtime context credentials override ambient credential lookup", async () => {
  const program = new Command("wjx");
  const command = program.command("probe");
  let received;
  const previousApiKey = process.env.WJX_API_KEY;
  process.env.WJX_API_KEY = "ambient-key";

  try {
    await executeRuntimeCommand(program, command, {
      buildPlans: () => [],
      execute: async (_input, credentials) => {
        received = credentials;
        return { result: true, data: { ok: true } };
      },
      context: createRuntimeContext({ credentials: { apiKey: "context-key" } }),
    });
  } finally {
    if (previousApiKey === undefined) delete process.env.WJX_API_KEY;
    else process.env.WJX_API_KEY = previousApiKey;
  }

  assert.deepEqual(received, { apiKey: "context-key" });
});

test("runtime action forwards context credentials and transport options to SDK functions that support them", async () => {
  const program = new Command("wjx");
  program.option("--api-key <apiKey>");
  const command = program.command("probe");
  let received;
  const previousApiKey = process.env.WJX_API_KEY;
  process.env.WJX_API_KEY = "ambient-key";
  const context = createRuntimeContext({
    credentials: { apiKey: "context-key" },
    requestOptions: { retryBudget: 0, timeoutMs: 1234 },
  });

  try {
    await executeRuntimeAction(
      program,
      command,
      async (...args) => {
        received = args;
        return { result: true, data: { ok: true } };
      },
      () => ({}),
      { context },
    );
  } finally {
    if (previousApiKey === undefined) delete process.env.WJX_API_KEY;
    else process.env.WJX_API_KEY = previousApiKey;
  }

  assert.deepEqual(received[1], { apiKey: "context-key" });
  assert.deepEqual(received[3], { retryBudget: 0, timeoutMs: 1234 });
});

test("runtime action carries a pre-read snapshot into preparation and post-verification", async () => {
  const program = new Command("wjx");
  program.option("--yes");
  program.setOptionValue("yes", true);
  const command = program.command("probe");
  let seen;
  let output = "";
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk) => {
    output += String(chunk);
    return true;
  });
  try {
    await executeRuntimeAction(
      program,
      command,
      async (input) => {
        seen = { input };
        return { result: true, data: { accepted: true } };
      },
      () => ({ value: "requested" }),
      {
        context: createRuntimeContext({ credentials: { apiKey: "test-key" } }),
        preRead: async () => ({ existing: "before" }),
        transformInput: async (input, _credentials, _requestOptions, snapshot) => ({
          ...input,
          preserved: snapshot.existing,
        }),
        postVerify: async (_result, _input, _credentials, snapshot) => ({
          verification: { structure: snapshot.existing === "before", status: true, link: true },
        }),
      },
    );
  } finally {
    process.stdout.write = originalWrite;
  }
  assert.deepEqual(seen.input, { value: "requested", preserved: "before" });
  const envelope = JSON.parse(output.trim());
  assert.equal(envelope.ok, true);
  assert.equal(envelope.data.verification.structure, true);
});

test("ambiguous writes attempt one read-after-write verification and preserve unknown outcome", async () => {
  const program = new Command("wjx");
  program.option("--yes");
  program.setOptionValue("yes", true);
  const command = program.command("probe");
  let verificationCalls = 0;
  let stderr = "";
  const originalWrite = process.stderr.write;
  process.stderr.write = ((chunk) => { stderr += String(chunk); return true; });
  try {
    await executeRuntimeAction(
      program,
      command,
      async () => {
        throw new WjxAmbiguousOutcomeError("probe", "trace-probe", 1);
      },
      () => ({ vid: 42 }),
      {
        context: createRuntimeContext({ credentials: { apiKey: "test-key" } }),
        postVerify: async (_result, input) => {
          verificationCalls += 1;
          assert.equal(input.vid, 42);
          return { verification: { structure: false, status: true, link: false }, warnings: ["read-back attempted"] };
        },
      },
    );
  } catch {
    // handleError intentionally throws an internal marker after writing stderr.
  } finally {
    process.stderr.write = originalWrite;
    process.exitCode = 0;
  }
  assert.equal(verificationCalls, 1);
  const envelope = JSON.parse(stderr.trim());
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error.outcome, "unknown");
  assert.deepEqual(envelope.error.verification.verification, { structure: false, status: true, link: false });
});

test("ambiguous writes report success when read-after-write proves the result", async () => {
  const program = new Command("wjx");
  program.option("--yes");
  program.setOptionValue("yes", true);
  const command = program.command("probe");
  const originalWrite = process.stdout.write;
  const originalErrorWrite = process.stderr.write;
  let output = "";
  let diagnostics = "";
  process.stdout.write = ((chunk) => { output += String(chunk); return true; });
  process.stderr.write = ((chunk) => { diagnostics += String(chunk); return true; });
  try {
    await executeRuntimeAction(
      program,
      command,
      async () => {
        throw new WjxAmbiguousOutcomeError("probe", "trace-proven", 1);
      },
      () => ({ vid: 42 }),
      {
        context: createRuntimeContext({ credentials: { apiKey: "test-key" } }),
        postVerify: async () => ({
          outcome: "verified",
          verification: { structure: true, status: true, link: true },
          warnings: ["传输结果不明确，但读回已确认"],
        }),
      },
    );
  } finally {
    process.stdout.write = originalWrite;
    process.stderr.write = originalErrorWrite;
    process.exitCode = 0;
  }

  const envelope = JSON.parse(output.trim());
  assert.equal(envelope.ok, true);
  assert.equal(envelope.data.outcome, "verified");
  assert.equal(envelope.data.verification.status, true);
  assert.equal(diagnostics, "");
});

test("runtime action awaits asynchronous noAuth functions before formatting", async () => {
  const program = new Command("wjx");
  program.option("--format <format>");
  const command = program.command("probe");
  const originalWrite = process.stdout.write;
  let output = "";
  process.stdout.write = ((chunk) => {
    output += String(chunk);
    return true;
  });

  try {
    await executeRuntimeAction(
      program,
      command,
      async () => {
        await new Promise((resolve) => setImmediate(resolve));
        return { result: true, data: { ready: true } };
      },
      () => ({}),
      { noAuth: true },
    );
  } finally {
    process.stdout.write = originalWrite;
  }

  assert.match(output, /"ready"\s*:\s*true/);
  assert.doesNotMatch(output, /Promise/);
});

test("runtime action keeps read-after-write verification in the result envelope", async () => {
  const program = new Command("wjx");
  program.option("--format <format>");
  program.setOptionValue("format", "json");
  program.option("--yes");
  program.setOptionValue("yes", true);
  const command = program.command("probe");
  const originalWrite = process.stdout.write;
  let output = "";
  process.stdout.write = ((chunk) => {
    output += String(chunk);
    return true;
  });

  try {
    await executeRuntimeAction(
      program,
      command,
      async () => ({ result: true, data: { vid: 42 } }),
      () => ({ vid: 42 }),
      {
        context: createRuntimeContext({ credentials: { apiKey: "test-key" } }),
        postVerify: async () => ({
          fillUrl: "https://www.wjx.cn/vm/verified.aspx",
          verification: { structure: true, status: true, link: true },
        }),
      },
    );
  } finally {
    process.stdout.write = originalWrite;
  }

  const envelope = JSON.parse(output.trim());
  assert.equal(envelope.ok, true);
  assert.equal(envelope.data.vid, 42);
  assert.equal(envelope.data.verification.status, true);
  assert.equal(envelope.data.fillUrl, "https://www.wjx.cn/vm/verified.aspx");
});

test("runtime action reports an unknown outcome when post-verification cannot prove the write", async () => {
  const program = new Command("wjx");
  program.option("--yes");
  program.setOptionValue("yes", true);
  const command = program.command("probe");
  const originalWrite = process.stderr.write;
  let stderr = "";
  process.stderr.write = ((chunk) => {
    stderr += String(chunk);
    return true;
  });

  try {
    await executeRuntimeAction(
      program,
      command,
      async () => ({ result: true, data: { vid: 42 } }),
      () => ({ vid: 42 }),
      {
        context: createRuntimeContext({ credentials: { apiKey: "test-key" } }),
        postVerify: async () => ({
          outcome: "unknown",
          verification: { structure: false, status: false, link: false },
          warnings: ["read-back unavailable"],
        }),
      },
    );
  } catch {
    // handleError intentionally throws an internal marker after writing stderr.
  } finally {
    process.stderr.write = originalWrite;
    process.exitCode = 0;
  }

  const envelope = JSON.parse(stderr.trim());
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error.code, "API_ERROR");
  assert.equal(envelope.error.outcome, "unknown");
  assert.deepEqual(envelope.error.verification, { structure: false, status: false, link: false });
  assert.deepEqual(envelope.error.warnings, ["read-back unavailable"]);
});

test("runtime action rejects any failed required verification check", async () => {
  const program = new Command("wjx");
  program.option("--yes");
  program.setOptionValue("yes", true);
  const command = program.command("probe");
  const originalWrite = process.stderr.write;
  let stderr = "";
  process.stderr.write = ((chunk) => {
    stderr += String(chunk);
    return true;
  });

  try {
    await executeRuntimeAction(
      program,
      command,
      async () => ({ result: true, data: { vid: 42 } }),
      () => ({ vid: 42 }),
      {
        context: createRuntimeContext({ credentials: { apiKey: "test-key" } }),
        postVerify: async () => ({
          verification: { structure: true, status: false, link: true },
          warnings: ["status did not match"],
        }),
      },
    );
  } catch {
    // handleError intentionally throws an internal marker after writing stderr.
  } finally {
    process.stderr.write = originalWrite;
    process.exitCode = 0;
  }

  const envelope = JSON.parse(stderr.trim());
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error.outcome, "unknown");
  assert.deepEqual(envelope.error.verification, { structure: true, status: false, link: true });
});

test("runtime action permits an explicitly non-applicable verification field", async () => {
  const program = new Command("wjx");
  program.option("--yes");
  program.setOptionValue("yes", true);
  const command = program.command("probe");
  const originalWrite = process.stdout.write;
  let output = "";
  process.stdout.write = ((chunk) => {
    output += String(chunk);
    return true;
  });

  try {
    await executeRuntimeAction(
      program,
      command,
      async () => ({ result: true, data: { vid: 42 } }),
      () => ({ vid: 42 }),
      {
        context: createRuntimeContext({ credentials: { apiKey: "test-key" } }),
        requiredVerification: ["structure", "status"],
        postVerify: async () => ({
          verification: { structure: true, status: true, link: false },
          warnings: ["respondent link is not applicable"],
        }),
      },
    );
  } finally {
    process.stdout.write = originalWrite;
  }

  const envelope = JSON.parse(output.trim());
  assert.equal(envelope.ok, true);
  assert.equal(envelope.data.verification.link, false);
});

test("runtime action rejects a post-verification callback that returns no evidence", async () => {
  const program = new Command("wjx");
  program.option("--yes");
  program.setOptionValue("yes", true);
  const command = program.command("probe");
  const originalWrite = process.stderr.write;
  let stderr = "";
  process.stderr.write = ((chunk) => {
    stderr += String(chunk);
    return true;
  });

  try {
    await executeRuntimeAction(
      program,
      command,
      async () => ({ result: true, data: { vid: 42 } }),
      () => ({ vid: 42 }),
      {
        context: createRuntimeContext({ credentials: { apiKey: "test-key" } }),
        postVerify: async () => undefined,
      },
    );
  } catch {
    // handleError intentionally throws an internal marker after writing stderr.
  } finally {
    process.stderr.write = originalWrite;
    process.exitCode = 0;
  }

  const envelope = JSON.parse(stderr.trim());
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error.outcome, "unknown");
  assert.equal(envelope.error.verification, undefined);
});

test("runtime action keeps failed verification errors marked unknown", async () => {
  const program = new Command("wjx");
  program.option("--yes");
  program.setOptionValue("yes", true);
  const command = program.command("probe");
  const originalWrite = process.stderr.write;
  let stderr = "";
  process.stderr.write = ((chunk) => {
    stderr += String(chunk);
    return true;
  });

  try {
    await executeRuntimeAction(
      program,
      command,
      async () => ({ result: true, data: { vid: 42 } }),
      () => ({ vid: 42 }),
      {
        context: createRuntimeContext({ credentials: { apiKey: "test-key" } }),
        postVerify: async () => ({
          outcome: "verified",
          verification: { structure: true, status: false, link: true },
          warnings: ["status did not match"],
        }),
      },
    );
  } catch {
    // handleError intentionally throws an internal marker after writing stderr.
  } finally {
    process.stderr.write = originalWrite;
    process.exitCode = 0;
  }

  const envelope = JSON.parse(stderr.trim());
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error.outcome, "unknown");
});

test("runtime action does not let an empty required verification list bypass evidence", async () => {
  const program = new Command("wjx");
  program.option("--yes");
  program.setOptionValue("yes", true);
  const command = program.command("probe");
  const originalWrite = process.stderr.write;
  let stderr = "";
  process.stderr.write = ((chunk) => {
    stderr += String(chunk);
    return true;
  });

  try {
    await executeRuntimeAction(
      program,
      command,
      async () => ({ result: true, data: { vid: 42 } }),
      () => ({ vid: 42 }),
      {
        context: createRuntimeContext({ credentials: { apiKey: "test-key" } }),
        requiredVerification: [],
        postVerify: async () => ({ verification: {}, warnings: ["no checks"] }),
      },
    );
  } catch {
    // handleError intentionally throws an internal marker after writing stderr.
  } finally {
    process.stderr.write = originalWrite;
    process.exitCode = 0;
  }

  const envelope = JSON.parse(stderr.trim());
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error.outcome, "unknown");
});

test("runtime action keeps failed post-verification output as structured JSON with a deprecation warning", async () => {
  const program = new Command("wjx");
  program.option("--yes");
  program.setOptionValue("yes", true);
  const command = program.command("probe");
  const originalWrite = process.stderr.write;
  let stderr = "";
  process.stderr.write = ((chunk) => {
    stderr += String(chunk);
    return true;
  });

  try {
    await executeRuntimeAction(
      program,
      command,
      async () => ({ result: true, data: { vid: 42 } }),
      () => ({ vid: 42 }),
      {
        context: createRuntimeContext({ credentials: { apiKey: "test-key" } }),
        deprecationWarning: "deprecated probe",
        postVerify: async () => ({
          verification: { structure: false, status: false, link: false },
          warnings: ["read-back unavailable"],
        }),
      },
    );
  } catch {
    // handleError intentionally throws an internal marker after writing stderr.
  } finally {
    process.stderr.write = originalWrite;
    process.exitCode = 0;
  }

  const envelope = JSON.parse(stderr.trim());
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error.outcome, "unknown");
});

test("dry-run renderer keeps plans separate from diagnostics", () => {
  const rendered = renderDryRun([
    buildRequestPlan({ action: "1000002", apiKey: "secret", body: { page_index: 1 } }),
  ]);
  assert.equal(rendered.kind, "dry-run");
  assert.equal(rendered.plans.length, 1);
  assert.equal(rendered.plans[0].headers.Authorization, "Bearer ****");
});

test("stdin parser replay uses the option default as previous value", async () => {
  const program = new Command();
  const seenPrevious = [];
  program.option(
    "--tag <value>",
    "tag",
    (value, previous) => {
      seenPrevious.push(previous);
      return [...previous, value];
    },
    [],
  );
  const { mergeStdinWithOpts } = await import("../dist/lib/stdin.js");
  const merged = mergeStdinWithOpts({ tag: "from-stdin" }, program);
  assert.deepEqual(merged.tag, ["from-stdin"]);
  assert.deepEqual(seenPrevious, [[]]);
});

test("stdin parser replay rejects non-scalar values before string coercion", async () => {
  const program = new Command();
  program.option("--tag <value>", "tag", (value) => value);
  const { mergeStdinWithOpts } = await import("../dist/lib/stdin.js");
  assert.throws(
    () => mergeStdinWithOpts({ tag: ["a", "b"] }, program),
    /Invalid value for --tag: expected a scalar string or number/,
  );
});
