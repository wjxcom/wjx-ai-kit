import json
import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from wjx_survey_ppt import fetch_survey


def _write_fetch_shim(directory: Path, log_path: Path) -> Path:
    """Create a real executable wjx shim for the complete Layer 1 chain."""
    script = directory / "wjx_fetch_shim.py"
    script.write_text(
        r'''import json
import os
import sys

raw_args = sys.argv[1:]
command = " ".join(raw_args[:2])
with open(os.environ["WJX_SHIM_LOG"], "a", encoding="utf-8") as stream:
    stream.write(json.dumps(raw_args, ensure_ascii=False) + "\n")

survey = {
    "title": "完整链路满意度",
    "atype": 1,
    "answer_valid": 4,
    "url": "https://example.test/m/short-sid",
    "questions": [
        {
            "q_index": 2,
            "q_type": 3,
            "q_subtype": 302,
            "is_nps": True,
            "q_title": "推荐意愿",
            "items": [
                {"item_index": index, "item_title": str(index), "item_score": index}
                for index in range(11)
            ],
        },
        {
            "q_index": 3,
            "q_type": 3,
            "q_subtype": 302,
            "q_title": "满意度",
            "items": [
                {"item_index": index, "item_title": str(index), "item_score": index}
                for index in range(1, 6)
            ],
        },
        {
            "q_index": 4,
            "q_type": 5,
            "q_title": "改进建议",
        },
    ],
}
counts = {
    "2": {"0": 1, "6": 1, "9": 1, "10": 1},
    "3": {"1": 1, "3": 1, "4": 1, "5": 1},
}
report = {
    "answer_report": {
        key: {"q_index": int(key), "item_count": value}
        for key, value in counts.items()
    }
}

if command == "survey get":
    data = survey
elif command == "response count":
    data = {"total_count": 4, "join_times": 4}
elif command == "response report":
    data = report
elif command == "response 360-report":
    data = {"open_answers": {"4": ["响应很快", "希望增加自助服务"]}}
elif command == "analytics nps":
    data = {
        "score": 0,
        "promoters": {"count": 2, "ratio": 0.5},
        "passives": {"count": 0, "ratio": 0},
        "detractors": {"count": 2, "ratio": 0.5},
        "total": 4,
        "rating": "一般",
    }
elif command == "analytics csat":
    data = {"csat": 0.75, "satisfied": 3, "total": 4, "rating": "一般"}
else:
    raise SystemExit("unexpected command: " + command)

print(json.dumps({"ok": True, "data": data}, ensure_ascii=False))
''',
        encoding="utf-8",
    )
    if os.name == "nt":
        command = directory / "wjx.cmd"
        command.write_text(
            f'@echo off\n"{sys.executable}" "{script}" %*\n',
            encoding="utf-8",
        )
        return command
    executable = directory / "wjx"
    executable.write_text(
        f"#!{sys.executable}\nexec(compile(open({str(script)!r}, encoding='utf-8').read(), {str(script)!r}, 'exec'))\n",
        encoding="utf-8",
    )
    executable.chmod(executable.stat().st_mode | stat.S_IXUSR)
    return executable


class FetchSurveyIntegrationTests(unittest.TestCase):
    def test_fetch_from_vid_runs_complete_cli_chain_and_aggregates_data(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            log_path = root / "calls.jsonl"
            shim = _write_fetch_shim(root, log_path)
            workdir = root / "work"
            workdir.mkdir()
            with patch.object(fetch_survey, "_resolve_wjx", return_value=str(shim)), patch.dict(
                os.environ, {"WJX_SHIM_LOG": str(log_path)}, clear=False
            ):
                data = fetch_survey.fetch_from_vid("12345", workdir)

            calls = [json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines()]
            self.assertEqual(
                [tuple(call[:2]) for call in calls],
                [
                    ("survey", "get"),
                    ("response", "count"),
                    ("response", "report"),
                    ("response", "360-report"),
                    ("analytics", "nps"),
                    ("analytics", "csat"),
                ],
            )
            self.assertTrue(all(call[-2:] == ["--format", "json"] for call in calls))
            self.assertEqual(calls[0][calls[0].index("--vid") + 1], "12345")
            self.assertEqual(calls[1][calls[1].index("--vid") + 1], "12345")
            self.assertEqual(calls[2][calls[2].index("--vid") + 1], "12345")
            self.assertEqual(calls[3][calls[3].index("--vid") + 1], "12345")

            nps_scores = json.loads(calls[4][calls[4].index("--scores") + 1])
            csat_scores = json.loads(calls[5][calls[5].index("--scores") + 1])
            self.assertEqual(nps_scores, [0, 6, 9, 10])
            self.assertEqual(csat_scores, [1, 3, 4, 5])

            self.assertEqual(data["survey"], {
                "title": "完整链路满意度",
                "vid": "12345",
                "type": 1,
                "url": "https://example.test/m/short-sid",
            })
            self.assertEqual(data["response"], {
                "total": 4,
                "completed": 4,
                "avg_time": None,
            })
            self.assertEqual(data["analytics"]["nps"]["score"], 0)
            self.assertEqual(data["analytics"]["csat"][0]["qid"], "3")
            text_question = next(question for question in data["questions"] if question["qid"] == "4")
            self.assertEqual(text_question["open_answers"], ["响应很快", "希望增加自助服务"])
            self.assertEqual(data["questions"][0]["distribution"][0]["count"], 1)

    def test_report_limit_falls_back_to_query_aggregation(self):
        calls = []
        survey = {
            "title": "报告限额回退",
            "atype": 1,
            "answer_valid": 2,
            "questions": [
                {
                    "q_index": 2,
                    "q_type": 3,
                    "q_title": "选择",
                    "items": [
                        {"item_index": 1, "item_title": "甲"},
                        {"item_index": 2, "item_title": "乙"},
                    ],
                }
            ],
        }

        def fake_run_wjx(args):
            calls.append(args)
            command = tuple(args[:2])
            if command == ("survey", "get"):
                return survey
            if command == ("response", "count"):
                return {"total_count": 2}
            if command == ("response", "report"):
                raise RuntimeError("超过可分析范围")
            if command == ("response", "query"):
                return {
                    "answers": {
                        "a": {"answer_items": {"20000": {"q_index": 2, "item_index": [1]}}},
                        "b": {"answer_items": {"20000": {"q_index": 2, "item_index": [2]}}},
                    }
                }
            if command == ("response", "360-report"):
                return {}
            raise AssertionError(f"unexpected wjx call: {args}")

        with patch.object(fetch_survey, "_run_wjx", side_effect=fake_run_wjx):
            data = fetch_survey.fetch_from_vid("limit-1", Path("."))

        self.assertEqual([tuple(call[:2]) for call in calls], [
            ("survey", "get"),
            ("response", "count"),
            ("response", "report"),
            ("response", "query"),
            ("response", "360-report"),
        ])
        query_call = calls[3]
        self.assertIn("--valid", query_call)
        self.assertEqual(data["response"]["total"], 2)
        self.assertEqual(
            [item["count"] for item in data["questions"][0]["distribution"]],
            [1, 1],
        )

    def test_360_failure_falls_back_to_open_answer_query_and_filters_noise(self):
        calls = []
        survey = {
            "title": "开放题回退",
            "atype": 1,
            "answer_valid": 2,
            "questions": [{"q_index": 4, "q_type": 5, "q_title": "建议"}],
        }

        def fake_run_wjx(args):
            calls.append(args)
            command = tuple(args[:2])
            if command == ("survey", "get"):
                return survey
            if command == ("response", "count"):
                return {"total_count": 2}
            if command == ("response", "report"):
                return {"answer_report": {}}
            if command == ("response", "360-report"):
                raise RuntimeError("当前问卷不支持 360 报告")
            if command == ("response", "query"):
                return {
                    "answers": {
                        "a": {
                            "answer_items": {
                                "40000": {"q_index": 4, "answer_text": "响应很快"}
                            }
                        },
                        "b": {
                            "answer_items": {
                                "40000": {"q_index": 4, "answer_text": "1"}
                            }
                        },
                        "c": {
                            "answer_items": {
                                "40000": {"q_index": 4, "answer_text": "希望增加自助服务"}
                            }
                        },
                    }
                }
            raise AssertionError(f"unexpected wjx call: {args}")

        with patch.object(fetch_survey, "_run_wjx", side_effect=fake_run_wjx):
            data = fetch_survey.fetch_from_vid("text-1", Path("."))

        query_calls = [call for call in calls if tuple(call[:2]) == ("response", "query")]
        self.assertEqual(len(query_calls), 1)
        self.assertEqual(query_calls[0][2:], ["--vid", "text-1", "--page_index", "1", "--page_size", "50"])
        self.assertEqual(
            data["questions"][0]["open_answers"],
            ["响应很快", "希望增加自助服务"],
        )
        self.assertNotIn("analytics", {tuple(call[:2]) for call in calls})

    def test_missing_answer_valid_uses_response_count_as_total(self):
        calls = []

        def fake_run_wjx(args):
            calls.append(args)
            command = tuple(args[:2])
            if command == ("survey", "get"):
                return {"title": "无 answer_valid", "questions": []}
            if command == ("response", "count"):
                return {"total_count": 3, "join_times": 4}
            if command == ("response", "report"):
                return {"answer_report": {}}
            if command == ("response", "360-report"):
                return {}
            raise AssertionError(f"unexpected wjx call: {args}")

        with patch.object(fetch_survey, "_run_wjx", side_effect=fake_run_wjx):
            data = fetch_survey.fetch_from_vid("count-fallback", Path("."))

        self.assertEqual(data["response"]["total"], 3)
        self.assertEqual(data["response"]["completed"], 3)
        self.assertEqual([tuple(call[:2]) for call in calls], [
            ("survey", "get"),
            ("response", "count"),
            ("response", "report"),
            ("response", "360-report"),
        ])

    def test_nps_cross_tab_queries_responses_and_computes_each_group(self):
        calls = []
        survey = {
            "title": "NPS 分组",
            "atype": 1,
            "answer_valid": 2,
            "questions": [
                {
                    "q_index": 2,
                    "q_type": 3,
                    "q_subtype": 302,
                    "is_nps": True,
                    "q_title": "推荐",
                    "items": [
                        {"item_index": i, "item_title": str(i), "item_score": i}
                        for i in range(11)
                    ],
                },
                {
                    "q_index": 3,
                    "q_type": 3,
                    "q_title": "用户类型",
                    "items": [
                        {"item_index": 1, "item_title": "新用户"},
                        {"item_index": 2, "item_title": "老用户"},
                    ],
                },
            ],
        }

        def fake_run_wjx(args):
            calls.append(args)
            command = tuple(args[:2])
            if command == ("survey", "get"):
                return survey
            if command == ("response", "count"):
                return {"total_count": 2}
            if command == ("response", "report"):
                return {
                    "answer_report": {
                        "2": {"q_index": 2, "item_count": {"0": 1, "10": 1}},
                        "3": {"q_index": 3, "item_count": {"1": 1, "2": 1}},
                    }
                }
            if command == ("response", "360-report"):
                return {}
            if command == ("response", "query"):
                return {
                    "answers": {
                        "a": {
                            "answer_items": {
                                "20000": {"q_index": 2, "item_value": 0},
                                "30000": {"q_index": 3, "item_index": [1]},
                            }
                        },
                        "b": {
                            "answer_items": {
                                "20000": {"q_index": 2, "item_value": 10},
                                "30000": {"q_index": 3, "item_index": [2]},
                            }
                        },
                    }
                }
            if command == ("analytics", "nps"):
                raw_scores = args[args.index("--scores") + 1]
                scores = json.loads(raw_scores)
                return {
                    "score": 100 if scores == [10] else -100 if scores == [0] else 0,
                    "promoters": {"ratio": 1 if scores == [10] else 0},
                    "passives": {"ratio": 0},
                    "detractors": {"ratio": 1 if scores == [0] else 0},
                }
            raise AssertionError(f"unexpected wjx call: {args}")

        with patch.object(fetch_survey, "_run_wjx", side_effect=fake_run_wjx):
            data = fetch_survey.fetch_from_vid("nps-1", Path("."))

        self.assertEqual(data["analytics"]["nps"]["score"], 0)
        cross_tab = data["nps_cross_tab"]["3"]
        self.assertEqual(cross_tab["title"], "用户类型")
        self.assertEqual(
            [(group["option_label"], group["count"], group["score"]) for group in cross_tab["groups"]],
            [("新用户", 1, -100), ("老用户", 1, 100)],
        )
        query_calls = [call for call in calls if tuple(call[:2]) == ("response", "query")]
        self.assertEqual(len(query_calls), 1)


if __name__ == "__main__":
    unittest.main()
