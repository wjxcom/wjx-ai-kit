import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerAnalysisPrompts } from "./analysis.js";

export function registerPrompts(server: McpServer): void {
  server.prompt(
    "design-survey",
    "引导 AI 设计问卷结构，包含题型选择、逻辑跳转和选项设计",
    {
      topic: z.string().describe("问卷主题（如：员工满意度、客户反馈、产品调研）"),
      target_audience: z.string().optional().describe("目标受众（如：企业员工、消费者、学生）"),
      survey_type: z.string().optional().describe("问卷类型：调查/测评/考试/投票/表单"),
    },
    async ({ topic, target_audience, survey_type }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `请帮我设计一份关于「${topic}」的${survey_type ?? "调查"}问卷。

目标受众：${target_audience ?? "通用"}

请按以下结构输出：
1. 问卷标题和描述
2. 题目列表（每题包含：题型、标题、选项/填空说明、是否必填）
3. 建议的逻辑跳转规则
4. 最终输出符合问卷星 create_survey 工具 questions 参数格式的 JSON

题型参考（q_type 编码）：单选题(3)、多选题(4)、填空题(5)、多项填空(6)、矩阵题(7)、文件上传(8)、比重题(9)、滑动条(10)、分页(1)、段落(2)
题目细分类型（q_subtype）：下拉框(301)、量表题(302)、评分单选(303)、情景题(304)、判断题(305)、评分多选(401)、排序题(402)、商品题(403)

每个题目必须包含 q_index（题号）和 q_type（题型编码）。选择题需包含 items 数组，每个选项包含 q_index、item_index、item_title。`,
        },
      }],
    }),
  );

  server.prompt(
    "analyze-results",
    "引导 AI 获取并分析问卷数据，生成洞察报告",
    {
      survey_id: z.string().describe("问卷编号 (vid)"),
      focus_areas: z.string().optional().describe("关注重点（如：满意度趋势、NPS 分析、交叉分析）"),
    },
    async ({ survey_id, focus_areas }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `请分析问卷 ${survey_id} 的答卷数据。

${focus_areas ? `关注重点：${focus_areas}` : ""}

请按以下步骤操作：
1. 先用 get_survey 获取问卷结构
2. 用 get_report 获取统计报告
3. 如需详细数据，用 query_responses 获取答卷明细
4. 基于数据生成分析报告，包含：
   - 关键数据概览（回收量、完成率、平均用时）
   - 各题统计分析（频率分布、均值、标准差）
   - 关键发现与洞察
   - 改进建议`,
        },
      }],
    }),
  );

  server.prompt(
    "create-nps-survey",
    "一键创建标准 NPS（净推荐值）问卷",
    {
      product_name: z.string().describe("产品或服务名称"),
      language: z.string().optional().describe("问卷语言：zh（默认）或 en"),
    },
    async ({ product_name, language }) => {
      const isEn = language === "en";
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: isEn
              ? `Please create a standard NPS survey for "${product_name}" using the create_survey tool.

The survey should include:
1. NPS Question: "How likely are you to recommend ${product_name} to a friend or colleague?" (Scale 0-10)
2. Follow-up: "What is the primary reason for your score?" (Open text)
3. Optional: "What could we improve?" (Open text)

Use survey type 1 (survey) and output the create_survey tool call with properly formatted questions JSON.`
              : `请使用 create_survey 工具为「${product_name}」创建一份标准 NPS 问卷。

问卷应包含：
1. NPS 核心题：「您有多大可能向朋友或同事推荐${product_name}？」（0-10分量表）
2. 跟进题：「您给出这个评分的主要原因是什么？」（填空题）
3. 可选：「您觉得我们还可以在哪些方面改进？」（填空题）

使用问卷类型 1（调查），输出 create_survey 工具调用，questions 参数为正确格式的 JSON。`,
          },
        }],
      };
    },
  );

  // ═══ Analysis Prompts ══════════════════════════════════════════════════
  registerAnalysisPrompts(server);
}
