import { LABEL_TO_TYPE, TYPE_MAP } from "wjx-api-sdk";
import { CliError, handleError } from "../lib/errors.js";
// ─── Generate DSL label reference from the authoritative LABEL_TO_TYPE ───
/** Build the DSL type-label section dynamically from LABEL_TO_TYPE + TYPE_MAP. */
function buildDslLabelSection() {
    // Group by primary label (skip aliases)
    const seen = new Set();
    const entries = [];
    for (const [label, internalType] of Object.entries(LABEL_TO_TYPE)) {
        if (seen.has(internalType))
            continue;
        seen.add(internalType);
        const typeInfo = TYPE_MAP[internalType];
        if (!typeInfo)
            continue;
        const aliases = Object.entries(LABEL_TO_TYPE)
            .filter(([l, t]) => t === internalType && l !== label)
            .map(([l]) => l);
        const { q_type, q_subtype } = typeInfo;
        const typeStr = q_type === q_subtype
            ? `q_type=${q_type}`
            : `q_subtype=${q_subtype}`;
        const aliasStr = aliases.length > 0
            ? `（别名：${aliases.map(a => `[${a}]`).join("、")}）`
            : "";
        entries.push({ label, typeStr, aliasStr });
    }
    const maxLen = Math.max(...entries.map(e => e.label.length));
    return entries
        .map(e => `  [${e.label}]${" ".repeat(Math.max(1, maxLen - e.label.length + 2))}→ ${e.typeStr}${e.aliasStr}`)
        .join("\n");
}
// ─── Inline reference data ───
const TOPICS = {
    "dsl": {
        title: "DSL 文本语法参考",
        content: `# DSL 文本语法

用于 \`wjx survey create-by-text --text "..."\` 的问卷 DSL 格式。

## 结构

第 1 行：问卷标题
第 2 行（可选）：问卷描述
空行后：题目列表

## 题目格式

  序号. 题目标题[类型标签]
  A. 选项1
  B. 选项2
  ...

## 支持的类型标签（自动生成，与解析器一致）

${buildDslLabelSection()}

## 填空题占位符

  使用 {_} 表示填空位置：
  请输入姓名：{_}[填空题]
  {_}是中国的首都[多项填空题]

## 量表题格式

  选项用 最小值~最大值 格式：
  1. 满意度评分[量表题]
  1~5

## 矩阵题格式

  题目后使用 "行：" 标记行标题（也支持 "Rows:"）：
  1. 请评价各方面[矩阵量表题]
  行：
  - 沟通能力
  - 团队协作

  1~5

## 选填标记

  在标签后加 （选填）（中文全角括号）：
  1. 您的建议[填空题]（选填）

## 示例

  英语考试
  期末英语测试

  1. What is the capital of France?[单选题]
  A. London
  B. Paris
  C. Berlin

  2. Select all prime numbers:[多选题]
  A. 2
  B. 4
  C. 7

  3. True or False: Earth is flat.[判断题]
  A. 正确
  B. 错误

  4. The answer is {_}[填空题]

## 限制

DSL 不支持：逻辑跳转、验证规则、计分规则、随机化、自定义样式。
这些需要创建后通过 wjx survey update-settings 设置。

## 投票问卷

投票问卷使用 --type 3，题目仍然使用普通题型标签：

  1. 最佳个人奖[单选题]     ← 不是"投票单选"
  2. 最佳团队[多选题]       ← 不是"投票多选"

命令：wjx survey create-by-text --text "..." --type 3
注意：--type 3 控制问卷展示为投票样式，题型本身不变。

## 不支持的题型

以下题型无法通过 DSL/API 创建：
  签名题        → 用 [绘图题] 近似替代
  地区题        → API 不支持，建议用 [多级下拉题] 或网页端添加
  NPS 专用题    → 用 [量表题] + 0~10 实现相同效果
  自动每题一页  → 用 === 分页 === 手动分页

## AI Agent 注意事项

1. 一个需求 = 一个问卷：所有题目放在同一个 create-by-text 调用中
2. 问卷类型 ≠ 题目类型："投票单选"= --type 3 + [单选题]
3. 不支持的题型要告知用户，不要反复尝试或创建多个问卷`,
    },
    "question-types": {
        title: "题型与问卷类型映射表",
        content: `# 题型映射表 (q_type / q_subtype)

## 主类型

  q_type=1   分页
  q_type=2   段落说明
  q_type=3   单选题
  q_type=4   多选题
  q_type=5   填空题
  q_type=6   多项填空题
  q_type=7   矩阵题
  q_type=8   文件上传
  q_type=9   比重题
  q_type=10  滑动条题

## 单选子类型 (q_type=3)

  q_subtype=3     标准单选
  q_subtype=301   下拉框
  q_subtype=302   量表
  q_subtype=303   评分单选
  q_subtype=304   情景题
  q_subtype=305   判断题

## 多选子类型 (q_type=4)

  q_subtype=4     标准多选
  q_subtype=401   评分多选
  q_subtype=402   排序题
  q_subtype=403   商品题

## 填空子类型 (q_type=5)

  q_subtype=5     标准填空
  q_subtype=501   多级下拉

## 多项填空子类型 (q_type=6)

  q_subtype=6     标准多项填空
  q_subtype=601   考试填空
  q_subtype=602   完形填空

## 矩阵子类型 (q_type=7)

  q_subtype=7     矩阵通用
  q_subtype=701   矩阵量表
  q_subtype=702   矩阵单选
  q_subtype=703   矩阵多选
  q_subtype=704   矩阵填空
  q_subtype=705   矩阵滑块
  q_subtype=706   矩阵评分
  q_subtype=707   矩阵数字
  q_subtype=708   矩阵表格(下拉)
  q_subtype=709   矩阵NPS
  q_subtype=710   矩阵表格(填空)
  q_subtype=711   矩阵表格(单选)
  q_subtype=712   矩阵表格(通用)

## 文件上传子类型 (q_type=8)

  q_subtype=8     文件上传
  q_subtype=801   绘图

# 问卷类型 (atype) — 通过 --type 参数设置

  atype=1   调查问卷
  atype=2   测评
  atype=3   投票          ← 题目仍用普通[单选题]/[多选题]，不存在[投票单选题]
  atype=4   360度评估
  atype=5   360评估(无测评关系)
  atype=6   考试          ← 题目仍用普通[单选题]/[填空题]等
  atype=7   表单
  atype=8   用户体系
  atype=9   教学评估
  atype=11  民主评议

# 问卷状态 (status)

  status=0  未发布
  status=1  已发布
  status=2  已暂停
  status=3  已删除
  status=4  彻底删除
  status=5  审核中

## 考试问卷注意事项

创建考试时使用 --type 6 (atype=6)。
考试支持评分单选(303)、评分多选(401)、判断题(305)等。`,
    },
    "survey": {
        title: "survey 模块命令参考",
        content: `# survey 模块命令参考

## wjx survey list
  列出问卷列表。
  --page <n>       页码（默认 1）
  --page_size <n>  每页数量（默认 10）
  --status <n>     状态筛选：0=未发布, 1=已发布, 2=暂停, 3=删除
  --atype <n>      问卷类型：1=调查, 2=测评, 3=投票, 6=考试, 7=表单
  --name_like <s>  名称模糊搜索

## wjx survey get
  获取问卷详情（含题目和选项）。
  --vid <n>        问卷ID（必填）

## wjx survey create
  用 JSON 创建问卷。
  --title <s>      问卷标题（必填）
  --type <n>       问卷类型（默认 0）
  --description <s> 问卷描述
  --questions <json> 题目JSON数组（见 question-types 参考）
  --source_vid <s> 复制源问卷ID（与 questions 互斥）
  --publish        创建后立即发布

## wjx survey create-by-text (推荐)
  用 DSL 文本创建问卷，无需手写 JSON。
  --text <s>       DSL 格式文本（见 dsl 参考）
  --file <path>    从文件读取 DSL 文本
  --type <n>       问卷类型：1=调查, 2=测评, 3=投票, 6=考试, 7=表单
  --publish        创建后发布
  --creater <s>    创建者子账号

## wjx survey delete
  删除问卷。
  --vid <n>        问卷ID（必填）
  --username <s>   用户名（必填）
  --completely     彻底删除（不可恢复）

## wjx survey status
  更新问卷状态。
  --vid <n>        问卷ID（必填）
  --state <n>      目标状态：1=发布, 2=暂停, 3=删除

## wjx survey settings
  获取问卷设置。
  --vid <n>        问卷ID（必填）

## wjx survey update-settings
  更新问卷设置。
  --vid <n>            问卷ID（必填）
  --api_setting <json> API设置
  --after_submit_setting <json> 提交后设置
  --msg_setting <json> 消息设置
  --sojumpparm_setting <json> 参数设置
  --time_setting <json> 时间设置

## wjx survey export-text
  导出问卷为纯文本。
  --vid <n>        问卷ID（必填）
  --raw            输出纯文本（不包裹 JSON）

## wjx survey url
  生成问卷 URL。
  --mode <s>       模式: create 或 edit
  --name <s>       问卷名称（create模式）
  --activity <n>   问卷vid（edit模式必填）

## wjx survey tags / tag-details / clear-bin / upload
  详见 wjx survey <cmd> --help`,
    },
    "response": {
        title: "response 模块命令参考",
        content: `# response 模块命令参考

## wjx response count
  获取问卷答题数量。
  --vid <n>        问卷ID（必填）
  返回 { total_count, join_times }

## wjx response query
  分页查询答卷数据。
  --vid <n>        问卷ID（必填）
  --page_index <n> 页码
  --page_size <n>  每页数量（最大 200）
  --begin_time <n> 开始时间（Unix 毫秒）
  --end_time <n>   结束时间（Unix 毫秒）

## wjx response realtime
  实时增量查询（用于轮询新数据）。
  --vid <n>        问卷ID（必填）
  --count <n>      返回条数

## wjx response download
  下载答卷数据。
  --vid <n>        问卷ID（必填）

## wjx response submit
  提交一条答卷。
  --vid <n>             问卷ID（必填）
  --submitdata <s>      答题数据（必填，格式：题号$答案}题号$答案）
  --inputcosttime <n>   答题耗时秒数（必填）
  --submittime <s>      提交时间（可选）

  submitdata 编码规则：
    } 分隔不同题目
    $ 分隔题号与答案
    | 分隔多选的多个选项
    , 分隔排序题的多个选项（英文逗号）
  示例：
    单选："1$2" = 第1题选B
    填空："2$hello" = 第2题填hello
    多选："3$1|3" = 第3题选A和C（竖线分隔）
    排序："4$2,3,1" = 第4题排序：选项B第1名、选项C第2名、选项A第3名（英文逗号分隔，按排名顺序列出所有选项序号）

## wjx response modify
  修改答卷数据。
  --vid <n>        问卷ID（必填）
  --jid <n>        答卷ID（必填）
  --answers <s>    新答案数据

## wjx response clear
  清空答卷数据。
  --vid <n>        问卷ID（必填）
  --username <s>   用户名（必填）

## wjx response report / files / winners / 360-report
  详见 wjx response <cmd> --help`,
    },
    "analytics": {
        title: "analytics 分析命令参考",
        content: `# analytics 模块命令参考

所有 analytics 命令为本地计算，不需要 API Key。

## wjx analytics decode
  解码答卷数据。
  --submitdata <s>  编码后的答题字符串（必填）
  返回 { answers: [...], count: N }

## wjx analytics nps
  计算 NPS（净推荐值）。
  --scores <json>   评分数组，如 [9,10,7,3,8]（必填）
  评分范围 0-10：
    9-10 = 推荐者(Promoter)
    7-8  = 被动者(Passive)
    0-6  = 贬损者(Detractor)
  NPS = %推荐者 - %贬损者（范围 -100 ~ +100）
  行业基准：>50 优秀, >70 卓越

## wjx analytics csat
  计算 CSAT（客户满意度）。
  --scores <json>   评分数组（必填）
  --scale <s>       量表类型：5-point（默认）或 7-point
  CSAT = 满意评分的比例 × 100
  行业基准：>80% 良好, >90% 优秀

## wjx analytics anomalies
  检测异常答卷。
  --responses <json>  答卷数组 JSON（必填）
  检测模式：答题时间过短、重复答案模式、直线填答

## wjx analytics compare
  对比两组指标。
  --set_a <json>    A组指标 JSON（必填）
  --set_b <json>    B组指标 JSON（必填）
  返回各指标的差异和变化百分比

## wjx analytics decode-push
  解密数据推送载荷。
  --payload <s>     加密的 payload（必填）
  --app_key <s>     AppKey（必填）
  --signature <s>   签名（可选）
  --raw_body <s>    原始请求体（可选）
  加密方式：AES-128-CBC，密钥=MD5(appKey)前16位`,
    },
    "topics": {
        title: "可用参考主题列表",
        content: `# wjx reference 可用主题

  dsl              DSL 文本语法（create-by-text 用）
  question-types   题型 / 问卷类型映射表
  survey           survey 模块全部命令参数
  response         response 模块全部命令参数
  analytics        analytics 本地分析命令`,
    },
};
export function registerReferenceCommands(program) {
    program
        .command("reference")
        .description("输出命令参考文档（DSL语法、题型映射、命令参数等）")
        .argument("[topic]", "主题：dsl, question-types, survey, response, analytics（默认列出所有主题）")
        .action((topic) => {
        if (!topic) {
            console.log(TOPICS["topics"].content);
            return;
        }
        const entry = TOPICS[topic];
        if (!entry) {
            handleError(new CliError("INPUT_ERROR", `未知主题: ${topic}\n可用主题: ${Object.keys(TOPICS).filter(k => k !== "topics").join(", ")}`));
        }
        console.log(entry.content);
    });
}
//# sourceMappingURL=reference.js.map