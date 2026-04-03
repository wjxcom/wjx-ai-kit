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

/** 校验字符串是否为合法 JSON 数组，在 handler 中调用（避免 Zod .refine() 导致 MCP 挂起） */
function assertJsonArray(value: string, fieldName: string): void {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error(`${fieldName} 必须是合法的 JSON 字符串`); }
  if (!Array.isArray(parsed)) throw new Error(`${fieldName} 必须是 JSON 数组`);
}

export function registerUserSystemTools(server: McpServer): void {
  // ─── add_participants ─────────────────────────────────────────────
  server.registerTool(
    "add_participants",
    {
      title: "[已过时] 批量添加参与者",
      description:
        "[Deprecated] 向用户系统批量添加参与者（每次最多100人）。users 为 JSON 数组字符串，每个对象包含: uid(参与者唯一编号,必填)、uname(参与者姓名,选填)、upass(初始登录密码,选填)、udept(部门,选填,必须是数组如[\"部门1\"])、uextf(附加信息,选填,必须是数组如[\"信息1\"])。",
      inputSchema: {
        users: z
          .string()
          .min(2)
          .describe(
            "参与者列表 JSON 字符串（数组），每项包含: uid(用户ID,必填), uname(姓名), upass(密码), udept(部门,数组格式如[\"部门1\"]), uextf(附加信息,数组格式如[\"信息1\"])",
          ),
        usid: z.number().int().positive().describe("用户系统 ID（sysid）"),
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
        assertJsonArray(args.users, "users");
        const result = await addParticipants({
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
        "[Deprecated] 批量修改用户系统中参与者的信息。users 为 JSON 数组字符串，每个对象包含: uid(参与者唯一编号,必填)、uname(姓名)、upass(密码)、udept(部门,必须是数组格式如[\"部门1\"])、uextf(附加信息,必须是数组格式如[\"信息1\"])。auto_create_udept 可在部门不存在时自动创建。",
      inputSchema: {
        users: z
          .string()
          .min(2)
          .describe(
            "参与者列表 JSON 字符串（数组），每项包含: uid(用户ID,必填), uname(姓名), upass(密码), udept(部门,数组格式如[\"部门1\"]), uextf(附加信息,数组格式如[\"信息1\"])",
          ),
        usid: z.number().int().positive().describe("用户系统 ID（sysid）"),
        auto_create_udept: z.boolean().optional().describe("部门不存在时是否自动创建"),
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
        assertJsonArray(args.users, "users");
        const result = await modifyParticipants({
          users: args.users,
          sysid: args.usid,
          auto_create_udept: args.auto_create_udept,
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
        uids: z
          .string()
          .min(2)
          .describe("参与者 ID 列表 JSON 字符串（数组），如 [\"uid1\",\"uid2\"]"),
        usid: z.number().int().positive().describe("用户系统 ID（sysid）"),
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
        assertJsonArray(args.uids, "uids");
        const result = await deleteParticipants({
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
        vid: z.number().int().positive().describe("问卷编号"),
        usid: z.number().int().positive().describe("用户系统 ID（sysid）"),
        uids: z
          .string()
          .min(2)
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
        assertJsonArray(args.uids, "uids");
        const result = await bindActivity({
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
        "[Deprecated] 查询问卷与用户系统的绑定关系，返回绑定的参与者列表。支持按参与状态(join_status)、日期(day)、周(week)、月(month)筛选，可选择是否强制获取参与次数(force_join_times)。",
      inputSchema: {
        vid: z.number().int().positive().describe("问卷编号"),
        usid: z.number().int().positive().describe("用户系统 ID（sysid）"),
        join_status: z.number().int().optional().describe("按参与状态筛选：0=全部（默认）, 1=待参与, 2=已参与"),
        day: z.string().optional().describe("按日期筛选，格式 yyyyMMdd（8位），如 '20260331'。当用户要求按天查询时必须传递此参数"),
        week: z.string().optional().describe("按周筛选，格式 yyyyWW（6位），如 '202614'。当用户要求按周查询时必须传递此参数"),
        month: z.string().optional().describe("按月筛选，格式 yyyyMM（6位），如 '202603'。当用户要求按月查询时必须传递此参数"),
        force_join_times: z.boolean().optional().describe("是否强制获取参与次数。当用户要求查看参与次数时设为 true"),
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
          vid: args.vid,
          sysid: args.usid,
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
        uid: z.string().min(1).describe("参与者 ID"),
        usid: z.number().int().positive().describe("用户系统 ID（sysid）"),
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
          uid: args.uid,
          sysid: args.usid,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
