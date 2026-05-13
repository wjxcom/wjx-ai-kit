# 故障排查

按"症状 → 可能原因 → 验证 → 解决"四段式查找。

---

## 症状：UnicodeEncodeError 'cp1252'（Windows）

**原因**：Windows 控制台默认 GBK/cp1252 编码，遇到中文路径或中文 SVG 内容崩溃。
**验证**：错误堆栈出现 `cp1252.py` / `charmap_encode`。
**解决**：skill 已内置 `PYTHONIOENCODING=utf-8` 注入，但用户环境若覆盖了变量则失效。手动重置：
```
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
```
或在 PowerShell：
```
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"
```
然后重新跑 skill。

---

## 症状：渲染输出 "Some gradients may be lost"

**原因**：默认走 svglib 渲染，对 SVG 渐变/滤镜支持有限。
**严重性**：警告而非错误，PPTX 仍正常生成。
**解决（可选）**：装 cairosvg 提升渲染质量：
```
pip install cairosvg
```
Windows 上 cairosvg 装完直接可用（pycairo 自带 wheel）；macOS 需 `brew install cairo`。

---

## 症状：PPT 打开后字体显示为方框

**原因**：SVG 用了系统未安装的字体（如 SF Pro、苹方），PowerPoint 找不到字形。
**验证**：用 PowerPoint 打开后选中文本，看字体名是否带"备选"或感叹号。
**解决**：
1. 在生成 SVG 时使用 `font-family="Microsoft YaHei, sans-serif"` 这种带 Windows 兜底的写法
2. 或在 PPT 中全选 → 字体改成已装的字体

---

## 症状：`wjx survey get` 返回 `vid is required`

**原因**：传给 skill 的 `--vid` 是空字符串或非法值。
**验证**：直接跑 `wjx survey list --json` 确认 vid 在列表中。
**解决**：让用户确认 vid 来源；如果是从浏览器 URL 复制，注意有时 URL 含 activity 而非 vid，两者不同。

---

## 症状：渲染 0 页（成功但 PPT 是空的）

**原因**：`project/svg_final/` 目录下没有 SVG 文件，可能是：
- 模板缺失（`templates/slide_layouts/` 为空或文件名不匹配）
- 数据为空导致所有页都被 skip
**验证**：`ls <workdir>/project/svg_final/`。
**解决**：
- 模板缺失 → skill 安装不完整，重装
- 数据全空 → 用户问卷无答卷，先收集数据再生成

---

## 症状：`ModuleNotFoundError: No module named 'ppt_master_survey'`

**原因**：ppt-master-survey PyPI 包未装，或装在了不同的 Python 环境。
**验证**：
```
pip show ppt-master-survey
```
有输出且 Location 跟当前 python 一致才算装好。
**解决**：
```
pip install --upgrade ppt-master-survey
```
若有多个 Python 环境，确保 skill 调用的 python 跟 pip install 的是同一个：
```
python -m pip install ppt-master-survey
```

---

## 症状：渲染时长超过 5 分钟卡住

**原因**：可能是 SVG 包含大量内嵌 base64 图片，svglib 解析慢。
**验证**：`<workdir>/project/svg_final/*.svg` 文件大小，单个 > 5MB 就有嫌疑。
**解决**：
- 短期：用 `--plan-only` 跳过渲染，手动检查有问题的 SVG
- 长期：在生成 SVG 时压缩 / 外链图片而非内嵌

---

## 症状：依赖检查通过但仍提示找不到 wjx 命令

**原因**：PATH 在不同 shell 中不一致（如 zsh 装了，bash 没继承）。
**验证**：在跑 skill 的同一个 shell 里直接 `wjx --version`。
**解决**：
- 如果 wjx 是用 npm 全局装，确认 npm 全局路径在 PATH 中
- Windows: `npm config get prefix`，把输出路径加到系统 PATH
