import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { createSurvey } from "./wjx-client.js";

const serverInfo = {
  name: "wjx-mcp-server",
  version: "1.0.0",
};

export function createServer(): McpServer {
  const server = new McpServer(serverInfo, {
    capabilities: {
      tools: {},
    },
  });

  server.registerTool(
    "create_survey",
    {
      title: "Create Survey",
      description: "Create a new WJX survey via OpenAPI action 1000101.",
      inputSchema: {
        title: z.string().min(1).describe("Survey title."),
        type: z.number().int().describe("WJX survey type (atype)."),
        description: z.string().min(1).describe("Survey description."),
        publish: z.boolean().optional().default(false).describe("Publish immediately."),
        questions: z
          .string()
          .min(1)
          .describe("Question list encoded as a JSON string."),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        title: "Create Survey",
      },
    },
    async (args) => {
      const result = await createSurvey({
        title: args.title,
        type: args.type,
        description: args.description,
        publish: args.publish,
        questions: args.questions,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: result.result === false,
      };
    },
  );

  return server;
}

export async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
