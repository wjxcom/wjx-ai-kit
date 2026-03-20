import csv
import json
from pathlib import Path

import pandas as pd
import pytest


@pytest.fixture
def sample_csv(tmp_path: Path) -> Path:
    """Create a sample CSV with survey data for testing."""
    rows = [
        {"age_group": "18-24", "gender": "F", "region": "East", "satisfaction_score": "8", "nps_score": "9", "multi_choice": "A;B", "q_open": "Good"},
        {"age_group": "25-34", "gender": "M", "region": "North", "satisfaction_score": "7", "nps_score": "8", "multi_choice": "B;C", "q_open": "OK"},
        {"age_group": "35-44", "gender": "F", "region": "South", "satisfaction_score": "9", "nps_score": "10", "multi_choice": "A;C", "q_open": "Great"},
        {"age_group": "18-24", "gender": "M", "region": "West", "satisfaction_score": "5", "nps_score": "4", "multi_choice": "A", "q_open": "Bad"},
        {"age_group": "25-34", "gender": "F", "region": "East", "satisfaction_score": "6", "nps_score": "5", "multi_choice": "C", "q_open": "Average"},
        {"age_group": "35-44", "gender": "M", "region": "North", "satisfaction_score": "10", "nps_score": "10", "multi_choice": "A;B;C", "q_open": "Excellent"},
        {"age_group": "45+", "gender": "F", "region": "South", "satisfaction_score": "4", "nps_score": "3", "multi_choice": "B", "q_open": "Poor"},
        {"age_group": "45+", "gender": "M", "region": "West", "satisfaction_score": "7", "nps_score": "7", "multi_choice": "A;B", "q_open": "Fine"},
        {"age_group": "18-24", "gender": "F", "region": "East", "satisfaction_score": "8", "nps_score": "9", "multi_choice": "A", "q_open": "Nice"},
        {"age_group": "25-34", "gender": "M", "region": "North", "satisfaction_score": "6", "nps_score": "6", "multi_choice": "B;C", "q_open": "Okay"},
    ]
    csv_path = tmp_path / "survey.csv"
    fieldnames = list(rows[0].keys())
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return csv_path


@pytest.fixture
def sample_df(sample_csv: Path) -> pd.DataFrame:
    """Load the sample CSV as a DataFrame."""
    return pd.read_csv(sample_csv)


@pytest.fixture
def sample_analysis() -> dict:
    """Provide a sample analysis_results dict for report rendering."""
    return {
        "meta": {"sample_size": 10, "survey_period": "2026-03"},
        "overview": {"satisfaction": {"mean": 7.0, "median": 7.0, "std": 1.8}},
        "nps": {
            "score": 10.0,
            "promoters_ratio": 0.4,
            "passives_ratio": 0.2,
            "detractors_ratio": 0.3,
        },
        "segments": [
            {
                "name": "Group A",
                "sample_size": 5,
                "satisfaction": {"mean": 7.5},
                "nps": {"score": 20},
                "charts": {"satisfaction_comparison": "charts/a.png"},
            },
        ],
        "charts": {
            "satisfaction_distribution": "charts/sat.png",
            "nps_structure": "charts/nps.png",
        },
        "key_insights": ["Insight 1", "Insight 2"],
        "recommendations": [
            {
                "title": "Rec 1",
                "priority": "High",
                "based_on": "Data A",
                "details": "Do X",
            },
            {
                "title": "Rec 2",
                "priority": "Medium",
                "based_on": "Data B",
                "details": "Do Y",
            },
            {
                "title": "Rec 3",
                "priority": "Low",
                "based_on": "Data C",
                "details": "Do Z",
            },
        ],
    }


@pytest.fixture
def analysis_json_file(tmp_path: Path, sample_analysis: dict) -> Path:
    """Write analysis dict to a JSON file and return path."""
    p = tmp_path / "analysis_results.json"
    with p.open("w", encoding="utf-8") as f:
        json.dump(sample_analysis, f, ensure_ascii=False)
    return p


@pytest.fixture
def templates_dir() -> Path:
    """Return the actual templates directory from the project."""
    return Path(__file__).parent / "src" / "templates"
