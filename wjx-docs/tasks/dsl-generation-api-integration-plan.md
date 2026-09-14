# CLI、MCP、SDK DSL 生成与 API 集成改造计划

## 1. 背景与目标

当前后端已经具备 WJX XML DSL 的解析、校验、逻辑规则投影、XML 转换和现有问卷写入能力，但 CLI、MCP、SDK 对 DSL 的接收、校验和 API 转发职责尚未统一，也缺少一份面向使用者的完整 DSL 参考文档。

本次改造目标（方案一）：

1. 由 AI 读取专门的 WJX XML DSL v1 规范，直接生成完整的 `wjx-dsl 1` 文本。
2. 在 `wjx-api-sdk` 中提供统一的 DSL 语法/结构校验、请求封装和 API 调用能力；SDK 不根据业务对象自行推导问卷语义。
3. 在 `wjx-cli` 和 `wjx-mcp-server` 中接收 AI 生成的 DSL，经 SDK 校验后提交创建或修改接口。
4. 建立一份专门的 WJX XML DSL v1 参考文档，作为 AI、CLI、MCP、SDK 和后端的共同使用契约。
5. 保留现有后端数据库和问卷写入链路，不在客户端重写 XML 或数据库逻辑。

本计划不包含：

- 不改变 `A1000006`、`A1000109`、`A1000110` 的业务语义和权限模型。
- 不新增数据库表、数据库写入逻辑或客户端直写 XML 文件的持久化逻辑。
- 不恢复已废弃的旧文本 DSL 作为默认创建路径。
- 不让客户端猜测问卷星未公开的 XML 属性；未知协议内容必须通过 `raw` 或扩展字段显式传递。

## 2. 当前实现盘点

### 2.1 后端已有能力

后端 `tanhao` 项目已经提供：

- `WjxDslParser`：DSL 词法和语法解析。
- `WjxDslLogicCodec`：`if`、`show`、`hide`、`jump`、`branch`、`reference`、`random` 等逻辑规则的解析、校验和 XML 投影。
- `WjxDslConverter` / `WjxDslCodec`：DSL 与 XML 双向转换。
- `WjxDslWorkflow`：校验、Diff、Topic 连续化、逻辑引用重映射、breaking change 判断和保存计划。
- `WjxDslOpenApiIntegration`：将 DSL 编译为传统 `surveyData`，创建时复用 `ActivityCreate.NewBySurveyData`，更新时复用 `Util.UpdateFileXmlOnly`。

### 2.2 SDK 当前能力

`wjx-api-sdk` 已有：

- `queryWjxDsl`：调用 `A1000006`。
- `createSurveyByWjxDsl`：调用 `A1000109`，发送 `dsl` 字符串。
- `updateWjxDsl`：调用 `A1000110`，发送传统 `vid` 和 `dsl`。
- `validateWjxDsl`：只覆盖客户端可确定的基础校验，例如 DSL 头、括号、Topic 和矩阵范围。

当前缺口是：CLI/MCP 尚未按统一规范承接 AI 生成的 DSL，SDK 的校验边界、错误诊断和三条 DSL API 的调用契约还需统一；不再新增“结构化定义 → DSL”的客户端业务编译器。

### 2.3 CLI 当前能力

`wjx dsl query/create/update` 已能读取 DSL 文本或文件并调用 SDK。需要明确 `create/update` 直接接收 AI 生成的 DSL，增加生成/校验工作流入口，并让 CLI 输出可审阅的 DSL 与诊断。

### 2.4 MCP 当前能力

MCP 当前主分支没有统一的 DSL 工具；历史实现曾包含 `create_survey_by_wjx_dsl`、`update_wjx_dsl`，本次将其替换为新的生成/校验/提交工作流。

### 2.5 文档现状

仓库中已有 Skill 内的 `wjx-xml-dsl-v1.md` 和旧文本 DSL 兼容说明，但缺少位于 `wjx-docs/reference`、可直接面向 CLI/MCP/SDK 使用者的专门协议文档。现有部分文档仍把 DSL 描述为只读或迁移格式，需要统一修订。

## 3. 统一协议设计

### 3.1 DSL 文档头

所有新建和修改请求使用版本化协议：

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
  };
};
```

### 3.2 DSL 输入与生成责任

DSL 的业务语义由 AI 根据本计划新增的参考文档生成，输入可以来自 AI 输出、用户粘贴文本、标准输入或受控文件。SDK 不定义问卷 JSON schema，也不负责把自然语言或结构化业务对象转换成题目语义；这样可避免客户端复制后端完整题型/高级属性模型，并保留 `raw` 扩展能力。

CLI/MCP 的“generate”能力定位为接收、规范化（可选）和校验 AI 生成的 DSL，不承诺自行生成问卷内容。生成失败或校验不通过时不得调用写入接口。

本计划不要求 CLI、MCP 或 SDK 内置大模型调用。宿主 AI（例如用户当前使用的 AI 客户端）负责依据参考文档产出 DSL；客户端组件只处理确定性的协议工作，避免模型供应商、提示词和业务编译逻辑进入 SDK。

### 3.3 生成结果

统一返回：

```ts
interface WjxDslGenerationResult {
  dsl: string;
  diagnostics: WjxDslDiagnostic[];
  valid: boolean;
  byteLength: number;
}
```

存在错误诊断时，CLI/MCP 不得调用创建或更新 API。

## 4. SDK 改造方案

### 4.1 DSL 接收与校验模块

建议新增或整理：

```text
wjx-api-sdk/src/modules/dsl/validate.ts
wjx-api-sdk/src/modules/dsl/types.ts
```

提供：

```ts
validateWjxDsl(dsl, options?): WjxDslDiagnostic[]
normalizeWjxDsl(dsl, options?): string
```

`normalizeWjxDsl` 只做协议层面的空白、编码和换行规范化，不改变题目语义或自动补字段。SDK 不提供结构化问卷对象序列化器；AI 生成的原始 DSL 应尽量原样保留，便于诊断和审计。

### 4.2 与现有 API 函数衔接

保留现有函数：

```ts
queryWjxDsl(input, credentials?)
createSurveyByWjxDsl(input, credentials?)
updateWjxDsl(input, credentials?)
```

CLI/MCP 的便捷流程内部执行：

```text
AI 生成 DSL → SDK validate/normalize → A1000109/A1000110
```

底层 `createSurveyByWjxDsl` 和 `updateWjxDsl` 继续接受已经生成的 DSL 字符串，作为唯一写入调用入口。若保留 `createSurveyFromDefinition` / `updateSurveyFromDefinition` 名称，其参数必须是 DSL 文本（或包含 DSL 文本的请求对象），名称仅表示“从问卷定义文本提交”，不得引入新的 JSON 语义模型。

### 4.3 SDK 校验边界

客户端只做轻量协议校验：

- 协议头、根节点和必填请求字段存在。
- DSL 能被客户端解析，字符串和块结构完整。
- Topic、Item 等引用使用合法格式，DSL UTF-8 大小不超过 API 限制。

题型完整性、Topic 连续化、逻辑循环、breaking change 和答卷限制由后端统一判断，客户端不重复实现。

后端继续作为最终语义校验者。客户端不能绕过后端诊断，也不能把客户端校验成功等同于写入成功。

## 5. CLI 改造方案

### 5.1 新增命令

新增：

```bash
wjx dsl generate --file survey.wjx --out normalized.wjx
wjx dsl generate --stdin
```

`--file`/`--stdin` 的内容均为 AI 按规范生成的 DSL 文本。默认输出 DSL 和诊断；`--out` 将规范化后的 DSL 写入 UTF-8 文件；`--dry-run` 只执行校验并输出请求预览，不调用 API。

### 5.2 创建和更新提交 AI 生成的 DSL

扩展现有命令：

```bash
wjx dsl create --dsl '<wjx-dsl 1 ...>'
wjx dsl create --file survey.wjx
wjx dsl update --vid <vid> --dsl '<wjx-dsl 1 ...>'
wjx dsl update --vid <vid> --file survey.wjx
```

`create` 和 `update` 接受 AI 生成的 DSL 文本、文件或标准输入，先交给 SDK 校验/规范化，再调用底层 `createSurveyByWjxDsl` 或 `updateWjxDsl`。删除 `--definition` 及任何结构化 JSON 到 DSL 的隐式转换路径。`dsl generate` 只负责校验/规范化，不负责根据自然语言或 JSON 生成题目。

更新命令继续只接受传统 `vid`，不接受 sid；默认不允许 breaking change，只有显式 `--allow-breaking-changes` 才传递审批参数。更新不引入 `If-Match`、receipt 或幂等参数。

### 5.3 CLI 输出和错误

JSON 输出至少包含：`dsl`（可按选项脱敏）、`diagnostics`、API action、请求结果和服务端错误码。表格模式只用于人工查看。DSL 校验失败时退出码使用现有 `INPUT_ERROR`，API 失败使用现有 `API_ERROR`。

## 6. MCP Server 改造方案

### 6.1 新增工具

新增工具：

```text
generate_wjx_dsl
create_survey_from_definition
update_survey_from_definition
```

其中：

- `generate_wjx_dsl`：接收 AI 生成的 DSL，执行协议校验/规范化并返回 DSL；不写服务器。
- `create_survey_from_definition`：接收 DSL 定义文本，校验后调用 `A1000109`。
- `update_survey_from_definition`：接收 DSL 定义文本，校验后调用 `A1000110`。

只保留 `query_wjx_dsl` 查询工具；已删除的 `create_survey_by_wjx_dsl` 和 `update_wjx_dsl` 工具不恢复。底层 SDK 函数继续保留，作为新工具接收并校验 AI 生成的 DSL 后调用 API 的内部实现，不直接暴露为 MCP 工具。

### 6.2 工具约束

- Schema 与 SDK 的 DSL 请求/诊断类型保持一致，避免三套字段定义；不新增结构化问卷 JSON schema。
- MCP 不复制序列化、签名或逻辑校验代码，只调用 SDK。
- `update_survey_from_definition` 必须要求传统 `vid`，支持 `allow_breaking_changes`；不提供 `if_match`、receipt 或幂等参数。
- 工具描述中明确“生成成功不等于 API 写入成功”，并返回服务端原始诊断。

## 7. 专门 DSL 参考文档

新增：

```text
wjx-docs/reference/wjx-xml-dsl-v1.md
```

文档结构按截图中的“参考文件”风格组织，并作为唯一面向调用者的协议入口：

1. DSL 适用范围和三条 API 链路。
2. 最小完整示例。
3. 词法规则：标识符、字符串、转义、注释、分号和嵌套块。
4. 根节点、问卷属性、页面、分页和题目语法。
5. 基础题型、矩阵 Mode、选项/行列结构和属性矩阵。
6. 逻辑 DSL：`if`、`show`、`hide`、`jump`、`branch`、`reference`、`random`、`raw`。
7. 条件表达式、Topic/Item 引用格式、`END` 目标和禁止循环规则。
8. `raw` 保留规则、未知属性处理和 XML 往返限制。
9. CLI、MCP、SDK 生成和调用示例。
10. 服务端错误码、breaking change、答卷存在时的限制和排错方法。
11. 与旧文本 DSL、JSONL 的兼容边界和迁移说明。

文档同步要求：

- 更新 `wjx-docs/index.md`、`reference/cli.md`、`reference/mcp-tools.md`、`reference/sdk.md`。
- 更新 `wjx-skills/wjx-cli-use` 和 `wjx-skills/wjx-mcp-use` 的引用。
- 更新 MCP `wjx://reference/wjx-xml-dsl` 资源，使其内容与文档一致。
- 运行现有 docs build/check，避免再出现失效链接。

## 8. 后端协作边界

本次客户端改造不复制后端 XML 编译器。后端接口仍按以下方式工作：

```text
AI 生成 DSL，CLI/MCP/SDK 负责校验和传输
        ↓
A1000109 / A1000110
        ↓
WjxDslWorkflow.PrepareCreate/PrepareSave
        ↓
WjxDslParser + WjxDslLogicCodec
        ↓
WJX XML
        ↓
现有 ActivityCreate / UpdateFileXmlOnly 写入链路
```

查询链路保持：

```text
A1000006 → 现有问卷查询 DTO + XML → DSL 往返结果
```

客户端不得自行写数据库、覆盖服务端未知节点或根据客户端模型删除 `raw` 内容。

## 8.1 最终业务流程

### 创建流程

```text
AI 读取 DSL v1 参考文档并生成完整的 wjx-dsl 1 文本
        ↓
用户将 DSL 交给 CLI / MCP
        ↓
CLI / MCP 将 DSL 交给 SDK
        ↓
SDK 执行客户端结构校验
        ↓（校验失败：返回诊断，不发请求）
调用 A1000109，正文以 dsl 字段传输
        ↓
后端 WjxDslParser 解析 DSL
        ↓
WjxDslLogicCodec 校验并投影逻辑规则
        ↓
WjxDslWorkflow 编译为 WJX XML / surveyData
        ↓
复用 ActivityCreate.NewBySurveyData 写入问卷
        ↓
返回 vid、sid、状态和访问地址
```

### 修改流程

```text
用户提供传统 vid 和修改要求
        ↓
通过 A1000006 获取当前 DSL（已有最新 DSL 时可跳过）
        ↓
AI 根据 DSL v1 规范生成修改后的完整 DSL
        ↓
CLI / MCP 将 vid + 完整 DSL 交给 SDK
        ↓
SDK 执行轻量协议校验
        ↓（校验失败：返回诊断，不发请求）
一次调用 A1000110，正文传输 vid + dsl
        ↓
后端读取旧 XML，执行解析、Diff、Topic 重排和逻辑引用重映射
        ↓
breaking change 审查；已有答卷时拒绝危险修改
        ↓
复用 UpdateFileXmlOnly 写入 XML 并清理缓存
        ↓
返回修改结果和诊断
```

更新不采用增量 Patch DSL。即使只修改一题，也由 AI 生成修改后的完整问卷 DSL，后端通过 Diff 判断实际变更。`generate_wjx_dsl` 仅作为可选的预检/规范化步骤，不是更新流程的必经调用。

### 查询流程

```text
CLI `wjx dsl query --vid` 或 MCP `query_wjx_dsl`
        ↓
调用 A1000006
        ↓
后端复用传统问卷查询 DTO
        ↓
读取 XML 并执行 XML → DSL 往返转换
        ↓
返回原查询内容 + dsl 字段
```

查询不需要先生成 DSL；查询返回的 DSL 可以作为 AI 后续审阅、修改和再次提交的依据。

### 失败处理

- 生成或客户端校验失败：不调用写入 API，返回结构化 diagnostics。
- API 返回业务失败：透传 action、错误码、状态和服务端诊断。
- 网络超时或结果未知：不自动重试写入，不生成第二份问卷；使用传统 vid 查询对账。
- 已发布问卷更新：遵循后端状态和暂停要求，客户端不自动暂停。

## 9. 测试计划

### 9.1 SDK 单元测试

- 最小问卷、分页、多题型、矩阵和所有基础属性 DSL 的校验。
- 字符串引号、反斜杠、换行和 Unicode 转义诊断。
- DSL 规范化结果在重复处理时保持一致。
- 非法 Topic/Item 引用在客户端给出诊断；Topic 连续化和循环跳转由后端负责最终判断。
- `raw` 节点和未知属性往返保留。
- AI 生成 DSL → 客户端校验 → 后端解析的 round-trip。
- DSL 写入函数的 action、字段和错误透传。

### 9.2 CLI 测试

- `dsl generate` 的文件、stdin、`--out`、`--dry-run`。
- `create/update` 接受 AI 生成的 `--dsl`、`--file` 或 stdin，并拒绝结构化 JSON 到 DSL 的隐式转换。
- JSON、table、错误退出码和敏感 DSL 脱敏。
- `update` 只接受传统 vid，不误把 sid 当作 vid；不发送 If-Match、receipt 或幂等参数。
- breaking change 默认拒绝，显式开关正确传递。

### 9.3 MCP 测试

- 工具注册、Schema 与 SDK 类型一致。
- `generate_wjx_dsl` 只校验/规范化 DSL，不写 API。
- 创建/更新工具调用正确 action。
- 逻辑引用、答卷限制、权限和后端诊断透传。

### 9.4 真实端到端测试

1. 由 AI 按参考文档生成 DSL，使用 CLI 提交并创建草稿问卷。
2. 使用 MCP `query_wjx_dsl` 读取并核对 DSL。
3. 使用 SDK 校验同一份 DSL，比较规范化结果和关键属性。
4. 使用 CLI/MCP 提交 AI 生成的完整 DSL，覆盖单题、选项、逻辑规则和题目顺序修改。
5. 验证新增/删除题目后的 Topic 顺序和逻辑引用。
6. 验证已有答卷时 breaking change 被拒绝。
7. 发布后验证填写页面、逻辑跳转和题型显示。
8. 记录服务端返回的 `vid`、`sid`、状态、错误码和诊断字段。

## 10. 实施阶段与交付物

### 阶段一：协议和文档

- 冻结 DSL v1 语法、逻辑子集和字段矩阵。
- 新增 `wjx-docs/reference/wjx-xml-dsl-v1.md`。
- 清理旧文档中的“DSL 只能读取”的过时描述。

### 阶段二：SDK DSL 校验与传输

- 整理 DSL 请求类型、协议校验、规范化和诊断 API。
- 接入现有客户端校验和三条 DSL API 函数。
- 完成 SDK 单元测试和导出；不实现结构化问卷语义编译器。

### 阶段三：CLI

- 新增 `dsl generate`。
- 为 create/update 统一接入 `--dsl`、`--file` 和 stdin 的 DSL 文本。
- 完成输入互斥、输出、错误和请求预览。

### 阶段四：MCP

- 新增三个生成/写入工具。
- 同步工具说明、资源和能力数量文档。
- 完成 Schema 和调用链测试。

### 阶段五：集成和发布准备

- 后端测试环境执行真实端到端回归。
- 更新 changelog、docs HTML 和 bundled Skill。
- 执行三 workspace 测试、构建和 docs 检查。
- 仅提交代码和文档到仓库；是否发布 npm 另行确认。

## 11. 验收标准

- AI 按同一份 DSL v1 参考文档生成的内容，CLI、MCP、SDK 均能校验并提交字节保持一致的 WJX DSL。
- 生成结果可以通过 `A1000109` 创建和 `A1000110` 更新，后端能正常解析为 XML。
- 查询 `A1000006` 返回的 DSL 可以被客户端读取、修改后再次提交。
- 逻辑规则有专门语法、结构化校验和后端 XML 投影，悬空引用和循环被拒绝。
- 创建和更新继续复用后端现有数据库/文件写入链路。
- 传统 vid、权限、答卷保护和 breaking change 规则保持有效。
- 专门 DSL 参考文档可从 CLI、MCP、SDK 文档导航到，且无失效链接。
- 单元测试、集成测试、真实端到端测试和文档检查全部通过；已知环境依赖失败项单独记录。

## 12. 已确认的实施决策

1. DSL 由 AI 按专门的 DSL v1 参考文档直接生成；SDK 不实现自然语言或结构化业务对象到 DSL 的转换。
2. `dsl generate` 默认输出 stdout，只有指定 `--out` 时写入 UTF-8 DSL 文件；其职责是校验/规范化输入 DSL。
3. CLI 保留 `wjx dsl query/create/update` 命令名称：
   - `query` 直接查询并返回 DSL；
   - `create/update` 接受 AI 生成的 DSL，内部先校验/规范化再调用 API；
   - 删除结构化 `--definition` 语义，保留 `--dsl`、`--file` 和 stdin 作为 DSL 输入路径。
4. MCP 保留 `query_wjx_dsl`；已删除的 `create_survey_by_wjx_dsl` 和 `update_wjx_dsl` 不恢复；新增 `generate_wjx_dsl`、`create_survey_from_definition`、`update_survey_from_definition`。
5. SDK 保留底层 `queryWjxDsl`、`createSurveyByWjxDsl`、`updateWjxDsl`，并提供 DSL 校验/规范化函数；不新增结构化定义生成器。
6. 逻辑 DSL 支持后端已实现的 `if`、`show`、`hide`、`jump`、`branch`、`reference`、`random` 和 `raw` 子集。
7. 新建默认保持草稿；更新只接受传统 vid；已有答卷时继续禁止 breaking change；不引入 CAS、receipt 或幂等机制。
8. 本次改造只提交代码和文档到仓库，不发布 npm 市场。
