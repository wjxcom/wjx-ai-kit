# 宿主中立握手与路由

本参考适用于 WorkBuddy、Cowork、Codex Work 和 Qianwen Work。宿主名称不代表当前会话已经提供某项能力；每次任务都必须检查实际可用的 MCP 工具/资源和 shell。不要猜测宿主专用的环境变量、配置路径、插件 API 或密钥位置。

## 握手顺序

按下面顺序完成一次握手，并在报告中说明探测到的能力：

1. 检查当前会话实际暴露的 MCP tools 和 resources。工具或资源列表为空时，不要把宿主名称当作 MCP 已连接的证据。
2. 如果有 shell，运行 `wjx --version` 并记录退出状态和版本；命令不可用只说明当前 shell 不能调用 CLI，不足以证明 Node.js 或 CLI 未安装。
3. 为本次任务选择一个业务协议：
   - 任务已经使用 CLI 或 MCP 时，继续使用已选协议。
   - 两者都可用且尚未选定时，CLI 用于 setup、local design 和 local file workflows；MCP 用于 connected business reads/writes。
   - 只可用 CLI 时，用 CLI 完成可发现的本地和业务流程；只可用 MCP 时，用 MCP 完成已暴露的业务工具，并说明 CLI-only 的 setup 能力不可用。
   - 选择后只使用一个协议；只有当前协议报告 capability failure 时才重新握手并切换。
4. 如果既没有可用 MCP 工具/资源，也没有 shell，停止业务操作，请宿主启用所需能力；不要编造工具、命令或结果。
5. 安装或写入 Skill 时，优先使用明确的 `--target-dir`。没有明确目标目录时，只使用宿主提供的工作区/Skill 目录；目标不明确就停止并请求目录，不要猜测路径。

## 四个宿主的使用方式

WorkBuddy、Cowork、Codex Work、Qianwen Work 都遵循同一握手。对每个宿主只检查当前会话能实际调用的能力，并使用宿主自己的环境/密钥配置界面；本文不假定任何宿主专用变量或固定文件位置。

## 业务生命周期

先识别用户意图，再按已选协议执行：setup -> design -> create -> publish -> collect -> analyze -> admin。创建、发布、提交、设置替换和清理前说明目标与副作用；写入完成后读取结构、状态、计数或经校验的链接作为证据。协议切换、凭据失败和能力缺失都要明确报告，不能用另一个协议的猜测结果补齐。

相关能力和安全规则以生成的 `capabilities/agent-contract.json`、`capabilities/jsonl-qtypes.json` 及 [CLI 使用指南](../SKILL.md) 为准。
