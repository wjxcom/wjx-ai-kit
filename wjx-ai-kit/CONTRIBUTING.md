# Contributing to wjx-ai-kit

感谢你对本项目的关注！以下指南将帮助你快速参与开发。

---

## 开发环境搭建

### 前置条件

- **Node.js >= 20**（推荐使用 [nvm](https://github.com/nvm-sh/nvm) 管理版本）
- **npm**（随 Node.js 一同安装）
- **Git**

### 初始化

```bash
git clone https://codeup.aliyun.com/6445da2d020eabef3107e22e/wjxfc/wjxagents.git
cd wjxagents/wjx-ai-kit
npm install
```

### 构建

构建顺序很重要 — **wjx-api-sdk 必须先构建**（其他两个包都依赖它）：

```bash
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-mcp-server
npm run build --workspace=wjx-cli
```

### 运行测试

```bash
npm test --workspace=wjx-api-sdk        # ~623 tests
npm test --workspace=wjx-mcp-server     # ~280 tests
npm test --workspace=wjx-cli            # ~122 tests
```

---

## 项目结构

```
wjx-ai-kit/
├── wjx-api-sdk/       # 零依赖 TypeScript SDK（基础层）
├── wjx-mcp-server/    # MCP Server（依赖 SDK）
├── wjx-cli/           # CLI 命令行工具（依赖 SDK）
├── wjx-agents/        # Claude Code Agent 定义
├── wjx-skills/        # Agent Skill 文件
└── package.json       # npm workspaces 根配置
```

---

## 代码规范

### TypeScript

- **Strict 模式** — `tsconfig.json` 已启用 `"strict": true`
- **ESM-only** — `"type": "module"`，导入路径必须带 `.js` 后缀
- **Target** — ES2022，Module 为 NodeNext
- **Style** — 2 空格缩进、双引号、分号

### Commit 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>: <description>

# 常用 type:
# feat     — 新功能
# fix      — Bug 修复
# docs     — 文档变更
# test     — 测试相关
# refactor — 重构（无功能变更）
# chore    — 构建或辅助工具变更
```

### 测试

- 使用 Node.js 内置测试运行器（`node:test`），无需额外框架
- 测试文件使用 `.test.mjs` 扩展名（编译后的 JS）
- 新增功能必须有对应测试
- 提交前确保全部测试通过

---

## 贡献流程

### 1. 创建分支

```bash
git checkout develop
git pull origin develop
git checkout -b feat/your-feature-name
```

### 2. 开发与提交

确保代码通过构建和测试：

```bash
npm run build --workspace=<package-name>
npm test --workspace=<package-name>
```

### 3. 推送并创建 PR

```bash
git push origin feat/your-feature-name
```

在 Codeup 上创建 Pull Request，目标分支为 `develop`。

---

## 新增功能指引

### SDK 新增 API 函数

1. 在 `wjx-api-sdk/src/modules/<module>/types.ts` 定义输入/输出类型
2. 在 `wjx-api-sdk/src/modules/<module>/client.ts` 实现函数
3. 在 `wjx-api-sdk/src/index.ts` 导出
4. 在 `__tests__/` 添加测试

### MCP Server 新增 Tool

1. 在 `wjx-mcp-server/src/modules/<module>/tools.ts` 使用 `server.registerTool()` 注册
2. 使用 Zod 定义 `inputSchema`
3. 使用 `toolResult()`/`toolError()` 统一返回格式
4. 在 `__tests__/` 添加测试
5. 更新 README 中的工具计数

### CLI 新增命令

1. 确认 SDK 函数已导出
2. 在 `wjx-cli/src/commands/<module>.ts` 中注册命令
3. 使用 `executeCommand()` 统一处理流程
4. 在 `__tests__/cli.test.mjs` 添加测试

---

## 需要帮助？

- 查看各包的 README 了解详细用法
- 查看 [MCP 架构文档](wjx-mcp-server/docs/architecture.md) 了解整体结构
- 提交 Issue 讨论新功能或报告问题
