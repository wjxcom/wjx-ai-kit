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

题型标识、题目属性、选项、矩阵行列和高级属性以问卷星后端支持矩阵为准。常用标识包括 `radio`、`checkbox`、`dropdown`、`scale`、`rating`、`ranking`、`text`、`multi_text`、`matrix_radio`、`matrix_checkbox`、`matrix_scale`、`matrix_text`、`matrix_slider`、`upload`、`drawing`、`weight` 和 `slider`。无法安全建模的字段使用 `raw`。

`Topic` 必须是题目在最终问卷中的引用编号。新增或删除题目后的连续化和逻辑引用重映射由后端完成。

题目块可包含 `item`（选项）、`row`（矩阵行）、`column`（矩阵列）和 `raw`（未建模字段）子块。题型编码、必填属性、选项值、矩阵 `mode` 及高级属性以服务端能力矩阵为准；客户端不根据本地题型表删除未知字段。

## 逻辑 DSL

后端支持的逻辑动作包括：`if`、`show`、`hide`、`jump`、`branch`、`reference`、`random` 和 `raw`。逻辑引用使用 Topic/Item 标识；`jump` 或 `branch` 的目标可以是 `END` 或有效 Topic。悬空引用、自循环和跳转环由后端最终校验。

## 创建、修改、查询

| 操作 | API | 客户端输入 |
| --- | --- | --- |
| 查询 | `A1000006` | 传统 `vid` |
| 创建 | `A1000109` | 完整 DSL，正文使用 `dsl` 字段 |
| 修改 | `A1000110` | 传统 `vid` + 修改后的完整 DSL |

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
