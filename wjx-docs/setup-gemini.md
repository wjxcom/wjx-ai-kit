# 在 Gemini Code Assist 中使用问卷星

> 在 Gemini Code Assist 中用自然语言创建问卷、分析数据、管理通讯录

---

## 准备工作

1. **安装 Gemini Code Assist** — 在 VS Code 或 JetBrains IDE 的扩展市场搜索 "Gemini Code Assist" 并安装
2. **Node.js >= 20** — 运行 `node --version` 确认版本，低于 20 请前往 [nodejs.org](https://nodejs.org) 升级
3. **获取问卷星 API Key** — 登录 [问卷星](https://www.wjx.cn)，进入「账号设置」→「API 设置」，创建或复制你的 API Key

> 注意：Gemini Code Assist 的 MCP 支持可能处于预览阶段，功能和配置方式可能随版本更新变化。

---

## 第一步：接入 MCP Server

### 通过扩展设置配置

在 Gemini Code Assist 扩展设置中找到 MCP 相关配置项，添加以下服务器信息：

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

## 第二步：增强 Agent 能力

Gemini Code Assist 目前不支持原生 Agent 部署，但你可以将 wjx-ai-kit 的 Skill 参考文档作为对话上下文的参考素材，帮助 Gemini 更好地理解问卷星的 DSL 语法、题型编码和分析方法。

---

## 第三步：验证

在 Gemini Code Assist 的对话中输入：

> 帮我创建一份客户满意度调查问卷

如果一切正常，Gemini 会调用问卷星工具，自动创建问卷并返回编辑链接。

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

---

## 常见问题

### Gemini Code Assist 支持 MCP 吗？

MCP 支持取决于 Gemini Code Assist 的具体版本。建议关注 [Google Cloud 官方文档](https://cloud.google.com/gemini/docs) 获取最新的 MCP 支持信息。

### 工具调用失败？

1. 确认 Node.js 版本 >= 20
2. 确认 API Key 有效且无多余空格
3. 检查 Gemini Code Assist 扩展是否为最新版本

---

## 下一步

- [MCP Server 入门指南](./mcp-getting-started.md) — 了解 56 个工具的完整能力
- [wjx-ai-kit 总览](./00-overview.md) — 了解 SDK、MCP、CLI 三合一架构
