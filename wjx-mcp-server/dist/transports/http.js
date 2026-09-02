import { createServer as createHttpServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { credentialStore } from "../core/context.js";
export const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024;
class RequestBodyTooLargeError extends Error {
    maxBytes;
    constructor(maxBytes) {
        super(`Request body exceeds maximum size of ${maxBytes} bytes`);
        this.maxBytes = maxBytes;
        this.name = "RequestBodyTooLargeError";
    }
}
/**
 * Extract Bearer token from Authorization header.
 * Returns the raw token string, or `undefined` when not present.
 */
function extractBearerToken(req) {
    const auth = req.headers.authorization;
    if (!auth)
        return undefined;
    const match = auth.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim();
    return token || undefined;
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
/** Read a bounded request body as a string, then JSON.parse it. */
export function readBody(req, maxBytes) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let totalBytes = 0;
        let settled = false;
        const fail = (error) => {
            if (settled)
                return;
            settled = true;
            // Continue consuming the request without retaining data so an oversized
            // client cannot leave the connection in a half-read state.
            req.resume();
            reject(error);
        };
        // Register the stream error handler before the Content-Length fast path.
        // An oversized request is resumed and can still emit a late socket error.
        req.on("error", fail);
        const contentLengthHeader = req.headers["content-length"];
        const contentLength = Array.isArray(contentLengthHeader)
            ? Number(contentLengthHeader[0])
            : Number(contentLengthHeader);
        if (Number.isFinite(contentLength) && contentLength > maxBytes) {
            fail(new RequestBodyTooLargeError(maxBytes));
            return;
        }
        req.on("data", (chunk) => {
            if (settled)
                return;
            totalBytes += chunk.byteLength;
            if (totalBytes > maxBytes) {
                fail(new RequestBodyTooLargeError(maxBytes));
                return;
            }
            chunks.push(Buffer.from(chunk));
        });
        req.on("end", () => {
            if (settled)
                return;
            settled = true;
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
            }
            catch (e) {
                reject(e);
            }
        });
    });
}
export async function startHttpTransport(_mcpServer, options, 
/** Factory that creates a fresh McpServer for each session. */
serverFactory) {
    const enableSessions = options.stateful !== false;
    const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
    const authToken = typeof options.authToken === "string" && options.authToken.trim()
        ? options.authToken.trim()
        : undefined;
    if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1) {
        throw new RangeError("maxBodyBytes must be a positive safe integer");
    }
    if (!Number.isSafeInteger(options.port) || options.port < 0 || options.port > 65535) {
        throw new RangeError("port must be a safe integer between 0 and 65535");
    }
    if (!enableSessions && !serverFactory) {
        throw new TypeError("serverFactory is required when stateful is false");
    }
    // Session map: sessionId → { transport, server, credentials }
    const sessions = new Map();
    let closing = false;
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
        if (authToken) {
            // Single-tenant gate: verify the incoming token matches MCP_AUTH_TOKEN
            const expected = authToken;
            const providedBytes = bearerToken ? Buffer.from(bearerToken) : undefined;
            const expectedBytes = Buffer.from(expected);
            if (!providedBytes ||
                providedBytes.length !== expectedBytes.length ||
                !timingSafeEqual(providedBytes, expectedBytes)) {
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
                    body = await readBody(req, maxBodyBytes);
                }
                catch (error) {
                    if (error instanceof RequestBodyTooLargeError) {
                        res.writeHead(413, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({
                            jsonrpc: "2.0",
                            error: { code: -32600, message: error.message },
                            id: null,
                        }));
                    }
                    else {
                        res.writeHead(400, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({
                            jsonrpc: "2.0",
                            error: { code: -32700, message: "Parse error: Invalid JSON" },
                            id: null,
                        }));
                    }
                    return;
                }
                let transport;
                let creds;
                let requestServer;
                const createRequestTransport = async () => {
                    // Stateless mode must create an isolated Protocol/McpServer pair for
                    // every request because the MCP Protocol can only own one transport.
                    // The production entry point supplies serverFactory for this mode;
                    // retain the injected server as a useful single-request fallback for
                    // embedded callers.
                    const server = serverFactory ? serverFactory() : _mcpServer;
                    let requestTransport;
                    requestTransport = new StreamableHTTPServerTransport({
                        sessionIdGenerator: enableSessions ? () => randomUUID() : undefined,
                        onsessioninitialized: (sid) => {
                            if (closing) {
                                void Promise.allSettled([requestTransport.close(), server.close()]);
                                return;
                            }
                            sessions.set(sid, { transport: requestTransport, server, credentials: clientCreds });
                            console.error(`[wjx-mcp-server] session ${sid} initialized (active: ${sessions.size})`);
                        },
                    });
                    requestTransport.onclose = () => {
                        const sid = requestTransport.sessionId;
                        if (sid) {
                            sessions.delete(sid);
                            console.error(`[wjx-mcp-server] session ${sid} closed (active: ${sessions.size})`);
                        }
                    };
                    try {
                        await server.connect(requestTransport);
                    }
                    catch (error) {
                        await Promise.allSettled([
                            requestTransport.close(),
                            server.close(),
                        ]);
                        throw error;
                    }
                    return { transport: requestTransport, server };
                };
                if (sessionId && sessions.has(sessionId)) {
                    // ── Existing session ──────────────────────────────────────
                    const entry = sessions.get(sessionId);
                    transport = entry.transport;
                    creds = entry.credentials;
                }
                else if (!sessionId && (isInitializeRequest(body) || !enableSessions)) {
                    // ── New session or stateless request ──────────────────────
                    const created = await createRequestTransport();
                    transport = created.transport;
                    requestServer = created.server;
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
                let cleanupStateless;
                if (!enableSessions) {
                    // A stateless transport/server is intentionally created per request.
                    // Close both once the response is flushed so repeated HTTP calls do
                    // not retain protocol listeners or in-memory tool state.
                    let cleanedUp = false;
                    cleanupStateless = () => {
                        if (cleanedUp)
                            return;
                        cleanedUp = true;
                        void transport.close().catch(() => undefined);
                        void requestServer.close().catch(() => undefined);
                    };
                    res.once("finish", cleanupStateless);
                    res.once("close", cleanupStateless);
                }
                try {
                    if (creds) {
                        await credentialStore.run(creds, () => transport.handleRequest(req, res, body));
                    }
                    else {
                        await transport.handleRequest(req, res, body);
                    }
                }
                finally {
                    // A handler can finish synchronously before the response events are
                    // delivered; do not leave a completed stateless request open.
                    if (res.writableEnded)
                        cleanupStateless?.();
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
    await new Promise((resolve, reject) => {
        const handleListenError = (error) => {
            httpServer.off("error", handleListenError);
            reject(error);
        };
        httpServer.once("error", handleListenError);
        httpServer.listen(options.port, () => {
            httpServer.off("error", handleListenError);
            const addr = httpServer.address();
            const port = typeof addr === "object" && addr ? addr.port : options.port;
            console.error(`[wjx-mcp-server] HTTP transport listening on port ${port}`);
            resolve();
        });
    });
    let closePromise;
    const close = () => {
        if (closePromise)
            return closePromise;
        closing = true;
        closePromise = (async () => {
            let listenerClosed;
            if (httpServer.listening) {
                listenerClosed = new Promise((resolve, reject) => {
                    httpServer.close((error) => error ? reject(error) : resolve());
                });
            }
            const activeSessions = [...sessions.entries()];
            await Promise.allSettled(activeSessions.map(async ([sessionId, entry]) => {
                sessions.delete(sessionId);
                await Promise.allSettled([
                    entry.transport.close(),
                    entry.server.close(),
                ]);
            }));
            await listenerClosed;
        })();
        return closePromise;
    };
    return { httpServer, close };
}
//# sourceMappingURL=http.js.map