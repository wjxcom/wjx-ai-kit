"""4 主题色板 + 通用 SVG 工具。

历史上这里有 plotly 的图表生成函数（make_nps_gauge_svg / make_bar_chart_svg 等），
但用户反馈 plotly 出图气质偏"网页化"，反而不如纯 SVG 模板看着清晰。已改回纯
SVG 模板路径。本模块降级为：
  - 4 主题的色板规格（PaletteSpec / _PALETTES）— SVG 模板生成时按主题取色
  - get_palette / list_themes 公共 API
  - 通用色值工具（_hex_to_rgba）

不再有 plotly / kaleido 依赖。
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PaletteSpec:
    """主题色板。覆盖各页可能要染色的元素。"""

    name: str
    bg: str               # 整页背景
    surface: str          # 卡片/前景背景
    text_primary: str     # 主文字
    text_secondary: str   # 次要文字
    accent: str           # 强调色（标题装饰、行业参考线）
    nps_promoter: str     # NPS 推荐者绿
    nps_passive: str      # NPS 中立黄
    nps_detractor: str    # NPS 贬损红
    bar_primary: str      # 条形图主色
    bar_top: str          # 条形图 Top1 高亮色
    heatmap_color: str    # 热力图主色（透明度叠出梯度）


_PALETTES: dict[str, PaletteSpec] = {
    "business": PaletteSpec(
        name="business",
        bg="#F7F9FC",
        surface="#FFFFFF",
        text_primary="#0F2847",
        text_secondary="#5A7090",
        accent="#F5A623",
        nps_promoter="#6FB8A1",
        nps_passive="#F5A623",
        nps_detractor="#E55B4F",
        bar_primary="#4A90D9",
        bar_top="#0F2847",
        heatmap_color="#4A90D9",
    ),
    "warm": PaletteSpec(
        name="warm",
        bg="#FBF6F0",
        surface="#FFFFFF",
        text_primary="#3D1F14",
        text_secondary="#7A5440",
        accent="#F4A261",
        nps_promoter="#A8B27A",
        nps_passive="#F4A261",
        nps_detractor="#C75145",
        bar_primary="#C8956D",
        bar_top="#3D1F14",
        heatmap_color="#C8956D",
    ),
    "minimal": PaletteSpec(
        name="minimal",
        bg="#FFFFFF",
        surface="#FFFFFF",
        text_primary="#1A1A1A",
        text_secondary="#5A5A5A",
        accent="#1A1A1A",
        nps_promoter="#3A3A3A",
        nps_passive="#9A9A9A",
        nps_detractor="#1A1A1A",
        bar_primary="#1A1A1A",
        bar_top="#000000",
        heatmap_color="#1A1A1A",
    ),
    "soft": PaletteSpec(
        name="soft",
        bg="#FAF7F2",
        surface="#FFFFFF",
        text_primary="#5B6A75",
        text_secondary="#7A6F65",
        accent="#D4B8A0",
        nps_promoter="#A8B5A0",
        nps_passive="#D4B8A0",
        nps_detractor="#C68F8F",
        bar_primary="#A8B5A0",
        bar_top="#5B6A75",
        heatmap_color="#A8B5A0",
    ),
    # === 2026-05 新增 4 款（v2 重做：每套主色 + 单一强调 + 协调的三数据色）===
    "consulting": PaletteSpec(
        # BCG 风：黑灰主调 + 暖砖红单一强调；数据三色采用同冷暖梯度
        name="consulting",
        bg="#FAFAFA",
        surface="#FFFFFF",
        text_primary="#1F1F1F",
        text_secondary="#6B6B6B",
        accent="#C04A3C",          # 暖砖红（代替原刺眼 #E55B4F）
        nps_promoter="#4A6B5A",    # 墨绿（不抢戏）
        nps_passive="#9B9B9B",     # 中灰
        nps_detractor="#C04A3C",   # 砖红与 accent 同
        bar_primary="#2F2F2F",     # 深炭主色
        bar_top="#C04A3C",         # 强调色当 Top1
        heatmap_color="#3D3D3D",   # 灰阶热力（深→浅靠 opacity 叠）
    ),
    "tech-dark": PaletteSpec(
        # 深色 SaaS 风：去霓虹改柔色，文字用柔白避免刺眼
        name="tech-dark",
        bg="#0F1419",              # 深底（比 #0A0E1A 略亮）
        surface="#1A2030",         # 深卡片
        text_primary="#E8ECF1",    # 柔白（不再 #FFFFFF）
        text_secondary="#8896A8",
        accent="#06B6D4",          # 青蓝（柔，不刺眼）
        nps_promoter="#34D399",    # 柔绿
        nps_passive="#FBBF24",     # 暖黄
        nps_detractor="#F87171",   # 柔红
        bar_primary="#06B6D4",
        bar_top="#A78BFA",         # 柔紫做对比强调
        heatmap_color="#06B6D4",
    ),
    "editorial": PaletteSpec(
        # 杂志风：米色底 + 深棕主文 + 朱砂强调
        name="editorial",
        bg="#F5EFE6",              # 米色底
        surface="#FFFFFF",
        text_primary="#2A1810",    # 深棕
        text_secondary="#6B5A4A",
        accent="#B7410E",          # 朱砂强调
        nps_promoter="#5C7A3D",    # 橄榄绿
        nps_passive="#C9933D",     # 赭黄
        nps_detractor="#B7410E",
        bar_primary="#3D2418",     # 深棕条形
        bar_top="#B7410E",
        heatmap_color="#6B5A4A",   # 暖灰热力
    ),
    "gov-red": PaletteSpec(
        # 政务风：酒红主色 + 鎏金强调，降饱和不土气
        name="gov-red",
        bg="#FAF6EE",              # 暖米底
        surface="#FFFFFF",
        text_primary="#8B1A2C",    # 酒红（比 #C8102E 沉稳）
        text_secondary="#7A5C3F",
        accent="#C9A227",          # 鎏金（比 #DAA520 沉稳）
        nps_promoter="#3D6B47",    # 深松绿
        nps_passive="#C9A227",
        nps_detractor="#8B1A2C",
        bar_primary="#8B1A2C",
        bar_top="#5A0F1B",         # 暗酒红做强调
        heatmap_color="#8B1A2C",
    ),
}


def get_palette(theme: str) -> PaletteSpec:
    return _PALETTES.get(theme, _PALETTES["business"])


def list_themes() -> list[str]:
    return list(_PALETTES.keys())


def hex_to_rgba(hex_color: str, alpha: float) -> str:
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"
