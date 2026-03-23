import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  addSubAccount,
  modifySubAccount,
  deleteSubAccount,
  restoreSubAccount,
  querySubAccounts,
} from "./client.js";
import { toolResult, toolError } from "../../helpers.js";

export function registerMultiUserTools(server: McpServer): void {
  // ─── add_sub_account ──────────────────────────────────────────────
  server.registerTool(
    "add_sub_account",
    {
      title: "创建子账号",
      description:
        "在主账户下创建子账号。可指定角色：1=系统管理员, 2=问卷管理员, 3=统计结果查看员, 4=完整结果查看员。",
      inputSchema: {
        username: z.string().min(1).describe("主账户用户名"),
        subuser: z.string().min(1).describe("子账号用户名"),
        password: z.string().min(1).describe("子账号密码"),
        mobile: z.string().optional().describe("手机号"),
        email: z.string().optional().describe("邮箱"),
        role_id: z
          .number()
          .int()
          .min(1)
          .max(4)
          .optional()
          .describe("角色：1=系统管理员, 2=问卷管理员, 3=统计结果查看员, 4=完整结果查看员"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        title: "创建子账号",
      },
    },
    async (args) => {
      try {
        const result = await addSubAccount({
          username: args.username,
          subuser: args.subuser,
          password: args.password,
          mobile: args.mobile,
          email: args.email,
          role_id: args.role_id,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── modify_sub_account ───────────────────────────────────────────
  server.registerTool(
    "modify_sub_account",
    {
      title: "修改子账号",
      description:
        "修改子账号的信息，包括密码、手机号、邮箱、角色等。",
      inputSchema: {
        username: z.string().min(1).describe("主账户用户名"),
        subuser: z.string().min(1).describe("子账号用户名"),
        password: z.string().optional().describe("新密码"),
        mobile: z.string().optional().describe("手机号"),
        email: z.string().optional().describe("邮箱"),
        role_id: z
          .number()
          .int()
          .min(1)
          .max(4)
          .optional()
          .describe("角色：1=系统管理员, 2=问卷管理员, 3=统计结果查看员, 4=完整结果查看员"),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
        title: "修改子账号",
      },
    },
    async (args) => {
      try {
        const result = await modifySubAccount({
          username: args.username,
          subuser: args.subuser,
          password: args.password,
          mobile: args.mobile,
          email: args.email,
          role_id: args.role_id,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── delete_sub_account ───────────────────────────────────────────
  server.registerTool(
    "delete_sub_account",
    {
      title: "删除子账号",
      description:
        "删除子账号（可通过 restore_sub_account 恢复）。请谨慎使用。",
      inputSchema: {
        username: z.string().min(1).describe("主账户用户名"),
        subuser: z.string().min(1).describe("子账号用户名"),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
        title: "删除子账号",
      },
    },
    async (args) => {
      try {
        const result = await deleteSubAccount({
          username: args.username,
          subuser: args.subuser,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── restore_sub_account ──────────────────────────────────────────
  server.registerTool(
    "restore_sub_account",
    {
      title: "恢复子账号",
      description:
        "恢复已删除的子账号。",
      inputSchema: {
        username: z.string().min(1).describe("主账户用户名"),
        subuser: z.string().min(1).describe("子账号用户名"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "恢复子账号",
      },
    },
    async (args) => {
      try {
        const result = await restoreSubAccount({
          username: args.username,
          subuser: args.subuser,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── query_sub_accounts ───────────────────────────────────────────
  server.registerTool(
    "query_sub_accounts",
    {
      title: "查询子账号列表",
      description:
        "查询主账户下的子账号列表，支持分页。",
      inputSchema: {
        username: z.string().min(1).describe("主账户用户名"),
        page_index: z.number().int().positive().optional().describe("页码，从1开始"),
        page_size: z.number().int().min(1).max(100).optional().describe("每页数量（1-100）"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "查询子账号列表",
      },
    },
    async (args) => {
      try {
        const result = await querySubAccounts({
          username: args.username,
          page_index: args.page_index,
          page_size: args.page_size,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
