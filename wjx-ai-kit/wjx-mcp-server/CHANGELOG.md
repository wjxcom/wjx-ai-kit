# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2026-03-30

### Added

- **wjx-ai-kit monorepo**: unified platform with npm workspaces (`wjx-api-sdk`, `wjx-mcp-server`, `wjx-cli`)
- **wjx-api-sdk** (v1.0.0): zero-MCP-dependency SDK extracted from wjx-mcp-server
  - 50+ API functions across 7 modules (survey, response, contacts, user-system, multi-user, SSO, analytics)
  - `setCredentialProvider()` hook for pluggable multi-tenant credential injection
  - Optional `Logger` callback replacing hardcoded `console.error`
  - Lazy URL getter functions for delayed environment variable evaluation
  - 506 unit tests (12 test files, 3 new: sdk-exports, logger-callback, credential-provider)
- **wjx-cli skeleton**: package.json placeholder for future CLI implementation

### Changed

- MCP server now depends on `wjx-api-sdk` via workspace link
- All module `client.ts` and `types.ts` files replaced with re-exports from SDK
- Core `api-client.ts`, `constants.ts`, `types.ts` replaced with re-exports from SDK
- `setCredentialProvider` type signature now accepts `undefined` to clear the provider
- Authentication: single Bearer Token (`WJX_TOKEN`) only, all SHA1 signing code removed
- Total tests: 827 → 722 (consolidated: 506 SDK + 216 MCP server, deduplicated)

### Removed

- `src/core/sign.ts`, `src/modules/sso/sign.ts`, `src/sign.ts` (SHA1 signing)
- `SignableRecord` type, `timestamp` parameter from all API functions
- Duplicate test files from MCP server (moved to SDK)

## [2.2.0] - 2026-03-29

### Added

- **`upload_file` tool** (action 1000104): upload images for surveys via Base64, supports png/jpg/gif/jpeg/bmp/webp
- **`bind_activity` tool** (action 1002004): bind surveys to user systems with answer limits, modification rights, and visibility controls
- **`create_survey` copy mode**: `source_vid` parameter to create surveys by copying an existing one, plus `creater`, `compress_img`, `is_string` params
- **`get_survey` extended params**: `get_exts`, `get_setting`, `get_page_cut`, `get_tags`, `showtitle` for richer survey detail retrieval
- **`list_surveys` filters**: `creater`, `folder`, `is_xingbiao`, `query_all`, `verify_status`, `time_type`, `begin_time`, `end_time` for advanced filtering
- **`submit_response` submittime**: specify custom submission timestamp
- **`query_survey_binding` filters**: `join_status`, `day`, `week`, `month`, `force_join_times` for participation filtering
- **`query_sub_accounts` mobile**: filter sub-accounts by phone number
- **`add_tag` is_radio**: set tag groups as single-select or multi-select
- `CLAUDE.md` project instructions for AI coding assistants

### Changed

- Total tools: 54 → 56
- Total tests: 723 → 827
- `create_survey` `atype`/`desc`/`questions` now optional (required only when not using `source_vid`)
- `atype` descriptions expanded with all survey types (4=360, 5=360 no relation, 8=user system, 9=teaching eval, 11=democratic review)
- `add_admin` description improved with role number mapping
- `modify_department` description corrected (parentid → order)

### Fixed

- `VERIFY_STATUSES` order corrected: 2=审核中, 3=审核未通过 (was swapped)
- `SURVEY_STATUSES` added missing entries: 4=彻底删除, 5=被审核
- `list_departments` removed unsupported `page_index`/`page_size` parameters (C# backend does not paginate this endpoint)

## [2.1.0] - 2026-03-23

### Added

- **Analytics module** (6 tools): `decode_responses`, `calculate_nps`, `calculate_csat`, `detect_anomalies`, `compare_metrics`, `decode_push_payload`
- **Contacts CRUD** (11 tools): department, admin, and tag management (`list_departments`, `add_department`, `modify_department`, `delete_department`, `add_admin`, `delete_admin`, `restore_admin`, `list_tags`, `add_tag`, `modify_tag`, `delete_tag`)
- **HTTP transport**: Streamable HTTP mode via `--http` flag with Bearer token auth, `/mcp` and `/health` endpoints
- **Webhook resource**: `wjx://reference/push-format` push format guide
- **Webhook prompt**: `configure-webhook` guided setup prompt
- **CI/CD**: GitHub Actions workflows for CI (`ci.yml`) and npm publish (`publish.yml`)
- **Templates**: GitHub issue templates (bug report, feature request) and PR template
- **Documentation**: README, CONTRIBUTING.md, architecture guide, API reference

### Changed

- Total tools: 37 → 54
- Total resources: 6 → 7
- Total prompts: 9 → 10
- Total tests: ~391 → 723

### Fixed

- `decode_push_payload` description corrected from "HMAC-SHA1" to "SHA1(rawBody+appKey)"
- `get_360_report` annotation `idempotentHint` corrected to `false` (first call creates server-side task)
- NPS prompt `q_type` guidance corrected
- Sentiment analysis wrong type codes fixed
- Question type codes corrected in reference data
- `GET_WINNERS` action code fixed
- JSON parse context improvements
- Zod validation edge cases fixed
- 20 total audit fixes across all modules

## [2.0.0] - 2026-03-21

### Added

- **Survey module** (10 tools): CRUD, settings, status management
- **Response module** (10 tools): query, export, 360 reports, lottery, realtime
- **Contacts module** (3 tools): query, add, manage contacts
- **SSO module** (4 tools): SSO URL generation with ordered signature
- **User system module** (5 tools): user system management
- **Multi-user module** (5 tools): multi-user management
- **Resources** (6): survey reference, analysis reference, question types, survey statuses, action codes, error codes
- **Prompts** (9): design-survey, analyze-results, create-nps-survey, nps-analysis, csat-analysis, cross-tabulation, sentiment-analysis, survey-health-check, comparative-analysis
- Core API client with SHA1 signature, retry with exponential backoff, trace ID
- Zod v4 input validation for all tools
- Comprehensive test suite (391 tests)

## [1.0.0] - 2026-03-19

### Added

- Initial release
- Basic survey and response tools
- stdio transport
