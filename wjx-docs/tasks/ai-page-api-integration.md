# AI 主页接口

## 功能

AI 主页不是问卷 XML DSL，而是由 AI 或其他编辑器生成 HTML，再通过 OpenAPI 写入问卷星。后端接口已经存在：

| 操作 | Action | 客户端入口 |
| --- | --- | --- |
| 创建 AI 主页 | `A1000107` | CLI `survey create-ai-page`、MCP `create_ai_page`、SDK `createAiPage` |
| 更新 AI 主页 | `A1000108` | CLI `survey update-ai-page`、MCP `update_ai_page`、SDK `updateAiPage` |

## 创建

```powershell
wjx survey create-ai-page `
  --title "中秋节 AI 主页" `
  --file .\mid-autumn.html `
  --page_type 0 `
  --publish `
  --yes --non-interactive
```

`--html_content` 和 `--file` 二选一。`page_type` 为 `0` 网页、`1` 海报、`2` PPT；省略时由服务端使用默认值。省略 `--publish` 时创建草稿。

## 更新

```powershell
wjx survey update-ai-page `
  --vid 123456 `
  --file .\revised.html `
  --title "更新后的主页" `
  --page_type 0 `
  --yes --non-interactive
```

`vid` 必须是传统数字问卷编号，不能使用 `sid`。后端会校验目标存在、类型为 AI 主页并且属于当前企业。已发布主页需要先使用 `survey status --vid <vid> --state 2` 暂停，再执行更新；客户端不会自动暂停。

## 输入约束

- HTML 最长 200000 个字符。
- 标题最长 100 个字符，不能包含“问卷星”。
- `page_type` 只能是 `0`、`1`、`2`。
- 创建/更新请求不自动重试，避免重复写入。
- `--dry-run` 只输出脱敏后的请求计划，不访问服务器。

## 结果

成功响应包含 `vid`、`sid`、`status`、`verify_status`、填写路径和 iframe 地址。CLI 默认以统一 `ok/data/meta` envelope 输出，SDK 保持问卷星原始 `result/data` 响应结构。
