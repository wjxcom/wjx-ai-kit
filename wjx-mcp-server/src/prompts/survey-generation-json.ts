import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const BLOCKED_QTYPE_NOTICE =
  "所有类型的问卷在创建或编辑时都禁止使用以下题型：表格数值（qtype=矩阵数值题）、表格组合、表格填空、表格下拉框、自增表格。需要多字段录入时，请改用单项填空、多项填空、多项文件题或多项简答题。";

/**
 * Common JSONL format instructions appended to all JSON survey-generation prompts.
 * Ensures AI output is compatible with the server-side JSONL parser.
 */
const JSONL_FORMAT_INSTRUCTIONS = `

【输出格式要求】
你生成的问卷内容必须严格遵守以下 JSONL 格式，便于系统直接调用 create_survey_by_json 创建问卷：

1. 每一行是一个 JSON 对象，不能输出 JSON 数组。
2. 首行必须是问卷基础信息，例如：
   {"qtype":"问卷基础信息","title":"2026 员工满意度调查","introduction":"请认真填写","endpageinformation":"感谢参与","language":"zh"}
3. 后续每行对应一道题目，至少包含 qtype 和 title。
4. title 中不要带题号，也不要带题型标签。
5. qtype 必须使用精确题型名称，不要发明“矩阵题”“表格题”之类模糊写法。
6. 默认所有题目都是必答题。只有用户明确指定某个题号/题目/字段为非必答时，才输出 \`requir:false\`。
7. 多项填空必须在 title 中使用 {_} 占位符表示子填空位，例如：
   {"qtype":"多项填空","title":"联系方式：电话 {_}，邮箱 {_}，微信 {_}"}
   不要使用 rowtitle 来定义多项填空子项。
8. ${BLOCKED_QTYPE_NOTICE}
9. 至少生成 1 道真实题目；仅输出问卷基础信息、分页栏、段落说明、知情同意书会被拒绝。
10. 不要输出 JSON 之外的解释文字。生成完成后直接调用 create_survey_by_json。

【常见示例】
{"qtype":"问卷基础信息","title":"客户满意度调查","introduction":"请认真填写","endpageinformation":"感谢参与","language":"zh"}
{"qtype":"单选","title":"您的性别","select":["男","女"]}
{"qtype":"多选","title":"您了解的品牌","select":["品牌A","品牌B","品牌C"]}
{"qtype":"矩阵量表","title":"请评价以下方面","rowtitle":["外观","功能","价格"],"select":["非常不满意","不满意","一般","满意","非常满意"]}
{"qtype":"多项填空","title":"联系方式：电话 {_}，邮箱 {_}"}
{"qtype":"比重题","title":"时间分配","total":"100","rowtitle":["工作","学习","娱乐"]}
{"qtype":"分页栏"}
{"qtype":"段落说明","title":"以下是第二部分"}

【绝对禁止的反面示例】
❌ {"qtype":"问卷基础信息","title":"???"}
❌ [{"qtype":"单选","title":"Q","select":["A"]}]
❌ {"qtype":"多项填空","title":"联系方式","rowtitle":["电话","邮箱"]}
❌ {"qtype":"矩阵题","title":"请评价","rowtitle":["A"],"select":["好","差"]}
❌ {"qtype":"表格组合题","title":"团队成员","rowtitle":["成员1"],"select":["姓名"]}
`;

const SURVEY_QTYPES =
  "单选、多选、下拉框、文件上传、排序、单项填空、简答题、多项填空、矩阵填空、多级下拉、日期、AI追问、AI处理、AI访谈、分页栏、段落说明、矩阵单选、矩阵多选、矩阵量表、矩阵滑动条、多项文件题、多项简答题、量表题、NPS量表、评分单选、评分多选、比重题、滑动条、姓名、基本信息、身份证号、国家及地区、省市、省市区、邮箱、手机、高校、邮寄地址、企业信息、知情同意书、门店选择、评价题、情景随机、VlookUp问卷关联、循环评价、热力图、BWS、MaxDiff、图片PK、联合分析、Kano模型、SUS模型、品牌漏斗、货架题、BPTO模型、PSM模型、价格断裂点、层次分析、选项分类、CATI调研、文字点睛、心理学实验、社会阶层、设备信息、城市级别、当前语言、答题录音、答卷摄像、分页计时器";

const EXAM_QTYPES =
  "单选、多选、下拉框、单项填空、矩阵填空、分页栏、段落说明、姓名、基本信息、身份证号、国家及地区、省市、省市区、邮箱、手机、日期、高校、邮寄地址、企业信息、答卷摄像、知情同意书、考试单选、考试判断、考试多选、考试单项填空、考试多项填空、考试简答、考试文件、考试绘图、考试代码";

const FORM_QTYPES =
  "单选、多选、下拉框、文件上传、单项填空、简答题、多项填空、矩阵填空、多级下拉、门店选择、签名题、地图、日期、AI追问、AI处理、分页栏、段落说明、折叠栏目、轮播图、图片OCR、商品题、预约题、姓名、基本信息、身份证号、国家及地区、省市、省市区、邮箱、手机、手机验证、时间、高校、邮寄地址、企业信息、知情同意书、密码、多项文件题、多项简答题";

function qtypeConstraint(qtypes: string): string {
  return `qtype 的值只能是如下列表中的一种：${qtypes}。`;
}

const JSONL_CONSTRAINTS =
  "不要生成重复题目或重复选项；relation/referselect 只引用前文真实存在的题目标题；题目顺序遵循由浅入深、由客观到主观、开放题靠后的基本逻辑。";

export function registerSurveyGenerationJsonPrompts(server: McpServer): void {
  server.prompt(
    "generate-survey-json",
    "AI 用 JSONL 格式生成调查/测评/量表/民主测评问卷（支持 60+ 题型，含 BWS/MaxDiff/联合分析/Kano/PSM 等专业模型），自动创建到问卷星",
    {
      topic: z.string().describe("问卷主题（如：品牌偏好调研、员工满意度测评、量表打分、民主测评）"),
      question_count: z.string().optional().describe("题目数量（默认 15）"),
      requirements: z.string().optional().describe("额外要求（如：包含联合分析、使用 Kano 模型、李克特量表、360 评估）"),
    },
    async ({ topic, question_count, requirements }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `你是一名专业的问卷调研专家，擅长制作用户调查、市场研究、学术调查、测评、量表、民主测评、360 评估等各类问卷。请根据主题“${topic}”生成一份高质量问卷。${requirements ? `额外要求：${requirements}` : ""}

问卷设计思路：如果用户没有明确给出调研目的，请结合主题合理推断调研场景和目标对象。从基本信息开始，逐步过渡到态度、行为、评价与开放反馈。充分利用矩阵题、评分题、排序题、量表题和专业模型题，但不要使用被禁用的五类表格题型。

题目数量硬性要求：必须生成 ${question_count ?? "15"} 道真实题目（不计问卷基础信息、分页栏、段落说明、知情同意书）。推荐题型比例：单选约 30%，多选约 25%，量表/矩阵量表约 15%，矩阵单选约 10%，排序约 5%，填空约 5%，其余根据主题使用专业模型题。

【atype 选择硬性规则】调用 create_survey_by_json 时应主动判断并显式传入 atype：
- 主题偏“测评/能力评估/心理测试” → atype=2
- 以量表打分为主 → atype=10
- 民主测评 / 360 评估 / 多人互评 → atype=11
- 普通调查 → atype=1（可省略）

【专业模型题型说明】
- BWS / MaxDiff / 图片PK：使用 mdattr 列出评价对象
- 联合分析：使用 columntitle 列出属性
- Kano模型：使用 rowtitle + select
- PSM模型：使用 minvalue / maxvalue / steps + rowtitle
- 品牌漏斗：使用 brands

${BLOCKED_QTYPE_NOTICE}
${qtypeConstraint(SURVEY_QTYPES)}
${JSONL_CONSTRAINTS}
${JSONL_FORMAT_INSTRUCTIONS}`,
        },
      }],
    }),
  );

  server.prompt(
    "generate-exam-json",
    "AI 用 JSONL 格式生成考试问卷（支持考试单选/多选/判断/填空/简答/绘图/代码题），自动创建到问卷星",
    {
      knowledge_scope: z.string().describe("知识范围（如：高中物理力学、Python 基础语法）"),
      single_count: z.string().optional().describe("考试单选题数量（默认 10）"),
      multi_count: z.string().optional().describe("考试多选题数量（默认 5）"),
      judge_count: z.string().optional().describe("考试判断题数量（默认 5）"),
      fill_count: z.string().optional().describe("考试填空题数量（默认 5）"),
      requirements: z.string().optional().describe("额外要求"),
    },
    async ({ knowledge_scope, single_count, multi_count, judge_count, fill_count, requirements }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `你是一名考试命题人，请根据知识范围“${knowledge_scope}”生成一套结构化、高质量的考试题目。${requirements ? `额外要求：${requirements}` : ""}

题目设计要求：
1. 覆盖核心概念，兼顾记忆、理解、应用。
2. 题干清晰，无歧义，避免文化或性别偏见。
3. 收集考生基础信息的题目放在前面，正式考试题放在后面。
4. 正式考试题必须包含 correctselect、quizscore、answeranalysis。

题目数量硬性要求：考试单选 ${single_count ?? "10"} 题，考试多选 ${multi_count ?? "5"} 题，考试判断 ${judge_count ?? "5"} 题，考试填空 ${fill_count ?? "5"} 题。必须严格按数量生成，不得只输出基础信息行。

【考试题型 JSON 示例】
考试单选：{"qtype":"考试单选","title":"题目？","select":["A","B","C","D"],"correctselect":["B"],"quizscore":"5","answeranalysis":"解析..."}
考试判断：{"qtype":"考试判断","title":"判断陈述","select":["对","错"],"correctselect":["对"],"quizscore":"5","answeranalysis":"解析..."}
考试多选：{"qtype":"考试多选","title":"题目？","select":["A","B","C","D"],"correctselect":["A","C"],"quizscore":"5","answeranalysis":"解析..."}
考试单项填空：{"qtype":"考试单项填空","title":"填空题","correctselect":["正确答案1","正确答案2"],"quizscore":"5","answeranalysis":"解析..."}
考试多项填空：{"qtype":"考试多项填空","title":"The boy {_} a student, he {_} very smart","answerlists":[{"correctselect":["is"],"quizscore":"2","include":true},{"correctselect":["is"],"quizscore":"2","include":true}],"answeranalysis":"解析..."}

${BLOCKED_QTYPE_NOTICE}
${qtypeConstraint(EXAM_QTYPES)}
${JSONL_CONSTRAINTS}

【atype 硬性规则】调用 create_survey_by_json 时必须显式传 atype=6，不要省略。${JSONL_FORMAT_INSTRUCTIONS}`,
        },
      }],
    }),
  );

  server.prompt(
    "generate-form-json",
    "AI 用 JSONL 格式生成表单（支持 60+ 题型，含手机验证/日期/地图/签名/商品/预约等表单专用题型），自动创建到问卷星",
    {
      topic: z.string().describe("表单主题（如：活动报名、客户登记、预约申请）"),
      question_count: z.string().optional().describe("题目数量（默认 10）"),
      requirements: z.string().optional().describe("额外要求（如：需要收集地址、需要文件上传）"),
    },
    async ({ topic, question_count, requirements }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `你擅长制作各种类型的表单，请根据主题“${topic}”生成一份内容清晰、结构合理的表单。${requirements ? `额外要求：${requirements}` : ""}

表单设计思路：
1. 优先使用预设字段题型，如手机、邮箱、省市区、高校、时间、签名题、地图、商品题、预约题、手机验证。
2. 收集基础信息的题目放在前面。
3. 需要条件显示时，合理使用 relation。
4. 多字段录入场景优先拆成普通题型，或改用多项文件题、多项简答题，不要使用被禁用的五类表格题型。

表单题目数量硬性要求：必须生成至少 ${question_count ?? "10"} 道真实题目（不计问卷基础信息、分页栏、段落说明、知情同意书），不能只生成基础信息行。

${BLOCKED_QTYPE_NOTICE}
${qtypeConstraint(FORM_QTYPES)}
${JSONL_CONSTRAINTS}

【atype 硬性规则】调用 create_survey_by_json 时必须显式传 atype=7，不要省略。${JSONL_FORMAT_INSTRUCTIONS}`,
        },
      }],
    }),
  );
}
