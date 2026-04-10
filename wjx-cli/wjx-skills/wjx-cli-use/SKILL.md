---
name: wjx-cli-use
description: "Guide for using wjx-cli (Wenjuanxing CLI) to create surveys, query responses, and analyze data. Use when the user mentions: 问卷, 调查, 收集, 表单, 投票, 考试, 测评, 满意度, NPS, 问卷星, wjx, survey, questionnaire — or wants to create surveys, view responses, export data, analyze NPS/CSAT, manage contacts/departments/sub-accounts. Covers all 69 subcommands across 15 modules."
---

# wjx-cli 使用指南

wjx-cli 是问卷星 OpenAPI 的命令行工具。命令格式：`wjx <模块> <操作> [选项]`。

全局选项：`--api-key <key>` 覆盖凭据，`--table` 表格输出，`--dry-run` 预览请求不发送，`--stdin` 从管道读 JSON 参数。

## AI Agent 行为准则（必读）

### 规则 1：一个需求 = 一个问卷

无论用户要求多少种题型，**必须在一次 create-by-text 调用中包含所有题目**。

- 正确：用户说"包含单选、多选、填空、量表" → 一个 DSL 文本包含所有题目 → 调用一次
- 错误：为每种题型分别调用 create-by-text → 产生多个问卷

一个问卷可以包含任意数量、任意类型的题目。没有"一种问卷只能包含一种题型"的限制。

### 规则 2：问卷类型 ≠ 题目类型

"投票问卷"、"考试问卷"、"调查问卷"是**问卷类型**（atype），通过 `--type` 参数设置。题目仍然使用普通的题型标签。

| 用户说 | 正确做法 | 错误做法 |
|--------|---------|---------|
| "投票单选" | `--type 3` + `[单选题]` | 寻找"投票单选"标签 |
| "投票多选" | `--type 3` + `[多选题]` | 寻找"投票多选"标签 |
| "考试填空" | `--type 6` + `[填空题]` | 寻找"考试填空"标签 |

不存在 `[投票单选题]`、`[投票多选题]` 这样的题型标签。"投票"描述的是问卷用途，不是题目类型。

### 规则 3：不支持的题型要明确告知

以下功能**不在 DSL/API 支持范围内**，遇到时应告知用户，不要反复尝试或创建替代问卷：

| 不支持的题型 | 替代方案 |
|-------------|---------|
| 签名题 | `[绘图题]` 近似替代 |
| 地区题/省市区选择 | API 不支持，建议用 `[多级下拉题]` 或网页端手动添加 |
| NPS 专用题 | `[量表题]` + `0~10` 实现相同效果 |
| 自动每题一页 | DSL 支持 `=== 分页 ===` 手动分页 |

遇到不支持的题型时，正确做法：
1. 告诉用户该题型不被支持，并建议替代方案
2. 继续创建问卷中其他可支持的题目
3. **不要**反复调用创建命令尝试不同方式，**不要**为不同题型分别创建多个问卷

### 规则 4：面向用户说自然语言，不说 CLI 命令

用户不需要知道 `wjx` 命令的存在。CLI 是你（AI）在后台执行的工具，**不要**在回复中展示 CLI 命令或命令行用法。

- 正确：「问卷已创建，这是填写链接：https://...」
- 错误：「你可以运行 `wjx survey list` 查看问卷列表」

唯一例外：用户明确问"怎么用命令行"或要求看具体命令时，可以展示。

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
| 查看问卷链接 | `wjx survey url --mode edit --activity <vid>` |

## 安装与配置

首次使用时按以下步骤执行。AI 应直接执行命令，不要求用户去终端操作。

### 步骤 1：检查并安装 wjx-cli

```bash
wjx --version
```

未安装或版本过低时，直接执行：

```bash
npm install -g wjx-cli
```

### 步骤 2：获取并配置 API Key

API Key 需要用户手动获取（无法自动化）：

1. 告诉用户打开以下链接，用微信扫码登录：
   `https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1`
2. 登录后页面会显示 API Key，让用户复制粘贴给你
3. 拿到 Key 后，直接执行（非交互模式）：

```bash
wjx init --api-key <用户提供的key>
```

凭据优先级：`--api-key` 参数 > `WJX_API_KEY` 环境变量 > `~/.wjxrc` 配置文件。通讯录操作另需 `WJX_CORP_ID`。

### 步骤 3：验证

配置完成后**必须执行** doctor 确认环境和连接正常：

```bash
wjx doctor
```

所有检查项应为 ok。如果 API 连接失败，根据错误信息排查（参见下方"常见错误与处理"）。

### 安装完成后的回复（重要）

验证通过后，**必须**向用户展示以下自然语言使用示例。**不要**向用户展示 CLI 命令——CLI 是你（AI）在后台使用的工具，用户只需要用自然语言告诉你需求。

请向用户回复：

```
安装完成！你现在可以直接告诉我你想做什么，比如：
- 「帮我做一份客户满意度调查，包含 NPS 评分题」
- 「出一套 JavaScript 基础测验，10 道选择题」
- 「查看我的问卷列表」
- 「分析一下这组 NPS 评分：9,10,7,3,8,10,6」
- 「把问卷 12345 的答卷数据导出为 CSV」
- 「帮我提交一份问卷的答案」
- 「帮我把这批联系人导入到通讯录」
```

## 命令总览（15 模块，69 命令）

| 模块 | 命令 | 说明 |
|------|------|------|
| `survey` | list, get, create, create-by-text, delete, status, settings, update-settings, tags, tag-details, clear-bin, upload, export-text, url | 问卷增删改查与配置 |
| `response` | query, realtime, download, submit, modify, clear, report, winners, 360-report, count | 答卷数据操作 |
| `contacts` | query, add, delete | 联系人管理（需 WJX_CORP_ID） |
| `department` | list, add, modify, delete | 部门管理 |
| `admin` | add, delete, restore | 管理员管理 |
| `tag` | list, add, modify, delete | 标签管理 |
| `user-system` | add-participants, modify-participants, delete-participants, bind, query-binding, query-surveys | 用户系统（已过时） |
| `account` | list, add, modify, delete, restore | 子账号管理 |
| `sso` | subaccount-url, user-system-url, partner-url | SSO 链接生成 |
| `analytics` | decode, nps, csat, anomalies, compare, decode-push | 本地分析（无需 API Key） |
| `init` / `doctor` / `whoami` | — | 配置向导 / 环境诊断 / 验证 API Key |
| `completion` | bash, zsh, fish, install | Shell 自动补全 |
| `skill` / `update` | — | 技能管理 / 自更新 |

## 核心工作流

### 创建问卷（DSL 文本格式）

> **重要**：必须执行 `wjx survey create-by-text` 命令来创建问卷。只生成 DSL 文本而不执行命令，问卷不会被创建到问卷星平台上。

```bash
wjx survey create-by-text --text "问卷标题

可选描述

1. 题目文本[单选题]
选项A
选项B

2. 另一个题目[填空题]"
```

问卷类型：`--type 1` 调查（默认），`3` 投票，`6` 考试，`7` 表单。考试问卷示例见 `examples/exam_survey.txt`。

**注意**：考试问卷的正确答案和每题分值**无法**通过 API 设置。创建考试后，应提供编辑链接 `wjx survey url --mode edit --activity <vid>`，指引用户在网页端手动配置答案与评分。

完整 DSL 语法（含 28 种题型标签）见 [references/dsl-syntax.md](references/dsl-syntax.md)。JSON 创建或复制问卷见 [references/survey-commands.md](references/survey-commands.md)。

### 查询与分析答卷

```bash
wjx response report --vid 12345           # 统计报告（建议第一步）
wjx response query --vid 12345            # 答卷明细数据
wjx response download --vid 12345         # 批量导出（CSV/SAV/Word）
wjx response count --vid 12345            # 答卷总数
wjx analytics nps --scores "[9,10,7,3,8]" # NPS 分析（本地，无需 API）
wjx analytics csat --scores "[4,5,3,5,2]" # CSAT 分析（本地）
```

下载格式：`--suffix 0` CSV，`1` SAV，`2` Word。完整参数见 [references/response-commands.md](references/response-commands.md)。

### 管理通讯录与账号

```bash
wjx contacts add --users '[{"userid":"u1","name":"Alice","mobile":"13800000001"}]'
wjx department add --depts '["研发部/后端"]'
wjx admin add --users '[{"userid":"u1","role":2}]'
wjx account add --subuser user1 --password pass123 --role 1
```

子账号角色：1=系统管理员, 2=问卷管理员, 3=统计查看, 4=完整查看。详见 [references/contacts-commands.md](references/contacts-commands.md)。

## 常见错误与处理

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `API Key is required` | 未配置 API Key | 执行 `wjx init --api-key <key>` |
| `Invalid API Key` | API Key 错误或过期 | 重新获取 API Key（见安装步骤 2） |
| `vid is required` | 未指定问卷 ID | 先 `wjx survey list` 获取 vid |
| `Corp ID is required` | 通讯录操作需企业 ID | 执行 `wjx init`，配置 `WJX_CORP_ID` |
| `Network Error` | 网络连接问题 | 检查网络，或用 `--dry-run` 预览请求 |

## 参考文件（按需读取）

- [DSL 语法](references/dsl-syntax.md) — create-by-text 的完整 DSL 格式，28 种题型标签
- [问卷命令](references/survey-commands.md) — survey 模块全部子命令参数、JSON 创建格式、设置
- [答卷命令](references/response-commands.md) — 查询筛选、submitdata 格式、下载选项
- [通讯录命令](references/contacts-commands.md) — 联系人、部门、管理员、标签、子账号、SSO
- [分析命令](references/analytics-commands.md) — NPS/CSAT/CES 公式、异常检测、数据解码
- [题型编码](references/question-types.md) — 完整 q_type/q_subtype 映射表
