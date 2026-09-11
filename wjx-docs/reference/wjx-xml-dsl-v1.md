# WJX XML DSL v1 参考

## 用途

AI 根据本规范直接生成完整的 `wjx-dsl 1` 文本。CLI、MCP 和 SDK 只负责接收、轻量校验、规范化和传输；问卷星后端负责最终语义校验、DSL 转 XML、变更审查和写入。

## 最小示例

```text
wjx-dsl 1;
xml version = "1.0";
xml encoding = "utf-8";

questionnaire {
  attr "Title" = "员工满意度调查";
  question radio {
    attr "Topic" = "1";
    attr "Title" = "整体满意度";
    attr "Requir" = "true";
    item { attr "ItemTitle" = "满意"; attr "ItemValue" = "1"; };
    item { attr "ItemTitle" = "不满意"; attr "ItemValue" = "2"; };
  };
};
```

## 语法

- 第一行必须是 `wjx-dsl 1;`。
- 可选 XML 声明使用 `xml version` 和 `xml encoding`。
- 根节点是 `questionnaire { ... };`。
- 属性格式为 `attr "Name" = "Value";`。
- 题目格式为 `question <type> { ... };`，题目内可包含 `item { ... };`。
- 字符串使用双引号；双引号、反斜杠和换行必须转义。
- 未知 XML 属性或高级结构使用 `raw` 显式保留，不得静默丢弃。

支持 `//` 到行尾的注释。问卷可包含 `page { ... };` 分页块；分页块内的题目顺序就是该页的顺序，未声明分页时所有题目属于默认页。`questionnaire`、`page`、`question`、`item` 和 `raw` 块都必须以分号结束。属性值统一按字符串传输；布尔值使用 `"true"`/`"false"`，数字和问卷星编码也保持字符串形式，以避免不同语言客户端的类型转换差异。

## 题型和属性

`question <type>` 的 `<type>` 既接受后端**基础 Type**，也接受已验证的**语义别名**（别名会归一到基础 Type，并只补齐作者未显式给出的默认属性）。以服务端支持矩阵为最终准绳；无法安全建模的字段使用 `raw`。

### 基础 Type

| Type | 说明 | 子块 |
| --- | --- | --- |
| `radio` | 单选 | `item` |
| `radio_down` | 下拉（别名 `dropdown`） | `item` |
| `check` | 多选（`Mode=1` 即排序，别名 `sort`） | `item` |
| `question` | 简答/文本，题型由 `Verify` 决定 | 无（可带 `raw`） |
| `gapfill` | 填空/完形（`GapCount` + 每空一个 `row`） | `row` |
| `fileupload` | 文件上传/签名（别名 `signature`/`drawing`） | 无 |
| `sum` | 比重题（`Total` + 每行一个 `row`） | `row` |
| `slider` | 滑动条 | 无 |
| `matrix` | 矩阵/表格系列，形态由 `Mode` 决定 | `row`、`rightrow`、`column`、`item` |
| `page` / `cut` | 分页 / 段落说明 | — |

常用语义别名：`scale`（量表）、`true_false`（判断）、`scenario`（情景）、`commodity`（商品）、`multi_level_dropdown`（多级下拉）、`matrix_single`/`matrix_multi`/`matrix_scale`（矩阵单选/多选/量表）、`matrix_fill`/`matrix_slider`/`matrix_numeric`（矩阵填空/滑块/数字）、`table_fill`/`table_dropdown`/`table_combo`（表格填空/下拉/组合）、`multi_file`/`multi_textarea`（多项文件/多项简答）、`exam_multi_fill`/`exam_cloze`（考试多空填空/完形）。完整别名清单与 `Mode` 取值以服务端支持矩阵为准。

> 注意：`checkbox`、`text`、`multi_text`、`upload`、`weight`、`matrix_radio`、`matrix_checkbox`、`matrix_text` 等**不是**后端题型标识，请勿使用；对应能力分别用 `check`、`question`/`gapfill`、`fileupload`、`sum`、`matrix_single`、`matrix_multi`、`matrix_fill`。

### 通用规则

`Topic` 必须是题目在最终问卷中的引用编号。新增或删除题目后的连续化和逻辑引用重映射由后端完成。题目块可包含 `item`（选项）、`row`（矩阵/填空/比重行）、`rightrow`（矩阵右行）、`column`（矩阵列）和 `raw`（未建模字段）子块。选项用 `item { attr "ItemTitle"; attr "ItemValue"; }`，矩阵行用 `row { attr "Title"; }`。题型编码、必填属性、选项值、矩阵 `Mode` 及高级属性以服务端能力矩阵为准；客户端不根据本地题型表删除未知字段。

### 常见题型示例

多选（`check`；`Mode=1` 即排序）：

```text
question check {
  attr "Topic" = "2";
  attr "Title" = "以下哪些功能你会使用";
  attr "MinValue" = "1";
  attr "MaxValue" = "3";
  item { attr "ItemTitle" = "导出"; attr "ItemValue" = "1"; };
  item { attr "ItemTitle" = "分享"; attr "ItemValue" = "2"; };
  other { attr "ItemTitle" = "其他"; attr "ItemValue" = "3"; };
};
```

填空（`gapfill`；每个空一个 `row`）：

```text
question gapfill {
  attr "Topic" = "3";
  attr "Title" = "我最喜欢的城市是 ___，因为 ___";
  attr "GapCount" = "2";
  row { attr "Title" = "城市"; attr "ItemVerify" = "单行文本"; attr "IsRequir" = "true"; };
  row { attr "Title" = "原因"; attr "ItemVerify" = "多行文本"; };
};
```

简答/文本（`question`；`Verify` 指定校验类型）：

```text
question question {
  attr "Topic" = "4";
  attr "Title" = "请填写你的建议";
  attr "Verify" = "不验证";
  attr "MinWord" = "5";
  attr "MaxWord" = "200";
};
```

矩阵单选（`matrix`；行用 `row`、选项用 `item`）：

```text
question matrix {
  attr "Topic" = "5";
  attr "Title" = "请对以下方面评分";
  attr "Mode" = "2";
  row { attr "Title" = "响应速度"; };
  row { attr "Title" = "界面体验"; };
  item { attr "ItemTitle" = "满意"; attr "ItemValue" = "1"; };
  item { attr "ItemTitle" = "一般"; attr "ItemValue" = "2"; };
  item { attr "ItemTitle" = "不满意"; attr "ItemValue" = "3"; };
};
```

### 高级题型（raw node + 标识属性）

别名表未覆盖的高级题型**今天即可创建**：用 Generic 别名 `node "Question" { ... }` 直接写出后端**基础 Type** 加上服务端序列化器实际读取的**标识属性**。这些属性名是后端 XML 原名，DSL 原样透传（不做本地题型校验、不删未知字段），因此高级子型完全由这组属性决定。

服务端从 `<Question>` 读取的关键标识属性：

| 属性 | 含义 | 典型用途 |
| --- | --- | --- |
| `Mode` | 形态编码 | 矩阵形态、NPS/量表/评价刻度 |
| `Verify` | 文本校验类型 / 高级子型标识 | 简答子型、矩阵高级模型 |
| `HasValue` | 是否带刻度/分值 | NPS、评价、量表、考试选择 |
| `IsCeShi` / `CeShiValue` | 是否计分 / 分值 | 所有考试题 |
| `IsSignature` | 手写签名 / 绘图 | 签名题、考试绘图 |
| `IsQingJing` | 情景随机 | 情景随机题（别名 `scenario`） |
| `IsEvaluate` | 评价星级（配 `IsHalfScore` 半星等） | 评价题 |
| `IsLadder` | 阶梯量表 | 社会阶层 |
| `IsTouPiao` | 投票 | 投票单选 / 投票多选 |
| `IsShop` / `IsShelf` | 商品 / 货架 | 商品题、货架题 |
| `IsAppointment` | 预约 | 预约题 |
| `Relation` = `-1` | 客观信息题（配对应 `Verify`） | 设备信息、企业信息、城市级别等 |
| `Height` | 输入框行数 | 简答（2）、单项填空（1） |

按基础 Type 分组的高级题型写法（`Mode`/`Verify`/标识属性取值以下表为准）：

| 题型 | 基础 Type | 关键属性 |
| --- | --- | --- |
| NPS 量表 | `radio` | `Mode="6"` + `HasValue="true"` |
| 评分量表 | `radio` | `Mode="1"` |
| 评价星级 | `radio` | `IsEvaluate="true"` + `HasValue="true"` |
| 社会阶层 | `radio` | `IsLadder="true"` |
| 情景随机 | `radio` | `IsQingJing="true"`（或用别名 `scenario`） |
| 投票单选 | `radio` | `IsTouPiao="true"` |
| 性别/年龄段/学历/婚姻/职业/行业 | `radio` | `Verify="性别"`（依次 `年龄段`/`学历`/`婚姻`/`职业`/`行业`） |
| 排序 | `check` | `Mode="1"`（或别名 `sort`） |
| 投票多选 | `check` | `IsTouPiao="true"` |
| 商品题 | `check` | `IsShop="true"` |
| 货架题 | `check` | `IsShop="true"` + `IsShelf="true"` |
| 预约题 | `check` | `IsAppointment="true"` |
| 日期/生日 | `question` | `Verify="日期"` |
| 手机 | `question` | `Verify="手机"` |
| 邮箱 | `question` | `Verify="Email"` |
| 姓名/身份证号/高校/密码 | `question` | `Verify="姓名"`（依次 `身份证号`/`高校`/`密码`） |
| 省市 / 省市区 / 国家及地区 | `question` | `Verify="城市单选"` / `省市区` / `国家及地区` |
| 多级下拉 / 门店选择 / 地图 | `question` | `Verify="多级下拉"` / `门店选择` / `地图` |
| 矩阵单选/多选/量表 | `matrix` | `Mode="103"` / `"102"` / `"101"` |
| 矩阵滑动条 / 矩阵填空 | `matrix` | `Mode="202"` / `Mode="201"` |
| 表格数值/组合/填空/下拉 | `matrix` | `Mode="301"` / `"302"`（填空同 302）/ `"303"` |
| 联合分析 / MaxDiff·BWS·图片PK / BPTO / 循环评价 / 心理学实验 | `matrix` | `Mode="302"` + `Verify="conjoint"` / `maxdiff` / `bpto` / `circulate` / `test` |
| PSM 模型 | `matrix` | `Mode="202"` + `Verify="psm"` |
| Kano / SUS / 价格断裂点 | `matrix` | `Mode="101"` + `Verify="kano"` / `sus` / `价格断裂点` |
| 层次分析 / 选项分类 / 文字点睛 | `matrix` | `Mode="103"` + `Verify="level"` / `classify` / `texthighlights` |
| 图片OCR / VlookUp / 设备信息 / 企业信息 / AI访谈 | `matrix` | `Mode="201"` + `Verify="ocr"` / `vlookup` / `device` / `company` / `aiInterview` |
| 签名题 | `fileupload` | `IsSignature="true"`（或别名 `signature`） |
| 考试题（任意基础 Type 计分） | 同原题型 | `IsCeShi="true"` + `CeShiValue="<分值>"`（考试文件 `fileupload`+`IsCeShi`，考试绘图再加 `IsSignature`） |

示例——社会阶层、NPS、手机验证（同一份 DSL 里的三道 raw node 题）：

```text
node "Question" {
  attr "Type" = "radio";
  attr "Topic" = "1";
  attr "Title" = "您的社会阶层";
  attr "IsLadder" = "true";
  node "Item" { attr "ItemTitle" = "上层"; attr "ItemValue" = "1"; };
  node "Item" { attr "ItemTitle" = "中层"; attr "ItemValue" = "2"; };
};
node "Question" {
  attr "Type" = "radio";
  attr "Topic" = "2";
  attr "Title" = "您向朋友推荐我们的可能性";
  attr "Mode" = "6";
  attr "HasValue" = "true";
};
node "Question" {
  attr "Type" = "question";
  attr "Topic" = "3";
  attr "Title" = "请填写手机号";
  attr "Verify" = "手机";
};
```

> 标识落在内容/结构而非 `<Question>` 属性上的题型，**不要**用 raw node 硬凑，改用问卷编辑器或 JSONL 创建（`create_survey_by_json` 传中文 `qtype`，后端会正确落全部标识）：热力图、折叠栏目、轮播图、知情同意书、品牌漏斗（后端展开为多道多选）、部门/其它信息（无对应后端题型）。同理，`langv`（当前语言）、`clock`（分页计时器）等 `Verify` 标识的渲染由后端决定，能力矩阵未确认前优先走 JSONL。

## 逻辑 DSL

后端支持的逻辑动作包括：`if`、`show`、`hide`、`jump`、`branch`、`reference`、`random` 和 `raw`。逻辑引用使用 Topic/Item 标识；`jump` 或 `branch` 的目标可以是 `END` 或有效 Topic。悬空引用、自循环和跳转环由后端最终校验。

## 查询结果的中文解读

`query`（`A1000006`）返回的往返 DSL 使用 **Generic 别名**，题目写成 `node "Question" { attr "Type" = "..."; ... }`，属性名是后端的**英文原名**。这是为了保证 XML↔DSL **无损往返**（属性名、顺序、未知节点、原始协议串都原样保留），因此 DSL 原文**不做中文化**。向用户口头/书面解释一份查询到的 DSL 时，按下面的规则把英文字段翻成中文，但提交回后端的 DSL 仍用英文原文。

### 呈现规则

- 用下表把常见属性译成中文讲给用户；**未列入下表**的字段保留英文原名，并说明它是「高级/协议字段，语义以服务端为准」，不要臆造含义。
- **列表型字段必须完整呈现，不得截断或省略**。典型是文件上传题的 `Ext`（允许的扩展名列表，`|` 分隔）：有多少种就列多少种。
- 遇到 `raw attr "X" ...` 或不认识的协议串，先查下面「协议值解读」；查不到就如实说明「这是后端保留的原始设置，客户端不改写」。

### 常用属性中文对照

| 英文属性 | 中文含义 | 出现位置 |
| --- | --- | --- |
| `Title` | 标题（问卷标题 / 题目标题 / 行标题） | 问卷、题目、行 |
| `Type` | 题型（基础 Type 名，见上文题型表） | 题目 |
| `Topic` | 题号（题目在问卷中的引用编号） | 题目 |
| `Requir` | 是否必答（`true`/`false`） | 题目 |
| `Mode` | 题型形态编码（如矩阵/多选的具体形态） | 题目 |
| `Verify` | 校验类型（简答题决定文本校验方式） | 题目 |
| `MinValue` / `MaxValue` | 取值下限 / 上限 | 题目、矩阵 |
| `MinWord` / `MaxWord` | 最少字数 / 最多字数 | 简答题 |
| `GapCount` | 填空数量 | 填空题 |
| `Total` | 比重合计 | 比重题 |
| `ItemTitle` / `ItemValue` | 选项文字 / 选项值 | 选项 `item` |
| `ItemImg` / `ItemImgText` | 选项图片路径 / 是否同时显示选项文字（`true`/`false`） | 选项 `item` |
| `Ext` | **允许上传的文件扩展名完整列表**（`|` 分隔） | 文件上传题 |
| `MaxSize` | 单文件大小上限（KB） | 文件上传题 |
| `MaxLength` | 允许上传的文件个数 | 文件上传题 |
| `IsCeShi` / `CeShiValue` | 是否计分 / 该题分值 | 考试题 |
| `ReferTopic` / `TitleTopic` | 选项引用题号 / 标题引用题号 | 逻辑引用 |
| `Relation` / `AnytimeJumpto` | 显示关联 / 跳转目标 | 逻辑 |

### 协议值解读（raw / 特殊字段）

- **`RandomChoice`（选项随机）**：`1`（或 `true`）表示「**全部选项随机**」；`N>1` 表示「随机前若干项、保留末 `N−1` 项固定」；`0`/空表示不随机。DSL 里投影为 `random options ... raw "N"`，其中 `raw "N"` 是原始取值——**不要**把它读成「随机展示 N 个选项」。
- **`PartSet`（题目随机设置，问卷级，按题目随机时生效）**：格式为逗号分隔的多组，每组 `起始题号;结束题号;抽取数量`（分号三段）。例如 `1;5;2` = **从第 1~5 题中随机抽取 2 题展示**；省略第三段则展示该区间全部题目。
- **`Ext`（上传类型）**：见上表，是权威的完整白名单，逐项列出，不要只报「支持文档/图片」这类概括。
- **`ItemImg`（选项图片）**：值是问卷星服务器上**已上传图片资源的相对路径**（如 `upfiles/.../x.png`），不是任意外链 URL——填入未上传到问卷星的地址，作答页不会显示图片。选项图片需先经问卷星上传接口/编辑器上传得到该路径后再写入 `ItemImg`；`ItemImgText=true` 时图片与选项文字同时显示。DSL 编解码对 `ItemImg`/`ItemImgText` 无损透传。

## 创建、修改、查询

| 操作 | API | 客户端输入 |
| --- | --- | --- |
| 查询 | `A1000006` | 传统 `vid` |
| 创建 | `A1000109` | 完整 DSL，正文使用 `dsl` 字段 |
| 修改 | `A1000110` | 传统 `vid` + 修改后的完整 DSL |

DSL 创建/修改作用于**普通问卷**，不限定「AI 主页」等特殊类型：创建默认生成调查类型（用 `--type` 指定其它类型），修改针对一个你有权限的既有传统 `vid`。`vid` 不存在或无权限时后端返回 `NotFound`/`Forbidden`（如「问卷不存在」），而非题型限制错误。DSL 与 JSONL（`survey create`）是两条相互独立的创建链路，互不转换。

修改不使用增量 Patch DSL。即使只修改一题，也提交修改后的完整问卷 DSL，由后端 Diff 判断实际变化。更新不使用 CAS、If-Match、receipt 或幂等参数；`allow_breaking_changes` 仅用于显式批准 breaking change，已有答卷时仍遵循后端限制。

## CLI 示例

```bash
wjx dsl generate --file survey.wjx
wjx dsl create --file survey.wjx
wjx dsl update --vid 207550 --file survey.wjx
wjx dsl query --vid 207550
```

`generate` 是可选的校验/规范化步骤。`create` 和 `update` 也可从 `--dsl` 或 stdin JSON 的 `dsl` 字段接收内容；不接受结构化 JSON 自动转换成 DSL。

## MCP 工具

- `query_wjx_dsl`：查询问卷并返回 DSL。
- `generate_wjx_dsl`：校验/规范化 DSL，不写服务器。
- `create_survey_from_definition`：校验 DSL 后调用 `A1000109`。
- `update_survey_from_definition`：校验 `vid` 和完整 DSL 后调用 `A1000110`。

旧的 `create_survey_by_wjx_dsl` 和 `update_wjx_dsl` 不作为 MCP 工具暴露；SDK 底层函数仍保留供客户端内部调用。

## SDK 示例

```ts
import { createSurveyByWjxDsl, queryWjxDsl, updateWjxDsl } from "wjx-api-sdk";

const current = await queryWjxDsl({ vid: "207550" });
const created = await createSurveyByWjxDsl({ dsl });
const updated = await updateWjxDsl({ vid: "207550", dsl: revisedDsl });
```

SDK 只做 UTF-8 大小、头部、根节点、字符串和花括号等协议校验，并规范化 BOM/换行；题型语义、逻辑引用、Diff、Topic 重排和数据库写入由后端完成。

## 错误码和限制

| 场景 | 处理 |
| --- | --- |
| DSL 协议错误 | 客户端返回 `diagnostics`，不调用创建/修改接口 |
| `vid` 不存在或无权限 | 后端返回 `NotFound`/`Forbidden` 及错误码 |
| 逻辑引用悬空、循环或题型属性不合法 | 后端返回 `ValidationFailed`，并给出失败字段 |
| breaking change 未显式允许 | 修改失败；追加 `allow_breaking_changes=true` 后重试 |
| 已有答卷的危险 breaking change | 始终拒绝，不能通过客户端参数绕过 |
| 写入依赖或数据库失败 | 返回 `DependencyFailure`/`PersistenceFailed`，不要盲目重复写入 |

创建默认保持服务端默认的草稿状态。更新提交完整 DSL，即使业务上只修改一题也不发送增量片段。客户端不发送 CAS、If-Match、receipt 或幂等字段。

## 失败处理

客户端校验失败时不发送写入请求，并返回 `diagnostics`。后端错误应透传错误码、失败字段和诊断。网络结果未知时不要自动重复写入，使用传统 `vid` 查询确认最终状态。

## 兼容与迁移

旧文本 DSL 仅用于历史读取/迁移，不能直接作为 XML DSL v1 提交。JSONL 是另一条创建链路（`A1000106`），不会自动转换为 XML DSL；需要 XML DSL 时由 AI 按本规范重新生成完整文本。迁移旧问卷时，先通过 `query_wjx_dsl` 获取服务端往返 DSL，人工审阅后再提交创建或修改。
