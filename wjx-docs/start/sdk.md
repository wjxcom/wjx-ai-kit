# SDK 快速开始

`wjx-api-sdk` 适用于 Node.js/TypeScript 程序。它使用 Node.js 内置 `fetch` 与 `crypto`，无需运行时第三方依赖。

## 安装

```bash
npm install wjx-api-sdk
```

要求 Node.js 20 或更高版本。凭据可以通过环境变量提供：

```bash
# macOS/Linux
export WJX_API_KEY="你的 API Key"
# PowerShell
$env:WJX_API_KEY = "你的 API Key"
```

## 第一个调用

```ts
import { listSurveys, createSurveyByJson } from "wjx-api-sdk";

const surveys = await listSurveys({ page_index: 1, page_size: 10 });
console.log(surveys.data);

const created = await createSurveyByJson({
  jsonl: [
    { qtype: "问卷基础信息", title: "客户满意度" },
    { qtype: "量表题", title: "整体满意度", select: ["1", "2", "3", "4", "5"] },
  ].map(JSON.stringify).join("\n"),
});
console.log(created.data);
```

也可以把 `{ apiKey: "...", baseUrl: "..." }` 作为第二参数传入函数；多租户程序使用凭据提供者。函数、类型和错误结构见 [SDK API 参考](../reference/sdk.md)。

## 不要从这里开始 DSL

`createSurveyByText`、`textToSurvey` 仍可用于旧数据迁移，但新代码应使用 JSONL/JSON。原因和迁移步骤见 [DSL 兼容](../legacy/dsl.md)。
