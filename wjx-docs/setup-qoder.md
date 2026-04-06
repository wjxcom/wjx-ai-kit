# 在 Qoder 中使用问卷星

> 在 Qoder 中用自然语言创建问卷、分析数据、管理通讯录

---

## 什么是 Qoder

[Qoder](https://qoder.ai) 是阿里巴巴面向全球开发者推出的 Agentic 编程平台，支持 VS Code 插件和 JetBrains 插件两种形态。Qoder 具备仓库级代码理解、智能模型路由、Quest 规格驱动开发等特性，支持 MCP 协议接入外部工具。

---

## 准备工作

1. **安装 Qoder** — 前往 [qoder.ai](https://qoder.ai) 下载，或在 VS Code / JetBrains 扩展市场搜索 "Qoder" 安装插件
2. **Node.js >= 20** — 运行 `node --version` 确认版本，低于 20 请前往 [nodejs.org](https://nodejs.org) 升级
3. **获取问卷星 API Key** — 登录 [问卷星](https://www.wjx.cn)，进入「账号设置」→「API 设置」，创建或复制你的 API Key

---

## 第一步：接入 MCP Server

在 Qoder 的 MCP 配置中添加问卷星服务器：

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

> Qoder 的 MCP 配置路径请参阅 [Qoder 官方文档](https://qoder.ai/docs)，配置方式可能因版本更新而变化。

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

## 第二步：部署 Agent + Skill

Qoder 支持记忆系统和规则文件，可以利用 wjx-ai-kit 的 Skill 参考文档增强 AI 的问卷领域知识：

1. 将 `wjx-skills/` 目录复制到项目中，作为 Qoder 的上下文参考
2. 在 Qoder 的记忆/规则配置中添加问卷星相关上下文

```
wjx-skills/
├── wjx-mcp-use/          # MCP 工具使用指南
│   ├── SKILL.md           # 56 个工具总览和工作流
│   └── references/        # 按需查阅的详细参数
└── wjx-cli-use/           # CLI 命令使用指南
    ├── SKILL.md           # 69 个命令总览和工作流
    └── references/        # 按需查阅的详细参数
```

---

## 第三步：验证

在 Qoder 的对话中输入：

> 帮我创建一份客户满意度调查问卷

如果一切正常，Qoder 会调用问卷星 MCP 工具，自动创建问卷并返回编辑链接。

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

### 场景 3: Quest 模式 + 问卷

> 你：用 Quest 模式为我的项目规划一套用户调研方案
>
> Qoder 先生成调研规格文档 → 拆解为多份问卷任务 → 逐个调用 MCP 工具创建 → 汇总链接

---

## 常见问题

### Qoder 和通义灵码有什么区别？

通义灵码（Lingma）面向国内市场，定位是代码补全和问答助手。Qoder 面向海外市场，定位是 Agentic 编程平台，支持更复杂的自主任务执行。两者都支持 MCP。

### Qoder 的 MCP 配置在哪里？

Qoder 的 MCP 配置入口可能随版本更新变化，请参阅 [Qoder 官方文档](https://qoder.ai/docs) 获取最新信息。

---

## 下一步

- [MCP Server 入门指南](./mcp-getting-started.md) — 了解 56 个工具的完整能力
- [wjx-ai-kit 总览](./00-overview.md) — 了解 SDK、MCP、CLI 三合一架构
