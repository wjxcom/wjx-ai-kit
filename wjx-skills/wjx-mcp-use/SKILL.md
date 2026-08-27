---
name: wjx-mcp-use
description: "Guide for using wjx-mcp-server MCP tools to interact with the Wenjuanxing (问卷星) platform. Use when the user mentions: 问卷, 调查, 收集, 表单, 投票, 考试, 测评, 满意度, NPS, 问卷星, wjx, survey, questionnaire — or wants to create surveys, query responses, analyze data, manage contacts, or generate SSO links via MCP protocol. Covers 61 tools, 9 resources, and 22 prompts."
---

# wjx-mcp-server Usage Guide

wjx-mcp-server 提供 61 个 MCP 工具、9 个参考资源和 22 个 prompt 模板，覆盖问卷星 OpenAPI 的全部能力。

## AI Agent 行为准则（必读）

### 规则 0：普通新建默认使用 WJX XML DSL（强制）

普通 AI 新建必须生成完整、版本化的 `wjx-dsl 1`，然后调用 `create_survey_by_wjx_dsl` 创建草稿；已有问卷先用 `query_wjx_dsl` 读取完整 DSL，再用 `update_wjx_dsl` 提交修改。创建/修改接口会在写入前执行 DSL 校验。语法和安全边界见 `wjx://reference/wjx-xml-dsl` 与 [references/wjx-xml-dsl-v1.md](references/wjx-xml-dsl-v1.md)。

显式兼容路径：用户明确要求 JSONL 时才调用 `create_survey_by_json`；明确要求旧文本 DSL 时才调用 `create_survey_by_text`；旧 JSON 数组仅按明确要求使用。不要混用格式。

DSL 写操作不自动重试。超时、断网或结果未知时，使用返回的传统 `vid` 和 `query_wjx_dsl` 对账，禁止自动 fallback 或生成第二份问卷。`if_match` 只是可选的弱前置校验，不是原子 CAS；当前公开接口没有 DSL 专用 dry-run、rollback 或幂等键。

### 规则 1：一个需求 = 一个问卷

无论用户要求多少种题型，**必须在一次 DSL 创建调用中包含所有题目**。一个问卷可包含任意数量、任意类型的题目。

### 规则 2：问卷类型 ≠ 题目类型

"投票/考试/调查"是**问卷类型**（`atype` 参数）。JSONL 创建投票时使用 `qtype:"投票单选"` / `qtype:"投票多选"`，并显式传 `atype: 3`；只有旧 DSL 文本格式才使用普通 `[单选题]` / `[多选题]`，不存在 `[投票单选题]` 标签。

### 规则 3：不支持的题型要明确告知

签名题（用 `[绘图题]` 替代）、地区题（用 `[多级下拉题]` 或网页端添加）、NPS 专用题（用 `[量表题]` + `0~10`）不在 DSL 支持范围内。告知用户替代方案，继续创建其他题目，**不要**反复尝试或拆分多个问卷。

### 规则 4：面向用户说自然语言，不说工具名

用户不需要知道 MCP 工具的存在。**不要**在回复中展示工具名或调用参数。唯一例外：用户明确要求调试时。

### 规则 5：首次使用时检查配置

在首次配置/初始化、用户明确要求检查配置，或工具实际返回 API Key 相关错误时，引导用户处理 API Key。

- **api_key 未设置**：如果工具返回未配置错误，停止当前业务操作，不要继续调用创建、查询、导出等需要鉴权的工具；引导用户在 AI 工具的 MCP 配置中添加 `WJX_API_KEY` 环境变量
- **api_key 错误或过期**：提醒用户重新获取 API Key，更新 MCP 配置后再继续原任务
- **已返回 API Key 相关错误**：如果工具返回 `API Key is required`、`Invalid API Key`、`appkey error` 或类似鉴权错误，必须立刻向用户说明需要处理 API Key，并给出获取/更新 `WJX_API_KEY` 的下一步；不要只复述错误信息，也不要继续调用其他业务工具反复尝试
- **base_url 与用户域名不符**：引导添加 `WJX_BASE_URL` 环境变量（如 `https://xxx.sojump.cn`）
- **获取 API Key**：让用户访问 `https://<域名>/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1`，微信扫码登录后复制 Key
- **cli_version 未安装**：可选，安装 `npm install -g wjx-cli` 后用 `wjx init --api-key <key>` 统一配置

收到 API Key 相关错误后的用户提醒应使用自然语言，不暴露 MCP 工具调用细节，例如：

```
刚才的操作返回了 API Key 相关错误，所以我暂时不能继续创建或查询问卷。请先打开下面的链接获取/重新获取 API Key，然后在 MCP 配置中添加或更新 WJX_API_KEY 环境变量：
https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1
```

### 规则 6：提交答卷的几个易错点

- **jpmversion 无需手动管**：`submit_response` 内部会自动 `get_survey` 取最新 `version` 并注入。**不要**手动算或省略。仅当外部已自行管理版本时才显式传入 `jpmversion` 参数。问卷被发布/编辑后服务端 `version` 自增，不带最新版本号会被拒绝并报"问卷已被修改请刷新"。
- **submitdata 题号用 `get_survey` 返回的原始 `q_index`**：服务端严格按此校验——"问卷基础信息"元数据占 `q_index=1`，真实题目从 2 开始。AI 自己按"第 N 题"顺序数（`1$..., 2$...`）极易与服务端 q_index 错位，被拒"5〒答案不符合要求"。**正确流程**：先 `get_survey({ vid, get_questions: true })` 拿 `questions[].q_index`，再按每题 q_index 拼 submitdata。选项序号仍是 1-based（从 1 数到 N）。
- **矩阵题用行号!列号，行用 `,` 分隔**（每题 3 条可复制示例）：
  - 矩阵单选（q_subtype=702）3 行：`3$1!1,2!3,3!2` — 第 3 题第 1 行选第 1 列、第 2 行选第 3 列、第 3 行选第 2 列
  - 矩阵多选（q_subtype=703）3 行：`4$1!1|2,2!3,3!1|4` — 同一行多个列用 `|` 拼
  - 矩阵量表（q_subtype=701）3 行：`5$1!5,2!4,3!3` — 行号!分值
  - 矩阵题的"行数"来自 `get_survey` 返回的 `item_rows.length`；`items` 数组是**列头**（列选项），不是行。
- **考试题分值/答案无法通过 submit API 设置**：创建考试问卷后需要去网页端配置。`submit_response` 仅用于答题端提交。

### 规则 7：填写链接必须使用加密短编号（强制）

- `vid` 是后台问卷编号，只用于查询、编辑和答卷接口，**禁止**自行拼成 `https://<域名>/m/<vid>.aspx`、`/vm/<vid>.aspx` 或 `/jq/<vid>.aspx` 后提供给用户。
- 查询问卷列表时，优先使用与 `vid` 不同的 `sid` 生成短链；也可使用服务端返回且不含数字 `vid` 的 `activity_domain + mobile_path`。若二者冲突，选择 `sid`，不得输出暴露 `vid` 的路径。
- 创建问卷后需要填写链接时，使用创建结果返回的 `sid` 调用 `build_preview_url({ sid })`。同时有 `sid` 和 `vid` 时必须优先 `sid`。
- `build_survey_url({ mode: "edit", activity: vid })` 生成的是**后台编辑链接**，不是用户填写链接，二者不得混用。
- 如果没有 `mobile_path`，且没有与 `vid` 不同的 `sid`，应明确说明暂时无法取得安全填写链接；**不得**用数字 `vid` 猜测或伪造链接。

## 快速路由

| 用户意图 | 工具 |
|---------|------|
| 做调查/问卷 | `create_survey_by_wjx_dsl`（默认） |
| 做考试/测验 | `create_survey_by_wjx_dsl`（默认；JSONL 仅显式选择） |
| 做投票 | `create_survey_by_wjx_dsl`（默认；按服务端校验诊断修正） |
| 做表单/报名表 | `create_survey_by_wjx_dsl`（默认；JSONL 仅显式选择） |
| 看问卷结果 | `get_report({ vid })` 统计概览，`query_responses({ vid })` 明细 |
| 导出答卷数据 | `download_responses({ vid })` |
| 查看填写链接 | 列表中的非数字 `sid` / 安全 `mobile_path`；创建后用 `build_preview_url({ sid })` |
| 查看编辑链接 | `build_survey_url({ mode: "edit", activity: vid })` |
| 分析 NPS | `calculate_nps({ scores: [...] })` |
| 查当前配置 | `get_config({})` |

## 工具总览（61 tools）

| 模块 | 工具数 | 说明 |
|------|--------|------|
| 问卷管理 | 13 | create_survey_by_json/create_survey_by_text 等现有创建、查询、设置和管理工具（兼容路径） |
| WJX XML DSL | 3 | query_wjx_dsl（读取完整 DSL）、create_survey_by_wjx_dsl（创建草稿）、update_wjx_dsl（提交修改） |
| 答卷数据 | 9 | query_responses, query_responses_realtime, download_responses, get_report, submit_response, get_winners, modify_response, get_360_report, clear_responses |
| 通讯录 | 14 | query/add/delete_contacts, add/delete/restore_admin, list/add/modify/delete_departments, list/add/modify/delete_tags |
| 子账号 | 5 | add/modify/delete/restore/query_sub_accounts |
| SSO | 5 | sso_subaccount_url, sso_user_system_url, sso_partner_url, build_survey_url, build_preview_url |
| 分析计算 | 5 | decode_responses, calculate_nps, calculate_csat, detect_anomalies, compare_metrics |
| 用户体系 | 6 | add/modify/delete_participants, bind_activity, query_survey_binding, query_user_surveys |
| 诊断 | 1 | get_config — API Key（脱敏）、Base URL、CLI 版本、配置来源 |

详细参数见 [references/tools-survey.md](references/tools-survey.md)、[references/tools-response.md](references/tools-response.md)、[references/tools-other.md](references/tools-other.md)。

## 核心工作流

### 创建问卷（默认 WJX XML DSL）

```
1. 生成完整 wjx-dsl 1 文档
2. create_survey_by_wjx_dsl({ dsl }) — 创建草稿
3. 使用返回的 `vid` 调用 query_wjx_dsl({ vid }) — fresh-read 核验 DSL 和传统问卷结果
```

修改已有问卷：`query_wjx_dsl({ vid }) -> 修改返回的 dsl -> update_wjx_dsl({ vid, dsl, if_match? }) -> query_wjx_dsl({ vid })`。`if_match` 仅作可选弱前置校验；更新不是强 CAS，也没有公开 dry-run 或 rollback。写结果未知时停止并用查询结果对账，不切换格式。

用户明确要求 JSONL 或旧文本 DSL 时，才分别调用 `create_survey_by_json` 或 `create_survey_by_text`。

**考试问卷（atype=6）注意**：正确答案和每题分值**无法**通过 API 设置。创建后应提供编辑链接，指引用户在网页端配置答案与评分。

题型字段映射详见 `wjx://reference/question-types` 资源，或 [references/dsl-and-types.md](references/dsl-and-types.md)。

### 查询和分析数据

```
1. get_report({ vid: N }) — 统计概览（首选）
2. query_responses({ vid: N, page_size: 50 }) — 明细数据
3. decode_responses({ submitdata: "..." }) — 解码答卷格式
4. calculate_nps / calculate_csat — 分析指标
5. detect_anomalies({ responses: [...] }) — 数据质量检查
```

### 提交答卷（代填/导入）

submitdata 题号必须与 `get_survey` 返回的原始 `q_index` 对齐——**先拉结构再拼数据**，不要凭"第几题"硬数：

```
1. get_survey({ vid, get_questions: true, get_items: true })
   → 拿到 questions[]，每题含 q_index / q_type / q_subtype / items / item_rows
2. 按每题 q_type 拼 placeholder（举例）：
   - q_type=3（单选/量表/下拉）   →  `${q.q_index}$1`
   - q_type=4（多选）              →  `${q.q_index}$1|2`
   - q_type=4 + q_subtype=402（排序）→ `${q.q_index}$2|3|1`（按名次列出选项序号）
   - q_type=5（填空）              →  `${q.q_index}$答案文本`
   - q_type=6（多项填空）          →  `${q.q_index}$空1|空2|空3`
   - q_type=7（矩阵）：行用 item_rows.length 决定，逐行 `行号!列号`，行间用 `,` 拼
   - q_type=10（滑动条）           →  `${q.q_index}$5`
3. 用 `}` 拼接所有题，得到完整 submitdata
4. submit_response({ vid, inputcosttime: 30, submitdata, ... })
   — 内部会自动注入最新 jpmversion
```

> 跳过 `q_type === 1`（分页栏）和 `q_type === 2`（段落说明），它们不接受答案。

## 常见错误与处理

| 错误现象 | 原因 | 解决方案 |
|---------|------|---------|
| `api_key` 未设置 / `API Key is required` | 未配置 API Key | 停止当前业务操作，明确提醒用户去获取 API Key，并在 MCP 配置中添加 `WJX_API_KEY` |
| "appkey error" / `Invalid API Key` | API Key 错误或过期 | 明确提醒用户重新获取 API Key，更新 MCP 配置后继续原任务 |
| "activity not found" | 问卷 vid 不存在 | `list_surveys` 确认正确 vid |
| "corp_id required" | 通讯录操作缺企业 ID | 配置 `WJX_CORP_ID` 环境变量 |
| 网络超时 | base_url 错误或网络不通 | `get_config` 检查 base_url |
| DSL 校验失败 | WJX XML DSL 属性/节点不符合契约 | 读取 `wjx://reference/wjx-xml-dsl`，根据 diagnostics 修正后重试 |

更多排查详见 [references/troubleshooting.md](references/troubleshooting.md)。

## MCP 资源（参考数据）

| 资源 URI | 内容 |
|----------|------|
| `wjx://reference/dsl-syntax` | DSL 文本语法（旧 `create_survey_by_text` 用，已弃用） |
| `wjx://reference/wjx-xml-dsl` | WJX XML DSL v1 语法、安全边界和 query/create/update 工作流 |
| `wjx://reference/question-types` | 题型和子类型完整映射表 |
| `wjx://reference/survey-types` | 问卷类型编码（1=调查, 6=考试 等） |
| `wjx://reference/survey-statuses` | 问卷状态码 |
| `wjx://reference/response-format` | submitdata 编码格式 |
| `wjx://reference/analysis-methods` | NPS/CSAT/CES 公式和行业基准 |
| `wjx://reference/user-roles` | 子账号角色编码 |
| `wjx://reference/push-format` | 数据推送格式和加密说明 |

## Prompt 模板（19 个）

**通用/运维（6）：** design-survey, analyze-results, create-nps-survey, configure-webhook, anomaly-detection, user-system-workflow

**分析（6）：** nps-analysis, csat-analysis, cross-tabulation, sentiment-analysis, survey-health-check, comparative-analysis

**问卷生成 — WJX XML DSL（7，默认）：** generate-survey, generate-nps-survey, generate-360-evaluation, generate-satisfaction-survey, generate-engagement-survey, generate-exam-from-document, generate-exam-from-knowledge

**问卷生成 — JSONL（3，显式兼容）：** generate-survey-json, generate-exam-json, generate-form-json

## 常用枚举值

| 参数 | 值 |
|------|-----|
| 问卷类型 (atype) | 1=调查, 2=测评, 3=投票, 6=考试, 7=表单 |
| 问卷状态 (state) | 1=发布, 2=暂停, 3=删除 |
| 下载格式 (suffix) | 0=CSV, 1=SAV, 2=Word |
| 角色 (roleid) | 1=系统管理员, 2=问卷管理员, 3=统计查看, 4=全部查看 |

## Reference 文件（按需查阅）

- [DSL 语法与题型](references/dsl-and-types.md) — DSL 格式、25+ 题型标签、q_type/q_subtype 映射表
- [WJX XML DSL v1](references/wjx-xml-dsl-v1.md) — 普通新建与安全修改的默认协议
- [问卷工具详解](references/tools-survey.md) — 12 个问卷管理工具的完整参数
- [答卷工具详解](references/tools-response.md) — 9 个答卷数据工具的完整参数
- [其他工具详解](references/tools-other.md) — 通讯录、子账号、SSO、分析、推送工具参数
- [错误排查](references/troubleshooting.md) — API 错误码、配置问题、自定义域名、考试限制
