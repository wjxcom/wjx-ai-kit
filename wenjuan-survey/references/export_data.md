# export_data - 导出原始数据

导出问卷**原始答题数据**（Excel / xlsx）：**文本数据、一题一列**，与问卷网报表后台「数据详情」导出逻辑一致。实现上与 `scripts/export_data.py` **同源**（`/report/api/download` 异步任务 + 轮询 + 本地下载）。

## 默认保存位置（约定）

- **JWT**：与其它脚本一致，经 `token_store` 解析；用户级主凭证文件在默认情况下为 **`~/.wenjuan/token.json`**（读取顺序仍可能先用到 Skill 根目录 `.wenjuan/auth.json`，见 `references/auth.md`）。
- **导出文件目录**：未指定 `-o/--output` 时，默认为 **`<凭证目录>/download`**；凭证目录未自定义时即 **`~/.wenjuan/download/`**。

## 接口（内部）

脚本使用问卷网报表下载接口（需 URL 查询签名 + JWT）。查询参数与 **`generate_sign.js`（`web_site=ai_skills`、`appkey`、`timestamp`、`signature`）** 同源，由 `buildSignedUrl` 生成。

| 用途 | 方法 | 路径 |
|------|------|------|
| 筛选条件下答卷数 | POST | `https://www.wenjuan.com/report/api/download/filter_count` |
| 创建导出任务 | POST | `https://www.wenjuan.com/report/api/download` |
| 查询任务列表 | GET | `https://www.wenjuan.com/report/api/download/infos` |

导出任务参数固定为：整体导出、数据详情、xlsx、文本数据、合并、扩展字段 `raw` / `text` / `one_question_one_column`。

## CLI 参数

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `project_id` | string | **是** | 项目ID（**第一个位置参数**） |
| `-o, --output` | 目录路径 | 否 | 保存目录，默认 `<凭证目录>/download`（未改凭证目录时为 **`~/.wenjuan/download/`**） |
| `--token-dir` | 目录路径 | 否 | 用户级凭证目录，与 `login_auto.js` 等一致；不传则用 `~/.wenjuan` 或环境变量 `WENJUAN_TOKEN_DIR` |
| `-t, --timeout` | 整数（秒） | 否 | 等待任务完成的最长时间，默认 `600` |

## 前置条件

**需要已登录问卷网账号。** JWT 与其它脚本一致，由 **`scripts/token_store.js`** 解析：优先 Skill 根目录 `.wenjuan/auth.json`，其次 `--token-dir` / 默认凭证目录下的 `token.json` 与 `access_token`（`token.json` 支持 `access_token`、`token`、`data.access_token`）。请先完成登录（如 `login_auto.js` 或项目内登录流程）。

## 行为说明

1. 调用 `filter_count` 检查是否有答卷；为 0 则提示退出。
2. 创建下载任务；若返回「已有任务进行中」等错误则退出。
3. 每隔 5 秒轮询任务列表，直至状态为成功（有 `download_url`）、失败或无数据。
4. 成功则流式下载 xlsx 到输出目录（默认 **`<凭证目录>/download`**），文件名为 `{project_id}_{unix时间戳}.xlsx`。
5. **超时**时打印提示并尝试在浏览器打开 `https://www.wenjuan.com/report/topic/{project_id}`，便于手动下载。

## 导出文件内容

xlsx 与报表后台「原始数据 / 文本 / 一题一列」一致，通常包含答卷 ID、提交时间、答题时长、各题答案及管理端相关字段等。

## CLI 调用示例

```bash
# 默认目录 <凭证目录>/download（凭证目录见 auth.md），超时 600 秒
node "${SKILL_DIR}/scripts/export_data.js" "project_id"

# 指定目录与超时
node "${SKILL_DIR}/scripts/export_data.js" "project_id" \
  -o ./downloads \
  -t 300
```

Python 等价：

```bash
python3 "${SKILL_DIR}/scripts/export_data.py" "project_id" -o ~/.wenjuan/download -t 600
```

## 相关：查看报表（网页统计页）

本脚本拉取的是**逐条原始数据表**，不是仅图表统计页。

若要在浏览器中查看官方**回收与统计界面**，可使用 **`get_report`** → `scripts/open_report.js`，说明见 [`get_report.md`](get_report.md)。可配合使用：先 `open_report` 看汇总，再用 `export_data` 拉原始数据。

## 相关：数据概况（Stats v2）

终端快速查看答卷数、浏览量、完成率等，使用 **`overview_stats`** → `scripts/overview_stats.js`，说明见 [`overview_stats.md`](overview_stats.md)。**概况接口 GET URL 与本脚本一致**（复用 `buildUrlWithAuth` → `buildSignedUrl`，`ai_skills` 配置）。
