# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
