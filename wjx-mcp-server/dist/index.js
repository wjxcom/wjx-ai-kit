#!/usr/bin/env node
import "./core/load-env.js"; // Must be first — populates process.env before other modules read it
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setCredentialProvider } from "wjx-api-sdk";
import { getRequestCredentials } from "./core/context.js";
import { createServer } from "./server.js";
// Wire MCP-server's per-request credential store into the SDK
setCredentialProvider(getRequestCredentials);
export { createServer } from "./server.js";
export async function main() {
    const transportMode = process.argv.includes("--http")
        ? "http"
        : (process.env.MCP_TRANSPORT ?? "stdio");
    const server = createServer();
    if (transportMode === "http") {
        const { startHttpTransport } = await import("./transports/http.js");
        const port = Number(process.env.PORT ?? 3000);
        if (!Number.isFinite(port) || port < 0 || port > 65535) {
            throw new Error(`Invalid PORT: ${process.env.PORT}`);
        }
        const { httpServer } = await startHttpTransport(server, {
            port,
            authToken: process.env.MCP_AUTH_TOKEN,
            stateful: process.env.MCP_SESSION !== "stateless",
        }, createServer);
        const shutdown = () => {
            httpServer.close();
        };
        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);
    }
    else {
        if (!process.env.WJX_API_KEY) {
            console.error("[wjx-mcp-server] Warning: WJX_API_KEY is not set. API calls will fail until an API key is provided.");
        }
        const transport = new StdioServerTransport();
        await server.connect(transport);
        const shutdown = () => { void server.close(); };
        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);
    }
}
function isMainModule() {
    try {
        const scriptPath = realpathSync(resolve(process.argv[1]));
        const modulePath = realpathSync(fileURLToPath(import.meta.url));
        return scriptPath === modulePath;
    }
    catch {
        return false;
    }
}
if (isMainModule()) {
    void main().catch((error) => {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        console.error(message);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=index.js.map