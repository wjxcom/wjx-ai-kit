import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  decodeResponses,
  calculateNps,
  calculateCsat,
  detectAnomalies,
  compareMetrics,
} from "./compute.js";
import { toolResult, toolError } from "../../helpers.js";
import { decodePushPayload } from "wjx-api-sdk";

export function registerAnalyticsTools(server: McpServer): void {
  // ─── decode_push_payload ──────────────────────────────────────────
  server.registerTool(
    "decode_push_payload",
    {
      title: "解密推送载荷",
      description: "解密问卷星 AES-128-CBC 推送载荷，并可校验 SHA1(rawBody + appKey) 签名。纯本地计算，不调用 API。",
      inputSchema: {
        encrypted_data: z.string().min(1).describe("加密推送数据（Base64）"),
        app_key: z.string().min(1).describe("问卷星应用密钥"),
        signature: z.string().optional().describe("可选签名"),
        raw_body: z.string().optional().describe("参与签名校验的原始请求体"),
      },
      annotations: {
        openWorldHint: false,
        destructiveHint: false,
        idempotentHint: true,
        title: "解密推送载荷",
      },
    },
    async (args) => {
      try {
        return toolResult(decodePushPayload(args.encrypted_data, args.app_key, args.signature, args.raw_body), false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── decode_responses ──────────────────────────────────────────────
  server.registerTool(
    "decode_responses",
    {
      title: "解码答卷数据",
      description:
        "解析问卷星 submitdata 格式（题号$答案}题号$答案），识别单选、多选（管道符分隔）、填空和矩阵题型。纯本地计算，不调用 API。",
      inputSchema: {
        submitdata: z.string().describe("问卷星原始 submitdata 字符串，格式为 题号$答案}题号$答案"),
      },
      annotations: {
        openWorldHint: false,
        destructiveHint: false,
        idempotentHint: true,
        title: "解码答卷数据",
      },
    },
    async (args) => {
      try {
        const result = decodeResponses(args.submitdata);
        return toolResult(result, false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── calculate_nps ─────────────────────────────────────────────────
  server.registerTool(
    "calculate_nps",
    {
      title: "计算 NPS 净推荐值",
      description:
        "根据 0-10 评分数组计算 NPS（净推荐值），输出推荐者/中立者/贬损者数量与比例，以及评级（>70优秀, 50-70良好, 0-50一般, <0较差）。纯本地计算。",
      inputSchema: {
        scores: z.array(z.number().int().min(0).max(10)).describe("0-10 评分数组"),
      },
      annotations: {
        openWorldHint: false,
        destructiveHint: false,
        idempotentHint: true,
        title: "计算 NPS",
      },
    },
    async (args) => {
      try {
        const result = calculateNps(args.scores);
        return toolResult(result, false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── calculate_csat ────────────────────────────────────────────────
  server.registerTool(
    "calculate_csat",
    {
      title: "计算 CSAT 满意度",
      description:
        "根据评分数组计算 CSAT（客户满意度），支持 5 分制（4-5 为满意）和 7 分制（5-7 为满意）。输出满意率、满意人数、分值分布。纯本地计算。",
      inputSchema: {
        scores: z.array(z.number().int().min(1).max(7)).describe("评分数组（5分制: 1-5, 7分制: 1-7）"),
        scale_type: z
          .enum(["5-point", "7-point"])
          .optional()
          .default("5-point")
          .describe("量表类型：5-point（默认）或 7-point"),
      },
      annotations: {
        openWorldHint: false,
        destructiveHint: false,
        idempotentHint: true,
        title: "计算 CSAT",
      },
    },
    async (args) => {
      try {
        const result = calculateCsat(args.scores, args.scale_type);
        return toolResult(result, false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── detect_anomalies ──────────────────────────────────────────────
  server.registerTool(
    "detect_anomalies",
    {
      title: "检测异常答卷",
      description:
        "检测异常答卷：直线作答（所有答案相同）、速度异常（答题时间 < 中位数 30%）、IP+内容重复。纯本地计算。",
      inputSchema: {
        responses: z
          .array(
            z.object({
              id: z
                .union([z.string(), z.number()])
                .optional()
                .describe("答卷 ID；未提供时使用 jid 或数组序号"),
              jid: z
                .union([z.string(), z.number()])
                .optional()
                .describe("问卷星 API 返回的答卷 ID"),
              answers: z
                .array(z.unknown())
                .optional()
                .describe("答案数组"),
              submitdata: z
                .string()
                .optional()
                .describe("问卷星原始 submitdata；未提供 answers 时自动解码"),
              duration_seconds: z
                .union([z.number(), z.string()])
                .optional()
                .describe("规范化答题时长（秒）"),
              inputcosttime: z
                .union([z.number(), z.string()])
                .optional()
                .describe("问卷星 API 的答题时长（秒）；未提供 duration_seconds 时使用"),
              ip: z.string().optional().describe("IP 地址"),
            }).passthrough(),
          )
          .describe("答卷记录数组"),
      },
      annotations: {
        openWorldHint: false,
        destructiveHint: false,
        idempotentHint: true,
        title: "检测异常答卷",
      },
    },
    async (args) => {
      try {
        const result = detectAnomalies(args.responses);
        return toolResult(result, false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── compare_metrics ───────────────────────────────────────────────
  server.registerTool(
    "compare_metrics",
    {
      title: "对比指标数据",
      description:
        "对比两组指标数据（A/B），输出每个指标的差值、变化率和显著性标记（|变化率|>10% 为显著）。纯本地计算。",
      inputSchema: {
        set_a: z.record(z.string(), z.number()).describe("指标集 A（键为指标名，值为数值）"),
        set_b: z.record(z.string(), z.number()).describe("指标集 B（键为指标名，值为数值）"),
      },
      annotations: {
        openWorldHint: false,
        destructiveHint: false,
        idempotentHint: true,
        title: "对比指标数据",
      },
    },
    async (args) => {
      try {
        const result = compareMetrics(args.set_a, args.set_b);
        return toolResult(result, false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

}
