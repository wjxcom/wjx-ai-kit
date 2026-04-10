# 在 Claude Code 中使用问卷星

> 在 Claude Code 中用自然语言创建问卷、分析数据、管理通讯录——支持 MCP + Agent + Skill 三层架构，释放 AI 问卷调研的全部能力

---

## 为什么 Claude Code 是最佳选择

wjx-ai-kit 提供三层 AI 能力，而 Claude Code 是唯一能发挥全部三层能力的工具：

| 层级 | 能力 | 说明 |
|------|------|------|
| **MCP Server** | 56 个工具 + 8 个资源 + 19 个提示 | 所有 MCP 客户端都支持 |
| **Agent** | 2 个专家 Agent（wjx-mcp-expert、wjx-cli-expert） | Claude Code 独占，内置完整工作流 |
| **Skill** | 渐进式参考文档，Agent 按需加载 | Claude Code 独占，DSL 语法、分析方法等领域知识 |

竞品（如金数据）只有 MCP 一层。wjx-ai-kit 的 Agent + Skill 系统让 AI 不仅能调用工具，还理解问卷领域的专业知识，能自主完成复杂的多步骤任务。

---

## 准备工作

1. **安装 Claude Code** — `npm install -g @anthropic-ai/claude-code`，然后运行 `claude` 完成认证
2. **Node.js >= 20** — 运行 `node --version` 确认版本
3. **获取问卷星 API Key** — 微信扫码登录 [API Key 获取页](https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1)，登录后页面直接显示 API Key

---

## 第一步：接入 MCP Server

### 方式一：命令行添加（推荐）

```bash
# 基本配置
claude mcp add wjx --env WJX_API_KEY=你的APIKey -- npx wjx-mcp-server

# 企业用户（需要通讯录功能）
claude mcp add wjx --env WJX_API_KEY=你的APIKey --env WJX_CORP_ID=你的企业ID -- npx wjx-mcp-server
```

### 方式二：手动编辑配置

在项目目录下创建 `.claude/mcp.json`：

```json
{
  "mcpServers": {
    "wjx": {
      "command": "npx",
      "args": ["wjx-mcp-server"],
      "env": {
        "WJX_API_KEY": "替换为你的 API Key"
      }
    }
  }
}
```

### HTTP 远程模式

团队部署了远程 MCP 服务时：

```json
{
  "mcpServers": {
    "wjx": {
      "url": "http://your-server:3000/mcp",
      "headers": {
        "Authorization": "Bearer your-token"
      }
    }
  }
}
```

### 验证 MCP 连接

```bash
claude mcp list
# 应该看到 wjx 服务器及其工具列表
```

---

## 第二步：部署 Agent（推荐）

Agent 是 wjx-ai-kit 相比其他方案的核心优势。两个专家 Agent 内置了完整的问卷操作工作流：

- **wjx-mcp-expert** — MCP 工具专家，擅长通过 MCP 协议操作问卷星
- **wjx-cli-expert** — CLI 命令专家，擅长通过命令行批量操作

### 方式一：使用 CLI 一键安装（推荐）

```bash
npx wjx-cli skill install
```

这条命令会自动完成以下操作：
- 创建 `.claude/agents/` 目录
- 复制两个专家 Agent 配置文件
- 复制 Skill 参考文档目录

### 方式二：从 Skill 市场安装

wjx-ai-kit 的 Skill 已上架 [Vercel Agent Skills](https://skills.sh/wjxcom/wjx-ai-kit) 和 [ClawHub](https://clawhub.ai/skills?q=wjx) 市场：

```bash
# 通过 Vercel Agent Skills 安装
npx skills add wjxcom/wjx-ai-kit
```

### 方式三：手动部署

```bash
# 创建 Agent 目录
mkdir -p .claude/agents

# 复制 Agent 配置
cp wjx-agents/wjx-mcp-expert/wjx-mcp-expert.md .claude/agents/
cp wjx-agents/wjx-cli-expert/wjx-cli-expert.md .claude/agents/

# 复制 Skill 参考文档
cp -r wjx-skills .
```

### 方式四：Skill zip 手动安装

如果无法使用 npm，可下载 Skill 包手动安装：

1. 下载 [wjx-cli-use-skill-latest.zip](https://pubdz.paperol.cn/wjx-ai-kit/skills/wjx-cli-use-skill-latest.zip)
2. 解压并提取其中的 `wjx-cli-use` 目录到项目目录下的 `wjx-skills/` 中
3. 安装 CLI 并配置 API Key：
   ```bash
   npm install -g wjx-cli
   wjx init
   ```

详见 [Skill 包入门指南](./skill-getting-started.md)。

### Agent 安装后的目录结构

```
your-project/
├── .claude/
│   ├── mcp.json              # MCP Server 配置
│   └── agents/
│       ├── wjx-mcp-expert.md # MCP 工具专家 Agent
│       └── wjx-cli-expert.md # CLI 命令专家 Agent
├── wjx-skills/               # Skill 参考文档（Agent 按需加载）
│   ├── wjx-mcp-use/          # MCP 使用技巧
│   └── wjx-cli-use/          # CLI 使用技巧
└── ...
```

---

## 第三步：三种使用模式

### 模式一：委托给 Agent（最强大）

在 Claude Code 中使用 `/agent` 命令将任务委托给专家 Agent：

```
/agent wjx-mcp-expert 帮我创建一份员工满意度调查问卷，包含 NPS 评分题和 5 个维度的量表题
```

Agent 会自动：
1. 加载相关 Skill 文档（DSL 语法、题型编码）
2. 规划问卷结构
3. 调用 MCP 工具创建问卷
4. 返回结果并给出优化建议

```
/agent wjx-cli-expert 批量导出上个月所有问卷的答卷数据到 CSV
```

CLI Agent 会自动：
1. 列出问卷列表
2. 筛选时间范围
3. 逐个导出答卷数据
4. 汇总结果

### 模式二：直接使用 MCP 工具

不通过 Agent，直接在 Claude Code 对话中使用问卷星工具：

> 帮我创建一份客户满意度调查问卷

Claude 会直接调用 MCP 工具完成任务。这种方式更直接，适合简单的单步操作。

### 模式三：团队协作

将 `.claude/` 目录和 `wjx-skills/` 提交到 Git 仓库，团队成员 clone 后即可使用相同的 Agent + Skill 配置：

```bash
# 提交配置到仓库
git add .claude/ wjx-skills/
git commit -m "feat: 添加问卷星 AI 工具配置"
```

团队成员只需设置自己的 API Key：

```bash
claude mcp add wjx --env WJX_API_KEY=自己的APIKey -- npx wjx-mcp-server
```

---

## 第四步：验证

### 验证 MCP

在 Claude Code 对话中输入：

> 帮我创建一份客户满意度调查问卷

如果 MCP 配置正确，Claude 会调用问卷星工具创建问卷。

### 验证 Agent

```
/agent wjx-mcp-expert 列出我的所有问卷
```

如果 Agent 部署正确，专家 Agent 会接管任务并调用相应工具。

---

## 典型场景

### 场景 1: 创建调研问卷

> 你：帮我创建一份员工满意度调查问卷，包含 NPS 评分题、工作环境满意度（5 级量表）和开放反馈
>
> Agent 自动：加载 DSL Skill → 读取题型编码 → 生成问卷结构 → 调用 create_survey_by_text → 返回编辑链接

### 场景 2: 分析数据

> 你：分析最近一次客户满意度调查的 NPS 得分，给出改进建议
>
> Agent 自动：加载分析 Skill → query_responses 获取数据 → calculate_nps 计算 → 生成推荐人/中立/贬损分布 → 给出针对性建议

### 场景 3: 批量管理

> 你：把这份 Excel 名单导入通讯录的"市场部"分组
>
> Agent 自动：读取文件 → add_contacts 批量导入 → query_contacts 验证 → 报告导入结果

### 场景 4: 复杂工作流（Agent 独有）

> 你：为下周的产品发布会准备一套完整的调研方案——会前期望调查、会中实时反馈、会后满意度评估
>
> Agent 自动：规划三份问卷 → 逐一创建 → 设置不同的发布时间 → 配置答卷通知 → 返回所有链接和操作说明

---

## CLAUDE.md 集成

如果你的项目已经有 `CLAUDE.md` 文件，可以在其中添加问卷星相关上下文，让 Claude Code 在所有对话中都了解项目的问卷需求：

```markdown
## 问卷星集成

本项目使用 wjx-ai-kit 管理问卷调研。常用操作：
- 创建问卷：使用 MCP 工具 create_survey_by_text
- 查询数据：使用 query_responses + calculate_nps
- 管理通讯录：使用 add_contacts / query_contacts

问卷命名规范：[项目代号]-[日期]-[类型]，如 "PROD-20260406-NPS"
```

---

## 常见问题

### MCP 工具没有出现？

```bash
# 检查 MCP 配置
claude mcp list

# 重新添加
claude mcp remove wjx
claude mcp add wjx --env WJX_API_KEY=你的APIKey -- npx wjx-mcp-server
```

### Agent 命令无效？

1. 确认 `.claude/agents/` 目录下有 Agent 配置文件
2. 确认文件名正确：`wjx-mcp-expert.md` 和 `wjx-cli-expert.md`
3. 重新运行 `npx wjx-cli skill install`

### npx 首次运行很慢？

npx 需要下载包。你可以先全局安装：

```bash
npm install -g wjx-mcp-server wjx-cli
```

### MCP 和 CLI Agent 该选哪个？

- **MCP Agent（wjx-mcp-expert）**：适合交互式操作，如创建问卷、分析数据、实时查询
- **CLI Agent（wjx-cli-expert）**：适合批量操作和自动化脚本，如批量导出、批量创建

两个 Agent 可以配合使用——用 MCP Agent 做设计和分析，用 CLI Agent 做批量执行。

---

## 下一步

- [MCP Server 入门指南](./mcp-getting-started.md) — 了解 56 个工具的完整能力
- [wjx-ai-kit 总览](./00-overview.md) — 了解 SDK、MCP、CLI 三合一架构
