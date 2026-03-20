"""Unit tests for src/data_loader.py"""
from pathlib import Path

import pandas as pd
import pytest

from src.data_loader import load_survey_data


class TestLoadSurveyData:
    """Tests for load_survey_data()."""

    def test_loads_csv_returns_dataframe(self, sample_csv: Path):
        df = load_survey_data(sample_csv)
        assert isinstance(df, pd.DataFrame)

    def test_has_expected_columns(self, sample_csv: Path):
        df = load_survey_data(sample_csv)
        expected = {
            "age_group", "gender", "region",
            "satisfaction_score", "nps_score",
            "multi_choice", "q_open",
        }
        assert set(df.columns) == expected

    def test_row_count(self, sample_csv: Path):
        df = load_survey_data(sample_csv)
        assert len(df) == 10

    def test_file_not_found_raises(self, tmp_path: Path):
        missing = tmp_path / "nonexistent.csv"
        with pytest.raises(FileNotFoundError):
            load_survey_data(missing)

    def test_empty_csv_returns_empty_dataframe(self, tmp_path: Path):
        """CSV with only a header line => empty DataFrame."""
        csv_path = tmp_path / "empty.csv"
        csv_path.write_text("age_group,gender,region,satisfaction_score,nps_score,multi_choice,q_open\n")
        df = load_survey_data(csv_path)
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 0

    def test_numeric_columns_are_numeric(self, sample_csv: Path):
        df = load_survey_data(sample_csv)
        assert pd.api.types.is_numeric_dtype(df["satisfaction_score"])
        assert pd.api.types.is_numeric_dtype(df["nps_score"])
