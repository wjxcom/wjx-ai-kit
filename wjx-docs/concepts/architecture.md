# 架构与边界

```text
AI 客户端 / 脚本
   ├─ wjx-cli（默认入口）
   ├─ wjx-mcp-server（MCP 客户端可选）
   └─ wjx-api-sdk（Node.js 程序集成）
          └─ 问卷星 OpenAPI
```

SDK 是共享业务基础层，负责认证、传输、重试、问卷/答卷业务函数和本地分析；CLI 在其上提供完整的 Runtime、Catalog、工作站配置、补全和 Skill 安装；MCP Server 在其上提供面向原生 MCP 客户端的核心业务子集。MCP 处于 secondary / maintenance-mode，具体差异由仓库 [能力矩阵](../../capabilities/capability-matrix.json) 定义。MCP 的 stdio 适合本机客户端，HTTP 适合受控的服务化部署。

Agent、Skill 是工作流提示和参考资料，不是新的 API 层。它们应调用 CLI 或 MCP，不应复制一份独立的参数真相。

CLI 的 `init`、`doctor`、profile、completion、reference/schema、update 和 Skill 安装属于工作站能力，不要求 MCP 对齐。MCP 不暴露通用 `call_api`，以避免 LLM 绕过 Tool schema、风险标注和 action 约束。

用户体系是例外的兼容边界：MCP/CLI 仍保留历史参与者和绑定工具，但这些能力已标记为 Deprecated，创建接口不支持新建 `atype=8`。新项目不应以用户体系作为架构依赖。


## Survey JSON 与逻辑

问卷创建统一使用 Survey JSON（JSONL），修改使用同一内容格式。涉及题目关联时增加可选节点：

```json
{"dsl":{"logic":"logic { if \"2::1\" then show \"3\"; };"}}
```

完整请求的 `jsonl` 是 JSONL 字符串；`dsl` 是对象，只包含 `logic`。无逻辑时省略 `dsl`。已有 `relation/referselect` 字段继续保留，冲突时 DSL 优先。

SDK 使用 `createSurveyByJson` / `updateSurveyByJson`；CLI 使用 `survey create` / `survey update`；MCP 使用 `create_survey_by_json` / `update_survey_by_json`。普通查询 `getSurvey` / `survey get` / `get_survey` 从实际 XML 返回可编辑的 `dsl.logic`。

仅修改逻辑时提交 `vid + dsl`；修改题目时提交 `vid + jsonl`，可同时提交 `dsl`。修改不会隐式重新发布或迁移创建者。修改请求执行一次，之后从普通查询验证实际保存结果。

服务端将 DSL 解析并转换为 XML 的 Relation、ItemRelation、AnytimeJumpto、ReferTopic 等原生逻辑属性。XML 中不保存 DSL 原文或新增的 DSL 节点。仅修改逻辑时在原 XML 上更新对应属性，保留题目、选项、分页、设置和扩展数据。

```text
创建：Survey JSON -> 题目 XML；dsl.logic -> 原生 XML 逻辑；校验后保存 XML
修改逻辑：实际 XML -> dsl.logic -> AI 修改 -> 原生 XML 逻辑 -> 更新原 XML
```

CLI 示例：

```powershell
wjx survey create --file survey.jsonl --dsl '{"logic":"logic { if \"2::1\" then show \"3\"; };"}'
wjx survey get --vid 12345
wjx --yes survey update --vid 12345 --dsl '{"logic":"logic { if \"2::2\" then show \"3\"; };"}'
wjx --yes survey update --vid 12345 --file survey.jsonl
```

修改问卷结构时，已有的答卷索引保护继续生效；无答卷问卷确需结构变更时显式使用 `--allow-breaking-changes`（SDK 为 `allowBreakingChanges`，MCP 为 `allow_breaking_changes`）。
