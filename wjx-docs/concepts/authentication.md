# 认证与安全

## CLI/SDK/MCP stdio

使用 `WJX_API_KEY`，或在 SDK 调用中显式传入凭据。Key 是高敏感凭据：不要提交到 Git、写入示例日志或直接发送给不受信任的 AI 服务。

## MCP HTTP

`MCP_AUTH_TOKEN` 是单租户访问 gate。实现会校验请求的 `Authorization: Bearer <token>`；同一个 Bearer token 也会作为该请求的问卷星 `apiKey` 放入凭据上下文。因此它不是与 `WJX_API_KEY` 独立的第二个租户凭据。

```bash
MCP_TRANSPORT=http \
MCP_AUTH_TOKEN="你的问卷星 API Key" \
PORT=3000 \
npm start --workspace=wjx-mcp-server
```

反向代理、TLS、访问控制和密钥轮换由部署方负责。`/health` 在实现中不要求 Bearer，适合健康探针，但不要把 `/mcp` 暴露到公网而不加网关控制。
