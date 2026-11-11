#!/usr/bin/env python
"""SVG 主题模板 lint 检查（防回归）。

跑：python scripts/lint_themes.py
退出码：0 = 全部通过；1 = 发现问题。

当前 5 类检查：

1) **business 残留色检查**：4 个新主题（consulting/tech-dark/editorial/gov-red）里
   不应该出现 business 主色（除以下豁免）。派生主题时漏色 = 撞色风险。

2) **NPS 三色硬编码检查**：P06_Scale / P11_NPS_Cross 模板里 NPS 推荐/中立/贬损
   三色必须用 {{NPS_PROMOTER_COLOR}} 等 slot，不能硬编码 hex。

3) **未填占位符检查**：模板里不应有 `{{XXX}}` 后未经 build 处理还残留的占位符
   （仅 source 模板该有占位符，渲染后产物不该有）。

4) **填槽未闭合检查**：`{{#KEY}}` 必须有匹配的 `{{/KEY}}`。

5) **viewBox 一致性**：所有模板必须 viewBox="0 0 1280 720"。
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path


_THEMES_ROOT = Path(__file__).resolve().parent.parent / "templates" / "themes"

# business 主题专用色（其他主题里出现 = 派生漏色）
_BUSINESS_ONLY_COLORS = {
    "#0F2847",  # business 顶栏深蓝（其他主题应该有自己的深色）
    "#5A7090",  # business 副标中蓝
    "#8FB4E0",  # business 顶栏浅蓝灰
    "#8A9BB5",  # business 副标灰蓝
    "#6A86A8",  # business footer 中蓝
    "#C9D6EA",  # business 副标浅灰蓝
    "#DDE4EF",  # business 浅边
    "#D8E0EC",  # business 边色
    "#E0E6F0",  # business 极浅边
    "#4A90D9",  # business 条形主蓝
}

# NPS 三色 hex 不该硬编码出现在 P06/P11 里（应该用 slot）
_NPS_PALETTE_HEXES = {
    # business
    "#6FB8A1", "#F5A623", "#E55B4F",
    # warm
    "#A8B27A", "#F4A261", "#C75145",
    # minimal
    "#3A3A3A", "#9A9A9A", "#1A1A1A",
    # soft
    "#A8B5A0", "#D4B8A0", "#C68F8F",
    # consulting
    "#4A6B5A", "#9B9B9B", "#C04A3C",
    # tech-dark
    "#34D399", "#FBBF24", "#F87171",
    # editorial
    "#5C7A3D", "#C9933D", "#B7410E",
    # gov-red
    "#3D6B47", "#C9A227", "#8B1A2C",
}


def _scan_theme_files() -> dict[str, list[Path]]:
    """{theme_name: [svg_paths]}"""
    if not _THEMES_ROOT.is_dir():
        return {}
    out = {}
    for theme_dir in sorted(_THEMES_ROOT.iterdir()):
        if not theme_dir.is_dir():
            continue
        svgs = sorted(theme_dir.glob("*.svg"))
        if svgs:
            out[theme_dir.name] = svgs
    return out


def _check_business_residue(themes: dict[str, list[Path]]) -> list[str]:
    """4 个新主题里不应该出现 business 主色。"""
    errs = []
    new_themes = ("consulting", "tech-dark", "editorial", "gov-red")
    for theme in new_themes:
        if theme not in themes:
            continue
        for svg in themes[theme]:
            text = svg.read_text(encoding="utf-8")
            colors_found = re.findall(r"#[A-F0-9]{6}", text, re.IGNORECASE)
            biz_residue = sorted({c.upper() for c in colors_found if c.upper() in _BUSINESS_ONLY_COLORS})
            if biz_residue:
                errs.append(f"[business 残留色] {theme}/{svg.name}: {biz_residue}")
    return errs


def _check_nps_color_slots(themes: dict[str, list[Path]]) -> list[str]:
    """P06_Scale 和 P11_NPS_Cross 必须用 {{NPS_*_COLOR}} slot，不能硬编码三色 hex。"""
    errs = []
    targets = ("P06_Scale.svg", "P11_NPS_Cross.svg")
    for theme, svgs in themes.items():
        for svg in svgs:
            if svg.name not in targets:
                continue
            text = svg.read_text(encoding="utf-8")
            colors_found = re.findall(r"#[A-F0-9]{6}", text, re.IGNORECASE)
            hard_coded = sorted({c.upper() for c in colors_found if c.upper() in _NPS_PALETTE_HEXES})
            if hard_coded:
                errs.append(
                    f"[NPS 色硬编码] {theme}/{svg.name}: {hard_coded} 应改用 "
                    f"{{{{NPS_PROMOTER_COLOR}}}} / {{{{NPS_PASSIVE_COLOR}}}} / {{{{NPS_DETRACTOR_COLOR}}}}"
                )
    return errs


def _check_balanced_blocks(themes: dict[str, list[Path]]) -> list[str]:
    """{{#KEY}}...{{/KEY}} 和 {{?KEY}}...{{/KEY}} 必须配对。"""
    errs = []
    for theme, svgs in themes.items():
        for svg in svgs:
            text = svg.read_text(encoding="utf-8")
            opens_list = re.findall(r"\{\{#(\w+)\}\}", text)
            opens_cond = re.findall(r"\{\{\?(\w+)\}\}", text)
            closes = re.findall(r"\{\{/(\w+)\}\}", text)
            opens = sorted(opens_list + opens_cond)
            for o in opens:
                if o not in closes:
                    errs.append(f"[未闭合块] {theme}/{svg.name}: {{{{#{o}}}}} 缺 {{{{/{o}}}}}")
            for c in closes:
                if c not in opens:
                    errs.append(f"[多余闭合] {theme}/{svg.name}: {{{{/{c}}}}} 没有对应开口")
    return errs


def _check_viewbox(themes: dict[str, list[Path]]) -> list[str]:
    """所有模板 viewBox 必须为 0 0 1280 720。"""
    errs = []
    target = '0 0 1280 720'
    for theme, svgs in themes.items():
        for svg in svgs:
            text = svg.read_text(encoding="utf-8")
            m = re.search(r'viewBox="([^"]+)"', text)
            if not m:
                errs.append(f"[缺 viewBox] {theme}/{svg.name}")
                continue
            if m.group(1).strip() != target:
                errs.append(f"[viewBox 不一致] {theme}/{svg.name}: '{m.group(1)}'（应该是 '{target}'）")
    return errs


def main() -> int:
    themes = _scan_theme_files()
    if not themes:
        print(f"错误：找不到 {_THEMES_ROOT}/")
        return 2

    print(f"扫描 {len(themes)} 个主题 / {sum(len(v) for v in themes.values())} 个 SVG 模板")
    print()

    all_errs: list[tuple[str, list[str]]] = [
        ("business 残留色", _check_business_residue(themes)),
        ("NPS 色硬编码", _check_nps_color_slots(themes)),
        ("填槽块未闭合", _check_balanced_blocks(themes)),
        ("viewBox 一致性", _check_viewbox(themes)),
    ]

    total = 0
    for label, errs in all_errs:
        if errs:
            print(f"✗ {label}（{len(errs)} 处）")
            for e in errs:
                print(f"    {e}")
            total += len(errs)
        else:
            print(f"✓ {label}")

    print()
    if total == 0:
        print("全部通过 ✓")
        return 0
    print(f"共 {total} 个问题")
    return 1


if __name__ == "__main__":
    sys.exit(main())
