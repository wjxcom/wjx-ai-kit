# 在 AI 工作台中使用问卷星

> AI 工作台的问卷星配置总览——Manus、WorkBuddy、QoderWork 等桌面智能体平台

---

## 工作台生态概览

AI 工作台是一类桌面级智能体平台，能自主规划并执行多步骤任务。与 IDE 插件型工具不同，工作台更侧重任务交付而非代码编辑，适合非开发者使用。

| 工具 | 厂商 | 特点 | 备注 |
|------|------|------|------|
| **Manus** | 蝴蝶效应 (Monica 团队) | 通用 AI Agent，自主交付复杂任务 | 支持 MCP 工具接入 |
| **WorkBuddy** | 腾讯 | AI Agent 桌面工作台，CodeBuddy 生态 | 支持 MCP 协议 |
| **QoderWork** | 阿里巴巴 | 桌面级通用智能体助手，Qoder 生态 | 支持 MCP 协议 |

---

## 准备工作

1. **安装你选择的工作台工具** — 前往对应官网下载安装
   - Manus: [manus.im](https://manus.im)
   - WorkBuddy: [copilot.tencent.com/work](https://copilot.tencent.com/work)
   - QoderWork: [qoder.com/zh/qoderwork](https://qoder.com/zh/qoderwork)
2. **Node.js >= 20** — 运行 `node --version` 确认版本
3. **获取问卷星 API Key** — 微信扫码登录 [API Key 获取页](https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1)，登录后页面直接显示 API Key

---

## 第一步：接入 MCP Server

在工作台的 MCP / 工具配置中添加问卷星服务器：

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

> 各工作台的 MCP 配置入口不同，请参阅对应工具的官方文档。

### 各工具配置入口

- **Manus**: 在 Agent Skills / Tools 设置中添加 MCP 服务器
- **WorkBuddy**: 在工具/插件配置面板中添加 MCP 连接
- **QoderWork**: 在设置 → MCP 配置中添加（与 Qoder IDE 插件共享配置）

### 企业用户

如需管理通讯录，在 `env` 中额外���加 `"WJX_CORP_ID": "你的企业通讯录 ID"`。

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

如果你的工作台支持 Rules 或指令文件，可以将 `wjx-skills/` 中的关键内容写入，提升 AI 操作问卷星的准确度。

### Skill zip 手动安装

如果无法使用 npm，可下载 Skill 包手动安装：

1. 下载 [wjx-cli-use-skill-latest.zip](https://pubdz.paperol.cn/wjx-ai-kit/skills/wjx-cli-use-skill-latest.zip)
2. 解压到工作台的技能目录（或当前项目目录下）
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

CLI 输出结构化 JSON，可与工作台配合使用。例如：

```bash
# 查询答卷并分析 NPS
wjx response query --vid 12345 --page_size 100
wjx analytics nps --scores 9,10,7,3,8
```

---

## 第四步：验证

在你的工作台中输入：

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

### 场景 3: 自主完成多步骤任务（工作台优势）

> 你：为下周的产品发布会准备调研方案——会前期望调查、会���实时反馈、会后满意度评估
>
> AI 自动规划三份问卷 → 逐一设计并创建 → 汇总所有链接和操作说明

---

## 常见问题

### 我用的工作台工具不在列表中？

只要你的工作台支持 MCP 协议，就可以参照上方的标准配置接入问卷星。如遇到问题，请在 [GitHub Issues](https://github.com/wjxcom/wjx-ai-kit/issues) 反馈。

### 工作台和 IDE 插件有什么区别？

- **工作台**（Manus、WorkBuddy、QoderWork）：侧重任务交付，AI 自主规划和执行，适合非开发者
- **IDE 插件**（Cursor、Windsurf、Cline 等）：侧重代码编写，AI 辅助开发，适合开发者

两者都支持 MCP，问卷星功能一致。

### QoderWork 和 Qoder IDE 插件是什么关系？

Qoder IDE 插件面向开发者，嵌入 VS Code / JetBrains。QoderWork 是独立桌面应用，面向更广泛用户。两者同属 Qoder 生态，MCP 配置方式相同。详见 [Qoder 配置指南](./setup-qoder.md)。

---

## 下一步

- [MCP Server 入门指南](./mcp-getting-started.md) — 了解 56 个工具的完整能力
- [wjx-ai-kit 总览](./00-overview.md) — 了解 SDK、MCP、CLI 三合一架构
