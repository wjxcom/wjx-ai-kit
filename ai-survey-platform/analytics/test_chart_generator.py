"""Unit tests for src/chart_generator.py"""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # non-interactive backend for CI

import pandas as pd
import pytest

from src.chart_generator import plot_nps_pie, plot_region_bar, plot_satisfaction_hist


class TestPlotSatisfactionHist:
    def test_creates_png_file(self, sample_df: pd.DataFrame, tmp_path: Path):
        out = tmp_path / "charts" / "satisfaction.png"
        plot_satisfaction_hist(sample_df, out)
        assert out.exists()
        assert out.stat().st_size > 0

    def test_creates_parent_dirs(self, sample_df: pd.DataFrame, tmp_path: Path):
        out = tmp_path / "deep" / "nested" / "chart.png"
        plot_satisfaction_hist(sample_df, out)
        assert out.exists()


class TestPlotNPSPie:
    def test_creates_png_file(self, tmp_path: Path):
        counts = {"promoters": 50, "passives": 30, "detractors": 20}
        out = tmp_path / "charts" / "nps.png"
        plot_nps_pie(counts, out)
        assert out.exists()
        assert out.stat().st_size > 0

    def test_zero_counts_raises(self, tmp_path: Path):
        """All-zero pie data triggers a ValueError in matplotlib."""
        counts = {"promoters": 0, "passives": 0, "detractors": 0}
        out = tmp_path / "nps_zero.png"
        with pytest.raises(ValueError):
            plot_nps_pie(counts, out)

    def test_missing_keys_default_zero(self, tmp_path: Path):
        counts = {"promoters": 10}  # passives and detractors missing
        out = tmp_path / "nps_partial.png"
        plot_nps_pie(counts, out)
        assert out.exists()


class TestPlotRegionBar:
    def test_creates_png_file(self, sample_df: pd.DataFrame, tmp_path: Path):
        out = tmp_path / "charts" / "region.png"
        plot_region_bar(sample_df, out)
        assert out.exists()
        assert out.stat().st_size > 0

    def test_creates_parent_dirs(self, sample_df: pd.DataFrame, tmp_path: Path):
        out = tmp_path / "a" / "b" / "region.png"
        plot_region_bar(sample_df, out)
        assert out.exists()
