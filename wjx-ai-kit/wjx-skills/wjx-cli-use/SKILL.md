---
name: wjx-cli-use
description: Guide for using wjx-cli (Wenjuanxing CLI) to create surveys, query responses, and analyze data. Use when the user wants to interact with the Wenjuanxing (问卷星) platform via CLI commands, including creating surveys with specific question types, querying response data, managing contacts, or performing analytics. Covers all 69 subcommands across 15 modules.
---

# wjx-cli 使用指南

wjx-cli 是问卷星 OpenAPI 的命令行工具。所有命令格式：`wjx <模块> <操作> [选项]`。

## 安装与配置

```bash
npm install -g wjx-cli
wjx init              # 交互式配置：API Key、Base URL、Corp ID → ~/.wjxrc
wjx doctor            # 检查连接状态
```

## 全局选项

| 选项 | 说明 |
|------|------|
| `--api-key <key>` | API Key（覆盖环境变量/配置文件） |
| `--table` | 输出为可读表格（默认 JSON） |
| `--dry-run` | 预览 API 请求，不实际发送 |
| `--stdin` | 从 stdin 读取 JSON 参数（可访问 SDK 全部参数） |

## 命令总览（15 模块，58 命令）

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

### 1. 创建问卷（推荐：DSL 文本格式）

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

### 2. 查询与分析答卷

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

### 3. 管理通讯录与账号

```bash
wjx contacts add --users '[{"userid":"u1","name":"Alice","mobile":"13800000001"}]'
wjx department add --depts '["研发部/后端"]'
wjx admin add --users '[{"userid":"u1","role":2}]'
wjx account add --subuser user1 --password pass123 --role 1
```

角色编号：1=系统管理员, 2=问卷管理员, 3=统计查看, 4=完整查看。所有参数见 [references/contacts-commands.md](references/contacts-commands.md)。

## 常用枚举值

| 参数 | 值 |
|------|-----|
| 问卷类型 (`--type`) | 1=调查, 2=测评, 3=投票, 6=考试, 7=表单 |
| 问卷状态 (`--state`) | 1=发布, 2=暂停, 3=删除 |
| 下载格式 (`--suffix`) | 0=CSV, 1=SAV, 2=Word |
| 排序方式 (`--sort`) | 0=升序, 1=降序 |

## 参考文件（按需读取）

- [DSL 语法](references/dsl-syntax.md) — create-by-text 的完整 DSL 格式，28 种题型标签
- [问卷命令](references/survey-commands.md) — survey 模块全部子命令参数、JSON 创建格式、设置
- [答卷命令](references/response-commands.md) — 查询筛选、submitdata 格式、下载选项
- [通讯录命令](references/contacts-commands.md) — 联系人、部门、管理员、标签、子账号、SSO
- [分析命令](references/analytics-commands.md) — NPS/CSAT/CES 公式、异常检测、数据解码
- [题型编码](references/question-types.md) — 完整 q_type/q_subtype 映射表
