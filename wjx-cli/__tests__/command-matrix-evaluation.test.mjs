import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createCipheriv, createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Action } from "wjx-api-sdk";
import { COMMAND_METADATA } from "../dist/lib/command-metadata.js";
import { CATALOG } from "../dist/catalog/catalog.js";
import { compareVersions, shouldUpdate } from "../dist/commands/update.js";
import { startFixture } from "./fixtures/http-fixture.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, "..", "dist", "index.js");
const SOURCE_INDEX = resolve(__dirname, "..", "src", "index.ts");
const SOURCE_CLI = resolve(__dirname, "..", "src", "cli.ts");
const DIST_CLI = resolve(__dirname, "..", "dist", "cli.js");
const NO_CONFIG = { WJX_CONFIG_PATH: resolve(__dirname, "..", "__matrix_eval_no_config__") };

function runCli(args, { env = {}, input, cwd, timeout = 15_000 } = {}) {
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

function json(value) {
  return JSON.stringify(value);
}

function encryptPush(payload, appKey) {
  const key = Buffer.from(createHash("md5").update(appKey, "utf8").digest("hex").slice(0, 16), "utf8");
  const iv = Buffer.alloc(16, 7);
  const cipher = createCipheriv("aes-128-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, encrypted]).toString("base64");
}

const JSONL = [
  { qtype: "问卷基础信息", title: "矩阵覆盖测试", atype: 1 },
  { qtype: "单选", title: "是否满意？", select: ["是", "否"] },
].map(json).join("\n") + "\n";


/**
 * Every API-backed shortcut has one canonical valid invocation. These values
 * deliberately exercise the same flag names that a Skill/Agent would emit.
 */
const REMOTE_CASES = [
  { id: "survey.list", path: ["survey", "list"], action: Action.LIST_SURVEYS, args: ["--page", "1", "--page_size", "10"], stdin: {} },
  { id: "survey.get", path: ["survey", "get"], action: Action.GET_SURVEY, required: ["--vid"], args: ["--vid", "42"], stdin: { vid: 42 } },
  { id: "survey.create", path: ["survey", "create"], action: Action.CREATE_SURVEY_BY_JSON, required: ["--jsonl"], args: ["--jsonl", JSONL], stdin: { jsonl: JSONL } },
  { id: "survey.delete", path: ["survey", "delete"], action: Action.DELETE_SURVEY, highRisk: true, required: ["--vid", "--username"], args: ["--vid", "42", "--username", "owner"], stdin: { vid: 42, username: "owner" } },
  { id: "survey.status", path: ["survey", "status"], action: Action.UPDATE_STATUS, highRisk: true, required: ["--vid", "--state"], args: ["--vid", "42", "--state", "1"], stdin: { vid: 42, state: 1 } },
  { id: "survey.settings", path: ["survey", "settings"], action: Action.GET_SETTINGS, required: ["--vid"], args: ["--vid", "42"], stdin: { vid: 42 } },
  { id: "survey.update-settings", path: ["survey", "update-settings"], action: Action.UPDATE_SETTINGS, highRisk: true, required: ["--vid"], args: ["--vid", "42", "--api_setting", "{}"], stdin: { vid: 42, api_setting: {} } },
  { id: "survey.tags", path: ["survey", "tags"], action: Action.GET_TAGS, required: ["--username"], args: ["--username", "owner"], stdin: { username: "owner" } },
  { id: "survey.tag-details", path: ["survey", "tag-details"], action: Action.GET_TAG_DETAILS, required: ["--tag_id"], args: ["--tag_id", "7"], stdin: { tag_id: 7 } },
  { id: "survey.clear-bin", path: ["survey", "clear-bin"], action: Action.CLEAR_RECYCLE_BIN, highRisk: true, required: ["--username"], args: ["--username", "owner"], stdin: { username: "owner" } },
  { id: "survey.upload", path: ["survey", "upload"], action: Action.UPLOAD_FILE, required: ["--file_name", "--file"], args: ["--file_name", "avatar.txt", "--file", "aGVsbG8="], stdin: { file_name: "avatar.txt", file: "aGVsbG8=" } },
  { id: "survey.export-text", path: ["survey", "export-text"], action: Action.GET_SURVEY, required: ["--vid"], args: ["--vid", "42"], stdin: { vid: 42 } },
  { id: "response.count", path: ["response", "count"], action: Action.QUERY_RESPONSES, required: ["--vid"], args: ["--vid", "42"], stdin: { vid: 42 } },
  { id: "response.query", path: ["response", "query"], action: Action.QUERY_RESPONSES, required: ["--vid"], args: ["--vid", "42", "--page_index", "1", "--page_size", "10"], stdin: { vid: 42, page_index: 1, page_size: 10 } },
  { id: "response.realtime", path: ["response", "realtime"], action: Action.QUERY_RESPONSES_REALTIME, required: ["--vid"], args: ["--vid", "42", "--count", "10"], stdin: { vid: 42, count: 10 } },
  { id: "response.download", path: ["response", "download"], action: Action.DOWNLOAD_RESPONSES, required: ["--vid"], args: ["--vid", "42", "--suffix", "0"], stdin: { vid: 42, suffix: 0 } },
  { id: "response.submit", path: ["response", "submit"], action: Action.SUBMIT_RESPONSE, required: ["--vid", "--inputcosttime", "--submitdata"], args: ["--vid", "42", "--inputcosttime", "30", "--submitdata", "1$1", "--jpmversion", "1"], stdin: { vid: 42, inputcosttime: 30, submitdata: "1$1", jpmversion: 1 } },
  { id: "response.modify", path: ["response", "modify"], action: Action.MODIFY_RESPONSE, highRisk: true, required: ["--vid", "--jid", "--answers"], args: ["--vid", "42", "--jid", "7", "--answers", "1$1"], stdin: { vid: 42, jid: 7, answers: "1$1" } },
  { id: "response.clear", path: ["response", "clear"], action: Action.CLEAR_RESPONSES, highRisk: true, required: ["--username", "--vid"], args: ["--username", "owner", "--vid", "42"], stdin: { username: "owner", vid: 42 } },
  { id: "response.report", path: ["response", "report"], action: Action.GET_REPORT, required: ["--vid"], args: ["--vid", "42"], stdin: { vid: 42 } },
  { id: "response.winners", path: ["response", "winners"], action: Action.GET_WINNERS, required: ["--vid"], args: ["--vid", "42"], stdin: { vid: 42 } },
  { id: "response.submit-template", path: ["response", "submit-template"], action: Action.GET_SURVEY, required: ["--vid"], args: ["--vid", "42"], stdin: { vid: 42 } },
  { id: "response.360-report", path: ["response", "360-report"], action: Action.GET_360_REPORT, required: ["--vid"], args: ["--vid", "42", "--taskid", "task-1"], stdin: { vid: 42, taskid: "task-1" } },
  { id: "contacts.query", path: ["contacts", "query"], action: Action.QUERY_CONTACTS, required: ["--uid"], args: ["--uid", "u-1", "--corpid", "corp-1"], stdin: { uid: "u-1", corpid: "corp-1" } },
  { id: "contacts.add", path: ["contacts", "add"], action: Action.ADD_CONTACTS, required: ["--users"], args: ["--users", json([{ uid: "u-1" }]), "--corpid", "corp-1", "--auto_create_udept"], stdin: { users: [{ uid: "u-1" }], corpid: "corp-1", auto_create_udept: true } },
  { id: "contacts.delete", path: ["contacts", "delete"], action: Action.MANAGE_CONTACTS, highRisk: true, required: ["--uids"], args: ["--uids", "u-1", "--corpid", "corp-1"], stdin: { uids: "u-1", corpid: "corp-1" } },
  { id: "department.list", path: ["department", "list"], action: Action.LIST_DEPARTMENTS, args: ["--corpid", "corp-1"], stdin: { corpid: "corp-1" } },
  { id: "department.add", path: ["department", "add"], action: Action.ADD_DEPARTMENT, required: ["--depts"], args: ["--depts", json([{ name: "研发" }]), "--corpid", "corp-1"], stdin: { depts: [{ name: "研发" }], corpid: "corp-1" } },
  { id: "department.modify", path: ["department", "modify"], action: Action.MODIFY_DEPARTMENT, required: ["--depts"], args: ["--depts", json([{ id: "d-1", name: "研发" }]), "--corpid", "corp-1"], stdin: { depts: [{ id: "d-1", name: "研发" }], corpid: "corp-1" } },
  { id: "department.delete", path: ["department", "delete"], action: Action.DELETE_DEPARTMENT, highRisk: true, required: ["--type", "--depts"], args: ["--type", "1", "--depts", json(["d-1"]), "--corpid", "corp-1"], stdin: { type: "1", depts: ["d-1"], corpid: "corp-1" } },
  { id: "admin.add", path: ["admin", "add"], action: Action.ADD_ADMIN, required: ["--users"], args: ["--users", json([{ uid: "u-1" }]), "--corpid", "corp-1"], stdin: { users: [{ uid: "u-1" }], corpid: "corp-1" } },
  { id: "admin.delete", path: ["admin", "delete"], action: Action.DELETE_ADMIN, highRisk: true, required: ["--uids"], args: ["--uids", "u-1", "--corpid", "corp-1"], stdin: { uids: "u-1", corpid: "corp-1" } },
  { id: "admin.restore", path: ["admin", "restore"], action: Action.RESTORE_ADMIN, required: ["--uids"], args: ["--uids", "u-1", "--corpid", "corp-1"], stdin: { uids: "u-1", corpid: "corp-1" } },
  { id: "account.list", path: ["account", "list"], action: Action.QUERY_SUB_ACCOUNTS, args: ["--page_index", "1"], stdin: { page_index: 1 } },
  { id: "account.add", path: ["account", "add"], action: Action.ADD_SUB_ACCOUNT, required: ["--subuser"], args: ["--subuser", "child-1", "--password", "secret"], stdin: { subuser: "child-1", password: "secret" } },
  { id: "account.modify", path: ["account", "modify"], action: Action.MODIFY_SUB_ACCOUNT, required: ["--subuser"], args: ["--subuser", "child-1", "--email", "child@example.test"], stdin: { subuser: "child-1", email: "child@example.test" } },
  { id: "account.delete", path: ["account", "delete"], action: Action.DELETE_SUB_ACCOUNT, highRisk: true, required: ["--subuser"], args: ["--subuser", "child-1"], stdin: { subuser: "child-1" } },
  { id: "account.restore", path: ["account", "restore"], action: Action.RESTORE_SUB_ACCOUNT, required: ["--subuser"], args: ["--subuser", "child-1"], stdin: { subuser: "child-1" } },
  { id: "tag.list", path: ["tag", "list"], action: Action.LIST_TAGS, args: ["--corpid", "corp-1"], stdin: { corpid: "corp-1" } },
  { id: "tag.add", path: ["tag", "add"], action: Action.ADD_TAG, required: ["--child_names"], args: ["--child_names", json(["研发", "后端"]), "--corpid", "corp-1"], stdin: { child_names: ["研发", "后端"], corpid: "corp-1" } },
  { id: "tag.modify", path: ["tag", "modify"], action: Action.MODIFY_TAG, required: ["--tp_id"], args: ["--tp_id", "tp-1", "--tp_name", "研发", "--corpid", "corp-1"], stdin: { tp_id: "tp-1", tp_name: "研发", corpid: "corp-1" } },
  { id: "tag.delete", path: ["tag", "delete"], action: Action.DELETE_TAG, highRisk: true, required: ["--type", "--tags"], args: ["--type", "1", "--tags", json(["tag-1"]), "--corpid", "corp-1"], stdin: { type: "1", tags: ["tag-1"], corpid: "corp-1" } },
  { id: "user-system.add-participants", path: ["user-system", "add-participants"], action: Action.ADD_PARTICIPANTS, required: ["--users", "--sysid"], args: ["--users", json([{ uid: "u-1" }]), "--sysid", "9"], stdin: { users: [{ uid: "u-1" }], sysid: 9 } },
  { id: "user-system.modify-participants", path: ["user-system", "modify-participants"], action: Action.MODIFY_PARTICIPANTS, required: ["--users", "--sysid"], args: ["--users", json([{ uid: "u-1" }]), "--sysid", "9"], stdin: { users: [{ uid: "u-1" }], sysid: 9 } },
  { id: "user-system.delete-participants", path: ["user-system", "delete-participants"], action: Action.DELETE_PARTICIPANTS, highRisk: true, required: ["--uids", "--sysid"], args: ["--uids", json(["u-1"]), "--sysid", "9"], stdin: { uids: ["u-1"], sysid: 9 } },
  { id: "user-system.bind", path: ["user-system", "bind"], action: Action.BIND_ACTIVITY, required: ["--vid", "--sysid", "--uids"], args: ["--vid", "42", "--sysid", "9", "--uids", json(["u-1"])], stdin: { vid: 42, sysid: 9, uids: ["u-1"] } },
  { id: "user-system.query-binding", path: ["user-system", "query-binding"], action: Action.QUERY_SURVEY_BINDING, required: ["--vid", "--sysid"], args: ["--vid", "42", "--sysid", "9"], stdin: { vid: 42, sysid: 9 } },
  { id: "user-system.query-surveys", path: ["user-system", "query-surveys"], action: Action.QUERY_USER_SURVEYS, required: ["--uid", "--sysid"], args: ["--uid", "u-1", "--sysid", "9"], stdin: { uid: "u-1", sysid: 9 } },
];

const LEAF_COMMANDS = [
  "account.list", "account.add", "account.modify", "account.delete", "account.restore",
  "admin.add", "admin.delete", "admin.restore",
  "analytics.decode", "analytics.nps", "analytics.csat", "analytics.anomalies", "analytics.compare", "analytics.decode-push",
  "api", "completion.bash", "completion.zsh", "completion.fish", "completion.install",
  "contacts.query", "contacts.add", "contacts.delete",
  "department.list", "department.add", "department.modify", "department.delete",
  "doctor", "init",
  "reference", "response.count", "response.query", "response.realtime", "response.download", "response.submit", "response.modify", "response.clear", "response.report", "response.winners", "response.submit-template", "response.360-report",
  "schema", "skill.install", "skill.update", "skill.install-ppt", "skill.update-ppt",
  "sso.subaccount-url", "sso.user-system-url", "sso.partner-url",
  "survey.list", "survey.get", "survey.create", "survey.delete", "survey.status", "survey.settings", "survey.update-settings", "survey.tags", "survey.tag-details", "survey.clear-bin", "survey.upload", "survey.export-text", "survey.jsonl-template", "survey.url",
  "tag.list", "tag.add", "tag.modify", "tag.delete",
  "update", "user-system.add-participants", "user-system.modify-participants", "user-system.delete-participants", "user-system.bind", "user-system.query-binding", "user-system.query-surveys", "whoami",
].sort();

const LOCAL_DRY_RUN_CASES = [
  { id: "analytics.decode", args: ["analytics", "decode", "--submitdata", "1$1"] },
  { id: "analytics.nps", args: ["analytics", "nps", "--scores", "[9,10,7]"] },
  { id: "analytics.csat", args: ["analytics", "csat", "--scores", "[4,5,3]"] },
  { id: "analytics.anomalies", args: ["analytics", "anomalies", "--responses", "[]"] },
  { id: "analytics.compare", args: ["analytics", "compare", "--set_a", "{}", "--set_b", "{}"] },
  { id: "analytics.decode-push", args: ["analytics", "decode-push", "--payload", encryptPush({ vid: 42, jid: 7, submitdata: "1$1" }, "preview-key"), "--app_key", "preview-key"] },
  { id: "api", args: ["api", "--service", "default", "--action", "survey.list", "--params", "{}"] },
  { id: "completion.bash", args: ["completion", "bash"] },
  { id: "completion.zsh", args: ["completion", "zsh"] },
  { id: "completion.fish", args: ["completion", "fish"] },
  { id: "completion.install", args: ["completion", "install"] },
  { id: "doctor", args: ["doctor"] },
  { id: "init", args: ["--api-key", "dry-run-key", "init", "--no-install-skill"] },
  { id: "reference", args: ["reference", "analytics"] },
  { id: "schema", args: ["schema", "survey.list"] },
  { id: "skill.install", args: ["skill", "install", "--silent"] },
  { id: "skill.update", args: ["skill", "update", "--silent"] },
  { id: "skill.install-ppt", args: ["skill", "install-ppt", "--silent", "--skip-pip"] },
  { id: "skill.update-ppt", args: ["skill", "update-ppt", "--silent", "--skip-pip"] },
  { id: "sso.subaccount-url", args: ["sso", "subaccount-url", "--subuser", "child-1"] },
  { id: "sso.user-system-url", args: ["sso", "user-system-url", "--u", "owner", "--system_id", "9", "--uid", "u-1"] },
  { id: "sso.partner-url", args: ["sso", "partner-url", "--username", "partner-1"] },
  { id: "survey.jsonl-template", args: ["survey", "jsonl-template", "--type", "1"] },
  { id: "survey.url", args: ["survey", "url", "--mode", "create", "--name", "dry-run survey"] },
  { id: "update", args: ["update", "--silent"] },
  { id: "whoami", args: ["whoami"] },
];

function parseProblem(result) {
  assert.equal(result.stdout.trim(), "", `error stdout must be empty: ${result.stdout}`);
  const envelope = JSON.parse(result.stderr);
  assert.equal(envelope.ok, false, `expected ProblemEnvelope: ${result.stderr}`);
  return envelope;
}

function parseSuccess(result) {
  assert.equal(result.stderr.trim(), "", `success stderr must be empty: ${result.stderr}`);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.ok, true, `expected ResultEnvelope: ${result.stdout}`);
  return envelope;
}

function argsWithoutFlag(args, flag) {
  const output = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === flag) {
      if (args[i + 1] !== undefined && !args[i + 1].startsWith("--")) i += 1;
      continue;
    }
    output.push(args[i]);
  }
  return output;
}

function extractTypedOptions(help) {
  return extractSurfaceOptions(help).map(({ flag, descriptor }) => ({
    flag,
    key: flag.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase()),
    descriptor,
  }));
}

// Keep the black-box denominator honest: Commander help is the public option
// surface, so every option definition must have at least one executable,
// side-effect-free scenario below. This parser intentionally only considers
// two-space option-definition lines and ignores wrapped descriptions.
function extractSurfaceOptions(help) {
  const options = [];
  for (const line of help.split(/\r?\n/)) {
    const match = line.match(/^\s{2}(?:-[A-Za-z],\s*)?(--[A-Za-z0-9_-]+)(?:\s+<([^>]+)>|\s+\[([^\]]+)\])?/);
    if (!match || match[1] === "--help") continue;
    options.push({ flag: match[1], descriptor: match[2] ?? match[3] });
  }
  return options;
}

const GLOBAL_OPTION_FLAGS = new Set([
  "--api-key", "--format", "--stdin", "--dry-run",
  "--yes", "--non-interactive", "--profile",
]);

const JSON_ARRAY_OPTION_FLAGS = new Set([
  "--questions", "--optional_titles", "--users", "--depts", "--child_names",
  "--tags", "--uids", "--conds",
]);

const JSON_OBJECT_OPTION_FLAGS = new Set([
  "--api_setting", "--after_submit_setting", "--msg_setting",
  "--sojumpparm_setting", "--time_setting", "--params", "--body",
]);

const BOOLEAN_OPTION_FLAGS = new Set([
  "--publish", "--completely", "--del_child", "--is_xingbiao", "--query_all",
  "--query_note", "--distinct_user", "--distinct_sojumpparm", "--query_record",
  "--valid", "--reset_to_zero", "--auto_create_udept", "--auto_create_tag",
  "--is_radio", "--can_chg_answer", "--can_view_result", "--force_join_times",
  "--get_questions", "--get_items", "--get_exts", "--get_setting", "--get_page_cut", "--get_tags",
  "--showtitle",
  "--force", "--silent", "--skip-pip", "--no-install-skill", "--install-ppt-skill",
  "--raw", "--no-auto-version",
]);

const INTEGER_COVERAGE_VALUES = new Map([
  ["survey.list:--status", "1"],
  ["survey.list:--atype", "1"],
  ["survey.list:--sort", "0"],
  ["survey.list:--verify_status", "0"],
  ["survey.list:--time_type", "0"],
  ["response.download:--suffix", "0"],
  ["response.download:--query_type", "0"],
  ["response.winners:--atype", "0"],
  ["response.winners:--awardstatus", "0"],
  ["user-system.query-binding:--join_status", "0"],
  ["user-system.bind:--can_hide_qlist", "0"],
  ["sso.user-system-url:--is_login", "0"],
  ["sso.subaccount-url:--admin", "1"],
]);

function hasFlag(args, flag) {
  return args.includes(flag);
}

function removeOption(args, flag) {
  const result = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag) {
      result.push(args[index]);
      continue;
    }
    if (args[index + 1] !== undefined && !args[index + 1].startsWith("--")) index += 1;
  }
  return result;
}

async function coverageValue(command, option, tempDir) {
  const flag = option.flag;
  if (!option.descriptor) return undefined;
  if (BOOLEAN_OPTION_FLAGS.has(flag)) return undefined;

  const id = `${command}:${flag}`;
  const semanticValues = new Map([
    ["analytics.csat:--scale", "5-point"],
    ["survey.url:--mode", "create"],
    ["department.delete:--type", "1"],
    ["tag.delete:--type", "1"],
    ["account.list:--role", "1"],
    ["account.add:--role", "1"],
    ["account.modify:--role", "1"],
    ["sso.subaccount-url:--role_id", "1"],
    ["sso.subaccount-url:--admin", "1"],
    ["sso.user-system-url:--is_login", "0"],
    ["user-system.query-binding:--join_status", "0"],
    ["response.submit:--inputcosttime", "30"],
    ["survey.jsonl-template:--type", "1"],
    ["survey.create:--type", "1"],
    ["analytics.decode-push:--signature", createHash("sha1").update(JSON.stringify({ event: "response.created" }) + "preview-key", "utf8").digest("hex")],
  ]);
  if (semanticValues.has(id)) return semanticValues.get(id);
  if (option.descriptor === "n") return INTEGER_COVERAGE_VALUES.get(id) ?? "1";
  if (JSON_ARRAY_OPTION_FLAGS.has(flag)) {
    if (flag === "--questions") return json([{ q_index: 1, q_type: 3 }]);
    if (flag === "--depts") {
      return command === "department.delete" ? json(["d-coverage"]) : json([{ id: "d-coverage", name: "覆盖" }]);
    }
    if (flag === "--users") return json([{ uid: "u-coverage", userid: "u-coverage" }]);
    if (flag === "--conds") return json([{ q_index: 10000, opt: "in", val: "1" }]);
    if (flag === "--child_names" && command === "tag.modify") return json([{ name: "coverage", id: "child-1" }]);
    return json(["coverage"]);
  }
  if (flag === "--responses") return json([{ jid: "coverage", answers: ["1"], duration_seconds: 30 }]);
  if (flag === "--scores") return json([1, 2, 3]);
  if (flag === "--set_a" || flag === "--set_b") return json({ nps: 50 });
  if (JSON_OBJECT_OPTION_FLAGS.has(flag)) return json({ coverage: true });
  if (flag === "--file") {
    if (command === "survey.upload") return "aGVsbG8=";
    const file = resolve(tempDir, `${command.replaceAll(".", "-")}-${flag.slice(2)}.txt`);
    const content = command === "survey.create" ? JSONL : "1$1";
    await writeFile(file, content, "utf8");
    return file;
  }
  if (flag === "--submitdata-file") {
    const file = resolve(tempDir, "response-submitdata.txt");
    await writeFile(file, "1$1", "utf8");
    return file;
  }
  if (flag === "--payload") {
    return encryptPush({ vid: 42, jid: 7, submitdata: "1$1" }, "coverage-key");
  }
  if (flag === "--raw_body") return JSON.stringify({ event: "response.created" });
  if (flag === "--signature") return "coverage-signature";
  if (flag === "--app_key") return "coverage-key";
  if (option.descriptor === "url" || flag === "--url" || flag === "--return_url") return "https://example.test/return";
  if (option.descriptor === "service") return "default";
  if (option.descriptor === "action") return "survey.list";
  if (option.descriptor === "format") return "json";
  if (flag === "--submitdata") return "1$1";
  if (flag === "--jsonl") return JSONL;
  if (flag === "--file_name") return "coverage.txt";
  if (flag === "--file") return "coverage.txt";
  if (flag === "--type" && command === "survey.jsonl-template") return "1";
  return `coverage-${command.replaceAll(".", "-")}-${flag.slice(2)}`;
}

function hasDeepValue(value, expected) {
  if (Object.is(value, expected) || String(value) === String(expected)) return true;
  if (typeof expected === "string") {
    try {
      const decodedExpected = JSON.parse(expected);
      if (decodedExpected !== expected && hasDeepValue(value, decodedExpected)) return true;
    } catch {
      // Expected value is an ordinary scalar string.
    }
  }
  // SDK request builders encode JSON-bearing options as JSON strings. Decode
  // those strings so the assertion checks the supplied payload itself.
  if (typeof value === "string") {
    try {
      const decoded = JSON.parse(value);
      if (decoded !== value && hasDeepValue(decoded, expected)) return true;
    } catch {
      // Ordinary scalar strings are handled by the equality check above.
    }
  }
  // Contact endpoints encode booleans as "1"/"0" while other endpoints keep
  // native booleans. Treat these documented wire representations equally.
  if (expected === true && (value === 1 || value === "1" || value === "true")) return true;
  if (expected === false && (value === 0 || value === "0" || value === "false")) return true;
  if (Array.isArray(value)) return value.some((item) => hasDeepValue(item, expected));
  if (value && typeof value === "object") return Object.values(value).some((item) => hasDeepValue(item, expected));
  return false;
}

function optionExpectedValue(command, flag, value) {
  if (/(?:password|upass|token|secret|api[_-]?key|app[_-]?key|credential|authorization|cookie)/i.test(flag)) return "****";
  if (command === "api" && flag === "--action") return Action.LIST_SURVEYS;
  // File options are transformed into their contents before the SDK call.
  // Compare against the resulting wire value, not the temporary path passed
  // to the CLI.
  if (flag === "--submitdata-file") return "1$1";
  if (!BOOLEAN_OPTION_FLAGS.has(flag)) return value;
  return flag === "--no-install-skill" || flag === "--no-auto-version" ? false : true;
}

function optionWireKeys(command, flag) {
  if (flag === "--file" && command === "survey.create") return ["surveydatajson", "jsonl"];
  const aliases = {
    "--page": ["page", "page_index"],
    "--type": ["type", "atype"],
    "--description": ["description", "desc"],
    "--completely": ["completely", "completely_delete"],
    "--status": ["status", "state"],
    "--jsonl": ["jsonl", "surveydatajson"],
    "--submitdata-file": ["submitdata"],
    "--text": ["text", "questions"],
    "--optional_titles": ["optional_titles", "optionalTitles", "questions"],
    "--target-dir": ["target-dir", "targetDir"],
    "--no-install-skill": ["no-install-skill", "installSkill"],
    "--file": command === "survey.create"
      ? ["file", "surveydatajson", "jsonl"]
      : ["file"],
  };
  const name = flag.slice(2);
  const camel = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  return aliases[flag] ?? [name, camel];
}

function assertOptionReflected(command, flag, value, envelope) {
  if (flag === "--raw") return;
  const expected = optionExpectedValue(command, flag, value);
  // The contacts API serializes boolean switches as the documented wire
  // values "1"/"0".  Keep the black-box assertion semantic rather than
  // requiring the CLI preview to expose the SDK's transport encoding.
  const expectedValues = BOOLEAN_OPTION_FLAGS.has(flag) && expected === true
    ? [true, "1", 1]
    : BOOLEAN_OPTION_FLAGS.has(flag) && expected === false
      ? [false, "0", 0]
      : [expected];
  const plans = envelope.data?.plans ?? [];
  const sources = [];
  for (const plan of plans) {
    sources.push(plan);
    try { sources.push(JSON.parse(plan.body)); } catch { sources.push(plan.body); }
  }
  if (envelope.data?.input !== undefined) sources.push(envelope.data.input);
  // `--no-auto-version` is an execution policy rather than a wire field; its
  // observable contract is asserted by the dedicated workflow test.
  if (flag === "--no-auto-version") return;
  const keys = optionWireKeys(command, flag);
  const reflected = sources.some((source) => {
    if (!source || typeof source !== "object") return false;
    const record = source;
    return keys.some((key) => key in record && expectedValues.some((candidate) => hasDeepValue(record[key], candidate)));
  });
  // Raw API params/body are intentionally flattened into the request body;
  // there is no surviving `params`/`body` wrapper to target.
  const flattenedApiInput = command === "api" && (flag === "--params" || flag === "--body")
    && sources.some((source) => expectedValues.some((candidate) => hasDeepValue(source, candidate)));
  const transformed = (flag === "--file" && command === "survey.create") || flag === "--jsonl";
  const hasTransformedField = transformed && sources.some((source) => {
    if (!source || typeof source !== "object") return false;
    return optionWireKeys(command, flag).some((key) => key in source && source[key] !== undefined && source[key] !== "");
  });
  // optional_titles is a validation-only input for create; it is
  // consumed while normalizing questions and is intentionally absent on wire.
  assert.ok(reflected || flattenedApiInput || hasTransformedField || (flag === "--optional_titles" && command.startsWith("survey.create")),
    `${command} ${flag} value ${String(expected)} was not reflected in its plan/input field`);
}

describe("complete CLI command contract matrix", () => {
  test("black-box evaluation refuses a stale CLI build", async () => {
    const [source, commandSource, dist, commandDist] = await Promise.all([
      readFile(SOURCE_INDEX, "utf8"),
      readFile(SOURCE_CLI, "utf8"),
      readFile(CLI, "utf8"),
      readFile(DIST_CLI, "utf8"),
    ]);
    assert.match(source, /import\([\"']\.\/cli\.js[\"']\)/);
    assert.match(commandSource, /--format/);
    assert.match(dist, /import\([\"']\.\/cli\.js[\"']\)/, "dist/index.js is stale; run CLI build");
    assert.match(commandDist, /--format/, "dist/cli.js is stale; run CLI build");
  });

  test("leaf command inventory is exhaustive and every leaf is discoverable", async () => {
    assert.equal(new Set(LEAF_COMMANDS).size, LEAF_COMMANDS.length);
    assert.equal(LEAF_COMMANDS.length, 74);
    for (const command of LEAF_COMMANDS) {
      const result = await runCli([...command.split("."), "--help"]);
      assert.equal(result.exitCode, 0, `${command}: ${result.stderr}`);
      assert.match(result.stdout, /Usage:/, `${command} did not render help`);
      assert.equal(result.stderr.trim(), "", `${command} wrote help diagnostics`);
    }
  });

  test("every typed leaf option has an invalid-input contract", async () => {
    const noStdinSurface = new Set([
      "reference", "schema", "doctor", "whoami", "init", "update",
      "skill.install", "skill.update", "skill.install-ppt", "skill.update-ppt",
      "completion.bash", "completion.zsh", "completion.fish", "completion.install",
    ]);
    let numericOptions = 0;
    let stdinOptions = 0;
    for (const command of LEAF_COMMANDS) {
      if (command === "reference") continue;
      const path = command.split(".");
      const help = await runCli([...path, "--help"]);
      for (const option of extractTypedOptions(help.stdout)) {
        if (!option.descriptor) continue;
        if (option.descriptor === "n") {
          numericOptions += 1;
          const result = await runCli([...path, option.flag, "not-a-number"]);
          assert.equal(result.exitCode, 2, `${command} ${option.flag} accepted a malformed integer`);
          const problem = parseProblem(result);
          assert.equal(problem.error.code, "INPUT_ERROR", `${command} ${option.flag}`);
          assert.match(problem.error.message, /Invalid integer/i, `${command} ${option.flag}`);
        } else if (!noStdinSurface.has(command)) {
          stdinOptions += 1;
          const result = await runCli(["--stdin", ...path], { input: JSON.stringify({ [option.key]: 123 }) });
          assert.equal(result.exitCode, 2, `${command} ${option.flag} accepted a non-string stdin value`);
          assert.equal(parseProblem(result).error.code, "INPUT_ERROR", `${command} ${option.flag}`);
        }
      }
    }
    assert.ok(numericOptions >= 50, `only ${numericOptions} numeric options were checked`);
    assert.ok(stdinOptions >= 100, `only ${stdinOptions} stdin options were checked`);
  });

  test("every metadata API command has exactly one valid matrix case", () => {
    // Two local-facing shortcuts still execute real API actions; survey.url is
    // the only shortcut that is entirely local and therefore belongs below.
    const remoteShortcutIds = new Set(["survey.export-text", "response.submit-template"]);
    const metadataIds = CATALOG
      .filter((entry) => entry.source === "api" || remoteShortcutIds.has(entry.id))
      .map((entry) => entry.id)
      .sort();
    const caseIds = REMOTE_CASES.map((item) => item.id).sort();
    assert.deepEqual(caseIds, metadataIds);
    for (const item of REMOTE_CASES) {
      assert.ok(COMMAND_METADATA[item.id], `${item.id} is missing command metadata`);
      assert.equal(COMMAND_METADATA[item.id].risk === "high-risk-write", Boolean(item.highRisk), `${item.id} risk mismatch`);
      assert.ok(item.action, `${item.id} has no expected API action`);
    }
  });

  test("all remote commands support credential-free dry-run from structured stdin", async () => {
    const fixture = await startFixture();
    try {
      for (const item of REMOTE_CASES) {
        const before = fixture.requests().length;
        const result = await fixture.run(["--stdin", "--dry-run", ...item.path], { input: json(item.stdin) });
        assert.equal(result.exitCode, 0, `${item.id}: ${result.stderr}`);
        const envelope = parseSuccess(result);
        assert.equal(envelope.data.kind, "dry-run", item.id);
        assert.equal(fixture.requests().length, before, `${item.id} made a real request during dry-run`);
        assert.ok(Array.isArray(envelope.data.plans), `${item.id} did not emit plans`);
        assert.equal(envelope.data.plans[0].method, "POST", `${item.id} plan is not POST`);
        const body = typeof envelope.data.plans[0].body === "string" ? JSON.parse(envelope.data.plans[0].body) : envelope.data.plans[0].body;
        assert.equal(String(body.action), String(item.action), `${item.id} planned wrong action`);
      }
    } finally {
      await fixture.close();
    }
  });

  test("every leaf command has a safe preview or local dry-run path", async () => {
    const cases = [
      ...REMOTE_CASES.map((item) => ({ id: item.id, args: [...item.path, ...item.args] })),
      ...LOCAL_DRY_RUN_CASES,
    ];
    const ids = cases.map((item) => item.id).sort();
    assert.deepEqual(ids, LEAF_COMMANDS, "every leaf must have exactly one executable preview case");

    for (const item of cases) {
      const result = await runCli(["--dry-run", ...item.args], {
        env: {
          WJX_API_KEY: "preview-key",
          WJX_API_URL: "http://127.0.0.1:1/openapi/default.aspx",
          SHELL: "",
        },
      });
      assert.equal(result.exitCode, 0, `${item.id}: ${result.stderr || result.stdout}`);
      assert.equal(result.stderr.trim(), "", `${item.id} emitted diagnostics during preview`);
      assert.ok(result.stdout.trim(), `${item.id} emitted no preview`);
    }
  });

  test("every required field is validated before auth or network", async () => {
    const fixture = await startFixture({
      response: { result: true, data: { title: "矩阵问卷", description: "", questions: [] } },
      env: { WJX_API_KEY: "matrix-key" },
    });
    try {
      for (const item of REMOTE_CASES) {
        for (const flag of item.required ?? []) {
          const before = fixture.requests().length;
          const result = await fixture.run([...(item.highRisk ? ["--yes"] : []), ...item.path, ...argsWithoutFlag(item.args, flag)]);
          assert.equal(result.exitCode, 2, `${item.id} missing ${flag} unexpectedly succeeded: ${result.stdout}`);
          assert.equal(parseProblem(result).error.code, "INPUT_ERROR", `${item.id} missing ${flag}`);
          assert.equal(fixture.requests().length, before, `${item.id} missing ${flag} made a request`);
        }
      }
    } finally {
      await fixture.close();
    }
  });

  test("strict integer options reject shell garbage before transport", async () => {
    const cases = [
      ["survey", "list", "--page", "1"], ["survey", "get", "--vid", "42"],
      ["survey", "create", "--title", "x", "--type", "1", "--questions", "[]"],
      ["survey", "delete", "--vid", "42", "--username", "owner"], ["survey", "status", "--vid", "42", "--state", "1"],
      ["survey", "settings", "--vid", "42"], ["survey", "tag-details", "--tag_id", "7"], ["survey", "export-text", "--vid", "42"],
      ["response", "query", "--vid", "42", "--page_size", "10"], ["response", "realtime", "--vid", "42", "--count", "10"],
      ["response", "download", "--vid", "42", "--suffix", "0"], ["response", "submit", "--vid", "42", "--inputcosttime", "30", "--submitdata", "1$1"],
      ["response", "modify", "--vid", "42", "--jid", "7", "--answers", "1$1"], ["response", "clear", "--username", "owner", "--vid", "42"],
      ["response", "winners", "--vid", "42", "--page_size", "10"], ["response", "360-report", "--vid", "42"],
      ["account", "list", "--role", "1"], ["user-system", "bind", "--vid", "42", "--sysid", "9", "--uids", "[]"],
    ];
    for (const args of cases) {
      const numericIndex = args.findIndex((value, index) => index > 0 && args[index - 1].startsWith("--") && /^-?\d+$/.test(value));
      assert.ok(numericIndex > 0, `matrix case has no numeric option: ${args.join(" ")}`);
      const invalid = [...args];
      invalid[numericIndex] = `${invalid[numericIndex]}abc`;
      const result = await runCli(invalid);
      assert.equal(result.exitCode, 2, args.join(" "));
      assert.equal(parseProblem(result).error.code, "INPUT_ERROR", args.join(" "));
    }
  });

  test("JSON-bearing command options reject malformed JSON before transport", async () => {
    const cases = [
      ["survey", "create", "--jsonl", "{"],
      ["survey", "update-settings", "--vid", "42", "--api_setting", "{"],
      ["response", "query", "--vid", "42", "--conds", "{"],
      ["response", "report", "--vid", "42", "--conds", "{"],
      ["contacts", "add", "--users", "{"], ["department", "add", "--depts", "{"],
      ["department", "modify", "--depts", "{"], ["department", "delete", "--type", "1", "--depts", "{"],
      ["admin", "add", "--users", "{"], ["tag", "add", "--child_names", "{"],
      ["tag", "modify", "--tp_id", "tp-1", "--child_names", "{"], ["tag", "delete", "--type", "1", "--tags", "{"],
      ["user-system", "add-participants", "--users", "{", "--sysid", "9"],
      ["user-system", "delete-participants", "--uids", "{", "--sysid", "9"],
    ];
    for (const args of cases) {
      const result = await runCli(args);
      assert.equal(result.exitCode, 2, args.join(" "));
      assert.equal(parseProblem(result).error.code, "INPUT_ERROR", args.join(" "));
    }
  });

  test("structured stdin applies Commander numeric parsers before transport", async () => {
    const fixture = await startFixture({ response: { result: true, data: {} }, env: { WJX_API_KEY: "stdin-type-key" } });
    try {
      const cases = [
        { path: ["survey", "get"], input: { vid: "abc" } },
        { path: ["survey", "list"], input: { page: "abc" } },
        { path: ["survey", "create"], input: { jsonl: "{\"qtype\":\"问卷基础信息\",\"title\":\"类型测试\"}", type: "abc" } },
        { path: ["response", "submit"], input: { vid: 42, inputcosttime: "abc", submitdata: "1$1", jpmversion: 1 } },
      ];
      for (const item of cases) {
        const result = await fixture.run(["--stdin", ...item.path], { input: JSON.stringify(item.input) });
        assert.equal(result.exitCode, 2, `${item.path.join(" ")} accepted an invalid stdin number`);
        assert.equal(parseProblem(result).error.code, "INPUT_ERROR");
      }
      assert.equal(fixture.requests().length, 0, "invalid stdin values must not reach transport");
    } finally {
      await fixture.close();
    }
  });

  test("structured stdin normalizes valid numeric strings like CLI options", async () => {
    const fixture = await startFixture({ response: { result: true, data: {} }, env: { WJX_API_KEY: "stdin-normalize-key" } });
    try {
      const result = await fixture.run(["--stdin", "survey", "get"], { input: JSON.stringify({ vid: "42" }) });
      assert.equal(result.exitCode, 0, result.stderr);
      const body = JSON.parse(fixture.requests()[0].body);
      assert.equal(body.vid, 42);
    } finally {
      await fixture.close();
    }
  });

  test("structured stdin rejects negative response durations before transport", async () => {
    const fixture = await startFixture({ response: { result: true, data: {} }, env: { WJX_API_KEY: "stdin-range-key" } });
    try {
      const result = await fixture.run(["--stdin", "response", "submit"], {
        input: JSON.stringify({ vid: 42, inputcosttime: -1, submitdata: "1$1", jpmversion: 1 }),
      });
      assert.equal(result.exitCode, 2, result.stderr);
      assert.equal(parseProblem(result).error.code, "INPUT_ERROR");
      assert.equal(fixture.requests().length, 0);
    } finally {
      await fixture.close();
    }
  });

  test("pagination options reject non-positive values before transport", async () => {
    const fixture = await startFixture({ env: { WJX_API_KEY: "pagination-key" } });
    const cases = [
      [["survey", "list"], "--page"],
      [["survey", "list"], "--page_size"],
      [["response", "query", "--vid", "42"], "--page_index"],
      [["response", "query", "--vid", "42"], "--page_size"],
      [["response", "winners", "--vid", "42"], "--page_index"],
      [["response", "winners", "--vid", "42"], "--page_size"],
      [["account", "list"], "--page_index"],
      [["account", "list"], "--page_size"],
    ];
    try {
      for (const [args, option] of cases) {
        const label = [...args, option].join(" ");
        const result = await fixture.run(["--dry-run", ...args, option, "0"]);
        assert.equal(result.exitCode, 2, label);
        const problem = parseProblem(result);
        assert.equal(problem.error.code, "INPUT_ERROR", label);
        assert.match(problem.error.message, /正整数|positive|范围内的整数|range/i, label);
      }
      assert.equal(fixture.requests().length, 0);
    } finally {
      await fixture.close();
    }
  });

  test("unknown schema actions are input errors", async () => {
    const result = await runCli(["schema", "does-not-exist"]);
    assert.equal(result.exitCode, 2);
    const problem = parseProblem(result);
    assert.equal(problem.error.code, "INPUT_ERROR");
    assert.match(problem.error.message, /Unknown catalog action/i);
  });

  test("unsupported JSONL question types are input errors", async () => {
    const jsonl = [
      JSON.stringify({ qtype: "问卷基础信息", title: "标题" }),
      JSON.stringify({ qtype: "地区题", title: "所在地区" }),
    ].join("\n");
    const result = await runCli(["survey", "create", "--dry-run", "--jsonl", jsonl]);
    assert.equal(result.exitCode, 2, result.stderr);
    assert.equal(parseProblem(result).error.code, "INPUT_ERROR");
  });

  test("JSONL scalar lines are input errors with a line diagnostic", async () => {
    const jsonl = `${JSON.stringify({ qtype: "问卷基础信息", title: "标量行测试" })}\nnull\n`;
    const result = await runCli(["survey", "create", "--dry-run", "--jsonl", jsonl]);
    assert.equal(result.exitCode, 2, result.stderr);
    const problem = parseProblem(result);
    assert.equal(problem.error.code, "INPUT_ERROR");
    assert.match(problem.error.message, /第 2 行/);
  });

  test("JSONL rejects duplicate survey metadata rows", async () => {
    const jsonl = [
      JSON.stringify({ qtype: "问卷基础信息", title: "重复元数据" }),
      JSON.stringify({ qtype: "问卷基础信息", title: "重复元数据" }),
      JSON.stringify({ qtype: "单选", title: "题目", select: ["是", "否"] }),
    ].join("\n");
    const result = await runCli(["survey", "create", "--dry-run", "--jsonl", jsonl]);
    assert.equal(result.exitCode, 2, result.stderr);
    assert.equal(parseProblem(result).error.code, "INPUT_ERROR");
  });

  test("raw api accepts required service and action from structured stdin", async () => {
    const result = await runCli(["--dry-run", "--stdin", "api"], {
      input: JSON.stringify({ service: "default", action: "survey.list", params: { page_index: 1 } }),
    });
    assert.equal(result.exitCode, 0, result.stderr);
    const envelope = parseSuccess(result);
    assert.equal(envelope.data.kind, "dry-run");
    assert.equal(JSON.parse(envelope.data.plans[0].body).action, Action.LIST_SURVEYS);
  });

  test("survey edit URL rejects non-positive activity ids", async () => {
    for (const activity of [0, -1]) {
      const result = await runCli(["survey", "url", "--mode", "edit", "--activity", String(activity)]);
      assert.equal(result.exitCode, 2, `activity=${activity} must be rejected`);
      assert.equal(parseProblem(result).error.code, "INPUT_ERROR");
    }
  });

  test("CSV renders scalar local output instead of silently dropping it", async () => {
    const result = await runCli(["reference", "analytics", "--format", "csv"]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /^value\r?\n/);
    assert.match(result.stdout, /analytics/);
  });

  test("unknown commands are input errors", async () => {
    const result = await runCli(["does-not-exist"]);
    assert.equal(result.exitCode, 2, result.stderr);
    assert.equal(parseProblem(result).error.code, "INPUT_ERROR");
  });

  test("local skill/update failures use the ProblemEnvelope error channel", async () => {
    const root = await mkdtemp(resolve(process.env.TEMP ?? ".", "wjx-local-failure-matrix-"));
    const bin = await mkdtemp(resolve(process.env.TEMP ?? ".", "wjx-local-failure-bin-"));
    try {
      const skill = await runCli(["skill", "update", "--silent", "--target-dir", root]);
      assert.equal(skill.exitCode, 2, skill.stdout);
      assert.equal(skill.stdout.trim(), "");
      assert.equal(parseProblem(skill).error.code, "INPUT_ERROR");

      const verboseSkill = await runCli(["skill", "update", "--target-dir", root]);
      assert.equal(verboseSkill.exitCode, 2, verboseSkill.stdout);
      assert.equal(verboseSkill.stdout.trim(), "");
      assert.equal(parseProblem(verboseSkill).error.code, "INPUT_ERROR");

      await writeFile(resolve(bin, "npm.cmd"), "@echo off\r\nexit /b 1\r\n", "utf8");
      const update = await runCli(["update", "--silent"], { env: { PATH: `${bin};${process.env.PATH ?? ""}` } });
      assert.equal(update.exitCode, 1, update.stdout);
      assert.equal(update.stdout.trim(), "");
      assert.equal(parseProblem(update).error.code, "API_ERROR");

      const verboseUpdate = await runCli(["update"], { env: { PATH: `${bin};${process.env.PATH ?? ""}` } });
      assert.equal(verboseUpdate.exitCode, 1, verboseUpdate.stdout);
      assert.equal(verboseUpdate.stdout.trim(), "");
      assert.equal(parseProblem(verboseUpdate).error.code, "API_ERROR");
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(bin, { recursive: true, force: true });
    }
  });

  test("update refuses to install when registry latest is older than the local version", async () => {
    assert.equal(compareVersions("0.4.1", "0.3.5"), 1);
    assert.equal(shouldUpdate("0.4.1", "0.3.5"), false);

    const bin = await mkdtemp(resolve(process.env.TEMP ?? ".", "wjx-update-guard-bin-"));
    const marker = resolve(bin, "install-called");
    try {
      await writeFile(resolve(bin, "npm.cmd"), `@echo off\r\nif "%~1"=="view" (echo "0.3.5" & exit /b 0)\r\necho install > "${marker}"\r\nexit /b 0\r\n`, "utf8");
      const result = await runCli(["update", "--silent"], { env: { PATH: `${bin};${process.env.PATH ?? ""}` } });
      assert.equal(result.exitCode, 0, result.stderr);
      const envelope = JSON.parse(result.stdout);
      assert.equal(envelope.ok, true);
      assert.equal(envelope.data.status, "up-to-date");
      assert.equal(envelope.data.oldVersion, "0.4.1");
      assert.equal(envelope.data.latestVersion, "0.3.5");
      await assert.rejects(access(marker));
    } finally {
      await rm(bin, { recursive: true, force: true });
    }
  });

  test("local analytics reject empty and structurally invalid datasets", async () => {
    const cases = [
      ["analytics", "nps", "--scores", "[]"],
      ["analytics", "csat", "--scores", "[]"],
      ["analytics", "anomalies", "--responses", "[1]"],
      ["analytics", "compare", "--set_a", "[]", "--set_b", "{}"],
      ["analytics", "decode", "--submitdata", ""],
    ];
    for (const args of cases) {
      const result = await runCli(args);
      assert.equal(result.exitCode, 2, `${args.join(" ")} unexpectedly succeeded`);
      assert.equal(parseProblem(result).error.code, "INPUT_ERROR");
    }
  });

  test("required text and collection inputs reject empty values", async () => {
    const cases = [
      ["contacts", "query", "--uid", ""],
      ["survey", "delete", "--vid", "42", "--username", "", "--yes"],
      ["response", "modify", "--vid", "42", "--jid", "7", "--answers", ""],
      ["survey", "upload", "--file_name", "file.txt", "--file", ""],
      ["department", "add", "--depts", "[]"],
      ["tag", "add", "--child_names", "[]"],
    ];
    for (const args of cases) {
      const result = await runCli(args);
      assert.equal(result.exitCode, 2, `${args.join(" ")} unexpectedly succeeded`);
      assert.equal(parseProblem(result).error.code, "INPUT_ERROR");
    }
  });

  test("JSON collection/object options reject valid JSON with the wrong shape", async () => {
    const cases = [
      ["survey", "update-settings", "--vid", "42", "--api_setting", "[]"],
      ["response", "query", "--vid", "42", "--conds", "{}"],
      ["contacts", "add", "--users", "{}"],
      ["department", "add", "--depts", JSON.stringify("研发")],
      ["tag", "add", "--child_names", "{}"],
      ["user-system", "add-participants", "--users", JSON.stringify("u-1"), "--sysid", "9"],
      ["user-system", "delete-participants", "--uids", "{}", "--sysid", "9", "--yes"],
    ];
    for (const args of cases) {
      const result = await runCli(args);
      assert.equal(result.exitCode, 2, `${args.join(" ")} unexpectedly succeeded`);
      assert.equal(parseProblem(result).error.code, "INPUT_ERROR");
    }
  });

  test("SSO rejects blank required identities and non-positive ids", async () => {
    const cases = [
      ["sso", "subaccount-url", "--subuser", ""],
      ["sso", "partner-url", "--username", "   "],
      ["sso", "user-system-url", "--u", "user", "--system_id", "0", "--uid", "uid"],
      ["sso", "user-system-url", "--u", "user", "--system_id", "1", "--uid", "uid", "--activity", "-1"],
    ];
    for (const args of cases) {
      const result = await runCli(args);
      assert.equal(result.exitCode, 2, `${args.join(" ")} unexpectedly succeeded`);
      assert.equal(parseProblem(result).error.code, "INPUT_ERROR");
    }
  });

  test("all remote commands execute the expected action and preserve success envelope", async () => {
    const fixture = await startFixture({
      response: { result: true, data: { title: "矩阵问卷", description: "", questions: [] } },
      env: { WJX_API_KEY: "matrix-key" },
    });
    try {
      for (const item of REMOTE_CASES) {
        const before = fixture.requests().length;
        const result = await fixture.run([...(item.highRisk ? ["--yes"] : []), ...item.path, ...item.args]);
        assert.equal(result.exitCode, 0, `${item.id}: ${result.stderr}`);
        assert.equal(result.stderr.trim(), "", `unexpected success diagnostics for ${item.id}: ${result.stderr}`);
        const successEnvelope = JSON.parse(result.stdout);
        assert.equal(successEnvelope.ok, true, `${item.id} did not emit ResultEnvelope`);
        const requests = fixture.requests().slice(before);
        assert.ok(requests.length >= 1, `${item.id} did not reach transport`);
        const finalBody = JSON.parse(requests.at(-1).body);
        assert.equal(String(finalBody.action), String(item.action), `${item.id} sent wrong action`);
        assert.equal(requests.at(-1).headers.authorization, "Bearer matrix-key", `${item.id} did not send credentials`);
        if (item.id === "response.submit") assert.equal(requests.length, 1, "explicit jpmversion should submit without metadata prefetch");
      }
    } finally {
      await fixture.close();
    }
  });

  test("high-risk commands require explicit authorization and make zero requests", async () => {
    const fixture = await startFixture({ env: { WJX_API_KEY: "matrix-key" } });
    try {
      for (const item of REMOTE_CASES.filter((entry) => entry.highRisk)) {
        const before = fixture.requests().length;
        const result = await fixture.run(["--non-interactive", ...item.path, ...item.args]);
        assert.equal(result.exitCode, 3, `${item.id} was not blocked: ${result.stdout}`);
        const problem = parseProblem(result);
        assert.equal(problem.error.code, "CONFIRMATION_REQUIRED", item.id);
        assert.equal(problem.error.confirmation_source, "missing", item.id);
        assert.equal(fixture.requests().length, before, `${item.id} requested before confirmation`);
      }
    } finally {
      await fixture.close();
    }
  });

  test("API failures remain ProblemEnvelopes for every remote command", async () => {
    const fixture = await startFixture({
      response: { result: false, errormsg: "matrix upstream failure", errorcode: "MATRIX_FAIL", traceid: "matrix-trace" },
      env: { WJX_API_KEY: "matrix-key" },
    });
    try {
      for (const item of REMOTE_CASES) {
        const result = await fixture.run([...(item.highRisk ? ["--yes"] : []), ...item.path, ...item.args]);
        assert.equal(result.exitCode, 1, `${item.id} did not route API failure to exit 1`);
        const problem = parseProblem(result);
        assert.equal(problem.error.code, "API_ERROR", item.id);
        assert.equal(problem.error.message, "matrix upstream failure", item.id);
        assert.equal(problem.error.errorcode, "MATRIX_FAIL", item.id);
        assert.equal(problem.error.traceid, "matrix-trace", item.id);
      }
    } finally {
      await fixture.close();
    }
  });

  test("ordinary remote commands fail authentication without touching transport", async () => {
    for (const item of REMOTE_CASES.filter((entry) => !entry.highRisk)) {
      const result = await runCli(item.path.concat(item.args));
      assert.equal(result.exitCode, 1, `${item.id} did not fail auth`);
      assert.equal(parseProblem(result).error.code, "AUTH_ERROR", item.id);
    }
  });

  test("missing corporate id during dry-run is classified as input, not API failure", async () => {
    const result = await runCli(["--dry-run", "contacts", "query", "--uid", "u-1"]);
    assert.equal(result.exitCode, 2);
    const problem = parseProblem(result);
    assert.equal(problem.error.code, "INPUT_ERROR");
    assert.match(problem.error.message, /corpid/i);
  });

  test("init dry-run performs no validation request, config write, or skill install", async () => {
    const root = await mkdtemp(resolve(process.env.TEMP ?? ".", "wjx-init-matrix-"));
    const configPath = resolve(root, ".wjxrc");
    try {
      const result = await runCli(["--dry-run", "--api-key", "dry-key", "init", "--no-install-skill", "--target-dir", root], {
        env: { WJX_CONFIG_PATH: configPath, WJX_API_URL: "http://127.0.0.1:1/openapi/default.aspx" },
      });
      assert.equal(result.exitCode, 0, result.stderr);
      const envelope = parseSuccess(result);
      assert.equal(envelope.data.kind, "dry-run");
      assert.equal(envelope.data.input.apiKey, "****");
      await assert.rejects(() => access(configPath));
      await assert.rejects(() => access(resolve(root, "skills")));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("skill install dry-run has no filesystem side effect", async () => {
    const root = await mkdtemp(resolve(process.env.TEMP ?? ".", "wjx-skill-matrix-"));
    try {
      for (const command of ["install", "update", "install-ppt", "update-ppt"]) {
        const args = ["--dry-run", "skill", command, "--silent"];
        if (command.endsWith("-ppt")) args.push("--skip-pip");
        args.push("--target-dir", root);
        const result = await runCli(args);
        assert.equal(result.exitCode, 0, `${command}: ${result.stderr}`);
        const envelope = parseSuccess(result);
        assert.equal(envelope.data.kind, "dry-run", command);
      }
      await assert.rejects(() => access(resolve(root, "skills")));
      await assert.rejects(() => access(resolve(root, ".claude")));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("completion install dry-run has no profile side effect", async () => {
    const result = await runCli(["--dry-run", "completion", "install"], { env: { SHELL: "" } });
    assert.equal(result.exitCode, 0, result.stderr);
    const envelope = parseSuccess(result);
    assert.equal(envelope.data.kind, "dry-run");
    assert.deepEqual(envelope.data.plans, []);
  });

  test("update dry-run does not invoke npm", async () => {
    const root = await mkdtemp(resolve(process.env.TEMP ?? ".", "wjx-update-matrix-"));
    try {
      await writeFile(resolve(root, "npm.cmd"), "@echo off\r\nexit /b 0\r\n", "utf8");
      const result = await runCli(["--dry-run", "update", "--silent"], {
        env: { PATH: `${root};${process.env.PATH ?? ""}` },
      });
      assert.equal(result.exitCode, 0, result.stderr);
      const envelope = parseSuccess(result);
      assert.equal(envelope.data.kind, "dry-run");
      assert.deepEqual(envelope.data.plans, []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("diagnostic API consumers honor dry-run without network requests", async () => {
    const fixture = await startFixture({
      env: { WJX_API_KEY: "diagnostic-dry-run-key" },
      response: { result: true, data: { total_count: 1, activitys: {} } },
    });
    try {
      for (const command of ["whoami", "doctor"]) {
        const result = await fixture.run(["--dry-run", command]);
        assert.equal(result.exitCode, 0, `${command}: ${result.stderr}`);
        const envelope = parseSuccess(result);
        assert.equal(envelope.data.kind, "dry-run", command);
        assert.deepEqual(envelope.data.plans, [], `${command} must not build a live request`);
      }
      assert.equal(fixture.requests().length, 0);
    } finally {
      await fixture.close();
    }
  });

  test("whoami reads total_surveys from the API data payload", async () => {
    const fixture = await startFixture({
      response: { result: true, data: { total_count: 7, activitys: {} } },
      env: { WJX_API_KEY: "whoami-key" },
    });
    try {
      const result = await fixture.run(["whoami"]);
      assert.equal(result.exitCode, 0, result.stderr);
      assert.equal(parseSuccess(result).data.total_surveys, 7);
    } finally {
      await fixture.close();
    }
  });

  test("doctor reports a successful connectivity check without leaking credentials", async () => {
    const fixture = await startFixture({ response: { result: true, data: { total_count: 2, activitys: {} } }, env: { WJX_API_KEY: "doctor-key" } });
    try {
      const result = await fixture.run(["doctor"]);
      assert.equal(result.exitCode, 0, result.stderr);
      assert.equal(result.stderr.trim(), "");
      const output = JSON.parse(result.stdout);
      assert.equal(output.ok, true);
      assert.ok(Array.isArray(output.data.checks));
      assert.equal(output.data.checks.find((check) => check.check === "API 连接")?.status, "ok");
      assert.doesNotMatch(result.stdout, /doctor-key/);
    } finally {
      await fixture.close();
    }
  });

  test("all output formats preserve successful data and aliases stay silent", async () => {
    const response = { result: true, data: { rows: [{ id: 1, title: "one" }, { id: 2, title: "two" }] } };
    for (const format of ["json", "pretty", "table", "ndjson", "csv"]) {
      const fixture = await startFixture({ response, env: { WJX_API_KEY: "format-key" } });
      try {
        const result = await fixture.run(["survey", "list", "--format", format]);
        assert.equal(result.exitCode, 0, `${format}: ${result.stderr}`);
        assert.equal(result.stderr.trim(), "", `${format} emitted a runtime deprecation warning`);
        assert.ok(result.stdout.trim(), `${format} emitted no data`);
        if (format === "json") assert.equal(JSON.parse(result.stdout).ok, true);
        if (format === "ndjson") assert.equal(JSON.parse(result.stdout.trim()).rows.length, 2);
        if (format === "csv") {
          assert.match(result.stdout, /"id","title"/);
          assert.doesNotMatch(result.stdout, /\[object Object\]/);
        }
      } finally {
        await fixture.close();
      }
    }

    const aliasFixture = await startFixture({ response, env: { WJX_API_KEY: "format-key" } });
    try {
      for (const alias of ["--json", "--table"]) {
        const result = await aliasFixture.run([alias, "survey", "list"]);
        assert.equal(result.exitCode, 2, alias);
        assert.equal(result.stdout.trim(), "", `${alias} must not write stdout`);
        const problem = parseProblem(result, "INPUT_ERROR");
        assert.match(problem.error.message, new RegExp(alias.replace("--", "\\-\\-")));
      }
    } finally {
      await aliasFixture.close();
    }
  });

  test("dry-run redacts sensitive values in request bodies and local inputs", async () => {
    const fixture = await startFixture({ env: { WJX_API_KEY: "redaction-key" } });
    try {
      const cases = [
        {
          args: ["--dry-run", "account", "add", "--subuser", "child", "--password", "SuperSecret123"],
          expectedPath: ["password"],
        },
        {
          args: ["--dry-run", "user-system", "add-participants", "--sysid", "9", "--users", json([{ uid: "u-1", upass: "NestedSecret456" }])],
          expectedPath: ["users", "upass"],
        },
        {
          args: ["--dry-run", "api", "--service", "default", "--action", "survey.list", "--body", json({ token: "ApiToken789", nested: { client_secret: "ClientSecret012" } })],
          expectedPath: ["body", "token"],
        },
      ];

      for (const item of cases) {
        const result = await fixture.run(item.args);
        assert.equal(result.exitCode, 0, result.stderr);
        assert.equal(result.stderr.trim(), "");
        assert.doesNotMatch(result.stdout, /SuperSecret123|NestedSecret456|ApiToken789|ClientSecret012/);
        const envelope = parseSuccess(result);
        const plan = envelope.data.plans[0];
        const body = JSON.parse(plan.body);
        if (item.expectedPath[0] === "users") {
          const users = JSON.parse(body.users);
          assert.equal(users[0].upass, "****");
        } else if (item.expectedPath[0] === "body") {
          assert.equal(body.token, "****");
          assert.equal(body.nested.client_secret, "****");
        } else {
          assert.equal(body.password, "****");
        }
      }

      const sso = await fixture.run([
        "--dry-run", "sso", "user-system-url", "--u", "owner", "--system_id", "9", "--uid", "u-1", "--upass", "SsoSecret345",
      ]);
      assert.equal(sso.exitCode, 0, sso.stderr);
      assert.doesNotMatch(sso.stdout, /SsoSecret345/);
      assert.equal(parseSuccess(sso).data.input.upass, "****");
      assert.equal(fixture.requests().length, 0);
    } finally {
      await fixture.close();
    }
  });

  test("export-text gives a specific API error for malformed survey payloads", async () => {
    const fixture = await startFixture({ response: { result: true, data: {} }, env: { WJX_API_KEY: "export-key" } });
    try {
      const result = await fixture.run(["survey", "export-text", "--vid", "42"]);
      assert.equal(result.exitCode, 1);
      const problem = parseProblem(result);
      assert.equal(problem.error.code, "API_ERROR");
      assert.match(problem.error.message, /questions/i);
    } finally {
      await fixture.close();
    }
  });

  test("local and operational command matrix covers every non-API leaf", async () => {
    const appKey = "local-matrix-key";
    const rawBody = JSON.stringify({ event: "response.created" });
    const pushPayload = { vid: 42, jid: 7, submitdata: "1$1" };
    const signature = createHash("sha1").update(rawBody + appKey, "utf8").digest("hex");
    const cases = [
      { id: "analytics.decode", args: ["analytics", "decode", "--submitdata", "1$1"] },
      { id: "analytics.nps", args: ["analytics", "nps", "--scores", "[9,10,7]"] },
      { id: "analytics.csat", args: ["analytics", "csat", "--scores", "[4,5,3]"] },
      { id: "analytics.anomalies", args: ["analytics", "anomalies", "--responses", json([])] },
      { id: "analytics.compare", args: ["analytics", "compare", "--set_a", json({ nps: 1 }), "--set_b", json({ nps: 2 })] },
      { id: "analytics.decode-push", args: ["analytics", "decode-push", "--payload", encryptPush(pushPayload, appKey), "--app_key", appKey, "--signature", signature, "--raw_body", rawBody] },
      { id: "completion.bash", args: ["completion", "bash"], raw: /_wjx_completions/ },
      { id: "completion.zsh", args: ["completion", "zsh"], raw: /compdef/ },
      { id: "completion.fish", args: ["completion", "fish"], raw: /complete -c wjx/ },
      { id: "sso.subaccount-url", args: ["sso", "subaccount-url", "--subuser", "child-1"] },
      { id: "sso.user-system-url", args: ["sso", "user-system-url", "--u", "owner", "--system_id", "9", "--uid", "u-1"] },
      { id: "sso.partner-url", args: ["sso", "partner-url", "--username", "partner-1"] },
      { id: "survey.jsonl-template", args: ["survey", "jsonl-template", "--type", "1"] },
      { id: "survey.url", args: ["survey", "url", "--mode", "create", "--name", "矩阵问卷"] },
      { id: "api", args: ["--dry-run", "api", "--service", "default", "--action", "survey.list", "--params", json({ page_size: 1 })] },
      { id: "schema", args: ["schema", "survey.list"] },
      { id: "reference", args: ["reference", "analytics"] },
    ];
    for (const item of cases) {
      const result = await runCli(item.args);
      assert.equal(result.exitCode, 0, `${item.id}: ${result.stderr}`);
      assert.equal(result.stderr.trim(), "", `${item.id} wrote diagnostics`);
      if (item.raw) assert.match(result.stdout, item.raw, item.id);
      else assert.equal(JSON.parse(result.stdout).ok, true, item.id);
    }
  });

  test("Skill source remains present and points Agents at canonical command families", async () => {
    const skill = await readFile(resolve(__dirname, "..", "..", "wjx-skills", "wjx-cli-use", "SKILL.md"), "utf8");
    for (const phrase of ["create", "response submit", "response query", "analytics nps", "total_count", "--dry-run"]) {
      assert.ok(skill.includes(phrase), `Skill is missing canonical phrase: ${phrase}`);
    }
  });

  test("raw API JSON options support @file and reject missing files", async () => {
    const tempDir = await mkdtemp(resolve(process.env.TEMP ?? ".", "wjx-api-file-matrix-"));
    try {
      const paramsFile = resolve(tempDir, "params.json");
      const bodyFile = resolve(tempDir, "body.json");
      await writeFile(paramsFile, json({ page_index: 3, page_size: 7 }), "utf8");
      await writeFile(bodyFile, json({ name_like: "from-file" }), "utf8");

      const result = await runCli([
        "--dry-run", "api", "--service", "default", "--action", "survey.list",
        "--params", `@${paramsFile}`, "--body", `@${bodyFile}`,
      ], { env: { WJX_API_KEY: "file-matrix-key" } });
      assert.equal(result.exitCode, 0, result.stderr);
      const envelope = parseSuccess(result);
      const body = JSON.parse(envelope.data.plans[0].body);
      assert.equal(body.page_index, 3);
      assert.equal(body.page_size, 7);
      assert.equal(body.name_like, "from-file");
      assert.equal(body.action, Action.LIST_SURVEYS);

      const missing = await runCli([
        "--dry-run", "api", "--service", "default", "--action", "survey.list",
        "--params", `@${resolve(tempDir, "missing.json")}`,
      ], { env: { WJX_API_KEY: "file-matrix-key" } });
      assert.equal(missing.exitCode, 2);
      assert.equal(parseProblem(missing).error.code, "INPUT_ERROR");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("Skill black-box option matrix executes every leaf option with a valid scenario", async () => {
    const tempDir = await mkdtemp(resolve(process.env.TEMP ?? ".", "wjx-option-matrix-"));
    const covered = new Set();
    const expectedLocalOptions = new Set();
    const remoteById = new Map(REMOTE_CASES.map((item) => [item.id, item]));
    const localById = new Map(LOCAL_DRY_RUN_CASES.map((item) => [item.id, item]));
    try {
      for (const command of LEAF_COMMANDS) {
        const path = command.split(".");
        const help = await runCli([...path, "--help"]);
        assert.equal(help.exitCode, 0, `${command}: ${help.stderr}`);
        const options = extractSurfaceOptions(help.stdout);
        const remote = remoteById.get(command);
        const local = localById.get(command);

        // Every API shortcut has a canonical invocation. For each option, run
        // a separate dry-run so failures identify the exact command/flag.
        if (remote) {
          for (const option of options) {
            const key = `${command}:${option.flag}`;
            if (GLOBAL_OPTION_FLAGS.has(option.flag)) continue;
            expectedLocalOptions.add(key);
            let baseArgs = [...remote.args];
            // Mutually exclusive input sources/aliases must be tested alone.
            if (option.flag === "--file") {
              baseArgs = removeOption(baseArgs, "--jsonl");
            } else if (option.flag === "--submitdata-file") {
              baseArgs = removeOption(baseArgs, "--submitdata");
            } else if (option.flag === "--status") {
              baseArgs = removeOption(baseArgs, "--state");
            }
            // Replace any canonical value so the option is explicitly
            // exercised, including boolean flags and aliases.
            baseArgs = removeOption(baseArgs, option.flag);
            const args = ["--dry-run", ...path, ...baseArgs, option.flag];
            const value = await coverageValue(command, option, tempDir);
            if (value !== undefined) args.push(value);
            const result = await runCli(args, {
              env: { WJX_API_KEY: "option-matrix-key", SHELL: "" },
              timeout: 20_000,
            });
            assert.equal(result.exitCode, 0, `${command} ${option.flag}: ${result.stderr || result.stdout}`);
            assert.equal(result.stderr.trim(), "", `${command} ${option.flag} emitted diagnostics`);
            const envelope = parseSuccess(result);
            assert.equal(envelope.data.kind, "dry-run", key);
            assert.ok(Array.isArray(envelope.data.plans), key);
            assertOptionReflected(command, option.flag, value, envelope);
            covered.add(key);
          }
          continue;
        }

        // Local commands use the same option-level matrix, while preserving
        // their real validation rules (analytics payloads, URL modes, etc.).
        if (!local) throw new Error(`Missing canonical evaluation case for ${command}`);
        for (const option of options) {
          const key = `${command}:${option.flag}`;
          if (GLOBAL_OPTION_FLAGS.has(option.flag)) continue;
          expectedLocalOptions.add(key);
          let baseArgs = [...local.args];
          if (command === "survey.url" && option.flag === "--activity") {
            baseArgs = removeOption(removeOption(baseArgs, "--mode"), "--name");
            baseArgs.push("--mode", "edit");
          }
          if (command === "analytics.decode-push" && option.flag === "--signature") {
            // The optional signature is meaningful only with its matching raw
            // body; provide both values as a valid pair for this scenario.
            baseArgs.push("--raw_body", JSON.stringify({ event: "response.created" }));
          }
          if (command === "analytics.decode-push" && (option.flag === "--payload" || option.flag === "--app_key")) {
            baseArgs = removeOption(removeOption(baseArgs, "--payload"), "--app_key");
            baseArgs.push(
              "--payload", encryptPush({ vid: 42, jid: 7, submitdata: "1$1" }, "coverage-key"),
              "--app_key", "coverage-key",
            );
          }
          baseArgs = removeOption(baseArgs, option.flag);
          const args = ["--dry-run", ...baseArgs, option.flag];
          const value = await coverageValue(command, option, tempDir);
          if (value !== undefined) args.push(value);
          const result = await runCli(args, {
            env: { WJX_API_KEY: "option-matrix-key", SHELL: "" },
            timeout: 20_000,
          });
          assert.equal(result.exitCode, 0, `${command} ${option.flag}: ${result.stderr || result.stdout}`);
          assert.equal(result.stderr.trim(), "", `${command} ${option.flag} emitted diagnostics`);
          assert.ok(result.stdout.trim(), `${command} ${option.flag} emitted no output`);
          const envelope = (() => {
            try { return JSON.parse(result.stdout); } catch { return undefined; }
          })();
          if (envelope?.ok === true && envelope.data?.kind === "dry-run") {
            assertOptionReflected(command, option.flag, value, envelope);
          }
          covered.add(key);
        }
      }

      // The local option matrix above covers every command-local option
      // occurrence (some flag names intentionally repeat across commands).
      // nine root controls are evaluated explicitly because they do not appear
      // in leaf help output.
      const globalCases = [
        ["--api-key", "matrix-key"], ["--format", "json"],
        ["--dry-run"], ["--yes"], ["--non-interactive"], ["--profile", "default"],
      ];
      for (const [flag, value] of globalCases) {
        const args = value === undefined ? [flag, "survey", "list", "--help"] : [flag, value, "survey", "list", "--help"];
        const result = await runCli(args, { env: { SHELL: "" } });
        assert.equal(result.exitCode, 0, `${flag}: ${result.stderr}`);
      }
      const stdinResult = await runCli(["--stdin", "--dry-run", "survey", "list"], { input: "{}" });
      assert.equal(stdinResult.exitCode, 0, stdinResult.stderr);

      assert.deepEqual([...covered].sort(), [...expectedLocalOptions].sort(),
        `option matrix did not execute every command-local option (covered ${covered.size}, expected ${expectedLocalOptions.size})`);
      // This is the current command-local occurrence denominator. Keep it
      // explicit so a help/parser drift cannot silently shrink the matrix.
      assert.equal(expectedLocalOptions.size, 251,
        "update the command-local option denominator only when the public surface intentionally changes");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
