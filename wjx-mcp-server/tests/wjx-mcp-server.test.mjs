import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import {
  buildCreateSurveyParams,
  createSurvey,
  WJX_API_URL,
  Action,
} from "../dist/wjx-client.js";
import { buildSignaturePayload, signParams } from "../dist/sign.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
const serverEntry = path.join(projectDir, "dist", "index.js");

test("signParams concatenates sorted values and appkey before hashing", () => {
  const params = {
    title: "问卷标题",
    action: "1000101",
    appid: "test-app",
    publish: false,
    ts: "1700000000",
  };

  const payload = buildSignaturePayload(params, "secret-key");
  const sign = signParams(params, "secret-key");

  assert.equal(payload, "1000101test-appfalse问卷标题1700000000secret-key");
  assert.equal(sign, "b3a551b74307086a5692ab96193190cd05af430c");
});

test("buildCreateSurveyParams produces a signed WJX request body", () => {
  const params = buildCreateSurveyParams(
    {
      title: "满意度调查",
      type: 1,
      description: "服务满意度调查",
      publish: true,
      questions: '[{"q_index":1,"q_type":3,"q_title":"你满意吗？"}]',
    },
    { appId: "demo-app", appKey: "demo-key" },
    "1700000000",
  );

  assert.equal(params.action, "1000101");
  assert.equal(params.appid, "demo-app");
  assert.equal(params.atype, 1);
  assert.equal(params.desc, "服务满意度调查");
  assert.equal(params.publish, true);
  assert.equal(params.ts, "1700000000");
  assert.equal(params.sign, "4785e9ceec67dc4ddfca8f6abf8706c258990c30");
});

test("createSurvey sends a JSON POST request to WJX", async () => {
  let capturedUrl;
  let capturedInit;

  const response = await createSurvey(
    {
      title: "产品调研",
      type: 2,
      description: "调研问卷",
      questions: "[]",
    },
    { appId: "client-app", appKey: "client-key" },
    async (input, init) => {
      capturedUrl = input;
      capturedInit = init;

      return new Response(
        JSON.stringify({ result: true, data: { surveyId: 123 } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
    "1700000000",
  );

  assert.ok(capturedUrl.startsWith(WJX_API_URL), `URL should start with ${WJX_API_URL}`);
  assert.equal(capturedInit.method, "POST");
  assert.equal(capturedInit.headers["Content-Type"], "application/json");
  assert.deepEqual(response, { result: true, data: { surveyId: 123 } });

  const parsedBody = JSON.parse(capturedInit.body);
  assert.equal(parsedBody.action, "1000101");
  assert.equal(parsedBody.appid, "client-app");
  assert.match(parsedBody.sign, /^[0-9a-f]{40}$/, "sign should be 40-char hex SHA1");
  assert.equal("traceid" in parsedBody, false, "traceid should not be in POST body");
});

test("server exposes all 37 tools, 6 resources, and 9 prompts over stdio", async () => {
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverEntry],
    cwd: projectDir,
    env: process.env,
    stderr: "pipe",
  });
  const client = new Client({
    name: "wjx-mcp-server-test-client",
    version: "1.0.0",
  });

  const stderr = [];
  transport.stderr?.on("data", (chunk) => {
    stderr.push(String(chunk));
  });

  try {
    await client.connect(transport);

    // ─── Tools ─────────────────────────────────────────────────────
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((t) => t.name).sort();
    assert.deepEqual(toolNames, [
      "add_contacts",
      "add_participants",
      "add_sub_account",
      "build_survey_url",
      "clear_recycle_bin",
      "clear_responses",
      "create_survey",
      "delete_participants",
      "delete_sub_account",
      "delete_survey",
      "download_responses",
      "get_360_report",
      "get_file_links",
      "get_question_tags",
      "get_report",
      "get_survey",
      "get_survey_settings",
      "get_tag_details",
      "get_winners",
      "list_surveys",
      "manage_contacts",
      "modify_participants",
      "modify_response",
      "modify_sub_account",
      "query_contacts",
      "query_responses",
      "query_responses_realtime",
      "query_sub_accounts",
      "query_survey_binding",
      "query_user_surveys",
      "restore_sub_account",
      "sso_partner_url",
      "sso_subaccount_url",
      "sso_user_system_url",
      "submit_response",
      "update_survey_settings",
      "update_survey_status",
    ]);

    const createTool = toolsResult.tools.find((t) => t.name === "create_survey");
    assert.ok(createTool, `create_survey not found. stderr: ${stderr.join("")}`);
    assert.deepEqual(createTool.inputSchema.required?.slice().sort(), [
      "atype",
      "desc",
      "questions",
      "title",
    ]);

    const getTool = toolsResult.tools.find((t) => t.name === "get_survey");
    assert.ok(getTool);
    assert.ok(getTool.inputSchema.required?.includes("vid"));

    const listTool = toolsResult.tools.find((t) => t.name === "list_surveys");
    assert.ok(listTool);

    const updateTool = toolsResult.tools.find((t) => t.name === "update_survey_status");
    assert.ok(updateTool);
    assert.deepEqual(updateTool.inputSchema.required?.slice().sort(), ["state", "vid"]);

    // ─── New tools checks ──────────────────────────────────────────
    const queryTool = toolsResult.tools.find((t) => t.name === "query_responses");
    assert.ok(queryTool);
    assert.ok(queryTool.inputSchema.required?.includes("vid"));

    const realtimeTool = toolsResult.tools.find((t) => t.name === "query_responses_realtime");
    assert.ok(realtimeTool);
    assert.ok(realtimeTool.inputSchema.required?.includes("vid"));

    const downloadTool = toolsResult.tools.find((t) => t.name === "download_responses");
    assert.ok(downloadTool);

    const reportTool = toolsResult.tools.find((t) => t.name === "get_report");
    assert.ok(reportTool);

    const deleteTool = toolsResult.tools.find((t) => t.name === "delete_survey");
    assert.ok(deleteTool);
    assert.deepEqual(deleteTool.inputSchema.required?.slice().sort(), ["username", "vid"]);

    const submitTool = toolsResult.tools.find((t) => t.name === "submit_response");
    assert.ok(submitTool);
    assert.deepEqual(submitTool.inputSchema.required?.slice().sort(), [
      "inputcosttime",
      "submitdata",
      "vid",
    ]);

    // ─── Resources ─────────────────────────────────────────────────
    const resourcesResult = await client.listResources();
    const resourceUris = resourcesResult.resources.map((r) => r.uri).sort();
    assert.deepEqual(resourceUris, [
      "wjx://reference/analysis-methods",
      "wjx://reference/question-types",
      "wjx://reference/response-format",
      "wjx://reference/survey-statuses",
      "wjx://reference/survey-types",
      "wjx://reference/user-roles",
    ]);

    // Verify a resource can be read
    const typesResource = await client.readResource({ uri: "wjx://reference/survey-types" });
    assert.ok(typesResource.contents.length > 0);
    const parsed = JSON.parse(typesResource.contents[0].text);
    assert.equal(parsed["1"], "问卷调查");

    // ─── Prompts ───────────────────────────────────────────────────
    const promptsResult = await client.listPrompts();
    const promptNames = promptsResult.prompts.map((p) => p.name).sort();
    assert.deepEqual(promptNames, [
      "analyze-results",
      "comparative-analysis",
      "create-nps-survey",
      "cross-tabulation",
      "csat-analysis",
      "design-survey",
      "nps-analysis",
      "sentiment-analysis",
      "survey-health-check",
    ]);

    // Verify a prompt can be retrieved
    const npsPrompt = await client.getPrompt({
      name: "create-nps-survey",
      arguments: { product_name: "TestProduct" },
    });
    assert.ok(npsPrompt.messages.length > 0);
    assert.ok(npsPrompt.messages[0].content.text.includes("TestProduct"));
  } finally {
    await transport.close();
  }
});
