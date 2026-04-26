# 在 IDE 插件中使用问卷星

> Cursor / Windsurf / Cline / GitHub Copilot / Trae / Gemini Code Assist / Qoder

---

## 🚀 最快接入：让 IDE 里的 AI 自己装

打开你 IDE 的 AI 对话窗（Cursor Chat / Windsurf Cascade / Cline / Copilot Chat / Trae / Gemini / Qoder），把下面这段话发给它：

````text
请帮我接入问卷星 MCP Server。我用的 IDE 是 <Cursor / Windsurf / Cline / Copilot / Trae / Gemini Code Assist / Qoder>。

1. 检查 node --version >= 20
2. 让我去 https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1 微信扫码取 API Key
3. 找到我这个 IDE 对应的 MCP 配置文件路径（Cursor: .cursor/mcp.json 或 ~/.cursor/mcp.json；Windsurf: ~/.codeium/windsurf/mcp_config.json；Cline: VS Code globalStorage 里的 cline_mcp_settings.json；Copilot: .github/copilot-mcp.json，VS Code settings.json 用 mcp.servers 不是 mcpServers；Trae: .trae/mcp.json；Qoder: 设置面板）
4. 把以下 JSON 合并进去：
   ```json
   {
     "mcpServers": {
       "wjx": {
         "command": "npx",
         "args": ["-y", "wjx-mcp-server@latest"],
         "env": { "WJX_API_KEY": "<我的Key>" }
       }
     }
   }
   ```
5. 提醒我**重启 IDE 或重新加载窗口**（VS Code 系：Ctrl/Cmd+Shift+P → Reload Window）
6. 重启后让我说"列出我的问卷"验证
````

> 各 IDE 的 MCP 配置入口和重载方式都不一样，让 AI 帮你定位是最稳的。下面是按 IDE 拆开的手动步骤。

---

## 准备工作

1. **安装你的 IDE 插件** — 见下表
2. **Node.js >= 20** — 运行 `node --version` 确认版本，低于 20 请前往 [nodejs.org](https://nodejs.org) 升级
3. **获取问卷星 API Key** — 微信扫码登录 [API Key 获取页](https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1)，登录后页面直接显示 API Key

| 工具 | 获取方式 |
|------|---------|
| **Cursor** | [cursor.com](https://www.cursor.com) |
| **Windsurf** | [windsurf.com](https://windsurf.com)（Codeium 出品） |
| **Cline** | VS Code 扩展市场搜索 "Cline" |
| **GitHub Copilot** | VS Code 内置，需 Copilot 订阅 |
| **Trae** | [trae.ai](https://trae.ai)（字节跳动出品） |
| **Gemini Code Assist** | VS Code / JetBrains 扩展市场搜索 "Gemini Code Assist" |
| **Qoder** | [qoder.com](https://qoder.com)（阿里巴巴出品），或 VS Code / JetBrains 扩展市场 |

---

## 第一步：接入 MCP Server

### 通用 MCP 配置

所有 IDE 插件使用相同的 JSON 配置内容：

```json
{
  "mcpServers": {
    "wjx": {
      "command": "npx",
      "args": ["-y", "wjx-mcp-server@latest"],
      "env": {
        "WJX_API_KEY": "替换为你的 API Key"
      }
    }
  }
}
```

> **企业用户**：如需管理通讯录，在 `env` 中额外添加 `"WJX_CORP_ID": "你的企业通讯录 ID"`。
>
> **自定义域名**：`WJX_BASE_URL` 为可选项，默认 `https://www.wjx.cn`，私有化部署用户可在 `env` 中添加。

### 各工具配置入口

<details>
<summary><b>Cursor</b></summary>

**配置文件**（推荐）：在项目根目录创建 `.cursor/mcp.json`，粘贴上方 JSON。也可放在全局路径 `~/.cursor/mcp.json`。

**通过 UI**：Settings（`Cmd+,` / `Ctrl+,`）→ Features → MCP → New MCP Server → 在打开的编辑器中粘贴 JSON。
</details>

<details>
<summary><b>Windsurf</b></summary>

**全局配置**：编辑 `~/.codeium/windsurf/mcp_config.json`，粘贴上方 JSON。

**项目级配置**：在项目根目录创建 `.windsurf/mcp.json`。项目级配置优先于全局配置。
</details>

<details>
<summary><b>Cline</b></summary>

**通过 UI**（推荐）：VS Code 侧边栏 Cline 面板 → Settings 齿轮图标 → MCP Servers → Add MCP Server → 填入名称 `wjx`、命令 `npx`、参数 `-y wjx-mcp-server@latest`、环境变量 `WJX_API_KEY`。

**配置文件**：编辑 VS Code globalStorage 中的 `cline_mcp_settings.json`。
</details>

<details>
<summary><b>GitHub Copilot</b></summary>

**项目级**（推荐）：在项目根目录创建 `.github/copilot-mcp.json`，粘贴上方 JSON。

**VS Code 设置**：在 `settings.json` 中添加：
```json
{
  "mcp": {
    "servers": {
      "wjx": {
        "command": "npx",
        "args": ["-y", "wjx-mcp-server@latest"],
        "env": { "WJX_API_KEY": "你的 API Key" }
      }
    }
  }
}
```

> 需要启用 Agent 模式：`"github.copilot.chat.agent.enabled": true`。Copilot 的 MCP 支持可能处于预览阶段。
>
> **注意**：VS Code `settings.json` 使用 `mcp.servers` 键名（非 `mcpServers`），这是 VS Code 设置的标准格式，与项目级 `.github/copilot-mcp.json` 的格式不同。
</details>

<details>
<summary><b>Trae</b></summary>

**通过菜单栏**（推荐）：菜单栏 → MCP → 在弹出的 MCP 管理界面中添加上方 JSON 配置。

也可通过 AI 聊天面板顶部的 **MCP 图标** 进入，或编辑项目根目录的 `.trae/mcp.json`。
</details>

<details>
<summary><b>Gemini Code Assist</b></summary>

VS Code 设置（`settings.json`）中添加 MCP 配置，或在 Gemini Code Assist 扩展设置面板中找到 MCP 相关配置项。

> MCP 支持可能处于预览阶段，配置方式可能随版本更新变化。
</details>

<details>
<summary><b>Qoder</b></summary>

在 Qoder 设置面板中找到 MCP/工具 配置入口，添加上方 JSON。详见 [Qoder 官方文档](https://qoder.com/docs)。
</details>

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

> 此命令安装 CLI 命令专家 Agent（wjx-cli-expert）和配套 Skill 文档。如需 MCP 工具专家 Agent（wjx-mcp-expert），可从 [GitHub 仓库](https://github.com/wjxcom/wjx-ai-kit/tree/master/wjx-agents/wjx-mcp-expert) 手动下载到 `.claude/agents/` 目录。
>
> 也可从 [Vercel Agent Skills](https://skills.sh/wjxcom/wjx-ai-kit) 安装：`npx skills add wjxcom/wjx-ai-kit`，或在 [ClawHub](https://clawhub.ai/skills?q=wjx) 市场搜索 "wjx" 安装。

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

### Rules / Instructions 增强

大多数 IDE 插件支持通过 Rules 文件注入项目级上下文。将以下内容写入对应文件，AI 会在每次对话中自动加载：

| 工具 | Rules 文件 |
|------|-----------|
| **Cursor** | `.cursor/rules/*.md`（推荐）或 `.cursorrules` |
| **Windsurf** | `.windsurf/rules.md` |
| **Cline** | Settings → Custom Instructions |
| **GitHub Copilot** | `.github/copilot-instructions.md` |
| **Trae** | `.trae/rules.md` 或 Trae 设置中的 Rules 配置 |
| **Qoder** | Qoder 设置中的记忆/规则配置面板 |
| **Gemini Code Assist** | 作为对话上下文手动粘贴，或通过 VS Code 设置注入 |

**推荐写入的 Rules 内容**：

```
# 问卷星集成

本项目使用 wjx-ai-kit 管理问卷调研。

## MCP 工具使用规范
- 创建问卷：一律使用 create_survey_by_json（覆盖 70+ 题型）。create_survey_by_text 已弃用
- 数据分析：先用 query_responses 获取数据，再用 calculate_nps / calculate_csat 分析
- 通讯录操作：使用 add_contacts 批量导入，query_contacts 查询验证

## DSL 语法要点
- 第一行为问卷标题，=== 分隔描述
- 题型标签：[单选题] [多选题] [填空题] [量表题] [矩阵量表题] [下拉框]
- 量表范围：1~5 或 0~10
```

### Skill zip 手动安装

如果无法使用 npm，可下载 Skill 包手动安装：

1. 下载 [wjx-cli-use-skill-latest.zip](https://pubdz.paperol.cn/wjx-ai-kit/skills/wjx-cli-use-skill-latest.zip)
2. 解压并提取其中的 `wjx-cli-use` 目录到项目目录下的 `skills/` 中
3. 安装 CLI 并配置 API Key：
   ```bash
   npm install -g wjx-cli
   wjx init
   ```

详见 [Skill 包入门指南](./skill-getting-started.md)。

---

## 第三步：安装 CLI（可选）

详见 [CLI 入门指南](./cli-getting-started.md)。CLI 提供 67 个子命令，适合批量操作和自动化脚本。

---

## 第四步：验证

在你的 AI 对话中输入：

> 帮我创建一份客户满意度调查问卷

| 工具 | 验证位置 |
|------|---------|
| Cursor | AI 对话面板 |
| Windsurf | Cascade 对话 |
| Cline | Cline 对话框 |
| GitHub Copilot | Copilot Chat（Agent 模式） |
| Trae | AI 聊天面板 |
| Gemini Code Assist | Gemini Code Assist 对话 |
| Qoder | Qoder 对话 |

如果一切正常，AI 会调用问卷星 MCP 工具，自动创建问卷并返回编辑链接。

---

## 常见问题

### Cursor

**MCP 工具没有出现？** 确认 `.cursor/mcp.json` 在项目根目录 → 重新加载窗口（`Cmd+Shift+P` → Reload Window）→ 在 Settings → Features → MCP 中确认状态。

**项目级和全局配置的区别？** 项目级（`.cursor/mcp.json`）只在当前项目生效；全局级（`~/.cursor/mcp.json`）所有项目共享。

### Windsurf

**Cascade 中看不到工具？** 确认配置文件路径正确（全局 `~/.codeium/windsurf/mcp_config.json` 或项目级 `.windsurf/mcp.json`）→ 确认 JSON 格式正确 → 重启 Windsurf。

### Cline

**添加后工具没出现？** 确认 Cline 为最新版 → 在 Settings → MCP Servers 中检查连接状态 → 点击刷新按钮重新连接。

**工具调用需要手动确认吗？** 默认需要确认。可在设置中对信任的工具开启自动执行。

### GitHub Copilot

**Chat 中没有 MCP 工具？** 确认已启用 Agent 模式 → 确认 Copilot 版本支持 MCP → 聊天面板切换到 Agent 模式（非普通 Chat）。

### Trae

**看不到 MCP 工具？** 确认已通过 AI 聊天面板中的 MCP 图标配置 → 确认 JSON 格式正确 → 重启 Trae。

**Windows 下 npx 报错 "cannot be loaded because running scripts is disabled"？** 以管理员身份运行 PowerShell：`Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`，设置后重启 Trae。

### Gemini Code Assist

**支持 MCP 吗？** 取决于具体版本，建议关注 [Google Cloud 官方文档](https://cloud.google.com/gemini/docs)。

### Qoder

**和通义灵码的区别？** 通义灵码面向国内，定位代码补全和问答。Qoder 面向海外，定位 Agentic 编程平台，支持更复杂的自主任务。两者都支持 MCP。

### 通用问题

**npx 首次运行很慢？** 需要下载包。可先全局安装：`npm install -g wjx-mcp-server wjx-cli`。

**工具调用失败？** 确认 Node.js >= 20 → 确认 API Key 有效且无多余空格 → 确认插件为最新版本。

---

## 下一步

- [MCP Server 入门指南](./mcp-getting-started.md) — 了解 58 个工具的完整能力
- [wjx-ai-kit 总览](./00-overview.md) — 了解 SDK、MCP、CLI 三合一架构
