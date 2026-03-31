# TODOS

## textToSurvey 完整 30+ 题型支持
- **What:** 扩展 textToSurvey() 支持全部 30+ 题型子类型（排序题、比重题、矩阵量表、文件上传、滑动条等）
- **Why:** v0.1.0 骨架只支持 6 核心题型。完整版让 AI Agent 能用纯文本创建任意问卷
- **Pros:** 覆盖所有题型，与 surveyToText 完全对称
- **Cons:** 需要深入研究问卷星编辑页 JS 转换逻辑，确保与后端 TxtToActivityService.cs 对齐
- **Context:** surveyToText 在 wjx-api-sdk 的 survey-to-text.ts 已有 275 行实现，覆盖 30+ 题型的反向转换。textToSurvey 需要对称实现。问卷星编辑页有一套 JS 版本的 text→survey 转换逻辑可供参考研究
- **Depends on:** 后端 API contract 确认 + 问卷星编辑页 JS 解析逻辑研究

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
