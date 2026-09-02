# SDK API 参考

SDK 的导出入口是 `wjx-api-sdk`。远程 API 函数接受业务参数、可选凭据和可选 `fetch` 实现；支持请求覆盖的远程函数还接受第四参数：

```ts
fn(input, credentials?, fetchImpl?, requestOptions?)
```

本地辅助函数不遵循这个远程请求签名：`buildSubmitTemplate(questions)`、`decodePushPayload(encryptedData, appKey, signature?, rawBody?)`、`buildPreviewUrl(input, baseUrl?)`、`surveyToText(survey)`、`calculateNps(scores)` 和 `calculateCsat(scores, scaleType?)` 都不发起网络请求。

## 主要导出

| 模块 | 示例 |
| --- | --- |
| survey | `listSurveys`, `getSurvey`, `createSurveyByJson`, `updateSurveyStatus` |
| response | `queryResponses`, `downloadResponses`, `getReport`, `submitResponse`, `buildSubmitTemplate` |
| analytics | `decodeResponses`, `decodePushPayload`, `calculateNps`, `calculateCsat`, `detectAnomalies`, `compareMetrics` |
| contacts | `queryContacts`, `addContacts` |
| user system（兼容/已过时） | `addParticipants`, `modifyParticipants`, `deleteParticipants`, `bindActivity`, `querySurveyBinding`, `queryUserSurveys`；仅用于已有系统 |
| SSO | `buildSsoSubaccountUrl`, `buildSsoUserSystemUrl`, `buildSurveyUrl`, `buildPreviewUrl` |
| DSL 读取/迁移 | `surveyToText`；不提供 DSL 创建接口 |

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
  clientVersion: "0.4.1",
});
```

问卷创建的唯一入口是 `createSurveyByJson`，参数为 JSONL 字符串。创建 `atype` 支持 `1/2/3/4/5/6/7/9/10/11`；`8` 用户体系不能新建。当前 SDK 不导出 `createSurvey`、`createSurveyByText` 或 `textToSurvey`；历史 DSL 需要在 SDK 外部转换为 JSONL。

`surveyToText` 保留用于把已读取的问卷转换为可读 DSL 文本；读取/导出 DSL 不等于使用 DSL 创建新问卷。

`buildSubmitTemplate` 是纯本地辅助函数：输入 `getSurvey` 返回的题目结构，输出按服务端原始 `q_index` 组织的 `submitdata` 占位模板和逐题提示，不发起网络请求。分页栏和段落说明会被跳过；生成后应由 AI 或用户替换占位答案，再交给 `submitResponse`。

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

当前工作树的 `0.4.1` 尚未发布到 npm，因此 `npm install -g wjx-cli@latest` 仅适用于正式发布后；发布前请按 [CLI 快速开始](../start/cli.md) 从源码构建。
