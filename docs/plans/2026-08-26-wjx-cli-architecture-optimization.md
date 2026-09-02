# wjx-cli 架构优化实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不破坏现有 `survey`、`response` 等命令兼容性的前提下，将 `wjx-cli` 从手工 SDK 适配层演进为具备统一执行契约、可扩展 API 入口、风险控制和元数据驱动能力的 CLI 平台。

**Architecture:** 保留现有快捷命令作为人类和 Agent 友好的入口，新增共享执行运行时和 Raw API 入口；随后建立版本化 API Catalog/Schema，由同一事实源生成 CLI 参数、帮助、MCP Tool Schema、SDK 类型、文档和补全。迁移采用适配层渐进替换，先修复契约级风险，再引入生成式能力。

**Tech Stack:** TypeScript、Node.js >= 20、Commander.js、Node 内置 fetch/node:test、npm workspaces、问卷星 OpenAPI。

---

## 评审基线

本计划来自对 `wjx-cli` 与飞书开源 [larksuite/cli](https://github.com/larksuite/cli) 的架构对比。飞书 CLI 的可借鉴点是三层命令模型：

1. 快捷命令：面向常见人类和 Agent 工作流。
2. 元数据生成命令：覆盖大量 API，并从 Schema 生成帮助和参数。
3. Raw API 逃生舱：在正式命令发布前调用新接口或私有化接口。

当前 `wjx-cli` 的主要链路是：

    Commander 解析
      -> 手工注册命令
      -> 手工 buildInput / transformInput
      -> executeCommand()
      -> SDK Action 常量 + POST
      -> JSON 或 table 输出

优点是链路短、易读、复用 SDK；主要结构性问题是命令定义、请求协议、帮助文档和测试没有共同事实源，横切能力由各命令分散承担。

## 已确认问题

### P0：正确性和安全边界

1. **`--dry-run` 不是零网络请求。** `executeCommand` 在 dry-run 判断前执行 `transformInput`；`response submit` 的转换会调用未注入捕获 fetch 的 `getSurvey`。预览可能访问真实 API、等待重试或吞掉请求错误。
   - 证据：`wjx-cli/src/lib/command-helpers.ts:167-175`、`wjx-cli/src/commands/response.ts:193-207`。
   - 验收：所有 dry-run 路径 HTTP 调用数为 0，输出请求方法、URL、headers 脱敏结果和 body。
2. **高风险写操作没有确认策略。** 删除问卷、清空/修改答卷、删除联系人/部门/管理员等命令可直接执行。
   - 证据：`wjx-cli/src/commands/survey.ts:268-285`、`wjx-cli/src/commands/response.ts:248-265`。
   - 验收：非交互环境执行 high-risk-write 必须显式 `--yes`；拒绝时不产生网络请求；审计信息包含命令、身份、目标和确认来源。

### P1：平台化能力

3. **没有 Raw API 逃生舱。** 入口逐个注册命令，SDK 能力绑定硬编码 `Action`；新接口必须等待代码发版。
   - 证据：`wjx-cli/src/index.ts:4-19`、`wjx-api-sdk/src/core/constants.ts:41-89`。
4. **没有运行时 Schema 和能力自省。** `reference` 主要是静态 DSL、题型和部分命令文本，无法查询请求体、响应结构、权限、身份和分页方式。
   - 证据：`wjx-cli/src/commands/reference.ts:43-65`、`439-456`。
5. **分页由调用方自行循环。** `survey list`、`response query` 只暴露单页参数，容易漏数、丢筛选条件和放大 Agent 上下文。
   - 证据：`wjx-cli/src/commands/survey.ts:31-65`、`wjx-cli/src/commands/response.ts:50-89`。
6. **输出协议不足以支撑稳定管道。** 当前主要是默认 JSON 和 `--table`；缺少稳定 envelope、NDJSON/CSV、jq、分页元数据和 stdout/stderr 边界。
   - 证据：`wjx-cli/src/index.ts:33-41`、`wjx-cli/src/lib/output.ts:84-145`。
7. **错误分类和上游错误信息不稳定。** SDK 的 `errorcode/data` 没有完整保留，CLI 错误类型少且依赖消息 substring。
   - 证据：`wjx-api-sdk/src/core/types.ts:11-18`、`wjx-cli/src/lib/errors.ts:1-61`、`wjx-cli/src/lib/command-helpers.ts:180-185`。
8. **认证模型只有单一 API Key。** `~/.wjxrc` 是明文配置，没有 Keychain、profile、多账号切换和权限预检。
   - 证据：`wjx-cli/src/lib/config.ts:18-35`、`wjx-cli/src/lib/auth.ts:4-12`。
9. **缺少终端内容净化和输入安全策略。** 用户可控内容直接进入表格/文本输出；stdin 任意键合并后由命令静默挑选已知字段。
   - 证据：`wjx-cli/src/lib/output.ts:92-145`、`wjx-cli/src/lib/stdin.ts:43-63`。

### P2：体验和交付效率

10. **文件传输不适合大文件和脚本。** 上传要求完整 Base64，下载没有统一 `--output`、覆盖和原子写入策略。
    - 证据：`wjx-cli/src/commands/survey.ts:379-390`、`wjx-cli/src/commands/response.ts:105-137`。
11. **测试门禁和版本契约不足。** 现有测试通过，但缺少 HTTP contract、分页、风险确认、输出净化、上传下载回归；CLI 依赖 SDK `*`，版本可能漂移。
    - 证据：`wjx-cli/package.json:16-21`、`37-40`、`wjx-cli/CLAUDE.md:49-56`。
12. **参数和文档缺少统一事实源。** 下划线和 kebab-case 混用，帮助、README、Skill、SDK 需要人工同步。
    - 证据：`wjx-cli/src/commands/survey.ts`、`wjx-cli/src/commands/reference.ts` 及现有文档。

## 目标架构

    +--------------------------+
    | API Catalog / Schema     |
    | action, params, body,    |
    | response, scope, risk,  |
    | pagination, file, retry |
    +------------+-------------+
                 | generate
       +---------+---------+-------------------------+
       |                   |                         |
  Shortcut layer     Generated API layer       Raw action layer
  现有友好命令        精确参数与帮助             新/私有接口逃生舱
       +---------+---------+-------------------------+
                 |
     +-----------+---------------------------------+
     | Shared execution runtime                   |
     | auth/profile · schema validation · risk gate |
     | pure preparation · dry-run · retry · pagination |
     | error envelope · output adapters · file I/O · trace |
     +-----------+---------------------------------+
                 |
          wjx-api-sdk transport
                 |
          问卷星 OpenAPI

统一执行流水线必须固定为：

    parse
      -> source-aware merge
      -> Schema validate / unknown-field check
      -> resolve profile and identity
      -> risk gate
      -> pure request preparation
      -> dry-run render OR network execution
      -> bounded retry / pagination
      -> normalize response and error
      -> output adapter

核心不变量：

- dry-run 位于所有网络副作用之前。
- risk gate 位于真实请求之前。
- 分页、重试、错误规范化和输出不能由各命令复制实现。
- stdout 只输出机器可消费结果，stderr 只输出诊断。
- API Catalog 是 CLI、MCP、SDK、文档和补全的共同事实源。

建议的成功和错误 envelope：

    {"ok":true,"data":{},"meta":{"command":"survey.list","page":1}}

    {"ok":false,"error":{"type":"api","subtype":"rate_limit","code":123,"message":"...","hint":"...","retryable":true}}

## 实施任务

### Task 1：建立契约测试基线

**Files:**
- Modify: `wjx-cli/src/lib/command-helpers.ts`
- Test: `wjx-cli/__tests__/` 中新增或扩展 dry-run、错误和输出契约测试

**Steps:**

1. 为 `response submit --dry-run` 注入计数 fetch，先写出 HTTP 调用数为 0 的失败测试。
2. 把 request preparation 与网络执行拆成纯准备阶段和执行阶段。
3. 运行 `npm test --workspace=wjx-cli`，确认原有测试和新增测试全部通过。
4. 增加上游 `errorcode/data/traceId` 保留测试，并冻结成功/错误 envelope。

**验收:** dry-run 不访问网络；错误输出稳定；stdout/stderr 和退出码保持现有兼容契约。

### Task 2：增加风险元数据与确认门

**Files:**
- Modify: `wjx-cli/src/commands/*.ts`
- Modify: `wjx-cli/src/lib/command-helpers.ts`
- Modify: `wjx-cli/src/index.ts`
- Test: `wjx-cli/__tests__/` 风险确认测试

**Steps:**

1. 为命令声明 `read`、`write`、`high-risk-write` 风险等级。
2. 为 high-risk-write 增加交互确认和非交互 `--yes` 要求。
3. 拒绝或缺少 `--yes` 时在网络执行前失败。
4. 将命令、目标、profile、确认来源写入结构化审计字段。
5. 覆盖删除问卷、清空答卷、联系人/部门/管理员删除等代表性命令。

**验收:** 未确认的高风险命令 HTTP 调用数为 0；CI/Agent 环境可通过明确 `--yes` 执行。

### Task 3：建设共享执行运行时和输出适配器

**Files:**
- Create: `wjx-cli/src/lib/runtime/`
- Modify: `wjx-cli/src/lib/output.ts`
- Modify: `wjx-cli/src/lib/errors.ts`
- Modify: `wjx-cli/src/index.ts`
- Test: `wjx-cli/__tests__/` 输出、错误、分页契约测试

**Steps:**

1. 抽出输入合并、Schema 校验、身份解析、风险门、请求执行和响应规范化接口。
2. 实现 `json`、`pretty`、`table`、`ndjson` 输出适配器，保留现有默认行为。
3. 统一错误 `type/subtype/code/message/hint/retryable/retry_after` 字段。
4. 在输出层净化 ANSI、控制字符和危险 Unicode。
5. 运行 CLI 全量测试及新增契约测试。

**验收:** 同一命令通过不同格式输出相同数据；错误分类不依赖 message substring；终端注入测试通过。

### Task 4：实现统一分页、重试和文件流

**Files:**
- Modify: `wjx-cli/src/lib/runtime/`
- Modify: `wjx-cli/src/commands/survey.ts`
- Modify: `wjx-cli/src/commands/response.ts`
- Modify: `wjx-api-sdk/src/core/api-client.ts`（仅在 SDK transport 需要共享能力时）
- Test: 分页、部分失败、大文件和原子写入测试

**Steps:**

1. 定义 `--page-all`、`--page-limit`、`--page-delay` 和统一 cursor/page token 接口。
2. 支持 JSON 聚合和 NDJSON 流式分页；输出页码、总数和部分失败信息。
3. 保留每页筛选条件，限制总页数、响应体和重试预算。
4. 将上传从 Base64-only 扩展为文件路径/stdin/multipart；下载增加 `--output`、覆盖策略和原子写入。
5. 用本地 HTTP fixture 覆盖分页、限流、超时、部分失败和大文件。

**验收:** 多页结果无漏数；超出预算可预测失败；大文件不要求一次性驻留内存。

### Task 5：增加 Raw API 和 API Catalog

**Files:**
- Create: `wjx-cli/src/catalog/`
- Create: `wjx-cli/src/commands/api.ts`
- Create: `wjx-cli/src/commands/schema.ts`
- Modify: `wjx-cli/src/index.ts`
- Modify: `wjx-api-sdk/src/core/constants.ts`（兼容现有 Action）
- Test: Raw API、Schema 和 catalog consistency 测试

**Steps:**

1. 先定义版本化 Catalog 字段：action、路由、参数、body/response schema、scope、risk、pagination、file、timeout、retry。
2. 实现 `wjx api`，支持 action、HTTP method、JSON body、请求参数和原始响应查看，复用共享 runtime。
3. 实现 `wjx schema <command-or-action>`，输出机器可读 Schema。
4. 让快捷命令先消费 Catalog 中的风险、分页和输出元数据。
5. 增加命令清单、Catalog、SDK 导出和 MCP Tool Schema 一致性检查。

**验收:** 新接口可通过 `wjx api` 调用而无需立即新增快捷命令；Schema 与帮助可被脚本消费。

### Task 6：认证 Profile 和企业交付门禁

**Files:**
- Modify: `wjx-cli/src/lib/config.ts`
- Modify: `wjx-cli/src/lib/auth.ts`
- Create: `wjx-cli/src/lib/profiles.ts`
- Modify: `wjx-cli/package.json`
- Modify: `.github/workflows/`
- Test: Profile、权限预检、Node 多版本 CI

**Steps:**

1. 保留环境变量优先级，增加 profile 选择和多账号切换。
2. 将 API Key 存储抽象为凭据提供者，优先接入 OS Keychain；明文配置只作为显式兼容回退。
3. 增加权限/身份预检和脱敏诊断命令。
4. 固定 CLI 与 SDK 的兼容版本，禁止运行时依赖 `*`。
5. 建立 Node 20/22 CI、覆盖率门槛、集成 HTTP contract 和命令清单检查。

**验收:** 凭据不出现在普通日志；profile 可切换；CI 覆盖支持版本并阻止 catalog/命令漂移。

## 分阶段交付

| 阶段 | 范围 | 验收结果 |
| --- | --- | --- |
| Phase 0 | Task 1-2 | dry-run 零网络；高风险操作必须确认；错误保留上游信息 |
| Phase 1 | Task 3-4 | 共享 runtime、稳定 envelope、输出适配器、统一分页和文件流 |
| Phase 2 | Task 5 | Raw API、运行时 Schema、Catalog 驱动帮助/MCP/SDK/文档 |
| Phase 3 | Task 6 | Keychain/profile、多账号、CI、覆盖率和兼容矩阵 |

## 当前建议的下一步

先执行 Phase 0。它修改范围最小、可独立验证，且直接关闭 dry-run 和高风险写操作两类 P0 问题；Phase 1 的公共 runtime 设计应以 Phase 0 的测试契约为输入，避免先抽象后返工。

本计划本身是实施前过程文件，不属于 `wjx-docs` 用户文档。当前计划阶段不修改产品源码、不修改用户文档、不创建提交；开始执行某一 Task 时再按测试驱动步骤逐项改动和验证。

---

## 飞书 CLI 框架能力抽取（源码核对版）

本节是对 `C:/Temp/lark-cli-reference-20260826` 的源码级抽取，重点记录可迁移的机制、层级和边界。它不是把飞书 CLI 简化成“快捷命令 + API 命令 + Raw API”三层，而是把三层命令放回完整的构建、运行和交付体系中。

### 一、核心工作机制：从声明到结果

飞书 CLI 的一条业务命令，实际经过以下链路：

```text
启动参数/环境
  -> BootstrapInvocationContext
  -> BuildOptions 快照
  -> Build command tree
       - Factory / IO / profile / keychain
       - builtin commands
       - shortcut snapshot
       - API Catalog generated commands
       - api / schema / skill / completion
       - plugins and hooks
       - strict-mode and user-policy pruning
       - surface projection and skill composition
  -> Startup lifecycle
  -> Cobra parse and command dispatch
  -> identity resolution
  -> input source resolution (@file / stdin / flag)
  -> typed binding and relation validation
  -> Normalize (no network)
  -> Validate (no network)
  -> dry-run rendering OR high-risk confirmation
  -> Execute (only network-capable stage)
  -> retry / pagination / file transport
  -> response and error classification
  -> output emitter (stdout/stderr + exit code)
  -> Shutdown lifecycle
```

源码中的关键边界如下：

1. `cmd/build.go` 把构建当成独立装配阶段。`BuildOption` 先形成一次配置快照，再创建 `Factory`、注册命令、安装插件和策略，避免为了检查配置而重复执行有副作用的 Option。构建期错误会安装一个可执行的错误守卫，让 CLI 仍能输出结构化故障。
2. `cmd/root.go` 的 `Execute` 负责进程级生命周期：解析启动上下文、构建命令树、设置通知、执行 Cobra、无论成功失败都触发 `Shutdown`，最后统一把错误映射为退出码和错误信封。
3. `extension/command` 的 typed contract 把命令声明拆成 `Metadata/Input/Output/Hooks`。编译器先把泛型声明降级成 host 可消费的类型擦除表示，再生成 Cobra flags、Schema、运行时执行器和测试适配器。
4. typed runner 固定执行顺序：读取来源 -> 别名归一化 -> 参数绑定 -> `Normalize` -> 关系校验 -> `Validate` -> `DryRun` -> 确认门 -> `Execute` -> Result protocol 校验 -> 统一输出。业务 Execute 不能直接写 stdout，也不能返回未标记的零值 Result。
5. `extension/command.CommandContext` 是受限能力对象，而不是可变的全局 client。它显式暴露 `CallJSON`、`CollectPages`、文件下载、scope 预检和路径校验；InputStage 和 dry-run context 会拒绝网络调用，形成可测试的零网络不变量。

因此，飞书 CLI 的核心不是“命令多”，而是把命令变成可编译、可约束、可自省、可替换运行时的声明单元。

### 二、架构级能力清单

#### 1. 命令面与导航层

| 能力 | 飞书 CLI 的实际机制 | 对 `wjx-cli` 的启示 |
| --- | --- | --- |
| 快捷命令 | `+` 前缀；手工编排领域工作流；智能默认值、友好别名、pretty/table、dry-run | 保留 `survey`/`response` 等业务入口，但将其变成统一 Shortcut contract 的一种实现 |
| 生成式 API 命令 | `meta.Service/Resource/Method/Field` 解析 OpenAPI 元数据；`cmd/service` 从 `MethodRef` 生成命令和 flags | 不再逐条手工注册 SDK Action；将 action、路由、参数、body、response、risk、scope 放入 Catalog |
| Raw API 逃生舱 | `lark-cli api METHOD PATH`；支持 params/data、stdin/@file、文件上传下载、分页和原始响应 | 新接口不必等待快捷命令发版，但 Raw API 必须复用同一认证、输出和路径校验；它只具备通用 `write` 风险，不知道具体端点的精细风险、Schema 和 affordance，不能替代 typed API 命令 |
| Schema 自省 | `schema` 与 API Catalog 共用导航和排序；支持全量、服务、资源、方法路径；隐藏面不会出现在候选和错误提示中 | `reference` 应升级为运行时能力描述，不只输出静态 DSL 和题型 |
| Completion | Catalog 的 `Complete` 同时支持 dotted path 和分段命令；completion 使用同一 strict-mode/filter 和可见性投影 | 补全、帮助、Schema、执行必须共享一个命令事实源 |
| 未知命令处理 | 根构建期给纯父节点装 unknown-subcommand guard，避免 Cobra 把错误调用静默降级为 help + exit 0 | Agent 调用失败必须显式失败，不能把“没有执行”误判成成功 |

#### 2. 元数据与事实源层

| 能力 | 飞书 CLI 的实际机制 | `wjx-cli` 当前差距 |
| --- | --- | --- |
| 类型化元数据 | `internal/meta` 用 `Service/Resource/Method/Field` 解析固定 JSON 词汇；所有 map 列表显式按名称排序 | 当前 Action 常量、命令注册和帮助文本分散在 CLI/SDK |
| 统一 Catalog | `internal/apicatalog` 负责 Service/Resource/Method 查找、路径解析、方法遍历、Schema 和 completion；不把策略逻辑混入导航模块 | 当前没有可复用的 action/path/params 目录层 |
| 运行时元数据 | Registry 先载入嵌入元数据，再按 brand 选择远端端点；缓存带版本、TTL、原子写入、损坏淘汰、后台刷新；远端 payload 按原始字节缓存，未知字段不因本地模型而丢失 | 当前发布版本与 API 能力绑定，无法在不发版情况下获得新接口 |
| 确定性 | Catalog、Schema、帮助、错误候选、completion 全部使用稳定排序，测试不依赖 map 遍历顺序 | 需要冻结命令和字段顺序，避免 Agent 解析结果漂移 |
| 生成边界 | 只由 Catalog 生成 API 命令；Shortcut 仍保留人类友好业务语义；Raw API 作为未覆盖能力的逃生舱 | 不宜把所有问卷业务逻辑强行生成化，业务语义应留在 Shortcut 层 |

#### 3. 统一执行运行时

`Factory`/`RuntimeContext` 是横切能力的唯一入口，承载配置、HTTP/OAPI client、profile、keychain、credential provider、FileIO、IO streams、scope 检查、分页、错误呈现和 emitter。命令业务只接触上下文能力，不直接读取全局环境或自行拼接横切逻辑。

公开 typed command 的四类 Hook 具有严格职责：

- `Normalize`：只处理兼容输入和旧字段映射，不发请求。
- `Validate`：只做格式、范围和字段关系检查，不发请求。
- `DryRun`：从已校验参数生成一个或多个 Request 描述和文件意图；只渲染，不执行。
- `Execute`：唯一允许调用 API 的阶段，返回 `Success(data)`；框架统一负责 envelope、格式和退出码。

请求对象本身也是受约束的值对象：只允许 `GET/POST/PUT/PATCH/DELETE`，路径必须是 `/open-apis/` 下的同源相对路径，禁止 query/fragment、绝对 URL 和路径穿越；用户输入拼入路径前必须经过 `PathSegment`。

#### 4. 输入契约与兼容性层

typed `InputDefinition` 不只描述字段类型，还描述：

- canonical flag、多个兼容别名以及冲突规则（canonical wins / 两者同时报错 / trim 后相等才接受）；
- 输入来源（flag、`@file`、stdin `-`）；一个进程最多一个字段消费 stdin；
- JSON、重复参数、逗号或重复列表等编码方式；
- 默认值是否显式设置，避免 JSON 零值和“未提供”混淆；
- `exactly_one`、`at_least_one`、`co_occur`、`requires`、`conflicts` 等字段关系及检查阶段。

这使兼容性成为声明的一部分，而不是分散在各命令的字符串判断中。文件和 stdin 的内容在进入 Normalize/Validate 前解析，并保留“是否来自外部来源”的标记，防止后续把合法 payload 误认为路径或 inline 值。

#### 5. 身份、权限和风险层

- 身份模型固定为 `user`/`bot`，支持显式 `--as`、default-as、profile 提示和 auto-detect；strict mode 可强制某一种身份。
- 每个命令声明支持身份及其 scopes；required scopes 在执行前严格检查，conditional scopes 可按参数分支触发，且可标为 `required` 或 `best_effort`。
- 服务命令执行前可从 token 的已授予 scope 做本地预检；缺失权限会形成带 `missing_scopes`、`identity`、console URL 和恢复动作的 typed PermissionError。
- 风险是命令元数据的闭合枚举：`read < write < high-risk-write`。高风险命令自动注册 `--yes`，确认缺失时在任何网络请求之前返回 `confirmation_required`。
- 风险元数据同时被 help、Agent 判断、策略裁剪、插件规则和质量门禁使用，而不是只用于展示。

#### 6. 输出、错误与退出码层

成功输出通过 `output.Emitter`，命令级配置包含 stdout/stderr、命令路径、身份、颜色能力和 notice provider。默认 JSON 使用稳定信封：

```json
{"ok":true,"identity":"user","data":{},"meta":{"pagination":{"complete":true,"pages":1,"items":20}}}
```

支持 `json`、`pretty`、`table`、`csv`、`ndjson` 和 `jq`：

- JSON/jq 过滤完整 envelope；
- table/pretty 允许人类摘要；
- CSV/NDJSON 的 stdout 保持记录流，分页诊断放 stderr；
- 分页 formatter 锁定第一页列集合，后续页缺字段补空、额外字段忽略，保证管道稳定；
- 输出前做 ANSI、控制字符和内容安全扫描，告警进入 envelope 或 stderr，不污染业务字段。

错误由 `errs.Problem` 和一组 typed error 组成，至少区分 validation、authentication、authorization、config、network、API、policy/content-safety、confirmation、internal 等类别。统一错误字段包括 `type/subtype/code/message/hint/retryable/retry_after/log_id`，权限、确认和安全策略还有各自的机器字段。`cmd/root.go` 先读取 typed exit code，再尝试写 envelope，避免输出流故障把真实退出码降级成通用 1。

stdout/stderr 分工是强约束：成功数据和可供管道消费的记录写 stdout；错误信封和诊断写 stderr；partial failure/bare result 已经写出结果时只返回非零退出码，不重复污染 stderr。

#### 7. 分页、重试和文件流层

分页由 runtime walker 统一执行，而非每个业务命令自己写循环。标准控制面是 `--page-all`、`--page-limit`、`--page-delay`，并检查 cursor 缺失、重复 cursor、最大页数和上下文取消；结果 meta 报告 `complete/pages/items/next_token`。

不同输出模式有明确策略：JSON 聚合后一次输出；NDJSON/table/CSV 可逐页流式输出，但后续页失败必须通过退出码标记 partial result。`jq` 需要完整聚合结果后再过滤。

文件能力由 FileIO/transport 抽象承载，支持 `@file`、stdin、multipart 上传、二进制下载和原子保存路径；业务命令只声明文件意图或 FileTarget，不直接接触宿主文件系统。

#### 8. Surface、Policy、Recovery 三个正交面

飞书 CLI 明确区分四种问题：命令是否存在、是否可被引用、是否允许执行、失败后如何恢复。`surface.Plan` 对最终发行版形成 build-local 投影，状态包括 `available`、`denied-visible`、`concealed`；Schema、help、completion 和错误候选都读取同一投影。

策略层 `cmdpolicy` 将插件 Restrict 和 YAML 规则归一成同一 `Rule`：Allow/Deny glob、MaxRisk、Identities、是否允许未标注风险，四轴按 AND 计算，多条规则按 OR 授权。拒绝时保留 policy source、rule name、reason code，并安装 deny stub，而不是从树上简单删除节点，以便输出稳定错误和保留原 help。

Recovery 层把错误恢复动作结构化为 command、text、user authorization、console URL 等 hint。命令被 conceal 后，相关 help/schema/skill 指针和恢复建议也会一并移除，避免提示用户执行实际上不可用的命令。

#### 9. Skill 与 Affordance 内容层

飞书 CLI 把四类内容拆开：

- Metadata：API 是什么，参数/响应/权限是什么；
- Affordance：命令什么时候用、避免什么时候用、前置条件、Tips、示例和关联 Skill；
- Skill：领域知识、路由决策、安全规则和跨命令工作流；
- References：只在特定场景需要的 HOW-TO。

`affordance/<service>.md` 是按域、按命令的少量 Markdown，运行时惰性读取并缓存；`[[command]]` 引用由 registry 解析，失效引用不显示。它不重复字段 Schema，避免帮助文本和参数定义双重维护。

插件可以通过 `SkillsOverlay` 对 Skill 树做 Base/Allow/Remove/Overlay 组合，但 Skill 内容只有一个拥有者；删除 Skill 只影响 Skill list/read 和帮助指针，不会假装禁用命令，命令限制必须走 policy。组合前会扫描和校验每个 Skill 的 `SKILL.md`、依赖和引用，失败则 fail-closed。

#### 10. 插件、嵌入和生命周期层

公开扩展契约位于 `extension/`，不要求修改 CLI 主源码：

- `extension/command`：外部 typed command set，编译成同一 Shortcut/runtime；
- `extension/credential`：外部凭据提供者，支持企业集中凭证；
- `extension/fileio`：宿主文件读写；
- `extension/transport`：外部 HTTP/平台传输；
- `extension/platform`：Plugin、Observer、Wrapper、Startup/Shutdown、Restrict、Skill overlay。

插件安装使用 staging Registrar，Install 成功后一次性提交，失败回滚本插件已注册内容。Observer 有 Before/After，Wrapper 按注册顺序组成中间件，After 即使业务失败也会运行；插件 panic 会被恢复成 typed validation error，AbortError 会保留 hook 名称和原因。

插件声明 `RequiredCLIVersion`、是否 Restrict、FailurePolicy。纯审计观察器可 fail-open；Restrict 或 Skill customization 自动要求 fail-closed。规则、hook 名称、插件名在构建期校验并命名空间化，避免多个插件互相覆盖。

#### 11. 质量门禁与可观测交付层

飞书 CLI 把命令契约作为发布资产维护：

- `manifest-export` 导出完整 command manifest 和 command index；
- manifest 校验路径、canonical path、source、generated、risk、identities、flags、alias、默认值和 annotations；
- quality gate 校验命令命名、Skill 引用、默认 list 输出、默认 limit、Agent 决策字段、dry-run 示例、错误契约和 public-content；
- `lint/errscontract`、`flagcontract`、`domaincontract` 用 AST/type analysis 阻止手工绕过统一错误、flag alias、域名 resolver；
- commandtest、dry-run E2E、plugin E2E、live E2E 和输出契约测试共享同一 host contract；
- 增量检查根据 changed files、command surface 和 base manifest 缩小范围，但全局契约仍可在完整扫描时复核。

这意味着框架不仅在运行时提供能力，还在合并和发布阶段阻止命令、Schema、Skill、错误和输出协议漂移。

### 三、面向人类与 Agent 的处理链路

#### 人类用户链路

```text
领域目标
  -> <domain> --help
  -> +快捷命令和默认值
  -> grouped flags / enum completion / @file / stdin
  -> pretty/table 输出
  -> 写操作先 --dry-run
  -> high-risk-write 交互确认或 --yes
  -> profile/identity 自动选择
  -> 结果摘要、分页摘要、恢复提示
```

人类层的重点是降低输入成本和认知负担：命令名按业务目标组织，帮助内容给“何时使用”和“前置条件”，表格和 pretty 负责扫描，危险动作在交互层可见。

#### Agent 链路

```text
Skill / domain route
  -> affordance（何时使用、前置条件、避免场景）
  -> help（flags、默认值、风险、身份）
  -> schema（精确类型、body、response、scope）
  -> completion / canonical path
  -> 结构化 JSON envelope
  -> ok + exit code + typed error subtype
  -> hint / missing_scopes / retryable / recovery command
```

Agent 层的重点是可预测和可恢复：

- 先通过 Skill/Affordance 选择命令，再用 Schema 填充参数；
- 用 `--dry-run` 确认请求序列，不依赖猜测 URL 或 body；
- 依赖 `ok`、退出码和 error subtype 判断结果，不解析人类文本；
- 读取 identity/risk/scope 元数据，在执行前决定是否需要授权、确认或换身份；
- 遇到 unknown command、missing scope、policy denial、rate limit 时，直接消费结构化 hint 和恢复动作；
- 大列表使用 bounded `--page-all` 或 NDJSON，避免一次性把无界数据塞进上下文；
- 只有 Raw API 作为最后兜底，且它仍然受同一输入安全、路径、认证和输出边界约束。

人类层和 Agent 层不共享同一种呈现，但共享 `Factory -> RuntimeContext -> Catalog -> policy -> output/error` 基础设施，避免两套行为逐渐分叉。

Raw API 是有意保留的低语义入口：它解决“接口已存在但快捷命令尚未发布”的覆盖问题，代价是调用方必须自己掌握路径、请求体、权限和业务风险。对 Agent 来说，只有在 `schema`/快捷命令无法满足需求时才应使用它；`--dry-run` 能确认请求形状，但不能凭空补齐端点语义。

### 四、层级分工与协作关系

```text
L0  Distribution / Build
    brand, profile, plugins, policy, surface, skills overlay, lifecycle
        |
L1  Capability Catalog
    API metadata, command manifest, schema, affordance, completion
        |
L2  Command Surface
    builtins | shortcuts | generated API | raw api | schema | skill
        |
L3  Execution Contract
    parse -> source resolve -> bind -> normalize -> validate -> dry-run/confirm
        |
L4  Runtime Services
    credential/identity/scope | HTTP/OAPI | retry/pagination | FileIO | hooks
        |
L5  Protocol Boundary
    response classification -> output emitter -> stdout/stderr -> exit code
        |
L6  External Systems
    WJX API / files / keychain / enterprise providers
```

层间不变量：

1. L0 的 Surface/Policy 只能裁剪或拒绝 L2，不应在 L3 之后才发现命令不可用；所有帮助、Schema、completion、错误候选必须读取同一最终 surface。
2. L1 是事实源，不直接执行网络；L2 只把 Catalog/Shortcut 声明投影成 CLI 形状；业务语义不应反向修改 Catalog。
3. L3 决定副作用边界：Normalize/Validate/DryRun 不得访问网络，风险确认必须先于 Execute；L4 的网络、分页、重试和文件能力只能由 runtime 提供。
4. L5 是唯一输出出口，业务代码不能直接写 stdout；错误类别和退出码必须由同一协议产生。
5. 插件只能通过 L0/L2/L4 的公开扩展契约接入，不能偷偷绕过 L3 风险门或 L5 输出协议；插件失败策略必须显式区分 fail-open 与 fail-closed。
6. Skill/Affordance 是决策辅助，不是权限控制；Policy 是执行控制，不应通过删除文案来伪装权限。

### 五、对照 `wjx-cli` 的架构结论

#### 已具备或可复用

- Commander 命令树、SDK Action 调用和现有领域 Shortcut，适合作为 L2 的初始快捷层。
- 已有 `--dry-run`、table/JSON、stdin 和 Skill 文件，可作为兼容入口，但需要纳入统一 runtime contract。
- `wjx-api-sdk` 已经提供模块化 client，可作为 L4 transport 的实现，不必重写 API 调用细节。
- 现有 CLI/MCP/Skill 文档可作为 Affordance/Skill 内容迁移素材。

#### 部分具备但需要收口

- `command-helpers.ts` 已承担执行和输出，但 input transform、网络、副作用和错误归一化仍混在一起；需要拆成 L3 的 prepare/validate/execute。
- `reference` 已有静态参考能力，但没有 L1 Catalog 的统一 action、路由、body/response、scope、risk、pagination 事实源。
- table/JSON 已存在，但缺少 envelope、NDJSON/CSV、jq、分页 meta、stdout/stderr 和输出净化的统一协议。
- SDK 已有重试或 Action 封装基础，但 CLI 命令各自决定分页和错误呈现，需要上收至 runtime。
- Skill/CLI 文档已存在，但命令、帮助、Skill 和 MCP schema 仍需从同一 manifest/catalog 校验。

#### 完全缺失的架构能力

- `wjx api METHOD PATH` Raw API 逃生舱；
- API Catalog、运行时 Schema、命令 manifest 和确定性导航；
- typed command contract、字段关系、别名冲突和结果协议编译器；
- user/bot、多 profile、keychain、scope 预检和 conditional scope；
- read/write/high-risk-write 元数据、确认门和企业 policy/surface 投影；
- 通用分页 walker、流式输出、文件流和原子下载；
- typed error taxonomy、recovery projector、partial failure/bare result 协议；
- plugin/credential/fileio/transport 扩展边界和 lifecycle hooks；
- manifest、quality gate、AST contract lint、dry-run/plugin/E2E 交付门禁。

#### 不应直接照搬

- 不要先复制飞书 200+ API 的命令数量；`wjx-cli` 应先把少量高价值问卷动作接入统一契约。
- 不要让动态 Catalog 取代问卷领域语义；`survey create-by-json`、答卷导出、分析等工作流仍应由 Shortcut 编排。
- 不要在没有稳定错误/输出契约前扩展 Raw API；否则只是扩大不一致的调用面。
- 不要把 Skill 当作权限开关，也不要让插件直接持有不可控的全局 client。
- 不要一开始引入完整插件生态；先建立 host contract、fail-closed 规则和 commandtest，再开放扩展点。

### 六、下一轮架构评估的判定表

后续每项 `wjx-cli` 优化都按以下问题验收：

| 判定问题 | 通过标准 |
| --- | --- |
| 是否有唯一事实源？ | 命令、参数、风险、身份、scope、输出和文档至少能从同一声明或 manifest 校验 |
| 是否明确副作用边界？ | 解析/校验/dry-run 阶段 HTTP 调用数为 0；只有 Execute 可访问网络 |
| 是否对人类和 Agent 都可用？ | 人类有 shortcut/pretty/help；Agent 有 schema/envelope/exit code/recovery |
| 是否可扩展？ | 新 API 可由 Catalog/Raw API 接入；外部命令和凭据可通过公开 contract 接入 |
| 是否可治理？ | risk/policy/surface 可裁剪、拒绝、审计，且提示与实际可用面一致 |
| 是否可验证？ | 有 contract test、manifest/schema consistency、dry-run E2E 和质量门禁 |

---
