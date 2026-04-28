# wjx-ai-kit：用 AI 重新定义问卷调研

> 问卷星官方开源 · CLI（主推） + SDK + MCP Server（可选）三合一工具包

---

## 一句话说清楚

**wjx-ai-kit** 是问卷星官方开源的 AI 开发工具包。它让你用自然语言创建问卷、用对话分析数据、用命令行自动化一切——把原来需要反复点击网页的问卷操作，变成 AI 可以直接完成的事。

---

## 🚀 最快开始：把这段话发给你的 AI

不用读文档，不用记命令——把下面这段**完整复制**发给你正在用的任何 AI（Claude Code / Cursor / Windsurf / Cline / Copilot / Trae / Gemini / Qoder / Claw 系列 / Manus / WorkBuddy / QoderWork 等），它会帮你把 CLI 装好：

````text
请帮我安装并配置问卷星 CLI（wjx-cli）：

1. 检查 Node.js 是否 ≥ 20（运行 `node --version`），版本过低请引导我升级到 https://nodejs.org

2. 执行 `npm install -g wjx-cli` 安装 CLI

3. 引导我获取问卷星 API Key：
   - 公网用户：让我访问 https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1 微信扫码登录后复制 Key
   - 私有化部署用户：把上面的 www.wjx.cn 换成我的域名（例如 xxx.sojump.cn）
   等我把 Key 发给你（可能还会附带域名）

4. 拿到 Key 后执行：
   `wjx init --api-key <我的Key>`
   私有化部署用户加 `--base-url https://<我的域名>`

5. 运行 `wjx doctor` 验证连接，应显示 API Key、网络都 ok

6. 最后跑 `wjx survey list --table` 列出我的问卷，看到真实列表就说明接好了
````

**为什么优先装 CLI？** CLI 是 wjx-ai-kit 的主入口：

- ✅ **几乎所有 AI 都能用**：任何能执行 shell 的工具都 OK（不需要 AI 本身支持 MCP 协议）
- ✅ **升级简单**：`npm update -g wjx-cli` 立刻生效，不用重启任何客户端
- ✅ **一次装好处处用**：一个 `wjx init` 配完，所有会话共享
- ✅ **67 子命令 = 全部 API 能力**：问卷、答卷、通讯录、子账号、SSO、分析

### Claude Code 用户：一键安装 Skill（最快捷径）

如果你在用 Claude Code，直接装我们发布到官方 Plugin Marketplace 的 Skill：

```
/plugin marketplace add wjxcom/wjx-ai-kit
/plugin install wjx-cli-use@wjx-ai-kit
```

之后跟 Claude 说"帮我做一份满意度问卷"、"分析下这组 NPS 评分"，它会自动调用 `wjx-cli` 完成。需要时 `/plugin marketplace update` 拉最新版规则。如果客户端原生支持 MCP，也可以再装 `/plugin install wjx-mcp-use@wjx-ai-kit`（次要选项）。

### 想让 AI "直接调工具"而不是"跑命令"？额外配 MCP

如果你用的是 Claude Code / Claude Desktop / Cursor / Windsurf / Cline 等**原生支持 MCP 协议**的工具，可以在 CLI 之外**加装 MCP Server**，AI 对话会更流畅（直接调 58 个工具，无需反复跑命令）。把这段发给 AI：

````text
请帮我在已装 wjx-cli 的基础上，额外接入问卷星 MCP Server：

1. 根据我的 AI 工具自动选择配置方式：
   - Claude Code：执行 `claude mcp add wjx --env WJX_API_KEY=<我的Key> -- npx -y wjx-mcp-server@latest`
     （私有化域名用户加 `--env WJX_BASE_URL=<我的域名>`）
   - 其他 MCP 客户端（Claude Desktop / Cursor / Windsurf / Cline / Copilot / Trae / Gemini / Qoder）：
     找到对应 MCP 配置文件，写入：
     ```json
     {
       "mcpServers": {
         "wjx": {
           "command": "npx",
           "args": ["-y", "wjx-mcp-server@latest"],
           "env": { "WJX_API_KEY": "<我的Key>", "WJX_BASE_URL": "<我的域名，默认不写>" }
         }
       }
     }
     ```

2. 提醒我**完全重启 AI 工具**（不是最小化）让它拉起 MCP server

3. 重启后调用 `list_surveys` 工具验证
````

> **MCP 客户端必须完全重启**：MCP server 是长驻子进程，npm 升级不会自动通知它。我们在配置里用了 `wjx-mcp-server@latest`，重启即拿最新版，不必手动清缓存。
>
> **不支持 MCP 的工具怎么办？** 只用 CLI 即可——WorkBuddy / Manus / QoderWork / 部分 Claw 工具的 MCP 支持还不成熟，CLI 是它们更稳妥的选择。

---

## AI 工具配置指南（手动）

如果你想自己改配置文件、或上面的 AI 自动安装出问题想看具体步骤，按你的工具点对应指南：

| AI 工具 | 一句话说明 | 配置指南 |
|---------|----------|---------|
| **Claude Code** | Agent + Skill 完整支持，终端内完成一切 | [配置指南](./setup-claude-code.md) |
| **Claude Desktop** | 最简单的入门方式，对话即操作 | [配置指南](./setup-claude-desktop.md) |
| **IDE 插件** | Cursor / Windsurf / Cline / Copilot / Trae / Gemini / Qoder | [配置指南](./setup-ide.md) |
| **Claw 系列** | OpenClaw / KimiClaw / QClaw / LinClaw / MaxClaw 等 | [配置指南](./setup-claw.md) |
| **AI 工作台** | Manus / WorkBuddy / QoderWork | [配置指南](./setup-workbench.md) |

---

## 为什么做这件事

AI 正在重塑工作方式——对 AI 说"帮我做一份员工满意度调查"，30 秒就能创建一份专业问卷。同时，企业和研究人员需要把问卷系统和 CRM、HRM、BI 打通，靠网页操作做不到。wjx-ai-kit 就是连接 AI 和问卷星的桥梁。

---

## 三个工具，一个目标

wjx-ai-kit 包含三个包，覆盖从 AI 对话到底层编程的全部场景：

### CLI — AI Agent 原生命令行（主入口，强烈推荐）

wjx-cli 是为 AI Agent 设计的命令行工具，**是 wjx-ai-kit 的主入口**。67 个子命令覆盖问卷星全部 API 能力，输出结构化 JSON，天然适配 AI Agent 工作流和自动化脚本。

- **任何 AI 都能用**：只要工具能跑 shell 就行，不依赖 MCP 协议（覆盖 WorkBuddy / Manus / Claw / Copilot / Gemini 等所有场景）
- **67 个子命令**：问卷、答卷、通讯录、部门、管理员、标签、用户体系、子账号、SSO、数据分析
- **AI Agent 友好**：JSON 输出 + 管道输入 + 结构化错误 + Shell 补全
- **6 个离线分析命令**：NPS、CSAT、异常检测、答卷解码等不需要 API Key
- **升级简单**：`npm update -g wjx-cli` 立即生效，无需重启任何客户端

**适合谁：** 所有用户的默认选择 — 开发者、自动化脚本、非技术用户、各类 AI 工具

### MCP Server — 让 MCP-aware AI 直接调工具（CLI 之外的可选增强）

MCP 是 Anthropic 提出的 AI 工具调用协议。wjx-mcp-server 实现了 **58 个工具**，让 Claude Code、Claude Desktop、Cursor、Windsurf 等**原生支持 MCP 协议**的 AI 客户端可以直接调工具——比"让 AI 跑命令"对话更流畅。

- **58 个 Tools** + **8 个 Resources** + **22 个 Prompts**
- **70+ 题型支持**：单选/多选/矩阵/比重/滑块/文件，**投票**（投票单选/多选）、**表格**（数值/填空/下拉/组合/自增）、专业模型（NPS/360）等全覆盖
- 与 CLI **能力等价**，差别在交互方式：MCP 直接工具调用，CLI 跑 shell 命令

**适合谁：** 已经在用 Claude Code/Desktop/Cursor 等 MCP 原生客户端，且希望在 CLI 之外加一层"无命令"对话体验。**MCP 支持不成熟的工具（WorkBuddy/Manus/部分 Claw）请只用 CLI**。

### SDK — 零依赖 TypeScript 基础层

wjx-api-sdk 是零运行时依赖的 TypeScript SDK，提供 48+ 类型安全的函数，覆盖问卷星 OpenAPI 全部能力。

- **零依赖**：只用 Node.js 内置 API（fetch + crypto），无第三方包
- **70+ 题型**：JSON 路径覆盖单选/多选/矩阵/比重/滑块/排序/文件/绘图、**投票**（投票单选/多选）、**表格**（数值/填空/下拉/组合/自增）、专业模型（NPS/360/双因素）等
- **DSL 双向转换**：纯文本 ↔ 问卷结构体（27 种标签，向后兼容；新代码用 JSON 路径）
- **本地分析引擎**：NPS/CSAT 计算、异常检测、数据解码，无需网络

**适合谁：** 构建调研 SaaS 的开发者、需要集成问卷能力的系统、学术研究自动化

---

## 选择你的工具

```
你想怎么用问卷星？
│
├─ 不确定／最快上手：装 wjx-cli（上面的 🚀 安装提示，推荐）
│
├─ 用的是 Claude Code/Desktop/Cursor 等 MCP 原生工具，想要更流畅对话
│     ──→ CLI 装好之后，再按上面的 MCP 步骤额外加装
│
├─ 命令行爱好者 / 自动化脚本 ──→ CLI 入门指南
│
└─ 构建应用 / 系统集成 ──→ SDK 入门指南
```

### 三层能力递进

wjx-ai-kit 不只是 MCP Server——它还提供 **Agent 定义** 和 **Skill 参考文档**，让 AI 从"能用工具"进化到"懂业务流程"：

| 层级 | 能力 | 说明 |
|------|------|------|
| **MCP 工具层** | 58 个 Tools + 8 Resources + 22 Prompts | 所有 MCP 客户端通用，AI 直接调用 |
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
| 问卷创建（JSON 路径，70+ 题型） | ✅ | ✅ | ✅ |
| 投票题型（投票单选/投票多选） | ✅ | ✅ | ✅ |
| 表格题型（数值/填空/下拉/组合/自增） | ✅ | ✅ | ✅ |
| 矩阵 / 比重 / 滑块 / 排序 / 文件上传 | ✅ | ✅ | ✅ |
| DSL 文本创建问卷（兼容，27 种） | ✅ | ✅ | ✅ |
| 答卷查询/下载/提交（自动 jpmversion） | ✅ | ✅ | ✅ |
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
