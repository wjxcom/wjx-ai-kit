# Claude Code

Claude Code 能执行 shell，也支持 MCP、Agent 和 Skill。CLI `0.4.1` 已发布到 npm，直接安装：

```bash
npm install -g wjx-cli@latest
wjx skill install --force
wjx init --api-key "你的 API Key"
```

npm 包名是 `wjx-cli`，安装后的命令名是 `wjx`；请用 `wjx --version` 验证，不要运行 `wjx-cli --version`。

然后在对话中让 Claude 调用 `wjx` 命令。只有需要原生工具调用时再配置 MCP，使用本地构建入口：

```bash
claude mcp add wjx \
  --env WJX_API_KEY="你的 API Key" \
  -- node /absolute/path/wjx-mcp-server/dist/index.js
```

Skill/Agent 只提供工作流约束，实际能力仍来自 CLI 或 MCP。命令和工具参数见 [CLI 命令](../reference/cli.md) 与 [MCP 工具](../reference/mcp-tools.md)。
