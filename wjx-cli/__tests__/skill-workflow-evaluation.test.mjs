import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { execFileSync } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startFixture } from "./fixtures/http-fixture.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const CLI = resolve(__dirname, "..", "dist", "index.js");
const CLI_SKILL = resolve(ROOT, "wjx-skills", "wjx-cli-use", "SKILL.md");

function parseSuccess(result) {
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stderr.trim(), "", `unexpected stderr: ${result.stderr}`);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.ok, true, result.stdout);
  return envelope;
}

function parseProblem(result, code = "INPUT_ERROR") {
  assert.notEqual(result.exitCode, 0, "expected a failure");
  assert.equal(result.stdout.trim(), "", `error stdout must be empty: ${result.stdout}`);
  const envelope = JSON.parse(result.stderr);
  assert.equal(envelope.ok, false, result.stderr);
  assert.equal(envelope.error.code, code, result.stderr);
  return envelope;
}

const jsonl = (title, atype = 1) => [
  { qtype: "问卷基础信息", title, atype },
  { qtype: "单选", title: "选择题", select: ["是", "否"] },
].map((row) => JSON.stringify(row)).join("\n") + "\n";

test("Skill documents every supported JSONL template type with usable JSONL", async () => {
  const supported = [1, 2, 3, 6, 7, 10, 11];
  const fixture = await startFixture();
  try {
    for (const atype of supported) {
      const result = await fixture.run(["survey", "jsonl-template", "--type", String(atype), "--raw"]);
      assert.equal(result.exitCode, 0, `atype=${atype}: ${result.stderr}`);
      assert.equal(result.stderr.trim(), "");
      const rows = result.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
      assert.ok(rows.length >= 2, `atype=${atype} template has no question`);
      assert.deepEqual(rows[0], {
        qtype: "问卷基础信息",
        title: rows[0].title,
        atype,
      });
      assert.ok(rows[0].title, `atype=${atype} template has no title`);
      assert.ok(rows.slice(1).every((row) => typeof row.qtype === "string" && row.title), `atype=${atype}`);
    }
    for (const atype of [0, 4, 5, 8]) {
      const result = await fixture.run(["survey", "jsonl-template", "--type", String(atype), "--raw"]);
      parseProblem(result);
      assert.equal(fixture.requests().length, 0);
    }
  } finally {
    await fixture.close();
  }
});

test("create applies documented source precedence and rejects missing files", async () => {
  const fixture = await startFixture();
  const file = resolve(fixture.tempDir, "from-file.jsonl");
  try {
    const fromCli = jsonl("from-cli");
    const fromFile = jsonl("from-file");
    await writeFile(file, fromFile, "utf8");

    const both = await fixture.run(["--dry-run", "survey", "create", "--jsonl", fromCli, "--file", file]);
    const bothPlan = JSON.parse(parseSuccess(both).data.plans[0].body);
    assert.equal(JSON.parse(bothPlan.surveydatajson.split(/\r?\n/)[0]).title, "from-cli");
    assert.equal(fixture.requests().length, 0);

    const onlyFile = await fixture.run(["--dry-run", "survey", "create", "--file", file]);
    const filePlan = JSON.parse(parseSuccess(onlyFile).data.plans[0].body);
    assert.equal(JSON.parse(filePlan.surveydatajson.split(/\r?\n/)[0]).title, "from-file");

    const fromStdin = jsonl("from-stdin");
    const stdin = await fixture.run(["--stdin", "--dry-run", "survey", "create"], {
      input: JSON.stringify({ jsonl: fromStdin }),
    });
    const stdinPlan = JSON.parse(parseSuccess(stdin).data.plans[0].body);
    assert.equal(JSON.parse(stdinPlan.surveydatajson.split(/\r?\n/)[0]).title, "from-stdin");

    const missing = await fixture.run(["--dry-run", "survey", "create", "--file", resolve(fixture.tempDir, "missing.jsonl")]);
    parseProblem(missing);
    assert.equal(fixture.requests().length, 0);
  } finally {
    await fixture.close();
  }
});

test("submit auto-version has a metadata prefetch, while --no-auto-version sends exactly one request", async () => {
  const autoFixture = await startFixture({
    response: { result: true, data: { version: 17, questions: [] } },
    env: { WJX_API_KEY: "submit-workflow-key" },
  });
  try {
    const result = await autoFixture.run([
      "--yes", "response", "submit", "--vid", "42", "--inputcosttime", "30",
      "--submitdata", "1$1",
    ]);
    parseSuccess(result);
    assert.equal(autoFixture.requests().length, 2, "default submit must fetch the latest version first");
    const body = JSON.parse(autoFixture.requests().at(-1).body);
    assert.equal(body.jpmversion, 17);
  } finally {
    await autoFixture.close();
  }

  const explicitFixture = await startFixture({ env: { WJX_API_KEY: "submit-workflow-key" } });
  try {
    const result = await explicitFixture.run([
      "--yes", "response", "submit", "--vid", "42", "--inputcosttime", "30",
      "--submitdata", "1$1", "--jpmversion", "23", "--no-auto-version",
    ]);
    parseSuccess(result);
    assert.equal(explicitFixture.requests().length, 1, "--no-auto-version must not prefetch survey metadata");
    const body = JSON.parse(explicitFixture.requests()[0].body);
    assert.equal(body.jpmversion, 23);

    const beforeExplicitAuto = explicitFixture.requests().length;
    const explicitAuto = await explicitFixture.run([
      "--yes", "response", "submit", "--vid", "42", "--inputcosttime", "30",
      "--submitdata", "1$1", "--jpmversion", "24",
    ]);
    parseSuccess(explicitAuto);
    assert.equal(explicitFixture.requests().length, beforeExplicitAuto + 1, "explicit jpmversion must skip metadata prefetch even when auto-version is enabled");
    assert.equal(JSON.parse(explicitFixture.requests().at(-1).body).jpmversion, 24);
  } finally {
    await explicitFixture.close();
  }
});

test("download exposes async task IDs and allows an explicit task poll", async () => {
  const firstFixture = await startFixture({
    response: { result: true, data: { taskid: "download-task-1", status: "processing" } },
    env: { WJX_API_KEY: "download-key" },
  });
  try {
    const result = await firstFixture.run(["response", "download", "--vid", "42", "--query_count", "3001"]);
    const data = parseSuccess(result).data;
    assert.equal(data.taskid, "download-task-1");
    assert.equal(firstFixture.requests().length, 1);
    const body = JSON.parse(firstFixture.requests()[0].body);
    assert.equal(body.query_count, 3001);
    assert.equal(body.taskid, undefined);
  } finally {
    await firstFixture.close();
  }

  const pollFixture = await startFixture({
    response: { result: true, data: { taskid: "download-task-1", status: "complete", url: "https://download.example.test/file.csv" } },
    env: { WJX_API_KEY: "download-key" },
  });
  try {
    const result = await pollFixture.run(["response", "download", "--vid", "42", "--taskid", "download-task-1"]);
    assert.equal(parseSuccess(result).data.status, "complete");
    assert.equal(pollFixture.requests().length, 1);
    assert.equal(JSON.parse(pollFixture.requests()[0].body).taskid, "download-task-1");
  } finally {
    await pollFixture.close();
  }
});

test("confirmation runtime supports interactive approval and policy denial", async () => {
  const { ensureConfirmation } = await import("../dist/lib/runtime/confirmation.js");
  const { getCommandMetadata } = await import("../dist/lib/command-metadata.js");

  const input = new PassThrough();
  Object.defineProperty(input, "isTTY", { value: true });
  const output = new PassThrough();
  let prompt = "";
  output.on("data", (chunk) => { prompt += chunk.toString(); });
  const approval = ensureConfirmation({
    command: "survey.delete",
    metadata: getCommandMetadata("survey.delete"),
    input: { vid: 42, username: "owner" },
    options: {},
    inputStream: input,
    outputStream: output,
  });
  input.end("y\n");
  assert.equal(await approval, "interactive");
  assert.match(prompt, /survey\.delete/);

  await assert.rejects(
    ensureConfirmation({
      command: "survey.delete",
      metadata: getCommandMetadata("survey.delete"),
      input: { vid: 42, username: "owner" },
      options: { yes: true },
      policy: { evaluate: () => ({ allowed: false, source: "test", reason: "blocked by evaluation" }) },
    }),
    (error) => error?.code === "POLICY_DENIED" && error?.details?.confirmation_source === "policy",
  );
});

test("pagination responses without total_count stay explicitly unknown", async () => {
  const fixture = await startFixture({
    response: { result: true, data: { page_index: 1, page_size: 2, activitys: { "42": { vid: 42, title: "one" } } } },
    env: { WJX_API_KEY: "pagination-unknown-key" },
  });
  try {
    const surveys = await fixture.run(["survey", "list"]);
    const surveyData = parseSuccess(surveys).data;
    assert.equal(Object.hasOwn(surveyData, "total_count"), false);
    assert.equal(surveyData.page_index, 1);

    const responses = await fixture.run(["response", "query", "--vid", "42"]);
    const responseData = parseSuccess(responses).data;
    assert.equal(Object.hasOwn(responseData, "total_count"), false);
  } finally {
    await fixture.close();
  }
});

test("raw Skill outputs remain machine-consumable without a ResultEnvelope", async () => {
  const template = execFileSync(process.execPath, [
    CLI, "survey", "jsonl-template", "--type", "3", "--raw",
  ], { encoding: "utf8", env: { ...process.env, WJX_CONFIG_PATH: resolve(__dirname, "..", "__raw_no_config__") } });
  const first = JSON.parse(template.trim().split(/\r?\n/)[0]);
  assert.equal(first.qtype, "问卷基础信息");
  assert.equal(first.atype, 3);

  const fixture = await startFixture({
    response: { result: true, data: { title: "原始模板", questions: [{ q_index: 2, q_type: 3, q_subtype: 3, q_title: "满意度", items: [{ item_index: 1, item_title: "满意" }] }] } },
    env: { WJX_API_KEY: "raw-output-key" },
  });
  try {
    const result = await fixture.run(["response", "submit-template", "--vid", "42", "--raw"]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.equal(result.stderr.trim(), "");
    assert.equal(result.stdout.trim(), "2$1");
    assert.equal(fixture.requests().length, 1);
  } finally {
    await fixture.close();
  }

  const skill = await readFile(CLI_SKILL, "utf8");
  assert.match(skill, /submit-template/);
  await access(CLI_SKILL);
});
