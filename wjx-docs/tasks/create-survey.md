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
- 多项填空在标题中使用 `{_}` 占位符。
- 只有明确指定选填时才在 `optional_titles` 中列出。
- 普通题型当前没有 CLI 创建草稿选项；若必须先不发布，请在 SDK/MCP 中传 `publish:false`，或创建后立即使用状态操作暂停。框架题型省略 `--publish` 会按上述规则默认创建为草稿。创建后可用 `wjx survey get --vid <id> --get_questions` 检查结构。

旧 DSL 仅用于读取、审阅和离线迁移，见 [DSL 兼容](../legacy/dsl.md)。题型字段见 [题型与 JSONL](../reference/question-types.md)。
