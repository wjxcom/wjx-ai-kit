import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { setCredentialProvider } from "wjx-api-sdk";
import { createServer } from "../dist/server.js";

test("MCP 仅修改逻辑：预读、JSON 更新和真实逻辑投影验证", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const nextLogic = 'logic { if "2::1" then show "3"; };';
  let logic = 'logic { if "2::2" then show "3"; };';
  setCredentialProvider(() => ({ apiKey: "fixture-key", baseUrl: "https://fixture.test" }));
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body); calls.push(body);
    if (body.action === "1000109") logic = body.dsl.logic;
    return new Response(JSON.stringify({ result: true, data: body.action === "1000109" ? { vid: 42 } : {
      vid: 42, title: "逻辑问卷", atype: 1, status: 0,
      questions: [{ q_index: 2, q_type: 3, q_subtype: 3, q_title: "原有题目", relation: logic }],
      dsl: { logic },
    } }), { headers: { "content-type": "application/json" } });
  };
  const server = createServer();
  const client = new Client({ name: "logic-contract", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport); await client.connect(clientTransport);
    const result = await client.callTool({ name: "update_survey_by_json", arguments: { vid: 42, dsl: { logic: nextLogic } } });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    assert.deepEqual(calls.map(call => call.action), ["1000001", "1000109", "1000001"]);
    assert.deepEqual(calls[1], { action: "1000109", vid: 42, dsl: { logic: nextLogic } });
    const names = (await client.listTools()).tools.map(tool => tool.name);
    for (const removed of ["query_wjx_dsl", "generate_wjx_dsl", "create_survey_from_definition", "update_survey_from_definition"]) assert.equal(names.includes(removed), false);
    calls.length = 0;
    const invalid = await client.callTool({ name: "update_survey_by_json", arguments: { vid: 42, dsl: { logic: "wjx-dsl 1; questionnaire {};" } } });
    assert.equal(invalid.isError, true);
    assert.equal(calls.length, 0);
  } finally {
    await client.close(); await server.close();
    globalThis.fetch = originalFetch; setCredentialProvider(undefined);
  }
});

test("MCP 查询未返回真实逻辑投影时，修改结果标记为未知", async () => {
  const originalFetch = globalThis.fetch;
  setCredentialProvider(() => ({ apiKey: "fixture-key", baseUrl: "https://fixture.test" }));
  globalThis.fetch = async () => new Response(JSON.stringify({ result: true, data: { vid: 42, title: "问卷", atype: 1, status: 0, questions: [] } }), { headers: { "content-type": "application/json" } });
  const server = createServer(); const client = new Client({ name: "logic-verify-contract", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport); await client.connect(clientTransport);
    const result = await client.callTool({ name: "update_survey_by_json", arguments: { vid: 42, dsl: { logic: 'logic { if "2::1" then show "3"; };' } } });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result), /unknown/);
  } finally {
    await client.close(); await server.close(); globalThis.fetch = originalFetch; setCredentialProvider(undefined);
  }
});

test("MCP 创建和仅逻辑修改可读回确认无条件 show，不能要求残留 DSL 文本", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const dsl = { logic: 'logic { show "3"; };' };
  let relation = "";
  setCredentialProvider(() => ({ apiKey: "fixture-key", baseUrl: "https://fixture.test" }));
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body); calls.push(body);
    if (body.action === "1000109") relation = "";
    return new Response(JSON.stringify({ result: true, data: ["1000106", "1000109"].includes(body.action) ? { vid: 42 } : {
      vid: 42, title: "无条件显示", atype: 1, status: 0,
      questions: [{ q_index: 3, q_type: 3, q_subtype: 3, q_title: "选择", is_requir: true, relation,
        items: [{ item_title: "A" }, { item_title: "B" }] }],
    } }), { headers: { "content-type": "application/json" } });
  };
  const server = createServer(); const client = new Client({ name: "unconditional-show", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport); await client.connect(clientTransport);
    const jsonl = [
      { qtype: "问卷基础信息", title: "无条件显示" },
      { qtype: "单选", title: "选择", select: ["A", "B"] },
    ].map(JSON.stringify).join("\n");
    const created = await client.callTool({ name: "create_survey_by_json", arguments: { jsonl, dsl, atype: 1, publish: false } });
    assert.notEqual(created.isError, true, JSON.stringify(created));
    assert.deepEqual(calls.map(call => call.action), ["1000106", "1000001"]);
    calls.length = 0; relation = "2,1";
    const updated = await client.callTool({ name: "update_survey_by_json", arguments: { vid: 42, dsl } });
    assert.notEqual(updated.isError, true, JSON.stringify(updated));
    assert.deepEqual(calls.map(call => call.action), ["1000001", "1000109", "1000001"]);
  } finally {
    await client.close(); await server.close(); globalThis.fetch = originalFetch; setCredentialProvider(undefined);
  }
});
