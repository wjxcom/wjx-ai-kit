# 创建问卷

## 推荐路径：JSONL

JSONL 每行一个对象，首行是问卷元数据，后续各行是一道题。它能表达当前题型，并且适合 AI 生成、审阅和版本控制。

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

普通题型未传 `--publish` 时默认立即发布。若 JSONL 包含纯框架题型（`折叠栏目`、`轮播图`、`AI追问`、`AI处理`、`AI访谈`、`图片OCR`、`VlookUp问卷关联`、`分页计时器`），则默认创建为草稿，因为这些题型还需要在编辑页补充素材或配置。完成二次编辑并获得用户明确授权后，再显式发布。

先生成可编辑骨架：

```bash
wjx survey jsonl-template --type 1 --raw > survey.jsonl
```

## 投票、考试和表单

使用 `--type` 或 JSONL 首行的 `atype` 指定问卷类型：`1` 调查、`2` 测评、`3` 投票、`6` 考试、`7` 表单、`10` 量表。投票题使用 `投票单选` 或 `投票多选`。

## 创建前检查

- 题目标题不要包含题号或题型标签。
- 多项填空在标题中使用 `{_}` 占位符。
- 只有明确指定选填时才在 `optional_titles` 中列出。
- 先不发布时去掉 `--publish`，用 `wjx survey get --vid <id> --get_questions` 检查结构。

旧 DSL 仅兼容使用，见 [DSL 兼容](../legacy/dsl.md)。题型字段见 [题型与 JSONL](../reference/question-types.md)。
