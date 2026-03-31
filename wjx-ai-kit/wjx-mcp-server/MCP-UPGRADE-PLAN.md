# WJX MCP Server 升级执行计划 v4.0

> 基于腾讯问卷竞品分析 + 问卷星 WjxNew AI 能力全景 + 双声道 CEO 审查
> 日期：2026-03-30
> 当前版本：wjx-mcp-server 0.1.0（**56 tools**, 7 resources, 10 prompts）
> 目标：让 AI Agent 能完成「需求 → 问卷草稿 → 发布 → 收集 → 分析」完整工作流

---

## 核心判断（v4.0 修正）

问卷星的 AI 创建能力（70+ 题型、9+ 模型、流式输出、文本 DSL 解析）远超腾讯问卷。**但这些能力都锁在产品 UI 里，MCP 层不可用。**

腾讯问卷的 4 个 MCP 工具虽然少，但 DSL 文本创建 + 单题更新的组合让 AI Agent 可以直接操作问卷，体验极好。

**v4.0 修正：**
- ~~目标：暴露 76 个工具~~ → **目标：让 AI Agent 能「读问卷 + 写问卷」，打通核心 workflow**
- Phase 1 CRUD 工具（6 user-system + 11 contacts 扩展）**已在 v2.1.0/v2.2.0 全部实现**，不再作为新增工作
- 成功指标从「工具数」改为「workflow 完成率」

---

## 基线修正（Autoplan CEO Review 发现）

| 项目 | 计划 v3.0 声称 | 实际代码状态 |
|------|--------------|-------------|
| 当前工具数 | 54 | **56**（v2.2.0 CHANGELOG 确认） |
| User System 模块 | "需创建 src/modules/user-system/" | **已存在**（6 个工具，标记为 [已过时]） |
| Contacts 扩展 | "新增 11 个工具" | **已存在**（v2.1.0 添加，共 14 个工具） |
| Phase 1 新增工具数 | +17 个 | **+0 个**（全部已实现） |
| 实际新增需求 | — | surveyToText() + DSL 资源 + 2 prompt + 分发 |

---

## 实际需要做的工作

### Phase 1：DSL 可读性（MCP 层，无需后端）— v2.3.0

预计工作量：CC ~2h

| 任务 | 说明 | 新增工具数 |
|------|------|-----------|
| `surveyToText()` | 在 survey/client.ts 实现结构化问卷 → DSL 文本转换 | 0（增强 get_survey） |
| DSL 语法参考资源 | `wjx://reference/dsl-syntax` 完整语法文档 | 0（+1 resource） |
| 快速创建/编辑 URL 资源 | `wjx://reference/quick-create-edit` URL 模板 | 0（+1 resource） |
| 短链接工具 | `get_short_link` 调用 shortlink.aspx | +1 |
| anomaly_detection 提示 | 异常答卷检测提示模板 | 0（+1 prompt） |
| user_system_workflow 提示 | 用户体系完整工作流指导 | 0（+1 prompt） |

**v2.3.0 交付物：** 57 tools, 9 resources, 12 prompts
**核心价值：** AI Agent 能「阅读」问卷内容（DSL text 返回），有完整的 DSL 语法参考

#### surveyToText() 实现方案

在 `src/modules/survey/client.ts` 中实现，将 `pages → questions → options` 递归转为 DSL 文本。无需后端改动。

```typescript
function surveyToText(survey: SurveyDetail): string {
  let text = survey.title + '\n\n';
  let qIndex = 1;
  for (const page of survey.pages) {
    for (const question of page.questions) {
      text += `${qIndex}. ${question.title}[${typeToLabel(question.type)}]\n`;
      for (const option of question.options || []) {
        text += `${option.text}\n`;
      }
      text += '\n';
      qIndex++;
    }
    text += '=== 分页 ===\n\n';
  }
  return text.trim();
}
```

**DSL 保真度说明：** DSL 文本是问卷的「可读摘要」，不是完整序列化。分支逻辑、验证规则、评分、随机化等高级设置不在 DSL 中表示，需通过 `get_survey` 的结构化 JSON 获取。这与腾讯问卷的 DSL 实现一致。

#### DSL 语法规范（与 TxtToActivityService.cs 对齐）

```
问卷标题

引导语（可选，不带序号的段落）

1. 题目标题[题型标记]
选项A
选项B

=== 分页 ===
```

支持的题型标记：`[单选题]`(可省略) / `[多选题]` / `[量表题]` / `[反向量表题]` / `[矩阵题]` / `[矩阵单选题]` / `[矩阵量表题]` / `[排序题]` / `[比重题]` / `[表格题]` / `[简答题]` / `[填空题]` / `[问答题]` / `[段落说明]` / `[分页栏]` / `[判断题]`

括号兼容：`[]` / `【】` / `()` / `（）`

---

### Phase 2：DSL 文本创建（需后端 1 个新端点）— v2.4.0

预计工作量：后端 ~2天 / CC ~2h MCP层
**状态：⚠️ 依赖后端，未获得承诺**

#### 后端需求：TxtToActivity OpenAPI 端点

**对接内部服务：** `TxtToActivityService.cs`

```
POST /openapi/default.aspx
action: 1000201（建议编号）

请求参数：
{
  "action": "1000201",
  "appid": "...",
  "ts": "...",
  "sign": "...",
  "text": "问卷标题\n\n1. 您的性别[单选题]\n男\n女\n\n2. 您的满意度[量表题]\n1~5",
  "atype": 1,
  "folder": ""
}

响应：
{
  "result": true,
  "data": {
    "vid": 12345,
    "sid": "abc",
    "title": "问卷标题",
    "pc_path": "/jq/12345.aspx",
    "mobile_path": "/m/12345.aspx"
  }
}
```

#### MCP 工具：create_survey_by_text

```typescript
server.registerTool("create_survey_by_text", {
  title: "通过 DSL 文本创建问卷",
  description: "使用纯文本 DSL 语法创建问卷，AI 友好。支持 [单选题]、[多选题]、[量表题]、[矩阵题] 等题型标记。",
  inputSchema: {
    text: z.string().describe("DSL 格式的问卷文本，第一行为标题，后续为题目"),
    survey_type: z.number().optional().describe("问卷类型：1=调查(默认) 2=测评 3=投票 6=考试 7=表单"),
    folder: z.string().optional().describe("目标文件夹名称")
  },
  annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true }
});
```

**v2.4.0 交付物：** 58 tools（+1 create_survey_by_text）
**核心价值：** AI Agent 能用纯文本「写问卷」，完成 read/write 闭环

---

### Phase 3：AI 创建（需后端 2-3 个新端点）— v2.5.0

预计工作量：后端 ~3-5天 / CC ~3h MCP层
**状态：⚠️ 依赖后端，未获得承诺**

#### 后端需求

| 需求 | 建议 Action | 对接内部服务 |
|------|------------|-------------|
| AI 创建任务 | 1000301 | OpenAiService.CreateQNew |
| AI 任务状态查询 | 1000302 | Redis 任务查询 |
| AI 模型列表 | 1000303 | AIType 枚举 |

#### MCP 工具

| 工具名 | 功能 |
|--------|------|
| `create_survey_by_ai` | 用自然语言描述创建问卷（异步任务） |
| `get_ai_task_status` | 查询 AI 创建任务状态 |
| `list_ai_models` | 列出可用的 AI 模型 |

#### 新资源：AI 题型映射

```typescript
// wjx://reference/ai-question-types
// 暴露 createbyai_qlist.js 中 70+ 种题型的映射关系
// 包含：基础题型、矩阵题型、专业题型（NPS/Kano/SUS/MaxDiff/PSM）、AI 题型、考试题型
```

---

### Phase 4：单题更新（需后端确认）

**状态：⚠️ 依赖后端，未获得承诺**

需要确认 C# 后端是否有或能提供单个题目更新的 API。

**如果支持（建议 action=1000202）：**

```typescript
server.registerTool("update_survey_question", {
  title: "更新问卷中的单个题目",
  description: "使用 DSL 文本更新问卷中的指定题目",
  inputSchema: {
    vid: z.number().describe("问卷编号"),
    question_index: z.number().describe("题目序号（从1开始）"),
    text: z.string().describe("新的题目 DSL 文本（仅这一道题）")
  }
});
```

**如果不支持：** 在 prompt 中提供 workaround 指导（获取→修改→复制创建），但需注意此路径会破坏问卷 ID/链接/回收数据的连续性。

---

### Phase 5：生态分发 — 与 Phase 1 并行

预计工作量：CC ~2h

| 任务 | 说明 |
|------|------|
| npm 发布优化 | `bin` 入口（`npx wjx-mcp-server`），完善 `keywords`/`repository`/`description` |
| Docker 镜像 | `node:20-alpine`，HTTP 模式默认 |
| Skill 包格式 | `skill/` 目录兼容 mcporter |

**注：** 分发优先级提前。先让现有 56 个工具能被更多人用上。

---

## 实施时间线（v4.0 修正）

```
Week 1 ──────────────────────────────────────────────────
  ★ surveyToText() + DSL语法参考资源
  ★ 短链接工具 get_short_link
  ★ 快速创建/编辑 URL 资源
  ★ anomaly_detection + user_system_workflow 提示模板
  ★ npm 发布优化（bin 入口 + package.json 完善）
  [后端] 提交 Phase 2 后端需求（TxtToActivity OpenAPI）
  → 发布 v2.3.0（DSL读 + 短链接 + 2资源 + 2提示 + npm分发）

Week 2 ──────────────────────────────────────────────────
  Docker 镜像 + Skill 包
  surveyToText() 16+ 题型覆盖测试
  [后端] 确认 Phase 2 排期

Week 3-4（依后端进度）──────────────────────────────────
  Phase 2: create_survey_by_text（后端就绪后）
  Phase 3: AI 创建工具 + 题型映射资源
  Phase 4: 单题更新（如后端支持）
```

---

## 版本号规划（v4.0 修正）

| 版本 | 内容 | 工具数 | 备注 |
|------|------|--------|------|
| 2.3.0 | DSL读 + 短链接 + 资源/提示 + npm分发 | 56 → 57 | Week 1，MCP层独立 |
| 2.4.0 | DSL写（create_survey_by_text） | 57 → 58 | 依赖后端 1000201 |
| 2.5.0 | AI创建 + 题型映射 | 58 → 61 | 依赖后端 1000301/302/303 |
| 2.6.0 | 单题更新 + Skill包 | 61 → 62 | 依赖后端 1000202 |

---

## 后端配合清单（提交给 C# 团队）

| 优先级 | 需求 | 建议 Action | 对接内部服务 | 状态 |
|--------|------|------------|-------------|------|
| P0 | DSL 文本创建问卷 | 1000201 | TxtToActivityService | ⚠️ 未提交 |
| P1 | AI 创建任务 | 1000301 | OpenAiService.CreateQNew | ⚠️ 未提交 |
| P1 | AI 任务状态查询 | 1000302 | Redis 任务查询 | ⚠️ 未提交 |
| P2 | 单题更新 | 1000202 | 待确认 | ⚠️ 未提交 |
| P2 | AI 模型列表 | 1000303 | AIType 枚举 | ⚠️ 未提交 |

---

## 风险与缓解（v4.0 扩充）

| 风险 | 类型 | 影响 | 缓解 |
|------|------|------|------|
| 后端排期延迟 | 交付 | Phase 2-4 阻塞 | Phase 1 独立可交付，先发 v2.3.0 |
| TxtToActivity 不适合做 API | 技术 | Phase 2 方案变更 | 备选：MCP 层实现简化版 DSL 解析，直接调用 create_survey |
| **无人使用 MCP server** | 战略 | 全部投入浪费 | v2.3.0 后观察 npm 下载量和 GitHub stars，2 周无信号则调整方向 |
| **LLM 工具选择精度下降** | 产品 | 56+ tools 时 AI 选错工具 | 考虑工具分组或 meta-tool 路由方案 |
| **WJX 产品自建 MCP** | 竞争 | 本项目被废弃 | 保持轻量，专注 DSL workflow 差异化 |
| AI 创建异步任务超时 | 技术 | 用户体验差 | 设置合理超时（60s），支持轮询查询 |
| 单题更新后端不支持 | 技术 | Phase 4 跳过 | 提供 prompt workaround，但需说明副作用 |

---

## 成功标准（v4.0 修正）

1. **AI Agent 能「阅读」问卷**（surveyToText DSL 返回）— v2.3.0 交付
2. **npm 安装可用**（`npx wjx-mcp-server`）— v2.3.0 交付
3. AI Agent 能用纯文本「创建」问卷 — v2.4.0（依赖后端）
4. AI Agent 能用自然语言「创建」问卷 — v2.5.0（依赖后端）
5. ~~工具数从 54 增长到 76~~ → 核心 workflow 打通率

---

## 测试要求

`surveyToText()` 需覆盖全部 16+ 题型转换测试：
- 基础：单选、多选、下拉、简答、填空、问答
- 量表：量表、反向量表
- 矩阵：矩阵单选、矩阵多选、矩阵量表
- 特殊：排序、比重、表格、判断
- 结构：段落说明、分页栏

短链接 `get_short_link`：
- URL 参数只允许 wjx.cn 域名
- URL 编码正确性

新增 prompt/resource：
- 内容完整性验证
- 资源 URI 可访问

---

## Autoplan CEO Review 记录

### 第 1 轮（v3.0 → CEO Review）
- **审查日期**: 2026-03-30
- **审查人**: GStack CEO Review
- **结果**: DSL-first 优先级调整，版本策略修正

### 第 2 轮（v3.0 → Autoplan 双声道审查）
- **审查日期**: 2026-03-30
- **审查人**: Claude Opus 4.6 + Codex gpt-5.4（独立审查）
- **Critical 发现**:
  1. 基线错误：实际 56 tools 非 54，Phase 1 的 17 个"新增"工具全部已存在
  2. 工具数量不是战略指标，LLM 在 50+ tools 时选择精度下降
  3. 无用户需求验证，纯供给侧推理
- **High 发现**:
  4. Phase 2-4 后端依赖未锁定
  5. DSL 保真度问题（分支逻辑等不可表示）
  6. 风险清单只覆盖交付风险
  7. 替代方案未分析（workflow tools, gateway pattern）
- **用户决策**: 接受修正，重写计划（v3.0 → v4.0）

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 4 | DONE | 6 expansions accepted, 2 bug fixes (health check, load-env), mode: SCOPE_EXPANSION |
| Codex Review | `/codex review` | Independent 2nd opinion | 4 | issues_found | Round 3-4 (eng): auth conflation, folder param fake, health-check prompt padded, startup warning wrong creds, ParsedSurvey boundary |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 3 | CLEAR (PLAN) | 10 issues, 1 critical gap (textToSurvey malformed input) |
| Code Review | `/review` | Code quality gate | 2 | clean (DIFF via /ship) | 0 issues on latest run |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | skipped | N/A (server-side project) |
| Adversarial | auto-scaled | Large diff (200+ lines) | 1 | clean | tier: large, gate: informational |

**CROSS-MODEL:** Round 3-4 Codex found 6 new issues: auth conflation (accepted as known limitation), folder param removed, survey-health-check prompt already complete (removed from scope), startup warning corrected to WJX_TOKEN, ParsedSurvey typed vs wire payload (typed chosen), build_preview_url moved to SDK method.
**UNRESOLVED:** 0
**VERDICT:** CEO + ENG + CODE CLEARED. Scope reduced: removed survey-health-check enhancement (already exists), removed folder param, corrected startup warning target.
