# MCP 快速开始

MCP 适用于原生支持 Model Context Protocol 的客户端。若客户端只能执行 shell，请使用 [CLI 快速开始](cli.md)。

## 前置条件

- Node.js 20 或更高版本（仅本地 stdio 模式）
- 问卷星 OpenAPI API Key（仅本地 stdio 模式）
- Claude Desktop、Claude Code、Cursor 等 MCP 客户端
- 已部署 HTTP 服务分配的访问令牌（HTTP 模式）

当前源码版本为 `0.4.4`。发布到 npm 后，registry 的 `latest` 将指向
`wjx-mcp-server@0.4.4`。直接安装：

```bash
npm install -g wjx-mcp-server
```

需要从源码开发时，再从 monorepo 根目录构建 SDK 和 MCP Server。

本地 stdio 启动命令：

```bash
WJX_API_KEY="你的 API Key" npx wjx-mcp-server
```

客户端配置中的 `command` 应指向 `wjx-mcp-server` 启动入口；不同客户端的示例见 [配置 AI 客户端](../tasks/configure-client.md)。配置后完全重启客户端，并让 AI 调用 `list_surveys` 验证。需要源码开发时，可按仓库 README 构建。

## HTTP 服务配置

如果使用已部署的 MCP HTTP 服务，无需在本机安装 `wjx-mcp-server` 或配置本地
`WJX_API_KEY`。在 MCP 客户端配置中添加：

```json
{
  "mcpServers": {
    "wjx": {
      "type": "http",
      "url": "https://alifc.wjx.cn/mcp/latest",
      "headers": {
        "Authorization": "Bearer sk-wjx-xxx"
      }
    }
  }
}
```

将 `sk-wjx-xxx` 替换为服务端分配的 HTTP 访问令牌。保存后完全重启客户端。

## 能力发现

当前版本提供 66 个 Tool、13 个 Resource、15 个 Prompt。MCP 是 CLI 的核心业务子集入口；初始化、补全、Skill 安装等工作站能力保持 CLI-only。完整名称和差异见 [MCP 工具参考](../reference/mcp-tools.md) 与仓库 capability matrix。

## 凭据安全

不要把 API Key 写入提交到仓库的 JSON。优先使用客户端的环境变量配置或本机密钥管理。HTTP 模式还涉及 Bearer gate，见 [认证与安全](../concepts/authentication.md) 和 [HTTP 部署](../operations/http.md)。
