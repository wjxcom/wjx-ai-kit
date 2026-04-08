# 在国产 Claw 工具中使用问卷星

> Claw 家族 AI 编程工具的问卷星配置总览

---

## Claw 生态概览

Claw 是国内 AI 编程工具的一个生态体系，多家厂商推出了各自的 Claw 工具，均支持 MCP 协议接入外部能力。

| 工具 | 厂商 | 特点 | 配置指南 |
|------|------|------|---------|
| **OpenClaw** | 开源社区 | 开源、Skills 系统、VS Code 插件 + 独立应用 | [配置指南](./setup-openclaw.md) |
| **KimiClaw** | 月之暗面 (Moonshot AI) | Kimi 大模型驱动，中文理解强 | 见下方通用配置 |
| **QClaw** | 腾讯 | 微信生态直联，企业场景优化 | 见下方通用配置 |
| **LinClaw** | 七牛云 | MIT 开源，支持 9 种 IDE 渠道，MCP 兼容 | 见下方通用配置 |
| **ArkClaw** | 字节跳动 | 基于豆包大模型（预发布） | 见下方通用配置 |
| **DuClaw** | 百度 | 基于文心大模型（预发布） | 见下方通用配置 |

---

## 准备工作

1. **安装你选择的 Claw 工具**
2. **Node.js >= 20**（OpenClaw 需要 >= 22）— 运行 `node --version` 确认版本
3. **获取问卷星 API Key** — 登录 [问卷星](https://www.wjx.cn)，进入「账号设置」→「API 设置」，创建或复制你的 API Key

---

## 第一步：接入 MCP Server

### OpenClaw

配置文件：`~/.openclaw/openclaw.json`

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

> **注意**：OpenClaw 使用 `acp.mcpServers` 路径，与标准的 `mcpServers` 不同。详见 [OpenClaw 配置指南](./setup-openclaw.md)。

### KimiClaw / QClaw / LinClaw / ArkClaw / DuClaw

大多数 Claw 工具采用标准 MCP 配置格式。在工具的 MCP 设置中添加：

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

> 各工具的 MCP 配置入口可能不同（设置面板、配置文件、命令行等），请参阅对应工具的官方文档。

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

各 Claw 工具如果支持 Rules 或指令文件，可以将 `wjx-skills/` 中的关键内容写入，提升 AI 操作问卷星的准确度。

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

在你的 Claw 工具中输入：

> 帮我创建一份客户满意度调查问卷

如果一切正常，AI 会调用问卷星 MCP 工具，自动创建问卷并返回编辑链接。

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

### 我用的 Claw 工具不在列表中？

只要你的 Claw 工具支持 MCP 协议，就可以参照上方的标准配置接入问卷星。如遇到问题，请在 [GitHub Issues](https://github.com/wjxcom/wjx-ai-kit/issues) 反馈。

### Claw 工具的 MCP 配置文件在哪？

各工具不同，常见位置：
- **OpenClaw**: `~/.openclaw/openclaw.json`（使用 `acp.mcpServers` 路径）
- **KimiClaw**: 通常在设置面板的 MCP/工具 配置中
- **LinClaw**: 参考 [LinClaw GitHub](https://github.com/aspect-build/linclaw) 文档
- 其他工具请查阅对应官方文档

### 需要特定版本的 Node.js？

大多数 Claw 工具需要 Node.js >= 20，OpenClaw 需要 >= 22。运行 `node --version` 检查。

---

## 下一步

- [OpenClaw 详细配置指南](./setup-openclaw.md) — OpenClaw 专属配置和 Skills 系统
- [MCP Server 入门指南](./mcp-getting-started.md) — 了解 56 个工具的完整能力
- [wjx-ai-kit 总览](./00-overview.md) — 了解 SDK、MCP、CLI 三合一架构
