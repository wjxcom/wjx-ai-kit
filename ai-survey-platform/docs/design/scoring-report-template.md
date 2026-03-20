# 问卷质量评分报告模板与改进建议生成器设计

> CMP-11 | 项目：跨系统集成与自动化 | 父任务：CMP-5 设计并实现问卷质量自动评分系统

---

## 第一部分：评分报告模板

### 1.1 报告结构总览

```
┌────────────────────────────────────────────┐
│           问卷质量评分报告                    │
├────────────────────────────────────────────┤
│  1. 总体评分摘要                             │
│  2. 各维度评分详情                            │
│  3. 对比基准分析                              │
│  4. 改进建议（按优先级）                       │
│  5. 洞察与趋势                               │
└────────────────────────────────────────────┘
```

### 1.2 总体评分展示格式

#### 数据结构

```json
{
  "report_id": "RPT-20260320-001",
  "questionnaire_id": "Q-2026-0042",
  "questionnaire_title": "2026年客户满意度调查",
  "evaluated_at": "2026-03-20T10:30:00Z",
  "evaluator_version": "v1.0",

  "overall_score": {
    "score": 78.5,
    "max_score": 100,
    "grade": "B",
    "grade_label": "良好",
    "percentile_rank": 65
  },

  "grade_scale": [
    { "grade": "A+", "label": "卓越", "range": [95, 100] },
    { "grade": "A",  "label": "优秀", "range": [90, 95) },
    { "grade": "B+", "label": "较好", "range": [85, 90) },
    { "grade": "B",  "label": "良好", "range": [75, 85) },
    { "grade": "C+", "label": "中等", "range": [65, 75) },
    { "grade": "C",  "label": "及格", "range": [55, 65) },
    { "grade": "D",  "label": "较差", "range": [40, 55) },
    { "grade": "F",  "label": "不合格", "range": [0, 40) }
  ],

  "radar_chart_data": {
    "dimensions": [
      { "key": "structure",     "label": "结构设计",   "score": 82, "weight": 0.20 },
      { "key": "question_quality", "label": "题目质量", "score": 75, "weight": 0.25 },
      { "key": "logic_flow",    "label": "逻辑流程",   "score": 88, "weight": 0.15 },
      { "key": "respondent_exp", "label": "答题体验",  "score": 70, "weight": 0.15 },
      { "key": "data_quality",  "label": "数据质量",   "score": 80, "weight": 0.15 },
      { "key": "compliance",    "label": "合规性",     "score": 76, "weight": 0.10 }
    ],
    "industry_benchmark": {
      "structure": 80,
      "question_quality": 78,
      "logic_flow": 82,
      "respondent_exp": 75,
      "data_quality": 77,
      "compliance": 85
    }
  }
}
```

#### 展示模板（Markdown 渲染）

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  问卷质量评分报告
  报告编号：RPT-20260320-001
  评估时间：2026-03-20 10:30
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  【总体评分】

      78.5 / 100    等级：B（良好）

  同行业排名：前 35%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 1.3 各维度评分详情展示

#### 数据结构

```json
{
  "dimension_details": [
    {
      "key": "structure",
      "label": "结构设计",
      "score": 82,
      "max_score": 100,
      "weight": 0.20,
      "weighted_score": 16.4,
      "sub_items": [
        {
          "item": "问卷长度合理性",
          "score": 90,
          "max_score": 100,
          "status": "pass",
          "detail": "共 25 题，预计完成时间 8 分钟，在推荐范围内（5-15分钟）"
        },
        {
          "item": "分页/分组设计",
          "score": 75,
          "max_score": 100,
          "status": "warning",
          "detail": "存在 1 个页面包含 8 道题目，建议拆分（推荐每页不超过 5 题）",
          "deductions": [
            {
              "reason": "页面题目数过多",
              "points_deducted": 15,
              "affected_questions": ["Q12-Q19"],
              "severity": "medium"
            }
          ]
        },
        {
          "item": "题目类型多样性",
          "score": 80,
          "max_score": 100,
          "status": "pass",
          "detail": "使用了 4 种题型（单选、多选、量表、开放题），分布较均衡"
        }
      ]
    }
  ]
}
```

#### 展示模板

```
┌─────────────────────────────────────────────────────┐
│  维度评分详情                                         │
├──────────┬───────┬──────┬────────┬──────────────────┤
│ 维度      │ 分数  │ 权重  │ 加权分  │ 状态             │
├──────────┼───────┼──────┼────────┼──────────────────┤
│ 结构设计   │ 82   │ 20%  │ 16.4   │ ✅ 良好          │
│ 题目质量   │ 75   │ 25%  │ 18.75  │ ⚠️  需改进       │
│ 逻辑流程   │ 88   │ 15%  │ 13.2   │ ✅ 优秀          │
│ 答题体验   │ 70   │ 15%  │ 10.5   │ ⚠️  需改进       │
│ 数据质量   │ 80   │ 15%  │ 12.0   │ ✅ 良好          │
│ 合规性     │ 76   │ 10%  │ 7.6    │ ⚠️  需改进       │
├──────────┼───────┼──────┼────────┼──────────────────┤
│ 总计      │ 78.5 │ 100% │ 78.45  │ B 良好           │
└──────────┴───────┴──────┴────────┴──────────────────┘
```

### 1.4 对比基准展示

#### 数据结构

```json
{
  "benchmark_comparison": {
    "industry": "市场调研",
    "sample_size": 1250,
    "period": "2025-Q4",
    "comparisons": [
      {
        "dimension": "结构设计",
        "your_score": 82,
        "industry_avg": 80,
        "industry_p75": 88,
        "industry_p25": 72,
        "delta": 2,
        "position": "above_average"
      },
      {
        "dimension": "题目质量",
        "your_score": 75,
        "industry_avg": 78,
        "industry_p75": 85,
        "industry_p25": 70,
        "delta": -3,
        "position": "below_average"
      }
    ],
    "summary": {
      "above_avg_dimensions": 3,
      "below_avg_dimensions": 3,
      "strongest": "逻辑流程",
      "weakest": "答题体验"
    }
  }
}
```

#### 展示模板

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  行业对比基准
  行业：市场调研 | 样本量：1,250 份问卷 | 周期：2025 Q4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  维度        你的分数   行业均值   差异    位置
  ──────────────────────────────────────
  结构设计      82       80       +2     高于平均 ▲
  题目质量      75       78       -3     低于平均 ▼
  逻辑流程      88       82       +6     显著领先 ▲▲
  答题体验      70       75       -5     低于平均 ▼
  数据质量      80       77       +3     高于平均 ▲
  合规性        76       85       -9     明显落后 ▼▼

  优势领域：逻辑流程（超行业均值 +6 分）
  薄弱领域：合规性（低于行业均值 -9 分）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 第二部分：改进建议生成逻辑

### 2.1 建议生成规则

改进建议基于扣分项自动生成。每条扣分记录（deduction）映射到一条或多条改进建议。

#### 生成流程

```
扣分项（deduction）
  ↓
匹配建议规则库（suggestion_rules）
  ↓
生成原始建议列表
  ↓
计算优先级分数（priority_score = impact × ease_of_fix）
  ↓
按优先级排序
  ↓
分类（必须修改 / 建议改进 / 可选优化）
  ↓
输出最终建议列表
```

#### 建议规则库结构

```json
{
  "suggestion_rules": [
    {
      "rule_id": "SR-001",
      "trigger": {
        "dimension": "structure",
        "item": "页面题目数过多",
        "severity": ["medium", "high"]
      },
      "suggestion": {
        "title": "拆分长页面，优化分页设计",
        "problem": "单页题目过多会导致答题者疲劳，增加放弃率",
        "impact": "答题完成率可提升 10%-15%",
        "method": "将超过 5 道题的页面拆分为多个子页面，按主题分组",
        "example": "将第3页的8道满意度题目拆分为「服务满意度」（4题）和「产品满意度」（4题）两个页面"
      },
      "impact_score": 8,
      "fix_difficulty": 2
    },
    {
      "rule_id": "SR-002",
      "trigger": {
        "dimension": "question_quality",
        "item": "双重否定表述",
        "severity": ["low", "medium", "high"]
      },
      "suggestion": {
        "title": "消除双重否定表述",
        "problem": "双重否定句式（如"您是否不同意不应该..."）造成理解困难，影响作答准确性",
        "impact": "题目理解正确率可提升 20%-30%",
        "method": "将双重否定改写为肯定句式或单一否定句式",
        "example": "原题："您是否不同意该产品不值得推荐？" → 改为："您认为该产品值得推荐吗？""
      },
      "impact_score": 9,
      "fix_difficulty": 1
    },
    {
      "rule_id": "SR-003",
      "trigger": {
        "dimension": "question_quality",
        "item": "引导性提问",
        "severity": ["medium", "high"]
      },
      "suggestion": {
        "title": "修改引导性措辞为中性表达",
        "problem": "引导性提问（如"您同意我们优秀的服务吗"）会引入偏差，降低数据有效性",
        "impact": "调研结果可信度显著提升",
        "method": "移除形容词和暗示性措辞，使用中性语言",
        "example": "原题："您是否满意我们快速高效的客服响应？" → 改为："请评价我们的客服响应速度""
      },
      "impact_score": 9,
      "fix_difficulty": 2
    },
    {
      "rule_id": "SR-004",
      "trigger": {
        "dimension": "question_quality",
        "item": "选项不完整",
        "severity": ["medium", "high"]
      },
      "suggestion": {
        "title": "补充缺失选项或添加「其他」选项",
        "problem": "选项覆盖不全导致答题者无法准确表达，被迫随意选择",
        "impact": "数据准确性提升，无效作答减少",
        "method": "审查所有单选/多选题的选项完整性，补充遗漏选项，必要时添加「其他（请注明）」",
        "example": "年龄段选项缺少"60岁以上" → 添加完整的年龄段覆盖"
      },
      "impact_score": 7,
      "fix_difficulty": 2
    },
    {
      "rule_id": "SR-005",
      "trigger": {
        "dimension": "logic_flow",
        "item": "缺少跳转逻辑",
        "severity": ["medium", "high"]
      },
      "suggestion": {
        "title": "添加条件跳转逻辑",
        "problem": "所有答题者回答所有题目，包括与其无关的题目，导致体验差和数据冗余",
        "impact": "平均作答时长减少 20%-30%，数据相关性提升",
        "method": "为筛选性题目设置条件跳转，跳过不相关题目",
        "example": "Q5 回答"未使用该产品"时，自动跳过 Q6-Q10 的产品使用体验题"
      },
      "impact_score": 7,
      "fix_difficulty": 4
    },
    {
      "rule_id": "SR-006",
      "trigger": {
        "dimension": "respondent_exp",
        "item": "必填题过多",
        "severity": ["medium", "high"]
      },
      "suggestion": {
        "title": "减少必填题数量，允许选择性跳过",
        "problem": "过高的必填比例（>80%）造成答题压力，增加中途放弃率",
        "impact": "问卷完成率可提升 15%-25%",
        "method": "仅核心题目设为必填，辅助性题目设为选填，必填比例控制在 50%-70%",
        "example": "将「补充说明」「其他意见」等开放题改为选填"
      },
      "impact_score": 8,
      "fix_difficulty": 1
    },
    {
      "rule_id": "SR-007",
      "trigger": {
        "dimension": "respondent_exp",
        "item": "缺少进度指示",
        "severity": ["low", "medium"]
      },
      "suggestion": {
        "title": "添加答题进度条",
        "problem": "答题者不知道还需多长时间完成，不确定感增加放弃意愿",
        "impact": "问卷完成率可提升 5%-10%",
        "method": "在页面顶部显示进度百分比或"第X页/共Y页"",
        "example": "添加进度条显示"当前进度：60%（第3页/共5页）""
      },
      "impact_score": 5,
      "fix_difficulty": 1
    },
    {
      "rule_id": "SR-008",
      "trigger": {
        "dimension": "data_quality",
        "item": "缺少数据验证",
        "severity": ["medium", "high"]
      },
      "suggestion": {
        "title": "添加输入验证规则",
        "problem": "缺少数据格式和范围验证，收集到的数据可能包含无效值",
        "impact": "数据清洗工作量减少 40%-60%",
        "method": "为数值、日期、邮箱等字段添加格式验证；为量表题添加合理性校验",
        "example": "年龄字段添加范围限制（1-120），邮箱字段添加格式验证"
      },
      "impact_score": 7,
      "fix_difficulty": 3
    },
    {
      "rule_id": "SR-009",
      "trigger": {
        "dimension": "compliance",
        "item": "缺少隐私声明",
        "severity": ["high"]
      },
      "suggestion": {
        "title": "添加数据隐私声明和知情同意",
        "problem": "缺少隐私告知可能违反《个人信息保护法》等法规，存在合规风险",
        "impact": "消除法律合规风险，增强答题者信任",
        "method": "在问卷首页添加数据收集目的说明、使用范围、保护措施、联系方式，并设置知情同意勾选",
        "example": "首页添加："本调查由XX公司开展，数据仅用于产品改进，我们将严格保护您的隐私...""
      },
      "impact_score": 10,
      "fix_difficulty": 1
    },
    {
      "rule_id": "SR-010",
      "trigger": {
        "dimension": "compliance",
        "item": "收集敏感信息未说明用途",
        "severity": ["high"]
      },
      "suggestion": {
        "title": "明确敏感信息收集的必要性和用途",
        "problem": "收集身份证号、地址等敏感信息而未说明理由，可能引起答题者疑虑并违反法规",
        "impact": "提高合规性，减少因隐私顾虑导致的放弃",
        "method": "评估每个敏感信息字段是否必需，必需的需在题目旁说明收集原因",
        "example": "手机号字段添加说明："用于发送调查结果反馈，不会用于其他目的""
      },
      "impact_score": 9,
      "fix_difficulty": 2
    }
  ]
}
```

### 2.2 优先级计算与排序

#### 优先级分数公式

```
priority_score = impact_score × (1 / fix_difficulty)
```

- **impact_score**（影响度）：1-10 分，衡量该问题对问卷质量和用户体验的影响程度
- **fix_difficulty**（修改难度）：1-5 分（1=非常容易，5=较复杂）
- **priority_score** 越高，越应优先处理

#### 优先级分类规则

| 分类 | 条件 | 标签 | 颜色 |
|------|------|------|------|
| 必须修改 | `priority_score >= 5` 或 `severity == "high"` 且 `impact_score >= 8` | `P0 - 必须修改` | 红色 |
| 建议改进 | `priority_score >= 2` 且不满足 P0 | `P1 - 建议改进` | 橙色 |
| 可选优化 | `priority_score < 2` | `P2 - 可选优化` | 蓝色 |

#### 排序规则

1. 先按分类排序：P0 > P1 > P2
2. 同分类内按 `priority_score` 降序排列
3. 相同 `priority_score` 按 `impact_score` 降序排列

### 2.3 建议输出格式

#### 数据结构

```json
{
  "improvement_suggestions": [
    {
      "suggestion_id": "SUG-001",
      "priority": "P0",
      "priority_label": "必须修改",
      "priority_score": 10.0,
      "source_rule": "SR-009",
      "source_deduction": {
        "dimension": "合规性",
        "item": "缺少隐私声明",
        "points_deducted": 20,
        "affected_questions": ["问卷首页"]
      },
      "title": "添加数据隐私声明和知情同意",
      "problem": "缺少隐私告知可能违反《个人信息保护法》等法规，存在合规风险",
      "impact": "消除法律合规风险，增强答题者信任",
      "method": "在问卷首页添加数据收集目的说明、使用范围、保护措施、联系方式，并设置知情同意勾选",
      "example": "首页添加："本调查由XX公司开展，数据仅用于产品改进，我们将严格保护您的隐私...""
    }
  ],
  "summary": {
    "total_suggestions": 6,
    "by_priority": {
      "P0_must_fix": 2,
      "P1_should_improve": 3,
      "P2_optional": 1
    },
    "estimated_score_improvement": 15,
    "estimated_new_score": 93.5,
    "estimated_new_grade": "A"
  }
}
```

#### 展示模板

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  改进建议（共 6 条）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  🔴 P0 - 必须修改（2 条）
  ─────────────────────────────────────

  1. 添加数据隐私声明和知情同意
     来源维度：合规性 | 扣分：-20
     ┌────────────────────────────────┐
     │ 问题：缺少隐私告知可能违反       │
     │ 《个人信息保护法》等法规         │
     │                                │
     │ 影响：消除法律合规风险，          │
     │ 增强答题者信任                   │
     │                                │
     │ 改进方法：在问卷首页添加数据      │
     │ 收集目的说明、使用范围、          │
     │ 保护措施、联系方式               │
     │                                │
     │ 示例：首页添加："本调查由XX       │
     │ 公司开展，数据仅用于产品改进，    │
     │ 我们将严格保护您的隐私..."       │
     └────────────────────────────────┘

  2. 消除双重否定表述
     来源维度：题目质量 | 扣分：-15
     ┌────────────────────────────────┐
     │ 问题：双重否定造成理解困难        │
     │                                │
     │ 影响：题目理解正确率可提升        │
     │ 20%-30%                        │
     │                                │
     │ 改进方法：将双重否定改写为        │
     │ 肯定句式或单一否定句式            │
     │                                │
     │ 示例：                          │
     │ 原题："您是否不同意该产品不值     │
     │ 得推荐？"                       │
     │ 改为："您认为该产品值得推荐吗？"  │
     └────────────────────────────────┘

  🟠 P1 - 建议改进（3 条）
  ─────────────────────────────────────
  3. 拆分长页面，优化分页设计 ...
  4. 减少必填题数量 ...
  5. 添加输入验证规则 ...

  🔵 P2 - 可选优化（1 条）
  ─────────────────────────────────────
  6. 添加答题进度条 ...

  ─────────────────────────────────────
  预计改进效果：
    当前分数 78.5 → 预计优化后 93.5（+15分）
    当前等级 B → 预计提升至 A
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 第三部分：洞察提炼

### 3.1 常见质量问题 Top 10

设计一套统计和展示框架，基于所有评估过的问卷，提炼最高频出现的质量问题。

#### 数据结构

```json
{
  "top_10_quality_issues": {
    "period": "2026-Q1",
    "total_questionnaires_evaluated": 580,
    "issues": [
      {
        "rank": 1,
        "issue": "缺少隐私声明/知情同意",
        "dimension": "合规性",
        "occurrence_rate": 0.62,
        "occurrence_count": 360,
        "avg_points_deducted": 18,
        "trend": "stable",
        "trend_vs_last_period": -0.02
      },
      {
        "rank": 2,
        "issue": "问卷长度过长（>20分钟）",
        "dimension": "结构设计",
        "occurrence_rate": 0.45,
        "occurrence_count": 261,
        "avg_points_deducted": 12,
        "trend": "increasing",
        "trend_vs_last_period": 0.08
      },
      {
        "rank": 3,
        "issue": "引导性提问",
        "dimension": "题目质量",
        "occurrence_rate": 0.41,
        "occurrence_count": 238,
        "avg_points_deducted": 10,
        "trend": "decreasing",
        "trend_vs_last_period": -0.05
      },
      {
        "rank": 4,
        "issue": "选项不完整/覆盖不全",
        "dimension": "题目质量",
        "occurrence_rate": 0.38,
        "occurrence_count": 220,
        "avg_points_deducted": 8,
        "trend": "stable",
        "trend_vs_last_period": 0.01
      },
      {
        "rank": 5,
        "issue": "必填题比例过高（>80%）",
        "dimension": "答题体验",
        "occurrence_rate": 0.35,
        "occurrence_count": 203,
        "avg_points_deducted": 8,
        "trend": "decreasing",
        "trend_vs_last_period": -0.03
      },
      {
        "rank": 6,
        "issue": "缺少条件跳转逻辑",
        "dimension": "逻辑流程",
        "occurrence_rate": 0.33,
        "occurrence_count": 191,
        "avg_points_deducted": 7,
        "trend": "stable",
        "trend_vs_last_period": 0.00
      },
      {
        "rank": 7,
        "issue": "单页题目数过多（>5题）",
        "dimension": "结构设计",
        "occurrence_rate": 0.30,
        "occurrence_count": 174,
        "avg_points_deducted": 6,
        "trend": "increasing",
        "trend_vs_last_period": 0.04
      },
      {
        "rank": 8,
        "issue": "缺少数据验证规则",
        "dimension": "数据质量",
        "occurrence_rate": 0.28,
        "occurrence_count": 162,
        "avg_points_deducted": 7,
        "trend": "decreasing",
        "trend_vs_last_period": -0.06
      },
      {
        "rank": 9,
        "issue": "量表锚点不清晰",
        "dimension": "题目质量",
        "occurrence_rate": 0.25,
        "occurrence_count": 145,
        "avg_points_deducted": 5,
        "trend": "stable",
        "trend_vs_last_period": -0.01
      },
      {
        "rank": 10,
        "issue": "缺少答题进度指示",
        "dimension": "答题体验",
        "occurrence_rate": 0.22,
        "occurrence_count": 128,
        "avg_points_deducted": 4,
        "trend": "decreasing",
        "trend_vs_last_period": -0.07
      }
    ]
  }
}
```

#### 展示模板

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  常见质量问题 Top 10（2026 Q1）
  样本量：580 份问卷
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  排名  问题                     出现率    趋势
  ─────────────────────────────────────
   1   缺少隐私声明               62%     → 持平
   2   问卷长度过长               45%     ↑ 上升
   3   引导性提问                 41%     ↓ 下降
   4   选项不完整                 38%     → 持平
   5   必填题比例过高             35%     ↓ 下降
   6   缺少条件跳转               33%     → 持平
   7   单页题目数过多             30%     ↑ 上升
   8   缺少数据验证               28%     ↓ 下降
   9   量表锚点不清晰             25%     → 持平
  10   缺少答题进度指示           22%     ↓ 下降

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3.2 行业质量基准线

#### 数据结构

```json
{
  "industry_benchmarks": {
    "last_updated": "2026-Q1",
    "industries": [
      {
        "industry": "市场调研",
        "sample_size": 1250,
        "avg_score": 76.3,
        "median_score": 78.0,
        "p25": 68.0,
        "p75": 85.0,
        "dimension_averages": {
          "structure": 80,
          "question_quality": 78,
          "logic_flow": 82,
          "respondent_exp": 75,
          "data_quality": 77,
          "compliance": 85
        }
      },
      {
        "industry": "员工满意度",
        "sample_size": 890,
        "avg_score": 72.1,
        "median_score": 73.5,
        "p25": 64.0,
        "p75": 81.0,
        "dimension_averages": {
          "structure": 76,
          "question_quality": 74,
          "logic_flow": 78,
          "respondent_exp": 70,
          "data_quality": 72,
          "compliance": 80
        }
      },
      {
        "industry": "学术研究",
        "sample_size": 650,
        "avg_score": 80.5,
        "median_score": 82.0,
        "p25": 74.0,
        "p75": 88.0,
        "dimension_averages": {
          "structure": 84,
          "question_quality": 82,
          "logic_flow": 80,
          "respondent_exp": 72,
          "data_quality": 85,
          "compliance": 82
        }
      },
      {
        "industry": "产品反馈",
        "sample_size": 1580,
        "avg_score": 74.8,
        "median_score": 76.0,
        "p25": 66.0,
        "p75": 83.0,
        "dimension_averages": {
          "structure": 78,
          "question_quality": 76,
          "logic_flow": 80,
          "respondent_exp": 73,
          "data_quality": 75,
          "compliance": 78
        }
      },
      {
        "industry": "教育评估",
        "sample_size": 420,
        "avg_score": 78.2,
        "median_score": 79.0,
        "p25": 72.0,
        "p75": 86.0,
        "dimension_averages": {
          "structure": 82,
          "question_quality": 80,
          "logic_flow": 76,
          "respondent_exp": 78,
          "data_quality": 80,
          "compliance": 83
        }
      }
    ]
  }
}
```

### 3.3 质量趋势追踪指标

#### 指标体系

```json
{
  "trend_metrics": {
    "tracking_frequency": "monthly",
    "metrics": [
      {
        "metric_id": "TM-001",
        "name": "平均质量评分",
        "description": "所有已评估问卷的月度平均质量分数",
        "calculation": "SUM(scores) / COUNT(questionnaires)",
        "target": "逐月提升，目标 >= 80",
        "alert_threshold": "连续两月下降或低于 70"
      },
      {
        "metric_id": "TM-002",
        "name": "优质问卷占比",
        "description": "评分 >= 85（B+及以上）的问卷在总评估数中的占比",
        "calculation": "COUNT(score >= 85) / COUNT(all)",
        "target": ">= 40%",
        "alert_threshold": "< 25%"
      },
      {
        "metric_id": "TM-003",
        "name": "不合格问卷占比",
        "description": "评分 < 55（D等级及以下）的问卷占比",
        "calculation": "COUNT(score < 55) / COUNT(all)",
        "target": "<= 10%",
        "alert_threshold": "> 20%"
      },
      {
        "metric_id": "TM-004",
        "name": "P0 问题平均数",
        "description": "每份问卷平均检出的 P0（必须修改）建议条数",
        "calculation": "SUM(p0_count) / COUNT(questionnaires)",
        "target": "<= 1.0",
        "alert_threshold": "> 2.5"
      },
      {
        "metric_id": "TM-005",
        "name": "改进采纳率",
        "description": "用户收到改进建议后实际修改的比例",
        "calculation": "COUNT(adopted_suggestions) / COUNT(total_suggestions)",
        "target": ">= 60%",
        "alert_threshold": "< 30%"
      },
      {
        "metric_id": "TM-006",
        "name": "改进后提分幅度",
        "description": "用户采纳建议修改后，再次评分的平均提升分数",
        "calculation": "AVG(new_score - old_score) WHERE re_evaluated = true",
        "target": ">= 10 分",
        "alert_threshold": "< 5 分"
      },
      {
        "metric_id": "TM-007",
        "name": "各维度月度均分",
        "description": "六个评估维度各自的月度平均分数，用于发现结构性问题",
        "calculation": "分维度计算 AVG(dimension_score)",
        "target": "所有维度 >= 75",
        "alert_threshold": "任一维度 < 65"
      },
      {
        "metric_id": "TM-008",
        "name": "行业对标差异",
        "description": "各行业问卷质量与该行业基准线的平均偏差",
        "calculation": "AVG(score - industry_benchmark) GROUP BY industry",
        "target": "差异 >= 0（达到或超过行业基准）",
        "alert_threshold": "差异 < -5"
      }
    ]
  }
}
```

#### 展示模板（月度趋势）

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  质量趋势追踪（2026年1月 - 3月）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  指标                 1月    2月    3月    趋势
  ─────────────────────────────────────
  平均质量评分          74.2   75.8   76.3   ↑
  优质问卷占比          32%    35%    37%    ↑
  不合格问卷占比        15%    13%    12%    ↓ (好)
  P0 问题平均数         2.1    1.8    1.6    ↓ (好)
  改进采纳率            48%    52%    55%    ↑
  改进后提分幅度        8.5    9.2    10.1   ↑

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 第四部分：完整报告输出样例

以下是一份完整的问卷质量评分报告样例，展示所有模块的联动输出：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  问卷质量评分报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  报告编号：RPT-20260320-001
  问卷名称：2026年客户满意度调查
  评估时间：2026-03-20 10:30
  评估引擎版本：v1.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  一、总体评分

      78.5 / 100    等级：B（良好）
      同行业（市场调研）排名：前 35%

  二、维度评分

  维度        分数   权重   加权分   状态        行业均值  对比
  ────────────────────────────────────────────────
  结构设计     82    20%   16.4    ✅ 良好      80       +2 ▲
  题目质量     75    25%   18.75   ⚠️  需改进   78       -3 ▼
  逻辑流程     88    15%   13.2    ✅ 优秀      82       +6 ▲
  答题体验     70    15%   10.5    ⚠️  需改进   75       -5 ▼
  数据质量     80    15%   12.0    ✅ 良好      77       +3 ▲
  合规性       76    10%   7.6     ⚠️  需改进   85       -9 ▼
  ────────────────────────────────────────────────
  总计        78.5  100%  78.45   B 良好

  优势：逻辑流程（+6 vs 行业）
  短板：合规性（-9 vs 行业）

  三、改进建议（共 6 条）

  🔴 P0 - 必须修改（2 条）

    1. [合规性] 添加数据隐私声明和知情同意
       问题：缺少隐私告知，存在合规风险
       影响：消除法律风险，增强答题者信任
       方法：首页添加数据收集目的、范围、保护措施
       示例：首页添加："本调查由XX公司开展..."

    2. [题目质量] 消除双重否定表述
       问题：Q7, Q15 存在双重否定，理解困难
       影响：题目理解正确率可提升 20%-30%
       方法：改写为肯定句式
       示例："您是否不同意..." → "您认为...吗？"

  🟠 P1 - 建议改进（3 条）

    3. [结构设计] 拆分长页面
    4. [答题体验] 减少必填题数量
    5. [数据质量] 添加输入验证规则

  🔵 P2 - 可选优化（1 条）

    6. [答题体验] 添加答题进度条

  预计改进效果：78.5 → 93.5（+15分），等级 B → A

  四、洞察

  该问卷在逻辑流程方面表现突出，但合规性和答题体验
  低于行业平均水平。建议优先解决 P0 级别的隐私声明
  缺失问题，这是法规强制要求且修改成本极低。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  报告生成时间：2026-03-20 10:30:15
  本报告由问卷星 AI 质量评分系统自动生成
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 附录：API 接口设计建议

### 生成报告接口

```
POST /api/v1/quality-report/generate

Request:
{
  "questionnaire_id": "Q-2026-0042",
  "industry": "market_research",
  "include_benchmark": true,
  "include_suggestions": true,
  "output_format": "json"  // "json" | "markdown" | "pdf"
}

Response:
{
  "report_id": "RPT-20260320-001",
  "overall_score": { ... },
  "dimension_details": [ ... ],
  "benchmark_comparison": { ... },
  "improvement_suggestions": [ ... ],
  "insights": { ... }
}
```

### 获取行业基准接口

```
GET /api/v1/benchmarks?industry=market_research&period=2026-Q1
```

### 获取趋势数据接口

```
GET /api/v1/trends?metrics=avg_score,quality_ratio&period=2026-01,2026-03
```
