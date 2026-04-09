---
name: wjx-cli-use
description: Guide for using wjx-cli (Wenjuanxing CLI) to create surveys, query responses, and analyze data. Use when the user wants to interact with the Wenjuanxing (问卷星) platform via CLI commands, including creating surveys with specific question types, querying response data, managing contacts, or performing analytics. Covers all 69 subcommands across 15 modules.
homepage: https://www.wjx.cn
version: 1.0.0
---

# wjx-cli 使用指南

wjx-cli 是问卷星 OpenAPI 的命令行工具。所有命令格式：`wjx <模块> <操作> [选项]`。

## AI Agent 行为准则（必读）

### 规则 1：一个需求 = 一个问卷

无论用户要求多少种题型，**必须在一次 create-by-text 调用中包含所有题目**。

- 正确：用户说"包含单选、多选、填空、量表" → 一个 DSL 文本包含所有题目 → 调用一次
- 错误：为每种题型分别调用 create-by-text → 产生多个问卷

一个问卷可��包含任意数量、任意类型的题目。没有"一种问卷只能包含一种题型"的限制。

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

## 触发场景

以下情况应直接使用本 Skill：

- 用户提到「问卷」「调查」「收集」「表单」「投票」「考试」「测评」「满意度」「NPS」「问卷星」「wjx」等关键词
- 用户说「帮我做个调查」「创建问卷」「查看答卷」「分析数据」「导出数据」等
- 用户需要管理通讯录、部门、子账号、SSO 等企业功能

### 模糊场景

| 用户表述 | 处理方式 |
|---------|---------|
| 「帮我做个调查/问卷」 | `wjx survey create-by-text --text "..."` |
| 「做个考试/测验」 | `wjx survey create-by-text --text "..." --type 6` |
| 「做个投票」 | `wjx survey create-by-text --text "..." --type 3` |
| 「做个表单/报名表」 | `wjx survey create-by-text --text "..." --type 7` |
| 「看看问卷结果」 | 先 `wjx survey list` 找 vid，再 `wjx response report --vid <vid>` |
| 「导出答卷数据」 | `wjx response download --vid <vid>` |
| 「分析 NPS 得分」 | `wjx analytics nps --scores "[9,10,7,3]"` |
| 「导入联系人」 | `wjx contacts add --users '[...]'`（需 `WJX_CORP_ID`） |
| 「查看问卷链接」 | `wjx survey url --vid <vid>` |

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

角色编号：1=系统管理员, 2=问卷管理员, 3=统计查看, 4=完整查看。所有参数见 [references/contacts-commands.md](references/contacts-commands.md)。

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

## 目录结构

```
wjx-cli-use/
├── SKILL.md                              # 本文档（AI 读取入口）
├── README.md                             # 场景化宣传文档
├── package.json                          # 元数据
├── setup.sh                              # 环境检测与安装脚本
├── pack_skill.sh                         # 打包分发 zip
├── examples/                             # DSL 示例文件
│   ├── nps_survey.txt                    # NPS 调查示例
│   ├── satisfaction_survey.txt           # 满意度调查示例
│   └── exam_survey.txt                   # 考试问卷示例
└── references/                           # 详细参考文档（按需读取）
    ├── dsl-syntax.md                     # DSL 语法，28 种题型标签
    ├── survey-commands.md                # survey 模块全部子命令
    ├── response-commands.md              # 答卷查询、筛选、下载
    ├── contacts-commands.md              # 通讯录、部门、管理员、标签、子账号、SSO
    ├── analytics-commands.md             # NPS/CSAT/异常检测/数据解码
    └── question-types.md                 # 题型编码映射表
```

## 参考文件（按需读取）

- [DSL 语法](references/dsl-syntax.md) — create-by-text 的完整 DSL 格式，28 种题型标签
- [问卷命令](references/survey-commands.md) — survey 模块全部子命令参数、JSON 创建格式、设置
- [答卷命令](references/response-commands.md) — 查询筛选、submitdata 格式、下载选项
- [通讯录命令](references/contacts-commands.md) — 联系人、部门、管理员、标签、子账号、SSO
- [分析命令](references/analytics-commands.md) — NPS/CSAT/CES 公式、异常检测、数据解码
- [题型编码](references/question-types.md) — 完整 q_type/q_subtype 映射表
