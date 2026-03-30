import { Command } from "commander";
import {
  decodeResponses,
  calculateNps,
  calculateCsat,
  detectAnomalies,
  compareMetrics,
  decodePushPayload,
} from "wjx-api-sdk";
import { formatOutput } from "../lib/output.js";
import { CliError, handleError } from "../lib/errors.js";
import { mergeStdinWithOpts } from "../lib/stdin.js";
import { requireField } from "../lib/command-helpers.js";

/**
 * Helper to get merged opts from stdin or CLI.
 */
function getMerged(cmd: Command): Record<string, unknown> {
  const stdinData = (cmd as unknown as Record<string, unknown>).__stdinData as Record<string, unknown> | undefined;
  if (stdinData && Object.keys(stdinData).length > 0) {
    return mergeStdinWithOpts(stdinData, cmd);
  }
  return { ...cmd.opts() };
}

export function registerAnalyticsCommands(program: Command): void {
  const analytics = program.command("analytics").description("数据分析");

  // --- decode ---
  analytics
    .command("decode")
    .description("解码答卷提交数据")
    .option("--submitdata <s>", "提交数据字符串")
    .action(async (_opts, cmd) => {
      try {
        const m = getMerged(cmd);
        requireField(m, "submitdata");
        const result = decodeResponses(m.submitdata as string);
        formatOutput(result, program.opts());
      } catch (e) {
        handleError(e);
      }
    });

  // --- nps ---
  analytics
    .command("nps")
    .description("计算NPS分数")
    .option("--scores <json>", "评分JSON数组")
    .action(async (_opts, cmd) => {
      try {
        const m = getMerged(cmd);
        requireField(m, "scores");
        const scores = JSON.parse(m.scores as string) as number[];
        if (!Array.isArray(scores)) {
          throw new CliError("INPUT_ERROR", "--scores must be a JSON array of numbers");
        }
        const result = calculateNps(scores);
        formatOutput(result, program.opts());
      } catch (e) {
        handleError(e);
      }
    });

  // --- csat ---
  analytics
    .command("csat")
    .description("计算CSAT分数")
    .option("--scores <json>", "评分JSON数组")
    .option("--scale <s>", "量表类型: 5-point 或 7-point", "5-point")
    .action(async (_opts, cmd) => {
      try {
        const m = getMerged(cmd);
        requireField(m, "scores");
        const scores = JSON.parse(m.scores as string) as number[];
        if (!Array.isArray(scores)) {
          throw new CliError("INPUT_ERROR", "--scores must be a JSON array of numbers");
        }
        const result = calculateCsat(scores, m.scale as "5-point" | "7-point");
        formatOutput(result, program.opts());
      } catch (e) {
        handleError(e);
      }
    });

  // --- anomalies ---
  analytics
    .command("anomalies")
    .description("检测异常答卷")
    .option("--responses <json>", "答卷数据JSON数组")
    .action(async (_opts, cmd) => {
      try {
        const m = getMerged(cmd);
        requireField(m, "responses");
        const responses = JSON.parse(m.responses as string);
        if (!Array.isArray(responses)) {
          throw new CliError("INPUT_ERROR", "--responses must be a JSON array");
        }
        const result = detectAnomalies(responses);
        formatOutput(result, program.opts());
      } catch (e) {
        handleError(e);
      }
    });

  // --- compare ---
  analytics
    .command("compare")
    .description("对比两组指标")
    .option("--set_a <json>", "指标集A JSON对象")
    .option("--set_b <json>", "指标集B JSON对象")
    .action(async (_opts, cmd) => {
      try {
        const m = getMerged(cmd);
        requireField(m, "set_a");
        requireField(m, "set_b");
        const setA = JSON.parse(m.set_a as string) as Record<string, number>;
        const setB = JSON.parse(m.set_b as string) as Record<string, number>;
        const result = compareMetrics(setA, setB);
        formatOutput(result, program.opts());
      } catch (e) {
        handleError(e);
      }
    });

  // --- decode-push ---
  analytics
    .command("decode-push")
    .description("解码推送回调数据")
    .option("--payload <s>", "加密数据")
    .option("--app_key <s>", "AppKey")
    .option("--signature <s>", "签名")
    .option("--raw_body <s>", "原始请求体")
    .action(async (_opts, cmd) => {
      try {
        const m = getMerged(cmd);
        requireField(m, "payload");
        requireField(m, "app_key");
        const result = decodePushPayload(
          m.payload as string,
          m.app_key as string,
          m.signature as string | undefined,
          m.raw_body as string | undefined,
        );
        formatOutput(result, program.opts());
      } catch (e) {
        handleError(e);
      }
    });
}
