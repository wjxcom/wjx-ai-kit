# delete_question - 删除题目

删除问卷中的某道题目。

## 接口

```bash
POST /app_api/edit/delete_question/
```

## 参数

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `-p, --project-id` | string | **是** | 项目ID |
| `-q, --question-id` | string | **是** | 题目ID |
| `-f, --force` | bool | 否 | 强制删除，不提示确认 |
| `--json` | bool | 否 | 输出原始JSON响应 |

## 前置条件

**⚠️ 删除题目前须完成停止收集（若需）与项目归档。** 导出的 **`deleteQuestion(projectId, questionId)`** 在发起删除请求**前**会调用 **`ensureReadyForEdit`**（`project_edit_guard.js`）；CLI 与之相同。**禁止**绕过该函数直接 POST `delete_question`。

## Token

JWT 读取与全库一致，由 `scripts/token_store.js` 统一解析：先 Skill 根目录 `.wenjuan/auth.json`，再用户级目录（默认 `~/.wenjuan` 或 `WENJUAN_TOKEN_DIR`）下的 **`token.json`，最后 `access_token`** 纯文本。详见 `references/auth.md`。

## 返回

接口成功时常见形式：

```json
{
  "status": 200,
  "status_code": 1
}
```

脚本以 **`Number(status_code) === 1`** 判定成功；失败时优先展示 `err_msg`。

## 注意事项

- 删除后无法恢复
- 建议先调用 `fetch_project.js`（或 `edit_question.js <project_id> -l`）确认题目 ID 再删除

## CLI 调用示例

```bash
# 删除题目（会提示确认）
node "${SKILL_DIR}/scripts/delete_question.js" \
  -p "project_id" \
  -q "question_id"

# 强制删除（不提示确认）
node "${SKILL_DIR}/scripts/delete_question.js" \
  -p "project_id" \
  -q "question_id" \
  --force
```
