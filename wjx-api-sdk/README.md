# wjx-api-sdk

问卷星 OpenAPI 的零运行时依赖 TypeScript SDK，适合 Node.js/TypeScript 应用集成。

## 安装

当前源码版本为 `0.4.4`。发布到 npm 后，registry 的 `latest` 将指向 `0.4.4`：

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


创建问卷统一使用 `createSurveyByJson`。答卷模板可用 `buildSubmitTemplate` 根据 `getSurvey` 题目结构在本地生成；它不会发起网络请求，并保留服务端原始 `q_index`。推送数据可用 `decodePushPayload` 在本地解密并可选验签，同样不会发起网络请求。


完整说明见 [SDK 快速开始](../wjx-docs/start/sdk.md) 和 [SDK API 参考](../wjx-docs/reference/sdk.md)。

## 开发

```bash
npm install
npm run build --workspace=wjx-api-sdk
npm test --workspace=wjx-api-sdk
```

许可证：[MIT](../LICENSE)


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
