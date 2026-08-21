# JSONL 题型参考

本文件只描述 `wjx survey create-by-json` 接受的 JSONL。每个非空行必须是一个完整 JSON 对象，首行必须是问卷基础信息，后续每行一道题。

> `q_type`、`q_subtype`、`q_title`、`items` 是旧创建接口及部分查询结果使用的内部字段，**不能**作为 `create-by-json` 的输入。JSONL 必须使用中文字符串 `qtype` 以及 `title`、`select`、`rowtitle` 等字段。

## 从模板开始

先让当前 CLI 生成与问卷类型匹配的可执行骨架，再编辑并创建：

```bash
wjx survey jsonl-template --type 1 --raw > survey.jsonl
wjx survey create-by-json --file survey.jsonl
```

模板类型：`1` 调查、`2` 测评、`3` 投票、`6` 考试、`7` 表单、`10` 量表。创建其他 CLI 支持的类型时，以 `wjx survey create-by-json -h` 的实时输出为准。

## 基本格式

```jsonl
{"qtype":"问卷基础信息","title":"客户满意度调查","introduction":"感谢您的参与","atype":1}
{"qtype":"单选","title":"您对本次服务是否满意？","select":["满意","一般","不满意"]}
{"qtype":"多选","title":"您希望改进哪些方面？","select":["产品","服务","价格"]}
{"qtype":"简答题","title":"您还有什么建议？"}
```

首行的 `qtype` 必须是 `问卷基础信息`。至少再提供一道真实题目；仅有元数据、分页或说明文字不能创建有效问卷。

## 常用字段

| 字段 | 用途 |
|------|------|
| `qtype` | 必填；使用下文列出的中文题型名 |
| `title` | 问卷标题或题目正文 |
| `atype` | 首行问卷类型：1=调查, 2=测评, 3=投票, 6=考试, 7=表单, 10=量表, 11=民主测评 |
| `introduction` | 首行问卷说明 |
| `endpageinformation` | 首行提交完成页说明 |
| `language` | 首行语言，默认 `zh` |
| `select` | 普通选择题的选项；矩阵题的列选项；NPS 量表的必填分值序列 |
| `rowtitle` | 矩阵题的行标题；比重题或表格题的项目/字段 |
| `requir` | 是否必答，默认 `true`；设为 `false` 时还需把同一题目标题传入 `--optional_titles` |
| `randomchoice` | 是否随机排列选项 |
| `lowlimit` / `uplimit` | 多选、排序等题型的最少/最多选择数 |
| `minvalue` / `maxvalue` | 滑动条、矩阵滑动条、表格数值等题型的数值范围；**不能**代替 NPS 的 `select` |
| `minvaluetext` / `maxvaluetext` | 量表或滑动条两端显示文案；只描述端点，不定义 NPS 的分值范围 |
| `total` | 比重题总值，默认 100 |
| `correctselect` | 考试题正确答案数组 |
| `quizscore` | 考试题分值字符串 |
| `answeranalysis` | 考试题答案解析 |
| `types` / `selects` | 表格组合各列的输入类型和对应选项 |
| `leveldata` | 多级下拉的层级数据 |
| `ext` / `maxsize` / `uploadlimit` | 文件上传的扩展名、大小和数量限制 |

## 常用 qtype

| 场景 | 推荐 qtype |
|------|------------|
| 选择 | `单选`, `多选`, `下拉框`, `排序` |
| 填写 | `单项填空`, `简答题`, `多项填空`, `日期` |
| 评分 | `量表题`, `NPS量表`, `评分单选`, `评分多选`, `评价题` |
| 矩阵 | `矩阵单选`, `矩阵多选`, `矩阵量表`, `矩阵填空`, `矩阵滑动条`, `矩阵数值题` |
| 表格 | `表格数值`, `表格填空`, `表格下拉框`, `表格组合`, `自增表格`, `多项文件题`, `多项简答题` |
| 其他 | `滑动条`, `比重题`, `文件上传`, `多级下拉`, `门店选择` |
| 页面结构 | `分页栏`, `段落说明`, `知情同意书` |
| 投票 | `投票单选`, `投票多选` |
| 考试 | `考试单选`, `考试判断`, `考试多选`, `考试单项填空`, `考试多项填空`, `考试简答`, `考试文件`, `考试绘图`, `考试代码` |

使用上表中的精确中文字符串。不要写数字 `qtype`，也不要使用 `radio`、`checkbox`、`rating` 等英文题型名。

## NPS 量表（唯一规范写法）

NPS 题必须使用 `qtype:"NPS量表"`，并提供完整且严格有序的 11 个字符串选项。`select` 定义答卷人实际能选择的分值，**不能省略，也不能用 `minvalue`/`maxvalue` 替代**。下面是唯一规范 JSONL 示例；需要自定义题干或端点文案时，只改对应文字，不改 `select` 序列：

```jsonl
{"qtype":"NPS量表","title":"您向朋友或同事推荐本餐厅的可能性有多大？","select":["0","1","2","3","4","5","6","7","8","9","10"],"minvaluetext":"完全不可能","maxvaluetext":"极其可能"}
```

四个字段的职责如下：`qtype` 选择量表题型；`select` 定义 0 到 10 的可选分值；`minvaluetext` 和 `maxvaluetext` 只定义两端文案。端点文案不会自动生成选项，也不会把没有 `select` 的题变成 NPS 量表。

## 其他受支持 qtype

以下名称适用于更专门的场景；字段结构不明确时先查看当前 CLI 模板或按用户已有的合法 JSONL 结构操作，不要猜字段：

| 类别 | qtype |
|------|-------|
| AI 题型 | `AI追问`, `AI处理`, `AI访谈` |
| 调研模型 | `情景随机`, `BWS`, `MaxDiff`, `图片PK`, `联合分析`, `Kano模型`, `SUS模型`, `品牌漏斗`, `货架题`, `BPTO模型`, `PSM模型`, `价格断裂点`, `层次分析`, `选项分类`, `CATI调研`, `文字点睛`, `心理学实验`, `VlookUp问卷关联`, `循环评价`, `热力图` |
| 预设信息 | `姓名`, `基本信息`, `身份证号`, `国家及地区`, `省市`, `省市区`, `邮箱`, `手机`, `高校`, `邮寄地址`, `社会阶层`, `企业信息` |
| 系统采集 | `设备信息`, `城市级别`, `当前语言`, `当前语音`, `答题录音`, `答卷摄像`, `分页计时器` |

兼容别名包括 `表格数值题`、`表格填空题`、`表格组合题`、`表格自增题` 和 `Maxdiff`。生成新 JSONL 时优先使用表中的规范名称。

## 典型结构

### 矩阵题

`rowtitle` 是行，`select` 是列：

```jsonl
{"qtype":"矩阵单选","title":"请评价以下方面","rowtitle":["响应速度","服务态度"],"select":["差","一般","好"]}
```

### 表格组合

`rowtitle`、`types`、`selects` 长度保持一致。无选项的列在 `selects` 中用空数组占位：

```jsonl
{"qtype":"表格组合","title":"请填写成员信息","rowtitle":["姓名","年龄","角色"],"types":["文本","数字","下拉"],"selects":[[],[],["研发","产品","运营"]]}
```

`types` 支持 `单选`、`多选`、`下拉`、`数字`、`小数`、`日期`、`手机`、`Email`、`文本`。

### 投票

投票问卷首行和命令都显式使用类型 3：

```jsonl
{"qtype":"问卷基础信息","title":"年度方案投票","atype":3}
{"qtype":"投票单选","title":"请选择一个方案","select":["方案 A","方案 B","方案 C"]}
```

```bash
wjx survey create-by-json --file vote.jsonl --type 3
```

### 考试

从考试模板开始，使用考试专用 `qtype`、`correctselect` 和 `quizscore`：

```jsonl
{"qtype":"问卷基础信息","title":"JavaScript 基础考试","atype":6}
{"qtype":"考试单选","title":"下列哪个值是布尔值？","select":["0","true","null"],"correctselect":["B"],"quizscore":"10"}
{"qtype":"考试判断","title":"const 声明的变量可以重新赋值","select":["对","错"],"correctselect":["错"],"quizscore":"5"}
```

```bash
wjx survey create-by-json --file exam.jsonl --type 6
```

### 可选题

题目默认必答。将题目设为选填时，JSONL 和命令参数必须同时声明同一个标题：

```jsonl
{"qtype":"简答题","title":"其他建议","requir":false}
```

```bash
wjx survey create-by-json --file survey.jsonl --optional_titles '["其他建议"]'
```

## 数字题型字段只用于读取结果

`survey get`、`response submit-template` 等输出中仍可能出现 `q_type`、`q_subtype` 和 `q_index`。这些字段用于解释服务端结果和构造答卷，不要复制回 JSONL。使用 `create-by-json` 创建后，问卷基础信息占 `q_index=1`，真实题目通常从 `q_index=2` 开始；提交答卷时始终以 `wjx response submit-template --vid <vid>` 返回的 `q_index` 为准。
