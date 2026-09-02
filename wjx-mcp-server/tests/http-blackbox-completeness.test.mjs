import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { after, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { setCredentialProvider } from "wjx-api-sdk";

import { createServer } from "../dist/server.js";
import { getRequestCredentials } from "../dist/core/context.js";
import { startHttpTransport } from "../dist/transports/http.js";

setCredentialProvider(getRequestCredentials);

let mcpHttpServer;
let apiHttpServer;
let previousApiUrl;
let previousApiKey;

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

after(async () => {
  if (previousApiUrl === undefined) delete process.env.WJX_API_URL;
  else process.env.WJX_API_URL = previousApiUrl;
  if (previousApiKey === undefined) delete process.env.WJX_API_KEY;
  else process.env.WJX_API_KEY = previousApiKey;
  await close(mcpHttpServer);
  await close(apiHttpServer);
});

test("HTTP MCP calls reach the WJX API with isolated per-session credentials", async () => {
  const apiRequests = [];
  apiHttpServer = createHttpServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    apiRequests.push({
      authorization: request.headers.authorization,
      forwardedFor: request.headers["x-forwarded-for"],
      body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      result: true,
      data: { total_count: 1, activitys: { "42": { vid: 42, title: "隔离问卷" } } },
    }));
  });
  const apiPort = await listen(apiHttpServer);
  previousApiUrl = process.env.WJX_API_URL;
  previousApiKey = process.env.WJX_API_KEY;
  process.env.WJX_API_URL = `http://127.0.0.1:${apiPort}/openapi/default.aspx`;
  process.env.WJX_API_KEY = "global-config-key";

  const { httpServer } = await startHttpTransport(createServer(), {
    port: 0,
    stateful: true,
  }, createServer);
  mcpHttpServer = httpServer;
  const mcpAddress = httpServer.address();
  assert.ok(mcpAddress && typeof mcpAddress !== "string");
  const endpoint = new URL(`http://127.0.0.1:${mcpAddress.port}/mcp`);

  const makeClient = async (apiKey, clientIp) => {
    const client = new Client({ name: `blackbox-${apiKey}`, version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(endpoint, {
      requestInit: {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Forwarded-For": clientIp,
        },
      },
    });
    await client.connect(transport);
    return { client, transport };
  };

  const first = await makeClient("tenant-a-secret-key", "203.0.113.10");
  const second = await makeClient("tenant-b-secret-key", "203.0.113.11");
  try {
    const configResult = await first.client.callTool({ name: "get_config", arguments: {} });
    assert.equal(configResult.isError, false, JSON.stringify(configResult));
    const config = JSON.parse(configResult.content[0].text);
    assert.equal(config.api_key, "tenant-a****-key");

    const [firstResult, secondResult] = await Promise.all([
      first.client.callTool({ name: "list_surveys", arguments: { page_index: 1, page_size: 1 } }),
      second.client.callTool({ name: "list_surveys", arguments: { page_index: 1, page_size: 1 } }),
    ]);
    for (const result of [firstResult, secondResult]) {
      assert.equal(result.isError, false, JSON.stringify(result));
      const payload = JSON.parse(result.content[0].text);
      assert.equal(payload.result, true);
      assert.equal(payload.data.total_count, 1);
    }
    assert.equal(apiRequests.length, 2);
    const auths = apiRequests.map((request) => request.authorization).sort();
    assert.deepEqual(auths, ["Bearer tenant-a-secret-key", "Bearer tenant-b-secret-key"]);
    const ips = apiRequests.map((request) => request.forwardedFor).sort();
    assert.deepEqual(ips, ["203.0.113.10", "203.0.113.11"]);
    assert.ok(apiRequests.every((request) => request.body.action === "1000002"));
  } finally {
    await first.client.close();
    await second.client.close();
  }
});
