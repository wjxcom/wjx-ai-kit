# WJX AI Documentation Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring every user-facing document, Agent/Skill consumer contract, generated artifact, and capability declaration into agreement with the implemented CLI-primary / MCP-core-subset architecture.

**Architecture:** This is a documentation-alignment pass based on the current working tree, not a repeat of the already implemented SDK/CLI/MCP feature work. Canonical Markdown under `wjx-docs/`, package docs, and source Agent/Skill files are authoritative prose. `docs:build` generates the single-page HTML; `sync-bundled` generates CLI distribution copies. The capability matrix remains the machine-readable contract, with a reverse coverage check so registered surfaces cannot silently disappear from it.

**Tech Stack:** Markdown, JSON, Node.js ESM/CommonJS scripts, npm workspaces, `node:test`, and the existing documentation, capability, protocol, bundle, manifest, and architecture gates.

---

## Scope and source-of-truth rules

- User documentation includes root/package READMEs, canonical pages in `wjx-docs/`, public migration pages, and current CHANGELOG entries. `docs/plans/` is internal process documentation and must not enter the docs manifest or generated HTML.
- Canonical consumer material is `wjx-skills/wjx-cli-use/`, `wjx-skills/wjx-mcp-use/`, and `wjx-agents/*`. `.claude/agents/*` and `wjx-cli/bundled/*` are consumer/distribution copies; do not hand-edit generated copies.
- `skills/wjx-cli-use/` is a tracked local installation mirror, not a new source of truth. When its tracked files change, update from `wjx-skills/wjx-cli-use/` and compare after normalizing line endings.
- Current package versions remain `0.4.1` Unreleased. Do not run `npm publish`, `npm dist-tag`, or any registry write. Preserve all historical CHANGELOG entries, including removed `create*` names.
- JSONL is the only new-survey creation path. DSL is documented only for reading, review, and offline migration of historical material.

## Completion criteria

- SDK is described as the shared business foundation, CLI as the primary complete workstation, and MCP as the secondary/maintenance-mode core business subset.
- Every registered CLI Catalog entry and MCP tool is represented by a matrix row or an explicit, reasoned non-core coverage entry.
- `survey preview-url`, `count_responses`, `build_submit_template`, and `decodePushPayload` are discoverable in the correct user and consumer documentation.
- No current-use claim remains for DSL/old JSON creation, MCP full parity, or nine response tools.
- Canonical Markdown and generated HTML are byte-identical after generation; bundled copies pass the read-only sync check.

### Task 0: Audit the implemented baseline

**Files:**
- Read: `git diff`, `capabilities/capability-matrix.json`, `scripts/check-capability-matrix.mjs`
- Read: `wjx-api-sdk/src/`, `wjx-cli/src/`, `wjx-mcp-server/src/`
- Read: all files listed in Tasks 1-4

**Step 1: Record current facts**

Run:

```bash
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-cli
npm run build --workspace=wjx-mcp-server
npm run architecture:check --workspace=wjx-cli
npm run capability:check
npm run docs:check
npm run sync-bundled:check --workspace=wjx-cli
```

Expected: the current implementation remains green (75 CLI Catalog entries, 59 MCP tools, 25 canonical pages). Do not alter or reset existing user changes.

**Step 2: Produce the documentation inventory**

Search all Markdown, Skill, Agent, and package README files for product positioning, tool counts, creation paths, DSL wording, and the four newly implemented capabilities. Use the inventory to drive only the edits below; do not treat the generated HTML as an independent source.

### Task 1: Make the capability matrix an exhaustive difference contract

**Files:**
- Modify: `capabilities/capability-matrix.json`
- Modify: `scripts/check-capability-matrix.mjs`
- Modify: `wjx-cli/__tests__/capability-matrix.test.mjs`

**Step 1: Add explicit non-core coverage**

Keep all existing core rows. Add a versioned coverage section for every registered Catalog command and MCP tool not represented by a core row, including account/admin/contacts/department/tag/user-system, completion/reference/skill/update, diagnostics, and compatibility tools. Each entry names the exact surface and a reason (`cli-only`, `compatibility`, `diagnostics`, or `intentional-gap`); never use an unbounded catch-all.

**Step 2: Add reverse checks**

Extend `check-capability-matrix.mjs` to reject duplicate coverage entries, stale coverage names, and any discovered Catalog command or MCP tool that appears neither in a matrix row nor in explicit coverage. Preserve all existing forward SDK/Catalog/MCP checks and row-specific diagnostics.

**Step 3: Verify**

```bash
npm test --workspace=wjx-cli
npm run capability:check
```

Expected: PASS and a report that all 75 Catalog entries and all 59 MCP tools are accounted for.

### Task 2: Correct canonical user documentation

**Files:**
- Modify: `README.md`
- Modify: `wjx-docs/index.md`
- Modify: `wjx-docs/concepts/architecture.md`
- Modify: `wjx-docs/concepts/compatibility.md`
- Modify: `wjx-docs/reference/cli.md`
- Modify: `wjx-docs/reference/mcp-tools.md`
- Modify: `wjx-docs/reference/sdk.md`
- Modify: `wjx-docs/tasks/create-survey.md`
- Modify: `wjx-docs/tasks/analyze-responses.md`
- Modify: `wjx-docs/migration.md`
- Modify: `wjx-docs/changelog.md`

**Step 1: Fix the product boundary**

Replace “shared same API capability” and “not three different capabilities” with: SDK is the shared foundation; CLI is the primary full workstation; MCP is the core business subset in secondary/maintenance mode. Link to `capabilities/capability-matrix.json`. State that initialization, diagnostics, profiles, completion, reference/schema, update, and Skill installation are CLI-only, and generic `call_api` is intentionally not exposed by MCP.

**Step 2: Fill new CLI/MCP workflows**

Document `survey preview-url`: prefer `sid`, accept only a positive `vid` fallback, use `sid` when both are present, and distinguish respondent preview/fill links from edit links. Update the create-survey task and CLI reference. Update the analysis task to call `count_responses` before fetching details when volume is unknown.

**Step 3: Correct protocol and migration semantics**

Document `decodePushPayload` in the SDK reference and clarify that SDK callers see raw OpenAPI `result: false` responses while CLI callers see `ok/data/meta` envelopes. Rename the migration section to `CLI 0.4.x`; scope `response download --format -> --suffix` without implying that global CLI `--format` was removed. State that `--json`/`--table` and old creation paths are removed, not deprecated aliases.

**Step 4: Correct JSONL/DSL and current version wording**

Make the canonical changelog say JSONL is the sole creation path and DSL is for read/review/offline migration only. Keep `0.4.1` as Unreleased and explicitly state that no npm registry write has occurred.

**Step 5: Verify**

```bash
npm run docs:check
```

Expected: 25 canonical pages, no unresolved links, no internal process notes.

### Task 3: Align package docs, Agent cards, and Skill references

**Files:**
- Modify: `wjx-api-sdk/README.md`
- Modify: `wjx-mcp-server/README.md`
- Modify: `wjx-mcp-server/docs/architecture.md`
- Modify: `wjx-mcp-server/CLAUDE.md`
- Modify: `wjx-cli/README.md`
- Modify: `wjx-agents/wjx-mcp-expert/README.md`
- Modify: `wjx-agents/wjx-mcp-expert/wjx-mcp-expert.md`
- Modify: `.claude/agents/wjx-survey.md`
- Modify: `wjx-agents/wjx-cli-expert/wjx-cli-expert.md`
- Modify: `wjx-skills/wjx-mcp-use/SKILL.md`
- Modify: `wjx-skills/wjx-mcp-use/references/tools-response.md`
- Modify: `wjx-skills/wjx-mcp-use/references/tools-other.md`
- Modify: `wjx-skills/wjx-mcp-use/references/dsl-and-types.md`
- Modify: `wjx-skills/wjx-cli-use/references/survey-commands.md`
- Mirror: `skills/wjx-cli-use/references/survey-commands.md`

**Step 1: Align MCP positioning and counts**

Change MCP Agent/package descriptions from “all operations” to “core business subset”; retain the secondary/maintenance-mode boundary and correct response references to 11 tools. Do not imply CLI/MCP parity beyond the matrix.

**Step 2: Align workflows and capabilities**

Add CLI `preview-url` usage and `sid` precedence. Add MCP `count_responses`, `build_submit_template`, and `decode_push_payload` guidance. Replace the stale “only consult DSL for deprecated compatibility entry” wording with “consult DSL when reading or migrating historical DSL; new surveys return to JSONL.” Update the DSL troubleshooting row accordingly.

**Step 3: Preserve safety rules**

Keep destructive-operation confirmation, framework-question default-draft behavior, JSONL-only creation, and result-verification rules. Keep generic `call_api` out of recommended MCP workflows.

**Step 4: Verify the tracked mirror**

Compare the relevant `skills/wjx-cli-use` files with `wjx-skills/wjx-cli-use` after CRLF/LF normalization. Do not add `docs/plans` or user-local generated files to the Skill source.

### Task 4: Regenerate artifacts and update current changelogs

**Files:**
- Regenerate: `wjx-docs/wjx-kit.html`
- Regenerate: `wjx-docs/wjx-kit.fragment.html`
- Regenerate: `wjx-cli/bundled/wjx-cli-use/`
- Regenerate: `wjx-cli/bundled/wjx-cli-expert.md`
- Modify: `CHANGELOG.md`
- Modify: `wjx-api-sdk/CHANGELOG.md`
- Modify: `wjx-mcp-server/CHANGELOG.md`
- Modify: `wjx-cli/CHANGELOG.md`

**Step 1: Generate docs and bundle**

```bash
npm run docs:build
npm run sync-bundled --workspace=wjx-cli
npm run sync-bundled:check --workspace=wjx-cli
```

Expected: generated HTML reports 25 pages and current runtime counts; bundled files match their source and the check is read-only.

**Step 2: Update only Unreleased entries**

Add the user-visible boundary, `preview-url`, response convenience/template/push decoding capabilities, and documentation synchronization to each `0.4.1 Unreleased` entry as appropriate. Never delete, reorder, or regenerate historical entries.

### Task 5: Add documentation consumer checks

**Files:**
- Create: `scripts/check-documentation-contract.mjs`
- Modify: `package.json`
- Create: `wjx-cli/__tests__/documentation-contract.test.mjs`

**Step 1: Implement a read-only scanner**

Scan canonical docs, package docs, source Agent/Skill files, and bundled copies for stale current-use claims about old creation paths, full MCP parity, nine response tools, and missing required capability names. Allow historical CHANGELOG and legacy migration references through explicit path-scoped exceptions. Generated HTML is validated by `docs:check`, not by a second independent prose regex set.

**Step 2: Verify diagnostics and green state**

```bash
npm test --workspace=wjx-cli
npm run documentation:check
```

Expected: PASS; any future failure identifies the exact file and stale contract.

### Task 6: Full verification and handoff

**Files:**
- Modify only files required by failing checks.

**Step 1: Run gates in dependency order**

```bash
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-mcp-server
npm run build --workspace=wjx-cli
npm run capability:check
npm run architecture:check --workspace=wjx-cli
npm run manifest:check --workspace=wjx-cli
npm run sync-bundled:check --workspace=wjx-cli
npm run protocol:check --workspace=wjx-cli
npm run documentation:check
npm run docs:check
```

Expected: all commands exit 0; capability reports 75 Catalog entries and 59 MCP tools accounted for; docs:check reports 25 canonical pages.

**Step 2: Run package tests**

```bash
npm test --workspace=wjx-api-sdk
npm test --workspace=wjx-mcp-server
npm test --workspace=wjx-cli
```

Expected: all tests pass. No test may publish packages or mutate registry tags.

**Step 3: Inspect scope**

```bash
git diff --check
git status --short
```

Remove only temporary files created by this work. If a generated artifact is wrong, regenerate it from its canonical source; do not revert unrelated user changes. Final handoff must list changed documentation layers, gate results, and explicitly confirm no npm registry write occurred.
