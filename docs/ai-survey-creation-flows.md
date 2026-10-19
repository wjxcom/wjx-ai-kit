# 问卷星 AI 创建问卷流程对比文档

## 一、网页端 AI 创建问卷流程

### 1.1 入口文件
**文件位置**：`D:\workspace\VSrepos\Branch\tanhao\04Web\WebSiteNew\Handler\OpenAI\AICreate.aspx.cs`

### 1.2 核心流程

#### 步骤 1：请求接收与鉴权
```csharp
// Handler_OpenAI_AICreate.Page_Load()
- 检查用户登录状态（Util.IsAuthenticated()）
- 获取用户类型（个人版/企业版）
- 获取企业信息（企业版用户）
- 解析请求参数：action, taskType, model, content 等
```

#### 步骤 2：点数余额校验
```csharp
// 针对 AI 创建类操作进行余额检查
double pointsBalance = Util.GetUserAIPointsBalance(owner, company);
if (pointsBalance <= 0) {
    return "点数余额不足";
}
```

#### 步骤 3：AI 任务创建（两种模式）

##### 3.1 旧版生成问卷（action="createQ"）
```csharp
// OpenAiService.CreateQuestionnaire()
参数：
- title: 问卷标题
- purpose: 调研目的
- dimension: 调研维度
- qnum: 题目数量（默认15）
- activityType: 问卷类型

流程：
1. 标题合法性校验（长度 >= 5，非纯数字，非测试/demo）
2. 内容审核（易盾）
3. 创建 AICreateQuestionnaire 任务对象
4. 调用 CreateAITask() 将任务推入 Redis 队列
5. 返回 taskId 给前端
```

##### 3.2 新版生成问卷（action="createQNew"）
```csharp
// OpenAiService.CreateQNew()
参数：
- content: 用户输入内容
- fileCount: 上传文件数量
- qVersion: 问卷版本（默认2）
- isAIIdentify: 是否为 AI 识别模式
- newActivityType: 新问卷类型

流程：
1. 内容审核（易盾）
2. 创建 AICreateQuestionnaire 任务对象
3. 调用 CreateAITask() 将任务推入 Redis 队列
4. 返回 taskId 给前端
```

#### 步骤 4：任务队列处理
```csharp
// OpenAiService.CreateAITask()
1. 确定队列名称：aitask_{AIType}_{TaskType}
2. 将任务序列化后存入 Redis 队列
3. 设置任务结果 key（aitaskid_{taskId}）初始值为 "-1"
```

#### 步骤 5：AI 生成题目（后台异步）
```
后台 AI Worker 从 Redis 队列取出任务
→ 调用 OpenAI/Azure API 生成题目
→ 生成 JSONL 格式数据（类似 wjx-cli 的 JSONL）
→ 写入 Redis 结果集
```

#### 步骤 6：前端轮询获取结果
```csharp
// action="getResult"
// OpenAiService.GetResultData()
1. 根据 taskId 查询 Redis 结果
2. 返回生成的 JSONL 数据
3. 前端解析并展示题目预览
```

#### 步骤 7：用户确认后保存问卷
```
前端收到 JSONL 数据后：
→ 用户预览、编辑题目
→ 点击"保存"按钮
→ 调用传统问卷保存接口（可能是 NewBySurveyData 或编辑器保存接口）
→ 生成 XML 并存储
→ 创建 WjxActivity 记录
→ 返回 vid（问卷 ID）
```

---

## 二、OpenAPI 创建问卷流程

### 2.1 入口
**SDK 函数**：`wjx-api-sdk/src/modules/survey/client.ts` 中的 `createSurveyByJson()`

### 2.2 核心流程

#### 步骤 1：客户端输入校验
```typescript
// createSurveyByJson()
1. 类型检查：jsonl 必须为字符串
2. 参数检查：title, publish, atype, optionalTitles, creater
3. JSONL 规范化：normalizeJsonl() 统一换行符
4. 大小限制：MAX_JSONL_SIZE（4MB）
```

#### 步骤 2：JSONL 预检与预处理
```typescript
// 按顺序执行以下步骤：
1. preflightJsonl(jsonl)
   - 拦截英文/拼错的 qtype
   - 给出中文修复建议

2. parseJsonl(jsonl)
   - 严格拒绝无法解析的行
   - 防止坏数据进入服务端

3. canonicalizeJsonlQtypes(jsonl)
   - 标准化题型名称

4. preprocessExamJsonl(canonicalJsonl)
   - 为考试题注入 isquiz="1"
   - 推断 atype=6（考试）

5. validateExplicitOptionalQuestionsInJsonl()
   - 校验明确指定的可选题

6. injectDefaultRequir(examProcessed)
   - 默认必答：为题目注入 requir=true

7. extractJsonlMetadata(requirInjected)
   - 提取元数据：title, description, atype

8. validateSurveyTitle(title)
   - 标题合理性校验
   - 拦截空/占位符/过短/黑名单标题

9. validateSurveyHasQuestions(requirInjected)
   - 至少包含 1 道真实题目

10. inferAtypeFromTitle(title)
    - 从标题关键字推断 atype

11. injectAtypeIntoJsonl(requirInjected, atype)
    - 关键修复：将最终 atype 注入「问卷基础信息」行
    - 服务端 action 1000106 只读 JSONL 内的 atype
```

#### 步骤 3：API 调用
```typescript
// callWjxApi()
参数：
- action: 1000106 (CREATE_SURVEY_BY_JSON)
- title: 问卷标题
- atype: 问卷类型
- desc: 描述
- surveydatajson: 处理后的 JSONL
- publish: 是否立即发布
- creater: 创建者（可选）

配置：
- maxRetries: 0（不重试）
- idempotency: "unsafe"
- httpRetryable: false
- timeoutMs: LONG_TIMEOUT_MS
```

#### 步骤 4：服务端处理（action 1000106）
```
服务端接收请求：
→ 解析 JSONL 格式数据
→ 转换为内部题目结构
→ 生成 XML 文档
→ 压缩并存储到文件系统
→ 创建 WjxActivity 记录
→ 根据 publish 参数决定是否发布
→ 返回 vid 和相关 URL
```

#### 步骤 5：响应返回
```typescript
// WjxApiResponse<T>
{
  success: true/false,
  data: {
    vid: "问卷ID",
    pc_path: "填写链接",
    iframe_url: "编辑链接",
    // ... 其他字段
  },
  error: null
}
```

---

## 三、关键差异对比

| 维度 | 网页端 AI 创建 | OpenAPI 创建 |
|------|---------------|-------------|
| **触发方式** | 用户在网页点击 AI 生成 | SDK 调用 `createSurveyByJson()` |
| **输入格式** | 自然语言描述（目的、维度） | 结构化 JSONL 格式 |
| **AI 参与** | ✅ 调用 OpenAI/Azure 生成题目 | ❌ 无 AI，直接解析 JSONL |
| **异步处理** | ✅ 任务队列 + 轮询 | ❌ 同步请求 |
| **预检严格度** | 较宽松（标题长度、黑名单） | 严格（preflightJsonl、parseJsonl） |
| **题型校验** | 服务端校验 | 客户端预检 + 服务端校验 |
| **atype 注入** | 不需要（surveydata 格式自带） | ✅ 关键修复：injectAtypeIntoJsonl() |
| **必答默认** | 服务端逻辑 | 客户端 injectDefaultRequir() |
| **发布控制** | 用户手动决定 | API 参数 `publish` 控制 |
| **重试机制** | 支持（任务队列可重试） | 不支持（maxRetries=0） |
| **点数扣费** | 创建任务时扣除 | 服务端扣费（推测） |
| **目标接口** | 最终也是类似 1000106 的服务端接口 | 直接调用 action 1000106 |

---

## 四、核心组件对应关系

### 4.1 网页端关键文件
```
AICreate.aspx.cs              # 入口 Handler
  ↓
OpenAiService.cs              # AI 任务创建
  ↓
ActivityCreate.NewBySurveyData()  # 问卷持久化
  ↓
WjxActivityControl.XmlToString()  # 生成 XML
```

### 4.2 OpenAPI 关键文件
```
wjx-api-sdk/src/modules/survey/client.ts
  ↓ createSurveyByJson()
  ↓
wjx-api-sdk/src/modules/survey/json-to-survey.ts
  ↓ preflightJsonl(), parseJsonl(), injectAtypeIntoJsonl()
  ↓
wjx-api-sdk/src/core/api-client.ts
  ↓ callWjxApi()
  ↓
服务端 action 1000106
```


---

## 五、总结

### 网页端 AI 创建问卷的本质
1. **前置 AI 生成阶段**：用户输入自然语言 → AI 生成 JSONL → 前端展示
2. **后置保存阶段**：用户确认 JSONL → 调用传统保存接口 → 生成 XML → 创建问卷

### OpenAPI 创建问卷的本质
1. **跳过 AI 生成**：客户端直接提供 JSONL（可以是自己调用 AI 生成的）
2. **SDK 层严格预检**：客户端完成题型校验、atype 注入、必答标记
3. **服务端快速落库**：action 1000106 直接解析 JSONL → XML → 创建问卷

**两者殊途同归**：
- 最终都是 JSONL → XML → WjxActivity
- OpenAPI 可看作"网页端 AI 创建的简化版"，去掉了 AI Worker 和异步轮询
- CLI 通过 `createSurveyByJson()` 调用 OpenAPI，本质上是直接对接服务端 action 1000106
