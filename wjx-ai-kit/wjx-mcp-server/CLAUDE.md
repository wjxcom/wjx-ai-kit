# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

wjx-mcp-server is a Model Context Protocol (MCP) server wrapping the Wenjuanxing (问卷星) OpenAPI. It exposes 54 tools, 7 resources, and 10 prompts to AI clients (Claude, Cursor, etc.). Pure TypeScript, ESM-only, minimal dependencies (`@modelcontextprotocol/sdk` + `zod`).

## Commands

```bash
npm run build          # tsc -p tsconfig.json -> dist/
npm test               # build + run all tests (unit + integration)
npm run test:unit      # build + unit tests only (__tests__/*.test.mjs)
npm run test:integration  # build + integration tests only (tests/*.test.mjs)
node --test __tests__/sign.test.mjs  # run a single test file (must build first)
npm start              # run server in stdio mode
npm run start:http     # run server in HTTP mode
```

Tests use Node.js built-in test runner (`node:test`). Test files are `.test.mjs` (compiled JS, not TS). Always `npm run build` before running tests.

## Architecture

### Entry Flow
`src/index.ts` (loads .env, selects transport) -> `src/server.ts` (`createServer()` registers all modules) -> stdio or HTTP transport

### Module Pattern (src/modules/<name>/)
Each of the 7 modules (survey, response, contacts, sso, user-system, multi-user, analytics) follows a strict 3-file convention:
- **types.ts** — Input/output interfaces
- **client.ts** — Business logic calling `callWjxApi()`. Accepts optional credentials/fetchImpl/timestamp params for testability.
- **tools.ts** — Exports `registerXxxTools(server)` that registers MCP tools with Zod input schemas

### Core Layer (src/core/)
- **api-client.ts** — `callWjxApi()`: traceID generation, signature, POST, retry with exponential backoff (max 2 retries, 0 for writes), 15s timeout
- **sign.ts** — SHA1 sorted-key signature algorithm (sort keys alphabetically, concat non-empty values, append appKey, SHA1)
- **constants.ts** — API URLs, Action enum, timeout/retry defaults
- **types.ts** — Shared types (WjxCredentials, WjxApiResponse, etc.)

### Resources & Prompts
- `src/resources/` — 7 resources registered via `wjx://reference/<name>` URI scheme
- `src/prompts/` — 10 prompts (4 general + 6 analysis: NPS, CSAT, cross-tab, sentiment, etc.)

### Backward Compat Barrel Files
Root-level `src/wjx-client.ts`, `src/sign.ts`, `src/prompts.ts`, `src/resources.ts` are re-exports from modular locations. Don't add new code here.

## Tool Registration Convention

```typescript
server.registerTool("tool_name", {
  title: "...",
  description: "...",
  inputSchema: { param: z.string().describe("...") },
  annotations: { destructiveHint, idempotentHint, openWorldHint: true, title },
}, async (args) => {
  try {
    const result = await clientFunction(args);
    return toolResult(result, result.result === false);
  } catch (error) {
    return toolError(error);
  }
});
```

All handlers use `toolResult()`/`toolError()` from `src/helpers.ts`.

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `WJX_APP_ID` | Yes | 问卷星 OpenAPI developer ID |
| `WJX_APP_KEY` | Yes | Signing key |
| `MCP_TRANSPORT` | No | `stdio` (default) or `http` |
| `PORT` | No | HTTP mode port (default 3000) |
| `MCP_AUTH_TOKEN` | No | Bearer token for HTTP mode |

The server has its own .env parser in `index.ts` (no dotenv dependency).

## Conventions

- **ESM-only**: `"type": "module"` in package.json, use NodeNext module resolution
- **Node >= 20** required
- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `refactor:`, etc.
- **No linter/formatter configured**: no ESLint or Prettier in the project
- **dist/ is checked into repo**
