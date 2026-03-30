import assert from "node:assert/strict";
import { describe, it, after } from "node:test";

// Set dummy env vars before importing server code
process.env.WJX_APP_ID = process.env.WJX_APP_ID || "test-app-id";
process.env.WJX_APP_KEY = process.env.WJX_APP_KEY || "test-app-key";

import { createServer } from "../dist/server.js";
import { startHttpTransport } from "../dist/transports/http.js";
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
