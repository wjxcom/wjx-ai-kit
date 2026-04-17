# TODOS

## 待验证

- [ ] **验证服务端自动变换能力** — 确认 action 1000106 的服务端 JSONL 解析是否自动处理：多项填空 `{_}` 占位符补全、量表/评分题 `item_score` 自动赋值、滑动条数值范围展开。删除 `json-to-survey.ts` 本地解析器后，这些变换完全依赖服务端。

## 待实施

- [ ] **AI → 问卷创建管道可观测性** — 为 `createSurveyByJson` 添加日志/遥测，跟踪 AI 生成的 JSONL 文本经过创建管道后的成功率、常见失败模式和题型分布。
- [ ] **合并 4 个 JSON prompt 为 1 个参数化 prompt** — `generate-survey-json`、`generate-major-survey-json`、`generate-exam-json`、`generate-form-json` 有大量重复结构（`JSONL_FORMAT_INSTRUCTIONS`、`JSONL_CONSTRAINTS`），可合并为一个接受 `survey_type` 参数的 prompt。
