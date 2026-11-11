from __future__ import annotations

import argparse
import json
import signal
import sys
import threading
from pathlib import Path

from . import __version__
from .core import run
from .models import RunOptions


class _ArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        raise ValueError(message)


def build_parser() -> argparse.ArgumentParser:
    parser = _ArgumentParser(prog="qrgenid", description="从 Excel 批量生成带 ID 标签的二维码")
    parser.add_argument("--version", action="version", version=__version__)
    parser.add_argument("--input", required=True, help="输入 .xlsx 或 .xls 文件")
    parser.add_argument("--output-dir", help="输出目录，默认使用输入文件所在目录")
    parser.add_argument("--id-column", default="A", help="ID 列字母或从 1 开始的列号")
    parser.add_argument("--url-column", default="B", help="URL 列字母或从 1 开始的列号")
    sheet_group = parser.add_mutually_exclusive_group()
    sheet_group.add_argument("--sheet", help="工作表名称，大小写敏感完全匹配")
    sheet_group.add_argument("--sheet-index", type=int, help="工作表序号，从 1 开始")
    parser.add_argument("--size", type=int, choices=[150, 256, 512], default=150, help="二维码主体尺寸")
    return parser


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    try:
        args = build_parser().parse_args(argv)
    except SystemExit as exc:
        return int(exc.code)
    except (ValueError, TypeError) as exc:
        payload = {
            "status": "error",
            "exit_code": 2,
            "input_file": None,
            "output_file": None,
            "success_count": 0,
            "failure_count": 0,
            "cancelled_count": 0,
            "errors": [{"row_number": None, "id": None, "url": None, "status": "失败", "failure_reason": f"参数错误: {exc}", "expected_image_path": None, "error_code": "parameter_error", "message": str(exc)}],
        }
        print(json.dumps(payload, ensure_ascii=False))
        return 2

    cancel_event = threading.Event()

    def handle_sigint(_signum: int, _frame: object) -> None:
        cancel_event.set()
        print("收到取消请求，正在整理已处理记录...", file=sys.stderr)

    previous = signal.signal(signal.SIGINT, handle_sigint)
    try:
        summary = run(
            RunOptions(
                input_file=Path(args.input),
                output_dir=Path(args.output_dir) if args.output_dir else None,
                id_column=args.id_column,
                url_column=args.url_column,
                sheet=args.sheet,
                sheet_index=args.sheet_index,
                size=args.size,
            ),
            log_callback=lambda message: print(message, file=sys.stderr),
            cancel_event=cancel_event,
        )
        print(json.dumps(summary.to_dict(), ensure_ascii=False))
        return summary.exit_code
    finally:
        signal.signal(signal.SIGINT, previous)

