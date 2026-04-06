# 在 Cursor 中使用问卷星

> 在 Cursor 中用自然语言创建问卷、分析数据、管理通讯录

---

## 准备工作

1. **安装 Cursor** — 前往 [cursor.com](https://www.cursor.com) 下载并安装
2. **Node.js >= 20** — 运行 `node --version` 确认版本，低于 20 请前往 [nodejs.org](https://nodejs.org) 升级
3. **获取问卷星 API Key** — 登录 [问卷星](https://www.wjx.cn)，进入「账号设置」→「API 设置」，创建或复制你的 API Key

---

## 第一步：接入 MCP Server

### 方式一：配置文件（推荐）

在项目根目录创建 `.cursor/mcp.json`：

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

> 也可以放在全局路径 `~/.cursor/mcp.json`，这样所有项目都能使用。

### 方式二：通过 UI 配置

1. 打开 Cursor Settings（`Cmd+,` / `Ctrl+,`）
2. 进入 **Features** → **MCP**
3. 点击 **Add Server**
4. 填入名称 `wjx`，命令 `npx wjx-mcp-server`
5. 在环境变量中添加 `WJX_API_KEY`

### 企业用户

如需管理通讯录，在 `env` 中额外添加 `"WJX_CORP_ID": "你的企业通讯录 ID"`。

### HTTP 远程模式

如果你的团队部署了远程 MCP 服务，使用以下配置：

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

Cursor 不支持原生 Agent 部署，但你可以通过 `.cursorrules` 文件注入问卷领域知识，让 Cursor 的 AI 更好地理解问卷星操作。

在项目根目录创建 `.cursorrules` 文件，将 wjx-ai-kit 的 Skill 参考文档中的关键内容（如 DSL 语法、题型编码、分析方法）加入其中：

```
# 问卷星操作指南

## 创建问卷
使用 create_survey_by_text 工具时，遵循问卷星 DSL 语法：
- 第一行为问卷标题
- 每题以序号开头
- 支持题型：单选、多选、填空、量表、NPS、矩阵等

## 数据分析
- 使用 calculate_nps 计算净推荐值
- 使用 cross_tabulate 进行交叉分析
- 使用 query_responses 获取原始答卷数据
```

这些规则会在每次对话中自动加载，帮助 AI 更准确地调用问卷星工具。

---

## 第三步：验证

在 Cursor 的 AI 对话中输入：

> 帮我创建一份客户满意度调查问卷

如果一切正常，Cursor 会调用问卷星工具，自动创建问卷并返回编辑链接。

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

### MCP 工具没有出现在 Cursor 中？

1. 确认 `.cursor/mcp.json` 放在项目根目录下
2. 重新打开 Cursor 或重新加载窗口（`Cmd+Shift+P` → Reload Window）
3. 在 Settings → Features → MCP 中确认服务状态为已连接

### Cursor 用的是哪个模型？

Cursor 的 Agent 模式支持多种模型。建议使用 Claude 系列模型，与 MCP 工具的兼容性最佳。

### 项目级配置和全局配置有什么区别？

- 项目级（`.cursor/mcp.json`）：只在当前项目中生效，适合不同项目使用不同的 API Key
- 全局级（`~/.cursor/mcp.json`）：所有项目共享，适合个人开发者

---

## 下一步

- [MCP Server 入门指南](./mcp-getting-started.md) — 了解 56 个工具的完整能力
- [wjx-ai-kit 总览](./00-overview.md) — 了解 SDK、MCP、CLI 三合一架构
