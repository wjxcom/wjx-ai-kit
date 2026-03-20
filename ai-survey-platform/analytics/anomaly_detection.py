"""问卷答题异常检测脚本

包含四种检测模式：
1. 答题时间过短检测
2. 连续相同选项检测
3. IP/设备指纹重复提交检测
4. 开放题答案相似度检测

使用 pandas 处理数据，并提供格式化检测报告输出。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# -----------------------------
# 数据模型与报告结构
# -----------------------------


@dataclass
class AnomalyResult:
  """单条异常记录结果。"""

  respondent_id: str
  reason: str
  score: float


@dataclass
class DetectionReport:
  """单种检测模式的汇总报告。"""

  name: str
  description: str
  anomalies: List[AnomalyResult]

  def to_dataframe(self) -> pd.DataFrame:
    if not self.anomalies:
      return pd.DataFrame(columns=["respondent_id", "reason", "score"])
    return pd.DataFrame(
      [
        {
          "respondent_id": a.respondent_id,
          "reason": a.reason,
          "score": a.score,
        }
        for a in self.anomalies
      ]
    )


# -----------------------------
# 1. 答题时间过短检测
# -----------------------------


def detect_short_response_time(
  df: pd.DataFrame,
  min_seconds_per_50_questions: float = 30.0,
  question_count_column: str = "question_count",
  duration_seconds_column: str = "duration_seconds",
  respondent_id_column: str = "respondent_id",
) -> DetectionReport:
  """检测整体作答时间明显过短的答卷。

  逻辑：
  - 计算等效 50 题的耗时：duration_seconds / (question_count / 50)
  - 若等效耗时 < min_seconds_per_50_questions，则认为可疑。
  """

  if question_count_column not in df.columns or duration_seconds_column not in df.columns:
    return DetectionReport(
      name="short_response_time",
      description="答题时间过短检测：缺少必要列，无法检测。",
      anomalies=[],
    )

  effective_time = df[duration_seconds_column] / (df[question_count_column] / 50.0)
  suspicious_mask = effective_time < min_seconds_per_50_questions

  anomalies: List[AnomalyResult] = []
  for idx, row in df[suspicious_mask].iterrows():
    respondent_id = str(row.get(respondent_id_column, idx))
    score = float(effective_time.loc[idx])
    reason = (
      f"答题时间过短：等效 50 题用时 {score:.2f} 秒，阈值 {min_seconds_per_50_questions:.2f} 秒"
    )
    anomalies.append(AnomalyResult(respondent_id=respondent_id, reason=reason, score=score))

  return DetectionReport(
    name="short_response_time",
    description="根据作答时长与题目数量检测异常快速答题。",
    anomalies=anomalies,
  )


# -----------------------------
# 2. 连续相同选项检测
# -----------------------------


def _longest_run_length(values: Iterable) -> int:
  longest = 0
  current = 0
  prev = object()
  for v in values:
    if v == prev:
      current += 1
    else:
      current = 1
      prev = v
    if current > longest:
      longest = current
  return longest


def detect_long_same_option_runs(
  df: pd.DataFrame,
  option_columns: List[str],
  min_run_length: int = 10,
  respondent_id_column: str = "respondent_id",
) -> DetectionReport:
  """检测单个被访者在客观题上连续选择同一选项次数过多的情况。"""

  missing_cols = [c for c in option_columns if c not in df.columns]
  if missing_cols:
    return DetectionReport(
      name="same_option_runs",
      description=f"连续相同选项检测：缺少列 {missing_cols}，无法检测。",
      anomalies=[],
    )

  anomalies: List[AnomalyResult] = []

  for idx, row in df.iterrows():
    seq = [row[c] for c in option_columns]
    run_len = _longest_run_length(seq)

    if run_len >= min_run_length:
      respondent_id = str(row.get(respondent_id_column, idx))
      reason = f"连续相同选项长度为 {run_len}，超过阈值 {min_run_length}"
      anomalies.append(
        AnomalyResult(
          respondent_id=respondent_id,
          reason=reason,
          score=float(run_len),
        )
      )

  return DetectionReport(
    name="same_option_runs",
    description="检测问卷作答中连续选择相同选项的异常模式。",
    anomalies=anomalies,
  )


# -----------------------------
# 3. IP / 设备指纹重复提交检测
# -----------------------------


def detect_ip_device_duplicates(
  df: pd.DataFrame,
  ip_column: str = "ip",
  device_column: str = "device_fingerprint",
  respondent_id_column: str = "respondent_id",
  min_submissions: int = 2,
) -> DetectionReport:
  """检测同一 IP 或设备指纹下的重复提交。

  逻辑：
  - 统计每个 IP / 设备的提交次数
  - 提交次数 >= min_submissions 的视为可疑
  """

  anomalies: List[AnomalyResult] = []

  def _add_group_anomalies(group_col: str) -> None:
    if group_col not in df.columns:
      return
    counts = df.groupby(group_col)[respondent_id_column].count()
    suspicious_keys = counts[counts >= min_submissions]
    for key, cnt in suspicious_keys.items():
      # 为该 key 下的所有答卷打标
      mask = df[group_col] == key
      for idx, row in df[mask].iterrows():
        respondent_id = str(row.get(respondent_id_column, idx))
        reason = f"{group_col}={key} 下共有 {cnt} 份提交，>= 阈值 {min_submissions}"
        anomalies.append(
          AnomalyResult(
            respondent_id=respondent_id,
            reason=reason,
            score=float(cnt),
          )
        )

  _add_group_anomalies(ip_column)
  _add_group_anomalies(device_column)

  return DetectionReport(
    name="ip_device_duplicates",
    description="检测相同 IP 或设备指纹下的重复提交。",
    anomalies=anomalies,
  )


# -----------------------------
# 4. 开放题答案相似度检测
# -----------------------------


def detect_open_ended_similarity(
  df: pd.DataFrame,
  text_column: str = "open_answer",
  respondent_id_column: str = "respondent_id",
  similarity_threshold: float = 0.9,
  max_pairs: int = 2000,
) -> DetectionReport:
  """基于 TF-IDF + 余弦相似度检测开放题答案高度相似的情况。

  为控制复杂度，若样本过多，可限制在前 max_pairs 条记录上检测。
  """

  if text_column not in df.columns:
    return DetectionReport(
      name="open_ended_similarity",
      description="开放题相似度检测：缺少 open_answer 列，无法检测。",
      anomalies=[],
    )

  # 只取非空文本
  subset = df.dropna(subset=[text_column]).copy()
  if subset.empty:
    return DetectionReport(
      name="open_ended_similarity",
      description="开放题相似度检测：没有有效文本答案。",
      anomalies=[],
    )

  if len(subset) > max_pairs:
    subset = subset.head(max_pairs)

  texts = subset[text_column].astype(str).tolist()
  respondent_ids = subset.get(respondent_id_column, subset.index).astype(str).tolist()

  vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2))
  tfidf_matrix = vectorizer.fit_transform(texts)

  sim_matrix = cosine_similarity(tfidf_matrix)

  n = sim_matrix.shape[0]
  anomalies: List[AnomalyResult] = []
  for i in range(n):
    for j in range(i + 1, n):
      sim = float(sim_matrix[i, j])
      if sim >= similarity_threshold:
        reason = (
          f"开放题答案与另一份答卷高度相似 (respondent {respondent_ids[j]}), 相似度 {sim:.2f}"
        )
        anomalies.append(
          AnomalyResult(
            respondent_id=respondent_ids[i],
            reason=reason,
            score=sim,
          )
        )

  return DetectionReport(
    name="open_ended_similarity",
    description="基于 TF-IDF 的开放题答案相似度检测。",
    anomalies=anomalies,
  )


# -----------------------------
# 汇总报告与示例入口
# -----------------------------


def format_reports_to_markdown(reports: List[DetectionReport]) -> str:
  """将多个检测报告格式化为 Markdown 文本，便于在控制台或日志中查看。"""

  lines: List[str] = []
  for report in reports:
    lines.append(f"## 检测模块：{report.name}")
    lines.append("")
    lines.append(report.description)
    lines.append("")
    if not report.anomalies:
      lines.append("- 未发现异常记录。")
      lines.append("")
      continue

    lines.append("| respondent_id | score | reason |")
    lines.append("| --- | ---: | --- |")
    for a in report.anomalies:
      # 对 reason 中的竖线进行转义
      reason = str(a.reason).replace("|", r"\|")
      lines.append(f"| {a.respondent_id} | {a.score:.4f} | {reason} |")
    lines.append("")

  return "\n".join(lines)


def build_mock_dataframe() -> pd.DataFrame:
  """构造用于演示和测试的 mock 数据集。"""

  data = {
    "respondent_id": ["u1", "u2", "u3", "u4"],
    "question_count": [50, 50, 50, 50],
    "duration_seconds": [20, 200, 25, 180],  # u1、u3 时间可疑
    "ip": ["1.1.1.1", "1.1.1.1", "2.2.2.2", "3.3.3.3"],
    "device_fingerprint": ["d1", "d1", "d2", "d3"],
    # 三道单选题的作答情况
    "q1": ["A", "A", "B", "C"],
    "q2": ["A", "A", "B", "C"],
    "q3": ["A", "A", "B", "C"],
    # 开放题答案
    "open_answer": [
      "我觉得这次活动非常好，非常满意",  # u1
      "这次活动非常好，我也很满意",      # u2，与 u1 相似
      "一般般，没有太大感觉",            # u3
      "不好也不坏"                        # u4
    ],
  }

  return pd.DataFrame(data)


def run_all_detections(df: pd.DataFrame) -> List[DetectionReport]:
  """对给定 DataFrame 运行四种检测并返回报告列表。"""

  reports = [
    detect_short_response_time(df),
    detect_long_same_option_runs(df, option_columns=["q1", "q2", "q3"], min_run_length=3),
    detect_ip_device_duplicates(df),
    detect_open_ended_similarity(df),
  ]
  return reports


if __name__ == "__main__":
  mock_df = build_mock_dataframe()
  all_reports = run_all_detections(mock_df)
  md = format_reports_to_markdown(all_reports)
  print(md)
