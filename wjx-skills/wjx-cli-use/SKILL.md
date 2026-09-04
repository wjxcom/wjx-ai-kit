---
name: wjx-cli-use
description: "Guide for using wjx-cli (Wenjuanxing CLI) to create surveys, query responses, and analyze data. Use when the user mentions: 问卷, 调查, 收集, 表单, 投票, 考试, 测评, 满意度, NPS, 问卷星, wjx, survey, questionnaire, or wants to create surveys, view responses, export data, analyze NPS/CSAT, or manage contacts, departments, and sub-accounts."
---

# wjx-cli 使用指南

wjx-cli 是问卷星 OpenAPI 的命令行工具。命令格式：`wjx <模块> <操作> [选项]`。

> 通过 AI 安装并启用 wjx-cli：先执行 `npm install -g wjx-cli@latest`，成功后再执行 `wjx skill install --force`；安装后命令名是 `wjx`，请用 `wjx --version` 验证，不要运行 `wjx-cli --version`。

## AI 安装与配置任务模板

需要 AI 自动完成安装和配置时，把下面整段话发给 AI；AI 应按顺序执行，拿到 API Key 前暂停等待，不要跳过连接验收：

```text
请帮我安装并配置问卷星 CLI（wjx-cli）：

1. 检查 Node.js 是否 >= 20（运行 `node --version`），版本过低请引导我升级到 https://nodejs.org

2. 先执行 `npm install -g wjx-cli@latest`，成功后再执行 `wjx skill install --force`，同时安装 CLI 和 wjx-cli-use 技能。npm 包名是 `wjx-cli`，安装后的命令名是 `wjx`；运行 `wjx --version` 验证，不要运行 `wjx-cli --version`

3. 引导我获取问卷星 API Key：
   - 公网用户：让我访问 https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1，微信扫码登录后复制 Key
   - 私有化部署用户：把上面的 www.wjx.cn 换成我的域名（例如 xxx.sojump.cn）
   等我把 Key 发给你（可能还会附带域名）

4. 拿到 Key 后执行 `wjx init --api-key <我的Key>`；私有化部署用户加 `--base-url https://<我的域名>`。不要在回复、日志或文件中回显完整 API Key

5. 运行 `wjx doctor` 验证连接，应确认 API Key 已配置且网络/API 检查通过

6. 最后运行 `wjx survey list --format table` 做一次人工验收，看到真实列表就说明接好了；这一步只用于人类查看，不要用表格推断总数、分页或填写链接
```

如果用户只提供了 API Key 而没有明确域名，使用公网地址；如果用户提供了私有化域名，API Key 获取链接和 `--base-url` 必须同时使用该域名。

全局选项：`--api-key <key>` 覆盖凭据，`--format table` 表格输出，`--dry-run` 预览请求不发送，`--stdin` 从管道读 JSON 参数。低于 `0.4.1` 的 CLI 必须先升级。

如果 `survey create` 返回顶层 `ok:false` 且 `error.code` 为 `UPGRADE_REQUIRED`，停止重试并提示用户先升级到服务端提供的 `error.min_client_version`（若有）；服务端提供 `error.upgrade_command` 时优先使用它，不要把升级错误当作问卷内容或普通 API 失败处理。

## AI Agent 行为准则（必读）

### 规则 0：创建问卷只用 `survey create`（强制）

创建任何新问卷都必须在一次创建调用中完成；可使用 `wjx survey create --file <path>.jsonl`，也可使用 `wjx dsl create --file <path>.wjx` 提交完整 XML DSL。AI 按 DSL 规范生成文本，CLI 只做校验和传输。

先运行 `wjx survey jsonl-template --type <问卷类型> --raw` 获取当前 CLI 可接受的骨架，再编辑 JSONL。每个非空行必须是一个完整 JSON 对象；首行必须是 `{"qtype":"问卷基础信息","title":"...","atype":1}`，后续题目使用中文字符串字段 `qtype` 以及 `title`、`select`、`rowtitle` 等字段。

不要把旧接口的 `_meta`、`q_type`、`q_subtype`、`q_title`、`items` 结构传给 `create`；CLI 会将其判为输入错误。

### 规则 1：一个需求 = 一个问卷

无论用户要求多少种题型，**必须在一次 `create` 调用中包含所有题目**。一个问卷可包含任意数量、任意类型的题目。

### 规则 2：问卷类型 ≠ 题目类型

"投票/考试/调查"是**问卷类型**（`--type` 参数）。JSONL 创建投票时使用 `qtype:"投票单选"` / `qtype:"投票多选"`，并显式传 `--type 3`；考试使用 `qtype:"考试单选"`、`qtype:"考试多选"` 等考试题型，并显式传 `--type 6`。

### 规则 3：不支持的题型要明确告知

只使用 [references/question-types.md](references/question-types.md) 列出的 JSONL `qtype`，不要自行发明题型名。地区题使用 `qtype:"多级下拉"` 并提供 `leveldata`。若当前 JSONL 格式确实无法表达用户要求，明确说明限制和替代方案，继续创建其余题目，**不要**反复尝试或拆分多个问卷。

### 规则 3.2：纯框架题型默认保持草稿

普通题型未指定发布选项时默认发布；但 `折叠栏目`、`轮播图`、`AI追问`、`AI处理`、`AI访谈`、`图片OCR`、`VlookUp问卷关联`、`分页计时器` 仅凭 JSONL 骨架无法完善。问卷包含任一上述题型时，创建接口默认保持草稿。先获取详情和编辑入口，指导用户补充素材/配置；只有用户明确要求发布时才显式传 `--publish` 或执行发布状态操作。

### 规则 3.1：用户体系只允许兼容维护

`user-system` 命令和 `sso user-system-url` 仍可发现，但已标记为 Deprecated，仅用于已有用户体系的历史维护。`atype=8` 不能通过创建命令新建；新项目不要主动使用用户体系工作流，只有用户明确提供已有 `sysid` 并要求维护时才执行，并先说明兼容风险。

**NPS 量表必须遵守以下强约束**：`select` 必填，且必须严格是从 `"0"` 到 `"10"` 的 11 个字符串，不能省略、缩短、改成数字或用其他字段代替。以下是唯一规范 JSONL 示例，生成 NPS 题时按此结构改写题干和端点文案：

```jsonl
{"qtype":"NPS量表","title":"您向朋友或同事推荐本餐厅的可能性有多大？","select":["0","1","2","3","4","5","6","7","8","9","10"],"minvaluetext":"完全不可能","maxvaluetext":"极其可能"}
```

字段职责必须分开理解：`qtype` 选择 NPS 量表题型；`select` 定义实际可选分值；`minvaluetext`/`maxvaluetext` 只定义两端显示文案，不定义分值范围。`minvalue`/`maxvalue` 是滑动条等其他题型的范围字段，**不能**替代 NPS 的 `select`。

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

**反例**：用户说"模拟 10 份答卷"，AI 顺序跑 10 次 `wjx response submit`，**只有 1 次返回顶层 `ok:true`**，但 AI 仍然报告"已提交 10 份"——这是欺骗用户，下游基于错误事实做决策（如生成 PPT 报告），导致总数与实际入库数不一致，**问题非常致命**。

**正确做法**：

```
计划提交 N 条
  ├─ for i in 1..N:
  │   ├─ wjx response submit ...  → 拿 stdout JSON
  │   ├─ 检查顶层 ok === true 才算成功（业务字段在 data）
  │   ├─ ok === false 时记录 error.message/code（IP 限制/重复提交/校验失败/问卷未发布）
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

### 规则 8：填写链接必须来自 API 返回的短路径（强制）

- `vid` 是后台问卷编号，**禁止**自行拼成 `https://<域名>/m/<vid>.aspx`、`/vm/<vid>.aspx` 或 `/jq/<vid>.aspx` 后提供给用户。数字 `vid` 不能被当作公开填写地址的标识。
- 填写地址只允许使用 API 返回并通过校验的域名和路径：优先使用响应中已经提供且可验证的 `fill_url`；当前 CLI 不会自动从原始字段派生 `fill_url`，通常只返回 `sid`、`activity_domain`、`pc_path`、`mobile_path`，此时用 `new URL(pc_path || mobile_path, activity_domain)`（或等价的结构化 URL API）组合，原样保留服务端路径，并核对路径中的标识是短 `sid`。
- 组合前必须确认域名、路径都来自同一条 API 记录，路径以允许的填写路由（例如 `/m/`、`/vm/` 或 `/jq/`）开头，且不是由 `vid` 推导出的猜测路径。字段缺失、域名/路径校验失败时，明确报告“服务端未提供可验证的填写路径”，不要静默猜测或替换成默认域名。
- 三类地址不能混用：填写地址面向答卷人并使用服务端短 `sid`/路径；`wjx survey url --mode edit --activity <vid>` 生成后台编辑地址；`wjx survey url --mode create` 生成建卷页面地址。后两者都不是填写地址。
- 创建成功后先从创建响应中解析填写地址及 `vid`/`sid`；只有创建响应没有可验证路径时，才按 `vid` 到 `survey list` 的分页记录中查找 `activity_domain` 与 `pc_path`/`mobile_path`。获取填写地址不需要先调用 `survey get`，也不需要探查 `survey url --help`。
- 找不到服务端路径时才报告暂时无法取得链接；不能因为没有名为 `fill_url` 的字段就断言所有链接都不可用，也不能输出未经 API 返回和校验的链接。

### 规则 9：问卷列表必须报告总数和分页范围（强制）

- 调用 `wjx survey list` 做机器处理、分页或链接查找时保留默认 JSON 输出，读取 `data.page_index`、`data.page_size`、`data.total_count` 和 `data.activitys`。**不要使用 `--format table` 做这些工作**，表格输出会隐藏总数和分页元数据。
- 必须用 JSON 解析器读取响应对象；不要用 `head` 截断 JSON，也不要用 `grep` 搜索字段。为刚创建的问卷找链接时，优先按创建响应中的 `vid`/`sid` 定位；列表 fallback 才按页读取目标记录。
- 用户只要求“查看问卷列表”时可以先展示一页，但必须同时说明匹配问卷总数、当前页和本页数量，例如：「共 N 份问卷，当前展示第 X/Y 页的 M 份。」不得把单页结果表述为全部问卷。
- 用户要求“全部问卷”或任务需要完整集合时，保持筛选和排序条件不变，根据 `total_count` 逐页查询，直到实际收集数量与总数一致；未取完前不得声称已列出全部。
- `--query_all` 只表示查询范围包含子账号问卷，**不会**自动获取全部分页。
- `--format table` 只展示部分问卷行，可能隐藏填写路径、链接以及 `total_count`、`page_index`、`page_size` 等元数据；它可以作为安装后的人工可读验收，但不可用于机器解析、分页判断或链接查找。
- 如果响应缺少 `total_count`，不要口述未核实的总数；逐页查询到空页后计算实际数量，或明确说明当前无法确认总数。详细响应结构见 [references/survey-commands.md](references/survey-commands.md)。

### 规则 10：答卷查询必须报告总数并按需取全（强制）

- 调用 `wjx response query` 时保留默认 JSON 输出，读取 `data.valid`、`data.page_index`、`data.page_size`、`data.total_count` 和 `data.answers`；`answers` 只包含当前页。
- 用户只要求“查看答卷”时可以先展示一页，但必须同时说明当前查询匹配的答卷总数、当前页和本页数量，例如：「共 N 份答卷，当前展示第 X/Y 页的 M 份。」不得把单页结果表述为全部答卷。
- 用户要求全部答卷，或任务需要完整明细进行聚合、核对、分析时，使用不超过 50 的 `page_size`，保持 `valid`、时间、条件、去重和排序参数不变，逐页查询并核对累计数量等于 `total_count`。
- 将 `response query` 返回的 `total_count` 作为当前筛选条件下的结果总数。`wjx response count` 只接受 `vid`，不得用它覆盖带时间、条件、答卷 ID、自定义参数或去重条件的查询总数；不要用 `join_times` 代替分页所需的 `total_count`。
- 如果响应缺少 `total_count`，不要口述未核实的总数；逐页查询到空页后计算实际数量，或明确说明当前无法确认总数。生成报告时的有效样本量仍按规则 7 使用 `survey.answer_valid`。详细响应结构见 [references/response-commands.md](references/response-commands.md)。

## 快速路由

| 用户意图 | 命令 |
|---------|------|
| 做调查/问卷 | `wjx survey create --file survey.jsonl` |
| 做考试/测验 | `wjx survey create --file exam.jsonl --type 6` |
| 做投票 | `wjx survey create --file vote.jsonl --type 3` |
| 做表单/报名表 | `wjx survey create --file form.jsonl --type 7` |
| 看问卷结果 | 先 `wjx survey list` 找 vid，再 `wjx response report --vid <vid>` |
| 导出答卷数据 | `wjx response download --vid <vid>` |
| 分析 NPS | `wjx analytics nps --scores "[9,10,7,3]"` |
| 导入联系人 | `wjx contacts add --users '[...]'`（需 `WJX_CORP_ID`） |
| 查看填写链接 | 优先使用创建响应中规范化的 `fill_url` 或经校验的 `activity_domain` + `pc_path`/`mobile_path`；路径缺失时按 `vid` 分页解析 `wjx survey list` |
| 查看编辑链接 | `wjx survey url --mode edit --activity <vid>` |

## 安装与配置

首次使用时按以下步骤执行。AI 应直接执行命令，不要求用户去终端操作。

### 步骤 1：检查并安装 Node.js 和 wjx-cli

```bash
node --version
```

如果 Node.js 未安装或版本 < 20，需要先安装。参见 [references/install-nodejs.md](references/install-nodejs.md)，根据操作系统选择安装方式。

Node.js 就绪后，当前稳定版本为 `0.4.2`。如果本机版本低于兼容最低版本 `0.4.1`，直接安装或升级：

```bash
npm install -g wjx-cli@latest
wjx skill install --force
wjx --version
```

从源码开发时才执行：

```bash
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-cli
npm link ./wjx-cli
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
| `survey` | list, get, create, jsonl-template, delete, status, settings, update-settings, tags, tag-details, clear-bin, upload, export-text, url, preview-url, dsl.query, dsl.create, dsl.update | 问卷增删改查、XML DSL、配置与预览链接 |
| `response` | query, realtime, download, submit-template, submit, modify, clear, report, count, winners, 360-report | 答卷数据操作 |
| `contacts` | query, add, delete | 联系人管理（需 WJX_CORP_ID） |
| `department` | list, add, modify, delete | 部门管理 |
| `admin` | add, delete, restore | 管理员管理 |
| `tag` | list, add, modify, delete | 标签管理 |
| `account` | list, add, modify, delete, restore | 子账号管理 |
| `user-system` | add-participants, modify-participants, delete-participants, bind, query-binding, query-surveys | 已过时的用户体系兼容维护 |
| `sso` | subaccount-url, user-system-url（兼容/已过时）, partner-url | SSO 链接生成 |
| `analytics` | decode, nps, csat, anomalies, compare, decode-push | 本地分析（无需 API Key） |
| `init` / `doctor` / `whoami` | — | 配置 / 诊断 / 验证 |

## 核心工作流

### 创建问卷（统一使用 JSONL 格式）

> **重要**：必须执行 `wjx survey create` 命令来创建问卷。只生成 JSONL 文本而不执行命令，问卷不会被创建到问卷星平台上。

```bash
wjx survey jsonl-template --type 1 --raw > survey.jsonl
# 编辑 survey.jsonl 后执行
wjx survey create --file survey.jsonl
```

JSONL 每个非空行放一个 JSON 对象，且首行必须是问卷基础信息。例如：

```jsonl
{"qtype":"问卷基础信息","title":"客户满意度调查","introduction":"感谢您的参与","atype":1}
{"qtype":"单选","title":"您对本次服务是否满意？","select":["满意","一般","不满意"]}
{"qtype":"简答题","title":"您还有什么建议？"}
```

字段命名和可用中文 `qtype` 见 [references/question-types.md](references/question-types.md)。题目 `title` 只写正文；普通选择题使用 `select`，矩阵题使用 `rowtitle + select`，表格组合使用 `rowtitle + types + selects`。投票题使用 `qtype:"投票单选"` / `qtype:"投票多选"` + `select`。

问卷类型：`--type 1` 调查（默认），`2` 测评，`3` 投票，`4` 360度评估，`5` 360评估无测评关系，`6` 考试，`7` 表单，`9` 教学评估，`10` 量表，`11` 民主评议。`8` 用户体系仅作历史维护，不能新建。

创建成功后，先保存并结构化解析完整 JSON 响应。若响应带有可验证的 `fill_url`，直接将它作为填写地址；否则从同一响应记录的 `activity_domain` 与 `pc_path`（桌面端优先）或 `mobile_path` 组合地址，并确认使用的是短 `sid`。只有创建响应缺少这些路径时，才用响应中的 `vid` 到列表接口逐页查找对应记录。不要为此调用 `survey get`，也不要把 `survey url` 的编辑/创建地址当作填写地址。

**考试问卷注意**：先运行 `wjx survey jsonl-template --type 6 --raw`，按模板使用 `考试单选`、`考试多选`、`考试判断` 等 `qtype`；用 `correctselect` 和 `quizscore` 设置正确答案与分值。需要模板未覆盖的高级考试设置时，再提供编辑链接并指引用户在网页端补充。

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
| `qtype` 不识别 / 字段名错误 | 混用了旧接口字段或题型名称无效 | 重新运行 `wjx survey jsonl-template --type <n> --raw`，改用中文 `qtype` 和 `title`/`select` 等 JSONL 字段 |

## 参考文件（按需读取）

- [问卷命令](references/survey-commands.md) — survey 模块常用子命令参数、JSONL 创建格式、设置
- [答卷命令](references/response-commands.md) — 查询筛选、submitdata 格式、下载选项
- [通讯录命令](references/contacts-commands.md) — 联系人、部门、管理员、标签、子账号、SSO
- [分析命令](references/analytics-commands.md) — NPS/CSAT/CES 公式、异常检测、数据解码
- [JSONL 题型](references/question-types.md) — `create` 的字段格式、中文 `qtype` 与示例
- [计算公式](references/formula-helper.md) — 问卷星计算公式与Excel函数功能指南，帮助AI在问卷中正确编写计算公式。涵盖题目引用、数组写法、赋值判断逻辑、各题型的推送数据格式、函数参考（日期时间/数学计算/文本合并/条件判断/逻辑/查找统计）及实战案例。
- [安装 Node.js](references/install-nodejs.md) — 各平台 Node.js 安装方式
