import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createServer as createNodeServer } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { callWjxApi } from "../dist/core/api-client.js";
import { createServer } from "../dist/server.js";
import { readBody, startHttpTransport } from "../dist/transports/http.js";

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
  }, createServer);
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

test("bounded body reader handles late stream errors after Content-Length rejection", async () => {
  const req = new EventEmitter();
  req.headers = { "content-length": "64" };
  req.resume = () => setImmediate(() => req.emit("error", new Error("socket closed")));

  await assert.rejects(readBody(req, 32), /maximum size of 32 bytes/);
  await new Promise((resolve) => setImmediate(resolve));
});

test("HTTP transport treats a whitespace auth token as unset", async () => {
  const server = createServer();
  const { httpServer } = await startHttpTransport(server, {
    port: 0,
    stateful: false,
    authToken: "   ",
  }, createServer);
  try {
    const address = httpServer.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    assert.notEqual(response.status, 401);
  } finally {
    await new Promise((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
    await server.close();
  }
});

test("HTTP auth rejects same-length tokens with different UTF-8 byte lengths", async () => {
  const server = createServer();
  const { httpServer } = await startHttpTransport(server, {
    port: 0,
    authToken: "é",
  });
  try {
    const address = httpServer.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "POST",
      headers: {
        authorization: "Bearer a",
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
    await server.close();
  }
});

test("stateless HTTP transport accepts the full initialize and tools/list flow", async () => {
  const server = createServer();
  const requestServers = [];
  const serverFactory = () => {
    const requestServer = createServer();
    let closeCount = 0;
    const close = requestServer.close.bind(requestServer);
    requestServer.close = async () => {
      closeCount += 1;
      return close();
    };
    requestServers.push({ requestServer, get closeCount() { return closeCount; } });
    return requestServer;
  };
  const { httpServer } = await startHttpTransport(server, {
    port: 0,
    stateful: false,
  }, serverFactory);
  try {
    const address = httpServer.address();
    assert.ok(address && typeof address !== "string");
    const endpoint = `http://127.0.0.1:${address.port}/mcp`;
    const client = new Client({ name: "stateless-contract", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(endpoint));
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.ok(tools.length >= 50);
    await client.close();
    assert.ok(requestServers.length >= 2, "initialize and tools/list must use isolated servers");
    assert.deepEqual(
      requestServers.map(({ closeCount }) => closeCount),
      requestServers.map(() => 1),
      "every stateless request server must be closed after its response",
    );
  } finally {
    await new Promise((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
    await server.close();
  }
});

test("HTTP transport rejects non-integer ports before opening a listener", async () => {
  const server = createServer();
  await assert.rejects(
    () => startHttpTransport(server, { port: 3000.5 }),
    /port must be a safe integer/,
  );
  await assert.rejects(
    () => startHttpTransport(server, { port: 65536 }),
    /port must be a safe integer/,
  );
  await assert.rejects(
    () => startHttpTransport(server, { port: 0, stateful: false }),
    /serverFactory is required/,
  );
  await server.close();
});

test("HTTP transport rejects a port binding failure", async () => {
  const blocker = createNodeServer();
  await new Promise((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(0, resolve);
  });
  const address = blocker.address();
  assert.ok(address && typeof address !== "string");
  const server = createServer();
  try {
    await assert.rejects(
      () => startHttpTransport(server, { port: address.port }),
      /EADDRINUSE|address already in use/i,
    );
  } finally {
    await server.close();
    await new Promise((resolve, reject) => blocker.close((error) => error ? reject(error) : resolve()));
  }
});

test("stateless transport closes a server when transport connection fails", async () => {
  const server = createServer();
  let closeCount = 0;
  const serverFactory = () => {
    const requestServer = createServer();
    requestServer.connect = async () => {
      throw new Error("connect failed");
    };
    const close = requestServer.close.bind(requestServer);
    requestServer.close = async () => {
      closeCount += 1;
      return close();
    };
    return requestServer;
  };
  const { httpServer } = await startHttpTransport(server, {
    port: 0,
    stateful: false,
  }, serverFactory);
  try {
    const address = httpServer.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "cleanup-test", version: "1.0.0" },
        },
      }),
    });
    assert.equal(response.status, 500);
    assert.equal(closeCount, 1);
  } finally {
    await new Promise((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
    await server.close();
  }
});

test("HTTP transport close handle closes active stateful sessions", async () => {
  const server = createServer();
  const requestServers = [];
  const serverFactory = () => {
    const requestServer = createServer();
    let closeCount = 0;
    const close = requestServer.close.bind(requestServer);
    requestServer.close = async () => {
      closeCount += 1;
      return close();
    };
    requestServers.push({ requestServer, get closeCount() { return closeCount; } });
    return requestServer;
  };
  const handle = await startHttpTransport(server, {
    port: 0,
    stateful: true,
  }, serverFactory);
  const address = handle.httpServer.address();
  assert.ok(address && typeof address !== "string");
  const client = new Client({ name: "shutdown-test", version: "1.0.0" });
  const clientTransport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${address.port}/mcp`),
  );
  try {
    await client.connect(clientTransport);
    assert.equal(typeof handle.close, "function");
    await handle.close();
    assert.equal(requestServers.length, 1);
    assert.equal(requestServers[0].closeCount, 1);
  } finally {
    await client.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
});
