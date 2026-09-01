# wjx-ai-kit 文档

wjx-ai-kit 把问卷星 OpenAPI 暴露为 CLI、TypeScript SDK 和 MCP Server。文档按用户目标组织：先选择入口，再按任务完成工作，最后查阅协议与运维参考。

## 先选择入口

| 你的场景 | 推荐入口 | 原因 |
| --- | --- | --- |
| 终端、脚本、CI，或不确定 AI 是否支持 MCP | [CLI 快速开始](start/cli.md) | 默认入口，任何能执行 shell 的客户端都能用 |
| Claude Desktop、Claude Code、Cursor 等原生 MCP 客户端 | [MCP 快速开始](start/mcp.md) | 直接调用工具；MCP 包当前从 GitHub 源码安装 |
| 在 Node.js/TypeScript 应用中集成 | [SDK 快速开始](start/sdk.md) | 类型安全的程序化调用 |
| 让 Claude Code 自动遵循问卷业务流程 | [Claude Code 集成](integrations/claude-code.md) | CLI/MCP 之上的 Agent 与 Skill 工作流 |

CLI 是默认建议。MCP 和 SDK 是针对特定运行环境的入口，不是三套不同能力。

## 常见目标

- [创建问卷](tasks/create-survey.md)
- [分析答卷](tasks/analyze-responses.md)
- [导出答卷](tasks/export-responses.md)
- [配置 AI 客户端](tasks/configure-client.md)

## 开发计划

AI 主页接口集成计划见 [AI page API integration](tasks/ai-page-api-integration.md)。

## 能力边界

当前版本提供 MCP **63 个 Tool**、**9 个 Resource**、**22 个 Prompt**，以及 CLI **81 个叶子命令**；SDK 的公开导出以 [SDK API 参考](reference/sdk.md) 为准。

问卷创建以 JSONL/JSON 为规范路径。旧 DSL 仅为兼容保留，见 [DSL 兼容](legacy/dsl.md)。

## 相关链接

- [GitHub 仓库](https://github.com/wjxcom/wjx-ai-kit)
- [问卷星 API Key 获取页](https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1)
- [变更记录](changelog.md) · [迁移指南](migration.md)
