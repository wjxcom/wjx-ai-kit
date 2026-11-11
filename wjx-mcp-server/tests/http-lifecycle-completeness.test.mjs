import assert from "node:assert/strict";
import { after, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { createServer } from "../dist/server.js";
import { startHttpTransport } from "../dist/transports/http.js";

let httpServer;

after(async () => {
  if (httpServer?.listening) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
  httpServer = undefined;
});

async function start() {
  if (httpServer?.listening) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
  const result = await startHttpTransport(createServer(), { port: 0, stateful: true }, createServer);
  httpServer = result.httpServer;
  const address = httpServer.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}/mcp`;
}

async function jsonResponse(response) {
  const body = await response.json();
  return { status: response.status, body };
}

test("MCP HTTP rejects malformed JSON, missing sessions, invalid sessions, and unsupported methods", async () => {
  const endpoint = await start();
  const commonHeaders = { "content-type": "application/json" };

  const malformed = await fetch(endpoint, {
    method: "POST",
    headers: commonHeaders,
    body: "{not-json",
  });
  const malformedResult = await jsonResponse(malformed);
  assert.equal(malformedResult.status, 400);
  assert.equal(malformedResult.body.error.code, -32700);

  const missingSession = await fetch(endpoint, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  const missingSessionResult = await jsonResponse(missingSession);
  assert.equal(missingSessionResult.status, 400);
  assert.equal(missingSessionResult.body.error.code, -32000);

  for (const method of ["GET", "DELETE"]) {
    const response = await fetch(endpoint, { method });
    const result = await jsonResponse(response);
    assert.equal(result.status, 400, `${method} without a session should be rejected`);
    assert.match(result.body.error, /session/i);
  }

  const invalidSession = await fetch(endpoint, {
    method: "POST",
    headers: { ...commonHeaders, "mcp-session-id": "does-not-exist" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
  });
  const invalidSessionResult = await jsonResponse(invalidSession);
  assert.equal(invalidSessionResult.status, 400);
  assert.equal(invalidSessionResult.body.error.code, -32000);

  const unsupported = await fetch(endpoint, { method: "PUT" });
  const unsupportedResult = await jsonResponse(unsupported);
  assert.equal(unsupportedResult.status, 405);
  assert.equal(unsupportedResult.body.error, "Method not allowed");
});

test("MCP HTTP DELETE terminates a live session and prevents reuse", async () => {
  const endpoint = await start();
  const client = new Client({ name: "http-lifecycle", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint));
  await client.connect(transport);
  const sessionId = transport.sessionId;
  assert.ok(sessionId, "stateful transport must issue a session ID");

  const deleted = await fetch(endpoint, {
    method: "DELETE",
    headers: { "mcp-session-id": sessionId },
  });
  assert.equal(deleted.status, 200);

  const reused = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "mcp-session-id": sessionId },
    body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list", params: {} }),
  });
  const reusedResult = await jsonResponse(reused);
  assert.equal(reusedResult.status, 400);
  assert.equal(reusedResult.body.error.code, -32000);

  await client.close().catch(() => undefined);
});
