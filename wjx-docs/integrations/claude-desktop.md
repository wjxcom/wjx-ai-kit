# Claude Desktop

先按 [MCP 快速开始](../start/mcp.md) 从源码构建 server，再把下面结构合并到 Claude Desktop 配置文件：

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

Windows 配置通常位于 `%APPDATA%\\Claude\\claude_desktop_config.json`，macOS 位于 `~/Library/Application Support/Claude/claude_desktop_config.json`。保存后完全退出并重启 Claude Desktop，看到工具后调用 `list_surveys`。
