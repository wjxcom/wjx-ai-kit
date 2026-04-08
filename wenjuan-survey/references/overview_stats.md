# overview_stats — 数据概况

即时查看问卷**数据收集概况**：有效答卷数、今日答卷、总浏览量、完成率、平均用时、首尾答卷时间等。对应问卷网报表侧 **Stats v2** 接口。

**重要**：本接口的 **URL 查询参数与签名** 与 **`generate_sign.js`（ai_skills）** 及 **下载原始数据**（`export_data.js`）一致。脚本通过复用 `export_data.js` 的 **`buildUrlWithAuth`**（内部为 **`buildSignedUrl`**）实现；密钥与编辑类接口同源。

## 接口

| 项 | 值 |
|----|-----|
| 方法 | `GET` |
| 路径 | `https://www.wenjuan.com/report/api/v2/overview/stats/{pid}/` |
| Path | `pid` = 项目 ID（24 位 ObjectId） |
| 认证 | `Authorization: Bearer <JWT>`（与本 Skill 其它报表类用法一致，凭证见 `references/auth.md`） |

### 查询参数与签名（与 `generate_sign.js` / `export_data` 一致）

由 `scripts/export_data.js` 的 **`buildUrlWithAuth`** → **`generate_sign.buildSignedUrl`** 生成，与 `app_api/edit` 等编辑接口**同一套 `CONFIG`**：

| 参数 | 说明 |
|------|------|
| `web_site` | 固定 `ai_skills` |
| `appkey` | 与 `generate_sign.js` 中 `CONFIG.appkey` 相同 |
| `timestamp` | 秒级 Unix 时间戳 |
| `signature` | 参与签名的参数（含业务查询参数若有）按**参数名字母序**拼接**各参数值**，再追加 `CONFIG.secret`，**MD5（小写 hex）**；计算时**不含** `signature` 自身 |

实现上 **`statsUrl(projectId)`** 返回的即为已带上述查询串的完整 URL，无需手写签名。

## 成功响应（节选）

`status` 为字符串 `"200"`，`data` 字段常见键：

| 字段 | 说明 |
|------|------|
| `rspd_count` | 有效答卷总数 |
| `today_count` | 今日答卷数 |
| `scan_count` | 总浏览量（链接打开次数） |
| `finished_rate` | 完成率（0–100） |
| `avg_rspd_time` | 平均答卷用时（可读字符串） |
| `rspd_begin_time` | 首份答卷时间 |
| `rspd_end_time` | 末份答卷时间 |

错误时 `status` 为数字（如 `10003`）并带 `message`，详见上游文档。

## 脚本

**`scripts/overview_stats.js`**

```bash
node "${SKILL_DIR}/scripts/overview_stats.js" "<project_id>"
node "${SKILL_DIR}/scripts/overview_stats.js" -p "<project_id>" --json
```

| 选项 | 说明 |
|------|------|
| `--json` | 打印标准 JSON（便于程序解析） |
| `--token-dir` | 用户级凭证目录（与 `token_store` 一致） |

## 模块导出

`fetchOverviewStats(accessToken, projectId)`、`formatOverviewText(data, projectId)`、`statsUrl(projectId)` 供其它脚本复用。其中 `statsUrl` 返回 **已含 ai_skills 签名的完整 URL**（内部调用 `export_data.buildUrlWithAuth` → `generate_sign.buildSignedUrl`）。

## 上游文档

接口字段与错误码原文：`/Users/apple/worker_space/hera/API_DOCUMENTATION_STATS_V2.md`

## 与其它能力的关系

- **查看报表页**（统计图表 UI）：仍用 `open_report.js` → `/report/topic/{project_id}`  
- **原始数据下载**：`export_data.js`（与本概况共用 **`generate_sign.js` 的 `CONFIG` 签名逻辑**）  
- **数据概况**：本接口，适合终端/Agent 快速读数、无需打开浏览器
