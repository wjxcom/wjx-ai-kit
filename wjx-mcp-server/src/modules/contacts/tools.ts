import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { queryContacts, addContacts, manageContacts } from "./client.js";
import { toolResult, toolError } from "../../helpers.js";

export function registerContactsTools(server: McpServer): void {
  // ─── query_contacts ──────────────────────────────────────────────
  server.registerTool(
    "query_contacts",
    {
      title: "查询通讯录成员",
      description:
        "查询通讯录中的联系人成员列表，可按部门筛选并分页获取。",
      inputSchema: {
        username: z.string().min(1).describe("账户用户名"),
        dept_id: z
          .number()
          .int()
          .optional()
          .describe("部门 ID，不传则查询全部"),
        page_index: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("页码，从1开始"),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("每页数量（1-100）"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "查询通讯录成员",
      },
    },
    async (args) => {
      try {
        const result = await queryContacts({
          username: args.username,
          dept_id: args.dept_id,
          page_index: args.page_index,
          page_size: args.page_size,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── add_contacts ────────────────────────────────────────────────
  server.registerTool(
    "add_contacts",
    {
      title: "批量添加通讯录成员",
      description:
        "批量添加通讯录联系人。members 为 JSON 数组字符串，每个成员对象包含 name、mobile、email、dept_id、ext 等字段。",
      inputSchema: {
        username: z.string().min(1).describe("账户用户名"),
        members: z
          .string()
          .min(2)
          .describe(
            "成员列表 JSON 字符串（数组），每个对象包含 name、mobile、email、dept_id、ext 等字段",
          ),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        title: "批量添加通讯录成员",
      },
    },
    async (args) => {
      try {
        const result = await addContacts({
          username: args.username,
          members: args.members,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── manage_contacts ─────────────────────────────────────────────
  server.registerTool(
    "manage_contacts",
    {
      title: "管理通讯录成员",
      description:
        "更新或删除通讯录成员。operation 为 \"update\" 或 \"delete\"。更新时 members 为包含 id 及待修改字段的对象数组 JSON；删除时 members 为成员 ID 数组 JSON。",
      inputSchema: {
        username: z.string().min(1).describe("账户用户名"),
        operation: z
          .enum(["update", "delete"])
          .describe("操作类型：update=更新, delete=删除"),
        members: z
          .string()
          .min(2)
          .describe(
            "成员数据 JSON 字符串。更新：对象数组（含 id 及待改字段）；删除：成员 ID 数组",
          ),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
        title: "管理通讯录成员",
      },
    },
    async (args) => {
      try {
        const result = await manageContacts({
          username: args.username,
          operation: args.operation,
          members: args.members,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
