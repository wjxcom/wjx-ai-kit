"""Python 评分引擎

输入：问卷结构 JSON（包含问题、回答、元数据）
输出：总分、各维度分数、改进建议列表

该实现是一个参考实现，后续可以根据具体评分模型设计文档进行参数和规则调整。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Tuple


@dataclass
class DimensionScore:
    name: str
    raw_score: float
    max_score: float
    normalized_score: float
    level: str
    suggestions: List[str]


@dataclass
class ScoringResult:
    total_score: float
    max_total_score: float
    normalized_score: float
    level: str
    dimension_scores: List[DimensionScore]
    suggestions: List[str]


# 一些简单的等级划分与建议模板，可按需调整
LEVEL_THRESHOLDS: List[Tuple[str, float]] = [
    ("高质量", 85.0),
    ("中等质量", 60.0),
    ("低质量", 0.0),
]


def classify_level(score: float) -> str:
    for level, threshold in LEVEL_THRESHOLDS:
        if score >= threshold:
            return level
    return "低质量"


def _safe_get(d: Dict[str, Any], key: str, default: Any = None) -> Any:
    value = d.get(key, default)
    return value if value is not None else default


def score_questionnaire(payload: Dict[str, Any], weight_config: Dict[str, float] | None = None) -> ScoringResult:
    """对问卷进行打分。

    参数
    ------
    payload: dict
        问卷结构 JSON，示例结构：
        {
          "meta": {"channel": "web", "duration_seconds": 320},
          "answers": [
              {"question_id": "q1", "dimension": "completeness", "value": 1},
              {"question_id": "q2", "dimension": "consistency", "value": 0},
              ...
          ]
        }

    weight_config: dict, optional
        各维度权重，例如：{"completeness": 0.4, "consistency": 0.3, "validity": 0.3}
        若未提供，则根据维度平均分配。
    """
    answers: List[Dict[str, Any]] = _safe_get(payload, "answers", [])
    if not isinstance(answers, list) or not answers:
        raise ValueError("payload['answers'] 不能为空，并且必须是列表")

    # 按维度聚合原始得分
    dim_raw: Dict[str, float] = {}
    dim_max: Dict[str, float] = {}

    for ans in answers:
        dim = _safe_get(ans, "dimension", "other")
        value = float(_safe_get(ans, "value", 0.0))
        max_value = float(_safe_get(ans, "max_value", 1.0))
        dim_raw[dim] = dim_raw.get(dim, 0.0) + value
        dim_max[dim] = dim_max.get(dim, 0.0) + max_value

    if not dim_raw:
        raise ValueError("未找到任何可用的维度分数")

    # 归一化每个维度的得分到 0-100
    dim_scores: Dict[str, float] = {}
    for dim, raw in dim_raw.items():
        max_v = dim_max[dim] or 1.0
        dim_scores[dim] = max(0.0, min(100.0, raw / max_v * 100.0))

    # 处理权重配置
    dimensions = list(dim_scores.keys())
    if weight_config is None:
        # 平均权重
        weight_config = {d: 1.0 / len(dimensions) for d in dimensions}
    else:
        # 只保留出现的维度，并进行归一化
        filtered = {d: w for d, w in weight_config.items() if d in dimensions and w > 0}
        if not filtered:
            filtered = {d: 1.0 for d in dimensions}
        total_w = sum(filtered.values()) or 1.0
        weight_config = {d: w / total_w for d, w in filtered.items()}

    # 计算总分（加权平均）
    total_score = 0.0
    for dim, s in dim_scores.items():
        w = weight_config.get(dim, 0.0)
        total_score += s * w

    max_total_score = 100.0
    normalized_total = max(0.0, min(100.0, total_score))
    level_total = classify_level(normalized_total)

    # 生成维度级别和建议
    dimension_results: List[DimensionScore] = []
    all_suggestions: List[str] = []

    for dim in dimensions:
        score = dim_scores[dim]
        level = classify_level(score)
        suggestions = generate_dimension_suggestions(dim, score)
        dimension_results.append(
            DimensionScore(
                name=dim,
                raw_score=dim_raw[dim],
                max_score=dim_max[dim],
                normalized_score=score,
                level=level,
                suggestions=suggestions,
            )
        )
        all_suggestions.extend(suggestions)

    # 去重保持顺序
    seen = set()
    dedup_suggestions: List[str] = []
    for s in all_suggestions:
        if s not in seen:
            seen.add(s)
            dedup_suggestions.append(s)

    return ScoringResult(
        total_score=normalized_total,
        max_total_score=max_total_score,
        normalized_score=normalized_total,
        level=level_total,
        dimension_scores=dimension_results,
        suggestions=dedup_suggestions,
    )


def generate_dimension_suggestions(dimension: str, score: float) -> List[str]:
    """根据维度得分生成简单的改进建议。

    这里使用了一些通用规则，实际项目中可以根据
    《评分模型设计文档》中的维度定义与扣分项进行细化。
    """
    suggestions: List[str] = []
    if score >= 85:
        suggestions.append(f"{dimension} 维度表现优秀，建议保持现有策略。")
    elif score >= 60:
        suggestions.append(f"{dimension} 维度中等，可以针对薄弱题目优化设计。")
    else:
        suggestions.append(f"{dimension} 维度得分较低，建议重点排查问题设置与逻辑。")
    return suggestions


def score_from_json(payload: Dict[str, Any], weight_config: Dict[str, float] | None = None) -> Dict[str, Any]:
    """便于集成的包装函数，返回纯 dict。"""
    result = score_questionnaire(payload, weight_config=weight_config)
    return {
        "total_score": result.total_score,
        "level": result.level,
        "max_total_score": result.max_total_score,
        "dimensions": [
            {
                "name": d.name,
                "raw_score": d.raw_score,
                "max_score": d.max_score,
                "normalized_score": d.normalized_score,
                "level": d.level,
                "suggestions": d.suggestions,
            }
            for d in result.dimension_scores
        ],
        "suggestions": result.suggestions,
    }


if __name__ == "__main__":
    # 简单示例运行
    example_payload = {
        "answers": [
            {"question_id": "q1", "dimension": "completeness", "value": 1, "max_value": 1},
            {"question_id": "q2", "dimension": "completeness", "value": 1, "max_value": 1},
            {"question_id": "q3", "dimension": "consistency", "value": 0, "max_value": 1},
            {"question_id": "q4", "dimension": "validity", "value": 1, "max_value": 1},
        ]
    }
    from pprint import pprint

    pprint(score_from_json(example_payload))
