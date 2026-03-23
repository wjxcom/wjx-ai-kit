import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface HttpOptions {
  port: number;
  authToken?: string;
  stateful?: boolean;
}

export async function startHttpTransport(
  mcpServer: McpServer,
  options: HttpOptions,
): Promise<{ httpServer: ReturnType<typeof createHttpServer>; transport: StreamableHTTPServerTransport }> {
  const enableSessions = options.stateful !== false;
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: enableSessions ? () => randomUUID() : undefined,
  });

  const httpServer = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Bearer token auth (timing-safe comparison to prevent timing attacks)
    if (options.authToken) {
      const auth = req.headers.authorization;
      const expected = `Bearer ${options.authToken}`;
      if (!auth || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (url.pathname === "/mcp") {
      try {
        await transport.handleRequest(req, res);
      } catch (error) {
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  await mcpServer.connect(transport);

  return new Promise((resolve) => {
    httpServer.listen(options.port, () => {
      const addr = httpServer.address();
      const port = typeof addr === "object" && addr ? addr.port : options.port;
      console.error(`[wjx-mcp-server] HTTP transport listening on port ${port}`);
      resolve({ httpServer, transport });
    });
  });
}
