import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  createSurvey,
  getSurvey,
  listSurveys,
  updateSurveyStatus,
} from "./wjx-client.js";

function toolResult(data: unknown, isError: boolean) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    isError,
  };
}

function toolError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return toolResult({ result: false, errormsg: msg }, true);
}

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
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file is optional
  }
}

const serverInfo = {
  name: "wjx-mcp-server",
  version: "1.0.0",
};

export function createServer(): McpServer {
  const server = new McpServer(serverInfo, {
    capabilities: { tools: {} },
  });

  // ─── create_survey ────────────────────────────────────────────────
  server.registerTool(
    "create_survey",
    {
      title: "创建问卷",
      description:
        "通过问卷星 OpenAPI 创建新问卷。支持问卷调查(1)、测评(2)、投票(3)、考试(6)、表单(7)等类型。",
      inputSchema: {
        title: z.string().min(1).describe("问卷名称"),
        atype: z
          .number()
          .int()
          .describe("问卷类型：1=调查, 2=测评, 3=投票, 6=考试, 7=表单"),
        desc: z.string().describe("问卷描述"),
        publish: z.boolean().optional().default(false).describe("是否立即发布"),
        questions: z
          .string()
          .min(2)
          .describe("题目列表的 JSON 字符串（question[] 序列化）"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        title: "创建问卷",
      },
    },
    async (args) => {
      try {
        const result = await createSurvey({
          title: args.title,
          type: args.atype,
          description: args.desc,
          publish: args.publish,
          questions: args.questions,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── get_survey ───────────────────────────────────────────────────
  server.registerTool(
    "get_survey",
    {
      title: "获取问卷内容",
      description:
        "根据问卷编号获取问卷详情，包括题目和选项信息。",
      inputSchema: {
        vid: z.number().int().positive().describe("问卷编号"),
        get_questions: z
          .boolean()
          .optional()
          .default(true)
          .describe("是否获取题目信息"),
        get_items: z
          .boolean()
          .optional()
          .default(true)
          .describe("是否获取选项信息"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "获取问卷内容",
      },
    },
    async (args) => {
      try {
        const result = await getSurvey({
          vid: args.vid,
          get_questions: args.get_questions,
          get_items: args.get_items,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── list_surveys ─────────────────────────────────────────────────
  server.registerTool(
    "list_surveys",
    {
      title: "获取问卷列表",
      description:
        "分页获取账户下的问卷列表，可按状态、类型、名称筛选。",
      inputSchema: {
        page_index: z
          .number()
          .int()
          .positive()
          .optional()
          .default(1)
          .describe("页码，从1开始"),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(300)
          .optional()
          .default(10)
          .describe("每页数量（1-300）"),
        status: z
          .number()
          .int()
          .optional()
          .describe("问卷状态筛选"),
        atype: z
          .number()
          .int()
          .optional()
          .describe("问卷类型筛选：1=调查, 2=测评, 3=投票, 6=考试, 7=表单"),
        name_like: z
          .string()
          .max(10)
          .optional()
          .describe("按名称模糊搜索（最长10字符）"),
        sort: z
          .number()
          .int()
          .min(0)
          .max(5)
          .optional()
          .describe("排序：0=ID升序, 1=ID降序, 2=开始时间升序, 3=开始时间降序, 4=创建时间升序, 5=创建时间降序"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "获取问卷列表",
      },
    },
    async (args) => {
      try {
        const result = await listSurveys({
          page_index: args.page_index,
          page_size: args.page_size,
          status: args.status,
          atype: args.atype,
          name_like: args.name_like,
          sort: args.sort,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── update_survey_status ─────────────────────────────────────────
  server.registerTool(
    "update_survey_status",
    {
      title: "修改问卷状态",
      description:
        "修改问卷的发布状态：发布(1)、暂停(2)、删除(3)。",
      inputSchema: {
        vid: z.number().int().positive().describe("问卷编号"),
        state: z
          .number()
          .int()
          .min(1)
          .max(3)
          .describe("目标状态：1=发布, 2=暂停, 3=删除"),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
        title: "修改问卷状态",
      },
    },
    async (args) => {
      try {
        const result = await updateSurveyStatus({ vid: args.vid, state: args.state });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  return server;
}

export async function main(): Promise<void> {
  loadEnvFile();
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  void main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
