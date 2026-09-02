# 架构与边界

```text
AI 客户端 / 脚本
   ├─ wjx-cli（默认入口）
   ├─ wjx-mcp-server（MCP 客户端可选）
   └─ wjx-api-sdk（Node.js 程序集成）
          └─ 问卷星 OpenAPI
```

SDK 是共享业务基础层，负责认证、传输、重试、问卷/答卷业务函数和本地分析；CLI 在其上提供完整的 Runtime、Catalog、工作站配置、补全和 Skill 安装；MCP Server 在其上提供面向原生 MCP 客户端的核心业务子集。MCP 处于 secondary / maintenance-mode，具体差异由仓库 [能力矩阵](../../capabilities/capability-matrix.json) 定义。MCP 的 stdio 适合本机客户端，HTTP 适合受控的服务化部署。

Agent、Skill 是工作流提示和参考资料，不是新的 API 层。它们应调用 CLI 或 MCP，不应复制一份独立的参数真相。

CLI 的 `init`、`doctor`、profile、completion、reference/schema、update 和 Skill 安装属于工作站能力，不要求 MCP 对齐。MCP 不暴露通用 `call_api`，以避免 LLM 绕过 Tool schema、风险标注和 action 约束。

用户体系是例外的兼容边界：MCP/CLI 仍保留历史参与者和绑定工具，但这些能力已标记为 Deprecated，创建接口不支持新建 `atype=8`。新项目不应以用户体系作为架构依赖。
