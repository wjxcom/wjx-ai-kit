"""Layer 1：通过 wjx-cli 拉取问卷结构与答卷数据，归一化为统一 JSON。

不直接调 wjx-api-sdk，全部走 wjx-cli 子进程，便于：
- 复用 wjx-cli 的认证、错误处理、重试逻辑
- skill 与 SDK 解耦，wjx-cli 升级时 skill 自动跟随

关键事实：wjx-cli 返回 {"result": true, "data": {...}}，所有具体字段在 data 下。
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


# q_type 数字 → skill 内部统一类型
_QTYPE_MAP: dict[int, str] = {
    3: "single",   # 单选题（含量表/评分子类型）
    4: "multi",    # 多选题
    5: "text",     # 填空题
    6: "text",     # 多项填空（暂按文本处理）
    7: "matrix",   # 矩阵题
    9: "text",     # 比重题（暂归文本）
    10: "scale",   # 滑块题
}


def _resolve_wjx() -> str:
    """Locate the wjx CLI executable cross-platform.

    Windows ships wjx as wjx.cmd via npm global; subprocess on Win can't run
    that without help. shutil.which finds the .cmd via PATHEXT.
    """
    found = shutil.which("wjx")
    if found:
        return found
    raise RuntimeError("未找到 wjx 命令，请先安装：npm install -g wjx-cli")


def _run_wjx(args: list[str]) -> Any:
    """调 wjx-cli 子命令，要求 --json 输出，返回 data 字段。

    出错时抛 RuntimeError 带上 stderr。

    wjx-cli 输出有两种风格：
    - 业务命令（survey/response 等）：{"result": true, "data": {...}, "errormsg": ...}
    - 工具命令（analytics 等）：直接返回数据对象，无 result 字段
    本函数兼容两者：有 result=true 取 data；无 result 则原样返回。
    """
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
    wjx_path = _resolve_wjx()
    result = subprocess.run(
        [wjx_path, *args, "--json"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
        timeout=120,
    )
    if result.returncode != 0:
        msg = result.stderr.strip() or result.stdout.strip()
        raise RuntimeError(f"wjx {' '.join(args)} 失败：{msg}")
    try:
        body = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"wjx {' '.join(args)} 返回非 JSON：{result.stdout[:200]}"
        ) from exc
    # 业务命令信封
    if isinstance(body, dict) and "result" in body:
        if not body.get("result"):
            err = body.get("errormsg") or body.get("error") or "unknown"
            raise RuntimeError(f"wjx {' '.join(args)} 业务错误：{err}")
        return body.get("data", {})
    # 工具命令直接返回（analytics nps/csat 等）
    return body


def _classify_question(q: dict[str, Any]) -> tuple[str, str | None]:
    """根据 q_type / q_subtype / is_nps 决定题目内部类型 + scale 子类型。

    返回 (type, scale_type)。scale_type 仅在量表/NPS 题非 None。
    """
    q_type = q.get("q_type")
    q_subtype = q.get("q_subtype")
    is_nps = bool(q.get("is_nps"))

    # NPS 是 q_type=3 + subtype=302 + is_nps=true 的组合
    if is_nps:
        return ("scale", "nps_0_10")

    # 非 NPS 的量表（q_subtype=302）：按 items 数量判 CSAT
    if q_type == 3 and q_subtype == 302:
        items = q.get("items") or []
        n = len(items)
        if n == 5:
            return ("scale", "csat_1_5")
        if n == 7:
            return ("scale", "csat_1_7")
        if n == 11:
            return ("scale", "nps_0_10")
        return ("scale", None)

    base = _QTYPE_MAP.get(int(q_type) if q_type else 0, "single")
    return (base, None)


def fetch_from_vid(vid: str, workdir: Path) -> dict[str, Any]:
    """端到端拉取一个问卷的全部 PPT 必需数据。"""
    print(f"[Layer 1] 拉取问卷 {vid} 数据...", file=sys.stderr)

    survey = _run_wjx(["survey", "get", "--vid", str(vid)])
    questions_raw = survey.get("questions", []) or []
    print(f"  题目结构 OK（{len(questions_raw)} 题）", file=sys.stderr)

    # 样本量取 survey.answer_valid（有效答卷数）— 这是问卷主表权威字段
    # 不要用 response count 的 total_count：实测它语义偏向"全部提交次数"
    # 含废卷/未通过校验的，会导致 PPT 报告基于错误总数
    count = _run_wjx(["response", "count", "--vid", str(vid)])
    survey_valid = survey.get("answer_valid")
    if isinstance(survey_valid, int) and survey_valid >= 0:
        total = survey_valid
        total_src = "survey.answer_valid"
    else:
        # 兜底：survey 没拿到 answer_valid 时退到 count 的 total_count
        total = count.get("total_count", count.get("join_times", 0))
        total_src = "response.total_count"
    print(f"  样本量 OK（{total} 份，来源 {total_src}）", file=sys.stderr)
    # 诊断辅助：count 接口跟主表对不上时打印警告（用户能看到数据语义差异）
    count_total = count.get("total_count")
    if (
        isinstance(count_total, int)
        and isinstance(survey_valid, int)
        and count_total != survey_valid
    ):
        print(
            f"  ⚠ response.total_count={count_total} ≠ survey.answer_valid={survey_valid}；"
            f"以 answer_valid 为准（count 字段可能含废卷）",
            file=sys.stderr,
        )

    matrix_report: dict[int, dict[int, dict[int, int]]] = {}
    try:
        report = _run_wjx(["response", "report", "--vid", str(vid)])
        answer_report = report.get("answer_report", {}) or {}
        print(f"  默认报告 OK（{len(answer_report)} 题聚合）", file=sys.stderr)
    except RuntimeError as exc:
        # API 限制：答卷数 × 题数 > 2000 时回退到分页聚合
        if "超过可分析范围" in str(exc) or "分析范围" in str(exc):
            print(f"  默认报告超过分析范围，回退到分页聚合...", file=sys.stderr)
            answer_report, matrix_report = _aggregate_from_query(vid, total, questions_raw)
            print(f"  分页聚合 OK（{len(answer_report)} 题 + 矩阵 {len(matrix_report)} 题）", file=sys.stderr)
        else:
            raise

    # 360-report 数据量大、字段不稳定，失败时不阻塞
    detail: dict[str, Any] = {}
    try:
        detail = _run_wjx(["response", "360-report", "--vid", str(vid)]) or {}
        print(f"  360 报告 OK", file=sys.stderr)
    except RuntimeError as exc:
        print(f"  360 报告跳过：{exc}", file=sys.stderr)

    # 合并题目结构 + 聚合分布
    questions = _normalize_questions(questions_raw, answer_report, detail, matrix_report)

    # 开放题答案：360-report 拿不到时（普通问卷），单独分页 query 抓 answer_text 样本
    text_qs_missing = [
        q for q in questions
        if (q.get("type") or "") == "text" and not q.get("open_answers")
    ]
    if text_qs_missing and total:
        try:
            open_data = _collect_open_answers(
                vid, int(total), [int(q["qid"]) for q in text_qs_missing]
            )
            for q in questions:
                qi = int(q["qid"])
                if qi in open_data and open_data[qi]:
                    q["open_answers"] = open_data[qi]
            n = sum(len(v) for v in open_data.values())
            print(f"  开放题摘录 OK（{n} 条样本）", file=sys.stderr)
        except RuntimeError as exc:
            print(f"  开放题摘录跳过：{exc}", file=sys.stderr)

    # NPS 分析：找第一个 nps_0_10 题计算
    analytics: dict[str, Any] = {}
    nps_q = next((q for q in questions if q.get("scale_type") == "nps_0_10"), None)
    if nps_q:
        scores = _expand_scores(nps_q.get("distribution") or [])
        if scores:
            try:
                nps = _run_wjx(["analytics", "nps", "--scores", json.dumps(scores)])
                analytics["nps"] = nps
                print(f"  NPS 分析 OK（score={nps.get('score', nps.get('value', '?'))})", file=sys.stderr)
            except RuntimeError as exc:
                print(f"  NPS 分析跳过：{exc}", file=sys.stderr)

    # CSAT 分析（每个 csat 题独立算）
    for q in questions:
        if q.get("scale_type") in ("csat_1_5", "csat_1_7"):
            scores = _expand_scores(q.get("distribution") or [])
            if not scores:
                continue
            try:
                csat = _run_wjx(["analytics", "csat", "--scores", json.dumps(scores)])
                analytics.setdefault("csat", []).append({**csat, "qid": q["qid"]})
            except RuntimeError as exc:
                print(f"  CSAT 分析跳过 q{q['qid']}：{exc}", file=sys.stderr)

    # NPS 分类比较（C 阶段）：按非 NPS 单选题的选项分组算各组 NPS
    nps_cross_tab: dict[str, Any] = {}
    if nps_q:
        nps_qi = int(nps_q["qid"])
        # 只对"非 NPS 的真单选"做分组（多选/矩阵跳过）
        group_qs = [
            q for q in questions
            if q.get("type") == "single"
            and q.get("scale_type") not in ("nps_0_10",)
            and q.get("distribution")
            and 2 <= len(q.get("distribution") or []) <= 8
        ]
        if group_qs and total:
            try:
                nps_cross_tab = _collect_nps_cross_tab(
                    vid, nps_qi, [int(q["qid"]) for q in group_qs], int(total),
                    questions_index={int(q["qid"]): q for q in questions},
                )
                print(f"  NPS 分类比较 OK（{len(nps_cross_tab)} 道分组题）", file=sys.stderr)
            except RuntimeError as exc:
                print(f"  NPS 分类比较跳过：{exc}", file=sys.stderr)

    return {
        "survey": {
            "title": survey.get("title", ""),
            "vid": str(vid),
            "type": survey.get("atype", 1),
            "url": survey.get("url"),
        },
        "response": {
            "total": total,
            "completed": survey.get("answer_valid", total),
            "avg_time": None,  # wjx-cli 当前不返回平均时长
        },
        "questions": questions,
        "analytics": analytics,
        "nps_cross_tab": nps_cross_tab,
    }


def _collect_open_answers(
    vid: str,
    total_count: int,
    text_q_indices: list[int],
    *,
    max_per_q: int = 10,
) -> dict[int, list[str]]:
    """从分页 response query 抽取文本题的 answer_text 样本（去重去空）。

    一旦每道题都凑满 max_per_q，立即停止分页。
    不依赖 360-report，普通问卷也可用。
    """
    page_size = 100
    page_count = max(1, (int(total_count) + page_size - 1) // page_size)
    out: dict[int, list[str]] = {qi: [] for qi in text_q_indices}
    seen: dict[int, set[str]] = {qi: set() for qi in text_q_indices}

    for page in range(1, page_count + 1):
        d = _run_wjx(
            ["response", "query", "--vid", str(vid),
             "--page_index", str(page), "--page_size", str(page_size)]
        )
        ans_dict = d.get("answers", {}) or {}
        iterator = ans_dict.values() if isinstance(ans_dict, dict) else ans_dict
        for ans in iterator:
            for _, item in (ans.get("answer_items") or {}).items():
                qi = int(item.get("q_index") or 0)
                if qi not in out:
                    continue
                if len(out[qi]) >= max_per_q:
                    continue
                txt = (item.get("answer_text") or "").strip()
                if not txt or txt in seen[qi]:
                    continue
                # 跳过太短或纯数字（多半不是有效原文）
                if len(txt) < 2 or txt.isdigit():
                    continue
                seen[qi].add(txt)
                out[qi].append(txt)
        if all(len(v) >= max_per_q for v in out.values()):
            break

    return out


def _collect_nps_cross_tab(
    vid: str,
    nps_qi: int,
    group_qis: list[int],
    total_count: int,
    questions_index: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    """对每道 group_q（非 NPS 单选），按其选项分组，分别算组内 NPS。

    返回形态：
    {
      str(group_qi): {
        "title": "...",
        "groups": [
          {"option_index": 1, "option_label": "选项1", "count": 304,
           "score": -33.22, "promoter_pct": 0, "passive_pct": 67, "detractor_pct": 33}
        ]
      }
    }
    """
    page_size = 100
    page_count = max(1, (int(total_count) + page_size - 1) // page_size)
    # bucket[gqi][option_idx] = [nps_score, ...]
    bucket: dict[int, dict[int, list[int]]] = {qi: {} for qi in group_qis}

    for page in range(1, page_count + 1):
        d = _run_wjx(
            ["response", "query", "--vid", str(vid),
             "--page_index", str(page), "--page_size", str(page_size)]
        )
        ans_dict = d.get("answers", {}) or {}
        iterator = ans_dict.values() if isinstance(ans_dict, dict) else ans_dict
        for ans in iterator:
            items = ans.get("answer_items") or {}
            nps_item = items.get(f"{nps_qi}0000")
            if not nps_item:
                continue
            try:
                score = int(nps_item.get("item_value"))
            except (TypeError, ValueError):
                continue
            if not 0 <= score <= 10:
                continue
            for gqi in group_qis:
                gitem = items.get(f"{gqi}0000")
                if not gitem:
                    continue
                idx_list = gitem.get("item_index") or []
                if not idx_list:
                    continue
                opt = int(idx_list[0])
                bucket[gqi].setdefault(opt, []).append(score)

    out: dict[str, Any] = {}
    for gqi, by_opt in bucket.items():
        if not by_opt:
            continue
        gq = questions_index.get(gqi, {})
        groups = []
        # 题目 items 顺序当展示顺序，但只放有数据的
        items_def = gq.get("options") or []
        for opt in sorted(by_opt.keys()):
            scores = by_opt[opt]
            if not scores:
                continue
            try:
                nps = _run_wjx(["analytics", "nps", "--scores", json.dumps(scores)])
            except RuntimeError:
                continue
            label = items_def[opt - 1] if 0 < opt <= len(items_def) else f"选项{opt}"
            prom = nps.get("promoters") or {}
            pas = nps.get("passives") or {}
            det = nps.get("detractors") or {}
            groups.append(
                {
                    "option_index": opt,
                    "option_label": label,
                    "count": len(scores),
                    "score": nps.get("score", 0),
                    "promoter_pct": round(float(prom.get("ratio", 0) or 0) * 100, 1),
                    "passive_pct": round(float(pas.get("ratio", 0) or 0) * 100, 1),
                    "detractor_pct": round(float(det.get("ratio", 0) or 0) * 100, 1),
                }
            )
        if groups:
            out[str(gqi)] = {
                "title": gq.get("title", f"q{gqi}"),
                "groups": groups,
            }
    return out


def _normalize_questions(
    questions_raw: list[dict[str, Any]],
    answer_report: dict[str, Any],
    detail: dict[str, Any],
    matrix_report: dict[int, dict[int, dict[int, int]]] | None = None,
) -> list[dict[str, Any]]:
    """合并 survey/get 的题目结构 + response/report（或客户端聚合）的分布。

    非矩阵题：item_count 是 {str(item_index): count}，把列表 items 映射成 distribution。
    矩阵题：matrix_report[q_index][q_row][col_value] = count，重排成 rows × cols 形态。
    """
    matrix_report = matrix_report or {}

    report_by_qindex: dict[int, dict[str, Any]] = {}
    for _, rep in answer_report.items():
        qi = rep.get("q_index")
        if qi is not None:
            report_by_qindex[qi] = rep

    out: list[dict[str, Any]] = []
    for q in questions_raw:
        q_index = q.get("q_index")
        q_type_num = int(q.get("q_type") or 0)
        if q_type_num in (1, 2):
            continue

        qtype, scale_type = _classify_question(q)
        items = q.get("items") or []
        rows_def = q.get("item_rows") or []

        if q_type_num == 7 and rows_def:
            # 矩阵：用 item_rows 当行、items 当列
            distribution = _build_matrix_distribution(
                q_index, rows_def, items, matrix_report.get(q_index, {})
            )
            options = [it.get("item_title", "") for it in items]
        else:
            rep = report_by_qindex.get(q_index, {})
            item_count = rep.get("item_count") or {}
            distribution = []
            for it in items:
                idx = it.get("item_index")
                count = item_count.get(str(idx), item_count.get(idx, 0))
                score = it.get("item_score")
                # item_score 可能是 0（NPS 起点），不能 `or idx` 否则吃掉 0
                value = score if score is not None else idx
                distribution.append(
                    {
                        "label": it.get("item_title", ""),
                        "count": count,
                        "value": value,
                    }
                )
            options = [it.get("item_title", "") for it in items] if items else None

        out.append(
            {
                "qid": str(q_index),
                "type": qtype,
                "scale_type": scale_type,
                "title": q.get("q_title", ""),
                "distribution": distribution if distribution else None,
                "options": options,
                "open_answers": _extract_open_answers(detail, q_index),
            }
        )
    return out


def _build_matrix_distribution(
    q_index: int,
    rows_def: list[dict[str, Any]],
    items: list[dict[str, Any]],
    cell_counts: dict[int, dict[int, int]],
) -> list[dict[str, Any]]:
    """矩阵题：每行一个对象 {label, values: [count_col1, count_col2, ...]}。

    cell_counts 形态：{q_row: {col_item_index: count}}。
    缺数据时用 0 填充，保证列数稳定。
    """
    cols = sorted({int(it.get("item_index") or 0) for it in items if it.get("item_index")})
    if not cols:
        return []
    out = []
    for r in rows_def:
        ridx = int(r.get("item_index") or 0)
        per_col = cell_counts.get(ridx, {}) or {}
        values = [int(per_col.get(c, 0) or 0) for c in cols]
        out.append({"label": r.get("item_title", ""), "values": values})
    return out


def _aggregate_from_query(
    vid: str,
    total_count: int,
    questions_raw: list[dict[str, Any]],
) -> tuple[dict[str, Any], dict[int, dict[int, dict[int, int]]]]:
    """report 限额 fallback：分页拉 response query，客户端聚合。

    返回 (answer_report, matrix_report)：
      answer_report 仿照 API 形态 {str(q_index): {q_index, item_count: {str(idx): count}}}
      matrix_report 矩阵专用 {q_index: {q_row: {col_item_index: count}}}
    """
    # 服务端实测每页上限 100
    page_size = 100
    page_count = max(1, (int(total_count) + page_size - 1) // page_size)
    qtype_by_qi = {int(q.get("q_index") or 0): int(q.get("q_type") or 0) for q in questions_raw}

    answer_report: dict[str, dict[str, Any]] = {}
    matrix_report: dict[int, dict[int, dict[int, int]]] = {}

    for page in range(1, page_count + 1):
        d = _run_wjx(
            [
                "response", "query", "--vid", str(vid),
                "--page_index", str(page), "--page_size", str(page_size),
            ]
        )
        answers = d.get("answers", {}) or {}
        iterator = answers.values() if isinstance(answers, dict) else answers
        for ans in iterator:
            for _, item in (ans.get("answer_items") or {}).items():
                qi = int(item.get("q_index") or 0)
                if not qi:
                    continue
                qrow = int(item.get("q_row") or 0)
                indices = item.get("item_index") or []
                qt = qtype_by_qi.get(qi, 0)

                if qt == 7 and qrow > 0:
                    bucket = matrix_report.setdefault(qi, {}).setdefault(qrow, {})
                    for v in indices:
                        try:
                            vi = int(v)
                        except (TypeError, ValueError):
                            continue
                        bucket[vi] = bucket.get(vi, 0) + 1
                else:
                    rep = answer_report.setdefault(
                        str(qi), {"q_index": qi, "item_count": {}}
                    )
                    ic = rep["item_count"]
                    for v in indices:
                        ks = str(v)
                        ic[ks] = ic.get(ks, 0) + 1
        print(f"    page {page}/{page_count}（{len(iterator) if hasattr(iterator,'__len__') else '?'} 答卷）", file=sys.stderr)

    return answer_report, matrix_report


def _expand_scores(distribution: list[dict[str, Any]]) -> list[float]:
    """把 distribution [{label, count, value}, ...] 展开成 [value, value, ...]。"""
    scores: list[float] = []
    for d in distribution:
        v = d.get("value")
        c = d.get("count", 0) or 0
        if v is None:
            continue
        try:
            v_num = float(v)
        except (TypeError, ValueError):
            continue
        scores.extend([v_num] * int(c))
    return scores


def _extract_open_answers(detail: dict[str, Any], q_index: int) -> list[str] | None:
    """从 360-report 提取某题的开放文本答卷。

    360-report 的 schema 在不同 wjx-cli 版本可能差异；这里防御性查找。
    """
    if not detail:
        return None
    # 常见路径 1：detail.answers[i].q{q_index}_text
    answers = detail.get("answers") or detail.get("data", {}).get("answers") or []
    if isinstance(answers, list):
        out = []
        for ans in answers[:10]:
            for k, v in (ans.items() if isinstance(ans, dict) else []):
                if str(q_index) in str(k) and isinstance(v, str) and v.strip():
                    out.append(v.strip())
                    break
        if out:
            return out[:5]
    # 常见路径 2：detail.open_answers[q_index]
    oa = detail.get("open_answers") or {}
    if isinstance(oa, dict):
        v = oa.get(str(q_index)) or oa.get(q_index)
        if isinstance(v, list):
            return [str(x) for x in v[:5]]
    return None
