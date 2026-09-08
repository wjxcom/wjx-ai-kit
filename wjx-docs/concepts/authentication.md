# 认证与安全

## CLI/SDK/MCP stdio

使用 `WJX_API_KEY`，或在 SDK 调用中显式传入凭据。Key 是高敏感凭据：不要提交到 Git、写入示例日志或直接发送给不受信任的 AI 服务。

## MCP HTTP

HTTP transport 有两个独立的凭据边界：

- `MCP_AUTH_TOKEN` 只保护 MCP `/mcp` 入口。客户端发送 `Authorization: Bearer <MCP_AUTH_TOKEN>`，服务端用常量时间比较校验访问权限。
- 问卷星上游 API 使用 `WJX_API_KEY`（或嵌入式调用传入的 `upstreamApiKey`）。单租户模式下它是进程级配置，和 transport gate 可以是不同值。
- 启用 `MCP_TENANT_MODE=1` 后，每个请求必须携带自己的 `X-WJX-API-Key`；它会绑定到该请求及其 MCP session，不能回退到进程级 `WJX_API_KEY`。
- 只有显式设置 `MCP_LEGACY_BEARER_API_KEY=1`，才允许把 Bearer token 兼作问卷星 API Key。未设置时，单租户保留旧版兼容回退；tenant 模式默认关闭该回退。

```bash
MCP_TRANSPORT=http \
MCP_AUTH_TOKEN="独立的 HTTP 访问令牌" \
WJX_API_KEY="你的问卷星 API Key" \
PORT=3000 \
npm start --workspace=wjx-mcp-server
```

多租户示例：

```bash
MCP_TRANSPORT=http \
MCP_TENANT_MODE=1 \
MCP_AUTH_TOKEN="独立的 HTTP 访问令牌" \
PORT=3000 \
npm start --workspace=wjx-mcp-server
```

请求 `/mcp` 时同时发送 `Authorization: Bearer <MCP_AUTH_TOKEN>` 和 `X-WJX-API-Key: <tenant-key>`。`/health` 不要求 Bearer，适合健康探针；生产环境仍应使用 HTTPS、反向代理、网络白名单和密钥管理，避免把任何密钥放入 URL、日志、镜像层或提交内容。
