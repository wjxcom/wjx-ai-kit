import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  SURVEY_TYPES,
  QUESTION_TYPES,
  SURVEY_STATUSES,
  VERIFY_STATUSES,
  STATUS_TRANSITIONS,
  TEXT_VALIDATION_TYPES,
  MATRIX_DISPLAY_TYPES,
  TABLE_DISPLAY_TYPES,
  SURVEY_SETTING_TYPES,
} from "./survey-reference.js";
import {
  ANALYSIS_METHODS,
  RESPONSE_FORMAT_GUIDE,
} from "./analysis-reference.js";
import { PUSH_FORMAT_GUIDE } from "./push-reference.js";
import { JSONL_QTYPES_RESOURCE } from "./jsonl-qtypes.js";

function formatResource(data: Record<string, unknown>): string {
  return JSON.stringify(data, null, 2);
}

export function registerResources(server: McpServer): void {
  server.resource(
    "jsonl-qtypes",
    "wjx://reference/jsonl-qtypes",
    { description: "JSONL 创建 qtype 能力与分层；区别于 get_survey 返回的 q_type/q_subtype 数字编码，并标明草稿/Web 编辑器限制", mimeType: "application/json" },
    async () => ({ contents: [{ uri: "wjx://reference/jsonl-qtypes", mimeType: "application/json", text: formatResource(JSONL_QTYPES_RESOURCE) }] }),
  );

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
    { description: "问卷详情返回的 q_type/q_subtype 读取编码映射；不是 JSONL 创建题型白名单", mimeType: "application/json" },
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
    { description: "问卷状态编码说明：0=未发布, 1=已发布, 2=已暂停, 3=已删除（回收站，可恢复）, 4=彻底删除（不可恢复）, 5=被审核", mimeType: "application/json" },
    async () => ({
      contents: [{
        uri: "wjx://reference/survey-statuses",
        mimeType: "application/json",
        text: formatResource({ survey_statuses: SURVEY_STATUSES, verify_statuses: VERIFY_STATUSES, status_transitions: STATUS_TRANSITIONS }),
      }],
    }),
  );

  server.resource(
    "text-validation-types",
    "wjx://reference/text-validation-types",
    { description: "文本题校验类型编码（题目设置/读取结果）", mimeType: "application/json" },
    async () => ({
      contents: [{
        uri: "wjx://reference/text-validation-types",
        mimeType: "application/json",
        text: formatResource(TEXT_VALIDATION_TYPES),
      }],
    }),
  );

  server.resource(
    "matrix-display-types",
    "wjx://reference/matrix-display-types",
    { description: "矩阵题展现形式编码", mimeType: "application/json" },
    async () => ({
      contents: [{
        uri: "wjx://reference/matrix-display-types",
        mimeType: "application/json",
        text: formatResource(MATRIX_DISPLAY_TYPES),
      }],
    }),
  );

  server.resource(
    "table-display-types",
    "wjx://reference/table-display-types",
    { description: "表格题展现形式编码", mimeType: "application/json" },
    async () => ({
      contents: [{
        uri: "wjx://reference/table-display-types",
        mimeType: "application/json",
        text: formatResource(TABLE_DISPLAY_TYPES),
      }],
    }),
  );

  server.resource(
    "survey-setting-types",
    "wjx://reference/survey-setting-types",
    { description: "问卷设置内容类型编码（additional_setting）", mimeType: "application/json" },
    async () => ({
      contents: [{
        uri: "wjx://reference/survey-setting-types",
        mimeType: "application/json",
        text: formatResource(SURVEY_SETTING_TYPES),
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
