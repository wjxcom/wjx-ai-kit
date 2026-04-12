import { createServer as createHttpServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { credentialStore } from "../core/context.js";
/**
 * Extract Bearer token from Authorization header.
 * Returns the raw token string, or `undefined` when not present.
 */
function extractBearerToken(req) {
    const auth = req.headers.authorization;
    if (!auth)
        return undefined;
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : undefined;
}
/**
 * Extract the client IP from the incoming request.
 * Respects reverse-proxy headers: X-Forwarded-For, X-Real-Ip, then socket.remoteAddress.
 */
function getClientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
        const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim();
        if (first)
            return first;
    }
    const realIp = req.headers["x-real-ip"];
    if (realIp) {
        return Array.isArray(realIp) ? realIp[0] : realIp;
    }
    return req.socket.remoteAddress;
}
/** Read the full request body as a string, then JSON.parse it. */
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
            }
            catch (e) {
                reject(e);
            }
        });
        req.on("error", reject);
    });
}
export async function startHttpTransport(_mcpServer, options, 
/** Factory that creates a fresh McpServer for each session. */
serverFactory) {
    const enableSessions = options.stateful !== false;
    // Session map: sessionId → { transport, server, credentials }
    const sessions = new Map();
    const httpServer = createHttpServer(async (req, res) => {
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
            if (!bearerToken ||
                bearerToken.length !== expected.length ||
                !timingSafeEqual(Buffer.from(bearerToken), Buffer.from(expected))) {
                res.writeHead(401, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Unauthorized" }));
                return;
            }
        }
        // Build per-request WjxCredentials from Bearer token + client IP
        const clientIp = getClientIp(req);
        const clientCreds = bearerToken
            ? { apiKey: bearerToken, ...(clientIp ? { clientIp } : {}) }
            : undefined;
        if (url.pathname !== "/mcp") {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Not found" }));
            return;
        }
        // ── /mcp endpoint ───────────────────────────────────────────────
        const sessionId = req.headers["mcp-session-id"];
        try {
            if (req.method === "POST") {
                // Parse body BEFORE deciding transport routing
                let body;
                try {
                    body = await readBody(req);
                }
                catch {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        jsonrpc: "2.0",
                        error: { code: -32700, message: "Parse error: Invalid JSON" },
                        id: null,
                    }));
                    return;
                }
                let transport;
                let creds;
                if (sessionId && sessions.has(sessionId)) {
                    // ── Existing session ──────────────────────────────────────
                    const entry = sessions.get(sessionId);
                    transport = entry.transport;
                    creds = entry.credentials;
                }
                else if (!sessionId && isInitializeRequest(body)) {
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
                }
                else {
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
                }
                else {
                    await transport.handleRequest(req, res, body);
                }
            }
            else if (req.method === "GET" || req.method === "DELETE") {
                // GET (SSE stream) / DELETE (session termination) — must have valid session
                if (!sessionId || !sessions.has(sessionId)) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "Invalid or missing session ID" }));
                    return;
                }
                const entry = sessions.get(sessionId);
                if (entry.credentials) {
                    await credentialStore.run(entry.credentials, () => entry.transport.handleRequest(req, res));
                }
                else {
                    await entry.transport.handleRequest(req, res);
                }
            }
            else {
                res.writeHead(405, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Method not allowed" }));
            }
        }
        catch (error) {
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
//# sourceMappingURL=http.js.map