import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { startFixture } from "./fixtures/http-fixture.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, "..", "dist", "index.js");
// Point to a non-existent config file so tests don't pick up a real ~/.wjxrc
const NO_CONFIG = { WJX_CONFIG_PATH: resolve(__dirname, "..", "__no_such_wjxrc__") };

function run(args, env = {}) {
  return execFileSync("node", [CLI, ...args], {
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 10_000,
  });
}

/** Run and capture both stdout, stderr, and exit code. */
function runFull(args, { env = {}, input, cwd, timeout = 10_000 } = {}) {
  return new Promise((resolve) => {
    const child = execFile("node", [CLI, ...args], {
      env: { ...process.env, ...env },
      cwd,
      encoding: "utf8",
      timeout,
    }, (error, stdout, stderr) => {
      resolve({
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

function parseResultData(serialized) {
  const envelope = JSON.parse(serialized);
  assert.equal(envelope.ok, true, `expected ResultEnvelope, got: ${serialized}`);
  return envelope.data;
}

function parseDryRunData(serialized) {
  const envelope = JSON.parse(serialized);
  assert.equal(envelope.ok, true, `expected dry-run ResultEnvelope, got: ${serialized}`);
  assert.equal(envelope.data.kind, "dry-run");
  assert.ok(Array.isArray(envelope.data.plans));
  return envelope.data;
}

function parseDryRunPlan(result) {
  assert.equal(result.stderr.trim(), "", `dry-run diagnostics should be empty: ${result.stderr}`);
  const data = parseDryRunData(result.stdout);
  assert.ok(
    data.plans.length >= 1,
    `expected at least 1 plan, got ${data.plans.length}`,
  );
  return data.plans[0];
}

function parseProblem(serialized) {
  const envelope = JSON.parse(serialized);
  assert.equal(envelope.ok, false, `expected ProblemEnvelope, got: ${serialized}`);
  assert.ok(envelope.error && typeof envelope.error === "object");
  return { ...envelope.error, exitCode: envelope.exitCode };
}

async function withTempCwd(name, callback) {
  const cwd = resolve(__dirname, `__tmp_${name}__`);
  rmSync(cwd, { recursive: true, force: true });
  mkdirSync(cwd, { recursive: true });
  try {
    return await callback(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

// ═══════════════════════════════════════
// Existing tests (regression)
// ═══════════════════════════════════════

describe("wjx CLI", () => {
  it("shows help", () => {
    const out = run(["--help"]);
    assert.match(out, /问卷星/);
    assert.match(out, /survey/);
  });

  it("shows version", () => {
    const out = run(["--version"]);
    assert.match(out, /\d+\.\d+\.\d+/);
  });

  it("survey --help lists all subcommands", () => {
    const out = run(["survey", "--help"]);
    for (const cmd of ["list", "get", "create", "jsonl-template", "delete", "status", "settings", "update-settings", "tags", "tag-details", "clear-bin", "upload", "url", "preview-url"]) {
      assert.match(out, new RegExp(cmd), `missing subcommand: ${cmd}`);
    }
  });

  it("survey url --mode create returns JSON with url", () => {
    const out = run(["survey", "url", "--mode", "create"]);
    const parsed = parseResultData(out);
    assert.ok(parsed.url);
    assert.match(parsed.url, /sojump|wjx/);
  });

  it("survey preview-url supports sid and source without authentication", () => {
    const parsed = parseResultData(run(["survey", "preview-url", "--sid", "short-code", "--source", "agent"]));
    assert.match(parsed.url, /\/vm\/short-code\.aspx\?source=agent$/);
  });

  it("survey preview-url rejects missing sid and vid", async () => {
    const result = await runFull(["survey", "preview-url"]);
    assert.equal(result.exitCode, 2);
    const error = parseProblem(result.stderr);
    assert.match(error.message, /--sid|--vid/);
  });

  it("exits with error when no api-key provided", async () => {
    const result = await runFull(["survey", "list"], {
      env: { WJX_API_KEY: "", PATH: process.env.PATH, ...NO_CONFIG },
    });
    assert.notEqual(result.exitCode, 0);
  });
});

describe("output formatting", () => {
  it("survey url --format table outputs plain text", () => {
    const out = run(["survey", "url", "--mode", "create", "--format", "table"]);
    assert.doesNotMatch(out, /^\{/);
    assert.match(out, /sojump|wjx/);
  });
});

// ═══════════════════════════════════════
// Phase 2: errors.ts — CliError + stderrJson
// ═══════════════════════════════════════

describe("errors: exit code routing", () => {
  it("AUTH_ERROR → exit 1 + stderr JSON", async () => {
    const result = await runFull(["survey", "list"], {
      env: { WJX_API_KEY: "", PATH: process.env.PATH, ...NO_CONFIG },
    });
    assert.equal(result.exitCode, 1);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "AUTH_ERROR");
    assert.equal(err.exitCode, 1);
    assert.ok(err.message.includes("WJX_API_KEY"));
  });

  it("INPUT_ERROR → exit 2 + stderr JSON (missing --vid)", async () => {
    const result = await runFull(["survey", "get"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.equal(err.exitCode, 2);
    assert.ok(err.message.includes("vid"));
  });

  it("INPUT_ERROR → exit 2 for invalid integer", async () => {
    const result = await runFull(["survey", "get", "--vid", "abc"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("abc"));
  });

  it("INPUT_ERROR → exit 2 for garbage like 123abc", async () => {
    const result = await runFull(["survey", "get", "--vid", "123abc"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("123abc"));
  });

  it("stderr is valid JSON, stdout is empty on error", async () => {
    const result = await runFull(["survey", "list"], {
      env: { WJX_API_KEY: "", PATH: process.env.PATH, ...NO_CONFIG },
    });
    // stdout should be empty on error
    assert.equal(result.stdout.trim(), "");
    // stderr should be valid JSON
    const envelope = JSON.parse(result.stderr.trim());
    assert.equal(envelope.ok, false);
    assert.equal(typeof envelope.error, "object");
    assert.equal(typeof envelope.error.message, "string");
    assert.equal(typeof envelope.error.code, "string");
    assert.equal(typeof envelope.exitCode, "number");
  });
});

// ═══════════════════════════════════════
// Phase 2: --stdin support
// ═══════════════════════════════════════

describe("--stdin support", () => {
  it("--stdin reads JSON from stdin for local command (url)", async () => {
    const result = await runFull(["survey", "url", "--stdin"], {
      input: JSON.stringify({ mode: "create" }),
    });
    assert.equal(result.exitCode, 0);
    const parsed = parseResultData(result.stdout);
    assert.ok(parsed.url);
    assert.match(parsed.url, /sojump|wjx/);
  });

  it("--stdin: CLI args override stdin keys", async () => {
    const result = await runFull(["survey", "url", "--stdin", "--mode", "edit", "--activity", "12345"], {
      input: JSON.stringify({ mode: "create" }),
    });
    assert.equal(result.exitCode, 0);
    const parsed = parseResultData(result.stdout);
    // CLI passed --mode edit, should override stdin mode: create
    assert.ok(parsed.url);
    assert.match(parsed.url, /12345/);
  });

  it("--stdin: empty stdin produces no error", async () => {
    const result = await runFull(["survey", "url", "--stdin", "--mode", "create"], {
      input: "",
    });
    assert.equal(result.exitCode, 0);
    const parsed = parseResultData(result.stdout);
    assert.ok(parsed.url);
  });

  it("--stdin: invalid JSON → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "url", "--stdin"], {
      input: "not-json",
    });
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("parse"));
  });

  it("--stdin: array JSON → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "url", "--stdin"], {
      input: "[1,2,3]",
    });
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("object"));
  });

  it("--stdin: default values do NOT override stdin (source-aware merge)", async () => {
    // url command has default mode="create". If we pass mode="edit" via stdin,
    // the default should NOT override it.
    const result = await runFull(["survey", "url", "--stdin"], {
      input: JSON.stringify({ mode: "edit", activity: 99999 }),
    });
    assert.equal(result.exitCode, 0);
    const parsed = parseResultData(result.stdout);
    // Should use stdin mode="edit" + activity=99999, not default mode="create"
    assert.match(parsed.url, /99999/);
  });
});

// ═══════════════════════════════════════
// Phase 2: requireField validation
// ═══════════════════════════════════════

describe("required field validation (post-merge)", () => {
  it("survey get without --vid → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "get"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
  });

  it("survey delete without --username → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "delete", "--vid", "123"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("username"));
  });

  it("survey status without --state → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "status", "--vid", "123"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("state"));
  });

  it("survey status accepts --status as alias for --state (--dry-run)", async () => {
    const result = await runFull(
      ["--dry-run", "survey", "status", "--vid", "123", "--status", "1"],
      { env: { WJX_API_KEY: "fake-key-1234567890", ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 0);
    const dry = parseDryRunPlan(result);
    const sentBody = JSON.parse(dry.body);
    assert.equal(sentBody.state, 1);
    assert.equal(sentBody.vid, 123);
  });

  it("--stdin can satisfy required fields", async () => {
    // survey get requires --vid, provide it via stdin
    // This will fail with API_ERROR (bad vid) or AUTH_ERROR, but NOT INPUT_ERROR
    const result = await runFull(["survey", "get", "--stdin"], {
      input: JSON.stringify({ vid: 99999999 }),
    });
    // Should not be INPUT_ERROR (exit 2) — should be auth or api error (exit 1)
    if (result.exitCode !== 0) {
      assert.notEqual(result.exitCode, 2, "stdin should satisfy required --vid");
    }
  });
});

// ═══════════════════════════════════════
// Phase 2: --stdin flag recognized
// ═══════════════════════════════════════

describe("--stdin flag", () => {
  it("--stdin is listed in --help", () => {
    const out = run(["--help"]);
    assert.match(out, /--stdin/);
  });
});

// ═══════════════════════════════════════
// Contract tests: output schema
// ═══════════════════════════════════════

describe("contract: error output schema", () => {
  it("error output has all required fields", async () => {
    const result = await runFull(["survey", "list"], {
      env: { WJX_API_KEY: "", PATH: process.env.PATH, ...NO_CONFIG },
    });
    const envelope = JSON.parse(result.stderr.trim());
    // Required Result/Problem envelope fields
    assert.equal(envelope.ok, false);
    assert.equal(typeof envelope.error, "object");
    assert.equal(typeof envelope.error.message, "string");
    assert.ok(envelope.error.message.length > 0);
    assert.ok(["API_ERROR", "INPUT_ERROR", "AUTH_ERROR"].includes(envelope.error.code));
    assert.ok([1, 2].includes(envelope.exitCode));
  });

  it("malformed upstream response without result → API_ERROR exit 1", async () => {
    const fixture = await startFixture({
      response: { data: { rows: [] } },
      env: { WJX_API_KEY: "malformed-response-key" },
    });
    try {
      const result = await fixture.run(["survey", "list"]);
      assert.equal(result.exitCode, 1);
      assert.equal(result.stdout.trim(), "");
      const err = parseProblem(result.stderr);
      assert.equal(err.code, "API_ERROR");
      assert.match(err.message, /result/);
    } finally {
      await fixture.close();
    }
  });
});

describe("contract: success output", () => {
  it("survey url outputs valid JSON with url field", () => {
    const out = run(["survey", "url", "--mode", "create"]);
    const parsed = parseResultData(out);
    assert.equal(typeof parsed.url, "string");
    assert.ok(parsed.url.startsWith("http"));
  });
});

describe("contract: exit codes", () => {
  it("success → exit 0", async () => {
    const result = await runFull(["survey", "url", "--mode", "create"]);
    assert.equal(result.exitCode, 0);
  });

  it("auth error → exit 1", async () => {
    const result = await runFull(["survey", "list"], {
      env: { WJX_API_KEY: "", PATH: process.env.PATH, ...NO_CONFIG },
    });
    assert.equal(result.exitCode, 1);
  });

  it("input error → exit 2", async () => {
    const result = await runFull(["survey", "get", "--vid", "not-a-number"]);
    assert.equal(result.exitCode, 2);
  });
});

// ═══════════════════════════════════════
// Phase 2.5: whoami
// ═══════════════════════════════════════

describe("whoami", () => {
  it("whoami without api-key → AUTH_ERROR exit 1", async () => {
    const result = await runFull(["whoami"], {
      env: { WJX_API_KEY: "", PATH: process.env.PATH, ...NO_CONFIG },
    });
    assert.equal(result.exitCode, 1);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "AUTH_ERROR");
  });

  it("whoami --help shows description", () => {
    const out = run(["whoami", "--help"]);
    assert.match(out, /ApiKey|验证/);
  });
});

// ═══════════════════════════════════════
// Phase 2.5: doctor
// ═══════════════════════════════════════

describe("doctor", () => {
  it("doctor without api-key → reports fail check", async () => {
    const result = await runFull(["doctor"], {
      env: { WJX_API_KEY: "", PATH: process.env.PATH, ...NO_CONFIG },
    });
    // Should exit 1 since api-key is missing
    assert.equal(result.exitCode, 1);
    const parsed = JSON.parse(result.stdout.trim());
    assert.equal(parsed.ok, false);
    // Should have checks array
    assert.ok(Array.isArray(parsed.data.checks));
    // WJX_API_KEY check should be fail
    const tokenCheck = parsed.data.checks.find((c) => c.check === "WJX_API_KEY");
    assert.equal(tokenCheck.status, "fail");
  });

  it("doctor --help shows description", () => {
    const out = run(["doctor", "--help"]);
    assert.match(out, /诊断|环境/);
  });
});

// ═══════════════════════════════════════
// Phase 2.5: response count
// ═══════════════════════════════════════

describe("response count", () => {
  it("response count without --vid → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["response", "count"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("vid"));
  });

  it("response count --vid abc → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["response", "count", "--vid", "abc"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
  });

  it("response --help lists count", () => {
    const out = run(["response", "--help"]);
    assert.match(out, /count/);
  });
});

// ═══════════════════════════════════════
// Phase 2.5: survey export-text
// ═══════════════════════════════════════

describe("survey export-text", () => {
  it("export-text without --vid → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "export-text"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("vid"));
  });

  it("export-text --vid abc → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "export-text", "--vid", "abc"]);
    assert.equal(result.exitCode, 2);
  });

  it("survey --help lists export-text", () => {
    const out = run(["survey", "--help"]);
    assert.match(out, /export-text/);
  });

  it("--stdin can provide vid for export-text", async () => {
    // Will fail with API/AUTH error, but NOT INPUT_ERROR
    const result = await runFull(["survey", "export-text", "--stdin"], {
      input: JSON.stringify({ vid: 99999999 }),
    });
    if (result.exitCode !== 0) {
      assert.notEqual(result.exitCode, 2, "stdin should satisfy required --vid");
    }
  });
});

// ═══════════════════════════════════════
// Phase 3: response module (full)
// ═══════════════════════════════════════

describe("response subcommands", () => {
  it("response --help lists all subcommands", () => {
    const out = run(["response", "--help"]);
    for (const cmd of ["count", "query", "realtime", "download", "submit", "submit-template", "modify", "clear", "report", "winners", "360-report"]) {
      assert.match(out, new RegExp(cmd), `missing subcommand: ${cmd}`);
    }
  });

  it("response query without --vid → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["response", "query"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
  });

  it("response query defaults valid=true and forwards --valid to the API", async () => {
    const fixture = await startFixture({
      response: {
        result: true,
        data: { valid: true, page_index: 1, page_size: 50, total_count: 0, answers: {} },
      },
      env: { WJX_API_KEY: "query-fixture-key" },
    });
    try {
      const defaultResult = await fixture.run(["response", "query", "--vid", "42"]);
      assert.equal(defaultResult.exitCode, 0, defaultResult.stderr);
      assert.equal(JSON.parse(defaultResult.stdout).ok, true);
      const explicitResult = await fixture.run(["response", "query", "--vid", "42", "--valid"]);
      assert.equal(explicitResult.exitCode, 0, explicitResult.stderr);
      assert.equal(JSON.parse(explicitResult.stdout).ok, true);

      const requests = fixture.requests();
      assert.equal(requests.length, 2);
      for (const request of requests) {
        const requestUrl = new URL(request.path, fixture.baseUrl);
        assert.equal(requestUrl.searchParams.get("action"), "1001002");
        const body = JSON.parse(request.body);
        assert.equal(body.valid, true);
      }
    } finally {
      await fixture.close();
    }
  });

  it("response submit without required fields → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["response", "submit", "--vid", "123"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("inputcosttime"));
  });

  it("response modify without --vid → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["response", "modify"]);
    assert.equal(result.exitCode, 2);
  });

  it("response clear without --username → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["response", "clear", "--vid", "123"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("username"));
  });

  it("response submit submitdata 缺 $ → INPUT_ERROR + 修复建议", async () => {
    const result = await runFull(
      ["response", "submit", "--vid", "123", "--inputcosttime", "10", "--submitdata", "1@A|2@B"],
      { env: { WJX_API_KEY: "fake-key-1234567890", ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.match(err.message, /\$|分隔符/);
    assert.match(err.message, /submitdata-file|submit-template/);
  });

  it("response submit --submitdata-file 不存在的路径 → INPUT_ERROR", async () => {
    const result = await runFull(
      ["response", "submit", "--vid", "123", "--inputcosttime", "10", "--submitdata-file", "/tmp/__no_such_submitdata_99887.txt"],
      { env: { WJX_API_KEY: "fake-key-1234567890", ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.match(err.message, /submitdata-file|无法读取/);
  });

  it("response submit 既无 --submitdata 也无 --submitdata-file → INPUT_ERROR", async () => {
    const result = await runFull(
      ["response", "submit", "--vid", "123", "--inputcosttime", "10"],
      { env: { WJX_API_KEY: "fake-key-1234567890", ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.match(err.message, /submitdata/);
  });

  it("response submit --help 含 --submitdata-file 选项", () => {
    const out = run(["response", "submit", "--help"]);
    assert.match(out, /--submitdata-file/);
  });

  it("response submit --help documents service q_index rather than sequential numbering", () => {
    const out = run(["response", "submit", "--help"]);
    assert.match(out, /原始\s+q_index/);
    assert.doesNotMatch(out, /顺序递增/);
  });

  it("response submit-template without --vid → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["response", "submit-template"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("vid"));
  });

  it("response submit-template --dry-run 能走到 getSurvey 请求", async () => {
    const result = await runFull(
      ["response", "submit-template", "--vid", "123", "--dry-run"],
      { env: { WJX_API_KEY: "fake-key-1234567890", ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 0);
    const preview = parseDryRunPlan(result);
    assert.match(preview.url, /action=1000001/);
    const body = JSON.parse(preview.body);
    assert.equal(body.vid, 123);
    assert.equal(body.get_questions, true);
    assert.equal(body.get_items, true);
  });
});

// ═══════════════════════════════════════
// buildSubmitTemplate — unit coverage
// ═══════════════════════════════════════

const { buildSubmitTemplate } = await import(
  pathToFileURL(resolve(__dirname, "..", "dist", "commands", "response.js")).href
);

describe("buildSubmitTemplate", () => {
  it("导出存在", () => {
    assert.equal(typeof buildSubmitTemplate, "function");
  });

  it("单选题生成 1-based 选项序号", () => {
    const r = buildSubmitTemplate([
      { q_index: 1, q_type: 3, q_subtype: 3, q_title: "性别", items: [{ item_index: 1 }, { item_index: 2 }] },
    ]);
    assert.equal(r.submitdata, "1$1");
    assert.equal(r.questions[0].placeholder, "1$1");
  });

  it("多选题用 | 分隔", () => {
    const r = buildSubmitTemplate([
      { q_index: 1, q_type: 4, q_subtype: 4, q_title: "爱好", items: [{ item_index: 1 }, { item_index: 2 }, { item_index: 3 }] },
    ]);
    assert.match(r.submitdata, /^1\$1\|2$/);
  });

  it("排序题 (q_subtype=402) 按名次给所有选项", () => {
    const r = buildSubmitTemplate([
      { q_index: 1, q_type: 4, q_subtype: 402, q_title: "排序", items: [{ item_index: 1 }, { item_index: 2 }, { item_index: 3 }] },
    ]);
    assert.match(r.submitdata, /^1\$1\|2\|3$/);
  });

  it("矩阵单选生成 行!列 的逗号序列", () => {
    const r = buildSubmitTemplate([
      {
        q_index: 1, q_type: 7, q_subtype: 702, q_title: "评估",
        items: [{ item_index: 1 }, { item_index: 2 }, { item_index: 3 }],
        col_items: [{ item_index: 1 }, { item_index: 2 }],
      },
    ]);
    assert.equal(r.submitdata, "1$1!1,2!1,3!1");
  });

  it("矩阵多选用 | 分隔列", () => {
    const r = buildSubmitTemplate([
      {
        q_index: 1, q_type: 7, q_subtype: 703, q_title: "多选矩阵",
        items: [{ item_index: 1 }, { item_index: 2 }],
      },
    ]);
    assert.equal(r.submitdata, "1$1!1|2,2!1|2");
  });

  it("多项填空使用 gap_count 决定占位数", () => {
    const r = buildSubmitTemplate([
      { q_index: 1, q_type: 6, q_subtype: 6, q_title: "姓名地址", gap_count: 3 },
    ]);
    assert.match(r.submitdata, /^1\$__填空1__\|__填空2__\|__填空3__$/);
  });

  it("比重题分值之和为 100", () => {
    const r = buildSubmitTemplate([
      { q_index: 1, q_type: 9, q_title: "预算分配", items: [{ item_index: 1 }, { item_index: 2 }, { item_index: 3 }] },
    ]);
    const value = r.submitdata.slice(2);
    const total = value.split(",")
      .map((seg) => Number(seg.split("!")[1]))
      .reduce((a, b) => a + b, 0);
    assert.equal(total, 100);
  });

  it("跳过分页栏/段落说明，保留原始 q_index（不重排）", () => {
    // 实测验证：submitResponse 要 raw q_index（含元数据占位后的原始编号），
    // 重排 answerable 1-based 反而被服务端拒收"5〒答案不符合要求"。
    const r = buildSubmitTemplate([
      { q_index: 1, q_type: 1, q_title: "分页" },
      { q_index: 2, q_type: 3, q_subtype: 3, q_title: "Q1", items: [{ item_index: 1 }] },
      { q_index: 3, q_type: 2, q_title: "说明" },
      { q_index: 4, q_type: 5, q_title: "Q2" },
    ]);
    const parts = r.submitdata.split("}");
    assert.equal(parts.length, 2);
    assert.match(parts[0], /^2\$/);
    assert.match(parts[1], /^4\$/);
    assert.equal(r.questions.length, 2);
    assert.equal(r.questions[0].q_index, 2);
    assert.equal(r.questions[1].q_index, 4);
  });

  it("矩阵题用 item_rows 决定行数，items 是列", () => {
    // 回归 Bug A：getSurvey 返回的 matrix items 是列（列头），item_rows 才是行。
    const r = buildSubmitTemplate([
      {
        q_index: 3, q_type: 7, q_subtype: 702, q_title: "技能评估",
        // 实际 3 行
        item_rows: [{ item_index: 1 }, { item_index: 2 }, { item_index: 3 }],
        // 实际 4 列
        items: [{ item_index: 1 }, { item_index: 2 }, { item_index: 3 }, { item_index: 4 }],
      },
    ]);
    assert.equal(r.submitdata, "3$1!1,2!1,3!1", "应给 3 行（不是 items 的 4 列）");
  });

  it("填空题给出 __请填写__ 占位", () => {
    const r = buildSubmitTemplate([
      { q_index: 1, q_type: 5, q_title: "建议" },
    ]);
    assert.equal(r.submitdata, "1$__请填写__");
  });

  it("滑动条 q_type=10 给出数字占位", () => {
    const r = buildSubmitTemplate([
      { q_index: 1, q_type: 10, q_title: "满意度" },
    ]);
    assert.equal(r.submitdata, "1$5");
  });
});

// ═══════════════════════════════════════
// Phase 3: contacts module
// ═══════════════════════════════════════

describe("contacts", () => {
  it("contacts --help lists all subcommands", () => {
    const out = run(["contacts", "--help"]);
    for (const cmd of ["query", "add", "delete"]) {
      assert.match(out, new RegExp(cmd), `missing subcommand: ${cmd}`);
    }
  });

  it("contacts query without --uid → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["contacts", "query"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("uid"));
  });

  it("contacts add without --users → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["contacts", "add"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("users"));
  });

  it("contacts delete without --uids → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["contacts", "delete"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("uids"));
  });
});

// ═══════════════════════════════════════
// Phase 3: department module
// ═══════════════════════════════════════

describe("department", () => {
  it("department --help lists all subcommands", () => {
    const out = run(["department", "--help"]);
    for (const cmd of ["list", "add", "modify", "delete"]) {
      assert.match(out, new RegExp(cmd), `missing subcommand: ${cmd}`);
    }
  });

  it("department add without --depts → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["department", "add"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("depts"));
  });

  it("department delete without --type → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["department", "delete", "--depts", "[]"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("type"));
  });

  it("department list without api-key → AUTH_ERROR exit 1", async () => {
    const result = await runFull(["department", "list"], {
      env: { WJX_API_KEY: "", PATH: process.env.PATH, ...NO_CONFIG },
    });
    assert.equal(result.exitCode, 1);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "AUTH_ERROR");
  });
});

// ═══════════════════════════════════════
// Phase 3: admin module
// ═══════════════════════════════════════

describe("admin", () => {
  it("admin --help lists all subcommands", () => {
    const out = run(["admin", "--help"]);
    for (const cmd of ["add", "delete", "restore"]) {
      assert.match(out, new RegExp(cmd), `missing subcommand: ${cmd}`);
    }
  });

  it("admin add without --users → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["admin", "add"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("users"));
  });

  it("admin delete without --uids → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["admin", "delete"]);
    assert.equal(result.exitCode, 2);
  });
});

// ═══════════════════════════════════════
// Phase 3: tag module
// ═══════════════════════════════════════

describe("tag", () => {
  it("tag --help lists all subcommands", () => {
    const out = run(["tag", "--help"]);
    for (const cmd of ["list", "add", "modify", "delete"]) {
      assert.match(out, new RegExp(cmd), `missing subcommand: ${cmd}`);
    }
  });

  it("tag add without --child_names → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["tag", "add"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("child_names"));
  });

  it("tag modify without --tp_id → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["tag", "modify"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("tp_id"));
  });

  it("tag delete without --type → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["tag", "delete", "--tags", "[]"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("type"));
  });
});

// ═══════════════════════════════════════
// Phase 3: user-system module
// ═══════════════════════════════════════

describe("user-system", () => {
  it("user-system --help lists all subcommands", () => {
    const out = run(["user-system", "--help"]);
    for (const cmd of ["add-participants", "modify-participants", "delete-participants", "bind", "query-binding", "query-surveys"]) {
      assert.match(out, new RegExp(cmd), `missing subcommand: ${cmd}`);
    }
  });

  it("user-system add-participants without --users → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["user-system", "add-participants"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("users"));
  });

  it("user-system bind without --vid → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["user-system", "bind", "--sysid", "1", "--uids", "a"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("vid"));
  });
});

// ═══════════════════════════════════════
// Phase 3: account module
// ═══════════════════════════════════════

describe("account", () => {
  it("account --help lists all subcommands", () => {
    const out = run(["account", "--help"]);
    for (const cmd of ["list", "add", "modify", "delete", "restore"]) {
      assert.match(out, new RegExp(cmd), `missing subcommand: ${cmd}`);
    }
  });

  it("account add without --subuser → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["account", "add"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("subuser"));
  });

  it("account delete without --subuser → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["account", "delete"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("subuser"));
  });

  it("account list without api-key → AUTH_ERROR exit 1", async () => {
    const result = await runFull(["account", "list"], {
      env: { WJX_API_KEY: "", PATH: process.env.PATH, ...NO_CONFIG },
    });
    assert.equal(result.exitCode, 1);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "AUTH_ERROR");
  });
});

// ═══════════════════════════════════════
// Phase 3: sso module
// ═══════════════════════════════════════

describe("sso", () => {
  it("sso --help lists all subcommands", () => {
    const out = run(["sso", "--help"]);
    for (const cmd of ["subaccount-url", "user-system-url", "partner-url"]) {
      assert.match(out, new RegExp(cmd), `missing subcommand: ${cmd}`);
    }
  });

  it("sso subaccount-url with --subuser returns JSON with url", () => {
    const out = run(["sso", "subaccount-url", "--subuser", "test123"]);
    // noAuth command, should return URL directly
    assert.match(out, /test123/);
  });

  it("sso subaccount-url without --subuser → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["sso", "subaccount-url"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("subuser"));
  });

  it("sso partner-url with --username returns URL", () => {
    const out = run(["sso", "partner-url", "--username", "partner1"]);
    assert.match(out, /partner1/);
  });

  it("sso user-system-url without required fields → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["sso", "user-system-url", "--u", "admin"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("system_id"));
  });
});

// ═══════════════════════════════════════
// Phase 3: analytics module
// ═══════════════════════════════════════

describe("analytics", () => {
  it("analytics --help lists all subcommands", () => {
    const out = run(["analytics", "--help"]);
    for (const cmd of ["decode", "nps", "csat", "anomalies", "compare", "decode-push"]) {
      assert.match(out, new RegExp(cmd), `missing subcommand: ${cmd}`);
    }
  });

  it("analytics decode with --submitdata returns decoded answers", () => {
    const out = run(["analytics", "decode", "--submitdata", "1$2}2$hello"]);
    const parsed = parseResultData(out);
    assert.ok(Array.isArray(parsed.answers));
    assert.equal(parsed.count, 2);
  });

  it("analytics decode rejects malformed non-empty segments", async () => {
    const result = await runFull(["analytics", "decode", "--submitdata", "1$2}malformed}2$ok"]);
    assert.equal(result.exitCode, 2);
    assert.equal(result.stdout, "");
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.match(err.message, /第 2 段|题序\$答案/);
  });

  it("analytics decode rejects non-positive question indexes", async () => {
    for (const submitdata of ["0$1", "-1$1"]) {
      const result = await runFull(["analytics", "decode", "--submitdata", submitdata]);
      assert.equal(result.exitCode, 2, submitdata);
      assert.equal(result.stdout, "", submitdata);
      const err = parseProblem(result.stderr);
      assert.equal(err.code, "INPUT_ERROR", submitdata);
    }
  });

  it("analytics decode rejects empty submitdata", async () => {
    const result = await runFull(["analytics", "decode", "--submitdata", ""]);
    assert.equal(result.exitCode, 2);
    assert.equal(result.stdout, "");
    assert.equal(parseProblem(result.stderr).code, "INPUT_ERROR");
  });

  it("analytics nps with --scores returns NPS result", () => {
    const out = run(["analytics", "nps", "--scores", "[9,10,7,3,8,10,9]"]);
    const parsed = parseResultData(out);
    assert.equal(typeof parsed.score, "number");
    assert.ok(parsed.total > 0);
  });

  it("analytics csat with --scores returns CSAT result", () => {
    const out = run(["analytics", "csat", "--scores", "[4,5,3,5,2]"]);
    const parsed = parseResultData(out);
    assert.equal(typeof parsed.csat, "number");
  });

  it("analytics anomalies accepts API response fields", () => {
    const responses = JSON.stringify([
      { jid: 1, submitdata: "1$1}2$1}3$1", inputcosttime: 100 },
      { jid: 2, submitdata: "1$2}2$3}3$4", inputcosttime: 100 },
      { jid: 3, submitdata: "1$3}2$3}3$3", inputcosttime: 10 },
      { jid: 4, submitdata: "1$1}2$1}3$1", inputcosttime: 100, ip: "192.168.1.1" },
    ]);
    const out = run(["analytics", "anomalies", "--responses", responses]);
    const parsed = parseResultData(out);
    const flagged = parsed.flagged.find((item) => item.responseId === 3);
    assert.ok(flagged);
    assert.ok(flagged.reasons.includes("straight-lining"));
    assert.ok(flagged.reasons.includes("speed-anomaly"));
  });

  it("analytics decode without --submitdata → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["analytics", "decode"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("submitdata"));
  });

  it("analytics compare without --set_a → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["analytics", "compare"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("set_a"));
  });

  it("analytics compare with valid sets returns comparison", () => {
    const out = run([
      "analytics", "compare",
      "--set_a", '{"score":80,"time":120}',
      "--set_b", '{"score":90,"time":100}',
    ]);
    const parsed = parseResultData(out);
    assert.ok(Array.isArray(parsed.comparisons));
    assert.ok(parsed.comparisons.length > 0);
  });

  it("analytics decode-push without --payload → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["analytics", "decode-push"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.ok(err.message.includes("payload"));
  });
});

// ═══════════════════════════════════════
// survey create
// ═══════════════════════════════════════

describe("survey create", () => {
  it("survey --help lists create", () => {
    const out = run(["survey", "--help"]);
    assert.match(out, /create/);
  });

  it("create without --jsonl or --file → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "create"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("--jsonl") || err.message.includes("--file"));
  });

  it("create --file with nonexistent file → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "create", "--file", "/tmp/__no_such_json_12345.jsonl"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
  });

  it("普通题型默认发布，所有纯框架题型默认草稿", async () => {
    const fixture = await startFixture({ env: { WJX_API_KEY: "publish-default-key" } });
    try {
      const ordinary = [
        { qtype: "问卷基础信息", title: "普通题型发布测试" },
        { qtype: "单选", title: "选择题", select: ["是", "否"] },
      ].map(JSON.stringify).join("\n");
      const ordinaryResult = await fixture.run(["--yes", "survey", "create", "--jsonl", ordinary]);
      assert.equal(ordinaryResult.exitCode, 0, ordinaryResult.stderr);
      assert.equal(JSON.parse(fixture.requests().at(-1).body).publish, true);

      for (const qtype of ["折叠栏目", "轮播图", "AI追问", "AI处理", "AI访谈", "图片OCR", "VlookUp问卷关联", "分页计时器"]) {
        const framework = [
          { qtype: "问卷基础信息", title: `纯框架题草稿测试-${qtype}` },
          { qtype, title: "待编辑的题型" },
        ].map(JSON.stringify).join("\n");
        const frameworkResult = await fixture.run(["--yes", "survey", "create", "--jsonl", framework]);
        assert.equal(frameworkResult.exitCode, 0, `${qtype}: ${frameworkResult.stderr}`);
        assert.equal(JSON.parse(fixture.requests().at(-1).body).publish, false, `${qtype} should default to draft`);
      }
    } finally {
      await fixture.close();
    }
  });

  it("纯框架题型显式 --publish 时允许发布", async () => {
    const fixture = await startFixture({ env: { WJX_API_KEY: "publish-explicit-key" } });
    try {
      const jsonl = [
        { qtype: "问卷基础信息", title: "显式发布测试" },
        { qtype: "轮播图", title: "已准备素材的轮播" },
      ].map(JSON.stringify).join("\n");
      const result = await fixture.run(["--yes", "survey", "create", "--jsonl", jsonl, "--publish"]);
      assert.equal(result.exitCode, 0, result.stderr);
      assert.equal(JSON.parse(fixture.requests().at(-1).body).publish, true);
    } finally {
      await fixture.close();
    }
  });

  it("create --dry-run captures real POST body with atype injected into JSONL", async () => {
    const jsonl = [
      '{"qtype":"问卷基础信息","title":"活动报名表","introduction":"请填写"}',
      '{"qtype":"单选","title":"性别","select":["男","女"]}',
    ].join("\n");
    const result = await runFull(
      ["survey", "create", "--jsonl", jsonl, "--type", "7", "--dry-run"],
      { env: { WJX_API_KEY: "fake-key-1234567890", ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 0);
    const preview = parseDryRunPlan(result);
    assert.equal(preview.method, "POST");
    assert.match(preview.url, /action=1000106/);
    const body = JSON.parse(preview.body);
    assert.equal(body.atype, 7, "顶层 atype 必须为 7");
    assert.equal(body.title, "活动报名表");
    const metaLine = JSON.parse(body.surveydatajson.split("\n")[0]);
    assert.equal(metaLine.qtype, "问卷基础信息");
    assert.equal(metaLine.atype, 7, "JSONL 内首行也必须含 atype=7（服务端实际读取的位置）");
  });

  it("create without api-key → AUTH_ERROR exit 1", async () => {
    const jsonl = '{"qtype":"问卷基础信息","title":"T"}\n{"qtype":"单选","title":"Q","select":["a"]}';
    const result = await runFull(
      ["survey", "create", "--jsonl", jsonl],
      { env: { WJX_API_KEY: "", PATH: process.env.PATH, ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 1);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "AUTH_ERROR");
  });

  it("blank JSONL is a validation error, not an API error", async () => {
    const result = await runFull(["--dry-run", "survey", "create", "--jsonl", " "], { env: NO_CONFIG });
    assert.equal(result.exitCode, 2);
    assert.equal(result.stdout, "");
    const problem = parseProblem(result.stderr);
    assert.equal(problem.code, "INPUT_ERROR");
  });

  it("oversized valid JSONL is rejected before authentication", async () => {
    const jsonl = JSON.stringify({
      qtype: "问卷基础信息",
      title: "超大问卷",
      introduction: "测".repeat(600_000),
    });
    const result = await runFull(["--stdin", "survey", "create"], {
      env: { ...NO_CONFIG, WJX_API_KEY: "" },
      input: JSON.stringify({ jsonl }),
    });
    assert.equal(result.exitCode, 2);
    const problem = parseProblem(result.stderr);
    assert.equal(problem.code, "INPUT_ERROR");
    assert.match(problem.message, /超过上限/);
  });
});

// ═══════════════════════════════════════
// survey jsonl-template
// ═══════════════════════════════════════

describe("survey jsonl-template", () => {
  it("默认 --type 1 输出调查骨架（JSON 包裹）", () => {
    const out = run(["survey", "jsonl-template"]);
    const parsed = parseResultData(out);
    assert.equal(parsed.atype, 1);
    assert.ok(typeof parsed.template === "string" && parsed.template.length > 0);
    const firstLine = parsed.template.trim().split("\n")[0];
    const meta = JSON.parse(firstLine);
    assert.equal(meta.qtype, "问卷基础信息");
    assert.equal(meta.atype, 1);
    assert.ok(meta.title && meta.title.length > 0);
  });

  it("--raw 直接输出 JSONL 文本（不包裹 JSON）", () => {
    const out = run(["survey", "jsonl-template", "--raw"]);
    assert.doesNotMatch(out.trim(), /^\{\s*\n\s*"atype"/); // 不是包裹对象
    const lines = out.trim().split("\n");
    for (const line of lines) {
      assert.doesNotThrow(() => JSON.parse(line), `每行都应是合法 JSON: ${line}`);
    }
    assert.equal(JSON.parse(lines[0]).qtype, "问卷基础信息");
  });

  it("--type 3 输出投票骨架，含投票单选/多选", () => {
    const out = run(["survey", "jsonl-template", "--type", "3", "--raw"]);
    assert.match(out, /投票单选/);
    assert.match(out, /投票多选/);
    const firstLine = out.trim().split("\n")[0];
    assert.equal(JSON.parse(firstLine).atype, 3);
  });

  it("--type 6 输出考试骨架，含 correctselect / quizscore", () => {
    const out = run(["survey", "jsonl-template", "--type", "6", "--raw"]);
    assert.match(out, /考试单选/);
    assert.match(out, /correctselect/);
    assert.match(out, /quizscore/);
    const questionLines = out.trim().split("\n").slice(1).map((line) => JSON.parse(line));
    for (const question of questionLines) {
      assert.equal(question.isquiz, "1", `考试题 ${question.qtype} 必须显式标记 isquiz=1`);
    }
  });

  it("--type 11 输出民主测评骨架", () => {
    const out = run(["survey", "jsonl-template", "--type", "11", "--raw"]);
    const lines = out.trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(lines[0].atype, 11);
    assert.equal(lines[0].qtype, "问卷基础信息");
    assert.ok(lines.some((question) => question.qtype === "矩阵单选"));
  });

  it("--type 99（无效值）→ INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "jsonl-template", "--type", "99"]);
    assert.equal(result.exitCode, 2);
    const err = parseProblem(result.stderr);
    assert.equal(err.code, "INPUT_ERROR");
    assert.match(err.message, /--type|可选值/);
  });

  it("骨架可直接通过 preflight（配合 create --dry-run）", async () => {
    const tmpl = run(["survey", "jsonl-template", "--type", "6", "--raw"]);
    const result = await runFull(
      ["survey", "create", "--jsonl", tmpl, "--dry-run"],
      { env: { WJX_API_KEY: "fake-key-1234567890", ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 0, `dry-run 应成功，stderr=${result.stderr}`);
    const preview = parseDryRunPlan(result);
    const body = JSON.parse(preview.body);
    const examLine = body.surveydatajson
      .split("\n")
      .map((line) => JSON.parse(line))
      .find((question) => question.qtype === "考试单选");
    assert.deepEqual(examLine.correctselect, ["B"]);
    assert.equal(examLine.quizscore, "10");
  });
});

describe("survey list help", () => {
  it("describes time_type according to the API semantics", () => {
    const out = run(["survey", "list", "--help"]);
    assert.match(out, /time_type.*0=.*不按时间查询.*1=.*问卷开始时间.*2=.*问卷创建时间/);
  });
});

// ═══════════════════════════════════════
// reference command
// ═══════════════════════════════════════

describe("reference", () => {
  it("reference is listed in main --help", () => {
    const out = run(["--help"]);
    assert.match(out, /reference/);
  });

  it("reference without topic lists available topics", () => {
    const out = run(["reference"]);
    assert.match(out, /question-types/);
    assert.match(out, /survey/);
    assert.match(out, /response/);
    assert.match(out, /analytics/);
  });

  it("reference dsl is rejected after legacy creation removal", async () => {
    const result = await runFull(["reference", "dsl"]);
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /未知主题/);
  });

  it("reference question-types outputs type mapping", () => {
    const out = run(["reference", "question-types"]);
    assert.match(out, /action 1000106/);
    assert.match(out, /qtype/);
    assert.match(out, /不要填写旧接口的 q_type/);
    assert.match(out, /考试/);
  });

  it("reference survey outputs survey commands", () => {
    const out = run(["reference", "survey"]);
    assert.match(out, /survey list/);
    assert.match(out, /survey create/);
    assert.match(out, /--jsonl/);
    assert.match(out, /--file/);
  });

  it("reference unknown-topic → exit 2", async () => {
    const result = await runFull(["reference", "nonexistent"]);
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /未知主题/);
  });
});

// ═══════════════════════════════════════
// init command
// ═══════════════════════════════════════

describe("init", () => {
  it("init --help shows description", () => {
    const out = run(["init", "--help"]);
    assert.match(out, /初始化|配置|init/);
  });

  it("init is listed in main --help", () => {
    const out = run(["--help"]);
    assert.match(out, /init/);
  });

  it("init --help shows --base-url and --no-install-skill options", () => {
    const out = run(["init", "--help"]);
    assert.match(out, /--base-url/);
    assert.match(out, /--no-install-skill/);
  });

  it("init --help shows --install-ppt-skill option", () => {
    const out = run(["init", "--help"]);
    assert.match(out, /--install-ppt-skill/);
  });

  it("init --api-key saves config (non-interactive)", async () => {
    const tmpDir = resolve(__dirname, "..", "__tmp_init_test__");
    const configPath = resolve(tmpDir, ".wjxrc");
    mkdirSync(tmpDir, { recursive: true });
    try {
      const { exitCode, stderr } = await runFull(
        ["--api-key", "test_key_123", "init", "--no-install-skill"],
        { env: { ...NO_CONFIG, WJX_CONFIG_PATH: configPath } },
      );
      assert.strictEqual(exitCode, 0);
      assert.match(stderr, /已保存/);
      const saved = JSON.parse(readFileSync(configPath, "utf8"));
      assert.strictEqual(saved.apiKey, "test_key_123");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("init --install-ppt-skill takes the ppt branch (without pip dep on test machine)", async () => {
    // 隔离 cwd 防止把 skills/wjx-survey-ppt/ 写到仓库根
    const tmpDir = resolve(__dirname, "..", "__tmp_init_ppt_test__");
    const configPath = resolve(tmpDir, ".wjxrc");
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    try {
      const { exitCode, stderr } = await runFull(
        ["--api-key", "test_key_xyz", "init", "--no-install-skill", "--install-ppt-skill"],
        {
          env: { ...NO_CONFIG, WJX_CONFIG_PATH: configPath },
          cwd: tmpDir,
          timeout: 30_000, // pip 探测可能慢
        },
      );
      assert.strictEqual(exitCode, 0);
      // 走到 ppt 分支的标记：stderr 出现 wjx-survey-ppt 相关字样
      assert.match(stderr, /wjx-survey-ppt/);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("init without --api-key in non-TTY returns a structured auth error", async () => {
    const { exitCode, stderr } = await runFull(
      ["init"],
      { env: NO_CONFIG, input: "" },
    );
    assert.strictEqual(exitCode, 1);
    const err = parseProblem(stderr);
    assert.equal(err.code, "AUTH_ERROR");
    assert.match(err.message, /--api-key/);
  });
});

// ═══════════════════════════════════════
// --dry-run
// ═══════════════════════════════════════

describe("--dry-run", () => {
  it("survey list --dry-run outputs request preview as a result envelope", async () => {
    const result = await runFull(
      ["survey", "list", "--dry-run"],
      { env: { WJX_API_KEY: "test-key-1234567890", ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 0);
    const preview = parseDryRunPlan(result);
    assert.equal(preview.method, "POST");
    assert.match(preview.url, /action=/);
    assert.match(preview.headers.Authorization, /\*\*\*\*/);
    assert.ok(preview.body);
  });

  it("noAuth command dry-run shows input only", async () => {
    const result = await runFull(
      ["sso", "subaccount-url", "--subuser", "test", "--dry-run"],
    );
    assert.equal(result.exitCode, 0);
    const preview = parseDryRunData(result.stdout);
    assert.equal(preview.note, "本地命令，不会发送 API 请求");
    assert.ok(preview.input);
    assert.equal(result.stderr.trim(), "");
  });

  it("dry-run does not make actual API calls", async () => {
    const result = await runFull(
      ["survey", "list", "--dry-run"],
      { env: { WJX_API_KEY: "fake", WJX_BASE_URL: "http://localhost:1", ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 0);
    const preview = parseDryRunPlan(result);
    assert.ok(preview);
  });

  it("dry-run exit code is always 0", async () => {
    const result = await runFull(
      ["survey", "get", "--vid", "123", "--dry-run"],
      { env: { WJX_API_KEY: "fake", ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 0);
  });

  it("--dry-run is listed in main --help", () => {
    const out = run(["--help"]);
    assert.match(out, /dry-run/);
  });

  it("export-text --dry-run outputs request preview", async () => {
    const result = await runFull(
      ["survey", "export-text", "--vid", "123", "--dry-run"],
      { env: { WJX_API_KEY: "fake-key-1234567890", ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 0);
    const preview = parseDryRunPlan(result);
    assert.ok(preview);
    assert.equal(preview.method, "POST");
  });
});

// ═══════════════════════════════════════
// completion
// ═══════════════════════════════════════

describe("completion", () => {
  it("completion bash outputs a bash script", () => {
    const out = run(["completion", "bash"]);
    assert.match(out, /complete.*_wjx_completions.*wjx/);
    assert.match(out, /COMP_WORDS/);
  });

  it("completion zsh outputs a zsh script", () => {
    const out = run(["completion", "zsh"]);
    assert.match(out, /compdef/);
  });

  it("completion fish outputs a fish script", () => {
    const out = run(["completion", "fish"]);
    assert.match(out, /complete -c wjx/);
  });

  it("--get-completions returns top-level commands", async () => {
    const result = await runFull(["--get-completions", "4", "wjx "]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /survey/);
    assert.match(result.stdout, /response/);
    assert.match(result.stdout, /completion/);
  });

  it("--get-completions returns subcommands for survey", async () => {
    const result = await runFull(["--get-completions", "11", "wjx survey "]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /list/);
    assert.match(result.stdout, /get/);
    assert.match(result.stdout, /create/);
  });

  it("--get-completions filters by partial", async () => {
    const result = await runFull(["--get-completions", "7", "wjx sur"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /survey/);
    assert.ok(!result.stdout.includes("response"));
  });

  it("--get-completions returns options when typing --", async () => {
    const result = await runFull(["--get-completions", "20", "wjx survey list --pa"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /--page/);
  });

  it("completion is listed in main --help", () => {
    const out = run(["--help"]);
    assert.match(out, /completion/);
  });
});


// ═══════════════════════════════════════
// skill command
// ═══════════════════════════════════════

describe("skill", () => {
  it("skill --help lists install and update", () => {
    const out = run(["skill", "--help"]);
    assert.match(out, /install/);
    assert.match(out, /update/);
    assert.match(out, /Claude Code/);
  });

  it("skill is listed in main --help", () => {
    const out = run(["--help"]);
    assert.match(out, /skill/);
  });

  it("skill install --silent outputs valid JSON", async () => {
    await withTempCwd("skill_install", async (cwd) => {
      const result = await runFull(["skill", "install", "--force", "--silent"], { cwd });
      const parsed = parseResultData(result.stdout);
      assert.ok(["installed", "updated"].includes(parsed.status));
      assert.match(parsed.version, /\d+\.\d+\.\d+/);
      assert.ok(parsed.files.length > 0);
      assert.match(parsed.message, /已(安装|更新)/);
    });
  });

  it("skill install --silent duplicate returns skipped", async () => {
    await withTempCwd("skill_install_duplicate", async (cwd) => {
      // Ensure installed first
      await runFull(["skill", "install", "--force", "--silent"], { cwd });
      // Try without --force
      const result = await runFull(["skill", "install", "--silent"], { cwd });
      const parsed = parseResultData(result.stdout);
      assert.equal(parsed.status, "skipped");
      assert.match(parsed.message, /已安装/);
    });
  });

  it("skill update --silent outputs valid JSON", async () => {
    await withTempCwd("skill_update", async (cwd) => {
      // Ensure installed first
      await runFull(["skill", "install", "--force", "--silent"], { cwd });
      const result = await runFull(["skill", "update", "--silent"], { cwd });
      const parsed = parseResultData(result.stdout);
      assert.equal(parsed.status, "updated");
      assert.match(parsed.version, /\d+\.\d+\.\d+/);
      assert.ok(parsed.files.length > 0);
    });
  });

  it("skill install --help shows --force and --silent options", () => {
    const out = run(["skill", "install", "--help"]);
    assert.match(out, /--force/);
    assert.match(out, /--silent/);
  });
});

// ═══════════════════════════════════════
// update command
// ═══════════════════════════════════════

describe("update", () => {
  it("update --help shows description", () => {
    const out = run(["update", "--help"]);
    assert.match(out, /自更新|最新版本/);
  });

  it("update is listed in main --help", () => {
    const out = run(["--help"]);
    assert.match(out, /update/);
  });

  it("update --help shows --silent option", () => {
    const out = run(["update", "--help"]);
    assert.match(out, /--silent/);
  });
});
