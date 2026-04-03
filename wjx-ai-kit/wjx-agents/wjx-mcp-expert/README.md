# wjx-mcp-expert

问卷星 MCP 专家子 Agent —— 通过 wjx-mcp-server 完成问卷创建、数据回收、分析等全部操作。

## 设计理念

本 Agent 遵循**渐进式披露**原则：

1. **Agent 定义（`wjx-survey.md`）** — 只包含职责、工作原则和安全规范（~80 行）
2. **Skill（`wjx-skills/wjx-mcp-use/SKILL.md`）** — 工具总览和核心工作流（~110 行）
3. **References（`wjx-skills/wjx-mcp-use/references/`）** — 详细参数，按需加载

Agent 不重复 Skill 中的工具参数内容，而是在需要时读取对应的 reference 文件。

启动后，它具备：

- 55 个 MCP 工具的完整知识（问卷、答卷、通讯录、分析等）
- 8 个 MCP 资源的参考数据（题型编码、DSL 语法、分析公式等）
- 12 个 Prompt 模板（NPS 分析、异常检测等）
- 内置的工作流程和安全原则

## 与 wjx-cli-expert 的区别

| | wjx-mcp-expert | wjx-cli-expert |
|---|---|---|
| **交互方式** | MCP 工具调用 | `wjx` 命令行执行 |
| **适用场景** | 支持 MCP 的 AI 客户端 | 任意终端 / CI / 通用 Agent |
| **依赖** | wjx-mcp-server 运行中 | `npm install -g wjx-cli` |

## 前置条件

1. **wjx-mcp-server 已配置并运行**

   在 Claude Code 的 MCP 配置中添加 wjx-mcp-server：

   ```json
   // ~/.claude/mcp.json 或项目 .claude/mcp.json
   {
     "mcpServers": {
       "wjx": {
         "command": "node",
         "args": ["path/to/wjx-mcp-server/dist/index.js"],
         "env": {
           "WJX_API_KEY": "your-api-key"
         }
       }
     }
   }
   ```

2. **部署 Agent 和 Skill**

   ```bash
   # Agent 定义
   mkdir -p .claude/agents
   cp wjx-agents/wjx-mcp-expert/wjx-survey.md .claude/agents/

   # Skill（Agent 需要引用）
   mkdir -p wjx-skills
   cp -r wjx-skills/wjx-mcp-use wjx-skills/
   ```

## 使用方式

### 方式一：Claude Code 中委派

```
请使用 wjx-survey Agent 帮我创建一份客户满意度调查问卷
```

### 方式二：命令行直接指定

```bash
claude --agent wjx-survey "创建一份英语考试问卷，包含单选、多选、判断和填空题"
```

### 方式三：团队协作

```
创建一个团队，让 wjx-survey agent 负责问卷操作，我来审核内容。
```

## 典型场景

**创建考试问卷：**
子 Agent 读取 `references/dsl-and-types.md` 学习 DSL 语法 → `create_survey_by_text` 创建 → `get_survey` 验证 → `build_survey_url` 返回编辑链接

**分析问卷数据：**
`get_report` 概览 → `query_responses` 明细 → `calculate_nps` 计算 NPS → `detect_anomalies` 检测异常

**批量导入通讯录：**
读取数据文件 → 查阅 `references/tools-other.md` 确认参数 → `add_contacts` 导入 → `query_contacts` 验证

## 文件说明

```
wjx-mcp-expert/
├── README.md       ← 本文件
└── wjx-survey.md   ← Agent 定义（复制到 .claude/agents/ 使用）
```
