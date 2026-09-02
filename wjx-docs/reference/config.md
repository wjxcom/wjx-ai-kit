# 配置项参考

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `WJX_API_KEY` | 无 | 问卷星 OpenAPI 凭据 |
| `WJX_CREDENTIAL_<REF>` | 无 | 命名 profile 的凭据；`<REF>` 对应 `profiles.json` 中的 `credentialRef` |
| `WJX_PROFILES_PATH` | `~/.wjx/profiles.json` | CLI 命名 profile 配置文件路径 |
| `WJX_CORP_ID` | 无 | 企业通讯录相关操作 |
| `WJX_BASE_URL` | `https://www.wjx.cn` | 私有化部署基础地址 |
| `MCP_TRANSPORT` | `stdio` | MCP 传输模式；也可用 `--http` |
| `PORT` | `3000` | HTTP 模式端口 |
| `MCP_AUTH_TOKEN` | 无 | HTTP 单租户 Bearer gate |
| `MCP_SESSION` | stateful | 设置为 `stateless` 禁用会话 |

CLI 还支持 `wjx init` 写入用户级配置。环境变量优先于配置文件；选择命名 profile 时，profile 的 `baseUrl`/`corpId` 优先于旧版 `.wjxrc` 的默认路由字段。配置了 `credentialRef` 的 profile 必须提供对应的 `WJX_CREDENTIAL_<REF>`，缺失时不会回退到全局 `WJX_API_KEY`，以免误用其他租户凭据；命令行 `--api-key` 仍可显式覆盖。CLI 将选中的地址作为每次请求的显式路由，不会为切换 profile 临时修改全局环境。
