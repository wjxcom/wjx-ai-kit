# DSL 语法与题型参考

## WJX XML DSL v1

> AI 按本规范直接生成完整 `wjx-dsl 1` 文本，MCP/SDK 负责轻量校验和传输，后端负责最终解析、Diff 与写入。

### 创建、修改和查询工具

- `query_wjx_dsl` 调用 `A1000006`，返回原查询内容和 DSL 往返结果。
- `generate_wjx_dsl` 只校验/规范化 AI 生成的 DSL，不写服务器。
- `create_survey_from_definition` 接收完整 DSL，校验后调用 `A1000109`。
- `update_survey_from_definition` 接收传统 `vid` 和修改后的完整 DSL，校验后一次调用 `A1000110`。
- 不使用结构化 JSON 到 DSL 的隐式转换，也不使用增量 Patch DSL。

### 语法结构

DSL 是花括号文本，**不是** `序号. 标题[题型标记]` 那种旧文本格式，也不接受 `min~max` 之类简写：

- 第一行必须是 `wjx-dsl 1;`，可选 `xml version` / `xml encoding` 声明。
- 根节点是 `questionnaire { ... };`；问卷标题用 `attr "Title" = "..."`。
- 题目为 `question <type> { ... };`，内部用 `attr "Name" = "Value";` 和 `item { ... };` / `row { ... };` 子块。
- 分页用 `page { ... };` 块，不是 `=== 分页 ===`。
- 段落说明用 `question cut { ... };`，不会被静默过滤。
- 字符串一律双引号，布尔/数字/编码也按字符串传输（`"true"` / `"1"`）。
- 未建模的高级字段用 `raw` 显式保留，客户端不删除未知字段。

完整最小示例、逻辑 DSL 和错误码见权威参考 [wjx-xml-dsl-v1.md](../../../wjx-docs/reference/wjx-xml-dsl-v1.md)。

### 题型（基础 Type）

`question <type>` 的 `<type>` 用后端**基础 Type** 名或已验证的**语义别名**，**不要**用 q_type/q_subtype 数字编码，也不要用 `[题型标记]`：

| Type | 说明 | 子块 |
|------|------|------|
| `radio` | 单选 | `item` |
| `radio_down` | 下拉（别名 `dropdown`） | `item` |
| `check` | 多选（`Mode=1` 即排序，别名 `sort`） | `item` |
| `question` | 简答/文本，题型由 `Verify` 决定 | 无（可带 `raw`） |
| `gapfill` | 填空/完形（`GapCount` + 每空一个 `row`） | `row` |
| `fileupload` | 文件上传/签名（别名 `signature`/`drawing`） | 无 |
| `sum` | 比重题（`Total` + 每行一个 `row`） | `row` |
| `slider` | 滑动条 | 无 |
| `matrix` | 矩阵/表格系列，形态由 `Mode` 决定 | `row`、`item` |
| `page` / `cut` | 分页 / 段落说明 | — |

常用语义别名：`scale`（量表）、`true_false`（判断）、`scenario`（情景）、`commodity`（商品）、`multi_level_dropdown`（多级下拉）、`matrix_single`/`matrix_multi`/`matrix_scale`（矩阵单选/多选/量表）、`matrix_fill`（矩阵填空）等。完整别名与 `Mode` 取值以服务端支持矩阵为准。

> 注意：`checkbox`、`text`、`upload`、`weight`、`matrix_radio` 等**不是**后端题型标识；对应能力分别用 `check`、`question`/`gapfill`、`fileupload`、`sum`、`matrix_single`。

### 别名未覆盖的高级题型（raw node）

别名表没有的高级题型用 Generic 别名 `node "Question" { ... }` 直接写：基础 Type + 后端读取的标识属性（`Mode`/`Verify`/`HasValue`/`IsCeShi`/`IsSignature`/`IsQingJing`/`IsEvaluate`/`IsLadder`/`IsTouPiao`/`IsShop`/`IsShelf`/`IsAppointment`/`Relation`/`Height`）。常用取值：NPS=`radio`+`Mode="6"`+`HasValue`；评价星级=`radio`+`IsEvaluate`+`HasValue`；社会阶层=`radio`+`IsLadder`；性别/学历等=`radio`+`Verify="性别"`；手机/日期/邮箱=`question`+`Verify="手机"`/`日期`/`Email`；矩阵高级模型=`matrix`+`Mode`(如 `302`)+`Verify`(`conjoint`/`maxdiff`/`bpto`/`vlookup`/`ocr` 等)；考试题=原题型+`IsCeShi="true"`+`CeShiValue`。完整对照表见权威参考 [wjx-xml-dsl-v1.md](../../../wjx-docs/reference/wjx-xml-dsl-v1.md) 的「高级题型（raw node + 标识属性）」。

> 标识不在 `<Question>` 属性上的题型（热力图、折叠栏目、轮播图、知情同意书、品牌漏斗、部门/其它信息，以及 `langv`/`clock` 等渲染由后端决定的 `Verify`）不要用 raw node 硬凑，改用编辑器或 JSONL 创建（`create_survey_by_json` 传中文 `qtype`，后端会正确落全部标识）。

### 题型示例

```text
wjx-dsl 1;
questionnaire {
  attr "Title" = "员工满意度调查";

  question radio_down {
    attr "Topic" = "1";
    attr "Title" = "您的部门";
    item { attr "ItemTitle" = "技术部"; attr "ItemValue" = "1"; };
    item { attr "ItemTitle" = "市场部"; attr "ItemValue" = "2"; };
  };

  question check {
    attr "Topic" = "2";
    attr "Title" = "您认为最重要的福利";
    item { attr "ItemTitle" = "薪资"; attr "ItemValue" = "1"; };
    item { attr "ItemTitle" = "假期"; attr "ItemValue" = "2"; };
  };

  page {};

  question matrix {
    attr "Topic" = "3";
    attr "Title" = "请对以下维度评分";
    attr "Mode" = "2";
    row { attr "Title" = "沟通效率"; };
    row { attr "Title" = "团队协作"; };
    item { attr "ItemTitle" = "满意"; attr "ItemValue" = "1"; };
    item { attr "ItemTitle" = "一般"; attr "ItemValue" = "2"; };
  };
};
```

### 逻辑与限制

分支逻辑、验证规则、评分权重、随机化等用 DSL 的逻辑动作（`if`/`show`/`hide`/`jump`/`branch`/`reference`/`random`/`raw`）表达；无法安全建模的字段用 `raw` 保留。题型编码、必填属性、矩阵 `Mode` 及高级属性均以服务端能力矩阵为最终准绳。

### 查询结果的中文解读

`query_wjx_dsl`（`A1000006`）返回的往返 DSL 用 **Generic 别名**（`node "Question" { attr "Type" = ...; }`），属性名是后端**英文原名**且原样保留以保证无损往返，DSL 原文不做中文化。向用户解释查询结果时：

- 把英文属性译成中文再讲（`Title` 标题、`Requir` 必答、`Ext` 允许上传的文件类型、`MaxSize` 单文件上限 KB、`ItemImg` 选项图片路径、`ItemImgText` 是否同时显示选项文字、`IsCeShi`/`CeShiValue` 计分/分值 等），未收录的字段保留英文原名并注明是高级/协议字段。
- **列表型字段（尤其 `Ext` 上传类型）必须逐项完整列出，不得截断或概括。**
- 协议值解读：`RandomChoice=1` 表示「全部选项随机」（不是「随机 1 个选项」）；`PartSet "1;5;2"` 表示「从第 1~5 题中随机抽取 2 题展示」。
- 选项图片 `ItemImg` 的值必须是问卷星**已上传图片的相对路径**（非任意外链 URL），凭空 URL 作答页不显示；DSL 编解码对 `ItemImg`/`ItemImgText` 无损透传。

完整对照表与协议值解读见权威参考 [wjx-xml-dsl-v1.md](../../../wjx-docs/reference/wjx-xml-dsl-v1.md) 的「查询结果的中文解读」一节。

### 投票问卷

投票问卷用 `atype: 3`（`create_survey_from_definition` 的 `atype` 参数），题目仍是普通 `radio`/`check`，不存在专门的「投票题型」；`atype` 只控制展示样式。

### DSL 与 JSONL 是两条独立链路

XML DSL（`create_survey_from_definition` → `A1000109`）和 JSONL（`create_survey_by_json` → `A1000106`）互不转换。JSONL 用**中文 `qtype` 字符串**（如 `"单选"`、`"矩阵单选"`），不要传 q_type/q_subtype 数字；XML DSL 用上表的基础 Type 名。两者都不接受 q_type/q_subtype 作为创建输入。

---

## 问卷类型编码

| 编码 | 类型 |
|------|------|
| 1 | 调查 |
| 2 | 测评 |
| 3 | 投票 |
| 4 | 360度评估 |
| 5 | 360评估(无测评关系) |
| 6 | 考试 |
| 7 | 表单 |
| 8 | 用户体系 |
| 9 | 教学评估 |
| 10 | 量表 |
| 11 | 民主评议 |

## 问卷状态码

| 编码 | 状态 |
|------|------|
| 0 | 未发布 |
| 1 | 已发布 |
| 2 | 已暂停 |
| 3 | 已删除 |
| 4 | 彻底删除 |
| 5 | 被审核 |

## 审核状态

| 编码 | 状态 |
|------|------|
| 1 | 已通过 |
| 2 | 审核中 |
| 3 | 未通过 |
| 4 | 待实名 |

## 关于 q_type / q_subtype

`q_type` / `q_subtype` 是服务端内部的题型数字编码，**只出现在查询结果里，不能作为创建输入**：

- XML DSL 创建/修改：用 `question <type>` 的基础 Type 名（见上文题型表）。
- JSONL 创建（`create_survey_by_json`）：用中文 `qtype` 字符串，如 `"单选"`、`"多选"`、`"矩阵单选"`。

两条链路都不接受 `q_type`/`q_subtype` 数字或 `[题型标记]` 作为输入。
