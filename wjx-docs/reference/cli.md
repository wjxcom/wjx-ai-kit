# CLI 命令参考

运行 `wjx <command> --help` 可查看当前命令和参数；本版本包含 74 个叶子命令。

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
| 彻底删除问卷 | `wjx survey delete --completely` |
| 上传文件 | `wjx survey upload --file_name <name> --file <base64>` |
| 导出格式 | `wjx response download --suffix 0\|1\|2` |
| 查询单份答卷 | `wjx response query --jid <id>` |
| 创建 JSONL 问卷 | `wjx survey create --file <path>` |

旧参数 `--permanent`、`--base64`、`--filename`、`--response_id` 不属于当前 CLI 参考路径。需要确认本机版本时运行 `wjx --version` 和 `wjx <command> --help`。

## 输出与输入

默认输出 JSON；使用 `--format table` 进行人工查看；`--stdin` 接收 JSON 参数。`--dry-run` 不发送 API 请求，并在 stdout 返回统一 envelope：`{"ok":true,"data":{"kind":"dry-run","plans":[...]}}`；stderr 只保留诊断信息。命令失败时使用结构化错误码，脚本应检查退出码。`--json`、`--table` 已移除，低于 `0.4.1` 的客户端必须先升级。

`wjx update` 会先读取 npm registry 的 `latest` 版本；只有远端版本严格高于当前版本才执行安装。当前版本未发布或 registry 检查失败时不会盲目更新，避免把本地版本降级或覆盖。

`survey create` 请求会发送 `X-WJX-Client: wjx-cli` 和 `X-WJX-Client-Version: <当前版本>`。服务端若返回 `errorcode: "CLIENT_VERSION_TOO_OLD"`、`"CLI_VERSION_TOO_OLD"` 或 `"UPGRADE_REQUIRED"`，CLI 会在 stderr 输出 `UPGRADE_REQUIRED`，并附带 `min_client_version`、`upgrade_command` 与可直接执行的 `hint`；stdout 不输出伪成功结果。低于 `0.4.1` 的旧 CLI 不会发送这些请求头，服务端需要按旧创建 action 或缺失版本头返回同一业务错误。
