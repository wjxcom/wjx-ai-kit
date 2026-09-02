import { test } from "node:test";
import assert from "node:assert/strict";
import { callWjxApi } from "../dist/core/api-client.js";
import { createServer } from "../dist/server.js";
import { startHttpTransport } from "../dist/transports/http.js";

test("MCP re-export retains SDK transport behavior", async () => {
  const result = await callWjxApi({ action: "mcp-test" }, { credentials: { apiKey: "key" }, retryBudget: 0, fetchImpl: async () => new Response(JSON.stringify({ result: true, data: {} })) });
  assert.equal(result.result, true);
});

test("HTTP transport rejects oversized request bodies before JSON parsing", async () => {
  const server = createServer();
  const { httpServer } = await startHttpTransport(server, {
    port: 0,
    stateful: false,
    maxBodyBytes: 32,
  });
  try {
    const address = httpServer.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(64),
    });
    assert.equal(response.status, 413);
    assert.match(await response.text(), /maximum size of 32 bytes/);
  } finally {
    await new Promise((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
    await server.close();
  }
});
