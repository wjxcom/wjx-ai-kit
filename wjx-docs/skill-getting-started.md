# Skill 包入门指南

> 两条命令，你的 AI 助手就能操作问卷星了。

---

## 什么是问卷星 Skill

Skill 是一种让 AI 助手获得特定能力的方式。问卷星 Skill 包含：

- **SKILL.md** -- AI 读取的使用指南，告诉它怎么操作问卷星
- **references/** -- 详细参考文档，AI 按需查阅

安装后，你对 AI 说 "帮我创建一份问卷"，它就知道该怎么做了。

---

## 三种接入方式对比

| | MCP Server | Skill 包 | CLI |
|---|---|---|---|
| **适合谁** | 所有 AI 工具用户 | Claw 系列 / 不想配 MCP 的用户 | 命令行 / 自动化脚本用户 |
| **能力** | 56 个工具 + AI 自动调用 | AI 读取指南 + 调用 CLI 命令 | 69 个子命令 |
| **安装** | 一行 npx 命令 | `npm install -g wjx-cli` | `npm install -g wjx-cli` |
| **配置复杂度** | 低 | 最低 | 最低 |
| **适合的 AI 工具** | Claude/Cursor/Windsurf/Cline/... | OpenClaw/KimiClaw/QClaw/... | 任何有终端的环境 |

**推荐**：
- 如果你的 AI 工具支持 MCP，优先用 MCP Server（能力最强）
- 如果你用 Claw 系列工具或想要最简安装，用 Skill 包
- 如果你主要做自动化脚本，直接用 CLI

---

## 快速开始：让 AI 帮你安装

你已经在 AI 工具里了，直接让 AI 完��安装。复制下面的话发给你的 AI 助手：

> 请帮我安装问卷星工具：
> 1. 运行 `npm install -g wjx-cli` 安装问卷星 CLI
> 2. 安装完成后，告诉我去这个链接获取 API Key：https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1 ，等我把 Key 发给你
> 3. 拿到我的 Key 后运行 `wjx init --api-key <我的Key>` 完成配置
> 4. 最后运行 `wjx doctor` 验证连接

AI 会自动执行安装，然后等你提供 API Key。你微信扫码登录后，把 Key 发给 AI（例如"这是 API Key：sk-wjx-xxx，请继续"），AI 就能帮你完成配置。

安装完成后，直接对 AI 说：

> "帮我创建一份客户满意度调查，包含 NPS 评分题和 5 个维度的量表题"

AI 会自动调用 `wjx` 命令创建问卷，返回编辑链接和填写链接。

---

## 手动安装

如果你更喜欢自己操作：

```bash
# 安装 CLI
npm install -g wjx-cli

# 配置 API Key（交互式，按提示操作）
wjx init

# 验证连接
wjx doctor

# 安装 AI 技能包到当前目录
wjx skill install
```

安装完成后，根据你的 AI 工具，将 Skill 目录添加到对应位置：

**OpenClaw / KimiClaw / QClaw / LinClaw**：
在工具的 Skills/技能 设置中，添加 `wjx-cli-use` 目录路径。

**Claude Code**：
`wjx skill install` 会自动安装到 `.claude/agents/`，无需额外操作。

**其他工具**：
将 `SKILL.md` 的内容添加到工具的系统提示或 Rules 文件中。

---

## 离线安装（无 npm 环境）

如果无法使用 npm，可下载 Skill 包：

1. 下载 [wjx-cli-use-skill-latest.zip](https://pubdz.paperol.cn/wjx-ai-kit/skills/wjx-cli-use-skill-latest.zip)
2. 解压并提��其中的 `wjx-cli-use` 目录到 AI 工具的技能目录
3. 仍需安装 CLI 并配置 API Key：
   ```bash
   npm install -g wjx-cli
   wjx init
   ```

详见 [CLI 入门指南](./cli-getting-started.md)。

---

## 环境要求

- **Node.js >= 20**（[下载](https://nodejs.org)）
- **问卷星账号**（微信扫码即可注册登录）
- 支持系统：macOS、Linux、Windows

---

## 与 MCP Server 的关系

```
┌──────────────────────────────────────┐
│          你的 AI 助手                 ��
├──────────┬───────────────────────────┤
│ Skill 包  │     MCP Server           │
│ (读 SKILL.md │  (56 个工具直接调用)     │
│  调 wjx 命令) │                        │
├──────────┴───────────────────────────┤
│           wjx-cli (69 子命令)         │
├──────────────────────────────────────┤
│           wjx-api-sdk (基础层)        │
├──────────────────────────────────────┤
│           问卷星 OpenAPI              │
└──────────────────────────────────────┘
```

- **Skill 包**：AI 读取 SKILL.md 学会用法，通过 `wjx` CLI 命令操作问卷星
- **MCP Server**：AI 通过 MCP 协议直接调用 56 个工具，不需要命令行

两者底层都走 `wjx-api-sdk`，能力一致。MCP Server 的工具调用更高效，Skill 包的安装更简单。

---

## 常见问题

**Q: 我需要同时装 MCP Server 和 Skill 包吗？**

不需要。选一种就行。如果你的 AI 工具支持 MCP，推荐用 MCP Server。

**Q: npm install 报错怎么办？**

需要 Node.js 20 以上。访问 [nodejs.org](https://nodejs.org) 下载最新 LTS 版本。安装��运行 `node --version` 确认版本号 >= 20。

**Q: API Key 在哪里找？**

打开 [这个链接](https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1)，微信扫码登录后直接显示。

**Q: 拿到 API Key 后怎么告诉 AI？**

直接把 Key 发给 AI 即可，例如"这是 API Key：sk-wjx-xxx，请继续"。AI 会自动执行 `wjx init --api-key <你的Key>` 完成配置。

---

## 深入了解

- [MCP Server 入门指南](./mcp-getting-started.md) -- 用 MCP 接入更多 AI 工具
- [CLI 入门指南](./cli-getting-started.md) -- 命令行完整用法
- [SDK 入门指南](./sdk-getting-started.md) -- TypeScript 开发集成
- [总纲](./00-overview.md) -- 功能全景和选择引导
