import { createServer as createHttpServer, type IncomingMessage } from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WjxCredentials } from "../core/types.js";
export interface HttpOptions {
    port: number;
    authToken?: string;
    stateful?: boolean;
    /** Maximum JSON request size accepted by the HTTP transport. */
    maxBodyBytes?: number;
    /** Upstream WJX API key for single-tenant HTTP deployments. */
    upstreamApiKey?: string;
    /**
     * Allow the transport Bearer token to double as the WJX API key.
     * Leave unset to retain the legacy single-tenant fallback while keeping
     * tenant mode strict; set explicitly for deterministic deployments/tests.
     */
    legacyBearerApiKey?: boolean;
}
export declare const DEFAULT_MAX_BODY_BYTES: number;
export declare function resolveHttpCredentials(input: {
    bearerToken?: string;
    /** Request-scoped WJX key, supplied separately from transport auth. */
    requestApiKey?: string;
    tenantMode: boolean;
    upstreamApiKey?: string;
    legacyBearerApiKey?: boolean;
    clientIp?: string;
}): WjxCredentials | undefined;
/** Read a bounded request body as a string, then JSON.parse it. */
export declare function readBody(req: IncomingMessage, maxBytes: number): Promise<unknown>;
export interface HttpTransportHandle {
    httpServer: ReturnType<typeof createHttpServer>;
    /** Close active MCP sessions and then stop accepting HTTP connections. */
    close: () => Promise<void>;
}
export declare function startHttpTransport(_mcpServer: McpServer, options: HttpOptions, 
/** Factory that creates a fresh McpServer for each session. */
serverFactory?: () => McpServer): Promise<HttpTransportHandle>;
