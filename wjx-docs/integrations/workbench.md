# 工作台与 Claw

Manus、WorkBuddy、QoderWork 及部分 Claw 工具的 MCP 支持和配置界面差异较大。它们只要能执行 shell，就直接使用 CLI。当前工作树的 `0.4.1` 尚未发布到 npm；发布前请按 [CLI 快速开始](../start/cli.md) 从源码构建。`0.4.1` 发布后再安装：

```bash
npm install -g wjx-cli
wjx init --api-key "你的 API Key"
```

只有产品文档明确支持 MCP 且允许配置 stdio server 时，才按 [MCP 快速开始](../start/mcp.md) 接入。下一发布版本 `wjx-mcp-server@0.4.1` 尚未发布；发布前固定使用本机构建入口，不要在工作台配置中隐式漂移到未验证的版本。
