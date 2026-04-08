# fetch_project - 获取项目详细结构

获取问卷的完整结构，包括所有页面、题目、选项等详细信息。

## 接口

```bash
GET /app_api/edit/edit_project/
```

**注意**：此接口需要签名认证。

## 参数

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `-p, --project-id` | string | **是** | 项目ID（24位） |
| `-o, --output` | string | 否 | 输出文件路径 |
| `--stats` | bool | 否 | 仅显示统计信息 |
| `-v, --verbose` | bool | 否 | 显示详细请求信息 |

## Token

JWT 由 `scripts/token_store.js` 统一读取：先 Skill 根目录 `.wenjuan/auth.json`，再用户级目录（默认 `~/.wenjuan` 或 `WENJUAN_TOKEN_DIR`）下的 `token.json`、`access_token`；`--token-dir` 可覆盖本次运行的用户级目录（详见 `references/auth.md`）。

## 返回

### 成功返回

```json
{
  "status_code": 1,
  "data": {
    "_id": "69cf989d20c788daf7aa196d",
    "project_id": "69cf989d20c788daf7aa196d",
    "title": "爸爸去哪儿第三季",
    "title_as_txt": "爸爸去哪儿第三季",
    "begin_desc": "欢迎参加本次调研",
    "end_desc": "感谢您的参与",
    "ptype_enname": "survey",
    "scene_type": "brand",
    "questionpage_list": [
      {
        "page_id": "page_xxx",
        "page_seq": 1,
        "question_list": [
          {
            "question_id": "q_xxx",
            "question_type": 2,
            "title": "您的性别",
            "is_required": 1,
            "option_list": [
              {"option_id": "opt_1", "title": "男", "is_open": false},
              {"option_id": "opt_2", "title": "女", "is_open": false}
            ]
          }
        ]
      }
    ]
  }
}
```

### 统计信息

使用 `--stats` 参数可获取简化统计：

```json
{
  "success": true,
  "project_id": "69cf989d20c788daf7aa196d",
  "title": "爸爸去哪儿第三季",
  "total_pages": 1,
  "total_questions": 5,
  "question_types": {
    "2": 2,   // 单选题
    "3": 1,   // 多选题
    "6": 1,   // 填空题
    "50": 1   // 评分题
  }
}
```

## 题目类型代码

| 代码 | 题型 |
|-----|------|
| 2 | 单选题 |
| 3 | 多选题 |
| 4 | 矩阵单选 |
| 6 | 填空题 |
| 7 | 矩阵多选/矩阵打分 |
| 50 | 量表/NPS/评分 |

## CLI 调用示例

```bash
# 获取项目详情并保存到默认路径
node "${SKILL_DIR}/scripts/fetch_project.js" \
  -p "69cf989d20c788daf7aa196d"

# 指定输出文件
node "${SKILL_DIR}/scripts/fetch_project.js" \
  -p "xxx" \
  -o my_project.json

# 仅显示统计信息
node "${SKILL_DIR}/scripts/fetch_project.js" \
  -p "xxx" \
  --stats

# 显示详细请求信息
node "${SKILL_DIR}/scripts/fetch_project.js" \
  -p "xxx" \
  -v
```

## 默认保存路径

项目数据默认保存到 **`<凭证目录>/project_struct/<project_id>.json`**（凭证目录与 `token_store` 的 `getDefaultTokenDir()` 一致：默认 `~/.wenjuan` 或 `WENJUAN_TOKEN_DIR`）。

## 用途

- 获取题目列表用于编辑
- 提取 `question_id` 用于 `edit_question.js` / `delete_question.js`
- 提取分页 ID（`questionpage_id_list` 或 `questionpage_list`）用于 `create_question.js`
- 查看当前问卷完整结构和统计信息
