# 工作台与 Claw

Manus、WorkBuddy、QoderWork 及部分 Claw 工具的 MCP 支持和配置界面差异较大。它们只要能执行 shell，就直接安装 CLI：

```bash
npm install -g wjx-cli
wjx init --api-key "你的 API Key"
```

只有产品文档明确支持 MCP 且允许配置本地 stdio server 时，才按 [MCP 快速开始](../start/mcp.md) 接入。不要把旧版“自动下载 `@latest`”提示复制到工作台；MCP npm 发布已冻结。
