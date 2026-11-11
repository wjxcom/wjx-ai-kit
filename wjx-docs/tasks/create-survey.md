# 创建问卷

## 推荐路径：JSONL

JSONL 每行一个对象，首行是问卷元数据，后续各行是一道题。它能表达当前可创建的题型；少数题型仅支持读取或 Web 编辑器配置，并且适合 AI 生成、审阅和版本控制。

```jsonl
{"qtype":"问卷基础信息","title":"客户满意度调查","introduction":"用于改进产品和服务"}
{"qtype":"单选","title":"您使用的产品版本？","select":["基础版","专业版","企业版"]}
{"qtype":"量表题","title":"整体满意度","select":["1","2","3","4","5"]}
{"qtype":"单项填空","title":"您最希望改进什么？"}
```

保存为 `survey.jsonl` 后运行：

```bash
wjx survey create --file survey.jsonl --publish
```

普通题型未传 `--publish` 时默认立即发布。若 JSONL 包含纯框架题型（`折叠栏目`、`轮播图`、`AI追问`、`AI处理`、`AI访谈`、`图片OCR`、`分页计时器`、`循环评价`、`考试代码`），则默认创建为草稿，因为这些题型还需要在编辑页补充素材或配置。`VlookUp问卷关联`、`矩阵数值题`、`多项文件题`、`多项简答题` 和 `当前语音` 属于读取/Web 编辑器边界，当前 JSONL 创建接口直接拒绝，不能按草稿路径重试。完成二次编辑并获得用户明确授权后，再显式发布。

创建成功后，如果需要让答卷人预览或填写，使用返回的 `sid` 生成链接：

```bash
wjx survey preview-url --sid <sid>
```

只有接口没有返回 `sid` 时才使用正整数 `vid` 作为后备；同时提供 `sid` 和 `vid` 时始终使用 `sid`。该链接面向答卷人，不是后台编辑链接；编辑请使用 `wjx survey url --mode edit --activity <vid>`。

先生成可编辑骨架：

```bash
wjx survey jsonl-template --type 1 --raw > survey.jsonl
```

## 投票、考试和表单

使用 `--type` 或 JSONL 首行的 `atype` 指定问卷类型：`1` 调查、`2` 测评、`3` 投票、`4` 360度评估、`5` 360评估无测评关系、`6` 考试、`7` 表单、`9` 教学评估、`10` 量表、`11` 民主评议。`8` 用户体系仅作历史维护，不能新建。投票题使用 `投票单选` 或 `投票多选`。

## 创建前检查

- 题目标题不要包含题号或题型标签。
- JSONL 多项填空在标题中使用 `{_}` 占位符。
- 只有明确指定选填时才在 `optional_titles` 中列出。
- 普通题型当前没有 CLI 创建草稿选项；若必须先不发布，请在 SDK/MCP 中传 `publish:false`，或创建后立即使用状态操作暂停。框架题型省略 `--publish` 会按上述规则默认创建为草稿。创建后可用 `wjx survey get --vid <id> --get_questions` 检查结构。

题型字段见 [题型与 JSONL](../reference/question-types.md)，关联条件见 [题目关联逻辑](../reference/wjx-xml-dsl-v1.md)。


## Survey JSON 与逻辑

问卷创建统一使用 Survey JSON（JSONL），修改使用同一内容格式。涉及题目关联时增加可选节点：

```json
{"dsl":{"logic":"logic { if \"2::1\" then show \"3\"; };"}}
```

完整请求的 `jsonl` 是 JSONL 字符串；`dsl` 是对象，只包含 `logic`。无逻辑时省略 `dsl`。已有 `relation/referselect` 字段继续保留，冲突时 DSL 优先。

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
