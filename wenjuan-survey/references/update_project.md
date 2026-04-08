# update_project - 更新项目信息

修改问卷的基本信息，包括标题、欢迎语（begin_desc）、结束语（end_desc）。

## 接口

```bash
POST /app_api/edit/edit_project/
```

**注意**：此接口需要签名认证和 JWT Token。

## 参数

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `-p, --project-id` | string | **是** | 项目ID（24位） |
| `-t, --title` | string | 条件 | 项目标题（可选） |
| `--begin-desc` | string | 条件 | 欢迎语/开始描述（可选） |
| `--end-desc` | string | 条件 | 结束语（可选） |
| `-v, --verbose` | bool | 否 | 显示详细请求信息 |
| `--token` | string | 否 | 直接传入 JWT；不传则从 `token_store` 默认路径读取 |
| `--token-dir` | string | 否 | 用户级凭证目录（默认 `~/.wenjuan` 或 `WENJUAN_TOKEN_DIR`） |

**注意**：至少需要提供一个要修改的字段（title、begin-desc、end-desc 之一）。

## Token

JWT 由 `scripts/token_store.js` 统一读取（与 `fetch_project.js` 一致）：先 Skill 根目录 `.wenjuan/auth.json`，再用户级目录下 `token.json`、`access_token`。支持命令行 **`--token`**、**`--token-dir`**（**勿与 `-t/--title` 混淆**）。默认用户级目录为 `~/.wenjuan`，可用环境变量 `WENJUAN_TOKEN_DIR`。详见 `references/auth.md`。

## 请求示例

```bash
# 修改标题
node update_project.js -p "69cf989d20c788daf7aa196d" --title "新标题"

# 修改欢迎语
node update_project.js -p "xxx" --begin-desc "欢迎参加本次调研"

# 修改结束语
node update_project.js -p "xxx" --end-desc "感谢您的参与！"

# 同时修改多个字段
node update_project.js -p "xxx" \
  --title "新标题" \
  --begin-desc "欢迎" \
  --end-desc "谢谢参与"
```

## 返回

### 成功返回

```json
{
  "status_code": 1,
  "data": {
    "title": "爸爸去哪儿第三季",
    "begin_desc": "欢迎参加本次调研",
    "end_desc": "<p style=\"text-align: center;\">您已完成本次问卷...</p>"
  }
}
```

### 失败返回

```json
{
  "status_code": 0,
  "err_code": "PROJECT_NOT_FOUND",
  "err_msg": "项目不存在"
}
```

## 常见错误

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| `PROJECT_NOT_FOUND` | 项目不存在 | 检查 project_id 是否正确 |
| `PROJECT_EDIT_DISABLED` | 项目正在收集中或未完成归档等，无法编辑 | 脚本会先 stop + 归档；仍失败则见终端报错或手动 `publish.js -a stop` 后执行 `project_archive.js` |
| `INVALID_TITLE` | 标题格式错误 | 检查标题长度和内容 |

## CLI 调用示例

```bash
# 修改标题
node "${SKILL_DIR}/scripts/update_project.js" \
  -p "69cf989d20c788daf7aa196d" \
  --title "爸爸去哪儿第三季"

# 修改欢迎语
node "${SKILL_DIR}/scripts/update_project.js" \
  -p "xxx" \
  --begin-desc "欢迎参加本次调研"

# 修改结束语
node "${SKILL_DIR}/scripts/update_project.js" \
  -p "xxx" \
  --end-desc "感谢您的参与"

# 同时修改多个字段
node "${SKILL_DIR}/scripts/update_project.js" \
  -p "xxx" \
  -t "新标题" \
  --begin-desc "欢迎" \
  --end-desc "谢谢"

# 显示详细请求信息
node "${SKILL_DIR}/scripts/update_project.js" \
  -p "xxx" \
  -t "新标题" \
  -v
```

## 注意事项

1. **编辑前状态**：**`updateProject()`（模块导出）内部**会先调用 **`ensureReadyForEdit`**（`project_edit_guard.js`）：**必要时停止收集**，再 **项目归档** 直至成功，最后刷新本地项目结构（详见 [`project_archive.md`](project_archive.md)）。CLI 与程序化调用同效。**禁止**为「省事」在外部重复实现改标题而不经 `update_project.js` 或绕过 `ensureReadyForEdit`。
2. **HTML 支持**：begin_desc 和 end_desc 支持 HTML 格式
3. **字段可选**：可以只修改其中一个字段，其他字段保持不变

## 使用场景

- 修改问卷标题
- 更新欢迎语/结束语
- 修正项目信息错误
