# 兼容性与弃用

- Node.js：要求 20+。
- CLI：以 `wjx --version` 和 `--help` 为准；文档不承诺未在源码出现的旧参数。
- MCP Server：当前源码版本为 `0.4.5`；发布前从 GitHub 构建和运行。
- 问卷创建入口统一为 CLI `survey create`、SDK `createSurveyByJson`、MCP `create_survey_by_json`（action `1000106`）；修改使用 `survey update`、`updateSurveyByJson`、`update_survey_by_json`（action `1000109`）。创建和修改均使用 JSONL，可选 `dsl.logic` 用于题目关联逻辑。

旧文本 DSL 仅用于历史读取和离线审阅；迁移时将题目整理为 JSONL，并按需附加 `dsl.logic`，再通过普通问卷查询核对实际保存结果。SDK 返回问卷星 OpenAPI 原始响应（业务失败通常是 `result: false`），CLI 则将结果投影为 `ok/data/meta` envelope；二者不是同一输出协议。重大变化记录在 [变更记录](../changelog.md)，迁移动作见 [迁移指南](../migration.md)。

## 创建接口的版本门禁

CLI `survey create` 使用 action `1000106`，并发送 `X-WJX-Client` 与 `X-WJX-Client-Version`。当服务端要求最低客户端版本时，返回 `result: false`、`errorcode: "CLIENT_VERSION_TOO_OLD"`（或 `"UPGRADE_REQUIRED"`），并可在 `data.min_client_version`、`data.upgrade_command` 中提供升级信息。CLI 将其转换为结构化 `UPGRADE_REQUIRED` 提示。

低于 `0.4.1` 的旧 CLI 不认识当前命令，也不会发送版本头。服务端应把旧创建 action、当前创建请求缺少版本头，或明确低于最低版本的请求统一返回上述升级错误；建议使用 HTTP 200 的 OpenAPI 业务失败格式，避免客户端把提示降级为不可解析的传输错误。
