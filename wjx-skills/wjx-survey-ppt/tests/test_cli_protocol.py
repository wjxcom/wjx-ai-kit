import json
import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from wjx_survey_ppt import fetch_survey


def _write_wjx_shim(directory: Path) -> Path:
    """Create a real executable shim that emits the current CLI envelope."""
    payload = {
        "ok": True,
        "data": {
            "title": "协议契约测试",
            "answer_valid": 7,
            "questions": [
                {
                    "q_index": 2,
                    "q_type": 3,
                    "q_title": "满意度",
                    "items": [{"item_index": 1, "item_title": "满意"}],
                }
            ],
        },
    }
    script = directory / "wjx_shim.py"
    script.write_text(
        "import json\n"
        "print(json.dumps(" + repr(payload) + ", ensure_ascii=False))\n",
        encoding="utf-8",
    )
    if os.name == "nt":
        command = directory / "wjx.cmd"
        command.write_text(
            f'@echo off\n"{sys.executable}" "{script}" %*\n',
            encoding="utf-8",
        )
        return command
    script.write_text(
        f"#!{sys.executable}\n"
        + script.read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    script.chmod(script.stat().st_mode | stat.S_IXUSR)
    return script


class CliProtocolTests(unittest.TestCase):
    def test_run_wjx_uses_canonical_format_option(self):
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            log_path = directory / "args.json"
            script = directory / "wjx_args.py"
            script.write_text(
                "import json, os\n"
                "with open(os.environ['WJX_ARG_LOG'], 'w', encoding='utf-8') as f:\n"
                "    json.dump(__import__('sys').argv[1:], f)\n"
                "print(json.dumps({'ok': True, 'data': {'answer_valid': 1}}, ensure_ascii=False))\n",
                encoding="utf-8",
            )
            if os.name == "nt":
                shim = directory / "wjx.cmd"
                shim.write_text(f'@echo off\n"{sys.executable}" "{script}" %*\n', encoding="utf-8")
            else:
                shim = directory / "wjx"
                shim.write_text(f"#!{sys.executable}\nexec(compile(open({str(script)!r}, encoding='utf-8').read(), {str(script)!r}, 'exec'))\n", encoding="utf-8")
                shim.chmod(shim.stat().st_mode | stat.S_IXUSR)
            with patch.object(fetch_survey, "_resolve_wjx", return_value=str(shim)), patch.dict(
                os.environ, {"WJX_ARG_LOG": str(log_path)}, clear=False
            ):
                fetch_survey._run_wjx(["survey", "get", "--vid", "42"])

            args = json.loads(log_path.read_text(encoding="utf-8"))
            self.assertEqual(args[-2:], ["--format", "json"])
            self.assertNotIn("--json", args)

    def test_run_wjx_unwraps_current_ok_data_envelope_from_real_subprocess(self):
        with tempfile.TemporaryDirectory() as raw:
            shim = _write_wjx_shim(Path(raw))
            with patch.object(fetch_survey, "_resolve_wjx", return_value=str(shim)):
                data = fetch_survey._run_wjx(["survey", "get", "--vid", "42"])

        self.assertEqual(data["title"], "协议契约测试")
        self.assertEqual(data["answer_valid"], 7)
        self.assertEqual(data["questions"][0]["q_index"], 2)

    def test_run_wjx_rejects_current_error_envelope_from_real_subprocess(self):
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            script = directory / "wjx_error.py"
            script.write_text(
                "import json\n"
                "print(json.dumps({'ok': False, 'error': {'code': 'API_ERROR', 'message': '无权限'}}, ensure_ascii=False))\n",
                encoding="utf-8",
            )
            if os.name == "nt":
                shim = directory / "wjx.cmd"
                shim.write_text(f'@echo off\n"{sys.executable}" "{script}" %*\n', encoding="utf-8")
            else:
                shim = directory / "wjx"
                shim.write_text(f"#!{sys.executable}\nexec({str(script)!r})\n", encoding="utf-8")
                shim.chmod(shim.stat().st_mode | stat.S_IXUSR)
            with patch.object(fetch_survey, "_resolve_wjx", return_value=str(shim)):
                with self.assertRaisesRegex(RuntimeError, "无权限"):
                    fetch_survey._run_wjx(["survey", "get", "--vid", "42"])


if __name__ == "__main__":
    unittest.main()
