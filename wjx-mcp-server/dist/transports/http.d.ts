import { createServer as createHttpServer } from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export interface HttpOptions {
    port: number;
    authToken?: string;
    stateful?: boolean;
}
export declare function startHttpTransport(_mcpServer: McpServer, options: HttpOptions, 
/** Factory that creates a fresh McpServer for each session. */
serverFactory?: () => McpServer): Promise<{
    httpServer: ReturnType<typeof createHttpServer>;
}>;
