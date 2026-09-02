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
