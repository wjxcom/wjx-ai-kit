# 在 Claude Desktop 中使用问卷星

> 在 Claude Desktop 中用自然语言创建问卷、分析数据、管理通讯录

---

## 准备工作

1. **安装 Claude Desktop** — 前往 [claude.ai/download](https://claude.ai/download) 下载并安装
2. **Node.js >= 20** — 运行 `node --version` 确认版本，低于 20 请前往 [nodejs.org](https://nodejs.org) 升级
3. **获取问卷星 API Key** — 登录 [问卷星](https://www.wjx.cn)，进入「账号设置」→「API 设置」，创建或复制你的 API Key

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

## 第二步：关于 Agent 能力

Claude Desktop 目前不支持原生 Agent 部署，但 wjx-mcp-server 内置了 **19 个 MCP Prompts**，提供预设工作流模板：

- **NPS 分析** — 自动计算净推荐值并生成分布报告
- **满意度调查** — 创建标准化满意度问卷并分析结果
- **考试出题** — 根据知识点自动生成考试问卷
- **异常检测** — 识别答卷中的异常模式

在 Claude Desktop 中，你可以直接使用这些 Prompts 来启动复杂工作流。

此外，wjx-ai-kit 提供的 Skill 参考文档（如 DSL 语法、分析方法）也可以作为对话上下文的参考素材。

---

## 第三步：验证

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

- [MCP Server 入门指南](./mcp-getting-started.md) — 了解 56 个工具的完整能力
- [wjx-ai-kit 总览](./00-overview.md) — 了解 SDK、MCP、CLI 三合一架构
