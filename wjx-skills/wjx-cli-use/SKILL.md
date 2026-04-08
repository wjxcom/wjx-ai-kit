---
name: wjx-cli-use
description: "Guide for using wjx-cli (Wenjuanxing CLI) to create surveys, query responses, and analyze data. Use when the user mentions: 问卷, 调查, 收集, 表单, 投票, 考试, 测评, 满意度, NPS, 问卷星, wjx, survey, questionnaire — or wants to create surveys, view responses, export data, analyze NPS/CSAT, manage contacts/departments/sub-accounts. Covers all 69 subcommands across 15 modules."
---

# wjx-cli 使用指南

wjx-cli 是问卷星 OpenAPI 的命令行工具。所有命令格式：`wjx <模块> <操作> [选项]`。

## 快速路由

| 用户意图 | 命令 |
|---------|------|
| 做调查/问卷 | `wjx survey create-by-text --text "..."` |
| 做考试/测验 | `wjx survey create-by-text --text "..." --type 6` |
| 做投票 | `wjx survey create-by-text --text "..." --type 3` |
| 做表单/报名表 | `wjx survey create-by-text --text "..." --type 7` |
| 看问卷结果 | 先 `wjx survey list` 找 vid，再 `wjx response report --vid <vid>` |
| 导出答卷数据 | `wjx response download --vid <vid>` |
| 分析 NPS | `wjx analytics nps --scores "[9,10,7,3]"` |
| 导入联系人 | `wjx contacts add --users '[...]'`（需 `WJX_CORP_ID`） |
| 查看问卷链接 | `wjx survey url --vid <vid>` |

## 安装与配置

### 快速安装（推荐）

```bash
./setup.sh -y    # 自动检测环境 → 安装 wjx-cli → 引导获取 API Key → 配置 → 验证
```

### 手动安装

```bash
npm install -g wjx-cli
wjx init              # 交互式配置：API Key、Base URL、Corp ID → ~/.wjxrc
wjx doctor            # 检查连接状态
```

### 其他选项

```bash
./setup.sh       # 交互式安装
./setup.sh -c    # 仅检查环境
./setup.sh -v    # 验证安装
./setup.sh -h    # 显示帮助
```

## 全局选项

| 选项 | 说明 |
|------|------|
| `--api-key <key>` | API Key（覆盖环境变量/配置文件） |
| `--table` | 输出为可读表格（默认 JSON） |
| `--dry-run` | 预览 API 请求，不实际发送 |
| `--stdin` | 从 stdin 读取 JSON 参数（可访问 SDK 全部参数） |

## 命令总览（15 模块，69 命令）

| 模块 | 命令 | 说明 |
|------|------|------|
| `survey` | list, get, create, create-by-text, delete, status, settings, update-settings, tags, tag-details, clear-bin, upload, export-text, url | 问卷增删改查与配置 |
| `response` | query, realtime, download, submit, modify, clear, report, winners, 360-report, count | 答卷数据操作 |
| `contacts` | query, add, delete | 联系人管理（需要 WJX_CORP_ID） |
| `department` | list, add, modify, delete | 部门管理 |
| `admin` | add, delete, restore | 管理员管理 |
| `tag` | list, add, modify, delete | 标签管理 |
| `user-system` | add-participants, modify-participants, delete-participants, bind, query-binding, query-surveys | 用户系统（已过时） |
| `account` | list, add, modify, delete, restore | 子账号管理 |
| `sso` | subaccount-url, user-system-url, partner-url | SSO 链接生成 |
| `analytics` | decode, nps, csat, anomalies, compare, decode-push | 本地分析（无需 API Key） |
| `init` | （独立命令） | 交互式配置向导 |
| `doctor` | （独立命令） | 环境诊断 |
| `completion` | bash, zsh, fish, install | Shell 自动补全 |
| `skill` | install, update | 管理 Claude Code 技能（安装/更新 wjx-cli-use） |
| `update` | （独立命令） | 自更新 wjx-cli 到最新版本 |

## 核心工作流

### 工作流 1：创建问卷（DSL 文本格式）

```bash
# AI Agent 推荐使用 DSL 文本格式
wjx survey create-by-text --text "问卷标题

可选描述

1. 题目文本[单选题]
选项A
选项B

2. 另一个题目[填空题]"
```

考试问卷加 `--type 6`。完整 DSL 语法（含 28 种题型标签）见 [references/dsl-syntax.md](references/dsl-syntax.md)。

JSON 创建或复制问卷见 [references/survey-commands.md](references/survey-commands.md)。

### 工作流 2：查询与分析答卷

```bash
wjx response report --vid 12345           # 统计报告（建议第一步）
wjx response query --vid 12345            # 答卷明细数据
wjx response download --vid 12345         # 批量导出（CSV/SAV/Word）
wjx response count --vid 12345            # 答卷总数

# 本地分析（无需 API）
wjx analytics nps --scores "[9,10,7,3,8]"
wjx analytics csat --scores "[4,5,3,5,2]"
wjx analytics decode --submitdata "1\$1}2\$3|4"
```

完整答卷查询参数（筛选、分页、条件）见 [references/response-commands.md](references/response-commands.md)。

### 工作流 3：管理通讯录与账号

```bash
wjx contacts add --users '[{"userid":"u1","name":"Alice","mobile":"13800000001"}]'
wjx department add --depts '["研发部/后端"]'
wjx admin add --users '[{"userid":"u1","role":2}]'
wjx account add --subuser user1 --password pass123 --role 1
```

子账号角色编号：1=系统管理员, 2=问卷管理员, 3=统计查看, 4=完整查看。管理员角色编号不同（0-5），详见 [references/contacts-commands.md](references/contacts-commands.md)。

### 工作流 4：考试/测评问卷

```bash
# 创建考试问卷（type=6）
wjx survey create-by-text --text "JavaScript 基础测验

1. typeof null 的结果是？[单选题]
\"null\"
\"undefined\"
\"object\"
\"boolean\"

2. 请解释闭包的概念 [填空题]" --type 6

# 也可使用示例文件
wjx survey create-by-text --file examples/exam_survey.txt --type 6
```

## 常用枚举值

| 参数 | 值 |
|------|-----|
| 问卷类型 (`--type`) | 1=调查, 2=测评, 3=投票, 6=考试, 7=表单 |
| 问卷状态 (`--state`) | 1=发布, 2=暂停, 3=删除 |
| 下载格式 (`--suffix`) | 0=CSV, 1=SAV, 2=Word |
| 排序方式 (`--sort`) | 0=升序, 1=降序 |

## 常见错误与处理

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `API Key is required` | 未配置 API Key | 运行 `wjx init` 或设置 `WJX_API_KEY` 环境变量 |
| `Invalid API Key` | API Key 错误或过期 | 登录问卷星重新获取 API Key |
| `vid is required` | 未指定问卷 ID | 先 `wjx survey list` 查看问卷列表获取 vid |
| `Corp ID is required` | 通讯录操作需企业 ID | 运行 `wjx init` 配置 `WJX_CORP_ID` |
| `Network Error` | 网络连接问题 | 检查网络，或用 `--dry-run` 预览请求 |

## 环境变量

| 变量 | 必填 | 说明 |
|------|:---:|------|
| `WJX_API_KEY` | 是 | 问卷星 OpenAPI API Key |
| `WJX_CORP_ID` | 否 | 企业通讯录 ID（通讯录相关操作需要） |
| `WJX_BASE_URL` | 否 | 自定义 API 基础域名（默认 `https://www.wjx.cn`） |

凭据优先级：`--api-key` 参数 > 环境变量 > `~/.wjxrc` 配置文件。

## 参考文件（按需读取）

- [DSL 语法](references/dsl-syntax.md) — create-by-text 的完整 DSL 格式，28 种题型标签
- [问卷命令](references/survey-commands.md) — survey 模块全部子命令参数、JSON 创建格式、设置
- [答卷命令](references/response-commands.md) — 查询筛选、submitdata 格式、下载选项
- [通讯录命令](references/contacts-commands.md) — 联系人、部门、管理员、标签、子账号、SSO
- [分析命令](references/analytics-commands.md) — NPS/CSAT/CES 公式、异常检测、数据解码
- [题型编码](references/question-types.md) — 完整 q_type/q_subtype 映射表
