# wjx-cli TODOS

Generated from CEO Plan Review (2026-03-30)

## P0: SDK result===false Silent Failure

- [ ] SDK 返回 `{result: false, errormsg: "..."}` 时 CLI 静默输出错误数据到 stdout (exit 0)
- [ ] 在中央执行器中检测 `result === false`，抛出结构化错误
- **Priority:** P0 (blocks all other Phase 2 work)
- **Source:** Codex outside voice

## Phase 2: Agent 基础能力加固

- [ ] Exit code 纪律: 0=成功, 1=API/应用错误, 2=参数/输入错误
- [ ] stderr JSON 错误输出: `{"error":true,"message":"...","code":"API_ERROR|INPUT_ERROR|AUTH_ERROR","exitCode":N}`
- [ ] `--stdin` 输入支持: stdin JSON 作为基础，命令行参数覆盖同名字段
- [ ] 合约测试: 核心 verb 输出 schema 锁定
- [ ] stdin JSON parse failure → 结构化 `INPUT_ERROR` exit 2 (Error GAP #1)
- [ ] parseInt10 → Number() 严格校验，拒绝 '123abc' 类垃圾输入 (Error GAP #2, Codex)
- [ ] requiredOption → option + executeCommand 内手动校验（stdin 兼容）(Codex)
- [ ] program.parse() → program.parseAsync() + exitOverride() + 顶层 catch (Codex)
- [ ] source-aware merge: 用 getOptionValueSource() 区分 CLI 传入 vs 默认值 (Codex)
- [ ] SDK validation error (plain Error) → 映射为 INPUT_ERROR exit 2 (Codex)
- ~~429 rate limit → SDK 已内置重试 (api-client.ts:76-109)，CLI 层无需重复~~
- **Priority:** P1 (prerequisite for all Accepted Scope)

## Phase 2.5: New Commands (5)

Depends on Phase 2 completion.

- [ ] `wjx discover` — 输出所有命令摘要列表 (from CommandSpec registry)
- [ ] `wjx <noun> <verb> --schema` — 输出该命令的 JSON Schema
- [ ] `wjx whoami` — 认证检查 + 环境信息
- [ ] `wjx doctor` — 5 项环境诊断 (token/URL/connectivity/Node/SDK version)
- [ ] `wjx response count --vid <n>` — 快速答卷计数
- [ ] `wjx survey export-text --vid <n>` — JSON 默认, --raw 纯文本
- **Priority:** P2

## Phase 3: Code Generator + 全 56 verb 覆盖

- [ ] 代码生成器从 MCP server Zod schema 读取命令元数据
- [ ] Data-first CommandSpec registry
- [ ] 生成 Commander 注册代码
- [ ] 所有模块 verb 覆盖 (response, contacts, department, admin, tag, user-system, account, sso, analytics)
- **Priority:** P3

## Deferred

- Workflow Primitives (watch, template, workflow DSL)
- Shell 自动补全 (completion)
- MCP↔CLI 双模式 (serve --mcp)
