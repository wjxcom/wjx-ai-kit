# wjx-mcp-expert

问卷星 MCP 专家子 Agent —— 通过 wjx-mcp-server 完成问卷星核心业务子集的创建、数据回收和分析。CLI 是完整的主入口，MCP 处于 secondary / maintenance-mode。

## 设计理念

本 Agent 遵循**渐进式披露**原则：

1. **Agent 定义（`wjx-mcp-expert.md`）** — 只包含职责、工作原则和安全规范（~80 行）
2. **Skill（`skills/wjx-mcp-use/SKILL.md`）** — 工具总览和核心工作流（~110 行）
3. **References（`skills/wjx-mcp-use/references/`）** — 详细参数，按需加载

Agent 不重复 Skill 中的工具参数内容，而是在需要时读取对应的 reference 文件。

启动后，它具备：

- MCP 核心业务子集工具的使用知识（问卷、答卷、通讯录、分析等；用户体系工具仅兼容维护；差异以 capability matrix 为准）
- 8 个 MCP 资源的参考数据（题型编码、DSL 语法、分析公式等）
- 15 个 Prompt 模板（NPS 分析、异常检测、JSONL 问卷生成等；数量以源码为准）
- 内置的工作流程和安全原则

## 与 wjx-cli-expert 的区别

| | wjx-mcp-expert | wjx-cli-expert |
|---|---|---|
| **交互方式** | MCP 工具调用 | `wjx` 命令行执行 |
| **适用场景** | 支持 MCP 的 AI 客户端 | 任意终端 / CI / 通用 Agent |
| **依赖** | wjx-mcp-server 运行中 | `wjx-cli >= 0.4.1`（可选） |

## 前置条件

### 1. 配置 MCP Server

```bash
# Claude Code 命令行方式（推荐）
claude mcp add wjx --env WJX_API_KEY=你的APIKey -- node /absolute/path/wjx-mcp-server/dist/index.js
```

或手动编辑 `.claude/mcp.json`：

```json
{
  "mcpServers": {
    "wjx": {
      "command": "node",
      "args": ["/absolute/path/wjx-mcp-server/dist/index.js"],
      "env": {
        "WJX_API_KEY": "替换为你的 API Key"
      }
    }
  }
}
```

### 2. 部署 Agent 和 Skill

`0.4.1` 尚未发布到 npm；发布前请使用本机构建的 CLI，发布后才使用 `npx wjx-cli`：

```bash
npx wjx-cli skill install   # 自动部署 wjx-cli-expert Agent + Skill
```

如需 MCP 专家 Agent，手动复制：

```bash
# 下载 Agent 定义文件到 .claude/agents/
mkdir -p .claude/agents
curl -o .claude/agents/wjx-mcp-expert.md https://raw.githubusercontent.com/wjxcom/wjx-ai-kit/master/wjx-agents/wjx-mcp-expert/wjx-mcp-expert.md

# 下载 MCP Skill 参考文档
npx degit wjxcom/wjx-ai-kit/wjx-skills/wjx-mcp-use wjx-skills/wjx-mcp-use
```

> 也可以直接从 [GitHub 仓库](https://github.com/wjxcom/wjx-ai-kit/tree/master/wjx-agents/wjx-mcp-expert) 手动下载这些文件。

## 使用方式

### 方式一：Claude Code 中委派

```
请使用 wjx-mcp-expert Agent 帮我创建一份客户满意度调查问卷
```

### 方式二：命令行直接指定

```bash
claude --agent wjx-mcp-expert "创建一份英语考试问卷，包含单选、多选、判断和填空题"
```

### 方式三：团队协作

```
创建一个团队，让 wjx-mcp-expert agent 负责问卷操作，我来审核内容。
```

## 典型场景

**创建考试问卷：**
子 Agent 用 `create_survey_by_json` 创建（覆盖 70+ 题型，含考试题）→ `get_survey` 验证 → `build_survey_url` 返回编辑链接

**维护历史用户体系：**
仅在用户提供已有 `usid`/`sysid` 且明确要求维护时使用用户体系工具。不能通过 API 新建 `atype=8` 用户体系问卷；新项目应改用普通问卷、通讯录和标准分发能力。

**分析问卷数据：**
`get_report` 概览 → `count_responses` 判断规模 → 按需 `query_responses` 明细 → `calculate_nps` 计算 NPS → `detect_anomalies` 检测异常

**批量导入通讯录：**
读取数据文件 → 查阅 `references/tools-other.md` 确认参数 → `add_contacts` 导入 → `query_contacts` 验证

## 文件说明

```
wjx-mcp-expert/
├── README.md       ← 本文件
└── wjx-mcp-expert.md   ← Agent 定义（复制到 .claude/agents/ 使用）
```
