import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { setCredentialProvider } from "wjx-api-sdk";

import { createServer } from "../dist/server.js";
import { getRequestCredentials } from "../dist/core/context.js";
import { startHttpTransport } from "../dist/transports/http.js";

setCredentialProvider(getRequestCredentials);

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      resolve(address.port);
    });
  });
}

function close(server) {
  if (!server?.listening) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}

function surveyResponse(status = 1) {
  return {
    result: true,
    data: {
      vid: 720001,
      sid: "httpGoldenSid",
      title: "HTTP Golden Survey",
      status,
      version: 4,
      questions: [{ q_index: 1, q_type: 3, q_subtype: 3, q_title: "满意度" }],
      // The mock upstream uses a per-test localhost origin. Keeping the
      // respondent origin aligned with that configured base exercises the
      // same-origin check without trusting an unrelated public host.
      activity_domain: process.env.WJX_BASE_URL,
      pc_path: "/vm/httpGoldenSid.aspx",
      edit_url: "/newwjx/design/editquestionnaire.aspx?activity=720001",
    },
  };
}

function jsonl() {
  return [
    JSON.stringify({ qtype: "问卷基础信息", title: "HTTP Golden Survey" }),
    JSON.stringify({ qtype: "单选", title: "满意度", select: ["A", "B"] }),
  ].join("\n");
}

test("HTTP MCP golden workflow reaches a local API, isolates tenants, and enforces session credentials", async () => {
  const previous = {
    apiUrl: process.env.WJX_API_URL,
    baseUrl: process.env.WJX_BASE_URL,
    shortLinkUrl: process.env.WJX_SHORTLINK_URL,
    apiKey: process.env.WJX_API_KEY,
    tenantMode: process.env.MCP_TENANT_MODE,
    legacy: process.env.MCP_LEGACY_BEARER_API_KEY,
  };
  const apiRequests = [];
  let apiServer;
  let mcpHandle;
  let first;
  let second;
  try {
    apiServer = createHttpServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const rawBody = Buffer.concat(chunks).toString("utf8");
      let body = {};
      try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { body = {}; }
      apiRequests.push({
        method: request.method,
        path: request.url,
        authorization: request.headers.authorization,
        forwardedFor: request.headers["x-forwarded-for"],
        body,
      });

      let payload;
      const action = String(body.action ?? "");
      if (request.method === "GET" && request.url?.startsWith("/openapi/shortlink.aspx")) {
        payload = { success: true, msg: null, data: "https://short.example/hg" };
      } else if (action === "1000002") {
        payload = { result: true, data: { total_count: 1, page_index: 1, page_size: 1, activitys: { "720001": { vid: 720001, title: "HTTP Golden Survey" } } } };
      } else if (action === "1000001") {
        payload = surveyResponse(1);
      } else if (action === "1000106") {
        payload = { result: true, data: { vid: 720001, sid: "httpGoldenSid" } };
      } else if (action === "1000102") {
        payload = { result: true, data: { status: 1 } };
      } else if (action === "1001002") {
        payload = { result: true, data: { total_count: 3, join_times: 3, page_index: 1, page_size: 1, responses: [{ jid: 31 }] } };
      } else if (action === "1001001") {
        payload = { result: true, data: { jid: 32 } };
      } else {
        payload = { result: true, data: {} };
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
    });
    const apiPort = await listen(apiServer);
    process.env.WJX_API_URL = `http://127.0.0.1:${apiPort}/openapi/default.aspx`;
    process.env.WJX_BASE_URL = `http://127.0.0.1:${apiPort}`;
    process.env.WJX_SHORTLINK_URL = `http://127.0.0.1:${apiPort}/openapi/shortlink.aspx`;
    process.env.WJX_API_KEY = "process-wide-key";
    process.env.MCP_TENANT_MODE = "1";
    process.env.MCP_LEGACY_BEARER_API_KEY = "0";

    mcpHandle = await startHttpTransport(createServer(), {
      port: 0,
      stateful: true,
      authToken: "transport-token",
      upstreamApiKey: "process-wide-key",
      legacyBearerApiKey: false,
    }, createServer);
    const mcpAddress = mcpHandle.httpServer.address();
    assert.ok(mcpAddress && typeof mcpAddress !== "string");
    const endpoint = new URL(`http://127.0.0.1:${mcpAddress.port}/mcp`);

    const makeClient = async (apiKey, ip, name) => {
      const client = new Client({ name, version: "1.0.0" });
      const transport = new StreamableHTTPClientTransport(endpoint, {
        requestInit: {
          headers: {
            Authorization: "Bearer transport-token",
            "X-WJX-API-Key": apiKey,
            "X-Forwarded-For": ip,
          },
        },
      });
      await client.connect(transport);
      return { client, transport };
    };
    first = await makeClient("tenant-a-secret-key", "203.0.113.20", "http-golden-a");
    second = await makeClient("tenant-b-secret-key", "203.0.113.21", "http-golden-b");

    const [listA, listB] = await Promise.all([
      first.client.callTool({ name: "list_surveys", arguments: { page_index: 1, page_size: 1 } }),
      second.client.callTool({ name: "list_surveys", arguments: { page_index: 1, page_size: 1 } }),
    ]);
    for (const result of [listA, listB]) {
      assert.equal(result.isError, false, JSON.stringify(result));
      assert.equal(JSON.parse(result.content[0].text).data.total_count, 1);
    }

    const created = await first.client.callTool({
      name: "create_survey_by_json",
      arguments: { jsonl: jsonl(), atype: 1 },
    });
    assert.equal(created.isError, false, JSON.stringify(created));
    assert.equal(JSON.parse(created.content[0].text).result, true);
    const published = await first.client.callTool({ name: "update_survey_status", arguments: { vid: 720001, state: 1 } });
    assert.equal(published.isError, false, JSON.stringify(published));

    const responses = await second.client.callTool({ name: "count_responses", arguments: { vid: 720001 } });
    assert.equal(responses.isError, false);
    assert.equal(JSON.parse(responses.content[0].text).total_count, 3);

    const shortLink = await first.client.callTool({
      name: "get_short_link",
      arguments: { url: "https://www.wjx.cn/vm/httpGoldenSid.aspx?source=agent" },
    });
    assert.equal(shortLink.isError, false, JSON.stringify(shortLink));
    assert.equal(JSON.parse(shortLink.content[0].text).data, "https://short.example/hg");

    const apiActions = apiRequests.filter((request) => request.body.action).map((request) => request.body.action);
    assert.ok(apiActions.includes("1000106"));
    assert.ok(apiActions.includes("1000102"));
    assert.ok(apiActions.includes("1001002"));
    const tenantAuth = apiRequests.filter((request) => request.body.action).map((request) => request.authorization).sort();
    assert.ok(tenantAuth.includes("Bearer tenant-a-secret-key"));
    assert.ok(tenantAuth.includes("Bearer tenant-b-secret-key"));
    assert.equal(tenantAuth.includes("Bearer process-wide-key"), false, "tenant mode must not use the process-wide key");
    const forwarded = apiRequests.filter((request) => request.body.action).map((request) => request.forwardedFor);
    assert.ok(forwarded.includes("203.0.113.20"));
    assert.ok(forwarded.includes("203.0.113.21"));

    const missingTenant = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: "Bearer transport-token", "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "missing", version: "1" } } }),
    });
    assert.equal(missingTenant.status, 401);

    const deleted = await fetch(endpoint, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer transport-token",
        "X-WJX-API-Key": "tenant-a-secret-key",
        "mcp-session-id": first.transport.sessionId,
      },
    });
    assert.equal(deleted.status, 200);
    const reused = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer transport-token",
        "X-WJX-API-Key": "tenant-a-secret-key",
        "content-type": "application/json",
        "mcp-session-id": first.transport.sessionId,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 100, method: "tools/list", params: {} }),
    });
    assert.equal(reused.status, 400);
  } finally {
    await first?.client.close().catch(() => undefined);
    await second?.client.close().catch(() => undefined);
    await mcpHandle?.close().catch(() => undefined);
    await close(apiServer);
    if (previous.apiUrl === undefined) delete process.env.WJX_API_URL;
    else process.env.WJX_API_URL = previous.apiUrl;
    if (previous.baseUrl === undefined) delete process.env.WJX_BASE_URL;
    else process.env.WJX_BASE_URL = previous.baseUrl;
    if (previous.shortLinkUrl === undefined) delete process.env.WJX_SHORTLINK_URL;
    else process.env.WJX_SHORTLINK_URL = previous.shortLinkUrl;
    if (previous.apiKey === undefined) delete process.env.WJX_API_KEY;
    else process.env.WJX_API_KEY = previous.apiKey;
    if (previous.tenantMode === undefined) delete process.env.MCP_TENANT_MODE;
    else process.env.MCP_TENANT_MODE = previous.tenantMode;
    if (previous.legacy === undefined) delete process.env.MCP_LEGACY_BEARER_API_KEY;
    else process.env.MCP_LEGACY_BEARER_API_KEY = previous.legacy;
  }
});

test("HTTP health remains public while MCP authentication is required", async () => {
  const handle = await startHttpTransport(createServer(), { port: 0, stateful: true, authToken: "health-token", legacyBearerApiKey: false }, createServer);
  try {
    const address = handle.httpServer.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    const unauthorized = await fetch(`${base}/mcp`, { method: "POST" });
    assert.equal(unauthorized.status, 401);
  } finally {
    await handle.close();
  }
});
