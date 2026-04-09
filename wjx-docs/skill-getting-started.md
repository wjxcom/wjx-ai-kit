# Skill 包入门指南

> 下载一个文件夹，运行一个脚本，你的 AI 助手就能操作问卷星了。

---

## 什么是问卷星 Skill

Skill 是一种让 AI 助手获得特定能力的方式。问卷星 Skill 包含：

- **SKILL.md** -- AI 读取的使用指南，告诉它怎么操作问卷星
- **references/** -- 详细参考文档，AI 按需查阅
- **setup.sh** -- 一键安装脚本
- **examples/** -- DSL 示例文件，可直接用于创建问卷

安装后，你对 AI 说 "帮我创建一份问卷"，它就知道该怎么做了。

---

## 三种接入方式对比

| | MCP Server | Skill 包 | CLI |
|---|---|---|---|
| **适合谁** | 所有 AI 工具用户 | Claw 系列 / 不想配 MCP 的用户 | 命令行 / 自动化脚本用户 |
| **能力** | 56 个工具 + AI 自动调用 | AI 读取指南 + 调用 CLI 命令 | 69 个子命令 |
| **安装** | 一行 npx 命令 | 下载 zip + `setup.sh` | `npm install -g wjx-cli` |
| **配置复杂度** | 低 | 最低 | 最低 |
| **适合的 AI 工具** | Claude/Cursor/Windsurf/Cline/... | OpenClaw/KimiClaw/QClaw/... | 任何有终端的环境 |

**推荐**：
- 如果你的 AI 工具支持 MCP，优先用 MCP Server（能力最强）
- 如果你用 Claw 系列工具或想要最简安装，用 Skill 包
- 如果你主要做自动化脚本，直接用 CLI

---

## 快速开始：让 AI 帮你安装

你已经在 AI 工具里了，直接让 AI 完成安装。复制下面的话发给你的 AI 助手：

> 请帮我安装问卷星 Skill：下载 https://pubdz.paperol.cn/wjx-ai-kit/skills/wjx-cli-use-skill-latest.zip 并解压到当前目录，然后运行 `bash wjx-cli-use/setup.sh -y` 完成安装。

AI 会自动执行以下步骤：
1. 下载并解压 Skill 包
2. 检测 Node.js 20+
3. 安装 wjx-cli 命令行工具
4. 打开浏览器，微信扫码登录问卷星获取 API Key
5. 运行 `wjx init` 配置 API Key
6. 运行 `wjx doctor` 验证连接

安装完成后，直接对 AI 说：

> "帮我创建一份客户满意度调查，包含 NPS 评分题和 5 个维度的量表题"

AI 会自动调用 `wjx` 命令创建问卷，返回编辑链接和填写链接。

---

## 手动安装

如果你更喜欢自己操作，或者 AI 工具没有终端权限：

### 第一步：下载并解压

```bash
curl -L -o wjx-cli-use-skill-latest.zip https://pubdz.paperol.cn/wjx-ai-kit/skills/wjx-cli-use-skill-latest.zip
unzip wjx-cli-use-skill-latest.zip
```

也可以直接在浏览器打开 [下载链接](https://pubdz.paperol.cn/wjx-ai-kit/skills/wjx-cli-use-skill-latest.zip) 下载。

如果已安装 wjx-cli，也可用命令安装：

```bash
wjx skill install
```

### 第二步：运行安装脚本

```bash
cd wjx-cli-use
bash setup.sh -y
```

### 第三步：在 AI 工具中启用

根据你使用的 AI 工具，将 Skill 目录添加到对应位置：

**OpenClaw / KimiClaw / QClaw / LinClaw**：
在工具的 Skills/技能 设置中，添加 `wjx-cli-use` 目录路径。

**Claude Code**：
```bash
wjx skill install   # 自动安装到 .claude/agents/
```

**其他工具**：
将 `SKILL.md` 的内容添加到工具的系统提示或 Rules 文件中。

---

## 其他安装选项

```bash
bash setup.sh          # 交互式安装（逐步确认）
bash setup.sh -c       # 仅检查环境，不安装
bash setup.sh -v       # 验证已有安装是否完整
bash setup.sh -h       # 显示帮助
```

---

## 环境要求

- **Node.js >= 20**（[下载](https://nodejs.org)）
- **问卷星账号**（微信扫码即可注册登录）
- 支持系统：macOS、Linux、Windows

---

## 与 MCP Server 的关系

```
┌──────────────────────────────────────┐
│          你的 AI 助手                 │
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

**Q: setup.sh 报错 "Node.js 版本过低" 怎么办？**

需要 Node.js 20 以上。访问 [nodejs.org](https://nodejs.org) 下载最新 LTS 版本，或用包管理器升级：
```bash
# macOS
brew install node
# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs
```

**Q: 无法打开浏览器获取 API Key 怎么办？**

在没有桌面环境的服务器上，脚本会打印链接。复制链接到本机浏览器打开，微信扫码登录后获取 API Key。

**Q: API Key 在哪里找？**

打开 [这个链接](https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1)，微信扫码登录后直接显示。

---

## 深入了解

- [MCP Server 入门指南](./mcp-getting-started.md) -- 用 MCP 接入更多 AI 工具
- [CLI 入门指南](./cli-getting-started.md) -- 命令行完整用法
- [SDK 入门指南](./sdk-getting-started.md) -- TypeScript 开发集成
- [总纲](./00-overview.md) -- 功能全景和选择引导
