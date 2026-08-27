# HTTP 部署

HTTP 仅在需要远程或团队共享时使用；本机客户端优先 stdio。

```bash
MCP_TRANSPORT=http \
MCP_AUTH_TOKEN="你的问卷星 API Key" \
PORT=3000 \
npm start --workspace=wjx-mcp-server
```

- MCP endpoint：`POST /mcp`
- 健康检查：`GET /health`
- 默认启用 session；设置 `MCP_SESSION=stateless` 可关闭
- `Authorization: Bearer <MCP_AUTH_TOKEN>` 是必需的访问 gate（如果配置了 token）

生产部署应使用 HTTPS、反向代理和网络白名单。不要把 API Key 放进 URL、Dockerfile 或镜像层。
