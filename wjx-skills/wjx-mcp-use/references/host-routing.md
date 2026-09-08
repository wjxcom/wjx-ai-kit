# 宿主中立握手与路由

本参考适用于 WorkBuddy、Cowork、Codex Work 和 Qianwen Work。MCP skill 只描述当前 Server 暴露的业务能力；宿主名称不代表 MCP 已连接，也不代表 CLI 可用。不要猜测宿主专用的环境变量、配置路径、插件 API 或密钥位置。

## 握手顺序

1. 检查当前会话实际暴露的 MCP tools 和 resources，并确认工具 schema 与任务需要的能力相符。
2. 如果有 shell，运行 `wjx --version` 并记录退出状态和版本；命令不可用时继续检查 MCP，不要凭宿主名称推断 CLI 状态。
3. 为本次任务选择一个业务协议：
   - 任务已经使用 CLI 或 MCP 时，继续使用已选协议。
   - 两者都可用且尚未选定时，CLI 用于 setup、local design 和 local file workflows；MCP 用于 connected business reads/writes。
   - 只可用 MCP 时，只调用已发现且 schema 匹配的 MCP 工具；只可用 CLI 时，转到 CLI skill 完成本地或业务流程，并说明原因。
   - 选择后只使用一个协议；只有当前协议报告 capability failure 时才重新握手并切换。
4. 如果既没有可用 MCP 工具/资源，也没有 shell，停止业务操作，请宿主启用所需能力；不要编造工具、命令或结果。
5. 安装或写入 Skill 时，优先使用明确的 `--target-dir`。没有明确目标目录时，只使用宿主提供的工作区/Skill 目录；目标不明确就停止并请求目录，不要猜测路径。

## 四个宿主的使用方式

WorkBuddy、Cowork、Codex Work、Qianwen Work 都遵循同一握手。对每个宿主只检查当前会话能实际调用的能力，并使用宿主自己的 MCP 配置和环境/密钥配置界面；本文不假定任何宿主专用变量或固定文件位置。

## MCP 业务边界

MCP 工具覆盖问卷星核心业务子集。完成 create、publish、collect、analyze 或 admin 前，先读工具 schema 和生成的 contract/profile；创建、发布、提交、设置替换和清理前说明副作用并取得所需确认。写入后必须执行读取验证，超时或缺少结构、状态、计数、链接证据时报告 `unknown`，不要用 CLI 或单页结果猜测补齐。

相关能力和安全规则以生成的 `capabilities/agent-contract.json`、`capabilities/jsonl-qtypes.json` 及 [MCP 使用指南](../SKILL.md) 为准。
