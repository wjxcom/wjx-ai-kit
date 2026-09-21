import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { test } from "node:test";
import { startFixture } from "./fixtures/http-fixture.mjs";

const run = promisify(execFile);
const CLI = resolve(import.meta.dirname, "..", "dist", "index.js");
const ENV = { ...process.env, WJX_CONFIG_PATH: resolve(import.meta.dirname, "..", "__dsl_no_config__") };
const DSL = 'wjx-dsl 1; questionnaire { attr "Title" = "CLI 测试"; };';

test("CLI exposes the planned DSL commands", async () => {
  const { stdout } = await run(process.execPath, [CLI, "dsl", "--help"], { env: ENV, encoding: "utf8" });
  assert.match(stdout, /query/);
  assert.match(stdout, /generate/);
  assert.match(stdout, /create/);
  assert.match(stdout, /update/);
});

test("dsl generate validates AI-generated DSL without authentication", async () => {
  const { stdout } = await run(process.execPath, [CLI, "dsl", "generate", "--dsl", DSL], { env: ENV, encoding: "utf8" });
  assert.match(stdout, /wjx-dsl 1/);
  assert.match(stdout, /questionnaire/);
});

test("dsl create and update expose the asset manifest pipeline", async () => {
  const create = await run(process.execPath, [CLI, "dsl", "create", "--help"], { env: ENV, encoding: "utf8" });
  const update = await run(process.execPath, [CLI, "dsl", "update", "--help"], { env: ENV, encoding: "utf8" });
  assert.match(create.stdout, /--assets <path>/);
  assert.match(update.stdout, /--assets <path>/);
});

test("dsl query forwards the optional read flags from CLI and structured stdin", async () => {
  const fixture = await startFixture({ env: { WJX_API_KEY: "dsl-contract-key" } });
  try {
    const fromCli = await fixture.run([
      "--dry-run", "dsl", "query", "--vid", "42",
      "--get-exts", "--get-setting", "--get-page-cut", "--get-tags", "--showtitle",
    ]);
    assert.equal(fromCli.exitCode, 0, fromCli.stderr);
    const body = JSON.parse(JSON.parse(fromCli.stdout).data.plans[0].body);
    assert.equal(body.action, "1000006");
    for (const flag of ["get_exts", "get_setting", "get_page_cut", "get_tags", "showtitle"]) {
      assert.equal(body[flag], true, flag);
    }

    const fromStdin = await fixture.run(["--stdin", "--dry-run", "dsl", "query"], {
      input: JSON.stringify({ vid: "42", get_exts: true, get_setting: true, get_page_cut: true, get_tags: true }),
    });
    assert.equal(fromStdin.exitCode, 0, fromStdin.stderr);
    const stdinBody = JSON.parse(JSON.parse(fromStdin.stdout).data.plans[0].body);
    for (const flag of ["get_exts", "get_setting", "get_page_cut", "get_tags"]) {
      assert.equal(stdinBody[flag], true, flag);
    }
    assert.equal(fixture.requests().length, 0);
  } finally {
    await fixture.close();
  }
});

test("dsl query and update reject sid values before transport", async () => {
  const fixture = await startFixture({ env: { WJX_API_KEY: "dsl-contract-key" } });
  try {
    for (const command of ["query", "update"]) {
      const result = await fixture.run([
        "--yes", "dsl", command, "--vid", "shortSid",
        ...(command === "update" ? ["--dsl", DSL] : []),
      ]);
      assert.equal(result.exitCode, 2, result.stderr);
      assert.match(JSON.parse(result.stderr).error.message, /不能使用 sid/);
    }
    assert.equal(fixture.requests().length, 0);
  } finally {
    await fixture.close();
  }
});

test("dsl update uses the traditional survey action and verifies the read-back", async () => {
  let current = 'wjx-dsl 1; questionnaire { attr "Title" = "旧标题"; };';
  const next = 'wjx-dsl 1; questionnaire { attr "Title" = "更新标题"; question radio { attr "Topic" = "1"; attr "Title" = "满意度"; item { attr "ItemTitle" = "满意"; attr "ItemValue" = "1"; }; }; };';
  const fixture = await startFixture({
    env: { WJX_API_KEY: "dsl-contract-key" },
    response: ({ request }) => {
      const body = JSON.parse(request.body);
      if (body.action === "1000006") return { result: true, data: { vid: 42, dsl: current, status: 0 } };
      if (body.action === "1000110") {
        current = body.dsl;
        return { result: true, data: { vid: 42, status: "Success" } };
      }
      return { result: false, errormsg: "unexpected action" };
    },
  });
  try {
    const result = await fixture.run(["--yes", "dsl", "update", "--vid", "42", "--dsl", next]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).data.outcome, "verified");
    assert.deepEqual(fixture.requests().map(({ body }) => JSON.parse(body).action), ["1000006", "1000110", "1000006"]);
  } finally {
    await fixture.close();
  }
});

test("dsl update preserves missing-vid diagnostics and never uses the AI homepage action", async () => {
  const fixture = await startFixture({
    env: { WJX_API_KEY: "dsl-contract-key" },
    response: { result: false, errormsg: "问卷不存在", errorcode: "NOT_FOUND", traceid: "read-trace" },
  });
  try {
    const result = await fixture.run(["--yes", "dsl", "update", "--vid", "999999", "--dsl", DSL]);
    assert.equal(result.exitCode, 1);
    const error = JSON.parse(result.stderr).error;
    assert.equal(error.message, "问卷不存在");
    assert.equal(error.action, "1000006");
    assert.equal(error.intendedAction, "1000110");
    assert.equal(error.errorcode, "NOT_FOUND");
    assert.equal(error.traceid, "read-trace");
    assert.deepEqual(fixture.requests().map(({ body }) => JSON.parse(body).action), ["1000006"]);
  } finally {
    await fixture.close();
  }
});

test("dsl update rejects AI homepages and incomplete DSL reads before writing", async () => {
  for (const data of [
    { vid: 42, atype: 12, html_content: "<main>主页</main>" },
    { vid: 42, atype: 1 },
    { atype: 1, dsl: DSL },
  ]) {
    const fixture = await startFixture({
      env: { WJX_API_KEY: "dsl-contract-key" },
      response: { result: true, data },
    });
    try {
      const result = await fixture.run(["--yes", "dsl", "update", "--vid", "42", "--dsl", DSL]);
      assert.notEqual(result.exitCode, 0);
      assert.match(JSON.parse(result.stderr).error.message, /AI 主页|完整 DSL|身份不匹配/);
      assert.deepEqual(fixture.requests().map(({ body }) => JSON.parse(body).action), ["1000006"]);
    } finally {
      await fixture.close();
    }
  }
});
