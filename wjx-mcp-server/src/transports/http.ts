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
  /** Maximum JSON request size accepted by the HTTP transport. */
  maxBodyBytes?: number;
}

export const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024;

class RequestBodyTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Request body exceeds maximum size of ${maxBytes} bytes`);
    this.name = "RequestBodyTooLargeError";
  }
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

/**
 * Extract the client IP from the incoming request.
 * Respects reverse-proxy headers: X-Forwarded-For, X-Real-Ip, then socket.remoteAddress.
 */
function getClientIp(req: IncomingMessage): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim();
    if (first) return first;
  }
  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }
  return req.socket.remoteAddress;
}

/** Read a bounded request body as a string, then JSON.parse it. */
function readBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      // Continue consuming the request without retaining data so an oversized
      // client cannot leave the connection in a half-read state.
      req.resume();
      reject(error);
    };

    const contentLengthHeader = req.headers["content-length"];
    const contentLength = Array.isArray(contentLengthHeader)
      ? Number(contentLengthHeader[0])
      : Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      fail(new RequestBodyTooLargeError(maxBytes));
      return;
    }

    req.on("data", (chunk: Buffer) => {
      if (settled) return;
      totalBytes += chunk.byteLength;
      if (totalBytes > maxBytes) {
        fail(new RequestBodyTooLargeError(maxBytes));
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", fail);
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
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1) {
    throw new RangeError("maxBodyBytes must be a positive safe integer");
  }

  // Session map: sessionId → { transport, server, credentials }
  const sessions = new Map<string, SessionEntry>();

  const httpServer = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    // ── Health check (before auth — must work for Docker/k8s probes) ──
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

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

    // Build per-request WjxCredentials from Bearer token + client IP
    const clientIp = getClientIp(req);
    const clientCreds: WjxCredentials | undefined = bearerToken
      ? { apiKey: bearerToken, ...(clientIp ? { clientIp } : {}) }
      : undefined;

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
          body = await readBody(req, maxBodyBytes);
        } catch (error) {
          if (error instanceof RequestBodyTooLargeError) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: error.message }));
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32700, message: "Parse error: Invalid JSON" },
              id: null,
            }));
          }
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
