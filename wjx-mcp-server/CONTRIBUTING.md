# Contributing to WJX MCP Server

感谢你对本项目的关注！以下指南将帮助你快速参与开发。

---

## 开发环境搭建

### 前置条件

- **Node.js >= 20**（推荐使用 [nvm](https://github.com/nvm-sh/nvm) 管理版本）
- **npm**（随 Node.js 一同安装）
- **Git**

### 初始化

```bash
# 1. 克隆仓库
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit

# 2. 安装依赖（在仓库根目录执行）
npm install

# 3. 构建（SDK 必须先构建，wjx-mcp-server 依赖它）
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-mcp-server

# 4. 运行测试
npm test --workspace=wjx-mcp-server
```

> 也可先 `cd wjx-mcp-server`，再直接运行包内脚本 `npm run build` / `npm test`。

### 可选：配置本地运行环境

如果你需要本地启动服务器进行手动调试（在仓库根目录执行）：

```bash
# Linux / macOS
cp wjx-mcp-server/.env.example wjx-mcp-server/.env

# Windows PowerShell
Copy-Item wjx-mcp-server/.env.example wjx-mcp-server/.env

# 编辑 wjx-mcp-server/.env，填入你的问卷星 OpenAPI 凭据
```

---

## 代码规范

### TypeScript

- **Strict 模式** — `tsconfig.json` 已启用 `"strict": true`，所有代码必须通过严格类型检查
- **ESM** — 项目使用 ES Modules（`"type": "module"`），导入路径必须带 `.js` 后缀
- **Target** — ES2022，Module 为 NodeNext

### 输入校验

- 所有 tool 的 `inputSchema` 使用 **Zod** 定义，确保参数在运行时得到校验
- 新增参数时优先使用 Zod 内置的 `.describe()` 提供中文描述

### 代码风格

- 使用项目已有的 `toolResult()` 和 `toolError()` helper 统一 tool 返回格式
- 模块内部函数保持职责单一：client 负责 API 调用，tools 负责注册与编排，types 负责类型定义
- 运行时零额外依赖 — 仅允许 `@modelcontextprotocol/sdk` 和 `zod`

---

## 测试

项目使用 Node.js 内置测试运行器（`node:test`），无需额外测试框架。

```bash
# 全部测试（构建 + 单元 + 集成）
npm test --workspace=wjx-mcp-server

# 仅单元测试
npm run test:unit --workspace=wjx-mcp-server

# 仅集成测试
npm run test:integration --workspace=wjx-mcp-server
```

### 测试要求

- 当前测试套件包含 **280+ 用例**，提交前请确保全部通过
- **新增 tool 必须有对应的单元测试**
- 单元测试放在 `__tests__/` 目录，集成测试放在 `tests/` 目录
- 测试文件使用 `.test.mjs` 扩展名

### CI 流水线

提交前请确保：

1. `npm run build --workspace=wjx-mcp-server` — 编译 TypeScript
2. `npm test --workspace=wjx-mcp-server` — 运行全部测试
3. `npm audit --omit=dev` — 安全审计

---

## Pull Request 流程

### 1. 创建分支

```bash
# 从最新的 develop 分支创建特性分支
git checkout develop
git pull origin develop
git checkout -b feat/your-feature-name
```

### 2. 开发与提交

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>: <description>

# 常用 type:
# feat     — 新功能
# fix      — Bug 修复
# docs     — 文档变更
# test     — 测试相关
# refactor — 重构（无功能变更）
# ci       — CI/CD 变更
# chore    — 构建或辅助工具变更
```

示例：

```bash
git commit -m "feat: add batch survey export tool"
git commit -m "fix: correct NPS score calculation for edge case"
git commit -m "docs: update API reference for contacts module"
```

### 3. 推送并创建 PR

```bash
git push origin feat/your-feature-name
```

创建 Pull Request，目标分支为 `develop`。请在描述中说明：

- **Summary** — 简要说明变更内容
- **Changes** — 列出具体修改项
- **Testing** — 说明测试方式

---

## 新模块添加指引

每个业务模块位于 `src/modules/<name>/`，包含三个标准文件：

```
src/modules/<name>/
├── client.ts   # API 调用逻辑（使用 callWjxApi）
├── tools.ts    # MCP tool 注册（registerXxxTools 函数）
└── types.ts    # TypeScript 类型与接口定义
```

### 步骤

1. **创建模块目录和文件**

```bash
mkdir src/modules/your-module
touch src/modules/your-module/{client,tools,types}.ts
```

2. **定义类型**（`types.ts`）— 定义 API 请求/响应接口

3. **实现 client**（`client.ts`）— 封装问卷星 API 调用

4. **注册 tools**（`tools.ts`）— 导出 `registerYourModuleTools(server: McpServer)` 函数，使用 Zod 定义 inputSchema

5. **在 server.ts 中注册** — 导入并调用注册函数：

```typescript
// src/server.ts
import { registerYourModuleTools } from "./modules/your-module/tools.js";

// 在 createServer() 内添加：
registerYourModuleTools(server);
```

6. **编写测试** — 在 `__tests__/` 中添加对应的 `.test.mjs` 文件

---

## 新 Tool 添加指引

在已有模块中添加新 tool：

1. 在对应模块的 `tools.ts` 中使用 `server.registerTool()` 注册：

```typescript
server.registerTool(
  "tool_name",
  {
    title: "工具标题",
    description: "工具描述，说明用途和注意事项。",
    inputSchema: {
      paramName: z.string().describe("参数描述"),
    },
    annotations: {
      openWorldHint: false,      // 是否调用外部 API
      destructiveHint: false,    // 是否为破坏性操作
      idempotentHint: true,      // 是否幂等
      title: "工具标题",
    },
  },
  async (args) => {
    try {
      const result = await yourClientFunction(args.paramName);
      return toolResult(result, false);
    } catch (error) {
      return toolError(error);
    }
  },
);
```

2. 如涉及新 API 调用，在 `client.ts` 中新增对应函数
3. 在 `__tests__/` 中为新 tool 添加测试用例
4. 更新 README.md 中的 tool 计数和模块表格

---

## 需要帮助？

- 查看 [架构设计文档](docs/architecture.md) 了解整体结构
- 查看 [问卷星 OpenAPI 参考](docs/wjx-openapi-spec.md) 了解 API 规范
- 提交 Issue 讨论新功能或报告问题
