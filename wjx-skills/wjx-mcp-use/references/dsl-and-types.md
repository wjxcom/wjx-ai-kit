# 题目逻辑与 JSONL 题型

## Survey JSON 与逻辑

问卷内容创建和修改统一使用 Survey JSON（JSONL）；涉及关联、跳题、引用或随机时必须提供 dsl.logic：

```json
{"dsl":{"logic":"logic { if \"2::1\" then show \"3\"; };"}}
```

完整请求的 `jsonl` 是 JSONL 字符串；`dsl` 是对象，只包含 `logic`。无逻辑时省略 `dsl`。不要新增、复制或修改 `relation`、`referselect` 等 JSON 逻辑字段，也不要用 JSON 和 DSL 重复表达同一逻辑。DSL 不支持或校验失败时明确说明限制，不得回退 JSON 或省略逻辑后宣称完成。

SDK 使用 `createSurveyByJson` / `updateSurveyByJson`；CLI 使用 `survey create` / `survey update`；MCP 使用 `create_survey_by_json` / `update_survey_by_json`。普通查询 `getSurvey` / `survey get` / `get_survey` 从实际 XML 返回可编辑的 `dsl.logic`。

仅修改逻辑时提交 `vid + dsl`；修改题目时提交 `vid + jsonl`，可同时提交 `dsl`。修改不会隐式重新发布或迁移创建者。修改请求执行一次，之后从普通查询验证实际保存结果。

服务端将 DSL 解析并转换为 XML 的 Relation、ItemRelation、AnytimeJumpto、ReferTopic 等原生逻辑属性。XML 中不保存 DSL 原文或新增的 DSL 节点。仅修改逻辑时在原 XML 上更新对应属性，保留题目、选项、分页、设置和扩展数据。

```text
创建：Survey JSON -> 题目 XML；dsl.logic -> 原生 XML 逻辑；校验后保存 XML
修改逻辑：实际 XML -> dsl.logic -> AI 修改 -> 原生 XML 逻辑 -> 更新原 XML
```

CLI 示例：

```powershell
wjx survey create --file survey.jsonl --dsl '{"logic":"logic { if \"2::1\" then show \"3\"; };"}'
wjx survey get --vid 12345
wjx --yes survey update --vid 12345 --dsl '{"logic":"logic { if \"2::2\" then show \"3\"; };"}'
wjx --yes survey update --vid 12345 --file survey.jsonl
```

修改问卷结构时，已有的答卷索引保护继续生效；无答卷问卷确需结构变更时显式使用 `--allow-breaking-changes`（SDK 为 `allowBreakingChanges`，MCP 为 `allow_breaking_changes`）。

中文 qtype 创建格式见 tools-survey.md；查询结果中的 q_type/q_subtype 是服务端读取编码。

## 引用方向与答案填入

所有引用固定写为 `from "前面的来源题" to "后面的接收题"`。选项引用使用 `options`，矩阵行标题引用使用 `rows`，来源必须为多选或排序题。题干引用使用 `title`，接收题题干必须先包含来源的 `[qN]` 占位符。

自动填入答题框使用 `reference answer from "5" to "6";`，放在 `logic { ... };` 中并通过 `dsl.logic` 提交。第 5 题必须为普通单选、下拉或普通填空题，第 6 题必须为普通填空题（单项填空或简答题）。仅支持整题引用，不支持多选、矩阵、子项、特殊校验、考试填空或 `raw`；同一接收题只能有一个答案来源。

答案填入保持第 6 题题干不变，允许手工修改答题框，来源答案变化时重新同步。不要把它改为 `reference title`、题干中的 `[q5]` 或 JSON 逻辑字段。读回缺少规则时报告未验证。
