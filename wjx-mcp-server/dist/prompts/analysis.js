import { z } from "zod";
export function registerAnalysisPrompts(server) {
    // ── 1. NPS 净推荐值完整分析 ──────────────────────────────────────────────
    server.prompt("nps-analysis", "NPS净推荐值完整分析：计算NPS得分、分类分布、趋势对比与改进建议", {
        survey_id: z.string().describe("问卷编号 (vid)"),
        time_range: z.string().optional().describe("时间范围（如：最近7天、2024-01至2024-03）"),
    }, async ({ survey_id, time_range }) => ({
        messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: `请对问卷 ${survey_id} 进行完整的 NPS（净推荐值）分析。${time_range ? `\n时间范围：${time_range}` : ""}

请严格按以下步骤操作：

**第一步：获取问卷结构**
调用 get_survey 工具获取问卷 ${survey_id} 的题目结构，识别出 NPS 核心题（通常是 0-10 分的量表题或评分题，询问推荐可能性）。

**第二步：获取统计报告**
调用 get_report 工具获取该问卷的统计数据概览。

**第三步：获取答卷明细**
调用 query_responses 工具获取所有答卷原始数据。${time_range ? `筛选条件：${time_range}。` : ""}
注意：query_responses 每页最多返回 50 条，如果答卷总数超过 50，需要通过 page_index 参数分页获取所有数据，直到返回结果为空。

**第四步：计算 NPS 得分**
根据答卷数据，对 NPS 题的回答进行分类统计：
- 推荐者 (Promoters)：评分 9-10 分
- 被动者 (Passives)：评分 7-8 分
- 贬损者 (Detractors)：评分 0-6 分

计算公式：NPS = 推荐者占比(%) - 贬损者占比(%)

**第五步：基准对比**
将计算出的 NPS 得分与行业基准进行对比：
- 优秀：> 70
- 良好：50 - 70
- 一般：0 - 50
- 较差：< 0

**第六步：输出分析报告**
请输出包含以下内容的完整报告：
1. NPS 得分及评级
2. 三类人群的数量与占比分布
3. 贬损者的主要不满原因（结合开放题回答分析）
4. 提升 NPS 的具体建议
5. 数据汇总表格`,
                },
            }],
    }));
    // ── 2. CSAT 客户满意度分析 ──────────────────────────────────────────────
    server.prompt("csat-analysis", "CSAT客户满意度分析：计算满意度得分、驱动因素分析与改进优先级", {
        survey_id: z.string().describe("问卷编号 (vid)"),
        satisfaction_question_index: z.string().optional().describe("满意度题的题号索引（如不指定则自动识别）"),
    }, async ({ survey_id, satisfaction_question_index }) => ({
        messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: `请对问卷 ${survey_id} 进行 CSAT（客户满意度）分析。${satisfaction_question_index ? `\n指定满意度题号：第 ${satisfaction_question_index} 题` : ""}

请严格按以下步骤操作：

**第一步：获取问卷结构**
调用 get_survey 工具获取问卷 ${survey_id} 的题目结构。${satisfaction_question_index ? `重点关注第 ${satisfaction_question_index} 题作为满意度核心题。` : `自动识别满意度相关题目（通常包含'满意'、'满意度'等关键词的量表题或单选题）。`}

**第二步：获取统计报告**
调用 get_report 工具获取统计数据。

**第三步：获取答卷明细**
调用 query_responses 工具获取所有答卷原始数据。
注意：query_responses 每页最多返回 50 条，如果答卷总数超过 50，需要通过 page_index 参数分页获取所有数据，直到返回结果为空。

**第四步：计算 CSAT 得分**
CSAT = 满意回答数 / 总回答数 x 100%
- 对于 5 分制量表：4-5 分视为满意
- 对于 7 分制量表：5-7 分视为满意
- 对于选择题：选择满意或非常满意选项视为满意

**第五步：驱动因素分析**
分析其他题目的回答与满意度之间的关系：
- 哪些因素与高满意度强相关？
- 哪些因素是不满意的主要驱动？
- 建立重要性-满意度矩阵

**第六步：输出分析报告**
请输出包含以下内容的完整报告：
1. 总体 CSAT 得分及评级（优秀 >90%、良好 75-90%、一般 50-75%、较差 <50%）
2. 各满意度等级的分布情况
3. 满意度驱动因素排序
4. 需要优先改进的领域
5. 提升满意度的具体建议
6. 数据汇总表格`,
                },
            }],
    }));
    // ── 3. 交叉分析 ────────────────────────────────────────────────────────
    server.prompt("cross-tabulation", "交叉分析：分析两个题目之间的关联关系，生成交叉统计表", {
        survey_id: z.string().describe("问卷编号 (vid)"),
        question_a: z.string().describe("第一个题目的索引号"),
        question_b: z.string().describe("第二个题目的索引号"),
    }, async ({ survey_id, question_a, question_b }) => ({
        messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: `请对问卷 ${survey_id} 中的第 ${question_a} 题和第 ${question_b} 题进行交叉分析。

请严格按以下步骤操作：

**第一步：获取问卷结构**
调用 get_survey 工具获取问卷 ${survey_id} 的完整题目结构，确认第 ${question_a} 题和第 ${question_b} 题的题型、选项内容。

**第二步：获取答卷明细**
调用 query_responses 工具获取所有答卷原始数据。
注意：query_responses 每页最多返回 50 条，如果答卷总数超过 50，需要通过 page_index 参数分页获取所有数据，直到返回结果为空。

**第三步：解析答卷数据**
答卷的 submitdata 格式为：题号$答案}题号$答案
- 分隔符 } 分隔不同题目
- 分隔符 $ 分隔题号和答案
- 分隔符 | 分隔多选/排序题答案
- 排序题答案按排名顺序列出所有选项序号（如 2|3|1 表示选项2第1名、选项3第2名、选项1第3名）
提取每份答卷中第 ${question_a} 题和第 ${question_b} 题的回答。

**第四步：构建交叉统计表**
以第 ${question_a} 题的选项为行、第 ${question_b} 题的选项为列，统计每个交叉单元格的：
- 频次（人数）
- 行百分比
- 列百分比
- 总体百分比

**第五步：关联性分析**
- 观察是否存在明显的回答模式
- 判断两个题目之间是否存在关联
- 找出最显著的交叉组合

**第六步：输出分析报告**
请输出包含以下内容的完整报告：
1. 交叉统计表（含频次和百分比）
2. 关键发现：哪些组合出现频率异常高或低
3. 两题之间的关联性判断
4. 基于交叉分析结果的业务建议
5. 原始数据汇总`,
                },
            }],
    }));
    // ── 4. 开放题情感/主题分析 ──────────────────────────────────────────────
    server.prompt("sentiment-analysis", "开放题情感与主题分析：对填空题文本进行情感倾向和关键主题提取", {
        survey_id: z.string().describe("问卷编号 (vid)"),
        question_index: z.string().optional().describe("指定分析的填空题题号索引（如不指定则分析所有开放题）"),
    }, async ({ survey_id, question_index }) => ({
        messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: `请对问卷 ${survey_id} 的开放题回答进行情感分析和主题提取。${question_index ? `\n指定分析题号：第 ${question_index} 题` : ""}

请严格按以下步骤操作：

**第一步：获取问卷结构**
调用 get_survey 工具获取问卷 ${survey_id} 的题目结构。${question_index ? `确认第 ${question_index} 题为填空题/开放题。` : `识别所有填空题（q_type=5）和多项填空题（q_type=6）。`}

**第二步：获取答卷明细**
调用 query_responses 工具获取所有答卷原始数据。
注意：query_responses 每页最多返回 50 条，如果答卷总数超过 50，需要通过 page_index 参数分页获取所有数据，直到返回结果为空。

**第三步：提取文本回答**
从答卷的 submitdata 中提取目标开放题的文本回答：
- 格式：题号$答案文本
- 过滤掉空白回答
- 记录有效回答的总数

**第四步：情感分析**
对每条文本回答进行情感分类：
- 正面 (Positive)：表达满意、赞赏、认可
- 中性 (Neutral)：客观描述、无明显情感倾向
- 负面 (Negative)：表达不满、批评、抱怨
统计各情感类别的数量和占比。

**第五步：主题提取**
从文本回答中提取高频主题和关键词：
- 识别反复出现的话题/关键词
- 按出现频率排序
- 将主题与情感倾向交叉分析（哪些主题正面多、哪些负面多）

**第六步：输出分析报告**
请输出包含以下内容的完整报告：
1. 情感分布概览（正面/中性/负面的数量与占比）
2. Top 10 高频主题/关键词及其出现次数
3. 主题-情感交叉矩阵
4. 各情感类别的典型回答示例（每类 2-3 条）
5. 关键发现与洞察
6. 基于文本分析的改进建议`,
                },
            }],
    }));
    // ── 5. 问卷质量诊断 ────────────────────────────────────────────────────
    server.prompt("survey-health-check", "问卷质量诊断：检查完成率、流失模式、异常回答和题目质量", {
        survey_id: z.string().describe("问卷编号 (vid)"),
    }, async ({ survey_id }) => ({
        messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: `请对问卷 ${survey_id} 进行全面的质量诊断。

请严格按以下步骤操作：

**第一步：获取问卷结构**
调用 get_survey 工具获取问卷 ${survey_id} 的完整题目结构，记录题目数量、题型分布、必填设置。

**第二步：获取统计报告**
调用 get_report 工具获取统计数据，关注回收量、浏览量、完成率。

**第三步：获取答卷明细**
调用 query_responses 工具获取答卷原始数据，用于细粒度分析。
注意：query_responses 每页最多返回 50 条，如果答卷总数超过 50，需要通过 page_index 参数分页获取所有数据，直到返回结果为空。

**第四步：完成率与流失分析**
- 计算总体完成率（完成答卷数 / 开始答卷数）
- 分析各题的回答率，找出流失高峰题目
- 判断是否存在某道题之后回答率骤降的断崖式流失
- 评估问卷长度是否合理

**第五步：回答时间分析**
- 统计平均作答时间、中位数作答时间
- 识别异常快速完成的答卷（可能是随意填写）
- 识别异常缓慢完成的答卷（可能中途暂停）
- 建议合理的作答时间阈值

**第六步：直线作答检测（Straight-lining）**
- 检查矩阵题、量表题中是否有大量连续相同答案
- 统计疑似直线作答的答卷比例
- 评估这些答卷对数据质量的影响

**第七步：题目质量评估**
- 选择题选项分布是否合理（是否有选项从未被选择）
- 填空题有效回答率
- 题目表述是否可能产生歧义
- 量表题/评分题的区分度

**第八步：输出诊断报告**
请输出包含以下内容的完整质量诊断报告：
1. 总体健康度评分（满分100分）及评级
2. 合格指标清单
3. 需要关注的问题
4. 严重问题警告
5. 关键数据指标汇总（完成率、平均时间、有效答卷比例等）
6. 各题逐题诊断结果
7. 改进建议（按优先级排序）
8. 建议清洗的异常答卷列表`,
                },
            }],
    }));
    // ── 6. 跨时段/跨问卷对比分析 ───────────────────────────────────────────
    server.prompt("comparative-analysis", "跨时段或跨问卷对比分析：比较多份问卷的关键指标差异与趋势", {
        survey_ids: z.string().describe("问卷编号列表（逗号分隔，如：12345,67890,11111）"),
        comparison_type: z.string().optional().describe("对比类型：time（同一问卷不同时段）或 survey（不同问卷之间），默认 survey"),
    }, async ({ survey_ids, comparison_type }) => {
        const ids = survey_ids.split(",").map(id => id.trim());
        const compType = comparison_type ?? "survey";
        const isTimeComparison = compType === "time";
        return {
            messages: [{
                    role: "user",
                    content: {
                        type: "text",
                        text: `请对以下问卷进行${isTimeComparison ? "跨时段" : "跨问卷"}对比分析。
问卷编号：${ids.join("、")}
对比类型：${isTimeComparison ? "同一问卷的不同时段数据对比" : "不同问卷之间的横向对比"}

请严格按以下步骤操作：

**第一步：逐个获取问卷信息**
${ids.map((id, i) => `${i + 1}. 调用 get_survey 工具获取问卷 ${id} 的结构`).join("\n")}

**第二步：逐个获取统计报告**
${ids.map((id, i) => `${i + 1}. 调用 get_report 工具获取问卷 ${id} 的统计数据`).join("\n")}

**第三步：数据整理**
将各问卷的关键指标整理成可比较的格式：
- 回收量
- 完成率
- 平均作答时间
- 各题的回答分布

**第四步：对比分析**
${isTimeComparison
                            ? `进行时间维度的纵向对比：
- 各指标随时间的变化趋势
- 是否存在显著的上升或下降
- 关键转折点识别
- 季节性或周期性规律`
                            : `进行问卷之间的横向对比：
- 相同/相似题目的回答差异
- 各问卷的回收量和完成率对比
- 各问卷受众特征的差异
- 共同趋势与独特发现`}

**第五步：差异显著性判断**
- 标记差异幅度超过 10% 的指标
- 判断差异是否具有实际意义
- 分析可能的原因

**第六步：输出对比分析报告**
请输出包含以下内容的完整报告：
1. 核心指标对比总览表
2. ${isTimeComparison ? "趋势变化图表描述" : "各问卷关键指标对比"}
3. 显著差异点分析
4. ${isTimeComparison ? "时间趋势洞察" : "共性与差异总结"}
5. 基于对比分析的建议
6. 完整数据对比表`,
                    },
                }],
        };
    });
}
//# sourceMappingURL=analysis.js.map