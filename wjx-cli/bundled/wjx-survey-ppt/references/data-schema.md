# Layer 1 / Layer 2 数据 Schema

`fetch_survey.py` 输出、`build_project.py` 输入的统一 JSON 结构。

## 顶层

```json
{
  "survey":     { ... },     // 问卷元信息
  "response":   { ... },     // 回收量统计
  "questions":  [ ... ],     // 题目数组（含分布数据）
  "analytics":  { ... },     // 算出来的指标（NPS/CSAT 等）
  "ai_findings": [ ... ],    // 可选，AI 注入的执行摘要
  "ai_insights": [ ... ]     // 可选，AI 注入的关键洞察
}
```

## survey

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | 问卷标题 |
| `vid` | string | 问卷 ID |
| `type` | int | 1=调查 / 3=投票 / 6=考试 / 7=表单 |
| `url` | string? | 问卷填写链接 |

## response

| 字段 | 类型 | 说明 |
|---|---|---|
| `total` | int | 总回收数 |
| `completed` | int | 已完成数 |
| `avg_time` | int? | 平均答题秒数 |

## questions[]

每题统一字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `qid` | string | 题号 |
| `type` | string | `single`/`multi`/`scale`/`matrix`/`text`/`...` |
| `title` | string | 题干 |
| `scale_type` | string? | `nps_0_10`/`csat_1_5`/`csat_1_7` 或 null |
| `distribution` | array? | `[{label, count}, ...]`，非选择题为 null |
| `options` | array? | `[{label, value}, ...]` 选项列表 |
| `open_answers` | array? | 文本题原文（前 N 条） |

## analytics

```json
{
  "nps": {
    "value": 32,
    "promoters": 0.45,
    "passives": 0.42,
    "detractors": 0.13
  },
  "csat": [
    { "qid": "Q5", "value": 0.78, "mean": 4.1 }
  ]
}
```

NPS 来自 `wjx analytics nps`，CSAT 来自 `wjx analytics csat`。两者均可缺失。

## ai_findings / ai_insights

由 AI agent 在调 `python -m wjx_survey_ppt --data-file` 之前，把已有的 data.json 加上这两个数组再传入。如果不传，`build_project.py` 会用兜底逻辑生成保底文案。

```json
{
  "ai_findings": [
    "回收 1234 份答卷，完成率 89%。",
    "NPS 净推荐值 32，处于行业中位数以上。",
    "对'售后响应速度'的不满意比例最高（22%）。"
  ],
  "ai_insights": [
    "建议优先优化售后响应：当前差评集中在 24h 未回复。",
    "推荐者对产品功能评价高，可作为种子用户做案例采访。",
    "下一轮调查可加入竞品对比维度。"
  ]
}
```
