import "./core/load-env.js"; // Must be first — populates process.env before other modules read it

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createServer } from "./server.js";

export { createServer } from "./server.js";

export async function main(): Promise<void> {

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
    const { httpServer } = await startHttpTransport(
      server,
      {
        port,
        authToken: process.env.MCP_AUTH_TOKEN,
        stateful: process.env.MCP_SESSION !== "stateless",
      },
      createServer,
    );
    const shutdown = () => {
      httpServer.close();
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    const shutdown = () => { void server.close(); };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  }
}

function isMainModule(): boolean {
  try {
    const scriptUrl = new URL(process.argv[1], "file:");
    return (
      realpathSync(fileURLToPath(scriptUrl)) ===
      realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isMainModule()) {
  void main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
