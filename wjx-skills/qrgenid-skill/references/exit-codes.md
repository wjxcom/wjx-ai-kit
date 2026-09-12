# 退出码与 JSON 语义

解析 `python -m scripts` 的 stdout JSON 时按需加载本文件。

## 退出码速查

| 退出码 | status 取值 | 含义 | skill 处理 |
|---|---|---|---|
| 0 | `success` | 全部成功 | 报告成功路径 |
| 1 | `partial_failure` | 部分行失败 | 列出失败明细 + 输出路径 |
| 1 | `cancelled` | 用户取消 | 说明已处理记录已保留 |
| 2 | `error` | 参数/系统错误 | **停止**，给修复建议 |

> 退出码 2 时，即使不生成结果文件，JSON 仍会在 stdout 返回（`output_file` 为 `null`）。

## JSON 顶层字段

```json
{
  "status": "success|partial_failure|cancelled|error",
  "exit_code": 0,
  "input_file": "C:/data/输入.xlsx",
  "output_file": "C:/data/out/output.xlsx",
  "success_count": 5,
  "failure_count": 1,
  "cancelled_count": 0,
  "errors": []
}
```

- `input_file` / `output_file`：绝对路径。
- `output_file` 在退出码 2 时为 `null`。
- `success_count + failure_count + cancelled_count` 之和 = 输入中的非空数据行数。

## errors 数组元素

```json
{
  "row_number": 5,
  "id": "A001",
  "url": "https://example.com/a",
  "status": "失败",
  "failure_reason": "URL 为空或不是有效的 http/https 地址",
  "expected_image_path": "C:/data/out/qrcodes/A001.png",
  "error_code": "row_failure",
  "message": "URL 为空或不是有效的 http/https 地址"
}
```

- `row_number`：Excel 实际行号（从 1 开始）；全局错误时为 `null`。
- `expected_image_path`：预期图片路径（即使未生成也返回）。
- `error_code` 见下表。

## 常见 error_code

| error_code | 触发场景 |
|---|---|
| `parameter_error` | 参数错误（ID/URL 列相同、工作表不存在、尺寸非法、列越界等） |
| `input_file_error` | 输入文件不存在、非文件、损坏或无法读取 |
| `output_error` | 输出目录不可写、输出 Excel 校验失败、`output.xlsx` 被占用等 |
| `font_unavailable` | 找不到 Windows 中文系统字体 |
| `row_failure` | 单行失败（如无效 URL） |
| `cancelled` | 用户取消 |
| `unexpected_error` | 未预期错误 |