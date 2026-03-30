import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, "..", "dist", "index.js");

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

  it("exits with error when no token provided", async () => {
    const result = await runFull(["survey", "list"], {
      env: { WJX_TOKEN: "", PATH: process.env.PATH },
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
      env: { WJX_TOKEN: "", PATH: process.env.PATH },
    });
    assert.equal(result.exitCode, 1);
    const err = JSON.parse(result.stderr.trim());
    assert.equal(err.error, true);
    assert.equal(err.code, "AUTH_ERROR");
    assert.equal(err.exitCode, 1);
    assert.ok(err.message.includes("WJX_TOKEN"));
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
      env: { WJX_TOKEN: "", PATH: process.env.PATH },
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
      env: { WJX_TOKEN: "", PATH: process.env.PATH },
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
      env: { WJX_TOKEN: "", PATH: process.env.PATH },
    });
    assert.equal(result.exitCode, 1);
  });

  it("input error → exit 2", async () => {
    const result = await runFull(["survey", "get", "--vid", "not-a-number"]);
    assert.equal(result.exitCode, 2);
  });
});
