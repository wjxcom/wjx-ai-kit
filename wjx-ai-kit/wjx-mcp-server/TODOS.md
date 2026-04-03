# TODOS

## ~~textToSurvey 完整 30+ 题型支持~~ ✅ 已完成
- **Status:** 已完成（2026-04-02）
- **实现:** textToSurvey 支持 28 个 DSL 标签（LABEL_TO_TYPE），parsedQuestionsToWire 支持 25 个题型（TYPE_MAP），含矩阵 col_items
- **架构:** 问卷创建主路径为 action 1000105（createSurveyByText，服务端 DSL 解析）；textToSurvey + parsedQuestionsToWire 作为辅助用于 dry-run 预览和本地校验

## get_short_link 短链接工具
- **What:** 实现 `get_short_link` MCP 工具，调用 shortlink.aspx 生成问卷短链接
- **Why:** 问卷分发 workflow 的最后一步，当前只能返回长 URL
- **Pros:** 完善分发闭环，生成可分享的短链接
- **Cons:** 需要研究 shortlink.aspx 的 API contract
- **Context:** MCP-UPGRADE-PLAN.md v4.0 Phase 1 原计划包含，CEO Review 因 API contract 未知而 deferred
- **Blocked by:** shortlink.aspx API contract 未知

## DSL diff（对比两版问卷差异）
- **What:** 实现 DSL diff 功能，比较两个问卷的 DSL 文本差异
- **Why:** AI Agent 修改问卷后需要知道改了什么
- **Context:** CEO Review deferred。需要 textToSurvey + surveyToText 都稳定后再做
- **Depends on:** textToSurvey 完整实现

## 批量导出 CSV prompt
- **What:** 添加 prompt 模板引导 AI Agent 批量导出问卷答卷为 CSV
- **Why:** 数据分析场景常见需求
- **Context:** CEO Review deferred

## Skill 包格式（mcporter 兼容）
- **What:** 按 mcporter 规范生成 skill/ 目录
- **Why:** 分发到 MCP skill marketplace
- **Context:** CEO Review deferred

## 快速创建/编辑 URL 资源
- **What:** 添加 `wjx://reference/quick-create-edit` 资源，文档化 build_survey_url 的 URL 模板
- **Why:** AI Agent 参考文档
- **Context:** CEO Review deferred
