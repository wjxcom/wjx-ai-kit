import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  queryResponses,
  queryResponsesRealtime,
  downloadResponses,
  getReport,
  submitResponse,
  getFileLinks,
  getWinners,
  modifyResponse,
  get360Report,
  clearResponses,
} from "./client.js";
import { toolResult, toolError } from "../../helpers.js";

export function registerResponseTools(server: McpServer): void {
  // ─── query_responses ──────────────────────────────────────────────
  server.registerTool(
    "query_responses",
    {
      title: "答卷查询",
      description:
        "查询问卷的答卷数据，支持分页、时间范围、条件筛选。返回答卷明细包括提交时间、来源、IP、各题答案等。",
      inputSchema: {
        vid: z.number().int().positive().describe("问卷编号"),
        valid: z.boolean().optional().describe("是否查询有效答卷，默认true"),
        page_index: z.number().int().positive().optional().describe("分页页码，默认1"),
        page_size: z.number().int().min(1).max(50).optional().describe("每页答卷数，默认10，最大50"),
        sort: z.number().int().min(0).max(1).optional().describe("排序：0=升序, 1=降序"),
        min_index: z.number().int().optional().describe("最小答卷序号，返回大于此序号的答卷"),
        jid: z.string().optional().describe("答卷编号，多个用逗号分隔，最多50个"),
        sojumpparm: z.string().optional().describe("自定义链接参数，多个用逗号分隔，最多50个"),
        qid: z.string().optional().describe("指定返回的题目编号列表，逗号分隔，最多50个"),
        begin_time: z.number().int().optional().describe("查询开始时间（Unix毫秒时间戳）"),
        end_time: z.number().int().optional().describe("查询结束时间（Unix毫秒时间戳）"),
        file_view_expires: z.number().int().optional().describe("文件上传题链接有效期（小时），默认1"),
        query_note: z.boolean().optional().describe("是否查询标注信息"),
        distinct_user: z.boolean().optional().describe("是否仅返回用户最新答卷"),
        distinct_sojumpparm: z.boolean().optional().describe("是否仅返回自定义参数最新答卷"),
        conds: z.string().refine(
          (s) => { try { JSON.parse(s); return true; } catch { return false; } },
          "conds 必须是合法的 JSON 字符串",
        ).optional().describe("题目查询条件 JSON 字符串，最多2个条件，AND关系"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "答卷查询",
      },
    },
    async (args) => {
      try {
        const result = await queryResponses({
          vid: args.vid,
          valid: args.valid,
          page_index: args.page_index,
          page_size: args.page_size,
          sort: args.sort,
          min_index: args.min_index,
          jid: args.jid,
          sojumpparm: args.sojumpparm,
          qid: args.qid,
          begin_time: args.begin_time,
          end_time: args.end_time,
          file_view_expires: args.file_view_expires,
          query_note: args.query_note,
          distinct_user: args.distinct_user,
          distinct_sojumpparm: args.distinct_sojumpparm,
          conds: args.conds,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── query_responses_realtime ─────────────────────────────────────
  server.registerTool(
    "query_responses_realtime",
    {
      title: "答卷实时查询",
      description:
        "实时查询新提交的答卷（队列模式）。查询成功的答卷将从队列移除，无法二次查询。需联系客服开通白名单。",
      inputSchema: {
        vid: z.number().int().positive().describe("问卷编号"),
        count: z.number().int().positive().optional().describe("每次获取的答卷数量"),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
        title: "答卷实时查询",
      },
    },
    async (args) => {
      try {
        const result = await queryResponsesRealtime({
          vid: args.vid,
          count: args.count,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── download_responses ───────────────────────────────────────────
  server.registerTool(
    "download_responses",
    {
      title: "答卷下载",
      description:
        "批量下载答卷数据，支持 CSV/SAV/Word 格式。超过3000条自动转为异步任务，返回 taskid 用于轮询。",
      inputSchema: {
        vid: z.number().int().positive().describe("问卷编号"),
        taskid: z.string().optional().describe("异步任务 ID（用于轮询下载状态）"),
        valid: z.boolean().optional().describe("是否查询有效答卷，默认true"),
        query_count: z.number().int().optional().describe("查询的最大答卷条数"),
        begin_time: z.number().int().optional().describe("查询开始时间（Unix毫秒时间戳）"),
        end_time: z.number().int().optional().describe("查询结束时间（Unix毫秒时间戳）"),
        min_index: z.number().int().optional().describe("最小答卷序号"),
        qid: z.string().optional().describe("指定问题列表，逗号分隔，最多50个"),
        sort: z.number().int().min(0).max(1).optional().describe("排序：0=升序, 1=降序"),
        query_type: z.number().int().min(0).max(2).optional().describe("查询方式：0=按文本, 1=按分数, 2=按序号"),
        suffix: z.number().int().min(0).max(2).optional().describe("文件格式：0=CSV, 1=SAV, 2=Word"),
        query_record: z.boolean().optional().describe("仅查询参与作答记录（不限制答卷数）"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        title: "答卷下载",
      },
    },
    async (args) => {
      try {
        const result = await downloadResponses({
          vid: args.vid,
          taskid: args.taskid,
          valid: args.valid,
          query_count: args.query_count,
          begin_time: args.begin_time,
          end_time: args.end_time,
          min_index: args.min_index,
          qid: args.qid,
          sort: args.sort,
          query_type: args.query_type,
          suffix: args.suffix,
          query_record: args.query_record,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── get_report ───────────────────────────────────────────────────
  server.registerTool(
    "get_report",
    {
      title: "默认报告查询",
      description:
        "获取问卷的统计报告，包含各题选项频次统计、平均分、总分等聚合数据。",
      inputSchema: {
        vid: z.number().int().positive().describe("问卷编号"),
        valid: z.boolean().optional().describe("是否查询有效答卷，默认true"),
        min_index: z.number().int().optional().describe("最小答卷序号"),
        jid: z.string().optional().refine(
          (s) => {
            if (s === undefined) return true;
            return s.split(",").length <= 50;
          },
          "jid 最多允许传入50个，用逗号分隔",
        ).describe("答卷编号，多个用逗号分隔，最多50个"),
        sojumpparm: z.string().optional().describe("自定义链接参数，多个用逗号分隔"),
        begin_time: z.number().int().optional().describe("查询开始时间（Unix毫秒时间戳）"),
        end_time: z.number().int().optional().describe("查询结束时间（Unix毫秒时间戳）"),
        distinct_user: z.boolean().optional().describe("是否仅用户最新答卷"),
        distinct_sojumpparm: z.boolean().optional().describe("是否仅自定义参数最新答卷"),
        conds: z.string().refine(
          (s) => { try { JSON.parse(s); return true; } catch { return false; } },
          "conds 必须是合法的 JSON 字符串",
        ).optional().describe("题目查询条件 JSON 字符串"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "默认报告查询",
      },
    },
    async (args) => {
      try {
        const result = await getReport({
          vid: args.vid,
          valid: args.valid,
          min_index: args.min_index,
          jid: args.jid,
          sojumpparm: args.sojumpparm,
          begin_time: args.begin_time,
          end_time: args.end_time,
          distinct_user: args.distinct_user,
          distinct_sojumpparm: args.distinct_sojumpparm,
          conds: args.conds,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── submit_response ──────────────────────────────────────────────
  server.registerTool(
    "submit_response",
    {
      title: "答卷提交",
      description:
        "向问卷提交答卷数据（代填/导入）。答卷格式：题号$答案}题号$答案，详见问卷星答卷格式规范。",
      inputSchema: {
        vid: z.number().int().positive().describe("问卷编号"),
        inputcosttime: z.number().int().min(2).describe("填写时间（秒），需>1秒否则视为机器提交"),
        submitdata: z.string().min(1).describe("答卷内容字符串，格式：题号$答案}题号$答案"),
        udsid: z.number().int().optional().describe("自定义来源编号"),
        sojumpparm: z.string().optional().describe("自定义链接参数"),
        submittime: z.string().optional().describe("答卷提交时间，日期时间字符串，默认当前时间"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        title: "答卷提交",
      },
    },
    async (args) => {
      try {
        const result = await submitResponse({
          vid: args.vid,
          inputcosttime: args.inputcosttime,
          submitdata: args.submitdata,
          udsid: args.udsid,
          sojumpparm: args.sojumpparm,
          submittime: args.submittime,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── get_file_links ───────────────────────────────────────────────
  server.registerTool(
    "get_file_links",
    {
      title: "获取文件链接",
      description:
        "获取答卷中文件上传题的文件访问和下载链接（仅限混合云/私有化场景）。",
      inputSchema: {
        vid: z.number().int().positive().describe("问卷编号"),
        file_keys: z.string().min(1).refine(
          (s) => { try { JSON.parse(s); return true; } catch { return false; } },
          "file_keys 必须是合法的 JSON 字符串",
        ).describe("文件键值列表 JSON 字符串，一次最多100个"),
        file_view_expires: z.number().int().optional().describe("链接有效期（小时），默认1"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "获取文件链接",
      },
    },
    async (args) => {
      try {
        const result = await getFileLinks({
          vid: args.vid,
          file_keys: args.file_keys,
          file_view_expires: args.file_view_expires,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── get_winners ──────────────────────────────────────────────────
  server.registerTool(
    "get_winners",
    {
      title: "获取中奖者信息",
      description:
        "获取问卷的中奖者信息列表，支持按奖品类型和发放状态筛选，支持分页。",
      inputSchema: {
        vid: z.number().int().positive().describe("问卷编号"),
        atype: z.number().int().optional().describe("奖品类型：0=其他奖品, 1=微信红包, -1=不限"),
        awardstatus: z.number().int().optional().describe("发放状态：0=未发放, 1=已发放, -1=不限"),
        page_index: z.number().int().positive().optional().describe("页码，默认1"),
        page_size: z.number().int().min(1).max(100).optional().describe("每页数量（1-100），默认10"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "获取中奖者信息",
      },
    },
    async (args) => {
      try {
        const result = await getWinners({
          vid: args.vid,
          atype: args.atype,
          awardstatus: args.awardstatus,
          page_index: args.page_index,
          page_size: args.page_size,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── modify_response ──────────────────────────────────────────────
  server.registerTool(
    "modify_response",
    {
      title: "修改答卷",
      description:
        "修改答卷数据。当前仅支持修改考试问卷的主观题分数（type=1）。answers 为 JSON 字符串，格式 {题号: 分数}。",
      inputSchema: {
        vid: z.number().int().positive().describe("问卷编号"),
        jid: z.number().int().positive().describe("答卷编号"),
        type: z.literal(1).describe("修改类型：1=修改分数（目前仅支持1）"),
        answers: z.string().min(1).refine(
          (s) => { try { JSON.parse(s); return true; } catch { return false; } },
          "answers 必须是合法的 JSON 字符串",
        ).describe("分数修改 JSON 字符串，格式：{\"题号\":\"分数\"}"),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
        title: "修改答卷",
      },
    },
    async (args) => {
      try {
        const result = await modifyResponse({
          vid: args.vid,
          jid: args.jid,
          type: args.type,
          answers: args.answers,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── get_360_report ───────────────────────────────────────────────
  server.registerTool(
    "get_360_report",
    {
      title: "360度评估报告下载",
      description:
        "下载360度评估报告的详细数据（XLS格式）。异步模式：首次调用可能返回 status=0 和 taskid，需再次调用并传入 taskid 轮询直到 status=1 获取下载链接。",
      inputSchema: {
        vid: z.number().int().positive().describe("问卷编号"),
        taskid: z.string().optional().describe("异步任务 ID（用于轮询下载状态）"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        title: "360度评估报告下载",
      },
    },
    async (args) => {
      try {
        const result = await get360Report({
          vid: args.vid,
          taskid: args.taskid,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── clear_responses ──────────────────────────────────────────────
  server.registerTool(
    "clear_responses",
    {
      title: "清空答卷数据",
      description:
        "清空指定问卷的所有答卷数据。此操作不可逆！可选择是否重置答卷序号为0。",
      inputSchema: {
        username: z.string().min(1).describe("用户名（主账户/系统管理员/问卷创建者子账号）"),
        vid: z.number().int().positive().describe("问卷编号"),
        reset_to_zero: z.boolean().describe("是否将答卷序号重置为0"),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
        title: "清空答卷数据",
      },
    },
    async (args) => {
      try {
        const result = await clearResponses({
          username: args.username,
          vid: args.vid,
          reset_to_zero: args.reset_to_zero,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
