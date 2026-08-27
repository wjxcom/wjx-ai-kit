# 配置项参考

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `WJX_API_KEY` | 无 | 问卷星 OpenAPI 凭据 |
| `WJX_CORP_ID` | 无 | 企业通讯录相关操作 |
| `WJX_BASE_URL` | `https://www.wjx.cn` | 私有化部署基础地址 |
| `MCP_TRANSPORT` | `stdio` | MCP 传输模式；也可用 `--http` |
| `PORT` | `3000` | HTTP 模式端口 |
| `MCP_AUTH_TOKEN` | 无 | HTTP 单租户 Bearer gate |
| `MCP_SESSION` | stateful | 设置为 `stateless` 禁用会话 |

CLI 还支持 `wjx init` 写入用户级配置。环境变量优先于配置文件。
