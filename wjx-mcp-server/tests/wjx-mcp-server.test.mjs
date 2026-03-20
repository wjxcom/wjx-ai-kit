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
    {
      appId: "demo-app",
      appKey: "demo-key",
    },
    "1700000000",
  );

  assert.equal(params.action, "1000101");
  assert.equal(params.appid, "demo-app");
  assert.equal(params.atype, 1);
  assert.equal(params.desc, "服务满意度调查");
  assert.equal(params.publish, true);
  assert.equal(params.ts, "1700000000");
  assert.equal(params.sign, "e25b274860a0734fb258e1edb6d1d86f1cb96db7");
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
    {
      appId: "client-app",
      appKey: "client-key",
    },
    async (input, init) => {
      capturedUrl = input;
      capturedInit = init;

      return new Response(JSON.stringify({ result: true, data: { surveyId: 123 } }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
    "1700000000",
  );

  assert.equal(capturedUrl, WJX_API_URL);
  assert.equal(capturedInit.method, "POST");
  assert.equal(capturedInit.headers["Content-Type"], "application/json");
  assert.deepEqual(response, { result: true, data: { surveyId: 123 } });

  const parsedBody = JSON.parse(capturedInit.body);
  assert.equal(parsedBody.action, "1000101");
  assert.equal(parsedBody.appid, "client-app");
  assert.equal(parsedBody.sign, "f35740456a4d3fe19dd9db412feab9c8bd10cb5d");
});

test("server exposes create_survey through tools/list over stdio", async () => {
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
    const result = await client.listTools();
    const tool = result.tools.find((entry) => entry.name === "create_survey");

    assert.ok(tool, stderr.join(""));
    assert.deepEqual(tool.inputSchema.required?.slice().sort(), [
      "description",
      "questions",
      "title",
      "type",
    ]);
  } finally {
    await transport.close();
  }
});
