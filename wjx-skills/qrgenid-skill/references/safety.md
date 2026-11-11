# 覆盖与清理行为

执行 `python -m scripts` 前必须向用户说明以下覆盖/清理风险，并取得明确确认。

## 1. `output.xlsx` 会被覆盖

- 程序先写同目录临时文件（`.qrgenid-*.xlsx`），校验通过后再 `os.replace` 替换正式 `output.xlsx`。
- 因此若输出目录已存在 `output.xlsx`，它会被覆盖。若该文件正被 Excel 打开占用，会报 `output_error`。

## 2. `qrcodes/` 根目录旧 PNG 会被清空

- 开始处理前，会删除 `qrcodes/` 根目录下的旧 `.png` 文件。
- **保留**：`qrcodes/` 下的子目录、以及非 `.png` 文件。
- 覆盖范围仅限 `qrcodes/` 根目录层级，不递归。

## 3. 输出目录自动创建

- 输出目录不存在时会自动创建，并创建 `qrcodes/` 子目录。
- 若目录不可写，报 `output_error`。

## 确认范例

> 检测到输入表 `Sheet1`（共 N 行数据），ID 列 A，URL 列 B，将输出到 `C:\data\out\`，尺寸 150。
>
> ⚠️ 将覆盖 `C:\data\out\output.xlsx` 并清空 `C:\data\out\qrcodes\` 下的旧 PNG。确认执行？