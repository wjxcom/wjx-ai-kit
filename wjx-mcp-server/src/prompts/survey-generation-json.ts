import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Common JSONL format instructions appended to all JSON survey-generation prompts.
 * Ensures AI output is compatible with the server-side JSONL parser.
 */
const JSONL_FORMAT_INSTRUCTIONS = `

【输出格式要求 — 严格遵守】
你生成的问卷内容必须符合以下 JSONL 格式，以便系统自动解析创建问卷：

1. 每个题目是一个 JSON 对象，每条 JSON 之间用换行符隔开
2. 第一行必须是问卷基础信息：{"qtype":"问卷基础信息","title":"问卷标题","introduction":"作答说明","endpageinformation":"提交后文案","language":"zh"}
3. 后续每行为一道题目，必须包含 qtype 和 title 两个字段
4. title 字段中不要生成题目序号以及题目类型
5. JSON 数据需要严格遵循 JSON 格式规范
6. 【多项填空特别说明】多项填空必须在 title 中用 {_} 占位符表示每个子填空位，每个 {_} 对应一个输入框。例：{"qtype":"多项填空","title":"姓名{_}，年龄{_}，电话{_}"} 会生成 3 个空位。**禁止用 rowtitle 数组定义多项填空的子项**（rowtitle 仅用于矩阵题/比重题/Kano/PSM 等）— 否则服务端只会生成 1 个空位。

常用题型示例：
{"qtype":"问卷基础信息","title":"客户满意度调查","introduction":"请认真填写","endpageinformation":"感谢您的参与！","language":"zh"}
{"qtype":"单选","title":"您的性别","select":["男","女"]}
{"qtype":"多选","title":"您了解的品牌","select":["品牌A","品牌B","品牌C"]}
{"qtype":"量表题","title":"整体满意度","select":["很不满意","不满意","一般","满意","很满意"]}
{"qtype":"矩阵量表","title":"请评价以下方面","rowtitle":["外观","功能","价格"],"select":["很不满意","不满意","一般","满意","很满意"]}
{"qtype":"单项填空","title":"请留下您的建议"}
{"qtype":"多项填空","title":"请填写联系方式：电话 {_}，邮箱 {_}，微信 {_}"}
{"qtype":"排序","title":"请排列重要程度","select":["选项A","选项B","选项C"]}
{"qtype":"比重题","total":"100","title":"时间分配","rowtitle":["工作","学习","娱乐"]}
{"qtype":"滑动条","minvalue":"0","maxvalue":"100","minvaluetext":"不满意","maxvaluetext":"满意","title":"满意程度"}
{"qtype":"分页栏"}
{"qtype":"段落说明","title":"以下是第二部分"}

【重要】不要生成除 JSON 外的其他内容。生成完成后，请直接调用 create_survey_by_json 工具，将上述 JSONL 文本作为 jsonl 参数传入以创建问卷。`;

/** CommonSurvey 支持的 qtype 列表 */
const COMMON_QTYPES = "单选、多选、下拉框、文件上传、排序、单项填空、简答题、多项填空、矩阵填空、多级下拉、日期、AI追问、AI处理、AI访谈、分页栏、段落说明、矩阵单选、矩阵多选、矩阵量表、矩阵滑动条、量表题、NPS量表、评分单选、评分多选、比重题、滑动条、姓名、基本信息、身份证号、国家及地区、省市、省市区、邮箱、手机、高校、邮寄地址、企业信息、知情同意书";

/** MajorSurvey 支持的 qtype 列表（含专业调查模型） */
const MAJOR_QTYPES = COMMON_QTYPES + "、门店选择、评价题、情景随机、VlookUp问卷关联、循环评价、热力图、BWS、MaxDiff、图片PK、联合分析、Kano模型、SUS模型、品牌漏斗、货架题、BPTO模型、PSM模型、价格断裂点、层次分析、选项分类、CATI调研、文字点睛、心理学实验、社会阶层、设备信息、城市级别、当前语言、答题录音、答卷摄像、分页计时器";

/** Exam 支持的 qtype 列表 */
const EXAM_QTYPES = "单选、多选、下拉框、单项填空、矩阵填空、分页栏、段落说明、姓名、基本信息、身份证号、国家及地区、省市、省市区、邮箱、手机、日期、高校、邮寄地址、企业信息、答卷摄像、知情同意书、考试单选、考试判断、考试多选、考试单项填空、考试多项填空、考试简答、考试文件、考试绘图、考试代码";

/** Form 支持的 qtype 列表 */
const FORM_QTYPES = "单选、多选、下拉框、文件上传、单项填空、简答题、多项填空、矩阵填空、多级下拉、门店选择、日期、AI追问、AI处理、AI访谈、分页栏、段落说明、矩阵单选、矩阵多选、矩阵量表、矩阵滑动条、量表题、NPS量表、评分单选、评分多选、评价题、比重题、滑动条、情景随机、VlookUp问卷关联、循环评价、热力图、BWS、MaxDiff、图片PK、联合分析、Kano模型、SUS模型、品牌漏斗、货架题、BPTO模型、PSM模型、价格断裂点、层次分析、选项分类、CATI调研、文字点睛、心理学实验、姓名、基本信息、身份证号、国家及地区、省市、省市区、邮箱、手机、高校、邮寄地址、社会阶层、设备信息、城市级别、企业信息、当前语言、答题录音、答卷摄像、分页计时器、知情同意书";

/** qtype 约束指令 */
function qtypeConstraint(qtypes: string): string {
  return `qtype 的值只能是如下列表中的一种：${qtypes}。`;
}

/** 通用 JSONL 格式约束 */
const JSONL_CONSTRAINTS = "不要生成重复的题目以及无关的问题，同一题目不要生成相同的选项；referselect 字段的值必须是其他相关题型的 title 字段的值；题目顺序需要遵循逻辑顺序，由简单到复杂，由客观到主观，开放题要放在末尾。";

// ─── Registration ───────────────────────────────────────────────────

export function registerSurveyGenerationJsonPrompts(server: McpServer): void {
  // ═══ 1. CommonSurvey（普通调查 — JSON 格式）═══════════════════════════
  server.prompt(
    "generate-survey-json",
    "AI 用 JSONL 格式生成普通调查问卷（支持 30+ 题型），自动创建到问卷星",
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

问卷设计思路：如果用户没有给出调研目的，请根据主题推测调研目的，结合主题推测场景和对象。从基本信息开始，逐步到意向、决策因素，然后是服务评估，最后是主观反馈。遵循逻辑顺序：由简单到复杂，从不敏感到敏感。

生成的问卷总题数为 ${question_count ?? "15"} 道题目。充分利用丰富的题型（矩阵题、评分题、排序题、量表题等），题型比例：单选题（35%）、多选题（30%）、量表题（10%）、矩阵单选题（10%）、矩阵量表题（5%）、排序题（5%）、填空题（5%）。

${qtypeConstraint(COMMON_QTYPES)}
${JSONL_CONSTRAINTS}${JSONL_FORMAT_INSTRUCTIONS}`,
        },
      }],
    }),
  );

  // ═══ 2. MajorSurvey（专业调查 — JSON 格式）═══════════════════════════
  server.prompt(
    "generate-major-survey-json",
    "AI 用 JSONL 格式生成专业调查问卷（支持 60+ 题型，含 BWS/MaxDiff/联合分析/Kano/PSM 等专业模型），自动创建到问卷星",
    {
      topic: z.string().describe("问卷主题（如：品牌偏好调研、产品定价分析）"),
      question_count: z.string().optional().describe("题目数量（默认15）"),
      requirements: z.string().optional().describe("额外要求（如：包含联合分析、使用 Kano 模型）"),
    },
    async ({ topic, question_count, requirements }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `你是一名专业的问卷调研专家，擅长制作专业的用户调查、市场项目、学术调查。请根据主题「${topic}」生成一份专业的问卷调查。${requirements ? `额外要求：${requirements}` : ""}

问卷设计思路：如果用户没有给出调研目的，请根据主题推测调研目的，结合主题推测场景和对象。从基本信息开始，逐步到意向、决策因素，然后是服务评估，最后是主观反馈。充分利用专业调查模型题型。

生成的问卷总题数为 ${question_count ?? "15"} 道题目。合理使用关联逻辑（relation 字段），让作答更加顺畅。

【专业模型题型说明】
- BWS/MaxDiff/图片PK：使用 mdattr 字段列出评价对象，如 {"qtype":"MaxDiff","title":"选出最喜欢和最不喜欢的","mdattr":["对象1","对象2","对象3","对象4","对象5","对象6"]}
- 联合分析：使用 columntitle 字段列出属性，如 {"qtype":"联合分析","title":"选择最吸引您的","columntitle":["品牌","价格","功能"]}
- Kano模型：使用 rowtitle + select，如 {"qtype":"Kano模型","title":"功能评价","rowtitle":["如果有该功能","如果没有该功能"],"select":["很喜欢","理所当然","无所谓","勉强接受","很不喜欢"]}
- PSM模型：使用 minvalue/maxvalue/steps + rowtitle，如 {"qtype":"PSM模型","minvalue":"1","maxvalue":"101","steps":"10","title":"价格评估","rowtitle":["太低不会购买","划算值得购买","较高但可接受","太高放弃购买"]}
- 品牌漏斗：使用 brands 字段，如 {"qtype":"品牌漏斗","brands":["品牌1","品牌2","品牌3"]}

${qtypeConstraint(MAJOR_QTYPES)}
${JSONL_CONSTRAINTS}${JSONL_FORMAT_INSTRUCTIONS}`,
        },
      }],
    }),
  );

  // ═══ 3. Exam（考试 — JSON 格式）══════════════════════════════════════
  server.prompt(
    "generate-exam-json",
    "AI 用 JSONL 格式生成考试问卷（支持考试单选/多选/判断/填空/简答/绘图/代码题），自动创建到问卷星",
    {
      knowledge_scope: z.string().describe("知识范围（如：高中物理力学、Python基础语法）"),
      single_count: z.string().optional().describe("考试单选题数量（默认10）"),
      multi_count: z.string().optional().describe("考试多选题数量（默认5）"),
      judge_count: z.string().optional().describe("考试判断题数量（默认5）"),
      fill_count: z.string().optional().describe("考试填空题数量（默认5）"),
      requirements: z.string().optional().describe("额外要求"),
    },
    async ({ knowledge_scope, single_count, multi_count, judge_count, fill_count, requirements }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `你是一个考试出题人，请根据知识范围「${knowledge_scope}」生成一套结构化、高质量的考试题目。${requirements ? `额外要求：${requirements}` : ""}

题目设计要求：
1. 覆盖知识范围的核心概念，确保题目多样（测试记忆、理解、应用能力）
2. 题目表述清晰、无歧义，避免文化或性别偏见
3. 普通题目（收集考生基础信息）放在最前面，正式考试题目在后
4. 正式考试题目必须包含分值（quizscore）、正确答案（correctselect）和答案解析（answeranalysis）

题型和数量：考试单选 ${single_count ?? "10"} 题，考试多选 ${multi_count ?? "5"} 题，考试判断 ${judge_count ?? "5"} 题，考试填空 ${fill_count ?? "5"} 题。必须严格按照各题型数量生成。

【考试题型 JSON 格式】
考试单选：{"qtype":"考试单选","title":"题目?","select":["A","B","C","D"],"correctselect":["B"],"quizscore":"5","answeranalysis":"解析..."}
考试判断：{"qtype":"考试判断","title":"判断陈述","select":["对","错"],"correctselect":["对"],"quizscore":"5","answeranalysis":"解析..."}
考试多选：{"qtype":"考试多选","title":"题目?","select":["A","B","C","D"],"correctselect":["A","C"],"quizscore":"5","answeranalysis":"解析..."}
考试单项填空：{"qtype":"考试单项填空","title":"填空题","correctselect":["正确答案1","正确答案2"],"quizscore":"5","answeranalysis":"解析..."}
考试多项填空：{"qtype":"考试多项填空","title":"The boy {_} a student, he {_} very smart","answerlists":[{"correctselect":["is"],"quizscore":"2","include":true},{"correctselect":["is"],"quizscore":"2","include":true}],"answeranalysis":"解析..."}（每个 {_} 对应一个填空，不要用下划线/rowtitle）

${qtypeConstraint(EXAM_QTYPES)}
${JSONL_CONSTRAINTS}

【创建时请使用 atype=6】${JSONL_FORMAT_INSTRUCTIONS}`,
        },
      }],
    }),
  );

  // ═══ 4. Form（表单 — JSON 格式）══════════════════════════════════════
  server.prompt(
    "generate-form-json",
    "AI 用 JSONL 格式生成表单（支持 60+ 题型，含手机验证/日期/地图/签名/商品/预约等表单专用题型），自动创建到问卷星",
    {
      topic: z.string().describe("表单主题（如：活动报名、客户登记、预约申请）"),
      question_count: z.string().optional().describe("题目数量（默认10）"),
      requirements: z.string().optional().describe("额外要求（如：需要收集地址、需要文件上传）"),
    },
    async ({ topic, question_count, requirements }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `你擅长制作各种类型的表单，请根据主题「${topic}」生成一份内容清晰、格式良好的表单。${requirements ? `额外要求：${requirements}` : ""}

表单设计思路：
1. 充分利用现有丰富的预设题型（如手机、邮箱、省市区、高校等），减少使用普通单项填空
2. 合理安排题目顺序，收集基本信息的题目放在前面
3. 根据主题合理使用关联逻辑（relation 字段）

生成的表单总题数为 ${question_count ?? "10"} 道题目。

${qtypeConstraint(FORM_QTYPES)}
${JSONL_CONSTRAINTS}

【创建时请使用 atype=7】${JSONL_FORMAT_INSTRUCTIONS}`,
        },
      }],
    }),
  );
}
