# Phase 1 实施计划（v2）：答卷数据 + 问卷增强 + MCP 三原语

> 基于问卷星 OpenAPI **完整接口清单**（47 个 API）重新规划
> 前版计划中"无答卷拉取 API"的判断有误，现已修正

---

## 0. 问卷星 OpenAPI 完整接口清单

### 问卷 [1000] — 10 个接口

| # | 接口名 | Action Code | 读/写 | 当前状态 |
|---|--------|-------------|-------|---------|
| 2.1.1 | 获取问卷内容 | `1000001` | 读 | ✅ 已实现 |
| 2.1.2 | 获取问卷列表 | `1000002` | 读 | ✅ 已实现 |
| 2.1.3 | 获取问卷设置 | `1000003` | 读 | ❌ 待实现 |
| 2.1.4 | 获取用户题目标签 | `1000004` | 读 | ❌ 待实现 |
| 2.1.5 | 获取题目标签详情 | `1000005` | 读 | ❌ 待实现 |
| 2.1.6 | 创建问卷 | `1000101` | 写 | ✅ 已实现 |
| 2.1.7 | 修改问卷状态 | `1000102` | 写 | ✅ 已实现 |
| 2.1.8 | 修改设置问卷 | `1000103` | 写 | ❌ 待实现 |
| 2.1.9 | 删除问卷 | `1000301` | 写（危险） | ❌ 待实现 |
| 2.1.10 | 清空回收站 | `1000302` | 写（危险） | ❌ 待实现 |

### 答卷 [1001] — 10 个接口

| # | 接口名 | Action Code | 读/写 | 当前状态 |
|---|--------|-------------|-------|---------|
| 2.2.1 | 答卷提交 | `1001001` | 写 | ❌ 待实现 |
| 2.2.2 | 答卷查询 | `1001002` | 读 | ❌ **Phase 1 核心** |
| 2.2.3 | 答卷实时查询 | `1001003` | 读 | ❌ **Phase 1 核心** |
| 2.2.4 | 答卷下载 | `1001004` | 读 | ❌ **Phase 1 核心** |
| 2.2.5 | 获取文件链接 | `1001005` | 读 | ❌ 待实现 |
| 2.2.6 | 获取中奖者信息 | `1001006` | 读 | ❌ 低优先级 |
| 2.2.7 | 修改答卷 | `1001007` | 写 | ❌ 待实现 |
| 2.2.8 | 默认报告查询 | `1001101` | 读 | ❌ **Phase 1 核心** |
| 2.2.9 | 360度评估报告下载 | `1001102` | 读 | ❌ 低优先级 |
| 2.2.10 | 清空答卷数据 | `1001201` | 写（危险） | ❌ 待实现 |

### 用户体系 [1002] — 6 个接口

| # | 接口名 | Action Code | 读/写 |
|---|--------|-------------|-------|
| 2.3.1 | 添加参与者 | `1002001` | 写 |
| 2.3.2 | 修改参与者 | `1002002` | 写 |
| 2.3.3 | 删除参与者 | `1002003` | 写（危险） |
| 2.3.4 | 绑定问卷 | `1002004` | 写 |
| 2.3.5 | 查询问卷绑定 | `1002005` | 读 |
| 2.3.6 | 查询用户分配的问卷 | `1002006` | 读 |

### 多用户管理 [1003] — 5 个接口

| # | 接口名 | Action Code | 读/写 |
|---|--------|-------------|-------|
| 2.4.1 | 添加子账户 | `1003001` | 写 |
| 2.4.2 | 修改子账户 | `1003002` | 写 |
| 2.4.3 | 删除子账户 | `1003003` | 写（危险） |
| 2.4.4 | 恢复子账户 | `1003004` | 写 |
| 2.4.5 | 查询子账户 | `1003005` | 读 |

### 红包奖品 [1004] — 1 个接口

| # | 接口名 | Action Code | 读/写 |
|---|--------|-------------|-------|
| 2.5.1 | 获取中奖者信息 | `1004001` | 读 |

### 通讯录 [1005] — 14 个接口

| # | 接口名 | Action Code | 读/写 |
|---|--------|-------------|-------|
| 2.6.1 | 查询成员 | `1005001` | 读 |
| 2.6.2 | 添加或更新成员 | `1005002` | 写 |
| 2.6.3 | 删除成员 | `1005003` | 写（危险） |
| 2.6.4 | 添加或修改管理员 | `1005004` | 写 |
| 2.6.5 | 删除管理员 | `1005005` | 写（危险） |
| 2.6.6 | 恢复管理员 | `1005006` | 写 |
| 2.6.7 | 部门列表 | `1005101` | 读 |
| 2.6.8 | 添加部门 | `1005102` | 写 |
| 2.6.9 | 修改部门 | `1005103` | 写 |
| 2.6.10 | 删除部门 | `1005104` | 写（危险） |
| 2.6.11 | 标签列表 | `1005201` | 读 |
| 2.6.12 | 添加标签 | `1005202` | 写 |
| 2.6.13 | 修改标签 | `1005203` | 写 |
| 2.6.14 | 删除标签 | `1005204` | 写（危险） |

### 其他

| 接口名 | 说明 |
|--------|------|
| 获取问卷短链接 | 生成短链接 |

**总计：47 个 API 端点**（已实现 4 个，覆盖率 8.5%）

---

## 1. Phase 1 目标

**将 MCP Server 从 4 个 tool 扩展至 15 个 tool，覆盖问卷全生命周期 + 答卷数据回收 + 统计报告。**

同时引入 MCP Resources 和 Prompts 两大原语，在 MCP 三原语覆盖度上超越所有竞品。

### 选取原则

1. **答卷数据优先**：答卷查询/实时查询/下载/报告是 AI Agent 最高频使用场景
2. **问卷管理补全**：设置读写、删除、克隆等补齐问卷生命周期
3. **参数挖满**：现有 4 个 tool 只用了 OpenAPI 的部分参数，全部补全
4. **安全第一**：危险操作（删除、清空）加入确认机制和明确标注

---

## 2. Phase 1 新增 Tool 清单（11 个新 Tool）

### 2.1 答卷数据类（4 个）— 最高优先级

| Tool 名 | Action | 功能 | 读/写 | 优先级 |
|---------|--------|------|-------|--------|
| `query_responses` | `1001002` | 答卷查询（分页、筛选、时间范围） | 读 | **P0** |
| `query_responses_realtime` | `1001003` | 答卷实时查询（增量拉取，适合轮询） | 读 | **P0** |
| `download_responses` | `1001004` | 答卷下载（批量导出） | 读 | **P0** |
| `get_report` | `1001101` | 默认报告查询（统计概要） | 读 | **P0** |

### 2.2 问卷管理增强（5 个）

| Tool 名 | Action | 功能 | 读/写 | 优先级 |
|---------|--------|------|-------|--------|
| `get_survey_settings` | `1000003` | 获取问卷设置 | 读 | **P0** |
| `update_survey_settings` | `1000103` | 修改问卷设置 | 写 | **P1** |
| `clone_survey` | `1000101` | 复制问卷（利用 source_vid 参数） | 写 | **P1** |
| `delete_survey` | `1000301` | 永久删除问卷 | 写（危险） | **P1** |
| `submit_response` | `1001001` | 代填/导入答卷数据 | 写 | **P1** |

### 2.3 标签与文件（2 个）

| Tool 名 | Action | 功能 | 读/写 | 优先级 |
|---------|--------|------|-------|--------|
| `get_question_tags` | `1000004` | 获取用户题目标签列表 | 读 | **P2** |
| `get_file_links` | `1001005` | 获取答卷中的文件链接 | 读 | **P2** |

### 2.4 现有 Tool 增强（4 个 Tool 参数补全）

| Tool | 新增参数 | 说明 |
|------|---------|------|
| `get_survey` | `get_exts`, `get_setting`, `get_page_cut`, `get_tags`, `get_simple_return`, `get_json`, `showtitle` | 从 3 参数 → 10 参数 |
| `list_surveys` | `creater`, `query_all`, `folder`, `is_xingbiao`, `verify_status`, `time_type`, `begin_time`, `end_time` | 从 6 参数 → 14 参数 |
| `create_survey` | `creater`, `source_vid`, `compress_img`, `is_string` | 从 5 参数 → 9 参数 |
| `update_survey_status` | 无新增 | 保持不变 |

---

## 3. MCP Resources（3 个）

| Resource URI | 描述 | 内容来源 |
|-------------|------|---------|
| `wjx://reference/survey-types` | 问卷类型列表（调查/测评/投票/考试/表单/360/教学评估等 11 种） | 静态常量 |
| `wjx://reference/question-types` | 题目类型 + 细分类型完整列表（10 主类 + 33 细分） | 静态常量 |
| `wjx://reference/survey-statuses` | 问卷状态 + 审核状态编码说明 | 静态常量 |

**实现方式**：在 capabilities 中启用 `resources: {}`，注册 `server.resource()`。

---

## 4. MCP Prompts（3 个）

| Prompt 名 | 用途 | 参数 |
|-----------|------|------|
| `design-survey` | 引导 AI 设计问卷结构 | `topic`, `target_audience`, `survey_type` |
| `analyze-results` | 引导 AI 获取并分析问卷数据 | `survey_id`, `focus_areas` |
| `create-nps-survey` | 一键创建标准 NPS 问卷 | `product_name`, `language` |

**实现方式**：在 capabilities 中启用 `prompts: {}`，注册 `server.prompt()`。

---

## 5. 代码变更清单

### 5.1 `src/wjx-client.ts` — 核心变更

```
新增 Action Code 常量：
  GET_SETTINGS    = "1000003"
  GET_TAGS        = "1000004"
  CREATE_SURVEY   = "1000101"  // 已有，增加 source_vid 参数
  UPDATE_SETTINGS = "1000103"
  DELETE_SURVEY   = "1000301"
  SUBMIT_RESPONSE = "1001001"
  QUERY_RESPONSES = "1001002"
  QUERY_RESPONSES_REALTIME = "1001003"
  DOWNLOAD_RESPONSES = "1001004"
  GET_FILE_LINKS  = "1001005"
  GET_REPORT      = "1001101"

新增函数（11 个）：
  queryResponses(input)          — 答卷查询
  queryResponsesRealtime(input)  — 答卷实时查询
  downloadResponses(input)       — 答卷下载
  getReport(input)               — 默认报告查询
  getSurveySettings(input)       — 获取问卷设置
  updateSurveySettings(input)    — 修改问卷设置
  cloneSurvey(input)             — 复制问卷
  deleteSurvey(input)            — 删除问卷
  submitResponse(input)          — 答卷提交
  getQuestionTags(input)         — 获取题目标签
  getFileLinks(input)            — 获取文件链接

修改函数（3 个）：
  getSurvey()     — 增加 7 个可选参数
  listSurveys()   — 增加 8 个可选参数
  createSurvey()  — 增加 4 个可选参数（含 source_vid）
```

### 5.2 `src/index.ts` — Tool 注册

```
修改：
  get_survey         — schema 补全 7 个参数
  list_surveys       — schema 补全 8 个参数
  create_survey      — schema 补全 4 个参数

新增 Tool 注册（11 个）：
  query_responses         — P0
  query_responses_realtime — P0
  download_responses      — P0
  get_report              — P0
  get_survey_settings     — P0
  update_survey_settings  — P1
  clone_survey            — P1
  delete_survey           — P1（destructiveHint: true）
  submit_response         — P1
  get_question_tags       — P2
  get_file_links          — P2

capabilities 变更：
  { tools: {}, resources: {}, prompts: {} }

新增 Resource 注册（3 个）
新增 Prompt 注册（3 个）
```

### 5.3 新增 `src/resources.ts`

```
导出：
  SURVEY_TYPES       — 11 种问卷类型常量
  QUESTION_TYPES     — 10+33 种题目类型常量
  SURVEY_STATUSES    — 问卷状态编码常量
  registerResources(server) — 注册函数
```

### 5.4 新增 `src/prompts.ts`

```
导出：
  registerPrompts(server) — 注册 3 个 Prompt 模板
```

### 5.5 测试文件

```
修改：
  __tests__/wjx-client.test.mjs
    — getSurvey 新参数测试
    — listSurveys 新参数测试
    — createSurvey 新参数测试
    — 新增 11 个函数的单元测试（每个 ~5 用例）

新增：
  __tests__/resources.test.mjs    — Resource 内容和注册测试
  __tests__/prompts.test.mjs      — Prompt 模板和注册测试

修改：
  tests/wjx-mcp-server.test.mjs  — 验证 15 个 tool + 3 resource + 3 prompt
```

---

## 6. 实施步骤与顺序

```
Step 1: 答卷数据核心 — queryResponses + queryResponsesRealtime    [1.5 天]
  ├── wjx-client.ts: 新增 queryResponses() / queryResponsesRealtime()
  ├── index.ts: 注册 query_responses / query_responses_realtime tool
  ├── 单元测试: 请求参数、签名、分页、筛选、响应解析
  └── 集成测试: MCP stdio 验证

Step 2: 答卷下载 + 报告 — downloadResponses + getReport           [1 天]
  ├── wjx-client.ts: 新增 downloadResponses() / getReport()
  ├── index.ts: 注册 download_responses / get_report tool
  └── 单元测试覆盖

Step 3: 问卷管理增强 — settings + clone + delete                  [1 天]
  ├── wjx-client.ts: 新增 getSurveySettings() / updateSurveySettings()
  │   / cloneSurvey() / deleteSurvey()
  ├── index.ts: 注册 4 个 tool
  └── 单元测试覆盖

Step 4: 现有 Tool 参数补全                                        [0.5 天]
  ├── getSurvey +7 参数
  ├── listSurveys +8 参数
  ├── createSurvey +4 参数
  └── 单元测试补充

Step 5: 答卷提交 + 标签 + 文件链接                                [0.5 天]
  ├── wjx-client.ts: submitResponse() / getQuestionTags() / getFileLinks()
  ├── index.ts: 注册 3 个 tool
  └── 单元测试覆盖

Step 6: MCP Resources + Prompts                                   [1 天]
  ├── src/resources.ts: 常量 + 注册函数
  ├── src/prompts.ts: 模板 + 注册函数
  ├── index.ts: capabilities 升级 + 注册调用
  └── 单元测试

Step 7: 集成测试 + 文档                                           [1 天]
  ├── tests/wjx-mcp-server.test.mjs: 全量验证
  ├── README.md: 更新工具列表、使用示例
  ├── docs/wjx-openapi-spec.md: 补全新接口文档
  └── 全量 npm test 通过
```

**总工期：约 6.5 天**

---

## 7. 交付物检查清单

| 交付项 | Phase 0 | Phase 1 完成后 | 增量 |
|--------|---------|---------------|------|
| **MCP Tools** | 4 | **15** | +11 |
| **MCP Resources** | 0 | **3** | +3 |
| **MCP Prompts** | 0 | **3** | +3 |
| **API 覆盖率** | 4/47 (8.5%) | **15/47 (32%)** | +11 |
| **参数完整度** | ~40% | **~90%** | 大幅提升 |
| **源文件** | 3 | **5** | +2 (resources.ts, prompts.ts) |
| **测试用例** | ~70 | **~140** | +70 |

---

## 8. 与竞品对比（Phase 1 完成后）

| 能力 | 问卷星 MCP Phase 0 | Phase 1 | 金数据 | JotForm |
|------|-------------------|---------|--------|---------|
| 问卷 CRUD | 4 tool | **8 tool** | 4 tool | 6 tool |
| 答卷数据 | ❌ | **✅ 4 tool** | 5 tool | 4 tool |
| 统计报告 | ❌ | **✅ 1 tool** | ❌ | 1 tool |
| 问卷设置 | ❌ | **✅ 2 tool** | ❌ | ❌ |
| 参数完整度 | ~40% | **~90%** | ~70% | ~80% |
| MCP Resources | ❌ | **✅ 3 个** | ❌ | ❌ |
| MCP Prompts | ❌ | **✅ 3 个** | ❌ | ❌ |
| **总 Tool 数** | **4** | **15** | **9** | **20+** |

**Phase 1 核心优势**：
1. 超越金数据（15 vs 9 tools）
2. MCP 三原语全覆盖（全球竞品均为 Tools only）
3. 答卷数据回收完整（查询 + 实时查询 + 下载 + 报告）
4. 参数覆盖率行业领先（~90%）

---

## 9. 关键技术决策

### 9.1 答卷查询 vs 答卷实时查询的区别

| 维度 | `query_responses` (1001002) | `query_responses_realtime` (1001003) |
|------|---------------------------|--------------------------------------|
| 适用场景 | 历史数据批量查询 | 增量轮询（新数据） |
| 数据延迟 | 可能有缓存 | 实时无缓存 |
| 分页方式 | page_index + page_size | 基于 datastart 游标 |
| AI Agent 用法 | "帮我查询最近一周的答卷" | "有没有新的答卷提交？" |
| 重试策略 | maxRetries: 2 | maxRetries: 2 |

### 9.2 clone_survey 实现方式

利用 `create_survey`（Action 1000101）的 `source_vid` 参数：
```typescript
async function cloneSurvey(input: { source_vid: number; title?: string; publish?: boolean }) {
  // 调用 createSurvey，传入 source_vid
  // 文档说明：填写 source_vid 后，atype/desc/questions 无需传入
  return callWjxApi({ action: "1000101", source_vid: input.source_vid, ... });
}
```

### 9.3 危险操作保护

| Tool | 危险等级 | 保护措施 |
|------|---------|---------|
| `delete_survey` (1000301) | 高 | `destructiveHint: true`, `idempotentHint: false` |
| `update_survey_status` (state=3) | 中 | 已有，`destructiveHint: true` |
| `submit_response` (1001001) | 低 | `destructiveHint: false`, 写操作不重试 |
| `update_survey_settings` (1000103) | 低 | `destructiveHint: false`, 写操作不重试 |

### 9.4 函数签名一致性

所有新函数遵循现有模式：
```typescript
export async function queryResponses(
  input: QueryResponsesInput,
  credentials?: WjxCredentials,
  fetchImpl?: FetchLike,
  timestamp?: string,
): Promise<WjxApiResponse<QueryResponsesData>> {
  // ...
}
```
- credentials/fetchImpl/timestamp 可选参数保留，用于测试注入
- 读操作 maxRetries: 2，写操作 maxRetries: 0

---

## 10. 后续 Phase 参考（不在本次范围）

| Phase | 内容 | 新增 API 覆盖 |
|-------|------|-------------|
| Phase 2 | 用户体系 + 多用户管理 | 1002xxx + 1003xxx (11 个) |
| Phase 3 | 通讯录管理 | 1005xxx (14 个) |
| Phase 4 | AI 原生分析（NPS/CSAT/情感） | 基于答卷数据的计算层 |
| Phase 5 | Remote MCP (SSE/HTTP) + OAuth 2.0 | 传输层升级 |

---

## 11. 首个 API 文档需求

**在开始编码前，需要确认以下 4 个关键接口的具体请求/响应参数**：

1. **答卷查询 [1001002]** — 请求参数（vid/分页/时间筛选）、响应参数（答卷列表结构）
2. **答卷实时查询 [1001003]** — 请求参数（vid/datastart 游标）、响应参数
3. **答卷下载 [1001004]** — 请求参数（vid/格式）、响应格式（JSON/文件流？）
4. **默认报告查询 [1001101]** — 请求参数（vid）、响应参数（统计数据结构）

> 建议：请提供这 4 个接口的 OpenAPI 文档页面内容，或我可以通过实际 API 调用探测参数结构。
