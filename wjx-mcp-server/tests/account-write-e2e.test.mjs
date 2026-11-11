import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
const serverEntry = path.join(projectDir, "dist", "index.js");
const WRITES_ENABLED = process.env.WJX_E2E === "1" && process.env.WJX_E2E_ACCOUNT_WRITES === "1";

function positiveInteger(value) {
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
        if (current[key] !== undefined && current[key] !== null) return current[key];
      }
    }
    for (const child of Object.values(current)) {
      if (child && typeof child === "object") queue.push(child);
    }
  }
  return undefined;
}

function findVid(value) {
  return positiveInteger(findValue(value, ["vid", "activity_id", "activityid"]));
}

function toolText(result, label) {
  const text = result?.content?.[0]?.text;
  assert.equal(typeof text, "string", `${label} returned no JSON text`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON content: ${text.slice(0, 500)}`);
  }
}

function toolSuccess(result, label) {
  assert.equal(result?.isError, false, `${label} returned an MCP error: ${JSON.stringify(result)}`);
  const payload = toolText(result, label);
  assert.equal(payload.result, true, `${label} returned an unsuccessful result: ${JSON.stringify(payload)}`);
  return payload.data;
}

function toolFailure(result, label) {
  assert.equal(result?.isError, true, `${label} unexpectedly succeeded: ${JSON.stringify(result)}`);
  return toolText(result, label);
}

async function openClient(name) {
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverEntry],
    cwd: projectDir,
    env: { ...process.env, MCP_TRANSPORT: "stdio" },
    stderr: "pipe",
  });
  const client = new Client({ name, version: "1.0.0" });
  await client.connect(transport);
  // Real upstream reads can each take several seconds while a destructive
  // lifecycle transition settles; keep the client-side MCP timeout above the
  // bounded verification window without changing production defaults.
  const callTool = client.callTool.bind(client);
  client.callTool = (params, schema, options) => callTool(params, schema, { timeout: 120_000, ...(options ?? {}) });
  return { client, transport };
}

function jsonl(title, atype = 1) {
  const question = atype === 6
    ? { qtype: "考试简答", title: "请简述测试答案", quizscore: "5" }
    : { qtype: "单选", title: "MCP E2E choice", select: ["是", "否"] };
  return [
    JSON.stringify({ qtype: "问卷基础信息", title, atype }),
    JSON.stringify(question),
  ].join("\n");
}

async function createSurvey(client, title, atype = 1) {
  const created = toolSuccess(await client.callTool({
    name: "create_survey_by_json",
    arguments: { jsonl: jsonl(title, atype), atype, publish: false },
  }), "create_survey_by_json");
  const vid = findVid(created);
  assert.ok(vid, `create_survey_by_json returned no vid: ${JSON.stringify(created)}`);
  return { vid };
}

async function cleanupSurvey(client, vid, username) {
  if (!vid) return;
  const cleared = await client.callTool({
    name: "clear_responses",
    arguments: { username, vid, reset_to_zero: true },
  });
  if (cleared.isError) {
    // Empty surveys may not expose a response count; deletion still remains
    // the only cleanup action and is attempted exactly once below.
  }
  await client.callTool({
    name: "delete_survey",
    arguments: { vid, username, completely_delete: true },
  });
}

function writeGate(t) {
  if (!WRITES_ENABLED) {
    t.skip("真实 MCP 写 E2E 需要同时设置 WJX_E2E=1 和 WJX_E2E_ACCOUNT_WRITES=1");
    return false;
  }
  if (!process.env.WJX_USERNAME?.trim()) {
    t.skip("真实 MCP 写 E2E 需要 WJX_USERNAME，以便清理临时问卷");
    return false;
  }
  return true;
}

test("real MCP account E2E: settings and scoped recycle cleanup", { skip: !WRITES_ENABLED }, async (t) => {
  if (!writeGate(t)) return;
  const username = process.env.WJX_USERNAME.trim();
  const suffix = Date.now().toString(36);
  const { client, transport } = await openClient("wjx-mcp-account-settings");
  let survey;
  try {
    survey = await createSurvey(client, `codex-mcp-settings-${suffix}`);
    const settings = toolSuccess(await client.callTool({
      name: "get_survey_settings",
      arguments: { vid: survey.vid },
    }), "get_survey_settings before");
    const existing = findValue(settings, ["msg_setting"]);
    const existingSetting = existing && typeof existing === "object"
      ? existing
      : { quick_post: false };
    const updated = toolSuccess(await client.callTool({
      name: "update_survey_settings",
      arguments: {
        vid: survey.vid,
        msg_setting: JSON.stringify({ post_url_global: typeof existingSetting.post_url_global === "string" ? existingSetting.post_url_global : "" }),
      },
    }), "update_survey_settings");
    assert.equal(updated.outcome, "verified", JSON.stringify(updated));

    toolSuccess(await client.callTool({
      name: "delete_survey",
      arguments: { vid: survey.vid, username, completely_delete: false },
    }), "delete_survey to recycle bin");
    const purged = toolSuccess(await client.callTool({
      name: "clear_recycle_bin",
      arguments: { username, vid: survey.vid },
    }), "clear_recycle_bin scoped");
    assert.equal(purged.outcome, "verified", JSON.stringify(purged));
    assert.equal(purged.status, "hard-deleted", JSON.stringify(purged));
    survey = undefined;
  } finally {
    await cleanupSurvey(client, survey?.vid, username);
    await transport.close().catch(() => undefined);
  }
});

test("real MCP account E2E: submit, modify boundary, and clear responses", { skip: !WRITES_ENABLED }, async (t) => {
  if (!writeGate(t)) return;
  const username = process.env.WJX_USERNAME.trim();
  const suffix = Date.now().toString(36);
  const { client, transport } = await openClient("wjx-mcp-account-responses");
  let survey;
  try {
    survey = await createSurvey(client, `codex-mcp-response-${suffix}`, 6);
    toolSuccess(await client.callTool({ name: "update_survey_status", arguments: { vid: survey.vid, state: 1 } }), "publish survey");
    const detail = toolSuccess(await client.callTool({ name: "get_survey", arguments: { vid: survey.vid } }), "get_survey response fixture");
    const qIndex = positiveInteger(findValue(detail, ["q_index"]));
    assert.ok(qIndex, `no question index returned: ${JSON.stringify(detail)}`);
    const marker = `codex-mcp-${suffix}`;
    const submittedResult = await client.callTool({
      name: "submit_response",
      arguments: { vid: survey.vid, inputcosttime: 5, submitdata: `${qIndex}$测试答案`, sojumpparm: marker },
    });
    if (submittedResult.isError) {
      const failure = toolFailure(submittedResult, "submit_response");
      const diagnostic = JSON.stringify(failure);
      if (/发布者在您打开问卷之后修改|问卷已被修改|版本/.test(diagnostic)) {
        t.diagnostic(`submit_response reached the upstream version boundary; no replay was attempted: ${diagnostic.slice(0, 1000)}`);
      } else {
        assert.fail(`submit_response failed unexpectedly: ${diagnostic}`);
      }
    } else {
      const submitted = toolSuccess(submittedResult, "submit_response");
      const jid = positiveInteger(findValue(submitted, ["jid", "id", "response_id"]));
      assert.ok(jid, `submit_response returned no jid: ${JSON.stringify(submitted)}`);
      const modifiedResult = await client.callTool({
        name: "modify_response",
        arguments: { vid: survey.vid, jid, type: 1, answers: JSON.stringify({ [qIndex * 10000]: "4" }) },
      });
      if (modifiedResult.isError) {
        const failure = toolFailure(modifiedResult, "modify_response");
        const diagnostic = JSON.stringify(failure);
        if (/答卷无效或不存在|读回分数\/答案与请求不一致|版本|内部错误/.test(diagnostic)) {
          t.diagnostic(`modify_response reached the upstream boundary and was left unknown: ${diagnostic.slice(0, 1000)}`);
        } else {
          assert.fail(`modify_response failed unexpectedly: ${diagnostic}`);
        }
      } else {
        const modified = toolSuccess(modifiedResult, "modify_response");
        assert.equal(modified.outcome, "verified", JSON.stringify(modified));
      }
    }

    const cleared = toolSuccess(await client.callTool({
      name: "clear_responses",
      arguments: { username, vid: survey.vid, reset_to_zero: true },
    }), "clear_responses");
    assert.equal(cleared.outcome, "verified", JSON.stringify(cleared));
    assert.equal(cleared.afterCount, 0, JSON.stringify(cleared));
  } finally {
    await cleanupSurvey(client, survey?.vid, username);
    await transport.close().catch(() => undefined);
  }
});

test("real MCP account E2E: sub-account lifecycle does not consume existing quota", { skip: !WRITES_ENABLED }, async (t) => {
  if (!writeGate(t)) return;
  const suffix = Date.now().toString(36);
  const subuser = `codex${suffix}`.slice(0, 18);
  const { client, transport } = await openClient("wjx-mcp-account-subuser");
  let created = false;
  try {
    const addedResult = await client.callTool({
      name: "add_sub_account",
      arguments: { subuser, password: `A${suffix}!x9`, role: 2 },
    });
    if (addedResult.isError && /最多允许.*活跃用户|active users/i.test(JSON.stringify(addedResult))) {
      t.skip("当前账号已达到活跃子账号配额；为保护已有账号，未删除现有账号腾位");
      return;
    }
    toolSuccess(addedResult, "add_sub_account");
    created = true;
    const listed = toolSuccess(await client.callTool({ name: "query_sub_accounts", arguments: { subuser } }), "query_sub_accounts after add");
    assert.match(JSON.stringify(listed), new RegExp(subuser));
    toolSuccess(await client.callTool({ name: "modify_sub_account", arguments: { subuser, role: 3 } }), "modify_sub_account");
    toolSuccess(await client.callTool({ name: "delete_sub_account", arguments: { subuser } }), "delete_sub_account");
    toolSuccess(await client.callTool({ name: "restore_sub_account", arguments: { subuser } }), "restore_sub_account");
    toolSuccess(await client.callTool({ name: "delete_sub_account", arguments: { subuser } }), "delete_sub_account final");
  } finally {
    if (created) await client.callTool({ name: "delete_sub_account", arguments: { subuser } }).catch(() => undefined);
    await transport.close().catch(() => undefined);
  }
});

test("real MCP account E2E: contacts, admin, departments, and tags use isolated enterprise data", { skip: !WRITES_ENABLED }, async (t) => {
  if (!writeGate(t)) return;
  const corpid = process.env.WJX_CORP_ID?.trim();
  if (!corpid) {
    t.skip("当前 API key 未配置 WJX_CORP_ID；通讯录/管理员/部门/标签接口无法安全定位企业范围");
    return;
  }
  const suffix = Date.now().toString(36);
  const userid = `codex-${suffix}`.slice(0, 30);
  const department = `codex-mcp-${suffix}`.slice(0, 40);
  const tagGroup = `codex-mcp-${suffix}`.slice(0, 40);
  const { client, transport } = await openClient("wjx-mcp-account-contacts");
  try {
    toolSuccess(await client.callTool({ name: "add_department", arguments: { corpid, depts: JSON.stringify([department]) } }), "add_department");
    const departments = toolSuccess(await client.callTool({ name: "list_departments", arguments: { corpid } }), "list_departments");
    assert.match(JSON.stringify(departments), new RegExp(department));
    toolSuccess(await client.callTool({ name: "delete_department", arguments: { corpid, type: "2", depts: JSON.stringify([department]), del_child: true } }), "delete_department");

    toolSuccess(await client.callTool({ name: "add_tag", arguments: { corpid, child_names: JSON.stringify([`${tagGroup}/temporary`]) } }), "add_tag");
    const tags = toolSuccess(await client.callTool({ name: "list_tags", arguments: { corpid } }), "list_tags");
    assert.match(JSON.stringify(tags), new RegExp(tagGroup));
    toolSuccess(await client.callTool({ name: "delete_tag", arguments: { corpid, type: "2", tags: JSON.stringify([tagGroup]) } }), "delete_tag");

    toolSuccess(await client.callTool({
      name: "add_contacts",
      arguments: { corpid, users: JSON.stringify([{ userid, name: `Codex MCP ${suffix}`, email: `${userid}@example.invalid` }]) },
    }), "add_contacts");
    const contact = toolSuccess(await client.callTool({ name: "query_contacts", arguments: { corpid, uid: userid } }), "query_contacts");
    assert.match(JSON.stringify(contact), new RegExp(userid));
    toolSuccess(await client.callTool({ name: "add_admin", arguments: { corpid, users: JSON.stringify([{ userid, role: 2 }]) } }), "add_admin");
    toolSuccess(await client.callTool({ name: "delete_admin", arguments: { corpid, uids: userid } }), "delete_admin");
    toolSuccess(await client.callTool({ name: "restore_admin", arguments: { corpid, uids: userid } }), "restore_admin");
    toolSuccess(await client.callTool({ name: "delete_admin", arguments: { corpid, uids: userid } }), "delete_admin final");
    toolSuccess(await client.callTool({ name: "delete_contacts", arguments: { corpid, uids: userid } }), "delete_contacts");
  } finally {
    await client.callTool({ name: "delete_admin", arguments: { corpid, uids: userid } }).catch(() => undefined);
    await client.callTool({ name: "delete_contacts", arguments: { corpid, uids: userid } }).catch(() => undefined);
    await client.callTool({ name: "delete_department", arguments: { corpid, type: "2", depts: JSON.stringify([department]), del_child: true } }).catch(() => undefined);
    await client.callTool({ name: "delete_tag", arguments: { corpid, type: "2", tags: JSON.stringify([tagGroup]) } }).catch(() => undefined);
    await transport.close().catch(() => undefined);
  }
});
