import { readFileSync } from "node:fs";
import { Command } from "commander";
import {
  queryResponses,
  queryResponsesRealtime,
  downloadResponses,
  getReport,
  submitResponse,
  getWinners,
  modifyResponse,
  get360Report,
  clearResponses,
  getSurvey,
  normalizeSubmitdata,
} from "wjx-api-sdk";
import type { WjxCredentials } from "wjx-api-sdk";
import { CliError } from "../lib/errors.js";
import { executeCommand, strictInt, requireField, ensureJsonString, getMerged, createCapturingFetch, printDryRunPreview } from "../lib/command-helpers.js";
import { getCredentials } from "../lib/auth.js";
import { handleError } from "../lib/errors.js";
import { formatOutput } from "../lib/output.js";

/** 规范化 submitdata 中的题号、矩阵题和排序题答案格式 */
export function registerResponseCommands(program: Command): void {
  const response = program.command("response").description("答卷管理");

  // --- count ---
  response
    .command("count")
    .description("获取问卷答卷总数")
    .option("--vid <n>", "问卷ID", strictInt)
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, queryResponses, (m) => {
        requireField(m, "vid");
        return { vid: m.vid, page_size: 1 };
      }, {
        transformResult: (result) => {
          const data = (result as unknown as Record<string, unknown>).data as Record<string, unknown> | undefined;
          return {
            result: true,
            data: {
              total_count: data?.total_count ?? 0,
              join_times: data?.join_times ?? 0,
            },
          };
        },
      });
    });

  // --- query ---
  response
    .command("query")
    .description("查询答卷")
    .option("--vid <n>", "问卷ID", strictInt)
    .option("--page_index <n>", "页码", strictInt)
    .option("--page_size <n>", "每页数量", strictInt)
    .option("--sort <n>", "排序", strictInt)
    .option("--min_index <n>", "最小序号", strictInt)
    .option("--jid <s>", "答卷ID")
    .option("--sojumpparm <s>", "自定义参数")
    .option("--qid <s>", "题目ID")
    .option("--begin_time <n>", "开始时间", strictInt)
    .option("--end_time <n>", "结束时间", strictInt)
    .option("--file_view_expires <n>", "文件链接有效期", strictInt)
    .option("--query_note", "查询备注")
    .option("--distinct_user", "去重用户")
    .option("--distinct_sojumpparm", "去重参数")
    .option("--conds <json>", "查询条件JSON，格式：[{\"q_index\":10000,\"opt\":\"in\",\"val\":\"1,2\"}]，q_index=题序×10000，最多2个条件")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, queryResponses, (m) => {
        requireField(m, "vid");
        return {
          vid: m.vid,
          page_index: m.page_index,
          page_size: m.page_size,
          sort: m.sort,
          min_index: m.min_index,
          jid: m.jid,
          sojumpparm: m.sojumpparm,
          qid: m.qid,
          begin_time: m.begin_time,
          end_time: m.end_time,
          file_view_expires: m.file_view_expires,
          query_note: m.query_note,
          distinct_user: m.distinct_user,
          distinct_sojumpparm: m.distinct_sojumpparm,
          conds: ensureJsonString(m.conds, "conds"),
        };
      });
    });

  // --- realtime ---
  response
    .command("realtime")
    .description("实时查询最新答卷")
    .option("--vid <n>", "问卷ID", strictInt)
    .option("--count <n>", "数量", strictInt)
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, queryResponsesRealtime, (m) => {
        requireField(m, "vid");
        return { vid: m.vid, count: m.count };
      });
    });

  // --- download ---
  response
    .command("download")
    .description("下载答卷")
    .option("--vid <n>", "问卷ID", strictInt)
    .option("--taskid <s>", "任务ID")
    .option("--query_count <n>", "查询数量", strictInt)
    .option("--begin_time <n>", "开始时间", strictInt)
    .option("--end_time <n>", "结束时间", strictInt)
    .option("--min_index <n>", "最小序号", strictInt)
    .option("--qid <s>", "题目ID")
    .option("--sort <n>", "排序", strictInt)
    .option("--query_type <n>", "查询类型", strictInt)
    .option("--suffix <n>", "导出格式: 0=CSV, 1=SAV, 2=Word", strictInt)
    .option("--query_record", "查询记录")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, downloadResponses, (m) => {
        requireField(m, "vid");
        return {
          vid: m.vid,
          taskid: m.taskid,
          query_count: m.query_count,
          begin_time: m.begin_time,
          end_time: m.end_time,
          min_index: m.min_index,
          qid: m.qid,
          sort: m.sort,
          query_type: m.query_type,
          suffix: m.suffix,
          query_record: m.query_record,
        };
      });
    });

  // --- submit ---
  response
    .command("submit")
    .description("提交答卷（题号/选项序号一律 1-based；建议先跑 submit-template 拿模板。默认会自动注入 jpmversion）")
    .option("--vid <n>", "问卷ID", strictInt)
    .option("--inputcosttime <n>", "填写耗时(秒)", strictInt)
    .option("--submitdata <s>", "提交数据，格式 `1$答}2$答}…`（题号 1, 2, 3… 顺序递增）。Windows PowerShell 用户必须用单引号包裹（双引号会让 $1/$2/$3 被识别为变量并吞掉）；或改用 --submitdata-file 从文件读，彻底绕开 shell 转义")
    .option("--submitdata-file <path>", "从文件读取 submitdata（推荐：彻底绕开 PowerShell/bash 的 $ 变量展开问题）")
    .option("--udsid <n>", "用户系统ID", strictInt)
    .option("--sojumpparm <s>", "自定义参数")
    .option("--submittime <s>", "提交时间")
    .option("--jpmversion <n>", "问卷版本号；不传时默认自动从 getSurvey 取", strictInt)
    .option("--no-auto-version", "关闭自动获取 jpmversion（适用于显式传入或不需要校验场景）")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, submitResponse, (m) => {
        requireField(m, "vid");
        requireField(m, "inputcosttime");

        // 解析 submitdata：--submitdata-file 优先（commander 把 --submitdata-file 解析成 submitdataFile）
        let submitdata = m.submitdata as string | undefined;
        const fileOpt = (m as Record<string, unknown>).submitdataFile ?? (m as Record<string, unknown>)["submitdata-file"];
        if (typeof fileOpt === "string" && fileOpt) {
          try {
            submitdata = readFileSync(fileOpt, "utf8").replace(/^﻿/, "").trimEnd();
          } catch {
            throw new CliError("INPUT_ERROR", `无法读取 --submitdata-file 指向的文件: ${fileOpt}`);
          }
        }
        if (!submitdata) {
          throw new CliError("INPUT_ERROR", "Missing required option: --submitdata 或 --submitdata-file");
        }

        // sanity check：submitdata 里一个 $ 都没有，大概率是 shell 吞掉了 $1/$2/$3。
        // 提前拦截并给出可操作的修复建议，避免服务端返回"数据格式错误"这类晦涩错误。
        if (!submitdata.includes("$")) {
          throw new CliError(
            "INPUT_ERROR",
            `submitdata 中未检测到任何 "$" 分隔符。问卷星答卷协议使用 "题序$答案" 格式（如 "1$男|2$跑步|3$5"），缺失 $ 几乎必然是 shell 转义问题。` +
            `修复建议：① Windows PowerShell 请用单引号 '...' 包裹；② 或改用 --submitdata-file <path>，从文件读取，彻底绕开 shell 转义；③ 运行 \`wjx response submit-template --vid <问卷ID>\` 获取可直接填充的模板。`,
          );
        }

        return {
          vid: m.vid,
          inputcosttime: m.inputcosttime,
          submitdata,
          udsid: m.udsid,
          sojumpparm: m.sojumpparm,
          submittime: m.submittime,
          jpmversion: m.jpmversion,
          // commander 把 --no-auto-version 解析成 autoVersion=false
          autoVersion: (m as Record<string, unknown>).autoVersion !== false,
        };
      }, {
        transformInput: async (input, creds) => {
          const explicitVersion = input.jpmversion;
          const autoVersion = (input as Record<string, unknown>).autoVersion !== false;
          // 仅在未显式传 jpmversion 且未关闭自动注入时才请求 getSurvey
          // 同时复用 getSurvey 结果做 submitdata 规范化
          let survey: Awaited<ReturnType<typeof getSurvey>> | null = null;
          if (autoVersion || typeof input.submitdata === "string") {
            try {
              survey = await getSurvey(
                { vid: input.vid as number },
                creds as WjxCredentials,
              );
            } catch {
              // 拿不到结构不阻塞提交
            }
          }

          const data = survey?.data as {
            version?: number;
            questions?: Array<{ q_index: number; q_type: number; q_subtype: number }>;
          } | undefined;

          const result: Record<string, unknown> = { ...input };
          // 不要把内部 autoVersion 透到 SDK
          delete result.autoVersion;

          if (explicitVersion === undefined && autoVersion && typeof data?.version === "number") {
            result.jpmversion = data.version;
          }

          const questions = data?.questions ?? [];
          if (questions.length > 0 && typeof input.submitdata === "string") {
            result.submitdata = normalizeSubmitdata(input.submitdata, questions);
          }
          return result;
        },
      });
    });

  // --- modify ---
  response
    .command("modify")
    .description("修改答卷")
    .option("--vid <n>", "问卷ID", strictInt)
    .option("--jid <n>", "答卷ID", strictInt)
    .option("--answers <s>", "答案数据")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, modifyResponse, (m) => {
        requireField(m, "vid");
        requireField(m, "jid");
        requireField(m, "answers");
        return { vid: m.vid, jid: m.jid, type: 1 as const, answers: m.answers };
      });
    });

  // --- clear ---
  response
    .command("clear")
    .description("清空答卷")
    .option("--username <s>", "用户名")
    .option("--vid <n>", "问卷ID", strictInt)
    .option("--reset_to_zero", "重置序号")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, clearResponses, (m) => {
        requireField(m, "username");
        requireField(m, "vid");
        return {
          username: m.username,
          vid: m.vid,
          reset_to_zero: m.reset_to_zero ?? false,
        };
      });
    });

  // --- report ---
  response
    .command("report")
    .description("获取统计报告")
    .option("--vid <n>", "问卷ID", strictInt)
    .option("--valid", "查询有效答卷（默认true）")
    .option("--min_index <n>", "最小序号", strictInt)
    .option("--jid <s>", "答卷ID")
    .option("--sojumpparm <s>", "自定义参数")
    .option("--begin_time <n>", "开始时间", strictInt)
    .option("--end_time <n>", "结束时间", strictInt)
    .option("--distinct_user", "去重用户")
    .option("--distinct_sojumpparm", "去重参数")
    .option("--conds <json>", "查询条件JSON，格式：[{\"q_index\":10000,\"opt\":\"in\",\"val\":\"1,2\"}]，q_index=题序×10000")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, getReport, (m) => {
        requireField(m, "vid");
        return {
          vid: m.vid,
          valid: m.valid ?? true,
          min_index: m.min_index,
          jid: m.jid,
          sojumpparm: m.sojumpparm,
          begin_time: m.begin_time,
          end_time: m.end_time,
          distinct_user: m.distinct_user,
          distinct_sojumpparm: m.distinct_sojumpparm,
          conds: ensureJsonString(m.conds, "conds"),
        };
      });
    });

  // --- files (已移除 — 仅限混合云/私有化场景) ---

  // --- winners ---
  response
    .command("winners")
    .description("获取中奖名单")
    .option("--vid <n>", "问卷ID", strictInt)
    .option("--atype <n>", "活动类型", strictInt)
    .option("--awardstatus <n>", "领奖状态", strictInt)
    .option("--page_index <n>", "页码", strictInt)
    .option("--page_size <n>", "每页数量", strictInt)
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, getWinners, (m) => {
        requireField(m, "vid");
        return {
          vid: m.vid,
          atype: m.atype,
          awardstatus: m.awardstatus,
          page_index: m.page_index,
          page_size: m.page_size,
        };
      });
    });

  // --- submit-template ---
  response
    .command("submit-template")
    .description("根据问卷结构生成 submitdata 模板：列出每题 1-based placeholder，AI 改成真实答案后即可调 submit")
    .option("--vid <n>", "问卷ID", strictInt)
    .option("--raw", "直接输出 submitdata 字符串（不包裹 JSON），便于重定向到文件")
    .action(async (_opts, cmd) => {
      try {
        const merged = getMerged(cmd);
        requireField(merged, "vid");
        const globalOpts = program.opts();
        const creds = getCredentials(globalOpts);

        if (globalOpts.dryRun) {
          const { fetchImpl, getCapturedRequest } = createCapturingFetch();
          await getSurvey({ vid: merged.vid as number, get_questions: true, get_items: true }, creds as WjxCredentials, fetchImpl);
          printDryRunPreview(getCapturedRequest());
          return;
        }

        const survey = await getSurvey(
          { vid: merged.vid as number, get_questions: true, get_items: true },
          creds as WjxCredentials,
        );
        if (survey.result === false) {
          throw new CliError("API_ERROR", survey.errormsg || "获取问卷结构失败");
        }
        const surveyData = survey.data as {
          title?: string;
          questions?: Array<{
            q_index: number;
            q_type: number;
            q_subtype?: number;
            q_title?: string;
            items?: Array<{ item_index: number; item_title?: string }>;
            col_items?: Array<{ item_index: number; item_title?: string }>;
            item_rows?: Array<{ item_index: number; item_title?: string }>;
            gap_count?: number;
          }>;
        } | undefined;
        const template = buildSubmitTemplate(surveyData?.questions ?? []);

        if (merged.raw || globalOpts.table) {
          process.stdout.write(template.submitdata);
          if (!template.submitdata.endsWith("\n")) process.stdout.write("\n");
        } else {
          formatOutput(
            {
              vid: merged.vid,
              title: surveyData?.title ?? "",
              submitdata: template.submitdata,
              questions: template.questions,
              next_step: `把每题 placeholder 改成真实答案，存为 submitdata.txt 后运行：wjx response submit --vid ${merged.vid} --inputcosttime 30 --submitdata-file submitdata.txt`,
            },
            globalOpts,
          );
        }
      } catch (e) {
        handleError(e);
      }
    });

  // --- 360-report (placeholder section break) ---
  response
    .command("360-report")
    .description("获取360度报告")
    .option("--vid <n>", "问卷ID", strictInt)
    .option("--taskid <s>", "任务ID")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, get360Report, (m) => {
        requireField(m, "vid");
        return { vid: m.vid, taskid: m.taskid };
      });
    });
}

interface SubmitTemplateQuestion {
  q_index: number;
  q_type: number;
  q_subtype?: number;
  q_title?: string;
  /**
   * 非矩阵题：选项列表；
   * 矩阵题（q_type=7）：服务端返回里 items 是**列**（列头），不是行。
   */
  items?: Array<{ item_index: number; item_title?: string }>;
  col_items?: Array<{ item_index: number; item_title?: string }>;
  /** 矩阵题的行标题（q_type=7 时服务端用 item_rows 返回真实行） */
  item_rows?: Array<{ item_index: number; item_title?: string }>;
  gap_count?: number;
}

interface SubmitTemplateOutputQuestion {
  q_index: number;
  q_type: number;
  q_subtype?: number;
  q_title: string;
  placeholder: string;
  hint: string;
}

interface SubmitTemplateResult {
  submitdata: string;
  questions: SubmitTemplateOutputQuestion[];
}

/**
 * 给单题生成 1-based placeholder（仅 placeholder 段，不含题号前缀）。
 * 序号一律 1-based，与 SDK normalizeSubmitdata 的内部约定一致。
 */
function placeholderForQuestion(q: SubmitTemplateQuestion): { value: string; hint: string } {
  const itemCount = Array.isArray(q.items) ? q.items.length : 0;
  const rowCount = Array.isArray(q.item_rows) ? q.item_rows.length : 0;
  switch (q.q_type) {
    case 3: {
      // 单选 / 量表 / 评分单选 / 下拉
      return { value: "1", hint: "选项序号（1-based），例：1=第1个选项" };
    }
    case 4: {
      // 多选 / 排序 / 评分多选
      if (q.q_subtype === 402) {
        const order = itemCount >= 2 ? `1|2|${itemCount}` : "1|2";
        return { value: order, hint: "排序：用 | 分隔，按名次列出选项序号（1-based）" };
      }
      return { value: "1|2", hint: "多选：用 | 分隔多个选项序号（1-based）" };
    }
    case 5: {
      return { value: "__请填写__", hint: "填空：直接写答案文本" };
    }
    case 6: {
      const gaps = q.gap_count && q.gap_count > 0 ? q.gap_count : 2;
      return {
        value: Array.from({ length: gaps }, (_, i) => `__填空${i + 1}__`).join("|"),
        hint: `多项填空：${gaps} 个空，用 | 分隔每个空的答案`,
      };
    }
    case 7: {
      // 矩阵题：getSurvey 里 item_rows 是真实行、items 是列（列头）；回退到 items 仅用于兜底
      const rows = rowCount > 0 ? rowCount : (itemCount > 0 ? itemCount : 2);
      const isMulti = q.q_subtype === 703;
      const cellPlaceholder = isMulti ? "1|2" : "1";
      const segments = Array.from({ length: rows }, (_, i) => `${i + 1}!${cellPlaceholder}`);
      return {
        value: segments.join(","),
        hint: isMulti
          ? "矩阵多选：行号!列号|列号 用 , 分隔多行（行号/列号都是 1-based）"
          : "矩阵单选/量表：行号!列号 用 , 分隔多行（行号/列号都是 1-based）",
      };
    }
    case 8: {
      return { value: "filename.png", hint: "文件上传：文件名（实际上传请用 wjx survey upload）" };
    }
    case 9: {
      // 比重题：行数取 item_rows 优先（行标签），否则兜底 items；分值和为 100
      const rows = rowCount > 0 ? rowCount : (itemCount > 0 ? itemCount : 2);
      const each = Math.floor(100 / rows);
      const last = 100 - each * (rows - 1);
      const parts = Array.from({ length: rows }, (_, i) => `${i + 1}!${i === rows - 1 ? last : each}`);
      return { value: parts.join(","), hint: "比重题：行号!分值，所有行分值之和需等于 100" };
    }
    case 10: {
      return { value: "5", hint: "滑动条：min~max 之间的整数" };
    }
    default: {
      return { value: "__请填写__", hint: `未知题型 q_type=${q.q_type}，请按问卷星协议手动填写` };
    }
  }
}

/**
 * 构建 submitdata 模板：跳过 q_type 1（分页栏）/2（段落说明）。
 *
 * 题号策略：**直接使用服务端返回的原始 q_index**（不重排）。
 * 原因：服务端 getSurvey 返回的 q_index 已把"问卷基础信息"占成 1，真实题目从 2 开始；
 * submitResponse 严格校验这个 q_index，重排成 1-based 反而会被服务端拒收"5〒答案不符合要求"。
 */
export function buildSubmitTemplate(questions: SubmitTemplateQuestion[]): SubmitTemplateResult {
  const segments: string[] = [];
  const out: SubmitTemplateOutputQuestion[] = [];
  for (const q of questions) {
    if (q.q_type === 1 || q.q_type === 2) continue;
    const qIndex = q.q_index;
    const { value, hint } = placeholderForQuestion(q);
    segments.push(`${qIndex}$${value}`);
    out.push({
      q_index: qIndex,
      q_type: q.q_type,
      q_subtype: q.q_subtype,
      q_title: q.q_title ?? "",
      placeholder: `${qIndex}$${value}`,
      hint,
    });
  }
  return { submitdata: segments.join("}"), questions: out };
}
