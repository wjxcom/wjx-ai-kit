import { test } from "node:test";
import assert from "node:assert/strict";
import { callWjxApi } from "../dist/index.js";

test("SDK accepts additive retryBudget and traceId options", async () => {
  let calls = 0;
  const response = await callWjxApi({ action: "test" }, {
    credentials: { apiKey: "key" }, retryBudget: 0, traceId: "trace-test",
    fetchImpl: async (url) => { calls += 1; assert.match(String(url), /trace-test/); return new Response(JSON.stringify({ result: true, data: { ok: true } })); },
  });
  assert.equal(calls, 1); assert.equal(response.result, true);
});
