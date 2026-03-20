"""Integration tests – end-to-end pipeline and boundary conditions."""
import csv
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")

import numpy as np
import pandas as pd
import pytest

from src.analyzer import analyze_survey, compute_descriptive_stats, compute_nps
from src.chart_generator import plot_nps_pie, plot_region_bar, plot_satisfaction_hist
from src.data_loader import load_survey_data
from src.report_generator import generate_report, render_report


# ── Integration: end-to-end flow ──────────────────────────────────

class TestEndToEnd:
    """Integration tests from CSV input to Markdown report output."""

    def test_full_pipeline(self, sample_csv: Path, templates_dir: Path, tmp_path: Path):
        """End-to-end: load CSV -> analyze -> generate charts -> generate report."""
        output_dir = tmp_path / "output"
        charts_dir = output_dir / "charts"

        # Step 1: load data
        df = load_survey_data(sample_csv)
        assert len(df) == 10

        # Step 2: analyze
        analysis = analyze_survey(df)
        assert "overview" in analysis
        assert "nps" in analysis
        assert "segments" in analysis

        # Step 3: generate charts
        plot_satisfaction_hist(df, charts_dir / "satisfaction_distribution.png")
        nps_counts = {
            "promoters": int((df["nps_score"] >= 9).sum()),
            "passives": int(((df["nps_score"] >= 7) & (df["nps_score"] <= 8)).sum()),
            "detractors": int((df["nps_score"] <= 6).sum()),
        }
        plot_nps_pie(nps_counts, charts_dir / "nps_structure.png")
        plot_region_bar(df, charts_dir / "region_satisfaction.png")

        # Step 4: write analysis JSON
        analysis_json_path = output_dir / "analysis_results.json"
        # Augment analysis with chart paths and report fields for template
        analysis["charts"] = {
            "satisfaction_distribution": "charts/satisfaction_distribution.png",
            "nps_structure": "charts/nps_structure.png",
        }
        analysis["key_insights"] = ["Test insight 1"]
        analysis["recommendations"] = [
            {"title": "Test rec", "priority": "High", "based_on": "Data", "details": "Details"},
        ]
        # Provide segments in list format for the template
        analysis["segments"] = [
            {"name": "TestGroup", "sample_size": 5, "satisfaction": {"mean": 7.0}, "nps": {"score": 20}, "charts": {"satisfaction_comparison": "charts/test.png"}},
        ]

        output_dir.mkdir(parents=True, exist_ok=True)
        with analysis_json_path.open("w", encoding="utf-8") as f:
            json.dump(analysis, f, ensure_ascii=False)

        # Step 5: generate report
        report_path = output_dir / "report.md"
        generate_report(analysis_json_path, templates_dir, report_path)

        # Verify output structure
        assert output_dir.exists()
        assert charts_dir.exists()
        assert (charts_dir / "satisfaction_distribution.png").exists()
        assert (charts_dir / "nps_structure.png").exists()
        assert (charts_dir / "region_satisfaction.png").exists()
        assert report_path.exists()

        # Verify chart files are non-empty
        for chart_file in charts_dir.iterdir():
            assert chart_file.stat().st_size > 0, f"Chart file is empty: {chart_file}"

        # Verify report contains required sections
        report_content = report_path.read_text(encoding="utf-8")
        assert "执行摘要" in report_content
        assert "数据解读" in report_content
        assert "行动建议" in report_content

    def test_output_directory_structure(self, sample_csv: Path, tmp_path: Path):
        """Verify that output directories are created correctly."""
        output_dir = tmp_path / "pipeline_output"
        charts_dir = output_dir / "charts"

        df = load_survey_data(sample_csv)
        plot_satisfaction_hist(df, charts_dir / "hist.png")
        plot_region_bar(df, charts_dir / "bar.png")

        assert output_dir.exists()
        assert charts_dir.exists()
        assert len(list(charts_dir.iterdir())) == 2


# ── Boundary Conditions ──────────────────────────────────────────

class TestBoundaryConditions:
    """Edge cases and boundary condition tests."""

    def test_empty_csv_analysis(self, tmp_path: Path):
        """Empty data file: header only, no rows."""
        csv_path = tmp_path / "empty.csv"
        csv_path.write_text(
            "age_group,gender,region,satisfaction_score,nps_score,multi_choice,q_open\n"
        )
        df = load_survey_data(csv_path)
        assert len(df) == 0

    def test_nps_empty_data(self):
        """NPS with empty scores Series."""
        result = compute_nps(pd.Series([], dtype=int))
        assert result.score == 0.0
        assert result.promoters_ratio == 0.0
        assert result.detractors_ratio == 0.0

    def test_nps_all_promoters_boundary(self):
        """NPS boundary: 100% promoters."""
        scores = pd.Series([9, 9, 10, 10, 9])
        result = compute_nps(scores)
        assert result.score == pytest.approx(100.0)
        assert result.promoters_ratio == pytest.approx(1.0)
        assert result.passives_ratio == pytest.approx(0.0)
        assert result.detractors_ratio == pytest.approx(0.0)

    def test_nps_all_detractors_boundary(self):
        """NPS boundary: 100% detractors."""
        scores = pd.Series([0, 1, 2, 3, 4, 5, 6])
        result = compute_nps(scores)
        assert result.score == pytest.approx(-100.0)
        assert result.promoters_ratio == pytest.approx(0.0)
        assert result.detractors_ratio == pytest.approx(1.0)

    def test_nps_score_boundary_values(self):
        """Test exact boundary values: 6 is detractor, 7 is passive, 9 is promoter."""
        # Score 6 => detractor
        assert compute_nps(pd.Series([6])).detractors_ratio == pytest.approx(1.0)
        # Score 7 => passive
        assert compute_nps(pd.Series([7])).passives_ratio == pytest.approx(1.0)
        # Score 8 => passive
        assert compute_nps(pd.Series([8])).passives_ratio == pytest.approx(1.0)
        # Score 9 => promoter
        assert compute_nps(pd.Series([9])).promoters_ratio == pytest.approx(1.0)

    def test_descriptive_stats_all_same_values(self):
        """All identical values should have std=0."""
        s = pd.Series([5, 5, 5, 5])
        result = compute_descriptive_stats(s)
        assert result["mean"] == pytest.approx(5.0)
        assert result["median"] == pytest.approx(5.0)
        assert result["std"] == pytest.approx(0.0)

    def test_missing_fields_in_csv(self, tmp_path: Path):
        """CSV with some missing field values."""
        csv_path = tmp_path / "missing_fields.csv"
        csv_path.write_text(
            "age_group,gender,region,satisfaction_score,nps_score,multi_choice,q_open\n"
            "18-24,F,East,8,9,A;B,Good\n"
            "25-34,,North,,8,,\n"
            ",M,,7,,,Average\n"
        )
        df = load_survey_data(csv_path)
        assert len(df) == 3
        # satisfaction_score has NaN for one row
        assert df["satisfaction_score"].isna().sum() == 1

    def test_descriptive_stats_with_all_nan(self):
        """Series of all NaN values."""
        s = pd.Series([np.nan, np.nan, np.nan])
        result = compute_descriptive_stats(s)
        assert result["mean"] is None
        assert result["count"] == 0

    def test_nps_with_all_nan(self):
        """NPS with all NaN values should behave as empty."""
        scores = pd.Series([np.nan, np.nan, np.nan])
        result = compute_nps(scores)
        assert result.score == 0.0

    def test_chart_generation_single_region(self, tmp_path: Path):
        """Chart generation with only one region."""
        df = pd.DataFrame({
            "region": ["East", "East", "East"],
            "satisfaction_score": [7, 8, 9],
        })
        out = tmp_path / "single_region.png"
        plot_region_bar(df, out)
        assert out.exists()
        assert out.stat().st_size > 0

    def test_report_generation_minimal_analysis(self, templates_dir: Path, tmp_path: Path):
        """Report generation with minimal analysis data."""
        minimal = {
            "meta": {"sample_size": 0},
            "overview": {"satisfaction": {"mean": 0, "median": 0, "std": 0}},
            "nps": {"score": 0, "promoters_ratio": 0, "passives_ratio": 0, "detractors_ratio": 0},
            "segments": [],
            "charts": {"satisfaction_distribution": "", "nps_structure": ""},
            "key_insights": [],
            "recommendations": [],
        }
        json_path = tmp_path / "minimal.json"
        with json_path.open("w", encoding="utf-8") as f:
            json.dump(minimal, f)
        output = tmp_path / "report.md"
        generate_report(json_path, templates_dir, output)
        assert output.exists()
        content = output.read_text(encoding="utf-8")
        assert "执行摘要" in content

    def test_large_dataset_nps(self):
        """NPS calculation with a larger dataset."""
        np.random.seed(42)
        scores = pd.Series(np.random.randint(0, 11, size=1000))
        result = compute_nps(scores)
        # NPS should be between -100 and 100
        assert -100 <= result.score <= 100
        # Ratios should sum to ~1.0
        total = result.promoters_ratio + result.passives_ratio + result.detractors_ratio
        assert total == pytest.approx(1.0, abs=0.01)
