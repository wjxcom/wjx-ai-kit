"""Unit tests for src/analyzer.py"""
import math

import numpy as np
import pandas as pd
import pytest

from src.analyzer import (
    NPSResult,
    analyze_survey,
    compute_descriptive_stats,
    compute_nps,
    cross_tab_mean,
)


# ── compute_descriptive_stats ─────────────────────────────────────

class TestComputeDescriptiveStats:
    def test_basic_stats(self):
        s = pd.Series([2, 4, 6, 8, 10])
        result = compute_descriptive_stats(s)
        assert result["mean"] == pytest.approx(6.0)
        assert result["median"] == pytest.approx(6.0)
        assert result["count"] == 5
        assert result["std"] is not None

    def test_single_value(self):
        s = pd.Series([5])
        result = compute_descriptive_stats(s)
        assert result["mean"] == pytest.approx(5.0)
        assert result["median"] == pytest.approx(5.0)
        assert result["count"] == 1
        # std with ddof=1 is undefined for a single value
        assert result["std"] is None

    def test_empty_series(self):
        s = pd.Series([], dtype=float)
        result = compute_descriptive_stats(s)
        assert result["mean"] is None
        assert result["median"] is None
        assert result["std"] is None
        assert result["count"] == 0

    def test_with_nan_values(self):
        s = pd.Series([1, np.nan, 3, np.nan, 5])
        result = compute_descriptive_stats(s)
        assert result["count"] == 3
        assert result["mean"] == pytest.approx(3.0)

    def test_returns_float_types(self):
        s = pd.Series([1, 2, 3])
        result = compute_descriptive_stats(s)
        assert isinstance(result["mean"], float)
        assert isinstance(result["median"], float)
        assert isinstance(result["std"], float)
        assert isinstance(result["count"], int)


# ── compute_nps ───────────────────────────────────────────────────

class TestComputeNPS:
    def test_mixed_scores(self):
        # 9,10 = promoters (2), 7,8 = passives (2), 0-6 = detractors (1)
        scores = pd.Series([10, 9, 8, 7, 5])
        result = compute_nps(scores)
        assert isinstance(result, NPSResult)
        # promoters=2/5=0.4, detractors=1/5=0.2 => NPS=(0.4-0.2)*100=20
        assert result.score == pytest.approx(20.0)
        assert result.promoters_ratio == pytest.approx(0.4)
        assert result.passives_ratio == pytest.approx(0.4)
        assert result.detractors_ratio == pytest.approx(0.2)

    def test_all_promoters(self):
        scores = pd.Series([9, 10, 9, 10, 10])
        result = compute_nps(scores)
        assert result.score == pytest.approx(100.0)
        assert result.promoters_ratio == pytest.approx(1.0)
        assert result.detractors_ratio == pytest.approx(0.0)

    def test_all_detractors(self):
        scores = pd.Series([0, 1, 2, 3, 4, 5, 6])
        result = compute_nps(scores)
        assert result.score == pytest.approx(-100.0)
        assert result.detractors_ratio == pytest.approx(1.0)
        assert result.promoters_ratio == pytest.approx(0.0)

    def test_all_passives(self):
        scores = pd.Series([7, 7, 8, 8])
        result = compute_nps(scores)
        assert result.score == pytest.approx(0.0)
        assert result.passives_ratio == pytest.approx(1.0)
        assert result.promoters_ratio == pytest.approx(0.0)
        assert result.detractors_ratio == pytest.approx(0.0)

    def test_empty_scores(self):
        scores = pd.Series([], dtype=int)
        result = compute_nps(scores)
        assert result.score == 0.0
        assert result.promoters_ratio == 0.0
        assert result.passives_ratio == 0.0
        assert result.detractors_ratio == 0.0

    def test_with_nan_values(self):
        scores = pd.Series([10, np.nan, 5, np.nan])
        result = compute_nps(scores)
        # Only 10 and 5 are counted => promoters=1/2, detractors=1/2
        assert result.score == pytest.approx(0.0)

    def test_single_promoter(self):
        scores = pd.Series([10])
        result = compute_nps(scores)
        assert result.score == pytest.approx(100.0)

    def test_single_detractor(self):
        scores = pd.Series([3])
        result = compute_nps(scores)
        assert result.score == pytest.approx(-100.0)


# ── cross_tab_mean ────────────────────────────────────────────────

class TestCrossTabMean:
    def test_basic_cross_tab(self, sample_df: pd.DataFrame):
        result = cross_tab_mean(sample_df, "gender", "satisfaction_score")
        assert "F" in result
        assert "M" in result
        assert "mean" in result["F"]
        assert "count" in result["F"]
        assert isinstance(result["F"]["mean"], float)
        assert isinstance(result["F"]["count"], int)

    def test_region_cross_tab(self, sample_df: pd.DataFrame):
        result = cross_tab_mean(sample_df, "region", "satisfaction_score")
        regions = set(result.keys())
        assert regions == {"East", "North", "South", "West"}

    def test_single_group(self):
        df = pd.DataFrame({
            "group": ["A", "A", "A"],
            "value": [1, 2, 3],
        })
        result = cross_tab_mean(df, "group", "value")
        assert len(result) == 1
        assert result["A"]["mean"] == pytest.approx(2.0)
        assert result["A"]["count"] == 3


# ── analyze_survey ────────────────────────────────────────────────

class TestAnalyzeSurvey:
    def test_returns_expected_keys(self, sample_df: pd.DataFrame):
        result = analyze_survey(sample_df)
        assert "overview" in result
        assert "nps" in result
        assert "segments" in result
        assert "meta" in result

    def test_overview_has_satisfaction(self, sample_df: pd.DataFrame):
        result = analyze_survey(sample_df)
        sat = result["overview"]["satisfaction"]
        assert "mean" in sat
        assert "median" in sat
        assert "std" in sat
        assert "count" in sat

    def test_nps_structure(self, sample_df: pd.DataFrame):
        result = analyze_survey(sample_df)
        nps = result["nps"]
        assert "score" in nps
        assert "promoters_ratio" in nps
        assert "passives_ratio" in nps
        assert "detractors_ratio" in nps

    def test_segments_includes_age_gender_region(self, sample_df: pd.DataFrame):
        result = analyze_survey(sample_df)
        segs = result["segments"]
        assert "age_group" in segs
        assert "gender" in segs
        assert "region" in segs

    def test_meta_sample_size(self, sample_df: pd.DataFrame):
        result = analyze_survey(sample_df)
        assert result["meta"]["sample_size"] == 10

    def test_meta_columns(self, sample_df: pd.DataFrame):
        result = analyze_survey(sample_df)
        assert "satisfaction_score" in result["meta"]["columns"]
        assert "nps_score" in result["meta"]["columns"]
