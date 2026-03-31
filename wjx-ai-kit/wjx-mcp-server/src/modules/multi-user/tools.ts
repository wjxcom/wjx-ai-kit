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
        subuser: z.string().min(1).describe("子账号用户名"),
        password: z.string().optional().describe("子账号密码"),
        mobile: z.string().optional().describe("手机号"),
        email: z.string().optional().describe("邮箱"),
        role: z
          .number()
          .int()
          .min(1)
          .max(4)
          .optional()
          .describe("角色：1=系统管理员, 2=问卷管理员, 3=统计结果查看员, 4=完整结果查看员"),
        group: z.number().int().optional().describe("分组 ID"),
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
          subuser: args.subuser,
          password: args.password,
          mobile: args.mobile,
          email: args.email,
          role: args.role,
          group: args.group,
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
        "修改子账号的信息，包括手机号、邮箱、角色、分组等。不支持修改密码。",
      inputSchema: {
        subuser: z.string().min(1).describe("子账号用户名"),
        mobile: z.string().optional().describe("手机号"),
        email: z.string().optional().describe("邮箱"),
        role: z
          .number()
          .int()
          .min(1)
          .max(4)
          .optional()
          .describe("角色：1=系统管理员, 2=问卷管理员, 3=统计结果查看员, 4=完整结果查看员"),
        group: z.number().int().optional().describe("分组 ID"),
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
          subuser: args.subuser,
          mobile: args.mobile,
          email: args.email,
          role: args.role,
          group: args.group,
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
        "恢复已删除的子账号。可同时更新手机号和邮箱。",
      inputSchema: {
        subuser: z.string().min(1).describe("子账号用户名"),
        mobile: z.string().optional().describe("手机号"),
        email: z.string().optional().describe("邮箱"),
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
          subuser: args.subuser,
          mobile: args.mobile,
          email: args.email,
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
        "查询主账户下的子账号列表，支持按用户名、名称模糊搜索、角色、分组、状态筛选。",
      inputSchema: {
        subuser: z.string().optional().describe("精确匹配子账号用户名"),
        name_like: z.string().optional().describe("按名称模糊搜索（最长10字符）"),
        role: z.number().int().optional().describe("按角色筛选"),
        group: z.number().int().optional().describe("按分组筛选"),
        status: z.boolean().optional().describe("按状态筛选"),
        mobile: z.string().optional().describe("按手机号筛选"),
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
          subuser: args.subuser,
          name_like: args.name_like,
          role: args.role,
          group: args.group,
          status: args.status,
          mobile: args.mobile,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
