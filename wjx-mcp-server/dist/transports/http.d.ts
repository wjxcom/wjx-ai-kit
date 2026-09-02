import { createServer as createHttpServer, type IncomingMessage } from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export interface HttpOptions {
    port: number;
    authToken?: string;
    stateful?: boolean;
    /** Maximum JSON request size accepted by the HTTP transport. */
    maxBodyBytes?: number;
}
export declare const DEFAULT_MAX_BODY_BYTES: number;
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
