import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, "..", "dist", "index.js");

function runCli(args) {
  return new Promise((done) => {
    execFile(process.execPath, [CLI, "--dry-run", ...args], {
      env: {
        ...process.env,
        WJX_CONFIG_PATH: resolve(__dirname, "..", "__boundary_eval_no_config__"),
        WJX_API_KEY: "boundary-test-key",
        WJX_CORP_ID: "corp-boundary",
      },
      encoding: "utf8",
      timeout: 10_000,
    }, (error, stdout, stderr) => {
      done({ code: error ? (typeof error.code === "number" ? error.code : 1) : 0, stdout, stderr });
    });
  });
}

function assertInputError(result, label) {
  assert.equal(result.code, 2, `${label} unexpectedly exited ${result.code}: ${result.stdout}${result.stderr}`);
  assert.equal(result.stdout.trim(), "", `${label} wrote success output`);
  const envelope = JSON.parse(result.stderr);
  assert.equal(envelope.ok, false, `${label} did not emit ProblemEnvelope`);
  assert.equal(envelope.error.code, "INPUT_ERROR", label);
}

test("Skill enum and range contracts reject invalid remote options before transport", async () => {
  const cases = [
    ["survey", "status", "--vid", "42", "--state", "0"],
    ["survey", "status", "--vid", "42", "--state", "4"],
    ["survey", "list", "--status", "9"],
    ["survey", "list", "--atype", "99"],
    ["survey", "list", "--sort", "9"],
    ["survey", "list", "--time_type", "9"],
    ["department", "delete", "--type", "0", "--depts", "[\"d1\"]"],
    ["department", "delete", "--type", "3", "--depts", "[\"d1\"]"],
    ["tag", "delete", "--type", "0", "--tags", "[\"t1\"]"],
    ["tag", "delete", "--type", "3", "--tags", "[\"t1\"]"],
    ["response", "realtime", "--vid", "42", "--count", "0"],
    ["response", "realtime", "--vid", "42", "--count", "-1"],
    ["response", "query", "--vid", "42", "--page_size", "0"],
    ["response", "query", "--vid", "42", "--page_size", "51"],
    ["response", "query", "--vid", "42", "--sort", "2"],
    ["response", "query", "--vid", "42", "--file_view_expires", "0"],
    ["response", "download", "--vid", "42", "--query_count", "0"],
    ["response", "download", "--vid", "42", "--sort", "2"],
    ["response", "download", "--vid", "42", "--query_type", "3"],
    ["response", "download", "--vid", "42", "--suffix", "3"],
    ["response", "winners", "--vid", "42", "--atype", "2"],
    ["response", "winners", "--vid", "42", "--awardstatus", "2"],
    ["account", "list", "--role", "0"],
    ["account", "list", "--role", "5"],
    ["account", "list", "--group", "0"],
  ];

  for (const args of cases) assertInputError(await runCli(args), args.join(" "));
});

test("Skill local URL and submit contracts reject invalid role and duration values", async () => {
  const cases = [
    ["sso", "subaccount-url", "--subuser", "child", "--role_id", "0"],
    ["sso", "subaccount-url", "--subuser", "child", "--role_id", "5"],
    ["sso", "subaccount-url", "--subuser", "child", "--admin", "0"],
    ["sso", "subaccount-url", "--subuser", "child", "--admin", "2"],
    ["account", "add", "--subuser", "child", "--role", "0"],
    ["account", "add", "--subuser", "child", "--role", "5"],
    ["response", "submit", "--vid", "42", "--inputcosttime", "0", "--submitdata", "1$1", "--jpmversion", "1"],
    ["response", "submit", "--vid", "42", "--inputcosttime", "1", "--submitdata", "1$1", "--jpmversion", "1"],
  ];

  for (const args of cases) assertInputError(await runCli(args), args.join(" "));
});

test("every documented enum boundary has an executable dry-run case", async () => {
  const cases = [
    { base: ["survey", "status", "--vid", "42"], flag: "--state", values: ["1", "2", "3"] },
    { base: ["survey", "list"], flag: "--status", values: ["0", "1", "2", "3", "5"] },
    { base: ["survey", "list"], flag: "--atype", values: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"] },
    { base: ["survey", "list"], flag: "--sort", values: ["0", "1", "2", "3", "4", "5"] },
    { base: ["survey", "list"], flag: "--time_type", values: ["0", "1", "2"] },
    { base: ["department", "delete", "--depts", "[\"d1\"]"], flag: "--type", values: ["1", "2"] },
    { base: ["tag", "delete", "--tags", "[\"t1\"]"], flag: "--type", values: ["1", "2"] },
    { base: ["response", "query", "--vid", "42"], flag: "--sort", values: ["0", "1"] },
    { base: ["response", "query", "--vid", "42"], flag: "--page_size", values: ["1", "50"] },
    { base: ["response", "download", "--vid", "42"], flag: "--sort", values: ["0", "1"] },
    { base: ["response", "download", "--vid", "42"], flag: "--query_type", values: ["0", "1", "2"] },
    { base: ["response", "download", "--vid", "42"], flag: "--suffix", values: ["0", "1", "2"] },
    { base: ["response", "winners", "--vid", "42"], flag: "--atype", values: ["-1", "0", "1"] },
    { base: ["response", "winners", "--vid", "42"], flag: "--awardstatus", values: ["-1", "0", "1"] },
    { base: ["account", "add", "--subuser", "child"], flag: "--role", values: ["1", "2", "3", "4"] },
    { base: ["sso", "subaccount-url", "--subuser", "child"], flag: "--role_id", values: ["1", "2", "3", "4"] },
    { base: ["sso", "subaccount-url", "--subuser", "child"], flag: "--admin", values: ["1"] },
    { base: ["sso", "user-system-url", "--u", "owner", "--system_id", "9", "--uid", "u1"], flag: "--is_login", values: ["0", "1"] },
    { base: ["response", "submit", "--vid", "42", "--inputcosttime", "2", "--submitdata", "1$1", "--jpmversion", "1"], flag: "--inputcosttime", values: ["2", "30"] },
  ];
  for (const item of cases) {
    for (const value of item.values) {
      const result = await runCli([...item.base, item.flag, value]);
      assert.equal(result.code, 0, `${item.base.join(" ")} ${item.flag}=${value}: ${result.stderr}`);
      assert.equal(result.stderr.trim(), "", `${item.flag}=${value} emitted diagnostics`);
      const envelope = JSON.parse(result.stdout);
      assert.equal(envelope.ok, true, `${item.flag}=${value} did not emit success envelope`);
    }
  }
});
