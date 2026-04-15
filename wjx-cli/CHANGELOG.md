# 更新日志

本文件记录项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.12] - 2026-04-03

### Added

- **`wjx init` 参数模式**: `wjx init --api-key <key>` 跳过交互式向导，AI Agent 可无人值守配置
  - `--base-url <url>`、`--corp-id <id>` 可选
  - `--no-install-skill` 跳过技能安装（默认安装）
  - 非 TTY 环境自动检测已有配置，提示使用参数模式
- 新增 3 个测试用例（共 133 个）

## [0.1.11] - 2026-04-03

### Added

- **`wjx skill install/update` 命令组**: 管理 Claude Code 技能安装
  - `wjx skill install [--force] [--silent]` 安装 wjx-cli-use 技能到当前目录
  - `wjx skill update [--silent]` 更新已安装的技能文件
- **`wjx update` 自更新命令**: 执行 `npm update wjx-cli -g`，更新后可选同步更新技能
- **`wjx init` 集成技能安装**: 配置完成后询问是否安装 wjx-cli-use 技能
- **bundled/ 目录**: 技能文件和 agent 定义随 npm 包发布，安装时复制到用户项目
- 所有新命令支持 `--silent` 模式（JSON 输出，适用于 CI/AI Agent）
- 新增 9 个测试用例（共 130 个）

## [0.1.10] - 2026-04-02

### Fixed

- `create-by-text` 使用 SDK 重写的 `createSurveyByText()`（客户端解析 DSL，不再发送原始文本到 API）
- `survey url` 新增 mode 验证，仅接受 `create` 或 `edit`
- `reference` 命令改为从 SDK 的 `LABEL_TO_TYPE` 动态生成 DSL 标签参考（单一数据源）
- `response count` 重写，仅返回 `{ vid, total_count, join_times }`

### Changed

- **移除 `response files` 子命令**: `get_file_links` API 已从服务端移除
- **移除 `--username` 选项**: user-system 命令不再接受 `--username`，与 API 对齐

## [0.1.9] - 2026-04-02

### Fixed

- 修复 `create-by-text` DSL 解析：矩阵题 body 跨空行、Format 1 scaleRange 解析、段落说明过滤

## [0.1.8] - 2026-04-02

### Added

- **`wjx survey create-by-text` 命令**: 用 DSL 文本创建问卷，无需手写 JSON
  - `--text <s>` 直接传入 DSL 文本
  - `--file <path>` 从文件读取 DSL 文本
  - `--type <n>` 问卷类型（1=调查, 6=考试）
  - `--publish` 创建后发布
  - `--dry-run` 预览解析结果（不调用 API）
  - 调用 SDK 的 `createSurveyByText()` 函数
- **`wjx reference` 命令**: 输出命令参考文档
  - `wjx reference` 列出可用主题
  - `wjx reference dsl` DSL 文本语法参考
  - `wjx reference question-types` 题型/问卷类型映射表
  - `wjx reference survey` survey 模块命令参考
  - `wjx reference response` response 模块命令参考
  - `wjx reference analytics` analytics 分析命令参考
- **Claude Code Skill**: `.claude/skills/wjx-cli-use/` 渐进式披露 CLI 使用指南

### Changed

- SDK 新增 `createSurveyByText()`、`parsedQuestionsToWire()` 导出
- MCP Server 去除重复的 `parsedQuestionsToWire`，改为从 SDK 导入
- 测试数从 96 增加到 108

## [0.1.7] - 2026-04-01

### Added

- **`wjx completion` 命令**: Shell 自动补全脚本生成
  - `wjx completion bash/zsh/fish` 输出对应 Shell 的补全脚本
  - `wjx completion install` 自动安装到 Shell 配置文件（检测重复）
  - 隐藏 `--get-completions` 回调端点，动态补全命令、子命令、选项
- **`--dry-run` 全局选项**: 预览 API 请求（不实际发送）
  - 注入捕获式 fetchImpl，显示完整 HTTP 请求（method/url/headers/body）
  - Authorization header 自动脱敏
  - noAuth 命令（sso/analytics）显示输入预览
  - 输出到 stderr，不污染 stdout JSON 协议

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
