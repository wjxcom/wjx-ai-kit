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
  /** Fixed downstream WJX key used when MCP_AUTH_TOKEN protects the endpoint. */
  wjxApiKey?: string;
  /** Exact proxy IPs allowed to supply X-Forwarded-For/X-Real-Ip. */
  trustedProxies?: readonly string[];
  stateful?: boolean;
}

export const MAX_HTTP_BODY_BYTES = 4 * 1024 * 1024;

export class PayloadTooLargeError extends Error {
  constructor() {
    super(`MCP request body exceeds ${MAX_HTTP_BODY_BYTES} bytes`);
    this.name = "PayloadTooLargeError";
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

function normalizeIp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.startsWith("::ffff:")) normalized = normalized.slice(7);
  const scopeIndex = normalized.indexOf("%");
  if (scopeIndex >= 0) normalized = normalized.slice(0, scopeIndex);
  return normalized || undefined;
}

function headerValues(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const joined = Array.isArray(value) ? value.join(",") : value;
  return joined.split(",").map((item) => normalizeIp(item)).filter((item): item is string => Boolean(item));
}

/** Resolve the client IP without trusting forwarding headers from direct clients. */
export function resolveClientIp(
  remoteAddress: string | undefined,
  forwarded: string | string[] | undefined,
  realIp: string | string[] | undefined,
  trustedProxies: readonly string[] = [],
): string | undefined {
  const remote = normalizeIp(remoteAddress);
  if (!remote) return undefined;

  const trusted = new Set(trustedProxies.map((item) => normalizeIp(item)).filter((item): item is string => Boolean(item)));
  if (!trusted.has(remote)) return remote;

  const chain = [...headerValues(forwarded), remote];
  if (chain.length > 1) {
    let index = chain.length - 1;
    while (index >= 0 && trusted.has(chain[index])) index--;
    if (index >= 0) return chain[index];
  }

  const realValues = headerValues(realIp);
  return realValues.length > 0 ? realValues[0] : remote;
}

function getClientIp(req: IncomingMessage, trustedProxies: readonly string[]): string | undefined {
  return resolveClientIp(
    req.socket.remoteAddress,
    req.headers["x-forwarded-for"],
    req.headers["x-real-ip"],
    trustedProxies,
  );
}

/** Keep the MCP gate secret separate from the downstream WJX API key. */
export function resolveWjxCredentials(
  bearerToken: string | undefined,
  options: Pick<HttpOptions, "authToken" | "wjxApiKey">,
  clientIp?: string,
): WjxCredentials | undefined {
  const apiKey = options.authToken ? options.wjxApiKey : bearerToken ?? options.wjxApiKey;
  if (!apiKey) return undefined;
  return { apiKey, ...(clientIp ? { clientIp } : {}) };
}

/** Read the full request body as a string, then JSON.parse it. */
function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const contentLength = req.headers["content-length"];
    if (typeof contentLength === "string" && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_HTTP_BODY_BYTES) {
      req.resume();
      reject(new PayloadTooLargeError());
      return;
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let rejected = false;
    req.on("data", (chunk: Buffer | string) => {
      if (rejected) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > MAX_HTTP_BODY_BYTES) {
        rejected = true;
        chunks.length = 0;
        reject(new PayloadTooLargeError());
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => {
      if (rejected) return;
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
      const expected = Buffer.from(options.authToken);
      const actual = bearerToken ? Buffer.from(bearerToken) : undefined;
      if (
        !actual ||
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      ) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
    }

    // MCP_AUTH_TOKEN is only the gateway credential. Downstream calls use
    // WJX_API_KEY in that mode; without a gateway token, Bearer remains the
    // request-scoped WJX key for backward-compatible multi-tenant operation.
    const clientIp = getClientIp(req, options.trustedProxies ?? []);
    const clientCreds = resolveWjxCredentials(bearerToken, options, clientIp);

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
        } catch (error) {
          const tooLarge = error instanceof PayloadTooLargeError;
          res.writeHead(tooLarge ? 413 : 400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            jsonrpc: "2.0",
            error: tooLarge
              ? { code: -32001, message: "Payload Too Large: maximum request body is 4 MiB" }
              : { code: -32700, message: "Parse error: Invalid JSON" },
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
