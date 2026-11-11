# excel-image-embed

将 Excel 中的图片 URL 下载并嵌入新工作簿。默认复制前六列，按源列号顺序追加图片列，支持同一单元格多图。

**100 像素是显示宽度，不是图片文件宽度。** 保留原始像素，锁定纵横比，放大可查看源图细节。源图本身模糊时不能凭空恢复细节。

## 安装

需要 Python 3.10 或更新版本，适用于 Windows、macOS、Linux，不需要安装 Excel。

```powershell
python -m pip install -r requirements.txt
```

在支持目录式 Skill 的助手中，将 `excel-image-embed` 文件夹放到对应的 skills 目录中，确保 `SKILL.md` 位于目录根部。例如 OpenCode 通常使用 `~/.config/opencode/skills/excel-image-embed/SKILL.md`。其他助手请按其 Skill 安装说明使用本目录；ZIP 是便携分享包，不保证所有平台可一键导入。

也可以不安装 Skill，直接运行脚本。以下命令在本包根目录执行：

```powershell
python scripts/embed_images.py "input.xlsx" --columns BR BS --output "output_images.xlsx"
python scripts/verify_output.py "output_images.xlsx"
```

向助手提出请求的示例：

> 把 input.xlsx 的 BR、BS 图片链接插到新文件，前六列保留，图片显示宽度 100 像素，放大仍保留原图清晰度。

## 参数

| 参数 | 默认 / 含义 |
|---|---|
| source | 必填源 `.xlsx` |
| `--columns BR BS` | 必填图片列，接受字母或 1 起始数字，排序去重 |
| `--keep-columns 6` | 复制前六列数据，允许 0 |
| `--width 100` | Excel 显示宽度，允许正数；不改变原图像素 |
| `--sheets Sheet1 Sheet2` | 单表自动选择，多表必须明确指定 |
| `--output output.xlsx` | 默认源文件名加 `_images.xlsx`，拒绝覆盖 |
| `--cache cache-dir` | 默认输出名加 `_cache`，可复用已验证原图 |
| `--workers 4` | 下载并发数，正整数 |
| `--max-download-mb 50` | 单文件下载上限 MiB |

图片列可以与保留列重叠：保留列仍保留原数据，选中列的图片另行追加。目标第一行沿用源图片列表头。仅支持第一行为表头。

URL 以空格、换行、英文或中文逗号、分号等分隔；URL 中确实需要这些字符时，请百分号编码。空单元格、`(空)`、`无`、`-` 被视为空项。不能识别为链接的非空值会记录为无效值。使用标准 HTTP(S)、正常 TLS 验证；需要登录的地址不自动绕过权限。

## 产物

- `output_images.xlsx`：图片已实际嵌入，打开时不需要网络或缓存。
- `output_images_issues.csv`：源/输出单元格、URL 序号、状态、URL、原因；无问题时只有表头。
- `output_images_manifest.json`：来源、配置、成功图片尺寸/哈希/锚点、问题项，用于验证。
- `output_images_verification.json`：运行验证脚本后的检查报告。
- `output_images_cache/`：下载原图及必要的全分辨率 PNG 转换文件，可复用。

问题 CSV 中以公式标记开头的外部文本会加单引号，避免打开 CSV 时被解释为公式；manifest 保留原始文本供核对。

**以上运行产物可能包含个人信息、真实链接或文件路径。分享 Skill 时不要打包它们。** 本分享包只含代码、文档和合成测试清单。

## 质量、大小与限制

JPEG/PNG 尽量逐字节保留；必要的方向修正和 WebP 转 PNG 不进行缩图。多图保留失败项位置，后续图不会错位。默认 100 像素显示宽度可调整，放大时请保持纵横比。

全分辨率图片会增大 Excel 文件，某些数据可能达到数百 MB。脚本不会擅自压缩或提高原图分辨率。过高/过宽的图片排版超出 Excel 上限时，改小 `--width` 后重新生成。

这是数据和图片的导出工具，不是原工作簿完整克隆：不复制宏、源图表、已有图片、条件格式、数据验证等复杂对象。跨复制边界的合并区域会拒绝处理。公式默认复制源文件缓存结果；缺失缓存时要求先在 Excel/WPS 重算保存。文本及日期、数字保留其类型和样式。

PDF、Word 等文档不转换为图片，跳过并记录。静态嵌入 GIF 等多帧格式的首帧。图片下载采用重试，单文件默认最大 50 MiB，HTTPS 不跳过证书校验。

验证脚本不依赖 OfficeCLI，检查数据、图片字节及布局；它不是 Excel/WPS 的真实界面截图。请在自己的表格软件中打开抽查。

## 可重复测试

```powershell
python scripts/self_test.py
```

测试只使用生成的虚构数据，在回环地址上启动临时服务，结束后停止服务。覆盖正常多图、空值/404/PDF/Word/无效链接、WebP/EXIF 方向/大图、参数顺序、多工作表确认及禁止覆盖。测试结果默认保存于系统临时目录；可用 `--output-dir path` 指定新目录。`evals/evals.json` 说明三个主要场景，日常使用无需读取。

## 分享

直接分享 `excel-image-embed.zip` 或整个同名目录。接收方解压后安装依赖，按上述方法运行。包不含当前用户的数据、真实链接、图片缓存或网络凭据。

如要自行重新打包，压缩本目录中的文档、requirements、scripts 和 evals，排除 `__pycache__`、`.pyc`、测试输出及实际业务文件。
