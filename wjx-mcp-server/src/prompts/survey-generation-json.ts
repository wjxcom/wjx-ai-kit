import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JSONL_QTYPES_RESOURCE } from "../resources/jsonl-qtypes.js";

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
4. title 字段中只写题目正文，不要生成题目序号，也不要写题目类型（例如不要写“表格填空-报名人基础信息”“投票单选：你最喜欢哪个网站”）
5. JSON 数据需要严格遵循 JSON 格式规范
6. 【标题硬性规则 — 违反会直接拒绝创建】
   - title 必须是真实问卷主题，例如 "2026 年员工满意度调查"、"秋季新品上市测试"
   - 禁止输出占位符：❌ "???" / "？？？" / "无标题" / "未命名" / "untitled" / "placeholder" / "TODO" / "xxx" / "新问卷" / "测试问卷"
   - 禁止少于 2 个字符；禁止仅用单字（❌ "A"）
   - 如果你不确定主题，宁可追问也不要编造；SDK 会在创建前强制校验，占位符会被拒绝
7. 【题目数量硬性规则】每份问卷必须生成 **至少 1 道真实题目**（元数据/分页栏/段落说明/知情同意书不计入题数），否则服务端会被 SDK 拦截。必须生成完整的题目列表，不允许只输出 _meta 行交差
8. 【必答规则】默认所有题目都是必答题。所有题型（包括单项填空、简答题、意见建议题、开放题、NPS 追问、联系方式题）在用户没有点名为“选填/可选/非必答”时，都不要输出 \`requir:false\`。只有用户明确指定某个题号/题目/字段为非必答时，才在该题输出 \`requir:false\`；其他题仍保持默认必答
  9. 【调用 create_survey_by_json 时 atype 规则】仅在用户明确授权创建后执行；生成阶段先展示预览
   - 投票问卷 → **必须显式传 atype=3**（包含 qtype="投票单选/投票多选" 或标题含"投票/评选/最佳..."时 SDK 会兜底推断，但你应主动传）
   - 表单 → **必须显式传 atype=7**
   - 考试 → **必须显式传 atype=6**（含考试题型时 SDK 会兜底推断）
   - 测评 → **必须显式传 atype=2**（李克特量表测评亦可用 **atype=10**，量表/打分场景）
   - 360度评估 → **必须显式传 atype=4**
   - 360评估无测评关系 → **必须显式传 atype=5**
   - 民主测评 / 民主评议 → **必须显式传 atype=11**
   - 普通调查 → atype=1（默认值，可省略）
9. 【多项填空特别说明】多项填空必须在 title 中用 {_} 占位符表示每个子填空位，每个 {_} 对应一个输入框。例：{"qtype":"多项填空","title":"姓名{_}，年龄{_}，电话{_}"} 会生成 3 个空位。**禁止用 rowtitle 数组定义多项填空的子项**（rowtitle 仅用于矩阵题/比重题/Kano/PSM/表格题 等）— 否则服务端只会生成 1 个空位。
10. 【矩阵题 & 表格题 用法指南】qtype 必须使用下列精确名称之一，不要凭想象造新名字（如"矩阵""矩阵题""通用矩阵""表格题"等模糊值会创建失败）：

    ── 矩阵类（rowtitle=行标题 / select=列标题 或 列值） ──
    - 矩阵单选：{"qtype":"矩阵单选","title":"评价以下方面","rowtitle":["外观","功能"],"select":["差","一般","好"]}
    - 矩阵多选：{"qtype":"矩阵多选","title":"每方面可选多项","rowtitle":["外观","功能"],"select":["美观","耐用","便宜"]}
    - 矩阵量表：{"qtype":"矩阵量表","title":"满意度","rowtitle":["外观","功能","价格"],"select":["很不满意","不满意","一般","满意","很满意"]}
    - 矩阵填空：{"qtype":"矩阵填空","title":"请填写各项详情","rowtitle":["项目1","项目2","项目3"]}
    - 矩阵滑动条：{"qtype":"矩阵滑动条","title":"各维度评分","rowtitle":["维度A","维度B"],"minvalue":"0","maxvalue":"100"}
    - 矩阵数值题：读取既有问卷或 Web 编辑器能力，当前 JSONL 创建接口会拒绝；生成时请改用矩阵滑动条或普通填空题，并在用户确认后重新生成完整 JSONL。

    ── 表格类标准 JSON 格式（706-710 必须优先使用以下字段） ──
    - qtype 必须使用精确名称：表格数值 / 表格填空 / 表格下拉框 / 表格组合 / 自增表格
    - 不要在 title 中说明题目类型；题目类型只放在 qtype
    - 表格数值 / 表格填空：使用 rowtitle 数组；表格数值可补 minvalue/maxvalue
    - 表格下拉框：使用 rowtitle + selects；selects[i] 对应 rowtitle[i] 的下拉选项
    - 表格组合：使用 rowtitle + types + selects；types[i] 对应 rowtitle[i]，无选项的文本/数字字段用 [] 占位
    - 自增表格：使用 rowtitle + columntitle + selects，其中 selects 只有一行模板；模板内 "" 表示文本，"a|b|c" 表示下拉选项；可选 min_rows/max_rows 设置行数边界，不要用 minvalue/maxvalue 代替
    - 标准示例：
      {"qtype":"表格填空","title":"报名人基础信息","rowtitle":["姓名","手机号","微信号","紧急联系人"]}
      {"qtype":"表格数值","title":"活动参与与体能数据","rowtitle":["计划参与人数","每周打球次数","可接受人均费用(元)"],"minvalue":"0","maxvalue":"999"}
      {"qtype":"表格下拉框","title":"个人水平与装备情况","rowtitle":["羽毛球水平","是否自带球拍","是否需要拼车"],"selects":[["新手","初级","中级","高级","校队/专业"],["是","否"],["是","否"]]}
      {"qtype":"表格组合","title":"活动时间与场地偏好","rowtitle":["可参加时段","偏好场地类型","备注"],"types":["多选","下拉","文本"],"selects":[["工作日晚上","周末上午","周末下午","周末晚上"],["木地板","塑胶地","不限"],[]]}
      {"qtype":"自增表格","title":"可参加日期清单","rowtitle":["可参加日期","可参加时段","是否可候补"],"columntitle":["日期","时段","是否可候补"],"selects":[["","工作日晚上|周末上午|周末下午|周末晚上","可以|不可以"]],"min_rows":1,"max_rows":5}

    - 多项文件题 (711)、多项简答题 (712)：读取既有问卷或 Web 编辑器能力，当前 JSONL 创建接口会拒绝；生成时请改用多个普通文件上传/简答题，并重新生成完整 JSONL。

    适用边界：如果只是"几个简单填空"就用 多项填空（title 里的 {_}）；真正的"表格/多项"场景（有明确的行列结构、多字段录入）才用 706-710。

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

【投票题】
- 投票问卷必须在调用 create_survey_by_json 时显式传 atype=3
- 投票单选 / 投票多选的 JSON 题型名必须写在 qtype；title 只写题目正文，不写题目类型
- 示例：
  {"qtype":"投票单选","title":"你最喜欢哪个网站","select":["淘宝网","开心网","百度","腾讯","人人网"]}
  {"qtype":"投票多选","title":"哪些网站是你经常使用的","select":["淘宝网","开心网","百度","腾讯","人人网"]}

【反面示例 — 绝对禁止生成】
❌ 只输出 _meta 行不生成题目：{"qtype":"问卷基础信息","title":"客户满意度调查"}  ← 零题目会被拦截
❌ 占位符标题：{"qtype":"问卷基础信息","title":"???"}  ← 会被拦截
❌ 用 rowtitle 做多项填空：{"qtype":"多项填空","title":"联系方式","rowtitle":["电话","邮箱"]}  ← 服务端只会生成 1 个空位
❌ 模糊的矩阵 qtype：{"qtype":"矩阵题","title":"评价","rowtitle":[...],"select":[...]}  ← qtype 必须是精确子类型
❌ title 重复说明题目类型：{"qtype":"投票单选","title":"投票单选：你最喜欢哪个网站","select":[...]}  ← title 不要写题目类型
❌ 表格题使用旧字段当主格式：{"qtype":"表格组合","title":"活动偏好","rowtitle":[...],"columntype":[...],"columndata":[...]}  ← 生成时优先使用 rowtitle/types/selects 标准格式
❌ 用 JSON 数组包裹：[{...}, {...}]  ← 必须是 JSONL（每行一个 JSON），不是 JSON 数组
❌ 未被用户点名为选填的单项填空/建议题写成非必答：{"qtype":"单项填空","title":"请留下您的建议","requir":false}  ← 应省略 requir 或设为 true

【执行边界】本 prompt 只负责生成和展示 JSONL 预览，不会自动创建或保证执行/验证。生成后先向用户展示标题、真实题数、题型、必答项、atype 和预计发布状态；只有用户明确授权创建时，才调用 create_survey_by_json，并将完整 JSONL 与 atype 一起传入。若 qtype 不支持，停止创建并在确认后完整重新生成 JSONL，不得部分创建。投票/考试/表单/测评/360/民主测评场景请同时显式传正确的 atype。`;

/** qtype 约束指令。列表来自生成的 profile，避免 prompt 与 SDK 漂移。 */
function qtypeConstraint(): string {
  return `qtype 的值只能是生成 profile 中列出的值：${JSONL_QTYPES_RESOURCE.qtypes.join("、")}。完整分层、草稿限制和字段约束请以资源 wjx://reference/jsonl-qtypes 为准；本 prompt 的示例不是额外白名单。`;
}

/** 通用 JSONL 格式约束 */
const JSONL_CONSTRAINTS = "不要生成重复的题目以及无关的问题，同一题目不要生成相同的选项；referselect 字段的值必须是其他相关题型的 title 字段的值；题目顺序需要遵循逻辑顺序，由简单到复杂，由客观到主观，开放题要放在末尾。";

// ─── Registration ───────────────────────────────────────────────────

export function registerSurveyGenerationJsonPrompts(server: McpServer): void {
  // ═══ 1. Survey（调查/测评/投票/量表/民主测评 — JSON 格式）═════════════════
  server.prompt(
    "generate-survey-json",
    "AI 用 JSONL 格式生成调查/测评/投票/量表/民主测评问卷草案（支持 60+ 题型，含 BWS/MaxDiff/联合分析/Kano/PSM 等专业模型以及投票单选/投票多选）",
    {
      topic: z.string().describe("问卷主题（如：品牌偏好调研、员工满意度测评、投票选举、量表打分、民主测评）"),
      question_count: z.string().optional().describe("题目数量（默认15）"),
      requirements: z.string().optional().describe("额外要求（如：包含联合分析、使用 Kano 模型、李克特量表、360 评估）"),
    },
    async ({ topic, question_count, requirements }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `你是一名专业的问卷调研专家，擅长制作用户调查、市场研究、学术调查、测评、投票、量表、民主测评/360 评估等各类问卷。请根据主题「${topic}」生成一份高质量的问卷。${requirements ? `额外要求：${requirements}` : ""}

问卷设计思路：如果用户没有给出调研目的，请根据主题推测调研目的，结合主题推测场景和对象。从基本信息开始，逐步到意向、决策因素，然后是服务评估，最后是主观反馈。遵循逻辑顺序：由简单到复杂，从不敏感到敏感。充分利用丰富的题型（矩阵题、评分题、排序题、量表题、专业模型题等）。

题目数量硬性要求：必须生成 **${question_count ?? "15"} 道真实题目**（不计 _meta/分页/段落）。合理使用关联逻辑（relation 字段），让作答更加顺畅。推荐题型比例：单选（30%）、多选（25%）、量表/矩阵量表（15%）、矩阵单选（10%）、排序（5%）、填空（5%）、其它专业模型（10%，按主题取舍）。

【atype 选择硬性规则】判断主题后在调用 create_survey_by_json 时决定 atype：
- 主题含"投票/评选/最佳...评比" → **显式传 atype=3**，并使用投票单选/投票多选 qtype
- 主题含"测评/能力评估/心理测试" → **显式传 atype=2**
- 李克特量表/打分量表为主 → **显式传 atype=10**
- 360度评估 → **显式传 atype=4**
- 360评估无测评关系 → **显式传 atype=5**
- 民主测评/民主评议/多人互评 → **显式传 atype=11**
- 普通调查（默认） → atype=1（可省略）

【专业模型题型说明】
- BWS/MaxDiff/图片PK：使用 mdattr 字段列出评价对象，并显式提供正整数 pertaskcount/tasklength；图片PK 的 mdattr 必须是上传接口返回的图片地址，如 {"qtype":"MaxDiff","title":"选出最喜欢和最不喜欢的","mdattr":["对象1","对象2","对象3","对象4","对象5","对象6"],"pertaskcount":2,"tasklength":3}
- 联合分析：使用 columntitle 字段列出属性，如 {"qtype":"联合分析","title":"选择最吸引您的","columntitle":["品牌","价格","功能"]}
- Kano模型：使用 rowtitle + select，如 {"qtype":"Kano模型","title":"功能评价","rowtitle":["如果有该功能","如果没有该功能"],"select":["很喜欢","理所当然","无所谓","勉强接受","很不喜欢"]}
- PSM模型：使用 minvalue/maxvalue/steps + rowtitle，如 {"qtype":"PSM模型","minvalue":"1","maxvalue":"101","steps":"10","title":"价格评估","rowtitle":["太低不会购买","划算值得购买","较高但可接受","太高放弃购买"]}
- 品牌漏斗：使用 brands 字段，如 {"qtype":"品牌漏斗","brands":["品牌1","品牌2","品牌3"]}

${qtypeConstraint()}
${JSONL_CONSTRAINTS}${JSONL_FORMAT_INSTRUCTIONS}`,
        },
      }],
    }),
  );

  // ═══ 2. Exam（考试 — JSON 格式）══════════════════════════════════════
  server.prompt(
    "generate-exam-json",
    "AI 用 JSONL 格式生成考试问卷草案（支持考试单选/多选/判断/填空/简答/绘图/代码题）",
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

${qtypeConstraint()}
${JSONL_CONSTRAINTS}

【atype 硬性规则】调用 create_survey_by_json 时**必须显式传 atype=6**（考试），不要省略。${JSONL_FORMAT_INSTRUCTIONS}`,
        },
      }],
    }),
  );

  // ═══ 3. Form（表单 — JSON 格式）══════════════════════════════════════
  server.prompt(
    "generate-form-json",
    "AI 用 JSONL 格式生成表单草案（支持 60+ 题型，含手机验证/日期/地图/签名/商品/预约等表单专用题型）",
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
4. 多字段录入场景可按需求选择普通题型，或表格数值/表格填空/表格下拉框/表格组合/自增表格；多项文件题和多项简答题需转 Web 编辑器

表单题目数量硬性要求：必须生成至少 ${question_count ?? "10"} 道**真实题目**（不计 _meta/分页/段落），不允许只生成基础信息行就交差。

${qtypeConstraint()}
${JSONL_CONSTRAINTS}

【atype 硬性规则】调用 create_survey_by_json 时**必须显式传 atype=7**（表单），不要省略。${JSONL_FORMAT_INSTRUCTIONS}`,
        },
      }],
    }),
  );
}
