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

    默认走 native 模式（DrawingML 形状，文字保留为原生 a:t 元素）—
    PowerPoint 用系统字体渲染中文，无豆腐字问题。文件小 3-4 倍、形状可编辑。

    历史包袱：plotly 出图时代曾因 CSS 内联样式被渲染成黑屏退到 legacy（图片嵌入）；
    现在模板全是干净手搓 SVG + 删了 plotly，native 模式不再丢内容。

    需要图片嵌入模式（用于排版极复杂的 SVG）设环境变量 ``WJX_PPT_LEGACY=1``。
    注意 legacy 模式下中文会显示为方块（字体加载缺陷）。
    """
    import os
    output.parent.mkdir(parents=True, exist_ok=True)

    cmd = _resolve_renderer_cmd()
    mode = "legacy" if os.environ.get("WJX_PPT_LEGACY") == "1" else "native"
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
