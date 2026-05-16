import json
import io
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from wjx_survey_ppt import __main__ as cli
from wjx_survey_ppt import fetch_survey
from wjx_survey_ppt.build_project import data_signature


def _single_choice_survey(answer_valid=1):
    return {
        "title": "Accuracy check",
        "atype": 1,
        "url": "https://example.test/survey",
        "answer_valid": answer_valid,
        "questions": [
            {
                "q_index": 2,
                "q_type": 3,
                "q_title": "Pick one",
                "items": [
                    {"item_index": 1, "item_title": "A"},
                    {"item_index": 2, "item_title": "B"},
                ],
            }
        ],
    }


class FetchSurveyAccuracyTests(unittest.TestCase):
    def test_count_mismatch_falls_back_to_response_query(self):
        calls = []

        def fake_run_wjx(args):
            calls.append(args)
            command = tuple(args[:2])
            if command == ("survey", "get"):
                return _single_choice_survey(answer_valid=1)
            if command == ("response", "count"):
                return {"total_count": 10, "join_times": 10}
            if command == ("response", "report"):
                return {
                    "answer_report": {
                        "2": {"q_index": 2, "item_count": {"1": 1, "2": 0}}
                    }
                }
            if command == ("response", "360-report"):
                raise RuntimeError("not available in test")
            if command == ("response", "query"):
                return {
                    "answers": {
                        "one": {
                            "answer_items": {
                                "20000": {
                                    "q_index": 2,
                                    "item_index": [1],
                                }
                            }
                        }
                    }
                }
            raise AssertionError(f"unexpected wjx call: {args}")

        with patch.object(fetch_survey, "_run_wjx", side_effect=fake_run_wjx):
            data = fetch_survey.fetch_from_vid("123", Path("."))

        self.assertEqual(data["response"]["total"], 1)
        dist = data["questions"][0]["distribution"]
        self.assertEqual(sum(item["count"] for item in dist), 1)
        self.assertIn(
            [
                "response",
                "query",
                "--vid",
                "123",
                "--valid",
                "--page_index",
                "1",
                "--page_size",
                "100",
            ],
            calls,
        )


class FinalStageFreshnessTests(unittest.TestCase):
    def test_final_stage_refreshes_data_from_vid_before_rendering(self):
        with tempfile.TemporaryDirectory() as tmp:
            workdir = Path(tmp)
            stale_data = {
                "survey": {"vid": "123", "title": "Old"},
                "response": {"total": 10, "completed": 10, "avg_time": None},
                "questions": [],
                "analytics": {},
                "nps_cross_tab": {},
            }
            fresh_data = {
                "survey": {"vid": "123", "title": "Fresh"},
                "response": {"total": 1, "completed": 1, "avg_time": None},
                "questions": [],
                "analytics": {},
                "nps_cross_tab": {},
            }
            (workdir / "data.json").write_text(
                json.dumps(stale_data, ensure_ascii=False),
                encoding="utf-8",
            )
            (workdir / "outline.json").write_text(
                json.dumps({"theme": "business", "pages": []}, ensure_ascii=False),
                encoding="utf-8",
            )

            rendered_totals = []

            def fake_build_svg_project(data, project_dir, theme="business"):
                rendered_totals.append(data["response"]["total"])
                return ["P01_Cover"]

            argv = [
                "wjx_survey_ppt",
                "--workdir",
                str(workdir),
                "--stage",
                "final",
                "--plan-only",
                "--skip-ai-check",
            ]
            with redirect_stdout(io.StringIO()), patch.object(
                sys, "argv", argv
            ), patch.object(
                cli, "fetch_from_vid", return_value=fresh_data
            ) as fetch_mock, patch.object(
                cli, "build_svg_project", side_effect=fake_build_svg_project
            ):
                exit_code = cli.main()

            self.assertEqual(exit_code, 0)
            fetch_mock.assert_called_once_with("123", workdir)
            self.assertEqual(rendered_totals, [1])
            saved = json.loads((workdir / "data.json").read_text(encoding="utf-8"))
            self.assertEqual(saved["response"]["total"], 1)

    def test_final_stage_blocks_stale_ai_outline_after_refresh(self):
        with tempfile.TemporaryDirectory() as tmp:
            workdir = Path(tmp)
            stale_data = {
                "survey": {"vid": "123", "title": "Old"},
                "response": {"total": 10, "completed": 10, "avg_time": None},
                "questions": [],
                "analytics": {},
                "nps_cross_tab": {},
            }
            fresh_data = {
                "survey": {"vid": "123", "title": "Fresh"},
                "response": {"total": 1, "completed": 1, "avg_time": None},
                "questions": [],
                "analytics": {},
                "nps_cross_tab": {},
            }
            (workdir / "data.json").write_text(
                json.dumps(stale_data, ensure_ascii=False),
                encoding="utf-8",
            )
            (workdir / "outline.json").write_text(
                json.dumps(
                    {
                        "theme": "business",
                        "_data_signature": data_signature(stale_data),
                        "pages": [
                            {
                                "name": "P02_Executive_Summary",
                                "type": "exec_summary",
                                "include": True,
                                "ai_findings": ["old facts"],
                            },
                            {
                                "name": "P09_Insights",
                                "type": "insights",
                                "include": True,
                                "ai_insights": ["old insight"],
                            },
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            argv = [
                "wjx_survey_ppt",
                "--workdir",
                str(workdir),
                "--stage",
                "final",
                "--plan-only",
            ]
            with redirect_stdout(io.StringIO()), patch.object(
                sys, "argv", argv
            ), patch.object(
                cli, "fetch_from_vid", return_value=fresh_data
            ), patch.object(
                cli, "build_svg_project"
            ) as build_mock:
                exit_code = cli.main()

            self.assertEqual(exit_code, 4)
            build_mock.assert_not_called()
            saved = json.loads((workdir / "data.json").read_text(encoding="utf-8"))
            self.assertEqual(saved["response"]["total"], 1)

    def test_final_stage_stale_outline_block_ignores_skip_ai_check(self):
        with tempfile.TemporaryDirectory() as tmp:
            workdir = Path(tmp)
            stale_data = {
                "survey": {"vid": "123", "title": "Old"},
                "response": {"total": 10, "completed": 10, "avg_time": None},
                "questions": [],
                "analytics": {},
                "nps_cross_tab": {},
            }
            fresh_data = {
                "survey": {"vid": "123", "title": "Fresh"},
                "response": {"total": 1, "completed": 1, "avg_time": None},
                "questions": [],
                "analytics": {},
                "nps_cross_tab": {},
            }
            (workdir / "data.json").write_text(
                json.dumps(stale_data, ensure_ascii=False),
                encoding="utf-8",
            )
            (workdir / "outline.json").write_text(
                json.dumps(
                    {
                        "theme": "business",
                        "_data_signature": data_signature(stale_data),
                        "pages": [
                            {
                                "name": "P02_Executive_Summary",
                                "type": "exec_summary",
                                "include": True,
                                "ai_findings": ["old facts"],
                            }
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            argv = [
                "wjx_survey_ppt",
                "--workdir",
                str(workdir),
                "--stage",
                "final",
                "--plan-only",
                "--skip-ai-check",
            ]
            with redirect_stdout(io.StringIO()), patch.object(
                sys, "argv", argv
            ), patch.object(
                cli, "fetch_from_vid", return_value=fresh_data
            ), patch.object(
                cli, "build_svg_project"
            ) as build_mock:
                exit_code = cli.main()

            self.assertEqual(exit_code, 4)
            build_mock.assert_not_called()

    def test_final_stage_blocks_legacy_ai_outline_without_signature_when_data_changes(self):
        with tempfile.TemporaryDirectory() as tmp:
            workdir = Path(tmp)
            stale_data = {
                "survey": {"vid": "123", "title": "Old"},
                "response": {"total": 10, "completed": 10, "avg_time": None},
                "questions": [],
                "analytics": {},
                "nps_cross_tab": {},
            }
            fresh_data = {
                "survey": {"vid": "123", "title": "Fresh"},
                "response": {"total": 1, "completed": 1, "avg_time": None},
                "questions": [],
                "analytics": {},
                "nps_cross_tab": {},
            }
            (workdir / "data.json").write_text(
                json.dumps(stale_data, ensure_ascii=False),
                encoding="utf-8",
            )
            (workdir / "outline.json").write_text(
                json.dumps(
                    {
                        "theme": "business",
                        "pages": [
                            {
                                "name": "P02_Executive_Summary",
                                "type": "exec_summary",
                                "include": True,
                                "ai_findings": ["old facts"],
                            },
                            {
                                "name": "P09_Insights",
                                "type": "insights",
                                "include": True,
                                "ai_insights": ["old insight"],
                            },
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            argv = [
                "wjx_survey_ppt",
                "--workdir",
                str(workdir),
                "--stage",
                "final",
                "--plan-only",
            ]
            with redirect_stdout(io.StringIO()), patch.object(
                sys, "argv", argv
            ), patch.object(
                cli, "fetch_from_vid", return_value=fresh_data
            ), patch.object(
                cli, "build_svg_project"
            ) as build_mock:
                exit_code = cli.main()

            self.assertEqual(exit_code, 4)
            build_mock.assert_not_called()


if __name__ == "__main__":
    unittest.main()
