# 题型与 JSONL

`create_survey_by_json` 的输入是 JSONL：每行一个 JSON 对象，不是 JSON 数组。首行必须是问卷元数据，题目从第二行开始。

```jsonl
{"qtype":"问卷基础信息","title":"客户满意度调查","atype":1}
{"qtype":"单选","title":"你使用过哪些服务？","select":["服务 A","服务 B","都没有"]}
{"qtype":"多项填空","title":"姓名 {_}，邮箱 {_}"}
{"qtype":"矩阵单选","title":"请评价服务","rowtitle":["响应速度","专业程度"],"select":["差","一般","好"]}
```

## 输入规则

- `qtype` 必须是 SDK 支持的中文题型名。不要把旧 API 的 `q_type`、`q_subtype`、`q_title`、`items` 直接复制到 JSONL。
- `title` 是题目标题；选择题通常使用 `select`，矩阵题使用 `rowtitle` 和 `select`。
- 题目默认必答；需要选填时使用 `requir:false`，并在调用参数中声明 `optionalTitles`（MCP 字段为 `optional_titles`，CLI 选项为 `--optional_titles`）。
- 每行都必须是合法 JSON；空行会被忽略。JSONL 总大小上限为 1 MB。
- `问卷基础信息` 行可设置 `title`、`introduction`、`endpageinformation`、`language` 和 `atype`。显式调用参数的 `atype` 优先级更高。

生成模板可运行 `wjx survey jsonl-template`，MCP 客户端也可以读取 `wjx://reference/question-types`。

## 基础题型

| qtype | 主要字段 | 用途 |
| --- | --- | --- |
| `单选` | `select` | 只能选择一个选项 |
| `多选` | `select` | 可选择多个选项 |
| `下拉框` | `select` | 下拉选择 |
| `排序` | `select` | 按顺序排列选项 |
| `单项填空` / `简答题` | `title` | 单行或多行文本 |
| `多项填空` | `title` 中写多个 `{_}` | 一个题目包含多个填空 |
| `文件上传` | `ext`、`maxsize`、`uploadlimit` | 上传文件 |
| `日期` | `datelimitstart`、`datelimitend` | 日期输入 |
| `滑动条` | `minvalue`、`maxvalue` | 数值滑动输入 |
| `比重题` | `total` | 分配比例，总和由服务端校验 |

多项填空的占位符数量决定输入框数量。例如 `部门 {_}，岗位 {_}` 会生成两个输入框；不要把 `{_}` 放进 `select`。

## 矩阵与表格

| qtype | q_subtype | 主要字段 | 备注 |
| --- | ---: | --- | --- |
| `矩阵量表` | 701 | `rowtitle`、`select` | 每行一个分值 |
| `矩阵单选` | 702 | `rowtitle`、`select` | 每行选一列 |
| `矩阵多选` | 703 | `rowtitle`、`select` | 每行可选多列 |
| `矩阵填空` | 704 | `rowtitle` | 每行文本输入 |
| `矩阵滑动条` | 705 | `rowtitle`、`minvalue`、`maxvalue` | 每行滑动输入 |
| `矩阵数值题` | 706 | `rowtitle` | 服务端可能降级为普通填空 |
| `表格数值` | 706 | `rowtitle`、`columntype` | 数值表格 |
| `表格填空` | 707 | `rowtitle`、`columntype` | 文本表格 |
| `表格下拉框` | 708 | `rowtitle`、`selects` | 每列独立选项 |
| `表格组合` | 709 | `rowtitle`、`types`、`selects` | 混合输入列 |
| `自增表格` | 710 | `rowtitle`、`selects`、`min_rows`、`max_rows` | 可增加行 |
| `多项文件题` | 711 | `rowtitle` | 每行文件上传 |
| `多项简答题` | 712 | `rowtitle` | 每行文本输入 |

题型名称后缀为“题”的别名（例如 `表格组合题`、`表格填空题`）仍被 SDK 接受，但新文档和新代码优先使用不带后缀的 canonical 名称。

## 评分、模型与预设

- 评分：`量表题`、`NPS量表`、`评分单选`、`评分多选`、`评价题`。
- 专业模型：`BWS`、`MaxDiff`、`图片PK`、`联合分析`、`Kano模型`、`SUS模型`、`品牌漏斗`、`货架题`、`BPTO模型`、`PSM模型`、`价格断裂点`、`层次分析`、`选项分类`、`CATI调研`、`文字点睛`、`心理学实验`、`VlookUp问卷关联`、`循环评价`、`热力图`、`情景随机`。
- 预设信息：`姓名`、`基本信息`、`身份证号`、`国家及地区`、`省市`、`省市区`、`邮箱`、`手机`、`高校`、`邮寄地址`、`社会阶层`、`企业信息`、`知情同意书`。
- AI 题型：`AI追问`、`AI处理`、`AI访谈`。
- 系统字段：`设备信息`、`城市级别`、`当前语言`、`当前语音`、`答题录音`、`答卷摄像`、`分页计时器`。

地区、高校等预设题在缺少 `leveldata` 或关联字段时可能降级为普通填空；需要稳定的级联行为时使用 `多级下拉` 并提供 `leveldata`。

## 投票与考试

投票题使用 `投票单选` / `投票多选`，并把问卷类型设为 `atype:3`。考试使用 `atype:6`，题目可以使用 `考试单选`、`考试判断`、`考试多选`、`考试单项填空`、`考试多项填空`、`考试简答`、`考试文件`、`考试绘图`、`考试代码`。

考试 JSONL 支持以下字段：

- `correctselect`：正确选项序号数组；
- `quizscore`：题目分值；
- `answeranalysis`：答案解析；
- `include`、`answerlists`、`isaigrading`、`aiansweranalysis`：按题型需要使用。

这些字段只在 JSONL 创建路径有明确转换支持；旧 DSL 兼容路径不支持考试答案和分值字段。考试时间等问卷级设置在创建后通过设置接口或编辑页配置。

## 运行时来源

本文解释常用字段。完整 canonical 列表和 `q_type/q_subtype` 映射可通过 MCP Resource `wjx://reference/question-types` 查看；程序化集成请以 SDK 的 `QTYPE_MAP` 为准。
