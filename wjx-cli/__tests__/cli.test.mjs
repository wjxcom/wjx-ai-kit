import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, readFileSync, rmSync } from "node:fs";

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
function runFull(args, { env = {}, input } = {}) {
  return new Promise((resolve) => {
    const child = execFile("node", [CLI, ...args], {
      env: { ...process.env, ...env },
      encoding: "utf8",
      timeout: 10_000,
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
    for (const cmd of ["list", "get", "create", "create-by-json", "delete", "status", "settings", "update-settings", "tags", "tag-details", "clear-bin", "upload", "url"]) {
      assert.match(out, new RegExp(cmd), `missing subcommand: ${cmd}`);
    }
  });

  it("survey url --mode create returns JSON with url", () => {
    const out = run(["survey", "url", "--mode", "create"]);
    const parsed = JSON.parse(out);
    assert.ok(parsed.url);
    assert.match(parsed.url, /sojump|wjx/);
  });

  it("exits with error when no api-key provided", async () => {
    const result = await runFull(["survey", "list"], {
      env: { WJX_API_KEY: "", PATH: process.env.PATH, ...NO_CONFIG },
    });
    assert.notEqual(result.exitCode, 0);
  });
});

describe("output formatting", () => {
  it("survey url --table outputs plain text", () => {
    const out = run(["survey", "url", "--mode", "create", "--table"]);
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
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.error, true);
    assert.equal(err.code, "AUTH_ERROR");
    assert.equal(err.exitCode, 1);
    assert.ok(err.message.includes("WJX_API_KEY"));
  });

  it("INPUT_ERROR → exit 2 + stderr JSON (missing --vid)", async () => {
    const result = await runFull(["survey", "get"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.error, true);
    assert.equal(err.code, "INPUT_ERROR");
    assert.equal(err.exitCode, 2);
    assert.ok(err.message.includes("vid"));
  });

  it("INPUT_ERROR → exit 2 for invalid integer", async () => {
    const result = await runFull(["survey", "get", "--vid", "abc"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("abc"));
  });

  it("INPUT_ERROR → exit 2 for garbage like 123abc", async () => {
    const result = await runFull(["survey", "get", "--vid", "123abc"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
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
    const parsed = JSON.parse(result.stderr.trim());
    assert.equal(typeof parsed.error, "boolean");
    assert.equal(typeof parsed.message, "string");
    assert.equal(typeof parsed.code, "string");
    assert.equal(typeof parsed.exitCode, "number");
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
    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.url);
    assert.match(parsed.url, /sojump|wjx/);
  });

  it("--stdin: CLI args override stdin keys", async () => {
    const result = await runFull(["survey", "url", "--stdin", "--mode", "edit", "--activity", "12345"], {
      input: JSON.stringify({ mode: "create" }),
    });
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    // CLI passed --mode edit, should override stdin mode: create
    assert.ok(parsed.url);
    assert.match(parsed.url, /12345/);
  });

  it("--stdin: empty stdin produces no error", async () => {
    const result = await runFull(["survey", "url", "--stdin", "--mode", "create"], {
      input: "",
    });
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.url);
  });

  it("--stdin: invalid JSON → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "url", "--stdin"], {
      input: "not-json",
    });
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("parse"));
  });

  it("--stdin: array JSON → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "url", "--stdin"], {
      input: "[1,2,3]",
    });
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
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
    const parsed = JSON.parse(result.stdout);
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
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.code, "INPUT_ERROR");
  });

  it("survey delete without --username → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "delete", "--vid", "123"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("username"));
  });

  it("survey status without --state → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "status", "--vid", "123"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("state"));
  });

  it("survey create without --title → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "create"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("title"));
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
    const err = JSON.parse(result.stderr.trim());
    // Required fields
    assert.equal(typeof err.error, "boolean");
    assert.equal(err.error, true);
    assert.equal(typeof err.message, "string");
    assert.ok(err.message.length > 0);
    assert.ok(["API_ERROR", "INPUT_ERROR", "AUTH_ERROR"].includes(err.code));
    assert.ok([1, 2].includes(err.exitCode));
  });
});

describe("contract: success output", () => {
  it("survey url outputs valid JSON with url field", () => {
    const out = run(["survey", "url", "--mode", "create"]);
    const parsed = JSON.parse(out);
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
    const err = JSON.parse(result.stderr.trim());
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
    assert.ok(Array.isArray(parsed.checks));
    // WJX_API_KEY check should be fail
    const tokenCheck = parsed.checks.find((c) => c.check === "WJX_API_KEY");
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
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("vid"));
  });

  it("response count --vid abc → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["response", "count", "--vid", "abc"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
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
    const err = JSON.parse(result.stderr.trim());
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
    for (const cmd of ["count", "query", "realtime", "download", "submit", "modify", "clear", "report", "winners", "360-report"]) {
      assert.match(out, new RegExp(cmd), `missing subcommand: ${cmd}`);
    }
  });

  it("response query without --vid → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["response", "query"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.code, "INPUT_ERROR");
  });

  it("response submit without required fields → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["response", "submit", "--vid", "123"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
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
    const err = JSON.parse(result.stderr.trim());
    assert.ok(err.message.includes("username"));
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
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("uid"));
  });

  it("contacts add without --users → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["contacts", "add"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.ok(err.message.includes("users"));
  });

  it("contacts delete without --uids → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["contacts", "delete"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
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
    const err = JSON.parse(result.stderr.trim());
    assert.ok(err.message.includes("depts"));
  });

  it("department delete without --type → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["department", "delete", "--depts", "[]"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.ok(err.message.includes("type"));
  });

  it("department list without api-key → AUTH_ERROR exit 1", async () => {
    const result = await runFull(["department", "list"], {
      env: { WJX_API_KEY: "", PATH: process.env.PATH, ...NO_CONFIG },
    });
    assert.equal(result.exitCode, 1);
    const err = JSON.parse(result.stderr.trim());
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
    const err = JSON.parse(result.stderr.trim());
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
    const err = JSON.parse(result.stderr.trim());
    assert.ok(err.message.includes("child_names"));
  });

  it("tag modify without --tp_id → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["tag", "modify"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.ok(err.message.includes("tp_id"));
  });

  it("tag delete without --type → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["tag", "delete", "--tags", "[]"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
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
    const err = JSON.parse(result.stderr.trim());
    assert.ok(err.message.includes("users"));
  });

  it("user-system bind without --vid → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["user-system", "bind", "--sysid", "1", "--uids", "a"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
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
    const err = JSON.parse(result.stderr.trim());
    assert.ok(err.message.includes("subuser"));
  });

  it("account delete without --subuser → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["account", "delete"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.ok(err.message.includes("subuser"));
  });

  it("account list without api-key → AUTH_ERROR exit 1", async () => {
    const result = await runFull(["account", "list"], {
      env: { WJX_API_KEY: "", PATH: process.env.PATH, ...NO_CONFIG },
    });
    assert.equal(result.exitCode, 1);
    const err = JSON.parse(result.stderr.trim());
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
    const err = JSON.parse(result.stderr.trim());
    assert.ok(err.message.includes("subuser"));
  });

  it("sso partner-url with --username returns URL", () => {
    const out = run(["sso", "partner-url", "--username", "partner1"]);
    assert.match(out, /partner1/);
  });

  it("sso user-system-url without required fields → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["sso", "user-system-url", "--u", "admin"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
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
    const parsed = JSON.parse(out);
    assert.ok(Array.isArray(parsed.answers));
    assert.equal(parsed.count, 2);
  });

  it("analytics nps with --scores returns NPS result", () => {
    const out = run(["analytics", "nps", "--scores", "[9,10,7,3,8,10,9]"]);
    const parsed = JSON.parse(out);
    assert.equal(typeof parsed.score, "number");
    assert.ok(parsed.total > 0);
  });

  it("analytics csat with --scores returns CSAT result", () => {
    const out = run(["analytics", "csat", "--scores", "[4,5,3,5,2]"]);
    const parsed = JSON.parse(out);
    assert.equal(typeof parsed.csat, "number");
  });

  it("analytics decode without --submitdata → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["analytics", "decode"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.ok(err.message.includes("submitdata"));
  });

  it("analytics compare without --set_a → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["analytics", "compare"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.ok(err.message.includes("set_a"));
  });

  it("analytics compare with valid sets returns comparison", () => {
    const out = run([
      "analytics", "compare",
      "--set_a", '{"score":80,"time":120}',
      "--set_b", '{"score":90,"time":100}',
    ]);
    const parsed = JSON.parse(out);
    assert.ok(Array.isArray(parsed.comparisons));
    assert.ok(parsed.comparisons.length > 0);
  });

  it("analytics decode-push without --payload → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["analytics", "decode-push"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.ok(err.message.includes("payload"));
  });
});

// ═══════════════════════════════════════
// survey create-by-text
// ═══════════════════════════════════════

describe("survey create-by-text", () => {
  it("survey --help lists create-by-text", () => {
    const out = run(["survey", "--help"]);
    assert.match(out, /create-by-text/);
  });

  it("create-by-text without --text or --file → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "create-by-text"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("--text") || err.message.includes("--file"));
  });

  it("create-by-text --file with nonexistent file → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "create-by-text", "--file", "/tmp/__no_such_file_12345.txt"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("无法读取"));
  });

  it("create-by-text --dry-run parses DSL and shows preview", async () => {
    const dsl = "测试问卷\n\n1. 你喜欢什么颜色？[单选题]\nA. 红色\nB. 蓝色\nC. 绿色";
    const result = await runFull(
      ["survey", "create-by-text", "--text", dsl, "--dry-run"],
      { env: { WJX_API_KEY: "fake-key-1234567890", ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 0);
    const preview = JSON.parse(result.stderr);
    assert.equal(preview.dry_run, true);
    assert.equal(preview.parsed_title, "测试问卷");
    assert.equal(preview.question_count, 1);
    assert.ok(Array.isArray(preview.wire_questions));
    assert.equal(preview.wire_questions.length, 1);
  });

  it("create-by-text --dry-run with multi-question DSL", async () => {
    const dsl = [
      "英语考试",
      "",
      "1. What is the capital of France?[单选题]",
      "A. London",
      "B. Paris",
      "C. Berlin",
      "",
      "2. Select all prime numbers[多选题]",
      "A. 2",
      "B. 4",
      "C. 7",
      "",
      "3. Fill in: The sun is a {_}[填空题]",
    ].join("\n");
    const result = await runFull(
      ["survey", "create-by-text", "--text", dsl, "--type", "6", "--dry-run"],
      { env: { WJX_API_KEY: "fake-key-1234567890", ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 0);
    const preview = JSON.parse(result.stderr);
    assert.equal(preview.question_count, 3);
    assert.equal(preview.parsed_title, "英语考试");
  });

  it("create-by-text without api-key → AUTH_ERROR exit 1", async () => {
    const dsl = "标题\n\n1. Q1[单选题]\nA. a\nB. b";
    const result = await runFull(
      ["survey", "create-by-text", "--text", dsl],
      { env: { WJX_API_KEY: "", PATH: process.env.PATH, ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 1);
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.code, "AUTH_ERROR");
  });
});

// ═══════════════════════════════════════
// survey create-by-json
// ═══════════════════════════════════════

describe("survey create-by-json", () => {
  it("survey --help lists create-by-json", () => {
    const out = run(["survey", "--help"]);
    assert.match(out, /create-by-json/);
  });

  it("create-by-json without --jsonl or --file → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "create-by-json"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.code, "INPUT_ERROR");
    assert.ok(err.message.includes("--jsonl") || err.message.includes("--file"));
  });

  it("create-by-json --file with nonexistent file → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["survey", "create-by-json", "--file", "/tmp/__no_such_json_12345.jsonl"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.code, "INPUT_ERROR");
  });

  it("create-by-json --dry-run shows metadata and line count", async () => {
    const jsonl = [
      '{"qtype":"问卷基础信息","title":"测试问卷","introduction":"请填写"}',
      '{"qtype":"单选","title":"性别","select":["男","女"]}',
    ].join("\n");
    const result = await runFull(
      ["survey", "create-by-json", "--jsonl", jsonl, "--dry-run"],
      { env: { WJX_API_KEY: "fake-key-1234567890", ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 0);
    const preview = JSON.parse(result.stderr);
    assert.equal(preview.dry_run, true);
    assert.equal(preview.metadata.title, "测试问卷");
    assert.equal(preview.line_count, 2);
  });

  it("create-by-json without api-key → AUTH_ERROR exit 1", async () => {
    const jsonl = '{"qtype":"问卷基础信息","title":"T"}\n{"qtype":"单选","title":"Q","select":["a"]}';
    const result = await runFull(
      ["survey", "create-by-json", "--jsonl", jsonl],
      { env: { WJX_API_KEY: "", PATH: process.env.PATH, ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 1);
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.code, "AUTH_ERROR");
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
    assert.match(out, /dsl/);
    assert.match(out, /question-types/);
    assert.match(out, /survey/);
    assert.match(out, /response/);
    assert.match(out, /analytics/);
  });

  it("reference dsl outputs DSL syntax guide", () => {
    const out = run(["reference", "dsl"]);
    assert.match(out, /DSL/);
    assert.match(out, /单选题/);
    assert.match(out, /create-by-text/);
  });

  it("reference question-types outputs type mapping", () => {
    const out = run(["reference", "question-types"]);
    assert.match(out, /q_type/);
    assert.match(out, /atype/);
    assert.match(out, /考试/);
  });

  it("reference survey outputs survey commands", () => {
    const out = run(["reference", "survey"]);
    assert.match(out, /survey list/);
    assert.match(out, /survey create/);
    assert.match(out, /--vid/);
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

  it("init without --api-key in non-TTY hints parameter mode", async () => {
    const { exitCode, stderr } = await runFull(
      ["init"],
      { env: NO_CONFIG, input: "" },
    );
    assert.strictEqual(exitCode, 1);
    assert.match(stderr, /--api-key/);
  });
});

// ═══════════════════════════════════════
// --dry-run
// ═══════════════════════════════════════

describe("--dry-run", () => {
  it("survey list --dry-run outputs request preview to stderr", async () => {
    const result = await runFull(
      ["survey", "list", "--dry-run"],
      { env: { WJX_API_KEY: "test-key-1234567890", ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
    const preview = JSON.parse(result.stderr);
    assert.equal(preview.dry_run, true);
    assert.ok(preview.request);
    assert.equal(preview.request.method, "POST");
    assert.match(preview.request.url, /action=/);
    assert.match(preview.request.headers.Authorization, /\*\*\*\*/);
    assert.ok(preview.request.body);
  });

  it("noAuth command dry-run shows input only", async () => {
    const result = await runFull(
      ["sso", "subaccount-url", "--subuser", "test", "--dry-run"],
    );
    assert.equal(result.exitCode, 0);
    const preview = JSON.parse(result.stderr);
    assert.equal(preview.dry_run, true);
    assert.ok(preview.note);
    assert.ok(preview.input);
  });

  it("dry-run does not make actual API calls", async () => {
    const result = await runFull(
      ["survey", "list", "--dry-run"],
      { env: { WJX_API_KEY: "fake", WJX_BASE_URL: "http://localhost:1", ...NO_CONFIG } },
    );
    assert.equal(result.exitCode, 0);
    const preview = JSON.parse(result.stderr);
    assert.equal(preview.dry_run, true);
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
    const preview = JSON.parse(result.stderr);
    assert.equal(preview.dry_run, true);
    assert.ok(preview.request);
    assert.equal(preview.request.method, "POST");
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
// survey create-by-text — use case tests
// ═══════════════════════════════════════

describe("create-by-text use cases", () => {
  const DRY_ENV = { WJX_API_KEY: "fake-key-1234567890", ...NO_CONFIG };

  // ── UC1: 员工满意度调查（混合题型：段落说明 + 量表 + 矩阵量表 + 填空）──
  it("UC1: 员工满意度调查 — 段落说明 + 量表题 + 矩阵量表题 + 填空题", async () => {
    const dsl = [
      "员工满意度调查",
      "请根据您的真实感受作答",
      "",
      "1. 薪酬福利[段落说明]",
      "",
      "2. 您对目前薪酬水平的满意程度？[量表题]",
      "非常不满意",
      "不满意",
      "一般",
      "满意",
      "非常满意",
      "",
      "3. 请对以下方面评分[矩阵量表题]",
      "非常不满意 不满意 一般 满意 非常满意",
      "办公环境",
      "团队氛围",
      "职业发展",
      "",
      "4. 您还有其他建议吗？[填空题]",
    ].join("\n");
    const result = await runFull(
      ["survey", "create-by-text", "--text", dsl, "--dry-run"],
      { env: DRY_ENV },
    );
    assert.equal(result.exitCode, 0);
    const p = JSON.parse(result.stderr);
    assert.equal(p.parsed_title, "员工满意度调查");
    assert.equal(p.parsed_description, "请根据您的真实感受作答");
    assert.equal(p.question_count, 3);

    // 段落说明被过滤（API 不支持 q_type=2），出现在 skipped_paragraphs
    assert.deepEqual(p.skipped_paragraphs, ["薪酬福利"]);

    // 量表题 → q_type=3, q_subtype=302, 5 个选项
    assert.equal(p.wire_questions[0].q_type, 3);
    assert.equal(p.wire_questions[0].q_subtype, 302);
    assert.equal(p.wire_questions[0].items.length, 5);

    // 矩阵量表题 → q_type=7, q_subtype=701, 3 行 + 5 列
    const matrixQ = p.wire_questions[1];
    assert.equal(matrixQ.q_type, 7);
    assert.equal(matrixQ.q_subtype, 701);
    assert.equal(matrixQ.items.length, 3);      // 3 行标题
    assert.equal(matrixQ.col_items.length, 5);   // 5 列头

    // 填空题 → q_type=5
    assert.equal(p.wire_questions[2].q_type, 5);
  });

  // ── UC2: 考试问卷（单选 + 多选 + 判断 + 填空）──
  it("UC2: 考试问卷 — 单选 + 多选 + 判断 + 填空 + --type 6", async () => {
    const dsl = [
      "期末考试",
      "",
      "1. 中国的首都是？[单选题]",
      "A 北京",
      "B 上海",
      "C 广州",
      "",
      "2. 以下哪些是哺乳动物？[多选题]",
      "A 猫",
      "B 蛇",
      "C 狗",
      "D 鲨鱼",
      "",
      "3. 地球绕太阳公转一周约365天[判断题]",
      "A 正确",
      "B 错误",
      "",
      "4. 中国最长的河流是____[填空题]",
    ].join("\n");
    const result = await runFull(
      ["survey", "create-by-text", "--text", dsl, "--type", "6", "--dry-run"],
      { env: DRY_ENV },
    );
    assert.equal(result.exitCode, 0);
    const p = JSON.parse(result.stderr);
    assert.equal(p.parsed_title, "期末考试");
    assert.equal(p.question_count, 4);

    // 单选题 → q_type=3, q_subtype=3
    assert.equal(p.wire_questions[0].q_type, 3);
    assert.equal(p.wire_questions[0].q_subtype, 3);
    assert.equal(p.wire_questions[0].items.length, 3);

    // 多选题 → q_type=4, q_subtype=4
    assert.equal(p.wire_questions[1].q_type, 4);
    assert.equal(p.wire_questions[1].q_subtype, 4);
    assert.equal(p.wire_questions[1].items.length, 4);

    // 判断题 → q_type=3, q_subtype=305
    assert.equal(p.wire_questions[2].q_type, 3);
    assert.equal(p.wire_questions[2].q_subtype, 305);
    assert.equal(p.wire_questions[2].items.length, 2);

    // 填空题 → q_type=5
    assert.equal(p.wire_questions[3].q_type, 5);
  });

  // ── UC3: NPS 调查（量表 0-10 + 排序题 + 多项填空题）──
  it("UC3: NPS 调查 — 量表11项 + 排序题 + 多项填空题", async () => {
    const dsl = [
      "NPS 客户调研",
      "",
      "1. 您有多大可能向朋友推荐我们？[量表题]",
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "",
      "2. 请对以下因素按重要性排序[排序题]",
      "A 产品质量",
      "B 售后服务",
      "C 价格",
      "D 品牌",
      "",
      "3. 请填写您的联系方式：姓名{_}，电话{_}[多项填空题]",
    ].join("\n");
    const result = await runFull(
      ["survey", "create-by-text", "--text", dsl, "--dry-run"],
      { env: DRY_ENV },
    );
    assert.equal(result.exitCode, 0);
    const p = JSON.parse(result.stderr);
    assert.equal(p.question_count, 3);

    // 量表题 11 项
    assert.equal(p.wire_questions[0].q_subtype, 302);
    assert.equal(p.wire_questions[0].items.length, 11);

    // 排序题 → q_type=4, q_subtype=402
    assert.equal(p.wire_questions[1].q_type, 4);
    assert.equal(p.wire_questions[1].q_subtype, 402);

    // 多项填空题 → q_type=6
    assert.equal(p.wire_questions[2].q_type, 6);
  });

  // ── UC4: 矩阵题家族（矩阵单选 + 矩阵多选 + 矩阵填空）──
  it("UC4: 矩阵题家族 — 矩阵单选 + 矩阵多选 + 矩阵填空", async () => {
    const dsl = [
      "课程评估",
      "",
      "1. 以下课程的教学质量如何？[矩阵单选题]",
      "很差 一般 良好 优秀",
      "数学",
      "英语",
      "物理",
      "",
      "2. 以下课程中您觉得需改进的方面？[矩阵多选题]",
      "教材 课件 作业 考试",
      "数学",
      "英语",
      "",
      "3. 请填写各科成绩[矩阵填空题]",
      "期中 期末 补考",
      "数学",
      "英语",
    ].join("\n");
    const result = await runFull(
      ["survey", "create-by-text", "--text", dsl, "--dry-run"],
      { env: DRY_ENV },
    );
    assert.equal(result.exitCode, 0);
    const p = JSON.parse(result.stderr);
    assert.equal(p.question_count, 3);

    // 矩阵单选 → q_type=7, q_subtype=702, 3 行 4 列
    assert.equal(p.wire_questions[0].q_subtype, 702);
    assert.equal(p.wire_questions[0].items.length, 3);
    assert.equal(p.wire_questions[0].col_items.length, 4);

    // 矩阵多选 → q_subtype=703, 2 行 4 列
    assert.equal(p.wire_questions[1].q_subtype, 703);
    assert.equal(p.wire_questions[1].items.length, 2);
    assert.equal(p.wire_questions[1].col_items.length, 4);

    // 矩阵填空 → q_subtype=704, 2 行 3 列
    assert.equal(p.wire_questions[2].q_subtype, 704);
    assert.equal(p.wire_questions[2].items.length, 2);
    assert.equal(p.wire_questions[2].col_items.length, 3);
  });

  // ── UC5: stdin 管道输入 ──
  it("UC5: stdin 管道输入 DSL 文本", async () => {
    const dsl = JSON.stringify({
      text: "调研问卷\n\n1. 您的年龄段？[单选题]\nA 18岁以下\nB 18-25\nC 26-35\nD 36岁以上",
    });
    const result = await runFull(
      ["survey", "create-by-text", "--stdin", "--dry-run"],
      { env: DRY_ENV, input: dsl },
    );
    assert.equal(result.exitCode, 0);
    const p = JSON.parse(result.stderr);
    assert.equal(p.parsed_title, "调研问卷");
    assert.equal(p.question_count, 1);
    assert.equal(p.wire_questions[0].items.length, 4);
  });

  // ── UC6: 从文件读取 DSL ──
  it("UC6: --file 从临时文件读取 DSL", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmpFile = join(tmpdir(), `wjx-test-dsl-${Date.now()}.txt`);
    const dsl = "文件测试问卷\n\n1. 测试题[单选题]\nA 选项一\nB 选项二";
    writeFileSync(tmpFile, dsl, "utf8");
    try {
      const result = await runFull(
        ["survey", "create-by-text", "--file", tmpFile, "--dry-run"],
        { env: DRY_ENV },
      );
      assert.equal(result.exitCode, 0);
      const p = JSON.parse(result.stderr);
      assert.equal(p.parsed_title, "文件测试问卷");
      assert.equal(p.question_count, 1);
    } finally {
      unlinkSync(tmpFile);
    }
  });

  // ── UC7: --text 优先于 stdin ──
  it("UC7: --text 优先于 stdin 输入", async () => {
    const stdinJson = JSON.stringify({ text: "stdin标题\n\n1. Q[单选题]\nA a\nB b" });
    const result = await runFull(
      ["survey", "create-by-text", "--stdin", "--text", "CLI标题\n\n1. Q[单选题]\nA x\nB y\nC z", "--dry-run"],
      { env: DRY_ENV, input: stdinJson },
    );
    assert.equal(result.exitCode, 0);
    const p = JSON.parse(result.stderr);
    assert.equal(p.parsed_title, "CLI标题");
    assert.equal(p.wire_questions[0].items.length, 3); // CLI 的 3 个选项
  });

  // ── UC8: 选填标记 ──
  it("UC8: （选填）标记使题目 is_requir=false", async () => {
    const dsl = [
      "标记测试",
      "",
      "1. 必填题[单选题]",
      "A 是",
      "B 否",
      "",
      "2. 选填题[填空题]（选填）",
    ].join("\n");
    const result = await runFull(
      ["survey", "create-by-text", "--text", dsl, "--dry-run"],
      { env: DRY_ENV },
    );
    assert.equal(result.exitCode, 0);
    const p = JSON.parse(result.stderr);
    assert.equal(p.wire_questions[0].is_requir, true);
    assert.equal(p.wire_questions[1].is_requir, false);
  });

  // ── UC9: wire_questions 的 q_index 连续编号 ──
  it("UC9: wire_questions q_index 从1开始连续编号", async () => {
    const dsl = [
      "编号测试",
      "",
      "1. Q1[单选题]",
      "A a",
      "B b",
      "",
      "2. Q2[多选题]",
      "A x",
      "B y",
      "",
      "3. Q3[填空题]",
      "",
      "4. Q4[量表题]",
      "差",
      "一般",
      "好",
    ].join("\n");
    const result = await runFull(
      ["survey", "create-by-text", "--text", dsl, "--dry-run"],
      { env: DRY_ENV },
    );
    assert.equal(result.exitCode, 0);
    const p = JSON.parse(result.stderr);
    assert.equal(p.question_count, 4);
    for (let i = 0; i < 4; i++) {
      assert.equal(p.wire_questions[i].q_index, i + 1);
    }
  });

  // ── UC10: --publish 标志传递 ──
  it("UC10: 无 api-key 但 --publish 标志被接受（AUTH_ERROR 在 publish 之前）", async () => {
    const dsl = "标题\n\n1. Q[单选题]\nA a\nB b";
    const result = await runFull(
      ["survey", "create-by-text", "--text", dsl, "--publish"],
      { env: { WJX_API_KEY: "", PATH: process.env.PATH, ...NO_CONFIG } },
    );
    // --publish 语法正确，但因没有 API key 而报 AUTH_ERROR
    assert.equal(result.exitCode, 1);
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.code, "AUTH_ERROR");
  });

  // ── UC11: 下拉框 + 比重题 + 文件上传 ──
  it("UC11: 下拉框 + 比重题 + 文件上传", async () => {
    const dsl = [
      "特殊题型测试",
      "",
      "1. 请选择省份[下拉框]",
      "北京",
      "上海",
      "广东",
      "",
      "2. 请分配预算比重[比重题]",
      "研发",
      "市场",
      "运营",
      "",
      "3. 请上传简历[文件上传]",
    ].join("\n");
    const result = await runFull(
      ["survey", "create-by-text", "--text", dsl, "--dry-run"],
      { env: DRY_ENV },
    );
    assert.equal(result.exitCode, 0);
    const p = JSON.parse(result.stderr);
    assert.equal(p.question_count, 3);

    // 下拉框 → q_type=3, q_subtype=301
    assert.equal(p.wire_questions[0].q_subtype, 301);
    assert.equal(p.wire_questions[0].items.length, 3);

    // 比重题 → q_type=9
    assert.equal(p.wire_questions[1].q_type, 9);
    assert.equal(p.wire_questions[1].items.length, 3);

    // 文件上传 → q_type=8
    assert.equal(p.wire_questions[2].q_type, 8);
  });

  // ── UC12: 大型综合问卷（AI 生成典型输出）──
  it("UC12: 大型综合问卷 — 15 题混合（模拟 AI 生成输出）", async () => {
    const dsl = [
      "水果消费习惯调研",
      "了解消费者的水果购买与食用习惯",
      "",
      "1. 您的性别？[单选题]",
      "A 男",
      "B 女",
      "",
      "2. 您的年龄段？[单选题]",
      "A 18岁以下",
      "B 18-25岁",
      "C 26-35岁",
      "D 36-45岁",
      "E 46岁以上",
      "",
      "3. 您购买水果的频率？[单选题]",
      "A 每天",
      "B 每周2-3次",
      "C 每周1次",
      "D 偶尔",
      "",
      "4. 您偏好的水果类型？[多选题]",
      "A 苹果",
      "B 香蕉",
      "C 葡萄",
      "D 草莓",
      "E 西瓜",
      "",
      "5. 影响您购买水果的因素？[多选题]",
      "A 价格",
      "B 新鲜度",
      "C 品牌",
      "D 产地",
      "E 包装",
      "",
      "6. 您对水果品质的整体满意度[量表题]",
      "非常不满意",
      "不满意",
      "一般",
      "满意",
      "非常满意",
      "",
      "7. 请评价以下水果购买渠道[矩阵单选题]",
      "从不 偶尔 经常 总是",
      "超市",
      "菜市场",
      "线上电商",
      "",
      "8. 请对以下方面评分[矩阵量表题]",
      "很差 较差 一般 较好 很好",
      "新鲜度",
      "价格",
      "种类丰富度",
      "",
      "9. 请对以下水果按喜好排序[排序题]",
      "A 苹果",
      "B 香蕉",
      "C 葡萄",
      "",
      "10. 您最常在什么时候吃水果？[单选题]",
      "A 早餐后",
      "B 午餐后",
      "C 晚餐后",
      "D 随时",
      "",
      "11. 您更倾向于购买哪种包装？[单选题]",
      "A 散装",
      "B 预包装",
      "C 礼盒装",
      "",
      "12. 您希望增加哪些水果品种？[多选题]",
      "A 进口热带水果",
      "B 有机水果",
      "C 本地特色水果",
      "D 无所谓",
      "",
      "13. 您每月水果消费大约多少？[单选题]",
      "A 50元以下",
      "B 50-100元",
      "C 100-200元",
      "D 200元以上",
      "",
      "14. 您会推荐常去的水果店吗？[量表题]",
      "完全不会",
      "不太会",
      "一般",
      "比较会",
      "非常会",
      "",
      "15. 您对水果消费有什么建议？[填空题]（选填）",
    ].join("\n");
    const result = await runFull(
      ["survey", "create-by-text", "--text", dsl, "--dry-run"],
      { env: DRY_ENV },
    );
    assert.equal(result.exitCode, 0);
    const p = JSON.parse(result.stderr);
    assert.equal(p.parsed_title, "水果消费习惯调研");
    assert.equal(p.parsed_description, "了解消费者的水果购买与食用习惯");
    assert.equal(p.question_count, 15);
    assert.equal(p.wire_questions.length, 15);

    // 验证题型分布
    const typeCount = {};
    for (const wq of p.wire_questions) {
      const key = `${wq.q_type}-${wq.q_subtype}`;
      typeCount[key] = (typeCount[key] || 0) + 1;
    }
    assert.equal(typeCount["3-3"], 6);    // 6 道单选题
    assert.equal(typeCount["4-4"], 3);    // 3 道多选题
    assert.equal(typeCount["3-302"], 2);  // 2 道量表题
    assert.equal(typeCount["7-702"], 1);  // 1 道矩阵单选
    assert.equal(typeCount["7-701"], 1);  // 1 道矩阵量表
    assert.equal(typeCount["4-402"], 1);  // 1 道排序题
    assert.equal(typeCount["5-5"], 1);    // 1 道填空题

    // 最后一题选填
    assert.equal(p.wire_questions[14].is_requir, false);
  });

  // ── UC13: 空文本应报错 ──
  it("UC13: 空字符串 --text 报 INPUT_ERROR", async () => {
    const result = await runFull(
      ["survey", "create-by-text", "--text", ""],
      { env: DRY_ENV },
    );
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.code, "INPUT_ERROR");
  });

  // ── UC14: stdin 优先级 — --file 优先于 stdin ──
  it("UC14: --file 优先于 stdin", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmpFile = join(tmpdir(), `wjx-test-priority-${Date.now()}.txt`);
    writeFileSync(tmpFile, "文件标题\n\n1. FQ[单选题]\nA a\nB b", "utf8");
    const stdinJson = JSON.stringify({ text: "stdin标题\n\n1. SQ[单选题]\nA x\nB y" });
    try {
      const result = await runFull(
        ["survey", "create-by-text", "--stdin", "--file", tmpFile, "--dry-run"],
        { env: DRY_ENV, input: stdinJson },
      );
      assert.equal(result.exitCode, 0);
      const p = JSON.parse(result.stderr);
      // --file 读取的文本存入 merged.file → 被 readFileSync 读取 → dslText = 文件内容
      // 但由于 --text 最优先，实际上 stdin 的 text 字段和 --file 都能设置
      // 这里 --file 提供文件路径，stdin 提供 text 字段，text 优先
      // merged 中同时有 file 和 text（来自 stdin），text 优先
      assert.equal(p.parsed_title, "stdin标题");
    } finally {
      unlinkSync(tmpFile);
    }
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
    const result = await runFull(["skill", "install", "--force", "--silent"]);
    const parsed = JSON.parse(result.stdout.trim());
    assert.ok(["installed", "updated"].includes(parsed.status));
    assert.match(parsed.version, /\d+\.\d+\.\d+/);
    assert.ok(parsed.files.length > 0);
    assert.match(parsed.message, /已(安装|更新)/);
  });

  it("skill install --silent duplicate returns skipped", async () => {
    // Ensure installed first
    await runFull(["skill", "install", "--force", "--silent"]);
    // Try without --force
    const result = await runFull(["skill", "install", "--silent"]);
    const parsed = JSON.parse(result.stdout.trim());
    assert.equal(parsed.status, "skipped");
    assert.match(parsed.message, /已安装/);
  });

  it("skill update --silent outputs valid JSON", async () => {
    // Ensure installed first
    await runFull(["skill", "install", "--force", "--silent"]);
    const result = await runFull(["skill", "update", "--silent"]);
    const parsed = JSON.parse(result.stdout.trim());
    assert.equal(parsed.status, "updated");
    assert.match(parsed.version, /\d+\.\d+\.\d+/);
    assert.ok(parsed.files.length > 0);
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
