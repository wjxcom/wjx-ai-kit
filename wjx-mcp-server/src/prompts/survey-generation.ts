import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  WJX_XML_DSL_DIMENSION_EXAMPLE,
  WJX_XML_DSL_EXAM_NOTE,
  WJX_XML_DSL_FORMAT_INSTRUCTIONS,
  WJX_XML_DSL_NPS_EXAMPLE,
} from "./wjx-xml-dsl.js";

/**
 * Default survey-generation prompts use the versioned WJX XML DSL. JSONL
 * prompts live in survey-generation-json.ts and remain an explicit route.
 */
const DSL_FORMAT_INSTRUCTIONS = WJX_XML_DSL_FORMAT_INSTRUCTIONS;

// ─── Shared prompt fragments ────────────────────────────────────────

/** 基于主题的设计思路段（survey, NPS） */
const DESIGN_THINKING_TOPIC = `设计思路：如果用户没有给出调研目的，请根据主题推测出调研目的，然后结合主题和调研目的推测出场景和对象。然后根据目的、场景和对象，对主题进行分类。根据分类后的主题，从基本信息开始，逐步到意向、决策因素，然后是服务评估，最后是主观反馈。遵循逻辑顺序：按照主题分类从简单到复杂，从基本到敏感。`;

/** 基于维度的设计思路段（360, 满意度, 敬业度） */
const DESIGN_THINKING_DIMENSION = `设计思路：如果用户没有给出维度指标，请根据主题生成维度指标。然后根据主题和维度指标，推测出与主题相关的调研目的、场景和对象。根据维度指标及推测出的内容生成问卷内容。遵循逻辑顺序：按照维度指标从简单到复杂，从不敏感到敏感。`;

/** 题目数量说明 */
function questionCountInstruction(count: string | undefined, defaultN: string): string {
  return `生成的问卷包含 ${count ?? defaultN} 道题目，题目不要出现重复或无关的问题。`;
}

/** 默认选项说明（要求题目适配量表选项） */
function defaultScaleInstruction(scaleText: string): string {
  return `题目选项默认为"${scaleText}"，请按照此选项内容生成题目，题目需要合理，且必须可以适配默认选项。`;
}

/** 维度格式要求块（段落说明 + 量表题） */
function dimensionFormatBlock(scaleOptions: string): string {
  return `【格式要求】
- 每个维度用 page 或 cut 块作为维度标题
- 该维度下的题目使用完整的 question 块；矩阵量表使用 Mode=101
- 同一维度的题目放在一起
- 量表选项为：${scaleOptions}
- 具体块结构请遵守 wjx://reference/wjx-xml-dsl，不要退回旧文本标签`;
}

/** 考试题目质量要求 */
const EXAM_QUALITY_REQUIREMENTS = `题目质量要求：
1. 覆盖知识范围的核心概念，确保题目多样（如测试记忆、理解、应用能力）
2. 题目表述清晰、无歧义，避免文化或性别偏见
3. 简单题侧重基础事实，中等题涉及分析，困难题要求综合应用`;

/** 考试题型数量描述 */
function examCountInstruction(s?: string, m?: string, t?: string, f?: string): string {
  return `题型和数量��求：单选题 ${s ?? "10"} 题，多选题 ${m ?? "5"} 题，判断题 ${t ?? "5"} 题，填空题 ${f ?? "5"} 题。必须严格按照各题型对应的数量生成题目。`;
}

/** 考试题型说明 + 示例 */
function examFormatInstructions(titleLine: string): string {
  return `【考试题型额外说明】
- 单选题使用 question radio，多选题使用 question check，判断题用两个 item 表达，填空题使用 question question 或 gapfill
- 每道题都必须有唯一 Topic；选项使用 item 的 ItemTitle/ItemValue，不要使用字母前缀文本
- 考试标题：${titleLine}
${WJX_XML_DSL_EXAM_NOTE}`;
}

// ─── 360/满意度/敬业度共用的维度示例 ────────────────────────────────

const AGREE_SCALE = "非常同意、同意、一般、不同意、非常不同意";
const SATISFY_SCALE = "非常满意、满意、一般、不满意、非常不满意";

function agreeDimensionExample(title: string): string {
  return `示例主题：${title}\n${WJX_XML_DSL_DIMENSION_EXAMPLE}\n量表选项：${AGREE_SCALE}`;
}

// ─── Registration ───────────────────────────────────────────────────

export function registerSurveyGenerationPrompts(server: McpServer): void {
  // ═══ 1. Survey（通用调查问卷）═══════════════════════════════════════
  server.prompt(
    "generate-survey",
    "AI 生成调查/表单问卷（通用类型），自动创建到问卷星",
    {
      topic: z.string().describe("问卷主题（如：水果消费习惯、员工培训需求）"),
      question_count: z.string().optional().describe("题目数量（默认15）"),
      requirements: z.string().optional().describe("额外要求（如：侧重满意度、增加开放题）"),
    },
    async ({ topic, question_count, requirements }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `你是一名问卷调研专家，请根据主题「${topic}」生成一份问卷。${requirements ? `额外要求：${requirements}` : ""}

${DESIGN_THINKING_TOPIC}

生成的问卷总题数为 ${question_count ?? "15"} 道题目，题目不要出现重复或无关的问题。

题目顺序与数量比例按先后顺序依次为：单选题（35%），多选题（30%），量表题（10%），矩阵单选题（10%），矩阵量表题（5%），排序题（5%），填空题（5%）。同一题型需要集中排列，不同题型不能穿插，填空题放在问卷尾部，每个题型都必须包含。${DSL_FORMAT_INSTRUCTIONS}`,
        },
      }],
    }),
  );

  // ═══ 2. NPSSurvey（NPS 问卷）══════════════════════════════════════
  server.prompt(
    "generate-nps-survey",
    "AI 生成 NPS（净推荐值）调查问卷",
    {
      topic: z.string().describe("问卷主题（如：产品体验、客户服务满意度）"),
      question_count: z.string().optional().describe("题目数量（默认15）"),
      requirements: z.string().optional().describe("额外要求"),
    },
    async ({ topic, question_count, requirements }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `你擅长设计 NPS 调查问卷，请根据主题「${topic}」生成一份问卷。${requirements ? `额外要求：${requirements}` : ""}

${DESIGN_THINKING_TOPIC}

${questionCountInstruction(question_count, "15")}

请根据行业经验合理分配题型顺序与数量，相同题型放在一起，填空题放在问卷尾部。

【NPS 核心要求】问卷中必须包含一个 0-10 共 11 个选项的 NPS 问题。不要使用旧的 [量表题] 文本标签；使用 WJX XML DSL 的 question radio 和 ItemValue 表达：
${WJX_XML_DSL_NPS_EXAMPLE}${DSL_FORMAT_INSTRUCTIONS}`,
        },
      }],
    }),
  );

  // ═══ 3. Estimate360（360度评估）═════════════════════════════════════
  server.prompt(
    "generate-360-evaluation",
    "AI 生成 360度评估/民主评议/人才盘点/教学评估问卷",
    {
      evaluation_type: z.string().describe("评估类型（如：360度评估、民主评议、人才盘点、教学评估）"),
      topic: z.string().describe("评估主题"),
      dimensions: z.string().optional().describe("维度指标（逗号分隔，如：领导力,沟通能力,专业技能）"),
      question_count: z.string().optional().describe("题目数量（默认20）"),
    },
    async ({ evaluation_type, topic, dimensions, question_count }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `你是一名 HR 专家，你擅长设计「${evaluation_type}」调查问卷。请根据问卷主题「${topic}」${dimensions ? `，维度指标：${dimensions}` : ""}生成一份问卷。

${DESIGN_THINKING_DIMENSION}

${questionCountInstruction(question_count, "20")}

${defaultScaleInstruction(AGREE_SCALE)}

${dimensionFormatBlock(AGREE_SCALE)}

${agreeDimensionExample(`${evaluation_type} - ${topic}`)}${DSL_FORMAT_INSTRUCTIONS}`,
        },
      }],
    }),
  );

  // ═══ 4. SatisSurvey（满意度调查）═══════════════════════════════════
  server.prompt(
    "generate-satisfaction-survey",
    "AI 生成员工满意度/客户满意度/客户旅程管理问卷",
    {
      satisfaction_type: z.string().describe("满意度类型（如：员工满意度、客户满意度、客户旅程管理）"),
      topic: z.string().describe("调查主题"),
      dimensions: z.string().optional().describe("维度指标（逗号分隔，如：薪酬,工作环境,职业发展）"),
      question_count: z.string().optional().describe("题目数量（默认20）"),
    },
    async ({ satisfaction_type, topic, dimensions, question_count }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `你是一名市场调研专家，你擅长设计「${satisfaction_type}」调查问卷。请根据问卷主题「${topic}」${dimensions ? `，维度指标：${dimensions}` : ""}生成一份问卷。

${DESIGN_THINKING_DIMENSION}

${questionCountInstruction(question_count, "20")}

${defaultScaleInstruction(SATISFY_SCALE)}

${dimensionFormatBlock(SATISFY_SCALE)}

${agreeDimensionExample(`${satisfaction_type} - ${topic}`)}${DSL_FORMAT_INSTRUCTIONS}`,
        },
      }],
    }),
  );

  // ═══ 5. EmpEngageSurvey（敬业度调查）═══════════════════════════════
  server.prompt(
    "generate-engagement-survey",
    "AI 生成员工敬业度调查问卷",
    {
      topic: z.string().describe("调查主题（如：2024年度员工敬业度调查）"),
      dimensions: z.string().optional().describe("维度指标（逗号分隔，如：工作投入,组织认同,团队协作）"),
      question_count: z.string().optional().describe("题目数量（默认20）"),
    },
    async ({ topic, dimensions, question_count }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `你是一名 HR 专家，你擅长设计「员工敬业度调查」问卷。请根据问卷主题「${topic}」${dimensions ? `，维度指标：${dimensions}` : ""}生成一份问卷。

${DESIGN_THINKING_DIMENSION}

${questionCountInstruction(question_count, "20")}

${defaultScaleInstruction(AGREE_SCALE)}

${dimensionFormatBlock(AGREE_SCALE)}

${agreeDimensionExample(`员工敬业度调查 - ${topic}`)}${DSL_FORMAT_INSTRUCTIONS}`,
        },
      }],
    }),
  );

  // ═══ 6. AICreateExamExcel（从文档创建考试）═════════════════════════
  server.prompt(
    "generate-exam-from-document",
    "从用户提供的资料文档中 AI 生成考试题目",
    {
      single_count: z.string().optional().describe("单选题数量（默认10）"),
      multi_count: z.string().optional().describe("多选题数量（默认5）"),
      truefalse_count: z.string().optional().describe("判断题数量（默认5）"),
      fillin_count: z.string().optional().describe("填空题数量（默认5）"),
    },
    async ({ single_count, multi_count, truefalse_count, fillin_count }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `你是一个考试出题人，我会给你一段资料，请从资料中生成一套结构化、高质量的考试题目，只能生成单选题、多选题、判断题、填空题。

${EXAM_QUALITY_REQUIREMENTS}

${examCountInstruction(single_count, multi_count, truefalse_count, fillin_count)}

请等待用户提供资料文档后再生成题目。${DSL_FORMAT_INSTRUCTIONS}

${examFormatInstructions("期末考试")}

【重要提示】考试问卷的正确答案和每题分值无法通过 API 设置。创建考试后请使用 build_preview_url 或 build_survey_url(mode=edit) 提供链接，指引用户在网页端设置答案与评分。`,
        },
      }],
    }),
  );

  // ═══ 7. AICreateExamExcelKnow（从知识库创建考试）═══════════════════
  server.prompt(
    "generate-exam-from-knowledge",
    "从公共知识库 AI 生成考试题目（无需提供文档）",
    {
      knowledge_scope: z.string().describe("知识范围（如：高中物理力学、Python基础语法）"),
      single_count: z.string().optional().describe("单选题数量（默认10）"),
      multi_count: z.string().optional().describe("多选题数量（默认5）"),
      truefalse_count: z.string().optional().describe("判断题数量（默认5）"),
      fillin_count: z.string().optional().describe("填空题数量（默认5）"),
    },
    async ({ knowledge_scope, single_count, multi_count, truefalse_count, fillin_count }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `你是一个考试出题人，请根据知识范围「${knowledge_scope}」，使用你所掌握的知识生成一套结构化、高质量的考试题目。

${EXAM_QUALITY_REQUIREMENTS}

${examCountInstruction(single_count, multi_count, truefalse_count, fillin_count)}${DSL_FORMAT_INSTRUCTIONS}

${examFormatInstructions(`${knowledge_scope} - 考试`)}

【重要提示】考试问卷的正确答案和每题分值无法通过 API 设置。创建考试后请使用 build_preview_url 或 build_survey_url(mode=edit) 提供链接，指引用户在网页端设置答案与评分。`,
        },
      }],
    }),
  );
}