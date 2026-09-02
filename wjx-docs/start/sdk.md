# SDK 快速开始

`wjx-api-sdk` 适用于 Node.js/TypeScript 程序。它使用 Node.js 内置 `fetch` 与 `crypto`，无需运行时第三方依赖。

## 安装

当前工作树版本为 `0.4.1`，尚未发布到 npm；registry 的 `latest` 仍是 `0.3.1`。发布前请从源码构建 SDK：

```bash
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
```

`0.4.1` 正式发布后，才执行下面的包安装命令：

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

也可以把 `{ apiKey: "...", baseUrl: "..." }` 作为第二参数传入函数；`baseUrl` 可以是部署主机，也可以是完整的 `/openapi/*.aspx` 地址。显式地址只作用于当前请求，不会修改全局环境，适合多租户并发调用。多租户程序也可以使用凭据提供者。函数、类型和错误结构见 [SDK API 参考](../reference/sdk.md)。

需要让服务端识别调用方时，在支持请求覆盖的函数第四参数传入 `clientName`、`clientVersion`；SDK 会发送对应的 `X-WJX-Client`、`X-WJX-Client-Version` 请求头。`wjx-cli` 的 `survey create` 已自动携带自身版本。

## 创建入口与 DSL 兼容边界

创建问卷只使用 `createSurveyByJson`。`surveyToText` 继续用于把已读取的问卷转换为可读 DSL 文本；SDK 不再提供 `createSurvey`、`createSurveyByText` 或 `textToSurvey` 创建接口。历史 DSL 只能在外部转换为 JSONL 后提交，步骤见 [DSL 兼容](../legacy/dsl.md)。
