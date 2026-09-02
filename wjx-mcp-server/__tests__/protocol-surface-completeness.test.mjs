import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createServer } from "../dist/server.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP_SKILL_ROOT = resolve(HERE, "..", "..", "wjx-skills", "wjx-mcp-use");

const RESOURCE_URIS = [
  "wjx://reference/analysis-methods",
  "wjx://reference/dsl-syntax",
  "wjx://reference/push-format",
  "wjx://reference/question-types",
  "wjx://reference/response-format",
  "wjx://reference/survey-statuses",
  "wjx://reference/survey-types",
  "wjx://reference/user-roles",
];

const PROMPT_ARGS = {
  "analyze-results": { survey_id: "42" },
  "anomaly-detection": { vid: "42" },
  "comparative-analysis": { survey_ids: "42,43" },
  "configure-webhook": { vid: "42" },
  "create-nps-survey": { product_name: "黑盒产品" },
  "csat-analysis": { survey_id: "42" },
  "cross-tabulation": { survey_id: "42", question_a: "1", question_b: "2" },
  "design-survey": { topic: "客户满意度" },
  "generate-exam-json": { knowledge_scope: "Python 基础" },
  "generate-form-json": { topic: "活动报名" },
  "generate-survey-json": { topic: "用户调研" },
  "nps-analysis": { survey_id: "42" },
  "sentiment-analysis": { survey_id: "42" },
  "survey-health-check": { survey_id: "42" },
  "user-system-workflow": {},
};

let client;
let server;

after(async () => {
  await client?.close();
  client = undefined;
  server = undefined;
});

async function createClient() {
  server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  client = new Client({ name: "protocol-surface-completeness", version: "1.0.0" });
  await client.connect(clientTransport);
  return client;
}

test("every registered resource is readable and contains valid JSON", async () => {
  const mcp = await createClient();
  const listed = await mcp.listResources();
  assert.deepEqual(listed.resources.map((resource) => resource.uri).sort(), [...RESOURCE_URIS].sort());

  for (const uri of RESOURCE_URIS) {
    const result = await mcp.readResource({ uri });
    assert.equal(result.contents.length, 1, `${uri} returned an unexpected content count`);
    assert.equal(result.contents[0].uri, uri);
    assert.equal(result.contents[0].mimeType, "application/json");
    const parsed = JSON.parse(result.contents[0].text);
    assert.ok(parsed && typeof parsed === "object", `${uri} returned non-object JSON`);
  }
});

test("every registered prompt can be fetched with a valid curated argument set", async () => {
  const mcp = await createClient();
  const listed = await mcp.listPrompts();
  const names = listed.prompts.map((prompt) => prompt.name).sort();
  assert.deepEqual(names, Object.keys(PROMPT_ARGS).sort(), "prompt denominator drifted without a curated invocation");

  for (const name of names) {
    const result = await mcp.getPrompt({ name, arguments: PROMPT_ARGS[name] });
    assert.ok(result.messages.length > 0, `${name} returned no messages`);
    for (const message of result.messages) {
      assert.equal(message.role, "user", `${name} returned an unexpected message role`);
      assert.equal(message.content.type, "text", `${name} returned non-text content`);
      assert.ok(message.content.text.trim(), `${name} returned empty prompt text`);
    }
  }
});

test("the MCP Skill documents every registered tool, resource, and prompt", async () => {
  const mcp = await createClient();
  const docs = [
    resolve(MCP_SKILL_ROOT, "SKILL.md"),
    resolve(MCP_SKILL_ROOT, "references", "tools-survey.md"),
    resolve(MCP_SKILL_ROOT, "references", "tools-response.md"),
    resolve(MCP_SKILL_ROOT, "references", "tools-other.md"),
    resolve(MCP_SKILL_ROOT, "references", "dsl-and-types.md"),
  ];
  const text = (await Promise.all(docs.map((path) => readFile(path, "utf8")))).join("\n");
  const [tools, resources, prompts] = await Promise.all([
    mcp.listTools(),
    mcp.listResources(),
    mcp.listPrompts(),
  ]);

  for (const tool of tools.tools) {
    assert.ok(text.includes(tool.name), `Skill does not document tool ${tool.name}`);
  }
  for (const resource of resources.resources) {
    assert.ok(text.includes(resource.uri), `Skill does not document resource ${resource.uri}`);
  }
  for (const prompt of prompts.prompts) {
    assert.ok(text.includes(prompt.name), `Skill does not document prompt ${prompt.name}`);
  }
});

test("required prompt arguments are rejected before prompt execution", async () => {
  const mcp = await createClient();
  const listed = await mcp.listPrompts();
  const required = listed.prompts.filter((prompt) => prompt.arguments?.some((argument) => argument.required));
  assert.equal(required.length, 14, "prompt required-argument denominator drifted without a prompt contract change");

  for (const prompt of required) {
    await assert.rejects(
      () => mcp.getPrompt({ name: prompt.name, arguments: {} }),
      undefined,
      `${prompt.name} accepted missing required arguments`,
    );
  }
});
