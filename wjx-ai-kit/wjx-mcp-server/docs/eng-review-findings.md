# Eng Review Findings — Phase 1 (v2.3.0)

> 审查日期：2026-03-30
> 审查人：Claude Opus (eng-manager agent)
> 状态：CONDITIONAL APPROVAL — 2 个阻塞项需先解决

---

## 阻塞项

### R1 (CRITICAL): get_survey 响应结构未知

代码用 `getSurvey<T = unknown>()`，没有 `SurveyDetail` 接口。计划假设 `survey.pages → questions → options` 但无证据。

**解决方案：** 用测试环境调用真实 API（get_questions=true, get_items=true, get_page_cut=true），捕获 JSON，定义 TypeScript 接口。

### R4 (MEDIUM): shortlink.aspx 契约未知

不在 OpenAPI 文档中，请求/响应格式未知。建议降级到 Phase 2 或验证后再做。

---

## 架构决策建议 (ADR)

### ADR-1: surveyToText() 集成方式

给 `get_survey` 工具加可选 `format` 参数（json/dsl/both，默认 json）。不新建工具，不破坏现有调用者。

**monorepo 修正：** `surveyToText()` 应实现在 `wjx-api-sdk/src/modules/survey/client.ts`（纯数据转换，CLI 也能用）。

### ADR-2: typeToLabel() 设计

- 需同时接收 `q_type` + `q_subtype`
- 实际有 30+ 子类型（计划只列了 16 个 DSL 标签）
- 用 lookup table `${q_type}_${q_subtype}` + fallback

### ADR-3: Phase 1 输出标签 vs Phase 2 输入标签

Phase 1 是只读（surveyToText），标签可以是任意可读中文。
Phase 2 是写入（create_survey_by_text），标签必须匹配 TxtToActivityService.cs 解析器。
应维护两套独立的映射。

---

## 代码缺陷（计划伪代码）

1. 尾部分页符：最后一页后多输出 `=== 分页 ===`
2. 无 null 守卫：`get_page_cut=false` 时 pages 可能不存在
3. 矩阵题：12 种矩阵子类型有行/列结构，伪代码只渲染扁平选项
4. 字段名假设：选项可能是 `item_title` 而非 `option.text`
5. 量表题：应渲染为 `1~5` 范围而非选项列表

---

## 完整题型子类型表

| q_type | q_subtype | DSL Label | 计划覆盖? |
|--------|-----------|-----------|-----------|
| 1 | -- | [分页栏] | Yes |
| 2 | -- | [段落说明] | Yes |
| 3 | 3 | [单选题] | Yes |
| 3 | 301 | [下拉框] | NO |
| 3 | 302 | [量表题] | Yes |
| 3 | 303 | [评分单选] | NO |
| 3 | 304 | [情景题] | NO |
| 3 | 305 | [判断题] | Yes |
| 4 | 4 | [多选题] | Yes |
| 4 | 401 | [评分多选] | NO |
| 4 | 402 | [排序题] | Yes |
| 4 | 403 | [商品题] | NO |
| 5 | 5 | [填空题] | Yes |
| 5 | 501 | [多级下拉题] | NO |
| 6 | 6 | [多项填空题] | NO |
| 7 | 701 | [矩阵量表题] | Yes |
| 7 | 702 | [矩阵单选题] | Yes |
| 7 | 703 | [矩阵多选题] | NO |
| 7 | 704-712 | 各种矩阵变体 | NO |
| 8 | 8 | [文件上传] | NO |
| 8 | 801 | [绘图题] | NO |
| 9 | -- | [比重题] | Yes |
| 10 | -- | [滑动条] | NO |

---

## 测试矩阵

| 类别 | 测试用例 | 优先级 |
|------|---------|--------|
| Happy path | 单页单选问卷；多页混合问卷 | P0 |
| 所有 q_type | 1-10（10 个测试） | P0 |
| 所有 q_subtype | 301-812（25+ 测试） | P1 |
| 结构边界 | 空问卷；单题；50+ 题 | P0 |
| 分页 | 单页（无分隔符）；多页（分隔符在中间）；空页 | P0 |
| 矩阵题 | 行+列；仅行 | P0 |
| Null 安全 | 缺 pages；缺 questions；缺 options/items；null title | P0 |
| HTML 清理 | 标题含 `<b>`, `<br>`, `<img>` | P1 |
| get_short_link | 有效 wjx.cn URL；非 wjx.cn 拒绝；畸形 URL | P0 |
| 资源/提示 | DSL 语法资源结构正确；prompt 内容完整 | P1 |

**覆盖目标：** surveyToText() + typeToLabel() 100% 行覆盖（纯函数）。
