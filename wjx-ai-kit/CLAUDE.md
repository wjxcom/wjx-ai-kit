# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

wjx-ai-kit is a monorepo (npm workspaces) wrapping the Wenjuanxing (问卷星) OpenAPI. Three packages provide the same API surface through different interfaces:

- **wjx-api-sdk** — Zero-dependency TypeScript SDK (50+ functions, foundation layer)
- **wjx-mcp-server** — MCP Server (56 tools, 8 resources, 19 prompts) for AI clients
- **wjx-cli** — Commander.js CLI (67 subcommands) designed for AI Agent consumption

## Build & Test Commands

Build order matters: **wjx-api-sdk must be built first** (both other packages depend on it).

```bash
# Install all workspace dependencies
npm install

# Build (from monorepo root)
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-mcp-server
npm run build --workspace=wjx-cli

# Test (from monorepo root)
npm test --workspace=wjx-api-sdk        # ~623 tests
npm test --workspace=wjx-mcp-server     # ~280 tests
npm test --workspace=wjx-cli            # ~122 tests

# Run a single test file (must build first)
cd wjx-api-sdk && npm run build && node --test __tests__/survey.test.mjs
cd wjx-mcp-server && npm run build && node --test __tests__/sign.test.mjs

# MCP server specific
npm run test:unit --workspace=wjx-mcp-server        # unit tests only
npm run test:integration --workspace=wjx-mcp-server  # integration tests only

# Run MCP server
npm start --workspace=wjx-mcp-server          # stdio mode
npm run start:http --workspace=wjx-mcp-server # HTTP mode

# Run CLI
node wjx-cli/dist/index.js survey list
```

Tests use **Node.js built-in test runner** (`node:test`). Test files are `.test.mjs` (compiled JS). Always build before running tests. No linter or formatter is configured.

## Architecture

```
wjx-cli / wjx-mcp-server  (consumers — both depend on SDK)
         ↓
    wjx-api-sdk            (core — zero dependencies, uses built-in fetch)
         ↓
   问卷星 OpenAPI            (external service)
```

### SDK Function Signature Pattern

Every SDK function follows this uniform 3-parameter signature:

```typescript
async function doSomething(
  input: DoSomethingInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>>
```

The optional `credentials` and `fetchImpl` parameters enable dependency injection for testing and multi-tenant use.

### Module Pattern (shared across packages)

Each module lives in `src/modules/<name>/` with a consistent file convention:

| File | SDK | MCP Server | CLI |
|------|-----|------------|-----|
| `types.ts` | Input/output interfaces | Input/output interfaces | — |
| `client.ts` | API functions calling `callWjxApi()` | Business logic wrapping SDK | — |
| `tools.ts` | — | `registerXxxTools(server)` with Zod schemas | — |
| `<name>.ts` | — | — | `registerXxxCommands(program)` |

Registration pattern: both MCP server and CLI use `register<Module>Xxx(parent)` functions to plug modules into the server/program.

### Key Core Files

- **SDK core**: `wjx-api-sdk/src/core/api-client.ts` — traceID, retry with backoff, AbortController timeout
- **SDK credentials**: `wjx-api-sdk/src/core/credentials.ts` — pluggable credential provider via `setCredentialProvider()`
- **MCP entry**: `wjx-mcp-server/src/index.ts` → `src/server.ts` (`createServer()`) → stdio or HTTP transport
- **MCP context**: `wjx-mcp-server/src/core/context.ts` — AsyncLocalStorage for per-request credentials
- **MCP helpers**: `wjx-mcp-server/src/helpers.ts` — `toolResult()`/`toolError()` used by all tool handlers
- **CLI entry**: `wjx-cli/src/index.ts` — Commander program with preAction hook, loads `~/.wjxrc` via `applyConfigToEnv()`, `--get-completions` short-circuit
- **CLI config**: `wjx-cli/src/lib/config.ts` — `~/.wjxrc` read/write, `applyConfigToEnv()` injects config into `process.env`
- **CLI helpers**: `wjx-cli/src/lib/command-helpers.ts` — `executeCommand()`, `strictInt()`, `requireField()`, `createCapturingFetch()` for dry-run
- **CLI completions**: `wjx-cli/src/lib/completions.ts` — `getCompletions()` walks Commander tree for shell auto-complete

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `WJX_API_KEY` | Yes | 问卷星 OpenAPI API Key |
| `WJX_CORP_ID` | No | 企业通讯录 ID（通讯录相关操作需要） |
| `WJX_BASE_URL` | No | Custom API base URL (default `https://www.wjx.cn`) |
| `MCP_TRANSPORT` | No | `stdio` (default) or `http` |
| `PORT` | No | HTTP mode port (default 3000) |
| `MCP_AUTH_TOKEN` | No | Bearer token for HTTP mode auth |

CLI supports `wjx init` to interactively configure `WJX_API_KEY`, `WJX_BASE_URL`, `WJX_CORP_ID` into `~/.wjxrc`. On startup, CLI loads config into `process.env` (env vars take precedence). Credential resolution: `--api-key` flag > env var > `~/.wjxrc`.

MCP server has its own .env parser (`src/core/load-env.ts`, no dotenv dependency). Resolution: `cwd/.env` first, then package root fallback.

## Conventions

- **ESM-only**: `"type": "module"` everywhere, NodeNext module resolution
- **Node >= 20** required
- **TypeScript strict mode**: ES2022 target, identical tsconfig across packages
- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`
- **dist/ is checked into the repo**
- **No linter/formatter**: no ESLint or Prettier configured
- **Style**: 2-space indent, double quotes, semicolons
- **Git**: branch `develop`, remote on Aliyun Codeup (no `gh`/`glab` CLI available)
- **CLI output protocol**: JSON to stdout, structured errors to stderr, exit codes 0 (success), 1 (API/auth error), 2 (input error)
- **沟通语言**: 使用中文与用户沟通，包括代码注释、提交信息和对话回复
