# MCP Server 入门指南：让 AI 直接操作问卷星

> 5 分钟配置，用自然语言创建问卷、查询数据、分析结果

---

## 什么是 MCP Server

MCP (Model Context Protocol) 是 AI 工具调用的标准协议。wjx-mcp-server 让 Claude、Cursor、Windsurf 等 AI 客户端可以直接操作你的问卷星账户——创建问卷、查看答卷、做数据分析，全部用自然语言完成。

打个比方：如果问卷星是一栋大楼，MCP Server 就是给 AI 配了一把钥匙和一份楼层指南。AI 知道每个房间在哪、能做什么，你只需要说目的地。

---

## 准备工作

### 1. 获取问卷星 API Key

微信扫码登录 [API Key 获取页](https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1)，登录后页面直接显示 API Key。

> 企业用户如需管理通讯录，还需要获取 Corp ID（企业通讯录 ID）。登录问卷星后台 → 我的问卷 → 通讯录 → 通讯录设置，页面中会显示通讯录 ID。

### 2. 确认 Node.js 版本

```bash
node --version
# 需要 v20 或更高版本
```

如果版本低于 20，请前往 [nodejs.org](https://nodejs.org) 下载安装最新 LTS 版本。

---

## 接入 Claude Desktop

### 安装

```bash
npm install -g wjx-mcp-server
```

### 配置

找到 Claude Desktop 配置文件：
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

添加以下内容：

```json
{
  "mcpServers": {
    "wjx": {
      "command": "npx",
      "args": ["wjx-mcp-server"],
      "env": {
        "WJX_API_KEY": "替换为你的API Key"
      }
    }
  }
}
```

保存后重启 Claude Desktop。在输入框底部会看到工具图标，点击可以看到 58 个问卷星工具已就绪。

> 更详细的配置说明请参阅 [Claude Desktop 配置指南](./setup-claude-desktop.md)。

### 验证

对 Claude 说：

> "列出我的问卷"

Claude 会调用 `list_surveys` 工具，返回你账户下的问卷列表。如果看到问卷数据，说明配置成功。

---

## 接入 Cursor

在项目根目录创建 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "wjx": {
      "command": "npx",
      "args": ["wjx-mcp-server"],
      "env": {
        "WJX_API_KEY": "替换为你的API Key"
      }
    }
  }
}
```

重启 Cursor，在 AI 对话中即可使用问卷星工具。

> 更详细的配置说明请参阅 [IDE 插件配置指南](./setup-ide.md)。

---

## 接入 Claude Code

```bash
claude mcp add wjx --env WJX_API_KEY=你的APIKey -- npx wjx-mcp-server
```

> Claude Code 支持完整的 Agent + Skill 体验，详见 [Claude Code 配置指南](./setup-claude-code.md)。

---

## 第一个任务：创建问卷

接入完成后，试试对 AI 说：

> "帮我创建一份客户满意度调查，包含：
> 1. NPS 推荐意愿评分（0-10）
> 2. 5 个维度的量表评分（产品质量、服务态度、响应速度、性价比、整体体验）
> 3. 一个开放建议题"

AI 会：
1. 设计问卷结构
2. 调用 `create_survey_by_json`（覆盖 70+ 题型，含矩阵/比重/滑块/文件上传/排序）创建问卷
3. 返回问卷 ID 和预览链接

整个过程不到 1 分钟。

---

## 常用对话示例

### 问卷管理

```
"列出我最近创建的 5 份问卷"
"获取问卷 12345 的详细信息"
"把问卷 12345 发布上线"
"暂停问卷 12345 的收集"
"删除草稿问卷 12345"
```

### 答卷查询

```
"问卷 12345 收到了多少份答卷？"
"查询问卷 12345 最近 7 天的答卷数据"
"下载问卷 12345 的全部答卷为 CSV"
"查看问卷 12345 的统计报告"
```

### 数据分析

```
"分析问卷 12345 的 NPS 得分"
"帮我做问卷 12345 的满意度分析"
"检测问卷 12345 的异常答卷（刷题、秒答等）"
"对比问卷 12345 和 67890 的关键指标"
```

### 问卷创建

```
"创建一份员工敬业度调查"
"帮我出一套高中物理力学考试题，20 题"
"做一份 360 度评估问卷，包含领导力、协作、创新三个维度"
"创建一份产品 NPS 调查，中英双语"
```

---

## 工具分类速览

MCP Server 提供 58 个工具（含 1 个系统工具 `get_config`），按功能分为 7 个模块：

| 模块 | 工具数 | 用途 | 示例 |
|------|--------|------|------|
| **问卷管理** | 13 | 创建、查看、修改、删除问卷 | `create_survey_by_json` |
| **答卷管理** | 9 | 查询、下载、提交答卷 | `query_responses` |
| **通讯录** | 14 | 联系人、部门、管理员、标签 | `add_contacts` |
| **SSO** | 5 | 生成单点登录链接 | `sso_subaccount_url` |
| **用户体系** | 6 | 参与者管理和问卷绑定 | `bind_activity` |
| **子账号** | 5 | 多用户账号管理 | `add_sub_account` |
| **数据分析** | 5 | NPS/CSAT/异常检测（本地计算） | `calculate_nps` |

### 内置参考资源

AI 可以随时查阅 8 个参考资源，不需要你提供文档：

| 资源 | 内容 |
|------|------|
| `wjx://reference/question-types` | 全部题型编码表（单选、多选、量表、矩阵等） |
| `wjx://reference/survey-types` | 问卷类型（调查、考试、投票、表单等） |
| `wjx://reference/dsl-syntax` | DSL 文本格式语法参考 |
| `wjx://reference/response-format` | 答卷数据编码格式说明 |
| `wjx://reference/analysis-methods` | NPS/CSAT 计算方法和行业基准 |
| `wjx://reference/survey-statuses` | 问卷状态码和合法状态转换 |
| `wjx://reference/user-roles` | 子账号角色权限说明 |
| `wjx://reference/push-format` | Webhook 推送数据加密格式 |

### 预设 Prompt 模板

23 个预设 Prompt 提供标准化工作流：

**调研分析类：**
- `nps-analysis` — 完整 NPS 分析流程
- `csat-analysis` — 满意度分析 + 驱动因素识别
- `cross-tabulation` — 交叉分析
- `sentiment-analysis` — 开放题情感分析
- `survey-health-check` — 问卷质量诊断（0-100 健康分）
- `comparative-analysis` — 多问卷对比分析

**问卷生成类：**
- `generate-survey` — 通用问卷生成
- `generate-nps-survey` — NPS 调查生成
- `generate-satisfaction-survey` — 满意度调查生成
- `generate-engagement-survey` — 员工敬业度调查生成
- `generate-360-evaluation` — 360 度评估生成
- `generate-exam-from-document` — 从文档出考试题
- `generate-exam-from-knowledge` — 从知识领域出考试题

**运维操作类：**
- `design-survey` — 引导式问卷设计
- `analyze-results` — 数据分析工作流
- `create-nps-survey` — 一键创建标准 NPS 问卷
- `configure-webhook` — Webhook 配置向导
- `anomaly-detection` — 异常答卷检测
- `user-system-workflow` — 用户体系端到端指南

---

## 环境变量参考

| 变量 | 必填 | 默认值 | 说明 |
|------|:----:|--------|------|
| `WJX_API_KEY` | 是 | - | 问卷星 API Key |
| `WJX_CORP_ID` | 否 | - | 企业通讯录 ID |
| `WJX_BASE_URL` | 否 | `https://www.wjx.cn` | API 基础地址 |
| `MCP_TRANSPORT` | 否 | `stdio` | 传输模式（stdio / http） |
| `PORT` | 否 | `3000` | HTTP 模式端口 |
| `MCP_AUTH_TOKEN` | 否 | - | HTTP 模式认证令牌 |

---

## 常见问题

**Q: 我看不到工具图标 / AI 说找不到问卷星工具**

检查：
1. 配置文件路径是否正确
2. API Key 是否已填入
3. 是否重启了 Claude Desktop / Cursor
4. 运行 `npx wjx-mcp-server` 看是否有报错

**Q: AI 创建问卷失败，说认证错误**

确认 API Key 是否有效。可以在终端测试：

```bash
WJX_API_KEY=你的Key npx wjx-mcp-server
```

然后在 Claude 中重试。

**Q: 可以在团队中共享使用吗？**

可以。有两种方式：
1. **每人独立配置**：每个团队成员用自己的 API Key 配置本地 MCP Server
2. **HTTP 模式共享**：部署一个 HTTP 模式的 MCP Server，团队共用（详见[进阶指南](./mcp-advanced.md)）

**Q: 支持哪些 AI 客户端？**

任何支持 MCP 协议的客户端都可以接入。已验证的包括：
- Claude Desktop
- Claude Code
- Cursor
- Windsurf
- Continue.dev

---

## 下一步

- [MCP Server 进阶指南](./mcp-advanced.md) — HTTP 部署、Docker、多租户、自动化工作流
- [CLI 入门指南](./cli-getting-started.md) — 命令行工具快速上手
- [总纲](./00-overview.md) — wjx-ai-kit 全景概览
