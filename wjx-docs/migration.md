# 迁移指南

## 从旧文档迁移

请按新的信息架构使用 `start/`、`tasks/`、`reference/`、`concepts/`、`integrations/` 和 `operations/` 下的页面；旧链接请替换为对应的新路径。

## 从 MCP npm 安装迁移

旧版源码安装方式仍可用。当前三个包的源码版本均为 `0.4.4`，发布顺序为 SDK → MCP Server → CLI。发布前从 GitHub 克隆并构建，发布完成后可直接安装 registry 的 `latest`。

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

## DSL 迁移复核清单

XML DSL v1 是面向问卷星协议的可读交换格式，但不是保证无损的通用备份格式。旧问卷迁移时，先用 `wjx dsl query --vid <vid>` 获取服务端往返 DSL，再人工核对以下项目；只有读回结构和页面行为都符合预期，才提交创建或更新：

- 分支、跳题、显示/隐藏条件和题目/选项引用；
- 题目和选项验证规则、默认值、提示文字、必答状态；
- 考试答案、解析、分值、评分权重和主观题阅卷设置；
- 题目随机、选项随机、分组随机、配额和 piping/答案回填；
- 矩阵/表格的列信息、列宽、列互斥、行分组、富文本和部分列属性；
- 图片、文件、音视频、定位数据等资源路径是否仍属于当前问卷；
- 高级题型（循环评价、热力图、VlookUp、AI 题型、考试代码等）是否需要 Web 编辑器补充配置。

导出结果中出现 `raw` 或未识别属性时，必须保留原字段并标记为“服务端协议字段”，不能根据字段名猜测语义，也不能把 DSL 成功解析当作页面功能已验证。
