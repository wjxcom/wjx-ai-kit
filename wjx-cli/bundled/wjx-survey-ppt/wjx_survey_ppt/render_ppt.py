"""Layer 3：调 ppt-master-survey 渲染引擎，把 SVG 转成 PPTX。

只通过 console_script 或 python -m 调用，不直接 import svg_to_pptx 模块。
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


def render_pptx(project_dir: Path, output: Path) -> None:
    """跑 ppt-master-svg2pptx，结果落到 output 路径。

    默认走 legacy 模式（每页 SVG 整张嵌入为图片），最大化"显示完整"兼容性 —
    plotly 出的复杂 SVG（CSS 内联样式、heatmap 渐变、Indicator 仪表盘）在 native
    模式（DrawingML 形状）下经常丢内容。代价：文件大约 3 倍、形状不可编辑。

    需要可编辑形状的用户设环境变量 ``WJX_PPT_NATIVE=1`` 切回 native。
    """
    import os
    output.parent.mkdir(parents=True, exist_ok=True)

    cmd = _resolve_renderer_cmd()
    mode = "native" if os.environ.get("WJX_PPT_NATIVE") == "1" else "legacy"
    args = [
        *cmd,
        str(project_dir),
        "-s", "svg_final",
        "-o", str(output),
        "--only", mode,
    ]

    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
    result = subprocess.run(
        args,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
        timeout=600,
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"渲染失败（exit {result.returncode}）。stderr: {result.stderr.strip()}"
        )

    if not output.exists():
        # 兼容模式会另外生成 *_svg.pptx；只要任一存在即认为成功
        compat = output.with_name(output.stem + "_svg" + output.suffix)
        if compat.exists():
            shutil.move(str(compat), str(output))
        else:
            raise RuntimeError(f"渲染未输出文件：{output}")


def _resolve_renderer_cmd() -> list[str]:
    # Priority 1: console_script on PATH
    if shutil.which("ppt-master-svg2pptx"):
        return ["ppt-master-svg2pptx"]
    # Priority 2: console_script in the same venv as current Python
    bin_dir = Path(sys.executable).parent
    for name in ("ppt-master-svg2pptx.exe", "ppt-master-svg2pptx"):
        candidate = bin_dir / name
        if candidate.exists():
            return [str(candidate)]
        scripts_candidate = bin_dir / "Scripts" / name
        if scripts_candidate.exists():
            return [str(scripts_candidate)]
    # Priority 3: python -m ppt_master_survey (requires ppt-master-survey >= 2.5.0.post1)
    return [sys.executable, "-m", "ppt_master_survey"]
