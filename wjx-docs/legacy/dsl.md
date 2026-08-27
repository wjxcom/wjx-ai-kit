# DSL 兼容

DSL 文本创建能力仍保留，用于读取旧模板和迁移历史项目，但已从默认创建路径降级。新项目请使用 JSONL/JSON，因为它覆盖更多题型，字段可验证，也更适合版本控制。

## 现有兼容入口

```bash
wjx survey create-by-text --file old-survey.txt
```

SDK 仍导出 `createSurveyByText`、`textToSurvey`、`surveyToText`；MCP 仍可能发现 `create_survey_by_text`。这些入口会给出弃用提示，不保证新增题型都能用 DSL 表达。

## 迁移

1. 用 `wjx survey export-text --vid <id> --raw` 导出旧问卷文本。
2. 在人工审阅或 AI 辅助下转换为 JSONL。
3. 用 `wjx survey create-by-json --file survey.jsonl --dry-run` 检查请求。
4. 验证题型、选填规则和问卷类型后再发布。
