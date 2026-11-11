# CLI 参数与命令模板

运行命令统一为（在 skill 根目录执行）：

```bash
python -m scripts [选项]
```

## 参数表

| 参数 | CLI 开关 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| 输入 Excel 路径 | `--input` | ✅ | — | `.xlsx` 或 `.xls` |
| 输出目录 | `--output-dir` | ❌ | 输入文件所在目录 | 不存在时自动创建 |
| ID 列 | `--id-column` | ❌ | `A` | 列字母或从 1 开始的列号 |
| URL 列 | `--url-column` | ❌ | `B` | 列字母或从 1 开始的列号 |
| 工作表名 | `--sheet` | ❌ | 第一张表 | 大小写敏感，完全匹配 |
| 工作表序号 | `--sheet-index` | ❌ | 第一张表 | 从 1 开始 |
| 二维码主体尺寸 | `--size` | ❌ | `150` | 仅 `150` / `256` / `512` |
| 版本 | `--version` | — | — | 输出 `0.1.0` |

## 互斥约束

- `--sheet` 与 `--sheet-index` 不能同时使用。
- ID 列与 URL 列不能相同。

## 命令模板

```bash
# 最小调用（用默认列 A/B、第一张表、尺寸 150，输出到输入文件所在目录）
python -m scripts --input "C:\data\输入.xlsx"

# 完整调用
python -m scripts --input "C:\data\输入.xlsx" --output-dir "C:\data\out" --id-column A --url-column B --sheet "Sheet1" --size 256

# 按工作表序号
python -m scripts --input "C:\data\输入.xls" --output-dir "C:\data\out" --sheet-index 1 --size 512
```

- 路径含空格或特殊字符时用双引号包裹。
- 无参数直接运行会启动 Tkinter GUI；skill 场景应始终带 `--input`。