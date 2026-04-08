# update_question - 编辑题目

通过 `edit_question.js` 修改问卷中已有题目（题干预览、选项增删改、矩阵行等）。

**实际请求接口**：`POST /app_api/edit/edit_question/`（表单带签名；请求头携带 JWT）。

## 执行流程

1. 读取 Token（与全库一致：`scripts/token_store.js`，先 Skill 根目录 `.wenjuan/auth.json`，再用户级目录下 `token.json`、`access_token`；详见 `references/auth.md`）
2. `fetch_project` 拉取最新结构（列表/预览场景；真正改题前仍会再走守卫）
3. **`QuestionEditor.updateQuestion` 在每次 `POST` 更新前**调用 **`ensureReadyForEdit`**：若 **收集中** 则先 `publish.js -a stop`，再 **项目归档** 直至成功（`scripts/project_edit_guard.js`，详见 [`project_archive.md`](project_archive.md)）。`editTitle` / `addOption` 等均通过 `updateQuestion` 落库，**不得**在 Agent 或自定义代码中替换/跳过 `updateQuestion` 或省略 `ensureReadyForEdit`。
4. `GET` 拉取题目详情 → 组装 `question_struct` → `POST` 更新

## 题目结构与 `title_as_txt`

- 本地组装结构时，会生成 `title`（HTML）及选项/矩阵行的文案字段。
- **更新失败时**：`updateQuestion` 会自动 **去掉题干、所有选项、所有矩阵行上的 `title_as_txt`** 后 **再请求一次**，避免部分环境下同时携带 `title` 与 `title_as_txt` 导致 **500**。
- **`editTitle`**：只设置 `<p>…</p>` 形式的 `title`，并主动删除题干及各选项/矩阵行上的 `title_as_txt` 后再提交。

## CLI 用法

**位置参数**：`project_id`、`question_id`（`--list` 时仅需 `project_id`）。

| 选项 | 说明 |
|------|------|
| `-l, --list` | 列出该项目全部题目及 `question_id` |
| `--edit-title <text>` | 修改题目标题 |
| `--edit-option <option_id>` | 修改选项（需配合 `--option-title`） |
| `--option-title <text>` | 选项新标题 |
| `--delete-option <option_id>` | 删除选项 |
| `--add-option <text>` | 新增选项（测评可用 `--is-answer`、`--score`） |
| `--edit-matrix-row <row_id>` | 编辑矩阵行（需配合 `--row-title`） |
| `--row-title <text>` | 矩阵行新标题 |
| `--delete-matrix-row <row_id>` | 删除矩阵行 |
| `--add-matrix-row <text>` | 新增矩阵行 |
| `-h, --help` | 帮助 |

**注意**：一次命令只支持 **一种** 操作（一个子命令）。

## 示例

```bash
# 列出题目
node "${SKILL_DIR}/scripts/edit_question.js" <project_id> -l

# 修改题目标题
node "${SKILL_DIR}/scripts/edit_question.js" <project_id> <question_id> \
  --edit-title "新的题目标题"

# 修改某个选项文案
node "${SKILL_DIR}/scripts/edit_question.js" <project_id> <question_id> \
  --edit-option <option_id> --option-title "新选项文案"

# 删除选项
node "${SKILL_DIR}/scripts/edit_question.js" <project_id> <question_id> \
  --delete-option <option_id>

# 新增选项
node "${SKILL_DIR}/scripts/edit_question.js" <project_id> <question_id> \
  --add-option "新选项"
```

## 前置条件

**⚠️ 编辑前须完成停止收集（若需要）与项目归档。** 由 `ensureReadyForEdit` 自动执行；编辑完成后如需继续收数，请使用 `publish.js -a publish` 重新发布。

## 错误码（节选）

与脚本内 `ERROR_CODE_MAP` 一致，常见包括：`10003` 参数错误、`10026` 项目已删除、`11004` 编辑锁、`20034` 题目不存在、以及选项/矩阵相关的 `30019`–`30143` 等。详见 `scripts/edit_question.js`。
