# wjx-ai-kit

> 问卷星 AI 工具套件 — SDK、MCP Server、CLI 三位一体，让 AI Agent 和开发者无缝操控[问卷星](https://www.wjx.cn) OpenAPI。

[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-green)](https://nodejs.org/)

---

## 项目结构

本仓库采用 npm workspaces 管理三个包：

```
wjx-ai-kit/
├── wjx-api-sdk/       # 零依赖 TypeScript SDK（50+ API 函数）
├── wjx-mcp-server/    # MCP Server（56 Tools / 8 Resources / 19 Prompts）
├── wjx-cli/           # 命令行工具（AI Agent 原生 CLI）
└── package.json       # workspace 根配置
```

| 包 | 版本 | 说明 |
|---|---|---|
| [`wjx-api-sdk`](wjx-api-sdk/) | 0.1.5 | 零 MCP 依赖的问卷星 OpenAPI 客户端。8 模块、50+ 函数，可在任意 Node.js 项目中使用 |
| [`wjx-mcp-server`](wjx-mcp-server/) | 0.1.4 | [Model Context Protocol](https://modelcontextprotocol.io/) 服务器。接入 Claude、Cursor 等 AI 客户端 |
| [`wjx-cli`](wjx-cli/) | 0.1.10 | 命令行工具。支持 `wjx survey list`、stdin pipe、JSON/表格输出 |

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
- **问卷星 OpenAPI API Key**

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
git clone https://codeup.aliyun.com/6445da2d020eabef3107e22e/wjxfc/wjxagents.git
cd wjxagents/wjx-ai-kit
npm install
```

### 使用方式一：MCP Server（AI 客户端集成）

适合 Claude Desktop、Cursor、Claude Code 等 AI 客户端。

```bash
# 配置环境变量
echo "WJX_API_KEY=your_api_key" > wjx-mcp-server/.env

# 构建并启动
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-mcp-server
npm start --workspace=wjx-mcp-server
```

详见 [wjx-mcp-server/README.md](wjx-mcp-server/README.md) 了解 Claude Desktop / Cursor 集成配置。

### 使用方式二：CLI（命令行）

适合脚本、CI/CD、AI Agent 工具调用。

```bash
# 全局安装
npm install -g wjx-cli

# 使用
export WJX_API_KEY=your_api_key
wjx survey list
wjx response query --vid 12345
```

详见 [wjx-cli/README.md](wjx-cli/README.md)。

### 使用方式三：SDK（编程集成）

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
npm test --workspace=wjx-mcp-server   # ~282 tests
npm test --workspace=wjx-cli          # ~122 tests
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
