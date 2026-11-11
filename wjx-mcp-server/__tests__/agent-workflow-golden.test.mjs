import assert from "node:assert/strict";
import { after, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { getJsonlQuestionTypeCode, setCredentialProvider } from "wjx-api-sdk";

import { createServer } from "../dist/server.js";

const previousApiKey = process.env.WJX_API_KEY;
process.env.WJX_API_KEY = "golden-mcp-fixture-key";
setCredentialProvider(undefined);

after(() => {
  if (previousApiKey === undefined) delete process.env.WJX_API_KEY;
  else process.env.WJX_API_KEY = previousApiKey;
  setCredentialProvider(undefined);
});

async function connectClient(name = "agent-workflow-golden") {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name, version: "1.0.0" });
  await client.connect(clientTransport);
  return {
    client,
    close: async () => {
      await client.close().catch(() => undefined);
      await server.close().catch(() => undefined);
    },
  };
}

function parseTool(result, label) {
  assert.equal(result.isError, false, `${label}: ${JSON.stringify(result)}`);
  assert.ok(result.content?.[0]?.text, `${label}: tool returned no text`);
  return JSON.parse(result.content[0].text);
}

function parseToolError(result, label) {
  assert.equal(result.isError, true, `${label}: expected an MCP tool error`);
  assert.ok(result.content?.[0]?.text, `${label}: tool returned no error text`);
  return JSON.parse(result.content[0].text);
}

/** Replace only the upstream API transport; MCP protocol remains real. */
async function withMockFetch(route, run) {
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const parsedUrl = new URL(String(url));
    const body = typeof init.body === "string" && init.body ? JSON.parse(init.body) : {};
    const call = {
      url: String(url),
      action: parsedUrl.searchParams.get("action") ?? "",
      body,
      method: init.method ?? "GET",
      headers: init.headers ?? {},
    };
    calls.push(call);
    const routed = await route(call, calls);
    if (routed?.throw) throw routed.throw;
    const payload = routed?.response ?? routed ?? { result: true, data: {} };
    return new Response(JSON.stringify(payload), {
      status: routed?.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = previousFetch;
  }
}

function surveyJsonl(qtype = "单选", title = "Golden MCP Survey") {
  return [
    JSON.stringify({ qtype: "问卷基础信息", title }),
    JSON.stringify({ qtype, title: "满意度", select: ["A", "B"] }),
  ].join("\n");
}

function surveyReadResponse(status = 1, qtype = "单选") {
  const code = getJsonlQuestionTypeCode(qtype);
  return {
    result: true,
    data: {
      vid: 710001,
      sid: "mcpGoldenSid",
      title: "Golden MCP Survey",
      status,
      verify_status: 1,
      version: 9,
      questions: [{
        q_index: 1,
        q_type: code?.q_type ?? 3,
        q_subtype: code?.q_subtype ?? 3,
        q_title: "满意度",
      }],
      activity_domain: "https://www.wjx.cn",
      pc_path: "/vm/mcpGoldenSid.aspx",
      edit_url: "/newwjx/design/editquestionnaire.aspx?activity=710001",
    },
  };
}

test("MCP golden setup and creation workflow preserves atype, draft semantics, and prompt authorization", async () => {
  const { client, close } = await connectClient();
  const createCalls = [];
  try {
    const listed = await client.listTools();
    assert.ok(listed.tools.some((tool) => tool.name === "create_survey_by_json"));
    const config = parseTool(await client.callTool({ name: "get_config", arguments: {} }), "get_config");
    assert.equal(config.api_key, "golden-m****-key");

    let latestQtype = "单选";
    await withMockFetch((call) => {
      createCalls.push(call);
      if (call.action === "1000106") {
        try {
          const line = String(call.body.surveydatajson ?? "").split(/\r?\n/).filter(Boolean)[1];
          latestQtype = JSON.parse(line ?? "{}").qtype ?? "单选";
        } catch { latestQtype = "单选"; }
        return { result: true, data: { vid: 710001 } };
      }
      return surveyReadResponse(1, latestQtype);
    }, async () => {
      const cases = [
        { atype: 1, qtype: "单选" },
        { atype: 3, qtype: "投票单选" },
        { atype: 6, qtype: "考试单选" },
        { atype: 7, qtype: "单项填空" },
      ];
      for (const entry of cases) {
        const payload = parseTool(await client.callTool({
          name: "create_survey_by_json",
          arguments: { jsonl: surveyJsonl(entry.qtype), atype: entry.atype },
        }), `create atype ${entry.atype}`);
        assert.equal(payload.result, true);
        const request = createCalls.filter((call) => call.action === "1000106").at(-1);
        assert.equal(request.action, "1000106");
        assert.equal(request.body.atype, entry.atype);
        assert.equal(request.body.publish, true);
        assert.equal(JSON.parse(request.body.surveydatajson.split(/\r?\n/)[0]).atype, entry.atype);
      }

      const draft = parseTool(await client.callTool({
        name: "create_survey_by_json",
        arguments: { jsonl: surveyJsonl("折叠栏目"), atype: 1 },
      }), "framework-only draft");
      assert.equal(draft.result, true);
      assert.equal(createCalls.filter((call) => call.action === "1000106").at(-1).body.publish, false);

      const unsupported = parseToolError(await client.callTool({
        name: "create_survey_by_json",
        arguments: { jsonl: surveyJsonl("single choice"), atype: 1 },
      }), "unsupported qtype");
      assert.match(unsupported.errormsg, /中文|不识别|qtype/i);
      assert.equal(
        createCalls.filter((call) => call.action === "1000106").length,
        5,
        "unsupported qtype must not partially create a survey",
      );
    });

    const prompt = await client.getPrompt({
      name: "generate-survey-json",
      arguments: { topic: "客户满意度", requirements: "包含基础满意度题" },
    });
    const promptText = prompt.messages.map((message) => message.content.text ?? "").join("\n");
    assert.match(promptText, /完整 JSONL|预览|明确授权/);
    assert.match(promptText, /unsupported|不支持|重新生成/i);

    const qtypesResource = await client.readResource({ uri: "wjx://reference/jsonl-qtypes" });
    const qtypes = JSON.parse(qtypesResource.contents[0].text).qtypes;
    assert.ok(Array.isArray(qtypes) && qtypes.length > 50);
    for (const qtype of ["单选", "图片OCR", "多项简答题"]) {
      assert.ok(qtypes.includes(qtype), `profile should include ${qtype}`);
      assert.match(promptText, new RegExp(qtype.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  } finally {
    await close();
  }
});

test("MCP golden response workflow reports pagination, queue consumption, polling, and ambiguous submit", async () => {
  const { client, close } = await connectClient("response-workflow-golden");
  const counts = new Map();
  const queue = [[{ jid: 21 }], []];
  let responsesCleared = false;
  try {
    await withMockFetch((call) => {
      const n = (counts.set(call.action, (counts.get(call.action) ?? 0) + 1), counts.get(call.action));
      if (call.action === "1000001") return surveyReadResponse(1);
      if (call.action === "1001002") {
        if (call.body.jid !== undefined) {
          return { result: true, data: { total_count: 1, responses: [{ jid: Number(call.body.jid) }] } };
        }
        if (call.body.page_size === 1) {
          return responsesCleared
            ? { result: true, data: { total_count: 0, join_times: 50, responses: [] } }
            : { result: true, data: { total_count: 42, join_times: 50, responses: [{ jid: 11 }] } };
        }
        return call.body.page_index === 2
          ? { result: true, data: { total_count: 42, page_index: 2, page_size: 2, responses: [{ jid: 12 }, { jid: 13 }] } }
          : { result: true, data: { page_index: 1, page_size: 2, responses: [{ jid: 14 }] } };
      }
      if (call.action === "1001003") return { result: true, data: { responses: queue.shift() ?? [] } };
      if (call.action === "1001004") return n === 1
        ? { result: true, data: { status: 0, taskid: "download-task" } }
        : { result: true, data: { status: 1, taskid: "download-task", url: "https://files.example/download.csv" } };
      if (call.action === "1001101") return { result: true, data: { status: 0, taskid: "report-task" } };
      if (call.action === "1001102") return n === 1
        ? { result: true, data: { status: 0, taskid: "360-task" } }
        : { result: true, data: { status: 1, taskid: "360-task", url: "https://files.example/report.xls" } };
      if (call.action === "1001001") return { result: true, data: { jid: 99 } };
      if (call.action === "1001201") {
        responsesCleared = true;
        return { result: true, data: {} };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const count = parseTool(await client.callTool({ name: "count_responses", arguments: { vid: 710001 } }), "count responses");
      assert.equal(count.total_count, 42);
      assert.equal(count.join_times, 50);

      const page = parseTool(await client.callTool({ name: "query_responses", arguments: { vid: 710001, page_index: 2, page_size: 2 } }), "query page");
      assert.equal(page.data.total_count, 42);
      assert.equal(page.data.page_index, 2);
      const missing = parseTool(await client.callTool({ name: "query_responses", arguments: { vid: 710001, page_index: 1, page_size: 2 } }), "missing total count");
      assert.equal("total_count" in missing.data, false);

      const firstQueue = parseTool(await client.callTool({ name: "query_responses_realtime", arguments: { vid: 710001 } }), "queue first");
      const secondQueue = parseTool(await client.callTool({ name: "query_responses_realtime", arguments: { vid: 710001 } }), "queue second");
      assert.equal(firstQueue.data.responses.length, 1);
      assert.equal(secondQueue.data.responses.length, 0);

      const started = parseTool(await client.callTool({ name: "download_responses", arguments: { vid: 710001 } }), "download start");
      const done = parseTool(await client.callTool({ name: "download_responses", arguments: { vid: 710001, taskid: "download-task" } }), "download poll");
      assert.equal(started.data.status, 0);
      assert.equal(done.data.status, 1);

      const report = parseTool(await client.callTool({ name: "get_report", arguments: { vid: 710001 } }), "report");
      assert.equal(report.data.status, 0);
      const report360 = parseTool(await client.callTool({ name: "get_360_report", arguments: { vid: 710001 } }), "360 start");
      const report360Done = parseTool(await client.callTool({ name: "get_360_report", arguments: { vid: 710001, taskid: "360-task" } }), "360 poll");
      assert.equal(report360.data.status, 0);
      assert.equal(report360Done.data.status, 1);

      const submitted = parseTool(await client.callTool({
        name: "submit_response",
        arguments: { vid: 710001, inputcosttime: 30, submitdata: "1$2" },
      }), "submit response");
      assert.equal(submitted.data.jid, 99);
      const submitCall = calls.find((call) => call.action === "1001001");
      assert.equal(submitCall.body.jpmversion, 9, "submit should use read-back survey version");
      assert.equal(submitCall.body.submit_channel, "wjx-mcp");

      const clear = parseTool(await client.callTool({
        name: "clear_responses",
        arguments: { username: "owner", vid: 710001, reset_to_zero: false },
      }), "clear responses");
      assert.equal(clear.result, true);
      const clearTool = (await client.listTools()).tools.find((tool) => tool.name === "clear_responses");
      assert.equal(clearTool.annotations.destructiveHint, true);
    });

    const ambiguous = await withMockFetch((call) => {
      if (call.action === "1000001") return surveyReadResponse(1);
      if (call.action === "1001001") return { throw: new TypeError("network connection lost") };
      return { result: true, data: {} };
    }, async () => client.callTool({
      name: "submit_response",
      arguments: { vid: 710001, inputcosttime: 30, submitdata: "1$2", jpmversion: 9 },
    }));
    const ambiguousError = parseToolError(ambiguous, "ambiguous submit");
    assert.equal(ambiguousError.outcome, "unknown");
    assert.equal(ambiguousError.attempts, 1);
  } finally {
    await close();
  }
});

test("MCP golden analytics, settings preservation, and organization diffs are local or explicitly typed", async () => {
  const { client, close } = await connectClient("analytics-admin-golden");
  const calls = [];
  const settingState = {
    api_setting: { limit_type: 0 },
    after_submit_setting: { show_thanks: false },
    msg_setting: { post_url: "https://example.test/hook", quick_post: true, retry: true },
    sojumpparm_setting: { params: [] },
    time_setting: { begin_time: "2026-01-01 00:00" },
  };
  try {
    await withMockFetch((call) => {
      calls.push(call);
      if (call.action === "1000003") return { result: true, data: structuredClone(settingState) };
      if (call.action === "1000103") {
        for (const key of ["api_setting", "after_submit_setting", "msg_setting", "sojumpparm_setting", "time_setting"]) {
          if (typeof call.body[key] === "string") settingState[key] = JSON.parse(call.body[key]);
        }
        return { result: true, data: { saved: true } };
      }
      return { result: true, data: { saved: true } };
    }, async () => {
      const noNps = parseTool(await client.callTool({ name: "calculate_nps", arguments: { scores: [] } }), "no-data NPS");
      assert.equal(noNps.dataStatus, "no-data");
      assert.equal(noNps.score, null);
      const noCsat = parseTool(await client.callTool({ name: "calculate_csat", arguments: { scores: [] } }), "no-data CSAT");
      assert.equal(noCsat.dataStatus, "no-data");
      const invalidCsat = parseToolError(await client.callTool({ name: "calculate_csat", arguments: { scores: [6] } }), "invalid CSAT");
      assert.match(invalidCsat.errormsg, /5-point|范围|整数/i);

      const anomalies = parseTool(await client.callTool({
        name: "detect_anomalies",
        arguments: { responses: [
          { jid: 1, answers: ["A", "A", "A"], inputcosttime: 100, ip: "192.0.2.1" },
          { jid: 2, answers: ["A", "A", "A"], inputcosttime: 100, ip: "192.0.2.1" },
        ] },
      }), "anomaly heuristic");
      assert.ok(anomalies.flagged.some((entry) => entry.reasons.includes("straight-lining")));
      assert.ok(anomalies.warnings.some((warning) => /speed-anomaly skipped/i.test(warning)));
      const comparison = parseTool(await client.callTool({
        name: "compare_metrics", arguments: { set_a: { nps: 10 }, set_b: { nps: 20 } },
      }), "metric comparison");
      assert.equal(comparison.comparisons[0].significanceBasis, "heuristic-threshold");

      const settings = parseTool(await client.callTool({ name: "get_survey_settings", arguments: { vid: 710001 } }), "settings read");
      assert.equal(settings.data.msg_setting.post_url, "https://example.test/hook");
      parseTool(await client.callTool({
        name: "update_survey_settings",
        arguments: {
          vid: 710001,
          api_setting: JSON.stringify({ limit_type: 1 }),
          after_submit_setting: JSON.stringify({ show_thanks: true }),
          msg_setting: JSON.stringify({ post_url: "https://example.test/hook", quick_post: true }),
          sojumpparm_setting: JSON.stringify({ params: [{ name: "source", type: 0 }] }),
          time_setting: JSON.stringify({ begin_time: "2026-01-01 00:00" }),
        },
      }), "settings update");
      const settingCall = calls.find((call) => call.action === "1000103");
      for (const key of ["api_setting", "after_submit_setting", "msg_setting", "sojumpparm_setting", "time_setting"]) {
        assert.equal(typeof settingCall.body[key], "string", `${key} should remain a complete JSON field`);
      }

      const organizationCases = [
        ["add_contacts", { corpid: "corp-1", users: '[{"userid":"u1","name":"张三"}]', auto_create_tag: true }, "1005002", "users"],
        ["add_admin", { corpid: "corp-1", users: '[{"userid":"u1","role":2}]' }, "1005004", "users"],
        ["add_department", { corpid: "corp-1", depts: '["研发部/后端"]' }, "1005102", "depts"],
        ["add_tag", { corpid: "corp-1", child_names: '["学历/本科"]' }, "1005202", "child_names"],
      ];
      for (const [name, arguments_, action, field] of organizationCases) {
        parseTool(await client.callTool({ name, arguments: arguments_ }), name);
        const call = calls.findLast((entry) => entry.action === action);
        assert.equal(call.body[field], arguments_[field]);
        assert.equal(call.body.corpid, "corp-1");
      }
      assert.equal(calls.length, 8, "local analytics should not use the upstream transport");
    });

    const { client: validationClient, close: closeValidation } = await connectClient("validation-golden");
    try {
      const numericSid = parseToolError(await validationClient.callTool({ name: "build_preview_url", arguments: { sid: "123456" } }), "numeric sid");
      assert.match(numericSid.errormsg, /sid|数字|短链/i);
      const atype8 = parseToolError(await validationClient.callTool({
        name: "create_survey_by_json",
        arguments: { jsonl: surveyJsonl("单选"), atype: 8 },
      }), "atype 8");
      assert.match(atype8.errormsg, /不支持|8/);
    } finally {
      await closeValidation();
    }
  } finally {
    await close();
  }
});
