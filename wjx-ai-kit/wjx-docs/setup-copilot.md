# 在 GitHub Copilot 中使用问卷星

> 在 VS Code / GitHub Copilot 中用自然语言创建问卷、分析数据、管理通讯录

---

## 准备工作

1. **GitHub Copilot 订阅** — 需要 GitHub Copilot 个人版或企业版
2. **VS Code** — 安装最新版 VS Code 并启用 GitHub Copilot 扩展
3. **Node.js >= 20** — 运行 `node --version` 确认版本，低于 20 请前往 [nodejs.org](https://nodejs.org) 升级
4. **获取问卷星 API Key** — 微信扫码登录 [API Key 获取页](https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1)，登录后页面直接显示 API Key

> 注意：Copilot 的 MCP 支持需要 Agent 模式。请确认你的 Copilot 版本已支持此功能。

---

## 第一步：接入 MCP Server

### 方式一：项目级配置（推荐）

在项目根目录创建 `.github/copilot-mcp.json`：

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

### 方式二：VS Code 设置

在 VS Code 的 `settings.json` 中添加：

```json
{
  "mcp": {
    "servers": {
      "wjx": {
        "command": "npx",
        "args": ["wjx-mcp-server"],
        "env": {
          "WJX_API_KEY": "替换为你的 API Key"
        }
      }
    }
  }
}
```

### 启用 Agent 模式

确保 VS Code 设置中已启用 Agent 模式：

```json
{
  "github.copilot.chat.agent.enabled": true
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

### copilot-instructions.md 增强

GitHub Copilot 支持通过 `.github/copilot-instructions.md` 文件注入项目级自定义指令。将 Skill 中的关键内容加入其中：

在项目根目录创建 `.github/copilot-instructions.md`：

```markdown
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

Copilot 会在 Agent 模式的每次对话中自动加载这些指令。

### Skill zip 手动安装

如果无法使用 npm，可下载 Skill 包手动安装：

1. 下载 [wjx-cli-use-skill-latest.zip](https://pubdz.paperol.cn/wjx-ai-kit/skills/wjx-cli-use-skill-latest.zip)
2. 解压到 AI 工具的技能目录（或当前项目目录下）
3. 安装 CLI 并配置 API Key：
   ```bash
   npm install -g wjx-cli
   wjx init
   ```

详见 [Skill 包入门指南](./skill-getting-started.md)。

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

在 Copilot Chat 中切换到 Agent 模式，输入：

> 帮我创建一份客户满意度调查问卷

如果一切正常，Copilot 会调用问卷星工具，自动创建问卷并返回编辑链接。

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

### Copilot Chat 中没有出现 MCP 工具？

1. 确认已启用 Agent 模式（`"github.copilot.chat.agent.enabled": true`）
2. 确认 Copilot 版本支持 MCP（需要较新版本）
3. 确认聊天面板已切换到 Agent 模式（非普通 Chat 模式）

### MCP 支持是稳定功能吗？

GitHub Copilot 的 MCP 支持可能处于预览阶段，功能和配置方式可能随版本更新变化。建议关注 [GitHub Copilot 官方文档](https://docs.github.com/copilot) 获取最新信息。

---

## 下一步

- [MCP Server 入门指南](./mcp-getting-started.md) — 了解 56 个工具的完整能力
- [wjx-ai-kit 总览](./00-overview.md) — 了解 SDK、MCP、CLI 三合一架构
