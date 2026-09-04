---
name: wjx-mcp-use
description: "Guide for using wjx-mcp-server MCP tools to interact with the Wenjuanxing (问卷星) platform. Use when the user mentions: 问卷, 调查, 收集, 表单, 投票, 考试, 测评, 满意度, NPS, 问卷星, wjx, survey, questionnaire — or wants to create surveys, query responses, analyze data, manage contacts, or generate SSO links via MCP protocol. Tool, resource, and prompt counts are discovered from source at build time."
---

# wjx-mcp-server Usage Guide

wjx-mcp-server 提供 MCP 工具、参考资源和 prompt 模板，覆盖问卷星核心业务子集；CLI 是主入口，工作站能力（初始化、配置、补全、Skill 安装）保持 CLI-only。完整差异以仓库 `capabilities/capability-matrix.json` 为准。

## AI Agent 行为准则（必读）

### 规则 0：创建问卷只用 `create_survey_by_json`（强制）

当前 MCP Server 只注册 `create_survey_by_json` 作为问卷创建工具。`create_survey_by_text` 与 `create_survey` 已移除；历史 DSL/JSON 必须在 MCP 外部转换为 JSONL。所有当前可创建题型、投票、考试、表单都走 `create_survey_by_json`；JSONL 不承诺覆盖读取接口的全部数字 `q_type/q_subtype` 编码。

### 规则 1：一个需求 = 一个问卷

无论用户要求多少种题型，**必须在一次 `create_survey_by_json` 调用中包含所有题目**。一个问卷可包含任意数量、任意类型的题目。

### 规则 2：问卷类型 ≠ 题目类型

"投票/考试/调查"是**问卷类型**（`atype` 参数）。JSONL 创建投票时使用 `qtype:"投票单选"` / `qtype:"投票多选"`，并显式传 `atype: 3`；只有旧 DSL 文本格式才使用普通 `[单选题]` / `[多选题]`，不存在 `[投票单选题]` 标签。

### 规则 3：历史 DSL 不支持的题型要明确告知

签名题（用 `[绘图题]` 替代）、地区题（用 `[多级下拉题]` 或网页端添加）、NPS 专用题（用 `[量表题]` + `0~10`）不在历史 DSL 支持范围内。新问卷应优先使用 JSONL 题型参考；只有读取或迁移 DSL 时才告知替代方案，**不要**反复尝试或拆分多个问卷。

### 规则 3.1：用户体系只允许兼容维护

用户体系工具（`add_participants`、`modify_participants`、`delete_participants`、`bind_activity`、`query_survey_binding`、`query_user_surveys`）已在源码中标记为 Deprecated。`atype=8` 用户体系问卷不能通过当前创建入口 `create_survey_by_json` 新建；不要主动设计或创建这类工作流。只有用户明确提供已有的 `sysid`/`usid` 并要求维护历史系统时，才使用这些工具，并先说明兼容风险。

### 规则 4：面向用户说自然语言，不说工具名

用户不需要知道 MCP 工具的存在。**不要**在回复中展示工具名或调用参数。唯一例外：用户明确要求调试时。

### 规则 5：首次使用时检查配置

在首次配置/初始化、用户明确要求检查配置，或工具实际返回 API Key 相关错误时，引导用户处理 API Key。

- **api_key 未设置**：如果工具返回未配置错误，停止当前业务操作，不要继续调用创建、查询、导出等需要鉴权的工具；引导用户在 AI 工具的 MCP 配置中添加 `WJX_API_KEY` 环境变量
- **api_key 错误或过期**：提醒用户重新获取 API Key，更新 MCP 配置后再继续原任务
- **已返回 API Key 相关错误**：如果工具返回 `API Key is required`、`Invalid API Key`、`appkey error` 或类似鉴权错误，必须立刻向用户说明需要处理 API Key，并给出获取/更新 `WJX_API_KEY` 的下一步；不要只复述错误信息，也不要继续调用其他业务工具反复尝试
- **base_url 与用户域名不符**：引导添加 `WJX_BASE_URL` 环境变量（如 `https://xxx.sojump.cn`）
- **获取 API Key**：让用户访问 `https://<域名>/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1`，微信扫码登录后复制 Key
- **cli_version 未安装**：可选；CLI `0.4.2` 已发布到 npm，先执行 `npm install -g wjx-cli@latest`，成功后再执行 `wjx skill install --force`，然后用 `wjx init --api-key <key>` 统一配置

收到 API Key 相关错误后的用户提醒应使用自然语言，不暴露 MCP 工具调用细节，例如：

```
刚才的操作返回了 API Key 相关错误，所以我暂时不能继续创建或查询问卷。请先打开下面的链接获取/重新获取 API Key，然后在 MCP 配置中添加或更新 WJX_API_KEY 环境变量：
https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1
```

### 规则 6：提交答卷的几个易错点

- **jpmversion 默认自动管理**：`submit_response` 每次提交前会尽量 `get_survey` 获取题目结构，规范化矩阵/排序等答卷格式；未显式传入时还必须成功取得最新 `version` 并注入。显式传入 `jpmversion` 时，元数据获取失败不会阻塞提交，但元数据可用仍会执行规范化。问卷被发布/编辑后服务端 `version` 自增，不带最新版本号会被拒绝并报"问卷已被修改请刷新"。
- **submitdata 题号用 `get_survey` 返回的原始 `q_index`**：服务端严格按此校验——"问卷基础信息"元数据占 `q_index=1`，真实题目从 2 开始。AI 自己按"第 N 题"顺序数（`1$..., 2$...`）极易与服务端 q_index 错位，被拒"5〒答案不符合要求"。**正确流程**：先 `get_survey({ vid, get_questions: true })` 拿 `questions[].q_index`，再按每题 q_index 拼 submitdata。选项序号仍是 1-based（从 1 数到 N）。
- **矩阵题用行号!列号，行用 `,` 分隔**（每题 3 条可复制示例）：
  - 矩阵单选（q_subtype=702）3 行：`3$1!1,2!3,3!2` — 第 3 题第 1 行选第 1 列、第 2 行选第 3 列、第 3 行选第 2 列
  - 矩阵多选（q_subtype=703）3 行：`4$1!1|2,2!3,3!1|4` — 同一行多个列用 `|` 拼
  - 矩阵量表（q_subtype=701）3 行：`5$1!5,2!4,3!3` — 行号!分值
  - 矩阵题的"行数"来自 `get_survey` 返回的 `item_rows.length`；`items` 数组是**列头**（列选项），不是行。
- **考试题分值/答案字段**：JSONL 创建路径支持 `correctselect`、`quizscore` 和 `answeranalysis`；旧 DSL 兼容路径不支持。`submit_response` 仅用于答题端提交，不能修改考试配置。

### 规则 7：填写链接优先使用短编号

- `vid` 是后台问卷编号，不得自行拼接 URL。需要链接时统一调用 `build_preview_url`，优先传服务端返回的短 `sid`。
- 查询问卷列表时，优先使用与 `vid` 不同的 `sid` 生成短链；也可使用服务端返回且不含数字 `vid` 的 `activity_domain + mobile_path`。若二者冲突，选择 `sid`，不得输出暴露 `vid` 的路径。
- 创建问卷后需要填写链接时，使用创建结果返回的 `sid` 调用 `build_preview_url({ sid })`。同时有 `sid` 和 `vid` 时必须优先 `sid`。
- `build_survey_url({ mode: "edit", activity: vid })` 生成的是**后台编辑链接**，不是用户填写链接，二者不得混用。
- 如果确实没有 `sid`，可以显式调用 `build_preview_url({ vid })` 生成兼容预览链接；该后备链接包含数字 vid，可能暴露内部编号，必须向用户说明它不是首选。不得绕过工具自行拼接链接。

## 快速路由

| 用户意图 | 工具 |
|---------|------|
| 做调查/问卷 | `create_survey_by_json`（支持 70+ 题型；atype 可创建 1/2/3/4/5/6/7/9/10/11，8 用户体系不能新建） |
| 做考试/测验 | `create_survey_by_json` + prompt `generate-exam-json`，`atype: 6` |
| 做投票 | `create_survey_by_json` + `atype: 3` |
| 做表单/报名表 | `create_survey_by_json` + prompt `generate-form-json`，`atype: 7` |
| 看问卷结果 | `get_report({ vid })` 统计概览，`query_responses({ vid })` 明细 |
| 导出答卷数据 | `download_responses({ vid })` |
| 查看填写链接 | 列表中的 `sid` / `mobile_path`；创建后优先用 `build_preview_url({ sid })`，无 sid 时才用 `build_preview_url({ vid })` 并说明暴露风险 |
| 查看编辑链接 | `build_survey_url({ mode: "edit", activity: vid })` |
| 分析 NPS | `calculate_nps({ scores: [...] })` |
| 查当前配置 | `get_config({})` |

## 工具总览

| 模块 | 工具数 | 说明 |
|------|--------|------|
| 问卷管理 | 13 | create_survey_by_json, get_survey, list_surveys, update_survey_status, get/update_survey_settings, delete_survey, get_question_tags, get_tag_details, upload_file, clear_recycle_bin, create_ai_page, update_ai_page |
| 答卷数据 | 11 | query_responses, count_responses, query_responses_realtime, download_responses, get_report, submit_response, build_submit_template, get_winners, modify_response, get_360_report, clear_responses |
| 通讯录 | 14 | query/add/delete_contacts, add/delete/restore_admin, list/add/modify/delete_departments, list/add/modify/delete_tags |
| 子账号 | 5 | add/modify/delete/restore/query_sub_accounts |
| SSO | 5 | sso_subaccount_url, sso_user_system_url, sso_partner_url, build_survey_url, build_preview_url |
| 分析计算 | 6 | decode_responses, decode_push_payload, calculate_nps, calculate_csat, detect_anomalies, compare_metrics |
| 用户体系（兼容/已过时） | 6 | add/modify/delete_participants, bind_activity, query_survey_binding, query_user_surveys；仅维护已有系统 |
| 诊断 | 1 | get_config — API Key（脱敏）、Base URL、CLI 版本、配置来源 |

详细参数见 [references/tools-survey.md](references/tools-survey.md)、[references/tools-response.md](references/tools-response.md)、[references/tools-other.md](references/tools-other.md)。

## 核心工作流

### 创建问卷（统一使用 JSON 方式）

**唯一推荐**：所有问卷创建一律使用 `create_survey_by_json`。JSONL 使用中文 `qtype` 名称；`get_survey` 等读取接口返回的数字 `q_type/q_subtype` 是另一套结果编码。`wjx://reference/question-types` 仅提供读取结果的编码映射；创建白名单以 SDK 的 `JSONL_SUPPORTED_QTYPES` 与服务端校验为准。

```
1. 使用 prompt 模板生成题目 JSON（如 generate-survey-json、generate-exam-json 等）
2. create_survey_by_json({ jsonl: "{\"qtype\":\"问卷基础信息\",...}\\n{\"qtype\":\"单选\",...}", atype: 1 })
3. get_survey({ vid: N }) — 验证内容
4. build_survey_url({ mode: "edit", activity: N }) — 提供编辑链接
```

`create_survey_by_json` 是唯一创建工具。其 `jsonl` 参数必须是每行一个 JSON 对象的字符串，不是 JSON 数组；当前 Server 不接受旧 DSL 或 JSON 数组创建参数。

普通题型未传 `publish` 时默认立即发布；若 JSONL 包含纯框架题型 `折叠栏目`、`轮播图`、`AI追问`、`AI处理`、`AI访谈`、`图片OCR`、`VlookUp问卷关联` 或 `分页计时器`，则默认创建为草稿。先调用 `get_survey` 并提供编辑入口，待用户明确授权后再传 `publish: true`。

**考试问卷（atype=6）注意**：JSONL 路径支持 `correctselect`、`quizscore` 和 `answeranalysis`；DSL 兼容路径不支持这些字段。创建后仍可提供编辑链接补充未覆盖的高级设置。

JSONL 题型字段详见 `create_survey_by_json` 的工具描述与 SDK `JSONL_SUPPORTED_QTYPES`；`wjx://reference/question-types` 只用于解释 `get_survey` 的 `q_type/q_subtype`。读取或迁移历史 DSL 时查阅 [references/dsl-and-types.md](references/dsl-and-types.md)，新问卷始终转换回 JSONL 后创建。

### 查询和分析数据

```
1. get_survey({ vid: N }) — 确认问卷结构
2. count_responses({ vid: N }) — 先获取规模，决定是否拉取明细
3. get_report({ vid: N }) — 统计概览
4. query_responses({ vid: N, page_size: 50 }) — 按需分页读取明细
5. decode_responses({ submitdata: "..." }) — 解码答卷格式
6. calculate_nps / calculate_csat — 分析指标
7. detect_anomalies({ responses: [...] }) — 数据质量检查
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
| 历史问卷迁移后题目丢失 | DSL 转换或 JSONL 字段错误 | 读取历史 DSL 时检查题号和题型映射；转换后先用 JSONL 预检，再重新获取问卷结构 |

更多排查详见 [references/troubleshooting.md](references/troubleshooting.md)。

## MCP 资源（参考数据）

| 资源 URI | 内容 |
|----------|------|
| `wjx://reference/dsl-syntax` | DSL 文本语法（仅读取、审阅和离线迁移） |
| `wjx://reference/question-types` | `get_survey` 读取结果的 q_type/q_subtype 映射（不是 JSONL 创建白名单） |
| `wjx://reference/survey-types` | 问卷类型编码及创建限制（1/2/3/4/5/6/7/9/10/11 可创建，8 用户体系不能新建） |
| `wjx://reference/survey-statuses` | 问卷状态码 |
| `wjx://reference/response-format` | submitdata 编码格式 |
| `wjx://reference/analysis-methods` | NPS/CSAT/CES 公式和行业基准 |
| `wjx://reference/user-roles` | 子账号角色编码 |
| `wjx://reference/push-format` | 数据推送格式和加密说明 |

## Prompt 模板

**通用/运维（6）：** design-survey, analyze-results, create-nps-survey, configure-webhook, anomaly-detection, user-system-workflow（兼容/已过时）

**分析（6）：** nps-analysis, csat-analysis, cross-tabulation, sentiment-analysis, survey-health-check, comparative-analysis

**问卷生成 — JSONL（3，唯一入口）：** generate-survey-json, generate-exam-json, generate-form-json

## 常用枚举值

| 参数 | 值 |
|------|-----|
| 问卷类型 (atype) | 1=调查, 2=测评, 3=投票, 4=360度评估, 5=360评估无测评关系, 6=考试, 7=表单, 9=教学评估, 10=量表, 11=民主评议；8 用户体系不能新建 |
| 问卷状态 (state) | 1=发布, 2=暂停, 3=删除 |
| 下载格式 (suffix) | 0=CSV, 1=SAV, 2=Word |
| 角色 (roleid) | 1=系统管理员, 2=问卷管理员, 3=统计查看, 4=全部查看 |

## Reference 文件（按需查阅）

- [DSL 语法与题型](references/dsl-and-types.md) — DSL 格式、25+ 题型标签、q_type/q_subtype 映射表
- [问卷工具详解](references/tools-survey.md) — 11 个问卷管理工具的完整参数
- [答卷工具详解](references/tools-response.md) — 11 个答卷数据工具的完整参数
- [其他工具详解](references/tools-other.md) — 通讯录、子账号、SSO、分析、推送工具参数
- [错误排查](references/troubleshooting.md) — API 错误码、配置问题、自定义域名、考试限制
