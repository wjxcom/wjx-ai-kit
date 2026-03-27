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
 * Extract Bearer token from Authorization header.
 * Returns the raw token string, or `undefined` when not present.
 */
function extractBearerToken(req: IncomingMessage): string | undefined {
  const auth = req.headers.authorization;
  if (!auth) return undefined;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : undefined;
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
    const bearerToken = extractBearerToken(req);

    // ── Authentication ───────────────────────────────────────────────
    if (options.authToken) {
      // Single-tenant gate: verify the incoming token matches MCP_AUTH_TOKEN
      const expected = options.authToken;
      if (
        !bearerToken ||
        bearerToken.length !== expected.length ||
        !timingSafeEqual(Buffer.from(bearerToken), Buffer.from(expected))
      ) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
    }

    // Build per-request WjxCredentials from Bearer token
    const clientCreds: WjxCredentials | undefined = bearerToken
      ? { token: bearerToken }
      : undefined;

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
