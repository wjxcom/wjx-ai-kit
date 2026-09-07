# 故障排查

## `wjx doctor` 失败

确认 Node.js 版本、`WJX_API_KEY` 是否过期、`WJX_BASE_URL` 是否包含协议，并重新运行 `wjx init`。私有化部署先用浏览器确认域名可达。

## MCP 没有工具

检查客户端配置 JSON、构建路径和 stderr 日志；完全重启客户端。MCP 客户端应先完成 initialize，再调用 `list_surveys`。

## HTTP 返回 401

先区分两类凭据：

- `Authorization: Bearer` 必须与 `MCP_AUTH_TOKEN` 完全一致（如果服务端配置了 gate）。
- 单租户还要确认服务端配置了正确的 `WJX_API_KEY`；它不必与 `MCP_AUTH_TOKEN` 相同。
- `MCP_TENANT_MODE=1` 时，当前请求必须带 `X-WJX-API-Key`。服务端不会使用另一个租户的进程级 key；检查代理是否转发了该请求头，并为每个新 session 重新建立凭据上下文。
- 只有设置 `MCP_LEGACY_BEARER_API_KEY=1` 才能让 Bearer 兼作上游 API Key。修改环境变量后重启 MCP Server。

`GET /health` 不需要 Bearer；它返回 200 只能说明 HTTP 进程存活，不能证明上游 API 凭据有效。

## 参数报错

运行 `wjx <command> --help`；CLI 当前使用 `--completely`、`--file_name`、`--file`、`--suffix`、`--jid` 等参数。旧文档中的同义参数已移除。
