import { z } from "zod";
import { registerAnalysisPrompts } from "./analysis.js";
import { registerSurveyGenerationJsonPrompts } from "./survey-generation-json.js";
export function registerPrompts(server) {
    server.prompt("design-survey", "引导 AI 设计问卷结构，包含题型选择、逻辑跳转和选项设计", {
        topic: z.string().describe("问卷主题（如：员工满意度、客户反馈、产品调研、年度评选投票）"),
        target_audience: z.string().optional().describe("目标受众（如：企业员工、消费者、学生）"),
        survey_type: z.string().optional().describe("问卷类型：调查/投票/测评/考试/表单"),
    }, async ({ topic, target_audience, survey_type }) => {
        const resolvedSurveyType = survey_type ?? "调查";
        const isVoteSurvey = resolvedSurveyType.includes("投票");
        const voteNotice = isVoteSurvey
            ? "\n\n投票题专用 qtype：「投票单选」/「投票多选」（作答页会显示每选项票数和百分比）。调用 create_survey_by_json 时请显式传 atype=3。"
            : "";
        return {
            messages: [{
                    role: "user",
                    content: {
                        type: "text",
                        text: `请帮我设计一份关于「${topic}」的${resolvedSurveyType}问卷。

目标受众：${target_audience ?? "通用"}

请按以下结构输出：
1. 问卷标题和描述
2. 题目列表（每题包含：题型、标题、选项/填空说明、是否必填）
3. 建议的逻辑跳转规则
4. 最终输出 JSONL 格式（供 create_survey_by_json 工具直接使用，推荐，支持 70+ 题型）

JSONL 格式说明（每行一个 JSON 对象）：
- 首行为问卷元数据：{"qtype":"问卷基础信息","title":"问卷标题","introduction":"问卷描述"}
- 后续每行一个题目，如：{"qtype":"单选","title":"题目标题","select":["选项1","选项2"]}
- title 只写题目正文，不要写题目序号或题目类型；题目类型只写在 qtype 字段
- 常用 qtype：单选、多选、单项填空、多项填空、下拉框、量表题、评分单选、评分多选、排序、判断题、矩阵量表、矩阵单选、矩阵多选、矩阵填空、文件上传、比重题、滑动条
- 表格题标准格式示例：{"qtype":"表格组合","title":"活动时间与场地偏好","rowtitle":["可参加时段","偏好场地类型","备注"],"types":["多选","下拉","文本"],"selects":[["工作日晚上","周末上午","周末下午","周末晚上"],["木地板","塑胶地","不限"],[]]}
- 投票题标准格式示例：{"qtype":"投票单选","title":"你最喜欢哪个网站","select":["淘宝网","开心网","百度","腾讯","人人网"]}，调用 create_survey_by_json 时显式传 atype=3
- 默认所有题目必答；单项填空、简答题、意见建议题、开放题默认也必须必答。只有用户明确指定某个题号/题目/字段为选填时，才给该题设 requir=false
- 量表题可用 minvaluetext/maxvaluetext 标注两端文字
- 多项填空必须在 title 中用 {_} 占位符表示每个子填空位，如 {"qtype":"多项填空","title":"电话 {_}，邮箱 {_}"}；**不要用 rowtitle 数组**（那是矩阵题字段，多项填空不支持，会导致只生成 1 个空位）
- 更多 qtype 及字段请参考 generate-survey-json prompt

所有问卷都必须使用 create_survey_by_json；即使只有简单题型，也要按 JSONL 逐行提供。${voteNotice}`,
                    },
                }],
        };
    });
    server.prompt("analyze-results", "引导 AI 获取并分析问卷数据，生成洞察报告", {
        survey_id: z.string().describe("问卷编号 (vid)"),
        focus_areas: z.string().optional().describe("关注重点（如：满意度趋势、NPS 分析、交叉分析）"),
    }, async ({ survey_id, focus_areas }) => ({
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
    }));
    server.prompt("create-nps-survey", "一键创建标准 NPS（净推荐值）问卷", {
        product_name: z.string().describe("产品或服务名称"),
        language: z.string().optional().describe("问卷语言：zh（默认）或 en"),
    }, async ({ product_name, language }) => {
        const isEn = language === "en";
        return {
            messages: [{
                    role: "user",
                    content: {
                        type: "text",
                        text: isEn
                            ? `Please create a standard NPS survey for "${product_name}" using the create_survey_by_json tool.

The survey should include:
1. NPS Question: "How likely are you to recommend ${product_name} to a friend or colleague?" (use qtype="NPS量表" with the 11 string options "0" through "10")
2. Follow-up: "What is the primary reason for your score?" (qtype="单项填空")
3. "What could we improve?" (qtype="单项填空", required by default)

Use survey type 1 (survey) and pass a JSONL string to create_survey_by_json. The first line must be the metadata object.`
                            : `请使用 create_survey_by_json 工具为「${product_name}」创建一份标准 NPS 问卷。

问卷应包含：
1. NPS 核心题：「您有多大可能向朋友或同事推荐${product_name}？」（使用 qtype="NPS量表"，select 必须是字符串 "0" 到 "10" 共 11 项）
2. 跟进题：「您给出这个评分的主要原因是什么？」（qtype="单项填空"）
3. 「您觉得我们还可以在哪些方面改进？」（qtype="单项填空"，默认必答）

使用问卷类型 1（调查），将首行元数据和题目逐行组成 JSONL 字符串，传给 create_survey_by_json 的 jsonl 参数。`,
                    },
                }],
        };
    });
    server.prompt("configure-webhook", "引导配置问卷星数据推送（Webhook），包括推送URL设置、加密配置、签名验证和测试", {
        vid: z.string().describe("问卷编号 (vid)"),
    }, async ({ vid }) => ({
        messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: `请帮我配置问卷 ${vid} 的数据推送（Webhook）。

请按以下步骤操作：

**第一步：查看当前设置**
调用 get_survey_settings 工具获取问卷 ${vid} 的当前配置，检查 msg_setting 中是否已有推送设置。

**第二步：配置推送参数**
调用 update_survey_settings 工具，通过 msg_setting 字段配置以下推送参数：
- push_url：接收推送数据的 HTTPS URL（必填）
- is_encrypt：是否启用 AES-128-CBC 加密（建议开启，设为 1）
- push_custom_params：需要附加的自定义参数（可选）

请向我确认推送 URL 和是否需要加密后再执行配置。

**第三步：了解推送数据格式**
参考资源 wjx://reference/push-format 了解推送载荷的完整字段说明：
- vid（问卷编号）、jid（答卷编号）、submitdata（答卷数据）、submittime（提交时间）
- source（来源）、ip（IP地址）等字段
- submitdata 的编码格式：题号$答案}题号$答案

**第四步：解密测试**
如果启用了加密，需要在接收端实现 AES 解密逻辑来验证推送密文：
- 加密算法：AES-128-CBC
- 密钥派生：MD5(appKey) 取前 16 字符
- 填充方式：PKCS7
- 密文格式：前 16 字节为 IV，其余为加密数据，整体 Base64 编码
（SDK 提供 decodePushPayload() 函数可直接解密，无需手动实现）

**第五步：签名验证**
推送请求在 HTTP 头中携带 X-Wjx-Signature 签名，验证方法：
- sign = SHA1(rawBody + appKey)
- 将请求原始 body 与 appKey 拼接后计算 SHA1
- 比对结果与请求头中的签名值，一致则验证通过

请告诉我你的推送接收 URL 以及是否需要开启加密，我来帮你完成配置。`,
                },
            }],
    }));
    // ═══ Anomaly Detection ═══════════════════════════════════════════════
    server.prompt("anomaly-detection", "检测问卷答卷中的异常数据：刷票、机器人、规律性作答、极短用时等", {
        vid: z.string().describe("问卷编号 (vid)"),
        threshold: z.string().optional().describe("异常阈值灵敏度：low/medium/high（默认 medium）"),
    }, async ({ vid, threshold }) => ({
        messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: `请对问卷 ${vid} 的答卷数据进行异常检测分析。

灵敏度：${threshold ?? "medium"}

请按以下步骤操作：

**第一步：获取数据**
1. 用 get_survey 获取问卷结构（了解题型分布）
2. 用 query_responses 获取答卷明细（需要 submitdata、submittime、inputcosttime、ip 等字段）

**第二步：检测以下异常模式**
- **速度异常**：答题用时（inputcosttime）低于正常范围（如 < 题目数 × 3秒）
- **规律性作答**：所有选择题答案相同（如全选A）或呈固定模式（如 ABCABC）
- **IP 集中**：大量答卷来自同一 IP 或同一 IP 段
- **时间集中**：短时间内出现大量提交（如 1分钟内 > 10 份）
- **答案雷同**：多份答卷的填空题答案高度相似（编辑距离 < 3）
- **直线作答**：矩阵题/量表题所有行选同一列

**第三步：输出报告**
- 异常答卷列表（jid + 异常类型 + 严重程度）
- 异常统计摘要（各类异常的数量和占比）
- 数据质量评分（0-100）
- 处理建议（是否需要剔除、标记或人工复核）

如需使用 SDK 的 detectAnomalies 函数，请参考 wjx://reference/analysis-methods 资源。`,
                },
            }],
    }));
    // ═══ Legacy User System Workflow ════════════════════════════════════
    server.prompt("user-system-workflow", "用户体系兼容工作流指导（已过时）：维护已有系统的参与者、绑定和参与状态", {
        scenario: z.string().optional().describe("使用场景（如：员工考核、培训评估、学生测评）"),
    }, async ({ scenario }) => ({
        messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: `请指导我维护一个已有的用户体系。该能力已过时，不能通过 API 新建 atype=8 用户体系问卷；只有在我提供已有 usid/sysid 并明确要求兼容维护时才继续。${scenario ? `\n\n使用场景：${scenario}` : ""}

## 用户体系兼容边界

用户体系工具仍注册在 MCP Server 中，用于历史系统的参与者、绑定关系和状态查询。创建接口不支持 atype=8；新项目请使用普通问卷、通讯录和标准分发能力。

### 步骤 1：确认已有系统

先确认用户提供的 usid/sysid、管理员账号和目标问卷编号；不要尝试创建 atype=8。

### 步骤 2：添加参与者
使用 add_participants 工具向用户体系添加用户：
- usid: 用户体系 ID（已有系统）
- uids: 用户 ID 列表（JSON 数组字符串）
- 可选：设置用户属性（姓名、部门等）

### 步骤 3：绑定问卷
使用 bind_activity 工具将问卷绑定到参与者：
- vid: 问卷编号
- usid: 用户体系 ID
- uids: 要绑定的用户 ID 列表
- 可选参数：
  - answer_times: 允许作答次数
  - can_chg_answer: 是否允许修改答案
  - can_view_result: 是否允许查看结果

### 步骤 4：分发问卷
使用 sso_user_system_url 生成每个用户的专属登录链接：
- 每个用户通过 SSO 链接登录后自动关联身份
- 链接由 sso_user_system_url 根据参数编码生成；当前实现不添加签名字段

### 步骤 5：查询参与状态
- query_survey_binding: 查看绑定状态和参与情况
  - join_status: 0=全部（默认）, 1=待参与, 2=已参与
  - 支持按日/周/月筛选
- query_user_surveys: 查看用户可参与的问卷列表

### 步骤 6：管理参与者
- modify_participants: 修改用户信息
- delete_participants: 移除用户

请先说明已有系统 ID 和要执行的兼容操作，我再帮你评估影响并逐步完成。`,
                },
            }],
    }));
    // ═══ Analysis Prompts ══════════════════════════════════════════════════
    registerAnalysisPrompts(server);
    // ═══ Survey Generation Prompts (JSON format) ════════════════════════
    registerSurveyGenerationJsonPrompts(server);
}
//# sourceMappingURL=index.js.map