# SDK API 参考

SDK 的导出入口是 `wjx-api-sdk`。远程 API 函数接受业务参数、可选凭据和可选 `fetch` 实现；支持请求覆盖的远程函数还接受第四参数：

```ts
fn(input, credentials?, fetchImpl?, requestOptions?)
```

本地辅助函数不遵循这个远程请求签名：`buildSubmitTemplate(questions)`、`decodePushPayload(encryptedData, appKey, signature?, rawBody?)`、`buildPreviewUrl(input, baseUrl?)`、`calculateNps(scores)` 和 `calculateCsat(scores, scaleType?)` 都不发起网络请求。


## 主要导出

| 模块 | 示例 |
| --- | --- |
| survey | `listSurveys`, `getSurvey`, `createSurveyByJson`, `updateSurveyStatus` |
| response | `queryResponses`, `downloadResponses`, `getReport`, `submitResponse`, `buildSubmitTemplate` |
| analytics | `decodeResponses`, `decodePushPayload`, `calculateNps`, `calculateCsat`, `detectAnomalies`, `compareMetrics` |
| contacts | `queryContacts`, `addContacts` |
| user system（兼容/已过时） | `addParticipants`, `modifyParticipants`, `deleteParticipants`, `bindActivity`, `querySurveyBinding`, `queryUserSurveys`；仅用于已有系统 |
| SSO | `buildSsoSubaccountUrl`, `buildSsoUserSystemUrl`, `buildSurveyUrl`, `buildPreviewUrl` |

## 凭据优先级

显式 `credentials` > 凭据提供者 > `WJX_API_KEY`/`WJX_BASE_URL` 环境变量。不要在服务端日志中打印 `apiKey`。

### 单次请求指定部署地址

多租户或私有化部署应把 `baseUrl` 放在该次调用的凭据对象中：

```ts
await listSurveys(
  { page_index: 1, page_size: 10 },
  { apiKey: "tenant-key", baseUrl: "https://survey.example.com" },
);
```

`baseUrl` 推荐使用包含协议的部署主机，也接受完整的 OpenAPI endpoint（例如
`https://survey.example.com/openapi/default.aspx`）。SDK 会去掉 endpoint 路径并为每个服务拼接正确地址。显式 `baseUrl` 优先于环境变量；请求之间不临时修改 `process.env`，因此可以安全地并发访问不同 profile。`RequestOverrides` 支持的函数还可以在请求选项中覆盖 `baseUrl`、`retryBudget`、`timeoutMs`，以及服务端兼容性识别所需的 `clientName`、`clientVersion`。

问卷创建请求建议带上客户端身份，例如：

```ts
await createSurveyByJson(input, credentials, fetch, {
  clientName: "wjx-cli",
  clientVersion: "0.4.5",
});
```


创建 `atype` 支持 `1/2/3/4/5/6/7/9/10/11`；`8` 用户体系不能新建。



AI 主页通过 `createAiPage`（OpenAPI `A1000107`）创建，通过 `getSurvey` 读取草稿也可返回的 `html_content` 和固定 `page_type`，再由 `updateAiPage`（OpenAPI `A1000108`）基于完整原 HTML 原位更新。更新不支持修改页面类型。

`buildSubmitTemplate` 是纯本地辅助函数：输入 `getSurvey` 返回的题目结构，输出按服务端原始 `q_index` 组织的 `submitdata` 占位模板和逐题提示，不发起网络请求。分页栏和段落说明会被跳过；生成后应由 AI 或用户替换占位答案，再交给 `submitResponse`。

`submitResponse` 支持可选的 `submit_channel` 字段，用于向 OpenAPI 1001001 标记提交来源；问卷星服务端只接受白名单值。CLI 和 MCP 会分别自动发送 `wjx-cli` 与 `wjx-mcp`。

`decodePushPayload` 是纯本地推送解密与验签函数：输入问卷星推送的加密载荷和 `appKey`，可选 `signature`、`rawBody`，输出解密后的 JSON/文本及验签结果，不发起网络请求。

## 错误处理

SDK 直接返回问卷星 OpenAPI 原始响应，业务失败通常返回 `result: false` 与错误信息；网络、超时和解析错误可能抛出异常。CLI 在其上把成功/失败投影为 `ok/data/meta` 或 `ok/error` envelope，不能把 SDK 原始响应当成 CLI 输出解析。生产代码同时处理两类结果，并为可重试请求设置边界。

### 客户端版本升级提示

服务端需要阻止旧 CLI 创建问卷时，建议保持 HTTP 200 并返回以下业务失败结构：

```json
{
  "result": false,
  "errorcode": "CLIENT_VERSION_TOO_OLD",
  "errormsg": "客户端版本过低，请升级后重试",
  "data": {
    "min_client_version": "0.4.1",
    "upgrade_command": "npm install -g wjx-cli@latest"
  }
}
```

CLI 会将该响应转换为 `UPGRADE_REQUIRED` 错误，并保留服务端实际提供的最低版本、升级命令和 trace id；未提供的可选升级字段不会由客户端臆造。旧于 `0.4.1` 的 CLI 不会发送版本请求头；服务端应同时将旧创建 action 或缺少客户端版本头的创建请求判定为升级场景。

`wjx-cli` 当前源码版本为 `0.4.5`；发布后 CLI 用户可先执行 `npm install -g wjx-cli@latest`，成功后再执行 `wjx skill install --force` 获取 CLI 并启用 `wjx-cli-use`。npm 包名是 `wjx-cli`，安装后的命令名是 `wjx`，验证时运行 `wjx --version`。发布前按 [CLI 快速开始](../start/cli.md) 从源码构建。


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
