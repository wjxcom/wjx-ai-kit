# 在 Windsurf 中使用问卷星

> 在 Windsurf 中用自然语言创建问卷、分析数据、管理通讯录

---

## 准备工作

1. **安装 Windsurf** — 前往 [windsurf.com](https://windsurf.com) 下载并安装（Codeium 出品的 AI IDE）
2. **Node.js >= 20** — 运行 `node --version` 确认版本，低于 20 请前往 [nodejs.org](https://nodejs.org) 升级
3. **获取问卷星 API Key** — 登录 [问卷星](https://www.wjx.cn)，进入「账号设置」→「API 设置」，创建或复制你的 API Key

---

## 第一步：接入 MCP Server

### 全局配置

编辑全局配置文件 `~/.codeium/windsurf/mcp_config.json`：

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

### 项目级配置

如果只想在特定项目中启用，在项目根目录创建 `.windsurf/mcp.json`：

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

Windsurf 使用 Cascade AI 作为核心交互引擎。你可以通过 Windsurf Rules 文件注入问卷领域知识，提升 Cascade 操作问卷星的准确度。

在项目中创建 Windsurf Rules 文件，将 wjx-ai-kit 的 Skill 参考文档中的关键内容（如 DSL 语法、题型编码、分析方法）加入其中：

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

---

## 第三步：验证

在 Windsurf 的 Cascade 对话中输入：

> 帮我创建一份客户满意度调查问卷

如果一切正常，Cascade 会调用问卷星工具，自动创建问卷并返回编辑链接。

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

### Cascade 中看不到问卷星工具？

1. 确认配置文件路径正确（全局 `~/.codeium/windsurf/mcp_config.json` 或项目级 `.windsurf/mcp.json`）
2. 确认 JSON 格式正确
3. 重启 Windsurf

### 全局配置和项目配置哪个优先？

项目级配置优先于全局配置。如果两处都配置了 `wjx`，以项目级为准。

### Windsurf 和 Cursor 的配置有什么区别？

配置格式基本相同，主要区别在配置文件路径。Windsurf 的全局配置在 `~/.codeium/windsurf/` 目录下。

---

## 下一步

- [MCP Server 入门指南](./mcp-getting-started.md) — 了解 56 个工具的完整能力
- [wjx-ai-kit 总览](./00-overview.md) — 了解 SDK、MCP、CLI 三合一架构
