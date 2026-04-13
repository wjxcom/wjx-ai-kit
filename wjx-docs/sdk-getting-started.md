# SDK 入门指南：TypeScript 开发快速上手

> 零依赖、类型安全、60+ 函数，5 分钟集成问卷能力

---

## 什么是 wjx-api-sdk

wjx-api-sdk 是问卷星 OpenAPI 的 TypeScript SDK。它的特点是：

- **零运行时依赖**：只用 Node.js 内置 API（fetch + crypto），无第三方包
- **完整类型系统**：70+ TypeScript 类型定义，全程类型安全
- **60+ 函数**：8 个模块覆盖问卷星全部 API 能力
- **可测试设计**：fetch 注入 + 凭据提供者模式，623 个测试零网络调用

---

## 安装

```bash
npm install wjx-api-sdk
```

或从源码安装：

```bash
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
```

需要 Node.js >= 20（使用内置 fetch）。

---

## 认证配置

三种方式，按优先级排列：

### 1. 直接传参

```typescript
import { listSurveys } from "wjx-api-sdk";

const result = await listSurveys(
  { page_index: 1 },
  { apiKey: "你的API Key" }
);
```

### 2. 环境变量

```bash
export WJX_API_KEY=你的APIKey
```

```typescript
// 不传 credentials，自动从 process.env.WJX_API_KEY 读取
const result = await listSurveys({ page_index: 1 });
```

### 3. 凭据提供者（多租户场景）

```typescript
import { setCredentialProvider, listSurveys } from "wjx-api-sdk";

// 注册提供者，适合 AsyncLocalStorage 多租户架构
setCredentialProvider(() => ({
  apiKey: getCurrentTenantApiKey()
}));

const result = await listSurveys({ page_index: 1 });
```

优先级：直接传参 > 凭据提供者 > 环境变量

---

## 第一个 API 调用

```typescript
import { listSurveys, getSurvey, createSurveyByText } from "wjx-api-sdk";

// 列出问卷
const list = await listSurveys({ page_index: 1, page_size: 10 });
console.log(`共 ${list.data.total} 份问卷`);

// 获取问卷详情
const survey = await getSurvey({ vid: 12345 });
console.log(survey.data.aname); // 问卷标题

// 用 DSL 文本创建问卷
const created = await createSurveyByText({
  text: `客户满意度调查

1. 推荐意愿 [量表题]
0~10

2. 改进建议 [填空题]`,
});
console.log(`新问卷 ID: ${created.data.vid}`);
```

---

## 统一函数签名

所有 SDK 函数遵循相同的 3 参数模式：

```typescript
async function doSomething(
  input: DoSomethingInput,     // 业务参数（类型安全）
  credentials?: WjxCredentials, // 可选，默认从环境读取
  fetchImpl?: FetchLike,       // 可选，默认用内置 fetch
): Promise<WjxApiResponse<T>>
```

这意味着：
- 你永远知道函数长什么样
- 测试时注入 mock fetch，不需要任何 HTTP mocking 库
- 多租户时注入不同的 credentials

---

## 模块速查

### 问卷管理（13 函数）

```typescript
import {
  createSurvey,           // 创建问卷（JSON）
  createSurveyByText,     // 创建问卷（DSL 文本）
  getSurvey,              // 获取详情
  listSurveys,            // 列表查询
  updateSurveyStatus,     // 修改状态（发布/暂停/删除）
  getSurveySettings,      // 获取设置
  updateSurveySettings,   // 修改设置
  deleteSurvey,           // 删除问卷
  getQuestionTags,        // 获取标签
  getTagDetails,          // 标签详情
  clearRecycleBin,        // 清空回收站
  uploadFile,             // 上传文件
  validateQuestionsJson,  // 验证题目 JSON
} from "wjx-api-sdk";
```

### 答卷管理（9 函数）

```typescript
import {
  queryResponses,          // 分页查询
  queryResponsesRealtime,  // 实时查询
  downloadResponses,       // 批量下载
  getReport,               // 统计报告
  submitResponse,          // 代填提交
  getWinners,              // 抽奖中奖者
  modifyResponse,          // 修改答卷
  get360Report,            // 360 报告
  clearResponses,          // 清空答卷
} from "wjx-api-sdk";
```

### 通讯录管理（14 函数）

```typescript
import {
  queryContacts, addContacts, deleteContacts,     // 联系人
  addAdmin, deleteAdmin, restoreAdmin,            // 管理员
  listDepartments, addDepartment, modifyDepartment, deleteDepartment, // 部门
  listTags, addTag, modifyTag, deleteTag,         // 标签
} from "wjx-api-sdk";
```

### SSO 单点登录（5 函数）

```typescript
import {
  buildSsoSubaccountUrl,   // 子账号 SSO
  buildSsoUserSystemUrl,   // 用户体系 SSO
  buildSsoPartnerUrl,      // 合作伙伴 SSO
  buildSurveyUrl,          // 问卷创建/编辑 URL
  buildPreviewUrl,         // 问卷填写 URL
} from "wjx-api-sdk";
```

### 数据分析（6 函数，纯本地计算）

```typescript
import {
  decodeResponses,     // 解码答卷数据
  calculateNps,        // NPS 计算
  calculateCsat,       // CSAT 计算
  detectAnomalies,     // 异常检测
  compareMetrics,      // 指标对比
  decodePushPayload,   // Webhook 解密
} from "wjx-api-sdk";
```

### DSL 文本转换（6 函数）

```typescript
import {
  textToSurvey,            // 文本 → 问卷结构
  surveyToText,            // 问卷结构 → 文本
  parsedQuestionsToWire,   // 解析结构 → API 格式
  typeToLabel,             // 题型代码 → 中文标签
  LABEL_TO_TYPE,           // 27 个标签映射表
  TYPE_MAP,                // 24 个类型映射表
} from "wjx-api-sdk";
```

### 其他模块

```typescript
// 用户体系（6 函数）
import { addParticipants, modifyParticipants, deleteParticipants,
         bindActivity, querySurveyBinding, queryUserSurveys } from "wjx-api-sdk";

// 子账号（5 函数）
import { addSubAccount, modifySubAccount, deleteSubAccount,
         restoreSubAccount, querySubAccounts } from "wjx-api-sdk";
```

---

## 常用场景

### 查询并分析答卷

```typescript
import { queryResponses, decodeResponses, calculateNps } from "wjx-api-sdk";

// 查询全部答卷
const responses = await queryResponses({
  vid: 12345,
  page_size: 100,
});

// 解码每份答卷
const allScores: number[] = [];
for (const r of responses.data.list) {
  const decoded = decodeResponses(r.submitdata);
  // decoded.answers 是 DecodedAnswer[] 数组
  // 假设第 1 题是 NPS 题，找到对应答案
  const npsAnswer = decoded.answers.find((a) => a.questionIndex === 1);
  if (npsAnswer) {
    const npsScore = Number(npsAnswer.value);
    if (!isNaN(npsScore)) allScores.push(npsScore);
  }
}

// 计算 NPS
const nps = calculateNps(allScores);
console.log(`NPS: ${nps.score} (${nps.rating})`);
console.log(`推荐者: ${(nps.promoters.ratio * 100).toFixed(0)}%`);
console.log(`贬损者: ${(nps.detractors.ratio * 100).toFixed(0)}%`);
```

### 生成 SSO 链接

```typescript
import { buildSsoSubaccountUrl, buildPreviewUrl } from "wjx-api-sdk";

// 子账号免密登录
const ssoUrl = buildSsoSubaccountUrl({
  subuser: "sales01",
  apiKey: "你的API Key",
});
console.log(ssoUrl); // https://www.wjx.cn/...&sign=...

// 问卷填写链接
const previewUrl = buildPreviewUrl({
  vid: 12345,
  source: "crm",
});
console.log(previewUrl); // https://www.wjx.cn/vm/12345.aspx?source=crm
```

### 错误处理

```typescript
import { listSurveys } from "wjx-api-sdk";

try {
  const result = await listSurveys({ page_index: 1 });
  if (result.result === false) {
    // API 返回了业务错误
    console.error("业务错误:", result.error);
  } else {
    console.log("成功:", result.data);
  }
} catch (error) {
  // 网络错误、超时等
  console.error("请求失败:", error.message);
}
```

---

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|:----:|--------|------|
| `WJX_API_KEY` | 是 | - | 问卷星 API Key |
| `WJX_CORP_ID` | 否 | - | 企业通讯录 ID |
| `WJX_BASE_URL` | 否 | `https://www.wjx.cn` | API 基础地址 |

---

## 下一步

- [SDK 进阶指南](./sdk-advanced.md) — DSL 双向转换、本地分析引擎、测试模式、多租户
- [MCP 入门指南](./mcp-getting-started.md) — 用 AI 操作问卷星
- [CLI 入门指南](./cli-getting-started.md) — 命令行工具
- [总纲](./00-overview.md) — 全景概览
