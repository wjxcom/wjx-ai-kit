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

## 问卷 DSL/JSONL 迁移的语义检查

从旧 DSL 或 JSONL 转换为当前 DSL/JSONL **不是无损转换**。导出内容只覆盖读取器能够表达和当前创建接口能够验证的字段；未覆盖的能力不会因为 dry-run 或创建成功而自动落库。发布前请逐项确认以下内容，必要时在问卷星 Web 编辑器中补配并重新读取核对：

- 分支/跳转逻辑（包括显示条件、题目关系和 `relation`/`referselect`）；
- 题目和选项随机化（包括 `randomchoice`、问卷级随机设置）；
- 验证规则、输入格式和自定义校验；
- 评分权重、计分公式和结果分组；
- 配额、配额组及达到配额后的行为；
- piping/答案引用到后续题目或文本的展示语义；
- 矩阵题的列、右行、量表模式及其他高级矩阵配置；
- 高级或仅支持 Web 编辑器的题型与扩展字段（例如 VlookUp、矩阵数值题、多项文件题、多项简答题和当前语音）。

建议的迁移验收顺序：

1. 导出并转换后执行 `--dry-run`，确认题目数量、顺序、题型和可见字段；
2. 创建或更新后使用 `get_survey`/DSL query 重新读取，逐题比对题干、选项、矩阵行列和必填/校验属性；
3. 对上列语义逐项标记“已验证”“需 Web 编辑器补配”或“不迁移”，再执行发布；
4. 对任何无法读回验证的字段保留人工复核记录，不能仅以接口返回成功作为迁移完成依据。
