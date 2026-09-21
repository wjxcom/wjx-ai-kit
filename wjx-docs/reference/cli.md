# CLI 命令参考

运行 `wjx <command> --help` 可查看当前命令和参数；本版本包含 81 个叶子命令。

## 顶层命令

| 命令 | 用途 |
| --- | --- |
| `survey` | 问卷生命周期、题型、设置和上传 |
| `dsl` | XML DSL 查询、校验、创建和修改 |
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
| 校验 XML DSL | `wjx dsl generate --file <path>` |
| 创建/修改 XML DSL 问卷 | `wjx dsl create --file <path>` / `wjx dsl update --vid <vid> --file <path>` |
| DSL 素材自动上传 | 在上述命令追加 `--assets <manifest.json>` |
| 查询 XML DSL | `wjx dsl query --vid <vid>` |
| 生成填写/预览链接 | `wjx survey preview-url --sid <sid>` |

旧参数 `--permanent`、`--base64`、`--filename`、`--response_id` 不属于当前 CLI 参考路径。需要确认本机版本时运行 `wjx --version` 和 `wjx <command> --help`。

## 输出与输入

默认输出 JSON；使用 `--format table` 进行人工查看；`--stdin` 接收 JSON 参数。`--dry-run` 不发送 API 请求，并在 stdout 返回统一 envelope：`{"ok":true,"data":{"kind":"dry-run","plans":[...]}}`；stderr 只保留诊断信息。命令失败时使用结构化错误码，脚本应检查退出码。`--json`、`--table` 已移除，低于 `0.4.1` 的客户端必须先升级。

`survey preview-url` 优先接受 API 返回的 `sid`；只有没有 `sid` 时才接受正整数 `vid`，同时提供两者时以 `sid` 为准。它生成答卷人填写/预览链接，不是后台编辑链接；后台编辑请使用 `survey url --mode edit --activity <vid>`。

`wjx update` 会先读取 npm registry 的 `latest` 版本；只有远端版本严格高于当前版本才执行安装。当前版本高于 registry 或 registry 检查失败时不会盲目更新，避免把本地版本降级或覆盖。

`survey create` 请求会发送 `X-WJX-Client: wjx-cli` 和 `X-WJX-Client-Version: <当前版本>`。服务端若返回结构化的 `errorcode: "CLIENT_VERSION_TOO_OLD"`、`"CLI_VERSION_TOO_OLD"`、`"UPGRADE_REQUIRED"`，或 `data.upgrade_required: true`，CLI 会在 stderr 输出 `UPGRADE_REQUIRED`；服务端提供 `min_client_version`、`upgrade_command` 时，CLI 会原样保留并生成对应提示，未提供的字段不会臆造。stdout 不输出伪成功结果。低于 `0.4.1` 的旧 CLI 不会发送这些请求头，服务端需要按旧创建 action 或缺失版本头返回同一业务错误。

DSL 查询支持额外读取扩展名、设置、分页/段落和标签；创建、修改成功后会读回问卷 DSL、身份、状态和链接。读回失败或结构不匹配时，客户端会报告未知结果，不会把写接口的成功响应单独当作已验证成功。

## DSL 素材流水线

`dsl create` 和 `dsl update` 支持 `--assets <manifest.json>`。DSL 中使用 `{{asset:<id>}}` 占位符，素材清单使用以下结构：

```json
{
  "assets": [
    { "id": "heatmap-bg", "file": "assets/heatmap.png" },
    { "id": "choice-a", "file": "assets/choice-a.jpg", "fileName": "choice-a.jpg" }
  ]
}
```

客户端在实际写入前读取素材、上传到问卷星、用服务端返回的资源路径替换占位符，再提交完整 DSL。上传失败、素材超限、占位符缺失或服务端未返回资源路径时不会提交问卷写入；`--dry-run` 不上传素材。图片素材仍需符合题型要求，音频、摄像和计时器只能自动生成配置框架，具体能力需在编辑页启用和补充。
# AI 主页

`wjx survey create-ai-page --file homepage.html` 创建独立的纯展示 AI 主页；使用 `--html_content` 可直接传入 HTML，PPT 默认应采用逐页展示。修改前用 `wjx survey get --vid <vid>` 读取草稿也可返回的 `html_content` 和固定 `page_type`，再通过 `wjx survey update-ai-page --vid <vid> --file homepage.html` 原位更新。`vid` 必须为传统数字编号，更新不支持修改页面类型。
