# 配置 AI 客户端

先决定客户端是“能执行 CLI”还是“原生支持 MCP”。能执行 shell 的客户端统一走 CLI；MCP 只在客户端明确支持协议时启用。

## CLI 配置

当前工作树的 `0.4.1` 尚未发布到 npm；发布前请按 [CLI 快速开始](../start/cli.md) 从源码构建并链接。`0.4.1` 发布后再执行：

```bash
npm install -g wjx-cli
wjx init --api-key "你的 API Key"
wjx doctor
```

## MCP 配置形状

MCP 客户端配置通常包含以下结构。下一发布版本为 `0.4.1`，当前尚未发布到 npm；发布前请使用本机构建后的启动命令，不要配置 `wjx-mcp-server@0.4.1`。

```json
{
  "mcpServers": {
    "wjx": {
      "command": "node",
      "args": ["/absolute/path/wjx-mcp-server/dist/index.js"],
      "env": { "WJX_API_KEY": "你的 API Key" }
    }
  }
}
```

保存后完全重启客户端，然后让 AI 调用 `list_surveys`。客户端特定路径见 [Claude Code](../integrations/claude-code.md)、[Claude Desktop](../integrations/claude-desktop.md) 和 [IDE](../integrations/ide.md)。

## 凭据提醒

API Key 不应出现在截图、Prompt、仓库或 CI 日志中。对话式安装提示可以引导用户获取 Key，但不应要求把 Key 发给第三方服务。
