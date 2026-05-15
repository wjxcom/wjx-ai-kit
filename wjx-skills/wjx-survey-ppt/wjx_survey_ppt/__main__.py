"""Entry point for `python -m wjx_survey_ppt`.

支持两种使用模式：

**一步法（默认，向后兼容）**：
    --vid <id>             从问卷 ID 一气呵成生成 PPT
    --data-file <path>     从已有 JSON 数据一气呵成生成 PPT

**分步法（推荐用于正式交付，每步可让 Agent + 用户介入修改）**：
    --stage data           Layer 1：拉数据 → workdir/data.json，立即退出
    --stage outline        基于 data.json 生成 workdir/outline.json（页面清单 + 默认标题）
    --stage preview        基于 outline.json 渲染封面 + 一张代表图为 SVG 样章
    --stage final          基于 outline.json + data.json 生成完整 PPT
    --inspect-outline      诊断 outline.json 完整度（哪些页有 AI 解读、哪些是空）

各 stage 之间，Agent 应当读取中间产物（data.json / outline.json）注入 AI 解读、
让用户确认后才进入下一阶段。Agent 可以编辑 outline.json 的 include/order/title/ai_summary 字段。

**强制 invariant**：Stage 4 (final) 默认会拒绝跑没注入 AI 解读的 outline，
避免"分步法跟一步法输出一样"的脱钩 bug。要强行跑加 --skip-ai-check。

通用选项：
    --check                只做依赖检查
    --plan-only             只生成 SVG 不渲染 PPTX（调试用）
    --workdir <path>       中间产物目录（默认 ./survey-ppt-workdir）
    --output <path>        PPTX 输出路径（默认 <workdir>/output.pptx）
    --theme <name>         主题（business/warm/minimal/soft/consulting/tech-dark/editorial/gov-red）
    --skip-ai-check        分步 final 阶段不强制检查 AI 解读（用于 batch 自动化场景）
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from .check import run_check
from .fetch_survey import fetch_from_vid
from .build_project import build_svg_project, build_outline, apply_outline, data_signature, list_themes
from .render_ppt import render_pptx


_VALID_STAGES = ("data", "outline", "preview", "final")


def main() -> int:
    parser = argparse.ArgumentParser(prog="wjx_survey_ppt")
    parser.add_argument("--vid", help="问卷 ID（路径 A）")
    parser.add_argument("--data-file", help="已有 JSON 数据（路径 B，跳过 Layer 1）")
    parser.add_argument("--check", action="store_true", help="只做依赖检查")
    parser.add_argument(
        "--stage",
        choices=_VALID_STAGES,
        help="分步模式：data→outline→preview→final，每步可让 agent 介入修改中间产物",
    )
    parser.add_argument(
        "--inspect-outline", action="store_true",
        help="诊断 outline.json 状态：哪些页含 AI 解读、哪些是空、当前主题",
    )
    parser.add_argument(
        "--fetch-only", action="store_true",
        help="向后兼容旧用法，等价于 --stage data",
    )
    parser.add_argument("--plan-only", action="store_true", help="只生成 SVG 不渲染")
    parser.add_argument(
        "--skip-ai-check", action="store_true",
        help="--stage final 不强制检查 AI 解读注入完整度（batch 自动化用）",
    )
    parser.add_argument("--workdir", default="./survey-ppt-workdir")
    parser.add_argument("--output")
    parser.add_argument(
        "--theme",
        default="business",
        help=f"模板主题（可用：{', '.join(list_themes()) or 'business'}）",
    )
    args = parser.parse_args()

    if args.check:
        return run_check()

    workdir = Path(args.workdir).resolve()
    workdir.mkdir(parents=True, exist_ok=True)
    data_path = workdir / "data.json"
    outline_path = workdir / "outline.json"

    # === --inspect-outline（诊断子命令）===
    if args.inspect_outline:
        return _inspect_outline(outline_path)

    # 兼容 --fetch-only
    stage = args.stage or ("data" if args.fetch_only else None)

    # === Stage: data（拉数据落地）===
    if stage == "data":
        if not args.vid and not args.data_file:
            print("错误：--stage data 需要 --vid 或 --data-file", file=sys.stderr)
            return 2
        data = _load_data(args, workdir)
        _write_json(data_path, data)
        n_q = len(data.get("questions", []))
        n_resp = data.get("response", {}).get("total", 0)
        print(f"[stage=data] 数据已落 {data_path}（{n_q} 题 / {n_resp} 答卷）")
        print()
        print("─── AGENT 视角下一步 ──────────────────────────────────")
        print("  1. 读 data.json，理解问卷主题、题型、关键指标")
        print("  2. 跟用户确认要做大纲（询问主题倾向：business / warm / minimal / soft / consulting / tech-dark / editorial / gov-red）")
        print(f"  3. 跑：python -m wjx_survey_ppt --workdir {workdir} --stage outline --theme <选定主题>")
        print()
        return 0

    # === Stage: outline（基于已有 data.json 生成大纲）===
    if stage == "outline":
        if not data_path.exists():
            print(f"错误：缺 {data_path}，请先跑 --stage data", file=sys.stderr)
            return 2
        data = json.loads(data_path.read_text(encoding="utf-8"))
        outline = build_outline(data, theme=args.theme)
        _write_json(outline_path, outline)
        print(f"[stage=outline] 大纲已落 {outline_path}（{len(outline['pages'])} 页骨架）")
        print()
        print("─── AGENT 视角下一步（关键节点，不可跳过）──────────────")
        print(f"  1. 读 {data_path}，提取关键事实（NPS 值、CSAT、Top 选项、矩阵最低维度等）")
        print(f"  2. 编辑 {outline_path}：")
        print(f"     · 给 P02_Executive_Summary 页填 ai_findings: 3 条事实摘要（≤56 字/条）")
        print(f"     · 给 P09_Insights 页填 ai_insights: 3 条洞察+建议（≤54 字/条）")
        print(f"     · 给每个 chart 页（P04/P05/P06/P07/P11）填 ai_summary: 1 条解读（≤76 字）")
        print(f"     · 跳过不需要的页：把 include 改 false")
        print(f"     · 改顺序：直接调整 pages 数组顺序")
        print(f"     · 换主题：改顶层 theme 字段")
        print(f"  3. 让用户确认大纲清单（include/order/theme）")
        print(f"  4. 自检：python -m wjx_survey_ppt --workdir {workdir} --inspect-outline")
        print(f"  5. 全部 OK 后跑：python -m wjx_survey_ppt --workdir {workdir} --stage preview")
        print()
        print("⚠ 跳过 AI 解读注入会导致最终 PPT 跟一步法（默认规则引擎）输出一样。")
        return 0

    # === Stage: preview（渲染封面 + 一张代表图作为样章）===
    if stage == "preview":
        if not data_path.exists():
            print(f"错误：缺 {data_path}", file=sys.stderr)
            return 2
        data = json.loads(data_path.read_text(encoding="utf-8"))
        outline = json.loads(outline_path.read_text(encoding="utf-8")) if outline_path.exists() else None
        # 临时 project 跑一次 build，再挑出代表性 SVG 复制到 preview/
        project_dir = workdir / "project"
        if outline:
            data_with_outline = apply_outline(data, outline)
            theme = outline.get("theme", args.theme)
        else:
            data_with_outline = data
            theme = args.theme
        pages = build_svg_project(data_with_outline, project_dir, theme=theme)
        preview_dir = workdir / "preview"
        preview_dir.mkdir(parents=True, exist_ok=True)
        for keyword in ("Cover", "Scale", "Single", "Multi", "Matrix", "NPS_Cross"):
            for f in sorted((project_dir / "svg_final").glob(f"*{keyword}*.svg")):
                shutil.copy2(f, preview_dir / f.name)
                break
        copied = sorted(preview_dir.glob("*.svg"))
        print(f"[stage=preview] {len(copied)} 张样章 SVG 落在 {preview_dir}（主题 {theme}）")
        for f in copied:
            print(f"  - {f.name}")
        print()
        print("─── AGENT 视角下一步 ──────────────────────────────────")
        print(f"  1. 让用户在浏览器/AI 客户端打开样章 SVG，看主题色调和版式是否合适")
        print(f"  2. 不合适 → 编辑 {outline_path} 的 theme 字段，回头重跑 preview")
        print(f"  3. 合适 → 跑：python -m wjx_survey_ppt --workdir {workdir} --stage final")
        print()
        return 0

    # === Stage: final（基于 outline 生成完整 PPT）===
    if stage == "final":
        if not data_path.exists():
            print(f"错误：缺 {data_path}", file=sys.stderr)
            return 2
        data = json.loads(data_path.read_text(encoding="utf-8"))
        stale_signature = data_signature(data)
        refreshed = False
        vid = (data.get("survey") or {}).get("vid")
        if vid and not args.data_file:
            data = fetch_from_vid(str(vid), workdir)
            _write_json(data_path, data)
            refreshed = True
            n_q = len(data.get("questions", []))
            n_resp = data.get("response", {}).get("total", 0)
            print(f"[stage=final] 已刷新最新数据（{n_q} 题 / {n_resp} 答卷）")
        outline = None
        theme = args.theme
        if outline_path.exists():
            outline = json.loads(outline_path.read_text(encoding="utf-8"))
            theme = outline.get("theme", args.theme)
            if (
                refreshed
                and _outline_is_stale_after_refresh(outline, stale_signature, data_signature(data))
                and not args.skip_ai_check
            ):
                print("错误：最终生成前已刷新到最新数据，但 outline.json 的 AI 解读基于旧数据。", file=sys.stderr)
                print(f"  · 最新 data.json 已覆盖到 {data_path}", file=sys.stderr)
                print(f"  · 请基于最新 data.json 重新生成/更新 outline.json 后再运行 final", file=sys.stderr)
                print(f"  · 若已人工确认旧解读仍适用，可加 --skip-ai-check 强制生成", file=sys.stderr)
                return 4
            # === Invariant：Stage final 必须有 AI 解读注入 ===
            if not args.skip_ai_check:
                report = _ai_completeness_report(outline)
                if report["missing_total"] > 0:
                    print(f"错误：outline.json 有 {report['missing_total']} 处 AI 解读未注入：", file=sys.stderr)
                    if not report["has_findings"]:
                        print(f"  · P02 ai_findings 为空（应填 3 条事实摘要）", file=sys.stderr)
                    if not report["has_insights"]:
                        print(f"  · P09 ai_insights 为空（应填 3 条洞察+建议）", file=sys.stderr)
                    for name in report["pages_missing_summary"][:5]:
                        print(f"  · {name} 缺 ai_summary", file=sys.stderr)
                    if len(report["pages_missing_summary"]) > 5:
                        print(f"  · 还有 {len(report['pages_missing_summary']) - 5} 页缺 ai_summary", file=sys.stderr)
                    print(file=sys.stderr)
                    print(f"分步法的价值在 AI 解读差异化。注入完毕后重试，或加 --skip-ai-check 强行跑。", file=sys.stderr)
                    print(f"诊断详情：python -m wjx_survey_ppt --workdir {workdir} --inspect-outline", file=sys.stderr)
                    return 3
            data = apply_outline(data, outline)
        return _do_final(data, workdir, theme, args.output, args.plan_only)

    # === 不指定 --stage：一步法（向后兼容）===
    if not args.vid and not args.data_file:
        print("错误：必须提供 --vid 或 --data-file（一步法），或 --stage（分步法）", file=sys.stderr)
        return 2
    data = _load_data(args, workdir)
    _write_json(data_path, data)
    return _do_final(data, workdir, args.theme, args.output, args.plan_only)


def _load_data(args: argparse.Namespace, workdir: Path) -> dict:
    if args.vid:
        return fetch_from_vid(args.vid, workdir)
    data_path = Path(args.data_file).resolve()
    return json.loads(data_path.read_text(encoding="utf-8"))


def _write_json(path: Path, obj: dict) -> None:
    path.write_text(
        json.dumps(obj, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _do_final(data: dict, workdir: Path, theme: str, output_arg: str | None, plan_only: bool) -> int:
    project_dir = workdir / "project"
    pages = build_svg_project(data, project_dir, theme=theme)
    print(f"[SVG] 已生成 {len(pages)} 页（主题 {theme}）→ {project_dir / 'svg_final'}")
    if plan_only:
        return 0
    output = Path(output_arg).resolve() if output_arg else workdir / "output.pptx"
    render_pptx(project_dir, output)
    size_kb = output.stat().st_size // 1024
    print(f"[PPTX] 已生成 {len(pages)} 页、{size_kb}KB → {output}")
    return 0


def _ai_completeness_report(outline: dict) -> dict:
    """统计 outline 里 AI 解读注入完整度。"""
    pages = outline.get("pages", [])
    has_findings = False
    has_insights = False
    pages_with_summary: list[str] = []
    pages_missing_summary: list[str] = []
    chart_page_types = {"single", "multi", "scale", "matrix", "nps_cross"}

    for p in pages:
        if not p.get("include", True):
            continue
        if p.get("type") == "exec_summary":
            findings = p.get("ai_findings") or []
            has_findings = bool(findings) and any((s or "").strip() for s in findings)
        elif p.get("type") == "insights":
            insights = p.get("ai_insights") or []
            has_insights = bool(insights) and any((s or "").strip() for s in insights)
        elif p.get("type") in chart_page_types:
            s = (p.get("ai_summary") or "").strip()
            if s:
                pages_with_summary.append(p["name"])
            else:
                pages_missing_summary.append(p["name"])

    missing_total = (
        (0 if has_findings else 1)
        + (0 if has_insights else 1)
        + len(pages_missing_summary)
    )
    return {
        "has_findings": has_findings,
        "has_insights": has_insights,
        "pages_with_summary": pages_with_summary,
        "pages_missing_summary": pages_missing_summary,
        "missing_total": missing_total,
        "total_chart_pages": len(pages_with_summary) + len(pages_missing_summary),
    }


def _outline_is_stale_after_refresh(
    outline: dict,
    stale_data_signature: str,
    fresh_data_signature: str,
) -> bool:
    outline_signature = outline.get("_data_signature")
    if outline_signature:
        return outline_signature != fresh_data_signature
    return stale_data_signature != fresh_data_signature and _outline_contains_ai_text(outline)


def _outline_contains_ai_text(outline: dict) -> bool:
    for p in outline.get("pages", []):
        values = [
            *(p.get("ai_findings") or []),
            *(p.get("ai_insights") or []),
            p.get("ai_summary") or "",
        ]
        if any(str(v).strip() for v in values):
            return True
    return False


def _inspect_outline(outline_path: Path) -> int:
    """诊断 outline.json：哪些页含 AI 解读、哪些是空、当前主题。"""
    if not outline_path.exists():
        print(f"错误：找不到 {outline_path}（先跑 --stage outline）", file=sys.stderr)
        return 2
    outline = json.loads(outline_path.read_text(encoding="utf-8"))
    theme = outline.get("theme", "(未设)")
    pages = outline.get("pages", [])
    n_total = len(pages)
    n_included = sum(1 for p in pages if p.get("include", True))
    n_skipped = n_total - n_included

    report = _ai_completeness_report(outline)

    print(f"📋 Outline 诊断: {outline_path}")
    print(f"  主题: {theme}")
    print(f"  页数: {n_total} 总（{n_included} 启用 / {n_skipped} 跳过）")
    print()
    print(f"AI 解读注入完整度:")
    print(f"  P02 ai_findings: {'✓ 已填' if report['has_findings'] else '✗ 空'}")
    print(f"  P09 ai_insights: {'✓ 已填' if report['has_insights'] else '✗ 空'}")
    print(f"  Chart 页 ai_summary: {len(report['pages_with_summary'])}/{report['total_chart_pages']} 页已填")
    if report["pages_with_summary"]:
        print(f"    ✓ 已填: {', '.join(report['pages_with_summary'])}")
    if report["pages_missing_summary"]:
        print(f"    ✗ 缺: {', '.join(report['pages_missing_summary'])}")
    print()
    if report["missing_total"] == 0:
        print(f"✅ 所有 AI 解读已注入，可以跑 --stage final 出 PPT。")
        return 0
    else:
        print(f"⚠ 共 {report['missing_total']} 处未注入。Stage final 默认会拒绝执行。")
        print(f"  Agent 需要：读 data.json，把对应的 ai_findings / ai_insights / ai_summary 写到 outline.json。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
