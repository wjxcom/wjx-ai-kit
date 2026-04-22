import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import {
  createSurvey,
  getWjxApiUrl,
  Action,
} from "../dist/wjx-client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
const serverEntry = path.join(projectDir, "dist", "index.js");

const credentials = { apiKey: "test-token" };

test("createSurvey sends a JSON POST with Bearer auth to WJX", async () => {
  let capturedUrl;
  let capturedInit;

  const response = await createSurvey(
    {
      title: "产品调研",
      type: 2,
      description: "调研问卷",
      questions: "[]",
    },
    credentials,
    async (input, init) => {
      capturedUrl = input;
      capturedInit = init;

      return new Response(
        JSON.stringify({ result: true, data: { surveyId: 123 } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  );

  const apiUrl = getWjxApiUrl();
  assert.ok(capturedUrl.startsWith(apiUrl), `URL should start with ${apiUrl}`);
  assert.equal(capturedInit.method, "POST");
  assert.equal(capturedInit.headers["Content-Type"], "application/json");
  assert.equal(capturedInit.headers["Authorization"], "Bearer test-token");
  assert.deepEqual(response, { result: true, data: { surveyId: 123 } });

  const parsedBody = JSON.parse(capturedInit.body);
  assert.equal(parsedBody.action, "1000101");
  assert.equal("sign" in parsedBody, false, "sign should not be in body");
  assert.equal("appid" in parsedBody, false, "appid should not be in body");
  assert.equal("ts" in parsedBody, false, "ts should not be in body");
  assert.equal("traceid" in parsedBody, false, "traceid should not be in POST body");
});

test("server exposes all 58 tools, 8 resources, and 22 prompts over stdio", async () => {
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
      "add_admin",
      "add_contacts",
      "add_department",
      "add_participants",
      "add_sub_account",
      "add_tag",
      "bind_activity",
      "build_preview_url",
      "build_survey_url",
      "calculate_csat",
      "calculate_nps",
      "clear_recycle_bin",
      "clear_responses",
      "compare_metrics",
      "create_survey",
      "create_survey_by_json",
      "create_survey_by_text",
      "decode_responses",
      "delete_admin",
      "delete_contacts",
      "delete_department",
      "delete_participants",
      "delete_sub_account",
      "delete_survey",
      "delete_tag",
      "detect_anomalies",
      "download_responses",
      "get_360_report",
      "get_config",
      "get_question_tags",
      "get_report",
      "get_survey",
      "get_survey_settings",
      "get_tag_details",
      "get_winners",
      "list_departments",
      "list_surveys",
      "list_tags",
      "modify_department",
      "modify_participants",
      "modify_response",
      "modify_sub_account",
      "modify_tag",
      "query_contacts",
      "query_responses",
      "query_responses_realtime",
      "query_sub_accounts",
      "query_survey_binding",
      "query_user_surveys",
      "restore_admin",
      "restore_sub_account",
      "sso_partner_url",
      "sso_subaccount_url",
      "sso_user_system_url",
      "submit_response",
      "update_survey_settings",
      "update_survey_status",
      "upload_file",
    ]);

    const createTool = toolsResult.tools.find((t) => t.name === "create_survey");
    assert.ok(createTool, `create_survey not found. stderr: ${stderr.join("")}`);
    assert.deepEqual(createTool.inputSchema.required?.slice().sort(), [
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
      "wjx://reference/dsl-syntax",
      "wjx://reference/push-format",
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
    assert.equal(parsed["1"], "调查");

    // ─── Prompts ───────────────────────────────────────────────────
    const promptsResult = await client.listPrompts();
    const promptNames = promptsResult.prompts.map((p) => p.name).sort();
    assert.deepEqual(promptNames, [
      "analyze-results",
      "anomaly-detection",
      "comparative-analysis",
      "configure-webhook",
      "create-nps-survey",
      "cross-tabulation",
      "csat-analysis",
      "design-survey",
      "generate-360-evaluation",
      "generate-engagement-survey",
      "generate-exam-from-document",
      "generate-exam-from-knowledge",
      "generate-exam-json",
      "generate-form-json",
      "generate-nps-survey",
      "generate-satisfaction-survey",
      "generate-survey",
      "generate-survey-json",
      "nps-analysis",
      "sentiment-analysis",
      "survey-health-check",
      "user-system-workflow",
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
