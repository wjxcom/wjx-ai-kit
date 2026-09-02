# 变更记录

## 0.4.1（下一发布，尚未发布）

- `wjx-api-sdk`、`wjx-mcp-server`、`wjx-cli` 的工作树版本统一为 `0.4.1`，正式发布顺序为 SDK → MCP Server → CLI。
- 本版本不改变 npm registry；发布前请从源码构建，registry 的 `latest` 仍指向旧版。
- SDK 暴露本地 `buildSubmitTemplate` / `decodePushPayload`；CLI 提供 `survey preview-url`；MCP 补充答卷计数、模板和推送解密工具。
- 明确 CLI 是完整主入口，MCP 只覆盖核心业务子集；具体差异由 capability matrix 定义。

## 0.4.0（已废弃）

- `wjx-api-sdk`、`wjx-mcp-server`、`wjx-cli` 曾统一发布 `0.4.0`，现已废弃，不能作为当前安装目标。
- 问卷创建统一使用 `createSurveyByJson` / `create_survey_by_json` / `survey create` 的 action `1000106` JSONL 链路。
- 旧 JSON 数组和 DSL 创建入口已移除；读取和迁移旧 DSL 的能力仍保留。

## 文档更新

- 首页按用户目标分流，提供 CLI、MCP 和 SDK 的清晰入口。
- 问卷创建唯一使用 action `1000106` 的 JSONL 链路；旧 JSON 数组和 DSL 创建入口已移除，DSL 仅用于读取、审阅和离线迁移。
- 补充题型、MCP 工具、认证、HTTP 部署和迁移说明。
- 标明已过时的用户体系能力和历史 `0.4.0` npm 发布方式。
- 明确问卷创建入口统一为 CLI `survey create`、SDK `createSurveyByJson` 和 MCP `create_survey_by_json`；保留 `surveyToText` / DSL 读取与历史迁移说明，旧创建入口不再作为新项目工作流。
