from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

from PIL import Image, ImageDraw, ImageFont

from .exceptions import FontUnavailableError, ParameterError
from .models import InputRecord

_ILLEGAL_FILENAME = re.compile(r'[\\/:*?"<>|]')
_RESERVED_NAMES = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}
_FONT_CANDIDATES = (
    "msyh.ttc",
    "msyh.ttf",
    "msyhui.ttc",
    "msyhui.ttf",
    "simsun.ttc",
    "simsun.ttf",
)


def is_valid_url(value: str) -> bool:
    parsed = urlparse(value.strip())
    return parsed.scheme.lower() in {"http", "https"} and bool(parsed.hostname)


def sanitize_filename(value: str, max_length: int = 120) -> str:
    cleaned = _ILLEGAL_FILENAME.sub("_", value).rstrip(" .")
    if not cleaned:
        return ""
    if cleaned.split(".", 1)[0].upper() in _RESERVED_NAMES:
        cleaned = f"_{cleaned}"
    if len(cleaned) > max_length:
        digest = hashlib.sha1(cleaned.encode("utf-8")).hexdigest()[:10]
        cleaned = f"{cleaned[: max_length - 11]}_{digest}"
    return cleaned


def allocate_filenames(records: Iterable[InputRecord]) -> None:
    used: set[str] = set()
    for record in records:
        base = sanitize_filename(record.record_id) or f"行号{record.excel_row}"
        candidate = base
        index = 0
        while f"{candidate}.png".casefold() in used:
            index += 1
            candidate = f"{base}_{index}"
        filename = f"{candidate}.png"
        used.add(filename.casefold())
        record.image_filename = filename


def _font_paths() -> list[Path]:
    windir = Path(os.environ.get("WINDIR", r"C:\Windows"))
    fonts_dir = windir / "Fonts"
    return [fonts_dir / filename for filename in _FONT_CANDIDATES]


def _load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in _font_paths():
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size=size)
            except OSError:
                continue
    raise FontUnavailableError("找不到可用的中文系统字体，请安装 Microsoft YaHei、Microsoft YaHei UI 或 SimSun")


def _split_long_token(token: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    parts: list[str] = []
    current = ""
    for char in token:
        candidate = current + char
        if current and font.getlength(candidate) > width:
            parts.append(current)
            current = char
        else:
            current = candidate
    if current:
        parts.append(current)
    return parts or [""]


def wrap_text(text: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    if not text:
        return []
    lines: list[str] = []
    for paragraph in text.splitlines() or [text]:
        words = paragraph.split(" ") if " " in paragraph else list(paragraph)
        current = ""
        for word in words:
            separator = " " if current and " " in paragraph else ""
            candidate = current + separator + word
            if current and font.getlength(candidate) > width:
                lines.append(current)
                current = ""
            if font.getlength(word) > width:
                chunks = _split_long_token(word, font, width)
                if current:
                    lines.append(current)
                lines.extend(chunks[:-1])
                current = chunks[-1]
            else:
                current = word if not current else candidate
        if current:
            lines.append(current)
    return lines or [""]


def create_qr_image(url: str, record_id: str, size: int, output_path: Path) -> tuple[int, int]:
    if size not in {150, 256, 512}:
        raise ParameterError(f"不支持的二维码尺寸: {size}")
    import qrcode
    from qrcode.constants import ERROR_CORRECT_M

    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=10, border=0)
    qr.add_data(url)
    qr.make(fit=True)
    matrix = qr.get_matrix()
    matrix_size = len(matrix)
    matrix_image = Image.new("L", (matrix_size, matrix_size), color=255)
    pixels = matrix_image.load()
    for y, row in enumerate(matrix):
        for x, is_dark in enumerate(row):
            pixels[x, y] = 0 if is_dark else 255
    body = matrix_image.resize((size, size), Image.Resampling.NEAREST).convert("RGB")
    quiet = max(1, round(4 * size / matrix_size))
    gap = round(8 * size / 150)
    font_size = max(1, round(18 * size / 150))
    font = _load_font(font_size) if record_id else None
    lines = wrap_text(record_id, font, size) if font else []
    bbox = font.getbbox("Ag") if font else (0, 0, 0, 0)
    line_height = max(1, bbox[3] - bbox[1])
    line_gap = max(1, round(font_size * 0.2))
    text_height = len(lines) * line_height + max(0, len(lines) - 1) * line_gap
    image = Image.new("RGB", (size + quiet * 2, size + quiet * 2 + (gap + text_height if lines else 0)), "white")
    image.paste(body, (quiet, quiet))
    if lines and font:
        draw = ImageDraw.Draw(image)
        y = quiet + size + gap
        for line in lines:
            line_width = draw.textbbox((0, 0), line, font=font)[2]
            x = quiet + (size - line_width) / 2
            draw.text((x, y), line, font=font, fill="black")
            y += line_height + line_gap
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, format="PNG")
    return image.size

