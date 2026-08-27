# Claude Code

Claude Code 能执行 shell，也支持 MCP、Agent 和 Skill。建议先安装 CLI：

```bash
npm install -g wjx-cli
wjx init --api-key "你的 API Key"
```

然后在对话中让 Claude 调用 `wjx` 命令。只有需要原生工具调用时再配置 MCP，使用本地构建入口：

```bash
claude mcp add wjx \
  --env WJX_API_KEY="你的 API Key" \
  -- node /absolute/path/wjx-mcp-server/dist/index.js
```

Skill/Agent 只提供工作流约束，实际能力仍来自 CLI 或 MCP。命令和工具参数见 [CLI 命令](../reference/cli.md) 与 [MCP 工具](../reference/mcp-tools.md)。
