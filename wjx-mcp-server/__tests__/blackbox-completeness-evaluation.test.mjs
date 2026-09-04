import assert from "node:assert/strict";
import { after, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Action, setCredentialProvider } from "wjx-api-sdk";

import { createServer } from "../dist/server.js";

const LOCAL_TOOLS = new Set([
  "calculate_nps", "calculate_csat", "decode_responses", "detect_anomalies",
  "compare_metrics", "sso_subaccount_url", "sso_user_system_url", "sso_partner_url",
  "build_survey_url", "build_preview_url", "decode_push_payload", "build_submit_template", "get_config",
]);

const EXPECTED_ACTIONS = {
  add_admin: Action.ADD_ADMIN,
  add_contacts: Action.ADD_CONTACTS,
  add_department: Action.ADD_DEPARTMENT,
  add_participants: Action.ADD_PARTICIPANTS,
  add_sub_account: Action.ADD_SUB_ACCOUNT,
  add_tag: Action.ADD_TAG,
  bind_activity: Action.BIND_ACTIVITY,
  clear_recycle_bin: Action.CLEAR_RECYCLE_BIN,
  clear_responses: Action.CLEAR_RESPONSES,
  create_ai_page: Action.CREATE_AI_PAGE,
  create_survey_by_json: Action.CREATE_SURVEY_BY_JSON,
  count_responses: Action.QUERY_RESPONSES,
  delete_admin: Action.DELETE_ADMIN,
  delete_contacts: Action.MANAGE_CONTACTS,
  delete_department: Action.DELETE_DEPARTMENT,
  delete_participants: Action.DELETE_PARTICIPANTS,
  delete_sub_account: Action.DELETE_SUB_ACCOUNT,
  delete_survey: Action.DELETE_SURVEY,
  delete_tag: Action.DELETE_TAG,
  download_responses: Action.DOWNLOAD_RESPONSES,
  get_360_report: Action.GET_360_REPORT,
  get_question_tags: Action.GET_TAGS,
  get_report: Action.GET_REPORT,
  get_survey: Action.GET_SURVEY,
  get_survey_settings: Action.GET_SETTINGS,
  get_tag_details: Action.GET_TAG_DETAILS,
  get_winners: Action.GET_WINNERS,
  list_departments: Action.LIST_DEPARTMENTS,
  list_surveys: Action.LIST_SURVEYS,
  list_tags: Action.LIST_TAGS,
  modify_department: Action.MODIFY_DEPARTMENT,
  modify_participants: Action.MODIFY_PARTICIPANTS,
  modify_response: Action.MODIFY_RESPONSE,
  modify_sub_account: Action.MODIFY_SUB_ACCOUNT,
  modify_tag: Action.MODIFY_TAG,
  query_contacts: Action.QUERY_CONTACTS,
  query_responses: Action.QUERY_RESPONSES,
  query_responses_realtime: Action.QUERY_RESPONSES_REALTIME,
  query_sub_accounts: Action.QUERY_SUB_ACCOUNTS,
  query_survey_binding: Action.QUERY_SURVEY_BINDING,
  query_user_surveys: Action.QUERY_USER_SURVEYS,
  restore_admin: Action.RESTORE_ADMIN,
  restore_sub_account: Action.RESTORE_SUB_ACCOUNT,
  submit_response: Action.SUBMIT_RESPONSE,
  update_survey_settings: Action.UPDATE_SETTINGS,
  update_survey_status: Action.UPDATE_STATUS,
  update_ai_page: Action.UPDATE_AI_PAGE,
  upload_file: Action.UPLOAD_FILE,
};

const TOOL_ARGS = {
  add_admin: { users: JSON.stringify([{ userid: "u-1", role: 2 }]), corpid: "corp-1" },
  add_contacts: { users: JSON.stringify([{ userid: "u-1", name: "Alice" }]), corpid: "corp-1" },
  add_department: { depts: JSON.stringify(["研发部/后端"]), corpid: "corp-1" },
  add_participants: { users: JSON.stringify([{ uid: "u-1" }]), usid: 9 },
  add_sub_account: { subuser: "child-1", password: "secret", role: 2 },
  add_tag: { child_names: JSON.stringify(["研发/后端"]), corpid: "corp-1" },
  bind_activity: { vid: 42, usid: 9, uids: JSON.stringify(["u-1"]) },
  build_preview_url: { sid: "short-code" },
  build_survey_url: { mode: "create", name: "黑盒测试" },
  calculate_csat: { scores: [1, 4, 5] },
  calculate_nps: { scores: [10, 8, 2] },
  clear_recycle_bin: { username: "owner", vid: 42 },
  clear_responses: { username: "owner", vid: 42, reset_to_zero: false },
  compare_metrics: { set_a: { score: 1 }, set_b: { score: 2 } },
  create_survey_by_json: {
    jsonl: `${JSON.stringify({ qtype: "问卷基础信息", title: "黑盒问卷", atype: 1 })}\n${JSON.stringify({ qtype: "单选", title: "满意度", select: ["是", "否"] })}`,
    atype: 1,
  },
  create_ai_page: { html_content: "<h1>AI homepage</h1>", title: "Test homepage", page_type: 0 },
  count_responses: { vid: 42 },
  decode_push_payload: { encrypted_data: "BwcHBwcHBwcHBwcHBwcHB4KSQXEH8Oas/HhG7FXfJDo=", app_key: "blackbox-key" },
  decode_responses: { submitdata: "1$1}2$2" },
  delete_admin: { uids: "u-1", corpid: "corp-1" },
  delete_contacts: { uids: "u-1", corpid: "corp-1" },
  delete_department: { type: "1", depts: JSON.stringify(["d-1"]), corpid: "corp-1" },
  delete_participants: { uids: JSON.stringify(["u-1"]), usid: 9 },
  delete_sub_account: { subuser: "child-1" },
  delete_survey: { vid: 42, username: "owner" },
  delete_tag: { type: "1", tags: JSON.stringify(["tag-1"]), corpid: "corp-1" },
  detect_anomalies: { responses: [] },
  build_submit_template: { questions: [{ q_index: 1, q_type: 3 }] },
  download_responses: { vid: 42, query_count: 1 },
  get_360_report: { vid: 42 },
  get_config: {},
  get_question_tags: { username: "owner" },
  get_report: { vid: 42 },
  get_survey: { vid: 42 },
  get_survey_settings: { vid: 42 },
  get_tag_details: { tag_id: 7 },
  get_winners: { vid: 42 },
  list_departments: { corpid: "corp-1" },
  list_surveys: { page_index: 1, page_size: 10 },
  list_tags: { corpid: "corp-1" },
  modify_department: { depts: JSON.stringify([{ id: "d-1", name: "研发" }]), corpid: "corp-1" },
  modify_participants: { users: JSON.stringify([{ uid: "u-1", uname: "Alice" }]), usid: 9 },
  modify_response: { vid: 42, jid: 7, type: 1, answers: JSON.stringify({ 10000: "5" }) },
  modify_sub_account: { subuser: "child-1", role: 2 },
  modify_tag: { tp_id: "tag-parent", tp_name: "研发" },
  query_contacts: { uid: "u-1", corpid: "corp-1" },
  query_responses: { vid: 42, page_index: 1, page_size: 10 },
  query_responses_realtime: { vid: 42, count: 1 },
  query_sub_accounts: { subuser: "child-1", page_index: 2, page_size: 25 },
  query_survey_binding: { vid: 42, usid: 9 },
  query_user_surveys: { uid: "u-1", usid: 9 },
  restore_admin: { uids: "u-1", corpid: "corp-1" },
  restore_sub_account: { subuser: "child-1" },
  sso_partner_url: { username: "partner" },
  sso_subaccount_url: { subuser: "child-1" },
  sso_user_system_url: { u: "owner", system_id: 9, uid: "u-1" },
  submit_response: { vid: 42, inputcosttime: 2, submitdata: "1$1", jpmversion: 1 },
  update_survey_settings: { vid: 42, api_setting: "{}" },
  update_survey_status: { vid: 42, state: 1 },
  update_ai_page: { vid: 42, html_content: "<h1>Updated homepage</h1>", page_type: 0 },
  upload_file: { file_name: "image.png", file: "aGVsbG8=" },
};

function createClient() {
  return (async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: "mcp-blackbox", version: "1.0.0" });
    await client.connect(clientTransport);
    return { client, server };
  })();
}

const previousFetch = globalThis.fetch;
const previousCredentialProvider = undefined;
after(() => {
  globalThis.fetch = previousFetch;
  setCredentialProvider(previousCredentialProvider);
  delete process.env.WJX_API_KEY;
  delete process.env.WJX_CORP_ID;
});

test("every registered MCP tool has an executable success-path contract", async () => {
  process.env.WJX_API_KEY = "mcp-matrix-key";
  process.env.WJX_CORP_ID = "corp-1";
  setCredentialProvider(() => ({ apiKey: "mcp-matrix-key" }));
  const requests = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    requests.push({ url: String(url), headers: init.headers, body });
    const data = body.action === "1000001"
      ? { title: "黑盒问卷", answer_valid: 1, version: 3, questions: [] }
      : {};
    return new Response(JSON.stringify({ result: true, data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const { client } = await createClient();
  try {
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);
    const missing = names.filter((name) => !Object.hasOwn(TOOL_ARGS, name));
    assert.deepEqual(missing, [], "every tool must have a curated valid invocation");
    assert.equal(names.length, 61, "update the tool denominator only when the MCP surface intentionally changes");

    for (const name of names) {
      const before = requests.length;
      const result = await client.callTool({ name, arguments: TOOL_ARGS[name] });
      assert.equal(result.isError, false, `${name}: ${JSON.stringify(result)}`);
      assert.ok(result.content?.[0]?.text, `${name} returned no text content`);
      const payload = JSON.parse(result.content[0].text);
      if (!LOCAL_TOOLS.has(name)) {
        assert.equal(payload.result, true, `${name} did not preserve an upstream success result`);
        const calls = requests.slice(before);
        assert.ok(calls.length >= 1, `${name} did not reach the API transport`);
        assert.equal(String(calls.at(-1).body.action), String(EXPECTED_ACTIONS[name]), `${name} routed to the wrong API action`);
        if (name === "query_sub_accounts") {
          assert.equal(calls.at(-1).body.page_index, 2);
          assert.equal(calls.at(-1).body.page_size, 25);
        }
      }
    }
    assert.deepEqual(
      Object.keys(EXPECTED_ACTIONS).sort(),
      names.filter((name) => !LOCAL_TOOLS.has(name)).sort(),
      "every remote tool must have an explicit OpenAPI action assertion",
    );
    assert.ok(requests.length >= 45, `expected broad API coverage, got ${requests.length} requests`);
    assert.ok(requests.every((request) => request.headers.Authorization === "Bearer mcp-matrix-key"));
  } finally {
    await client.close();
  }
});

test("submit_response stops after a failed version lookup", async () => {
  process.env.WJX_API_KEY = "mcp-submit-key";
  setCredentialProvider(() => ({ apiKey: "mcp-submit-key" }));
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    requests.push(body);
    const response = body.action === "1000001"
      ? { result: false, errormsg: "问卷版本已过期", errorcode: "STALE_VERSION" }
      : { result: true, data: { submitted: true } };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const { client } = await createClient();
  try {
    const result = await client.callTool({
      name: "submit_response",
      arguments: { vid: 42, inputcosttime: 2, submitdata: "1$1" },
    });
    assert.equal(result.isError, true, JSON.stringify(result));
    const payload = JSON.parse(result.content[0].text);
    assert.match(payload.errormsg, /问卷版本已过期/);
    assert.equal(requests.length, 1, "failed version lookup must not submit the response");
    assert.equal(requests[0].action, "1000001");
  } finally {
    await client.close();
  }
});

test("submit_response stops when the version lookup has no valid version", async () => {
  process.env.WJX_API_KEY = "mcp-invalid-version-key";
  setCredentialProvider(() => ({ apiKey: "mcp-invalid-version-key" }));
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    requests.push(body);
    return new Response(JSON.stringify({ result: true, data: { questions: [] } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const { client } = await createClient();
  try {
    const result = await client.callTool({
      name: "submit_response",
      arguments: { vid: 42, inputcosttime: 2, submitdata: "1$1" },
    });
    assert.equal(result.isError, true, JSON.stringify(result));
    assert.match(result.content[0].text, /version/i);
    assert.equal(requests.length, 1, "an unverifiable version must not submit the response");
    assert.equal(requests[0].action, "1000001");
  } finally {
    await client.close();
  }
});

test("submit_response normalizes data when metadata is available even with explicit jpmversion", async () => {
  process.env.WJX_API_KEY = "mcp-explicit-version-key";
  setCredentialProvider(() => ({ apiKey: "mcp-explicit-version-key" }));
  const requests = [];
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      requests.push(body);
      const data = body.action === "1000001"
        ? { version: 7, questions: [{ q_index: 1, q_type: 7, q_subtype: 7 }] }
        : { submitted: true };
      return new Response(JSON.stringify({ result: true, data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const { client } = await createClient();
  try {
    const result = await client.callTool({
      name: "submit_response",
      arguments: { vid: 42, inputcosttime: 2, submitdata: "1_1$2", jpmversion: 23 },
    });
    assert.equal(result.isError, false, JSON.stringify(result));
    assert.equal(requests.length, 2);
    assert.equal(requests[0].action, "1000001");
    assert.equal(requests[1].action, Action.SUBMIT_RESPONSE);
    assert.equal(requests[1].jpmversion, 23);
    assert.equal(requests[1].submitdata, "1$1!2");
  } finally {
    await client.close();
  }
});

test("submit_response continues with explicit jpmversion when metadata lookup fails", async () => {
  process.env.WJX_API_KEY = "mcp-explicit-version-failure-key";
  setCredentialProvider(() => ({ apiKey: "mcp-explicit-version-failure-key" }));
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    requests.push(body);
    const response = body.action === "1000001"
      ? { result: false, errormsg: "metadata unavailable", errorcode: "TEMPORARY" }
      : { result: true, data: { submitted: true } };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const { client } = await createClient();
  try {
    const result = await client.callTool({
      name: "submit_response",
      arguments: { vid: 42, inputcosttime: 2, submitdata: "1$1_2", jpmversion: 23 },
    });
    assert.equal(result.isError, false, JSON.stringify(result));
    assert.equal(requests.length, 2);
    assert.equal(requests[1].action, Action.SUBMIT_RESPONSE);
    assert.equal(requests[1].submitdata, "1$1_2");
  } finally {
    await client.close();
  }
});

test("create_survey_by_json enforces the UTF-8 byte limit", async () => {
  process.env.WJX_API_KEY = "mcp-jsonl-size-key";
  setCredentialProvider(() => ({ apiKey: "mcp-jsonl-size-key" }));
  const { client } = await createClient();
  try {
    const jsonl = "测".repeat(400_000);
    assert.ok(jsonl.length < 1_000_000);
    assert.ok(Buffer.byteLength(jsonl, "utf8") > 1_000_000);
    const result = await client.callTool({ name: "create_survey_by_json", arguments: { jsonl } });
    assert.equal(result.isError, true, JSON.stringify(result));
    assert.match(result.content[0].text, /不能超过|maximum size/i);
  } finally {
    await client.close();
  }
});
