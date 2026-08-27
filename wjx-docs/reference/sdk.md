# SDK API 参考

SDK 的导出入口是 `wjx-api-sdk`。函数统一接受业务参数、可选凭据和可选 `fetch` 实现：

```ts
fn(input, credentials?, fetchImpl?)
```

## 主要导出

| 模块 | 示例 |
| --- | --- |
| survey | `listSurveys`, `getSurvey`, `createSurvey`, `createSurveyByJson`, `updateSurveyStatus` |
| response | `queryResponses`, `downloadResponses`, `getReport`, `submitResponse` |
| analytics | `decodeResponses`, `calculateNps`, `calculateCsat`, `detectAnomalies`, `compareMetrics` |
| contacts | `queryContacts`, `addContacts` |
| user system（兼容/已过时） | `addParticipants`, `modifyParticipants`, `deleteParticipants`, `bindActivity`, `querySurveyBinding`, `queryUserSurveys`；仅用于已有系统 |
| SSO | `buildSsoSubaccountUrl`, `buildSsoUserSystemUrl`, `buildSurveyUrl`, `buildPreviewUrl` |
| compatibility | `createSurveyByText`, `textToSurvey`, `surveyToText` |

## 凭据优先级

显式 `credentials` > 凭据提供者 > `WJX_API_KEY`/`WJX_BASE_URL` 环境变量。不要在服务端日志中打印 `apiKey`。

## 错误处理

业务失败通常返回 `result: false` 与错误信息；网络、超时和解析错误可能抛出异常。生产代码同时处理两类结果，并为可重试请求设置边界。
