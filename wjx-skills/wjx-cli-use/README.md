# 问卷星 AI Skill

> 用自然语言做调研 -- 创建问卷、分析数据、管理通讯录，像聊天一样简单。

**问卷星**（[wjx.cn](https://www.wjx.cn)）是中国领先的在线调研平台，服务 2.6 亿用户。这个 Skill 让你的 AI 助手直接操作问卷星，不用打开网页，不用学 API。

---

## 你能做什么

### 一句话创建问卷

> "帮我做一份客户满意度调查，包含 NPS 评分和 5 个维度的量表题"

AI 自动生成问卷结构，调用问卷星 API 创建，返回编辑链接和填写链接。30 秒搞定。

### 对话式数据分析

> "分析一下问卷 12345 的 NPS 得分，找出需要改进的点"

AI 自动查询答卷数据，计算 NPS 分值，给出推荐者/中立者/贬损者分布，附带改进建议。

### 批量自动化

> "把这份名单导入市场部通讯录"

自动解析数据格式，调用批量导入 API，验证导入结果。省掉手工操作。

### 考试出题

> "出一套 JavaScript 基础测验，10 道选择题"

AI 生成题目，创建考试问卷（type=6），发布后可直接分享考试链接。

---

## 三种接入方式

根据你使用的 AI 工具和场景，选一种即可。

### 方式一：MCP Server（推荐，所有 AI 工具通用）

一行命令，56 个工具直接可用。

```bash
npx wjx-mcp-server
```

在你的 AI 工具中添加配置（以 Claude Desktop 为例）：

```json
{
  "mcpServers": {
    "wjx": {
      "command": "npx",
      "args": ["wjx-mcp-server"],
      "env": { "WJX_API_KEY": "你的APIKey" }
    }
  }
}
```

**支持的 AI 工具**：Claude Desktop、Claude Code、Cursor、Windsurf、Cline、GitHub Copilot、Trae、Gemini、Qoder、OpenClaw、国产 Claw 系列。详见各工具配置指南。

### 方式二：下载 Skill 包（适合 Claw 系列工具）

1. 下载并解压 Skill 包到本地
2. 运行安装脚本：

```bash
cd wjx-cli-use
bash setup.sh -y
```

安装脚本会自动完成：检测 Node.js → 安装 wjx-cli → 引导微信登录获取 API Key → 配置 → 验证。

3. 在 AI 工具的 Skills/技能 设置中添加本目录
4. 对 AI 说 "帮我创建一份问卷" 即可

### 方式三：CLI 命令行（适合脚本和自动化）

```bash
npm install -g wjx-cli    # 安装
wjx init                   # 配置 API Key
wjx doctor                 # 验证连接

wjx survey list                              # 查看问卷列表
wjx survey create-by-text --text "..."       # 用文本创建问卷
wjx response report --vid 12345              # 查看统计报告
wjx analytics nps --scores "[9,10,7,3,8]"   # 计算 NPS（离线）
```

69 个子命令覆盖问卷星全部 API 能力。详见 [CLI 入门指南](../../wjx-docs/cli-getting-started.md)。

---

## 支持的 AI 工具

| AI 工具 | 接入方式 | 配置指南 |
|---------|---------|---------|
| **Claude Code** | MCP + Agent + Skill + CLI | [配置指南](../../wjx-docs/setup-claude-code.md) |
| **Claude Desktop** | MCP + Agent + Skill + CLI | [配置指南](../../wjx-docs/setup-claude-desktop.md) |
| **Cursor** | MCP + Agent + Skill + CLI | [配置指南](../../wjx-docs/setup-cursor.md) |
| **Windsurf** | MCP + Agent + Skill + CLI | [配置指南](../../wjx-docs/setup-windsurf.md) |
| **Cline** | MCP + Agent + Skill + CLI | [配置指南](../../wjx-docs/setup-cline.md) |
| **GitHub Copilot** | MCP + Agent + Skill + CLI | [配置指南](../../wjx-docs/setup-copilot.md) |
| **Trae** | MCP + Agent + Skill + CLI | [配置指南](../../wjx-docs/setup-trae.md) |
| **Gemini** | MCP + Agent + Skill + CLI | [配置指南](../../wjx-docs/setup-gemini.md) |
| **Qoder** | MCP + Agent + Skill + CLI | [配置指南](../../wjx-docs/setup-qoder.md) |
| **OpenClaw** | MCP + Skill | [配置指南](../../wjx-docs/setup-openclaw.md) |
| **国产 Claw 系列** | MCP + Skill | [配置指南](../../wjx-docs/setup-claw.md) |

---

## 获取 API Key

1. 打开浏览器访问：[微信扫码登录](https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1)
2. 用微信扫码登录
3. 登录后自动跳转到 API Key 页面，复制 Key
4. 在终端运行 `wjx init`，粘贴 Key 即可

或者运行 `bash setup.sh`，脚本会自动引导完成以上步骤。

---

## 完整能力

| 能力 | 说明 | 命令示例 |
|------|------|---------|
| 创建问卷 | DSL 文本/JSON/复制 | `wjx survey create-by-text --text "..."` |
| 管理问卷 | 列表/详情/设置/删除 | `wjx survey list` |
| 答卷查询 | 明细/统计/实时/计数 | `wjx response report --vid <vid>` |
| 数据导出 | CSV/SAV/Word | `wjx response download --vid <vid>` |
| NPS 分析 | 推荐者/中立/贬损 | `wjx analytics nps --scores "[...]"` |
| CSAT 分析 | 满意度评分 | `wjx analytics csat --scores "[...]"` |
| 异常检测 | 秒答/直线/重复 | `wjx analytics anomalies --data '[...]'` |
| 通讯录 | 联系人增删查 | `wjx contacts add --users '[...]'` |
| 部门管理 | 部门树增删改 | `wjx department list` |
| 子账号 | 创建/管理子账号 | `wjx account add --subuser user1` |
| SSO | 单点登录链接 | `wjx sso subaccount-url --subuser user1` |

---

## 示例文件

本 Skill 包含 DSL 示例文件，可直接用于创建问卷：

```bash
wjx survey create-by-text --file examples/nps_survey.txt           # NPS 调查
wjx survey create-by-text --file examples/satisfaction_survey.txt   # 满意度调查
wjx survey create-by-text --file examples/exam_survey.txt --type 6  # 考试问卷
```

也可以自己写 DSL 文本，语法简单直觉：

```
问卷标题
问卷描述（可选）

1. 题目文本 [单选题]
选项A
选项B

2. 评分题 [量表题]
1~10

3. 开放题 [填空题]
```

支持 28 种题型标签，详见 [DSL 语法参考](references/dsl-syntax.md)。

---

## 相关链接

- [问卷星官网](https://www.wjx.cn)
- [wjx-ai-kit GitHub](https://github.com/wjxcom/wjx-ai-kit)
- [wjx-api-sdk (npm)](https://www.npmjs.com/package/wjx-api-sdk)
- [wjx-mcp-server (npm)](https://www.npmjs.com/package/wjx-mcp-server)
- [wjx-cli (npm)](https://www.npmjs.com/package/wjx-cli)
