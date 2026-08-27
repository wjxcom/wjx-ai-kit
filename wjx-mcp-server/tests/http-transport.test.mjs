import assert from "node:assert/strict";
import { describe, it, after } from "node:test";
import { request as httpRequest } from "node:http";

// Set dummy env vars before importing server code
process.env.WJX_APP_ID = process.env.WJX_APP_ID || "test-app-id";
process.env.WJX_APP_KEY = process.env.WJX_APP_KEY || "test-app-key";

import { createServer } from "../dist/server.js";
import {
  MAX_HTTP_BODY_BYTES,
  resolveClientIp,
  resolveWjxCredentials,
  startHttpTransport,
} from "../dist/transports/http.js";
import { credentialStore, getRequestCredentials } from "../dist/core/context.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

describe("HTTP transport", () => {
  let httpServer;
  let transport;
  let baseUrl;

  after(async () => {
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
  });

  it("starts on a random port and /health returns 200", async () => {
    const server = createServer();
    const result = await startHttpTransport(server, { port: 0, stateful: true });
    httpServer = result.httpServer;
    transport = result.transport;

    const addr = httpServer.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;

    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
  });

  it("/nonexistent returns 404", async () => {
    const res = await fetch(`${baseUrl}/nonexistent`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, "Not found");
  });

  it("rejects Content-Length over 4 MiB with 413", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "x".repeat(MAX_HTTP_BODY_BYTES + 1),
    });
    assert.equal(res.status, 413);
    const body = await res.json();
    assert.match(body.error.message, /maximum request body is 4 MiB/);
  });

  it("rejects chunked bodies over 4 MiB with 413", async () => {
    const response = await new Promise((resolve, reject) => {
      const req = httpRequest(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({
          status: res.statusCode,
          body: JSON.parse(Buffer.concat(chunks).toString("utf-8")),
        }));
      });
      req.on("error", reject);
      req.write(Buffer.alloc(MAX_HTTP_BODY_BYTES, 0x20));
      req.end(Buffer.from("x"));
    });
    assert.equal(response.status, 413);
    assert.match(response.body.error.message, /maximum request body is 4 MiB/);
  });

  it("MCP client can connect via HTTP and list tools", async () => {
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const clientTransport = new StreamableHTTPClientTransport(
      new URL(`${baseUrl}/mcp`),
    );
    await client.connect(clientTransport);

    const { tools } = await client.listTools();
    assert.ok(Array.isArray(tools), "tools should be an array");
    assert.ok(tools.length >= 50, `expected >=50 tools, got ${tools.length}`);

    await client.close();
  });
});

describe("HTTP credential and proxy boundaries", () => {
  it("does not forward MCP_AUTH_TOKEN as the WJX API key", () => {
    assert.deepEqual(
      resolveWjxCredentials(
        "mcp-gate-secret",
        { authToken: "mcp-gate-secret", wjxApiKey: "wjx-api-secret" },
        "203.0.113.10",
      ),
      { apiKey: "wjx-api-secret", clientIp: "203.0.113.10" },
    );
    assert.equal(
      resolveWjxCredentials("mcp-gate-secret", { authToken: "mcp-gate-secret" }),
      undefined,
    );
  });

  it("keeps request-scoped Bearer credentials when no MCP gate is configured", () => {
    assert.deepEqual(
      resolveWjxCredentials("tenant-wjx-key", {}, "203.0.113.11"),
      { apiKey: "tenant-wjx-key", clientIp: "203.0.113.11" },
    );
  });

  it("does not trust forwarding headers from a direct client", () => {
    assert.equal(
      resolveClientIp("198.51.100.20", "203.0.113.99", "203.0.113.98", []),
      "198.51.100.20",
    );
  });

  it("walks a trusted proxy chain from right to left", () => {
    assert.equal(
      resolveClientIp(
        "::ffff:10.0.0.2",
        "192.0.2.9, 198.51.100.21, 10.0.0.1",
        undefined,
        ["10.0.0.1", "10.0.0.2"],
      ),
      "198.51.100.21",
    );
  });

  it("isolates concurrent request credentials", async () => {
    const seen = await Promise.all([
      credentialStore.run({ apiKey: "tenant-a" }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return getRequestCredentials()?.apiKey;
      }),
      credentialStore.run({ apiKey: "tenant-b" }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return getRequestCredentials()?.apiKey;
      }),
    ]);
    assert.deepEqual(seen, ["tenant-a", "tenant-b"]);
    assert.equal(getRequestCredentials(), undefined);
  });
});

describe("HTTP transport with auth", () => {
  let httpServer;
  const AUTH_TOKEN = "test-secret-token-42";

  after(async () => {
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
  });

  it("allows /health without token even when auth is configured", async () => {
    const server = createServer();
    const result = await startHttpTransport(server, {
      port: 0,
      authToken: AUTH_TOKEN,
    });
    httpServer = result.httpServer;

    const addr = httpServer.address();
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
  });

  it("rejects /mcp without token (401)", async () => {
    const addr = httpServer.address();
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const res = await fetch(`${baseUrl}/mcp`, { method: "POST" });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, "Unauthorized");
  });

  it("rejects requests with wrong token (401)", async () => {
    const addr = httpServer.address();
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { Authorization: "Bearer wrong-token" },
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, "Unauthorized");
  });

  it("rejects a non-ASCII token with equal character length without throwing", async () => {
    const addr = httpServer.address();
    const baseUrl = `http://127.0.0.1:${addr.port}`;
    const wrongToken = "é".repeat(AUTH_TOKEN.length);

    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${wrongToken}` },
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, "Unauthorized");
  });

  it("accepts requests with correct token", async () => {
    const addr = httpServer.address();
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const res = await fetch(`${baseUrl}/health`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
  });
});
