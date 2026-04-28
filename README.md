# wjx-ai-kit

> 问卷星 AI 工具套件 — SDK、MCP Server、CLI 三位一体，让 AI Agent 和开发者无缝操控[问卷星](https://www.wjx.cn) OpenAPI。

[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-green)](https://nodejs.org/)
[![npm wjx-api-sdk](https://img.shields.io/npm/v/wjx-api-sdk?label=wjx-api-sdk)](https://www.npmjs.com/package/wjx-api-sdk)
[![npm wjx-mcp-server](https://img.shields.io/npm/v/wjx-mcp-server?label=wjx-mcp-server)](https://www.npmjs.com/package/wjx-mcp-server)
[![npm wjx-cli](https://img.shields.io/npm/v/wjx-cli?label=wjx-cli)](https://www.npmjs.com/package/wjx-cli)
[![npm downloads](https://img.shields.io/npm/dm/wjx-mcp-server?label=downloads)](https://www.npmjs.com/package/wjx-mcp-server)

---

## 项目结构

本仓库采用 npm workspaces 管理三个包：

```
wjx-ai-kit/
├── wjx-api-sdk/       # 零依赖 TypeScript SDK（50+ API 函数）
├── wjx-mcp-server/    # MCP Server（58 Tools / 8 Resources / 22 Prompts）
├── wjx-cli/           # 命令行工具（AI Agent 原生 CLI）
├── wjx-agents/        # 2 个专家 Agent 定义
├── wjx-skills/        # 2 套 Skill 参考文档（可打包分发 zip）
├── wjx-docs/          # 使用文档 + AI 工具配置指南
└── package.json       # workspace 根配置
```

| 包                                   | 版本     | 角色 | 说明                                                                                |
| ----------------------------------- | ------ | --- | --------------------------------------------------------------------------------- |
| [`wjx-cli`](wjx-cli/)               | 0.3.1 | **主推** | 命令行工具。67 子命令，支持 stdin pipe、JSON/表格输出。任意能跑 shell 的 AI 客户端都可用 |
| [`wjx-api-sdk`](wjx-api-sdk/)       | 0.3.1 | 基础 | 零依赖 TypeScript SDK。8 模块、48+ 函数，可在任意 Node.js 项目中使用                                 |
| [`wjx-mcp-server`](wjx-mcp-server/) | 0.3.1 | 可选 | [MCP](https://modelcontextprotocol.io/) Server。仅适用于原生支持 MCP 协议的客户端（Claude Code/Desktop、Cursor、Cline 等）。功能与 CLI 等价；如不确定优先选 CLI |

---

## ⚡ 在 Claude Code 一键装 Skill（推荐）

`wjx-ai-kit` 本身就是一个 Claude Code Plugin Marketplace。在 Claude Code 里执行：

```
/plugin marketplace add wjxcom/wjx-ai-kit
/plugin install wjx-cli-use@wjx-ai-kit
```

之后跟 Claude 说"帮我做一份满意度问卷"、"分析下这组 NPS 评分"、"导出问卷 12345 的答卷"——它会自动调用 `wjx-cli` 完成。后续 SKILL 更新时执行 `/plugin marketplace update` 即可拉到最新版。

如果你的客户端原生支持 MCP 协议（Claude Code/Desktop、Cursor、Cline），也可以装 MCP 版（次要选项）：

```
/plugin install wjx-mcp-use@wjx-ai-kit
```

---

## AI 工具配置指南

在你的 AI 工具中接入问卷星，用自然语言创建问卷、分析数据、管理通讯录。

| AI 工具 | 配置指南 |
|---------|---------|
| **Claude Code** | [setup-claude-code.md](wjx-docs/setup-claude-code.md) |
| **Claude Desktop** | [setup-claude-desktop.md](wjx-docs/setup-claude-desktop.md) |
| **IDE 插件**（Cursor / Windsurf / Cline / Copilot / Trae / Gemini / Qoder） | [setup-ide.md](wjx-docs/setup-ide.md) |
| **Claw 系列**（OpenClaw / KimiClaw / QClaw / LinClaw / MaxClaw 等） | [setup-claw.md](wjx-docs/setup-claw.md) |
| **AI 工作台**（Manus / WorkBuddy / QoderWork） | [setup-workbench.md](wjx-docs/setup-workbench.md) |

---

## 架构关系

```
┌─────────────────────────────────────────────┐
│              AI 客户端 / 脚本                 │
├──────────┬──────────────┬───────────────────┤
│ wjx-cli  │ wjx-mcp-server │  你的 Node.js 项目  │
│  (CLI)   │  (MCP Server)  │                   │
├──────────┴──────────────┴───────────────────┤
│              wjx-api-sdk                     │
│         （统一 API 客户端层）                  │
├─────────────────────────────────────────────┤
│           问卷星 OpenAPI                      │
└─────────────────────────────────────────────┘
```

`wjx-api-sdk` 是基础层，`wjx-mcp-server` 和 `wjx-cli` 都依赖它。

---

## 快速开始

### 前置条件

- **Node.js >= 20**
- **问卷星 OpenAPI API Key** — 微信扫码登录 [API Key 获取页](https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1)，登录后页面直接显示 API Key

### 安装

**从 npm 安装（推荐）**

```bash
# SDK — 在你的 Node.js 项目中使用
npm install wjx-api-sdk

# CLI — 全局安装命令行工具
npm install -g wjx-cli
```

**从源码安装（开发者）**

```bash
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit
npm install
```

### 使用方式一：CLI（推荐）

适合脚本、CI/CD、AI Agent 工具调用，几乎所有 AI 客户端通用（不需要 MCP 协议）。

```bash
# 全局安装
npm install -g wjx-cli

# 使用
export WJX_API_KEY=your_api_key
wjx survey list
wjx response query --vid 12345
```

详见 [wjx-cli/README.md](wjx-cli/README.md)。

### 使用方式二：SDK（编程集成）

适合在你自己的 Node.js 项目中调用问卷星 API。

```bash
npm install wjx-api-sdk
```

```typescript
import { listSurveys, createSurvey } from "wjx-api-sdk";

const creds = { apiKey: "your_api_key" };

// 列出问卷
const surveys = await listSurveys({ page_index: 1, page_size: 10 }, creds);

// 创建问卷
const result = await createSurvey({
  title: "客户满意度调查",
  type: 0,
  questions: "[]",
}, creds);
```

详见 [wjx-api-sdk/README.md](wjx-api-sdk/README.md)。

### 使用方式三：MCP Server（可选）

仅适用于原生支持 MCP 协议的客户端（Claude Code/Desktop、Cursor、Cline 等）。功能与 CLI 等价；如果你的客户端能跑 shell，**优先选 CLI**——升级、维护、跨平台都更省心。

```bash
# 配置环境变量
echo "WJX_API_KEY=your_api_key" > wjx-mcp-server/.env

# 构建并启动
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-mcp-server
npm start --workspace=wjx-mcp-server
```

详见 [wjx-mcp-server/README.md](wjx-mcp-server/README.md) 了解集成配置，或查看上方 **AI 工具配置指南** 找到你使用的工具。

---

## 文档

完整的使用文档和指南位于 [`wjx-docs/`](wjx-docs/) 目录：

| 文档 | 说明 |
|------|------|
| [总纲](wjx-docs/00-overview.md) | 功能全景、选择引导、场景速览 |
| [CLI 入门](wjx-docs/cli-getting-started.md) | **（推荐）** 命令行快速上手 |
| [CLI 进阶](wjx-docs/cli-advanced.md) | 70 命令完全攻略、Skill 系统 |
| [SDK 入门](wjx-docs/sdk-getting-started.md) | TypeScript 开发快速上手 |
| [SDK 进阶](wjx-docs/sdk-advanced.md) | DSL、分析引擎、Webhook 解密 |
| [MCP 入门](wjx-docs/mcp-getting-started.md) | （可选）MCP Server 快速接入 |
| [MCP 进阶](wjx-docs/mcp-advanced.md) | （可选）58 工具深度用法、HTTP 部署、Docker |

---

## 开发

```bash
# 安装所有 workspace 依赖
npm install

# 构建所有包（SDK 必须先构建）
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-mcp-server
npm run build --workspace=wjx-cli

# 运行所有测试
npm test --workspace=wjx-api-sdk      # ~623 tests
npm test --workspace=wjx-mcp-server   # ~280 tests
npm test --workspace=wjx-cli          # ~133 tests
```

### 环境变量

| 变量 | 必填 | 说明 |
|---|:---:|---|
| `WJX_API_KEY` | 是 | 问卷星 OpenAPI API Key |
| `WJX_CORP_ID` | 否 | 企业通讯录 ID（通讯录相关操作需要） |
| `WJX_BASE_URL` | 否 | 自定义 API 基础域名（默认 `https://www.wjx.cn`） |
| `MCP_TRANSPORT` | 否 | MCP 传输模式：`stdio`（默认）或 `http` |
| `PORT` | 否 | HTTP 模式端口（默认 3000） |

---

## 贡献

欢迎贡献！请参阅 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献指南。

## 许可证

[MIT](LICENSE)
