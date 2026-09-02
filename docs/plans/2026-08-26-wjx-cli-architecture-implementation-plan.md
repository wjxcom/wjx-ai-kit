# wjx-cli Architecture Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 以一次性架构切换的方式，把 `wjx-cli` 建设为具备明确副作用边界、统一运行时、统一输出/错误协议、可自省 API 能力和风险治理的 CLI 平台。

**Architecture:** 保留现有领域快捷命令作为人类友好的 Shortcut 层，但直接切换到共享 `RuntimeContext` 和 typed command contract；所有命令统一经过输入来源解析、Normalize、Validate、DryRun/Confirm、Execute、响应归一化和唯一输出协议。随后建立以 WJX action/service 为中心的静态 API Catalog，提供 Schema、Raw API 和 manifest；最后补齐 profile、最小 policy/surface 和质量门禁。插件运行时、远端动态 Catalog、原生 Keychain 和强 scope 预检只保留接口或后置项，不进入首轮核心交付。

**Tech Stack:** TypeScript、Node.js >= 20、Commander.js、Node 内置 `fetch`/`node:test`、npm workspaces、`wjx-api-sdk`。

---

## 1. 目标、边界与完成标准

### 1.1 本需求解决的问题

当前 CLI 的主链路是：

```text
Commander -> 手工 buildInput -> SDK Action + POST -> 每个命令自行处理输出和错误
```

这条链路已经支持不少业务命令，但架构边界不够稳定：

- `--dry-run` 会在判断前执行 `transformInput`，`response submit` 可能先调用 `getSurvey`，因此不是零网络请求。
- 删除问卷、清空答卷、删除联系人/部门/管理员等写操作没有统一风险等级和确认门。
- 命令、Action、参数、帮助、MCP Schema 和文档没有共同事实源。
- 分页、重试、文件传输、错误分类和输出格式由命令或 SDK 分散承担。
- 只有单一 API Key 和明文配置文件，没有 profile/credential provider 扩展边界。
- 没有 WJX 原生的 Raw API 逃生舱；新增 Action 必须等待手工命令和 SDK 发布。

统一输出协议不是 CLI 单包内部改动：它会同时影响 `wjx-skills` 中供 Agent 读取的输出示例、`wjx-cli/bundled` 发布副本、`wjx-agents`/`.claude/agents` Agent 卡、`wjx-survey-ppt/SKILL.md` 中的 CLI 调用说明，以及 `wjx-docs` 的 CLI/任务参考。当前仓库没有独立的 Python CLI 解析器；若未来的外部 `ppt-master-survey` 仓库存在独立解析逻辑，应另立跨仓库协调需求。协议变更必须作为一次完整的 breaking release 处理，不能只修改 `wjx-cli/src`。

基线证据位于：

- `wjx-cli/src/index.ts:31-73`：命令树和全局选项手工装配。
- `wjx-cli/src/lib/command-helpers.ts:138-192`：输入转换、认证、dry-run、执行、输出和错误混在一个函数。
- `wjx-cli/src/commands/response.ts:153-230`：submit 的自动版本预取会穿过 dry-run 边界。
- `wjx-cli/src/lib/output.ts:84-145`：只有 JSON/table 两种主要投影，缺少统一 envelope 和流式输出。
- `wjx-cli/src/lib/errors.ts:1-70`：错误分类依赖少量类型和 message substring。
- `wjx-cli/src/lib/config.ts:1-49`、`wjx-cli/src/lib/auth.ts:1-14`：配置和认证是单 profile 明文/env 模型。
- `wjx-api-sdk/src/core/api-client.ts:63-167`：transport 统一处理 POST、超时和重试，但没有为 CLI 暴露请求计划、分页或结构化错误。
- `wjx-mcp-server/src/core/api-client.ts` 和 `wjx-mcp-server/src/index.ts`：MCP Server 复用 SDK transport/credential provider；SDK transport 改动若只在 CLI 外层实现，会让 MCP 静默失去既有重试，因此必须纳入同一跨包回归。

### 1.2 范围内

本计划覆盖架构能力、一次性协议切换及其所有下游契约同步所需的最小业务接入：

1. 统一命令执行契约和 Build/Execute 生命周期。
2. Dry-run 零网络、请求计划和 high-risk confirmation。
3. 稳定的结果/错误/退出码协议，以及 JSON、pretty、table、NDJSON、CSV 输出适配器。
4. 通用分页、重试预算、文件输入/输出和原子写入。
5. WJX action/service 形式的 API Catalog、Schema 和 Raw API。
6. Profile、可注入 credential provider 和最小 policy/surface。
7. 命令 manifest、契约测试、AST/静态质量门禁和 Node 版本 CI。
8. `wjx-skills`、`wjx-cli/bundled`、`wjx-agents`、`.claude/agents`、`wjx-survey-ppt` 和 `wjx-docs` 的协议同步及发布门禁。

### 1.3 范围外

- 不在本需求中新增大量业务命令或重写问卷领域模型。
- 不把飞书 CLI 的 REST `METHOD PATH` 形式直接复制到 WJX；WJX 的第一版 Raw API 使用 `service + action + params/body`，只有 transport 真正支持 HTTP 路径时才扩展 HTTP 入口。
- 不把 Skill/Affordance 当成权限控制；权限和执行限制必须由 policy/surface 实现。
- 不在核心交付中实现插件运行时、插件市场、远端动态 Catalog、原生 Keychain 或强 scope 强制校验；只保留不会改变主链路的接口预留和后置评估项。
- 不把实施过程、评审记录或临时设计写入 `wjx-docs`；但协议 breaking release 必须同步更新受影响的正式用户文档、Skill、bundled 副本、Agent 卡和下游 CLI 消费说明，并由发布门禁校验。

### 1.4 可验证完成标准

完成全部阶段后，以下命令和检查必须通过：

```bash
npm --workspace=wjx-api-sdk run build
npm --workspace=wjx-api-sdk test
npm --workspace=wjx-mcp-server run build
npm --workspace=wjx-mcp-server test
npm --workspace=wjx-cli run build
npm --workspace=wjx-cli run sync-bundled:check
npm --workspace=wjx-cli run manifest:check
npm --workspace=wjx-cli run architecture:check
npm --workspace=wjx-cli run protocol:check
npm --workspace=wjx-cli run perf:startup
npm --workspace=wjx-cli run release:check
npm --workspace=wjx-cli test
npm run docs:build
npm run docs:check
```

行为标准：

| 领域 | 完成标准 |
| --- | --- |
| 副作用 | `Normalize`、`Validate`、`DryRun` 的 HTTP 调用数为 0；只有 `Execute` 可以使用网络 transport |
| 风险 | 标记为 `high-risk-write` 的命令在非交互环境必须带显式 `--yes`；拒绝时 HTTP 调用数为 0 |
| 输出 | 同一个结果由不同 formatter 投影时数据一致；stdout 只放结果，stderr 只放诊断/错误 |
| 错误 | 错误包含稳定 `type/subtype/code/message/retryable`，并保留 WJX `errorcode/traceid`（若上游提供） |
| 扩展 | 新 action 可通过 Catalog/Raw API 使用，不需要先新增 Shortcut；Shortcut、Schema、completion 共享 Catalog 投影，并由 manifest 门禁校验漂移 |
| 协议切换 | 所有结构化命令直接输出统一 `ResultEnvelope`/`ProblemEnvelope`；`pretty/table` 只是人类投影，不再维护旧 JSON 形状 |
| 生态同步 | CLI、SDK、MCP、wjx-skills、bundled、Agent 卡和 `wjx-docs` 的协议示例一致；`sync-bundled`、`docs:build`、`docs:check` 全部通过 |
| 启动性能 | 同一次采样先测裸 Node 冷启动地板，再测 `wjx --version`；门禁比较 CLI 相对增量 p95，而不是跨机器的绝对毫秒数。基线按 `platform-arch-nodeMajor` 建 key，Catalog/Surface 构建不能造成增量无界增长 |
| 版本发布 | CLI、SDK、MCP Server 从现有 `0.3.x` 统一升级为 `0.4.0`；CHANGELOG 和迁移文档包含 breaking change、迁移示例和下游影响 |
| 跨包回归 | SDK 默认 transport 行为不变；CLI、SDK、MCP Server build/test 全部通过，MCP 的重试回归测试保持通过 |
| 交付 | 每个阶段有 focused test、全量跨包测试和可回滚的独立提交；协议切换只在新契约与生态同步门禁全量通过后发布 |

### 1.5 收益/风险筛选

本计划不追求把飞书 CLI 的所有能力一次性搬进 WJX。按“收益大、风险小、能独立验收”的原则，首轮只做下表中的核心项：

| 能力 | 收益 | 实施风险 | 决策 |
| --- | --- | --- | --- |
| 纯请求准备 + DryRun 零网络 | 直接修复 P0 副作用问题，显著提高 Agent 可预测性 | 低 | 核心必做 |
| 统一风险元数据 + high-risk confirmation | 防止误删/误清空，行为边界清晰 | 低 | 核心必做 |
| 统一 Result/Problem 协议 | 消除命令间输出差异，降低 Agent 解析成本 | 中（涉及全量命令切换） | 一次性切换，核心必做 |
| 有界分页、重试和文件流 | 直接改善答卷导出和大文件工作流 | 中 | 核心必做，但不扩展复杂传输协议 |
| SDK additive transport + MCP 回归 | 让 CLI 获得显式预算，同时保住 MCP 既有重试语义 | 低到中 | 核心必做；默认 SDK 行为不变 |
| 静态 Catalog + Schema + 白名单 Raw API | 新 Action 可快速接入，减少手工命令开发 | 中 | 核心后半段；不接远端动态元数据 |
| Manifest、契约测试、架构检查 | 阻止后续命令/协议漂移 | 低 | 核心必做 |
| Profile + 可注入 credential provider | 支持多环境和测试隔离，改动边界清晰 | 低到中 | 核心必做 |
| 强 scope 预检、OS Keychain | 企业场景有价值，但当前 WJX 能力和跨平台实现不确定 | 中到高 | 只留接口，另立需求 |
| 插件运行时、插件市场、远端 Catalog | 扩展性强，但引入加载、隔离、版本和安全治理 | 高 | 不进入本计划 |

首轮的核心发布判定是：Task 1-5b、Task 6-8 和 Task 9a-9c 的 focused test、跨包回归全部通过，且所有提交保持绿态；Task 9c 的生态同步、manifest、静态架构、发布产物和性能门禁全部通过后才发布。任何新增能力若不能通过独立 fixture 验证，或需要引入新的全局状态、动态代码加载或第二套协议，应移出本计划。

### 1.6 有意放弃与继续保留的优势

为了换取长期的确定性，本次明确接受以下损失：

- 不再保留旧 JSON 顶层形状，也不维护新旧协议双轨；协议一次性切换，升级后的调用方必须读取 `ok/data/meta` 或 `ok/error`。
- 不再允许命令 handler 随意绕过 Runtime 直接请求、打印或退出；临时特判必须归入明确的生命周期阶段。
- 高风险写操作不再追求“一条命令直接执行”，自动化调用需要显式授权。
- `response submit --dry-run` 不再联网补全 `jpmversion`；未显式提供时计划会标记 `unresolved: ["jpmversion"]`，需要完全确定的请求体时必须显式传入该值。这是有意牺牲“dry-run 输出与即将发送请求体完全相同”的便利，换取零网络不变量。
- 命令实现会比当前 `解析参数 -> 调 SDK` 更有结构，换取统一测试和治理能力。

以下优势继续保留，但以新契约为边界：

- `survey`、`response` 等领域 Shortcut 的业务语义和跨 API 编排能力。
- `wjx-api-sdk` 的模块化 API 实现，不重复手写底层 HTTP 细节。
- `pretty/table` 的人工可读体验，以及 stdin、文件输入和 completion 等高频交互能力。
- Raw API 只作为低语义逃生舱，不替代领域命令，也不绕过风险、认证和输出边界。

### 1.7 发布策略与兼容边界

- `wjx-cli` 的 `result -> ok`、错误对象、stdout/stderr 和退出码变化是明确的 breaking change；按用户确定的版本策略从 `0.3.x` 统一发布 `0.4.0`，不增加短期兼容开关，不维护旧协议分支。
- `wjx-cli/CHANGELOG.md` 必须包含 breaking change、受影响的 Skill/Agent/脚本清单和迁移示例；`wjx-docs/migration.md` 必须说明顶层字段、错误结构、流输出和退出码变化。
- 架构阶段原计划只允许 SDK additive 扩展；本次独立需求又明确移除 `createSurvey`、`createSurveyByText`、`textToSurvey` 等公开创建能力，因此最终发布边界按实际 API 破坏面调整：`wjx-api-sdk`、MCP Server 与 CLI 统一升至 `0.4.0`，CLI/MCP 固定依赖 `^0.4.0`。三个包按 SDK → MCP Server → CLI 顺序发布，确保下游包安装时不会解析到旧 SDK。
- `wjx-mcp-server` 虽保持现有 MCP 工具协议，也随本次 SDK 依赖和创建工具移除同步发布 `0.4.0`；它必须继续获得 SDK 默认 transport 的重试能力，并在 CI 中有独立回归测试。
- CLI 和 MCP 源码包均固定依赖 `wjx-api-sdk: "^0.4.0"`，以保证新 Runtime/JSONL 能力不会落到 npm 上的旧 SDK；`release:check` 会在临时 staging 中再次断言 CLI tarball 的 SDK 依赖范围和已安装 SDK 导出，避免本地 workspace 版本掩盖发布错配。
- `--json`/`--table` 已从 CLI 注册和帮助中移除；运行时作为未知选项返回结构化 `INPUT_ERROR`，不提供兼容别名。所有调用方必须使用 `--format json|table`。

### 1.8 路径与门禁可行性核对

本计划中的路径按当前仓库实际状态分为三类，执行时不得混淆：

| 类型 | 当前核对结果 | 执行约束 |
| --- | --- | --- |
| 已存在且直接修改 | `wjx-cli/src/commands/*`、`wjx-cli/__tests__`、`wjx-api-sdk/__tests__`、`wjx-mcp-server/__tests__`、`wjx-skills/*`、`wjx-agents/*`、`.claude/agents/*`、`wjx-docs/*`、`wjx-cli/scripts/sync-bundled.mjs` | 只按对应 Task 修改；不把目录重建成新模块 |
| 计划中新建 | `wjx-cli/src/lib/runtime/*`、`wjx-cli/src/catalog/*`、`wjx-cli/scripts/export-manifest.mjs`、`wjx-cli/scripts/check-architecture-contract.mjs`、`wjx-cli/scripts/benchmark-startup.mjs`、`wjx-cli/scripts/lib/protocol-scan.mjs`、`wjx-cli/scripts/check-protocol-contract.mjs`、`wjx-cli/scripts/check-release-artifacts.mjs`、`wjx-cli/manifest/commands.json`、`wjx-cli/perf/startup-baseline.json`、`.github/workflows/cli.yml` | 先在所属 Task 的 failing test 中声明，再创建；生成文件禁止手工编辑；`manifest` 是 Catalog 派生的 CI/发布审计快照，不是运行时数据源 |
| 已确认不存在、不得创建 | `wjx-survey-ppt` 下的独立 Python CLI 解析器和对应协议测试文件 | 只修改实际存在的 `wjx-skills/wjx-survey-ppt/SKILL.md`；外部 `ppt-master-survey` 若有消费逻辑，另立跨仓库需求 |

门禁的落地前置关系也已固定：Task 1 的新协议断言用 Node `todo` 保持绿态，并创建可非阻塞运行的 `benchmark-startup.mjs --report`；Task 2、3、4、5、6、7、8 在完成各自架构变更后都运行一次 report 并记录相对增量；Task 2 激活 DryRun 断言；Task 5 激活 envelope/退出码断言；Task 5b 创建共享 `protocol-scan.mjs`、同步 Skill/Agent/正式参考并生成 bundled；Task 9a 创建 manifest、架构检查并把性能脚本切换为按环境 key 强制比较；Task 9b 逐组更新 manifest；Task 9c 才创建 protocol/release checker、`sync-bundled --check` 和 CI。Catalog/TypeScript 是唯一运行时真源，manifest 不加入 npm `files`，也不在启动路径读取。`release:check` 必须先验证 bundled/manifest/build，再在临时 staging 中使用 `npm pack --ignore-scripts`，避免触发自身的 `prepublishOnly` 递归；CI 不得用 `SKIP_PERF` 绕过性能门禁。

## 2. 目标架构

### 2.1 分层模型

```text
L0 Bootstrap / Build
   profile、credential provider、policy、surface、lifecycle
        |
L1 Capability Catalog
   action/service、参数、body/response schema、risk、identity、scope、分页、文件、重试
        |
L2 Command Surface
   builtin | Shortcut | Catalog command | Raw API | schema | reference | skill | completion
        |
L3 Execution Contract
   parse -> source resolve -> bind -> Normalize -> Validate -> DryRun/Confirm
        |
L4 Runtime Services
   identity、WJX transport、retry、pagination、FileIO、trace
        |
L5 Protocol Boundary
   response/error classification -> envelope -> formatter -> stdout/stderr -> exit code
        |
L6 External Systems
   WJX API、文件系统、stdin、credential provider
```

### 2.2 固定执行流水线

```text
Build command tree
  -> resolve final Surface/Policy
  -> parse Commander arguments
  -> resolve stdin/@file/flag source
  -> bind aliases and typed values
  -> Normalize (no network)
  -> Validate field relations (no network)
  -> DryRun request plan OR risk confirmation
  -> Execute through RuntimeContext (network allowed here only)
  -> bounded retry/pagination/file transport
  -> classify response or typed error
  -> emit ResultEnvelope/ProblemEnvelope or human projection
  -> map stable exit code
```

三个不变量必须写进接口和测试，而不是只写进注释：

1. `Normalize`、`Validate` 和 `DryRun` 接收的 context 不暴露可发请求的 client。
2. 高风险确认发生在任何真实 API 调用之前；`--yes` 必须来自显式 CLI 参数或受信任的自动化授权来源。
3. 业务命令不得直接 `console.log`、`process.stdout.write` 或 `process.exit`，统一交给 emitter/root lifecycle。

### 2.3 关键类型契约

后续实现以以下形状为唯一协议基线；字段版本化扩展，不再为旧输出形状保留第二套协议：

```typescript
export type RiskLevel = "read" | "write" | "high-risk-write";

export interface CommandSpec<Input = unknown, Data = unknown> {
  path: string;                         // e.g. "survey.list"
  source: "builtin" | "shortcut" | "catalog" | "raw";
  risk: RiskLevel;
  identities: Array<"user" | "bot" | "unknown">;
  normalize(input: unknown, ctx: InputContext): Input;
  validate(input: Input, ctx: ValidationContext): void;
  dryRun?(input: Input, ctx: DryRunContext): RequestPlan[];
  execute(input: Input, ctx: ExecuteContext): Promise<Data>;
}

export interface RequestPlan {
  service: string;
  action: string;
  method: "POST";
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  unresolved?: string[];
}

export type DryRunEnvelope = ResultEnvelope<{
  kind: "dry-run";
  plans: RequestPlan[];
}>;

export interface ResultEnvelope<T = unknown> {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ProblemEnvelope {
  ok: false;
  error: {
    type: string;
    subtype?: string;
    code?: string | number;
    message: string;
    hint?: string;
    retryable?: boolean;
    retry_after?: number;
    trace_id?: string;
  };
}
```

协议切换采用一次性发布：所有命令的机器可消费输出统一为 `ResultEnvelope`/`ProblemEnvelope`，不设置 `legacyOutput`，不增加 `--envelope` 双轨开关。`pretty`、`table` 是同一 envelope 的人类投影；`--json`/`--table` 不再注册，统一使用 `--format`。

### 2.4 人类和 Agent 的共同基础设施

```text
人类：Shortcut -> help/pretty/table -> dry-run -> confirm -> summary
Agent：Skill/Affordance -> schema -> canonical command -> envelope/exit code -> hint/recovery
                          \_________ shared Build/Catalog/Runtime/Policy _________/
```

- Shortcut 保留业务语义、默认值和跨 API 编排。
- Catalog command 提供精确 action/字段/schema，不取代领域 Shortcut。
- Raw API 只解决“接口已有但 Shortcut 尚未覆盖”，仍受路径、输入、认证、风险和输出协议约束。
- Skill/Affordance 负责选择和前置条件；Policy 负责是否允许执行；两者不可混用。

## 3. 实施任务

每个任务都遵循 TDD 顺序：先写失败测试，再实现最小变更，再运行 focused test 和全量测试，最后单独提交。任务中的“提交”是未来执行计划，不代表本次已经修改源码。

绿态和性能观察是全局约束：Step 1-2 允许当前基线或本任务新增的 focused test 暂时失败；完成实现后的 Step 4 必须恢复 focused/full test PASS，禁止把预期失败或回归红态提交到共享分支。Task 2、3、4、5、6、7、8 每个 Step 4 还必须运行 `npm --workspace=wjx-cli run perf:startup -- --report`，在 commit message 中记录本次 Node floor、CLI p95 和增量 p95；`--report` 只采集和报告，不因性能超阈值失败。若任一任务的 `deltaP95Ms` 超过所选基线的 120%，该任务不得直接提交：必须在本任务内完成懒加载/延迟构造等优化并重新 report 回到预算内，或在 commit message 和 PR 描述中记录经 review 批准的预算上调、旧/新目标值和原因；只有批准后才能更新对应基线，不能推迟到 Task 9a，也不能用重写基线掩盖回归。Task 9a 才将同一脚本切换为 enforce。除非任务明确说明“当前基线下预期 FAIL”，其余 Expected 均以实现后 PASS 为准。

执行各任务前加载并遵循 `@karpathy-guidelines`、`@test-driven-development` 和 `@verification-before-completion`；整份计划按 `@executing-plans` 的检查点执行。

### Task 1: 定义新协议并建立架构测试夹具

**Files:**
- Create: `wjx-cli/__tests__/architecture-contract.test.mjs`
- Create: `wjx-cli/__tests__/fixtures/http-fixture.mjs`
- Create: `wjx-cli/scripts/benchmark-startup.mjs`（Task 1 提供 `--report` 非阻塞采集；Task 9a 再加入强制阈值）
- Create: `wjx-cli/perf/startup-baseline.json`（在任何架构源码改动前生成并审阅）
- Modify: `wjx-cli/package.json`（Task 1 先注册 `perf:startup`，后续任务复用同一入口）
- Inspect: `wjx-cli/tsconfig.json`

**Step 1: Write the failing tests**

在 `architecture-contract.test.mjs` 添加以下契约测试。由于协议和 Runtime 尚未实现，除当前基线已满足的断言外，新增断言统一使用 Node `test(name, { todo: "activate in Task N" }, fn)` 标记，不允许把预期缺口作为红色提交；Task 2/Task 5 分别将对应 TODO 提升为活动断言。

- `dry-run never calls the configured HTTP fixture`（TODO，Task 2 激活）：通过 `node:http` 启动本地 fixture，并在测试进程安装会直接 throw 的全局 `fetch` sentinel；将 `WJX_BASE_URL` 指向 fixture，运行 `survey list --dry-run` 和 `response submit --dry-run`，断言 sentinel 未触发且 fixture 请求计数为 `0`。
- `structured commands emit one result protocol`（TODO，Task 5 激活）：断言 `survey url` 默认输出 `{"ok":true,"data":...}`；`--format pretty/table` 只改变人类呈现，不改变底层 data。
- `error keeps stdout empty and emits ProblemEnvelope`（TODO，Task 5 激活）：断言输入错误和认证错误的 stdout 为空，stderr 是 `ProblemEnvelope`，包含稳定 `type/subtype/code/message`。
- `unknown command is non-zero`（TODO，Task 5 激活）：为后续 unknown-command guard 固定非零退出契约。

**Step 2: Run the tests to verify the baseline gaps**

Run:

```bash
npm --workspace=wjx-cli run build
node --test wjx-cli/__tests__/architecture-contract.test.mjs
```

Expected: `node:test` 报告预期契约为 TODO，进程退出码为 0；基线输出仍允许显示旧形状，但不得把预期架构缺口提交成红态。

**Step 3: Implement only the fixture and assertions needed for repeatability**

`http-fixture.mjs` 提供 `startFixture()`、`requests()`、`close()`，不修改生产代码。将 subprocess 环境、超时和临时目录逻辑集中在测试 helper，避免每个测试自行拼接。

在当前 HEAD、尚未修改架构源码前，使用基线脚本采集启动快照。脚本必须在同一次采样中先执行裸 Node 子进程 `node -e ""`，再执行 `wjx --version`，保存 `nodeP95Ms`、`cliP95Ms` 和 `deltaP95Ms = cliP95Ms - nodeP95Ms`；JSON 以 `platform-arch-nodeMajor` 为 key，允许 `default` 作为显式审阅过的回退项：

```bash
npm --workspace=wjx-cli run build
node wjx-cli/scripts/benchmark-startup.mjs --write-baseline --write-default --samples 20 --discard 2
```

审阅 `wjx-cli/perf/startup-baseline.json` 后随 Task 1 提交；当前本机已有一次 12 次冷启动观测约 p95 177 ms、裸 Node 约 75 ms，仅作为人工对照信息，不替代用 20/2 参数生成的提交基线。Task 1 同时在 `package.json` 注册 `"perf:startup": "node scripts/benchmark-startup.mjs"`。

基线文件固定为可合并的结构，不保存单一机器的绝对阈值：

```json
{
  "schemaVersion": 1,
  "samples": 20,
  "discard": 2,
  "baselines": {
    "default": {
      "nodeP95Ms": 0,
      "cliP95Ms": 0,
      "deltaP95Ms": 0
    },
    "platform-arch-nodeMajor": {
      "nodeP95Ms": 0,
      "cliP95Ms": 0,
      "deltaP95Ms": 0
    }
  }
}
```

实际 key 由脚本替换为例如 `win32-x64-node22`；`--write-baseline` 只更新当前 key，不覆盖其他已审阅 runner 条目；`--write-default` 才允许显式更新 `default` 回退条目，且必须在 review 中说明原因。`--report` 可以读取基线用于展示对比，但不修改基线、不执行阈值门禁，也不因超阈值失败。

**Step 4: Run the new-contract baseline**

```bash
npm --workspace=wjx-cli test
npm --workspace=wjx-cli run perf:startup -- --report
```

Expected: 测试夹具可重复运行，TODO 数量和名称稳定；全量测试和 report 退出码均为 0。report 输出当前环境 key、Node floor、CLI p95 和增量 p95，但不执行阈值门禁。现有 `cli.test.mjs` 暂不大规模改写，避免把协议基线和命令迁移混成一个提交。

**Step 5: Commit**

```bash
git add wjx-cli/__tests__/architecture-contract.test.mjs wjx-cli/__tests__/fixtures/http-fixture.mjs wjx-cli/scripts/benchmark-startup.mjs wjx-cli/perf/startup-baseline.json wjx-cli/package.json
git commit -m "test(cli): define unified architecture contracts"
```

### Task 2: 拆分纯请求准备并保证 DryRun 零网络

**Files:**
- Create: `wjx-cli/src/lib/runtime/types.ts`
- Create: `wjx-cli/src/lib/runtime/input.ts`
- Create: `wjx-cli/src/lib/runtime/request-plan.ts`
- Create: `wjx-cli/src/lib/runtime/dry-run.ts`
- Create: `wjx-cli/src/lib/runtime/executor.ts`
- Modify: `wjx-cli/src/lib/command-helpers.ts:32-192`
- Modify: `wjx-cli/src/commands/response.ts:153-230,323-383`
- Modify: `wjx-cli/src/commands/survey.ts:140-230,438-456`
- Modify: `wjx-cli/src/index.ts:46-56`
- Test: `wjx-cli/__tests__/runtime-preparation.test.mjs`

**Step 1: Write the failing tests**

测试以下 contract：

将 Task 1 中与 DryRun 直接相关的 TODO 断言提升为活动断言；只允许本任务新增的 focused test 在实现前暂时失败，提交前必须恢复绿态。

- `normalize and validate do not receive a network-capable context`：在类型和运行时 mock context 中都没有 `fetch`/`sdkFn`/SDK client；测试进程安装 throw 型全局 `fetch` sentinel，调用 prepare 不得触发它。
- `response submit dry-run returns a request sequence without fetching survey`：自动版本场景返回 `RequestPlan[]`，可以包含 `unresolved: ["jpmversion"]` 或显式的 preflight plan，但 fixture 请求数必须为 `0`。
- `dry-run masks authorization and keeps diagnostics on stderr`：请求预览中的 Authorization 脱敏，计划作为 `ResultEnvelope` 写入 stdout，只有诊断写入 stderr。
- `stdin and explicit CLI flags preserve source precedence`：保留 `mergeStdinWithOpts` 当前“显式 CLI 覆盖 stdin 默认值”的行为，并对未知字段给出可配置的 reject/warn 结果。

**Step 2: Run the focused tests**

```bash
npm --workspace=wjx-cli run build
node --test wjx-cli/__tests__/runtime-preparation.test.mjs
```

Expected: focused test 在实现前因 `transformInput` 可在 dry-run 前发起 `getSurvey` 而 FAIL；完成 Step 3 后必须 PASS，且不得把失败状态提交到共享分支。

**Step 3: Implement the pure preparation boundary**

实现以下职责：

1. `input.ts` 只处理 flag、stdin、`@file`、别名、默认值和字段关系；保留 source metadata，区分显式值与 Commander 默认值。
2. `request-plan.ts` 将 WJX action 调用转换为不执行的 `RequestPlan`。请求描述使用 `service + action + method=POST + sanitized headers + body`，不允许绝对外部 URL。
3. `dry-run.ts` 只渲染计划，不调用 SDK 函数。需要远端问卷结构才能完成的 submit 预处理，返回带 `unresolved` 的计划或明确的多步计划，禁止偷偷调用 `getSurvey`。
4. 将执行生命周期抽到 `runtime/executor.ts`。为尚未迁移的命令保留一个**内部**执行 facade，使其复用同一 prepare/execute 生命周期；facade 不产生第二套用户可见协议，也不允许绕过统一 emitter。
5. 本任务只迁移两个代表命令：`survey list` 和 `response submit`（若 `response query` 已具备稳定 fixture，可作为第三个代表命令）；其余命令继续通过内部 facade 工作，由 Task 9b 按组迁移。
6. 所有已迁移命令的顺序固定为 `merge -> normalize -> validate -> dryRun/confirm -> execute`；`executor.ts` 只依赖抽象的 lifecycle/context 接口，不提前依赖尚未建立的完整 Profile 或 Policy 实现。

**Step 4: Verify zero-network and the new contract**

```bash
npm --workspace=wjx-cli run build
node --test wjx-cli/__tests__/runtime-preparation.test.mjs wjx-cli/__tests__/architecture-contract.test.mjs
npm --workspace=wjx-cli test
npm --workspace=wjx-cli run perf:startup -- --report
```

Expected: 新增 dry-run 测试和全量测试 PASS，fixture 请求数保持 `0`；代表命令改用新执行契约，未迁移命令仍由内部 facade 保持可运行；report 记录本任务的 Node floor、CLI p95 和增量 p95，不执行强制阈值。

**Step 5: Commit**

```bash
git add wjx-cli/src/lib/runtime wjx-cli/src/lib/command-helpers.ts wjx-cli/src/commands/response.ts wjx-cli/src/commands/survey.ts wjx-cli/src/index.ts wjx-cli/__tests__
git commit -m "refactor(cli): separate pure request preparation from execution"
```

### Task 3: 引入风险元数据和高风险确认门

**Files:**
- Create: `wjx-cli/src/lib/runtime/risk.ts`
- Create: `wjx-cli/src/lib/runtime/confirmation.ts`
- Create: `wjx-cli/src/lib/policy.ts`（先提供恒为 allow 的 `PolicyDecision` 接口，完整规则在 Task 8 填充）
- Create: `wjx-cli/src/lib/command-metadata.ts`
- Modify: `wjx-cli/src/lib/command-helpers.ts`
- Modify: `wjx-cli/src/index.ts:33-41`
- Modify: `wjx-cli/src/commands/survey.ts`（delete、clear-bin、update-settings、status）
- Modify: `wjx-cli/src/commands/response.ts`（modify、clear、submit）
- Modify: `wjx-cli/src/commands/contacts.ts`、`department.ts`、`admin.ts`、`account.ts`、`tag.ts`、`user-system.ts`
- Test: `wjx-cli/__tests__/risk-confirmation.test.mjs`

**Step 1: Write the failing tests**

测试代表性命令：

- `survey delete`、`survey clear-bin`、`response clear`、`response modify`、`contacts delete`、`department delete`、`admin delete`、`account delete`、`tag delete`、`user-system delete` 在无 `--yes` 的非交互环境下返回 `confirmation_required`。
- 被拒绝时 fixture 请求数为 `0`，stderr 包含 `command`、`risk`、目标字段和 `confirmation_source`。
- 传入 `--yes` 后才允许进入 SDK/transport；`--dry-run` 仍优先于确认且不发请求。
- 读操作和普通写操作不应被错误要求确认。

**Step 2: Run the focused tests**

```bash
npm --workspace=wjx-cli run build
node --test wjx-cli/__tests__/risk-confirmation.test.mjs
```

Expected: 当前基线下 focused test 预期 FAIL，因为命令没有统一风险元数据；完成实现后 Step 4 必须 PASS，禁止提交红态。

**Step 3: Implement risk and confirmation**

1. 在 `command-metadata.ts` 为每个现有 action 声明 `path`、`risk`、支持身份和目标摘要字段；默认缺失风险必须视为 `write` 或在 strict mode 下拒绝注册，不能默认为 read。
2. `risk.ts` 使用闭合枚举 `read < write < high-risk-write`，提供 `requiresConfirmation(spec, invocation)`。
3. `policy.ts` 先定义 `PolicyDecision`、`PolicyEvaluator` 和默认 allow 实现；本任务不读取远端权限，也不假设 Task 8 的完整规则已经存在。
4. 根命令新增 `--yes` 和 `--non-interactive`；交互确认读取受控 `Input`，不直接散落在业务命令中。
5. confirmation gate 放在 `Execute` 之前，并把 `confirmation_source` 标为 `cli_yes`、`interactive`、`policy` 或 `missing`；默认 allow 只表示未配置额外策略，不跳过 high-risk confirmation。
6. 统一记录 `command/profile/identity/target/risk/confirmation_source` 的审计字段；敏感值只保留 hash 或掩码。

**Step 4: Verify the gate**

```bash
npm --workspace=wjx-cli run build
node --test wjx-cli/__tests__/risk-confirmation.test.mjs
npm --workspace=wjx-cli test
npm --workspace=wjx-cli run perf:startup -- --report
```

Expected: 未确认高风险命令请求数为 `0`；显式 `--yes`、已有读命令、focused/full test 均 PASS；report 记录本任务的启动增量，不执行强制阈值。

**Step 5: Commit**

```bash
git add wjx-cli/src/lib/runtime/risk.ts wjx-cli/src/lib/runtime/confirmation.ts wjx-cli/src/lib/command-metadata.ts wjx-cli/src/lib/command-helpers.ts wjx-cli/src/index.ts wjx-cli/src/commands wjx-cli/__tests__/risk-confirmation.test.mjs
git commit -m "feat(cli): add risk metadata and confirmation gate"
```

### Task 4: 建立 Profile 和可注入凭据边界

**Files:**
- Create: `wjx-cli/src/lib/profiles.ts`
- Create: `wjx-cli/src/lib/credential-provider.ts`
- Modify: `wjx-cli/src/lib/config.ts:1-49`
- Modify: `wjx-cli/src/lib/auth.ts:1-14`
- Modify: `wjx-cli/src/commands/diagnostics.ts`
- Modify: `wjx-cli/src/index.ts`
- Test: `wjx-cli/__tests__/profile-auth.test.mjs`

**Step 1: Write the failing tests**

- env > explicit profile > default profile 的优先级稳定；旧 `.wjxrc` 仅作为隔离的读取回退，不参与新 Runtime/输出协议。
- `--profile name` 能切换 API key/base URL/corp id，诊断输出只显示掩码。
- credential provider 可被测试注入；命令代码不直接依赖 `process.env.WJX_API_KEY`。
- profile 只负责 endpoint、corp id 和 credential reference；不在本任务实现 scope 强制预检、远程权限探测或 OS Keychain。
- 配置文件写入采用临时文件 + rename，权限为用户可读；secret 由 provider 管理，配置文件只保存引用或受控本地凭据。

**Step 2: Run the focused tests**

```bash
npm --workspace=wjx-cli run build
node --test wjx-cli/__tests__/profile-auth.test.mjs
```

Expected: 当前基线下 focused test 预期 FAIL，因为只有单一 API key/env/config；完成实现后 Step 4 必须 PASS，禁止提交红态。

**Step 3: Implement provider boundaries**

1. `profiles.ts` 定义 profile 文件格式、选择和优先级；保留旧 `.wjxrc` 读取作为低风险输入回退，但新写入只使用 profile 格式，不让旧配置形状进入 Runtime。
2. `credential-provider.ts` 定义 `CredentialProvider.get(profile, identity)`；默认只提供 env/file provider，OS Keychain 留作后置 provider，不让命令感知存储方式。
3. `auth.ts` 只负责把 invocation 转成 provider 请求和脱敏诊断，不再直接读取全局 env。
4. `diagnostics` 增加 profile、身份和 endpoint 检查，禁止打印 API key、Authorization、完整路径中的敏感参数。
5. 为后续 `RuntimeContext` 输出一个不可变的 resolved profile/credential 引用；credential 原文只在 Execute 所需的 transport 边界短暂可见。

**Step 4: Verify profile and auth isolation**

```bash
npm --workspace=wjx-cli run build
npm --workspace=wjx-cli test
npm --workspace=wjx-cli run perf:startup -- --report
```

Expected: profile/auth 测试 PASS；没有凭据时返回统一 authentication problem，诊断输出不泄露 secret；report 记录本任务的启动增量，不执行强制阈值。

**Step 5: Commit**

```bash
git add wjx-cli/src/lib/profiles.ts wjx-cli/src/lib/credential-provider.ts wjx-cli/src/lib/config.ts wjx-cli/src/lib/auth.ts wjx-cli/src/commands/diagnostics.ts wjx-cli/src/index.ts wjx-cli/__tests__/profile-auth.test.mjs
git commit -m "feat(cli): add profiles and credential provider boundary"
```

### Task 5: 建立 RuntimeContext、统一错误和输出协议

**Files:**
- Create: `wjx-cli/src/lib/runtime/context.ts`
- Create: `wjx-cli/src/lib/runtime/result.ts`
- Create: `wjx-cli/src/lib/runtime/streams.ts`
- Modify: `wjx-cli/src/lib/runtime/executor.ts`
- Modify: `wjx-cli/src/lib/output.ts:1-145`
- Modify: `wjx-cli/src/lib/errors.ts:1-70`
- Modify: `wjx-cli/src/lib/command-helpers.ts`
- Modify: `wjx-cli/src/index.ts:75-105`
- Modify: `wjx-cli/__tests__/cli.test.mjs`（只迁移统一 envelope/退出码断言，不在本任务重写命令行为）
- Test: `wjx-cli/__tests__/protocol.test.mjs`

**Step 1: Write the failing tests**

使用本地 HTTP fixture 覆盖：

- 将 Task 1 中标记为 TODO 的结构化输出、错误和 unknown-command 断言全部提升为活动断言；同步更新 `wjx-cli/__tests__/cli.test.mjs` 的协议断言。
- `json output contains ok/data/meta`：默认 JSON 直接输出稳定 `ResultEnvelope` 和命令元数据。
- `human format is a projection of the same result`：`pretty/table` 只负责呈现，不生成第二种机器协议。
- `formatters agree on records`：同一数据的 JSON、pretty、table、NDJSON、CSV 记录集合一致。
- `removed format aliases fail clearly`：`--json`/`--table` 不出现在任何帮助中，调用时返回 `INPUT_ERROR`；`--format json`/`--format table` 是唯一格式入口。
- `errors preserve upstream fields`：WJX `result=false` 的 `errorcode`、`errormsg`、trace id 被保留。
- `stdout and stderr are separated`：正常结果不混入诊断；错误不污染 stdout。
- `control characters and ANSI are sanitized`：标题、表格单元格和错误提示中的控制字符不会改变终端结构。

**Step 2: Run the focused tests**

```bash
npm --workspace=wjx-cli run build
node --test wjx-cli/__tests__/protocol.test.mjs
```

Expected: 当前基线下 focused test 预期 FAIL，因为 output 只有 JSON/table 且没有统一 envelope；完成实现后 Step 4 必须 PASS，禁止提交红态。

**Step 3: Implement the shared runtime and protocol**

1. `context.ts` 持有已解析的 profile、credential provider、transport、FileIO、IO streams、logger、默认 allow 的 `PolicyDecision` 和 request budget；命令不再读取全局环境来完成横切工作。
2. `executor.ts` 固定调用顺序，并禁止 handler 直接输出或退出进程；Task 2 的内部 facade 只能调用这里的生命周期。
3. `result.ts` 定义 `ResultEnvelope`、`ProblemEnvelope`、partial result 和 dry-run envelope；WJX 原始 `result/data/errormsg/errorcode/traceid` 作为 `meta.upstream` 或 error fields 保留，不维护旧顶层协议。
4. `errors.ts` 将错误归类为 `validation`、`authentication`、`authorization`、`config`、`network`、`api`、`policy`、`confirmation`、`internal`，错误对象带 `subtype`、`retryable`、`retry_after`、`trace_id` 和 `hint`。
5. `output.ts` 增加唯一的 `--format <json|pretty|table|ndjson|csv>` formatter 路由；`json` 默认输出 `ResultEnvelope`，`pretty/table` 是人类投影，`ndjson/csv` 是稳定记录流。`--json`/`--table` 不作为语法别名注册；分页进度和诊断事件走 stderr，结果记录始终走 stdout。
6. unknown command、help、version 和 formatter failure 必须通过 root lifecycle 映射稳定 exit code，不能让 Commander 隐式 `exit 0`。

**Step 4: Verify protocol behavior**

```bash
npm --workspace=wjx-cli run build
node --test wjx-cli/__tests__/protocol.test.mjs wjx-cli/__tests__/output.test.mjs wjx-cli/__tests__/cli.test.mjs
npm --workspace=wjx-cli test
npm --workspace=wjx-cli run perf:startup -- --report
```

Expected: 新协议测试和全量测试 PASS；命令测试统一断言新 envelope，错误 stderr 仍是合法 `ProblemEnvelope`；report 记录本任务的启动增量，不执行强制阈值。

**Step 5: Commit**

```bash
git add wjx-cli/src/lib/runtime wjx-cli/src/lib/output.ts wjx-cli/src/lib/errors.ts wjx-cli/src/lib/command-helpers.ts wjx-cli/src/index.ts wjx-cli/__tests__
git commit -m "refactor(cli): centralize runtime result and error protocols"
```

### Task 5b: 在 Runtime 切换后立即同步协议消费者

Task 5 一旦让 CLI 默认输出新 envelope，仓库中的 Skill、Agent 卡和正式 CLI 参考就必须同步；否则后续 Task 6-8 期间会出现“CLI 已输出 `ok`，下游仍按 `result` 解析”的撕裂状态。本任务紧跟 Task 5 执行，先同步协议语义，不等待全部命令迁移完成。

**Files:**
- Create: `wjx-cli/__tests__/protocol-consumers.test.mjs`
- Create: `wjx-cli/scripts/lib/protocol-scan.mjs`（测试和发布门禁共用的扫描规则与例外表）
- Modify: `wjx-skills/wjx-cli-use/SKILL.md`
- Modify: `wjx-skills/wjx-cli-use/references/response-commands.md`
- Modify: `wjx-skills/wjx-cli-use/references/survey-commands.md`
- Modify: `wjx-skills/wjx-survey-ppt/SKILL.md`
- Modify: `wjx-agents/wjx-cli-expert/wjx-cli-expert.md`
- Modify: `.claude/agents/wjx-cli-expert.md`
- Modify: `wjx-docs/reference/cli.md`, `wjx-docs/start/cli.md`, `wjx-docs/migration.md` 和受影响的 `wjx-docs/tasks/*.md`
- Generated: `wjx-cli/bundled/*`（通过现有 `sync-bundled` 生成）

**Step 1: Write the failing contract test**

`protocol-scan.mjs` 集中声明扫描文件清单、旧协议匹配规则和 migration 文档允许的旧协议例外，并导出给 `protocol-consumers.test.mjs` 和 Task 9c 的 `check-protocol-contract.mjs` 使用。扫描禁止将 `"result": true/false` 当作当前协议，要求成功数据位于 `ok/data`、失败位于 `ok/error`。`wjx-docs/migration.md` 中明确标注的“迁移前/旧版本”代码块可以保留旧形状；CLI surface 测试还检查 `--json`/`--table` 不出现在帮助中且调用返回 `INPUT_ERROR`。

**Step 2: Run the focused test**

```bash
node --test wjx-cli/__tests__/protocol-consumers.test.mjs
```

Expected: 现有 Skill、Agent 卡或正式文档中的旧活动示例使测试 FAIL；失败输出文件和行号。

**Step 3: Synchronize canonical consumers**

1. 将 `wjx-cli-use` 的成功/失败示例改为 `ok/data`、`ok/error`，并明确 `data` 内业务字段语义不变。
2. 将 `wjx-survey-ppt/SKILL.md` 中所有 CLI 示例改用 canonical `--format json`；不得再说明或使用 `--json`/`--table` 别名，保留 `answer_valid`、`total_count` 等位于 `data` 下的字段路径。
3. 更新两个 Agent 卡和 `wjx-docs` 的当前协议说明；旧形状只放在迁移章节并明确标注，不把过程记录写入正式文档。
4. 运行现有 `npm --workspace=wjx-cli run sync-bundled` 生成 bundled 副本，禁止手工编辑 `wjx-cli/bundled/*`。

**Step 4: Verify the repository remains self-consistent**

```bash
node --test wjx-cli/__tests__/protocol-consumers.test.mjs
npm --workspace=wjx-cli run sync-bundled
npm run docs:build
npm run docs:check
```

Expected: 协议消费者测试、bundled 同步和文档检查全部 PASS；从此 Task 6-8 的每个提交都基于同一份活动协议。

**Step 5: Commit**

```bash
git add wjx-cli/__tests__/protocol-consumers.test.mjs wjx-cli/scripts/lib/protocol-scan.mjs wjx-skills wjx-cli/bundled wjx-agents .claude/agents wjx-docs
git commit -m "docs(cli): sync downstream consumers to result envelope"
```

### Task 6: 统一分页、重试预算和文件流

**Files:**
- Create: `wjx-cli/src/lib/runtime/pagination.ts`
- Create: `wjx-cli/src/lib/runtime/retry.ts`
- Create: `wjx-cli/src/lib/runtime/fileio.ts`
- Modify: `wjx-cli/src/lib/runtime/context.ts`
- Modify: `wjx-cli/src/lib/output.ts`
- Modify: `wjx-cli/src/commands/survey.ts:31-65,373-390`
- Modify: `wjx-cli/src/commands/response.ts:50-137`
- Modify: `wjx-api-sdk/src/core/types.ts`
- Modify: `wjx-api-sdk/src/core/api-client.ts:63-167`（只做向后兼容的增量扩展）
- Inspect/Modify if needed: `wjx-mcp-server/src/core/api-client.ts`、`wjx-mcp-server/src/index.ts`（仅做类型适配，不改变 MCP 对外工具行为）
- Test: `wjx-cli/__tests__/transport-contract.test.mjs`
- Test: `wjx-api-sdk/__tests__/transport-contract.test.mjs`
- Test: `wjx-mcp-server/__tests__/transport-contract.test.mjs`

**Step 1: Write the failing tests**

- `survey list --page-all` 聚合多页且保留原筛选条件。
- cursor 缺失、重复 cursor、最大页数和取消信号会可预测失败。
- 429/5xx 按预算重试，4xx 不重试；`retry_after` 被保留。
- NDJSON/CSV 可以逐页输出；后续页失败时 stdout 保留已输出记录且进程返回非零。
- `survey upload` 支持 `--file @path`/stdin 意图，`response download --output` 使用临时文件 + rename，禁止半写文件。
- 响应体和重试次数有上限，大文件测试不要求完整 Base64 常驻内存。
- SDK 默认 transport 行为保持不变；MCP Server 继续通过 SDK 获得默认超时/重试，不因 CLI 的 runtime budget 改动而静默失去重试。

**Step 2: Run the focused tests**

```bash
npm --workspace=wjx-api-sdk run build
npm --workspace=wjx-cli run build
node --test wjx-cli/__tests__/transport-contract.test.mjs wjx-api-sdk/__tests__/transport-contract.test.mjs wjx-mcp-server/__tests__/transport-contract.test.mjs
```

Expected: 当前基线下 focused test 预期 FAIL，因为 list/query 只执行单页且没有统一 FileIO/budget contract；完成实现后 Step 4 必须 PASS，禁止提交红态。

**Step 3: Implement bounded runtime services and additive SDK transport options**

实现以下边界：

1. `pagination.ts` 定义 `PageStrategy`，至少支持 `page_index/page_size` 和 `next_token` 两种形状；统一选项为 `--page-all`、`--page-limit`、`--page-delay`，默认有最大页数/项目数预算。
2. 分页结果 meta 包含 `complete/pages/items/next_token`；JSON 聚合后输出，NDJSON/CSV/table 可流式输出。
3. `retry.ts` 负责把 timeout、429、5xx、网络错误归一化，并把调用预算转换为 SDK 的可选 `RequestOptions.retryBudget`；CLI 不在 SDK 外再包一层实际重试，避免倍增。SDK 未收到该选项时保持原有默认重试行为。
4. `fileio.ts` 提供 `readInput`、`writeAtomic`、`openUploadStream`、`safeOutputPath`；命令只声明文件意图，不直接拼接临时文件。
5. `wjx-api-sdk` 只增加可选的 `RequestOptions.retryBudget`、请求 trace 上下文和响应 `meta`（字段名按现有 SDK 类型落地）；options 必须是尾部可选参数或 transport 配置，现有三参数 SDK 调用无需修改，默认超时、重试和错误行为不变。
6. `wjx-mcp-server` 继续使用 SDK 默认 transport；若为类型适配修改 re-export，只做兼容性变更，并新增回归测试证明 429/5xx 仍按 SDK 默认策略重试。
7. 分页策略只在 CLI Runtime/Catalog 声明，不硬编码进通用 SDK。

**Step 4: Verify transport limits and the unified command contract**

```bash
npm --workspace=wjx-api-sdk test
npm --workspace=wjx-mcp-server run build
npm --workspace=wjx-mcp-server test
npm --workspace=wjx-cli test
npm --workspace=wjx-cli run perf:startup -- --report
```

Expected: transport contract、分页、部分失败和文件原子写入测试 PASS；CLI 的 `survey list`/`response query` 分页策略由 Runtime 显式声明，SDK/MCP 默认重试回归保持通过；report 记录本任务的启动增量，不执行强制阈值。

**Step 5: Commit**

```bash
git add wjx-cli/src/lib/runtime wjx-cli/src/lib/output.ts wjx-cli/src/commands/survey.ts wjx-cli/src/commands/response.ts wjx-cli/__tests__/transport-contract.test.mjs wjx-api-sdk/src/core/types.ts wjx-api-sdk/src/core/api-client.ts wjx-api-sdk/__tests__ wjx-mcp-server/__tests__/transport-contract.test.mjs
git commit -m "feat(cli): add bounded pagination retry and file transport"
```

### Task 7: 建立 API Catalog、Schema 和 WJX Raw API

**Files:**
- Create: `wjx-cli/src/catalog/types.ts`
- Create: `wjx-cli/src/catalog/catalog.ts`
- Create: `wjx-cli/src/catalog/loader.ts`
- Create: `wjx-cli/src/catalog/schema.ts`
- Create: `wjx-cli/src/commands/api.ts`
- Create: `wjx-cli/src/commands/schema.ts`
- Modify: `wjx-cli/src/index.ts`
- Modify: `wjx-api-sdk/src/core/constants.ts`（将 Action 作为 Catalog 的来源并由 Catalog 校验；不增加第二套兼容映射）
- Test: `wjx-cli/__tests__/catalog.test.mjs`
- Test: `wjx-cli/__tests__/raw-api.test.mjs`

**Step 1: Write the failing tests**

- `catalog has deterministic service/action ordering`：同一 Catalog 多次序列化字节一致。
- `schema exposes input body response risk and pagination`：`wjx schema survey.list` 和 `wjx schema --action 1000002` 返回机器可消费结构。
- `raw api calls a known WJX action through shared runtime`：`wjx api --service default --action 1000002 --params '{...}' --dry-run` 只输出请求计划；执行模式复用 profile、risk、retry 和 output。
- `raw api rejects unsafe service/action/path input`：不允许任意外部 URL、header 注入或未声明服务；unknown action 返回非零和恢复提示。
- `shortcut and catalog metadata agree`：现有 `survey list` 的 action、risk、输入字段与 Catalog 一致。

**Step 2: Run the focused tests**

```bash
npm --workspace=wjx-cli run build
node --test wjx-cli/__tests__/catalog.test.mjs wjx-cli/__tests__/raw-api.test.mjs
```

Expected: 当前基线下 focused test 预期 FAIL，因为没有 Catalog、schema 或 Raw API；完成实现后 Step 4 必须 PASS，禁止提交红态。

**Step 3: Implement the WJX-native catalog**

Catalog 最小字段为：

```typescript
export interface ActionCatalogEntry {
  id: string;
  command?: string;
  service: "default" | "user-system" | "subuser" | "contacts";
  action: string;
  input: JsonSchema;
  response?: JsonSchema;
  risk: RiskLevel;
  identities: Array<"user" | "bot" | "unknown">;
  scopes?: string[];
  pagination?: PageStrategy;
  file?: FileIntent;
  retry?: RetryPolicy;
  output?: {
    defaultFormat: "json" | "pretty" | "table" | "ndjson" | "csv";
    supportsStreaming?: boolean;
  };
}
```

实现顺序：

1. 先把 `wjx-api-sdk/src/core/constants.ts` 的 Action 和当前 Shortcut 映射录入一个版本化 TypeScript Catalog，所有 map/list 在导出前按名称排序；Catalog 是唯一 action 事实源。
2. `loader.ts` 负责内置 Catalog、版本和校验；不在导航模块里混入 policy 判断。
3. `schema.ts` 将 Catalog 投影为命令输入/响应/风险/身份/分页 Schema；以后可由同一投影生成 MCP Tool Schema 和 completion。
4. `api.ts` 使用 WJX 真实协议：`--service`、`--action`、`--params <json|@file|->`、`--body <json|@file|->`，不接受绝对 URL；输出通过 RuntimeContext 和 formatter。
5. `schema.ts` 命令支持 command path、action id 和 service 三种查询入口；unknown 候选只来自最终可见 Catalog。

`catalog.ts`/TypeScript metadata 是唯一运行时真源；`wjx-cli/manifest/commands.json` 只由 `export-manifest.mjs` 从 Catalog、Shortcut metadata 和最终 surface 派生，用于 CI 漂移检查、发布审计和 review，不由 CLI 启动或 `schema`/completion 运行时读取。若未来需要把 manifest 作为运行时数据源，必须另立需求并重新评估启动性能，不在本计划内实现。

**Step 4: Verify new-action coverage without a Shortcut**

```bash
npm --workspace=wjx-cli run build
node --test wjx-cli/__tests__/catalog.test.mjs wjx-cli/__tests__/raw-api.test.mjs
npm --workspace=wjx-cli test
npm --workspace=wjx-cli run perf:startup -- --report
```

Expected: Catalog/Schema/Raw API 测试和全量测试 PASS；新增一个 fixture action 只需增加 Catalog 条目即可通过 Raw API 调用，不需注册新业务命令；report 记录 Catalog 加载后的启动增量，不执行强制阈值。

**Step 5: Commit**

```bash
git add wjx-cli/src/catalog wjx-cli/src/commands/api.ts wjx-cli/src/commands/schema.ts wjx-cli/src/index.ts wjx-api-sdk/src/core/constants.ts wjx-cli/__tests__
git commit -m "feat(cli): add action catalog schema and raw api"
```

### Task 8: 最小 Surface、Policy 和 Affordance 治理

**Files:**
- Create: `wjx-cli/src/lib/surface.ts`
- Modify: `wjx-cli/src/lib/policy.ts`（在 Task 3 默认 allow 接口上填充静态规则实现）
- Create: `wjx-cli/src/lib/affordance.ts`
- Modify: `wjx-cli/src/commands/reference.ts`
- Modify: `wjx-cli/src/commands/skill.ts`
- Modify: `wjx-cli/src/index.ts`
- Test: `wjx-cli/__tests__/surface-policy.test.mjs`

**Step 1: Write the failing tests**

- Surface 投影只有 `available`、`denied-visible`、`concealed` 三种稳定状态；help、schema、completion、unknown-command 候选使用同一投影。
- Policy 支持 command glob、最大风险、identity 和“是否允许未标注风险”四轴；拒绝时返回 policy source/rule/reason，而不是静默删除。
- Skill/Affordance 引用不存在的 command 时不显示失效指针；Skill 内容不改变命令可执行权限。
- policy/surface 的实现不会引入插件加载器、动态脚本执行或新的网络入口；后置扩展只能在不改变 Runtime 边界的前提下另立需求。

**Step 2: Run the focused tests**

```bash
npm --workspace=wjx-cli run build
node --test wjx-cli/__tests__/surface-policy.test.mjs
```

Expected: 当前基线下 focused test 预期 FAIL，因为 completion/reference/skill 与命令注册分散；完成实现后 Step 4 必须 PASS，禁止提交红态。

**Step 3: Implement the governance boundaries**

1. `surface.ts` 在 Build 阶段把 Catalog、Shortcut 和 builtin 投影成最终可见 command tree；禁止 Execute 阶段才发现命令被禁用。
2. `policy.ts` 归一化静态配置规则，按 AND 计算约束、按 OR 计算多条授权；deny 使用 typed error/stub，保留可诊断原因。
3. `affordance.ts` 只加载“何时使用、前置条件、示例和关联 Skill”，不重复字段 Schema，也不充当权限开关。
4. 外部扩展不在本任务实现；若未来需要插件，必须另行定义 command/credential/fileio/transport/platform contract，并通过独立安全评审后接入，不得把插件治理和首轮 Runtime 改造捆绑。

**Step 4: Verify governance and extension isolation**

```bash
npm --workspace=wjx-cli test
npm --workspace=wjx-cli run perf:startup -- --report
```

Expected: 被 conceal/deny 的命令不会出现在 completion/schema 候选；Skill 不改变命令权限，policy 原因可机器读取；全量测试和 report 均 PASS，report 记录 Surface/Policy 投影后的启动增量。

**Step 5: Commit**

```bash
git add wjx-cli/src/lib/surface.ts wjx-cli/src/lib/policy.ts wjx-cli/src/lib/affordance.ts wjx-cli/src/commands/reference.ts wjx-cli/src/commands/skill.ts wjx-cli/src/index.ts wjx-cli/__tests__
git commit -m "feat(cli): add minimal policy surface and affordance governance"
```

### Task 9a: Manifest、静态架构门禁和启动性能门禁

**Files:**
- Create: `wjx-cli/scripts/export-manifest.mjs`
- Create: `wjx-cli/scripts/check-architecture-contract.mjs`
- Create: `wjx-cli/manifest/commands.json`（由脚本生成，不手工编辑）
- Modify: `wjx-cli/scripts/benchmark-startup.mjs`（将 Task 1 的采集工具升级为门禁脚本）
- Modify: `wjx-cli/perf/startup-baseline.json`（仅在明确批准的新基线流程中更新）
- Create: `wjx-cli/__tests__/manifest.test.mjs`
- Modify: `wjx-cli/package.json`（先加入 manifest/architecture/perf 脚本，版本暂不升至 0.4.0）

**Step 1: Write the failing quality-gate tests**

`manifest.test.mjs` 和 `check-architecture-contract.mjs` 固定检查 command path 唯一、canonical path 稳定、source/risk/identity 已声明，Catalog action、Shortcut、manifest 和 SDK Action 导出无漂移，以及业务代码不直接写 stdout/stderr、调用 `process.exit` 或在 Normalize/Validate/DryRun 中调用 SDK 网络函数。

**Step 2: Verify startup report and seed approved environment baselines**

```bash
npm --workspace=wjx-cli run build
node wjx-cli/scripts/benchmark-startup.mjs --report
```

`benchmark-startup.mjs` 使用干净 Node 子进程执行固定 20 次裸 Node `-e ""` 和 20 次 `wjx --version`，各丢弃前 2 次预热，报告 p50/p95/min/max、Node 版本、平台、架构和 commit，并读取 Task 1 提交的 `startup-baseline.json`。门禁指标是同一次采样得到的 `deltaP95Ms = cliP95Ms - nodeP95Ms`，而不是绝对 CLI p95；基线条目按 `platform-arch-nodeMajor` 查找，允许使用经过审阅的 `default` 回退，但不能静默跳过。当前本机已有一次 12 次冷启动观测约 p95 177 ms、裸 Node 约 75 ms，该数字只作为现状参考；提交的基线必须用与门禁相同的 20/2 采样参数生成。

门禁规则：`deltaP95Ms` 不得超过匹配基线的 120%；优先使用 `platform-arch-nodeMajor` 条目，没有精确条目时必须明确命中经过审阅的 `default`，若两者都不存在则 enforce 失败并输出生成命令。Task 9a 启用 enforce 前确认 `default` 存在；Task 9c 的 Node 20/22 runner 首次运行可先使用该回退并记录实际 key，后续只有经过 review 的基线更新才能新增精确条目，不能在回归后直接重写基线掩盖变化。`--report` 永不因超阈值失败；本地可显式使用 `SKIP_PERF=1` 进行诊断，但 CI 和发布门禁不得设置该变量。若后续目标仍是 150 ms，应另立“懒加载命令/Catalog”优化任务，不把它伪装成当前架构任务的验收条件。

**Step 3: Implement manifest and static checks**

1. `export-manifest.mjs` 从 Catalog、Shortcut metadata、surface snapshot 生成排序稳定的 `manifest/commands.json`，禁止手工修改生成文件；`--check` 只在内存中生成并比较字节，不写回文件。
2. `check-architecture-contract.mjs` 先做 AST 级静态检查，再做轻量 manifest/schema 一致性检查；失败输出文件、行号和修复提示。
3. `package.json` 增加 `manifest:export`、`manifest:check`、`architecture:check`、`perf:startup`，保留 npm `files` 只有 `dist`、`bundled`；manifest 不作为运行时数据源，也不打入 npm 包，`perf/startup-baseline.json` 仅用于仓库/CI。本任务不引入协议消费者或版本发布改动。

**Step 4: Verify the gate**

```bash
npm --workspace=wjx-cli run build
npm --workspace=wjx-cli run manifest:export
git diff --exit-code -- wjx-cli/manifest/commands.json
npm --workspace=wjx-cli run manifest:check
npm --workspace=wjx-cli run architecture:check
npm --workspace=wjx-cli run perf:startup
npm --workspace=wjx-cli test
```

Expected: 首次生成的 manifest 仅包含预期内容；对于已存在并受版本控制的 manifest，`git diff --exit-code` 无意外改动；manifest:check、静态架构检查、性能相对基线门禁和全量测试 PASS。`manifest:export` 只在本 Task 首次生成或明确的 Catalog 变更后运行，后续 CI/发布检查不得先 export 再 check。

**Step 5: Commit**

```bash
git add wjx-cli/scripts/export-manifest.mjs wjx-cli/scripts/check-architecture-contract.mjs wjx-cli/scripts/benchmark-startup.mjs wjx-cli/manifest wjx-cli/perf wjx-cli/__tests__/manifest.test.mjs wjx-cli/package.json
git commit -m "ci(cli): add manifest architecture and startup gates"
```

### Task 9b: 分组迁移剩余 Shortcut 并消灭内部 facade

**Files:**
- Modify: `wjx-cli/src/commands/account.ts`
- Modify: `wjx-cli/src/commands/admin.ts`
- Modify: `wjx-cli/src/commands/analytics.ts`
- Modify: `wjx-cli/src/commands/completion.ts`
- Modify: `wjx-cli/src/commands/contacts.ts`
- Modify: `wjx-cli/src/commands/department.ts`
- Modify: `wjx-cli/src/commands/diagnostics.ts`
- Modify: `wjx-cli/src/commands/init.ts`
- Modify: `wjx-cli/src/commands/reference.ts`
- Modify: `wjx-cli/src/commands/response.ts`
- Modify: `wjx-cli/src/commands/skill.ts`
- Modify: `wjx-cli/src/commands/sso.ts`
- Modify: `wjx-cli/src/commands/survey.ts`
- Modify: `wjx-cli/src/commands/tag.ts`
- Modify: `wjx-cli/src/commands/update.ts`
- Modify: `wjx-cli/src/commands/user-system.ts`
- Modify: `wjx-cli/__tests__/cli.test.mjs` 及各命令 focused tests
- Generated: `wjx-cli/manifest/commands.json`

每个 Phase 都是独立的绿态提交；完成一个 Phase 后运行 `manifest:export`、`manifest:check` 和对应 focused/full test，再进入下一个 Phase。不要把四个 Phase 合并成一个提交。

Phase 与命令级文件映射如下；同一 `.ts` 文件可因命令边界跨多个 Phase，不能据此把整个文件一次性迁移：

- Phase A：`survey list/get/url/status/tags/tag-details/jsonl-template`、`response count/query/realtime/download/report/winners`、`user-system query-binding/query-surveys`、全部 `analytics` 只读/计算命令；主要修改 `survey.ts`、`response.ts`、`user-system.ts`、`analytics.ts`。
- Phase B：`survey create/update-settings/upload/export-text`、`response submit/submit-template`；旧的 `create-by-json`、`create-by-text` 已移除，不得重新注册；主要修改 `survey.ts`、`response.ts`。
- Phase C：`survey delete/clear-bin`、`response modify/clear`、`contacts add/delete`、`department add/modify/delete`、`admin add/delete/restore`、`account add/modify/delete/restore`、`tag add/modify/delete`、`user-system add-participants/modify-participants/delete-participants/bind`；主要修改 `survey.ts`、`response.ts`、`contacts.ts`、`department.ts`、`admin.ts`、`account.ts`、`tag.ts`、`user-system.ts`。
- Phase D：`completion`、`reference`、`skill`、`diagnostics`、`init`、`sso`、`update` 及剩余 builtin/安装辅助入口；同时删除内部 facade，并确认所有 public command 都有 manifest entry。

**Phase A: Read Shortcut**

迁移 `survey get/url`、`response query/count` 等 read 命令，复用 Task 5 的 envelope/退出码测试 helper，验证输入来源、分页策略和 stdout/stderr 分离。

```bash
npm --workspace=wjx-cli run manifest:export
npm --workspace=wjx-cli run manifest:check
npm --workspace=wjx-cli run perf:startup
npm --workspace=wjx-cli test
git add wjx-cli/src/commands/survey.ts wjx-cli/src/commands/response.ts wjx-cli/src/commands/analytics.ts wjx-cli/src/commands/user-system.ts wjx-cli/__tests__/cli.test.mjs wjx-cli/manifest/commands.json
git commit -m "refactor(cli): migrate read shortcuts to runtime"
```

**Phase B: Ordinary writes**

迁移 `survey create`、`response submit-template` 等普通写命令，验证纯请求准备、DryRun 和文件输入；旧的 `create-by-json` 与 `create-by-text` 不在迁移范围内。

```bash
npm --workspace=wjx-cli run manifest:export
npm --workspace=wjx-cli run manifest:check
npm --workspace=wjx-cli run perf:startup
npm --workspace=wjx-cli test
git add wjx-cli/src/commands/survey.ts wjx-cli/src/commands/response.ts wjx-cli/__tests__/cli.test.mjs wjx-cli/manifest/commands.json
git commit -m "refactor(cli): migrate ordinary writes to runtime"
```

**Phase C: High-risk and management writes**

迁移删除、清空和管理类命令，逐条补齐 risk、confirmation 和 policy 测试；未带 `--yes` 的非交互调用必须保持零网络。

```bash
npm --workspace=wjx-cli run manifest:export
npm --workspace=wjx-cli run manifest:check
npm --workspace=wjx-cli run perf:startup
npm --workspace=wjx-cli test
git add wjx-cli/src/commands/survey.ts wjx-cli/src/commands/response.ts wjx-cli/src/commands/contacts.ts wjx-cli/src/commands/department.ts wjx-cli/src/commands/admin.ts wjx-cli/src/commands/account.ts wjx-cli/src/commands/tag.ts wjx-cli/src/commands/user-system.ts wjx-cli/__tests__/cli.test.mjs wjx-cli/manifest/commands.json
git commit -m "refactor(cli): migrate guarded management commands"
```

**Phase D: Remaining surfaces**

迁移剩余 Shortcut、Raw API、completion/reference/skill 注册，并删除内部 facade；确认所有 public command 都有 manifest entry。

```bash
npm --workspace=wjx-cli run manifest:export
npm --workspace=wjx-cli run manifest:check
npm --workspace=wjx-cli run perf:startup
npm --workspace=wjx-cli test
git add wjx-cli/src/commands/completion.ts wjx-cli/src/commands/reference.ts wjx-cli/src/commands/skill.ts wjx-cli/src/commands/diagnostics.ts wjx-cli/src/commands/init.ts wjx-cli/src/commands/sso.ts wjx-cli/src/commands/update.ts wjx-cli/src/commands/survey.ts wjx-cli/src/commands/response.ts wjx-cli/src/commands/user-system.ts wjx-cli/src/lib/command-helpers.ts wjx-cli/__tests__/cli.test.mjs wjx-cli/manifest/commands.json
git commit -m "refactor(cli): remove legacy command facade"
```

### Task 9c: 生态协议门禁与 `0.4.0` 发布

**Files:**
- Create: `wjx-cli/scripts/check-protocol-contract.mjs`
- Create: `wjx-cli/scripts/check-release-artifacts.mjs`
- Create: `.github/workflows/cli.yml`
- Modify: `wjx-cli/scripts/sync-bundled.mjs`（增加 `--check`，继续以真源生成 bundled）
- Modify: `wjx-cli/__tests__/sync-bundled.test.mjs`（覆盖 `--check` 无删除/复制副作用）
- Modify: `wjx-cli/package.json`（版本升至 `0.4.0`，补齐 sync/protocol/release scripts）
- Modify: `package-lock.json`
- Modify: `wjx-cli/README.md`（记录一次性切换后的唯一命令/输出协议）
- Modify: `wjx-cli/CLAUDE.md`（更新命令实现边界和 Runtime/协议约束）
- Modify: `wjx-cli/CHANGELOG.md`（记录 `0.4.0` breaking change）
- Inspect/Modify only if a final command migration changed its examples: `wjx-skills/wjx-cli-use/SKILL.md`, `wjx-skills/wjx-cli-use/references/response-commands.md`, `wjx-skills/wjx-cli-use/references/survey-commands.md`, `wjx-skills/wjx-survey-ppt/SKILL.md`
- Generated/verify: `wjx-cli/bundled/*`（只由 `sync-bundled` 生成，不手工编辑）
- Inspect/Modify only if final command references changed: `wjx-agents/wjx-cli-expert/wjx-cli-expert.md`, `.claude/agents/wjx-cli-expert.md`
- Modify: `wjx-docs/reference/cli.md`、`wjx-docs/start/cli.md`、`wjx-docs/tasks/` 下受影响任务文档、`wjx-docs/migration.md`

当前仓库没有独立的 Python CLI 解析器或对应协议测试文件；不要为不存在的解析器创建占位路径。`wjx-survey-ppt` 对 CLI 的消费写在 `SKILL.md` 的散文指令中；外部 `D:/__code/ppt-master-survey` 若存在独立解析逻辑，另立跨仓库协调需求。

**Step 1: Write the failing release, protocol and sync checks**

`check-protocol-contract.mjs` 只调用 Task 5b 创建的 `scripts/lib/protocol-scan.mjs`，与 `protocol-consumers.test.mjs` 共用同一份扫描文件清单、旧协议规则和 migration 例外，扫描 Skill 真源、bundled 副本、Agent 卡和正式 CLI 文档，禁止活动示例残留顶层 `"result": true/false` 或旧错误对象；`wjx-docs/migration.md` 中明确标注的“旧版本/迁移前”代码块可以保留旧形状。`check-release-artifacts.mjs` 检查 `npm pack` tarball 的固定依赖范围、包版本关系和 bundled 内容；CLI 发布包必须固定 `wjx-api-sdk: "^0.4.0"`，不得用 npm 上仍为 0.3.x 的旧 SDK 冒充当前 workspace。

```bash
node wjx-cli/scripts/check-protocol-contract.mjs
node wjx-cli/scripts/check-release-artifacts.mjs
node --test wjx-cli/__tests__/sync-bundled.test.mjs
```

Expected: 在同步前，旧活动示例或尚未固定的发布产物使检查 FAIL；新增的 `--check` 无副作用测试在实现前因缺少纯比较路径而 FAIL；失败输出文件、行号和修复提示。

**Step 2: Revalidate sources and apply only final command-reference deltas**

1. 运行 `protocol:check`，确认 Task 5b 已同步的 `ok/data`、`ok/error` 语义没有被命令迁移重新写成旧形状。
2. 仅修正 Task 9b 新增或变更的命令示例；`wjx-survey-ppt/SKILL.md` 的所有 CLI 调用继续使用 canonical `--format json`，保留 `answer_valid`、`total_count` 等 `data` 下字段路径，不再记录已移除的 `--json`/`--table` 别名。
3. 将 `sync-bundled.mjs` 的当前单体 `syncDir()` 拆为 `collectSourceSnapshot()`、`collectBundleSnapshot()`、`compareSnapshots()` 和执行同步的 `syncDir()`；目录和单文件 target 都先通过 snapshot/compare 实现 `--check`，并导出 snapshot/compare helper 供测试使用。`main()` 根据 `--check` 选择纯比较或执行路径；`--check` 只能比较文件集合与内容 hash，不能调用 `rmSync`、`copyFileSync` 或 `copyDirRecursive`。两种模式都必须先验证 source 存在、类型正确和 `MIN_SOURCE_FILES` 护栏；该护栏必须仍在任何删除操作之前，重构不得调换该顺序。
4. 运行 `npm --workspace=wjx-cli run sync-bundled` 生成最终 bundled，再用 `sync-bundled:check` 验证真源一致性；禁止手工编辑 `wjx-cli/bundled/*`。

**Step 3: Wire release scripts and CI**

在 `wjx-cli/package.json` 增加：

```json
{
  "scripts": {
    "sync-bundled:check": "node scripts/sync-bundled.mjs --check",
    "manifest:export": "node scripts/export-manifest.mjs",
    "manifest:check": "node scripts/export-manifest.mjs --check",
    "architecture:check": "node scripts/check-architecture-contract.mjs",
    "protocol:check": "node scripts/check-protocol-contract.mjs",
    "perf:startup": "node scripts/benchmark-startup.mjs",
    "release:check": "npm run sync-bundled:check && npm run build && npm run manifest:check && node scripts/check-release-artifacts.mjs"
  }
}
```

`prepublishOnly` 的实际顺序固定为 `npm run sync-bundled && npm run release:check`，展开后严格是 `sync-bundled -> sync-bundled:check -> build -> manifest:check -> npm pack --ignore-scripts -> tarball 校验`；其中 `sync-bundled:check` 在发布流程中只是无害的同构确认，真实价值在 CI 和本地手工验证。`release:check` 不得调用 `manifest:export`，否则会先覆盖被 git 跟踪的 manifest、让漂移检查永远通过并使 `npm publish` 意外改脏工作区。`check-release-artifacts.mjs` 在临时 staging 副本中使用已固定的 `^0.4.0` SDK 依赖运行 `npm pack --ignore-scripts`，并额外执行 `reference question-types` smoke，避免 `prepublishOnly -> release:check -> npm pack -> prepublishOnly` 递归，只检查 tarball，不修改开发态依赖。staging 必须复制改写后的 `package.json`、已构建的 `dist/`、已同步的 `bundled` 和 npm 默认收录文件；检查必须断言 tarball 含 `dist/index.js`，且不含 `manifest/`、`perf/` 或 `src/`。由于 manifest 是审计快照而非运行时数据源，tarball 应包含 `dist` 和 `bundled`。`.github/workflows/cli.yml` 使用 Node 20/22 矩阵，先构建 `wjx-api-sdk` 与 `wjx-mcp-server`，再构建 `wjx-cli`，然后严格按 `sync-bundled:check -> manifest:check -> architecture:check -> protocol:check -> perf:startup -> release:check` 执行门禁；`release:check` 之后再执行 SDK/MCP/CLI test，先运行 `docs:check` 做只读一致性校验，再运行 `docs:build` 生成验证产物，禁止在这些检查之前运行 `manifest:export`。真实 API 不进入 CI，统一用 HTTP fixture。

`wjx-cli/CLAUDE.md` 中原有“不要过度抽象，每个命令的实现就是：解析参数 → 调 SDK → 输出结果”必须改写为新边界：命令声明 `CommandSpec`，统一经过 `prepare/validate/dry-run/confirm/execute/emitter` 生命周期；handler 不直接发请求、不直接写 stdout/stderr、不直接调用 `process.exit`，横切能力由 RuntimeContext、Catalog、Policy 和 formatter 提供。

**Step 4: Run the one-time release gate**

```bash
npm --workspace=wjx-cli run sync-bundled
npm --workspace=wjx-cli run sync-bundled:check
npm --workspace=wjx-cli run build
npm --workspace=wjx-cli run manifest:check
npm --workspace=wjx-cli run architecture:check
npm --workspace=wjx-cli run protocol:check
npm --workspace=wjx-cli run perf:startup
npm --workspace=wjx-cli run release:check
npm --workspace=wjx-api-sdk run build
npm --workspace=wjx-api-sdk test
npm --workspace=wjx-mcp-server run build
npm --workspace=wjx-mcp-server test
npm --workspace=wjx-cli test
npm run docs:build
npm run docs:check
```

Expected: 所有检查 PASS；`manifest:check` 直接验证当前受版本控制的 manifest 与 Catalog 投影无漂移；下游 Skill/Agent/文档与 bundled 一致；Node 20/22 CI 使用同一 fixture 结果；按顺序发布 `wjx-api-sdk@0.4.0`、`wjx-mcp-server@0.4.0`、`wjx-cli@0.4.0`。

**Step 5: Commit in two reviewable changes**

先提交 Task 9c 新增的协议扫描、bundled 检查实现，以及确实由 Task 6/7/8 最终命令变更引起的下游引用增量；Task 5b 已提交过的完整 Skill、Agent 卡、正式文档和 `protocol-consumers.test.mjs` 不得重复纳入本提交，提交前用 `git diff --name-only` 审阅真实变更文件：

```bash
git add wjx-cli/scripts/check-protocol-contract.mjs wjx-cli/scripts/sync-bundled.mjs wjx-cli/__tests__/sync-bundled.test.mjs wjx-cli/bundled
git commit -m "docs(cli): enforce downstream protocol contract"
```

若 Task 9b 确实改动了下游示例，只把 `git diff --name-only` 审阅后属于本次最终命令引用变化的具体文件追加到同一提交；不得再次按整个 `wjx-skills`、`wjx-agents`、`.claude/agents` 或 `wjx-docs` 目录整体暂存。

再提交发布脚本、版本、CI 和 CHANGELOG：

```bash
git add wjx-cli/scripts/check-release-artifacts.mjs wjx-cli/package.json package-lock.json wjx-cli/README.md wjx-cli/CLAUDE.md wjx-cli/CHANGELOG.md .github/workflows/cli.yml
git commit -m "release: publish unified architecture as 0.4.0"
```

## 4. 分阶段交付顺序

所有阶段都是同一发布变更集中的内部检查点，不单独发布三包；Task 5 的协议切换必须与紧随其后的 Task 5b 作为相邻提交（或同一 PR 的连续检查点）落地，避免共享分支长期处于 CLI 与下游契约不一致状态。只有 Task 9c 的生态同步和全部门禁通过后，才按 SDK → MCP Server → CLI 顺序发布 `0.4.0`。

| 阶段 | 包含任务 | 交付结果 | 允许的用户可见变化 |
| --- | --- | --- | --- |
| Phase 0 | Task 1-3 | 新协议基线、dry-run 零网络、高风险确认和默认 allow PolicyDecision | 不单独发布；固定测试契约和内部边界 |
| Phase 1 | Task 4-5 | profile/provider、RuntimeContext、错误/输出协议 | 不单独发布；完成统一 envelope 实现 |
| Phase 1b | Task 5b | 立即同步 Skill、Agent 卡、正式协议参考和 bundled | 不单独发布；恢复仓库自洽 |
| Phase 2 | Task 6 | 有界分页、重试预算、文件流和 SDK/MCP transport 回归 | 不单独发布；SDK 默认消费者行为不变 |
| Phase 3 | Task 7 | 静态 Catalog、Schema、WJX Raw API | 不单独发布；新增入口随最终版本发布 |
| Phase 4 | Task 8 | 最小 policy/surface、Affordance | 不单独发布；插件和强 scope 校验留后置需求 |
| Phase 5 | Task 9a | manifest 审计快照、静态架构门禁、启动性能门禁 | 不单独发布；建立后续迁移门禁 |
| Phase 6 | Task 9b | 按 Phase A-D 分组迁移 Shortcut 并删除内部 facade | 不单独发布；每组独立绿态提交 |
| Phase 7 | Task 9c | 生态协议门禁、发布产物校验、Node 20/22 CI 和版本升级 | 一次性发布统一版本 `0.4.0`，包含统一协议和全部新增入口 |

阶段依赖必须保持：

```text
Task 1 -> Task 2 -> Task 3 -> Task 4 -> Task 5 -> Task 5b -> Task 6 -> Task 7 -> Task 8 -> Task 9a -> Task 9b -> Task 9c
```

Task 3 只提供默认 allow 的 `PolicyDecision` 接口，Task 8 再实现完整规则，因此前置任务不依赖未完成的 policy；Task 4 先建立 Profile，Task 5 才创建持有它的 `RuntimeContext`。Task 5b 必须紧跟 Task 5，之后才能进入 Task 6；不能在 Task 5 的输出/错误契约和 Task 6 的 transport 边界尚未稳定前扩大 Raw API。首轮只实现静态、白名单 Catalog，不接远端动态元数据。

## 5. 实施时的审查清单

每个迁移提交都必须回答以下问题：

1. 新字段/别名的来源是否可区分 flag、stdin、文件和默认值？
2. Normalize/Validate/DryRun 是否能在没有 credentials 和 network client 的单元测试中运行？
3. risk、identity、scope、pagination、file、retry 是否位于同一 command spec/Catalog，而不是散落在 handler 文本里？
4. 拒绝、缺失权限、未确认和限流错误是否有稳定 subtype、退出码和恢复 hint？
5. stdout 是否仍然是纯结果流，stderr 是否没有混入成功数据？
6. Shortcut、Catalog、Raw API、MCP Schema、completion、Skill 引用是否共享同一 Catalog 投影，并由派生 manifest 做漂移校验？
7. 是否新增了与本任务无关的业务命令、文案或正式文档？若有，应拆分为独立需求。
8. 是否添加了回归测试，并运行了对应 workspace 的 build/test 和 `docs:check`？

## 6. 本次交付边界

本文件是独立的架构优化实施计划，建立在综合评审记录 `docs/plans/2026-08-26-wjx-cli-architecture-optimization.md` 之上，但不替代该评审记录，也不把评审过程复制到 `wjx-docs`。本次撰写只新增本计划文件，不修改 `wjx-cli`、`wjx-api-sdk`、`wjx-mcp-server` 源码或正式用户文档，不创建提交或推送；实施阶段必须按 Task 5b/Task 9c 修改受影响的 `wjx-docs`、Skill、Agent 卡和 bundled 内容，不能将本条误读为永久禁止同步正式文档。
