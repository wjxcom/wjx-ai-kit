# 问卷调研平台 MCP Server 深度研究报告

> 调研日期：2026-03-23
> 调研范围：金数据、JotForm、SurveyMonkey、SurveySparrow、SurveyCake、Typeform、问卷星
> 目标：制定世界级问卷调研平台 MCP Server 框架与业务场景规划

---

## 一、行业竞品 MCP 实现全景

### 1.1 各平台 MCP 成熟度矩阵

| 平台 | MCP 原生 | 工具数量 | 认证方式 | 传输协议 | 技术栈 | 覆盖场景 |
|------|---------|---------|---------|---------|--------|---------|
| **JotForm** | ✅ 官方原生 | 20+ | API Key / OAuth 2.0 | stdio | Python | 全生命周期 |
| **金数据** | ✅ 官方原生 | 9 | API Key / OAuth 2.0 | stdio/SSE | — | 表单+数据CRUD |
| **SurveyMonkey** | ⚠️ 三方集成 | N/A | OAuth 2.0 | Zapier/CData MCP | — | 通过中间件 |
| **SurveySparrow** | ⚠️ 三方集成 | N/A | OAuth 2.0 | Zapier MCP | — | 通过中间件 |
| **Typeform** | ⚠️ 三方集成 | N/A | OAuth 2.0 | Zapier/Composio | — | 通过中间件 |
| **SurveyCake** | ❌ 无 MCP | 0 | API Key | Webhook only | — | 仅文本校验+Webhook |
| **问卷星 (当前)** | ✅ 自建 MVP | 4 | AppKey 签名 | stdio | TypeScript | 问卷CRUD |

### 1.2 关键发现

1. **JotForm 是行业标杆**：唯一实现官方完整 MCP Server 的问卷平台，暴露全部 API 方法为 MCP 工具
2. **金数据是中文市场标杆**：9 个工具覆盖表单+数据全生命周期，支持 13 种字段类型
3. **SurveyMonkey/SurveySparrow/Typeform** 均依赖 Zapier MCP 或 CData 等第三方中间件，无原生 MCP
4. **SurveyCake** 最弱，仅有 Webhook 和 API 文本校验，无 MCP 适配
5. **差异化机会巨大**：目前无任何平台实现 AI 原生分析工具（NPS/CSAT/情感分析）作为 MCP 内置能力

---

## 二、竞品 MCP 工具详细清单

### 2.1 JotForm MCP Server（标杆）

> 来源：[GitHub - JotForm MCP Server](https://github.com/The-AI-Workshops/jotform-mcp-server)、[JotForm 官方](https://jotform.com)

**架构**：Python + JotFormAPIClient → MCP stdio Server

#### 用户管理工具
| 工具名 | 功能 | 读/写 | 类别 |
|--------|------|-------|------|
| `get_user` | 获取用户账户详情 | 读 | 用户 |
| `get_usage` | 获取月度使用统计（提交数、上传数） | 读 | 用户 |
| `get_subusers` | 获取子用户列表 | 读 | 用户 |
| `get_settings` | 获取用户设置（时区、语言） | 读 | 用户 |
| `update_settings` | 更新用户设置 | 写 | 用户 |
| `get_history` | 获取用户活动日志 | 读 | 用户 |
| `register_user` | 注册新用户 | 写 | 用户 |
| `login_user` | 用户登录 | 写 | 用户 |
| `logout_user` | 用户登出 | 写 | 用户 |

#### 表单管理工具
| 工具名 | 功能 | 读/写 | 类别 |
|--------|------|-------|------|
| `get_forms` / `form_list` | 获取表单列表 | 读 | 表单 |
| `get_form` | 获取单个表单基本信息 | 读 | 表单 |
| `get_form_questions` | 获取表单题目列表 | 读 | 表单 |
| `create_form` | 创建新表单 | 写 | 表单 |
| `edit_form` | 编辑已有表单 | 写 | 表单 |
| `delete_form` | 删除表单 | 写（危险） | 表单 |

#### 提交数据工具
| 工具名 | 功能 | 读/写 | 类别 |
|--------|------|-------|------|
| `get_submissions` | 获取账户全部提交（分页+筛选） | 读 | 数据 |
| `get_form_submissions` | 获取指定表单的提交 | 读 | 数据 |
| `create_form_submission` / `create_submission` | 向表单提交数据 | 写 | 数据 |
| `get_submission_data` | 获取单条提交详情 | 读 | 数据 |
| `delete_submission_data` | 删除提交 | 写（危险） | 数据 |

#### 报告与 Webhook 工具
| 工具名 | 功能 | 读/写 | 类别 |
|--------|------|-------|------|
| `get_form_reports` | 获取表单所有报告 | 读 | 报告 |
| `create_report` | 创建新报告 | 写 | 报告 |
| `get_form_webhooks` | 获取表单 Webhook 列表 | 读 | Webhook |
| `create_form_webhook` | 创建 Webhook | 写 | Webhook |
| `delete_form_webhook` | 删除 Webhook | 写（危险） | Webhook |

---

### 2.2 金数据 MCP Server

> 来源：[金数据官网](https://jinshuju.net)

**架构**：MCP stdio/SSE Server
**认证**：API Key (HTTP Basic) 或 OAuth 2.0

#### 表单管理工具
| 工具名 | 功能 | 读/写 | 支持字段类型 |
|--------|------|-------|-------------|
| `create_form` | 创建新表单 | 写 | 13 种字段类型 |
| `get_form` | 查看表单详情及字段结构 | 读 | — |
| `list_forms` | 搜索和浏览表单（按名称、分页） | 读 | — |
| `edit_form` | 修改表单标题、增删字段、调整设置、管理选项 | 写 | — |

#### 数据管理工具
| 工具名 | 功能 | 读/写 | 特性 |
|--------|------|-------|------|
| `create_entry` | 提交新数据条目 | 写 | — |
| `get_entry` | 查看单条数据条目详情 | 读 | — |
| `list_entries` | 查询和分页数据条目（支持时间筛选） | 读 | 时间过滤 |
| `update_entry` | 更新数据（全量替换或部分更新） | 写 | PATCH 支持 |
| `delete_entry` | 删除数据条目 | 写（危险） | — |

**金数据亮点**：
- 表单编辑能力强（支持字段级别操作）
- 数据 CRUD 完整（含 PATCH 更新）
- 双认证方案（API Key 快速接入 + OAuth 精细授权）

---

### 2.3 SurveyMonkey（通过第三方 MCP）

> 来源：[Zapier MCP](https://zapier.com)、[CData Connect AI](https://cdata.com)、[Truto](https://truto.one)

**无原生 MCP Server**，通过以下中间件实现：

| 中间件 | 提供能力 | 特点 |
|--------|---------|------|
| Zapier MCP | 连接 SurveyMonkey 动作到 AI 工具 | 无需代码，动态 MCP URL |
| CData Connect AI | 远程 MCP Server，读写 SurveyMonkey 数据 | 支持 300+ 企业应用互连 |
| Truto | AI Agent 工具集 | LangChain/PyDantic 框架集成 |
| Agentsfera | AI 助手集成 | Claude/ChatGPT 兼容 |

**SurveyMonkey API 能力（可映射为 MCP 工具）**：

| 场景 | API 端点 | 对应 MCP 工具建议 |
|------|---------|------------------|
| 问卷管理 | 创建/获取/更新/删除问卷 | `create_survey`, `get_survey`, `update_survey`, `delete_survey` |
| 问卷结构 | 管理页面和题目 | `add_page`, `add_question`, `get_questions` |
| 分发管理 | 创建 collector（weblink/email/SMS/popup） | `create_collector`, `list_collectors` |
| 邀请消息 | 发送邮件/短信邀请 | `send_invite`, `list_recipients` |
| 数据回收 | 获取回复详情 | `get_responses`, `get_response_details` |
| 联系人 | 联系人和联系人列表管理 | `create_contact`, `list_contacts` |
| 文件夹 | 问卷分组管理 | `create_folder`, `list_folders` |
| 多语言 | 问卷翻译 | `add_translation` |
| Webhook | 事件通知（response_completed） | `create_webhook`, `list_webhooks` |

---

### 2.4 SurveySparrow

> 来源：[SurveySparrow API 文档](https://surveysparrow.com)

**无原生 MCP Server**，通过 Zapier MCP 集成。

**SurveySparrow API v3 完整能力（可映射为 MCP 工具）**：

| 场景分类 | API 端点 | 对应 MCP 工具建议 |
|----------|---------|------------------|
| **问卷管理** | Get/Create/Update/Clone/Delete surveys | `create_survey`, `get_survey`, `update_survey`, `clone_survey`, `delete_survey` |
| **回复管理** | Get/Create/Update/Delete responses | `get_responses`, `create_response`, `update_response` |
| **受众管理** | Contacts CRUD, Contact Lists, Contact Properties | `create_contact`, `list_contacts`, `create_contact_list` |
| **分发** | 创建分享链接、邮件/SMS/WhatsApp 分享 | `create_share_link`, `share_survey` |
| **报告** | 推送数据到第三方报告工具 | `get_report`, `export_report` |
| **自动化** | 触发-事件工作流 | `create_automation`, `list_automations` |
| **NPS** | NPS 专用端点 | `get_nps_score`, `list_nps_responses` |
| **题目管理** | Questions CRUD | `add_question`, `update_question`, `delete_question` |
| **Webhook** | Webhook 管理 | `create_webhook`, `list_webhooks` |
| **团队与角色** | Users/Teams/Roles/Audit Logs | `list_users`, `list_teams` |
| **工单系统** | Tickets/Comments/Fields/Templates | `create_ticket`, `list_tickets` |
| **翻译** | 多语言支持 | `add_translation` |
| **渠道** | 多渠道管理 | `list_channels` |
| **口碑管理** | Reviews/Platforms | `list_reviews` |
| **员工360** | 360度评估 | `get_360_results` |

---

### 2.5 SurveyCake（台湾）

> 来源：[SurveyCake 官网](https://surveycake.com)

**最弱的平台**，无公开的问卷管理 API：

| 能力 | 详情 |
|------|------|
| API 文本校验 | POST 请求验证问卷输入（发票号、员工ID等） |
| Webhook | 提交后触发第三方服务 |
| 企业定制 API | 仅企业版提供 |
| MCP 支持 | ❌ 无 |

**结论**：SurveyCake 不具备 MCP 参考价值，但其"实时输入校验"思路可借鉴。

---

### 2.6 Typeform

> 来源：[Zapier](https://zapier.com)、[Composio](https://composio.dev)、[Activepieces](https://activepieces.com)

**无原生 MCP Server**，但生态丰富：

| 集成方式 | 提供者 | 能力 |
|----------|--------|------|
| Zapier MCP | Zapier | 连接 Typeform 到 AI 工具 |
| Composio MCP | Composio | 创建表单、列出回复、更新题目 |
| Activepieces MCP | Activepieces | AI Agent 控制 Typeform |
| Improvado MCP | Improvado | 分析回复数据、转化率、流失率 |

**Typeform 内部实践**：开发了内部设计系统 MCP Server（Echo），用于 AI 编码助手获取组件文档和设计 Token。

---

### 2.7 问卷星（当前 MVP 状态）

| 工具名 | 功能 | 已实现 |
|--------|------|--------|
| `create_survey` | 创建问卷 | ✅ |
| `get_survey` | 获取问卷详情 | ✅ |
| `list_surveys` | 获取问卷列表 | ✅ |
| `update_survey_status` | 修改问卷状态 | ✅ |

**已有技术基础**：SHA1 签名、指数退避重试、15s 超时、70+ 单元测试

---

## 三、MCP 工具分场景分类框架

基于竞品调研，将问卷调研平台 MCP 工具体系按 **8 大业务场景** 分类：

### 场景 1：问卷生命周期管理（Survey Lifecycle）

> 核心价值：让 AI 能完整管理问卷从创建到归档的全过程

| 工具名 | 功能描述 | 读/写 | 优先级 | 竞品覆盖 |
|--------|---------|-------|--------|---------|
| `create_survey` | 创建问卷（调查/测评/投票/考试/表单） | 写 | P0 | ✅ 全部 |
| `get_survey` | 获取问卷详情（含题目/选项） | 读 | P0 | ✅ 全部 |
| `list_surveys` | 分页查询问卷列表（含筛选/排序） | 读 | P0 | ✅ 全部 |
| `update_survey` | 修改问卷标题、描述、设置 | 写 | P1 | ✅ JotForm/金数据 |
| `update_survey_status` | 发布/暂停/删除问卷 | 写 | P0 | ✅ 已实现 |
| `clone_survey` | 复制问卷 | 写 | P2 | ✅ SurveySparrow |
| `delete_survey` | 永久删除问卷 | 写（危险） | P2 | ✅ JotForm |

### 场景 2：题目与结构管理（Question & Structure）

> 核心价值：让 AI 能精细化编辑问卷内部结构

| 工具名 | 功能描述 | 读/写 | 优先级 | 竞品覆盖 |
|--------|---------|-------|--------|---------|
| `list_questions` | 获取问卷所有题目 | 读 | P1 | ✅ JotForm |
| `get_question` | 获取单个题目详情 | 读 | P1 | ✅ JotForm |
| `add_question` | 向问卷添加新题目 | 写 | P1 | ✅ 金数据/SurveySparrow |
| `update_question` | 修改题目内容/选项/设置 | 写 | P1 | ✅ 金数据/SurveySparrow |
| `delete_question` | 删除题目 | 写（危险） | P2 | ✅ 金数据/SurveySparrow |
| `reorder_questions` | 调整题目顺序 | 写 | P2 | ✅ 金数据 |
| `add_page` | 添加分页 | 写 | P3 | ✅ SurveyMonkey |
| `set_logic` | 设置跳转逻辑/显示逻辑 | 写 | P2 | ⚠️ 部分平台 |

### 场景 3：数据回收与管理（Response & Data）

> 核心价值：让 AI 能读取、提交、管理答卷数据

| 工具名 | 功能描述 | 读/写 | 优先级 | 竞品覆盖 |
|--------|---------|-------|--------|---------|
| `list_responses` | 分页获取答卷列表（含筛选/时间范围） | 读 | P0 | ✅ 全部 |
| `get_response` | 获取单条答卷详情 | 读 | P0 | ✅ 全部 |
| `create_response` | 代填/批量导入答卷数据 | 写 | P1 | ✅ JotForm/金数据/SurveySparrow |
| `update_response` | 修改答卷数据 | 写 | P2 | ✅ 金数据/SurveySparrow |
| `delete_response` | 删除答卷 | 写（危险） | P2 | ✅ JotForm/金数据/SurveySparrow |
| `export_responses` | 批量导出答卷（CSV/Excel/JSON） | 读 | P1 | ✅ SurveyMonkey |
| `get_response_count` | 获取答卷总数/趋势 | 读 | P1 | ✅ SurveyMonkey |

### 场景 4：分发与渠道管理（Distribution & Channels）

> 核心价值：让 AI 能自动化问卷分发流程

| 工具名 | 功能描述 | 读/写 | 优先级 | 竞品覆盖 |
|--------|---------|-------|--------|---------|
| `create_share_link` | 生成问卷分享链接/二维码 | 写 | P1 | ✅ SurveySparrow |
| `create_collector` | 创建收集渠道（weblink/email/SMS/popup） | 写 | P1 | ✅ SurveyMonkey |
| `list_collectors` | 列出所有收集渠道 | 读 | P1 | ✅ SurveyMonkey |
| `send_invite` | 通过邮件/短信发送问卷邀请 | 写 | P2 | ✅ SurveyMonkey/SurveySparrow |
| `get_share_stats` | 获取分享渠道统计（点击/完成率） | 读 | P2 | ✅ SurveySparrow |
| `create_custom_link` | 创建带自定义参数的链接（用户ID关联） | 写 | P1 | ✅ 问卷星 |

### 场景 5：统计分析与报告（Analytics & Reports）

> 核心价值：让 AI 直接获取结构化统计结果，支持智能分析

| 工具名 | 功能描述 | 读/写 | 优先级 | 竞品覆盖 |
|--------|---------|-------|--------|---------|
| `get_survey_stats` | 获取问卷统计概要（完成率、平均时长等） | 读 | P0 | ✅ SurveyMonkey |
| `get_question_stats` | 获取单题统计（选项分布、均值、中位数） | 读 | P1 | ✅ SurveyMonkey |
| `get_cross_analysis` | 获取交叉分析结果 | 读 | P2 | ⚠️ 少数平台 |
| `create_report` | 创建统计报告 | 写 | P1 | ✅ JotForm |
| `get_report` | 获取已创建的报告 | 读 | P1 | ✅ JotForm/SurveySparrow |
| `export_report` | 导出报告（PDF/Excel） | 读 | P2 | ✅ SurveySparrow |

### 场景 6：AI 原生分析能力（AI-Native Analysis）🌟

> 核心价值：**差异化竞争力** — 目前无任何竞品在 MCP 层面提供此能力

| 工具名 | 功能描述 | 读/写 | 优先级 | 竞品覆盖 |
|--------|---------|-------|--------|---------|
| `analyze_sentiment` | 对开放题答案进行情感分析 | 读 | P1 | ❌ 无竞品 |
| `extract_themes` | 从开放题自动提取主题/关键词 | 读 | P1 | ❌ 无竞品 |
| `calculate_nps` | 计算 NPS 得分及分组分布 | 读 | P1 | ⚠️ SurveySparrow API |
| `calculate_csat` | 计算 CSAT 满意度得分 | 读 | P1 | ❌ 无竞品 |
| `generate_insights` | AI 生成问卷数据洞察摘要 | 读 | P2 | ❌ 无竞品 |
| `detect_anomalies` | 检测异常答卷（刷票/机器人） | 读 | P2 | ❌ 无竞品 |
| `compare_surveys` | 对比多次调查的数据变化趋势 | 读 | P3 | ❌ 无竞品 |

### 场景 7：联系人与用户管理（Contacts & Users）

> 核心价值：管理调查对象和账户体系

| 工具名 | 功能描述 | 读/写 | 优先级 | 竞品覆盖 |
|--------|---------|-------|--------|---------|
| `list_contacts` | 获取联系人列表 | 读 | P2 | ✅ SurveyMonkey/SurveySparrow |
| `create_contact` | 创建联系人 | 写 | P2 | ✅ SurveyMonkey/SurveySparrow |
| `create_contact_list` | 创建联系人分组 | 写 | P2 | ✅ SurveySparrow |
| `get_user_info` | 获取当前用户信息 | 读 | P1 | ✅ JotForm |
| `get_usage_stats` | 获取账户用量统计 | 读 | P1 | ✅ JotForm |
| `sso_login` | SSO 单点登录 | 写 | P3 | ✅ 问卷星 |

### 场景 8：自动化与集成（Automation & Integration）

> 核心价值：事件驱动的自动化工作流

| 工具名 | 功能描述 | 读/写 | 优先级 | 竞品覆盖 |
|--------|---------|-------|--------|---------|
| `create_webhook` | 创建数据推送 Webhook | 写 | P1 | ✅ JotForm/SurveyMonkey |
| `list_webhooks` | 列出 Webhook 配置 | 读 | P1 | ✅ JotForm |
| `delete_webhook` | 删除 Webhook | 写（危险） | P2 | ✅ JotForm |
| `set_redirect_url` | 设置提交后跳转 URL | 写 | P2 | ✅ 问卷星 |
| `set_data_push` | 配置答卷实时推送 | 写 | P1 | ✅ 问卷星 |

---

## 四、MCP 接口框架架构设计

### 4.1 推荐分层架构

```
┌─────────────────────────────────────────────────────┐
│                   MCP Client (AI Agent)              │
├─────────────────────────────────────────────────────┤
│                  Transport Layer                     │
│          stdio (本地) │ SSE/HTTP (远程)               │
├─────────────────────────────────────────────────────┤
│                 MCP Server Core                      │
│  ┌───────────────┬──────────────┬─────────────────┐ │
│  │   Tools       │  Resources   │    Prompts       │ │
│  │  (42 tools)   │ (schema暴露) │  (模板提示词)    │ │
│  └───────────────┴──────────────┴─────────────────┘ │
├─────────────────────────────────────────────────────┤
│              Business Logic Layer                    │
│  ┌──────────┬──────────┬──────────┬──────────────┐  │
│  │Survey    │Question  │Response  │Analytics     │  │
│  │Manager   │Manager   │Manager   │Engine        │  │
│  └──────────┴──────────┴──────────┴──────────────┘  │
├─────────────────────────────────────────────────────┤
│              Infrastructure Layer                    │
│  ┌──────────┬──────────┬──────────┬──────────────┐  │
│  │HTTP      │Signature │Rate      │Cache         │  │
│  │Client    │Module    │Limiter   │Layer         │  │
│  └──────────┴──────────┴──────────┴──────────────┘  │
├─────────────────────────────────────────────────────┤
│            问卷星 OpenAPI / 第三方 API               │
└─────────────────────────────────────────────────────┘
```

### 4.2 MCP 三大原语规划

#### Tools（工具）— 42 个规划工具

按场景分类的工具数量：
| 场景 | 工具数 | 优先级 |
|------|--------|--------|
| 问卷生命周期 | 7 | P0-P2 |
| 题目与结构 | 8 | P1-P3 |
| 数据回收 | 7 | P0-P2 |
| 分发与渠道 | 6 | P1-P2 |
| 统计分析 | 6 | P0-P2 |
| AI 原生分析 | 7 | P1-P3 |
| 联系人与用户 | 6 | P1-P3 |
| 自动化与集成 | 5 | P1-P2 |
| **合计** | **52** | — |

#### Resources（资源）— 结构化数据暴露

| Resource URI 模式 | 描述 | MIME 类型 |
|-------------------|------|-----------|
| `survey://{vid}` | 问卷元数据 | application/json |
| `survey://{vid}/questions` | 问卷题目结构 | application/json |
| `survey://{vid}/responses` | 答卷数据流 | application/json |
| `survey://{vid}/stats` | 统计概要 | application/json |
| `account://usage` | 账户用量 | application/json |
| `template://question-types` | 支持的题型列表 | application/json |

#### Prompts（提示词模板）

| Prompt 名称 | 用途 | 参数 |
|-------------|------|------|
| `design-survey` | 引导 AI 设计问卷结构 | topic, target_audience, purpose |
| `analyze-results` | 引导 AI 分析调查结果 | survey_id, focus_areas |
| `generate-report` | 引导 AI 生成调查报告 | survey_id, format, language |
| `improve-questions` | 引导 AI 优化题目质量 | survey_id, optimization_goal |
| `create-from-template` | 基于模板创建问卷 | template_type (NPS/CSAT/员工满意度/...) |

### 4.3 认证与安全架构

```
Phase 1 (当前): AppKey + SHA1 签名 → stdio 本地使用
Phase 2 (计划): OAuth 2.0 / OAuth 2.1 → Remote MCP (SSE/HTTP)
Phase 3 (远景): RBAC + Scope 权限控制 → 多租户安全
```

| 阶段 | 认证方式 | 传输协议 | 适用场景 |
|------|---------|---------|---------|
| Phase 1 | AppKey 签名 | stdio | 开发者本地使用 |
| Phase 2 | OAuth 2.0 | SSE over HTTP | SaaS 集成 |
| Phase 3 | OAuth 2.1 + PKCE | Streamable HTTP | 企业级部署 |

---

## 五、分阶段实施路线图

### Phase 1：数据回收与只读增强（4 周）

**目标**：补齐数据读取能力，实现问卷全生命周期可观测

| 工具 | 描述 | 依赖 |
|------|------|------|
| `list_responses` | 分页获取答卷列表 | 问卷星答卷数据API |
| `get_response` | 获取单条答卷详情 | 问卷星答卷数据API |
| `get_response_count` | 获取答卷总数 | 问卷星API |
| `export_responses` | 批量导出答卷 | 问卷星API |
| `get_survey_stats` | 获取问卷统计概要 | 问卷星统计API |
| `get_user_info` | 获取账户信息 | 问卷星API |
| `get_usage_stats` | 获取账户用量 | 问卷星API |

**交付物**：
- 7 个新 tool 实现
- Resource schema（survey:// URI）
- 评测集（prompt → expected tool call）

### Phase 2：题目编辑与分发（4 周）

**目标**：让 AI 能精细化编辑问卷并自动化分发

| 工具 | 描述 |
|------|------|
| `list_questions` | 获取问卷题目列表 |
| `add_question` | 添加新题目 |
| `update_question` | 修改题目 |
| `delete_question` | 删除题目 |
| `update_survey` | 修改问卷设置 |
| `create_share_link` | 生成分享链接 |
| `create_custom_link` | 带参数的自定义链接 |
| `set_data_push` | 配置数据推送 |

### Phase 3：AI 原生分析能力（6 周）🌟

**目标**：打造差异化竞争力 — AI 原生调研分析

| 工具 | 描述 | 实现方式 |
|------|------|---------|
| `analyze_sentiment` | 开放题情感分析 | LLM Sampling |
| `extract_themes` | 主题提取 | LLM Sampling |
| `calculate_nps` | NPS 计算 | 内置算法 |
| `calculate_csat` | CSAT 计算 | 内置算法 |
| `generate_insights` | AI 洞察生成 | LLM Sampling |
| `detect_anomalies` | 异常检测 | 规则+统计 |

**技术要点**：
- 利用 MCP Sampling 能力，让 Server 调用 Client 的 LLM 进行分析
- NPS/CSAT 使用确定性算法，不依赖 LLM
- 情感分析和主题提取通过 Sampling 请求实现

### Phase 4：Remote MCP + 企业级功能（8 周）

**目标**：支持远程部署，面向企业用户

| 能力 | 描述 |
|------|------|
| SSE Transport | 支持 Server-Sent Events 传输 |
| OAuth 2.0 | 标准 OAuth 认证流程 |
| RBAC | 基于角色的权限控制 |
| Webhook 管理 | 创建/删除 Webhook |
| 联系人管理 | 联系人 CRUD |
| 多语言支持 | 国际化 |

### Phase 5：差异化创新（持续）

| 能力 | 描述 | 创新点 |
|------|------|--------|
| Prompt 模板 | 预置调研设计提示词 | 降低 AI 使用门槛 |
| Resource 暴露 | 结构化数据 URI | 便于 AI 上下文获取 |
| 问卷模板库 | NPS/CSAT/员工满意度等模板 | 一键创建 |
| 智能推荐 | 基于历史数据推荐问卷优化 | 独创功能 |
| 批量操作 | 批量创建/分发/分析 | 提高效率 |

---

## 六、差异化竞争力分析

### 6.1 问卷星 MCP vs 竞品的差异化方向

```
                    数据回收    题目编辑    分发管理    AI分析    模板系统
 JotForm MCP        ✅         ✅         ❌          ❌        ❌
 金数据 MCP         ✅         ✅         ❌          ❌        ❌
 SurveyMonkey       ✅(三方)    ✅(三方)    ✅(三方)    ❌        ❌
 问卷星 MCP (规划)   ✅         ✅         ✅          ✅🌟      ✅🌟
```

### 6.2 独创优势（无竞品实现）

1. **AI 原生分析工具**：情感分析、主题提取、NPS/CSAT 计算内置于 MCP
2. **MCP Sampling 利用**：利用 MCP Sampling 机制让 Server 端调用 Client 的 LLM
3. **Prompt 模板系统**：预置调研设计、分析、报告生成的 Prompt 模板
4. **Resource Schema**：暴露结构化数据 URI，支持 AI 自动发现和获取上下文
5. **问卷模板库**：标准化 NPS/CSAT/员工满意度/客户体验等调研模板

### 6.3 技术差异化

| 维度 | JotForm | 金数据 | 问卷星 MCP (规划) |
|------|---------|--------|------------------|
| 语言 | Python | 未知 | **TypeScript** |
| MCP 原语 | Tools only | Tools only | **Tools + Resources + Prompts** |
| AI 分析 | ❌ | ❌ | **✅ Sampling** |
| 传输 | stdio | stdio/SSE | **stdio → SSE → Streamable HTTP** |
| 认证 | API Key | API Key/OAuth | **签名 → OAuth 2.1** |
| 测试 | 基础 | 未知 | **70+ 测试 + 评测集** |

---

## 七、参考资源

### 平台官方
- [JotForm MCP Server (GitHub)](https://github.com/The-AI-Workshops/jotform-mcp-server)
- [JotForm API 文档](https://jotform.com)
- [金数据官网](https://jinshuju.net)
- [SurveyMonkey API 文档](https://surveymonkey.com)
- [SurveySparrow API v3](https://surveysparrow.com)
- [SurveyCake 官网](https://surveycake.com)
- [问卷星 API](https://wjx.cn)

### MCP 生态
- [MCP 协议规范](https://modelcontextprotocol.io)
- [MCP 中文文档](https://mcp-docs.cn)
- [Zapier MCP](https://zapier.com)
- [CData Connect AI](https://cdata.com)
- [Composio MCP](https://composio.dev)
- [Activepieces MCP](https://activepieces.com)
- [Improvado MCP](https://improvado.io)

### 第三方调研
- [mcp.so - MCP Server 目录](https://mcp.so)
- [Truto AI Agent Tools](https://truto.one)

---

## 八、总结

### 当前定位
问卷星 MCP Server 已完成 MVP（4 工具），在中国市场具有先发优势。金数据是最直接的竞争对手（9 工具），JotForm 是全球标杆（20+ 工具）。

### 战略建议
1. **短期（Phase 1-2）**：快速补齐数据回收和题目编辑能力，达到金数据水平
2. **中期（Phase 3）**：打造 AI 原生分析能力作为**杀手级差异化功能**
3. **长期（Phase 4-5）**：Remote MCP + 企业级 + 模板生态，形成完整闭环

### 核心竞争力公式
```
问卷星 MCP = 完整问卷 CRUD + AI 原生分析🌟 + Prompt 模板🌟 + Resource Schema🌟
```

这三个独创能力（AI 分析 + Prompt 模板 + Resource Schema）是目前全球所有问卷平台 MCP 实现中**无人涉足**的领域，代表了下一代问卷调研 MCP Server 的演进方向。
