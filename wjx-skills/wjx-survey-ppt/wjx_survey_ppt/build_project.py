"""Layer 2：把 data.json 填进 templates/slide_layouts/*.svg 模板，输出 SVG 到 project/svg_final/。

填槽语法（references/slot-filling.md 详述）：
- {{KEY}}                标量替换
- {{#LIST}}...{{/LIST}}  列表展开（循环体内 {{ITEM}} {{INDEX}} {{VALUE}} 等）
- {{?KEY}}...{{/KEY}}    条件块（KEY 不存在或值假则整段删除）

页面选择策略：固定 10 页框架，但根据数据特征跳过空页（如无矩阵题则跳过 P07）。
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any


_THEMES_ROOT = Path(__file__).resolve().parent.parent / "templates" / "themes"
_DEFAULT_THEME = "business"


def list_themes() -> list[str]:
    if not _THEMES_ROOT.is_dir():
        return []
    return sorted(p.name for p in _THEMES_ROOT.iterdir() if p.is_dir())


def build_outline(data: dict[str, Any], theme: str = _DEFAULT_THEME) -> dict[str, Any]:
    """根据 data.json 生成默认 outline.json：哪些页 + 默认标题。

    Agent 可以编辑产出的 outline.json，把 include 改 false 跳页、改 title/subtitle、
    填 ai_summary。再用 apply_outline 把编辑应用回 data 后跑 build。
    """
    s = data.get("survey", {}) or {}
    questions = data.get("questions", []) or []
    pages: list[dict[str, Any]] = []

    pages.append({
        "name": "P01_Cover", "type": "cover", "include": True,
        "title": s.get("title", "问卷调查报告"),
    })
    pages.append({
        "name": "P02_Executive_Summary", "type": "exec_summary", "include": True,
        "ai_findings": data.get("ai_findings") or [],  # 三条事实摘要（agent 填）
    })
    pages.append({
        "name": "P03_Sample_Overview", "type": "sample", "include": True,
    })

    singles = [q for q in questions if (q.get("type") or "") == "single"]
    for i, q in enumerate(singles[:_PAGE_CAP]):
        suffix = _SUFFIXES[i] if len(singles) > 1 else ""
        pages.append({
            "name": f"P04_Single_Choice{('_' + suffix) if suffix else ''}",
            "type": "single", "qid": q["qid"], "include": True,
            "title": q.get("title", ""),
            "ai_summary": "",
        })
    multis = [q for q in questions if (q.get("type") or "") == "multi"]
    for i, q in enumerate(multis[:_PAGE_CAP]):
        suffix = _SUFFIXES[i] if len(multis) > 1 else ""
        pages.append({
            "name": f"P05_Multi_Choice{('_' + suffix) if suffix else ''}",
            "type": "multi", "qid": q["qid"], "include": True,
            "title": q.get("title", ""),
            "ai_summary": "",
        })

    if data.get("analytics", {}).get("nps") or data.get("analytics", {}).get("csat"):
        pages.append({
            "name": "P06_Scale", "type": "scale", "include": True,
            "ai_summary": "",
        })

    matrices = [q for q in questions if (q.get("type") or "") == "matrix"]
    for i, q in enumerate(matrices[:_PAGE_CAP]):
        suffix = _SUFFIXES[i] if len(matrices) > 1 else ""
        pages.append({
            "name": f"P07_Matrix{('_' + suffix) if suffix else ''}",
            "type": "matrix", "qid": q["qid"], "include": True,
            "title": q.get("title", ""),
            "ai_summary": "",
        })

    cross_tab = data.get("nps_cross_tab") or {}
    for i, gqi in enumerate(list(cross_tab.keys())[:_PAGE_CAP]):
        suffix = _SUFFIXES[i] if len(cross_tab) > 1 else ""
        pages.append({
            "name": f"P11_NPS_Cross{('_' + suffix) if suffix else ''}",
            "type": "nps_cross", "group_qid": gqi, "include": True,
            "ai_summary": "",
        })

    text_qs = [q for q in questions if (q.get("type") or "") == "text" and q.get("open_answers")]
    if text_qs:
        pages.append({
            "name": "P08_Open_Questions", "type": "open", "include": True,
        })

    pages.append({
        "name": "P09_Insights", "type": "insights", "include": True,
        "ai_insights": data.get("ai_insights") or [],
    })
    pages.append({
        "name": "P10_Appendix", "type": "appendix", "include": True,
    })

    return {
        "theme": theme,
        "_help": "可编辑：theme（换主题）、include=false（跳页）、调整数组顺序（改顺序）、ai_findings/ai_insights/ai_summary（写自然语言解读）",
        "_themes_available": list_themes(),
        "pages": pages,
    }


def apply_outline(data: dict[str, Any], outline: dict[str, Any]) -> dict[str, Any]:
    """把 agent 编辑后的 outline 反向应用到 data，让 build_svg_project 消费。

    具体动作：
    - 把 ai_findings / ai_insights 写到 data 顶层
    - 把每页的 ai_summary 收集到 data["ai_page_summaries"]
    - 设置 data["_outline_filter"]：build 时按 outline.pages 顺序+include 过滤
    """
    data = {**data}  # 浅拷
    pages = outline.get("pages", [])

    # 顶层 findings/insights 从 outline 同步
    for p in pages:
        if p.get("type") == "exec_summary" and p.get("ai_findings"):
            data["ai_findings"] = p["ai_findings"]
        if p.get("type") == "insights" and p.get("ai_insights"):
            data["ai_insights"] = p["ai_insights"]

    # 每页 ai_summary 收到 ai_page_summaries
    summaries = dict(data.get("ai_page_summaries") or {})
    for p in pages:
        s = (p.get("ai_summary") or "").strip()
        if not s:
            continue
        # 优先按 qid 索引（chart 页），否则按 page name
        key = p.get("qid") or (f"{p.get('group_qid')}_cross" if p.get("group_qid") else p["name"])
        summaries[str(key)] = s
    if summaries:
        data["ai_page_summaries"] = summaries

    # 把 outline 的页面过滤信息存起来，build_svg_project 会用
    data["_outline_filter"] = {
        "ordered_names": [p["name"] for p in pages if p.get("include", True)],
        "skipped_names": [p["name"] for p in pages if not p.get("include", True)],
    }
    return data


def build_svg_project(
    data: dict[str, Any],
    project_dir: Path,
    theme: str = _DEFAULT_THEME,
) -> list[str]:
    """根据 data 决定生成哪些页，填槽并写入 project_dir/svg_final/。

    返回实际生成的页面文件名列表（用于上层报告页数）。
    """
    svg_dir = project_dir / "svg_final"
    svg_dir.mkdir(parents=True, exist_ok=True)

    # 注入主题供 _nps_color_slots 等读取
    data = {**data, "_theme": theme}

    pages: list[tuple[str, Any]] = []

    pages.append(("P01_Cover", _cover_context(data)))
    pages.append(("P02_Executive_Summary", _exec_summary_context(data)))
    pages.append(("P03_Sample_Overview", _sample_context(data)))
    pages.extend(_single_choice_pages(data))
    pages.extend(_multi_choice_pages(data))

    scale = _scale_context(data)
    if scale is not None:
        pages.append(("P06_Scale", scale))

    pages.extend(_matrix_pages(data))

    # NPS 分类比较页（按其他单选题分组对照）
    pages.extend(_nps_cross_tab_pages(data))

    open_q = _open_question_context(data)
    if open_q is not None:
        pages.append(("P08_Open_Questions", open_q))

    pages.append(("P09_Insights", _insights_context(data)))
    pages.append(("P10_Appendix", _appendix_context(data)))

    # 应用 outline 过滤（如果调用方走了分步流程）：按 outline 顺序重排 + 跳过 include=false
    outline_filter = data.get("_outline_filter") or {}
    if outline_filter:
        ordered = outline_filter.get("ordered_names") or []
        skipped = set(outline_filter.get("skipped_names") or [])
        page_map = {name: payload for name, payload in pages if name not in skipped}
        # 按 outline 顺序优先；outline 没列到的（默认全保留）追加到末尾
        new_pages = []
        seen: set[str] = set()
        for n in ordered:
            if n in page_map:
                new_pages.append((n, page_map[n]))
                seen.add(n)
        for n, p in pages:
            if n not in seen and n not in skipped:
                new_pages.append((n, p))
        pages = new_pages

    theme_dir = _THEMES_ROOT / theme
    if not theme_dir.is_dir():
        available = ", ".join(list_themes()) or "(none)"
        raise RuntimeError(
            f"主题 '{theme}' 不存在。可用主题：{available}"
        )

    # 加 NN_ 前缀确保 ppt-master 按字母序处理时与逻辑序一致
    # （否则 P11_NPS_Cross 会排在 P10_Appendix 之后变成最后一页）
    written = []
    for idx, (name, payload) in enumerate(pages, start=1):
        prefix = f"{idx:02d}_"
        out_name = f"{prefix}{name}.svg"
        if isinstance(payload, str):
            (svg_dir / out_name).write_text(payload, encoding="utf-8")
            written.append(out_name)
            continue
        template_path = _resolve_template(theme_dir, name)
        if not template_path.exists():
            print(f"  [skip] 模板缺失：{theme}/{name}")
            continue
        svg = _render_svg(template_path.read_text(encoding="utf-8"), payload)
        out = svg_dir / out_name
        out.write_text(svg, encoding="utf-8")
        written.append(out_name)
    return written


def _resolve_template(theme_dir: Path, page_name: str) -> Path:
    """支持 P04_xxx_a / P04_xxx_b 这种动态命名 → 复用同一个 P04 模板。"""
    direct = theme_dir / f"{page_name}.svg"
    if direct.exists():
        return direct
    base = re.sub(r"_[a-z]$", "", page_name)
    return theme_dir / f"{base}.svg"


# ---------- 各页 context 构造 ----------


def _cover_context(data: dict[str, Any]) -> dict[str, Any]:
    s = data.get("survey", {})
    r = data.get("response", {})
    return {
        "TITLE": s.get("title", "问卷调查报告"),
        "VID": s.get("vid", ""),
        "TOTAL": r.get("total", 0),
        "DATE": _today(),
    }


def _exec_summary_context(data: dict[str, Any]) -> dict[str, Any]:
    findings = data.get("ai_findings") or _auto_findings(data)
    return {
        "TITLE": "执行摘要",
        "FINDINGS": [
            {
                "INDEX": i + 1,
                "TEXT": _truncate(f, 56),
                "Y_OFFSET": 270 + i * 130,
            }
            for i, f in enumerate(findings[:3])
        ],
    }


def _sample_context(data: dict[str, Any]) -> dict[str, Any]:
    r = data.get("response", {})
    total = r.get("total", 0)
    completed = r.get("completed", 0)
    rate = (completed / total * 100) if total else 0
    return {
        "TITLE": "样本概览",
        "TOTAL": total,
        "COMPLETED": completed,
        "COMPLETION_RATE": f"{rate:.1f}",
        "AVG_TIME": r.get("avg_time") or "—",
    }


_PAGE_CAP = 5  # 每类题最多 5 页（_a/_b/_c/_d/_e）
_SUFFIXES = "abcde"


def _single_choice_pages(data: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    """选最多 5 道单选题各一页。"""
    pages = []
    candidates = [
        q for q in data.get("questions", []) if (q.get("type") or "").lower() == "single"
    ]
    summaries = data.get("ai_page_summaries") or {}
    for i, q in enumerate(candidates[:_PAGE_CAP]):
        suffix = _SUFFIXES[i] if len(candidates) > 1 else ""
        page_name = f"P04_Single_Choice{('_' + suffix) if suffix else ''}"
        ctx = _bar_chart_context(q, data)
        ctx["AI_SUMMARY"] = summaries.get(q.get("qid"), "")
        pages.append((page_name, ctx))
    return pages


def _nps_cross_tab_pages(data: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    """每道分组题（非 NPS 单选）一页 NPS 对照图。最多 5 页。

    走 SVG 模板路径（P11_NPS_Cross.svg）。模板在 templates/themes/<theme>/ 下。
    """
    cross_tab = data.get("nps_cross_tab") or {}
    if not cross_tab:
        return []
    pages: list[tuple[str, dict[str, Any]]] = []
    items = list(cross_tab.items())
    total = len(items)
    summaries = data.get("ai_page_summaries") or {}
    for i, (gqi, payload) in enumerate(items[:_PAGE_CAP]):
        groups = payload.get("groups") or []
        if not groups:
            continue
        suffix = _SUFFIXES[i] if total > 1 else ""
        page_name = f"P11_NPS_Cross{('_' + suffix) if suffix else ''}"
        ctx = _nps_cross_tab_context(payload, data)
        ctx["AI_SUMMARY"] = summaries.get(f"{gqi}_cross", "") or summaries.get(page_name, "")
        pages.append((page_name, ctx))
    return pages


def _nps_color_slots(data: dict[str, Any]) -> dict[str, str]:
    """从全局上下文里取主题，给模板返回 NPS 三色 hex（避免硬编码 business 三色）。

    通过 data["_theme"] 传入；若缺失则用 business 默认色。
    """
    from . import charts
    theme = data.get("_theme") or "business"
    p = charts.get_palette(theme)
    return {
        "NPS_PROMOTER_COLOR": p.nps_promoter,
        "NPS_PASSIVE_COLOR": p.nps_passive,
        "NPS_DETRACTOR_COLOR": p.nps_detractor,
    }


def _nps_cross_tab_context(payload: dict[str, Any], data: dict[str, Any] | None = None) -> dict[str, Any]:
    """把单道分组题的 NPS 对照转换成 P11 模板可消费的 context。

    模板里：
      - 标题 + 副标题
      - 一组堆叠柱（每选项一柱），柱内分推荐 / 中立 / 贬损（高度 = 占比）
      - 每柱顶部贴 NPS 值标签 + n=N 样本量
    几何：每柱宽 W=200，间距 G=40，整组居中在 viewBox 1280×720
    """
    groups = payload.get("groups") or []
    n = len(groups)
    bar_w = 200 if n <= 4 else 140
    gap = 40 if n <= 4 else 24
    chart_x_start = (1280 - (n * bar_w + (n - 1) * gap)) // 2
    chart_y_top = 290     # 柱顶（最高 100%）所在 y
    chart_y_bottom = 580  # 柱底（0%）所在 y
    chart_h = chart_y_bottom - chart_y_top  # 柱总高（对应 100%）

    bars = []
    for idx, g in enumerate(groups):
        x0 = chart_x_start + idx * (bar_w + gap)
        prom = float(g.get("promoter_pct", 0))
        pas = float(g.get("passive_pct", 0))
        det = float(g.get("detractor_pct", 0))
        # 三段从底向上堆：贬损 → 中立 → 推荐
        det_h = chart_h * det / 100
        pas_h = chart_h * pas / 100
        prom_h = chart_h * prom / 100
        det_y = chart_y_bottom - det_h
        pas_y = det_y - pas_h
        prom_y = pas_y - prom_h
        bars.append(
            {
                "X": x0,
                "BAR_W": bar_w,
                "DET_Y": f"{det_y:.1f}",
                "DET_H": f"{det_h:.1f}",
                "PAS_Y": f"{pas_y:.1f}",
                "PAS_H": f"{pas_h:.1f}",
                "PROM_Y": f"{prom_y:.1f}",
                "PROM_H": f"{prom_h:.1f}",
                "LABEL": _truncate(g.get("option_label", ""), 12),
                "LABEL_X": x0 + bar_w // 2,
                "LABEL_Y": chart_y_bottom + 30,
                "N_TEXT": f"n={g.get('count', 0)}",
                "N_X": x0 + bar_w // 2,
                "N_Y": chart_y_bottom + 50,
                "NPS_SCORE": f"{float(g.get('score', 0)):.1f}",
                "NPS_X": x0 + bar_w // 2,
                "NPS_Y": prom_y - 12 if prom_h > 0 else pas_y - 12,
                # 三段内部百分比标签（仅当段够高才显示，>= 8% 才放）
                "PROM_LABEL": f"{int(round(prom))}%" if prom >= 8 else "",
                "PROM_LABEL_Y": prom_y + prom_h / 2 + 5,
                "PAS_LABEL": f"{int(round(pas))}%" if pas >= 8 else "",
                "PAS_LABEL_Y": pas_y + pas_h / 2 + 5,
                "DET_LABEL": f"{int(round(det))}%" if det >= 8 else "",
                "DET_LABEL_Y": det_y + det_h / 2 + 5,
            }
        )

    out = {
        "TITLE": f"NPS 分类比较 · 按「{payload.get('title', '分组题')}」",
        "SUBTITLE": "各选项独立计算的 NPS · 堆叠条 = 三类用户占比 · 顶端 = NPS 值",
        "BARS": bars,
        "CHART_Y_TOP": chart_y_top,
        "CHART_Y_BOTTOM": chart_y_bottom,
        "CHART_X_START": chart_x_start - 30,
        "CHART_X_END": chart_x_start + n * bar_w + (n - 1) * gap + 10,
    }
    if data is not None:
        out.update(_nps_color_slots(data))
    return out


def _nps_gauge_geometry(score: float, benchmark: int | None, cx: int, cy: int, r: int) -> dict[str, Any]:
    """半圆 NPS gauge 的几何 slot。

    NPS 范围 [-100,100] → 角度 [180°, 0°]，SVG y 向下。
    指针长度 = r * 0.85；基准刻度内/外端在 r ± 8。
    """
    import math

    def to_xy(s: float, radius: float) -> tuple[float, float]:
        s = max(-100.0, min(100.0, float(s)))
        theta = math.radians(180 - 0.9 * (s + 100))
        return cx + radius * math.cos(theta), cy - radius * math.sin(theta)

    needle_x, needle_y = to_xy(score, r * 0.85)
    out: dict[str, Any] = {
        "GAUGE_CX": cx, "GAUGE_CY": cy, "GAUGE_R": r,
        "NEEDLE_X": f"{needle_x:.1f}",
        "NEEDLE_Y": f"{needle_y:.1f}",
    }
    if benchmark is not None:
        bi_x, bi_y = to_xy(benchmark, r - 14)
        bo_x, bo_y = to_xy(benchmark, r + 14)
        bl_x, bl_y = to_xy(benchmark, r + 32)
        out.update(
            {
                "BENCHMARK_INNER_X": f"{bi_x:.1f}",
                "BENCHMARK_INNER_Y": f"{bi_y:.1f}",
                "BENCHMARK_OUTER_X": f"{bo_x:.1f}",
                "BENCHMARK_OUTER_Y": f"{bo_y:.1f}",
                "BENCHMARK_LABEL_X": f"{bl_x:.1f}",
                "BENCHMARK_LABEL_Y": f"{bl_y:.1f}",
            }
        )
    return out


def _donut_geometry(percents: dict[str, int], r: int) -> dict[str, Any]:
    """三个 donut 的 stroke-dasharray slot。

    每个 percent 转成 (arc, gap)，circumference = 2πr。
    """
    import math

    out: dict[str, Any] = {}
    c = 2 * math.pi * r
    for key, pct in percents.items():
        pct_f = max(0, min(100, int(pct))) / 100
        arc = c * pct_f
        gap = c - arc
        out[f"{key}_DASH"] = f"{arc:.2f}"
        out[f"{key}_GAP"] = f"{gap:.2f}"
    return out


def _question_avg(q: dict[str, Any]) -> float | None:
    """根据 distribution 算加权平均分；item_score 任一缺失则返回 None。"""
    dist = q.get("distribution") or []
    if not dist:
        return None
    total = 0
    weighted = 0.0
    for d in dist:
        v = d.get("value")
        c = d.get("count", 0) or 0
        if v is None:
            return None
        try:
            v_num = float(v)
        except (TypeError, ValueError):
            return None
        weighted += v_num * c
        total += c
    return weighted / total if total else None


def _bar_rows(q: dict[str, Any]) -> list[dict[str, Any]]:
    """从 question 抽出 [{label, count, percent}] 排序后的列表（top 5 + 其他）。"""
    dist = q.get("distribution") or []
    options = q.get("options") or []
    total = sum((d.get("count", 0) for d in dist), 0) or 1
    sorted_dist = sorted(enumerate(dist), key=lambda x: x[1].get("count", 0), reverse=True)
    top = sorted_dist[:5]
    rest = sorted_dist[5:]
    rows: list[dict[str, Any]] = []
    for orig_i, d in top:
        label = d.get("label") or (options[orig_i] if orig_i < len(options) else f"选项{orig_i + 1}")
        count = d.get("count", 0)
        rows.append({"label": _truncate(label, 28), "count": count, "percent": count / total * 100})
    if rest:
        rest_count = sum(d.get("count", 0) for _, d in rest)
        rows.append({"label": f"其他（{len(rest)}项）", "count": rest_count, "percent": rest_count / total * 100})
    return rows


def _multi_choice_pages(data: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    """最多 5 道多选题各一页，复用 P05 模板。"""
    multis = [
        q for q in data.get("questions", []) if (q.get("type") or "").lower() == "multi"
    ]
    summaries = data.get("ai_page_summaries") or {}
    pages: list[tuple[str, dict[str, Any]]] = []
    for i, q in enumerate(multis[:_PAGE_CAP]):
        suffix = _SUFFIXES[i] if len(multis) > 1 else ""
        page_name = f"P05_Multi_Choice{('_' + suffix) if suffix else ''}"
        ctx = _bar_chart_context(q, data)
        ctx["AI_SUMMARY"] = summaries.get(q.get("qid"), "")
        pages.append((page_name, ctx))
    return pages


_CN_NPS_BENCHMARK = 30  # 中国市场综合 NPS 参考值（LLM 估算，仅作方向性参考）


def _scale_context(data: dict[str, Any]) -> dict[str, Any] | None:
    nps = data.get("analytics", {}).get("nps")
    if nps:
        score = float(nps.get("score", nps.get("value", 0)) or 0)
        prom = int(round(_pct(nps.get("promoters")) * 100))
        pas = int(round(_pct(nps.get("passives")) * 100))
        det = int(round(_pct(nps.get("detractors")) * 100))

        ctx = {
            "TITLE": "净推荐值（NPS）",
            "NPS_VALUE": int(round(score)),
            "PROMOTERS": prom,
            "PASSIVES": pas,
            "DETRACTORS": det,
            "HAS_NPS_BENCHMARK": True,
            "BENCHMARK_VALUE": _CN_NPS_BENCHMARK,
        }
        ctx.update(_nps_color_slots(data))
        summaries = data.get("ai_page_summaries") or {}
        ctx["AI_SUMMARY"] = summaries.get("P06_Scale") or summaries.get("p06_nps", "")
        # 半圆 gauge 几何（fallback SVG 模板用）：cx=380 cy=410 R=200，从 180° 顺时针到 0°
        ctx.update(_nps_gauge_geometry(score, _CN_NPS_BENCHMARK, cx=380, cy=410, r=200))
        # 三个 donut（半径 60，stroke-width 14）的 dasharray
        ctx.update(_donut_geometry({"PROMOTERS": prom, "PASSIVES": pas, "DETRACTORS": det}, r=60))
        return ctx
    csat_list = data.get("analytics", {}).get("csat") or []
    if csat_list:
        c = csat_list[0]
        # 新 schema：csat=ratio (0-1)；老 schema：value=百分比
        csat_pct = c.get("csat")
        if csat_pct is not None:
            csat_value = round(csat_pct * 100, 1)
        else:
            csat_value = c.get("value", 0)
        total = c.get("total") or 0
        satisfied = c.get("satisfiedCount") or 0
        # MEAN 在新 schema 不直接给，能算就算
        mean = c.get("mean")
        if mean is None and total:
            dist = c.get("distribution") or {}
            score_sum = sum(int(k) * v for k, v in dist.items() if str(k).lstrip("-").isdigit())
            mean = round(score_sum / total, 2) if score_sum else 0
        return {
            "TITLE": "满意度（CSAT）",
            "CSAT_VALUE": csat_value,
            "MEAN": mean or 0,
            "SATISFIED": satisfied,
            "TOTAL": total,
        }
    return None


def _pct(v: Any) -> float:
    """analytics 子分组既可能是 dict {count, ratio} 也可能是裸 ratio。"""
    if isinstance(v, dict):
        return float(v.get("ratio") or 0)
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _matrix_pages(data: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    """最多 5 道矩阵题各一页，复用 P07 模板。"""
    matrices = [
        q for q in data.get("questions", []) if (q.get("type") or "").lower() == "matrix"
    ]
    summaries = data.get("ai_page_summaries") or {}
    pages: list[tuple[str, dict[str, Any]]] = []
    for i, q in enumerate(matrices[:_PAGE_CAP]):
        ctx = _matrix_context_for_question(q, data)
        if not ctx:
            continue
        ctx["AI_SUMMARY"] = summaries.get(q.get("qid"), "")
        suffix = _SUFFIXES[i] if len(matrices) > 1 else ""
        page_name = f"P07_Matrix{('_' + suffix) if suffix else ''}"
        pages.append((page_name, ctx))
    return pages


def _matrix_context_for_question(q: dict[str, Any], data: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """单题矩阵 → P07 模板 context（含动态列头 COLUMNS）。

    cell 填色用主题的 heatmap_color（不再硬编码 business 蓝）。
    """
    rows_in = q.get("distribution") or []
    options = q.get("options") or []  # 列名
    if not rows_in:
        return None

    # 列数稳定取自 distribution 第一行 values 长度（_normalize_questions 已对齐）
    n_cols = max((len(r.get("values") or []) for r in rows_in), default=0) or len(options)
    if n_cols == 0:
        return None

    # 自适应列宽：模板 P07 内部 g translate(300, ...) 后可用宽度约 820（1280-80*2-300 行 label 区）
    cell_gap = 4
    available_w = 820
    cell_w = max(48, min(140, (available_w - (n_cols - 1) * cell_gap) // n_cols))
    # 列数 > 5 时把列名再激进截断（48-100px 宽度只能容 4-6 个全角）
    label_max = 8 if cell_w >= 110 else (6 if cell_w >= 80 else 4)

    # 从主题 palette 取 heatmap 色 + 浅色文字色（深底用白、浅底用主文色）
    from . import charts
    theme = (data or {}).get("_theme") or "business"
    p = charts.get_palette(theme)
    cell_color = p.heatmap_color
    text_on_dark = "#FFFFFF"
    text_on_light = p.text_primary

    columns = []
    for ci in range(n_cols):
        label = options[ci] if ci < len(options) else f"列{ci + 1}"
        columns.append(
            {
                "X_CENTER": ci * (cell_w + cell_gap) + cell_w / 2,
                "LABEL": _truncate(label, label_max),
            }
        )

    rows = []
    for ri, r in enumerate(rows_in[:5]):
        values = r.get("values") or []
        total = sum(values) or 1
        cells = []
        for ci, v in enumerate(values):
            pct = v / total * 100
            cells.append(
                {
                    "X_OFFSET": ci * (cell_w + cell_gap),
                    "TEXT_X": ci * (cell_w + cell_gap) + cell_w / 2,
                    "PERCENT": f"{pct:.0f}",
                    "OPACITY": f"{0.25 + min(pct, 100) / 100 * 0.7:.2f}",
                    "COLOR": cell_color,
                    "TEXT_COLOR": text_on_dark if pct > 35 else text_on_light,
                }
            )
        rows.append(
            {
                "LABEL": _truncate(r.get("label", f"行 {ri + 1}"), 14),
                "VALUES": cells,
                "Y_OFFSET": ri * 70,
            }
        )
    return {
        "TITLE": q.get("title", "矩阵题"),
        "COLUMNS": columns,
        "ROWS": rows,
        "CELL_W": cell_w,  # 模板里 <rect width="{{CELL_W}}" .../> 用
    }


_OPEN_STOPWORDS = {
    "的", "了", "和", "是", "在", "我", "有", "也", "就", "都", "很", "不", "也是",
    "还", "但", "但是", "可以", "可能", "会", "把", "被", "让", "给", "对", "向", "从",
    "为", "以", "之", "等", "或", "而", "与", "及", "或者", "这", "那", "这个", "那个",
    "这些", "那些", "什么", "怎么", "如何", "为什么", "因为", "所以", "如果", "虽然",
    "然后", "比如", "例如", "目前", "现在", "已经", "正在", "一些", "一个", "一种",
    "进行", "通过", "需要", "应该", "可以", "希望", "感觉", "觉得", "认为", "建议",
    "提供", "做", "出", "去", "来", "上", "下", "里", "外", "中", "我们", "你们", "他们",
    "自己", "大家", "时候", "方面", "问题", "情况", "之后", "之前", "时间", "可以的",
    "the", "and", "is", "to", "a", "of", "in", "for", "on", "with", "at", "by",
}


def _segment_chinese(text: str) -> list[str]:
    """简易中文分词：优先 jieba，回退到 2-3 字符 N-gram 扫描。

    回退策略不如 jieba 精准，但够用：
    - 提取 ASCII 词作为整体（英文/数字）
    - 中文连续段切成滑动 bigram + trigram
    """
    try:
        import jieba  # type: ignore
        tokens = [t.strip() for t in jieba.cut(text) if t.strip()]
        return tokens
    except ImportError:
        pass

    tokens: list[str] = []
    # ASCII 整词
    for m in re.finditer(r"[A-Za-z][A-Za-z0-9_]+", text):
        tokens.append(m.group(0).lower())
    # 中文连续段
    for seg in re.findall(r"[一-鿿]+", text):
        n = len(seg)
        if n <= 1:
            continue
        # bigram
        for i in range(n - 1):
            tokens.append(seg[i:i+2])
        # trigram (更有信息量)
        for i in range(n - 2):
            tokens.append(seg[i:i+3])
    return tokens


def _extract_word_frequencies(texts: list[str], top_n: int = 30) -> list[tuple[str, int]]:
    """合并所有文本，分词、过滤停用词，返回 [(word, count)] 降序前 N。"""
    from collections import Counter

    counter: Counter[str] = Counter()
    for t in texts:
        if not t:
            continue
        for tok in _segment_chinese(str(t)):
            if len(tok) < 2:
                continue
            if tok in _OPEN_STOPWORDS:
                continue
            # 纯数字过滤
            if tok.isdigit():
                continue
            counter[tok] += 1

    # 去包含关系：如果 trigram 出现且其包含的 bigram 频次相同，优先 trigram
    items = sorted(counter.items(), key=lambda x: (-x[1], x[0]))

    # 过滤被更长词完全覆盖的 bigram
    selected: list[tuple[str, int]] = []
    chosen_set: set[str] = set()
    for word, cnt in items:
        # 若已存在更长且频次相同（或更高）的词包含本词，跳过
        covered = False
        for longer in chosen_set:
            if len(longer) > len(word) and word in longer and counter.get(longer, 0) >= cnt:
                covered = True
                break
        if covered:
            continue
        selected.append((word, cnt))
        chosen_set.add(word)
        if len(selected) >= top_n:
            break

    return selected


def _open_question_context(data: dict[str, Any]) -> dict[str, Any] | None:
    """P08 词云：合并所有开放题回答，提取 Top30 高频词，按 4 档字号布局。"""
    all_answers: list[str] = []
    for q in data.get("questions", []):
        if (q.get("type") or "").lower() == "text":
            all_answers.extend(q.get("open_answers") or [])
    if not all_answers:
        return None

    top = _extract_word_frequencies(all_answers, top_n=30)
    if not top:
        return None

    # 4 档：Top3 巨大 / 4-9 大 / 10-19 中 / 20-30 小
    # 各档独占一行/两行的栅格布局：
    #   Tier 1: Y=320, 字号 56，3 列居中
    #   Tier 2: Y=410, 字号 32，6 列居中
    #   Tier 3: Y=490 + Y=545, 字号 22，每行 10 列
    words_ctx: list[dict[str, Any]] = []
    chart_x_start = 80
    chart_w = 1120

    def _place_row(items: list[tuple[str, int]], y: int, font_size: int, opacity: float):
        n = len(items)
        if n == 0:
            return
        slot_w = chart_w / n
        for i, (w, c) in enumerate(items):
            cx = chart_x_start + slot_w * (i + 0.5)
            words_ctx.append({
                "TEXT": w,
                "X": f"{cx:.1f}",
                "Y": str(y),
                "SIZE": str(font_size),
                "OPACITY": f"{opacity:.2f}",
                "COUNT": str(c),
            })

    tier1 = top[:3]
    tier2 = top[3:9]
    tier3a = top[9:19]
    tier3b = top[19:29]

    _place_row(tier1, y=320, font_size=56, opacity=1.0)
    _place_row(tier2, y=410, font_size=32, opacity=0.92)
    _place_row(tier3a, y=485, font_size=22, opacity=0.78)
    _place_row(tier3b, y=540, font_size=22, opacity=0.65)

    sample_n = sum(1 for a in all_answers if a)
    return {
        "TITLE": "用户原声 · 高频词云",
        "WORDS": words_ctx,
        "SAMPLE_N": str(sample_n),
        "WORD_N": str(len(top)),
    }


def _insights_context(data: dict[str, Any]) -> dict[str, Any]:
    insights = data.get("ai_insights") or _generate_insights(data)
    # P09 卡片宽 1120/字号 20，混排（ASCII 计半角）实测约 54 字安全
    return {
        "TITLE": "关键洞察",
        "INSIGHTS": [
            {
                "INDEX": i + 1,
                "TEXT": _truncate(s, 54),
                "Y_OFFSET": 280 + i * 130,
            }
            for i, s in enumerate(insights[:3])
        ],
    }


def _nps_rating(score: float) -> str:
    if score < 0:
        return "警示"
    if score < 30:
        return "一般"
    if score < 50:
        return "良好"
    if score < 70:
        return "优秀"
    return "卓越"


def _nps_count(group: Any) -> int | None:
    """从 {count, ratio} 字典里取 count；裸值时返回 None。"""
    if isinstance(group, dict):
        c = group.get("count")
        try:
            return int(c) if c is not None else None
        except (TypeError, ValueError):
            return None
    return None


def _generate_insights(data: dict[str, Any]) -> list[str]:
    """规则引擎：按优先级评分从 8 个候选规则里挑前 3 条最有信息量的洞察。

    规则编号 + 优先级（数字越大越优先）：
      R1  NPS 区间 + 行业参考对照     (90)  - 有 NPS 必出
      R2  NPS-CSAT 一致性矛盾警告      (88)  - 两者都有且打架时出
      R3  数据零值警告（CSAT 0/100%） (85)  - 极端值时出
      R4  NPS 结构信号（贬/中/推占比） (85)  - 有 NPS 必出
      R5  CSAT 等级评价                (80)  - 有 CSAT 必出
      R6  评分题异常分布（双峰/极端）   (75)  - 量表/CSAT 题出现异常时出
      R7  单选 Top1 落差分析           (70)  - 有单选题时出
      R8  矩阵最低维度警告              (65)  - 有矩阵题时出
      F1  样本量警示                   (50/40)
      F2  完成率诊断                   (45/25)
      F3  题量负担                     (30)
      F4  通用兜底                     (10)

    Agent 路径：本规则引擎是 staged workflow 的回退；正式交付场景下 Agent
    应该读 data.json 自己写更好的洞察到 outline.json 的 ai_insights。
    """
    candidates: list[tuple[int, str]] = []
    nps = data.get("analytics", {}).get("nps")
    csat_list = data.get("analytics", {}).get("csat") or []
    questions = data.get("questions") or []
    r = data.get("response", {})
    total = int(r.get("total", 0) or 0)
    rate = _completion_rate(r)

    if nps:
        candidates.append((90, _insight_nps_region(nps)))
        s = _insight_nps_structure(nps, total)
        if s:
            candidates.append((85, s))

    if nps and csat_list:
        s = _insight_nps_csat_consistency(nps, csat_list[0])
        if s:
            candidates.append((88, s))

    if csat_list:
        c = csat_list[0]
        ratio = c.get("csat")
        if ratio is not None and ratio in (0, 1, 0.0, 1.0):
            candidates.append((85, _insight_csat_zero_or_full(float(ratio))))
        s = _insight_csat_level(c)
        if s:
            candidates.append((80, s))

    for q in questions:
        if q.get("scale_type") in ("nps_0_10", "csat_1_5", "csat_1_7"):
            s = _insight_distribution_shape(q)
            if s:
                candidates.append((75, s))
                break

    singles = [q for q in questions if (q.get("type") or "") == "single" and q.get("distribution")]
    if singles:
        s = _insight_single_top_gap(singles[0])
        if s:
            candidates.append((70, s))

    matrices = [q for q in questions if (q.get("type") or "") == "matrix" and q.get("distribution")]
    if matrices:
        s = _insight_matrix_lowest(matrices[0])
        if s:
            candidates.append((65, s))

    if total and total < 30:
        candidates.append((50, f"样本量 {total} 份偏小，结论置信区间较宽，建议扩大至 30+ 后复核数据趋势。"))
    elif total >= 100:
        candidates.append((40, f"样本量 {total} 份充足，统计推断置信度较高，可作为决策依据。"))

    if rate and rate < 70:
        candidates.append((45, f"问卷完成率 {rate:.0f}% 偏低，问卷长度或难度可能给受访者带来负担，建议精简题目。"))
    elif rate >= 95:
        candidates.append((25, f"问卷完成率 {rate:.0f}%，问卷设计负担合理，可在下一轮维持当前题量结构。"))

    if len(questions) >= 20:
        candidates.append((30, f"问卷有 {len(questions)} 道题，体量偏大，建议下一轮考虑分页或抽样以降低用户负担。"))

    # 按优先级降序去重取前 3
    candidates.sort(key=lambda x: -x[0])
    out: list[str] = []
    seen: set[str] = set()
    for _, text in candidates:
        if text in seen:
            continue
        seen.add(text)
        out.append(text)
        if len(out) >= 3:
            break

    while len(out) < 3:
        out.append("可在下一轮调查中扩大样本并对比本次发现的趋势变化。")

    return out[:3]


# ---------- 洞察规则单元（每条独立可测）----------


def _insight_nps_region(nps: dict[str, Any]) -> str:
    score = int(nps.get("score", nps.get("value", 0)) or 0)
    diff = score - _CN_NPS_BENCHMARK
    if abs(diff) <= 5:
        cmp_str = f"接近中国市场参考值（约 {_CN_NPS_BENCHMARK}）"
    elif diff > 0:
        cmp_str = f"高于中国市场参考值约 {diff} 分"
    else:
        cmp_str = f"低于中国市场参考值约 {-diff} 分"

    if score < 0:
        return f"NPS {score} 处于负区间，{cmp_str}，需立即排查体验链路。"
    elif score < 30:
        gap = 30 - score
        return f"NPS {score}，0–30 一般区间，距良好仅 {gap} 分；{cmp_str}。"
    elif score < 50:
        gap = 50 - score
        return f"NPS {score}，30–50 良好区间，距优秀尚有 {gap} 分；{cmp_str}。"
    elif score < 70:
        return f"NPS {score}，50–70 优秀区间；{cmp_str}，已超行业多数同行。"
    else:
        return f"NPS {score}，卓越区间（>70）；{cmp_str}，重点是保持口碑。"


def _insight_nps_structure(nps: dict[str, Any], total: int) -> str | None:
    det = _pct(nps.get("detractors"))
    prom = _pct(nps.get("promoters"))
    passive = _pct(nps.get("passives"))
    nps_total = int(nps.get("total") or total or 0)
    det_n = _nps_count(nps.get("detractors"))
    det_str = f"（{det_n}/{nps_total}）" if det_n is not None and nps_total else ""

    if det >= 0.30:
        return f"贬损者占比 {int(det*100)}%{det_str} 偏高，建议优先回访其打分原因找出共性问题。"
    elif det >= 0.10:
        return f"贬损者占比 {int(det*100)}%{det_str}，高于行业 10% 健康基线，建议回访低分用户分析归因。"
    elif passive >= 0.40:
        lift = int(round(100 / nps_total)) if nps_total else 11
        return f"中立用户占比 {int(passive*100)}% 较高，每多转化 1 位为推荐者可推升 NPS 约 {lift} 分。"
    elif prom >= 0.60:
        return f"推荐者占比 {int(prom*100)}% 已具规模，可设计推荐激励机制放大现有口碑。"
    return None


def _insight_nps_csat_consistency(nps: dict[str, Any], csat: dict[str, Any]) -> str | None:
    """NPS 和 CSAT 都存在时检查一致性。矛盾时强烈警告（vid=199802 就是典型矛盾）。"""
    score = int(nps.get("score", 0) or 0)
    ratio = csat.get("csat")
    if ratio is None:
        return None
    csat_pct = float(ratio) * 100

    # 高 NPS + 低 CSAT 矛盾
    if score >= 30 and csat_pct < 60:
        return f"NPS {score}（良好）与 CSAT {csat_pct:.0f}%（偏低）相互矛盾，疑似问卷设计或样本口径问题，建议核对数据真实性。"
    # 负 NPS + 高 CSAT 矛盾
    if score < 0 and csat_pct >= 80:
        return f"NPS {score}（负值）与 CSAT {csat_pct:.0f}%（高满意）相互矛盾，可能是不同维度评价，建议分维度独立分析。"
    return None


def _insight_csat_zero_or_full(ratio: float) -> str:
    if ratio == 0:
        return "CSAT 为 0%，无任何用户给出满意评价，强烈建议核对样本来源与问卷投放渠道的真实性。"
    return "CSAT 为 100%，所有用户都满意，需核对样本是否经过筛选（理想数据通常意味着选择性参与）。"


def _insight_csat_level(csat: dict[str, Any]) -> str | None:
    ratio = csat.get("csat")
    if ratio is None:
        v = csat.get("value", 0)
        csat_pct = float(v)
    else:
        csat_pct = float(ratio) * 100
    # 边界 0/100 已被 _insight_csat_zero_or_full 覆盖，这里只处理中间值
    if csat_pct in (0, 100):
        return None
    if csat_pct < 60:
        return f"客户满意度 {csat_pct:.0f}% 低于警戒线（60%），需诊断主要不满点并制定整改计划。"
    elif csat_pct < 80:
        return f"客户满意度 {csat_pct:.0f}% 处于一般水平，存在显著改进空间，建议聚焦中评用户访谈。"
    else:
        return f"客户满意度 {csat_pct:.0f}% 表现良好，建议通过深度访谈识别促成满意的关键因素。"


def _insight_single_top_gap(q: dict[str, Any]) -> str | None:
    """单选 Top1 占比 + Top1 vs Top2 落差，反映用户偏好的集中度。"""
    dist = q.get("distribution") or []
    if len(dist) < 2:
        return None
    sorted_dist = sorted(dist, key=lambda d: -(d.get("count", 0) or 0))
    total = sum(d.get("count", 0) or 0 for d in dist) or 1
    top1_pct = (sorted_dist[0].get("count", 0) or 0) / total * 100
    top2_pct = (sorted_dist[1].get("count", 0) or 0) / total * 100
    gap = top1_pct - top2_pct
    label1 = (sorted_dist[0].get("label", "") or "")[:14]
    title = (q.get("title", "") or "首项单选")[:14]

    if top1_pct >= 60:
        return f"「{title}」选项「{label1}」占比 {top1_pct:.0f}% 高度集中，体现明显倾向。"
    elif gap >= 20:
        return f"「{title}」选项「{label1}」领先第二名 {gap:.0f} 个百分点，倾向较明显。"
    elif top1_pct < 30:
        return f"「{title}」无明显倾向，Top 选项仅占 {top1_pct:.0f}%，用户偏好分散。"
    return None


def _insight_matrix_lowest(q: dict[str, Any]) -> str | None:
    """矩阵题各行加权平均，找最低维度作为改进重点。"""
    rows_in = q.get("distribution") or []
    if not rows_in:
        return None
    row_means: list[tuple[str, float]] = []
    for r in rows_in:
        values = r.get("values") or []
        if not values:
            continue
        row_total = sum(values) or 1
        score_sum = sum((j + 1) * v for j, v in enumerate(values))
        row_means.append((r.get("label", "") or "", score_sum / row_total))
    if len(row_means) < 2:
        return None
    row_means.sort(key=lambda x: x[1])
    lowest_label, lowest_score = row_means[0]
    highest_label, highest_score = row_means[-1]
    gap = highest_score - lowest_score
    title = (q.get("title", "") or "矩阵题")[:14]

    if gap >= 0.5:
        return f"「{title}」中「{lowest_label}」评分最低（{lowest_score:.2f}），与最高「{highest_label}」（{highest_score:.2f}）拉开差距，是改进重点。"
    return None


def _insight_distribution_shape(q: dict[str, Any]) -> str | None:
    """评分题分布形态检测：双峰、极端集中。"""
    dist = q.get("distribution") or []
    if len(dist) < 4:
        return None
    counts = [d.get("count", 0) or 0 for d in dist]
    total = sum(counts)
    if total == 0:
        return None

    n = len(counts)
    left_third = sum(counts[:n // 3]) / total
    middle_third = sum(counts[n // 3:2 * n // 3]) / total
    right_third = sum(counts[2 * n // 3:]) / total
    title = (q.get("title", "") or "评分题")[:14]

    # 双峰：两端各 ≥ 30%、中间 < 20%
    if left_third > 0.30 and right_third > 0.30 and middle_third < 0.20:
        return f"「{title}」评分呈双峰分布（两端各 30%+），存在两类截然不同的用户群体，建议分群分析。"

    # 极端集中：单一选项 ≥ 70%
    max_pct = max(counts) / total
    if max_pct >= 0.70:
        max_idx = counts.index(max(counts))
        max_label = (dist[max_idx].get("label", "") or "某项")
        return f"「{title}」{max_pct*100:.0f}% 集中在「{max_label}」，分布极不均匀，可能存在样本偏倚或题目引导。"
    return None


def _appendix_context(data: dict[str, Any]) -> dict[str, Any]:
    s = data.get("survey", {})
    return {
        "TITLE": "附录",
        "VID": s.get("vid", ""),
        "URL": s.get("url") or "—",
        "DATE": _today(),
    }


# ---------- 通用辅助 ----------


def _bar_chart_context(q: dict[str, Any], data: dict[str, Any] | None = None) -> dict[str, Any]:
    """单选/多选条形图 → P04/P05 模板 context。

    BAR_COLOR 从主题 palette 取：Top1 用 bar_top、其它用 bar_primary。
    不再用 url(#barFillTop) 渐变（之前批量去渐变时被清掉，引起柱状条 fill 失败）。
    """
    from . import charts
    theme = (data or {}).get("_theme") or "business"
    p = charts.get_palette(theme)
    bar_top_color = p.bar_top
    bar_primary_color = p.bar_primary

    dist = q.get("distribution") or []
    options = q.get("options") or []
    total = sum((d.get("count", 0) for d in dist), 0) or 1
    max_count = max((d.get("count", 0) for d in dist), default=1) or 1
    bar_max = 1120
    rows = []
    sorted_dist = sorted(enumerate(dist), key=lambda x: x[1].get("count", 0), reverse=True)
    # 取前 5 条，超出 5 条合并为"其他"
    top = sorted_dist[:5]
    rest = sorted_dist[5:]
    if rest:
        rest_count = sum(d.get("count", 0) for _, d in rest)
        top.append((-1, {"label": f"其他（{len(rest)}项）", "count": rest_count}))
    for rank, (orig_i, d) in enumerate(top):
        if orig_i == -1:
            label = d.get("label", "其他")
        else:
            label = d.get("label") or (options[orig_i] if orig_i < len(options) else f"选项{orig_i + 1}")
        count = d.get("count", 0)
        rows.append(
            {
                "LABEL": _truncate(label, 28),
                "COUNT": count,
                "PERCENT": f"{count / total * 100:.1f}",
                "BAR_WIDTH": int(count / max_count * bar_max),
                "BAR_COLOR": bar_top_color if rank == 0 else bar_primary_color,
                "Y_OFFSET": rank * 72,
            }
        )
    return {
        "TITLE": q.get("title", "分布"),
        "TOTAL": total,
        "ROWS": rows,
    }


def _auto_findings(data: dict[str, Any]) -> list[str]:
    """P02 执行摘要按数据形态走 4 套优先级。

    形态判别（按优先级）：
      A. 有 NPS    → NPS 报告：[回收 / NPS 评级 / 三类用户结构]
      B. 有 CSAT   → 满意度报告：[回收 / CSAT 总分 / 满意比例]
      C. 纯单/多选 → 普查报告：[回收 / Top 选项亮点 / 题型构成]
      D. 全文本    → 开放调研：[回收 / 文本题数量 / 平均文本长度]

    Agent 路径：本规则引擎是 staged workflow 的回退；正式交付场景下 Agent
    应该读 data.json 自己写更好的事实摘要到 outline.json 的 ai_findings。
    """
    out: list[str] = []
    r = data.get("response", {})
    total = int(r.get("total", 0) or 0)
    rate = _completion_rate(r)
    out.append(f"回收 {total} 份答卷，完成率 {rate:.0f}%。")

    nps = data.get("analytics", {}).get("nps")
    csat_list = data.get("analytics", {}).get("csat") or []
    questions = data.get("questions") or []

    if nps:
        # 形态 A: NPS 报告
        score = int(nps.get("score", nps.get("value", 0)) or 0)
        rating = nps.get("rating") or _nps_rating(score)
        out.append(f"NPS 净推荐值 {score}，评级「{rating}」。")
        prom = int(_pct(nps.get("promoters")) * 100)
        det = int(_pct(nps.get("detractors")) * 100)
        passive = int(_pct(nps.get("passives")) * 100)
        out.append(f"推荐者 {prom}% / 中立 {passive}% / 贬损 {det}%。")
    elif csat_list:
        # 形态 B: CSAT 报告
        c = csat_list[0]
        ratio = c.get("csat")
        csat_pct = float(ratio) * 100 if ratio is not None else float(c.get("value", 0))
        out.append(f"客户满意度 CSAT {csat_pct:.0f}%。")
        sat = c.get("satisfiedCount") or 0
        ctotal = c.get("total") or 0
        if ctotal:
            out.append(f"满意（4–5 分）样本 {sat}/{ctotal}。")
    elif any((q.get("type") or "") in ("single", "multi") for q in questions):
        # 形态 C: 普查报告（无 NPS/CSAT 但有结构化题）
        singles = [q for q in questions if (q.get("type") or "") == "single" and q.get("distribution")]
        if singles:
            s_q = singles[0]
            dist = s_q.get("distribution") or []
            sorted_dist = sorted(dist, key=lambda d: -(d.get("count", 0) or 0))
            top = sorted_dist[0]
            tot = sum((d.get("count", 0) or 0) for d in dist) or 1
            top_pct = (top.get("count", 0) or 0) / tot * 100
            title = (s_q.get("title", "") or "首项")[:10]
            top_lbl = (top.get("label", "") or "")[:10]
            out.append(f"「{title}」中「{top_lbl}」占比 {top_pct:.0f}%，为最受关注选项。")
        n_single = sum(1 for q in questions if (q.get("type") or "") == "single")
        n_multi = sum(1 for q in questions if (q.get("type") or "") == "multi")
        n_matrix = sum(1 for q in questions if (q.get("type") or "") == "matrix")
        parts = []
        if n_single:
            parts.append(f"{n_single} 单选")
        if n_multi:
            parts.append(f"{n_multi} 多选")
        if n_matrix:
            parts.append(f"{n_matrix} 矩阵")
        out.append("含 " + " / ".join(parts) + "，回答可定量统计。")
    else:
        # 形态 D: 开放/文本调研
        text_qs = [q for q in questions if (q.get("type") or "") == "text"]
        n_text = len(text_qs)
        if n_text:
            out.append(f"含 {n_text} 道开放题，回答以文本为主。")
            samples = [a for q in text_qs for a in (q.get("open_answers") or [])]
            if samples:
                avg_len = sum(len(a) for a in samples) / len(samples)
                out.append(f"开放题样本 {len(samples)} 条，平均长度 {avg_len:.0f} 字，需 AI 归类主题后呈现。")

    if len(out) < 3:
        out.append(f"共 {len(questions)} 道题，详见后续页面分项数据。")

    while len(out) < 3:
        out.append("详见后续页面分项数据。")

    return out[:3]


def _completion_rate(r: dict[str, Any]) -> float:
    total = r.get("total", 0)
    completed = r.get("completed", 0)
    return (completed / total * 100) if total else 0.0


def _today() -> str:
    from datetime import date

    return date.today().strftime("%Y-%m-%d")


def _truncate(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 1] + "…"


# ---------- 模板渲染引擎 ----------


_LIST_RE = re.compile(r"\{\{#(\w+)\}\}(.*?)\{\{/\1\}\}", re.DOTALL)
_COND_RE = re.compile(r"\{\{\?(\w+)\}\}(.*?)\{\{/\1\}\}", re.DOTALL)
_VAR_RE = re.compile(r"\{\{(\w+)\}\}")


def _render_svg(template: str, ctx: dict[str, Any]) -> str:
    """简化版 mustache：先消化条件块，再展开列表，最后替换变量。"""

    # 条件块：值假则删除
    def cond_sub(m: re.Match[str]) -> str:
        key, body = m.group(1), m.group(2)
        return body if ctx.get(key) else ""

    template = _COND_RE.sub(cond_sub, template)

    # 列表展开
    def list_sub(m: re.Match[str]) -> str:
        key, body = m.group(1), m.group(2)
        items = ctx.get(key) or []
        if not isinstance(items, list):
            return ""
        return "".join(_render_svg(body, {**ctx, **item}) for item in items)

    template = _LIST_RE.sub(list_sub, template)

    # 变量替换
    def var_sub(m: re.Match[str]) -> str:
        key = m.group(1)
        val = ctx.get(key, "")
        return _xml_escape(val)

    return _VAR_RE.sub(var_sub, template)


def _xml_escape(val: Any) -> str:
    if val is None:
        return ""
    s = str(val)
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
