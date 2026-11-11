import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";

test("MCP exposes only create_survey_by_json for survey creation", async () => {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "creation-surface", version: "1.0.0" });
  await client.connect(clientTransport);
  try {
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    assert.equal(names.includes("create_survey_by_json"), true);
    assert.equal(names.includes("create_survey"), false);
    assert.equal(names.includes("create_survey_by_text"), false);
  } finally {
    await client.close();
  }
});

test("AI homepage tools expose the standalone create and in-place update contract", async () => {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "ai-page-contract", version: "1.0.0" });
  await client.connect(clientTransport);
  try {
    const tools = (await client.listTools()).tools;
    const createTool = tools.find((tool) => tool.name === "create_ai_page");
    const updateTool = tools.find((tool) => tool.name === "update_ai_page");
    const getTool = tools.find((tool) => tool.name === "get_survey");

    assert.match(createTool.description, /不要额外创建或关联表单、问卷/);
    assert.match(createTool.description, /逐页 PPT/);
    assert.equal("page_type" in updateTool.inputSchema.properties, false);
    assert.match(updateTool.description, /先用 get_survey 读取/);
    assert.match(updateTool.description, /不得创建替代主页，也不得删除原主页/);
    assert.match(getTool.description, /html_content/);
    assert.match(getTool.description, /草稿/);
  } finally {
    await client.close();
  }
});
