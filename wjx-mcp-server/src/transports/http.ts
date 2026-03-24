import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { credentialStore } from "../core/context.js";
import type { WjxCredentials } from "../core/types.js";

export interface HttpOptions {
  port: number;
  authToken?: string;
  stateful?: boolean;
}

/**
 * Extract per-request WJX credentials from incoming HTTP headers.
 *
 * Supports two styles (checked in order):
 *  1. Custom headers:  X-WJX-App-Id + X-WJX-App-Key   (simplest)
 *  2. Basic auth:      Authorization: Basic base64(appid:appkey)
 *
 * Returns `undefined` when neither is present.
 */
function extractCredentials(req: IncomingMessage): WjxCredentials | undefined {
  // --- Style 1: custom headers (no encoding needed) ---
  const hdrId  = req.headers["x-wjx-app-id"];
  const hdrKey = req.headers["x-wjx-app-key"];
  if (typeof hdrId === "string" && typeof hdrKey === "string" && hdrId && hdrKey) {
    return { appId: hdrId, appKey: hdrKey };
  }

  // --- Style 2: Basic auth ---
  const auth = req.headers.authorization;
  if (auth) {
    const match = auth.match(/^Basic\s+(.+)$/i);
    if (match) {
      const decoded = Buffer.from(match[1], "base64").toString("utf-8");
      const colonIdx = decoded.indexOf(":");
      if (colonIdx !== -1) {
        const appId  = decoded.slice(0, colonIdx);
        const appKey = decoded.slice(colonIdx + 1);
        if (appId && appKey) return { appId, appKey };
      }
    }
  }

  return undefined;
}

/** Read the full request body as a string, then JSON.parse it. */
function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  credentials: WjxCredentials | undefined;
}

export async function startHttpTransport(
  _mcpServer: McpServer,
  options: HttpOptions,
  /** Factory that creates a fresh McpServer for each session. */
  serverFactory?: () => McpServer,
): Promise<{ httpServer: ReturnType<typeof createHttpServer> }> {
  const enableSessions = options.stateful !== false;

  // Session map: sessionId → { transport, server, credentials }
  const sessions = new Map<string, SessionEntry>();

  const httpServer = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    const clientCreds = extractCredentials(req);

    // ── Authentication (Bearer token, single-tenant mode) ───────────
    if (!clientCreds && options.authToken) {
      const authHeader = req.headers.authorization;
      const expected = `Bearer ${options.authToken}`;
      if (
        !authHeader ||
        authHeader.length !== expected.length ||
        !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
      ) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    // ── /mcp endpoint ───────────────────────────────────────────────
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    try {
      if (req.method === "POST") {
        // Parse body BEFORE deciding transport routing
        let body: unknown;
        try {
          body = await readBody(req);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32700, message: "Parse error: Invalid JSON" },
            id: null,
          }));
          return;
        }

        let transport: StreamableHTTPServerTransport;
        let creds: WjxCredentials | undefined;

        if (sessionId && sessions.has(sessionId)) {
          // ── Existing session ──────────────────────────────────────
          const entry = sessions.get(sessionId)!;
          transport = entry.transport;
          creds = entry.credentials;
        } else if (!sessionId && isInitializeRequest(body)) {
          // ── New session (initialize request) ──────────────────────
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: enableSessions ? () => randomUUID() : undefined,
            onsessioninitialized: (sid) => {
              sessions.set(sid, { transport, server, credentials: clientCreds });
              console.error(`[wjx-mcp-server] session ${sid} initialized (active: ${sessions.size})`);
            },
          });

          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid) {
              sessions.delete(sid);
              console.error(`[wjx-mcp-server] session ${sid} closed (active: ${sessions.size})`);
            }
          };

          const server = serverFactory ? serverFactory() : _mcpServer;
          await server.connect(transport);
          creds = clientCreds;
        } else {
          // ── No valid session, not an initialize request ────────────
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Bad Request: No valid session ID provided" },
            id: null,
          }));
          return;
        }

        // Pass pre-parsed body as third argument
        if (creds) {
          await credentialStore.run(creds, () => transport.handleRequest(req, res, body));
        } else {
          await transport.handleRequest(req, res, body);
        }
      } else if (req.method === "GET" || req.method === "DELETE") {
        // GET (SSE stream) / DELETE (session termination) — must have valid session
        if (!sessionId || !sessions.has(sessionId)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid or missing session ID" }));
          return;
        }
        const entry = sessions.get(sessionId)!;
        if (entry.credentials) {
          await credentialStore.run(entry.credentials, () => entry.transport.handleRequest(req, res));
        } else {
          await entry.transport.handleRequest(req, res);
        }
      } else {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
      }
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
  });

  return new Promise((resolve) => {
    httpServer.listen(options.port, () => {
      const addr = httpServer.address();
      const port = typeof addr === "object" && addr ? addr.port : options.port;
      console.error(`[wjx-mcp-server] HTTP transport listening on port ${port}`);
      resolve({ httpServer });
    });
  });
}
