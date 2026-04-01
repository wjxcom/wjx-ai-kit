import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
    assert.match(out, /0\.1\.0/);
  });

  it("survey --help lists all subcommands", () => {
    const out = run(["survey", "--help"]);
    for (const cmd of ["list", "get", "create", "delete", "status", "settings", "update-settings", "tags", "tag-details", "clear-bin", "upload", "url"]) {
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
    assert.match(out, /Token|验证/);
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
    // Should exit 1 since token is missing
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
    for (const cmd of ["count", "query", "realtime", "download", "submit", "modify", "clear", "report", "files", "winners", "360-report"]) {
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

  it("response files without --file_keys → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["response", "files", "--vid", "123"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.ok(err.message.includes("file_keys"));
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

  it("user-system add-participants without --username → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["user-system", "add-participants"]);
    assert.equal(result.exitCode, 2);
    const err = JSON.parse(result.stderr.trim());
    assert.ok(err.message.includes("username"));
  });

  it("user-system bind without --vid → INPUT_ERROR exit 2", async () => {
    const result = await runFull(["user-system", "bind", "--username", "x", "--sysid", "1", "--uids", "a"]);
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
});
