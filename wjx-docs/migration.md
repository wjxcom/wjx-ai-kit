# 迁移指南

## 从旧文档迁移

请按新的信息架构使用 `start/`、`tasks/`、`reference/`、`concepts/`、`integrations/` 和 `operations/` 下的页面；旧链接请替换为对应的新路径。

## 从 MCP npm 安装迁移

停止使用 `npx -y wjx-mcp-server@latest` 和 `npm install -g wjx-mcp-server`。从 GitHub 克隆、构建 `wjx-api-sdk` 与 `wjx-mcp-server`，然后在客户端配置 `node /absolute/path/wjx-mcp-server/dist/index.js`。

## 从旧 CLI 参数迁移

### CLI 1.0 输出协议

成功结果读取 `ok/data/meta`，失败结果读取 `ok/error`。不再读取顶层 `result`；`data` 内业务字段保持原语义。机器调用使用 `--format json`，分页或流式消费可使用 `ndjson`/`csv`。`--json`、`--table` 仍可运行但只在帮助中标记 deprecated，不会向 stderr 输出警告。

高风险删除、清空和修改命令在非交互环境必须追加 `--yes`；`--dry-run` 始终优先且不会发出 HTTP 请求。

| 旧写法 | 当前写法 |
| --- | --- |
| `--permanent` | `--completely` |
| `--filename` | `--file_name` |
| `--format` | `--suffix` |
| `--response_id` | `--jid` |
| `--base64`（上传） | `--file` |

## 从 DSL 迁移

参阅 [DSL 兼容](legacy/dsl.md)，将文本转成 JSONL 后使用 `create-by-json`。
