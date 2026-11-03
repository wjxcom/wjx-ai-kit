# CLI 命令参考

运行 `wjx <command> --help` 可查看当前命令和参数；本版本包含 {{CLI_COMMAND_COUNT}} 个叶子命令。

## 顶层命令

| 命令 | 用途 |
| --- | --- |
| `survey` | 问卷生命周期、题型、设置和上传 |
| `response` | 答卷查询、下载、提交、报告 |
| `analytics` | 本地解码、NPS/CSAT、异常检测、对比 |
| `contacts` / `department` / `admin` / `tag` | 通讯录域 |
| `user-system` / `account` | 子账号，以及已有用户体系的兼容维护（用户体系能力已过时） |
| `sso` | 生成 SSO 和问卷 URL |
| `init` / `doctor` / `whoami` | 配置与诊断 |
| `completion` / `reference` / `skill` / `update` | 辅助能力 |

## 关键参数

| 目标 | 当前参数 |
| --- | --- |
| 删除问卷 | `wjx survey delete --vid <vid>`；省略 `--username` 时从读回的 `creater` 自动补齐 |
| 彻底删除问卷 | `wjx survey delete --vid <vid> --completely` |
| 上传文件 | `wjx survey upload --file_name <name> --file <base64>` |
| 导出格式 | `wjx response download --suffix 0\|1\|2` |
| 查询单份答卷 | `wjx response query --jid <id>` |
| 创建 JSONL 问卷 | `wjx survey create --file <path>` |
| 创建或修改题目逻辑 | `survey create` / `survey update` 增加 `--dsl '{"logic":"logic { ... };"}'` |
| 生成填写/预览链接 | `wjx survey preview-url --sid <sid>` |

旧参数 `--permanent`、`--base64`、`--filename`、`--response_id` 不属于当前 CLI 参考路径。需要确认本机版本时运行 `wjx --version` 和 `wjx <command> --help`。

## 输出与输入

默认输出 JSON；使用 `--format table` 进行人工查看；`--stdin` 接收 JSON 参数。`--dry-run` 不发送 API 请求，并在 stdout 返回统一 envelope：`{"ok":true,"data":{"kind":"dry-run","plans":[...]}}`；stderr 只保留诊断信息。命令失败时使用结构化错误码，脚本应检查退出码。`--json`、`--table` 已移除，低于 `0.4.1` 的客户端必须先升级。

`survey preview-url` 优先接受 API 返回的 `sid`；只有没有 `sid` 时才接受正整数 `vid`，同时提供两者时以 `sid` 为准。它生成答卷人填写/预览链接，不是后台编辑链接；后台编辑请使用 `survey url --mode edit --activity <vid>`。

`wjx update` 会先读取 npm registry 的 `latest` 版本；只有远端版本严格高于当前版本才执行安装。当前版本高于 registry 或 registry 检查失败时不会盲目更新，避免把本地版本降级或覆盖。

`survey create` 请求会发送 `X-WJX-Client: wjx-cli` 和 `X-WJX-Client-Version: <当前版本>`。服务端若返回结构化的 `errorcode: "CLIENT_VERSION_TOO_OLD"`、`"CLI_VERSION_TOO_OLD"`、`"UPGRADE_REQUIRED"`，或 `data.upgrade_required: true`，CLI 会在 stderr 输出 `UPGRADE_REQUIRED`；服务端提供 `min_client_version`、`upgrade_command` 时，CLI 会原样保留并生成对应提示，未提供的字段不会臆造。stdout 不输出伪成功结果。低于 `0.4.1` 的旧 CLI 不会发送这些请求头，服务端需要按旧创建 action 或缺失版本头返回同一业务错误。

# AI 主页

`wjx survey create-ai-page --file homepage.html` 创建独立的纯展示 AI 主页；使用 `--html_content` 可直接传入 HTML，PPT 默认应采用逐页展示。修改前用 `wjx survey get --vid <vid>` 读取草稿也可返回的 `html_content` 和固定 `page_type`，再通过 `wjx survey update-ai-page --vid <vid> --file homepage.html` 原位更新。`vid` 必须为传统数字编号，更新不支持修改页面类型。


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
