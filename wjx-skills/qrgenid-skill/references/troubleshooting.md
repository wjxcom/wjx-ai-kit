# 常见故障排障

退出码 2 或运行报错时按需加载本文件。

## 缺依赖（ModuleNotFoundError）

```
ModuleNotFoundError: No module named 'PIL' / 'xlsxwriter' / 'openpyxl' / 'qrcode' / 'xlrd'
```

- 修复：见 `references/install.md` 的一次性补齐命令。

## URL 无效

- 症状：`failure_reason` 含 "URL 为空或不是有效的 http/https 地址"。
- 修复：在输入 Excel 中修正 URL，保留 `http`/`https` 协议与非空主机名。

## 文件名冲突 / 非法字符 / 空 ID

- 多条 ID 清洗后相同：程序自动追加序号（`A001.png`、`A001_1.png`…），无需干预。
- ID 含 `/`、`*`、`:` 等非法字符：自动替换为下划线。
- ID 为空：自动用 `行号<实际行号>` 命名（如 `行号5.png`），仍生成二维码。

## 参数错误（退出码 2）

| 现象 | 修复 |
|---|---|
| ID 列与 URL 列相同 | 改用不同列 |
| 工作表不存在 | 重新列出工作表名并选择 |
| `--sheet` 与 `--sheet-index` 同时使用 | 只选其一 |
| 尺寸非法 | 使用 150 / 256 / 512 |
| 列超出范围 | 检查输入 Excel 实际列数 |

## 系统错误（退出码 2）

| 现象 | 修复 |
|---|---|
| 输入文件不存在 | 核实路径 |
| 输入文件损坏/无法读取 | 用 Excel 打开验证 |
| 输出目录不可写 | 换输出目录或修复权限 |
| `output.xlsx` 被占用 | 关闭正在打开该文件的 Excel，重试 |

## 字体缺失（font_unavailable）

- 症状：`failure_reason` 含 "找不到可用的中文系统字体"。
- 修复：确认 Windows 存在 Microsoft YaHei / YaHei UI / SimSun 任一字体；参考 `references/install.md`。

## 中文乱码

- `qrgenid.log` 用 UTF-8 写入。
- Windows 控制台默认编码可能显示乱码：用 VS Code / Notepad++ 打开日志，或 PowerShell 执行 `chcp 65001` 后再查看。

## 大批量 / 取消

- 线程池并发处理；数据量大时可用 Ctrl+C（CLI）或 GUI 取消。
- 已处理记录会保留，未处理记录标记为 "已取消"，仍生成 `output.xlsx`。