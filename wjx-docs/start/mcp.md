# MCP 快速开始

MCP 适用于原生支持 Model Context Protocol 的客户端。若客户端只能执行 shell，请使用 [CLI 快速开始](cli.md)。

## 前置条件

- Node.js 20 或更高版本
- 问卷星 OpenAPI API Key
- Claude Desktop、Claude Code、Cursor 等 MCP 客户端

当前稳定版本为 `0.4.2`，已发布到 npm，registry 的 `latest` 指向
`wjx-mcp-server@0.4.2`。直接安装：

```bash
npm install -g wjx-mcp-server
```

需要从源码开发时，再从 monorepo 根目录构建 SDK 和 MCP Server。

本地 stdio 启动命令：

```bash
WJX_API_KEY="你的 API Key" npx wjx-mcp-server
```

客户端配置中的 `command` 应指向 `wjx-mcp-server` 启动入口；不同客户端的示例见 [配置 AI 客户端](../tasks/configure-client.md)。配置后完全重启客户端，并让 AI 调用 `list_surveys` 验证。需要源码开发时，可按仓库 README 构建。

## 能力发现

当前版本提供 63 个 Tool、8 个 Resource、15 个 Prompt。MCP 是 CLI 的核心业务子集入口；初始化、补全、Skill 安装等工作站能力保持 CLI-only。完整名称和差异见 [MCP 工具参考](../reference/mcp-tools.md) 与仓库 capability matrix。

## 凭据安全

不要把 API Key 写入提交到仓库的 JSON。优先使用客户端的环境变量配置或本机密钥管理。HTTP 模式还涉及 Bearer gate，见 [认证与安全](../concepts/authentication.md) 和 [HTTP 部署](../operations/http.md)。
