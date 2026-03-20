"""Unit tests for src/report_generator.py"""
import json
from pathlib import Path

import pytest

from src.report_generator import (
    create_jinja_env,
    generate_report,
    load_analysis_results,
    render_report,
)


class TestLoadAnalysisResults:
    def test_loads_valid_json(self, analysis_json_file: Path):
        result = load_analysis_results(analysis_json_file)
        assert isinstance(result, dict)
        assert "meta" in result
        assert "nps" in result

    def test_file_not_found_raises(self, tmp_path: Path):
        missing = tmp_path / "missing.json"
        with pytest.raises(FileNotFoundError):
            load_analysis_results(missing)

    def test_preserves_values(self, analysis_json_file: Path):
        result = load_analysis_results(analysis_json_file)
        assert result["meta"]["sample_size"] == 10
        assert result["nps"]["score"] == 10.0


class TestCreateJinjaEnv:
    def test_returns_environment(self, templates_dir: Path):
        env = create_jinja_env(templates_dir)
        assert env is not None
        assert env.trim_blocks is True
        assert env.lstrip_blocks is True

    def test_can_load_template(self, templates_dir: Path):
        env = create_jinja_env(templates_dir)
        template = env.get_template("report_template.md")
        assert template is not None


class TestRenderReport:
    def test_render_produces_markdown(self, sample_analysis: dict, templates_dir: Path):
        content = render_report(sample_analysis, templates_dir)
        assert isinstance(content, str)
        assert len(content) > 0

    def test_report_contains_executive_summary(self, sample_analysis: dict, templates_dir: Path):
        content = render_report(sample_analysis, templates_dir)
        assert "执行摘要" in content

    def test_report_contains_data_interpretation(self, sample_analysis: dict, templates_dir: Path):
        content = render_report(sample_analysis, templates_dir)
        assert "数据解读" in content

    def test_report_contains_action_recommendations(self, sample_analysis: dict, templates_dir: Path):
        content = render_report(sample_analysis, templates_dir)
        assert "行动建议" in content

    def test_report_includes_nps_score(self, sample_analysis: dict, templates_dir: Path):
        content = render_report(sample_analysis, templates_dir)
        assert str(sample_analysis["nps"]["score"]) in content

    def test_report_includes_satisfaction_mean(self, sample_analysis: dict, templates_dir: Path):
        content = render_report(sample_analysis, templates_dir)
        assert str(sample_analysis["overview"]["satisfaction"]["mean"]) in content

    def test_report_includes_all_recommendations(self, sample_analysis: dict, templates_dir: Path):
        content = render_report(sample_analysis, templates_dir)
        for rec in sample_analysis["recommendations"]:
            assert rec["title"] in content

    def test_report_includes_key_insights(self, sample_analysis: dict, templates_dir: Path):
        content = render_report(sample_analysis, templates_dir)
        for insight in sample_analysis["key_insights"]:
            assert insight in content

    def test_report_includes_chart_references(self, sample_analysis: dict, templates_dir: Path):
        content = render_report(sample_analysis, templates_dir)
        assert "charts/sat.png" in content
        assert "charts/nps.png" in content


class TestGenerateReport:
    def test_writes_report_file(self, analysis_json_file: Path, templates_dir: Path, tmp_path: Path):
        output = tmp_path / "output" / "report.md"
        generate_report(analysis_json_file, templates_dir, output)
        assert output.exists()
        assert output.stat().st_size > 0

    def test_report_file_is_valid_markdown(self, analysis_json_file: Path, templates_dir: Path, tmp_path: Path):
        output = tmp_path / "report.md"
        generate_report(analysis_json_file, templates_dir, output)
        content = output.read_text(encoding="utf-8")
        # Should start with a markdown heading
        assert content.startswith("# ")

    def test_creates_parent_directories(self, analysis_json_file: Path, templates_dir: Path, tmp_path: Path):
        output = tmp_path / "a" / "b" / "c" / "report.md"
        generate_report(analysis_json_file, templates_dir, output)
        assert output.exists()
