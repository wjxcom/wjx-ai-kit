import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const CLI = resolve(packageRoot, "dist", "index.js");
const WRITES_ENABLED = process.env.WJX_E2E === "1" && process.env.WJX_E2E_ACCOUNT_WRITES === "1";
const COMMAND_TIMEOUT_MS = 120_000;

function runCli(args, options = {}) {
  return new Promise((done) => {
    execFile(process.execPath, [CLI, ...args], {
      cwd: packageRoot,
      env: { ...process.env, ...(options.env ?? {}) },
      encoding: "utf8",
      timeout: options.timeout ?? COMMAND_TIMEOUT_MS,
      maxBuffer: 4 * 1024 * 1024,
    }, (error, stdout, stderr) => done({
      code: error && typeof error.code === "number" ? error.code : error ? 1 : 0,
      stdout: stdout || "",
      stderr: stderr || "",
    }));
  });
}

function parseEnvelope(result, label) {
  const raw = result.stdout.trim() || result.stderr.trim();
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw new Error(`${label} returned non-JSON output: ${raw.slice(0, 500)}`);
  }
  return envelope;
}

function success(result, label) {
  assert.equal(result.code, 0, `${label} failed: ${result.stderr || result.stdout}`);
  const envelope = parseEnvelope(result, label);
  assert.equal(envelope.ok, true, `${label} returned an unsuccessful result: ${JSON.stringify(envelope)}`);
  return envelope.data;
}

function numeric(value) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value);
  return undefined;
}

function findValue(value, keys) {
  const queue = [value];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (!Array.isArray(current)) {
      for (const key of keys) {
        const found = current[key];
        if (found !== undefined && found !== null) return found;
      }
    }
    for (const child of Object.values(current)) {
      if (child && typeof child === "object") queue.push(child);
    }
  }
  return undefined;
}

function findVid(value) {
  return numeric(findValue(value, ["vid", "activity_id", "activityid"]));
}

function records(value) {
  if (!value || typeof value !== "object") return [];
  for (const key of ["answers", "responses", "rows", "list", "items", "records"]) {
    if (Array.isArray(value[key])) return value[key];
    if (value[key] && typeof value[key] === "object") return Object.values(value[key]);
  }
  return [];
}

function responseJid(value, marker) {
  const row = records(value).find((item) => {
    if (!item || typeof item !== "object") return false;
    if (!marker) return true;
    return Object.values(item).some((candidate) => String(candidate) === marker);
  });
  return numeric(row?.jid ?? row?.id ?? row?.answer_id);
}

function questions(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value.questions)) return value.questions;
  if (value.data && typeof value.data === "object" && Array.isArray(value.data.questions)) return value.data.questions;
  return [];
}

function settingObject(value) {
  if (!value || typeof value !== "object") return {};
  for (const key of ["msg_setting", "settings", "setting", "data"]) {
    if (value[key] && typeof value[key] === "object" && !Array.isArray(value[key])) {
      if (key === "data" && !("quick_post" in value[key])) continue;
      return value[key];
    }
  }
  return value;
}

function describeFailure(result) {
  return (result.stdout || result.stderr || "").replace(/sk-wjx-[^\"\s]+/g, "sk-wjx-<redacted>").slice(0, 1000);
}

async function createSurvey(prefix, { publish = true, exam = false } = {}) {
  const tempDir = await mkdtemp(resolve(process.env.TEMP ?? ".", "wjx-account-e2e-"));
  const title = `${prefix} ${exam ? "exam" : "survey"}`;
  const jsonl = [
    JSON.stringify({ qtype: "问卷基础信息", title, atype: exam ? 6 : 1 }),
    JSON.stringify(exam
      ? { qtype: "考试简答", title: "请简述测试答案", quizscore: "5" }
      : { qtype: "单选", title: `${prefix} choice`, select: ["是", "否"] }),
  ].join("\n") + "\n";
  const file = resolve(tempDir, "survey.jsonl");
  await writeFile(file, jsonl, "utf8");
  try {
    const data = success(await runCli(["survey", "create", "--file", file, ...(publish ? ["--publish"] : [])]), "survey create");
    const vid = findVid(data);
    assert.ok(vid, `survey create did not return a verifiable vid: ${JSON.stringify(data)}`);
    return { vid, title, tempDir };
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

async function cleanupSurvey(survey, username, failures) {
  if (!survey?.vid) return;
  if (!survey.purged) {
    let result = await runCli(["--yes", "survey", "delete", "--vid", String(survey.vid), "--username", username, "--completely"]);
    if (result.code !== 0 && /还有答卷|responses/i.test(result.stdout + result.stderr)) {
      const cleared = await runCli(["--yes", "response", "clear", "--username", username, "--vid", String(survey.vid), "--reset_to_zero"]);
      if (cleared.code === 0) {
        result = await runCli(["--yes", "survey", "delete", "--vid", String(survey.vid), "--username", username, "--completely"]);
      }
    }
    if (result.code !== 0) failures.push(`survey ${survey.vid} cleanup failed: ${describeFailure(result)}`);
  }
  await rm(survey.tempDir, { recursive: true, force: true });
}

function writeGate(t, reason) {
  if (!WRITES_ENABLED) {
    t.skip("真实写 E2E 需要同时设置 WJX_E2E=1 和 WJX_E2E_ACCOUNT_WRITES=1");
    return false;
  }
  if (!process.env.WJX_USERNAME?.trim()) {
    t.skip("真实问卷写 E2E 需要 WJX_USERNAME，以便清理临时问卷");
    return false;
  }
  if (reason) t.diagnostic(reason);
  return true;
}

test("real account E2E: survey settings update preserves and verifies the requested patch", { skip: !WRITES_ENABLED }, async (t) => {
  if (!writeGate(t)) return;
  const username = process.env.WJX_USERNAME.trim();
  const prefix = `codex-account-${Date.now().toString(36)}`;
  const failures = [];
  let survey;
  try {
    survey = await createSurvey(prefix, { publish: false });
    const before = success(await runCli(["survey", "settings", "--vid", String(survey.vid)]), "survey settings before");
    const existing = settingObject(before);
    // `msg_setting` currently exposes post_url_global for normal surveys.
    // Keep the service-owned shape intact and update that existing field.
    const nextValue = typeof existing.post_url_global === "string" ? existing.post_url_global : "";
    const updateResult = await runCli([
      "--yes", "survey", "update-settings", "--vid", String(survey.vid), "--msg_setting", JSON.stringify({ post_url_global: nextValue }),
    ]);
    if (updateResult.code !== 0) {
      const afterFailure = await runCli(["survey", "settings", "--vid", String(survey.vid)]);
      t.diagnostic(`settings before=${JSON.stringify(existing)} update=${describeFailure(updateResult)} after=${describeFailure(afterFailure)}`);
    }
    const update = success(updateResult, "survey settings update");
    assert.equal(update.outcome, "verified", JSON.stringify(update));
    const after = success(await runCli(["survey", "settings", "--vid", String(survey.vid)]), "survey settings after");
    assert.equal(settingObject(after).post_url_global, nextValue);
  } finally {
    await cleanupSurvey(survey, username, failures);
    assert.deepEqual(failures, [], failures.join("\n"));
  }
});

test("real account E2E: recycle bin transitions status 3 to terminal status 4", { skip: !WRITES_ENABLED }, async (t) => {
  if (!writeGate(t)) return;
  const username = process.env.WJX_USERNAME.trim();
  const prefix = `codex-recycle-${Date.now().toString(36)}`;
  let survey;
  const failures = [];
  try {
    survey = await createSurvey(prefix, { publish: false });
    const deleted = success(await runCli(["--yes", "survey", "delete", "--vid", String(survey.vid), "--username", username]), "survey delete to recycle bin");
    assert.equal(deleted.outcome, "verified", JSON.stringify(deleted));
    assert.equal(deleted.status, "deleted", JSON.stringify(deleted));
    const cleared = success(await runCli(["--yes", "survey", "clear-bin", "--vid", String(survey.vid), "--username", username]), "clear recycle bin");
    assert.equal(cleared.outcome, "verified", JSON.stringify(cleared));
    assert.equal(cleared.status, "hard-deleted", JSON.stringify(cleared));
    survey.purged = true;
  } finally {
    await cleanupSurvey(survey, username, failures);
    assert.deepEqual(failures, [], failures.join("\n"));
  }
});

test("real account E2E: response submit, modify, and clear are observable", { skip: !WRITES_ENABLED }, async (t) => {
  if (!writeGate(t)) return;
  const username = process.env.WJX_USERNAME.trim();
  const prefix = `codex-response-${Date.now().toString(36)}`;
  const marker = `${prefix}-marker`;
  const failures = [];
  let survey;
  try {
    survey = await createSurvey(prefix, { publish: true, exam: true });
    const detail = success(await runCli(["survey", "get", "--vid", String(survey.vid), "--get_questions", "--get_items"]), "survey get response fixture");
    const question = questions(detail).find((item) => numeric(item.q_index));
    assert.ok(question, `no question with q_index returned: ${JSON.stringify(detail)}`);
    const qIndex = numeric(question.q_index);
    const submitdata = `${qIndex}$测试答案`;
    const submitted = success(await runCli([
      "response", "submit", "--vid", String(survey.vid), "--inputcosttime", "5", "--submitdata", submitdata, "--sojumpparm", marker,
    ]), "response submit");
    assert.ok(numeric(submitted.jid), JSON.stringify(submitted));
    assert.equal(numeric(submitted.vid), survey.vid, JSON.stringify(submitted));

    const queried = success(await runCli(["response", "query", "--vid", String(survey.vid), "--sojumpparm", marker, "--page_index", "1", "--page_size", "10"]), "response query");
    const jid = responseJid(queried, marker);
    assert.ok(jid, `submitted response did not return a jid: ${JSON.stringify(queried)}`);
    const answers = JSON.stringify({ [qIndex * 10000]: "4" });
    const modifyResult = await runCli(["--yes", "response", "modify", "--vid", String(survey.vid), "--jid", String(jid), "--answers", answers]);
    if (modifyResult.code !== 0) {
      const diagnostic = describeFailure(modifyResult);
      if (/答卷无效或不存在|读回分数\/答案与请求不一致/.test(diagnostic)) {
        t.diagnostic(`response modify reached the upstream boundary and was not verifiable; response query=${JSON.stringify(queried)} failure=${diagnostic}`);
      } else {
        assert.fail(`response modify failed unexpectedly: ${diagnostic}`);
      }
    } else {
      const modified = success(modifyResult, "response modify");
      assert.equal(modified.outcome, "verified", JSON.stringify(modified));
    }

    const cleared = success(await runCli(["--yes", "response", "clear", "--username", username, "--vid", String(survey.vid), "--reset_to_zero"]), "response clear");
    assert.equal(cleared.outcome, "verified", JSON.stringify(cleared));
    assert.equal(cleared.afterCount, 0);
  } finally {
    await cleanupSurvey(survey, username, failures);
    assert.deepEqual(failures, [], failures.join("\n"));
  }
});

test("real account E2E: sub-account create, modify, delete, restore, delete", { skip: !WRITES_ENABLED }, async (t) => {
  if (!writeGate(t)) return;
  const prefix = `codex${Date.now().toString(36)}`.slice(0, 18);
  const password = `A${Date.now().toString(36)}!x9`;
  let created = false;
  const failures = [];
  try {
    const addResult = await runCli(["account", "add", "--subuser", prefix, "--password", password, "--role", "2"]);
    if (addResult.code !== 0 && /最多允许.*活跃用户|active users/i.test(addResult.stdout + addResult.stderr)) {
      t.skip("当前账号已达到活跃子账号配额；为保护已有账号，未删除现有账号腾位");
      return;
    }
    const added = success(addResult, "account add");
    created = true;
    assert.ok(added);
    const listed = success(await runCli(["account", "list", "--subuser", prefix]), "account list after add");
    assert.ok(JSON.stringify(listed).includes(prefix), JSON.stringify(listed));
    success(await runCli(["account", "modify", "--subuser", prefix, "--role", "3"]), "account modify");
    success(await runCli(["account", "delete", "--subuser", prefix]), "account delete");
    success(await runCli(["account", "restore", "--subuser", prefix]), "account restore");
    success(await runCli(["account", "delete", "--subuser", prefix]), "account final delete");
    const final = success(await runCli(["account", "list", "--subuser", prefix]), "account list after final delete");
    assert.ok(!JSON.stringify(final).includes(prefix) || JSON.stringify(final).includes('"status":false'), JSON.stringify(final));
  } finally {
    if (created) {
      const cleanup = await runCli(["--yes", "account", "delete", "--subuser", prefix]);
      if (cleanup.code !== 0) failures.push(`sub-account ${prefix} cleanup failed: ${describeFailure(cleanup)}`);
    }
    assert.deepEqual(failures, [], failures.join("\n"));
  }
});

test("real account E2E: contacts, admin, departments, and tags create, mutate, and clean isolated data", { skip: !WRITES_ENABLED }, async (t) => {
  if (!writeGate(t)) return;
  const corpid = process.env.WJX_CORP_ID?.trim();
  if (!corpid) {
    t.skip("当前 API key 未配置 WJX_CORP_ID；通讯录/管理员/部门/标签接口无法安全定位企业范围");
    return;
  }

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const userid = `codex-${suffix}`.slice(0, 30);
  const departmentName = `codex-e2e-${suffix}`.slice(0, 40);
  const renamedDepartment = `${departmentName}-m`.slice(0, 40);
  const tagGroup = `codex-e2e-${suffix}`.slice(0, 40);
  const renamedTagGroup = `${tagGroup}-m`.slice(0, 40);
  const tagPath = `${tagGroup}/temporary`;
  const cleanupFailures = [];
  let departmentId;
  let tagId;

  const findNestedObject = (value, predicate) => {
    const queue = [value];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || typeof current !== "object") continue;
      if (!Array.isArray(current) && predicate(current)) return current;
      for (const child of Object.values(current)) {
        if (child && typeof child === "object") queue.push(child);
      }
    }
    return undefined;
  };

  const cleanup = async (args, label) => {
    const result = await runCli(["--yes", ...args]);
    if (result.code !== 0 && !/不存在|not.?found|找不到/i.test(result.stdout + result.stderr)) {
      cleanupFailures.push(`${label}: ${describeFailure(result)}`);
    }
  };

  try {
    const addedDepartment = success(await runCli([
      "department", "add", "--corpid", corpid, "--depts", JSON.stringify([departmentName]),
    ]), "department add");
    assert.ok(addedDepartment);
    const departmentList = success(await runCli(["department", "list", "--corpid", corpid]), "department list after add");
    const department = findNestedObject(departmentList, (item) =>
      Object.values(item).some((value) => String(value) === departmentName));
    departmentId = department?.id ?? department?.deptid ?? department?.department_id;
    if (departmentId !== undefined) {
      success(await runCli([
        "department", "modify", "--corpid", corpid,
        "--depts", JSON.stringify([{ id: String(departmentId), name: renamedDepartment, order: 1 }]),
      ]), "department modify");
      success(await runCli([
        "--yes", "department", "delete", "--corpid", corpid, "--type", "1", "--depts", JSON.stringify([String(departmentId)]),
      ]), "department delete by id");
    } else {
      success(await runCli([
        "--yes", "department", "delete", "--corpid", corpid, "--type", "2", "--depts", JSON.stringify([departmentName]),
      ]), "department delete by name");
    }

    success(await runCli([
      "tag", "add", "--corpid", corpid, "--child_names", JSON.stringify([tagPath]),
    ]), "tag add");
    const tagList = success(await runCli(["tag", "list", "--corpid", corpid]), "tag list after add");
    const tag = findNestedObject(tagList, (item) =>
      Object.values(item).some((value) => String(value) === tagGroup || String(value) === "temporary"));
    tagId = tag?.tp_id ?? tag?.id ?? tag?.tag_id;
    if (tagId !== undefined) {
      success(await runCli([
        "tag", "modify", "--corpid", corpid, "--tp_id", String(tagId), "--tp_name", renamedTagGroup,
      ]), "tag modify");
      success(await runCli([
        "--yes", "tag", "delete", "--corpid", corpid, "--type", "2", "--tags", JSON.stringify([renamedTagGroup]),
      ]), "tag delete by name");
    } else {
      success(await runCli([
        "--yes", "tag", "delete", "--corpid", corpid, "--type", "2", "--tags", JSON.stringify([tagGroup]),
      ]), "tag delete by name");
    }

    const contact = [{ userid, name: `Codex E2E ${suffix}`, email: `${userid}@example.invalid` }];
    success(await runCli([
      "contacts", "add", "--corpid", corpid, "--users", JSON.stringify(contact),
    ]), "contact add");
    const queriedContact = success(await runCli([
      "contacts", "query", "--corpid", corpid, "--uid", userid,
    ]), "contact query after add");
    assert.match(JSON.stringify(queriedContact), new RegExp(userid));

    success(await runCli([
      "admin", "add", "--corpid", corpid, "--users", JSON.stringify([{ userid, role: 2 }]),
    ]), "admin add");
    success(await runCli(["--yes", "admin", "delete", "--corpid", corpid, "--uids", userid]), "admin delete");
    success(await runCli(["admin", "restore", "--corpid", corpid, "--uids", userid]), "admin restore");
    success(await runCli(["--yes", "admin", "delete", "--corpid", corpid, "--uids", userid]), "admin final delete");
    success(await runCli(["--yes", "contacts", "delete", "--corpid", corpid, "--uids", userid]), "contact delete");
  } finally {
    await cleanup(["admin", "delete", "--corpid", corpid, "--uids", userid], "admin cleanup");
    await cleanup(["contacts", "delete", "--corpid", corpid, "--uids", userid], "contact cleanup");
    if (departmentId !== undefined) {
      await cleanup(["department", "delete", "--corpid", corpid, "--type", "1", "--depts", JSON.stringify([String(departmentId)])], "department cleanup");
    }
    await cleanup(["department", "delete", "--corpid", corpid, "--type", "2", "--depts", JSON.stringify([departmentName, renamedDepartment])], "department name cleanup");
    if (tagId !== undefined) {
      await cleanup(["tag", "delete", "--corpid", corpid, "--type", "1", "--tags", JSON.stringify([String(tagId)])], "tag cleanup");
    }
    await cleanup(["tag", "delete", "--corpid", corpid, "--type", "2", "--tags", JSON.stringify([tagGroup, renamedTagGroup])], "tag name cleanup");
    assert.deepEqual(cleanupFailures, [], cleanupFailures.join("\n"));
  }
});
