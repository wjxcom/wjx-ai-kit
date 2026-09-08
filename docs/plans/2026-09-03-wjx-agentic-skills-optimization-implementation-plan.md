# WJX Agentic Skills Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn wjx-cli-use and wjx-mcp-use into source-aligned Agent execution contracts so a novice can safely complete setup, survey creation, publication, response collection, analysis, and administration in WorkBuddy, Cowork, Codex Work, and Qianwen Work.

**Architecture:** Keep wjx-api-sdk as the business-logic source, wjx-skills/ as the canonical skill source, wjx-cli as the complete workstation surface, and wjx-mcp-server as the typed MCP business-tool surface. Extend existing CLI runtime modules for confirmation, risk, retry, request planning, pagination, and result envelopes. Generate Agent-facing capability artifacts from those sources instead of maintaining a second hand-written policy system.

**Tech Stack:** Markdown, JSON, TypeScript/ESM, Node.js 20+, node:test, Commander, MCP SDK, Zod, npm workspaces, and the existing capability/documentation/protocol/manifest/sync gates.

---

## Plan status and change control

This is Revision 2 of the plan. The GSTACK REVIEW REPORT at the end is retained as the review record. The task list and numbering before that section are authoritative; the historical report's old Task 1-11 numbering is not.

| ID | Priority | Outcome | Depends on | Status |
|---|---|---|---|---|
| T0 | P0 | Reproducible baseline and rollback anchor | - | [x] |
| T1 | P0 | SDK/CLI idempotency audit and ambiguous-outcome handling | T0 | [x] |
| T2 | P0 | No-data-safe analytics and heuristic labels | T0 | [x] |
| T3 | P0 | Read-after-write verification, URL and status correctness | T1 | [x] |
| T4 | P1 | Generated Agent contract from metadata/runtime | T0, T1 | [x] |
| T5 | P1 | Generated JSONL qtype capability profile | T0 | [x] |
| T6 | P1 | Novice-first CLI skill | T4, T5 | [x] |
| T7 | P2 | MCP skill, prompts, and resources | T2, T4, T5 | [x] |
| T8 | P2 | MCP HTTP credential boundary | T7 | [x] |
| T9 | P2 | Four-host routing and setup | T6, T7 | [~] |
| T10 | P2 | Fixture-based Agent golden scenarios | T1-T9 | [x] |
| T11 | P1 | Mirror synchronization and user documentation | T4-T10 | [x] |
| T12 | P0 | Full verification and handoff | T0-T11 | [~] |

Status markers: `[x]` = complete; `[~]` = locally implemented and verified in the stated scope, with the external or real-account acceptance explicitly listed as unfinished below; `[ ]` = not started.

- T9：路由文档和自动化检查完成，四宿主真实交互验收未完成。
- T10：fixture/golden 流程和 110 个 JSONL qtype 的显式真实 create/get/delete harness 均已完成；真实 respondent 提交仍受服务端版本保护/页面协议边界限制。
- T12：本地构建、测试和门禁完成，发布同步与外部验收未完成。

Rules for every task:

- Write a focused failing test or deterministic check before implementation.
- Use the existing source of truth and local naming. Do not add a parallel abstraction when an existing runtime/helper owns the behavior.
- Do not reset, checkout, clean, or overwrite the user's pre-existing changes. Resolve overlap by reading and preserving it.
- Keep SDK tasks T1-T3 serial because all workspaces share wjx-api-sdk/dist/.
- Default golden tests use fixtures and never require credentials. Real API tests are opt-in with WJX_E2E=1; never log or commit WJX_API_KEY.
- A task is complete only when its focused test, package tests where affected, and stated gates pass.

## Scope, assumptions, and non-goals

- Canonical skill sources are wjx-skills/wjx-cli-use/ and wjx-skills/wjx-mcp-use/. skills/wjx-cli-use/, .claude/skills/wjx-cli-use/, and wjx-cli/bundled/wjx-cli-use/ are consumers and must be generated/synchronized.
- wjx-agents/wjx-cli-expert/ remains the CLI expert source; its mirrors are checked separately. MCP distribution currently uses the GitHub degit path documented in wjx-agents/wjx-mcp-expert/README.md.
- JSONL is the supported programmatic survey-creation input. The historical DSL is retained for reading, review, and offline migration only; it is not a new remote creation path.
- SurveyMonkey/Tencent Questionnaire patterns are UX references only. Branching, randomization, quotas, piping, multilingual workflows, accessibility scoring, question banks, and other features are not promises unless the current SDK/API and capability matrix prove them.
- Current SDK fact that must remain explicit: DEFAULT_MAX_RETRIES = 2 means at most three attempts, but the main non-idempotent module wrappers already pass maxRetries: 0. T1 audits every wrapper and direct callWjxApi path instead of asserting that all current user paths duplicate writes. Current source semantics remain authoritative: ordinary survey creation may publish by default, while framework-only creations remain draft by default; changing that default requires a separate migration task and is out of scope here.
- buildPreviewUrl remains the single URL builder. It gains allowVidFallback; its default remains compatible, while verified post-write flows disable fallback.
- No npm publish, registry write, external deployment, credential rotation, or cross-repository CI is authorized by this plan.

## Definition of done

1. Both skills teach the same discover -> precheck -> plan -> confirm -> execute -> verify -> report lifecycle and route work to one consistent protocol per task.
2. Destructive, non-idempotent, full-replacement, queue-consuming, credential-sensitive, and ambiguous operations have explicit confirmation, retry, stop, and verification behavior implemented at the owning runtime/API layer.
3. Webhook fields, anomaly thresholds, NPS/CSAT empty/range behavior, URL semantics, and publish-state wording match source code.
4. Agent contract and JSONL qtype profile are generated artifacts with source-equality checks and lazy loading where consumed.
5. Canonical skills, references, tracked mirrors, generated docs, prompts, and package READMEs are synchronized.
6. Fixture golden scenarios cover setup, create/verify, publish, single-response submission, pagination, settings preservation, async polling, realtime queue semantics, analytics boundaries, and HTTP credentials. Batch submission is not a current CLI/MCP surface and is not introduced by this plan.
7. Builds, package tests, capability, contract, protocol, architecture, manifest, documentation, sync, docs, and startup-performance gates pass.
8. Any risk-level promotion has a documented migration path, a --yes compatibility assertion, and an explicit breaking-change entry; no silent exit-code change is shipped.

## Required Agent lifecycle

~~~text
DISCOVER intent and host capabilities
  -> PRECHECK credentials, target IDs, capability tier, and input validity
  -> PLAN side effects, publish state, pagination, queue consumption, and fallback
  -> CONFIRM writes, publish, bulk, destructive, full-replacement, or credential-sensitive actions
  -> EXECUTE through one native protocol (CLI or MCP)
  -> VERIFY structured result and post-state
  -> REPORT IDs, links, status, counts, failures, warnings, and unknowns
~~~

Mandatory stop conditions:

- Ask when target, survey ID, publish intent, recipient scope, or destructive scope is ambiguous.
- Stop on missing/invalid credentials; do not keep probing business tools.
- Stop on unsupported qtype/feature; offer a downgrade and regenerate a complete JSONL after approval. Never partially create a survey.
- Never retry an unsafe non-idempotent call after a network timeout or ambiguous transport failure. Query for a likely result or report unknown.
- Never report a count, link, publish state, or successful batch that was not verified.

---

## Task 0: Establish the implementation baseline and rollback anchor (P0)

**Files**

- Read: git status, git diff, package manifests, canonical skills, SDK/CLI/MCP source and tests
- Create outside the repository: $env:TEMP/wjx-pre-plan-worktree.patch and $env:TEMP/wjx-pre-plan-untracked.txt

**Step 1: Capture the user's current worktree before any task**

Run in PowerShell:

~~~powershell
git status --short
git diff --binary HEAD --output="$env:TEMP/wjx-pre-plan-worktree.patch"
git ls-files --others --exclude-standard | Set-Content "$env:TEMP/wjx-pre-plan-untracked.txt"
Get-Item "$env:TEMP/wjx-pre-plan-worktree.patch" | Select-Object FullName,Length
git diff --stat
node --version
npm --version
~~~

Expected: the patch includes staged and unstaged tracked changes, the untracked inventory is recorded separately, and no file is reverted or cleaned.

**Step 2: Build workspaces serially**

~~~powershell
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-mcp-server
npm run build --workspace=wjx-cli
~~~

Expected: all three commands exit 0. Serial execution is required because SDK changes share dist/.

**Step 3: Record baseline tests and gates**

~~~powershell
npm test --workspace=wjx-api-sdk
npm test --workspace=wjx-mcp-server
npm test --workspace=wjx-cli
npm run capability:check
npm run documentation:check
npm run manifest:check --workspace=wjx-cli
npm run protocol:check --workspace=wjx-cli
npm run architecture:check --workspace=wjx-cli
npm run sync-bundled:check --workspace=wjx-cli
~~~

Expected baseline output is recorded separately from later failures. The known current baseline is CLI 412 passed, 1 skipped, 0 failed and MCP integration 13/13 passed; re-record rather than assuming it remains unchanged.

**Step 4: Commit only the baseline note if the project convention requires one**

Do not commit the user's unrelated changes. Store baseline output in the task log or PR notes and continue.

---

## Task 1: Audit and enforce SDK/CLI idempotency (P0)

**Files**

- Modify: wjx-api-sdk/src/core/types.ts
- Modify: wjx-api-sdk/src/core/api-client.ts
- Modify: every SDK wrapper that calls callWjx*Api in wjx-api-sdk/src/modules/
- Modify: wjx-cli/src/lib/runtime/retry.ts, wjx-cli/src/commands/api.ts, and request helpers as required by the audit
- Test: SDK core/module tests and wjx-cli/__tests__/ retry/command tests

**Step 1: Add failing transport tests**

Use an injected fetchImpl to simulate:

- first network timeout, then success;
- first network error, then success;
- retryable HTTP response, then success;
- a successful create/submit/clear response.

Assert that unsafe operations make one network attempt on timeout/error and expose a structured ambiguous outcome; safe reads retain their bounded retry budget. Assert the test through the module wrappers, not only _callApi.

Run:

~~~powershell
npm test --workspace=wjx-api-sdk
npm test --workspace=wjx-cli
~~~

Expected: the new unsafe-retry assertions fail before implementation while existing suites continue to identify regressions.

**Step 2: Inventory and classify every call path**

Search:

~~~powershell
rg -n "callWjx(?:Api|UserSystemApi|SubuserApi|ContactsApi)|maxRetries|retryBudget" wjx-api-sdk/src wjx-cli/src wjx-mcp-server/src
~~~

Record a table in the test or developer note with action, wrapper, idempotency (safe, unsafe, or unknown), current retry override, and post-verification strategy. Confirm the known explicit maxRetries: 0 paths for survey create/submit/status/settings/delete, response modify/clear, contacts, multi-user, user-system, sub-account, and tags. Find any unclassified direct callWjxApi or long-running download path.

**Step 3: Add the smallest source-level idempotency contract**

Add an optional idempotency: safe | unsafe | unknown request dimension to SDK request options and the existing CLI retry normalization. Define `maxRetries` as retries after the first attempt everywhere; CLI `retryBudget` is converted to that same unit exactly once. Do not create operationPolicies or a second executor.

Implement these rules in api-client.ts:

- safe calls may use the existing default budget (maxRetries = 2, at most three attempts), bounded by the caller's explicit budget.
- unsafe calls never automatically retry network errors or timeouts. On the first ambiguous failure, throw a typed error containing outcome: unknown, action, traceId, and attempts for post-verification/reporting.
- unknown is treated as unsafe for network/timeout retry. Add an explicit endpoint-level `httpRetryable` declaration to the existing operation metadata; only safe operations with that declaration may retry 429/5xx. Do not silently re-enable retries through a generic default. Classify download-without-taskid and report generation according to their actual side effects (task creation is unsafe/unknown; taskid polling is safe/read).
- Keep response-body cleanup and existing error masking behavior. Do not put API keys or request bodies into the new error.

Set the marker at every audited wrapper. Raw CLI API calls derive safe only for read actions and unsafe for writes; unknown raw actions fail closed or require an explicit retry choice. Preserve maxRetries: 0 where it already expresses endpoint safety.

**Step 4: Implement and expose the ambiguous result**

Add a serializable CLI/MCP error mapping to the existing protocols: CLI remains `{ok:false,error:{...}}` and MCP remains `isError:true` with `{result:false,errormsg}`. Add `outcome: "unknown"`, `action`, `traceId`, and `attempts` inside the existing error/diagnostic data, recommend read-after-write verification, and do not label the operation simply “failed” when the server may have accepted it.

**Step 5: Run focused and full tests**

~~~powershell
npm test --workspace=wjx-api-sdk
npm test --workspace=wjx-cli
npm run build --workspace=wjx-mcp-server
npm run test:unit --workspace=wjx-mcp-server
~~~

Expected: unsafe operations issue no blind network/timeout retry, safe reads remain bounded, and no API caller loses its existing response contract.

**Step 6: Commit**

~~~powershell
git add <only the audited files listed above and their focused tests>
git commit -m "fix: make API retries idempotency-aware"
~~~

---

## Task 2: Make analytics results safe for Agents (P0)

**Files**

- Modify: wjx-api-sdk/src/modules/analytics/types.ts
- Modify: wjx-api-sdk/src/modules/analytics/compute.ts
- Modify: wjx-mcp-server/src/modules/analytics/tools.ts
- Modify: wjx-cli/src/commands/analytics.ts only where CLI validation/serialization is separate
- Test: SDK analytics tests, MCP analytics tests, CLI analytics tests
- Modify: analytics references in both canonical skills

**Step 1: Write no-data and range tests**

Assert:

- empty NPS returns an explicit no-data status and does not expose rating: 一般 or a real numeric score;
- empty CSAT is also no-data;
- NPS accepts only integer 0..10;
- 5-point CSAT accepts only 1..5 and 7-point CSAT only 1..7; zero, six, and seven are rejected for 5-point input;
- populated results retain the existing NPS bands 9-10/7-8/0-6 and existing CSAT calculations.

Run the focused tests and expect the new cases to fail before implementation.

**Step 2: Add a backwards-conscious result shape**

Use an additive discriminator such as dataStatus: ok | no-data (or the repository's established snake-case equivalent). For no-data, return score: null/rating: null for NPS and csat: null for CSAT, with zero counts and an empty distribution. The SDK, CLI, and MCP all accept an empty score array and emit this same no-data shape; only malformed/non-array input is a validation error. Keep populated-data field meanings unchanged and update all TypeScript consumers to branch on the discriminator.

**Step 3: Validate inputs at the computation boundary**

Reject non-finite, non-integer, and out-of-scale values before counting. Keep validation in the SDK so CLI, MCP, and future callers cannot bypass it. Return a normal structured validation error rather than silently dropping values.

**Step 4: Label heuristic analytics honestly**

Keep the current anomaly speed heuristic (duration < median * 0.3) only when there are at least 3 valid duration samples and the median is positive; otherwise omit speed flags and include a warning/metadata field explaining insufficient sample size. Keep duplicate and straight-line detectors unchanged unless tests show a bug. Mark compareMetrics.significant as a heuristic threshold, not statistical significance, in the type/docs/output wording.

**Step 5: Verify and commit**

~~~powershell
npm test --workspace=wjx-api-sdk
npm run test:unit --workspace=wjx-mcp-server
npm test --workspace=wjx-cli
~~~

Expected: populated-data tests remain green, no-data cannot become a business conclusion, and invalid scales fail locally.

~~~powershell
git add <only the analytics files and focused tests changed by T2; exclude all baseline paths>
git commit -m "fix: make analytics outputs agent-safe"
~~~

---

## Task 3: Add read-after-write verification and safe URL/status handling (P0)

**Files**

- Create: wjx-cli/src/lib/runtime/post-verify.ts
- Modify: wjx-api-sdk/src/modules/sso/types.ts
- Modify: wjx-api-sdk/src/modules/sso/client.ts
- Modify: wjx-cli/src/commands/survey.ts
- Modify: existing CLI/MCP survey workflow tests and fixtures
- Modify: both canonical skill front doors/references

**Step 1: Add failing verification tests**

Cover create responses containing vid, sid, or server-provided links; list fallback; malformed or cross-origin URLs; title/question-count/qtype mismatches; draft/published/paused transitions; fill versus edit links; and a response containing only vid where a public link must not be claimed as verified.

**Step 2: Extend the existing URL builder**

Add allowVidFallback?: boolean to BuildPreviewUrlInput, defaulting to true so survey preview-url and existing consumers remain compatible. With false, require a server-returned non-numeric sid and throw a typed “verified sid unavailable” error. Do not hand-build /vm/{vid}.aspx in post-verification code.

**Step 3: Implement a pure post-verification helper**

Use existing runtime result/request helpers and structured URL parsing. Return a result shaped like:

~~~ts
{
  vid?: number;
  sid?: string;
  fillUrl?: string;
  editUrl?: string;
  status?: "draft" | "published" | "paused" | "unknown";
  verification: { structure: boolean; status: boolean; link: boolean };
  warnings: string[];
}
~~~

Resolve status from actual get_survey/status response fields and fixtures, not guessed numeric codes, including `deleted` for state 3. Validate that a returned URL matches the configured respondent base URL or an explicit respondent-origin allowlist derived from the same WJX deployment; preserve configured protocol/port rules and reject query/redirect URLs that leave the allowlist. If only vid is available, omit fillUrl or mark it unverified with a warning; never infer a public route.

**Step 4: Wire CLI create and publish flows**

After a real create or publish, call read-after-write verification before reporting success. Preserve dry-run as network-free. On outcome: unknown, query by known identifiers once where safe, then report unknown if the post-state cannot be proven. The same typed helper is used by MCP orchestration or the MCP tool returns a pending/unknown result that requires the read-back sequence; documentation alone cannot claim verification. Keep the existing survey preview-url command's compatible fallback default.

**Step 5: Document the MCP equivalent**

Require create_survey_by_json -> get_survey -> status read -> safe link resolution -> final report. Do not add a second URL-concatenation implementation. A helper MCP tool, if needed, must be read-only and use typed SDK behavior.

**Step 6: Verify content, synchronize consumers, and commit**

~~~powershell
npm test --workspace=wjx-api-sdk
npm test --workspace=wjx-cli
npm run test:unit --workspace=wjx-mcp-server
npm run test:integration --workspace=wjx-mcp-server
~~~

Expected: no create/publish success is reported without structure, status, and link evidence appropriate to the response.

~~~powershell
git add <only the URL/post-verify files and focused tests changed by T3; exclude all baseline paths>
git commit -m "feat: verify survey writes and respondent links"
~~~

---

## Task 4: Generate the Agent contract from existing metadata/runtime (P1)

**Files**

- Create: scripts/export-agent-contract.mjs
- Create: capabilities/agent-contract.json
- Create: scripts/check-agent-contract.mjs
- Create: wjx-cli/__tests__/agent-contract.test.mjs
- Modify: root package.json
- Modify: both canonical SKILL.md front doors
- Read as source: wjx-cli/src/lib/command-metadata.ts, wjx-cli/src/lib/runtime/risk.ts, wjx-cli/src/lib/runtime/confirmation.ts, wjx-cli/src/lib/runtime/retry.ts, wjx-cli/src/lib/policy.ts, capabilities/capability-matrix.json

**Step 1: Define the generated schema test first**

Require top-level keys schemaVersion, generatedFrom, intentRoutes, operations, hostRoutes, verificationRules, and stopConditions. Require operation records for read, create, submit, update-settings, publish/status, delete, clear, realtime, and async-download. Require every operation to carry generated risk, confirmation, retry, preRead, postVerify, ambiguousTimeout, and maxBatch facts; use `maxBatch: null` for surfaces without batch support.

Run:

~~~powershell
node --test wjx-cli/__tests__/agent-contract.test.mjs
~~~

Expected: fail because the generated contract and exporter do not yet exist.

**Step 2: Implement export using built source, not duplicated literals**

Follow the existing wjx-cli/scripts/export-manifest.mjs pattern: build the CLI, import dist/lib/command-metadata.js and the runtime modules, combine them with the capability matrix, sort deterministically, and write capabilities/agent-contract.json. Extend the existing command metadata with the minimal agent facts required by this contract, including `httpRetryable`, queue consumption, pre/post verification, ambiguous timeout handling, and batch cardinality. The contract's operations section is a serialization for Agents, not a new runtime operationPolicies abstraction.

Keep intent routes explicit: design, create, publish, collect, analyze, admin, and setup. Four host routes must choose one protocol per task. Generated risk must reflect current metadata and protocol annotations using a documented merge rule (the more restrictive destructive/idempotent annotation wins); custom verification rules must point to known capability IDs.

**Step 3: Add generation/check scripts**

Add root scripts:

~~~json
"agent-contract:export": "npm run build --workspace=wjx-cli && node scripts/export-agent-contract.mjs",
"agent-contract:check": "npm run build --workspace=wjx-cli && node scripts/check-agent-contract.mjs"
~~~

The checker must regenerate in memory and compare byte-for-byte, reject duplicate IDs/unknown enum values/missing operation fields/routes without a supported CLI or MCP surface, and reject verification rules that reference unknown capability IDs.

**Step 4: Keep the contract lazy**

Do not load agent-contract.json or jsonl-qtypes.json during CLI module initialization, wjx --help, or completions. Read them only in commands/flows that request Agent capability data.
Package the generated artifacts into the CLI distribution (copy under `dist/capabilities/` during build or include an equivalent package file) and add an `npm pack` smoke test proving an installed CLI can load them without the repository root.

**Step 5: Add the risk migration gate**

Do not silently promote risk levels. If implementation promotes any command from write to high-risk-write, enumerate the exact command IDs in the contract test and changelog, add a test showing --yes preserves the old successful behavior, and add a non-interactive test expecting the documented CONFIRMATION_REQUIRED exit code 3 (the current CLI mapping). If no promotion is needed, record that existing high-risk confirmation plus Agent-level write confirmation satisfies the requirement.

**Step 6: Verify and commit**

~~~powershell
npm run agent-contract:export
node --test wjx-cli/__tests__/agent-contract.test.mjs
npm run agent-contract:check
~~~

Expected: a deterministic generated contract matches metadata/runtime and introduces no startup regression.

~~~powershell
git add <only the contract exporter/checker/artifact, metadata, package script, and focused test files changed by T4>
git commit -m "feat: generate agent execution contract"
~~~

---

## Task 5: Generate the JSONL qtype capability profile (P1)

**Files**

- Create: scripts/export-jsonl-capabilities.mjs
- Create: capabilities/jsonl-qtypes.json
- Create: wjx-cli/__tests__/jsonl-capability-profile.test.mjs
- Create: wjx-mcp-server/src/resources/jsonl-qtypes.ts
- Modify: wjx-mcp-server/src/resources/index.ts
- Modify: root package.json and wjx-mcp-server/package.json when adding export/check scripts or packaging generated resource data
- Modify: qtype references in both canonical skills

**Step 1: Write profile tests**

Require qtypes, creatableAtypes, tiers, frameworkQtypes, npsRules, and sourceRevision. Require tiers stable-basic, advanced-jsonl, framework-draft, and read-only-or-web-editor; require atype 8 to be absent; require NPS options as string values 0 through 10.

**Step 2: Generate from SDK constants and validators**

Read JSONL_SUPPORTED_QTYPES, framework qtypes, creatable atypes, and NPS/CSAT validation from SDK source or built exports. Sort all arrays and use a deterministic SHA-256 over the normalized source files plus SDK package version as sourceRevision (exclude git state and generated outputs). Generate the checked-in JSON and the MCP TypeScript resource from that one JSON artifact in the same command; the MCP package embeds the resource data or copies the artifact into `dist/` so installed packages do not depend on the repository root. Never hand-maintain a second qtype list.

**Step 3: Register the MCP resource**

Expose wjx://reference/jsonl-qtypes as read-only JSON. Its description must distinguish JSONL creation qtype names from get_survey numeric q_type/q_subtype codes and state which tiers are draft-only or web-editor-only.

**Step 4: Map competitor patterns without promising unsupported behavior**

Add a small reference table in the skill docs: SurveyMonkey/Tencent-like “question builder”, “preview”, “publish”, “collect”, and “analyze” map to current WJX surfaces; branching/randomization/quotas/piping map to unsupported/not validated unless the profile says otherwise. This is a UX orientation aid, not an API capability claim.

**Step 5: Verify and commit**

~~~powershell
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-mcp-server
npm run jsonl-capabilities:export
node --test wjx-cli/__tests__/jsonl-capability-profile.test.mjs
npm run capability:check
~~~

Add jsonl-capabilities:export/check scripts alongside the contract scripts if they do not already exist. Expected: deterministic profile generation and readable MCP resource.

~~~powershell
git add <only the qtype exporter/checker/artifact, MCP resource, package script, and focused test files changed by T5>
git commit -m "feat: expose generated jsonl capability profile"
~~~

---

## Task 6: Refactor the CLI skill into a novice-first front door (P1)

**Files**

- Modify: wjx-skills/wjx-cli-use/SKILL.md
- Modify: wjx-skills/wjx-cli-use/references/survey-commands.md
- Modify: wjx-skills/wjx-cli-use/references/response-commands.md
- Modify: wjx-skills/wjx-cli-use/references/contacts-commands.md
- Modify: wjx-skills/wjx-cli-use/references/analytics-commands.md
- Create/modify only if needed: wjx-skills/wjx-cli-use/references/host-routing.md
- Modify: scripts/check-documentation-contract.mjs and CLI skill evaluation tests

**Step 1: Write content assertions**

Require lifecycle, host routing, design/create/publish distinction, source-accurate draft/publish policy (ordinary create may publish by default; framework-only create defaults to draft), complete-JSONL regeneration after unsupported qtype, CLI ok/data/meta and ProblemEnvelope parsing, idempotency/ambiguous-timeout handling, verified-sid URL policy, total-count pagination, async polling, and queue-consumption warnings. Require the stale phrase 继续创建其余题目 to be absent from active guidance.

**Step 2: Rewrite the front door around novice decisions**

The first section must answer: what the Agent can do, whether CLI/MCP is available, which intent was detected, what confirmation is needed, and what evidence a successful result contains. Put shell quoting, full flags, and exhaustive qtype examples in references. Link to generated contract/profile rather than copying their tables.

**Step 3: Define setup and credential boundaries**

Probe node --version, npm --version, Get-Command node,npm,wjx, where.exe node, npm prefix -g, and wjx --version before installing. Use an explicit --target-dir when no host root is known. Configure secrets through host environment/secret storage before accepting a prompt-pasted key; never put a key in a repository, log, fixture, generated file, or final report. Stop immediately after authentication failure.

**Step 4: Define create/publish behavior from actual CLI semantics**

Use this exact rule:

~~~text
设计请求只生成方案或 JSONL；创建请求先展示标题、题数、题型、必答项、atype 和预计发布状态；遵循 SDK 当前语义：普通题型创建可默认发布，纯框架题型默认草稿；发布命令和删除等高风险操作必须明确确认。若 qtype 不支持，给出降级方案并重新生成一份完整 JSONL，不做部分创建。
~~~

Do not claim that the CLI can create from removed text/DSL paths. Explain --yes, risk/confirmation, ok/data/meta versus raw SDK result, and how to report unknown after an ambiguous timeout.

**Step 5: Add a final report template**

Require operation, target, success/failure/unknown, survey status, fill/edit links and their source/verification state, planned/succeeded/failed counts, matched/collected pages, warnings, limitations, and next step.

**Step 6: Verify and commit**

~~~powershell
node --test wjx-cli/__tests__/skill-completeness-evaluation.test.mjs
npm run sync-bundled --workspace=wjx-cli
npm run documentation:check
~~~

Expected: all current command names and safety terms are source-accurate, with no stale creation or capability claims.

~~~powershell
git add <only the CLI skill files, documentation checker, and focused tests changed by T6>
git commit -m "docs: make cli skill novice-first and stateful"
~~~

---

## Task 7: Align MCP skill, prompts, and resources with executable behavior (P2)

**Files**

- Modify: wjx-skills/wjx-mcp-use/SKILL.md
- Modify: wjx-skills/wjx-mcp-use/references/tools-survey.md
- Modify: wjx-skills/wjx-mcp-use/references/tools-response.md
- Modify: wjx-skills/wjx-mcp-use/references/tools-other.md
- Modify: wjx-skills/wjx-mcp-use/references/troubleshooting.md
- Modify: wjx-mcp-server/src/prompts/index.ts
- Modify: wjx-mcp-server/src/prompts/survey-generation-json.ts
- Modify: wjx-mcp-server/src/prompts/analysis.ts
- Modify: wjx-mcp-server/src/resources/push-reference.ts
- Modify: MCP prompt/resource tests

**Step 1: Add prompt/resource contract tests**

Discover registered IDs and require each prompt to map to at least one real tool/resource and each resource to have a documented use. Reject stale Webhook field names, “question-count-times-three” anomaly language, direct creation without authorization, zero-sample NPS conclusions, and claims that prompts guarantee execution/verification.

**Step 2: Add the MCP front door**

Document MCP-connected versus CLI-only responsibilities, annotation-driven risk policy, MCP success as isError=false plus parsed result=true, and the fact that prompts guide an Agent but do not execute or verify it. Use the generated contract/profile for risk and qtype facts.

**Step 3: Gate JSON generation and Webhook updates**

Generation prompts may produce a preview first and call create_survey_by_json only after explicit authorization. Unsupported qtypes require full JSONL regeneration. For Webhook, read complete settings, change only requested keys, submit the full replacement expected by the current tool schema, read again, and report preserved fields. Include HTTPS, encryption, signature, and secret-handling requirements using source-verified names only.

**Step 4: Correct analysis, async, and queue workflows**

Require count_responses, explicit valid/filter values, page-size limits, total-count accumulation, empty-sample stop, score validation, heuristic wording for anomaly/metric comparison, taskid polling, and queue-consumption warnings for realtime/download/360 operations. Never infer a count from one page.
The CLI and MCP surfaces must expose the same risk for queue-consuming operations; the more restrictive MCP annotation wins when merged into the generated contract, and a cross-surface test must reject drift.

**Step 5: Record MCP release-path limitation**

State in the skill/release notes that the MCP skill is pulled by degit from GitHub wjxcom/wjx-ai-kit; Codeup changes do not reach users until the GitHub mirror is synchronized. This is a publication-delay note, not a reason to add cross-repository CI in this plan.

**Step 6: Verify content and commit**

~~~powershell
npm run build --workspace=wjx-mcp-server
npm run test:unit --workspace=wjx-mcp-server
npm run test:integration --workspace=wjx-mcp-server
npm run documentation:check
~~~

Expected: prompt/resource mappings resolve to current tools and all MCP guidance describes a verifiable workflow.

~~~powershell
git add <only the MCP skill, prompt/resource, checker, and focused tests changed by T7>
git commit -m "docs: align mcp skill with agent execution policy"
~~~

---

## Task 8: Harden MCP HTTP and credential onboarding (P2)

**Files**

- Modify: wjx-mcp-server/src/transports/http.ts
- Modify: wjx-mcp-server/src/core/context.ts only if precedence changes
- Modify: wjx-mcp-server/package.json and resource packaging/build scripts if generated profile data is embedded or copied
- Modify: wjx-mcp-server/README.md
- Modify: wjx-mcp-server/docs/architecture.md
- Modify: wjx-docs/operations/http.md
- Modify: wjx-docs/start/mcp.md
- Modify: MCP HTTP integration tests
- Modify: wjx-skills/wjx-mcp-use/SKILL.md

**Step 1: Write credential-boundary tests**

Test independent MCP_AUTH_TOKEN and WJX_API_KEY, unauthenticated /health, 401 behavior for /mcp, configured-key upstream calls, legacy compatibility behavior, per-session isolation, and DELETE invalidation. Assert secrets are absent from logs and diagnostic payloads.

**Step 2: Implement explicit precedence**

~~~text
MCP_AUTH_TOKEN -> protects the MCP transport
WJX_API_KEY -> authenticates upstream WJX API
WJX_BASE_URL and WJX_CORP_ID -> routing and contacts scope
~~~

Keep request-scoped credentials only for an explicitly enabled tenant mode. Mask all diagnostics and preserve the stdio default.

Define `MCP_TENANT_MODE=1` as the opt-in request-scoped mode. With it unset, `MCP_AUTH_TOKEN` authenticates the transport and process `WJX_API_KEY` authenticates upstream calls; the legacy single-tenant behavior remains the default. In tenant mode, resolve the upstream key from the authenticated session only after transport auth succeeds, never from the bearer token unless an explicit legacy compatibility flag is set and recorded in diagnostics as masked.

**Step 3: Document HTTP setup and threat boundaries**

Document local stdio first, HTTP for remote/shared deployments, /health -> /mcp -> session handshake, TLS/reverse proxy, stateful/stateless mode, body limits, session isolation, and secret-manager requirements.

**Step 4: Verify and commit**

~~~powershell
npm run build --workspace=wjx-mcp-server
npm run test:integration --workspace=wjx-mcp-server
~~~

Expected: transport and upstream credentials are independent and no secret appears in output.

~~~powershell
git add <only the HTTP credential, documentation, skill, and focused integration files changed by T8>
git commit -m "fix: separate mcp transport and wjx credentials"
~~~

---

## Task 9: Add host-neutral onboarding for four workstations (P2)

**Files**

- Create: wjx-skills/wjx-cli-use/references/host-routing.md
- Create: wjx-skills/wjx-mcp-use/references/host-routing.md
- Modify: both canonical skills
- Modify: install-root and documentation contract tests only where assertions are missing

**Step 1: Write routing assertions**

Require the names WorkBuddy, Cowork, Codex Work, and Qianwen Work, but require generic capability detection rather than invented variables such as COWORK_HOME, CODEX_WORK, or Qianwen-specific APIs.

**Step 2: Define the host-neutral handshake**

~~~text
1. Detect available MCP tools/resources.
2. Detect shell and wjx --version if a shell exists.
3. If both exist, choose one business protocol deterministically: continue the protocol already used in the task; otherwise use CLI for setup, local design, and local file workflows, and MCP for connected business reads/writes. State the selected protocol once and do not switch mid-task without a capability failure.
4. If neither exists, stop and request host capability enablement.
5. Resolve skill destination with explicit --target-dir first.
~~~

**Step 3: Add only verified host notes**

Document host-specific secret/config locations only when verified from current host documentation. Otherwise direct the Agent to that host's secret/environment configuration without guessing paths.

**Step 4: Verify and commit**

~~~powershell
node --test wjx-cli/__tests__/install-root.test.mjs
npm run documentation:check
~~~

Expected: deterministic target-dir setup and no fabricated host API.

~~~powershell
git add <only the host-routing references, skill files, checker, and focused test changed by T9>
git commit -m "docs: add host-neutral agent onboarding"
~~~

---

## Task 10: Add fixture-based Agent golden scenarios (P2)

**Files**

- Create: wjx-cli/__tests__/agent-workflow-golden.test.mjs
- Create: wjx-mcp-server/__tests__/agent-workflow-golden.test.mjs
- Create: wjx-mcp-server/tests/http-agent-workflow.test.mjs
- Create: shared redacted fixtures under the existing test fixture conventions
- Modify: documentation contract tests only where a scenario claim needs a gate

**Step 1: Make fixture mode the default**

Use injected fetches/MCP transports and redacted responses. Tests must run without WJX_API_KEY. Add a separate WJX_E2E=1 branch for real environments; skip it by default and never print the key or full response body.

**Step 2: Cover setup, create, and publish**

Cover survey, vote, exam, and form JSONL. Assert atype, qtype tier, draft-by-default for design intent, explicit publish confirmation, structure verification, status evidence, and safe fill/edit link handling.

**Step 3: Cover local validation and unsupported inputs**

Cover unknown/English qtype, duplicate metadata, zero real questions, invalid NPS/CSAT options, oversized JSONL, and atype 8. Assert local validation performs zero network requests and unsupported qtypes cause complete regeneration rather than partial creation.

**Step 4: Cover response and queue semantics**

Cover total-count pagination, missing total-count, single-submit ambiguous timeout, realtime queue consumption, download task polling, 360 report polling, and clear-response confirmation. Assert page/count metadata and unknown outcomes are explicit; do not invent batch-submit behavior absent from the current surfaces.

**Step 5: Cover analytics, settings, and admin**

Cover no-data NPS/CSAT, invalid CSAT scale, anomaly heuristic wording, non-statistical compare flags, complete settings preservation, and bulk contacts/admin/department/tag diffs.

**Step 6: Verify and commit**

~~~powershell
node --test wjx-cli/__tests__/agent-workflow-golden.test.mjs
node --test wjx-mcp-server/__tests__/agent-workflow-golden.test.mjs wjx-mcp-server/tests/http-agent-workflow.test.mjs
npm test --workspace=wjx-api-sdk
npm test --workspace=wjx-mcp-server
npm test --workspace=wjx-cli
~~~

Expected: every fixture scenario produces a truthful structured report and no credential is required.

~~~powershell
git add <only the golden tests and fixture files changed by T10>
git commit -m "test: cover agent workflow golden scenarios"
~~~

---

## Task 11: Synchronize mirrors and publish user documentation (P1)

**Files**

- Modify: wjx-cli/scripts/sync-bundled.mjs
- Modify: scripts/check-documentation-contract.mjs
- Regenerate: skills/wjx-cli-use/
- Regenerate: .claude/skills/wjx-cli-use/
- Regenerate: wjx-cli/bundled/wjx-cli-use/
- Regenerate: wjx-cli/bundled/wjx-cli-expert.md
- Modify current Unreleased entries only in CHANGELOG.md and package changelogs
- Modify: README.md, package READMEs, and relevant wjx-docs/ pages

**Step 1: Make all CLI skill references generated**

Add skills/wjx-cli-use and .claude/skills/wjx-cli-use as directory targets in sync-bundled.mjs, alongside wjx-cli/bundled/wjx-cli-use, with recursive references/ copying. Retain MIN_SOURCE_FILES and refuse to clear a destination when the source is missing or suspiciously small.

**Step 2: Make mirror checks recursive**

Change documentation mirrorPairs from individual SKILL.md/setup.sh files to directory snapshots. Compare relative filenames and SHA-256 content after CRLF/LF normalization, including all references/ files. Keep the expert-agent file mirror checks and MCP GitHub path text check.

**Step 3: Regenerate, never hand-edit consumers**

First inspect the baseline patch and untracked inventory for overlap. Before syncing, compare every target file against the baseline and abort or preserve a separate backup for any target with user changes; the sync implementation must write files atomically and never recursively delete a non-empty target containing changes. Then run:

~~~powershell
npm run sync-bundled --workspace=wjx-cli
npm run sync-bundled:check --workspace=wjx-cli
npm run documentation:check
~~~

Review generated diffs for user changes before committing. A canonical edit must flow to every consumer; a generated file must not be edited independently. Normalize CRLF/LF before comparison in both the generator checker and `sync-bundled:check`, so the two gates use the same content identity.

**Step 4: Update user-facing docs and migration notes**

Describe the CLI-primary/MCP-business-tools boundary, lifecycle, credential trust boundary, draft/publish semantics, capability tiers, URL verification, async behavior, analytics limitations, and unsupported SurveyMonkey/Tencent-like features. If any risk promotion occurred, list command IDs, the current CONFIRMATION_REQUIRED exit code 3, --yes migration, and the breaking-change label in CHANGELOG.md. If no promotion occurred, state that explicitly.

Do not claim MCP changes are available to users until Codeup content has been synchronized to GitHub wjxcom/wjx-ai-kit; record this as a release prerequisite, not a local test failure.

**Step 5: Build generated HTML and verify**

~~~powershell
npm run docs:build
npm run docs:check
npm run documentation:check
~~~

Expected: generated HTML matches canonical docs and contains no internal plan text or stale capability claim.

**Step 6: Commit**

~~~powershell
git add <only the synchronization, documentation, changelog, and generated consumer files changed by T11; exclude baseline paths>
git commit -m "docs: publish agentic skill contract and synchronized mirrors"
~~~

---

## Task 12: Full verification and handoff (P0)

**Files**

- Modify only files identified by failing checks.
- Read all T0-T11 commits and the final diff; do not broaden scope during cleanup.

**Step 1: Build serially**

~~~powershell
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-mcp-server
npm run build --workspace=wjx-cli
~~~

Expected: all exit 0.

**Step 2: Run package suites serially**

~~~powershell
npm test --workspace=wjx-api-sdk
npm test --workspace=wjx-mcp-server
npm test --workspace=wjx-cli
~~~

Expected: zero failures. Record skipped tests and whether WJX_E2E=1 was disabled.

**Step 3: Run every repository gate**

~~~powershell
npm run capability:check
npm run agent-contract:check
npm run jsonl-capabilities:check
npm run documentation:check
npm run docs:check
npm run manifest:check --workspace=wjx-cli
npm run protocol:check --workspace=wjx-cli
npm run architecture:check --workspace=wjx-cli
npm run sync-bundled:check --workspace=wjx-cli
npm run perf:startup --workspace=wjx-cli
~~~

Expected: capability matrix, generated artifacts, docs, mirrors, command manifest/protocol/architecture, and startup performance are all green. The startup gate must include wjx --help/completions and prove lazy artifact loading does not regress the existing budget.

**Step 4: Inspect diff quality and safety**

~~~powershell
git diff --check
git status --short
git diff --stat
git log --oneline -n 20
~~~

Expected: no whitespace errors, API keys, fixture secrets, unrelated generated churn, deleted user changes, or untracked required artifacts.

**Step 5: Produce handoff evidence**

Record:

- generated contract/profile schemaVersion and sourceRevision;
- focused and package test totals, skipped tests, and WJX_E2E status;
- canonical and generated consumer paths plus sync evidence;
- unsupported/web-only capabilities and competitor-pattern mapping;
- HTTP credential mode and secret-handling result;
- any risk promotion and migration/exit-code evidence;
- the Codeup-to-GitHub MCP synchronization prerequisite;
- confirmation that no npm registry write or external deployment occurred.

Do not claim completion without evidence for each Definition of done item.

---

## Execution checkpoints

Checkpoint A (T0-T3) is an independently releasable data-safety increment: its delivery gate is the focused tests for T0-T3 plus the three package builds/tests, `capability:check`, and `documentation:check`. T12 is the final full-delivery gate for all capabilities and documentation; it is not required before the T0-T3 increment can be reviewed or released. The fixture-based end-to-end evidence in T10 remains part of the final gate and may follow the earlier increment.

| Checkpoint | Tasks | Review gate |
|---|---|---|
| A: Baseline and data safety | T0-T3 | rollback anchor, idempotency tests, analytics boundaries, post-write verification |
| B: Agent contract and capabilities | T4-T5 | generated artifacts, source-equality checks, lazy-load performance |
| C: Novice workflows | T6-T7 | CLI/MCP content tests, prompt/resource mapping, documentation check |
| D: Host reach and fixtures | T8-T10 | HTTP auth isolation, four-host routing, credential-free golden scenarios |
| E: Release hygiene | T11-T12 | recursive mirror check, docs build, all gates, handoff evidence |

Do not begin the next checkpoint until the previous checkpoint's focused tests and review gate are green. SDK tasks T1-T3 remain serial; documentation and fixture work may be parallelized only when no shared generated output is being written.

**Incremental delivery semantics:** Checkpoint A (T0-T3) is independently releasable after its focused tests, the three workspace build/test suites, `capability:check`, and `documentation:check` pass. T12 is the final gate for the full T0-T11 delivery, not a prerequisite for releasing the P0 data-safety increment. The Checkpoint A release must state that end-to-end evidence for the P0 workflows is completed later by T10.

---

## GSTACK REVIEW REPORT (historical record)

评审对象：本计划 Revision 1（评审时正文约 688 行）。评审方式：计划文本、代码现状、测试、未提交改动全量核对。

### 结论

Webhook、异常检测、NPS/CSAT、URL 规则、发布状态五处事实冲突均在代码中成立。但“SDK 会让所有创建、提交、清空操作重复”的表述需要按实际调用路径收窄：核心默认最多三次尝试，主要非幂等封装当前已经显式 maxRetries: 0。本 Revision 2 将其改为全路径审计与 SDK 层幂等测试，不把合同文本误当成运行时修复。

### 必须落地的修正

- **M1/P0：幂等性。** wjx-api-sdk/src/core/api-client.ts 的默认预算为 DEFAULT_MAX_RETRIES = 2，网络错误/超时会进入重试循环。T1 必须覆盖 SDK wrappers、直接 callWjxApi、CLI raw API 和异步路径；unsafe 操作在网络/超时上不自动重试，并向 post-verify 暴露 outcome: unknown。HTTP 状态重试必须由 endpoint 语义明确允许，不能由 Agent 合同单独解决。
- **M2/P1：合同生成。** agent-contract.json 不再手写。由 command-metadata.ts、runtime/risk.ts、runtime/confirmation.ts、runtime/retry.ts、policy 和 capability matrix 生成；checker 比较生成物与源码。
- **M3：复用 runtime。** 不创建平行 operationPolicies。确认、风险、retry、request-plan、pagination、executor、result 和 policy 继续由 wjx-cli/src/lib/runtime/ 与现有 policy.ts 承担。
- **M4/P0：URL。** 扩展现有 buildPreviewUrl 的 allowVidFallback，默认兼容；verified post-write 传 false。没有 sid 时不得把数字 vid 拼成未经验证的公共链接。
- **M5/P1：镜像。** sync-bundled.mjs 递归同步 references/ 到 skills/、.claude/skills/ 和 bundled；documentation check 改为目录级快照，保留 MIN_SOURCE_FILES 防误清空。
- **M6：风险迁移。** risk 上调会让旧非交互脚本得到 CONFIRMATION_REQUIRED；当前源码的退出码是 **3**（本报告早期草稿中的“2”已更正）。任何 promotion 都必须列出命令、补 --yes 行为测试、写 breaking changelog 和迁移说明；仅 manifest:export 通过不算兼容。
- **M7/P2：MCP 发布。** MCP skill 通过 GitHub degit 分发，而当前仓库 remote 是 Codeup。这是发布延迟，不是架构缺口；交付说明必须标注 Codeup 改动需先同步到 GitHub，计划不新增跨仓 CI。

### 评审要求纳入的测试与性能规则

- 用注入 fetchImpl 模拟“首次超时/网络错误、二次成功”，断言 unsafe 操作只发出一次请求。
- golden/e2e 默认使用 fixture；真实凭据仅在显式 WJX_E2E=1 下运行，API key 不进入日志、fixture、CI 输出。
- 合同/profile 按需惰性加载，不影响 wjx --help 和 completions；T12 必须运行 npm run perf:startup --workspace=wjx-cli。
- SDK 修改不要并行，因为共享 wjx-api-sdk/dist/。

### 已存在、无需重建

wjx-cli/src/lib/runtime/ 的 confirmation/risk/policy/retry/dry-run/pagination/request-plan/executor/result/streams/context/fileio/input；wjx-cli/src/lib/command-helpers.ts 的 command executor、strict integer、required field 和 capturing fetch；CLI export/check/sync/benchmark 脚本；capabilities/capability-matrix.json；现有 CLI/MCP command, protocol, architecture, risk-confirmation, breaking-surface, creation-surface, skill/workflow evaluation tests。

### 失败模式验收表

| 场景 | 计划验收结果 |
|---|---|
| 建卷/提交超时 | 不盲重试；查询可验证状态，否则报告 unknown |
| 502/5xx | 仅按 endpoint 明确语义和预算处理，不由文本合同兜底 |
| 零样本 NPS/CSAT | 明确 no-data，不得输出真实“一般”或有效分数 |
| CSAT 越界 | SDK 边界校验报错 |
| 只有 vid | 不生成未经验证的公共 fill URL，warnings 明示 |
| canonical 改动 | 生成器覆盖所有 references 镜像，递归门禁阻止漂移 |
| risk 上调 | changelog、退出码、--yes 和迁移测试齐全 |

NO UNRESOLVED DECISIONS.

---

## Revision 2 审查结论

对 Revision 2（T0-T12）的复核。评审方式：逐条核对七项修正在计划中的落地，并回到代码验证 Revision 2 提出的反驳。

### Revision 2 对上一轮评审的修正成立

第 48 行推翻了上一轮 M1 的结论，经代码核实**该反驳正确，上一轮结论过强**：

- `wjx-api-sdk/src/core/constants.ts:141` — `DEFAULT_MAX_RETRIES = 2`，即最多三次尝试（上一轮记为"默认重试 3 次"，不准确）
- 主要写路径均已显式传 `maxRetries: 0`：`createSurveyByJson:298`、`submitResponse:102`、`clearResponses:178`、`deleteSurvey:159`、`updateSurveyStatus:110`、`updateSurveySettings:144`、`clearRecycleBin:195`、`modifyResponse:148`、`uploadFile:315`
- 遍历 contacts / multi-user / user-system / sso 等模块，未显式禁用重试的函数**全部是 query/list 读操作**（`queryContacts`、`listDepartments`、`listTags`、`querySubAccounts`、`querySurveyBinding`、`queryUserSurveys`），读操作保留重试预算是正确的
- 结论：**当前没有任何写路径会被盲目重试。**"重复建卷/重复提交是确定行为"这一说法不成立，应以本节为准

T1 因此保留 P0 是恰当的，但理由变了：不是修复正在发生的数据损坏，而是**把 wrapper 级的人工约定升级为源码级机制**。现状依赖每个 wrapper 作者记得写 `maxRetries: 0`，新增 wrapper 漏写就静默退回默认预算，且无门禁可查。T1 的 idempotency 维度正是补这个洞。

### 七项修正的落地核对

| 项 | 落地位置 | 结果 |
|---|---|---|
| M1 幂等 | T1 全任务 + 第 48 行事实澄清 | 落地，并修正了原结论 |
| M2 合同生成 | T4，`scripts/export-agent-contract.mjs` + `agent-contract:export/check` | 落地。沿用 `export-manifest.mjs:8-9` 的 `pathToFileURL(dist/...)` 动态 import 模式，正确 |
| M3 复用 runtime | 第 36 行通则 + T1 Step 3「Do not create operationPolicies or a second executor」 | 落地。`wjx-cli/src/lib/policy.ts` 路径引用正确 |
| M4 URL | T3 Step 2，`allowVidFallback` 默认 `true`，`false` 时要求非数字 `sid` 并抛类型化错误 | 落地，且 Step 3 增加了同源校验与路由白名单，强于原要求 |
| M5 镜像 | T11，`sync-bundled.mjs` 增加两个目录目标；`mirrorPairs` 改为目录快照 + SHA-256 比对 | 落地，强于原要求（原只提递归比对） |
| M6 risk 迁移 | DoD #8 + T4 Step 5 | 落地，且补了「若无 promotion 则显式记录」的兜底 |
| M7 MCP 发布 | 第 45/530/726/812 行 | 落地，定性为发布延迟，不新增跨仓 CI |
| 测试凭据 | 第 39/652 行，fixture 默认 + `WJX_E2E=1` opt-in | 落地 |
| 启动性能 | T4 Step 4 惰性加载 + T12 `perf:startup` 含 `--help`/completions | 落地 |

T11 的 `docs:build` 先于 `docs:check` 执行，顺序正确。T12 引用的 `agent-contract:check`、`jsonl-capabilities:check` 与 T4/T5 新建的 script 自洽。

### 唯一遗留结构问题：优先级与依赖图倒挂

- T11 是 **P1**，依赖 T4-T10，其中 T7/T8/T9/T10 是 **P2**
- T12 是 **P0**，依赖 T0-T11，即依赖全部 P2
- Execution checkpoints 表把顺序定为 A(T0-T3) → B(T4-T5) → C(T6-T7) → D(T8-T10) → E(T11-T12)，严格线性；checkpoint C 同时含 P1 的 T6 与 P2 的 T7

后果：**P0/P1/P2 只是重要性标签，不构成可分批交付的阶段。** 想先上线数据安全修复（T1-T3）时，T12 的"完整验证与交付"要求 T0-T11 全部完成，P0 的核心价值被 P2 的四宿主适配和 golden scenario 阻塞。

建议（不改任务内容，只改交付语义）：在 Execution checkpoints 下声明——checkpoint A 结束后即构成一个可独立发布的增量，其交付门是「T0-T3 的 focused test + 三包 build/test + `capability:check` + `documentation:check`」；T12 是全量交付的最终门，而非每个增量的必经门。

同时注意 T10（golden scenarios，P2）验证的正是 T1-T3 的 P0 行为（create/verify、publish、analytics 边界）。若采纳上述分批，checkpoint A 的增量只有各任务的 focused test 覆盖，端到端证据要等到 T10——这可以接受，但交付说明中应写明。

### 结论

Revision 2 可以执行。七项修正全部落地，其中三项强于原要求；对上一轮 M1 的反驳经代码核实成立，应以修订后的表述为准。建议按上节补一句交付语义说明，其余无需再改。

---

## 实际执行记录（2026-09-05，历史窗口）

以下是 2026-09-05 历史窗口的串行命令和显式真实 smoke 记录。它保留作为审计轨迹，已由 2026-09-06 最新复核记录取代；旧数字、旧 contract revision 和当时的完成判断不应被当作当前状态。

### 构建、测试与门禁

- `wjx-api-sdk`：`npm test --workspace=wjx-api-sdk`，`662 tests / 662 pass / 0 fail / 0 skip`。
- `wjx-mcp-server`：`npm test --workspace=wjx-mcp-server`，`349 tests / 348 pass / 0 fail / 1 skip`；唯一跳过项是未设置 `WJX_E2E=1` 时的真实 stdio 只读 smoke。
- `wjx-cli`：`npm test --workspace=wjx-cli`，`474 tests / 472 pass / 0 fail / 2 skip`，进程退出码 `0`；跳过项是未设置 `WJX_E2E=1` 的真实只读 smoke，以及默认关闭的真实题型 create/get/delete 工作流。
- 三个 workspace 已串行构建成功。golden、黑盒和 HTTP MCP E2E 的写流程使用 fixture/injected transport；真实账号的写入证据见“真实 MCP 写闭环补充”一节。三个题型 smoke 仍只覆盖选定题型，不代表 110 个题型的全量真实写入。
- 显式真实验证也已完成：`WJX_E2E=1 WJX_E2E_VID=37138404 node --test __tests__/agent-real-e2e.test.mjs`（CLI `1/1` 通过）；`WJX_E2E=1 WJX_E2E_VID=37138404 node --test tests/wjx-mcp-server.test.mjs`（MCP `3/3` 通过）。另以 `WJX_E2E=1 WJX_REAL_QTYPE_EVAL=1 WJX_USERNAME=xiajinhu WJX_REAL_QTYPE_ONLY=单选,投票单选,考试单选` 重跑真实题型工作流，测试文件共 `6 pass / 0 fail / 0 skip`，三个选定题型的 create/get/彻底删除及清理断言均通过；这不代表 110 个题型已完成全量真实写入。
- 以下门禁均已执行并通过：`capability:check`、`agent-contract:check`、`jsonl-capabilities:check`、`documentation:check`、`docs:build`、`docs:check`、CLI `manifest:check`、`protocol:check`、`architecture:check`、`sync-bundled:check`、`perf:startup`。最后一次空闲窗口 `npm run perf:startup --workspace=wjx-cli -- --report` 使用 20 个配对样本并返回 0，覆盖 `wjx --help` 与 completions 的惰性加载路径；Windows 调度抖动只作为诊断说明，不据单次尖峰修改基线。
- 最终 `git diff --check` 通过。未执行 `npm publish`、registry 写入、外部部署或凭据轮换。

### 历史生成契约、镜像与 MCP E2E

- **历史 contract 记录**：`schemaVersion: 1`，`sourceRevision: cb93a1849c9fe4e747785178244ca4238e9ac1a6d85fd4fe5a24160edecec7b3`，MCP annotations `60`，operations `13`，host routes `4`。根文件与 CLI dist 镜像字节一致：`capabilities/agent-contract.json` 与 `wjx-cli/dist/capabilities/agent-contract.json`；当时的 `agent-contract:check` 已验证由源码生成且无漂移。当前 revision 见 2026-09-06 最新复核记录。
- JSONL capability profile：`schemaVersion: 1`，`sourceRevision: 3b2b172e402342d5da1a22b5fa1a9ab3b6aa40594880a2ec0735c43879ef25ec`，`qtypes` 共 `110` 项。canonical skill 的 references 已递归同步到 `skills/`、`.claude/skills/`、CLI bundled 目标，镜像检查通过。
- MCP 已验证 stdio、in-memory 和 HTTP 三种传输；HTTP 验证包含认证失败、请求级凭据隔离和多租户 session 隔离。稳定串行构建后的真实 stdio 只读 smoke 通过：initialize、`60` 个工具发现、`list_surveys`、`get_survey`、`count_responses`；真实 stdio 写闭环见下一节。`get_config` 脱敏、资源/提示及 stderr 凭据不泄露由协议和黑盒套件覆盖。
- HTTP 默认仍是单租户进程级 `WJX_API_KEY`；启用 `MCP_TENANT_MODE=1` 后才按认证会话解析请求级凭据/租户上下文。两种模式的日志与错误只保留掩码或引用，不把 API key 写入 fixture、stdout、stderr 或生成物。
- CLI 补全脚本已集中到无运行时依赖的 `src/lib/completions.ts`，根入口对精确的 `completion bash|zsh|fish` 请求提前返回；补全相关测试和架构测试均通过，避免静态脚本生成加载完整命令图的启动开销。Windows 进程调度可能使诊断报告的 p95 偶发尖峰，门禁以串行空闲窗口的 `--enforce` 结果为准，未据尖峰更新基线。

### 历史 Windows 真实 API 只读证据与短链接边界

- 当前 Windows 安装的 `wjx 0.4.2` 通过 `wjx doctor --format json`，API 连接正常且 API key 只显示掩码。真实只读验证成功：`wjx survey list --page 1 --page_size 1`（`total_count=257`）、`wjx survey get --vid 37138404`（有效答卷 `564/566`）、`wjx response count --vid 37138404`（`total_count=564`、`join_times=564`）、`wjx response query --vid 37138404 --page_index 1 --page_size 1`（返回 1 条、分页总数 `564`）。
- `wjx survey preview-url --vid 37138404` 是本地 URL helper，返回 `https://www.wjx.cn/vm/37138404.aspx`；`--sid 37138404` 按设计拒绝纯数字 sid。`--sid abc123` 即使构造成功也只是本地 `noAuth` URL smoke，不属于真实 API E2E，不能作为服务端链接验证。
- 本地 NPS/CSAT 验证覆盖空数据（`no-data`、分数 `null`）、NPS 样例 `-17` 和 CSAT 样例 `0.4`。未把启发式或空样本当成统计结论。
- 短链接 SDK/CLI/MCP 能力已实现并有 fixture/协议测试。真实调用 `https://www.wjx.cn/openapi/shortlink.aspx` 已验证两种输入：无参数和带 `sojumpparm`/`parmsign` 的 URL 均返回 HTTP 200、`success: true`，结果为 `https://tp.wjx.com/s/<动态短 ID>`；本地 CLI 与 stdio MCP 入口对带参数 URL 也分别返回 `success: true`。短 ID 随调用变化，不将某一次返回值固化为合同。数字 `/m/<vid>.aspx` 仍可能被上游以 `url参数不合法` 拒绝，这是服务端 URL 合法性限制，不是客户端绕过条件。

### 历史能力映射、风险与发布前提

- SurveyMonkey/腾讯问卷的常见模式已映射到当前可证明能力：问卷生命周期、题型/枚举发现、响应查询、NPS/CSAT、短链接、异步任务、MCP resources/prompts、HTTP 租户隔离。随机化、配额、piping、多语言、无障碍评分、题库等当前 API/代码没有证据，已列为 intentional gaps，不对 Agent 做虚假承诺。
- `query_responses_realtime` 的不可重放/高风险标记属于 Agent contract 层策略；CLI metadata 和退出码未因该标记改变。实际提升风险的命令均有 `--yes` 和非交互拒绝测试；CLI 当前 `CONFIRMATION_REQUIRED` 退出码为 `3`，`--dry-run` 优先于确认且保持无网络。
- MCP skill 通过 GitHub `degit` 分发，而当前开发 remote 为 Codeup；对外分发前必须先完成 Codeup → `wjxcom/wjx-ai-kit` 的同步。这是发布前提，不是本地测试失败。
- 当前工作树仍是未提交状态，并包含本计划所需的新增脚本、契约/profile、测试和镜像文件；未删除用户已有改动。

### 历史真实 MCP 写闭环补充（2026-09-05，独立 stdio 会话）

此前记录中的“没有真实 MCP 写操作”只描述了早先的只读窗口，现已由以下显式授权的临时问卷试验补充。每次试验都使用唯一标题、同一个本地 `StdioClientTransport` 会话，API key 只由 `~/.wjxrc` 读取并保持脱敏；任何提交或删除结果不明确时均未重放原写请求。

#### 历史成功提交闭环（历史证据，独立 stdio 会话）

| 阶段 | 脱敏证据 |
|---|---|
| 创建 | 唯一标题 `codex-mcp-e2e-mtpd5d61-c9c05d`；`create_survey_by_json({ atype: 1, publish: false })` 返回 `result=true`、`outcome=verified`、`status=draft`；`vid=383528424`，读回题型 `q_type=3/q_subtype=3`、`q_index=2`。 |
| 发布 | `update_survey_status({ vid: 383528424, state: 1 })` 只发送一次，返回 `result=true`、`outcome=verified`、`status=published`；发布后只读读回 `status=1`、`version=1`。 |
| 准备提交 | `build_submit_template` 生成基于服务端原始题号的 `submitdata=2$1`；提交前 `count_responses` 为 `total_count=0/join_times=0`。 |
| 提交 | `submit_response({ inputcosttime: 5, submitdata: "2$1", jpmversion: 1, sojumpparm: "codex-<unique-suffix>" })` 只发送一次，使用唯一 `sojumpparm`，返回 `result=true`、`outcome=verified`、`jid=127710312560`；`structure/status/count` 已按答卷身份和计数读回验证，`link=true` 是该操作不暴露答题链接的“不适用”标志，并非 URL 可访问性证明。 |
| 验证答卷 | 按 `jid` 查询返回 1 条；提交后 `count_responses` 为 `total_count=1/join_times=1`。MCP 工具内部已按同一 `jid` 完成读回身份验证。 |
| 清理与删除 | `clear_responses(reset_to_zero=true)` 只发送一次，返回 `result=true`、`outcome=verified`，读回 `beforeCount=1/afterCount=0`；随后 `delete_survey(completely_delete=true)` 只发送一次并返回 `result=true`、`outcome=verified`、`status=hard-deleted`。最终 `get_survey` 为数值 `status=4`，`list_surveys(status=4)` 精确命中同一 `vid` 且 `answer_total=0`。 |

该历史窗口的写调用计数为 `{create:1,publish:1,submit:1,clear:1,delete:1}`；没有重试、没有访问 respondent URL，stdio stderr 无输出。`vid=383528424` 与此前 `383522460` 的闭环均仅保留为历史证据，不代表当前最新或稳定的真实提交能力。

#### 失败路径与修复后的复核

- 早先临时问卷 `vid=383523620` 的创建和发布均验证成功，但提交返回上游“发布者在打开问卷之后修改了问卷”的版本错误；没有重试提交，随后一次彻底删除并以 `status=4` 清理。
- 为确认删除轮询修复，另用全新 `vid=383521733` 验证：创建/发布成功；该试验在发布前主动打开答题链接，随后提交收到同一版本错误，未重试且无答卷落库；修复后的 `delete_survey` 自身返回 `outcome=verified/status=hard-deleted`，终态 `get_survey` 为 `status=4`。
- 另一个失败样本 `vid=383520143` 在测试脚本中没有可见的答题链接 GET，且创建/发布、版本读取和提交参数均与成功样本一致，仍收到同类版本保护错误；因此不能把“打开答题链接”写成已证实的唯一根因。可执行结论是：发布后重新读取最新 `version` 和题目结构，再提交；遇到版本保护或未知结果时停止并读回，不重放提交。
- 根因是删除状态的公开 API 最终一致性可能超过原约 4.5 秒轮询窗口。MCP 删除只读轮询现为约 8.5 秒的有界窗口，仍只发送一次删除写请求；“delayed hard-delete state”、计数未知、身份核对和通用验证门禁等聚焦回归测试共 `23/23` 通过。
- 真实读取还证明题号不能固定假设从 2 开始：同一工具在其他线上问卷返回过 `q_index=1`。CLI/MCP skill 已改为“始终以 `get_survey`/`submit-template` 返回的原始 `q_index` 为准”，并完成 CLI 镜像同步。
- 额外只读审计显示本轮生成的问卷均已达到 `status=4` 且 `answer_total=0`；此前唯一回收站遗留 `vid=383479891`（标题 `codex-agent-real-20260905-8f3c2a`）已通过一次 `delete_survey(completely_delete=true)` 收敛为 `status=4`，随后 `status=3` 列表为空。

## 最新复核记录（2026-09-06）

本节是当前执行状态的唯一依据；2026-09-05 记录仅作为历史审计窗口保留。验证按 wjx-api-sdk → wjx-mcp-server → wjx-cli 串行重建后执行，避免共享 `wjx-api-sdk/dist/` 时产生构建竞态。

### 构建、测试与门禁

- `wjx-api-sdk`：`669 tests / 669 pass / 0 fail / 0 skip`。
- `wjx-mcp-server`：`357 tests / 356 pass / 0 fail / 1 skip`；跳过项是未设置 `WJX_E2E=1` 时的真实 stdio 只读 smoke。
- `wjx-cli`：`484 tests / 482 pass / 0 fail / 2 skip`；跳过项是未设置 `WJX_E2E=1` 时的真实只读 smoke，以及默认关闭的真实题型 create/get/delete 工作流。
- 三个 workspace 已串行构建成功。`capability:check`、`agent-contract:check`、`jsonl-capabilities:check`、`documentation:check`、`docs:build`、`docs:check`、CLI `manifest:check`、`protocol:check`、`architecture:check`、`sync-bundled:check` 和 `perf:startup` 均通过；最终 `git diff --check` 通过。
- `perf:startup --enforce` 首次运行受 Windows 进程调度抖动影响而失败（`version deltaP95Ms=189.892`）；不修改基线的复核报告为 `version=18.192ms`、`help=215.498ms`、`completion=13.687ms`，随后重新执行门禁通过，未写入基线。
- 当前 Agent contract 为 `schemaVersion: 1`、`sourceRevision: ff86ca95cfb888b5e544675dadb26bdf190a840abe9b2c1310538ff9fa015128`，包含 MCP annotations `60`、operations `13`、host routes `4`。当前 JSONL capability profile 为 `schemaVersion: 1`、`sourceRevision: 0ae41c7037d5ec4d33b79e2244f7d2f27e8ec811ed4e61731c682eada5d1c0e1`，包含 `110` 个 qtype；契约/profile 的源码生成、CLI 镜像和递归 skill 镜像检查均通过。

### 真实只读 smoke

- CLI：`WJX_E2E=1 WJX_E2E_VID=37138404 node --test __tests__/agent-real-e2e.test.mjs`，`1/1` 通过。
- MCP：`WJX_E2E=1 WJX_E2E_VID=37138404 node --test tests/wjx-mcp-server.test.mjs`，`3/3` 通过；覆盖 initialize、工具发现、`list_surveys`、`get_survey` 和 `count_responses` 的真实只读路径。
- 短链接真实调用也已复核：无参数和带 `sojumpparm`/`parmsign` 的问卷星 URL 均由上游返回 HTTP 200、`success=true`；本地 CLI 与 stdio MCP 入口对带参数 URL 均返回成功。短 ID 为动态值，不固化某一次返回值。
- 以上 smoke 只证明当前账号下的只读连接和协议路径，不证明 respondent 页面提交或稳定真实写入。

### 最新真实 MCP 写试验与协议边界

- 独立复核临时问卷 `vid=383555153`（标题 `codex-mcp-submitlink-20260906-mtpmi892-qrs1xe`）时，`create_survey_by_json({ atype: 1, publish: false })` 和 `update_survey_status({ state: 1 })` 均返回已验证结果；发布后等待约 2.5 秒并重新读取 `version=1`、`q_index=2`，使用唯一 `sojumpparm` `codex-mtpmi892-qrs1xe` 只发送一次 `submit_response({ inputcosttime: 5, submitdata: "2$1", jpmversion: 1, sojumpparm: ... })`，仍收到同一上游版本保护错误。未重放提交；只读计数保持为 0；随后 `delete_survey(completely_delete=true)` 成功，最终 `get_survey` 为 `status=4`。这进一步验证了写请求一次性和失败后清理规则，但仍不能记作成功提交闭环或稳定可重复性证据。
- 最新临时问卷 `vid=383556560` 的创建和发布均成功，发布后状态读回正确。`submit_response` 只发送一次，收到上游版本保护错误“发布者在打开问卷之后修改了此问卷”；未重放提交。随后彻底删除成功，最终 `get_survey` 读回 `status=4`。该试验取代 `383544811` 成为本节最新真实写窗口，进一步证明了失败时停止和清理策略，但不能记作稳定的真实提交闭环。
- 临时问卷 `vid=383544811` 的创建和发布均成功，发布后状态读回正确。`submit_response` 只发送一次，收到上游版本保护错误“发布者在打开问卷之后修改了此问卷”；未重放提交。随后彻底删除成功，最终 `get_survey` 读回 `status=4`。本次试验因此提供了 create/publish/delete 的真实证据，同时明确记录了提交失败和停止策略，不能记作稳定的真实提交闭环。
- respondent 页面协议调查确认填写页 GET 可返回 HTTP 200，填写页使用 `POST /joinnew/processjq.ashx?shortid=<sid>`；请求依赖页面生成的 `starttime`、`source`、`hfAnswerData`、`jqnonce`、cookie、验证码和 JavaScript 计算参数，页面没有显式 `jpmversion`。本轮未发送 respondent 表单 POST，因为无法在不引入不明确提交的情况下完整复现这些会话参数。
- MCP 管理 OpenAPI action `1001001` 只发送 `vid`、`inputcosttime`、`submitdata`、`jpmversion` 等管理接口字段。它与 respondent `processjq` 协议存在边界，当前不能据管理 API 的提交结果宣称真实 respondent URL 访问或稳定代填能力。

### 本轮代码 Review 与修复（2026-09-06）

- **[P1] CLI raw API 未透传 endpoint metadata。** `wjx-cli/src/commands/api.ts` 原先只按 `risk` 设置 `retryBudget`，导致声明 `httpRetryable=true` 的 `survey.list` 不会重试 503/429，且 `response.realtime` 等 `idempotent=false` 的读取路径会按 SDK 默认策略重放网络失败。现已将 `COMMAND_METADATA` 的 `idempotent` 与 `httpRetryable` 转换为 SDK `idempotency`/`httpRetryable` 选项：安全幂等读取使用 `safe`，未声明或明确不可重放的读取使用 `unknown`，所有 raw 写入固定 `unsafe` 和预算 0。
- 新增 `wjx-cli/__tests__/raw-api.test.mjs` 回归覆盖。修复前验证：`survey.list` 首个 503 直接失败，`response.realtime` 连接中断发送 3 次；修复后验证：前者发送 2 次并成功，后者只发送 1 次并报告未知/需读回结果。
- **[P1] MCP `jpmversion` 输入边界。** `wjx-mcp-server/src/modules/response/tools.ts` 已要求正整数，0 和负数在 transport 前拒绝；对应 handlers 回归测试已覆盖。
- **[P1] MCP 清空回收站状态证明不足。** `wjx-mcp-server/src/modules/survey/tools.ts` 在 `getSurvey` not-found 时不再报告 `status=4` 已验证，而是返回 `outcome=unknown`、`verification.status=false` 并要求继续确认；不会重放删除请求。
- **[P1] 短链接超时边界。** `wjx-api-sdk/src/modules/shortlink/client.ts` 已将 response body 清理和 `response.json()` 纳入同一 timeout race，并拒绝超过 Node 定时器上限的 `timeoutMs`；挂起 body 与超大 timeout 回归测试均已覆盖。
- 定向修复验证结果：CLI raw API `6/6` 通过；MCP write verification `30/30` 通过；短链接客户端 `10/10` 通过。后续全量构建、测试与门禁以本节后的最新命令记录为准。
- 本轮最终 fresh 验证：SDK `669 tests / 669 pass / 0 fail / 0 skip`，MCP `357 tests / 356 pass / 0 fail / 1 skip`（真实 stdio 只读 smoke 未设置 `WJX_E2E` 时跳过），CLI `484 tests / 482 pass / 0 fail / 2 skip`（真实只读 smoke 与全量题型真实写入在默认环境跳过）；三包 build、`capability:check`、`agent-contract:check`、`jsonl-capabilities:check`、`documentation:check`、`docs:build`、`docs:check`、CLI `manifest:check`、`protocol:check`、`architecture:check`、`sync-bundled:check`、`perf:startup --enforce` 和 `git diff --check` 均通过。性能门禁在当前 Windows Node 24 环境通过。
- 真实只读复核：`WJX_E2E=1 WJX_E2E_VID=37138404 node --test wjx-cli/__tests__/agent-real-e2e.test.mjs` 为 `1/1`，`WJX_E2E=1 WJX_E2E_VID=37138404 node --test wjx-mcp-server/tests/wjx-mcp-server.test.mjs` 为 `3/3`；未发送任何真实写请求。

### 最新真实题型 E2E 与全局 CLI 升级（2026-09-06）

- 修复真实图片 PK 上传返回协议相对 URL（`//pubnew.paperol.cn/...`）被 harness 误判的问题；新增本地规范化回归测试，并修正 Maxdiff 与只读题型的测试夹具契约。
- 以 `WJX_E2E=1 WJX_REAL_QTYPE_EVAL=1 WJX_USERNAME=xiajinhu` 执行 `node --test --test-name-pattern="every supported qtype completes a real create/get/delete workflow" wjx-cli/__tests__/skill-completeness-evaluation.test.mjs`，110 个 JSONL qtype 的真实 create/get/delete 全量闭环 `1/1` 通过，耗时约 49.9 分钟；只读/Web 编辑器边界全部按预期拒绝，临时问卷由 harness 清理到终态。
- 通过 `npm install -g .\wjx-cli` 将当前工作树安装到 Windows 全局；`wjx --version` 为 `0.4.2`，`wjx doctor --format json` 返回 API 连接正常、SDK `v0.4.2`，API Key 仅脱敏显示。
- Codex 子智能体重新加载 canonical `wjx-cli-use`/`wjx-mcp-use` 后完成宿主验收：CLI 真实只读 smoke `1/1`、MCP stdio `3/3`（60 tools、13 resources、15 prompts 及 list/get/count 链路）通过；Codex 仅覆盖 shell/MCP 层，WorkBuddy、Cowork、Qianwen Work 无可用宿主会话，四宿主 UI 配置、交互安装和 respondent 页面仍未验收。

### 交付判断

主要 Agentic 优化目标已实现：SDK、CLI、MCP 和四宿主引导形成统一的发现、输入预检、计划、确认、执行、读回验证和结构化报告闭环；源码契约、JSONL profile、镜像门禁、fixture golden 流程、风险确认和真实只读 smoke 均已落地。这个结论足以支持小白用户按 CLI/MCP skill 完成已证明的连接、设计、创建、发布、查询和分析路径，但不等于所有真实写入和 respondent 交互都已稳定验收。`383528424` 的成功 create/publish/submit/clear/delete 是已验证的真实闭环证据；2026-09-06 的 `383555153` 和 `383556560` 试验均在唯一一次提交后复现上游版本保护错误并按规则停止。因此已完成至少一条真实闭环，但稳定可重复性仍未证明。该计划也不承诺与 SurveyMonkey/腾讯问卷功能完全等价；下列事项是当前边界、发布前提或未覆盖验证。

### 当前遗留任务

- **发布交付**：当前工作树尚未提交；对外分发前仍需完成代码审阅/提交，并将 Codeup 改动同步到 `wjxcom/wjx-ai-kit` 的 GitHub remote。按计划未执行 `npm publish`、registry 写入、外部部署或凭据轮换。
- **真实写覆盖**：`vid=383528424` 已完成一次真实 create/publish/submit/clear/delete 闭环；后续 `vid=383555153`、`383556560` 均完成 create/publish/delete，但 `submit_response` 仅发送一次即因版本保护错误失败。110 个 JSONL 题型的真实 create/get/delete 已由显式 opt-in harness 全量验证通过，但真实提交稳定性仍未证明；真实问卷设置更新、回收站清理、答卷修改/清空之外的联系人、管理员、部门、标签、子账号等高风险写操作也未做账号 E2E。
- **respondent 与宿主验收**：尚未在 WorkBuddy、Cowork、Codex Work、千问 Work 四个宿主中逐一完成交互式安装和真实 respondent 链接访问；respondent `processjq` 所需的页面会话、验证码和 JavaScript 参数尚未形成可重复测试 harness。HTTP/stdio 协议与请求级租户隔离已有自动化验证。
- **有意能力边界**：随机化/分支、配额、piping、多语言、无障碍评分、题库、batch submit，以及 `atype=8` 新建没有当前 API/代码证据，未作为本计划承诺。

## 最新高风险账号级 E2E 与修复记录（2026-09-06）

本轮针对“问卷设置更新、回收站清理、答卷修改/清空、联系人、管理员、部门、标签、子账号”等高风险接口执行了真实账号级测试，并在测试失败后完成回归修复。测试使用唯一标题、唯一联系人/部门/标签名称；临时问卷和答卷只由测试创建，清理动作使用一次性写请求和只读读回，不触碰已有业务数据。

| 范围 | 结果 | 证据/限制 |
|---|---|---|
| CLI 问卷设置更新 | 真实闭环通过 | 创建临时问卷，读取原设置，提交保持形状的 patch，再读回核对 `post_url_global` |
| CLI 回收站清理 | 真实闭环通过 | 普通删除读回 `status=3`，`clear-bin --vid` 使用彻底删除并读回 `status=4` |
| CLI 答卷提交/修改/清空 | 提交与清空通过；修改结果为 `unknown` | 上游修改接口返回成功但读回分数仍不一致；代码和测试禁止重放，并完成清空与问卷清理 |
| MCP 问卷设置更新 | 真实闭环通过 | stdio 会话中读回并验证设置 |
| MCP 回收站清理 | 真实闭环通过 | 指定 `vid` 使用 `delete_survey(completely_delete=true)`，有界轮询终态 `status=4` |
| MCP 答卷提交/修改/清空 | 清空通过；提交触发上游版本保护后停止 | `submit_response` 只发送一次，未重试；测试仍完成清理，修改仅在可读回时宣称 verified |
| 子账号创建/修改/删除/恢复 | 安全跳过 | 当前账号已有活跃子账号并达到配额；测试不会删除已有账号腾位 |
| 联系人/管理员/部门/标签 | 安全跳过 | 当前环境未配置 `WJX_CORP_ID`，无法安全确定企业通讯录范围；代码路径、参数校验和 fixture E2E 已覆盖 |

本轮修复了 MCP 黑盒成功路径 fixture：指定 `vid` 的 `clear_recycle_bin` 实际走 `DELETE_SURVEY(completely_delete=1)`，fixture 现在按 `status=4` 和允许的 action 断言验证；生产代码继续要求彻底删除必须由读回状态证明，不因旧 fixture 放宽验证。

### 本轮验证结果

- 真实账号 E2E：CLI `3 pass / 2 skip / 0 fail`；MCP `2 pass / 2 skip / 0 fail`。跳过项分别为子账号配额和缺失 `WJX_CORP_ID`；答卷修改的上游不一致被报告为 `unknown`，不是测试失败。
- SDK：`670 tests / 670 pass / 0 fail / 0 skip`。
- MCP：`363 tests / 358 pass / 0 fail / 5 skip`，其中 4 个真实账号写 E2E 和 1 个真实 stdio 只读 smoke 按条件跳过。
- CLI：`491 tests / 484 pass / 0 fail / 7 skip`，包含真实账号写 E2E、真实只读 smoke 和默认关闭的全量真实题型写工作流。
- 本轮已重建 SDK、MCP、CLI；CLI 文档镜像已通过 `npm run sync-bundled` 同步，MCP 黑盒定向测试 `6/6` 通过。根目录契约、文档、构建和性能门禁需在本轮改动后再次串行执行。

### 当前遗留任务修订

- **账号条件遗留**：子账号真实生命周期需在有可用配额的测试账号执行；联系人、管理员、部门、标签需配置并确认正确的 `WJX_CORP_ID` 后执行，不能用未知企业 ID 代替。
- **上游行为遗留**：答卷修改已执行一次真实请求，但服务端读回仍不一致，当前只能返回 `unknown` 并要求人工/后台确认；答卷提交在多个最新临时问卷上触发上游“发布者在打开问卷之后修改”保护，无法据此宣称稳定 respondent/管理 API 提交闭环。
- **发布交付遗留**：工作树尚未提交；Codeup 到 `wjxcom/wjx-ai-kit` 的同步、外部发布和宿主侧安装仍需另行完成。
- **宿主与 respondent 遗留**：WorkBuddy、Cowork、Codex Work、千问 Work 尚未逐一完成交互式安装验收；respondent 页面所需会话参数、验证码和 JavaScript 计算尚未形成可重复 E2E harness。
