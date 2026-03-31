# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- **7 大模块 · 56 个 Tools**:
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
