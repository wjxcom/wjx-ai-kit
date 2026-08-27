# WJX XML DSL v1

> 协议标识：`wjx-dsl 1`
> 参考版本：`1.0.0`

WJX XML DSL 是 AI 新建问卷和安全修改问卷的默认格式。它直接描述完整的 WJX 问卷 XML 信息集，与 `survey create-by-text` 使用的旧行文本 DSL 不兼容。生产 XML 始终是运行时事实源。

## 最小语法

```text
wjx-dsl 1;
xml version = "1.0";
xml encoding = "utf-8";

questionnaire {
  attr "Title" = "产品体验调查";

  question radio {
    attr "Topic" = "1";
    attr "Title" = "您对产品是否满意？";
    attr "Requir" = "true";
    item { attr "ItemTitle" = "满意"; attr "ItemValue" = "1"; };
    item { attr "ItemTitle" = "不满意"; attr "ItemValue" = "2"; };
  };

  question question {
    attr "Topic" = "2";
    attr "Title" = "请说明主要原因";
    attr "Requir" = "true";
    attr "Verify" = "多行文本";
    attr "Height" = "4";
  };
};
```

文档由 `wjx-dsl 1;`、可选 XML 指令和一个 `questionnaire { ... };` 根组成。块内可使用：

- `attr "Name" = "value";`
- `text`、`cdata`、`comment`、`pi`
- `node "ElementName" { ... };`
- 问卷别名：`page`、`cut`、`question <type>`、`item`、`row`、`rightrow`、`column`

新增高级协议别名：`company`、`psm`、`level`、`citylevel`、`contacts_user`、`test`、`ai_interview`、`radio_cati`、`ocr`、`sus`、`bpto`、`price_breakpoint`、`classify`、`device`。除 `contacts_user` 及文本校验别名映射到基础 `question` 外，其余别名映射到 `matrix` 并补齐对应 `Mode/Verify`，专项参数仍通过显式属性提供。常用文本校验别名还包括 `map`、`date`、`ai`、`ai_hci`、`store_select`、`name`、`id_number`、`country_region`、`city_select`、`region`、`email`、`phone`、`university`、`password`。
矩阵输入类语义别名在 `item` 缺少 `ItemJump` 时会补为 `0`；直接使用基础 `matrix` 时请按协议显式写 `ItemJump="0"`，以区别旧编辑器的空值占位项。
选项别名 `other`、`item_textbox`/`itemtextbox` 映射到 `Item` 并补齐 `ItemTextBox=true`。
文本高亮扩展可使用 `texthighlights`/`text_highlights`，映射到 `question` 并补齐 `Verify=texthighlights`。

AI 生成时遵守以下最小约束：

- 新建时不要提供内部问卷身份；服务端会分配身份，外部只使用返回的传统 `vid`。
- 每道题的 `Topic` 是唯一正整数；选项的 `ItemValue` 在题内唯一。
- 除非用户明确要求选填，否则题目写 `attr "Requir" = "true";`。
- 选择题至少包含一个 `item`；多项填空的标题使用 `___`，并让 `GapCount` 与 `row` 数量一致。
- 不确定的高级属性先查参考或在创建/更新失败时根据服务端错误修正，禁止猜测后绕过校验。
- 不删除从 `query` 读取到的未知属性、未知节点、`raw` 逻辑或历史扩展。

## 题型和矩阵支持矩阵

当前 DSL 的基础 Type 为：`page`、`cut`、`radio`、`radio_down`、`check`、`question`、
`gapfill`、`fileupload`、`sum`、`slider`、`matrix`。排序、签名和已验证矩阵子型也可直接使用上面的语义别名，
也可以继续通过 `Mode`、`Verify`、`IsSignature` 等 XML 属性表达。

`matrix` 当前校验并支持以下生产 Mode：

| Mode | 子节点约束 |
|---|---|
| `2/3/6/7` | `row` + `item` |
| `101` | `row`，可带 `rightrow` + `item` |
| `102/103` | `row` + `item` |
| `201` | `row`，可带协议选项 `item(ItemJump=0)` |
| `202` | `row`，可带 `rightrow` + 协议选项 `item(ItemJump=0)` |
| `203` | `row`，每行 `ItemVerify="文件上传"` |
| `204` | `row`，每行 `ItemVerify="多项简答"` |
| `301/302` | `row` + `column`，可带协议选项 `item(ItemJump=0)` |
| `303` | `row` + `column` + `item` |

已验证可经旧编辑器服务端分隔符协议往返的高级属性包括：

- 选择题：`HasValue`、`IsTouPiao`、`DisplayPercent`、`DisplayNum`、`MinValue`、`MaxValue`、`PartScore`、`GroupMutual`；
- 文本/填空：`Verify`、`Height`、`MinWord`、`MaxWord`、`GapCount`、`NeedOnly`、`LevelData`、`IsCloze`；
- 上传/滑块/比重：`Ext`、`MaxSize`、`MaxLength`、`IsSignature`、`Size`、`SignatureBg`、`Total`、`RowWidth`、`MinValue`、`MaxValue`、`MinValueText`、`MaxValueText`、`DigitType`；
- 矩阵：`HasValue`、`RandomRow`、`RowRightWidth`、`DaoZhi`、`GroupMutual`、`PartRequir`、`NoColumn`、`DigitType`、`ShowMobileScrollBar`。

这些属性有历史协议条件：`PartScore` 与同一题的 `GroupMutual` 使用互斥编码分支；
`IsCloze` 需要配合 `IsCeShi`；`PartRequir` 从必答题的行级非必答设置推导；
`SignatureBg` 必须符合旧转换器允许的 WJX 资源 URL 格式。未列入上述清单的扩展属性
仍可由 XML DSL raw AST 保留，但不能据此保证旧编辑器转换后会持久化。

## 新建工作流

```bash
wjx dsl create --file survey.wjx
wjx dsl create --file survey.wjx
wjx dsl query --vid <vid>
```

流程必须是 `generate -> create`。创建结果是草稿；发布仍使用既有非 DSL 状态接口。填写和编辑链接直接使用服务端返回值，不用内部问卷身份拼接 URL。
创建结果返回传统 `vid`；后续 query/update 都使用该 `vid`。

## 修改工作流

```bash
wjx dsl query --vid <vid>
wjx dsl update --vid <vid> --file candidate.wjx --if-match <etag>
wjx dsl update --vid <vid> --file candidate.wjx --if-match <etag>
wjx dsl query --vid <vid>
```

流程是 `query -> 修改 DSL -> update(If-Match 可选) -> query`。从 query 返回的完整 DSL 修改并保留未知内容；ETag 过期时重新 query，不覆盖并发修改。breaking change 默认拒绝；确需修改索引时必须显式增加 `--allow-breaking-changes`，且问卷已有回收答卷时服务端仍会拒绝。

## 未知结果和兼容路径

- `create`、`update` 不自动重试，也不在超时、断网或结果未知时自动改用 JSONL/旧文本 DSL。
- 结果未知时停止，并使用返回的传统 `vid` 重新 query 对账。
- 仅当服务端明确返回 `FeatureDisabled` 或 `Unsupported`，并确认没有副作用时，才提示用户显式选择 JSONL。
- 用户明确要求 JSONL 时使用 `wjx survey create-by-json`；明确要求旧文本 DSL 时使用 `wjx survey create-by-text`；旧 JSON 数组接口仅用于明确兼容需求。
