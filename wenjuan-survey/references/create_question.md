# create_question - 新增题目

在问卷中新增一道题目。支持智能题型选择和交互式项目选择。

## 功能特点

- **智能题型选择**：根据项目类型自动选择合适的题目模板
- **交互式项目选择**：不指定项目ID时，自动列出项目供选择
- **编辑前置**：**`createQuestionApi` 在发起创建请求前**会调用 **`ensureReadyForEdit`**（停收 + 归档）；创建后需手动重新发布。**禁止**在外部直接拼装 `create_question` 请求而跳过该步骤。
- **智能题目生成**：在**再次拉取的最新项目结构**上，结合**项目标题 / 卷首说明（`begin_desc` 等）**与**已有题目题干摘要**，生成贴近主题的新题与默认选项；**题干**不与全卷已有题重复（规范化比对），**选项**尽量不与已有选择题选项字面重复（冲突时替换为备用文案）。未传 `--title` 时走上述逻辑；传了 `--title` 若与已有题干重复则报错退出。

## 执行流程

```
1. 获取项目信息（展示标题与类型）
2. 分析项目场景（调查/测评/表单）
3. 再次 fetch 最新结构 → 计算插入位置 + 基于最新项目信息与题目生成结构
4. 编辑前置：停止收集（若需）+ 项目归档成功（见 `project_archive.md`）
5. 调用 API 创建题目
```

## 接口

```bash
POST /app_api/edit/create_question/
```

## 参数

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `project_id` | string | 条件 | 项目ID（位置参数，不传则从列表选择） |
| `--type` | string | 否 | 题型：auto(自动)/single(单选)/multi(多选)/fill(填空)/judge(判断)，默认auto |
| `--title` | string | 否 | 题目标题（可选；不传则按最新结构中的项目信息 + 已有题目智能生成，见上文） |
| `--options` | string | 否 | 选项，逗号分隔（可选，不传则使用模板选项） |
| `--index` | int | 否 | 插入位置，0-based（默认末尾） |
| `-h, --help` | bool | 否 | 显示帮助信息 |

## 前置条件

**⚠️ 问卷必须处于停止状态才能新增题目。**

如正在收集中会先停止，并 **归档项目信息成功后** 再创建题目；创建后需手动重新发布（详见 `project_archive.md`）。

### Token 与请求体

- **JWT**：与 `fetch_project.js` 相同，由 `scripts/token_store.js` 统一读取：先 `.wenjuan/auth.json`，再用户级目录下 `token.json`、`access_token`（目录默认 `~/.wenjuan`，可 `WENJUAN_TOKEN_DIR` / `--token-dir`）。详见 `references/auth.md`。
- **`question_struct`**：调用 `create_question` 时，脚本会把 **`project_id`、`questionpage_id` 合并进 `question_struct` JSON**，与表单参数保持一致；缺少任一则不会发请求。
- **分页 ID**：除 `questionpage_id_list[0]` 外，会从 `questionpage_list[0]._id` 解析，支持 `{ "$oid": "..." }` 与**纯字符串**两种形式，并回退 `page_id` / `questionpage_id`。
- **`--options`**：对调查类 **单选（`--type single`）**、**多选（`--type multi`）**，若传入逗号分隔选项，会按列表 **完整重建 `option_list`**，不再受智能模板默认选项个数限制（测评类单选带分值时选项结构会保留分值字段）。

## 返回

```json
{
  "status": 200,
  "status_code": 1,
  "data": {
    "_id": { "$oid": "69cfb0f020c788511ffaabfb" },
    "title": "您平均每天的课外学习时间？",
    "question_type": 2,
    ...
  }
}
```

## CLI 调用示例

### 方式一：交互式选择项目（推荐）

```bash
# 不指定任何参数，从列表中选择项目
node "${SKILL_DIR}/scripts/create_question.js"

# 选择项目后，根据项目类型智能生成题目
```

### 方式二：指定项目ID

```bash
# 指定项目ID，智能生成题目
node "${SKILL_DIR}/scripts/create_question.js" 69cf1ec220c788db14aa18e8

# 指定项目ID和题型
node "${SKILL_DIR}/scripts/create_question.js" 69cf1ec220c788db14aa18e8 --type single

# 指定完整的题目信息
node "${SKILL_DIR}/scripts/create_question.js" 69cf1ec220c788db14aa18e8 \
  --type single \
  --title "您的性别？" \
  --options "男,女"
```

### 方式三：指定题目类型和内容

```bash
# 创建单选题
node "${SKILL_DIR}/scripts/create_question.js" 69cf1ec220c788db14aa18e8 \
  --type single \
  --title "您的性别？" \
  --options "男,女"

# 创建多选题
node "${SKILL_DIR}/scripts/create_question.js" 69cf1ec220c788db14aa18e8 \
  --type multi \
  --title "喜欢的颜色？" \
  --options "红,绿,蓝,黄"

# 创建填空题
node "${SKILL_DIR}/scripts/create_question.js" 69cf1ec220c788db14aa18e8 \
  --type fill \
  --title "请输入您的建议"

# 创建判断题
node "${SKILL_DIR}/scripts/create_question.js" 69cf1ec220c788db14aa18e8 \
  --type judge \
  --title "您是否满意当前服务？"

# 指定插入位置（0-based，默认末尾）
node "${SKILL_DIR}/scripts/create_question.js" 69cf1ec220c788db14aa18e8 \
  --type single \
  --title "新题目" \
  --options "A,B,C" \
  --index 2
```

## 智能题目模板

### 调查项目模板

| 序号 | 类型 | 标题 | 选项 |
|------|------|------|------|
| 1 | 单选题 | 您的性别是？ | 男、女 |
| 2 | 单选题 | 您的年龄段是？ | 18岁以下、18-25岁、26-35岁、36-50岁、50岁以上 |
| 3 | 单选题 | 您的学历是？ | 高中及以下、大专、本科、硕士、博士 |
| 4 | 多选题 | 您常用的社交媒体有哪些？ | 微信、微博、抖音、小红书、其他 |
| 5 | 填空题 | 请留下您的建议 | - |

### 测评项目模板

| 序号 | 类型 | 标题 | 选项 |
|------|------|------|------|
| 1 | 单选题 | 单选题 | 选项A、选项B、选项C、选项D |
| 2 | 多选题 | 多选题 | 选项A、选项B、选项C、选项D |
| 3 | 判断题 | 判断题 | 是、否 |
| 4 | 填空题 | 填空题 | - |

### 表单项目模板

| 序号 | 类型 | 标题 |
|------|------|------|
| 1 | 填空题 | 您的姓名 |
| 2 | 填空题 | 您的手机号码 |
| 3 | 填空题 | 您的邮箱 |

## 题目结构示例

```json
{
  "title": "您的性别",
  "question_type": 2,
  "custom_attr": {
    "show_seq": "on",
    "show_option_number": "on"
  },
  "option_list": [
    {
      "title": "男",
      "is_open": false,
      "custom_attr": {}
    },
    {
      "title": "女",
      "is_open": false,
      "custom_attr": {}
    }
  ]
}
```

## 题型代码

| 题型 | question_type | en_name |
|------|---------------|---------|
| 单选题 | 2 | QUESTION_TYPE_SINGLE |
| 多选题 | 3 | QUESTION_TYPE_MULTIPLE |
| 填空题 | 6 | QUESTION_TYPE_BLANK |
| 判断题 | 2 | QUESTION_TYPE_SINGLE（disp_type=judge） |
| 评分题 | 50 | QUESTION_TYPE_SCORE |
| 性别 | 2 | QUESTION_TYPE_SEX |

## 注意事项

1. **编辑前置**：收集中则自动停止，并 **完成项目归档** 后再创建题目；创建完成后需要手动重新发布（见 `project_archive.md`）
2. **智能生成**：如果不指定 `--title` 和 `--options`，会根据项目类型和已有题目数量自动生成合适的题目
3. **分页ID**：脚本会自动获取项目的第一个分页ID，如果项目没有分页会报错
4. **插入选项**：`--index` 参数指定插入位置，0 表示插入到第一题，不指定则添加到末尾

## 依赖脚本

- `fetch_project.js` - 获取项目结构
- `publish.js` - 停止/发布项目
- `list_projects.js` - 获取项目列表
- `generate_sign.js` - 生成API签名
