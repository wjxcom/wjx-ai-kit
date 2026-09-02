import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
/** Mask API keys without exposing short credentials in diagnostics. */
export declare function maskApiKeyForDisplay(apiKey: string): string;
export declare function createServer(): McpServer;
