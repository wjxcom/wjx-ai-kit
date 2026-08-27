# 迁移指南

## 从旧文档迁移

请按新的信息架构使用 `start/`、`tasks/`、`reference/`、`concepts/`、`integrations/` 和 `operations/` 下的页面；旧链接请替换为对应的新路径。

## 从 MCP npm 安装迁移

停止使用 `npx -y wjx-mcp-server@latest` 和 `npm install -g wjx-mcp-server`。从 GitHub 克隆、构建 `wjx-api-sdk` 与 `wjx-mcp-server`，然后在客户端配置 `node /absolute/path/wjx-mcp-server/dist/index.js`。

## 从旧 CLI 参数迁移

| 旧写法 | 当前写法 |
| --- | --- |
| `--permanent` | `--completely` |
| `--filename` | `--file_name` |
| `--format` | `--suffix` |
| `--response_id` | `--jid` |
| `--base64`（上传） | `--file` |

## 从 DSL 迁移

参阅 [DSL 兼容](legacy/dsl.md)，将文本转成 JSONL 后使用 `create-by-json`。
