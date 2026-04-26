# SDK 进阶指南：高级特性与最佳实践

> DSL 双向转换、本地分析引擎、fetch 注入测试、多租户架构、Webhook 解密

---

## DSL 双向转换

SDK 内置了一套完整的问卷 DSL（领域特定语言），支持纯文本和 API 结构体之间的双向转换。

### 文本 → 问卷（textToSurvey）

```typescript
import { textToSurvey } from "wjx-api-sdk";

const text = `
员工满意度调查
这是一份匿名调查
===

1. 您的部门 [下拉框]
技术部
产品部
市场部

2. 整体满意度 [量表题]
1~10

3. 请评价以下方面 [矩阵量表题]
行：
- 工作环境
- 团队协作
- 薪酬福利
列：
- 非常不满意
- 不满意
- 一般
- 满意
- 非常满意

4. 改进建议 [填空题]
`;

const parsed = textToSurvey(text);
// parsed.title === "员工满意度调查"
// parsed.description === "这是一份匿名调查"
// parsed.questions[0].type === "dropdown"
// parsed.questions[1].type === "scale"
// parsed.questions[2].type === "matrix-scale"
```

### 问卷 → 文本（surveyToText）

```typescript
import { getSurvey, surveyToText } from "wjx-api-sdk";

const survey = await getSurvey({ vid: 12345 });
const text = surveyToText(survey.data);
console.log(text);
// 输出人类可读的 DSL 文本，可以编辑后重新创建
```

### 结构 → API 格式（parsedQuestionsToWire）

```typescript
import { textToSurvey, parsedQuestionsToWire, createSurvey } from "wjx-api-sdk";

const parsed = textToSurvey(dslText);
const { questions: wireQuestions } = parsedQuestionsToWire(parsed.questions);
// wireQuestions 是 API 需要的 { q_title, q_type, q_subtype, items, ... } 格式

await createSurvey({
  title: parsed.title,
  description: parsed.description ?? "",
  type: 1,
  questions: JSON.stringify(wireQuestions),
});
```

`createSurveyByText()` 是以上三步的封装——解析、转换、创建一步完成。

### DSL 支持的题型标签（旧 `createSurveyByText`）

| 类别 | 标签 | 内部类型 |
|------|------|----------|
| 单选 | `[单选题]` `[下拉框]` `[量表题]` `[评分单选]` `[情景题]` `[判断题]` | q_type=3 |
| 多选 | `[多选题]` `[评分多选]` `[排序题]` `[商品题]` | q_type=4 |
| 填空 | `[填空题]` `[简答题]` `[多级下拉题]` | q_type=5 |
| 多项填空 | `[多项填空题]` `[考试多项填空]` `[考试完形填空]` | q_type=6 |
| 矩阵 | `[矩阵题]` `[矩阵量表题]` `[矩阵单选题]` `[矩阵多选题]` `[矩阵填空题]` | q_type=7 |
| 文件 | `[文件上传]` `[绘图题]` | q_type=8 |
| 特殊 | `[比重题]` `[滑动条]` | q_type=9/10 |

方括号 `[]`、中括号 `【】`、圆括号 `()` `（）` 都可以识别。

> DSL 路径已弃用，这里只列旧标签的覆盖范围；新代码请用 `createSurveyByJson`。

### JSON 支持的题型（推荐，70+ 种）

`createSurveyByJson` 在 DSL 之外额外覆盖以下高级题型，**这是创建问卷的唯一推荐路径**：

| 类别 | qtype 值 |
|------|---------|
| 投票题（atype=3 时使用） | `投票单选`、`投票多选` |
| 表格题 | `表格数值`、`表格填空`、`表格下拉框`、`表格组合`、`自增表格` |
| 专业模型 | `净推荐值`（NPS）、`双因素分析`、`360 度评估`、`重要紧急矩阵` 等 |
| 媒体题 | `图片单选`、`图片多选`、`视频题` |
| 时间/位置 | `日期时间`、`地区题`、`签到题` |

完整 70+ 题型清单见 [references/question-types.md](../wjx-cli/wjx-skills/wjx-cli-use/references/question-types.md) 或 SDK 中的 `q_type` / `q_subtype` 映射。

---

## 本地分析引擎

6 个分析函数完全在本地运行，不需要网络，不需要 API Key。

### NPS 计算

```typescript
import { calculateNps } from "wjx-api-sdk";

const result = calculateNps([10, 9, 10, 8, 7, 6, 5, 4, 3, 2]);

console.log(result);
// {
//   score: -20,                          // NPS 得分 (-100 ~ 100)
//   rating: "较差",                       // 评级
//   total: 10,
//   promoters: { count: 3, ratio: 0.3 },  // 推荐者 (9-10分)
//   passives: { count: 2, ratio: 0.2 },   // 中立者 (7-8分)
//   detractors: { count: 5, ratio: 0.5 }, // 贬损者 (0-6分)
// }
```

评级标准：
| 分值 | 评级 | 含义 |
|------|------|------|
| > 70 | 优秀 | 强烈推荐 |
| 50-70 | 良好 | 倾向推荐 |
| 0-50 | 一般 | 有改进空间 |
| < 0 | 较差 | 需紧急改进 |

### CSAT 计算

```typescript
import { calculateCsat } from "wjx-api-sdk";

// 5 级量表（默认，满意 = 4 和 5）
const csat5 = calculateCsat([5, 4, 3, 5, 4]);
// { csat: 0.8, satisfiedCount: 4, total: 5, distribution: {"3":1,"4":2,"5":2} }

// 7 级量表（满意 = 5、6 和 7）
const csat7 = calculateCsat([6, 7, 5, 6, 7], "7-point");
// { csat: 1.0, satisfiedCount: 5, total: 5, distribution: {"5":1,"6":2,"7":2} }
```

### 异常检测

```typescript
import { detectAnomalies } from "wjx-api-sdk";

const result = detectAnomalies([
  { id: "r1", duration_seconds: 5, answers: [1, 1, 1, 1, 1], ip: "1.2.3.4" },
  { id: "r2", duration_seconds: 120, answers: [3, 2, 4, 1, 5], ip: "5.6.7.8" },
  { id: "r3", duration_seconds: 8, answers: [1, 1, 1, 1, 1], ip: "1.2.3.4" },
]);

// result: {
//   flagged: [
//     { responseId: "r1", reasons: ["straight-lining", "speed-anomaly"] },
//     { responseId: "r3", reasons: ["straight-lining", "speed-anomaly", "ip-content-duplicate"] },
//   ],
//   totalChecked: 3,
// }
```

三种检测策略：
- **秒答检测**：答题时间 < 中位时长的 30%
- **直线作答**：所有答案完全相同
- **重复检测**：相同 IP + 相似答案内容

### 答卷数据解码

```typescript
import { decodeResponses } from "wjx-api-sdk";

const decoded = decodeResponses("1$2}2$hello world}3$1|3|5");
// {
//   answers: [
//     { questionIndex: 1, type: "single", value: "2" },
//     { questionIndex: 2, type: "fill", value: "hello world" },
//     { questionIndex: 3, type: "multi", value: ["1", "3", "5"] },
//   ],
//   count: 3,
// }
```

问卷星的 submitdata 使用 `题号$答案}题号$答案` 格式，`decodeResponses` 将其转换为结构化对象。

### 指标对比

```typescript
import { compareMetrics } from "wjx-api-sdk";

const result = compareMetrics(
  { nps: 45, csat: 78, completion: 85 },  // A 组
  { nps: 52, csat: 72, completion: 90 },  // B 组
);

// result.comparisons: [
//   { metric: "nps", valueA: 45, valueB: 52, delta: 7, changeRate: 0.1556, significant: true },
//   { metric: "csat", valueA: 78, valueB: 72, delta: -6, changeRate: -0.0769, significant: false },
//   { metric: "completion", valueA: 85, valueB: 90, delta: 5, changeRate: 0.0588, significant: false },
// ]
```

差异超过 10% 标记为 `significant: true`。

---

## Webhook 推送解密

问卷星的 Webhook 推送使用 AES-128-CBC 加密。SDK 提供完整的解密和签名验证：

```typescript
import { decodePushPayload } from "wjx-api-sdk";

// Express 中间件示例
app.post("/webhook", (req, res) => {
  const { decrypted, signatureValid } = decodePushPayload(
    req.body.encrypt,                    // 加密数据
    process.env.WJX_API_KEY,             // API Key（用于派生 AES 密钥）
    req.headers["x-wjx-signature"],      // 可选：签名
    JSON.stringify(req.body),            // 可选：原始请求体
  );

  if (signatureValid) {
    // decrypted 是解密后的 JSON 对象
    console.log("新答卷:", decrypted);
    res.json({ success: true });
  } else {
    res.status(403).json({ error: "签名验证失败" });
  }
});
```

解密流程：
1. MD5(API Key) 取前 16 字节作为 AES 密钥
2. 密文前 16 字节为 IV
3. AES-128-CBC + PKCS7 解密
4. 可选：SHA1 签名验证（timing-safe 比较，防时序攻击）

---

## fetch 注入测试

SDK 的每个函数都接受可选的 `fetchImpl` 参数，让你无需任何 HTTP mocking 库就能编写测试：

```typescript
import { createSurvey, type FetchLike } from "wjx-api-sdk";

function mockFetch(responseBody: unknown, status = 200): FetchLike {
  let capturedUrl: string;
  let capturedInit: RequestInit;

  const fn = async (input: string | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedInit = init!;
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };

  // 附加捕获器
  (fn as any).captured = () => ({ url: capturedUrl, init: capturedInit });
  return fn as FetchLike;
}

// 测试
test("创建问卷发送正确请求", async () => {
  const fetch = mockFetch({ result: true, data: { vid: 999 } });

  const result = await createSurvey(
    { title: "测试问卷", type: 1, description: "", questions: "[]" },
    { apiKey: "test-key" },
    fetch,
  );

  assert.strictEqual(result.data.vid, 999);

  // 验证请求内容
  const { url, init } = (fetch as any).captured();
  assert(url.includes("/openapi/survey/create"));
  assert.strictEqual(init.method, "POST");
  const body = JSON.parse(init.body);
  assert.strictEqual(body.title, "测试问卷");
});
```

**623 个测试全部使用这种模式**，零网络调用，运行速度极快。

---

## 多租户架构

### 凭据提供者模式

`setCredentialProvider()` 配合 Node.js AsyncLocalStorage 实现请求级别的凭据隔离：

```typescript
import { AsyncLocalStorage } from "node:async_hooks";
import { setCredentialProvider, listSurveys } from "wjx-api-sdk";

const store = new AsyncLocalStorage<{ apiKey: string }>();

// 注册提供者
setCredentialProvider(() => {
  const ctx = store.getStore();
  return ctx ? { apiKey: ctx.apiKey } : undefined;
});

// HTTP 请求处理
app.get("/api/surveys", (req, res) => {
  const apiKey = req.headers["x-api-key"] as string;

  store.run({ apiKey }, async () => {
    // 自动使用当前请求的 API Key
    const surveys = await listSurveys({ page_index: 1 });
    res.json(surveys);
  });
});
```

每个请求在自己的 AsyncLocalStorage context 中运行，凭据互不干扰。这正是 wjx-mcp-server HTTP 模式的实现方式。

### 凭据优先级

1. 函数参数中直接传入的 `credentials`
2. `setCredentialProvider()` 注册的提供者
3. `process.env.WJX_API_KEY` 环境变量

提供者可以返回 `undefined` 来跳过，让系统 fallback 到环境变量。

---

## 自定义 API 端点

私有部署或测试环境可以覆盖 API 基础地址：

```bash
# 全局覆盖
export WJX_BASE_URL=https://your-private-instance.com

# 单个端点覆盖
export WJX_API_URL=https://custom-api.example.com/openapi
export WJX_CONTACTS_API_URL=https://custom-contacts.example.com
```

URL 解析优先级：显式端点环境变量 > BASE_URL + 路径 > 硬编码默认值

---

## API 核心机制

### 请求签名算法

所有 API 请求自动签名，无需手动处理：

```
1. 收集所有参数（包括 timestamp）
2. 按 key 字母排序
3. 拼接所有非空 value
4. 末尾追加 API Key
5. SHA1 哈希 → sign 参数
```

时间窗口 30 秒，SDK 自动生成 timestamp。

### 重试与超时

| 操作类型 | 重试次数 | 超时 | 说明 |
|----------|---------|------|------|
| 读取操作 | 最多 2 次 | 15s | 429/5xx 触发，指数退避 + 随机抖动 |
| 写入操作 | 0 次 | 15s | 防止重复创建/删除 |
| 批量下载 | 最多 2 次 | 120s | 大数据量场景 |
| 360 报告 | 最多 2 次 | 120s | 异步任务轮询 |

### TraceID

每个请求自动生成 UUID traceID（32 字符），附加在 URL 查询参数中。出现问题时可以提供 traceID 给问卷星技术支持快速定位。

---

## 底层 API 调用

如果需要调用 SDK 尚未封装的 API，可以直接使用底层调用器：

```typescript
import { callWjxApi, Action } from "wjx-api-sdk";

const result = await callWjxApi(
  // 第一个参数：请求参数（包含 action）
  { action: Action.GET_SURVEY, vid: 12345 },
  // 第二个参数：可选配置
  {
    credentials: { apiKey: "你的Key" },
    // fetchImpl: customFetch,  // 可选
    // maxRetries: 0,           // 可选
    // timeoutMs: 30000,        // 可选
  },
);
```

四个底层调用器对应不同的 API 端点：
- `callWjxApi()` — 主 API
- `callWjxContactsApi()` — 通讯录 API
- `callWjxUserSystemApi()` — 用户体系 API
- `callWjxSubuserApi()` — 子账号 API

---

## TypeScript 类型系统

所有输入输出都有完整的类型定义：

```typescript
import type {
  // 输入类型
  CreateSurveyInput,
  ListSurveysInput,
  QueryResponsesInput,

  // 输出类型
  WjxApiResponse,
  SurveyDetail,

  // 核心类型
  WjxCredentials,
  FetchLike,

  // DSL 类型
  ParsedSurvey,
  ParsedQuestion,
  WireQuestion,
  WireConversionResult,
} from "wjx-api-sdk";
```

---

## 下一步

- [SDK 入门指南](./sdk-getting-started.md) — 快速上手
- [MCP 进阶指南](./mcp-advanced.md) — MCP Server 深度用法
- [CLI 进阶指南](./cli-advanced.md) — 命令行高级技巧
- [总纲](./00-overview.md) — 全景概览
