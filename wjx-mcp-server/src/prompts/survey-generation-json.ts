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
6. 【标题硬性规则 — 违反会直接拒绝创建】
   - title 必须是真实问卷主题，例如 "2026 年员工满意度调查"、"秋季新品上市测试"
   - 禁止输出占位符：❌ "???" / "？？？" / "无标题" / "未命名" / "untitled" / "placeholder" / "TODO" / "xxx" / "新问卷" / "测试问卷"
   - 禁止少于 2 个字符；禁止仅用单字（❌ "A"）
   - 如果你不确定主题，宁可追问也不要编造；SDK 会在创建前强制校验，占位符会被拒绝
7. 【题目数量硬性规则】每份问卷必须生成 **至少 1 道真实题目**（元数据/分页栏/段落说明/知情同意书不计入题数），否则服务端会被 SDK 拦截。必须生成完整的题目列表，不允许只输出 _meta 行交差
8. 【调用 create_survey_by_json 时 atype 规则】
   - 投票问卷 → **必须显式传 atype=3**（标题含"投票/评选"时 SDK 会兜底推断，但你应主动传）
   - 表单 → **必须显式传 atype=7**
   - 考试 → **必须显式传 atype=6**（含考试题型时 SDK 会兜底推断）
   - 测评 → **必须显式传 atype=2**
   - 普通调查 → atype=1（默认值，可省略）
9. 【多项填空特别说明】多项填空必须在 title 中用 {_} 占位符表示每个子填空位，每个 {_} 对应一个输入框。例：{"qtype":"多项填空","title":"姓名{_}，年龄{_}，电话{_}"} 会生成 3 个空位。**禁止用 rowtitle 数组定义多项填空的子项**（rowtitle 仅用于矩阵题/比重题/Kano/PSM/表格题 等）— 否则服务端只会生成 1 个空位。
10. 【矩阵题 & 表格题 用法指南】qtype 必须使用下列精确名称之一，不要凭想象造新名字（如"矩阵""矩阵题""通用矩阵""表格题"等模糊值会创建失败）：

    ── 矩阵类（rowtitle=行标题 / select=列标题 或 列值） ──
    - 矩阵单选：{"qtype":"矩阵单选","title":"评价以下方面","rowtitle":["外观","功能"],"select":["差","一般","好"]}
    - 矩阵多选：{"qtype":"矩阵多选","title":"每方面可选多项","rowtitle":["外观","功能"],"select":["美观","耐用","便宜"]}
    - 矩阵量表：{"qtype":"矩阵量表","title":"满意度","rowtitle":["外观","功能","价格"],"select":["很不满意","不满意","一般","满意","很满意"]}
    - 矩阵填空：{"qtype":"矩阵填空","title":"请填写各项详情","rowtitle":["项目1","项目2","项目3"]}
    - 矩阵滑动条：{"qtype":"矩阵滑动条","title":"各维度评分","rowtitle":["维度A","维度B"],"minvalue":"0","maxvalue":"100"}
    - 矩阵数值题：{"qtype":"矩阵数值题","title":"各项数值","rowtitle":["项目A","项目B"],"select":["数量","金额"]}

    ── 表格类（适用于更复杂的多列/多项场景，服务端原生支持） ──
    - 表格填空题 (707)：每行一项、每列一个填空字段。用 rowtitle 定义行、select 定义列。
      示例：{"qtype":"表格填空题","title":"项目进度登记","rowtitle":["项目A","项目B","项目C"],"select":["计划完成日","实际完成日","负责人"]}
    - 表格下拉框 (708)：每行一项、每列一个下拉评价。行×列每个单元格都是下拉选择。
      示例：{"qtype":"表格下拉框","title":"品牌满意度矩阵","rowtitle":["品牌A","品牌B","品牌C"],"select":["外观","功能","价格","售后"]}
    - 表格组合题 (709)：多成员/多行收集不同类型字段（姓名/年龄/性别等）。
      示例：{"qtype":"表格组合题","title":"团队成员信息","rowtitle":["成员1","成员2","成员3"],"select":["姓名","年龄","性别"]}
    - 表格自增题 (710)：用户可自行添加任意数量的行，每列一个字段。**不需要 rowtitle**（用户运行时自加）。
      示例：{"qtype":"表格自增题","title":"工作经历（请添加所有相关经历）","select":["公司名称","职位","起止时间","工作内容"]}
    - 多项文件题 (711)：一题收集多个命名的文件上传。rowtitle 列出每个上传项名称。
      示例：{"qtype":"多项文件题","title":"请上传以下材料","rowtitle":["身份证正面","身份证反面","学历证书扫描件"]}
    - 多项简答题 (712)：一题收集多个独立的简答子项（区别于多项填空：子项内容更长、每项独立展示）。
      示例：{"qtype":"多项简答题","title":"自我评估","rowtitle":["你的三大优势","你的主要不足","未来一年的职业目标"]}

    适用边界：如果只是"几个简单填空"就用 多项填空（title 里的 {_}）；真正的"表格/多项"场景（有明确的行列结构、多字段录入）才用 707-712。

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

【反面示例 — 绝对禁止生成】
❌ 只输出 _meta 行不生成题目：{"qtype":"问卷基础信息","title":"客户满意度调查"}  ← 零题目会被拦截
❌ 占位符标题：{"qtype":"问卷基础信息","title":"???"}  ← 会被拦截
❌ 用 rowtitle 做多项填空：{"qtype":"多项填空","title":"联系方式","rowtitle":["电话","邮箱"]}  ← 服务端只会生成 1 个空位
❌ 模糊的矩阵 qtype：{"qtype":"矩阵题","title":"评价","rowtitle":[...],"select":[...]}  ← qtype 必须是精确子类型
❌ 用 JSON 数组包裹：[{...}, {...}]  ← 必须是 JSONL（每行一个 JSON），不是 JSON 数组

【重要】不要生成除 JSON 外的其他内容。生成完成后，请直接调用 create_survey_by_json 工具，将上述 JSONL 文本作为 jsonl 参数传入以创建问卷；投票/考试/表单/测评场景请同时显式传 atype 参数。`;

/** CommonSurvey 支持的 qtype 列表 */
const COMMON_QTYPES = "单选、多选、下拉框、文件上传、排序、单项填空、简答题、多项填空、矩阵填空、多级下拉、日期、AI追问、AI处理、AI访谈、分页栏、段落说明、矩阵单选、矩阵多选、矩阵量表、矩阵滑动条、矩阵数值题、表格填空题、表格下拉框、表格组合题、表格自增题、多项文件题、多项简答题、量表题、NPS量表、评分单选、评分多选、比重题、滑动条、姓名、基本信息、身份证号、国家及地区、省市、省市区、邮箱、手机、高校、邮寄地址、企业信息、知情同意书";

/** MajorSurvey 支持的 qtype 列表（含专业调查模型） */
const MAJOR_QTYPES = COMMON_QTYPES + "、门店选择、评价题、情景随机、VlookUp问卷关联、循环评价、热力图、BWS、MaxDiff、图片PK、联合分析、Kano模型、SUS模型、品牌漏斗、货架题、BPTO模型、PSM模型、价格断裂点、层次分析、选项分类、CATI调研、文字点睛、心理学实验、社会阶层、设备信息、城市级别、当前语言、答题录音、答卷摄像、分页计时器";

/** Exam 支持的 qtype 列表 */
const EXAM_QTYPES = "单选、多选、下拉框、单项填空、矩阵填空、分页栏、段落说明、姓名、基本信息、身份证号、国家及地区、省市、省市区、邮箱、手机、日期、高校、邮寄地址、企业信息、答卷摄像、知情同意书、考试单选、考试判断、考试多选、考试单项填空、考试多项填空、考试简答、考试文件、考试绘图、考试代码";

/** Form 支持的 qtype 列表 */
const FORM_QTYPES = "单选、多选、下拉框、文件上传、单项填空、简答题、多项填空、矩阵填空、表格填空题、表格下拉框、表格组合题、表格自增题、多项文件题、多项简答题、多级下拉、门店选择、日期、AI追问、AI处理、AI访谈、分页栏、段落说明、矩阵单选、矩阵多选、矩阵量表、矩阵滑动条、量表题、NPS量表、评分单选、评分多选、评价题、比重题、滑动条、情景随机、VlookUp问卷关联、循环评价、热力图、BWS、MaxDiff、图片PK、联合分析、Kano模型、SUS模型、品牌漏斗、货架题、BPTO模型、PSM模型、价格断裂点、层次分析、选项分类、CATI调研、文字点睛、心理学实验、姓名、基本信息、身份证号、国家及地区、省市、省市区、邮箱、手机、高校、邮寄地址、社会阶层、设备信息、城市级别、企业信息、当前语言、答题录音、答卷摄像、分页计时器、知情同意书";

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

题目数量硬性要求：必须生成 **${question_count ?? "15"} 道真实题目**（不计 _meta/分页/段落）。充分利用丰富的题型（矩阵题、评分题、排序题、量表题等），题型比例：单选题（35%）、多选题（30%）、量表题（10%）、矩阵单选题（10%）、矩阵量表题（5%）、排序题（5%）、填空题（5%）。

【atype 选择硬性规则】判断主题后在调用 create_survey_by_json 时决定 atype：
- 主题含"投票/评选/最佳...评比" → **显式传 atype=3**
- 主题含"测评/能力评估/心理测试" → **显式传 atype=2**
- 普通调查（默认） → atype=1（可省略）

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

题目数量硬性要求：必须生成 **${question_count ?? "15"} 道真实题目**（不计 _meta/分页/段落）。合理使用关联逻辑（relation 字段），让作答更加顺畅。

【atype 选择硬性规则】
- 主题含"投票/评选" → **显式传 atype=3**
- 主题含"测评" → **显式传 atype=2**
- 其它专业调查 → atype=1（可省略）

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

题目数量硬性要求（总和 ≥ 1，通常 15+ 道）：考试单选 ${single_count ?? "10"} 题，考试多选 ${multi_count ?? "5"} 题，考试判断 ${judge_count ?? "5"} 题，考试填空 ${fill_count ?? "5"} 题。必须严格按照各题型数量生成，不得漏生成或只生成基础信息行。

【考试题型 JSON 格式】
考试单选：{"qtype":"考试单选","title":"题目?","select":["A","B","C","D"],"correctselect":["B"],"quizscore":"5","answeranalysis":"解析..."}
考试判断：{"qtype":"考试判断","title":"判断陈述","select":["对","错"],"correctselect":["对"],"quizscore":"5","answeranalysis":"解析..."}
考试多选：{"qtype":"考试多选","title":"题目?","select":["A","B","C","D"],"correctselect":["A","C"],"quizscore":"5","answeranalysis":"解析..."}
考试单项填空：{"qtype":"考试单项填空","title":"填空题","correctselect":["正确答案1","正确答案2"],"quizscore":"5","answeranalysis":"解析..."}
考试多项填空：{"qtype":"考试多项填空","title":"The boy {_} a student, he {_} very smart","answerlists":[{"correctselect":["is"],"quizscore":"2","include":true},{"correctselect":["is"],"quizscore":"2","include":true}],"answeranalysis":"解析..."}（每个 {_} 对应一个填空，不要用下划线/rowtitle）

${qtypeConstraint(EXAM_QTYPES)}
${JSONL_CONSTRAINTS}

【atype 硬性规则】调用 create_survey_by_json 时**必须显式传 atype=6**（考试），不要省略。${JSONL_FORMAT_INSTRUCTIONS}`,
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
4. 多字段批量录入场景请使用表格类题型（表格组合题/表格自增题/多项文件题/多项简答题），而不是堆叠多个单字段题

表单题目数量硬性要求：必须生成至少 ${question_count ?? "10"} 道**真实题目**（不计 _meta/分页/段落），不允许只生成基础信息行就交差。

${qtypeConstraint(FORM_QTYPES)}
${JSONL_CONSTRAINTS}

【atype 硬性规则】调用 create_survey_by_json 时**必须显式传 atype=7**（表单），不要省略。${JSONL_FORMAT_INSTRUCTIONS}`,
        },
      }],
    }),
  );
}
