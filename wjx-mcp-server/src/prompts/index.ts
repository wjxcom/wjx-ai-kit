import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerAnalysisPrompts } from "./analysis.js";
import { registerSurveyGenerationPrompts } from "./survey-generation.js";
import { registerSurveyGenerationJsonPrompts } from "./survey-generation-json.js";

export function registerPrompts(server: McpServer): void {
  server.prompt(
    "design-survey",
    "引导 AI 设计问卷结构，包含题型选择、逻辑跳转和选项设计",
    {
      topic: z.string().describe("问卷主题（如：员工满意度、客户反馈、产品调研）"),
      target_audience: z.string().optional().describe("目标受众（如：企业员工、消费者、学生）"),
      survey_type: z.string().optional().describe("问卷类型：调查/测评/考试/表单（不支持投票）"),
    },
    async ({ topic, target_audience, survey_type }) => {
      const isVoteSurvey = survey_type?.includes("投票") ?? false;
      const resolvedSurveyType = isVoteSurvey ? "调查" : (survey_type ?? "调查");
      const voteNotice = isVoteSurvey
        ? "\n\n注意：当前接口不支持创建投票类型问卷，请改为调查、测评、考试或表单方案。"
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
- 常用 qtype：单选、多选、单项填空、多项填空、下拉框、量表题、评分单选、评分多选、排序题、判断题、矩阵量表题、矩阵单选题、矩阵多选题、矩阵填空题、文件上传、比重题、滑动条
- 默认所有题目必答；只有用户明确要求选填时，才设 requir=false
- 量表题可用 minvaluetext/maxvaluetext 标注两端文字
- 多项填空必须在 title 中用 {_} 占位符表示每个子填空位，如 {"qtype":"多项填空","title":"电话 {_}，邮箱 {_}"}；**不要用 rowtitle 数组**（那是矩阵题字段，多项填空不支持，会导致只生成 1 个空位）
- 更多 qtype 及字段请参考 generate-survey-json prompt

如果问卷仅涉及简单题型（约 25 种），也可退而使用 DSL 文本格式 + create_survey_by_text 工具。${voteNotice}`,
          },
        }],
      };
    },
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
1. NPS Question: "How likely are you to recommend ${product_name} to a friend or colleague?" (Scale 0-10, use q_type=3, q_subtype=302 for 量表题, with 11 items indexed 0-10)
2. Follow-up: "What is the primary reason for your score?" (Open text, q_type=5)
3. "What could we improve?" (Open text, q_type=5, required by default)

Use survey type 1 (survey) and output the create_survey tool call with properly formatted questions JSON.`
              : `请使用 create_survey 工具为「${product_name}」创建一份标准 NPS 问卷。

问卷应包含：
1. NPS 核心题：「您有多大可能向朋友或同事推荐${product_name}？」（0-10分量表，使用 q_type=3, q_subtype=302，items 数组包含 0-10 共 11 个选项）
2. 跟进题：「您给出这个评分的主要原因是什么？」（填空题，q_type=5）
3. 「您觉得我们还可以在哪些方面改进？」（填空题，q_type=5，默认必答）

使用问卷类型 1（调查），输出 create_survey 工具调用，questions 参数为正确格式的 JSON。`,
          },
        }],
      };
    },
  );

  server.prompt(
    "configure-webhook",
    "引导配置问卷星数据推送（Webhook），包括推送URL设置、加密配置、签名验证和测试",
    {
      vid: z.string().describe("问卷编号 (vid)"),
    },
    async ({ vid }) => ({
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
    }),
  );

  // ═══ Anomaly Detection ═══════════════════════════════════════════════
  server.prompt(
    "anomaly-detection",
    "检测问卷答卷中的异常数据：刷票、机器人、规律性作答、极短用时等",
    {
      vid: z.string().describe("问卷编号 (vid)"),
      threshold: z.string().optional().describe("异常阈值灵敏度：low/medium/high（默认 medium）"),
    },
    async ({ vid, threshold }) => ({
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
    }),
  );

  // ═══ User System Workflow ═══════════════════════════════════════════
  server.prompt(
    "user-system-workflow",
    "用户体系完整工作流指导：创建用户体系问卷 → 添加参与者 → 绑定问卷 → 分发 → 查询参与状态",
    {
      scenario: z.string().optional().describe("使用场景（如：员工考核、培训评估、学生测评）"),
    },
    async ({ scenario }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `请指导我完成一个完整的用户体系问卷工作流。${scenario ? `\n\n使用场景：${scenario}` : ""}

## 用户体系工作流概览

用户体系（atype=8）允许你为特定用户群发放问卷，追踪每个人的参与状态。

### 步骤 1：创建用户体系问卷
使用 create_survey 工具创建问卷，atype 设为 8（用户体系）：
- 设计好题目结构
- 可选：发布问卷（publish=true）

### 步骤 2：添加参与者
使用 add_participants 工具向用户体系添加用户：
- username: 管理员用户名
- sysid: 用户体系 ID（从问卷详情获取）
- uids: 用户 ID 列表（JSON 数组字符串）
- 可选：设置用户属性（姓名、部门等）

### 步骤 3：绑定问卷
使用 bind_activity 工具将问卷绑定到参与者：
- vid: 问卷编号
- sysid: 用户体系 ID
- uids: 要绑定的用户 ID 列表
- 可选参数：
  - answer_times: 允许作答次数
  - can_chg_answer: 是否允许修改答案
  - can_view_result: 是否允许查看结果

### 步骤 4：分发问卷
使用 build_sso_user_system_url 生成每个用户的专属登录链接：
- 每个用户通过 SSO 链接登录后自动关联身份
- 链接格式：基础 URL + 签名参数

### 步骤 5：查询参与状态
- query_survey_binding: 查看绑定状态和参与情况
  - join_status: 0=全部（默认）, 1=待参与, 2=已参与
  - 支持按日/周/月筛选
- query_user_surveys: 查看用户可参与的问卷列表

### 步骤 6：管理参与者
- modify_participants: 修改用户信息
- delete_participants: 移除用户

请告诉我你的具体需求，我来帮你一步步完成。`,
        },
      }],
    }),
  );

  // ═══ Analysis Prompts ══════════════════════════════════════════════════
  registerAnalysisPrompts(server);

  // ═══ Survey Generation Prompts ════════════════════════════════════════
  registerSurveyGenerationPrompts(server);

  // ═══ Survey Generation Prompts (JSON format) ════════════════════════
  registerSurveyGenerationJsonPrompts(server);
}
