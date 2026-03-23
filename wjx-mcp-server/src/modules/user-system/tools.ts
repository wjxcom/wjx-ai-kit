import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  addParticipants,
  modifyParticipants,
  deleteParticipants,
  querySurveyBinding,
  queryUserSurveys,
} from "./client.js";
import { toolResult, toolError } from "../../helpers.js";

export function registerUserSystemTools(server: McpServer): void {
  // ─── add_participants ─────────────────────────────────────────────
  server.registerTool(
    "add_participants",
    {
      title: "批量添加参与者",
      description:
        "向用户系统批量添加参与者（每次最多100人）。users 为 JSON 数组字符串，每个对象包含 uid、uname、upass、udept、uextf 字段。",
      inputSchema: {
        username: z.string().min(1).describe("主账户用户名"),
        users: z
          .string()
          .min(2)
          .refine(
            (s) => { try { return Array.isArray(JSON.parse(s)); } catch { return false; } },
            "users 必须是合法的 JSON 数组",
          )
          .describe(
            "参与者列表 JSON 字符串（数组），每项包含: uid(用户ID), uname(姓名), upass(密码), udept(部门), uextf(扩展字段)",
          ),
        usid: z.number().int().positive().describe("用户系统 ID"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        title: "批量添加参与者",
      },
    },
    async (args) => {
      try {
        const result = await addParticipants({
          username: args.username,
          users: args.users,
          usid: args.usid,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── modify_participants ──────────────────────────────────────────
  server.registerTool(
    "modify_participants",
    {
      title: "批量修改参与者",
      description:
        "批量修改用户系统中参与者的信息。users 为 JSON 数组字符串，每个对象包含 uid、uname、upass、udept、uextf 字段。",
      inputSchema: {
        username: z.string().min(1).describe("主账户用户名"),
        users: z
          .string()
          .min(2)
          .refine(
            (s) => { try { return Array.isArray(JSON.parse(s)); } catch { return false; } },
            "users 必须是合法的 JSON 数组",
          )
          .describe(
            "参与者列表 JSON 字符串（数组），每项包含: uid(用户ID), uname(姓名), upass(密码), udept(部门), uextf(扩展字段)",
          ),
        usid: z.number().int().positive().describe("用户系统 ID"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "批量修改参与者",
      },
    },
    async (args) => {
      try {
        const result = await modifyParticipants({
          username: args.username,
          users: args.users,
          usid: args.usid,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── delete_participants ──────────────────────────────────────────
  server.registerTool(
    "delete_participants",
    {
      title: "批量删除参与者",
      description:
        "从用户系统中批量删除参与者。此操作不可逆，请谨慎使用！uids 为逗号分隔的用户 ID 列表。",
      inputSchema: {
        username: z.string().min(1).describe("主账户用户名"),
        uids: z.string().min(1).describe("参与者 ID 列表，逗号分隔"),
        usid: z.number().int().positive().describe("用户系统 ID"),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
        title: "批量删除参与者",
      },
    },
    async (args) => {
      try {
        const result = await deleteParticipants({
          username: args.username,
          uids: args.uids,
          usid: args.usid,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── query_survey_binding ─────────────────────────────────────────
  server.registerTool(
    "query_survey_binding",
    {
      title: "查询问卷用户绑定",
      description:
        "查询问卷与用户系统的绑定关系，返回绑定的参与者列表，支持分页。",
      inputSchema: {
        username: z.string().min(1).describe("主账户用户名"),
        vid: z.number().int().positive().describe("问卷编号"),
        usid: z.number().int().positive().describe("用户系统 ID"),
        page_index: z.number().int().positive().optional().describe("页码，从1开始"),
        page_size: z.number().int().min(1).max(100).optional().describe("每页数量（1-100）"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "查询问卷用户绑定",
      },
    },
    async (args) => {
      try {
        const result = await querySurveyBinding({
          username: args.username,
          vid: args.vid,
          usid: args.usid,
          page_index: args.page_index,
          page_size: args.page_size,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── query_user_surveys ───────────────────────────────────────────
  server.registerTool(
    "query_user_surveys",
    {
      title: "查询用户关联问卷",
      description:
        "查询指定参与者被分配的问卷列表，支持分页。",
      inputSchema: {
        username: z.string().min(1).describe("主账户用户名"),
        uid: z.string().min(1).describe("参与者 ID"),
        usid: z.number().int().positive().describe("用户系统 ID"),
        page_index: z.number().int().positive().optional().describe("页码，从1开始"),
        page_size: z.number().int().min(1).max(100).optional().describe("每页数量（1-100）"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "查询用户关联问卷",
      },
    },
    async (args) => {
      try {
        const result = await queryUserSurveys({
          username: args.username,
          uid: args.uid,
          usid: args.usid,
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
