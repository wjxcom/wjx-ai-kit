import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, "..", "dist", "index.js");
const COMMAND_SOURCE = resolve(__dirname, "..", "src", "commands");

function runCli(args) {
  return new Promise((done) => {
    execFile(process.execPath, [CLI, ...args], {
      env: {
        ...process.env,
        WJX_CONFIG_PATH: resolve(__dirname, "..", "__surface_eval_no_config__"),
      },
      encoding: "utf8",
      timeout: 15_000,
    }, (error, stdout, stderr) => {
      done({ code: error ? (typeof error.code === "number" ? error.code : 1) : 0, stdout, stderr });
    });
  });
}

const helpCache = new Map();
function runHelp(args) {
  const key = JSON.stringify(args);
  if (!helpCache.has(key)) helpCache.set(key, runCli([...args, "--help"]));
  return helpCache.get(key);
}

function commandSection(help) {
  const start = help.indexOf("Commands:");
  if (start < 0) return [];
  const lines = help.slice(start + "Commands:".length).replace(/^\r?\n/, "").split(/\r?\n/);
  const commands = [];
  for (const line of lines) {
    if (!line.trim()) break;
    const match = line.match(/^\s{2}([a-z0-9][a-z0-9-]*)(?:\s|$)/);
    if (match && match[1] !== "help") commands.push(match[1]);
  }
  return commands;
}

function optionSection(help) {
  const start = help.indexOf("Options:");
  if (start < 0) return [];
  const lines = help.slice(start + "Options:".length).replace(/^\r?\n/, "").split(/\r?\n/);
  const options = [];
  for (const line of lines) {
    if (!line.trim()) break;
    // Commander wraps long descriptions on indented continuation lines. Only
    // the two-space option definition line is part of the surface inventory.
    const match = line.match(/^\s{2}(?:-[A-Za-z],\s*)?(--[a-zA-Z0-9_-]+)(?:\s+<([^>]+)>)?/);
    if (match) options.push({ name: match[1], valueName: match[2] });
  }
  return options;
}

function valueFor(valueName) {
  if (!valueName) return undefined;
  if (valueName === "json") return "{}";
  if (valueName === "n") return "1";
  if (valueName === "path") return ".";
  if (valueName === "format") return "json";
  if (valueName === "service") return "default";
  if (valueName === "action") return "survey.list";
  if (valueName === "url") return "https://example.test/";
  return "surface-test";
}

let leavesPromise;

async function discoverLeaves() {
  if (leavesPromise) return leavesPromise;
  leavesPromise = (async () => {
  const root = await runHelp([]);
  assert.equal(root.code, 0, root.stderr);
  const leaves = [];
  for (const command of commandSection(root.stdout)) {
    const result = await runHelp([command]);
    assert.equal(result.code, 0, `${command}: ${result.stderr}`);
    const children = commandSection(result.stdout);
    if (children.length === 0) {
      leaves.push([command]);
    } else {
      for (const child of children) {
        const leaf = await runHelp([command, child]);
        assert.equal(leaf.code, 0, `${command} ${child}: ${leaf.stderr}`);
        leaves.push([command, child]);
      }
    }
  }
  return leaves;
  })();
  return leavesPromise;
}

test("CLI surface inventory discovers every leaf command", async () => {
  const leaves = await discoverLeaves();
  assert.equal(leaves.length, 75, `unexpected leaf count: ${leaves.map((item) => item.join(" ")).join(", ")}`);
  assert.equal(new Set(leaves.map((item) => item.join(".")).sort()).size, 75);
});

test("every source-declared option is exposed by at least one command help", async () => {
  const sourceFiles = (await readFile(resolve(__dirname, "..", "src", "index.ts"), "utf8"))
    + (await readFile(resolve(__dirname, "..", "src", "cli.ts"), "utf8"))
    + (await readFile(resolve(COMMAND_SOURCE, "survey.ts"), "utf8"))
    + (await Promise.all([
      "account.ts", "admin.ts", "analytics.ts", "api.ts", "completion.ts", "contacts.ts",
      "department.ts", "diagnostics.ts", "init.ts", "reference.ts", "response.ts", "schema.ts",
      "skill.ts", "sso.ts", "tag.ts", "update.ts", "user-system.ts",
    ].map((file) => readFile(resolve(COMMAND_SOURCE, file), "utf8")))).join("\n");
  const sourceOptions = new Set();
  const optionPattern = /\.option\(\s*(?:["'](?:\r?\n\s*)?)?["'](--[a-zA-Z0-9_-]+)/g;
  for (const match of sourceFiles.matchAll(optionPattern)) sourceOptions.add(match[1]);

  const root = await runHelp([]);
  const leaves = await discoverLeaves();
  const helpOptions = new Set(optionSection(root.stdout).map((option) => option.name));
  for (const leaf of leaves) {
    const result = await runHelp(leaf);
    for (const option of optionSection(result.stdout)) helpOptions.add(option.name);
  }

  assert.deepEqual([...sourceOptions].filter((option) => !helpOptions.has(option)), [],
    "source option declarations missing from generated help");
  const builtInOptions = new Set(["--help", "--version"]);
  assert.deepEqual([...helpOptions].filter((option) => !sourceOptions.has(option) && !builtInOptions.has(option)), [],
    "help exposes options that are not declared in source");
  assert.equal(sourceOptions.size, 139, "update this denominator when a new option is intentionally added");
});

test("every leaf accepts all of its declared options syntactically", async () => {
  const leaves = await discoverLeaves();
  const failures = [];
  for (const leaf of leaves) {
    const help = await runHelp(leaf);
    const options = optionSection(help.stdout);
    const args = [...leaf];
    for (const option of options) {
      args.push(option.name);
      const value = valueFor(option.valueName);
      if (value !== undefined) args.push(value);
    }
    args.push("--help");
    const result = await runCli(args);
    if (result.code !== 0) failures.push(`${leaf.join(" ")}: ${result.stderr || result.stdout}`);
  }
  assert.deepEqual(failures, [], "one or more declared options cannot be parsed");
});

test("global protocol and execution controls are accepted before every command", async () => {
  const controls = [
    ["--format", "json"], ["--stdin"], ["--dry-run"],
    ["--yes"], ["--non-interactive"], ["--profile", "default"], ["--api-key", "surface-key"],
  ];
  const result = await runCli([...controls.flat(), "survey", "list", "--help"]);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Usage: wjx survey list/);
});
