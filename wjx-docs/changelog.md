# 变更记录

## 0.4.3（2026-09-07）

- 三个工作区包统一升级至 `0.4.3`，按 SDK → MCP Server → CLI 顺序发布到 npm。
- MCP Agent contract 将 `query_responses_realtime` 标记为高风险队列消费操作（`destructiveHint=true`、`idempotentHint=false`），调用前需要宿主确认；这是 Agent 合同层的安全提升，不修改 CLI metadata、CLI 退出码或现有命令行为。
- CLI 高风险命令继续使用 `CONFIRMATION_REQUIRED` 退出码 **3**；非交互脚本用 `--yes` 保持兼容，`--dry-run` 仍不发请求。
- SDK、CLI 和 MCP 增加问卷填写长链接转短信短链接能力，并补充问卷、题型、状态、审核和设置枚举资源。
- 完成真实问卷设置、回收站、答卷清空及 MCP/CLI 读回验证；未覆盖的企业联系人类和子账号流程受当前账号凭据/配额限制，答卷提交仍受问卷星版本保护约束。

## 0.4.2（2026-09-02）

- `wjx-api-sdk`、`wjx-mcp-server`、`wjx-cli` 统一升级至 `0.4.2`，继续按 SDK → MCP Server → CLI 顺序发布。
- 修复 MCP 运行时传递依赖中的已知安全漏洞，并在 CI 中加入 `npm audit` 门禁与每周 Dependabot 扫描。

## 0.4.1（2026-09-02）

- `wjx-api-sdk`、`wjx-mcp-server`、`wjx-cli` 的稳定版本统一为 `0.4.1`，发布顺序为 SDK → MCP Server → CLI。
- 三个包已按 SDK → MCP Server → CLI 顺序发布到 npm，registry 的 `latest` 均指向 `0.4.1`。
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
