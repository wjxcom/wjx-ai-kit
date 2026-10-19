# Survey JSON 与题目逻辑 DSL 合并改造计划

## 1. 目标

将问卷创建和修改统一到 Survey JSON 接口。只有问卷包含题目关联逻辑时，才在请求中增加可选的 `dsl` JSON 节点；DSL 节点只承载现有 WJX DSL 的 `logic` 模块。

最终输入形态：

```json
{
  "jsonl": "{\"qtype\":\"问卷基础信息\",...}",
  "dsl": {
    "logic": "logic {\n  if \"2::1\" then show \"3\";\n};"
  }
}
```

没有逻辑时省略 `dsl`。Survey JSON 中已有的 `relation`、`referselect` 等字段继续保留；两者同时存在时，以 `dsl.logic` 为最终逻辑来源。

`dsl.logic` 是接口输入的逻辑描述，必须解析并转换为问卷 XML 已有的原生逻辑属性或节点后才能保存。它不是 XML 的扩展存储节点：不能把 DSL 字符串直接写入 XML 属性、文本、CDATA 或新增的 `<dsl>` 节点，也不能仅保存请求中的 DSL 原文就认为转换完成。

## 2. 改造前代码基线（历史状态）

- 创建入口是 SDK `createSurveyByJson`，通过 action `1000106` 发送 `surveydatajson`。
- 当前没有非 DSL 的问卷结构修改函数。
- 修改入口是 `updateWjxDsl`，通过 action `1000110` 发送完整 XML DSL。
- DSL 校验目前针对完整 `wjx-dsl 1; questionnaire { ... }` 文档，尚未提供仅校验 `logic { ... };` 模块的能力。
- CLI 暴露 `dsl query/generate/create/update`，MCP 暴露四个独立 DSL 工具，SDK index 也直接导出 DSL 创建、查询、更新和校验接口。

## 3. 目标接口设计

### 3.1 SDK 类型

新增内部共享类型：

```ts
interface SurveyDslJson {
  logic: string;
}
```

`CreateSurveyByJsonInput` 增加可选 `dsl?: SurveyDslJson`。

将 `updateWjxDsl` 改造成 `updateSurveyByJson`，输入使用 Survey JSON 字段并增加：

```ts
interface UpdateSurveyByJsonInput {
  vid: string | number;
  /** Full Survey JSON when question/content fields also change. */
  jsonl?: string;
  title?: string;
  atype?: number;
  optionalTitles?: string[];
  publish?: boolean;
  dsl?: SurveyDslJson;
  allowBreakingChanges?: boolean;
}
```

`updateSurveyByJson` 至少需要提供 `jsonl` 或 `dsl` 之一：仅优化逻辑时只传 `dsl.logic`，同时修改问卷内容时传完整 `jsonl` 和可选 `dsl.logic`。更新 action 统一为 `1000109`；服务端必须同步改造为接收 Survey JSON 和可选逻辑模块，不能只重命名 SDK 函数。仅修改逻辑时，服务端读取原 XML，将 DSL 解析、转换得到的原生逻辑属性或节点应用到原问卷，再保存结果。

### 3.2 DSL 逻辑模块

新增仅面向逻辑模块的本地处理函数：

- `normalizeSurveyLogic`：去除 BOM、统一换行和末尾格式；
- `validateSurveyLogic`：校验 `logic { ... };` 根结构、括号配对、语句结束符、题目/选项引用的基本形态；
- `prepareSurveyDslJson`：验证并返回规范化后的 `{ logic }` 节点。

该模块复用现有 DSL 语法约束，不再要求 `wjx-dsl 1;`、`questionnaire` 或题目定义块。服务端仍负责最终语义验证。

### 3.3 请求优先级

创建和修改都按以下顺序处理：

1. 解析并规范化 Survey JSON；
2. 读取 JSON 中的 `relation`、`referselect` 等旧逻辑字段；
3. 若存在 `dsl.logic`，校验并随 Survey JSON 提交给服务端；
4. 若不存在 `dsl`，维持原 JSON 请求行为。

客户端保留 Survey JSON 中的逻辑字段。服务端先执行原有 JSON 到 XML 的转换，再解析并转换 `dsl.logic`，以转换结果覆盖冲突的原生逻辑属性或节点，从而落实 DSL 优先。不能仅依赖请求参数的排列顺序表达优先级。

## 4. SDK 实施步骤

### 阶段 A：共享输入处理

1. 抽取当前 `createSurveyByJson` 的 JSONL 预处理逻辑，形成创建和修改共用的 `prepareSurveyJson`。
2. 保持现有 qtype、atype、必答、考试题、大小限制和标题/题目校验行为。
3. 增加 `dsl` 类型校验，拒绝数组、非对象、未知的顶层逻辑结构和空 `logic`。
4. 在创建请求中仅当 `dsl` 存在时增加 `dsl` 字段，确保无逻辑请求的 wire body 完全兼容当前行为。

### 阶段 B：修改接口重构

1. 将 `updateWjxDsl` 的输入改为 `UpdateSurveyByJsonInput`。
2. 新增 `updateSurveyByJson`，复用共享 JSON 预处理和 DSL 逻辑预处理。
3. 保留传统 `vid` 校验、不可重试写请求、`allowBreakingChanges` 传递和长超时策略。
4. 删除 SDK 对外的 `queryWjxDsl`、`createSurveyByWjxDsl`、`updateWjxDsl`、完整 DSL 写入验证导出。
5. 删除完整问卷 DSL 的解析、生成及兼容门面，只保留 logic 模块与原生 XML 转换、校验和答卷索引保护。

### 阶段 C：SDK 测试

新增或改写测试覆盖：

- 创建请求不带 `dsl` 时 body 与旧行为一致；
- 创建请求带 `dsl.logic` 时发送对象节点；
- 修改请求使用 action `1000109`、`vid`、`surveydatajson` 和 `dsl`；
- `dsl.logic` 支持多个 `if`、`or` 和题号/选项号引用；
- 空逻辑、完整 XML DSL、未闭合逻辑块和非法引用被本地拒绝；
- `relation/referselect` 与 `dsl.logic` 同时存在时，两者都保留在请求中；最终优先级另由服务端转换测试验证。

## 5. 服务端逻辑转换和保存

此部分是实际功能的一部分，必须与 SDK、CLI、MCP 接口调整一起实施和验证。

1. 定位并复用已有 DSL 逻辑解析及 XML 转换实现，以代码中的映射为准，不重新发明一套逻辑语法或 XML 存储格式。
2. 创建问卷时，先通过现有 Survey JSON 转换链路构建问卷，再将 `dsl.logic` 解析为逻辑结构，转换为题目关联、跳转、引用等已有的 XML 表达。
3. 仅修改逻辑时，读取现有问卷 XML 作为基线；解析并转换修改后的 `dsl.logic`，只更新其涉及的原生逻辑属性或节点，保留其他题目、选项、分页、设置和扩展内容。
4. 同时修改题目和逻辑时，先处理 Survey JSON 对题目内容的修改，再依据最终题号和选项映射转换逻辑，并校验引用。
5. 查询时，从实际保存的 XML 原生逻辑属性或节点反向转换得到 `{ dsl: { logic: "logic { ... };" } }`，通过原问卷查询接口提供给 AI 编辑。不能把上次提交的 DSL 原文直接作为读回结果。
6. 在保存前完成 DSL 解析、XML 转换和引用校验；失败时返回诊断，不提交部分变更。

转换验收必须覆盖：

- 使用用户给出的多条 `if ... then show ...` 和 `or` 示例，检查保存后的原生逻辑属性或节点及答题页实际显示行为；
- XML 中不存在作为数据保存的 DSL 原文或新增的 DSL 存储节点；
- `relation/referselect` 与 DSL 冲突时，保存后的 XML 行为符合 DSL；
- XML -> 逻辑 DSL -> XML 的逻辑语义一致；
- 仅修改逻辑后，问卷其他内容保持不变；
- 转换失败后，原问卷未被部分修改。

## 6. MCP 实施步骤

1. `create_survey_by_json` 增加可选 `dsl: { logic: string }` schema，并透传到 SDK。
2. 新增 `update_survey_by_json` 工具，参数与 SDK `UpdateSurveyByJsonInput` 对齐。
3. 修改工具继续使用现有问卷写入验证框架，验证目标问卷身份、状态和结构。
4. 从 server 注册表移除：
   - `query_wjx_dsl`
   - `generate_wjx_dsl`
   - `create_survey_from_definition`
   - `update_survey_from_definition`
5. 删除或改写 DSL 独立工具、协议完整性测试、能力矩阵和 MCP 工具文档。

## 7. CLI 实施步骤

1. `survey create` 增加 `--dsl <json>` 或 stdin 中的 `dsl` 对象输入，格式固定为 `{ "logic": "..." }`。
2. 新增 `survey update`，接受 `--vid`、`--jsonl/--file`、`--dsl`、`--type`、`--publish` 和 `--allow-breaking-changes`。
3. dry-run 请求计划必须展示脱敏后的 `dsl` 节点和 `surveydatajson`，不得发送网络请求。
4. 删除 `dsl query/generate/create/update` 命令、命令元数据、catalog 条目和旧 DSL 参数解析器。
5. 更新命令帮助、manifest、completion、skill 文档和 CLI surface 测试。

## 8. 文档和协议清理

同步更新：

- `capabilities/capability-matrix.json`；
- `capabilities/agent-contract.json`；
- SDK、CLI、MCP reference 文档；
- DSL 独立创建/修改说明；
- CHANGELOG 和迁移指南；
- MCP DSL resource（保留逻辑语法说明时改为内嵌在 Survey JSON 文档中）。

文档中的主流程必须明确 DSL 到 XML 的解析和转换步骤：

```text
创建（无逻辑）：
Survey JSON -> XML

创建（包含逻辑）：
Survey JSON -> 题目 XML
dsl.logic -> 解析逻辑 -> 转换为 XML 原生逻辑属性或节点
题目 XML + 转换结果 -> 校验并保存最终 XML

编辑/优化逻辑：
现有 XML -> 读取原生逻辑并反向转换 -> dsl.logic
-> AI 修改 dsl.logic -> 解析逻辑并转换为 XML 原生逻辑属性或节点
-> 在原 XML 基线上更新对应逻辑 -> 校验并保存最终 XML

编辑问卷内容和逻辑：
读取现有问卷内容和由 XML 反向转换的 dsl.logic
-> AI 修改 Survey JSON / dsl.logic
-> 转换题目内容，再按最终题号转换逻辑
-> 校验并保存最终 XML
```

其中“编辑/优化逻辑”是默认主流程。原 XML 由服务端保留为更新基线，DSL 必须先转换为原生逻辑表达，再更新对应位置。不能把 `logic JSON` 或 DSL 原文直接嵌入 XML，也不能仅凭逻辑重新生成整份问卷。

## 9. 验证顺序

1. 服务端 DSL 解析、XML 正反转换、优先级和保存测试；
2. SDK build 和单元测试；
3. MCP build、工具 schema 和协议 surface 测试；
4. CLI build、dry-run、命令矩阵和 manifest 检查；
5. 全仓库测试；
6. 检查 `rg` 确认旧 DSL 对外命令、工具和导出均已移除；
7. 用无逻辑创建、带逻辑创建和已有问卷逻辑修改场景做端到端验证，检查实际 XML 与答题页行为；仅验证请求体或 DSL 读回不算转换验收通过。

## 10. 实现边界

- 将现有 `updateWjxDsl` 改为 `updateSurveyByJson`，更新动作调整为 `1000109`；服务端需要同步完成 JSON 输入及逻辑转换改造。
- 如果后端要求字段名不是 `dsl` 或 `surveydatajson`，只需在 SDK transport 层调整映射，不改变上层类型和工具契约。
- SDK、CLI、MCP 负责输入规范化、结构校验和传输；服务端复用现有逻辑解析及 XML 转换实现，负责语义校验和持久化。
- 本次改造是破坏性变更，旧的完整 XML DSL 创建/查询/修改公共入口不保留兼容别名。

## 11. 实施记录（2026-10-19）

- 服务端复用原逻辑解析器，将内嵌逻辑转换为 `Relation` 等 XML 原生属性，并补齐示例中纯 `or` 条件的反向转换。复杂协议条件保留原生值，避免改变优先级。
- `1000106` 支持可选的 `{ dsl: { logic } }`；`1000109` 用于 Survey JSON 更新，支持完整 JSONL 和仅逻辑更新；普通 `1000001` 查询从实际 XML 返回逻辑模块。
- `creater` 保留为创建专用参数；更新不迁移问卷所有者。仅修改逻辑时保留原题目、分页、设置和扩展节点，省略 `publish` 时保留原发布状态。
- SDK、CLI、MCP 的独立完整 DSL 接口已移除，统一使用 `createSurveyByJson` / `updateSurveyByJson`、`survey create/update`、`create_survey_by_json/update_survey_by_json`。
- 逻辑转换失败及引用校验失败在保存前返回诊断；写后验证使用普通查询的真实 XML 投影。显式发布操作复用既有状态服务；若内容已保存而发布失败，返回明确的保存状态。
- 本地验证覆盖 XML 正反转换、JSON 请求边界、SDK 请求、CLI dry-run、MCP 写后验证及生成协议检查。数据库持久化和实际答题页仍需在部署环境完成联调。

验证结果：SDK 609 项通过；MCP 362 项通过、5 项跳过；XML 转换 55 项通过；请求边界、失败保护、服务端组合及索引保留契约通过。CLI 新功能与错误协议的 20 项用例、274 个命令参数场景通过，文档、能力矩阵、manifest 和 Agent 契约检查通过。CLI 全量测试中原有的 `init --install-ppt-skill` 依赖安装用例仍超时；初始化连接及 PPT 文件安装的其他失败项已单独复跑通过，未为该环境问题修改业务代码。

## 12. 底层清理补充

根据后续确认，旧独立 DSL 能力的专用底层代码也全部移除，本节取代此前保留底层兼容函数和可选前置匹配的假设。

- 删除完整问卷 DSL 解析/生成、题型别名创建、PrepareCreate/PrepareSave/DryRun、保存计划、版本审计和索引迁移。旧门面和模型类型不再存在。
- 逻辑解析器直接解析一个 logic 模块，删除伪造 questionnaire 包装和完整文档语法；完整问卷 DSL 输入明确拒绝。
- 原生 XML 与答卷索引功能整理为 SurveyXmlCodec、SurveyXmlChangeAnalyzer、SurveyAnswerIndexAnalyzer；它们服务于新 JSON 更新与逻辑转换。
- 删除旧动作枚举、创建计数配置、includeDsl、clientRequestId、revisionToken、backupToken、If-Match、旧 CORS 配置和未使用的返回字段。
- 删除仅面向旧全文 DSL 的测试、性能项目和 .dsl 夹具；替换为 48 项逻辑/原生 XML/索引保护测试，并通过反射确认旧类型与方法确实消失。
- 保留并验证请求边界、失败保护和普通 JSON 创建/修改链路；SDK/CLI/MCP 仍只传 Survey JSON 与可选 dsl.logic。
- 全仓复查补删权限管理中的旧查询/创建入口，当前 `1000109` 权限用于 JSON 修改问卷；清理无人调用的 DOM/字节解析入口、独立 XML 校验门面及兼容属性。
- 清理旧测试的空目录和残留构建产物；当前文档、Skill 资源表及生成页面同步删除独立 DSL、素材上传和旧题型创建说明，历史设计文档明确标记废弃。
- 文档契约检查增加旧 DSL 接口、命令、资源与参数检查，后端契约增加权限管理残留检查。

## 13. 残留复查记录（2026-10-19）

本轮按服务端入口及权限配置、类库调用链、SDK 导出、CLI/MCP 注册、发布目录、声明文件、source map 和当前文档逐项核对。

- 再删除 9 个无调用方法及重载：逻辑文档 Add、显式索引策略工厂、索引条目 Clone、3 个 BuildSnapshot 包装重载、2 个快照比较入口、旧单参数子节点引用助手；删除未使用的逻辑解析器无参构造函数。
- 删除旧索引策略种类枚举、版本与快照元数据，以及全文 DSL 时期的逻辑启用开关。按问卷日期计算答卷索引、逻辑解析与原生 XML 转换继续保留。
- 移除已无生成方的全文 DSL 版本与整份文档往返诊断分支，XML 路径助手和错误提示改为对应的 XML 含义。
- 更新后端 XML 总指南和架构索引，移除已删除全文 DSL 门面、题型别名和旧入口说明；旧一致性问题记录标记为历史状态。
- 从 Apply/Extract、CompareXml、索引比较和日期策略入口检查编译 DLL 的 IL 调用链；保留的非属性、非诊断格式化方法均有可达调用路径。此检查用于发现候选，删除前同时核对源码引用。
- SDK 运行时仅保留 prepareSurveyDslJson 这一名称含 DSL 的函数导出；旧 DSL Action 不存在。三个包的 dist、类型声明和 source map 未发现旧独立 DSL 模块。

保留范围为题目逻辑解析与转换、原生 XML 校验及答卷索引保护，以及验证这些行为的测试。沿用 WjxDsl 文件名的文件不再包含完整问卷 DSL 工作流。历史设计记录和“旧类型不存在”的负例测试会提及已删除名称，不属于可执行实现。

该轮验证结果：当时的 DLL 调用链检查覆盖 687 个方法，未发现无调用的非属性、非诊断格式化方法或构造函数；48 项底层测试、28 项后端契约、12 项 SDK/CLI/MCP 逻辑与旧接口移除测试通过。Model/Bll 构建、C# 5 OpenAPI 集成编译、协议及文档检查通过。

## 14. 独立交叉复查与二进制清理（2026-10-19）

由独立审查分别核对后端、客户端发布面、文档和配置，并补充检查忽略目录中的编译产物。

- 删除 3 个无调用便捷属性（HasTopic、SourceTopic、TargetTopic）和 3 个仅写入或复制的预留字段（条件 Operator/Value、行为 Raw），以及无效的枚举恒等转发函数。
- 删除索引比较中固定为 true 的顺序检查开关和 2 层内部转发重载，始终执行题目及子节点顺序保护；XML 序列化验证助手移除闲置参数和返回值。
- 视频校验诊断改为说明保留原生媒体地址，删除全文 DSL 时期的自动包装、自动迁移承诺。
- 清理 .tmp 中 11 个旧构建目录和 3 个独立 DLL，并清理无源码的 SubmitResponseJsonContract 输出目录和主站 Bin 中的旧编译备份；共删除 1126 个生成文件。删除前验证目录边界、内容类型及旧程序集标识，保留日志与其他用户文件。
- 将 7 个业务项目中的 9 个 Model/Bll 依赖副本及对应 PDB 同步至当前构建版本；重新编译 Overseas，移除其旧 EXE 中的答卷锁运行时引用。其他业务程序自身输出保留。
- 使用不应用忽略规则的扫描核对 5537 个生产 C# 文件及相关配置，未发现旧独立 DSL 源实现；17 份 Model/Bll 副本及相关 EXE/DLL 中也未发现旧实现标识。
- SDK/CLI/MCP 的源码、401 个发布产物（含 133 个 source map）、导出、注册、manifest、catalog、补全、能力矩阵和打包范围未发现其他残留。文档、Skill、Prompt、Resource、SQL 和部署配置复查也未发现新的旧功能。

本轮验证通过：48 项底层测试、28 项后端契约、Model/Bll 构建、Overseas 重编译、C# 5 OpenAPI 集成编译、协议和文档检查。历史设计说明及删除回归负例仍保留已删除名称；现存 WjxDsl 文件名和逻辑模型服务于新的题目逻辑转换。

## 15. JSON 修改接口编号调整（2026-10-19）

按最新确认，`updateSurveyByJson` 的 action 从 `1000110` 调整为 `1000109`，旧编号不保留兼容入口。`1000109` 当前只表示 JSON 修改问卷，不再表示旧完整 DSL 创建或其他历史动作。

后端路由、JSON 请求识别与白名单、写操作权限、权限管理和 QPS 字段同步使用新编号；修改操作不计入创建配额。SDK 动作常量、CLI/MCP 请求、manifest、发布产物和当前文档同步更新。测试同时验证 `1000109` 唯一映射至 JSON 修改，以及 `1000110` 不再注册或授权。

验证通过：29 项后端契约、12 项 SDK/CLI/MCP 逻辑测试、CLI 全部远端命令动作专项、三包构建、C# 5 权限处理器与实际动作枚举编译，以及能力矩阵、manifest、Agent 契约和文档检查。

## 16. 创建与修改逻辑的实际测试（2026-10-19）

已在配置的测试站点创建两份草稿，实测 OR 关联创建、仅逻辑更新、清除、隐藏、跳转、完整 JSON 与逻辑更新，以及非法引用和新旧跳转循环拒绝。13 项 HTTP／查询断言通过，测试草稿 220117、220118 已验证移入回收站。

实际测试发现并修复了原生运行标记与引用反向链接遗漏、合并循环漏检、条件操作静默变义、完整内容更新的节点位置与标题问题、基础信息说明丢失，以及客户端读回误判。当前回归为 Model 78 项、真实创建／查询 19 项、生产更新方法与可控存储 24 项、后端契约 29 项、SDK 615 项；另有客户端定向与协议检查通过。

详细证据、测试边界及可复跑脚本见 [测试报告](../test-reports/2026-10-19-survey-json-logic.md)。

## 17. 移除共享查询模型新增字段（2026-10-19）

移除 `ExtQuestion.relation` 和相关赋值，保留原有 `ExtQCut.Relation`、`is_hide` 及 XML 原生 `Relation` 协议。创建输入中既有 `relation/referselect` 的兼容和 DSL 优先规则继续保留。

查询传统问卷且包含题目时，OpenAPI 始终返回从真实 XML 提取的完整 `dsl.logic`，无规则时明确返回 `logic {\n};`。SDK、CLI 和 MCP 据此核验条件显示、隐藏及清除条件；缺失或非法投影不视为成功，原生 `Relation="0"` 不视为显示成功。可复跑集成测试把真实业务程序集生成的查询投影交给 SDK，验证不依赖新增 `relation` 字段。

验证通过：SDK 全量 620 项、CLI／MCP 定向 25 项、真实创建／查询 22 项、生产修改 24 项、真实查询投影与 SDK 联合核验 6 项、Model 回归 78 项、后端契约 33 项。Model 与客户端构建、C# 5 组合契约、文档和差异检查通过，相关 Model 依赖副本已同步。
