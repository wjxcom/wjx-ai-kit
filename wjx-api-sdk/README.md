# wjx-api-sdk

问卷星 OpenAPI 的零运行时依赖 TypeScript SDK，适合 Node.js/TypeScript 应用集成。

## 安装

当前稳定版本为 `0.4.3`，已发布到 npm，registry 的 `latest` 指向 `0.4.3`：

```bash
npm install wjx-api-sdk
```

从源码开发时，再从 monorepo 根目录构建 SDK：

```bash
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
```

要求 Node.js 20+。通过环境变量配置凭据：

```bash
# macOS/Linux
export WJX_API_KEY="你的 API Key"
# PowerShell
$env:WJX_API_KEY = "你的 API Key"
```

## 最小示例

```ts
import { listSurveys, createSurveyByJson } from "wjx-api-sdk";

const surveys = await listSurveys({ page_index: 1, page_size: 10 });
console.log(surveys.data);

const result = await createSurveyByJson({
  jsonl: [
    { qtype: "问卷基础信息", title: "示例问卷" },
    { qtype: "单选", title: "选择一个", select: ["A", "B"] },
  ].map(JSON.stringify).join("\n"),
});
console.log(result.data);
```

远程 API 函数统一接受 `(input, credentials?, fetchImpl?, requestOptions?)`（仅支持请求覆盖的函数接受第四参数）。本地辅助函数有各自的纯函数签名，不需要凭据，也不发起网络请求。显式凭据优先于凭据提供者，再回退到环境变量。业务失败返回 `result: false`，网络/超时错误可能抛出异常。

### 私有化与多租户路由

将 `baseUrl` 放入第二参数的凭据对象即可为单次请求指定部署地址：

```ts
await listSurveys(
  { page_index: 1, page_size: 10 },
  { apiKey: "tenant-key", baseUrl: "https://survey.example.com" },
);
```

`baseUrl` 推荐填写部署主机（包含协议）；也兼容完整的
`/openapi/default.aspx`、`/openapi/contacts.aspx` 等 endpoint，SDK 会按当前服务选择正确路径。单次请求的显式地址优先于 `WJX_BASE_URL`，请求之间不会修改全局环境变量，适合并发的多租户程序。支持 `RequestOverrides` 的模块也可通过第四参数传入 `baseUrl`、`retryBudget` 或 `timeoutMs`。

需要服务端识别调用方版本时，可在第四参数传入 `clientName` 和 `clientVersion`。SDK 会发送 `X-WJX-Client` 与 `X-WJX-Client-Version` 请求头；CLI 的 `survey create` 已自动发送 `wjx-cli` 与自身版本。

创建问卷统一使用 `createSurveyByJson`。答卷模板可用 `buildSubmitTemplate` 根据 `getSurvey` 题目结构在本地生成；它不会发起网络请求，并保留服务端原始 `q_index`。推送数据可用 `decodePushPayload` 在本地解密并可选验签，同样不会发起网络请求。`surveyToText` 保留用于把已读取的问卷转换为可读 DSL 文本；当前 SDK 不提供 `createSurvey`、`createSurveyByText` 或 `textToSurvey` 创建接口。旧 DSL 只能在外部转换为 JSONL。

完整说明见 [SDK 快速开始](../wjx-docs/start/sdk.md) 和 [SDK API 参考](../wjx-docs/reference/sdk.md)。

## 开发

```bash
npm install
npm run build --workspace=wjx-api-sdk
npm test --workspace=wjx-api-sdk
```

许可证：[MIT](../LICENSE)
