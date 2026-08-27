import { test } from "node:test";
import assert from "node:assert/strict";
import { callWjxApi } from "../dist/core/api-client.js";

test("MCP re-export retains SDK transport behavior", async () => {
  const result = await callWjxApi({ action: "mcp-test" }, { credentials: { apiKey: "key" }, retryBudget: 0, fetchImpl: async () => new Response(JSON.stringify({ result: true, data: {} })) });
  assert.equal(result.result, true);
});
