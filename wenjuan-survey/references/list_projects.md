# list_projects - 获取问卷列表

获取当前用户的问卷项目列表，支持搜索和分页。

## 接口

```bash
GET /app_api/skills/v1/projects/simple
```

## 参数

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `-t, --token` | string | **是** | JWT Token（本脚本**不从磁盘自动读取**；可从 `~/.wenjuan/token.json` 等取出 `access_token` 传入，规则见 `references/auth.md` / `token_store.js`） |
| `-k, --keyword` | string | 否 | 标题模糊搜索关键词 |
| `-p, --page` | int | 否 | 页码，默认1 |
| `-n, --page-size` | int | 否 | 每页条数，默认10 |
| `-i, --interactive` | bool | 否 | 交互式浏览，展示后询问是否下一页 |
| `--json` | bool | 否 | 输出原始JSON响应 |

## 返回

```json
{
  "status_code": 1,
  "data": {
    "list": [
      {
        "project_id": "5f8a9b2c3d4e5f6a7b8c9d0e",
        "title": "员工满意度调研",
        "short_id": "abc123",
        "status": "收集中",
        "create_time": "2024-01-15 10:30:00"
      }
    ],
    "total": 100,
    "page": 1,
    "total_pages": 10
  }
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| `project_id` | string | 项目唯一标识 |
| `title` | string | 问卷标题 |
| `short_id` | string | 短链接 ID |
| `status` | string | 问卷状态 |
| `create_time` | string | 创建时间 |

**答题链接**: `https://www.wenjuan.com/s/{short_id}`

**查看报表（统计页）**：`https://www.wenjuan.com/report/topic/{project_id}`。可用 **`scripts/open_report.js`**（`get_report`，默认打开浏览器；`--no-open` 只打印链接）。**本页筛选结果多条时**，在交互终端内须**手动选序号**，脚本不会默认选第 1 条。详见 [`get_report.md`](get_report.md)。

## 状态说明

| 状态 | 含义 |
|------|------|
| 未发布 | 草稿/已停止 |
| 收集中 | 正在收集数据 |

## CLI 调用示例

```bash
# 交互式浏览（推荐）
node "${SKILL_DIR}/scripts/list_projects.js" \
  -t "your_jwt_token" \
  -i

# 获取指定页
node "${SKILL_DIR}/scripts/list_projects.js" \
  -t "your_jwt_token" \
  -p 2

# 搜索项目
node "${SKILL_DIR}/scripts/list_projects.js" \
  -t "your_jwt_token" \
  -k "大学生" \
  -i

# 每页20条
node "${SKILL_DIR}/scripts/list_projects.js" \
  -t "your_jwt_token" \
  -n 20 \
  -i
```
