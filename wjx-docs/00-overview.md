# wjx-ai-kit：用 AI 重新定义问卷调研

> 问卷星官方开源 · TypeScript SDK + MCP Server + CLI 三合一工具包

---

## 一句话说清楚

**wjx-ai-kit** 是问卷星官方开源的 AI 开发工具包。它让你用自然语言创建问卷、用对话分析数据、用命令行自动化一切——把原来需要反复点击网页的问卷操作，变成 AI 可以直接完成的事。

---

## AI 工具配置指南

在你常用的 AI 工具中接入问卷星。点击对应指南，5 分钟内完成配置。

| AI 工具 | 一句话说明 | 配置指南 |
|---------|----------|---------|
| **Claude Code** | Agent + Skill 完整支持，终端内完成一切 | [配置指南](./setup-claude-code.md) |
| **Claude Desktop** | 最简单的入门方式，对话即操作 | [配置指南](./setup-claude-desktop.md) |
| **IDE 插件** | Cursor / Windsurf / Cline / Copilot / Trae / Gemini / Qoder | [配置指南](./setup-ide.md) |
| **Claw 系列** | OpenClaw / KimiClaw / QClaw / LinClaw / MaxClaw 等 | [配置指南](./setup-claw.md) |
| **AI 工作台** | Manus / WorkBuddy / QoderWork | [配置指南](./setup-workbench.md) |

> 不确定该用哪个？先试 [Skill 包入门指南](./skill-getting-started.md)，让 AI 一句话帮你安装，最快上手。

---

## 为什么做这件事

AI 正在重塑工作方式——对 AI 说"帮我做一份员工满意度调查"，30 秒就能创建一份专业问卷。同时，企业和研究人员需要把问卷系统和 CRM、HRM、BI 打通，靠网页操作做不到。wjx-ai-kit 就是连接 AI 和问卷星的桥梁。

---

## 三个工具，一个目标

wjx-ai-kit 包含三个包，覆盖从 AI 对话到底层编程的全部场景：

### MCP Server — 让 AI 直接操作问卷星

MCP 是 Anthropic 提出的 AI 工具调用协议。wjx-mcp-server 实现了 **58 个工具**，让 Claude、Cursor、Windsurf 等 AI 客户端可以直接操作问卷星。

- **58 个 Tools** + **8 个 Resources** + **23 个 Prompts**
- 开箱即用：配置 API Key，接入你的 AI 工具即可使用

**适合谁：** 使用 AI 编程工具的开发者、想用自然语言管理问卷的企业用户

### CLI — AI Agent 原生命令行

wjx-cli 是为 AI Agent 设计的命令行工具。67 个子命令覆盖问卷星全部 API 能力，输出结构化 JSON，天然适配 AI Agent 工作流和自动化脚本。

- **67 个子命令**：问卷、答卷、通讯录、部门、管理员、标签、用户体系、子账号、SSO、数据分析
- **AI Agent 友好**：JSON 输出 + 管道输入 + 结构化错误 + Shell 补全
- **6 个离线分析命令**：NPS、CSAT、异常检测、答卷解码等不需要 API Key

**适合谁：** AI Agent 开发者、自动化脚本编写者、命令行爱好者

### SDK — 零依赖 TypeScript 基础层

wjx-api-sdk 是零运行时依赖的 TypeScript SDK，提供 48+ 类型安全的函数，覆盖问卷星 OpenAPI 全部能力。

- **零依赖**：只用 Node.js 内置 API（fetch + crypto），无第三方包
- **DSL 双向转换**：纯文本 ↔ 问卷结构体，支持 27 种题型标签
- **本地分析引擎**：NPS/CSAT 计算、异常检测、数据解码，无需网络

**适合谁：** 构建调研 SaaS 的开发者、需要集成问卷能力的系统、学术研究自动化

---

## 选择你的工具

```
你想怎么用问卷星？
│
├─ 最快上手：让 AI 帮你装 ──→ Skill 包入门指南
│
├─ 在 AI 对话中操作 ──→ 选择你的 AI 工具（见上方配置指南）
│
├─ 命令行 / 自动化脚本 ──→ CLI 入门指南
│
└─ 构建应用 / 系统集成 ──→ SDK 入门指南
```

### 三层能力递进

wjx-ai-kit 不只是 MCP Server——它还提供 **Agent 定义** 和 **Skill 参考文档**，让 AI 从"能用工具"进化到"懂业务流程"：

| 层级 | 能力 | 说明 |
|------|------|------|
| **MCP 工具层** | 58 个 Tools + 8 Resources + 23 Prompts | 所有 MCP 客户端通用，AI 直接调用 |
| **Agent 层** | 2 个专家 Agent（MCP 专家 / CLI 专家） | 内置工作流和安全规范，自动编排多步操作 |
| **Skill 层** | 2 套渐进式参考文档 | Agent 按需读取参数细节，无需预加载全部知识 |

> **对比**：大多数同类工具只有工具层。问卷星的 Agent + Skill 体系让 AI 像问卷星专家一样主动规划工作流。

### Skill 市场

| 市场 | 安装方式 |
|------|----------|
| **[Vercel Agent Skills](https://skills.sh/wjxcom/wjx-ai-kit)** | `npx skills add wjxcom/wjx-ai-kit` |
| **[ClawHub](https://clawhub.ai/skills?q=wjx)** | 搜索 "wjx" 安装 |

---

## 能力全景

| 能力 | SDK | MCP Server | CLI |
|------|:---:|:----------:|:---:|
| 问卷创建/编辑/删除 | ✅ | ✅ | ✅ |
| DSL 文本创建问卷 | ✅ | ✅ | ✅ |
| 答卷查询/下载/提交 | ✅ | ✅ | ✅ |
| 统计报告 | ✅ | ✅ | ✅ |
| 通讯录管理 | ✅ | ✅ | ✅ |
| 部门/标签管理 | ✅ | ✅ | ✅ |
| 用户体系/参与者 | ✅ | ✅ | ✅ |
| 子账号管理 | ✅ | ✅ | ✅ |
| SSO 单点登录 | ✅ | ✅ | ✅ |
| NPS/CSAT 计算 | ✅ | ✅ | ✅ |
| 异常检测 | ✅ | ✅ | ✅ |
| Webhook 解密 | ✅ | ✅ | ✅ |
| AI Prompt 模板 | - | ✅ 19 个 | - |
| AI 参考资源 | - | ✅ 8 个 | - |
| Claude Code 技能 | - | - | ✅ |
| Shell 补全 | - | - | ✅ |
| Docker 部署 | - | ✅ | - |

---

## 参与贡献

wjx-ai-kit 是问卷星官方开源项目，采用 MIT 协议，欢迎社区贡献。

- GitHub: [github.com/wjxcom/wjx-ai-kit](https://github.com/wjxcom/wjx-ai-kit)
- Issues: [提交反馈](https://github.com/wjxcom/wjx-ai-kit/issues)
- npm: [wjx-api-sdk](https://www.npmjs.com/package/wjx-api-sdk) · [wjx-mcp-server](https://www.npmjs.com/package/wjx-mcp-server) · [wjx-cli](https://www.npmjs.com/package/wjx-cli)
- Skill 市场: [Vercel Agent Skills](https://skills.sh/wjxcom/wjx-ai-kit) · [ClawHub](https://clawhub.ai/skills?q=wjx)

---

## 深入了解

### 入门指南

- [Skill 包入门指南](./skill-getting-started.md) — 最快上手，让 AI 一句话帮你安装
- [MCP Server 入门指南](./mcp-getting-started.md) — 5 分钟接入 Claude/Cursor
- [CLI 入门指南](./cli-getting-started.md) — 命令行快速上手
- [SDK 入门指南](./sdk-getting-started.md) — TypeScript 开发快速上手

### 进阶指南

- [MCP Server 进阶指南](./mcp-advanced.md) — 58 个工具深度用法、HTTP 部署、Docker
- [CLI 进阶指南](./cli-advanced.md) — 67 个命令完全攻略、Skill 系统
- [SDK 进阶指南](./sdk-advanced.md) — DSL 引擎、分析函数、Webhook 解密
