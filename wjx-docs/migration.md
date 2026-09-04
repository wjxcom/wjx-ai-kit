# 迁移指南

## 从旧文档迁移

请按新的信息架构使用 `start/`、`tasks/`、`reference/`、`concepts/`、`integrations/` 和 `operations/` 下的页面；旧链接请替换为对应的新路径。

## 从 MCP npm 安装迁移

旧版源码安装方式仍可用。当前三个包均为 `0.4.3`，已按 SDK → MCP Server → CLI 顺序发布到 npm，registry 的 `latest` 均已更新。直接安装最新包即可；需要开发源码时再从 GitHub 克隆并构建。

## 从旧 CLI 参数迁移

### CLI 0.4.x 输出协议

成功结果读取 `ok/data/meta`，失败结果读取 `ok/error`。不再读取顶层 `result`；`data` 内业务字段保持原语义。机器调用使用 `--format json`，分页或流式消费可使用 `ndjson`/`csv`。旧的 `--json`、`--table` 别名已移除，必须升级到 `wjx-cli >= 0.4.1` 并使用 `--format`。

这条规则只适用于 CLI 输出。`wjx-api-sdk` 仍返回问卷星 OpenAPI 原始响应，业务失败使用 `result: false`；SDK 调用方不要按 CLI 的 `ok/data/meta` envelope 解析。

高风险删除、清空和修改命令在非交互环境必须追加 `--yes`；`--dry-run` 始终优先且不会发出 HTTP 请求。dry-run 成功结果同样写入 stdout，读取 `ok/data`，其中 `data.kind` 为 `dry-run`、`data.plans` 是脱敏后的请求计划；stderr 只保留诊断信息。

| 旧写法 | 当前写法 |
| --- | --- |
| `--permanent` | `--completely` |
| `--filename` | `--file_name` |
| `response download --format` | `response download --suffix` |
| `--response_id` | `--jid` |
| `--base64`（上传） | `--file` |

## 从 DSL 迁移

参阅 [DSL 兼容](legacy/dsl.md)，将文本转成 JSONL 后使用 `create`。
