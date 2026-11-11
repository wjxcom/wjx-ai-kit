# HTTP 部署

HTTP 仅在需要远程或团队共享时使用；本机客户端优先 stdio。

```bash
MCP_TRANSPORT=http \
MCP_AUTH_TOKEN="独立的 HTTP 访问令牌" \
WJX_API_KEY="你的问卷星 API Key" \
PORT=3000 \
npm start --workspace=wjx-mcp-server
```

- MCP endpoint：`POST /mcp`
- 健康检查：`GET /health`
- 默认启用 session；设置 `MCP_SESSION=stateless` 可关闭
- `Authorization: Bearer <MCP_AUTH_TOKEN>` 是访问 gate（配置了 `MCP_AUTH_TOKEN` 时必需）
- 单租户上游凭据：`WJX_API_KEY`；它可以和 `MCP_AUTH_TOKEN` 使用不同的值
- 多租户：设置 `MCP_TENANT_MODE=1`，每个 `/mcp` 请求都要携带 `X-WJX-API-Key`；请求凭据会绑定到 session，不能回退到进程级 `WJX_API_KEY`
- 兼容旧部署：设置 `MCP_LEGACY_BEARER_API_KEY=1` 才允许 Bearer token 兼作上游 API Key；tenant 模式默认关闭此行为
- 请求体默认上限为 10 MiB；超过上限返回 413

生产部署应使用 HTTPS、反向代理和网络白名单。不要把访问令牌或 API Key 放进 URL、Dockerfile、镜像层或普通日志。关闭/回收 session 时使用服务端提供的生命周期接口，避免共享 session 泄露租户上下文。
