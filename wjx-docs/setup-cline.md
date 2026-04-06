# 在 Cline 中使用问卷星

> 在 VS Code 中通过 Cline 插件用自然语言创建问卷、分析数据、管理通讯录

---

## 准备工作

1. **安装 Cline** — 在 VS Code 扩展市场搜索 "Cline" 并安装
2. **Node.js >= 20** — 运行 `node --version` 确认版本，低于 20 请前往 [nodejs.org](https://nodejs.org) 升级
3. **获取问卷星 API Key** — 登录 [问卷星](https://www.wjx.cn)，进入「账号设置」→「API 设置」，创建或复制你的 API Key

---

## 第一步：接入 MCP Server

### 方式一：通过 UI 配置（推荐）

1. 打开 VS Code 侧边栏中的 **Cline** 面板
2. 点击顶部 **Settings** 齿轮图标
3. 找到 **MCP Servers** 部分
4. 点击 **Add MCP Server**
5. 填入以下信息：
   - 名称：`wjx`
   - 命令：`npx`
   - 参数：`wjx-mcp-server`
   - 环境变量：`WJX_API_KEY` = `你的 API Key`

### 方式二：直接编辑配置文件

Cline 的 MCP 配置文件位于 VS Code 的 globalStorage 目录中：

- **文件名**: `cline_mcp_settings.json`
- **路径**: VS Code globalStorage 中 Cline 扩展的目录下

配置内容：

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

## 第二步：增强 Agent 能��

Cline 支持 Custom Instructions 功能。你可以在 Cline 设置中添加问卷领域的自定义指令，让 AI 更好地理解问卷星操作。

在 Cline Settings 的 **Custom Instructions** 区域添加：

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

你也可以将 wjx-ai-kit 的 Skill 参考文档中更详细的 DSL 语法和分析方法内容加入 Custom Instructions。

---

## 第三步：验证

在 Cline 对话框中输入：

> 帮我创建一份客户满意度调查问卷

如果一切正常，Cline 会调用问卷星工具，自动创建问卷并返回编辑链接。

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

### 添加 MCP Server 后工具没有出现？

1. 确认 Cline 已更新到最新版本（支持 MCP 的版本）
2. 在 Cline Settings → MCP Servers 中检查连接状态
3. 点击服务器旁边的刷新按钮重新连接

### Cline 支持哪些模型？

Cline 支持 Claude、GPT、Gemini 等多种模型。使用 Claude 系列模型与 MCP 工具的兼容性最佳。

### 工具调用时需要手动确认吗？

Cline 默认会在每次工具调用前请求用户确认。你可以在设置中调整自动批准策略，对信任的工具开启自动执行。

---

## 下一步

- [MCP Server 入门指南](./mcp-getting-started.md) — 了解 56 个工具的完整能力
- [wjx-ai-kit 总览](./00-overview.md) — 了解 SDK、MCP、CLI 三合一架构
