# publish_survey - 发布/停止问卷

控制问卷的收集状态，发布开始收集或停止收集。

## Token（凭证）

`publish.js` 通过 **`scripts/token_store.js`** 读取 JWT：先 Skill 根目录 `.wenjuan/auth.json`，再用户级目录下 `token.json`、`access_token`（默认 `~/.wenjuan`，可 `WENJUAN_TOKEN_DIR`）。详见 `references/auth.md`。

## 接口

```bash
POST /edit/api/update_project_status/
```

## 参数

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `-p, --project-id` | string | **是** | 项目ID |
| `-a, --action` | string | **是** | 操作：publish(发布)/stop(停止) |
| `--json` | bool | 否 | 输出原始JSON响应 |

**发布（`publish`）成功后**：脚本会 **按固定间隔（默认每 2 秒）循环** 请求：

1. **项目详情**（`/app_api/edit/edit_project/`）：用 `status` / `proj_status` 判断收集态（**与下表不是同一套枚举**）。轮询输出列名为「项目详情」。
2. **状态接口**（`GET /project/api/status/{id}`）：**仅 `data.status`**（无 `audit_status`）。含义与脚本一致如下表；**`200`** 为占位，继续轮询。

| `data.status` | 含义 |
|---------------|------|
| `0` | 发布 |
| `1` | 收集中（发布成功） |
| `2` | 完成 |
| `3` | 暂停收集 |
| `99` | 审核中 |
| `100` | 审核不通过 |
| `-1` | 永久删除 |
| `-2` | 删除（回收站） |
| `200` | 未就绪占位（脚本视为处理中） |

直至已正式发布、驳回或超时（最长约 30 分钟）。终端会显示 **审核参考倒计时**：

- **第一阶段**（约 120 秒）：「问卷网正在审核您的项目，预计约 N 秒内完成（仅供参考）」；
- **第二阶段**（约 15 分钟参考）：「当前待审核项目较多…预计仍需约 M 分 S 秒（仅供参考）」；
- 参考倒计时结束后：「仍在审核中，请耐心等待」并继续轮询；
- 审核通过后若项目状态尚未同步：「正在等待项目状态同步为收集中」。

（与是否传入 `--poll` 无关，该参数仅为兼容旧命令。）**停止（`stop`）** 不会轮询。

判定发布 API 成功：`status_code === 1` 或历史兼容 `status === 200`。

## 返回

```json
{
  "status": 200,
  "status_code": 1,
  "message": "操作成功"
}
```

## 状态说明

| status | 含义 |
|--------|------|
| 0 | 已停止 |
| 1 | 收集中 |

## 发布失败处理

如返回 `NOT_BIND_MOBILE` 错误，表示用户未绑定手机号，需：

1. 调用手机号绑定流程
2. 重新尝试发布

## CLI 调用示例

```bash
# 发布项目（开始收集，成功后自动轮询审核/发布状态）
node "${SKILL_DIR}/scripts/publish.js" \
  -p "project_id" \
  -a publish

# 停止收集（不轮询）
node "${SKILL_DIR}/scripts/publish.js" \
  -p "project_id" \
  -a stop
```

## 使用场景

- 创建问卷后自动发布
- 编辑前由 `ensureReadyForEdit` 处理：停止收集（若需）+ **项目归档**（见 `project_archive.md`）
- 编辑完成后重新发布
- 暂停数据收集
