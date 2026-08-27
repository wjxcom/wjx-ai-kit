# wjx-mcp-server

问卷星 MCP Server，供 Claude Desktop、Claude Code、Cursor 等原生 MCP 客户端直接调用。CLI 是默认入口；MCP 只在客户端明确支持协议时使用。

## 发布状态

当前 MCP Server 通过 GitHub 源码安装和运行：

```bash
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-mcp-server
```

## stdio 配置

使用构建后的入口，并通过环境变量传入 API Key：

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

保存后完全重启客户端，再调用 `list_surveys` 验证。Tool、Resource、Prompt 的数量和模块见 [MCP 工具参考](../wjx-docs/reference/mcp-tools.md)。

## HTTP

```bash
MCP_TRANSPORT=http MCP_AUTH_TOKEN="你的问卷星 API Key" PORT=3000 npm start --workspace=wjx-mcp-server
```

`MCP_AUTH_TOKEN` 是单租户 Bearer gate；Bearer 值同时作为问卷星 API Key 使用，并非独立的第二个租户令牌。HTTP 详情见 [HTTP 部署](../wjx-docs/operations/http.md) 和 [认证与安全](../wjx-docs/concepts/authentication.md)。生产环境应使用 HTTPS、反向代理和网络白名单。

## 开发

```bash
npm install
npm run build --workspace=wjx-mcp-server
npm test --workspace=wjx-mcp-server
```

许可证：[MIT](../LICENSE)
