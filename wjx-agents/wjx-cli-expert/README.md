# wjx-cli-expert

问卷星 CLI 专家子 Agent —— 通过 `wjx` 命令行工具完成问卷创建、数据回收、分析等全部操作。

## 设计理念

本 Agent 遵循**渐进式披露**原则：

1. **Agent 定义（`wjx-cli-expert.md`）** — 只包含职责、工作原则和安全规范（~80 行）
2. **Skill（`skills/wjx-cli-use/SKILL.md`）** — 命令总览和核心工作流（~110 行）
3. **References（`skills/wjx-cli-use/references/`）** — 详细参数，按需加载

Agent 不重复 Skill 中的命令参数内容，而是在需要时读取对应的 reference 文件。

## 与 wjx-mcp-expert 的区别

| | wjx-mcp-expert | wjx-cli-expert |
|---|---|---|
| **交互方式** | MCP 工具调用 | `wjx` 命令行执行 |
| **适用场景** | 支持 MCP 的 AI 客户端 | 任意终端 / CI / 通用 Agent |
| **依赖** | wjx-mcp-server 运行中 | `npm install -g wjx-cli` |

## 前置条件

### 一键安装（推荐）

```bash
npm install -g wjx-cli      # 安装 CLI
wjx init                    # 配置 API Key → ~/.wjxrc
wjx doctor                  # 验证连接
npx wjx-cli skill install   # 自动部署 Agent + Skill 到当前目录
```

`skill install` 会自动完成：
- 创建 `.claude/agents/wjx-cli-expert.md`（Agent 定义）
- 复制 `skills/wjx-cli-use/`（参考文档）

### 手动安装

如果无法使用 npm，可下载 [wjx-cli-use-skill-latest.zip](https://pubdz.paperol.cn/wjx-ai-kit/skills/wjx-cli-use-skill-latest.zip)，解压后将 `wjx-cli-use` 目录放到项目根目录的 `skills/` 下，并将 `wjx-cli-expert.md` 复制到 `.claude/agents/`。

> **注意：** Agent 通过相对路径 `skills/wjx-cli-use/` 引用 Skill 文件，因此 `skills/` 目录必须位于项目根目录下。

## 使用方式

### 方式一：Claude Code 中委派

```
请使用 wjx-cli-expert Agent 帮我创建一份客户满意度调查问卷
```

### 方式二：命令行直接指定

```bash
claude --agent wjx-cli-expert "创建一份英语考试问卷，包含单选、多选、判断和填空题"
```

### 方式三：团队协作

```
创建一个团队，让 wjx-cli-expert agent 负责问卷操作，我来审核内容。
```

## 典型场景

**创建考试问卷：**
子 Agent 读取 `references/dsl-syntax.md` 学习 DSL 语法 → `create-by-text --dry-run` 预览 → 创建 → 返回编辑链接

**分析问卷数据：**
`response report` 概览 → `response query` 明细 → `analytics nps/csat` 计算 → `analytics anomalies` 检测异常

**批量导入通讯录：**
读取数据文件 → 查阅 `references/contacts-commands.md` 确认参数 → `contacts add` 导入 → `contacts query` 验证

## 文件说明

```
wjx-cli-expert/
├── README.md              ← 本文件
└── wjx-cli-expert.md      ← Agent 定义（复制到 .claude/agents/ 使用）
```
