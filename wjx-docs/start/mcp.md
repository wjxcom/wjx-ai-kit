# MCP 快速开始

MCP 适用于原生支持 Model Context Protocol 的客户端。若客户端只能执行 shell，请使用 [CLI 快速开始](cli.md)。

## 前置条件

- Node.js 20 或更高版本
- 问卷星 OpenAPI API Key
- Claude Desktop、Claude Code、Cursor 等 MCP 客户端

当前工作树对应下一发布版本 `0.4.1`，尚未发布到 npm。npm registry 的
`latest` 仍是 `wjx-mcp-server@0.3.1`；发布前请从源码构建本版本，不要
把 `@0.4.1` 作为可安装版本。

```bash
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-mcp-server
```

本地 stdio 启动命令：

```bash
WJX_API_KEY="你的 API Key" npx wjx-mcp-server
```

客户端配置中的 `command` 应指向 `wjx-mcp-server` 启动入口；不同客户端的示例见 [配置 AI 客户端](../tasks/configure-client.md)。配置后完全重启客户端，并让 AI 调用 `list_surveys` 验证。需要源码开发时，可按仓库 README 构建。

## 能力发现

当前版本提供 59 个 Tool、8 个 Resource、15 个 Prompt。MCP 是 CLI 的核心业务子集入口；初始化、补全、Skill 安装等工作站能力保持 CLI-only。完整名称和差异见 [MCP 工具参考](../reference/mcp-tools.md) 与仓库 capability matrix。

## 凭据安全

不要把 API Key 写入提交到仓库的 JSON。优先使用客户端的环境变量配置或本机密钥管理。HTTP 模式还涉及 Bearer gate，见 [认证与安全](../concepts/authentication.md) 和 [HTTP 部署](../operations/http.md)。
