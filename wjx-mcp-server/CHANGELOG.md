# 更新日志

本文件记录项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.2.6] - 2026-04-24

### Added

- 工具/Prompt 层透传表格类题型与必答题设置（联动 SDK 0.2.6）。

## [0.2.4] - 2026-04-22

### Changed

- **prompt 合并**：`generate-major-survey-json` 并入 `generate-survey-json`（统一覆盖 atype∈{1,2,3,10,11} 调查/测评/投票/量表/民主测评，含 BWS/MaxDiff/联合分析/Kano/PSM 等专业模型）。**BREAKING**：旧名 `generate-major-survey-json` 不再注册。
- **atype 引导扩展**：`generate-survey-json` 与 JSONL_FORMAT_INSTRUCTIONS 新增 atype=10（量表）/atype=11（民主测评/360 评估）选择规则。
- prompt 总数：23 → 22。

### Fixed

- **`FORM_QTYPES` 白名单修正**：剔除错误混入的调查专业模型（BWS/MaxDiff/联合分析/Kano/SUS/品牌漏斗/BPTO/PSM/价格断裂点/层次分析/选项分类/CATI 等），改用服务端官方"7"白名单 42 项（新增签名题/地图/手机验证/折叠栏目/轮播图/表格数值/自增表格/图片OCR/商品题/预约题/密码 等真正的表单题型）。
- **测试**：新增 `__tests__/prompts-survey-generation-json.test.mjs`（6 用例），覆盖 prompt 合并 + form 白名单 + atype 提示。

### Verified

- 服务端 atype 修复（`wa.QType = model.AType`）已端到端真实回归：vid 201104-201117，atype=1/2/3/6/7/11 共 6 个用例全部正确落库（环境：tanhao.sojump.cn）。
- master commit `8076f41` 中"服务端实测仍忽略 atype，根因待定位"叙述已过时；SDK `injectAtypeIntoJsonl` 现作为防御性兜底保留。

## [0.1.4] - 2026-04-02

### Changed

- 去除重复的 `parsedQuestionsToWire`，改为从 wjx-api-sdk 导入
- 升级 zod 依赖至 v4
- **移除 `get_file_links` 工具**: 该工具已从 C# 服务端移除
- **移除 `username` 参数**: user-system 6 个工具的输入 schema 不再包含 `username`
- **工具总数**: 56 → 57（新增 build_preview_url、create_survey_by_text，移除 get_file_links）

### Fixed

- `create_survey_by_text` 工具使用 SDK 的 `createSurveyByText()` 客户端解析
- **评分量表 `item_score=0` 被覆写**: create_survey 不再将合法的 0 分自动替换为 item_index
- **prompt 模板更新**: survey-generation prompts 与 API 参数变更对齐

## [0.1.3] - 2026-04-01

### Added

- `create_survey_by_text` 工具：通过 DSL 文本创建问卷
- `build_preview_url` SSO 工具：生成问卷预览 URL
- 7 个问卷生成 Prompts（generate-survey、generate-nps-survey 等）
- 2 个运维 Prompts（anomaly-detection、user-system-workflow）

## [0.1.2] - 2026-03-31

### Changed

- **环境变量重命名**: `WJX_TOKEN` → `WJX_API_KEY`
- **凭据类型**: `{ token }` → `{ apiKey }` 与 SDK 保持一致
- 新增 `WJX_CORP_ID` 环境变量文档

## [0.1.1] - 2026-03-30

### Fixed

- `create_survey` 的 `atype` 描述明确限制仅支持 1/2/3/6/7 类型创建（与后端 C# 代码一致）
- `create_survey` 的 `questions` 描述重构，区分主题型和子类型（q_subtype），添加 JSON 示例
- `create_survey_by_text` 描述更新为支持 12 种题型标签
- TYPE_MAP 扩展 6 种新题型映射：dropdown(301)、scoring-single(303)、scoring-multi(401)、sort(402)、true-false(305)、weight(9)
- `update_survey_settings` 的 5 个 JSON 设置参数添加格式示例
- `add_admin` 描述强调 `role` 为必填字段
- `modify_department` 的 `depts` 描述添加 `order` 字段约束说明
- `query_sub_accounts` 移除不存在的分页参数
- `query_survey_binding` 和 `query_user_surveys` 移除不存在的分页参数
- `modify_participants` 新增 `auto_create_udept` 参数
- `get_report` 的 `jid` 参数添加最多 50 个的校验
- `SURVEY_STATUSES` 枚举修正（去掉括号备注，与 API 实际返回一致）

## [0.1.0] - 2026-03-30

### Added

- **wjx-ai-kit monorepo**: unified platform with npm workspaces (`wjx-api-sdk`, `wjx-mcp-server`, `wjx-cli`)
- **wjx-api-sdk**: zero-MCP-dependency SDK extracted from wjx-mcp-server
  - 50+ API functions across 7 modules (survey, response, contacts, user-system, multi-user, SSO, analytics)
  - `setCredentialProvider()` hook for pluggable multi-tenant credential injection
  - Optional `Logger` callback replacing hardcoded `console.error`
  - Lazy URL getter functions for delayed environment variable evaluation
  - `textToSurvey()` / `surveyToText()`: DSL round-trip parser for 6 question types
  - `ParsedSurvey` / `ParsedQuestion` typed interfaces for structured survey representation
  - `buildPreviewUrl()`: generate survey preview URLs from vid
  - 598 unit tests
- **7 大模块 · 57 个 Tools**:
  - Survey (12): 问卷 CRUD、状态管理、设置读写、标签、回收站、文件上传、文本创建、预览
  - Response (10): 答卷查询、实时查询、下载、统计报告、代填提交、文件链接、中奖者、改分、360 报告、清空
  - Contacts (14): 通讯录成员、管理员、部门、标签管理
  - SSO (4): 子账号/用户体系/合作伙伴/问卷创建编辑的 SSO 链接
  - User System (5): 参与者管理、问卷绑定查询、用户关联问卷查询
  - Multi-User (5): 子账号创建、修改、删除、恢复、查询
  - Analytics (6): 答卷解码、NPS、CSAT、异常检测、指标对比、推送解密
- **8 个 MCP Resources**: survey-types, question-types, survey-statuses, analysis-methods, response-format, user-roles, push-format, dsl-syntax
- **12 个 MCP Prompts**: design-survey, analyze-results, create-nps-survey, configure-webhook, nps-analysis, csat-analysis, cross-tabulation, sentiment-analysis, survey-health-check, comparative-analysis, create-survey-by-text, batch-export
- **`create_survey_by_text` tool**: create surveys from natural language DSL text
- **DSL syntax reference resource** (`wjx://reference/dsl-syntax`)
- **HTTP transport**: Streamable HTTP mode via `--http` flag with Bearer token auth
- **Dockerfile**: multi-stage Docker build for monorepo deployment with health check
- **CI/CD**: GitHub Actions workflows for CI and npm publish
- **Documentation**: README, CONTRIBUTING.md, architecture guide, API reference
- Core API client with request signing, retry with exponential backoff, trace ID
- Zod v4 input validation for all tools
- 222 MCP server tests + 598 SDK tests
