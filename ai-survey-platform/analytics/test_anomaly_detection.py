import pandas as pd

from anomaly_detection import (
  build_mock_dataframe,
  detect_ip_device_duplicates,
  detect_long_same_option_runs,
  detect_open_ended_similarity,
  detect_short_response_time,
  run_all_detections,
)


def test_short_response_time_detects_fast_respondents():
  df = build_mock_dataframe()
  report = detect_short_response_time(df, min_seconds_per_50_questions=30.0)
  ids = {a.respondent_id for a in report.anomalies}
  assert "u1" in ids
  assert "u3" in ids


def test_same_option_runs_detects_long_runs():
  df = build_mock_dataframe()
  # 放宽阈值为 2，前三个题都相同则认为有长连续
  report = detect_long_same_option_runs(df, option_columns=["q1", "q2", "q3"], min_run_length=2)
  ids = {a.respondent_id for a in report.anomalies}
  assert "u1" in ids
  assert "u2" in ids


def test_ip_device_duplicates_marks_duplicate_submissions():
  df = build_mock_dataframe()
  report = detect_ip_device_duplicates(df, min_submissions=2)
  ids = {a.respondent_id for a in report.anomalies}
  # u1、u2 共用 ip 和 device，应被标记
  assert "u1" in ids
  assert "u2" in ids


def test_open_ended_similarity_detects_similar_pairs():
  df = build_mock_dataframe()
  report = detect_open_ended_similarity(df, similarity_threshold=0.5)
  ids = {a.respondent_id for a in report.anomalies}
  # u1 和 u2 的开放题答案较为相似
  assert "u1" in ids or "u2" in ids


def test_run_all_detections_returns_four_reports():
  df = build_mock_dataframe()
  reports = run_all_detections(df)
  assert len(reports) == 4
  names = {r.name for r in reports}
  assert {
    "short_response_time",
    "same_option_runs",
    "ip_device_duplicates",
    "open_ended_similarity",
  } <= names
