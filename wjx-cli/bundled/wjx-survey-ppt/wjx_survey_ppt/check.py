"""依赖检查（规则 0 的程序化实现）。

检查项：
1. wjx CLI 可用且版本有效
2. python ≥ 3.10
3. ppt-master-survey 可调（console_script 或 python -m）
返回 0 = 通过；非 0 = 缺失，stderr 给出可操作的修复指引。
"""

from __future__ import annotations

import shutil
import subprocess
import sys


def _check_wjx_cli() -> tuple[bool, str]:
    wjx_path = shutil.which("wjx")
    if not wjx_path:
        return False, "wjx 命令未找到。请按 wjx-cli-use skill 的安装流程装 wjx-cli。"
    try:
        out = subprocess.run(
            [wjx_path, "--version"], capture_output=True, text=True, timeout=15
        )
        if out.returncode != 0:
            return False, f"wjx 命令报错：{out.stderr.strip() or out.stdout.strip()}"
        return True, f"wjx {out.stdout.strip()}"
    except Exception as exc:
        return False, f"wjx 调用异常：{exc}"


def _check_python() -> tuple[bool, str]:
    major, minor = sys.version_info[:2]
    if (major, minor) < (3, 10):
        return False, (
            f"Python {major}.{minor} 过低，需要 ≥ 3.10。"
            "参见 references/install-python.md"
        )
    return True, f"Python {major}.{minor}.{sys.version_info.micro}"


def _check_renderer() -> tuple[bool, str]:
    if shutil.which("ppt-master-svg2pptx"):
        return True, "ppt-master-svg2pptx (console_script)"
    try:
        out = subprocess.run(
            [sys.executable, "-m", "ppt_master_survey", "--help"],
            capture_output=True,
            text=True,
            timeout=20,
        )
        if out.returncode == 0:
            return True, "ppt_master_survey (python -m)"
    except Exception:
        pass
    return False, (
        "未检测到 ppt-master-survey。请执行：pip install ppt-master-survey"
    )


def run_check() -> int:
    checks = [
        ("wjx-cli", _check_wjx_cli),
        ("Python", _check_python),
        ("renderer", _check_renderer),
    ]
    failed = []
    for name, fn in checks:
        ok, msg = fn()
        marker = "✓" if ok else "✗"
        print(f"  [{marker}] {name}: {msg}")
        if not ok:
            failed.append(name)
    if failed:
        print(f"\n依赖未就绪：{', '.join(failed)}", file=sys.stderr)
        return 1
    print("\n依赖检查通过")
    return 0
