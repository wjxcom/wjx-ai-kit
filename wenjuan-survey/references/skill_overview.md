# Skill 总览（触发、功能索引、工作流、错误码）

问卷网 Skill：创建/发布、列表、拉取与编辑项目、报表、导出、数据概况等。入口脚本多在 `scripts/`。

## 触发场景

以下情况应使用本 Skill：

- 用户提到「问卷」「调查」「收集」「表单」「投票」「评选」「报名」「登记」「考试」「测评」「趣味测试」「心理测试」「打分测试」「满意度」「在线收款」「360评估」「问卷网」「wenjuan.com」等
- 用户说「帮我做个调查」「创建一个投票」「做个表单/报名表」「新建问卷」「新建测评问卷」「做个趣味测试」等

**新建问卷**：优先执行 **`workflow_create_and_publish.js`**（登录 → 创建并导入 → 发布 → 轮询审核）。仅保存 `examples/*.json` **不会**上网；须 **执行脚本** 完成导入+发布（见 [`create_survey.md`](create_survey.md) 开篇说明）。已登记节日测评可 **`npm run publish:valentines` / `publish:labor` / `publish:april-fools` / `publish:singles-day`**（Skill 根目录）；**Agent** 应在生成/修改对应 JSON 后**自行执行**并汇报输出。题目来源四选一：**(A)** 默认模板（`--title` + `--type`，可选 `--scene`）**(B)** 本地题目 JSON（`-f` / `--text-file`）**(C)** `--url` 拉取 JSON **(D)** `--stdin`。设计稿 **txt / docx / xlsx / pdf** 须先转为题目 JSON（见 [`create_survey.md`](create_survey.md)「稿件支持的文档格式」）。

**类型（勿混用）**：

- 调研：`--type survey`（常见默认）
- 测评：`--type assess`
- 投票：`--type vote`
- 表单：`--type form`

不要把投票、表单、测评误作成 `survey`。

### 表述对照

| 用户表述 | 处理 |
|----------|------|
| 投票 / 评选 / 票选 | `workflow_create_and_publish.js` + **`--type vote`** + `--title` 或 JSON；见 [`create_survey.md`](create_survey.md) |
| 表单 / 报名表 / 信息登记 / 收集联系人 | + **`--type form`** |
| 考试 / 调研 | + **`--type survey`**（或默认） |
| 测评 / 趣味测试带结果 | + **`--type assess`** + 题目 JSON 或模板 |
| 从 URL 导入题目 | + **`--url`** |
| 文本 / JSON 建成问卷 | 整理为 JSON 后 `--file` / `--text-file` / `--stdin` |
| Word / Excel / PDF 稿 | 按 [`create_survey.md`](create_survey.md) 转 JSON；docx 示例：`examples/college_pocket_money_from_docx.json` |
| 收集意见 / 做调查 | 直接用本 Skill |
| 查看我的问卷 | `list_projects` |
| 编辑第 X 题 | `list_projects` → `fetch_project` → **`edit_question.js`**（见 [`update_question.md`](update_question.md)） |
| 改标题 | `update_project` |
| 看结构 | `fetch_project` |
| 绑定手机 | `bind_mobile` |
| 看回答 / 报表 | `open_report.js`（[`get_report.md`](get_report.md)）；`--no-open` 仅打印链接 |
| 下载数据 | `export_data` |
| 回收份数 / 完成率 | `overview_stats.js`（[`overview_stats.md`](overview_stats.md)） |
| 退出登录 / 清 token | 手动删凭证文件（[`auth.md`](auth.md)「清除本机登录态」） |

## 功能索引

| 功能 | 说明 | 文档 |
|------|------|------|
| create_survey | 创建并发布；`workflow_create_and_publish.js`；稿格式见 create_survey | [`create_survey.md`](create_survey.md) |
| list_projects | 我的问卷列表 | [`list_projects.md`](list_projects.md) |
| fetch_project | 项目结构 | [`fetch_project.md`](fetch_project.md) |
| update_project | 标题/欢迎语/结束语 | [`update_project.md`](update_project.md) |
| create_question | 新增题 | [`create_question.md`](create_question.md) |
| update_question | 改题（`edit_question.js`） | [`update_question.md`](update_question.md) |
| delete_question | 删题 | [`delete_question.md`](delete_question.md) |
| publish_survey | 发布/停止 | [`publish_survey.md`](publish_survey.md) |
| get_report | 报表页，默认开浏览器 | [`get_report.md`](get_report.md) |
| export_data | 原始数据 | [`export_data.md`](export_data.md) |
| overview_stats | 数据概况 | [`overview_stats.md`](overview_stats.md) |
| bind_mobile | 绑定手机 | [`bind_mobile.md`](bind_mobile.md) |
| check_version | 版本检查 | [`version_check.md`](version_check.md) |
| check_env | 仅 Node/依赖 | [`check_env.md`](check_env.md) |

## 工作流 1：新建问卷

```
1. 检查/获取登录凭证
2. 创建并导入题目（textproject；默认模板或 --file / --text-file / --url / --stdin；稿为 txt/docx/xlsx/pdf 时先转 JSON）
   • survey / assess / vote / form 对应 --type
3. 发布（update_project_status）
4. NOT_BIND_MOBILE → bind_mobile 后重试
5. 轮询审核与项目状态直至稳定（不可关终端）
```

命令示例见 [`create_survey.md`](create_survey.md)。

## 工作流 2：编辑问卷

```
1. 鉴权
2. list_projects → 选项目
3. fetch_project
4. 改项目信息 → update_project
5. 改题 → edit_question.js
6. 新增 → create_question.js
7. 删除 → delete_question.js
```

**编辑前**：收集中须先停止收集，再 **项目归档**（[`project_archive.md`](project_archive.md)），归档成功后才改题。`project_edit_guard.js` 会处理；也可手动 `publish_survey(stop)`。改完后不自动重新发布，需收集时手动 `publish_survey(publish)`。

## 工作流 3：数据

```
1. 鉴权
2. list_projects 或已知 project_id
3. 只要数字概况 → overview_stats.js
4. 可视化报表 → open_report.js（/report/topic/{id}）
5. 原始答卷 → export_data
```

## 数据模型（摘要）

```
问卷（Project）
├── project_id, title, ptype_enname, scene_type, status
├── begin_desc, end_desc, appearance_themenum
├── Pages[] → Questions[]
│   ├── question_id, question_type, title, is_required
│   ├── Options[]；MatrixRows[]
└── 报表 https://www.wenjuan.com/report/topic/{project_id}
    数据概况 overview_stats.js；原始数据 export_data
```

结构细节见 [`fetch_project.md`](fetch_project.md)、[`project_json_structure_guide.md`](project_json_structure_guide.md)。

## 常见错误码

### 认证（须重新登录）

| 错误码 | 说明 |
|--------|------|
| 20004 USER_NOT_EXIST | 用户不存在 |
| 20055 JWT_EXPIRED | token 过期 |
| 20056 CAN_NOT_GET_MID_FROM_JWT | jwt 无 mid |
| 20057 JWT_DECODE_ERROR | 解析失败 |
| 20058 GET_JWT_ERROR | 获取 JWT 失败 |
| 401 / Unauthorized | Token 失效 |

### 项目

| 错误 | 处理 |
|------|------|
| NOT_BIND_MOBILE | `bind_mobile.js` 后发布 |
| PROJECT_PUBLISHED / PROJECT_EDIT_DISABLED | 先停止收集 |
| PROJECT_NOT_FOUND | 检查 project_id |

### 题目

| 错误 | 处理 |
|------|------|
| QUESTION_NOT_FOUND | 检查 question_id |
| INVALID_PARAM | 检查参数 |

### 其他

| 错误 | 处理 |
|------|------|
| SIGNATURE_ERROR | 见 [`url_signing.md`](url_signing.md) |
| RATE_LIMIT | 稍后重试 |

## 注意事项

1. **编辑前**：`ensureReadyForEdit`：收集中则 stop → 归档成功后再编辑（[`project_archive.md`](project_archive.md)）；**禁止**在 Agent/自定义脚本中绕过（须走 `update_project` / `edit_question.updateQuestion` / `create_question.createQuestionApi` / `delete_question.deleteQuestion`）
2. **Token** 会过期，失效后重新登录（[`auth.md`](auth.md)）
3. **发布** 可能需要绑定手机号（[`bind_mobile.md`](bind_mobile.md)）
4. **签名** 带时间戳，需每次现算（[`url_signing.md`](url_signing.md)）
5. **脚本** 均为 Node.js；Token 路径由 **`token_store.js`** 统一（项目内 `.wenjuan/auth.json` 优先，其次 `~/.wenjuan` 等，见 [`auth.md`](auth.md)）
6. **默认路径**：主凭证常 **`~/.wenjuan/token.json`**；导出默认 **`~/.wenjuan/download/`**（可被环境变量与参数覆盖）

## 仓库目录结构

```
wenjuan-survey/
├── SKILL.md
├── setup.sh
├── package.json
├── scripts/
│   ├── workflow_create_and_publish.js
│   ├── list_projects.js, fetch_project.js, update_project.js
│   ├── publish.js, project_edit_guard.js, project_archive.js
│   ├── bind_mobile.js
│   ├── create_question.js, edit_question.js, delete_question.js
│   ├── export_data.js, overview_stats.js, open_report.js
│   ├── generate_sign.js, token_store.js
│   ├── login_auto.js
│   ├── check_version.js, pack_skill.sh, check_env.js
├── references/          # 各功能文档（本文件所在目录）
└── examples/            # 题目 JSON 示例
```
