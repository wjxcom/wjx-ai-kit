# 在 OpenClaw 中使用问卷星

> 在 OpenClaw 中用自然语言创建问卷、分析数据、管理通讯录

---

## 什么是 OpenClaw

[OpenClaw](https://openclaw.com) 是开源的 AI 编程助手，支持 VS Code 插件和独立应用两种形态。OpenClaw 支持 MCP 协议和 Skills 系统，可以灵活扩展 AI 能力。

---

## 准备工作

1. **安装 OpenClaw** — 前往 [openclaw.com](https://openclaw.com) 下载，或在 VS Code 扩展市场搜索 "OpenClaw" 安装
2. **Node.js >= 22** — 运行 `node --version` 确认版本（OpenClaw 要求 Node.js 22 或更高）
3. **获取问卷星 API Key** — 微信扫码登录 [API Key 获取页](https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1)，登录后页面直接显示 API Key

---

## 第一步：接入 MCP Server

编辑 OpenClaw 配置文件 `~/.openclaw/openclaw.json`，在 `acp.mcpServers` 中添加问卷星：

```json
{
  "acp": {
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
}
```

> **注意**：OpenClaw 的 MCP 配置路径是 `acp.mcpServers`，与其他工具的 `mcpServers` 不同。

### 企业用户

如需管理通讯录，在 `env` 中额外添加 `"WJX_CORP_ID": "你的企业通讯录 ID"`。

### HTTP 远程模式

团队部署了远程 MCP 服务时：

```json
{
  "acp": {
    "mcpServers": {
      "wjx": {
        "url": "http://your-server:3000/mcp",
        "headers": {
          "Authorization": "Bearer your-token"
        }
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

### OpenClaw Skills 增强

OpenClaw 支持 Skills 系统，你可以在配置中启用 npm 作为包管理器来自动安装依赖：

```json
{
  "skills": {
    "install": {
      "nodeManager": "npm"
    }
  }
}
```

同时，将 `wjx-skills/` 中的参考文档作为项目上下文，OpenClaw 会自动读取并用于增强 AI 的问卷操作能力。

### 从 ClawHub 市场安装

wjx-ai-kit 的 Skill 已上架 [ClawHub 市场](https://clawhub.ai/skills?q=wjx)，你可以直接在 ClawHub 中搜索 "wjx" 找到并安装问卷星技能包（wjx-cli-use、wjx-mcp-use）。

也可通过 [Vercel Agent Skills](https://skills.sh/wjxcom/wjx-ai-kit) 安装：

```bash
npx skills add wjxcom/wjx-ai-kit
```

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

在 OpenClaw 的对话中输入：

> 帮我创建一份客户满意度调查问卷

如果一切正常，OpenClaw 会调用问卷星 MCP 工具，自动创建问卷并返回编辑链接。

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

### 场景 3: 代码中集成问卷

> 你：帮我在这个 Express 项目中添加一个问卷回调接口，接收问卷星的 Webhook 推送
>
> AI 自动：读取 push 解密参考 → 生成 Webhook 处理代码 → 集成到项目中

---

## 常见问题

### OpenClaw 中看不到问卷星工具？

1. 确认配置文件路径是 `~/.openclaw/openclaw.json`
2. 确认 MCP 配置在 `acp.mcpServers` 下（不是 `mcpServers`）
3. 确认 Node.js 版本 >= 22
4. 重启 OpenClaw

### OpenClaw 和其他 Claw 工具有什么区别？

OpenClaw 是开源的，支持更灵活的扩展。其他 Claw 工具（如 KimiClaw、QClaw）各有特色，配置方式类似但可能有细微差异。

---

## 下一步

- [MCP Server 入门指南](./mcp-getting-started.md) — 了解 56 个工具的完整能力
- [wjx-ai-kit 总览](./00-overview.md) — 了解 SDK、MCP、CLI 三合一架构
