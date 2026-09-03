import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startFixture } from "./fixtures/http-fixture.mjs";
import { handleError, CliErrorHandled } from "../dist/lib/errors.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const { version: CLI_VERSION } = require("../package.json");
const CLI = resolve(ROOT, "dist", "index.js");

function run(args) {
  return new Promise((resolveResult) => execFile(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    env: { ...process.env, WJX_CONFIG_PATH: resolve(ROOT, "__missing__"), WJX_API_KEY: "" },
    encoding: "utf8",
  }, (error, stdout, stderr) => resolveResult({ code: error?.code ?? 0, stdout, stderr })));
}

test("default structured output is an ok/data envelope", async () => {
  const result = await run(["survey", "url", "--mode", "create"]);
  assert.equal(result.code, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.ok(parsed.data.url);
});

test("format options and record formats preserve data", async () => {
  const json = JSON.parse((await run(["survey", "url", "--format", "json"])).stdout);
  const ndjson = (await run(["survey", "url", "--format", "ndjson"])).stdout.trim().split("\n");
  assert.equal(JSON.parse(ndjson[0]).url, json.data.url);
});

test("errors are ProblemEnvelope on stderr and stdout remains empty", async () => {
  const result = await run(["survey", "get"]);
  assert.notEqual(result.code, 0);
  assert.equal(result.stdout, "");
  const parsed = JSON.parse(result.stderr);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.type, "validation");
});

test("init treats an explicitly blank API key as input validation", async () => {
  const result = await run(["init", "--api-key", ""]);
  assert.equal(result.code, 2);
  assert.equal(result.stdout, "");
  const problem = JSON.parse(result.stderr);
  assert.equal(problem.ok, false);
  assert.equal(problem.error.code, "INPUT_ERROR");
  assert.match(problem.error.message, /不能为空/);
});

test("API response failures never become successful stdout envelopes", async () => {
  const fixture = await startFixture({
    response: { result: false, errormsg: "无效凭据", errorcode: 40102, traceid: "trace-whoami" },
    env: { WJX_API_KEY: "bad-key" },
  });
  try {
    const result = await fixture.run(["whoami"]);
    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, "");
    const problem = JSON.parse(result.stderr);
    assert.equal(problem.ok, false);
    assert.equal(problem.error.code, "API_ERROR");
    assert.equal(problem.error.errorcode, 40102);
    assert.equal(problem.error.traceid, "trace-whoami");
  } finally {
    await fixture.close();
  }
});

test("survey create reports a structured upgrade requirement from the backend", async () => {
  const fixture = await startFixture({
    response: {
      result: false,
      errorcode: "CLIENT_VERSION_TOO_OLD",
      errormsg: "客户端版本过低",
      data: {
        min_client_version: "0.4.1",
        upgrade_command: "npm install -g wjx-cli@latest",
      },
      traceid: "trace-upgrade",
    },
    env: { WJX_API_KEY: "test-key" },
  });
  try {
    const jsonl = [
      { qtype: "问卷基础信息", title: "版本升级测试" },
      { qtype: "单选", title: "选择一个", select: ["A", "B"] },
    ].map(JSON.stringify).join("\n");
    const result = await fixture.run(["survey", "create", "--jsonl", jsonl]);
    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, "");
    const problem = JSON.parse(result.stderr);
    assert.equal(problem.ok, false);
    assert.equal(problem.error.code, "UPGRADE_REQUIRED");
    assert.equal(problem.error.type, "upgrade");
    assert.equal(problem.error.min_client_version, "0.4.1");
    assert.equal(problem.error.upgrade_command, "npm install -g wjx-cli@latest");
    assert.match(problem.error.hint, /0\.4\.1/);
    assert.match(problem.error.hint, /npm install -g wjx-cli@latest/);
    const request = fixture.requests()[0];
    assert.equal(request.headers["x-wjx-client"], "wjx-cli");
    assert.equal(request.headers["x-wjx-client-version"], CLI_VERSION);
  } finally {
    await fixture.close();
  }
});

test("survey create keeps structured upgrade errors without backend details", async () => {
  const fixture = await startFixture({
    response: {
      result: false,
      errorcode: "CLIENT_VERSION_TOO_OLD",
      errormsg: "客户端版本过低，请升级后重试",
    },
    env: { WJX_API_KEY: "test-key" },
  });
  try {
    const jsonl = [
      { qtype: "问卷基础信息", title: "版本升级默认提示" },
      { qtype: "单选", title: "选择一个", select: ["A", "B"] },
    ].map(JSON.stringify).join("\n");
    const result = await fixture.run(["survey", "create", "--jsonl", jsonl]);
    assert.equal(result.exitCode, 1);
    const problem = JSON.parse(result.stderr);
    assert.equal(problem.error.code, "UPGRADE_REQUIRED");
    assert.equal(problem.error.min_client_version, undefined);
    assert.equal(problem.error.upgrade_command, undefined);
    assert.equal(problem.error.hint, undefined);
  } finally {
    await fixture.close();
  }
});

test("numeric backend codes are not classified from upgrade wording alone", async () => {
  const fixture = await startFixture({
    response: {
      result: false,
      errorcode: 42601,
      errormsg: "请升级套餐后重试",
    },
    env: { WJX_API_KEY: "test-key" },
  });
  try {
    const jsonl = [
      { qtype: "问卷基础信息", title: "版本升级数字错误码" },
      { qtype: "单选", title: "选择一个", select: ["A", "B"] },
    ].map(JSON.stringify).join("\n");
    const result = await fixture.run(["survey", "create", "--jsonl", jsonl]);
    assert.equal(result.exitCode, 1);
    const problem = JSON.parse(result.stderr);
    assert.equal(problem.error.code, "API_ERROR");
    assert.equal(problem.error.errorcode, 42601);
  } finally {
    await fixture.close();
  }
});

test("business upgrade wording is not classified as a client-version upgrade", async () => {
  const fixture = await startFixture({
    response: {
      result: false,
      errorcode: "PLAN_LIMIT",
      errormsg: "请升级套餐后继续使用",
    },
    env: { WJX_API_KEY: "test-key" },
  });
  try {
    const jsonl = [
      { qtype: "问卷基础信息", title: "套餐限制测试" },
      { qtype: "单选", title: "选择一个", select: ["A", "B"] },
    ].map(JSON.stringify).join("\n");
    const result = await fixture.run(["survey", "create", "--jsonl", jsonl]);
    assert.equal(result.exitCode, 1);
    const problem = JSON.parse(result.stderr);
    assert.equal(problem.error.code, "API_ERROR");
    assert.equal(problem.error.upgrade_required, undefined);
    assert.equal(problem.error.min_client_version, undefined);
  } finally {
    await fixture.close();
  }
});

test("upgrade classification requires structured backend metadata", async () => {
  const fixture = await startFixture({
    response: {
      result: false,
      errorcode: 42601,
      errormsg: "客户端版本过低，请升级后重试",
      data: { upgrade_required: true, min_client_version: "0.5.0" },
    },
    env: { WJX_API_KEY: "test-key" },
  });
  try {
    const jsonl = [
      { qtype: "问卷基础信息", title: "结构化升级测试" },
      { qtype: "单选", title: "选择一个", select: ["A", "B"] },
    ].map(JSON.stringify).join("\n");
    const result = await fixture.run(["survey", "create", "--jsonl", jsonl]);
    const problem = JSON.parse(result.stderr);
    assert.equal(problem.error.code, "UPGRADE_REQUIRED");
    assert.equal(problem.error.min_client_version, "0.5.0");
    assert.equal(problem.error.upgrade_command, undefined);
    assert.match(problem.error.hint, /请升级 wjx-cli 至 0\.5\.0/);
  } finally {
    await fixture.close();
  }
});

test("version fast path only handles a root-level version flag", async () => {
  const result = await run(["survey", "list", "--version"]);
  assert.notEqual(result.code, 0);
  assert.equal(result.stdout, "");
  const problem = JSON.parse(result.stderr);
  assert.equal(problem.ok, false);
  assert.equal(problem.error.code, "INPUT_ERROR");
});

test("CLI preserves retryable guidance for transport errors identified by error code", () => {
  const originalWrite = process.stderr.write;
  const previousExitCode = process.exitCode;
  let output = "";
  process.stderr.write = ((chunk) => {
    output += String(chunk);
    return true;
  });

  try {
    assert.throws(
      () => handleError(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" })),
      CliErrorHandled,
    );
  } finally {
    process.stderr.write = originalWrite;
    process.exitCode = previousExitCode;
  }

  const problem = JSON.parse(output);
  assert.equal(problem.ok, false);
  assert.equal(problem.error.code, "API_ERROR");
  assert.equal(problem.error.retryable, true);
});
