import { createServer as createHttpServer } from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export interface HttpOptions {
    port: number;
    authToken?: string;
    stateful?: boolean;
    /** Maximum JSON request size accepted by the HTTP transport. */
    maxBodyBytes?: number;
}
export declare const DEFAULT_MAX_BODY_BYTES: number;
export declare function startHttpTransport(_mcpServer: McpServer, options: HttpOptions, 
/** Factory that creates a fresh McpServer for each session. */
serverFactory?: () => McpServer): Promise<{
    httpServer: ReturnType<typeof createHttpServer>;
}>;
