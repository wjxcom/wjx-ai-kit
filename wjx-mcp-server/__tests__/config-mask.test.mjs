import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, maskApiKeyForDisplay } from "../dist/server.js";

test("MCP diagnostics fully masks short API keys", () => {
  assert.equal(maskApiKeyForDisplay(""), "(未设置)");
  assert.equal(maskApiKeyForDisplay("short-key"), "****");
  assert.equal(maskApiKeyForDisplay("123456789012"), "****");
  assert.equal(maskApiKeyForDisplay("1234567890123"), "12345678****0123");
});

test("MCP get_config treats whitespace routing values as unset", async () => {
  const previousCorpId = process.env.WJX_CORP_ID;
  const previousBaseUrl = process.env.WJX_BASE_URL;
  process.env.WJX_CORP_ID = "  \t";
  process.env.WJX_BASE_URL = "  \t";
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "config-test", version: "1.0" });
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const result = await client.callTool({ name: "get_config", arguments: {} });
    assert.equal(result.isError, false);
    const config = JSON.parse(result.content[0].text);
    assert.equal(config.corp_id, "(未设置)");
    assert.equal(config.env_WJX_BASE_URL, "(未设置，使用默认值)");
    assert.equal(config.base_url, "https://www.wjx.cn");
  } finally {
    await client.close();
    await server.close();
    if (previousCorpId === undefined) delete process.env.WJX_CORP_ID;
    else process.env.WJX_CORP_ID = previousCorpId;
    if (previousBaseUrl === undefined) delete process.env.WJX_BASE_URL;
    else process.env.WJX_BASE_URL = previousBaseUrl;
  }
});
