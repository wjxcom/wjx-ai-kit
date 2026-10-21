# 变更记录

## Survey JSON 逻辑改造（未发布）

- 创建和修改统一使用 Survey JSON，可选 `dsl.logic` 由服务端转换为 XML 原生逻辑属性。
- 问卷逻辑统一通过 Survey JSON 的可选 dsl.logic 提交，并由服务端转换为 XML 原生逻辑。

## 0.4.5 (2026-09-14)

- SDK、CLI、MCP Server 统一升级至 `0.4.5`，并同步工作区依赖和发布文档。
- 完善 XML DSL v1 的结构/题目语义校验、注释语法、gapfill 占位符和可创建问卷类型边界说明。
- 对齐 DSL query/generate/create/update 的字段命名、Skill 镜像和迁移文档，补充回归测试与发布产物。

## 0.4.4 (2026-09-07)

- SDK、CLI、MCP Server 统一升级至 0.4.4。
- AI PPT 默认使用固定画布逐页展示，AI 主页创建不再附带表单或问卷。
- 草稿 AI 主页可通过 `get_survey` 读取完整 HTML，并基于原稿原位修改。
- AI 主页类型保持不可变，拒绝网页、海报和 PPT 之间的更新转换。

## 0.4.3 (2026-09-04)

- SDK、CLI、MCP Server 统一升级至 0.4.3。
- 完善 AI 主页参数校验并统一共享约束。


## 0.4.2（2026-09-02）

- `wjx-api-sdk`、`wjx-mcp-server`、`wjx-cli` 统一升级至 `0.4.2`，继续按 SDK → MCP Server → CLI 顺序发布。
- 修复 MCP 运行时传递依赖中的已知安全漏洞，并在 CI 中加入 `npm audit` 门禁与每周 Dependabot 扫描。

## 0.4.1（2026-09-02）

- `wjx-api-sdk`、`wjx-mcp-server`、`wjx-cli` 的稳定版本统一为 `0.4.1`，发布顺序为 SDK → MCP Server → CLI。
- 三个包已按 SDK → MCP Server → CLI 顺序发布到 npm，registry 的 `latest` 均指向 `0.4.1`。
- SDK 暴露本地 `buildSubmitTemplate` / `decodePushPayload`；CLI 提供 `survey preview-url`；MCP 补充答卷计数、模板和推送解密工具。
- 明确 CLI 是完整主入口，MCP 只覆盖核心业务子集；具体差异由 capability matrix 定义。

## 0.4.0（已废弃）

- `wjx-api-sdk`、`wjx-mcp-server`、`wjx-cli` 曾统一发布 `0.4.0`，现已废弃，不能作为当前安装目标。
- 问卷创建统一使用 `createSurveyByJson` / `create_survey_by_json` / `survey create` 的 action `1000106` JSONL 链路。
- 问卷逻辑统一通过 Survey JSON 的可选 `dsl.logic` 处理，并从实际保存的 XML 反向读取。

## 文档更新

- 首页按用户目标分流，提供 CLI、MCP 和 SDK 的清晰入口。
- 问卷创建使用 action `1000106` 的 JSONL 链路，修改使用 action `1000109`；涉及题目关联时提供可选 `dsl.logic`。
- 补充题型、MCP 工具、认证、HTTP 部署和迁移说明。
- 标明已过时的用户体系能力和历史 `0.4.0` npm 发布方式。
- 问卷逻辑随 JSON 创建和修改接口提交，查询从实际保存的 XML 提取 `dsl.logic`。
