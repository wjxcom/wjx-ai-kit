# CLI 命令参考

运行 `wjx <command> --help` 可查看当前命令和参数；本版本包含 76 个叶子命令。

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
| 创建 JSONL 问卷 | `wjx survey create-by-json --file <path>` |

旧参数 `--permanent`、`--base64`、`--filename`、`--format`、`--response_id` 不属于当前 CLI 参考路径。需要确认本机版本时运行 `wjx --version` 和 `wjx <command> --help`。

## 输出与输入

默认输出 JSON；`--table` 用于人工查看；`--stdin` 接收 JSON 参数；`--dry-run` 只打印请求预览，不发送 API 请求。命令失败时使用结构化错误码，脚本应检查退出码。
