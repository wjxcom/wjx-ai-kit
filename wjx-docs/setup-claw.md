# 在 Claw 系列工具中使用问卷星

> OpenClaw / KimiClaw / QClaw / LinClaw / MaxClaw 等 Claw 家族工具的问卷星配置

---

## Claw 生态概览

Claw 是国内 AI 编程工具的一个生态体系，多家厂商推出了各自的 Claw 工具，均支持 MCP 协议接入外部能力。

| 工具 | 厂商 | 特点 |
|------|------|------|
| **OpenClaw** | 开源社区 | 开源、Skills 系统、VS Code 插件 + 独立应用 |
| **KimiClaw** | 月之暗面 (Moonshot AI) | Kimi 大模型驱动，中文理解强 |
| **QClaw** | 腾讯 | 微信生态直联，企业场景优化 |
| **LinClaw** | 七牛云 | MIT 开源，支持 9 种 IDE 渠道，MCP 兼容 |
| **MaxClaw** | MiniMax | 一键云部署 OpenClaw，AI Agent 平台 |
| **EasyClaw** | 独立项目 | OpenClaw 托管部署，非技术用户友好 |
| **ArkClaw** | 字节跳动 | 基于豆包大模型（预发布） |
| **DuClaw** | 百度 | 基于文心大模型（预发布） |

---

## 准备工作

1. **安装你选择的 Claw 工具**
2. **Node.js >= 20** — 运行 `node --version` 确认版本
3. **获取问卷星 API Key** — 微信扫码登录 [API Key 获取页](https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1)，登录后页面直接显示 API Key

---

## 第一步：接入 MCP Server

### 通用配置（KimiClaw / QClaw / LinClaw / MaxClaw 等）

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

### OpenClaw 特殊配置

OpenClaw 使用不同的配置路径。编辑 `~/.openclaw/openclaw.json`：

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

> **注意**：OpenClaw 的 MCP 配置路径是 `acp.mcpServers`，与其他 Claw 工具的 `mcpServers` 不同。

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

wjx-ai-kit 提供专家 Agent 和配套 Skill 参考文档，让 AI 理解问卷领域的专业知识。

### 一键安装

```bash
npx wjx-cli skill install
```

> 也可从 [Vercel Agent Skills](https://skills.sh/wjxcom/wjx-ai-kit) 安装：`npx skills add wjxcom/wjx-ai-kit`，或在 [ClawHub](https://clawhub.ai/skills?q=wjx) 市场搜索 "wjx" 安装。

这条命令会自动完成：
- 创建 `.claude/agents/` 目录，部署 wjx-cli-expert Agent（CLI 命令专家）
- 复制 `skills/wjx-cli-use/` 参考文档（DSL 语法、题型编码、CLI 命令参数等）

安装后的目录结构：

```
your-project/
├── .claude/agents/
│   └── wjx-cli-expert.md    # CLI 命令专家 Agent
└── skills/
    └── wjx-cli-use/          # CLI 使用技巧
        ├── SKILL.md
        └── references/
```

### OpenClaw Skills 增强

OpenClaw 支持 Skills 系统，可在 `~/.openclaw/openclaw.json` 中启用 npm 包管理：

```json
{
  "skills": {
    "install": {
      "nodeManager": "npm"
    }
  }
}
```

wjx-ai-kit 的 Skill 已上架 [ClawHub 市场](https://clawhub.ai/skills?q=wjx)，搜索 "wjx" 即可安装。

各 Claw 工具如果支持 Rules 或指令文件，可以将 `skills/` 中的关键内容写入，提升 AI 操作问卷星的准确度。

### Skill zip 手动安装

如果无法使用 npm，可下载 Skill 包手动安装：

1. 下载 [wjx-cli-use-skill-latest.zip](https://pubdz.paperol.cn/wjx-ai-kit/skills/wjx-cli-use-skill-latest.zip)
2. 解压并提取其中的 `wjx-cli-use` 目录到 AI 工具的技能目录（或当前项目目录下）
3. 安装 CLI 并配置 API Key：
   ```bash
   npm install -g wjx-cli
   wjx init
   ```

详见 [Skill 包入门指南](./skill-getting-started.md)。

---

## 第三步：安装 CLI（可选）

详见 [CLI 入门指南](./cli-getting-started.md)。CLI 提供 {{CLI_COMMAND_COUNT}} 个子命令，适合批量操作和自动化脚本。

---

## 第四步：验证

在你的 Claw 工具中输入：

> 帮我创建一份客户满意度调查问卷

如果一切正常，AI 会调用问卷星 MCP 工具，自动创建问卷并返回编辑链接。

---

## 常见问题

### 我用的 Claw 工具不在列表中？

只要支持 MCP 协议，就可以参照上方的标准配置接入。如遇到问题，请在 [GitHub Issues](https://github.com/wjxcom/wjx-ai-kit/issues) 反馈。

### OpenClaw 中看不到问卷星工具？

1. 确认配置文件路径是 `~/.openclaw/openclaw.json`
2. 确认 MCP 配置在 `acp.mcpServers` 下（不是 `mcpServers`）
3. 确认 Node.js 版本 >= 20
4. 重启 OpenClaw

### Claw 工具的 MCP 配置文件在哪？

- **OpenClaw**: `~/.openclaw/openclaw.json`（使用 `acp.mcpServers` 路径）
- **KimiClaw**: 通常在设置面板的 MCP/工具 配置中
- **MaxClaw**: MiniMax Agent 平台的工具/MCP 配置中
- **EasyClaw**: 托管部署面板的工具配置中
- **LinClaw**: 参考 LinClaw 官方文档
- 其他工具请查阅对应官方文档

---

## 下一步

- [MCP Server 入门指南](./mcp-getting-started.md) — 了解 {{MCP_TOOL_COUNT}} 个工具的完整能力
- [wjx-ai-kit 总览](./00-overview.md) — 了解 SDK、MCP、CLI 三合一架构
