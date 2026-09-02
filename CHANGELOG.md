# Changelog

本项目使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

各包的详细变更记录请参阅：

- [wjx-api-sdk CHANGELOG](wjx-api-sdk/CHANGELOG.md)
- [wjx-mcp-server CHANGELOG](wjx-mcp-server/CHANGELOG.md)
- [wjx-cli CHANGELOG](wjx-cli/CHANGELOG.md)

---

## [0.4.1] - 2026-09-02

### 已发布

- 三个工作区包统一使用 `0.4.1`，已按 SDK → MCP Server → CLI 顺序发布到 npm，registry 的 `latest` 均指向 `0.4.1`。
- 延续 `0.4.0` 的 JSONL-only 创建接口清理和统一输出协议。
- 明确 SDK 基础层、CLI 主入口与 MCP 核心业务子集的边界；新增能力矩阵和文档/消费者一致性门禁。
- CLI 增加 `survey preview-url`；MCP 核心业务子集包含 `count_responses`、`build_submit_template` 和 `decode_push_payload`。

---

## [0.4.0] - 2026-08-30

### 统一发布

- `wjx-api-sdk@0.4.0`、`wjx-mcp-server@0.4.0`、`wjx-cli@0.4.0` 曾按 SDK → MCP Server → CLI 顺序发布；该版本现已废弃。
- 问卷创建统一使用 action `1000106` 的 JSONL 链路；旧 JSON 数组和 DSL 创建入口已移除。
- CLI、SDK、MCP Server 的题型、协议和下游 Skill/Agent 文档已同步。

---

## [0.1.0] - 2026-04-06

### 首次开源发布

- **wjx-api-sdk@0.1.6** — 零依赖 TypeScript SDK（50+ 函数、70+ 类型）
- **wjx-mcp-server@0.1.5** — MCP Server（57 tools / 8 resources / 19 prompts）
- **wjx-cli@0.1.13** — CLI 命令行工具（69 子命令）
- 2 个 Agent 定义（wjx-mcp-expert、wjx-cli-expert）
- 2 套 Skill（wjx-mcp-use、wjx-cli-use）
- 7 篇使用文档 + 9 篇 AI 工具配置指南
- 完整开源基础设施（MIT 许可证、贡献指南、行为准则、安全策略）
