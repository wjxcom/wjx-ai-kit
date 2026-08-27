# 架构与边界

```text
AI 客户端 / 脚本
   ├─ wjx-cli（默认入口）
   ├─ wjx-mcp-server（MCP 客户端可选）
   └─ wjx-api-sdk（Node.js 程序集成）
          └─ 问卷星 OpenAPI
```

CLI 与 MCP 共享 SDK；分析和 SSO 的部分能力在本地完成。MCP 的 stdio 适合本机客户端，HTTP 适合受控的服务化部署。

Agent、Skill 是工作流提示和参考资料，不是新的 API 层。它们应调用 CLI 或 MCP，不应复制一份独立的参数真相。

用户体系是例外的兼容边界：MCP/CLI 仍保留历史参与者和绑定工具，但这些能力已标记为 Deprecated，创建接口不支持新建 `atype=8`。新项目不应以用户体系作为架构依赖。
