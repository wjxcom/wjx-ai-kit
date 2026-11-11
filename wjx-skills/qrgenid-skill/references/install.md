# 依赖自检与一次性补齐（仅 Windows）

`python -m scripts` 直跑源码，运行期依赖以下第三方库（非标准库，import 阶段即加载）：

- `Pillow` — 二维码绘制
- `XlsxWriter` — 写输出 Excel
- `openpyxl` — 读 `.xlsx`
- `qrcode` — 二维码编码
- `xlrd` — 读 `.xls`

## 前置条件

- Windows
- Python 3.10+（安装时勾选 "Add python.exe to PATH"）

## 自检

在 skill 根目录运行：

```powershell
python -m scripts --version
```

- 输出 `0.1.0` → 环境就绪。
- 报 `ModuleNotFoundError` → 按下面补齐依赖。

## 一次性补齐依赖

```powershell
python -m pip install Pillow XlsxWriter openpyxl "qrcode[pil]" xlrd
```

装完后再次自检：

```powershell
python -m scripts --version
```

## 字体说明（ID 标签文字需要）

二维码下方的 ID 文字使用 Windows 系统字体，按以下顺序探测：

- Microsoft YaHei (`msyh.ttc` / `msyh.ttf`)
- Microsoft YaHei UI (`msyhui.ttc` / `msyhui.ttf`)
- SimSun (`simsun.ttc` / `simsun.ttf`)

若都找不到，会报 `font_unavailable`。默认 Windows 均已自带上述字体，无需额外安装；本 skill 不内置/分发字体。