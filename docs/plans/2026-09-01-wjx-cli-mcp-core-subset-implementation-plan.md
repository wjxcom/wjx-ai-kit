# WJX CLI/MCP Core Subset Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish an explicit capability matrix and make the CLI and MCP Server equivalent for the supported core business subset, while documenting and enforcing intentional CLI-only gaps.

**Architecture:** The SDK owns reusable business logic. The CLI remains the primary, workstation-oriented surface and projects SDK capabilities through its Catalog; MCP exposes only the core business subset plus explicitly approved convenience tools. A repository-level capability matrix is the contract: every row names the SDK function, CLI Catalog entry, CLI command, MCP tool, status, and rationale for intentional gaps. A read-only checker validates the matrix against built SDK/CLI exports and MCP registrations without making the packages depend on each other.

**Tech Stack:** TypeScript/ESM, Node.js 20+, `node:test`, Commander, MCP SDK, Zod, JSON manifests, npm workspaces.

---

## Scope and non-goals

- Core business subset includes survey read/create/status/settings, response query/count/submit/report/template, preview URL generation, push-payload decoding, and existing analytics calculations.
- CLI-only capabilities remain CLI-only: `init`, `doctor`, profiles, completion, Skill installation/update, local reference/schema surfaces, and workstation configuration.
- `call_api` is intentionally not exposed by MCP. The matrix must record this as `intentional-gap` with the reason that a generic LLM-facing transport would bypass tool schemas, risk annotations, and action constraints.
- No generic MCP approval layer is added. Stdio approval belongs to the host; an HTTP read-only/allowlist mode is a conditional follow-up only if a public HTTP deployment is authorized.
- This work does not publish to npm, alter dist tags, or change release versions. Release remains a separate explicitly authorized operation.

## Matrix contract

Create `capabilities/capability-matrix.json` with schema version 1. Each row has:

```json
{
  "id": "response.submit-template",
  "sdk": ["buildSubmitTemplate"],
  "catalog": "response.submit-template",
  "cli": "response submit-template",
  "mcp": "build_submit_template",
  "status": "core-aligned",
  "reason": null
}
```

Allowed statuses are `core-aligned`, `intentional-gap`, and `cli-only`. A core row must name all four surfaces. A gap row must explain why the missing surface is deliberate. The matrix is the only source for the alignment gate; prose documentation is generated/checked against it.

## Global execution rules

- Use TDD for every behavior change: add a focused failing test, implement the smallest change, then run the package test suite.
- Build SDK before MCP or CLI checks. Do not commit generated `dist` changes unless the existing repository release workflow requires them.
- Every task is independently reviewable and must leave its package tests green.
- Run the repository capability gate after any change to the matrix or a registered surface.
- Do not run `npm publish`.

### Task 1: Add the capability matrix and repository gate

**Files:**
- Create: `capabilities/capability-matrix.json`
- Create: `scripts/check-capability-matrix.mjs`
- Modify: `package.json`
- Create: `wjx-cli/__tests__/capability-matrix.test.mjs`

**Steps:**

1. Add matrix rows for the core subset, CLI-only workstation capabilities, and the `call_api` intentional gap. Include the currently aligned `build_preview_url` row and the three rows to be added in later tasks.
2. Implement the checker. It must load the matrix, reject duplicate IDs and invalid statuses, import the built SDK and CLI Catalog, and scan built MCP modules for `registerTool` names. Require every `core-aligned` SDK export, Catalog ID, CLI command path, and MCP tool name to exist. Require every `intentional-gap`/`cli-only` row to have a non-empty reason. Exit non-zero with row-specific diagnostics.
3. Add root script `capability:check` and a CLI test that runs the checker against the built workspace and verifies the `call_api` gap is explicit.
4. Run `npm run build --workspace=wjx-api-sdk`, `npm run build --workspace=wjx-cli`, `npm run build --workspace=wjx-mcp-server`, and `npm run capability:check`.
5. Commit: `feat: add explicit cli mcp capability matrix`.

### Task 2: Move submit-template generation into the SDK

**Files:**
- Create: `wjx-api-sdk/src/modules/response/submit-template.ts`
- Modify: `wjx-api-sdk/src/index.ts`
- Modify: `wjx-api-sdk/__tests__/sdk-exports.test.mjs`
- Modify: `wjx-api-sdk/__tests__/response.test.mjs` (or the existing response test file)
- Modify: `wjx-cli/src/commands/response.ts`
- Modify: `wjx-cli/__tests__/cli.test.mjs`

**Steps:**

1. Move the existing `SubmitTemplateQuestion`, output types, placeholder rules, and `buildSubmitTemplate` implementation verbatim into the SDK response module, keeping q-index semantics and framework-question skipping unchanged.
2. Export the function and its public types from `wjx-api-sdk/src/index.ts`.
3. Add SDK unit tests covering qtypes 3, 4 (multi-select and ordering), 5, 6, 7 (single/multi matrix), 8, 9, 10, framework qtypes 1/2, and unknown qtypes.
4. Replace the CLI-local implementation with an SDK import and keep the existing command output unchanged.
5. Update CLI tests to import the function from the built SDK and preserve the existing command-level assertions.
6. Run SDK and CLI tests, then `npm run capability:check`.
7. Commit: `refactor: move submit template generation into sdk`.

### Task 3: Add the CLI preview-url command

**Files:**
- Modify: `wjx-cli/src/commands/survey.ts`
- Modify: `wjx-cli/src/catalog/catalog.ts`
- Modify: `wjx-cli/src/lib/command-metadata.ts`
- Modify: `wjx-cli/__tests__/cli.test.mjs`
- Modify: `wjx-cli/__tests__/command-matrix-evaluation.test.mjs`
- Regenerate: `wjx-cli/manifest/commands.json`

**Steps:**

1. Add `survey preview-url` with `--sid`, optional positive `--vid`, and optional `--source`; require `sid` or a positive `vid` before authentication/network setup.
2. Resolve the selected profile base URL and call SDK `buildPreviewUrl`; return the normal ResultEnvelope and support the existing `--format table` path.
3. Add Catalog and metadata entries with read risk and user/bot identities.
4. Add tests for sid-only, vid-only, invalid/missing identifiers, selected profile base URL, and manifest discoverability.
5. Run `npm run manifest:export`, CLI tests, `manifest:check`, `architecture:check`, and the capability gate.
6. Commit: `feat: add survey preview-url command`.

### Task 4: Add the three approved MCP tools

**Files:**
- Modify: `wjx-mcp-server/src/modules/analytics/tools.ts`
- Modify: `wjx-mcp-server/src/modules/response/tools.ts`
- Modify: `wjx-mcp-server/src/modules/response/client.ts`
- Modify: `wjx-mcp-server/src/resources/push-reference.ts`
- Modify: `wjx-mcp-server/src/prompts/index.ts`
- Modify: `wjx-mcp-server/__tests__/tools-handlers.test.mjs`
- Modify: `wjx-mcp-server/__tests__/blackbox-completeness-evaluation.test.mjs`
- Modify: `wjx-mcp-server/tests/wjx-mcp-server.test.mjs`

**Steps:**

1. Register `decode_push_payload` as a local, idempotent tool using SDK `decodePushPayload`, with Zod validation for payload, app key, optional signature, and raw body.
2. Register `count_responses` as a read-only convenience tool. Use `queryResponses` with `page_size: 1` and return the service-provided total count without fetching the full response set; preserve API errors through the existing MCP error wrapper.
3. Export SDK `buildSubmitTemplate` through the MCP response client and register `build_submit_template` as a local, idempotent tool accepting the normalized survey question shape used by `getSurvey`.
4. Update push resource/prompt text to state that the decode tool is available. Add handler, schema, annotation, and black-box discovery tests for all three tools.
5. Run MCP unit/integration tests and the capability gate.
6. Commit: `feat: expose approved core subset tools in mcp`.

### Task 5: Document the explicit differences and conditional HTTP posture

**Files:**
- Modify: `CLAUDE.md`
- Modify: `wjx-mcp-server/CLAUDE.md`
- Modify: `wjx-mcp-server/docs/architecture.md`
- Modify: `wjx-mcp-server/README.md`
- Modify: `README.md`
- Modify: `capabilities/capability-matrix.json`
- Modify: `wjx-cli/__tests__/skill-completeness-evaluation.test.mjs`

**Steps:**

1. Replace “Functionality matches wjx-cli” with the core-subset/CLI-primary policy and link the matrix as the authoritative difference list.
2. Correct MCP surface counts to the values emitted by the current server and describe the three new tools.
3. Document that `call_api` is not exposed and why; document CLI-only workstation capabilities.
4. Add a note that HTTP `--read-only`/allowlist is deferred until an authorized public deployment requirement exists. Do not implement an approval layer or generic call-through in this task.
5. Run `npm run docs:check`, all three package test suites, and the capability gate.
6. Commit: `docs: declare cli mcp core subset boundary`.

### Task 6: Final verification and release handoff

**Files:**
- Modify only files required by failing checks.

**Steps:**

1. Run, in order: `npm run build --workspace=wjx-api-sdk`; `npm run build --workspace=wjx-mcp-server`; `npm run build --workspace=wjx-cli`; `npm run capability:check`; `npm run manifest:check --workspace=wjx-cli`; `npm run sync-bundled:check --workspace=wjx-cli`; `npm run protocol:check --workspace=wjx-cli`; `npm run architecture:check --workspace=wjx-cli`; `npm run docs:check`.
2. Run `npm test --workspace=wjx-api-sdk`, `npm test --workspace=wjx-mcp-server`, and `npm test --workspace=wjx-cli`.
3. Inspect `git diff --check` and `git status --short`; remove only temporary test artifacts created by this work.
4. Confirm no npm publish or dist-tag mutation occurred. Record the final matrix and intentional gaps in the handoff.
