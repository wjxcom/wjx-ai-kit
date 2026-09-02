# 兼容性与弃用

- Node.js：要求 20+。
- CLI：以 `wjx --version` 和 `--help` 为准；文档不承诺未在源码出现的旧参数。
- MCP Server：`0.4.1` 已发布到 npm；需要源码开发时才从 GitHub 安装和运行。
- 问卷创建的当前入口统一为：CLI `survey create`、SDK `createSurveyByJson`、MCP `create_survey_by_json`，三者都使用 action `1000106` 的 JSONL 链路。
- DSL：`surveyToText`、CLI `survey export-text` 和 `get_survey` 的 DSL 输出继续用于读取、审阅和离线迁移旧问卷。当前 CLI、SDK 和 MCP 均不注册 `create-by-text`、`createSurveyByText`、`create_survey_by_text` 或原始 `create_survey`。

兼容能力仅限读取旧数据；转换完成后统一使用 JSONL 创建。SDK 返回问卷星 OpenAPI 原始响应（业务失败通常是 `result: false`），CLI 则将结果投影为 `ok/data/meta` envelope；二者不是同一输出协议。重大变化记录在 [变更记录](../changelog.md)，迁移动作见 [迁移指南](../migration.md)。

## 创建接口的版本门禁

CLI `survey create` 使用 action `1000106`，并发送 `X-WJX-Client` 与 `X-WJX-Client-Version`。当服务端要求最低客户端版本时，返回 `result: false`、`errorcode: "CLIENT_VERSION_TOO_OLD"`（或 `"UPGRADE_REQUIRED"`），并可在 `data.min_client_version`、`data.upgrade_command` 中提供升级信息。CLI 将其转换为结构化 `UPGRADE_REQUIRED` 提示。

低于 `0.4.1` 的旧 CLI 不认识当前命令，也不会发送版本头。服务端应把旧创建 action、当前创建请求缺少版本头，或明确低于最低版本的请求统一返回上述升级错误；建议使用 HTTP 200 的 OpenAPI 业务失败格式，避免客户端把提示降级为不可解析的传输错误。
