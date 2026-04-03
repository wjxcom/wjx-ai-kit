# 问卷管理工具详解（12 tools）

## create_survey — 创建问卷

从零创建或复制已有问卷。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 问卷名称 |
| `atype` | number | 否 | 问卷类型：1=调查(默认), 2=测评, 3=投票, 6=考试, 7=表单 |
| `desc` | string | 否 | 问卷描述 |
| `publish` | boolean | 否 | 是否立即发布（默认 false） |
| `questions` | string | 否 | 题目列表 JSON 字符串 |
| `source_vid` | string | 否 | 源问卷编号（复制模式） |
| `creater` | string | 否 | 创建者子账号用户名 |
| `compress_img` | boolean | 否 | 是否压缩图片 |
| `is_string` | boolean | 否 | 是否使用原始 activity string 格式 |

## create_survey_by_text — 用 DSL 文本创建问卷（推荐）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `text` | string | 是 | DSL 格式的问卷文本（语法见 dsl-and-types.md） |
| `atype` | number | 否 | 问卷类型（默认 1=调查） |
| `publish` | boolean | 否 | 是否立即发布（默认 false） |
| `creater` | string | 否 | 创建者子账号用户名 |

## get_survey — 获取问卷详情

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `format` | "json" \| "dsl" \| "both" | 否 | 返回格式（默认 "json"） |
| `get_questions` | boolean | 否 | 是否获取题目（默认 true） |
| `get_items` | boolean | 否 | 是否获取选项（默认 true） |
| `get_exts` | boolean | 否 | 是否获取问答选项列表 |
| `get_setting` | boolean | 否 | 是否获取题目设置 |
| `get_page_cut` | boolean | 否 | 是否获取分页信息 |
| `get_tags` | boolean | 否 | 是否获取标签信息 |
| `showtitle` | boolean | 否 | 是否返回标题 |

## list_surveys — 问卷列表查询

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page_index` | number | 否 | 页码（默认 1） |
| `page_size` | number | 否 | 每页数量（默认 10，最大 300） |
| `status` | number | 否 | 状态筛选 |
| `atype` | number | 否 | 类型筛选 |
| `name_like` | string | 否 | 名称模糊搜索（最多 10 字符） |
| `sort` | number | 否 | 排序方式（0-5） |
| `creater` | string | 否 | 子账号用户名筛选 |
| `folder` | string | 否 | 文件夹筛选 |
| `is_xingbiao` | boolean | 否 | 只获取星标问卷 |
| `query_all` | boolean | 否 | 获取企业所有问卷 |
| `verify_status` | number | 否 | 审核状态筛选 |
| `time_type` | number | 否 | 时间查询类型（0-2） |
| `begin_time` | number | 否 | 起始时间（毫秒时间戳） |
| `end_time` | number | 否 | 结束时间（毫秒时间戳） |

## update_survey_status — 修改问卷状态

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `state` | number | 是 | 目标状态：1=发布, 2=暂停, 3=删除 |

## get_survey_settings — 获取问卷设置

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `additional_setting` | string | 否 | 设置类别 JSON 数组（默认 `[1000,1001,1002,1003,1004,1005,1006,1007]`） |

## update_survey_settings — 修改问卷设置

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `api_setting` | string/JSON | 否 | API 请求次数限制设置 |
| `after_submit_setting` | string/JSON | 否 | 作答后跳转设置 |
| `msg_setting` | string/JSON | 否 | 数据推送设置 |
| `sojumpparm_setting` | string/JSON | 否 | 自定义链接参数设置 |
| `time_setting` | string/JSON | 否 | 时间设置 |

## delete_survey — 删除问卷（不可恢复）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `username` | string | 是 | 用户名 |
| `completely_delete` | boolean | 否 | 是否彻底删除 |

## get_question_tags — 获取题目标签

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | 是 | 用户名 |

## get_tag_details — 获取题目标签详情

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tag_id` | number | 是 | 标签 ID |

## upload_file — 上传文件

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file_name` | string | 是 | 文件名（含扩展名） |
| `file` | string | 是 | Base64 编码的文件内容 |

## clear_recycle_bin — 清空回收站

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | 是 | 用户名 |
| `vid` | number | 否 | 问卷编号（指定则只清空该问卷） |
