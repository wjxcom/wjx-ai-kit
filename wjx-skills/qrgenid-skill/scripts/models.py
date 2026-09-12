from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class RunOptions:
    input_file: Path
    output_dir: Path | None = None
    id_column: str = "A"
    url_column: str = "B"
    sheet: str | None = None
    sheet_index: int | None = None
    size: int = 150

    def resolved_output_dir(self) -> Path:
        return (self.output_dir or self.input_file.parent).expanduser().resolve()


@dataclass
class InputRecord:
    excel_row: int
    record_id: str
    url: str
    image_filename: str = ""
    image_path: Path | None = None
    status: str = ""
    failure_reason: str = ""

    def as_output_row(self) -> list[str]:
        return [self.record_id, self.url, self.status, self.failure_reason]


@dataclass
class ErrorItem:
    row_number: int | None
    record_id: str | None
    url: str | None
    status: str
    failure_reason: str
    expected_image_path: str | None
    error_code: str | None = None
    message: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "row_number": self.row_number,
            "id": self.record_id,
            "url": self.url,
            "status": self.status,
            "failure_reason": self.failure_reason,
            "expected_image_path": self.expected_image_path,
            "error_code": self.error_code,
            "message": self.message,
        }


@dataclass
class RunSummary:
    status: str
    exit_code: int
    input_file: str | None
    output_file: str | None
    success_count: int = 0
    failure_count: int = 0
    cancelled_count: int = 0
    errors: list[ErrorItem] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "exit_code": self.exit_code,
            "input_file": self.input_file,
            "output_file": self.output_file,
            "success_count": self.success_count,
            "failure_count": self.failure_count,
            "cancelled_count": self.cancelled_count,
            "errors": [item.to_dict() for item in self.errors],
        }

