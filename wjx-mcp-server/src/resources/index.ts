import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  SURVEY_TYPES,
  QUESTION_TYPES,
  SURVEY_STATUSES,
  VERIFY_STATUSES,
} from "./survey-reference.js";
import {
  ANALYSIS_METHODS,
  RESPONSE_FORMAT_GUIDE,
} from "./analysis-reference.js";
import { PUSH_FORMAT_GUIDE } from "./push-reference.js";

function formatResource(data: Record<string, unknown>): string {
  return JSON.stringify(data, null, 2);
}

export function registerResources(server: McpServer): void {
  server.resource(
    "survey-types",
    "wjx://reference/survey-types",
    { description: "问卷星支持的问卷类型列表（调查/测评/投票/考试/表单等）", mimeType: "application/json" },
    async () => ({
      contents: [{
        uri: "wjx://reference/survey-types",
        mimeType: "application/json",
        text: formatResource(SURVEY_TYPES),
      }],
    }),
  );

  server.resource(
    "question-types",
    "wjx://reference/question-types",
    { description: "问卷星题目类型与细分类型完整列表", mimeType: "application/json" },
    async () => ({
      contents: [{
        uri: "wjx://reference/question-types",
        mimeType: "application/json",
        text: formatResource(QUESTION_TYPES),
      }],
    }),
  );

  server.resource(
    "survey-statuses",
    "wjx://reference/survey-statuses",
    { description: "问卷状态与审核状态编码说明", mimeType: "application/json" },
    async () => ({
      contents: [{
        uri: "wjx://reference/survey-statuses",
        mimeType: "application/json",
        text: formatResource({ survey_statuses: SURVEY_STATUSES, verify_statuses: VERIFY_STATUSES }),
      }],
    }),
  );

  server.resource(
    "analysis-methods",
    "wjx://reference/analysis-methods",
    { description: "NPS/CSAT/CES 分析方法的计算公式与行业基准", mimeType: "application/json" },
    async () => ({
      contents: [{
        uri: "wjx://reference/analysis-methods",
        mimeType: "application/json",
        text: formatResource(ANALYSIS_METHODS),
      }],
    }),
  );

  server.resource(
    "response-format",
    "wjx://reference/response-format",
    { description: "问卷星答卷 submitdata 字段的编码格式说明", mimeType: "application/json" },
    async () => ({
      contents: [{
        uri: "wjx://reference/response-format",
        mimeType: "application/json",
        text: formatResource(RESPONSE_FORMAT_GUIDE),
      }],
    }),
  );

  server.resource(
    "user-roles",
    "wjx://reference/user-roles",
    { description: "多账号子账号角色编码说明", mimeType: "application/json" },
    async () => ({
      contents: [{
        uri: "wjx://reference/user-roles",
        mimeType: "application/json",
        text: formatResource({
          "1": "系统管理员",
          "2": "问卷管理员",
          "3": "统计结果查看员",
          "4": "完整结果查看员",
        }),
      }],
    }),
  );

  server.resource(
    "push-format",
    "wjx://reference/push-format",
    { description: "问卷星数据推送格式、AES加密与签名验证说明", mimeType: "application/json" },
    async () => ({
      contents: [{
        uri: "wjx://reference/push-format",
        mimeType: "application/json",
        text: formatResource(PUSH_FORMAT_GUIDE),
      }],
    }),
  );
}
