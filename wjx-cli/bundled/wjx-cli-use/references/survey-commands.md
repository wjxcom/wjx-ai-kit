# 问卷命令参考

> **全参数访问**: CLI 的显式 flags 是常用参数的子集。要使用 SDK 支持的全部参数，可通过 `--stdin` 传入 JSON：
> ```bash
> echo '{"vid":12345,"get_questions":true,"get_items":true,"format":"dsl"}' | wjx survey get --stdin
> ```

## wjx survey create

创建新问卷。

```bash
wjx survey create --title "标题" --type 1 --description "描述" --questions '<JSON>'
wjx survey create --title "标题" --source_vid 12345   # 复制已有问卷
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--title <s>` | 是 | 问卷标题 |
| `--type <n>` | 新建时是 | 1=调查, 2=测评, 3=投票, 6=考试, 7=表单 |
| `--description <s>` | 新建时是 | 问卷描述 |
| `--questions <json>` | 新建时是 | 题目 JSON 数组（格式见下方） |
| `--source_vid <s>` | 复制时是 | 源问卷编号（跳过 type/description/questions） |
| `--publish` | 否 | 创建后立即发布 |

**--stdin 可用的额外参数**: `creater`(创建者子账号), `compress_img`(压缩图片), `is_string`(原始格式)

### 题目 JSON 格式

```json
[{
  "q_index": 1,
  "q_type": 3,
  "q_subtype": 3,
  "q_title": "题目文本",
  "is_requir": true,
  "items": [
    {"q_index": 1, "item_index": 1, "item_title": "选项A"},
    {"q_index": 1, "item_index": 2, "item_title": "选项B"}
  ]
}]
```

**重要规则**：
- `q_subtype` 每题必填
- `q_title` 中不要包含题型标签（如[单选题]），题型由 q_type/q_subtype 决定
- 考试问卷设 `--type 6`，题目使用相同的 q_type 编码
- 多项填空（q_type=6）的 q_title 必须包含 `{_}` 占位符

完整 q_type/q_subtype 编码见 [question-types.md](question-types.md)。

## wjx survey create-by-text

用 DSL 文本创建问卷（**推荐 AI Agent 使用**）。

```bash
wjx survey create-by-text --text "标题\n\n1. 题目[单选题]\n选项A\n选项B"
wjx survey create-by-text --file survey.txt
cat survey.txt | wjx survey create-by-text --stdin
wjx survey create-by-text --text "..." --dry-run   # 预览解析结果
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--text <s>` | 三选一 | DSL 文本内容 |
| `--file <path>` | 三选一 | 从文件读取 DSL |
| `--stdin` | 三选一 | 从 stdin 读取 |
| `--type <n>` | 否 | 问卷类型（默认 1=调查，考试用 6） |
| `--publish` | 否 | 创建后发布 |
| `--creater <s>` | 否 | 创建者子账号 |
| `--dry-run` | 否 | 预览解析结果，不实际创建 |

DSL 语法详见 [dsl-syntax.md](dsl-syntax.md)。

## wjx survey list

查询问卷列表。

```bash
wjx survey list
wjx survey list --name_like "满意度" --status 1
```

| Flag | 说明 |
|------|------|
| `--page <n>` | 页码 |
| `--page_size <n>` | 每页数量 |
| `--status <n>` | 状态筛选：0=未发布, 1=已发布, 2=已暂停, 3=已删除, 5=被审核 |
| `--atype <n>` | 类型筛选：1=调查, 2=测评, 3=投票, 6=考试, 7=表单 |
| `--name_like <s>` | 名称模糊搜索（最多 10 字符） |

**--stdin 可用的额外参数**: `sort`(0-5 排序), `creater`(子账号筛选), `folder`(文件夹), `is_xingbiao`(星标), `query_all`(全部问卷), `verify_status`(审核状态), `time_type`(0=创建/1=开始/2=结束), `begin_time`/`end_time`(毫秒时间戳)

## wjx survey get

获取问卷详情。

```bash
wjx survey get --vid 12345
# 获取 DSL 文本格式（通过 --stdin）
echo '{"vid":12345,"format":"dsl"}' | wjx survey get --stdin
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--vid <n>` | 是 | 问卷编号 |

**--stdin 可用的额外参数**: `format`("json"/"dsl"/"both"), `get_questions`(获取题目), `get_items`(获取选项), `get_exts`(获取问答选项), `get_setting`(获取题目设置), `get_page_cut`(获取分页信息), `get_tags`(获取标签), `showtitle`(返回标题)

## wjx survey export-text

导出问卷为人类可读的 DSL 文本。

```bash
wjx survey export-text --vid 12345
wjx survey export-text --vid 12345 --raw   # 纯文本输出（不包裹 JSON）
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--vid <n>` | 是 | 问卷编号 |
| `--raw` | 否 | 输出纯文本而非 JSON |

## wjx survey status

修改问卷发布状态。

```bash
wjx survey status --vid 12345 --state 1   # 发布
wjx survey status --vid 12345 --state 2   # 暂停
wjx survey status --vid 12345 --state 3   # 删除
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--vid <n>` | 是 | 问卷编号 |
| `--state <n>` | 是 | 1=发布, 2=暂停, 3=删除 |

## wjx survey settings / update-settings

```bash
wjx survey settings --vid 12345
wjx survey update-settings --vid 12345 --time_setting '{"exam_min_seconds":60,"exam_max_seconds":3600}'
```

获取设置只需 `--vid`。更新设置的 flags：

| Flag | 说明 |
|------|------|
| `--vid <n>` | 问卷编号（必填） |
| `--api_setting <json>` | API 限制：`{"max_times":100,"pass_score":60,"pass_no_allow":true}` |
| `--after_submit_setting <json>` | 提交后跳转：`{"type":1,"url":"https://..."}` (type: 0=感谢信息, 1=跳转) |
| `--msg_setting <json>` | 数据推送：`{"push_url":"https://...","quick_post":true,"retry":true}` |
| `--sojumpparm_setting <json>` | 自定义参数：`{"params":[{"name":"source","type":0}]}` |
| `--time_setting <json>` | 时间设置：`{"start_time":"2026-04-01 00:00","exam_min_seconds":60}` |

## wjx survey delete

删除问卷（**不可逆**）。

```bash
wjx survey delete --vid 12345 --username admin
wjx survey delete --vid 12345 --username admin --completely   # 彻底删除，不进回收站
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--vid <n>` | 是 | 问卷编号 |
| `--username <s>` | 是 | 用户名 |
| `--completely` | 否 | 彻底删除（不进回收站） |

## wjx survey url

生成问卷创建/编辑链接（无需 API 签名）。

```bash
wjx survey url --mode create --name "新问卷"
wjx survey url --mode edit --activity 12345
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--mode <s>` | 否 | "create"（默认）或 "edit" |
| `--name <s>` | 否 | 问卷名称（create 模式） |
| `--activity <n>` | edit 模式是 | 问卷编号（edit 模式） |

## 其他 Survey 命令

| 命令 | 用法 |
|------|------|
| `wjx survey tags --username user` | 获取题目标签列表 |
| `wjx survey tag-details --tag_id 123` | 获取标签下的题目详情 |
| `wjx survey clear-bin --username user` | 清空回收站（可选 `--vid N` 指定问卷） |
| `wjx survey upload --file_name img.png --file <base64>` | 上传文件（png/jpg/gif/bmp/webp，~4MB） |
