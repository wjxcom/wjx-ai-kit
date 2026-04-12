# 在 Claude Desktop 中使用问卷星

> 在 Claude Desktop 中用自然语言创建问卷、分析数据、管理通讯录

---

## 准备工作

1. **安装 Claude Desktop** — 前往 [claude.ai/download](https://claude.ai/download) 下载并安装
2. **Node.js >= 20** — 运行 `node --version` 确认版本，低于 20 请前往 [nodejs.org](https://nodejs.org) 升级
3. **获取问卷星 API Key** — 微信扫码登录 [API Key 获取页](https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1)，登录后页面直接显示 API Key

---

## 第一步：接入 MCP Server

### 找到配置文件

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

如果文件不存在，手动创建即可。

### 添加配置

将以下内容添加到配置文件中（如果已有其他 MCP 服务，在 `mcpServers` 对象中添加 `wjx` 条目即可）：

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

> 企业用户如需管理通讯录，在 `env` 中额外添加 `"WJX_CORP_ID": "你的企业通讯录 ID"`。

### 重启 Claude Desktop

配置完成后，**必须完全退出并重新启动 Claude Desktop**（不是最小化，是退出）。成功后，你会在聊天输入框底部看到工具图标，表示 MCP 工具已加载。

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

### 使用 MCP Prompts 工作流

Claude Desktop 内置支持 MCP Prompts。wjx-mcp-server 提供了 19 个预设工作流模板（NPS 分析、满意度调查、考试出题、异常检测等），可直接在 Claude Desktop 对话中使用。

此外，你可以将 `wjx-skills/` 中的参考文档内容作为对话上下文粘贴给 Claude，提升问卷操作的准确度。

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

重启 Claude Desktop 后，在对话框中输入：

> 帮我创建一份客户满意度调查问卷

如果一切正常，Claude 会调用问卷星工具，自动创建问卷并返回编辑链接。

---

## 典型场景

### 场景 1: 创建调研问卷

> 你：帮我创建一份员工满意度调查问卷，包含 NPS 评分题、工作环境满意度（5 级量表）和开放反馈
>
> Claude 自动：读取 DSL 语法 → 生成问卷结构 → 调用 create_survey_by_text → 返回编辑链接

### 场景 2: 分析数据

> 你：分析最近一次客户满意度调查的 NPS 得分
>
> Claude 自动：query_responses 获取数据 → calculate_nps 计算 → 给出推荐人/中立/贬损分布

### 场景 3: 批量管理

> 你：把这份名单导入通讯录的"市场部"分组
>
> Claude 自动：读取数据 → add_contacts 批量导入 → query_contacts 验证

---

## 常见问题

### 配置后看不到工具图标？

1. 确认配置文件的 JSON 格式正确（没有尾逗号、引号匹配）
2. 确认已**完全退出**并重新启动 Claude Desktop（仅最小化不会重新加载配置）
3. 检查 Node.js 版本是否 >= 20：`node --version`

### API Key 无效？

确认 API Key 没有多余的空格或换行符。登录问卷星后台重新复制一次。

### 工具调用超时？

npx 首次运行需要下载包，可能较慢。你也可以先全局安装：

```bash
npm install -g wjx-mcp-server
```

然后将配置中的 `"command"` 改为 `"wjx-mcp-server"`，`"args"` 改为 `[]`。

---

## 下一步

- [MCP Server 入门指南](./mcp-getting-started.md) — 了解 57 个工具的完整能力
- [wjx-ai-kit 总览](./00-overview.md) — 了解 SDK、MCP、CLI 三合一架构
