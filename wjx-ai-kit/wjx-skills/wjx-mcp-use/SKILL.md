---
name: wjx-mcp-use
description: Guide for using wjx-mcp-server MCP tools to interact with the Wenjuanxing (问卷星) platform. Use when the user wants to create surveys, query responses, analyze data, manage contacts, or generate SSO links via MCP protocol. Covers 56 tools, 8 resources, and 19 prompts.
---

# wjx-mcp-server Usage Guide

wjx-mcp-server 提供 56 个 MCP 工具、8 个参考资源和 19 个 prompt 模板，覆盖问卷星 OpenAPI 的全部能力。

## 工具总览（56 tools）

| 模块 | 工具数 | 说明 |
|------|--------|------|
| 问卷管理 | 12 | create_survey, create_survey_by_text, get_survey, list_surveys, update_survey_status, get/update_survey_settings, delete_survey, get_question_tags, get_tag_details, upload_file, clear_recycle_bin |
| 答卷数据 | 9 | query_responses, query_responses_realtime, download_responses, get_report, submit_response, get_winners, modify_response, get_360_report, clear_responses |
| 通讯录 | 14 | query/add/delete_contacts, add/delete/restore_admin, list/add/modify/delete_departments, list/add/modify/delete_tags |
| 子账号 | 5 | add/modify/delete/restore/query_sub_accounts |
| SSO | 5 | sso_subaccount_url, sso_user_system_url, sso_partner_url, build_survey_url, build_preview_url |
| 分析计算 | 5 | decode_responses, calculate_nps, calculate_csat, detect_anomalies, compare_metrics |
| 用户体系 | 6 | add/modify/delete_participants, bind_activity, query_survey_binding, query_user_surveys |

详细参数见 [references/tools-survey.md](references/tools-survey.md)、[references/tools-response.md](references/tools-response.md)、[references/tools-other.md](references/tools-other.md)。

## 核心工作流

### 1. 创建问卷（推荐 DSL 文本方式）

```
1. create_survey_by_text({ text: "问卷标题\n\n1. 题目[单选题]\nA. 选项A\nB. 选项B", atype: 6 })
2. get_survey({ vid: N }) — 验证内容
3. build_survey_url({ mode: "edit", activity: N }) — 提供编辑链接
```

DSL 语法详见 `wjx://reference/dsl-syntax` 资源，或 [references/dsl-and-types.md](references/dsl-and-types.md)。

### 2. 查询和分析数据

```
1. get_report({ vid: N }) — 统计概览（首选）
2. query_responses({ vid: N, page_size: 50 }) — 明细数据
3. decode_responses({ submitdata: "..." }) — 解码答卷格式
4. calculate_nps({ scores: [...] }) / calculate_csat({ scores: [...] }) — 分析
5. detect_anomalies({ responses: [...] }) — 数据质量检查
```

### 3. 管理通讯录

```
1. add_contacts({ users: [...] }) — 批量导入（最多 100 条）
2. query_contacts({ uid: "..." }) — 验证
3. list_departments() / add_department({ depts: [...] }) — 部门管理
```

## MCP 资源（参考数据）

调用工具前可查阅，获取编码参考：

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

可直接使用的预定义工作流：

**通用/运维（6）：**

| Prompt | 用途 |
|--------|------|
| `design-survey` | 引导设计问卷结构 |
| `analyze-results` | 获取并分析问卷数据 |
| `create-nps-survey` | 一键创建 NPS 问卷 |
| `configure-webhook` | 配置数据推送 |
| `anomaly-detection` | 异常答卷检测 |
| `user-system-workflow` | 用户体系完整流程 |

**分析（6）：**

| Prompt | 用途 |
|--------|------|
| `nps-analysis` | NPS 完整分析（得分、分布、建议） |
| `csat-analysis` | CSAT 满意度分析 |
| `cross-tabulation` | 交叉分析 |
| `sentiment-analysis` | 开放题情感分析 |
| `survey-health-check` | 问卷质量诊断 |
| `comparative-analysis` | 跨问卷对比分析 |

**问卷生成（7）：**

| Prompt | 用途 |
|--------|------|
| `generate-survey` | 通用问卷生成 |
| `generate-nps-survey` | NPS 问卷生成 |
| `generate-360-evaluation` | 360 度评估问卷生成 |
| `generate-satisfaction-survey` | 满意度调查生成 |
| `generate-engagement-survey` | 员工敬业度调查生成 |
| `generate-exam-from-document` | 从文档生成考试 |
| `generate-exam-from-knowledge` | 从知识点生成考试 |

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
