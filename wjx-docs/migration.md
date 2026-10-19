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

## Survey JSON 与逻辑

问卷创建统一使用 Survey JSON（JSONL），修改使用同一内容格式。涉及题目关联时增加可选节点：

```json
{"dsl":{"logic":"logic { if \"2::1\" then show \"3\"; };"}}
```

完整请求的 `jsonl` 是 JSONL 字符串；`dsl` 是对象，只包含 `logic`。无逻辑时省略 `dsl`。已有 `relation/referselect` 字段继续保留，冲突时 DSL 优先。

SDK 使用 `createSurveyByJson` / `updateSurveyByJson`；CLI 使用 `survey create` / `survey update`；MCP 使用 `create_survey_by_json` / `update_survey_by_json`。普通查询 `getSurvey` / `survey get` / `get_survey` 从实际 XML 返回可编辑的 `dsl.logic`。

仅修改逻辑时提交 `vid + dsl`；修改题目时提交 `vid + jsonl`，可同时提交 `dsl`。修改不会隐式重新发布或迁移创建者。修改请求执行一次，之后从普通查询验证实际保存结果。

服务端将 DSL 解析并转换为 XML 的 Relation、ItemRelation、AnytimeJumpto、ReferTopic 等原生逻辑属性。XML 中不保存 DSL 原文或新增的 DSL 节点。仅修改逻辑时在原 XML 上更新对应属性，保留题目、选项、分页、设置和扩展数据。

```text
创建：Survey JSON -> 题目 XML；dsl.logic -> 原生 XML 逻辑；校验后保存 XML
修改逻辑：实际 XML -> dsl.logic -> AI 修改 -> 原生 XML 逻辑 -> 更新原 XML
```

CLI 示例：

```powershell
wjx survey create --file survey.jsonl --dsl '{"logic":"logic { if \"2::1\" then show \"3\"; };"}'
wjx survey get --vid 12345
wjx --yes survey update --vid 12345 --dsl '{"logic":"logic { if \"2::2\" then show \"3\"; };"}'
wjx --yes survey update --vid 12345 --file survey.jsonl
```

修改问卷结构时，已有的答卷索引保护继续生效；无答卷问卷确需结构变更时显式使用 `--allow-breaking-changes`（SDK 为 `allowBreakingChanges`，MCP 为 `allow_breaking_changes`）。
