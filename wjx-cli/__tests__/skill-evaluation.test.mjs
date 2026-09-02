import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startFixture } from "./fixtures/http-fixture.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, "..", "dist", "index.js");
const NO_CONFIG = { WJX_CONFIG_PATH: resolve(__dirname, "..", "__skill_eval_no_config__") };
const SKILL = resolve(__dirname, "..", "..", "wjx-skills", "wjx-cli-use", "SKILL.md");

function runCli(args, { env = {}, input, cwd, timeout = 10_000 } = {}) {
  return new Promise((resolveRun) => {
    const child = execFile(process.execPath, [CLI, ...args], {
      cwd,
      env: { ...process.env, ...NO_CONFIG, ...env },
      encoding: "utf8",
      timeout,
    }, (error, stdout, stderr) => {
      resolveRun({
        exitCode: error ? error.code ?? 1 : 0,
        stdout: stdout || "",
        stderr: stderr || "",
      });
    });
    if (input !== undefined) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

function jsonl(...entries) {
  return `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
}

function parseResult(result) {
  assert.equal(result.stderr.trim(), "", `unexpected stderr: ${result.stderr}`);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.ok, true, `expected ResultEnvelope: ${result.stdout}`);
  return envelope.data;
}

function parseProblem(result) {
  assert.equal(result.stdout.trim(), "", `unexpected stdout: ${result.stdout}`);
  const envelope = JSON.parse(result.stderr);
  assert.equal(envelope.ok, false, `expected ProblemEnvelope: ${result.stderr}`);
  return { ...envelope.error, exitCode: envelope.exitCode };
}

function encryptPush(payload, appKey) {
  const key = Buffer.from(createHash("md5").update(appKey, "utf8").digest("hex").slice(0, 16), "utf8");
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-128-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, encrypted]).toString("base64");
}

async function writeSkillFixture(fixture, name, content) {
  const file = join(fixture.tempDir, name);
  await writeFile(file, content, "utf8");
  return file;
}

test("evaluation suite is pinned to the current wjx-cli skill rules", async () => {
  const skill = await readFile(SKILL, "utf8");
  assert.match(skill, /create/);
  assert.match(skill, /NPS量表/);
  assert.match(skill, /total_count/);
  assert.match(skill, /API Key/);
});

describe("Skill rule 0-3: AI survey creation", () => {
  test("creates one canonical satisfaction survey containing NPS and free text", async () => {
    const fixture = await startFixture();
    try {
      const file = await writeSkillFixture(fixture, "satisfaction.jsonl", jsonl(
        { qtype: "问卷基础信息", title: "客户满意度调查", atype: 1 },
        { qtype: "单选", title: "您对服务满意吗？", select: ["满意", "一般", "不满意"] },
        { qtype: "NPS量表", title: "您愿意推荐吗？", select: Array.from({ length: 11 }, (_, i) => String(i)) },
        { qtype: "简答题", title: "还有什么建议？" },
      ));
      const result = await fixture.run(["survey", "create", "--file", file, "--dry-run"]);
      assert.equal(result.exitCode, 0);
      const data = parseResult(result);
      assert.equal(fixture.requests().length, 0);
      assert.equal(data.kind, "dry-run");
      assert.equal(data.plans.length, 1);
      const request = JSON.parse(data.plans[0].body);
      const wire = String(request.surveydatajson).split(/\r?\n/).filter(Boolean).map(JSON.parse);
      assert.equal(wire.length, 4, "one user request must contain every question");
      assert.deepEqual(wire.find((item) => item.qtype === "NPS量表").select, Array.from({ length: 11 }, (_, i) => String(i)));
      assert.ok(wire.every((item) => !("_meta" in item) && !("q_type" in item) && !("q_subtype" in item)));
    } finally {
      await fixture.close();
    }
  });

  test("preserves exam type, answer keys, scores, and isquiz metadata", async () => {
    const fixture = await startFixture();
    try {
      const file = await writeSkillFixture(fixture, "exam.jsonl", jsonl(
        { qtype: "问卷基础信息", title: "JavaScript 基础考试", atype: 6 },
        { qtype: "考试单选", title: "哪个值是布尔值？", select: ["0", "true", "null"], correctselect: ["B"], quizscore: "10", isquiz: "1" },
        { qtype: "考试判断", title: "const 可以重新赋值", select: ["对", "错"], correctselect: ["错"], quizscore: "5", isquiz: "1" },
      ));
      const result = await fixture.run(["survey", "create", "--file", file, "--type", "6", "--dry-run"]);
      assert.equal(result.exitCode, 0);
      const data = parseResult(result);
      assert.equal(fixture.requests().length, 0);
      const request = JSON.parse(data.plans[0].body);
      assert.equal(request.atype, 6);
      const wire = String(request.surveydatajson).split(/\r?\n/).filter(Boolean).map(JSON.parse);
      assert.equal(wire[0].atype, 6);
      assert.equal(wire[1].qtype, "考试单选");
      assert.deepEqual(wire[1].correctselect, ["B"]);
      assert.equal(wire[1].quizscore, "10");
      assert.equal(wire[1].isquiz, "1");
    } finally {
      await fixture.close();
    }
  });

  test("keeps vote question types distinct from survey atype", async () => {
    const fixture = await startFixture();
    try {
      const file = await writeSkillFixture(fixture, "vote.jsonl", jsonl(
        { qtype: "问卷基础信息", title: "产品投票", atype: 3 },
        { qtype: "投票单选", title: "最喜欢的方案", select: ["A", "B", "C"] },
        { qtype: "投票多选", title: "支持的功能", select: ["导出", "分析", "Webhook"] },
      ));
      const result = await fixture.run(["survey", "create", "--file", file, "--type", "3", "--dry-run"]);
      assert.equal(result.exitCode, 0);
      const data = parseResult(result);
      const request = JSON.parse(data.plans[0].body);
      assert.equal(request.atype, 3);
      const wire = String(request.surveydatajson).split(/\r?\n/).filter(Boolean).map(JSON.parse);
      assert.deepEqual(wire.slice(1).map((item) => item.qtype), ["投票单选", "投票多选"]);
    } finally {
      await fixture.close();
    }
  });

  test("rejects every non-canonical NPS select shape before any request", async () => {
    const invalid = [
      { qtype: "NPS量表", title: "推荐吗？" },
      { qtype: "NPS量表", title: "推荐吗？", select: ["0", "1", "2"] },
      { qtype: "NPS量表", title: "推荐吗？", select: Array.from({ length: 11 }, (_, i) => i) },
      { qtype: "NPS量表", title: "推荐吗？", select: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"] },
      { qtype: "NPS量表", title: "推荐吗？", select: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "10", "9"] },
      { qtype: "NPS量表", title: "推荐吗？", select: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", null] },
    ];
    const fixture = await startFixture();
    try {
      for (const question of invalid) {
        const file = await writeSkillFixture(fixture, "invalid-nps.jsonl", jsonl(
          { qtype: "问卷基础信息", title: "NPS 调查", atype: 1 },
          question,
        ));
        const result = await fixture.run(["survey", "create", "--file", file, "--dry-run"]);
        assert.equal(result.exitCode, 2, JSON.stringify(question));
        assert.equal(parseProblem(result).code, "INPUT_ERROR");
        assert.equal(fixture.requests().length, 0);
      }
    } finally {
      await fixture.close();
    }
  });

  test("rejects legacy fields and English qtype values before transport", async () => {
    const fixture = await startFixture();
    try {
      const cases = [
        jsonl({ qtype: "问卷基础信息", title: "错误题型", atype: 1 }, { qtype: "radio", title: "错误" }),
        jsonl({ qtype: "问卷基础信息", title: "旧字段", atype: 1 }, { q_type: 3, q_subtype: 3, q_title: "错误", items: [] }),
      ];
      for (const content of cases) {
        const file = await writeSkillFixture(fixture, "invalid-qtype.jsonl", content);
        const result = await fixture.run(["survey", "create", "--file", file, "--dry-run"]);
        assert.equal(result.exitCode, 2);
        assert.equal(parseProblem(result).code, "INPUT_ERROR");
        assert.equal(fixture.requests().length, 0);
      }
    } finally {
      await fixture.close();
    }
  });

  test("rejects atype=8 user-system survey creation before transport", async () => {
    const fixture = await startFixture();
    try {
      const file = await writeSkillFixture(fixture, "user-system.jsonl", jsonl(
        { qtype: "问卷基础信息", title: "历史用户体系", atype: 8 },
        { qtype: "单选", title: "角色", select: ["管理员", "成员"] },
      ));
      const result = await fixture.run(["survey", "create", "--file", file, "--dry-run"]);
      assert.equal(result.exitCode, 2);
      assert.equal(parseProblem(result).code, "INPUT_ERROR");
      assert.equal(fixture.requests().length, 0);
    } finally {
      await fixture.close();
    }
  });
});

describe("Skill rule 5-7: credentials and response submission", () => {
  test("dry-run submit is credential-free and marks unresolved jpmversion", async () => {
    const result = await runCli([
      "response", "submit", "--vid", "42", "--inputcosttime", "30", "--submitdata", "1$1", "--dry-run",
    ]);
    assert.equal(result.exitCode, 0);
    const data = parseResult(result);
    assert.deepEqual(data.plans[0].unresolved, ["jpmversion"]);
    assert.match(data.plans[0].headers.Authorization, /\*\*\*\*/);
  });

  test("missing API key is an authentication problem with no request", async () => {
    const fixture = await startFixture({ env: { WJX_API_KEY: "" } });
    try {
      const result = await fixture.run(["response", "query", "--vid", "42"]);
      assert.equal(result.exitCode, 1);
      const problem = parseProblem(result);
      assert.equal(problem.code, "AUTH_ERROR");
      assert.equal(fixture.requests().length, 0);
    } finally {
      await fixture.close();
    }
  });

  test("upstream API Key failures preserve diagnostics for the Agent", async () => {
    const fixture = await startFixture({
      response: { result: false, errormsg: "appkey error", errorcode: "AUTH_INVALID", traceid: "trace-auth" },
      env: { WJX_API_KEY: "expired-key" },
    });
    try {
      const result = await fixture.run(["survey", "list"]);
      assert.equal(result.exitCode, 1);
      const problem = parseProblem(result);
      assert.equal(problem.code, "API_ERROR");
      assert.equal(problem.message, "appkey error");
      assert.equal(problem.errorcode, "AUTH_INVALID");
      assert.equal(problem.traceid, "trace-auth");
      assert.equal(fixture.requests().length, 1);
    } finally {
      await fixture.close();
    }
  });

  test("submitdata-file preserves dollar delimiters through the real request", async () => {
    const fixture = await startFixture({ env: { WJX_API_KEY: "submit-file-key" } });
    try {
      const file = await writeSkillFixture(fixture, "submitdata.txt", "1$1}2$3|4");
      const result = await fixture.run([
        "--yes", "response", "submit", "--vid", "42", "--inputcosttime", "30",
        "--submitdata-file", file, "--jpmversion", "1",
      ]);
      assert.equal(result.exitCode, 0);
      assert.equal(fixture.requests().length, 1, "explicit jpmversion skips survey metadata prefetch");
      const body = JSON.parse(fixture.requests().at(-1).body);
      assert.equal(body.submitdata, "1$1}2$3|4");
    } finally {
      await fixture.close();
    }
  });

  test("batch submission can be audited one result at a time", async () => {
    const outcomes = [];
    for (const response of [{ result: true, data: { jid: 1 } }, { result: false, errorcode: "DUPLICATE", errormsg: "duplicate submission", traceid: "trace-2" }, { result: true, data: { jid: 3 } }]) {
      const fixture = await startFixture({ response, env: { WJX_API_KEY: "batch-test-key" } });
      try {
        const result = await fixture.run([
          "--yes", "response", "submit", "--vid", "42", "--inputcosttime", "30", "--submitdata", "1$1", "--jpmversion", "1",
        ]);
        if (result.exitCode === 0) {
          const envelope = JSON.parse(result.stdout);
          outcomes.push({ ok: envelope.ok, error: null });
        } else {
          const problem = parseProblem(result);
          outcomes.push({ ok: false, error: { message: problem.message, errorcode: problem.errorcode, traceid: problem.traceid } });
        }
      } finally {
        await fixture.close();
      }
    }
    assert.deepEqual({ planned: outcomes.length, succeeded: outcomes.filter((item) => item.ok).length, failed: outcomes.filter((item) => !item.ok).length }, { planned: 3, succeeded: 2, failed: 1 });
    assert.deepEqual(outcomes[1].error, { message: "duplicate submission", errorcode: "DUPLICATE", traceid: "trace-2" });
  });
});

describe("Skill rule 8-10: links, pagination, and analysis", () => {
  test("survey list keeps total count and page metadata for Agent pagination", async () => {
    const fixture = await startFixture({
      response: { result: true, data: { total_count: 5, page_index: 1, page_size: 2, activitys: {} } },
      env: { WJX_API_KEY: "query-key" },
    });
    try {
      const result = await fixture.run(["survey", "list", "--page_size", "2"]);
      assert.equal(result.exitCode, 0);
      const data = parseResult(result);
      assert.equal(data.total_count, 5);
      assert.equal(data.page_index, 1);
      assert.equal(data.page_size, 2);
      assert.equal(fixture.requests().length, 1, "Agent must request later pages explicitly");
    } finally {
      await fixture.close();
    }
  });

  test("response query exposes total count instead of pretending one page is complete", async () => {
    const fixture = await startFixture({
      response: { result: true, data: { valid: true, page_index: 1, page_size: 2, total_count: 5, answers: [{ jid: 1 }, { jid: 2 }] } },
      env: { WJX_API_KEY: "query-key" },
    });
    try {
      const result = await fixture.run(["response", "query", "--vid", "42", "--page_size", "2"]);
      assert.equal(result.exitCode, 0);
      const data = parseResult(result);
      assert.equal(data.total_count, 5);
      assert.equal(data.answers.length, 2);
      assert.equal(fixture.requests().length, 1);
    } finally {
      await fixture.close();
    }
  });

  test("NPS analysis returns the expected classification for valid scores and stdin", async () => {
    const direct = await runCli(["analytics", "nps", "--scores", "[9,10,7,3,8,10,6]"]);
    const directData = parseResult(direct);
    assert.equal(directData.score, 14);
    assert.equal(directData.promoters.count, 3);
    assert.equal(directData.detractors.count, 2);

    const stdin = await runCli(["analytics", "nps", "--stdin"], { input: JSON.stringify({ scores: [10, 9, 8] }) });
    const stdinData = parseResult(stdin);
    assert.equal(stdinData.score, 67);
    assert.equal(stdinData.total, 3);
  });

  test("NPS rejects out-of-range and non-numeric score values", async () => {
    for (const scores of [[-1, 5, 11], ["10", 9, null], [1.5, 2]]) {
      const result = await runCli(["analytics", "nps", "--scores", JSON.stringify(scores)]);
      assert.equal(result.exitCode, 2, JSON.stringify(scores));
      assert.equal(parseProblem(result).code, "INPUT_ERROR");
    }
  });

  test("CSAT supports 5/7-point scales and rejects unsupported scales or values", async () => {
    const five = await runCli(["analytics", "csat", "--scores", "[4,5,3,5,2,4,5]"]);
    assert.equal(parseResult(five).csat, 0.7143);
    const seven = await runCli(["analytics", "csat", "--scores", "[6,7,5,7,3,6,7]", "--scale", "7-point"]);
    assert.equal(parseResult(seven).csat, 0.8571);

    for (const args of [
      ["--scores", "[1,2,3]", "--scale", "3-point"],
      ["--scores", "[1,\"5\",null]"],
      ["--scores", "[0,8]", "--scale", "7-point"],
    ]) {
      const result = await runCli(["analytics", "csat", ...args]);
      assert.equal(result.exitCode, 2, args.join(" "));
      assert.equal(parseProblem(result).code, "INPUT_ERROR");
    }
  });

  test("unknown output formats are rejected instead of silently becoming CSV", async () => {
    const result = await runCli(["survey", "url", "--mode", "create", "--format", "yaml"]);
    assert.equal(result.exitCode, 2);
    assert.equal(parseProblem(result).code, "INPUT_ERROR");
  });
});

describe("Skill workflow edge cases and local analytics", () => {
  test("decode handles single, multi, matrix, and free-text answers", async () => {
    const result = await runCli([
      "analytics", "decode", "--submitdata", "1$1}2$3|4}3$hello}4$1!2,2!3",
    ]);
    const data = parseResult(result);
    assert.equal(data.count, 4);
    assert.deepEqual(data.answers.map((answer) => answer.type), ["single", "multi", "fill", "matrix"]);
    assert.deepEqual(data.answers[1].value, ["3", "4"]);
    assert.deepEqual(data.answers[3].value, { "1": "2", "2": "3" });
  });

  test("anomalies reports straight-line, speed, and duplicate signals", async () => {
    const responses = [
      { jid: "a", answers: ["1", "1", "1"], duration_seconds: 100, ip: "192.0.2.1" },
      { jid: "b", answers: ["1", "1", "1"], duration_seconds: 100, ip: "192.0.2.1" },
      { jid: "c", answers: ["1", "2", "3"], duration_seconds: 10, ip: "192.0.2.2" },
    ];
    const result = await runCli(["analytics", "anomalies", "--responses", JSON.stringify(responses)]);
    const data = parseResult(result);
    assert.equal(data.totalChecked, 3);
    assert.deepEqual(data.flagged, [
      { responseId: "a", reasons: ["straight-lining"] },
      { responseId: "b", reasons: ["straight-lining", "ip-content-duplicate"] },
      { responseId: "c", reasons: ["speed-anomaly"] },
    ]);
  });

  test("compare includes union of metrics and marks significant changes", async () => {
    const result = await runCli([
      "analytics", "compare",
      "--set_a", JSON.stringify({ nps: 50, csat: 0.8, unchanged: 1 }),
      "--set_b", JSON.stringify({ nps: 60, csat: 0.8, added: 2 }),
    ]);
    const data = parseResult(result);
    const byMetric = Object.fromEntries(data.comparisons.map((item) => [item.metric, item]));
    assert.deepEqual(byMetric.nps, { metric: "nps", valueA: 50, valueB: 60, delta: 10, changeRate: 0.2, significant: true });
    assert.deepEqual(byMetric.csat, { metric: "csat", valueA: 0.8, valueB: 0.8, delta: 0, changeRate: 0, significant: false });
    assert.deepEqual(byMetric.added, { metric: "added", valueA: 0, valueB: 2, delta: 2, changeRate: 1, significant: true });
  });

  test("analytics stdin accepts structured CSAT input", async () => {
    const result = await runCli(["analytics", "csat", "--stdin"], {
      input: JSON.stringify({ scores: [4, 5, 2], scale: "5-point" }),
    });
    const data = parseResult(result);
    assert.equal(data.csat, 0.6667);
    assert.equal(data.satisfiedCount, 2);
  });

  test("decode-push decrypts payload and verifies an optional signature", async () => {
    const appKey = "skill-evaluation-key";
    const rawBody = JSON.stringify({ event: "response.created" });
    const payload = { vid: 42, jid: 99, submitdata: "1$1" };
    const encrypted = encryptPush(payload, appKey);
    const signature = createHash("sha1").update(rawBody + appKey, "utf8").digest("hex");
    const result = await runCli([
      "analytics", "decode-push", "--payload", encrypted, "--app_key", appKey,
      "--signature", signature, "--raw_body", rawBody,
    ]);
    const data = parseResult(result);
    assert.deepEqual(data.decrypted, payload);
    assert.equal(data.signatureValid, true);
  });

  test("submitdata without a protocol delimiter is rejected before transport", async () => {
    const fixture = await startFixture({ env: { WJX_API_KEY: "submit-key" } });
    try {
      const result = await fixture.run([
        "--yes", "response", "submit", "--vid", "42", "--inputcosttime", "30", "--submitdata", "1-1",
      ]);
      assert.equal(result.exitCode, 2);
      assert.equal(parseProblem(result).code, "INPUT_ERROR");
      assert.equal(fixture.requests().length, 0);
    } finally {
      await fixture.close();
    }
  });

  test("unknown output format is rejected before an authenticated request", async () => {
    const fixture = await startFixture({ env: { WJX_API_KEY: "format-key" } });
    try {
      const result = await fixture.run(["survey", "list", "--format", "yaml"]);
      assert.equal(result.exitCode, 2);
      assert.equal(parseProblem(result).code, "INPUT_ERROR");
      assert.equal(fixture.requests().length, 0);
    } finally {
      await fixture.close();
    }
  });

  test("survey list derives a fill URL from the API record without exposing vid", async () => {
    const fixture = await startFixture({
      response: {
        result: true,
        data: {
          total_count: 1,
          page_index: 1,
          page_size: 10,
          activitys: {
            "42": {
              vid: 42,
              sid: "short-code",
              activity_domain: "https://tenant.example.test",
              pc_path: "/m/short-code.aspx",
            },
          },
        },
      },
      env: { WJX_API_KEY: "link-key" },
    });
    try {
      const result = await fixture.run(["survey", "list"]);
      const data = parseResult(result);
      const item = data.activitys["42"];
      assert.equal(item.fill_url, "https://tenant.example.test/m/short-code.aspx");
      assert.doesNotMatch(item.fill_url, /42/);
    } finally {
      await fixture.close();
    }
  });

  test("survey list preserves a validated API fill_url when sid is absent", async () => {
    const fixture = await startFixture({
      response: {
        result: true,
        data: {
          total_count: 1,
          page_index: 1,
          page_size: 10,
          activitys: {
            "safe": {
              vid: 42,
              fill_url: "https://tenant.example.test/m/short-code.aspx",
            },
          },
        },
      },
      env: { WJX_API_KEY: "link-key" },
    });
    try {
      const result = await fixture.run(["survey", "list"]);
      const data = parseResult(result);
      assert.equal(data.activitys.safe.fill_url, "https://tenant.example.test/m/short-code.aspx");
    } finally {
      await fixture.close();
    }
  });

  test("survey list prefers the validated API fill_url over sid derivation", async () => {
    const fixture = await startFixture({
      response: {
        result: true,
        data: {
          total_count: 1,
          page_index: 1,
          page_size: 10,
          activitys: {
            "safe": {
              vid: 42,
              sid: "short-code",
              activity_domain: "https://tenant.example.test",
              fill_url: "https://tenant.example.test/jq/server-selected.aspx",
            },
          },
        },
      },
      env: { WJX_API_KEY: "link-key" },
    });
    try {
      const result = await fixture.run(["survey", "list"]);
      const data = parseResult(result);
      assert.equal(data.activitys.safe.fill_url, "https://tenant.example.test/jq/server-selected.aspx");
    } finally {
      await fixture.close();
    }
  });
});
