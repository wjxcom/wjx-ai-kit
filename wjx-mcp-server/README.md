# wjx-mcp-server

问卷星 MCP Server，供 Claude Desktop、Claude Code、Cursor 等原生 MCP 客户端直接调用。CLI 是默认入口；MCP 处于 secondary / maintenance-mode，只覆盖核心业务子集，工作站能力保持 CLI-only。

## 安装与发布

当前稳定版本为 `0.4.2`，已发布到 npm，registry 的 `latest` 指向
`wjx-mcp-server@0.4.2`。直接安装并运行：

```bash
npm install -g wjx-mcp-server
WJX_API_KEY="你的 API Key" wjx-mcp-server
```

需要从源码开发时，再从 GitHub 克隆并构建 `wjx-api-sdk` 与 `wjx-mcp-server`。

```bash
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-mcp-server
```

## stdio 配置

全局安装后，客户端可以直接使用命令入口，并通过环境变量传入 API Key：

```json
{
  "mcpServers": {
    "wjx": {
      "command": "wjx-mcp-server",
      "args": [],
      "env": { "WJX_API_KEY": "你的 API Key" }
    }
  }
}
```

如果使用源码构建，将 `command` 改为 `node`，`args` 改为构建产物的绝对路径：
`["/absolute/path/wjx-mcp-server/dist/index.js"]`。

保存后完全重启客户端，再调用 `list_surveys` 验证。当前 Server 提供 59 个 Tool、8 个 Resource 和 15 个 Prompt；它不承诺与 CLI 完全同面，具体差异和 CLI-only 能力见 [MCP 工具参考](../wjx-docs/reference/mcp-tools.md) 与仓库 `capabilities/capability-matrix.json`。

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
