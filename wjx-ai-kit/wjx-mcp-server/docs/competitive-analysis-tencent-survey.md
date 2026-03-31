# 竞品深度研究：腾讯问卷 MCP Skill v1.0.2

> 分析日期：2026-03-29
> 竞品版本：tencent-survey-skill 1.0.2
> 对标产品：wjx-mcp-server 0.1.0（问卷星）

---

## 1. 产品概览

| 维度 | 腾讯问卷 MCP Skill | 问卷星 MCP Server |
|------|-------------------|------------------|
| 产品形态 | **Skill 包**（SKILL.md + setup.sh + references/） | **独立 MCP Server**（TypeScript, ESM） |
| 运行时依赖 | mcporter（npm 全局包）+ jq + curl | Node.js >= 20，无外部依赖 |
| 传输协议 | HTTP（通过 mcporter 代理） | stdio / HTTP（原生 MCP SDK） |
| 工具数量 | **4 个** + 1 个版本检查 | **54 个** |
| 资源 | 0 | 7 |
| 提示模板 | 0 | 10 |
| 代码量 | ~640 行 shell + ~1200 行 markdown | ~5000+ 行 TypeScript |

## 2. 架构对比

### 2.1 腾讯问卷：Skill 模式

```
AI Agent (Claude/Cursor/etc.)
  ↓ 读取 SKILL.md（工具描述 + 使用指南）
  ↓ 调用 mcporter CLI
mcporter call tencent-survey.<tool> --args '{...}'
  ↓ HTTP POST
https://wj.qq.com/api/v2/mcp (Bearer Token)
  ↓
腾讯问卷后端
```

**特点：**
- 无自有服务端代码 — 纯粹的 API 调用代理
- 依赖 `mcporter` 作为 MCP 桥接层
- 鉴权脚本 `setup.sh`（~640 行 bash）处理 OAuth 设备授权流程
- 所有业务逻辑在腾讯后端（`/api/v2/mcp` 端点）

### 2.2 问卷星：独立 Server 模式

```
AI Agent
  ↓ MCP Protocol (stdio/HTTP)
wjx-mcp-server (Node.js)
  ↓ callWjxApi() — 签名 + 重试 + 超时
https://open.wjx.top/api/v1/... (SHA1 签名认证)
  ↓
问卷星 OpenAPI 后端
```

**特点：**
- 完整的服务端实现，自建签名算法
- 模块化架构（7 大模块，每个 types/client/tools 三文件）
- 内置重试、超时、traceID 等生产级特性
- 直接实现 MCP SDK，无中间层

## 3. 功能覆盖对比

### 3.1 腾讯问卷 4 个工具

| 工具 | 功能 | 对应问卷星工具 |
|------|------|--------------|
| `get_survey` | 获取问卷详情（含 DSL 文本） | `get_survey_details` |
| `create_survey` | 纯文本创建问卷 | `create_survey` |
| `update_question` | 更新单个题目 | 无直接对应（问卷星无单题更新） |
| `list_answers` | 获取回答列表（游标分页） | `get_survey_responses` |

### 3.2 问卷星独有功能（腾讯问卷未覆盖）

| 模块 | 工具数 | 核心能力 |
|------|--------|---------|
| **通讯录管理** | 10 | 联系人/部门/标签 CRUD、管理员管理 |
| **子账号管理** | 5 | 创建/修改/删除子账号 |
| **SSO 单点登录** | 2 | SSO 链接生成 |
| **答卷操作** | 5 | 提交答卷、修改分数、删除答卷、下载答卷 |
| **问卷管理** | 8 | 暂停/恢复回收、复制问卷、获取问卷列表等 |
| **统计分析** | 4 | 统计报告、交叉分析、NPS/CSAT 等 |
| **分析提示** | 6 | NPS、CSAT、交叉分析、情感分析 prompt |

### 3.3 腾讯问卷独有亮点

| 特性 | 说明 | 问卷星是否支持 |
|------|------|--------------|
| **纯文本 DSL 创建问卷** | 用自然语言般的 DSL 语法直接创建完整问卷 | ❌ 需结构化 API |
| **单题更新** | `update_question` 可更新单个题目 | ❌ 无此 API |
| **DSL text 返回** | `get_survey` 返回 DSL 文本，便于 AI 理解 | ❌ 仅返回结构化 JSON |
| **考试/测评/投票场景** | 支持 4 种场景（调查/考试/测评/投票），考试支持评分 | ⚠️ 仅调查场景 |
| **OAuth 设备授权** | 扫码授权，无需手动管理 AppID/AppKey | ❌ 需预配置凭据 |
| **自动版本检查** | `check_skill_update` 检查 Skill 新版本 | ❌ 无此机制 |

## 4. DSL 文本语法深度分析

这是腾讯问卷最大的差异化特性。

### 4.1 语法设计

```
问卷标题

引导语（可选）

1. 题目标题[题型][设置](描述)
选项A
选项B

=== 分页 ===
```

### 4.2 支持的题型

| 题型 | 语法标记 | 选项格式 |
|------|---------|---------|
| 单选题 | `[单选题]`（可省略） | 每行一个选项 |
| 多选题 | `[多选题]` | 每行一个选项 |
| 下拉题 | `[下拉题]` | 每行一个选项 |
| 排序题 | `[排序题]` | 每行一个选项 |
| 量表题 | `[量表题]` | `1~5` 数字范围 |
| 单行文本题 | `[单行文本题]` | 无选项 |
| 多行文本题 | `[多行文本题]` | 无选项 |
| 多项填空题 | `[多项填空题]` | `字段名：____` |
| 矩阵单选题 | `[矩阵单选题]` | 选项空格分隔 + 子问题每行一个 |
| 矩阵多选题 | `[矩阵多选题]` | 同上 |
| 矩阵量表题 | `[矩阵量表题]` | `1~5` + 子问题 |
| 联动题 | `[联动题]` | 层级名空格分隔，答案用 `+` 连接 |
| 日期时间题 | `[日期时间题]` | 无选项 |
| 地理位置题 | `[地理位置题]` | 无选项 |
| 附件题 | `[附件题]` | 无选项 |
| 手写签名题 | `[手写签名题]` | 无选项 |
| 段落说明 | `[段落说明]` | 无选项 |

### 4.3 考试场景专用

```
题目[单选题][答案：D][分数：5][全部]
题目[判断题][答案：A][分数：3]
题目[不定项选择题][答案：B、C][分数：4][部分]
题目[问答题][分数：20][人工]
```

### 4.4 对 AI 的友好度

DSL 语法**极其 AI 友好**：
- AI 可以直接用自然语言生成问卷文本，无需构造复杂 JSON
- `get_survey` 返回的 `text` 字段让 AI 能直接"阅读"问卷内容
- `update_question` 只需写一道题的 DSL 就能更新

**这是腾讯问卷对 AI 场景做的最重要的产品设计。**

## 5. 鉴权机制对比

| 维度 | 腾讯问卷 | 问卷星 |
|------|---------|--------|
| 认证方式 | Bearer Token（`wjpt_` 前缀） | SHA1 签名（AppID + AppKey） |
| Token 获取 | OAuth 设备授权 / 手动创建 | 开发者后台申请 |
| Token 有效期 | 有过期机制 | 无过期（Key 不变） |
| 安全级别 | Token 泄露可被撤销/重置 | Key 泄露需重新申请 |
| 接入门槛 | 扫码即可，非常低 | 需申请开发者资格 |

## 6. 数据模型对比

### 6.1 问卷结构

两者几乎一致：`Survey → Pages[] → Questions[] → Options[]`

**腾讯问卷额外字段：**
- `text`：DSL 文本表示
- `scene`：场景类型（调查/考试/测评/投票）
- `project`：项目归属

### 6.2 回答结构

| 维度 | 腾讯问卷 | 问卷星 |
|------|---------|--------|
| 分页方式 | **游标分页**（last_answer_id） | offset + per_page |
| 答题者信息 | nickname, avatar, openid, IP, UA | 基础信息 |
| 地理信息 | country, province, city | 有 |
| 考试评分 | score 字段 | 无 |

## 7. 分发机制对比

| 维度 | 腾讯问卷 | 问卷星 |
|------|---------|--------|
| 分发方式 | Skill zip 包 + mcporter | npm 包 / Docker / 源码 |
| 安装命令 | `bash setup.sh` | `npm install` + 配置环境变量 |
| 多平台支持 | QClaw、WorkBuddy、通用 AI | Claude、Cursor、通用 MCP 客户端 |
| 更新机制 | `check_skill_update` 自动检查 | 手动更新 |
| 依赖链 | mcporter → npm → Node.js | Node.js |

## 8. 问卷星已有 AI 创建能力（WjxNew 源码分析）

**重要更正**：问卷星产品端已具备完整的 AI 创建问卷能力，且远比腾讯问卷强大。以下是 WjxNew 源码中的 AI 能力全景：

### 8.1 问卷星 AI 创建能力矩阵

| 能力 | 入口 | 说明 |
|------|------|------|
| **智能识别创建** | `createbyai.aspx` (aikey=0) | 系统自动识别用户需求类型 |
| **调查问卷创建** | aikey=1 | 生成调查问卷 |
| **专业调查创建** | aikey=2 | 生成专业调查问卷 |
| **考试试卷创建** | aikey=3 / `exampaperAi.aspx` | 生成考试试卷 |
| **表单创建** | aikey=4 | 生成表单 |
| **360度评估** | 独立页面 | 独立入口 |
| **文本导入** | `designqbytxt.aspx` | 类似腾讯 DSL，支持粘贴 Word 文本 |
| **AI 追问** | `aifollowp.aspx` | AI 自动追问 |
| **AI 邀请** | `aiinvite.aspx` | AI 邀请 |
| **AI 图片创建** | `createimgbyai.aspx` | AI 生成图片 |

### 8.2 问卷星已有 DSL 文本语法（TxtToActivityService.cs）

问卷星同样支持纯文本解析创建问卷，支持的题型标注包括：
- `[单选题]` / `【单选题】` / `(单选题)` / `（单选题）`
- `[多选题]` / `[量表题]` / `[反向量表题]`
- `[矩阵题]` / `[矩阵单选题]` / `[矩阵量表题]`
- `[排序题]` / `[比重题]` / `[表格题]`
- `[简答题]` / `[填空题]` / `[问答题]`
- `[段落说明]` / `[分页栏]` / `[判断题]`

### 8.3 问卷星支持 70+ 种 AI 题型（createbyai_qlist.js）

腾讯问卷仅支持 ~17 种题型，问卷星 AI 支持 **70+** 种：

| 类别 | 题型 |
|------|------|
| 基础题型 | 单选、多选、下拉框、简答题、多项填空、文件上传 |
| 矩阵题型 | 矩阵单选、矩阵多选、矩阵量表、矩阵滑动条、表格数值 |
| **专业题型** | NPS量表、评分题、Kano模型、SUS模型、MaxDiff/BWS、联合分析、PSM模型、层次分析、品牌漏斗 |
| **AI 题型** | AI追问、AI处理、AI访谈、知情同意书 |
| 考试题型 | 考试单选、考试多选、考试判断、考试填空、考试简答、考试代码 |
| 特殊题型 | 图片OCR、热力图 |

### 8.4 问卷星支持多 AI 模型

| 模型 | 说明 |
|------|------|
| GPT-3.5 / GPT-4 | Azure OpenAI |
| DeepSeek | |
| 文心一言 | 百度 |
| 讯飞星火 | 科大讯飞 |
| Google Gemini | |
| Kimi | 月之暗面 |
| 通义千问 | 阿里 |
| 豆包 | 字节跳动 |
| OpenRouter / AIComm | 通用接口 |

腾讯问卷仅使用后端固定模型，无模型选择能力。

### 8.5 架构差异

```
问卷星 AI 创建流程：
前端 → AICreate.aspx (action=createQNew)
     → OpenAiService.CreateQNew()
     → Redis 队列（异步任务）
     → 后台 AI 服务（消费队列，调用 LLM）
     → Redis 流式结果（aitaskid_ 前缀）
     → 前端轮询 getResult → JSONL 解析 → 问卷设计器渲染 → 保存

腾讯问卷 AI 创建流程：
AI Agent → mcporter → wj.qq.com/api/v2/mcp → 后端解析 DSL 文本 → 返回问卷
```

**问卷星的 AI 创建能力是产品级的**（支持流式输出、异步任务、多模型、附件上传、扩展提示词），而腾讯问卷的 DSL 创建是**纯文本解析**（无 AI 参与，只是文本格式化）。

## 9. 修正后的竞争分析

### 9.1 腾讯问卷的真实优势（缩小范围）

1. **MCP 接入便捷**：Skill 包 + 扫码授权，接入门槛极低
2. **DSL 直接暴露给 MCP**：`create_survey` 的 text 参数让外部 AI Agent 可以直接用 DSL 创建问卷
3. **单题更新 API**：`update_question` 允许 AI 精准编辑
4. **腾讯社交生态**：QQ/微信扫码授权和分发

### 9.2 问卷星的全面优势

1. **54 vs 4 工具**：API 覆盖面碾压
2. **70+ vs ~17 题型**：AI 创建的题型丰富度碾压
3. **多 AI 模型支持**：9+ 种 LLM vs 固定后端模型
4. **专业分析题型**：NPS、Kano、SUS、MaxDiff、PSM、联合分析等腾讯完全没有
5. **企业级功能**：通讯录、子账号、SSO、统计分析
6. **AI 创建是产品级的**：流式输出、异步任务、附件支持、提示词系统
7. **独立 MCP Server**：不依赖第三方 CLI

### 9.3 关键差距：MCP 层面的 AI 创建能力

**问卷星的核心问题不是没有 AI 创建能力，而是这些能力还没有暴露到 MCP 工具层。**

当前 `wjx-mcp-server` 的 `create_survey` 工具只是调用 OpenAPI 创建问卷，需要传入结构化参数。问卷星产品内部的 AI 创建（createbyai）、文本导入（TxtToActivity）等强大能力，在 MCP 层面不可用。

## 10. 建议行动项（修正版）

### 10.1 高优先级 — 将已有 AI 能力暴露到 MCP

1. **新增 `create_survey_by_text` 工具**：对接 `TxtToActivityService` 的文本解析能力，让外部 AI Agent 也能用 DSL 文本创建问卷
2. **新增 `create_survey_by_ai` 工具**：对接 `OpenAiService.CreateQNew()`，让外部 AI Agent 触发 AI 创建任务
3. **新增 `update_question` 工具**：如果 OpenAPI 支持单题更新，暴露到 MCP

### 10.2 中优先级 — 增强 AI 体验

4. **get_survey 返回可读文本**：类似腾讯的 `text` DSL 字段，让 AI 更容易理解问卷
5. **暴露 AI 题型映射**：将 70+ 种题型的 DSL 语法作为 MCP 资源暴露
6. **简化鉴权**：考虑增加 Token 模式作为替代

### 10.3 差异化 — 发挥独有优势

7. **专业分析工具**：NPS/Kano/SUS/MaxDiff 等专业分析是腾讯无法短期追赶的
8. **企业级 AI 工作流**：通讯录 + 子账号 + SSO 构建完整企业场景
9. **多模型 AI 创建**：在 MCP 层暴露模型选择，让用户选择 AI 模型

---

## 附录：腾讯问卷 MCP 完整文件清单

```
tencent-survey-skill/
├── SKILL.md              # Skill 入口（工具列表、触发场景、配置指南）
├── README.md             # 项目说明
├── setup.sh              # 鉴权脚本（~640 行 bash，OAuth 设备授权 + mcporter 配置）
└── references/
    ├── auth.md           # 鉴权流程详细说明
    ├── get_survey.md     # get_survey 工具参考（返回值、字段说明）
    ├── create_survey.md  # create_survey 工具参考（DSL 语法详解）
    ├── update_question.md# update_question 工具参考
    └── list_answers.md   # list_answers 工具参考（游标分页说明）
```
