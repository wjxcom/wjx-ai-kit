---
name: wjx-cli-use
description: "Guide for using wjx-cli (Wenjuanxing CLI) to create surveys, query responses, and analyze data. Use when the user mentions: 问卷, 调查, 收集, 表单, 投票, 考试, 测评, 满意度, NPS, 问卷星, wjx, survey, questionnaire — or wants to create surveys, view responses, export data, analyze NPS/CSAT, manage contacts/departments/sub-accounts. Covers all 67 subcommands across 15 modules."
---

# wjx-cli 使用指南

wjx-cli 是问卷星 OpenAPI 的命令行工具。命令格式：`wjx <模块> <操作> [选项]`。

全局选项：`--api-key <key>` 覆盖凭据，`--table` 表格输出，`--dry-run` 预览请求不发送，`--stdin` 从管道读 JSON 参数。

## AI Agent 行为准则（必读）

### 规则 0：普通新建默认使用 WJX XML DSL（强制）

普通 AI 新建问卷必须生成版本化 `wjx-dsl 1`，严格执行 `generate -> create`：先调用 `wjx dsl create --file <path>`，通过后调用 `wjx dsl query --vid <vid>` fresh-read 核验。语法和安全边界见 [references/wjx-xml-dsl-v1.md](references/wjx-xml-dsl-v1.md)。

显式兼容路径：用户明确要求 JSONL 时才调用 `wjx survey create-by-json`；明确要求旧文本 DSL 时才调用 `wjx survey create-by-text`；旧 JSON 数组仅按明确要求使用。不要把三种格式混在一次请求中。

DSL 的 `create`、`update` 不自动重试。超时、断网或结果未知时，使用返回的传统 `vid` 重新 query 对账，禁止自动 fallback 到另一种创建格式或生成第二份问卷。仅服务端明确返回 `FeatureDisabled`/`Unsupported` 且确认无副作用时，才提示用户显式选择兼容路径。

### 规则 1：一个需求 = 一个问卷

无论用户要求多少种题型，**必须在一次 DSL 创建调用中包含所有题目**。一个问卷可包含任意数量、任意类型的题目。

### 规则 2：问卷类型 ≠ 题目类型

"投票/考试/调查"是**问卷类型**（`--type` 参数）。JSONL 创建投票时使用 `qtype:"投票单选"` / `qtype:"投票多选"`，并显式传 `--type 3`；只有旧 DSL 文本格式才使用普通 `[单选题]` / `[多选题]`，不存在 `[投票单选题]` 标签。

### 规则 3：不支持的题型要明确告知

签名题（用 `[绘图题]` 替代）、地区题（用 `[多级下拉题]` 或网页端添加）、NPS 专用题（用 `[量表题]` + `0~10`）不在 DSL 支持范围内。告知用户替代方案，继续创建其他题目，**不要**反复尝试或拆分多个问卷。

### 规则 4：面向用户说自然语言，不说 CLI 命令

CLI 是你（AI）在后台执行的工具，**不要**在回复中展示命令或命令行用法。唯一例外：用户明确要求看命令时。

- 正确：「问卷已创建，这是填写链接：https://...」
- 错误：「你可以运行 `wjx survey list` 查看问卷列表」

### 规则 5：未配置或返回 API Key 错误时先提醒配置

在安装/初始化流程、用户明确要求检查配置，或命令实际返回 API Key 相关错误时，引导用户处理 API Key。

- **未配置 API Key**：如果命令返回未配置错误，停止当前业务操作，提醒用户先获取并配置 API Key，不要继续尝试创建、查询、导出等需要鉴权的命令
- **Key 错误或过期**：提醒用户重新获取 API Key，并在配置成功后继续原任务
- **已返回 API Key 相关错误**：如果命令返回 `API Key is required`、`Invalid API Key`、`appkey error` 或类似鉴权错误，必须立刻向用户说明需要处理 API Key，并给出获取/重新配置 API Key 的下一步；不要只复述错误信息
- **获取 API Key**：让用户访问 `https://<域名>/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1`，默认域名为 `www.wjx.cn`
- **配置方式**：用户提供 Key 后，由 AI 在后台执行 `wjx init --api-key <key>`；不要让用户自己敲命令，除非用户明确要求

收到 API Key 相关错误后的用户提醒应使用自然语言，例如：

```
刚才的操作返回了 API Key 相关错误，说明当前还没有配置 API Key，或者 Key 已失效。请先打开下面的链接获取/重新获取 API Key，拿到后发给我，我再继续帮你完成后续操作：
https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1
```

### 规则 6：发布与提交答卷的几个易错点

- **发布问卷状态参数**：用 `wjx survey status --vid <vid> --state 1`（1=发布、2=暂停、3=删除）。`--status` 是兼容别名，但默认参数名是 `--state`。
- **提交答卷必须带版本号**：问卷被发布/编辑后 `version` 自增，提交时不带最新 `jpmversion` 会被服务端拒绝并报"问卷已被修改请刷新"。`wjx response submit` 默认会自动获取最新版本注入，请**不要**加 `--no-auto-version`，也不需要手动算版本号。
- **submitdata 题号一律用 `submit-template` 返回的 q_index**：问卷星服务端严格按 `getSurvey` 返回的原始 `q_index` 校验提交的题号（"问卷基础信息"元数据占 q_index=1，真实题目从 2 开始编号）。**手算很容易搞错**——直接跑 `wjx response submit-template --vid <问卷ID>`，每题的 `placeholder` 就是正确格式，改成真实答案即可。选项序号仍然是 1-based（从 1 数到 N）。
- **避开 shell `$` 转义陷阱**：submitdata 含 `$` 分隔符，PowerShell 双引号会把 `$1/$3` 当变量吞掉。**首选** `--submitdata-file <path>`（从文件读，彻底绕开 shell）；其次用 PowerShell 单引号 `--submitdata '1$1}2$3'`。CLI 会在提交前做 `$` sanity check：一个 `$` 都没有时立刻报 INPUT_ERROR。

### 规则 7：批量 submit 必须逐次确认成功/失败（强制）

**反例**：用户说"模拟 10 份答卷"，AI 顺序跑 10 次 `wjx response submit`，**只有 1 次返回 `result:true`**，但 AI 仍然报告"已提交 10 份"——这是欺骗用户，下游基于错误事实做决策（如生成 PPT 报告），导致总数与实际入库数不一致，**问题非常致命**。

**正确做法**：

```
计划提交 N 条
  ├─ for i in 1..N:
  │   ├─ wjx response submit ...  → 拿 stdout JSON
  │   ├─ 检查 result === true 才算成功
  │   ├─ result === false 时记 errormsg（IP 限制/重复提交/校验失败/问卷未发布）
  │   └─ 累加 succeeded / failed
  └─ 报告："计划 N，成功 M，失败 N-M"。
     失败 ≥ 10% 时主动列出 errormsg 分布 + 建议（换 IP / 调"重复提交"设置）。
```

**绝不口述未核实的数字**。如果不确定，跑 `wjx response query --vid <vid>` 核对实际入库明细；生成 PPT 报告时，样本量仍以 `survey.answer_valid` 作为有效答卷数权威口径。

**常见拦截原因**（要如实告诉用户）：
- 同 IP / 同设备短时间多次提交被风控
- 问卷"重复提交"设置开启
- 必填项缺失或校验不通过
- 问卷未发布 / 已暂停 / 已关闭
- **矩阵题可复制示例**：行号!列号，多行用 `,`，多列用 `|`：
  - 矩阵单选 3×4：`6$1!1,2!3,3!2`
  - 矩阵多选 3 行：`7$1!1|2,2!3,3!1|4`
  - 矩阵量表 3 行：`8$1!5,2!4,3!3`

### 规则 8：填写链接必须使用加密短编号（强制）

- `vid` 是后台问卷编号，**禁止**自行拼成 `https://<域名>/m/<vid>.aspx`、`/vm/<vid>.aspx` 或 `/jq/<vid>.aspx` 后提供给用户。
- `wjx survey list` 返回的 `fill_url` 是填写链接的唯一首选；CLI 优先使用与 `vid` 不同的 `sid`，并拒绝暴露数字 `vid` 的路径。
- `wjx survey url --mode edit --activity <vid>` 生成的是**后台编辑链接**，不是填写链接。
- 如果列表结果没有 `fill_url`，应说明暂时无法取得安全填写链接，**不得**用数字 `vid` 猜测或伪造。

## 快速路由

| 用户意图 | 命令 |
|---------|------|
| 做调查/问卷 | `wjx dsl create/query/update`（默认 WJX XML DSL） |
| 做考试/测验 | `wjx dsl create/query/update`（默认；JSONL 仅显式选择） |
| 做投票 | `wjx dsl create/query/update`（默认） |
| 做表单/报名表 | `wjx dsl create/query/update`（默认；JSONL 仅显式选择） |
| 看问卷结果 | 先 `wjx survey list` 找 vid，再 `wjx response report --vid <vid>` |
| 导出答卷数据 | `wjx response download --vid <vid>` |
| 分析 NPS | `wjx analytics nps --scores "[9,10,7,3]"` |
| 导入联系人 | `wjx contacts add --users '[...]'`（需 `WJX_CORP_ID`） |
| 查看填写链接 | `wjx survey list` 返回的 `fill_url` |
| 查看编辑链接 | `wjx survey url --mode edit --activity <vid>` |

## 安装与配置

首次使用时按以下步骤执行。AI 应直接执行命令，不要求用户去终端操作。

### 步骤 1：检查并安装 Node.js 和 wjx-cli

```bash
node --version
```

如果 Node.js 未安装或版本 < 20，需要先安装。参见 [references/install-nodejs.md](references/install-nodejs.md)，根据操作系统选择安装方式。

Node.js 就绪后：

```bash
npm install -g wjx-cli
wjx --version
```

### 步骤 2：获取并配置 API Key

API Key 需要用户手动获取（无法自动化）。

**确定域名**：默认 `www.wjx.cn`。如果用户使用自定义域名（如 `xxx.sojump.cn`），替换下方链接中的域名。

1. 让用户打开（`<域名>` 替换为实际域名，默认 `www.wjx.cn`）：
   `https://<域名>/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1`
2. 微信扫码登录后复制 API Key
3. 拿到 Key 后执行：

```bash
wjx init --api-key <用户提供的key>
```

自定义域名追加 `--base-url`：

```bash
wjx init --api-key <key> --base-url https://<域名>
```

凭据优先级：`--api-key` 参数 > `WJX_API_KEY` 环境变量 > `~/.wjxrc` 配置文件。通讯录操作另需 `WJX_CORP_ID`。

### 步骤 3：验证

```bash
wjx doctor
```

所有检查项应为 ok。失败时参见下方"常见错误与处理"。

### 安装完成后的回复（重要）

验证通过后，**必须**向用户展示自然语言使用示例，**不要**展示 CLI 命令：

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

## 命令总览

| 模块 | 命令 | 说明 |
|------|------|------|
| `survey` | list, get, create, create-by-text, create-by-json, delete, status, settings, update-settings, upload, export-text, url | 问卷增删改查与配置 |
| `response` | query, realtime, download, submit, modify, clear, report, count | 答卷数据操作 |
| `contacts` | query, add, delete | 联系人管理（需 WJX_CORP_ID） |
| `department` | list, add, modify, delete | 部门管理 |
| `admin` | add, delete, restore | 管理员管理 |
| `tag` | list, add, modify, delete | 标签管理 |
| `account` | list, add, modify, delete, restore | 子账号管理 |
| `sso` | subaccount-url, user-system-url, partner-url | SSO 链接生成 |
| `analytics` | decode, nps, csat, anomalies, compare, decode-push | 本地分析（无需 API Key） |
| `dsl` | query, create, update | WJX XML DSL v1 新建与安全修改 |
| `init` / `doctor` / `whoami` | — | 配置 / 诊断 / 验证 |

## 核心工作流

### 创建问卷（默认 WJX XML DSL）

> **重要**：普通 AI 新建必须先生成完整 WJX XML DSL，再执行 `wjx dsl create`；只生成文本而不调用工具不会创建问卷。创建结果中的传统 `vid` 用于后续 query/update。

```bash
wjx dsl create --file survey.wjx
wjx dsl create --file survey.wjx
wjx dsl query --vid <vid>
```

语法、题型基础 Type、保留规则和兼容路径见 [references/wjx-xml-dsl-v1.md](references/wjx-xml-dsl-v1.md)。创建默认是草稿，链接直接使用服务端响应。

### 修改问卷

```bash
wjx dsl query --vid <vid>
wjx dsl update --vid <vid> --file candidate.wjx --if-match <etag>
wjx dsl update --vid <vid> --file candidate.wjx --if-match <etag>
wjx dsl query --vid <vid>
```

更新前先用 `wjx dsl query --vid <vid>` 获取完整 DSL；写操作不自动重试或 fallback。`If-Match` 过期先重新 query。

### 显式兼容格式

用户明确要求 JSONL 时使用 `wjx survey create-by-json --file <path>.jsonl`；明确要求旧文本 DSL 时使用 `wjx survey create-by-text`。这些接口仍受支持，但不是普通新建默认路径。

### 答卷与分析

先获取 vid（`wjx survey list`），再用 `wjx response` 子命令。下载格式：`--suffix 0` CSV，`1` SAV，`2` Word。详见 [references/response-commands.md](references/response-commands.md)。

### 通讯录与账号

角色：1=系统管理员, 2=问卷管理员, 3=统计查看, 4=完整查看。详见 [references/contacts-commands.md](references/contacts-commands.md)。

## 常见错误与处理

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `API Key is required` | 未配置 API Key | 停止当前业务操作，明确提醒用户去获取并配置 API Key；用户提供后执行 `wjx init --api-key <key>` |
| `Invalid API Key` / "appkey error" | Key 错误或过期 | 明确提醒用户重新获取 API Key（见步骤 2），配置成功后继续原任务 |
| `vid is required` | 未指定问卷 ID | 先 `wjx survey list` 获取 vid |
| `Corp ID is required` | 通讯录操作需企业 ID | `wjx init` 配置 `WJX_CORP_ID` |
| `Network Error` / 超时 | 网络不通或 base_url 错误 | `wjx doctor` 检查，`--dry-run` 预览 |
| DSL 更新失败 | WJX XML DSL 属性/节点不符合契约或版本冲突 | 读取 `wjx-xml-dsl-v1.md`，根据服务端错误修正；版本冲突先重新 query |

## 参考文件（按需读取）

- [DSL 语法](references/dsl-syntax.md) — 旧 `create-by-text` 的 DSL 格式（已弃用，仅供历史代码参考）
- [WJX XML DSL v1](references/wjx-xml-dsl-v1.md) — 普通新建和安全修改的默认协议
- [问卷命令](references/survey-commands.md) — survey 模块全部子命令参数、JSON 创建格式、设置
- [答卷命令](references/response-commands.md) — 查询筛选、submitdata 格式、下载选项
- [通讯录命令](references/contacts-commands.md) — 联系人、部门、管理员、标签、子账号、SSO
- [分析命令](references/analytics-commands.md) — NPS/CSAT/CES 公式、异常检测、数据解码
- [题型编码](references/question-types.md) — 完整 q_type/q_subtype 映射表
- [计算公式](references/formula-helper.md) — 问卷星计算公式与Excel函数功能指南，帮助AI在问卷中正确编写计算公式。涵盖题目引用、数组写法、赋值判断逻辑、各题型的推送数据格式、函数参考（日期时间/数学计算/文本合并/条件判断/逻辑/查找统计）及实战案例。
- [安装 Node.js](references/install-nodejs.md) — 各平台 Node.js 安装方式
