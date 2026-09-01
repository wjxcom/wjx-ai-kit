# MCP 快速开始

MCP 适用于原生支持 Model Context Protocol 的客户端。若客户端只能执行 shell，请使用 [CLI 快速开始](cli.md)。

## 前置条件

- Node.js 20 或更高版本
- 问卷星 OpenAPI API Key
- Claude Desktop、Claude Code、Cursor 等 MCP 客户端

当前 MCP Server 通过 GitHub 源码安装和运行：

```bash
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-mcp-server
```

本地 stdio 启动命令：

```bash
WJX_API_KEY="你的 API Key" npm start --workspace=wjx-mcp-server
```

客户端配置中的 `command` 应指向构建后的 `wjx-mcp-server` 启动入口；不同客户端的示例见 [配置 AI 客户端](../tasks/configure-client.md)。配置后完全重启客户端，并让 AI 调用 `list_surveys` 验证。

## 能力发现

当前版本提供 63 个 Tool、9 个 Resource、22 个 Prompt。完整名称和模块见 [MCP 工具参考](../reference/mcp-tools.md)。

## 凭据安全

不要把 API Key 写入提交到仓库的 JSON。优先使用客户端的环境变量配置或本机密钥管理。HTTP 模式还涉及 Bearer gate，见 [认证与安全](../concepts/authentication.md) 和 [HTTP 部署](../operations/http.md)。
