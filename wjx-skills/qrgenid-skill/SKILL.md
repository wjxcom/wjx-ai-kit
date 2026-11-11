---
name: qrgenid
description: 从 Excel 批量生成带 ID 标签的二维码（运行本 skill 自带源码 python -m scripts）。当用户要“Excel 生成二维码 / 批量二维码 / 从表格做二维码 / xlsx 二维码 / QR batch”时触发。
---

# qrgenid

从 Excel 工作簿批量生成二维码：二维码本体只编码 URL，ID 作为黑色文字显示在二维码下方。最终产物三件套：

- `output.xlsx`：二维码图片**实际嵌入**单元格（不是路径）
- `qrcodes/`：PNG 文件目录
- `qrgenid.log`：完整处理日志

本 skill 直接运行自带源码（`scripts/` 目录），仅支持 Windows。

## When to Use

用户提到以下任一意图都应触发，无论是否明确叫出 qrgenid 这个名字：

- "Excel 生成二维码" / "xlsx 二维码" / "从表格做二维码"
- "QR code batch" / "Excel to QR"
- "批量二维码" / "给这表做二维码"

## 约定

- 本 `SKILL.md` 所在目录记为 `<SKILL_DIR>`，所有命令都在 `<SKILL_DIR>` 下执行。
- 运行命令统一为：`python -m scripts ...`（源码在 `<SKILL_DIR>/scripts/`）。

## Step 1: 运行前自检

运行：

```bash
python -m scripts --version
```

- 输出 `0.1.0` → 进入 Step 2。
- 报 `ModuleNotFoundError`（缺 `Pillow` / `XlsxWriter` / `openpyxl` / `qrcode` / `xlrd` 等）→ 按 `references/install.md` 给出一次性依赖补齐命令，然后**停止**，等用户装好后重试。
- 其他启动错误 → 参考 `references/troubleshooting.md`。

## Step 2: 收集参数

需要 6 个参数：

| 参数 | CLI 开关 | 必填 | 默认 |
|---|---|---|---|
| 输入 Excel 路径 | `--input` | ✅ | — |
| 输出目录 | `--output-dir` | ❌ | 输入文件所在目录 |
| ID 列（字母或 1-based 列号） | `--id-column` | ❌ | A |
| URL 列（字母或 1-based 列号） | `--url-column` | ❌ | B |
| 工作表名或序号（互斥） | `--sheet` / `--sheet-index` | ❌ | 第一张表 |
| 二维码主体尺寸 | `--size` | ❌ | 150（可选 150/256/512） |

- 用户已给全参数 → 直接进入 Step 3 的确认。
- 参数不全 → 用你的文件读取能力读取 Excel 表头与样本行，手动确认 ID 列 / URL 列（表头含 "ID/编号/编码/序号" 倾向 ID，含 "URL/链接/网址/二维码" 倾向 URL；默认 A=ID、B=URL）。
- 多张表时列出所有工作表名，默认选第一张。
- 尺寸默认 150，除非用户明确说“高清/大尺寸”或给出数字。
- 输出目录默认 = 输入文件所在目录，**必须告知用户这个默认行为**。

## Step 3: 覆盖风险确认（不可跳过）

执行前**必须**明确告知用户两项覆盖风险：

1. `output.xlsx` 会被覆盖（程序先写临时文件、校验后替换，但正式文件仍被覆盖）
2. `qrcodes/` 根目录下的旧 `.png` 文件会被清空（子目录和其他文件保留）

**等待用户明确确认后才调用命令**。用户拒绝 → 停止，告知任务已取消。

## Step 4: 执行

```bash
python -m scripts --input "<input-path>" --output-dir "<output-dir>" --id-column <col> --url-column <col> [--sheet <name> | --sheet-index <n>] --size <150|256|512>
```

- 路径含空格或特殊字符时用引号。
- 捕获 stdout（JSON）与 stderr（日志）；stderr 仅在排障时读取，不主动展示给用户。

## Step 5: 按退出码分支处理

解析 stdout 中的 JSON（字段语义详见 `references/exit-codes.md`）。

### 退出码 0（全成功，status=success）

报告：✅ 全部成功 N 张；`output.xlsx`、`qrcodes/`、`qrgenid.log` 的绝对路径。

### 退出码 1（部分失败/取消，status=partial_failure|cancelled）

报告：⚠️ 部分成功（成功 X/N，失败 Y，取消 Z）；输出路径；**逐条列出失败行**（行号、ID、URL、失败原因）。`cancelled` 时说明用户中断，已处理记录已保留。

### 退出码 2（参数/系统错误，status=error）

**停止，不重试**。报告 ❌ 错误 + `errors[0].message` 与 `errors[0].error_code`，给出修复建议（参考 `references/troubleshooting.md`）。

## Step 6: 路径展示

所有路径用**绝对路径**，报告三件套：`output.xlsx`、`qrcodes/`、`qrgenid.log`。

## 重要约束

- ✅ 运行前自检（`python -m scripts --version`）
- ✅ 覆盖风险必确认
- ✅ 用户给全参数时跳过推断
- ✅ 路径一律用绝对路径
- ❌ 退出码 2 必停止，不重试
- ❌ 不内置/分发字体
- ❌ 仅 Windows（ID 标签依赖 Windows 系统字体）

## 参考文档

按需加载（不要一次性全读）：

- `references/install.md` — 依赖自检与一次性补齐
- `references/cli.md` — 参数与命令模板
- `references/exit-codes.md` — 退出码与 JSON 语义
- `references/safety.md` — 覆盖与清理行为
- `references/troubleshooting.md` — 常见故障排障