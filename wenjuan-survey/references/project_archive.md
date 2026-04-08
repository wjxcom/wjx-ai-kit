# project_archive - 项目信息归档

问卷网 **项目归档** 接口（与 Hera 文档一致），用于在编辑问卷结构前固化当前版本、停止相关收集侧逻辑。**本 Skill 在编辑工作流中由 `project_edit_guard.js` 自动调用**：`ensureReadyForEdit` 会在必要时先 **停止收集**，再 **归档直至成功** 后，才继续创建/编辑/删除题目或修改项目信息。

## 接口

| 项 | 值 |
|----|-----|
| 基址 | `https://www.wenjuan.com` |
| 路径 | `POST /report/ajax/project_archive/` |
| Query | `pid` = 项目 ID（必填）；另须带 **AI 技能签名** 查询参数：`appkey`、`web_site`（`ai_skills`）、`timestamp`（秒）、`signature`（MD5，规则见 `scripts/generate_sign.js`，与 `export_data` 的 `buildSignedUrl` 一致）。脚本用 `buildSignedUrl(baseUrl, { pid })` 生成完整 URL。 |
| 表单 | `is_merge`：`0`（默认，不合并历史版本答卷）或 `1`（合并，可能更耗时） |
| 认证 | `Authorization: Bearer <JWT>`（与其它报表类接口一致，凭证见 `references/auth.md` / `token_store.js`）；签名与 JWT **同时**使用。 |

## 响应约定

| 条件 | 说明 |
|------|------|
| `status === "200"` 且 `result === "Success"` | 归档成功 |
| `status === "200"` 且 `result === "Doing"` | 归档进行中（互斥锁），客户端应间隔数秒后 **重试同一请求** |
| `status` 为数字（如 `10003`）或含 `message` | 失败，参见错误码表 |

## 脚本

| 文件 | 说明 |
|------|------|
| `scripts/project_archive.js` | 单次/轮询归档；可独立执行：`node project_archive.js -p <project_id> [--merge]` |
| `scripts/project_edit_guard.js` | `ensureReadyForEdit(projectId)` 内调用 `pollArchiveUntilSuccess` |

## 与编辑工作流的关系

以下脚本在执行改项目/改题前会调用 **`ensureReadyForEdit`**（停止收集 + 归档）：

- `create_question.js`
- `edit_question.js`
- `delete_question.js`
- `update_project.js`

## 选项与环境

- **合并版本**：`ensureReadyForEdit(projectId, { isMerge: 1 })` 或 CLI `project_archive.js --merge`（默认 `is_merge=0`）。
- **凭证目录**：与全库一致，支持 `opts.tokenDir` 或环境变量 `WENJUAN_TOKEN_DIR`（见 `auth.md`）。

## 参考

上游接口说明原文见本地文档：`/Users/apple/worker_space/hera/API_DOCUMENTATION.md`（Hera 项目归档章节）。
