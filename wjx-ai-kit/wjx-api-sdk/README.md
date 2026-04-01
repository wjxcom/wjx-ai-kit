# wjx-api-sdk

> 问卷星 OpenAPI TypeScript SDK — 零依赖、类型安全、ESM-only。

[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-green)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/wjx-api-sdk)](https://www.npmjs.com/package/wjx-api-sdk)

---

## 特性

- **零运行时依赖** — 仅使用 Node.js 内置 `fetch`，无需安装任何第三方包
- **完整类型定义** — 所有输入/输出均有 TypeScript 类型，IDE 自动补全
- **8 大模块、50+ 函数** — 覆盖问卷星 OpenAPI 全部功能
- **ESM-only** — 原生 ES Module，`import` 直接使用
- **可测试设计** — 所有函数支持注入 `credentials` 和 `fetchImpl`

---

## 安装

### 从 npm 安装（推荐）

```bash
npm install wjx-api-sdk
```

### 从源码安装（开发者）

```bash
git clone <your-repo-url>
cd wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
```

---

## 快速开始

```typescript
import { listSurveys, getSurvey, createSurvey } from "wjx-api-sdk";

const creds = { apiKey: process.env.WJX_API_KEY! };

// 列出问卷
const list = await listSurveys({ page_index: 1, page_size: 10 }, creds);
console.log(list);

// 获取问卷详情
const detail = await getSurvey({ vid: 12345 }, creds);

// 创建问卷
const created = await createSurvey({
  title: "客户满意度调查",
  type: 0,
  description: "2026年Q1客户满意度",
  questions: "[]",
}, creds);
```

---

## 认证

### 方式一：直接传入（推荐）

```typescript
const creds = { apiKey: "your_api_key" };
const result = await listSurveys({ page_index: 1 }, creds);
```

### 方式二：环境变量

设置 `WJX_API_KEY` 环境变量后，可省略 `credentials` 参数：

```bash
export WJX_API_KEY=your_api_key
```

```typescript
// 自动从 WJX_API_KEY 读取
const result = await listSurveys({ page_index: 1 });
```

### 方式三：自定义 Provider

```typescript
import { setCredentialProvider } from "wjx-api-sdk";

setCredentialProvider(() => ({
  apiKey: getTokenFromVault(),
}));

// 后续调用自动使用 provider
const result = await listSurveys({ page_index: 1 });
```

---

## API 参考

### 统一函数签名

所有 SDK 函数遵循统一的 3 参数模式：

```typescript
async function sdkFunction(
  input: InputType,                              // 请求参数
  credentials: WjxCredentials = getWjxCredentials(),  // 认证凭据
  fetchImpl: FetchLike = fetch,                  // 可选：注入 fetch 实现
): Promise<WjxApiResponse<T>>
```

### Core — 核心

| 函数 | 说明 |
|------|------|
| `callWjxApi(action, params, creds, opts?)` | 底层 API 调用（签名、重试、超时） |
| `callWjxUserSystemApi(...)` | 用户体系 API 调用 |
| `callWjxSubuserApi(...)` | 子账号 API 调用 |
| `callWjxContactsApi(...)` | 通讯录 API 调用 |
| `setCredentialProvider(fn)` | 设置全局凭据 Provider |
| `getWjxCredentials()` | 获取当前凭据 |
| `validateQuestionsJson(json)` | 验证题目 JSON 格式 |
| `getCorpId(creds)` | 获取企业 ID |

### Survey — 问卷管理（11 函数）

| 函数 | 说明 |
|------|------|
| `listSurveys(input)` | 列出问卷列表 |
| `getSurvey(input)` | 获取问卷详情 |
| `createSurvey(input)` | 创建问卷 |
| `updateSurveyStatus(input)` | 更新问卷状态（发布/暂停/删除） |
| `getSurveySettings(input)` | 获取问卷设置 |
| `updateSurveySettings(input)` | 更新问卷设置 |
| `deleteSurvey(input)` | 删除问卷 |
| `getQuestionTags(input)` | 获取题目标签 |
| `getTagDetails(input)` | 获取标签详情 |
| `clearRecycleBin(input)` | 清空回收站 |
| `uploadFile(input)` | 上传文件 |

### Survey — DSL 转换器

| 函数 | 说明 |
|------|------|
| `surveyToText(survey)` | 将问卷结构转为纯文本 DSL |
| `textToSurvey(text)` | 将纯文本 DSL 解析为 `ParsedSurvey` |
| `typeToLabel(type)` | 题型代码转可读标签 |
| `stripHtml(html)` | 去除 HTML 标签 |

### Response — 答卷数据（10 函数）

| 函数 | 说明 |
|------|------|
| `queryResponses(input)` | 查询答卷（分页） |
| `queryResponsesRealtime(input)` | 实时查询答卷 |
| `downloadResponses(input)` | 下载答卷数据 |
| `getReport(input)` | 获取统计报告 |
| `submitResponse(input)` | 代填提交答卷 |
| `getFileLinks(input)` | 获取文件链接 |
| `getWinners(input)` | 获取中奖者 |
| `modifyResponse(input)` | 修改答卷分数 |
| `get360Report(input)` | 获取 360 报告 |
| `clearResponses(input)` | 清空答卷 |

### Contacts — 通讯录（14 函数）

| 函数 | 说明 |
|------|------|
| `queryContacts(input)` | 查询联系人 |
| `addContacts(input)` | 添加联系人 |
| `deleteContacts(input)` | 删除联系人 |
| `addAdmin(input)` | 添加管理员 |
| `deleteAdmin(input)` | 删除管理员 |
| `restoreAdmin(input)` | 恢复管理员 |
| `listDepartments(input)` | 列出部门 |
| `addDepartment(input)` | 添加部门 |
| `modifyDepartment(input)` | 修改部门 |
| `deleteDepartment(input)` | 删除部门 |
| `listTags(input)` | 列出标签 |
| `addTag(input)` | 添加标签 |
| `modifyTag(input)` | 修改标签 |
| `deleteTag(input)` | 删除标签 |

### User System — 用户体系（6 函数）

| 函数 | 说明 |
|------|------|
| `addParticipants(input)` | 添加参与者 |
| `modifyParticipants(input)` | 修改参与者 |
| `deleteParticipants(input)` | 删除参与者 |
| `bindActivity(input)` | 绑定活动 |
| `querySurveyBinding(input)` | 查询问卷绑定 |
| `queryUserSurveys(input)` | 查询用户问卷 |

### Multi-User — 多用户管理（5 函数）

| 函数 | 说明 |
|------|------|
| `addSubAccount(input)` | 添加子账号 |
| `modifySubAccount(input)` | 修改子账号 |
| `deleteSubAccount(input)` | 删除子账号 |
| `restoreSubAccount(input)` | 恢复子账号 |
| `querySubAccounts(input)` | 查询子账号列表 |

### SSO — 免登录（5 函数）

| 函数 | 说明 |
|------|------|
| `buildSsoSubaccountUrl(input)` | 生成子账号 SSO 链接 |
| `buildSsoUserSystemUrl(input)` | 生成用户体系 SSO 链接 |
| `buildSsoPartnerUrl(input)` | 生成合作伙伴 SSO 链接 |
| `buildSurveyUrl(input)` | 生成问卷创建/编辑 URL |
| `buildPreviewUrl(input)` | 生成问卷预览 URL |

### Analytics — 本地分析（6 函数）

| 函数 | 说明 |
|------|------|
| `decodeResponses(responses, questions)` | 解码答卷原始数据为可读结构 |
| `calculateNps(responses)` | 计算 NPS 净推荐值 |
| `calculateCsat(responses)` | 计算 CSAT 客户满意度 |
| `detectAnomalies(responses)` | 检测异常答卷 |
| `compareMetrics(baseline, current)` | 指标对比分析 |
| `decodePushPayload(payload)` | 解码推送回调数据 |

---

## DSL 文本格式

SDK 提供问卷与纯文本之间的双向转换，方便 AI Agent 和脚本操作。

### surveyToText — 问卷转文本

```typescript
import { getSurvey, surveyToText } from "wjx-api-sdk";

const detail = await getSurvey({ vid: 12345 }, creds);
const text = surveyToText(detail.data);
console.log(text);
```

输出格式：

```
问卷标题: 客户满意度调查
===

Q1 [单选题] 您对我们的服务满意吗？
1. 非常满意
2. 满意
3. 一般
4. 不满意

Q2 [填空题] 请输入您的建议
```

### textToSurvey — 文本转问卷

```typescript
import { textToSurvey } from "wjx-api-sdk";

const parsed = textToSurvey(`
问卷标题: 员工满意度调查
===

Q1 [单选题] 您对工作环境满意吗？
1. 非常满意
2. 满意
3. 一般
`);

console.log(parsed.title);     // "员工满意度调查"
console.log(parsed.questions); // ParsedQuestion[]
```

---

## 环境变量

| 变量 | 必填 | 说明 |
|------|:----:|------|
| `WJX_API_KEY` | 是 | 问卷星 OpenAPI API Key |
| `WJX_CORP_ID` | 否 | 企业通讯录 ID（通讯录相关操作需要） |
| `WJX_BASE_URL` | 否 | 自定义 API 基础域名（默认 `https://www.wjx.cn`） |

---

## 开发

```bash
cd wjx-ai-kit/wjx-api-sdk

npm run build    # tsc 编译
npm test         # 运行全部测试（598 tests）
npm run clean    # 清理 dist/
```

测试使用 Node.js 内置测试运行器（`node:test`）。

---

## 许可证

[MIT](LICENSE)
