# DSL 兼容

DSL 文本转换能力仍保留，用于读取旧模板和迁移历史项目；它不是创建接口。新项目的创建入口统一为 CLI `survey create`、SDK `createSurveyByJson` 或 MCP `create_survey_by_json`；JSONL 覆盖更多题型，字段可验证，也更适合 AI 生成、审阅和版本控制。

## 当前边界

当前 CLI、SDK 和 MCP 均不提供 DSL 创建接口。旧版本中的创建命令或函数只能作为迁移资料识别，不能在当前版本执行；`surveyToText` 和 CLI 的 `survey export-text` 继续用于读取和导出 DSL。

## 迁移

1. 用 `wjx survey export-text --vid <id> --raw` 导出旧问卷文本。
2. 在人工审阅或 AI 辅助下离线转换为 JSONL。
3. 用 `wjx survey create --file survey.jsonl --dry-run` 检查请求。
4. 验证题型、选填规则和问卷类型后再发布。
