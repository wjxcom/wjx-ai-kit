import { readFileSync, realpathSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createServer } from "./server.js";

function loadEnvFile(): void {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(__dirname, "..", ".env");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Strip inline comments (unquoted values only)
      if (value[0] !== '"' && value[0] !== "'") {
        const commentIdx = value.indexOf(" #");
        if (commentIdx !== -1) value = value.slice(0, commentIdx).trimEnd();
      }
      // Strip surrounding quotes (single or double)
      if (
        value.length >= 2 &&
        ((value[0] === '"' && value[value.length - 1] === '"') ||
          (value[0] === "'" && value[value.length - 1] === "'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file is optional
  }
}

export { createServer } from "./server.js";

export async function main(): Promise<void> {
  loadEnvFile();

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
    });
    const shutdown = () => {
      httpServer.close();
      void server.close();
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
