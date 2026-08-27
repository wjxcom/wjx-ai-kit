# 兼容性与弃用

- Node.js：要求 20+。
- CLI：以 `wjx --version` 和 `--help` 为准；文档不承诺未在源码出现的旧参数。
- MCP Server：当前通过 GitHub 源码安装和运行。
- DSL：保留 `create-by-text`、`createSurveyByText` 和 MCP `create_survey_by_text` 作为兼容入口；新项目使用 JSONL/JSON。

兼容入口可以继续读取旧数据，但不再作为首页、快速开始或 AI 默认生成路径。重大变化记录在 [变更记录](../changelog.md)，迁移动作见 [迁移指南](../migration.md)。
