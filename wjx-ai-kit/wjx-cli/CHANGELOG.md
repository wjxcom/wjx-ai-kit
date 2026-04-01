# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  - `sso` (3): subaccount-url, user-system-url, partner-url (无需 Token)
  - `analytics` (6): decode, nps, csat, anomalies, compare, decode-push (本地计算，无需 Token)
- **诊断工具**: `whoami`(Token 验证) + `doctor`(环境诊断: Node 版本、Token、API 连接、SDK 版本)
- **stdin 管道输入**: `--stdin` 标志支持从管道读取 JSON 参数，source-aware merge 确保 CLI 显式值优先于 stdin
- **结构化错误协议**: stderr JSON 输出 `{error, message, code, exitCode}`，退出码区分错误类型 (0=成功, 1=API/认证错误, 2=输入错误)
- **双输出格式**: 默认 JSON (stdout) + `--table` 表格模式 (console.table)
- **共享 executeCommand 执行器**: 统一处理 stdin merge、认证、SDK 调用、result===false 检测、错误路由
- **strictInt 验证**: 拒绝 `123abc`、`12.5` 等非法整数输入
- **80 个端到端测试**: 覆盖帮助输出、必填字段验证、错误分类、stdin merge、本地计算输出
