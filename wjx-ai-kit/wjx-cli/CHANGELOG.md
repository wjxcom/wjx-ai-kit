# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.6] - 2026-04-01

### Added

- **`wjx init` 命令**: 交互式引导配置 API Key、Base URL、Corp ID，保存到 `~/.wjxrc`
  - `*` 标记必填项，方括号脱敏显示当前值，回车保留
  - 自动探测环境变量和配置文件中的现有值作为默认值
  - 验证时使用用户输入的 Base URL
- **配置文件支持**: CLI 启动时自动读取 `~/.wjxrc`，凭据解析优先级: `--api-key` > 环境变量 > 配置文件
- `doctor` 命令新增「配置文件」检查项

### Fixed

- 版本号从 package.json 动态读取，不再硬编码
- `doctor` 中 SDK 版本从 `wjx-api-sdk/package.json` 动态读取
- `strictInt("")` 不再静默返回 0，改为抛出 INPUT_ERROR
- stdin 输入为数组时错误信息正确显示 "got array" 而非 "got object"
- 移除未使用的 `--verbose` 选项和相关代码
- `auth.ts` 移除冗余的 `loadConfig()` 回退（`applyConfigToEnv()` 已在启动时处理）
- `diagnostics.ts` API Key 脱敏格式统一为 4+****+4
- PLAN.md 更新为当前实际状态（目录结构、命令数量、认证方式）

## [0.1.5] - 2026-04-01

### Added

- **`wjx init` 命令**: 交互式引导配置 API Key、Base URL、Corp ID，保存到 `~/.wjxrc`
  - `*` 标记必填项，方括号脱敏显示当前值，回车保留
  - 自动探测环境变量和配置文件中的现有值作为默认值
  - 验证时使用用户输入的 Base URL
- **配置文件支持**: CLI 启动时自动读取 `~/.wjxrc`，凭据解析优先级: `--api-key` > 环境变量 > 配置文件
- `doctor` 命令新增「配置文件」检查项

## [0.1.2] - 2026-03-31

### Changed

- **环境变量重命名**: `WJX_TOKEN` → `WJX_API_KEY`
- **CLI 选项重命名**: `--token` → `--api-key`
- `doctor` 命令新增 `WJX_CORP_ID` 检查（可选，通讯录功能需要）

## [0.1.0] - 2026-03-30

### Added

- **CLI 框架**: Commander.js 入口，支持 `wjx <noun> <verb> [options]` 命令结构
- **11 个命令模块，56 个子命令**:
  - `survey` (14): list, get, create, delete, status, settings, update-settings, tags, tag-details, clear-bin, upload, export-text, url
  - `response` (11): count, query, realtime, download, submit, modify, clear, report, files, winners, 360-report
  - `contacts` (3): query, add, delete
  - `department` (4): list, add, modify, delete
  - `admin` (3): add, delete, restore
  - `tag` (4): list, add, modify, delete
  - `user-system` (6): add-participants, modify-participants, delete-participants, bind, query-binding, query-surveys
  - `account` (5): list, add, modify, delete, restore
  - `sso` (3): subaccount-url, user-system-url, partner-url (无需 API Key)
  - `analytics` (6): decode, nps, csat, anomalies, compare, decode-push (本地计算，无需 API Key)
- **诊断工具**: `whoami`(API Key 验证) + `doctor`(环境诊断: Node 版本、API Key、API 连接、SDK 版本)
- **stdin 管道输入**: `--stdin` 标志支持从管道读取 JSON 参数，source-aware merge 确保 CLI 显式值优先于 stdin
- **结构化错误协议**: stderr JSON 输出 `{error, message, code, exitCode}`，退出码区分错误类型 (0=成功, 1=API/认证错误, 2=输入错误)
- **双输出格式**: 默认 JSON (stdout) + `--table` 表格模式 (console.table)
- **共享 executeCommand 执行器**: 统一处理 stdin merge、认证、SDK 调用、result===false 检测、错误路由
- **strictInt 验证**: 拒绝 `123abc`、`12.5` 等非法整数输入
- **80 个端到端测试**: 覆盖帮助输出、必填字段验证、错误分类、stdin merge、本地计算输出
