import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  addParticipants,
  modifyParticipants,
  deleteParticipants,
  bindActivity,
  querySurveyBinding,
  queryUserSurveys,
} from "./client.js";
import { toolResult, toolError } from "../../helpers.js";

export function registerUserSystemTools(server: McpServer): void {
  // ─── add_participants ─────────────────────────────────────────────
  server.registerTool(
    "add_participants",
    {
      title: "[已过时] 批量添加参与者",
      description:
        "[Deprecated] 向用户系统批量添加参与者（每次最多100人）。users 为 JSON 数组字符串，每个对象包含 uid、uname、upass、udept、uextf 字段。",
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
        title: "[已过时] 批量添加参与者",
      },
    },
    async (args) => {
      try {
        const result = await addParticipants({
          username: args.username,
          users: args.users,
          sysid: args.usid,
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
      title: "[已过时] 批量修改参与者",
      description:
        "[Deprecated] 批量修改用户系统中参与者的信息。users 为 JSON 数组字符串，每个对象包含 uid、uname、upass、udept、uextf 字段。",
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
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
        title: "[已过时] 批量修改参与者",
      },
    },
    async (args) => {
      try {
        const result = await modifyParticipants({
          username: args.username,
          users: args.users,
          sysid: args.usid,
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
      title: "[已过时] 批量删除参与者",
      description:
        "[Deprecated] 从用户系统中批量删除参与者。此操作不可逆，请谨慎使用！uids 为 JSON 数组字符串，如 [\"uid1\",\"uid2\"]。",
      inputSchema: {
        username: z.string().min(1).describe("主账户用户名"),
        uids: z
          .string()
          .min(2)
          .refine(
            (s) => { try { return Array.isArray(JSON.parse(s)); } catch { return false; } },
            "uids 必须是合法的 JSON 数组",
          )
          .describe("参与者 ID 列表 JSON 字符串（数组），如 [\"uid1\",\"uid2\"]"),
        usid: z.number().int().positive().describe("用户系统 ID"),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
        title: "[已过时] 批量删除参与者",
      },
    },
    async (args) => {
      try {
        const result = await deleteParticipants({
          username: args.username,
          uids: args.uids,
          sysid: args.usid,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── bind_activity ───────────────────────────────────────────────
  server.registerTool(
    "bind_activity",
    {
      title: "[已过时] 绑定问卷到用户体系",
      description:
        "[Deprecated] 将问卷绑定到用户体系，并指定参与者。可设置作答次数限制、是否允许修改答案等。",
      inputSchema: {
        username: z.string().min(1).describe("主账户用户名"),
        vid: z.number().int().positive().describe("问卷编号"),
        usid: z.number().int().positive().describe("用户系统 ID"),
        uids: z
          .string()
          .min(2)
          .refine(
            (s) => { try { return Array.isArray(JSON.parse(s)); } catch { return false; } },
            "uids 必须是合法的 JSON 数组",
          )
          .describe("参与者 ID 列表 JSON 字符串（数组），如 [\"uid1\",\"uid2\"]"),
        answer_times: z.number().int().min(0).optional().describe("作答次数限制，0=不限"),
        can_chg_answer: z.boolean().optional().describe("是否允许修改答案"),
        can_view_result: z.boolean().optional().describe("是否允许查看结果"),
        can_hide_qlist: z.number().int().min(0).max(1).optional().describe("是否隐藏问卷列表：0=不隐藏, 1=隐藏"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        title: "[已过时] 绑定问卷到用户体系",
      },
    },
    async (args) => {
      try {
        const result = await bindActivity({
          username: args.username,
          vid: args.vid,
          sysid: args.usid,
          uids: args.uids,
          answer_times: args.answer_times,
          can_chg_answer: args.can_chg_answer,
          can_view_result: args.can_view_result,
          can_hide_qlist: args.can_hide_qlist,
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
      title: "[已过时] 查询问卷用户绑定",
      description:
        "[Deprecated] 查询问卷与用户系统的绑定关系，返回绑定的参与者列表，支持分页。",
      inputSchema: {
        username: z.string().min(1).describe("主账户用户名"),
        vid: z.number().int().positive().describe("问卷编号"),
        usid: z.number().int().positive().describe("用户系统 ID"),
        page_index: z.number().int().positive().optional().describe("页码，从1开始"),
        page_size: z.number().int().min(1).max(100).optional().describe("每页数量（1-100）"),
        join_status: z.number().int().optional().describe("参与状态筛选，0=全部"),
        day: z.string().optional().describe("按日期筛选，格式 yyyyMMdd（8位）"),
        week: z.string().optional().describe("按周筛选，格式 yyyyWW（6位）"),
        month: z.string().optional().describe("按月筛选，格式 yyyyMM（6位）"),
        force_join_times: z.boolean().optional().describe("是否强制获取参与次数"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "[已过时] 查询问卷用户绑定",
      },
    },
    async (args) => {
      try {
        const result = await querySurveyBinding({
          username: args.username,
          vid: args.vid,
          sysid: args.usid,
          page_index: args.page_index,
          page_size: args.page_size,
          join_status: args.join_status,
          day: args.day,
          week: args.week,
          month: args.month,
          force_join_times: args.force_join_times,
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
      title: "[已过时] 查询用户关联问卷",
      description:
        "[Deprecated] 查询指定参与者被分配的问卷列表，支持分页。",
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
        title: "[已过时] 查询用户关联问卷",
      },
    },
    async (args) => {
      try {
        const result = await queryUserSurveys({
          username: args.username,
          uid: args.uid,
          sysid: args.usid,
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
