from __future__ import annotations

import logging
import os
import re
import threading
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, as_completed, wait
from pathlib import Path
from typing import Callable

from .exceptions import InputFileError, OutputError, ParameterError, QrgenidError
from .excel import load_records
from .models import ErrorItem, InputRecord, RunOptions, RunSummary
from .qr import allocate_filenames, create_qr_image, is_valid_url
from .writer import write_verified_workbook

ProgressCallback = Callable[[dict[str, object]], None]


def _error_item(record: InputRecord, error_code: str | None = None) -> ErrorItem:
    if error_code is None:
        error_code = {"失败": "row_failure", "已取消": "cancelled"}.get(record.status)
    return ErrorItem(
        row_number=record.excel_row,
        record_id=record.record_id,
        url=record.url,
        status=record.status,
        failure_reason=record.failure_reason,
        expected_image_path=str(record.image_path.resolve()) if record.image_path else None,
        error_code=error_code,
        message=record.failure_reason,
    )


def _configure_logger(output_dir: Path) -> logging.Logger:
    logger = logging.getLogger("qrgenid")
    logger.handlers.clear()
    logger.setLevel(logging.INFO)
    handler = logging.FileHandler(output_dir / "qrgenid.log", mode="w", encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(handler)
    return logger


def _emit(callback: ProgressCallback | None, payload: dict[str, object]) -> None:
    if callback:
        callback(payload)


def _preflight(options: RunOptions) -> tuple[Path, Path, logging.Logger]:
    if options.size not in {150, 256, 512}:
        raise ParameterError(f"不支持的二维码尺寸: {options.size}")
    if options.sheet is not None and options.sheet_index is not None:
        raise ParameterError("--sheet 和 --sheet-index 不能同时使用")
    input_file = options.input_file.expanduser().resolve()
    if not input_file.exists() or not input_file.is_file():
        raise InputFileError(f"输入文件不存在或不是文件: {input_file}")
    output_dir = options.resolved_output_dir()
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        qrcodes_dir = output_dir / "qrcodes"
        qrcodes_dir.mkdir(parents=True, exist_ok=True)
        probe = output_dir / ".qrgenid-write-test"
        probe.write_bytes(b"")
        probe.unlink()
        output_file = output_dir / "output.xlsx"
        if output_file.exists():
            with output_file.open("ab"):
                pass
        logger = _configure_logger(output_dir)
        return output_dir, qrcodes_dir, logger
    except QrgenidError:
        raise
    except Exception as exc:
        raise OutputError(f"输出目录不可写: {output_dir}: {exc}") from exc


def _cleanup_pngs(qrcodes_dir: Path, logger: logging.Logger) -> None:
    for entry in qrcodes_dir.iterdir():
        if entry.is_file() and entry.suffix.lower() == ".png":
            try:
                entry.unlink()
                logger.info("清理旧图片: %s", entry)
            except OSError as exc:
                raise OutputError(f"无法清理旧二维码图片: {entry}: {exc}") from exc


def _validate_url(record: InputRecord) -> None:
    if not record.url or not is_valid_url(record.url):
        record.status = "失败"
        record.failure_reason = "URL 为空或不是有效的 http/https 地址"


def run(options: RunOptions, progress_callback: ProgressCallback | None = None, log_callback: Callable[[str], None] | None = None, cancel_event: threading.Event | None = None) -> RunSummary:
    cancel_event = cancel_event or threading.Event()
    input_file = options.input_file.expanduser().resolve()
    output_file = (options.resolved_output_dir() / "output.xlsx").resolve()
    logger: logging.Logger | None = None
    records: list[InputRecord] = []
    try:
        output_dir, qrcodes_dir, logger = _preflight(options)
        # Validate the workbook, sheet, and columns before deleting any old PNGs.
        records = load_records(input_file, options.sheet, options.sheet_index, options.id_column, options.url_column)
        _cleanup_pngs(qrcodes_dir, logger)
        allocate_filenames(records)
        for record in records:
            record.image_path = (qrcodes_dir / record.image_filename).resolve()
        _emit(progress_callback, {"event": "loaded", "total": len(records)})
        if log_callback:
            log_callback(f"已读取 {len(records)} 条有效记录")
        if logger:
            logger.info("读取记录数: %d", len(records))

        for record in records:
            _validate_url(record)
        pending = [record for record in records if not record.status]
        workers = max(1, min(32, (os.cpu_count() or 1) + 4))
        futures = {}
        pending_iter = iter(pending)
        with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="qrgenid") as executor:
            def submit_more() -> None:
                while not cancel_event.is_set() and len(futures) < workers * 2:
                    try:
                        record = next(pending_iter)
                    except StopIteration:
                        return
                    futures[executor.submit(create_qr_image, record.url, record.record_id, options.size, record.image_path)] = record

            submit_more()
            while futures:
                done_futures, _ = wait(tuple(futures), return_when=FIRST_COMPLETED)
                for future in done_futures:
                    record = futures.pop(future)
                    try:
                        future.result()
                        record.status = "成功"
                        record.failure_reason = ""
                        if logger:
                            logger.info("生成成功，第 %d 行: %s", record.excel_row, record.image_path)
                    except Exception as exc:
                        if future.cancelled():
                            record.status = "已取消"
                            record.failure_reason = "用户取消"
                        else:
                            record.status = "失败"
                            record.failure_reason = f"二维码生成失败: {exc}"
                            if logger:
                                logger.exception("生成失败，第 %d 行", record.excel_row)
                    done = sum(1 for item in records if item.status)
                    _emit(progress_callback, {"event": "progress", "row": record.excel_row, "done": done, "total": len(records), "status": record.status})
                    if log_callback:
                        log_callback(f"第 {record.excel_row} 行：{record.status}")
                if cancel_event.is_set():
                    for future, record in list(futures.items()):
                        if future.cancel():
                            futures.pop(future)
                            record.status = "已取消"
                            record.failure_reason = "用户取消"
                    continue
                submit_more()

        for record in records:
            if not record.status:
                record.status = "已取消" if cancel_event.is_set() else "失败"
                record.failure_reason = "用户取消" if cancel_event.is_set() else "未处理"
        write_verified_workbook(output_file, records)
        success = sum(record.status == "成功" for record in records)
        failure = sum(record.status == "失败" for record in records)
        cancelled = sum(record.status == "已取消" for record in records)
        errors = [_error_item(record) for record in records if record.status != "成功"]
        status = "cancelled" if cancelled else ("partial_failure" if failure else "success")
        exit_code = 1 if failure or cancelled else 0
        _emit(progress_callback, {"event": "finished", "total": len(records), "status": status})
        return RunSummary(status, exit_code, str(input_file), str(output_file), success, failure, cancelled, errors)
    except (ParameterError, InputFileError, OutputError, QrgenidError) as exc:
        if logger:
            logger.error("任务失败: %s", exc)
        error = ErrorItem(None, None, None, "失败", str(exc), None, getattr(exc, "error_code", "error"), str(exc))
        return RunSummary("error", 2, str(input_file), None, errors=[error])
    except Exception as exc:
        if logger:
            logger.exception("未预期错误")
        error = ErrorItem(None, None, None, "失败", f"未预期错误: {exc}", None, "unexpected_error", str(exc))
        return RunSummary("error", 2, str(input_file), None, errors=[error])
    finally:
        if logger:
            for handler in logger.handlers:
                handler.close()
            logger.handlers.clear()

