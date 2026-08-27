# wjx-api-sdk

问卷星 OpenAPI 的零运行时依赖 TypeScript SDK，适合 Node.js/TypeScript 应用集成。

## 安装

```bash
npm install wjx-api-sdk
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
  ].map(JSON.stringify).join("\\n"),
});
console.log(result.data);
```

函数统一接受 `(input, credentials?, fetchImpl?)`。显式凭据优先于凭据提供者，再回退到环境变量。业务失败返回 `result: false`，网络/超时错误可能抛出异常。

新代码使用 JSONL/JSON；`createSurveyByText`、`textToSurvey` 和 `surveyToText` 仅用于 DSL 兼容和迁移。

完整说明见 [SDK 快速开始](../wjx-docs/start/sdk.md) 和 [SDK API 参考](../wjx-docs/reference/sdk.md)。

## 开发

```bash
npm install
npm run build --workspace=wjx-api-sdk
npm test --workspace=wjx-api-sdk
```

许可证：[MIT](../LICENSE)
