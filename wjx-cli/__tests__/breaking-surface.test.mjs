import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.js");
const NO_CONFIG = { WJX_CONFIG_PATH: resolve(dirname(fileURLToPath(import.meta.url)), "..", "__breaking_surface_no_config__") };

function runCli(args) {
  return new Promise((done) => {
    execFile(process.execPath, [CLI, ...args], {
      env: { ...process.env, ...NO_CONFIG },
      encoding: "utf8",
      timeout: 10_000,
    }, (error, stdout, stderr) => done({
      code: error ? error.code ?? 1 : 0,
      stdout: stdout || "",
      stderr: stderr || "",
    }));
  });
}

function parseProblem(result) {
  assert.notEqual(result.code, 0, result.stdout || result.stderr);
  assert.equal(result.stdout.trim(), "");
  const envelope = JSON.parse(result.stderr);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error.code, "INPUT_ERROR");
  return envelope.error;
}

test("removed output aliases are rejected while --format table remains supported", async () => {
  for (const alias of ["--json", "--table"]) {
    const result = await runCli(["survey", "url", "--mode", "create", alias]);
    parseProblem(result);
    assert.match(result.stderr, new RegExp(alias.replace("--", "\\-\\-")));
  }

  const table = await runCli(["survey", "url", "--mode", "create", "--format", "table"]);
  assert.equal(table.code, 0, table.stderr);
  assert.equal(table.stderr.trim(), "");
  assert.doesNotMatch(table.stdout, /^\{/);
});

test("removed output aliases are absent from root and command help", async () => {
  for (const args of [[], ["survey"], ["survey", "create"]]) {
    const result = await runCli([...args, "--help"]);
    assert.equal(result.code, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /--json(?:\s|,|$)/);
    assert.doesNotMatch(result.stdout, /--table(?:\s|,|$)/);
  }
});

test("survey creation uses the standard create command only", async () => {
  const help = await runCli(["survey", "--help"]);
  assert.equal(help.code, 0, help.stderr);
  assert.match(help.stdout, /create\s+\[options\]/);
  assert.doesNotMatch(help.stdout, /create-by-json|create-by-text/);

  for (const legacyName of ["create-by-json", "create-by-text"]) {
    const legacy = await runCli(["survey", legacyName]);
    parseProblem(legacy);
  }

  const catalog = await runCli(["schema", "survey.create"]);
  assert.equal(catalog.code, 0, catalog.stderr);
  assert.match(catalog.stdout, /survey\.create/);
  assert.doesNotMatch(catalog.stdout, /survey\.create-by-json/);
});
