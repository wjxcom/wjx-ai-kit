---
name: wjx-mcp-use
description: "Guide for using wjx-mcp-server MCP tools to interact with the Wenjuanxing (问卷星) platform. Use when the user mentions: 问卷, 调查, 收集, 表单, 投票, 考试, 测评, 满意度, NPS, 问卷星, wjx, survey, questionnaire — or wants to create surveys, query responses, analyze data, manage contacts, or generate SSO links via MCP protocol. Covers 57 tools, 8 resources, and 19 prompts."
---

# wjx-mcp-server Usage Guide

wjx-mcp-server 提供 57 个 MCP 工具、8 个参考资源和 19 个 prompt 模板，覆盖问卷星 OpenAPI 的全部能力。

## AI Agent 行为准则（必读）

### 规则 1：一个需求 = 一个问卷

无论用户要求多少种题型，**必须在一次 `create_survey_by_text` 调用中包含所有题目**。一个问卷可包含任意数量、任意类型的题目。

### 规则 2：问卷类型 ≠ 题目类型

"投票/考试/调查"是**问卷类型**（`atype` 参数），不是题型标签。`atype: 3` + `[单选题]` = 投票单选，不存在 `[投票单选题]` 标签。

### 规则 3：不支持的题型要明确告知

签名题（用 `[绘图题]` 替代）、地区题（用 `[多级下拉题]` 或网页端添加）、NPS 专用题（用 `[量表题]` + `0~10`）不在 DSL 支持范围内。告知用户替代方案，继续创建其他题目，**不要**反复尝试或拆分多个问卷。

### 规则 4：面向用户说自然语言，不说工具名

用户不需要知道 MCP 工具的存在。**不要**在回复中展示工具名或调用参数。唯一例外：用户明确要求调试时。

### 规则 5：首次使用时检查配置

首次使用问卷星功能，先调用 `get_config` 确认 API Key 和 Base URL 是否已配置。

- **api_key 未设置**：引导用户在 AI 工具的 MCP 配置中添加 `WJX_API_KEY` 环境变量
- **base_url 与用户域名不符**：引导添加 `WJX_BASE_URL` 环境变量（如 `https://xxx.sojump.cn`）
- **获取 API Key**：让用户访问 `https://<域名>/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1`，微信扫码登录后复制 Key
- **cli_version 未安装**：可选，安装 `npm install -g wjx-cli` 后用 `wjx init --api-key <key>` 统一配置

## 快速路由

| 用户意图 | 工具 |
|---------|------|
| 做调查/问卷 | `create_survey_by_text({ text: "...", atype: 1 })` |
| 做考试/测验 | `create_survey_by_text({ text: "...", atype: 6 })` |
| 做投票 | `create_survey_by_text({ text: "...", atype: 3 })` |
| 做表单/报名表 | `create_survey_by_text({ text: "...", atype: 7 })` |
| 看问卷结果 | `get_report({ vid })` 统计概览，`query_responses({ vid })` 明细 |
| 导出答卷数据 | `download_responses({ vid })` |
| 查看问卷链接 | `build_survey_url({ mode: "edit", activity: vid })` |
| 分析 NPS | `calculate_nps({ scores: [...] })` |
| 查当前配置 | `get_config({})` |

## 工具总览（57 tools）

| 模块 | 工具数 | 说明 |
|------|--------|------|
| 问卷管理 | 12 | create_survey, create_survey_by_text, get_survey, list_surveys, update_survey_status, get/update_survey_settings, delete_survey, get_question_tags, get_tag_details, upload_file, clear_recycle_bin |
| 答卷数据 | 9 | query_responses, query_responses_realtime, download_responses, get_report, submit_response, get_winners, modify_response, get_360_report, clear_responses |
| 通讯录 | 14 | query/add/delete_contacts, add/delete/restore_admin, list/add/modify/delete_departments, list/add/modify/delete_tags |
| 子账号 | 5 | add/modify/delete/restore/query_sub_accounts |
| SSO | 5 | sso_subaccount_url, sso_user_system_url, sso_partner_url, build_survey_url, build_preview_url |
| 分析计算 | 5 | decode_responses, calculate_nps, calculate_csat, detect_anomalies, compare_metrics |
| 用户体系 | 6 | add/modify/delete_participants, bind_activity, query_survey_binding, query_user_surveys |
| 诊断 | 1 | get_config — API Key（脱敏）、Base URL、CLI 版本、配置来源 |

详细参数见 [references/tools-survey.md](references/tools-survey.md)、[references/tools-response.md](references/tools-response.md)、[references/tools-other.md](references/tools-other.md)。

## 核心工作流

### 创建问卷（推荐 DSL 文本方式）

```
1. create_survey_by_text({ text: "问卷标题\n\n1. 题目[单选题]\nA. 选项A\nB. 选项B", atype: 6 })
2. get_survey({ vid: N }) — 验证内容
3. build_survey_url({ mode: "edit", activity: N }) — 提供编辑链接
```

**考试问卷（atype=6）注意**：正确答案和每题分值**无法**通过 API 设置。创建后应提供编辑链接，指引用户在网页端配置答案与评分。

DSL 语法详见 `wjx://reference/dsl-syntax` 资源，或 [references/dsl-and-types.md](references/dsl-and-types.md)。

### 查询和分析数据

```
1. get_report({ vid: N }) — 统计概览（首选）
2. query_responses({ vid: N, page_size: 50 }) — 明细数据
3. decode_responses({ submitdata: "..." }) — 解码答卷格式
4. calculate_nps / calculate_csat — 分析指标
5. detect_anomalies({ responses: [...] }) — 数据质量检查
```

## 常见错误与处理

| 错误现象 | 原因 | 解决方案 |
|---------|------|---------|
| "appkey error" | API Key 错误或过期 | `get_config` 查看 key，引导重新获取 |
| "activity not found" | 问卷 vid 不存在 | `list_surveys` 确认正确 vid |
| "corp_id required" | 通讯录操作缺企业 ID | 配置 `WJX_CORP_ID` 环境变量 |
| 网络超时 | base_url 错误或网络不通 | `get_config` 检查 base_url |
| 创建问卷题目丢失 | DSL 格式错误 | 检查题号 + [题型标签]，选项各占一行 |

更多排查详见 [references/troubleshooting.md](references/troubleshooting.md)。

## MCP 资源（参考数据）

| 资源 URI | 内容 |
|----------|------|
| `wjx://reference/dsl-syntax` | DSL 文本语法（create_survey_by_text 用） |
| `wjx://reference/question-types` | 题型和子类型完整映射表 |
| `wjx://reference/survey-types` | 问卷类型编码（1=调查, 6=考试 等） |
| `wjx://reference/survey-statuses` | 问卷状态码 |
| `wjx://reference/response-format` | submitdata 编码格式 |
| `wjx://reference/analysis-methods` | NPS/CSAT/CES 公式和行业基准 |
| `wjx://reference/user-roles` | 子账号角色编码 |
| `wjx://reference/push-format` | 数据推送格式和加密说明 |

## Prompt 模板（19 个）

**通用/运维（6）：** design-survey, analyze-results, create-nps-survey, configure-webhook, anomaly-detection, user-system-workflow

**分析（6）：** nps-analysis, csat-analysis, cross-tabulation, sentiment-analysis, survey-health-check, comparative-analysis

**问卷生成（7）：** generate-survey, generate-nps-survey, generate-360-evaluation, generate-satisfaction-survey, generate-engagement-survey, generate-exam-from-document, generate-exam-from-knowledge

## 常用枚举值

| 参数 | 值 |
|------|-----|
| 问卷类型 (atype) | 1=调查, 2=测评, 3=投票, 6=考试, 7=表单 |
| 问卷状态 (state) | 1=发布, 2=暂停, 3=删除 |
| 下载格式 (suffix) | 0=CSV, 1=SAV, 2=Word |
| 角色 (roleid) | 1=系统管理员, 2=问卷管理员, 3=统计查看, 4=全部查看 |

## Reference 文件（按需查阅）

- [DSL 语法与题型](references/dsl-and-types.md) — DSL 格式、25+ 题型标签、q_type/q_subtype 映射表
- [问卷工具详解](references/tools-survey.md) — 12 个问卷管理工具的完整参数
- [答卷工具详解](references/tools-response.md) — 9 个答卷数据工具的完整参数
- [其他工具详解](references/tools-other.md) — 通讯录、子账号、SSO、分析、推送工具参数
- [错误排查](references/troubleshooting.md) — API 错误码、配置问题、自定义域名、考试限制
