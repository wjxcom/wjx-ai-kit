import { z } from "zod";
/**
 * Common DSL format instructions appended to all survey-generation prompts.
 * Ensures AI output is compatible with the textToSurvey parser.
 */
const DSL_FORMAT_INSTRUCTIONS = `

【输出格式要求 — 严格遵守】
你生成的问卷内容必须符合以下 DSL 格式，以便系统自动解析创建问卷：

1. 第一行为问卷标题（纯文本，不带编号）
2. 第二行为问卷描述（可为空）
3. 每道题格式：题号.题干[题型标签]，如 \`1. 您的性别？[单选题]\`
4. 选项紧跟题目，每行一个，可带字母前缀（如 A 男）
5. 题目之间用空行分隔
6. 支持的题型标签：[单选题]、[多选题]、[填空题]、[量表题]、[矩阵单选题]、[矩阵量表题]、[矩阵多选题]、[排序题]、[判断题]、[段落说明]、[下拉框]、[滑动条]、[多项填空题]、[文件上传]、[比重题]
7. 矩阵题格式：第一行为空格分隔的列头（如"很不满意 不满意 一般 满意 很满意"），后续每行为一个行标题
8. 量表题格式：每个量表选项独立一行
9. 默认所有题目必答。除非用户明确要求“选填/可选/非必答”，否则不要给题目加“（选填）”标记；简答题和建议题默认也必须是必答题

示例：
员工满意度调查

1. 您的部门？[单选题]
A 技术部
B 市场部
C 人力资源部
D 财务部

2. 您对公司以下方面的满意程度？[矩阵量表题]
非常不满意 不满意 一般 满意 非常满意
办公环境
薪酬福利
团队氛围

3. 您对公司整体满意度如何？[量表题]
非常不满意
不满意
一般
满意
非常满意

4. 请问您还有其他建议？[填空题]

【重要】生成完成后，请直接调用 create_survey_by_text 工具，将上述 DSL 文本作为 text 参数传入以创建问卷。`;
// ─── Shared prompt fragments ────────────────────────────────────────
/** 基于主题的设计思路段（survey, NPS） */
const DESIGN_THINKING_TOPIC = `设计思路：如果用户没有给出调研目的，请根据主题推测出调研目的，然后结合主题和调研目的推测出场景和对象。然后根据目的、场景和对象，对主题进行分类。根据分类后的主题，从基本信息开始，逐步到意向、决策因素，然后是服务评估，最后是主观反馈。遵循逻辑顺序：按照主题分类从简单到复杂，从基本到敏感。`;
/** 基于维度的设计思路段（360, 满意度, 敬业度） */
const DESIGN_THINKING_DIMENSION = `设计思路：如果用户没有给出维度指标，请根据主题生成维度指标。然后根据主题和维度指标，推测出与主题相关的调研目的、场景和对象。根据维度指标及推测出的内容生成问卷内容。遵循逻辑顺序：按照维度指标从简单到复杂，从不敏感到敏感。`;
/** 题目数量说明 */
function questionCountInstruction(count, defaultN) {
    return `生成的问卷包含 ${count ?? defaultN} 道题目，题目不要出现重复或无关的问题。`;
}
/** 默认选项说明（要求题目适配量表选项） */
function defaultScaleInstruction(scaleText) {
    return `题目选项默认为"${scaleText}"，请按照此选项内容生成题目，题目需要合理，且必须可以适配默认选项。`;
}
/** 维度格式要求块（段落说明 + 量表题） */
function dimensionFormatBlock(scaleOptions) {
    return `【格式要求】
- 每个维度用一道 [段落说明] 题作为维度标题
- 该维度下的题目使用 [量表题] 标签
- 同一维度的题目放在一起
- 量表选项为：${scaleOptions}`;
}
/** 考试题目质量要求 */
const EXAM_QUALITY_REQUIREMENTS = `题目质量要求：
1. 覆盖知识范围的核心概念，确保题目多样（如测试记忆、理解、应用能力）
2. 题目表述清晰、无歧义，避免文化或性别偏见
3. 简单题侧重基础事实，中等题涉及分析，困难题要求综合应用`;
/** 考试题型数量描述 */
function examCountInstruction(s, m, t, f) {
    return `题型和数量��求：单选题 ${s ?? "10"} 题，多选题 ${m ?? "5"} 题，判断题 ${t ?? "5"} 题，填空题 ${f ?? "5"} 题。必须严格按照各题型对应的数量生成题目。`;
}
/** 考试题型说明 + 示例 */
function examFormatInstructions(titleLine) {
    return `【考试题型额外说明】
- 单选题使用 [单选题] 标签，选项带字母前缀
- 多选题使用 [多选题] 标签，选项带字母前缀
- 判断题使用 [判断题] 标签，选项为"A 正确"和"B 错误"
- 填空题使用 [填空题] 标签，无选项

考试问卷示例：
${titleLine}

1. 以下哪个是中国的首都？[单选题]
A 北京
B 上海
C 广州
D 深圳

2. 以下哪些是编程语言？[多选题]
A Python
B HTML
C Java
D CSS

3. 地球是太阳系中最大的行星[判断题]
A 正确
B 错误

4. 中国的四大发明是造纸术、印刷术、火药和____[填空题]`;
}
// ─── 360/满意度/敬业度共用的维度示例 ────────────────────────────────
const AGREE_SCALE = "非常同意、同意、一般、不同意、非常不同意";
const SATISFY_SCALE = "非常满意、满意、一般、不满意、非常不满意";
function agreeDimensionExample(title) {
    return `示例格式：
${title}

1. 企业管理[段落说明]

2. 公司内部沟通渠道顺畅，我能够及时有效地传递我的想法[量表题]
非常同意
同意
一般
不同意
非常不同意`;
}
// ─── Registration ───────────────────────────────────────────────────
export function registerSurveyGenerationPrompts(server) {
    // ═══ 1. Survey（通用调查问卷）═══════════════════════════════════════
    server.prompt("generate-survey", "AI 生成调查/表单问卷（通用类型），自动创建到问卷星", {
        topic: z.string().describe("问卷主题（如：水果消费习惯、员工培训需求）"),
        question_count: z.string().optional().describe("题目数量（默认15）"),
        requirements: z.string().optional().describe("额外要求（如：侧重满意度、增加开放题）"),
    }, async ({ topic, question_count, requirements }) => ({
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
    }));
    // ═══ 2. NPSSurvey（NPS 问卷）══════════════════════════════════════
    server.prompt("generate-nps-survey", "AI 生成 NPS（净推荐值）调查问卷", {
        topic: z.string().describe("问卷主题（如：产品体验、客户服务满意度）"),
        question_count: z.string().optional().describe("题目数量（默认15）"),
        requirements: z.string().optional().describe("额外要求"),
    }, async ({ topic, question_count, requirements }) => ({
        messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: `你擅长设计 NPS 调查问卷，请根据主题「${topic}」生成一份问卷。${requirements ? `额外要求：${requirements}` : ""}

${DESIGN_THINKING_TOPIC}

${questionCountInstruction(question_count, "15")}

请根据行业经验合理分配题型顺序与数量，相同题型放在一起，填空题放在问卷尾部。

【NPS 核心要求】问卷中必须包含一个专业净推荐值（NPS）问题，使用 [量表题] 标签，包含 0-10 共 11 个选项。

NPS 题示例：
X. 您愿意向同事推荐我们的服务吗？[量表题]
非常不愿意
0
1
2
3
4
5
6
7
8
9
10
非常愿意${DSL_FORMAT_INSTRUCTIONS}`,
                },
            }],
    }));
    // ═══ 3. Estimate360（360度评估）═════════════════════════════════════
    server.prompt("generate-360-evaluation", "AI 生成 360度评估/民主评议/人才盘点/教学评估问卷", {
        evaluation_type: z.string().describe("评估类型（如：360度评估、民主评议、人才盘点、教学评估）"),
        topic: z.string().describe("评估主题"),
        dimensions: z.string().optional().describe("维度指标（逗号分隔，如：领导力,沟通能力,专业技能）"),
        question_count: z.string().optional().describe("题目数量（默认20）"),
    }, async ({ evaluation_type, topic, dimensions, question_count }) => ({
        messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: `你是一名 HR 专家，你擅长设计「${evaluation_type}」调查问卷。请根据问卷主题「${topic}」${dimensions ? `，维度指标：${dimensions}` : ""}生成一份问卷。

${DESIGN_THINKING_DIMENSION}

${questionCountInstruction(question_count, "20")}

${defaultScaleInstruction(AGREE_SCALE)}

${dimensionFormatBlock(AGREE_SCALE)}

${agreeDimensionExample(`${evaluation_type} - ${topic}`)}

3. 公司的决策过程透明且合理[量表题]
非常同意
同意
一般
不同意
非常不同意

4. 企业发展[段落说明]

5. 与同行业公司相比，我们公司拥有更快的成长速度[量表题]
非常同意
同意
一般
不同意
非常不同意${DSL_FORMAT_INSTRUCTIONS}`,
                },
            }],
    }));
    // ═══ 4. SatisSurvey（满意度调查）═══════════════════════════════════
    server.prompt("generate-satisfaction-survey", "AI 生成员工满意度/客户满意度/客户旅程管理问卷", {
        satisfaction_type: z.string().describe("满意度类型（如：员工满意度、客户满意度、客户旅程管理）"),
        topic: z.string().describe("调查主题"),
        dimensions: z.string().optional().describe("维度指标（逗号分隔，如：薪酬,工作环境,职业发展）"),
        question_count: z.string().optional().describe("题目数量（默认20）"),
    }, async ({ satisfaction_type, topic, dimensions, question_count }) => ({
        messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: `你是一名市场调研专家，你擅长设计「${satisfaction_type}」调查问卷。请根据问卷主题「${topic}」${dimensions ? `，维度指标：${dimensions}` : ""}生成一份问卷。

${DESIGN_THINKING_DIMENSION}

${questionCountInstruction(question_count, "20")}

${defaultScaleInstruction(SATISFY_SCALE)}

${dimensionFormatBlock(SATISFY_SCALE)}

示例格式：
${satisfaction_type} - ${topic}

1. 薪酬[段落说明]

2. 与在其他单位的同学、朋友相比，我对自己目前的薪酬水平感到满意[量表题]
非常满意
满意
一般
不满意
非常不满意

3. 服务人员[段落说明]

4. 您对我们服务人员的专业水平是否满意？[量表题]
非常满意
满意
一般
不满意
非常不满意${DSL_FORMAT_INSTRUCTIONS}`,
                },
            }],
    }));
    // ═══ 5. EmpEngageSurvey（敬业度调查）═══════════════════════════════
    server.prompt("generate-engagement-survey", "AI 生成员工敬业度调查问卷", {
        topic: z.string().describe("调查主题（如：2024年度员工敬业度调查）"),
        dimensions: z.string().optional().describe("维度指标（逗号分隔，如：工作投入,组织认同,团队协作）"),
        question_count: z.string().optional().describe("题目数量（默认20）"),
    }, async ({ topic, dimensions, question_count }) => ({
        messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: `你是一名 HR 专家，你擅长设计「员工敬业度调查」问卷。请根据问卷主题「${topic}」${dimensions ? `，维度指标：${dimensions}` : ""}生成一份问卷。

${DESIGN_THINKING_DIMENSION}

${questionCountInstruction(question_count, "20")}

${defaultScaleInstruction(AGREE_SCALE)}

${dimensionFormatBlock(AGREE_SCALE)}

${agreeDimensionExample(`员工敬业度调查 - ${topic}`)}

3. 企业发展[段落说明]

4. 与同行业公司相比，我们公司拥有更快的成长速度，更高的盈利能力[量表题]
非常同意
同意
一般
不同意
非常不同意${DSL_FORMAT_INSTRUCTIONS}`,
                },
            }],
    }));
    // ═══ 6. AICreateExamExcel（从文档创建考试）═════════════════════════
    server.prompt("generate-exam-from-document", "从用户提供的资料文档中 AI 生成考试题目", {
        single_count: z.string().optional().describe("单选题数量（默认10）"),
        multi_count: z.string().optional().describe("多选题数量（默认5）"),
        truefalse_count: z.string().optional().describe("判断题数量（默认5）"),
        fillin_count: z.string().optional().describe("填空题数量（默认5）"),
    }, async ({ single_count, multi_count, truefalse_count, fillin_count }) => ({
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
    }));
    // ═══ 7. AICreateExamExcelKnow（从知识库创建考试）═══════════════════
    server.prompt("generate-exam-from-knowledge", "从公共知识库 AI 生成考试题目（无需提供文档）", {
        knowledge_scope: z.string().describe("知识范围（如：高中物理力学、Python基础语法）"),
        single_count: z.string().optional().describe("单选题数量（默认10）"),
        multi_count: z.string().optional().describe("多选题数量（默认5）"),
        truefalse_count: z.string().optional().describe("判断题数量（默认5）"),
        fillin_count: z.string().optional().describe("填空题数量（默认5）"),
    }, async ({ knowledge_scope, single_count, multi_count, truefalse_count, fillin_count }) => ({
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
    }));
}
//# sourceMappingURL=survey-generation.js.map