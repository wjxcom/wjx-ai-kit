"""问卷答题异常检测脚本 —— 单元测试

覆盖四种检测器 + 边界条件 + 报告生成，共 30+ 测试用例。
使用 pytest fixtures 管理测试数据。
"""
from __future__ import annotations

import pytest
import pandas as pd

from anomaly_detection import (
    AnomalyResult,
    DetectionReport,
    _longest_run_length,
    build_mock_dataframe,
    detect_ip_device_duplicates,
    detect_long_same_option_runs,
    detect_open_ended_similarity,
    detect_short_response_time,
    format_reports_to_markdown,
    run_all_detections,
)


# ================================================================
# Fixtures — Mock 测试数据
# ================================================================


@pytest.fixture
def normal_records() -> pd.DataFrame:
    """生成模拟正常答题记录（合理时长、多样化选项、不同 IP）"""
    return pd.DataFrame(
        {
            "respondent_id": ["n1", "n2", "n3", "n4", "n5"],
            "question_count": [50, 50, 50, 50, 50],
            "duration_seconds": [300, 450, 600, 200, 350],
            "ip": ["10.0.0.1", "10.0.0.2", "10.0.0.3", "10.0.0.4", "10.0.0.5"],
            "device_fingerprint": ["fp1", "fp2", "fp3", "fp4", "fp5"],
            "q1": ["A", "B", "C", "D", "A"],
            "q2": ["B", "C", "A", "B", "D"],
            "q3": ["C", "A", "D", "A", "B"],
            "q4": ["D", "D", "B", "C", "C"],
            "q5": ["A", "B", "A", "D", "A"],
            "open_answer": [
                "产品质量很好，推荐购买",
                "价格偏高，但服务态度不错",
                "包装精美，物流很快",
                "一般般，没有特别的感觉",
                "性价比高，下次还会购买",
            ],
        }
    )


@pytest.fixture
def time_anomaly_records() -> pd.DataFrame:
    """极短答题时间（5秒完成50题）"""
    return pd.DataFrame(
        {
            "respondent_id": ["fast1", "fast2", "normal1"],
            "question_count": [50, 50, 50],
            "duration_seconds": [5, 10, 300],
            "ip": ["1.1.1.1", "2.2.2.2", "3.3.3.3"],
            "device_fingerprint": ["d1", "d2", "d3"],
            "q1": ["A", "B", "C"],
            "q2": ["B", "A", "D"],
            "q3": ["C", "D", "A"],
            "open_answer": ["ok", "good", "非常好的问卷"],
        }
    )


@pytest.fixture
def same_option_records() -> pd.DataFrame:
    """全选同一选项的记录"""
    return pd.DataFrame(
        {
            "respondent_id": ["same1", "same2", "varied1"],
            "question_count": [10, 10, 10],
            "duration_seconds": [120, 150, 200],
            "ip": ["1.1.1.1", "2.2.2.2", "3.3.3.3"],
            "device_fingerprint": ["d1", "d2", "d3"],
            "q1": ["A", "B", "A"],
            "q2": ["A", "B", "B"],
            "q3": ["A", "B", "C"],
            "q4": ["A", "B", "D"],
            "q5": ["A", "B", "A"],
            "q6": ["A", "B", "B"],
            "q7": ["A", "B", "C"],
            "q8": ["A", "B", "D"],
            "q9": ["A", "B", "A"],
            "q10": ["A", "B", "C"],
            "open_answer": ["test", "test2", "多样化答案"],
        }
    )


@pytest.fixture
def duplicate_ip_records() -> pd.DataFrame:
    """相同 IP 多次提交的记录"""
    return pd.DataFrame(
        {
            "respondent_id": ["dup1", "dup2", "dup3", "dup4", "unique1"],
            "question_count": [50, 50, 50, 50, 50],
            "duration_seconds": [200, 210, 220, 230, 300],
            "ip": ["192.168.1.1", "192.168.1.1", "192.168.1.1", "192.168.1.1", "10.0.0.1"],
            "device_fingerprint": ["fp_a", "fp_a", "fp_a", "fp_b", "fp_c"],
            "q1": ["A", "B", "C", "D", "A"],
            "q2": ["B", "A", "D", "C", "B"],
            "q3": ["C", "D", "A", "B", "C"],
            "open_answer": ["答案1", "答案2", "答案3", "答案4", "独立答案"],
        }
    )


@pytest.fixture
def similar_answers_records() -> pd.DataFrame:
    """开放题高相似度答案的记录"""
    return pd.DataFrame(
        {
            "respondent_id": ["sim1", "sim2", "sim3", "diff1"],
            "question_count": [50, 50, 50, 50],
            "duration_seconds": [300, 310, 320, 400],
            "ip": ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"],
            "device_fingerprint": ["d1", "d2", "d3", "d4"],
            "q1": ["A", "B", "C", "D"],
            "q2": ["B", "A", "D", "C"],
            "q3": ["C", "D", "A", "B"],
            "open_answer": [
                "这个产品非常好用，我觉得质量很高，推荐大家购买",
                "这个产品非常好用，我觉得质量很高，推荐大家购买",  # 完全相同
                "这个产品非常好用，质量高，推荐购买",  # 高度相似
                "天气不错今天出去玩了很开心和朋友一起吃了火锅",  # 完全不同
            ],
        }
    )


@pytest.fixture
def mixed_records() -> pd.DataFrame:
    """混合数据集（正常 + 多种异常混合）"""
    return pd.DataFrame(
        {
            "respondent_id": [
                "mix_normal1", "mix_normal2",
                "mix_fast1",
                "mix_same1",
                "mix_dup1", "mix_dup2",
                "mix_sim1", "mix_sim2",
            ],
            "question_count": [50, 50, 50, 10, 50, 50, 50, 50],
            "duration_seconds": [300, 400, 5, 120, 200, 210, 300, 310],
            "ip": [
                "10.0.0.1", "10.0.0.2",
                "10.0.0.3",
                "10.0.0.4",
                "192.168.0.1", "192.168.0.1",
                "10.0.0.5", "10.0.0.6",
            ],
            "device_fingerprint": [
                "fp1", "fp2", "fp3", "fp4", "fp5", "fp5", "fp6", "fp7"
            ],
            "q1": ["A", "B", "C", "A", "D", "A", "B", "C"],
            "q2": ["B", "C", "A", "A", "C", "B", "A", "D"],
            "q3": ["C", "A", "D", "A", "B", "C", "D", "A"],
            "open_answer": [
                "正常的答案一",
                "正常的答案二",
                "随便写写",
                "测试答案",
                "重复提交的答案",
                "另一个重复提交",
                "这个服务非常好我很满意推荐给大家使用",
                "这个服务非常好我很满意推荐给大家使用",  # 完全相同
            ],
        }
    )


@pytest.fixture
def empty_df() -> pd.DataFrame:
    """空数据集"""
    return pd.DataFrame(
        columns=[
            "respondent_id", "question_count", "duration_seconds",
            "ip", "device_fingerprint",
            "q1", "q2", "q3",
            "open_answer",
        ]
    )


@pytest.fixture
def single_record_df() -> pd.DataFrame:
    """只有一条记录"""
    return pd.DataFrame(
        {
            "respondent_id": ["only1"],
            "question_count": [50],
            "duration_seconds": [300],
            "ip": ["10.0.0.1"],
            "device_fingerprint": ["fp1"],
            "q1": ["A"],
            "q2": ["B"],
            "q3": ["C"],
            "open_answer": ["唯一的一条记录"],
        }
    )


OPTION_COLS = ["q1", "q2", "q3"]
OPTION_COLS_10 = [f"q{i}" for i in range(1, 11)]


# ================================================================
# 1. 答题时间过短检测 (test_time_anomaly_detection)
# ================================================================


class TestTimeAnomalyDetection:
    """验证短时间答题被正确检出"""

    def test_detects_extremely_fast_respondents(self, time_anomaly_records):
        report = detect_short_response_time(time_anomaly_records)
        ids = {a.respondent_id for a in report.anomalies}
        assert "fast1" in ids, "5秒完成50题应被检出"
        assert "fast2" in ids, "10秒完成50题应被检出"

    def test_does_not_flag_normal_respondents(self, time_anomaly_records):
        report = detect_short_response_time(time_anomaly_records)
        ids = {a.respondent_id for a in report.anomalies}
        assert "normal1" not in ids, "300秒完成50题不应被标记"

    def test_all_normal_records_no_anomalies(self, normal_records):
        report = detect_short_response_time(normal_records)
        assert len(report.anomalies) == 0, "全部正常记录不应有异常"

    def test_report_name(self, time_anomaly_records):
        report = detect_short_response_time(time_anomaly_records)
        assert report.name == "short_response_time"

    def test_score_is_effective_time(self, time_anomaly_records):
        """score 应为等效 50 题的耗时"""
        report = detect_short_response_time(time_anomaly_records)
        for a in report.anomalies:
            assert a.score >= 0, "score（等效时间）应 >= 0"
            assert a.score < 30, "被检出的 score 应小于阈值 30"

    def test_custom_threshold(self, normal_records):
        """使用非常高的阈值，所有人都应被标记"""
        report = detect_short_response_time(
            normal_records, min_seconds_per_50_questions=9999
        )
        assert len(report.anomalies) == len(normal_records)

    def test_missing_columns_returns_empty(self):
        """缺少必要列时返回空报告"""
        df = pd.DataFrame({"respondent_id": ["u1"], "irrelevant": [1]})
        report = detect_short_response_time(df)
        assert len(report.anomalies) == 0

    def test_empty_input(self, empty_df):
        report = detect_short_response_time(empty_df)
        assert len(report.anomalies) == 0

    def test_single_record_normal(self, single_record_df):
        report = detect_short_response_time(single_record_df)
        assert len(report.anomalies) == 0

    def test_single_record_anomalous(self):
        df = pd.DataFrame(
            {
                "respondent_id": ["fast_only"],
                "question_count": [50],
                "duration_seconds": [3],
            }
        )
        report = detect_short_response_time(df)
        assert len(report.anomalies) == 1
        assert report.anomalies[0].respondent_id == "fast_only"


# ================================================================
# 2. 连续相同选项检测 (test_same_option_detection)
# ================================================================


class TestSameOptionDetection:
    """验证连续相同选项被检出"""

    def test_detects_all_same_options(self, same_option_records):
        report = detect_long_same_option_runs(
            same_option_records,
            option_columns=OPTION_COLS_10,
            min_run_length=5,
        )
        ids = {a.respondent_id for a in report.anomalies}
        assert "same1" in ids, "全选 A 的 same1 应被检出"
        assert "same2" in ids, "全选 B 的 same2 应被检出"

    def test_does_not_flag_varied_options(self, same_option_records):
        report = detect_long_same_option_runs(
            same_option_records,
            option_columns=OPTION_COLS_10,
            min_run_length=5,
        )
        ids = {a.respondent_id for a in report.anomalies}
        assert "varied1" not in ids, "多样化选项不应被标记"

    def test_all_normal_no_anomalies(self, normal_records):
        report = detect_long_same_option_runs(
            normal_records, option_columns=OPTION_COLS, min_run_length=3
        )
        # Normal records have varied options in 3 questions, max run = 1
        assert len(report.anomalies) == 0

    def test_score_equals_run_length(self, same_option_records):
        report = detect_long_same_option_runs(
            same_option_records,
            option_columns=OPTION_COLS_10,
            min_run_length=5,
        )
        for a in report.anomalies:
            assert a.score >= 5, "score 应等于连续长度且 >= 阈值"

    def test_missing_columns_returns_empty(self):
        df = pd.DataFrame({"respondent_id": ["u1"]})
        report = detect_long_same_option_runs(
            df, option_columns=["nonexistent1", "nonexistent2"]
        )
        assert len(report.anomalies) == 0

    def test_empty_input(self, empty_df):
        report = detect_long_same_option_runs(
            empty_df, option_columns=OPTION_COLS
        )
        assert len(report.anomalies) == 0

    def test_single_record(self, single_record_df):
        report = detect_long_same_option_runs(
            single_record_df, option_columns=OPTION_COLS, min_run_length=2
        )
        assert len(report.anomalies) == 0

    def test_all_anomalous(self):
        """全部记录连续相同选项超标"""
        df = pd.DataFrame(
            {
                "respondent_id": ["a1", "a2"],
                "q1": ["A", "B"],
                "q2": ["A", "B"],
                "q3": ["A", "B"],
                "q4": ["A", "B"],
                "q5": ["A", "B"],
            }
        )
        report = detect_long_same_option_runs(
            df,
            option_columns=["q1", "q2", "q3", "q4", "q5"],
            min_run_length=5,
        )
        assert len(report.anomalies) == 2


class TestLongestRunLength:
    """测试 _longest_run_length 内部函数"""

    def test_empty(self):
        assert _longest_run_length([]) == 0

    def test_single_element(self):
        assert _longest_run_length(["A"]) == 1

    def test_all_same(self):
        assert _longest_run_length(["A", "A", "A", "A"]) == 4

    def test_all_different(self):
        assert _longest_run_length(["A", "B", "C", "D"]) == 1

    def test_mixed(self):
        assert _longest_run_length(["A", "A", "B", "B", "B", "C"]) == 3

    def test_run_at_end(self):
        assert _longest_run_length(["A", "B", "C", "C", "C"]) == 3


# ================================================================
# 3. IP/设备指纹重复提交检测 (test_duplicate_submission_detection)
# ================================================================


class TestDuplicateSubmissionDetection:
    """验证重复提交被检出"""

    def test_detects_ip_duplicates(self, duplicate_ip_records):
        report = detect_ip_device_duplicates(
            duplicate_ip_records, min_submissions=2
        )
        ids = {a.respondent_id for a in report.anomalies}
        # 4 submissions from same IP
        assert "dup1" in ids
        assert "dup2" in ids
        assert "dup3" in ids
        assert "dup4" in ids

    def test_does_not_flag_unique_ip(self, duplicate_ip_records):
        report = detect_ip_device_duplicates(
            duplicate_ip_records, min_submissions=5
        )
        # With min_submissions=5, only the 4 from same IP won't trigger
        ids = {a.respondent_id for a in report.anomalies}
        assert "unique1" not in ids

    def test_all_unique_no_anomalies(self, normal_records):
        report = detect_ip_device_duplicates(normal_records, min_submissions=2)
        assert len(report.anomalies) == 0

    def test_device_fingerprint_duplicates(self):
        """同设备指纹不同IP也应检出"""
        df = pd.DataFrame(
            {
                "respondent_id": ["u1", "u2", "u3"],
                "ip": ["1.1.1.1", "2.2.2.2", "3.3.3.3"],
                "device_fingerprint": ["same_fp", "same_fp", "different_fp"],
            }
        )
        report = detect_ip_device_duplicates(df, min_submissions=2)
        ids = {a.respondent_id for a in report.anomalies}
        assert "u1" in ids
        assert "u2" in ids

    def test_score_equals_submission_count(self, duplicate_ip_records):
        report = detect_ip_device_duplicates(
            duplicate_ip_records, min_submissions=2
        )
        for a in report.anomalies:
            assert a.score >= 2, "score 应等于提交次数且 >= 阈值"

    def test_empty_input(self, empty_df):
        report = detect_ip_device_duplicates(empty_df)
        assert len(report.anomalies) == 0

    def test_single_record(self, single_record_df):
        report = detect_ip_device_duplicates(single_record_df, min_submissions=2)
        assert len(report.anomalies) == 0

    def test_missing_ip_column(self):
        """缺少 ip 列但有 device_fingerprint 列时仍正常工作"""
        df = pd.DataFrame(
            {
                "respondent_id": ["u1", "u2"],
                "device_fingerprint": ["fp1", "fp1"],
            }
        )
        report = detect_ip_device_duplicates(df, min_submissions=2)
        ids = {a.respondent_id for a in report.anomalies}
        assert "u1" in ids
        assert "u2" in ids

    def test_all_duplicates(self):
        """全部记录来自同一 IP"""
        df = pd.DataFrame(
            {
                "respondent_id": ["u1", "u2", "u3"],
                "ip": ["same_ip", "same_ip", "same_ip"],
                "device_fingerprint": ["d1", "d2", "d3"],
            }
        )
        report = detect_ip_device_duplicates(df, min_submissions=2)
        ids = {a.respondent_id for a in report.anomalies}
        assert len(ids) == 3


# ================================================================
# 4. 开放题答案相似度检测 (test_similarity_detection)
# ================================================================


class TestSimilarityDetection:
    """验证高相似度答案被检出"""

    def test_detects_identical_answers(self, similar_answers_records):
        report = detect_open_ended_similarity(
            similar_answers_records, similarity_threshold=0.9
        )
        ids = {a.respondent_id for a in report.anomalies}
        # sim1 and sim2 have identical answers
        assert "sim1" in ids or "sim2" in ids, "完全相同答案应被检出"

    def test_does_not_flag_different_answers(self, similar_answers_records):
        report = detect_open_ended_similarity(
            similar_answers_records, similarity_threshold=0.95
        )
        # diff1 has completely different content
        ids = {a.respondent_id for a in report.anomalies}
        assert "diff1" not in ids, "完全不同的答案不应被标记"

    def test_all_unique_no_anomalies(self, normal_records):
        report = detect_open_ended_similarity(
            normal_records, similarity_threshold=0.95
        )
        assert len(report.anomalies) == 0

    def test_score_is_similarity_value(self, similar_answers_records):
        report = detect_open_ended_similarity(
            similar_answers_records, similarity_threshold=0.5
        )
        for a in report.anomalies:
            assert 0.0 <= a.score <= 1.0, f"置信度/相似度应在 [0, 1] 范围内，实际 {a.score}"

    def test_missing_text_column_returns_empty(self):
        df = pd.DataFrame({"respondent_id": ["u1", "u2"]})
        report = detect_open_ended_similarity(df)
        assert len(report.anomalies) == 0

    def test_empty_input(self, empty_df):
        report = detect_open_ended_similarity(empty_df)
        assert len(report.anomalies) == 0

    def test_single_record(self, single_record_df):
        report = detect_open_ended_similarity(
            single_record_df, similarity_threshold=0.5
        )
        assert len(report.anomalies) == 0

    def test_all_null_text(self):
        """全部开放题答案为空"""
        df = pd.DataFrame(
            {
                "respondent_id": ["u1", "u2"],
                "open_answer": [None, None],
            }
        )
        report = detect_open_ended_similarity(df)
        assert len(report.anomalies) == 0

    def test_all_identical_answers(self):
        """全部答案完全相同"""
        same_text = "这个产品非常好用推荐购买"
        df = pd.DataFrame(
            {
                "respondent_id": ["u1", "u2", "u3"],
                "open_answer": [same_text, same_text, same_text],
            }
        )
        report = detect_open_ended_similarity(df, similarity_threshold=0.9)
        assert len(report.anomalies) > 0, "全部相同答案至少应检出一对"

    def test_custom_threshold(self, similar_answers_records):
        """极低阈值应检出更多"""
        report_low = detect_open_ended_similarity(
            similar_answers_records, similarity_threshold=0.1
        )
        report_high = detect_open_ended_similarity(
            similar_answers_records, similarity_threshold=0.99
        )
        assert len(report_low.anomalies) >= len(report_high.anomalies)


# ================================================================
# 边界条件测试
# ================================================================


class TestBoundaryConditions:
    """边界条件：空数据、单条记录、全部正常、全部异常"""

    def test_empty_df_all_detectors(self, empty_df):
        reports = [
            detect_short_response_time(empty_df),
            detect_long_same_option_runs(empty_df, option_columns=OPTION_COLS),
            detect_ip_device_duplicates(empty_df),
            detect_open_ended_similarity(empty_df),
        ]
        for r in reports:
            assert len(r.anomalies) == 0, f"空数据 {r.name} 不应有异常"

    def test_single_record_all_detectors(self, single_record_df):
        reports = [
            detect_short_response_time(single_record_df),
            detect_long_same_option_runs(
                single_record_df, option_columns=OPTION_COLS
            ),
            detect_ip_device_duplicates(single_record_df, min_submissions=2),
            detect_open_ended_similarity(single_record_df),
        ]
        for r in reports:
            assert len(r.anomalies) == 0, f"单条正常记录 {r.name} 不应有异常"

    def test_all_normal_records(self, normal_records):
        """全部正常的数据集"""
        reports = [
            detect_short_response_time(normal_records),
            detect_long_same_option_runs(
                normal_records, option_columns=OPTION_COLS, min_run_length=3
            ),
            detect_ip_device_duplicates(normal_records, min_submissions=2),
            detect_open_ended_similarity(
                normal_records, similarity_threshold=0.95
            ),
        ]
        total_anomalies = sum(len(r.anomalies) for r in reports)
        assert total_anomalies == 0, "全部正常的数据不应有任何异常"

    def test_all_anomalous_time(self):
        """全部记录答题时间异常"""
        df = pd.DataFrame(
            {
                "respondent_id": ["f1", "f2", "f3"],
                "question_count": [50, 50, 50],
                "duration_seconds": [2, 3, 5],
            }
        )
        report = detect_short_response_time(df)
        assert len(report.anomalies) == 3

    def test_all_anomalous_same_option(self):
        """全部记录全选同一选项"""
        df = pd.DataFrame(
            {
                "respondent_id": ["s1", "s2"],
                "q1": ["A", "B"],
                "q2": ["A", "B"],
                "q3": ["A", "B"],
            }
        )
        report = detect_long_same_option_runs(
            df, option_columns=["q1", "q2", "q3"], min_run_length=3
        )
        assert len(report.anomalies) == 2

    def test_mixed_data_detects_correct_anomalies(self, mixed_records):
        """混合数据集中应正确识别各类异常"""
        time_report = detect_short_response_time(mixed_records)
        time_ids = {a.respondent_id for a in time_report.anomalies}
        assert "mix_fast1" in time_ids, "快速答题者应被检出"
        assert "mix_normal1" not in time_ids

        dup_report = detect_ip_device_duplicates(mixed_records, min_submissions=2)
        dup_ids = {a.respondent_id for a in dup_report.anomalies}
        assert "mix_dup1" in dup_ids or "mix_dup2" in dup_ids


# ================================================================
# 报告生成测试
# ================================================================


class TestReportGeneration:
    """验证报告格式正确、统计数据准确"""

    def test_report_format_contains_headers(self, time_anomaly_records):
        report = detect_short_response_time(time_anomaly_records)
        md = format_reports_to_markdown([report])
        assert "## 检测模块" in md, "报告应包含标题"
        assert "short_response_time" in md

    def test_report_contains_table(self, time_anomaly_records):
        report = detect_short_response_time(time_anomaly_records)
        md = format_reports_to_markdown([report])
        assert "respondent_id" in md
        assert "score" in md
        assert "reason" in md

    def test_report_with_no_anomalies(self, normal_records):
        report = detect_short_response_time(normal_records)
        md = format_reports_to_markdown([report])
        assert "未发现异常记录" in md

    def test_multiple_reports_format(self, mixed_records):
        reports = run_all_detections(mixed_records)
        md = format_reports_to_markdown(reports)
        assert md.count("## 检测模块") == 4, "应包含 4 个检测模块"

    def test_run_all_detections_returns_four(self):
        df = build_mock_dataframe()
        reports = run_all_detections(df)
        assert len(reports) == 4
        names = {r.name for r in reports}
        expected = {
            "short_response_time",
            "same_option_runs",
            "ip_device_duplicates",
            "open_ended_similarity",
        }
        assert names == expected

    def test_detection_report_to_dataframe(self):
        anomalies = [
            AnomalyResult(respondent_id="u1", reason="test reason", score=0.95),
            AnomalyResult(respondent_id="u2", reason="another reason", score=0.80),
        ]
        report = DetectionReport(
            name="test_report",
            description="Test description",
            anomalies=anomalies,
        )
        df = report.to_dataframe()
        assert len(df) == 2
        assert list(df.columns) == ["respondent_id", "reason", "score"]
        assert df.iloc[0]["respondent_id"] == "u1"
        assert df.iloc[1]["score"] == 0.80

    def test_empty_report_to_dataframe(self):
        report = DetectionReport(
            name="empty", description="Empty", anomalies=[]
        )
        df = report.to_dataframe()
        assert len(df) == 0
        assert list(df.columns) == ["respondent_id", "reason", "score"]

    def test_anomaly_type_labels_correct(self, time_anomaly_records):
        """验证异常类型标记正确"""
        report = detect_short_response_time(time_anomaly_records)
        assert report.name == "short_response_time"
        for a in report.anomalies:
            assert "答题时间过短" in a.reason

    def test_build_mock_dataframe(self):
        df = build_mock_dataframe()
        assert len(df) == 4
        assert "respondent_id" in df.columns
        assert "question_count" in df.columns
        assert "duration_seconds" in df.columns
        assert "ip" in df.columns
        assert "open_answer" in df.columns


# ================================================================
# 置信度/Score 范围验证
# ================================================================


class TestScoreRanges:
    """验证各检测器的 score 值符合预期"""

    def test_time_score_is_non_negative(self, time_anomaly_records):
        report = detect_short_response_time(time_anomaly_records)
        for a in report.anomalies:
            assert a.score >= 0

    def test_similarity_score_in_01(self, similar_answers_records):
        report = detect_open_ended_similarity(
            similar_answers_records, similarity_threshold=0.1
        )
        for a in report.anomalies:
            assert 0.0 <= a.score <= 1.0, f"相似度应在 [0,1]，实际 {a.score}"

    def test_run_length_score_positive(self, same_option_records):
        report = detect_long_same_option_runs(
            same_option_records,
            option_columns=OPTION_COLS_10,
            min_run_length=2,
        )
        for a in report.anomalies:
            assert a.score > 0

    def test_duplicate_score_positive(self, duplicate_ip_records):
        report = detect_ip_device_duplicates(
            duplicate_ip_records, min_submissions=2
        )
        for a in report.anomalies:
            assert a.score >= 2
