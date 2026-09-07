# 工作台与 Claw

Manus、WorkBuddy、QoderWork 及部分 Claw 工具的 MCP 支持和配置界面差异较大。它们只要能执行 shell，就直接使用 CLI。CLI `0.4.3` 已发布到 npm，直接安装：

```bash
npm install -g wjx-cli@latest
wjx skill install --force
wjx init --api-key "你的 API Key"
```

npm 包名是 `wjx-cli`，安装后的命令名是 `wjx`；请用 `wjx --version` 验证，不要运行 `wjx-cli --version`。

只有产品文档明确支持 MCP 且允许配置 stdio server 时，才按 [MCP 快速开始](../start/mcp.md) 接入。`wjx-mcp-server@0.4.3` 已发布；也可以固定使用本机构建入口。
