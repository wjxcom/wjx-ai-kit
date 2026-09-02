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
  buildSubmitTemplate,
  Action,
} from "wjx-api-sdk";
import type { WjxCredentials } from "wjx-api-sdk";
import { CliError, ensureApiSuccess } from "../lib/errors.js";
import { strictInt, requireField, requirePositiveInt, requireEnum, requireIntRange, ensureJsonArray, getMerged, createCapturingFetch, printDryRunPreview } from "../lib/command-helpers.js";
import { applyProfileCredentials, getCredentials } from "../lib/auth.js";
import { resolveProfile } from "../lib/profiles.js";
import { handleError } from "../lib/errors.js";
import { formatOutput } from "../lib/output.js";
import { executeRuntimeAction, executeRuntimeCommand } from "../lib/runtime/executor.js";
import { buildRequestPlan } from "../lib/runtime/request-plan.js";

/** 规范化 submitdata 中的题号、矩阵题和排序题答案格式 */
export { buildSubmitTemplate } from "wjx-api-sdk";

export function registerResponseCommands(program: Command): void {
  const response = program.command("response").description("答卷管理");

  // --- count ---
  response
    .command("count")
    .description("获取问卷答卷总数")
    .option("--vid <n>", "问卷ID", strictInt)
    .action(async (_opts, cmd) => {
      await executeRuntimeAction(program, cmd, queryResponses, (m) => {
        requireField(m, "vid");
        return { vid: m.vid, page_size: 1 };
      }, {
        transformResult: (result) => {
          const data = (result as unknown as Record<string, unknown>).data as Record<string, unknown> | undefined;
          return {
            total_count: data?.total_count ?? 0,
            join_times: data?.join_times ?? 0,
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
    .option("--valid", "查询有效答卷（默认true）")
    .option("--query_note", "查询备注")
    .option("--distinct_user", "去重用户")
    .option("--distinct_sojumpparm", "去重参数")
    .option("--conds <json>", "查询条件JSON，格式：[{\"q_index\":10000,\"opt\":\"in\",\"val\":\"1,2\"}]，q_index=题序×10000，最多2个条件")
    .action(async (_opts, cmd) => {
      await executeRuntimeAction(program, cmd, queryResponses, (m) => {
        requireField(m, "vid");
        if (m.page_index !== undefined) requirePositiveInt(m, "page_index");
        if (m.page_size !== undefined) requireIntRange(m, "page_size", 1, 50);
        if (m.sort !== undefined) requireEnum(m, "sort", [0, 1]);
        if (m.file_view_expires !== undefined) requirePositiveInt(m, "file_view_expires");
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
          valid: m.valid ?? true,
          query_note: m.query_note,
          distinct_user: m.distinct_user,
          distinct_sojumpparm: m.distinct_sojumpparm,
          conds: ensureJsonArray(m.conds, "conds"),
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
      await executeRuntimeAction(program, cmd, queryResponsesRealtime, (m) => {
        requireField(m, "vid");
        if (m.count !== undefined) requirePositiveInt(m, "count");
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
      await executeRuntimeAction(program, cmd, downloadResponses, (m) => {
        requireField(m, "vid");
        if (m.query_count !== undefined) requirePositiveInt(m, "query_count");
        if (m.sort !== undefined) requireEnum(m, "sort", [0, 1]);
        if (m.query_type !== undefined) requireEnum(m, "query_type", [0, 1, 2]);
        if (m.suffix !== undefined) requireEnum(m, "suffix", [0, 1, 2]);
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
    .description("提交答卷（选项序号 1-based；题号使用 submit-template 返回的原始 q_index。默认会自动注入 jpmversion）")
    .option("--vid <n>", "问卷ID", strictInt)
    .option("--inputcosttime <n>", "填写耗时(秒)", strictInt)
    .option("--submitdata <s>", "提交数据，格式 `题号$答}题号$答}…`（题号必须使用服务端返回的原始 q_index，不保证连续）。Windows PowerShell 用户必须用单引号包裹（双引号会让 $1/$2/$3 被识别为变量并吞掉）；或改用 --submitdata-file 从文件读，彻底绕开 shell 转义")
    .option("--submitdata-file <path>", "从文件读取 submitdata（推荐：彻底绕开 PowerShell/bash 的 $ 变量展开问题）")
    .option("--udsid <n>", "用户系统ID", strictInt)
    .option("--sojumpparm <s>", "自定义参数")
    .option("--submittime <s>", "提交时间")
    .option("--jpmversion <n>", "问卷版本号；不传时默认自动从 getSurvey 取", strictInt)
    .option("--no-auto-version", "关闭自动获取 jpmversion（适用于显式传入或不需要校验场景）")
    .action(async (_opts, cmd) => {
      await executeRuntimeCommand(program, cmd, {
        normalize: ({ values }) => {
          requireField(values, "vid");
          requireField(values, "inputcosttime");
          if (typeof values.inputcosttime !== "number" ||
            !Number.isInteger(values.inputcosttime) || values.inputcosttime < 2) {
            throw new CliError("INPUT_ERROR", "--inputcosttime 必须是大于 1 的整数");
          }

          let submitdata = values.submitdata as string | undefined;
          const fileOpt = values.submitdataFile ?? values["submitdata-file"];
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
          if (!submitdata.includes("$")) {
            throw new CliError(
              "INPUT_ERROR",
              `submitdata 中未检测到任何 "$" 分隔符。问卷星答卷协议使用 "题序$答案" 格式（如 "1$男|2$跑步|3$5"），缺失 $ 几乎必然是 shell 转义问题。` +
              `修复建议：① Windows PowerShell 请用单引号 '...' 包裹；② 或改用 --submitdata-file <path>，从文件读取，彻底绕开 shell 转义；③ 运行 \`wjx response submit-template --vid <问卷ID>\` 获取可直接填充的模板。`,
            );
          }
          return {
            vid: values.vid,
            inputcosttime: values.inputcosttime,
            submitdata,
            udsid: values.udsid,
            sojumpparm: values.sojumpparm,
            submittime: values.submittime,
            jpmversion: values.jpmversion,
            autoVersion: values.autoVersion !== false,
          };
        },
        buildPlans: (input, context) => [buildRequestPlan({
          service: "default",
          action: Action.SUBMIT_RESPONSE,
          url: context?.apiUrl,
          body: {
            action: Action.SUBMIT_RESPONSE,
            vid: input.vid,
            inputcosttime: input.inputcosttime,
            submitdata: input.submitdata,
            udsid: input.udsid,
            sojumpparm: input.sojumpparm,
            submittime: input.submittime,
            jpmversion: input.jpmversion,
          },
          unresolved: input.autoVersion && input.jpmversion === undefined ? ["jpmversion"] : undefined,
        })],
        prepareExecute: async (input, creds, requestOptions) => {
          const explicitVersion = input.jpmversion;
          const autoVersion = (input as Record<string, unknown>).autoVersion !== false;
          // 仅在未显式传 jpmversion 且未关闭自动注入时才请求 getSurvey
          // 同时复用 getSurvey 结果做 submitdata 规范化
          let survey: Awaited<ReturnType<typeof getSurvey>> | null = null;
          // An explicit version is already caller-verified, so it must not
          // trigger a metadata prefetch. Submitdata normalization depends on
          // that same metadata and is intentionally skipped in this mode.
          if (explicitVersion === undefined && autoVersion) {
            survey = await getSurvey(
              { vid: input.vid as number },
              creds as WjxCredentials,
              undefined,
              requestOptions,
            );
            // Automatic version lookup is part of the submit safety contract.
            // Never fall through to a potentially stale or unverifiable submit.
            ensureApiSuccess(survey);
          }

          const data = survey?.data as {
            version?: number;
            questions?: Array<{ q_index: number; q_type: number; q_subtype: number }>;
          } | undefined;

          if (explicitVersion === undefined && autoVersion &&
            (!Number.isSafeInteger(data?.version) || (data?.version as number) <= 0)) {
            throw new CliError("API_ERROR", "自动获取问卷版本失败：API 响应缺少有效的正整数 version");
          }

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
        execute: (input, credentials, requestOptions) => {
          const finalInput = { ...input };
          delete finalInput.autoVersion;
          return submitResponse(finalInput as unknown as Parameters<typeof submitResponse>[0], credentials, undefined, requestOptions);
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
      await executeRuntimeAction(program, cmd, modifyResponse, (m) => {
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
      await executeRuntimeAction(program, cmd, clearResponses, (m) => {
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
      await executeRuntimeAction(program, cmd, getReport, (m) => {
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
          conds: ensureJsonArray(m.conds, "conds"),
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
      await executeRuntimeAction(program, cmd, getWinners, (m) => {
        requireField(m, "vid");
        if (m.page_index !== undefined) requirePositiveInt(m, "page_index");
        if (m.page_size !== undefined) requirePositiveInt(m, "page_size");
        if (m.atype !== undefined) requireEnum(m, "atype", [-1, 0, 1]);
        if (m.awardstatus !== undefined) requireEnum(m, "awardstatus", [-1, 0, 1]);
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
    .description("根据问卷结构生成 submitdata 模板：列出每题 1-based placeholder，AI 改成真实答案后即可调 submit；默认输出 ResultEnvelope")
    .option("--vid <n>", "问卷ID", strictInt)
    .option("--raw", "直接输出 submitdata 字符串（不包裹 JSON），便于重定向到文件")
    .action(async (_opts, cmd) => {
      try {
        const merged = getMerged(cmd);
        requireField(merged, "vid");
        const globalOpts = program.opts();

        if (globalOpts.dryRun) {
          const { fetchImpl, getCapturedRequest } = createCapturingFetch();
          const profile = resolveProfile({ profile: globalOpts.profile });
          await getSurvey(
            { vid: merged.vid as number, get_questions: true, get_items: true },
            applyProfileCredentials({ apiKey: "dry-run" }, profile),
            fetchImpl,
          );
          printDryRunPreview(getCapturedRequest(), globalOpts);
          return;
        }

        const creds = getCredentials(globalOpts);

        const survey = await getSurvey(
          { vid: merged.vid as number, get_questions: true, get_items: true },
          creds as WjxCredentials,
        );
        ensureApiSuccess(survey);
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

        if (merged.raw || globalOpts.format === "table") {
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
      await executeRuntimeAction(program, cmd, get360Report, (m) => {
        requireField(m, "vid");
        return { vid: m.vid, taskid: m.taskid };
      });
    });
}
