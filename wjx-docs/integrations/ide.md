# IDE 客户端

Cursor、Windsurf、Cline 等客户端的配置文件路径和字段名会随版本变化。核心配置保持一致：`command` 指向本地构建的 Node 入口，`env.WJX_API_KEY` 提供凭据。

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

优先查阅客户端当前版本的 MCP 配置文档；保存后完全重启。若 IDE 能执行终端命令，CLI 是更稳定的替代入口。
