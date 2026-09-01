# AI 主页接口集成开发计划

## 1. 文档目的

本文档用于指导在 `wjx-ai-kit` 中集成问卷星 AI 主页接口，增加创建和更新 AI 主页的调用能力。

后端接口已经存在于 `tanhao` 项目：

- `A1000107`：创建 AI 主页
- `A1000108`：更新 AI 主页

本次不修改后端 action 编号，也不与 DSL 接口混用：

- `A1000107` / `A1000108`：AI 主页
- `A1000109` / `A1000110`：DSL 问卷创建和修改

## 2. 已确认的实现范围

本次在 `wjx-ai-kit` 中同时提供以下三层能力：

1. SDK：提供类型安全的 TypeScript 函数。
2. CLI：提供面向用户和 AI Agent 的命令行入口。
3. MCP Server：提供与 SDK、CLI 等价的 MCP 工具。

三层统一复用 SDK 的请求、签名、认证和错误处理逻辑，不重复实现 HTTP 协议细节。

CLI 命令采用：

```text
wjx survey create-ai-page
wjx survey update-ai-page
```

更新已发布 AI 主页时，CLI 不自动暂停主页。调用者必须显式调用 `A1000102` 将主页暂停后，再调用更新接口，以避免工具隐式改变线上状态。

## 3. 接口契约

### 3.1 创建 AI 主页：A1000107

接口地址使用现有 API Client 配置的 `default.aspx`，认证方式复用 API Key 和现有签名逻辑。

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `creater` | string | 否 | 子账号用户名；不传时使用主账号 |
| `title` | string | 否 | 最长 100 字符，不能包含“问卷星” |
| `html_content` | string | 是 | HTML 内容，最长 200000 字符 |
| `html` | string | 否 | `html_content` 的兼容字段 |
| `page_type` | number | 否 | `0=网页`、`1=海报`、`2=PPT`，默认 `0` |
| `publish` | boolean | 否 | 是否创建后发布，默认不发布 |

客户端输入中 `html_content` 与 `html` 至少提供一个；优先使用 `html_content`。

### 3.2 更新 AI 主页：A1000108

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `vid` | string/number | 是 | 传统问卷 `vid`，不得传短编号 `sid` |
| `html_content` | string | 是 | HTML 内容，最长 200000 字符 |
| `html` | string | 否 | `html_content` 的兼容字段 |
| `title` | string | 否 | 最长 100 字符；不传时保留原标题 |
| `page_type` | number | 否 | `0=网页`、`1=海报`、`2=PPT`；不传时保留原值 |

已发布主页不能直接更新。调用者需要先执行：

```bash
wjx survey status --vid <vid> --state 2
```

然后再执行更新命令。CLI 和 MCP 均不得自动执行暂停操作。

### 3.3 返回值

两个接口统一返回：

- `vid`
- `sid`
- `status`
- `verify_status`
- `pc_path`
- `mobile_path`
- `activity_domain`
- `iframe_auto_url`
- `iframe_noauto_url`

返回值应保留后端原始字段，同时由 SDK 提供明确的 TypeScript 类型。

## 4. SDK 开发内容

建议新增 AI 主页模块：

```text
wjx-api-sdk/src/modules/ai-page/types.ts
wjx-api-sdk/src/modules/ai-page/client.ts
```

在 `wjx-api-sdk/src/core/constants.ts` 中增加或复用 `1000107`、`1000108` action 常量，并在 `src/index.ts` 导出：

```ts
createAiPage(input, credentials?)
updateAiPage(input, credentials?)
```

建议类型：

```ts
CreateAiPageInput
UpdateAiPageInput
AiPageResult
```

SDK 负责：

- 复用现有 API Client、API Key、Base URL 和 SHA-1 签名逻辑。
- 生成正确的 action、时间戳和请求体。
- 支持 `html_content` 和兼容字段 `html`。
- 校验 HTML 长度、标题长度和 `page_type` 范围。
- 校验更新接口只能接收传统 `vid`。
- 复用现有 API 错误转换和响应结构。
- 不增加数据库访问或新的持久化逻辑。

## 5. CLI 开发内容

在 `wjx-cli/src/commands/survey.ts` 中增加两个命令。

### 5.1 create-ai-page

支持参数：

```text
--title <s>
--html_content <s>
--file <path>
--page_type <n>
--publish
--creater <s>
```

### 5.2 update-ai-page

支持参数：

```text
--vid <n>
--html_content <s>
--file <path>
--title <s>
--page_type <n>
```

`--file` 用于读取较长 HTML；文件内容转换为 `html_content` 后调用 SDK。命令应支持现有 CLI 的 JSON、表格、请求预览和统一错误输出模式。

CLI 从现有配置读取：

- `WJX_API_KEY`
- `WJX_BASE_URL`

## 6. MCP Server 开发内容

在 `wjx-mcp-server` 中增加两个工具：

```text
create_ai_page
update_ai_page
```

工具参数与 SDK 输入类型保持一致，工具实现只调用 SDK 函数，不复制签名、参数校验和 HTTP 请求逻辑。

同步更新 MCP 工具说明、输入 schema、错误说明和工具数量文档。

## 7. 测试计划

### 7.1 SDK 单元测试

- 创建最小 HTML 页面。
- 创建网页、海报、PPT 三种页面类型。
- 创建草稿和创建后发布。
- 使用 `html` 兼容字段。
- 更新 HTML、标题和页面类型。
- 缺少 HTML 内容。
- 标题超过 100 字符。
- HTML 超过 200000 字符。
- `page_type` 非 `0/1/2`。
- `vid` 缺失、非法、传入 `sid` 或不存在。
- 模拟后端错误响应。
- 验证 action 为 `1000107` 和 `1000108`。

### 7.2 CLI 测试

- 内联 HTML 创建。
- `--file` 文件创建。
- 更新已有 AI 主页。
- JSON 和表格输出。
- `--dry-run` / `--request-preview` 请求预览。
- 缺少必填参数和非法参数。
- 已发布主页更新失败时给出暂停提示。
- 验证 CLI 不会自动调用暂停接口。

### 7.3 MCP 测试

- 工具 schema 校验。
- 创建和更新调用参数映射。
- 认证失败和业务错误透传。
- 已发布主页更新时返回显式暂停提示。

### 7.4 真实端到端测试

1. 创建草稿 AI 主页。
2. 校验返回的 `vid`、`sid` 和访问地址。
3. 更新标题和 HTML 内容。
4. 创建并发布另一份 AI 主页。
5. 直接更新已发布主页，确认后端拒绝。
6. 显式调用 `A1000102` 暂停主页。
7. 再调用 `A1000108`，确认更新成功。
8. 查询并确认标题、页面类型和 HTML 内容已保存。

## 8. 文档与发布

需要同步更新：

- SDK API 参考文档。
- CLI 命令参考和使用示例。
- MCP 工具参考。
- `wjx-docs/reference` 中的 API 能力矩阵。
- `CHANGELOG.md`。

验证命令：

```bash
npm test --workspace=wjx-api-sdk
npm test --workspace=wjx-cli
npm test --workspace=wjx-mcp-server
npm run build
```

验证通过后，再按项目现有发布流程发布 SDK、CLI 和 MCP Server。

## 9. 验收标准

- SDK 可以成功调用 `A1000107` 和 `A1000108`。
- CLI 两个命令可完成创建和更新 AI 主页。
- MCP 提供等价工具能力。
- 传统 `vid` 校验有效，`sid` 不会被当作更新参数接受。
- 已发布主页不会被 CLI 或 MCP 自动暂停。
- 请求和响应字段与 ShowDoc 文档一致。
- 两个 action 不影响 DSL 的 `A1000109`、`A1000110`。
- 单元测试、集成测试和真实端到端测试通过。
- 文档、帮助信息和变更日志已同步更新。

## 10. 当前状态

SDK、CLI、MCP Server 及配套文档和自动化测试已完成。三个包均可成功构建；SDK 测试 712 项通过，MCP 测试 319 项通过，CLI 测试 196 项通过，另有一个既有的 PPT 技能安装测试因本机未安装 Python 依赖失败，与 AI 主页功能无关。

真实环境初测已完成：网络和 API Key 可用，使用表单请求创建得到 `vid=206431`，并可成功更新；但线上 `A1000107/A1000108` 对标准 JSON 请求体返回“参数读取失败”，CLI 因此无法完成 JSON 端到端调用。需要先部署后端原始 JSON 参数解析/请求校验修复，再执行 CLI 创建、更新和发布回归。
\n### Legacy JSON transport compatibility
