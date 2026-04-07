# 在 Cline 中使用问卷星

> 在 VS Code 中通过 Cline 插件用自然语言创建问卷、分析数据、管理通讯录

---

## 准备工作

1. **安装 Cline** — 在 VS Code 扩展市场搜索 "Cline" 并安装
2. **Node.js >= 20** — 运行 `node --version` 确认版本，低于 20 请前往 [nodejs.org](https://nodejs.org) 升级
3. **获取问卷星 API Key** — 登录 [问卷星](https://www.wjx.cn)，进入「账号设置」→「API 设置」，创建或复制你的 API Key

---

## 第一步：接入 MCP Server

### 方式一：通过 UI 配置（推荐）

1. 打开 VS Code 侧边栏中的 **Cline** 面板
2. 点击顶部 **Settings** 齿轮图标
3. 找到 **MCP Servers** 部分
4. 点击 **Add MCP Server**
5. 填入以下信息：
   - 名称：`wjx`
   - 命令：`npx`
   - 参数：`wjx-mcp-server`
   - 环境变量：`WJX_API_KEY` = `你的 API Key`

### 方式二：直接编辑配置文件

Cline 的 MCP 配置文件位于 VS Code 的 globalStorage 目录中：

- **文件名**: `cline_mcp_settings.json`
- **路径**: VS Code globalStorage 中 Cline 扩展的目录下

配置内容：

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

### 企业用户

如需管理通讯录，在 `env` 中额外添加 `"WJX_CORP_ID": "你的企业通讯录 ID"`。

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

---

## 第二步：部署 Agent + Skill（推荐）

wjx-ai-kit 提供 2 个专家 Agent 和配套 Skill 参考文档，让 AI 理解问卷领域的专业知识。

### 一键安装

```bash
npx wjx-cli skill install
```

> 也可从 [Vercel Agent Skills](https://skills.sh/wjxcom/wjx-ai-kit) 安装：`npx skills add wjxcom/wjx-ai-kit`，或在 [ClawHub](https://clawhub.ai/skills?q=wjx) 市场搜索 "wjx" 安装。

这条命令会自动完成：
- 创建 `.claude/agents/` 目录，部署 2 个专家 Agent（wjx-mcp-expert、wjx-cli-expert）
- 复制 `wjx-skills/` 参考文档目录（DSL 语法、题型编码、分析方法等）

安装后的目录结构：

```
your-project/
├── .claude/agents/
│   ├── wjx-mcp-expert.md    # MCP 工具专家
│   └── wjx-cli-expert.md    # CLI 命令专家
└── wjx-skills/
    ├── wjx-mcp-use/          # MCP 使用技巧
    │   ├── SKILL.md
    │   └── references/
    └── wjx-cli-use/          # CLI 使用技巧
        ├── SKILL.md
        └── references/
```

### Custom Instructions 增强

Cline 支持 Custom Instructions 功能。在 Cline Settings 的 Custom Instructions 区域添加 Skill 中的关键内容：

```
# 问卷星集成

本项目使用 wjx-ai-kit 管理问卷调研。

## MCP 工具使用规范
- 创建问卷：优先使用 create_survey_by_text（DSL 文本模式）
- 数据分析：先用 query_responses 获取数据，再用 calculate_nps / calculate_csat 分析
- 通讯录操作：使用 add_contacts 批量导入，query_contacts 查询验证

## DSL 语法要点
- 第一行为问卷标题，=== 分隔描述
- 题型标签：[单选题] [多选题] [填空题] [量表题] [矩阵量表题] [下拉框]
- 量表范围：1~5 或 0~10
```

你也可以将 `wjx-skills/` 目录中更详细的参数参考文档内容加入 Custom Instructions。

---

## 第三步：安装 CLI（可选）

wjx-cli 提供 69 个子命令，适合批量操作和自动化脚本：

```bash
# 安装
npm install -g wjx-cli

# 配置 API Key
wjx init

# 环境检查
wjx doctor

# 试试看
wjx survey list
```

CLI 输出结构化 JSON，可与 AI 工具配合使用。例如：

```bash
# 查询答卷并分析 NPS
wjx response query --vid 12345 --page_size 100
wjx analytics nps --scores 9,10,7,3,8
```

---

## 第四步：验证

在 Cline 对话框中输入：

> 帮我创建一份客户满意度调查问卷

如果一切正常，Cline 会调用问卷星工具，自动创建问卷并返回编辑链接。

---

## 典型场景

### 场景 1: 创建调研问卷

> 你：帮我创建一份员工满意度调查问卷，包含 NPS 评分题、工作环境满意度（5 级量表）和开放反馈
>
> AI 自动：读取 DSL 语法 → 生成问卷结构 → 调用 create_survey_by_text → 返回编辑链接

### 场景 2: 分析数据

> 你：分析最近一次客户满意度调查的 NPS 得分
>
> AI 自动：query_responses 获取数据 → calculate_nps 计算 → 给出推荐人/中立/贬损分布

### 场景 3: 批量管理

> 你：把这份 Excel 名单导入通讯录的"市场部"分组
>
> AI 自动：读取文件 → add_contacts 批量导入 → query_contacts 验证

---

## 常见问题

### 添加 MCP Server 后工具没有出现？

1. 确认 Cline 已更新到最新版本（支持 MCP 的版本）
2. 在 Cline Settings → MCP Servers 中检查连接状态
3. 点击服务器旁边的刷新按钮重新连接

### Cline 支持哪些模型？

Cline 支持 Claude、GPT、Gemini 等多种模型。使用 Claude 系列模型与 MCP 工具的兼容性最佳。

### 工具调用时需要手动确认吗？

Cline 默认会在每次工具调用前请求用户确认。你可以在设置中调整自动批准策略，对信任的工具开启自动执行。

---

## 下一步

- [MCP Server 入门指南](./mcp-getting-started.md) — 了解 56 个工具的完整能力
- [wjx-ai-kit 总览](./00-overview.md) — 了解 SDK、MCP、CLI 三合一架构
