# WJX MCP Server API 参考

本文档根据 `src/modules/*/tools.ts`、`src/resources/index.ts` 与 `src/prompts/*.ts` 的源码定义整理，作为当前 MCP Server 能力清单。

## 概览

- Tools: 54 个，分为 7 个模块
- Resources: 7 个
- Prompts: 10 个
- 参数字段、必填项与默认值以源码中的 Zod schema 为准
- 返回值说明为调用语义摘要，实际响应字段仍以问卷星 OpenAPI 返回为准

## Tools

### 问卷管理

问卷的创建、读取、设置与生命周期管理。

#### `create_survey` - 创建问卷

通过问卷星 OpenAPI 创建新问卷。支持问卷调查(1)、测评(2)、投票(3)、考试(6)、表单(7)等类型。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| title | string | 是 | - | 问卷名称 |
| atype | number | 是 | - | 问卷类型：1=调查, 2=测评, 3=投票, 6=考试, 7=表单 |
| desc | string | 是 | - | 问卷描述 |
| publish | boolean | 否 | false | 是否立即发布 |
| questions | string | 是 | - | 题目列表 JSON 字符串。每个题目必须包含 q_index（题号）和 q_type（题型编码：3=单选,4=多选,5=填空,6=多项填空,7=矩阵,8=文件上传,9=比重,10=滑动条,1=分页,2=段落）。选择题需包含 items 数组。示例：[{"q_index":1,"q_type":3,"q_title":"您的性别","items":[{"q_index":1,"item_index":1,"item_title":"男"},{"q_index":1,"item_index":2,"item_title":"女"}]}] |

**返回值说明**

返回创建结果，通常包含新建问卷的编号、接口状态以及是否已发布。

#### `get_survey` - 获取问卷内容

根据问卷编号获取问卷详情，包括题目和选项信息。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| vid | number | 是 | - | 问卷编号 |
| get_questions | boolean | 否 | true | 是否获取题目信息 |
| get_items | boolean | 否 | true | 是否获取选项信息 |

**返回值说明**

返回问卷详情对象，包含问卷基本信息，以及按参数决定是否带出题目与选项结构。

#### `list_surveys` - 获取问卷列表

分页获取账户下的问卷列表，可按状态、类型、名称筛选。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| page_index | number | 否 | 1 | 页码，从1开始 |
| page_size | number | 否 | 10 | 每页数量（1-300） |
| status | number | 否 | - | 问卷状态筛选 |
| atype | number | 否 | - | 问卷类型筛选：1=调查, 2=测评, 3=投票, 6=考试, 7=表单 |
| name_like | string | 否 | - | 按名称模糊搜索（最长10字符） |
| sort | number | 否 | - | 排序：0=ID升序, 1=ID降序, 2=开始时间升序, 3=开始时间降序, 4=创建时间升序, 5=创建时间降序 |

**返回值说明**

返回分页问卷列表，包含当前页数据、总量或游标类分页信息。

#### `update_survey_status` - 修改问卷状态

修改问卷的发布状态：发布(1)、暂停(2)、删除(3)。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| vid | number | 是 | - | 问卷编号 |
| state | number | 是 | - | 目标状态：1=发布, 2=暂停, 3=删除 |

**返回值说明**

返回状态更新结果，标识发布、暂停或删除动作是否执行成功。

#### `get_survey_settings` - 获取问卷设置

获取问卷的详细设置，包括时间设置、提交后跳转、考试设置、维度、奖品、数据推送等。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| vid | number | 是 | - | 问卷编号 |
| additional_setting | string | 否 | "[1000,1001,1002,1003,1004,1005]" | 要获取的设置类别 JSON 数组字符串。默认获取全部：1000=基本信息, 1001=提交后设置, 1002=时间设置, 1003=消息推送, 1004=参数设置, 1005=API设置 |

**返回值说明**

返回问卷配置详情，包含基础设置、时间设置、提交后行为、消息推送和 API 设置等字段。

#### `update_survey_settings` - 修改问卷设置

修改问卷的设置，包括 API 限制、提交后跳转、数据推送、自定义参数、时间设置等。每个设置项为 JSON 字符串。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| vid | number | 是 | - | 问卷编号 |
| api_setting | string | 否 | - | API请求次数限制设置 JSON |
| after_submit_setting | string | 否 | - | 作答后跳转设置 JSON |
| msg_setting | string | 否 | - | 数据推送设置 JSON |
| sojumpparm_setting | string | 否 | - | 自定义链接参数设置 JSON |
| time_setting | string | 否 | - | 时间设置 JSON（开始/结束时间、每日时段、考试时间限制等） |

**返回值说明**

返回设置更新结果，以及服务端接受并保存配置的状态信息。

#### `delete_survey` - 删除问卷

永久删除问卷。可选择彻底删除（不进回收站）。此操作不可逆，请谨慎使用。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| vid | number | 是 | - | 问卷编号 |
| username | string | 是 | - | 用户名（主账户/系统管理员/问卷创建者子账号） |
| completely_delete | boolean | 否 | - | 是否彻底删除（不进回收站） |

**返回值说明**

返回删除结果，标识问卷是否已移入回收站或被彻底删除。

#### `get_question_tags` - 获取题目标签

获取指定用户所在企业的所有题目标签列表。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 用户名 |

**返回值说明**

返回题目标签列表，包含标签编号、名称及关联统计信息。

#### `get_tag_details` - 获取题目标签详情

根据标签 ID 获取标签下的题目详情列表，包括关联的问卷、题目类型和标签名称。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| tag_id | number | 是 | - | 标签 ID |

**返回值说明**

返回指定标签下的题目明细，通常包含问卷信息、题号、题型与标签名称。

#### `clear_recycle_bin` - 清空回收站

清空回收站中的问卷。若指定 vid 则仅彻底删除该问卷，否则清空整个回收站。此操作不可逆！

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 用户名（只能清空该用户创建的问卷） |
| vid | number | 否 | - | 问卷编号（指定则仅删除该问卷，否则清空回收站） |

**返回值说明**

返回清空结果，说明已彻底删除的问卷范围或指定 vid 的处理状态。

### 答卷管理

答卷查询、下载、提交、修改与清空。

#### `query_responses` - 答卷查询

查询问卷的答卷数据，支持分页、时间范围、条件筛选。返回答卷明细包括提交时间、来源、IP、各题答案等。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| vid | number | 是 | - | 问卷编号 |
| valid | boolean | 否 | - | 是否查询有效答卷，默认true |
| page_index | number | 否 | - | 分页页码，默认1 |
| page_size | number | 否 | - | 每页答卷数，默认10，最大50 |
| sort | number | 否 | - | 排序：0=升序, 1=降序 |
| min_index | number | 否 | - | 最小答卷序号，返回大于此序号的答卷 |
| jid | string | 否 | - | 答卷编号，多个用逗号分隔，最多50个 |
| sojumpparm | string | 否 | - | 自定义链接参数，多个用逗号分隔，最多50个 |
| qid | string | 否 | - | 指定返回的题目编号列表，逗号分隔，最多50个 |
| begin_time | number | 否 | - | 查询开始时间（Unix毫秒时间戳） |
| end_time | number | 否 | - | 查询结束时间（Unix毫秒时间戳） |
| file_view_expires | number | 否 | - | 文件上传题链接有效期（小时），默认1 |
| query_note | boolean | 否 | - | 是否查询标注信息 |
| distinct_user | boolean | 否 | - | 是否仅返回用户最新答卷 |
| distinct_sojumpparm | boolean | 否 | - | 是否仅返回自定义参数最新答卷 |
| conds | string | 否 | - | 题目查询条件 JSON 字符串，最多2个条件，AND关系 |

**返回值说明**

返回分页答卷明细列表，含提交时间、来源、IP、submitdata 及问卷相关元数据。

#### `query_responses_realtime` - 答卷实时查询

实时查询新提交的答卷（队列模式）。查询成功的答卷将从队列移除，无法二次查询。需联系客服开通白名单。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| vid | number | 是 | - | 问卷编号 |
| count | number | 否 | - | 每次获取的答卷数量 |

**返回值说明**

返回实时队列中的新答卷；成功读取后这些记录会从队列移除。

#### `download_responses` - 答卷下载

批量下载答卷数据，支持 CSV/SAV/Word 格式。超过3000条自动转为异步任务，返回 taskid 用于轮询。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| vid | number | 是 | - | 问卷编号 |
| taskid | string | 否 | - | 异步任务 ID（用于轮询下载状态） |
| valid | boolean | 否 | - | 是否查询有效答卷，默认true |
| query_count | number | 否 | - | 查询的最大答卷条数 |
| begin_time | number | 否 | - | 查询开始时间（Unix毫秒时间戳） |
| end_time | number | 否 | - | 查询结束时间（Unix毫秒时间戳） |
| min_index | number | 否 | - | 最小答卷序号 |
| qid | string | 否 | - | 指定问题列表，逗号分隔，最多50个 |
| sort | number | 否 | - | 排序：0=升序, 1=降序 |
| query_type | number | 否 | - | 查询方式：0=按文本, 1=按分数, 2=按序号 |
| suffix | number | 否 | - | 文件格式：0=CSV, 1=SAV, 2=Word |
| query_record | boolean | 否 | - | 仅查询参与作答记录（不限制答卷数） |

**返回值说明**

返回下载任务结果；同步场景提供下载地址，异步场景返回 taskid 与轮询状态。

#### `get_report` - 默认报告查询

获取问卷的统计报告，包含各题选项频次统计、平均分、总分等聚合数据。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| vid | number | 是 | - | 问卷编号 |
| valid | boolean | 否 | - | 是否查询有效答卷，默认true |
| min_index | number | 否 | - | 最小答卷序号 |
| jid | string | 否 | - | 答卷编号，多个用逗号分隔 |
| sojumpparm | string | 否 | - | 自定义链接参数，多个用逗号分隔 |
| begin_time | number | 否 | - | 查询开始时间（Unix毫秒时间戳） |
| end_time | number | 否 | - | 查询结束时间（Unix毫秒时间戳） |
| distinct_user | boolean | 否 | - | 是否仅用户最新答卷 |
| distinct_sojumpparm | boolean | 否 | - | 是否仅自定义参数最新答卷 |
| conds | string | 否 | - | 题目查询条件 JSON 字符串 |

**返回值说明**

返回问卷统计报告，包含各题频次、均值、总分或其他聚合指标。

#### `submit_response` - 答卷提交

向问卷提交答卷数据（代填/导入）。答卷格式：题号$答案}题号$答案，详见问卷星答卷格式规范。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| vid | number | 是 | - | 问卷编号 |
| inputcosttime | number | 是 | - | 填写时间（秒），需&gt;1秒否则视为机器提交 |
| submitdata | string | 是 | - | 答卷内容字符串，格式：题号$答案}题号$答案 |
| udsid | number | 否 | - | 自定义来源编号 |
| sojumpparm | string | 否 | - | 自定义链接参数 |

**返回值说明**

返回代填/导入答卷的提交结果，通常包含答卷编号、提交状态和错误信息。

#### `get_file_links` - 获取文件链接

获取答卷中文件上传题的文件访问和下载链接（仅限混合云/私有化场景）。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| vid | number | 是 | - | 问卷编号 |
| file_keys | string | 是 | - | 文件键值列表 JSON 字符串，一次最多100个 |
| file_view_expires | number | 否 | - | 链接有效期（小时），默认1 |

**返回值说明**

返回文件上传题的访问链接与下载链接集合。

#### `get_winners` - 获取中奖者信息

获取问卷的中奖者信息列表，支持按奖品类型和发放状态筛选，支持分页。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| vid | number | 是 | - | 问卷编号 |
| atype | number | 否 | - | 奖品类型：0=其他奖品, 1=微信红包, -1=不限 |
| awardstatus | number | 否 | - | 发放状态：0=未发放, 1=已发放, -1=不限 |
| page_index | number | 否 | - | 页码，默认1 |
| page_size | number | 否 | - | 每页数量（1-100），默认10 |

**返回值说明**

返回中奖者分页列表，含奖品类型、发放状态和中奖人信息。

#### `modify_response` - 修改答卷

修改答卷数据。当前仅支持修改考试问卷的主观题分数（type=1）。answers 为 JSON 字符串，格式 {题号: 分数}。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| vid | number | 是 | - | 问卷编号 |
| jid | number | 是 | - | 答卷编号 |
| type | literal | 是 | - | 修改类型：1=修改分数（目前仅支持1） |
| answers | string | 是 | - | 分数修改 JSON 字符串，格式：{"题号":"分数"} |

**返回值说明**

返回答卷修改结果，说明指定答卷是否已成功更新。

#### `get_360_report` - 360度评估报告下载

下载360度评估报告的详细数据（XLS格式）。异步模式：首次调用可能返回 status=0 和 taskid，需再次调用并传入 taskid 轮询直到 status=1 获取下载链接。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| vid | number | 是 | - | 问卷编号 |
| taskid | string | 否 | - | 异步任务 ID（用于轮询下载状态） |

**返回值说明**

返回 360 评估报告下载状态；异步未完成时给出 taskid，完成后给出下载地址。

#### `clear_responses` - 清空答卷数据

清空指定问卷的所有答卷数据。此操作不可逆！可选择是否重置答卷序号为0。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 用户名（主账户/系统管理员/问卷创建者子账号） |
| vid | number | 是 | - | 问卷编号 |
| reset_to_zero | boolean | 是 | - | 是否将答卷序号重置为0 |

**返回值说明**

返回答卷清空结果，说明是否已删除全部答卷以及是否重置序号。

### 本地分析

纯本地计算类工具，不调用问卷星远程 API。

#### `decode_responses` - 解码答卷数据

解析问卷星 submitdata 格式（题号$答案}题号$答案），识别单选、多选（管道符分隔）、填空和矩阵题型。纯本地计算，不调用 API。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| submitdata | string | 是 | - | 问卷星原始 submitdata 字符串，格式为 题号$答案}题号$答案 |

**返回值说明**

返回本地解析结果，将 submitdata 拆解成结构化题目答案列表。

#### `calculate_nps` - 计算 NPS 净推荐值

根据 0-10 评分数组计算 NPS（净推荐值），输出推荐者/中立者/贬损者数量与比例，以及评级（>70优秀, 50-70良好, 0-50一般, <0较差）。纯本地计算。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| scores | array | 是 | - | 0-10 评分数组 |

**返回值说明**

返回 NPS 计算结果，包含推荐者/被动者/贬损者人数、占比、NPS 分数与评级。

#### `calculate_csat` - 计算 CSAT 满意度

根据评分数组计算 CSAT（客户满意度），支持 5 分制（4-5 为满意）和 7 分制（5-7 为满意）。输出满意率、满意人数、分值分布。纯本地计算。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| scores | array | 是 | - | 评分数组（5分制: 1-5, 7分制: 1-7） |
| scale_type | enum(5-point, 7-point) | 否 | "5-point" | 量表类型：5-point（默认）或 7-point |

**返回值说明**

返回 CSAT 计算结果，包含满意率、满意人数、总样本数和分值分布。

#### `detect_anomalies` - 检测异常答卷

检测异常答卷：直线作答（所有答案相同）、速度异常（答题时间 < 中位数 30%）、IP+内容重复。纯本地计算。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| responses | array | 是 | - | 答卷记录数组 |

**返回值说明**

返回异常检测结果，列出疑似直线作答、异常速度或重复提交的记录。

#### `compare_metrics` - 对比指标数据

对比两组指标数据（A/B），输出每个指标的差值、变化率和显著性标记（|变化率|>10% 为显著）。纯本地计算。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| set_a | record | 是 | - | 指标集 A（键为指标名，值为数值） |
| set_b | record | 是 | - | 指标集 B（键为指标名，值为数值） |

**返回值说明**

返回两组指标的差值、变化率以及显著性标记。

#### `decode_push_payload` - 解密推送数据

解密问卷星数据推送的 AES-128-CBC 加密载荷。密钥为 MD5(appKey) 前 16 字符，IV 为密文前 16 字节，PKCS7 填充。可选验证 SHA1(rawBody+appKey) 签名。纯本地计算。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| encrypted_data | string | 是 | - | Base64 编码的加密数据 |
| app_key | string | 是 | - | 应用的 AppKey |
| signature | string | 否 | - | SHA1 签名（可选，用于验签） |
| raw_body | string | 否 | - | 原始请求体（可选，用于验签） |

**返回值说明**

返回解密后的推送原文、解析后的 JSON 以及可选的签名校验结果。

### 通讯录

企业通讯录成员、部门、标签与管理员管理。

#### `query_contacts` - 查询通讯录成员

查询通讯录中的联系人成员列表，可按部门筛选并分页获取。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 账户用户名 |
| dept_id | number | 否 | - | 部门 ID，不传则查询全部 |
| page_index | number | 否 | - | 页码，从1开始 |
| page_size | number | 否 | - | 每页数量（1-100） |

**返回值说明**

返回通讯录成员分页列表，可附带部门、联系方式和扩展字段。

#### `add_contacts` - 批量添加通讯录成员

批量添加通讯录联系人。members 为 JSON 数组字符串，每个成员对象包含 name、mobile、email、dept_id、ext 等字段。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 账户用户名 |
| members | string | 是 | - | 成员列表 JSON 字符串（数组），每个对象包含 name、mobile、email、dept_id、ext 等字段 |

**返回值说明**

返回批量导入结果，包含成功/失败条目及对应原因。

#### `manage_contacts` - 管理通讯录成员

更新或删除通讯录成员。operation 为 "update" 或 "delete"。更新时 members 为包含 id 及待修改字段的对象数组 JSON；删除时 members 为成员 ID 数组 JSON。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 账户用户名 |
| operation | enum(update, delete) | 是 | - | 操作类型：update=更新, delete=删除 |
| members | string | 是 | - | 成员数据 JSON 字符串。更新：对象数组（含 id 及待改字段）；删除：成员 ID 数组 |

**返回值说明**

返回更新或删除结果，标识各成员记录的处理状态。

#### `add_admin` - 添加管理员

添加一个新的通讯录管理员，可指定手机号、邮箱和角色。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 账户用户名 |
| admin_name | string | 是 | - | 管理员姓名 |
| mobile | string | 否 | - | 管理员手机号 |
| email | string | 否 | - | 管理员邮箱 |
| role | string | 否 | - | 管理员角色 |

**返回值说明**

返回新增管理员结果，通常包含管理员编号与角色信息。

#### `delete_admin` - 删除管理员

删除指定的通讯录管理员。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 账户用户名 |
| admin_id | number | 是 | - | 管理员 ID |

**返回值说明**

返回管理员删除结果。

#### `restore_admin` - 恢复管理员

恢复已删除的通讯录管理员。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 账户用户名 |
| admin_id | number | 是 | - | 管理员 ID |

**返回值说明**

返回管理员恢复结果。

#### `list_departments` - 查询部门列表

查询通讯录中的部门列表，支持分页获取。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 账户用户名 |
| page_index | number | 否 | - | 页码，从1开始 |
| page_size | number | 否 | - | 每页数量（1-100） |

**返回值说明**

返回部门分页列表，包含部门编号、名称和父子层级信息。

#### `add_department` - 添加部门

添加一个新的部门，可指定父部门 ID。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 账户用户名 |
| name | string | 是 | - | 部门名称 |
| parent_id | number | 否 | - | 父部门 ID |

**返回值说明**

返回新建部门结果，通常包含部门编号与父部门关系。

#### `modify_department` - 修改部门

修改部门信息，可更新名称和父部门。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 账户用户名 |
| dept_id | number | 是 | - | 部门 ID |
| name | string | 否 | - | 新部门名称 |
| parent_id | number | 否 | - | 新父部门 ID |

**返回值说明**

返回部门修改结果。

#### `delete_department` - 删除部门

删除指定的部门。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 账户用户名 |
| dept_id | number | 是 | - | 部门 ID |

**返回值说明**

返回部门删除结果。

#### `list_tags` - 查询标签列表

查询通讯录中的所有标签。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 账户用户名 |

**返回值说明**

返回标签列表，包含标签编号与名称。

#### `add_tag` - 添加标签

添加一个新的通讯录标签。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 账户用户名 |
| tag_name | string | 是 | - | 标签名称 |

**返回值说明**

返回新建标签结果，通常包含标签编号。

#### `modify_tag` - 修改标签

修改通讯录标签名称。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 账户用户名 |
| tag_id | number | 是 | - | 标签 ID |
| tag_name | string | 是 | - | 新标签名称 |

**返回值说明**

返回标签修改结果。

#### `delete_tag` - 删除标签

删除指定的通讯录标签。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 账户用户名 |
| tag_id | number | 是 | - | 标签 ID |

**返回值说明**

返回标签删除结果。

### 用户系统

参与者导入、修改、删除与问卷绑定查询。

#### `add_participants` - 批量添加参与者

向用户系统批量添加参与者（每次最多100人）。users 为 JSON 数组字符串，每个对象包含 uid、uname、upass、udept、uextf 字段。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 主账户用户名 |
| users | string | 是 | - | 参与者列表 JSON 字符串（数组），每项包含: uid(用户ID), uname(姓名), upass(密码), udept(部门), uextf(扩展字段) |
| usid | number | 是 | - | 用户系统 ID |

**返回值说明**

返回参与者批量添加结果，包含成功/失败统计和逐项错误信息。

#### `modify_participants` - 批量修改参与者

批量修改用户系统中参与者的信息。users 为 JSON 数组字符串，每个对象包含 uid、uname、upass、udept、uextf 字段。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 主账户用户名 |
| users | string | 是 | - | 参与者列表 JSON 字符串（数组），每项包含: uid(用户ID), uname(姓名), upass(密码), udept(部门), uextf(扩展字段) |
| usid | number | 是 | - | 用户系统 ID |

**返回值说明**

返回参与者批量修改结果，包含逐项处理状态。

#### `delete_participants` - 批量删除参与者

从用户系统中批量删除参与者。此操作不可逆，请谨慎使用！uids 为逗号分隔的用户 ID 列表。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 主账户用户名 |
| uids | string | 是 | - | 参与者 ID 列表，逗号分隔 |
| usid | number | 是 | - | 用户系统 ID |

**返回值说明**

返回参与者批量删除结果，说明已删除用户及失败原因。

#### `query_survey_binding` - 查询问卷用户绑定

查询问卷与用户系统的绑定关系，返回绑定的参与者列表，支持分页。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 主账户用户名 |
| vid | number | 是 | - | 问卷编号 |
| usid | number | 是 | - | 用户系统 ID |
| page_index | number | 否 | - | 页码，从1开始 |
| page_size | number | 否 | - | 每页数量（1-100） |

**返回值说明**

返回问卷与用户系统的绑定列表，含参与者信息和分页数据。

#### `query_user_surveys` - 查询用户关联问卷

查询指定参与者被分配的问卷列表，支持分页。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 主账户用户名 |
| uid | string | 是 | - | 参与者 ID |
| usid | number | 是 | - | 用户系统 ID |
| page_index | number | 否 | - | 页码，从1开始 |
| page_size | number | 否 | - | 每页数量（1-100） |

**返回值说明**

返回指定参与者关联的问卷列表和分页信息。

### 多账号

主账号下的子账号生命周期管理。

#### `add_sub_account` - 创建子账号

在主账户下创建子账号。可指定角色：1=系统管理员, 2=问卷管理员, 3=统计结果查看员, 4=完整结果查看员。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 主账户用户名 |
| subuser | string | 是 | - | 子账号用户名 |
| password | string | 是 | - | 子账号密码 |
| mobile | string | 否 | - | 手机号 |
| email | string | 否 | - | 邮箱 |
| role_id | number | 否 | - | 角色：1=系统管理员, 2=问卷管理员, 3=统计结果查看员, 4=完整结果查看员 |

**返回值说明**

返回子账号创建结果，通常包含子账号编号或登录标识。

#### `modify_sub_account` - 修改子账号

修改子账号的信息，包括密码、手机号、邮箱、角色等。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 主账户用户名 |
| subuser | string | 是 | - | 子账号用户名 |
| password | string | 否 | - | 新密码 |
| mobile | string | 否 | - | 手机号 |
| email | string | 否 | - | 邮箱 |
| role_id | number | 否 | - | 角色：1=系统管理员, 2=问卷管理员, 3=统计结果查看员, 4=完整结果查看员 |

**返回值说明**

返回子账号修改结果。

#### `delete_sub_account` - 删除子账号

删除子账号（可通过 restore_sub_account 恢复）。请谨慎使用。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 主账户用户名 |
| subuser | string | 是 | - | 子账号用户名 |

**返回值说明**

返回子账号删除结果。

#### `restore_sub_account` - 恢复子账号

恢复已删除的子账号。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 主账户用户名 |
| subuser | string | 是 | - | 子账号用户名 |

**返回值说明**

返回子账号恢复结果。

#### `query_sub_accounts` - 查询子账号列表

查询主账户下的子账号列表，支持分页。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 主账户用户名 |
| page_index | number | 否 | - | 页码，从1开始 |
| page_size | number | 否 | - | 每页数量（1-100） |

**返回值说明**

返回子账号分页列表，包含角色、联系方式与状态。

### SSO / URL

单点登录链接与问卷创建/编辑链接生成。

#### `sso_subaccount_url` - 生成子账号SSO登录链接

生成子账号单点登录（SSO）链接，用于子账号免密登录或自动创建子账号。签名有效期60秒。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| subuser | string | 是 | - | 子账号用户名 |
| mobile | string | 否 | - | 手机号 |
| email | string | 否 | - | 邮箱 |
| role_id | number | 否 | - | 角色 ID（1-4） |
| url | string | 否 | - | 登录后跳转地址 |
| admin | number | 否 | - | 设为 1 时以主账号身份登录 |

**返回值说明**

返回子账号 SSO 登录链接，以及可能的过期时间或签名相关信息。

#### `sso_user_system_url` - 生成用户系统SSO链接

生成用户系统参与者的单点登录（SSO）链接，用于用户系统中的成员免密登录。签名有效期300秒。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| u | string | 是 | - | 账户用户名 |
| user_system | number | 否 | 1 | 用户系统标志（固定为 1） |
| system_id | number | 是 | - | 用户系统 ID |
| uid | string | 是 | - | 参与者 ID |
| uname | string | 否 | - | 参与者姓名 |
| udept | string | 否 | - | 参与者部门 |
| uextf | string | 否 | - | 扩展字段 |
| upass | string | 否 | - | 密码 |
| is_login | number | 否 | - | 是否登录（0 或 1） |
| activity | number | 否 | - | 跳转到的问卷编号 |
| return_url | string | 否 | - | 返回地址 |

**返回值说明**

返回用户系统参与者 SSO 登录链接。

#### `sso_partner_url` - 生成合作伙伴SSO登录链接

生成合作伙伴/代理商的单点登录（SSO）链接，用于合作伙伴免密登录。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| username | string | 是 | - | 合作伙伴账号用户名 |
| mobile | string | 否 | - | 手机号 |
| subuser | string | 否 | - | 子账号用户名 |

**返回值说明**

返回合作伙伴或代理商 SSO 登录链接。

#### `build_survey_url` - 生成问卷创建/编辑链接

生成快速创建或编辑问卷的 URL（无需签名）。创建模式生成空白问卷链接，编辑模式生成问卷编辑器链接（需提供 activity 问卷编号）。

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| mode | enum(create, edit) | 是 | - | 模式：create=创建, edit=编辑 |
| name | string | 否 | - | 问卷名称（仅创建模式） |
| qt | number | 否 | - | 问卷类型（仅创建模式） |
| osa | number | 否 | - | 设为 1 自动发布（仅创建模式） |
| redirect_url | string | 否 | - | 操作后跳转地址 |
| activity | number | 否 | - | 问卷编号（编辑模式必填） |
| editmode | number | 否 | - | 编辑模式（仅编辑模式） |
| runprotect | number | 否 | - | 运行保护标志（仅编辑模式） |

**返回值说明**

返回可直接访问的问卷创建或编辑 URL。

## Resources

### `survey-types`

- URI 模式: `wjx://reference/survey-types`
- 描述: 问卷星支持的问卷类型列表（调查/测评/投票/考试/表单等）
- MIME Type: `application/json`
- 返回内容: 返回问卷类型编码字典，帮助调用方选择 atype。

### `question-types`

- URI 模式: `wjx://reference/question-types`
- 描述: 问卷星题目类型与细分类型完整列表
- MIME Type: `application/json`
- 返回内容: 返回题型与细分题型编码字典，便于构造 create_survey 的 questions。

### `survey-statuses`

- URI 模式: `wjx://reference/survey-statuses`
- 描述: 问卷状态与审核状态编码说明
- MIME Type: `application/json`
- 返回内容: 返回问卷状态和审核状态编码说明。

### `analysis-methods`

- URI 模式: `wjx://reference/analysis-methods`
- 描述: NPS/CSAT/CES 分析方法的计算公式与行业基准
- MIME Type: `application/json`
- 返回内容: 返回 NPS、CSAT、CES 等分析方法说明与参考基准。

### `response-format`

- URI 模式: `wjx://reference/response-format`
- 描述: 问卷星答卷 submitdata 字段的编码格式说明
- MIME Type: `application/json`
- 返回内容: 返回 submitdata 编码规则，说明题号、分隔符和多选格式。

### `user-roles`

- URI 模式: `wjx://reference/user-roles`
- 描述: 多账号子账号角色编码说明
- MIME Type: `application/json`
- 返回内容: 返回多账号子账号角色编码与含义映射。

### `push-format`

- URI 模式: `wjx://reference/push-format`
- 描述: 问卷星数据推送格式、AES加密与签名验证说明
- MIME Type: `application/json`
- 返回内容: 返回问卷推送载荷格式、AES 解密与签名验证说明。

## Prompts

### `design-survey`

- 用途: 帮助 AI 规划问卷结构，并产出可直接传给 create_survey 的 questions JSON。
- 描述: 引导 AI 设计问卷结构，包含题型选择、逻辑跳转和选项设计

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| topic | string | 是 | - | 问卷主题（如：员工满意度、客户反馈、产品调研） |
| target_audience | string | 否 | - | 目标受众（如：企业员工、消费者、学生） |
| survey_type | string | 否 | - | 问卷类型：调查/测评/考试/投票/表单 |

### `analyze-results`

- 用途: 指导 AI 组合 get_survey、get_report 与 query_responses 生成分析报告。
- 描述: 引导 AI 获取并分析问卷数据，生成洞察报告

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| survey_id | string | 是 | - | 问卷编号 (vid) |
| focus_areas | string | 否 | - | 关注重点（如：满意度趋势、NPS 分析、交叉分析） |

### `create-nps-survey`

- 用途: 快速生成标准 NPS 问卷，并输出 create_survey 调用草稿。
- 描述: 一键创建标准 NPS（净推荐值）问卷

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| product_name | string | 是 | - | 产品或服务名称 |
| language | string | 否 | - | 问卷语言：zh（默认）或 en |

### `configure-webhook`

- 用途: 指导配置数据推送 URL、加密与签名验证，并串联 decode_push_payload。
- 描述: 引导配置问卷星数据推送（Webhook），包括推送URL设置、加密配置、签名验证和测试

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| vid | string | 是 | - | 问卷编号 (vid) |

### `nps-analysis`

- 用途: 面向 NPS 场景的完整分析流程模板。
- 描述: NPS净推荐值完整分析：计算NPS得分、分类分布、趋势对比与改进建议

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| survey_id | string | 是 | - | 问卷编号 (vid) |
| time_range | string | 否 | - | 时间范围（如：最近7天、2024-01至2024-03） |

### `csat-analysis`

- 用途: 面向满意度问卷的完整分析流程模板。
- 描述: CSAT客户满意度分析：计算满意度得分、驱动因素分析与改进优先级

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| survey_id | string | 是 | - | 问卷编号 (vid) |
| satisfaction_question_index | string | 否 | - | 满意度题的题号索引（如不指定则自动识别） |

### `cross-tabulation`

- 用途: 生成两道题之间的交叉分析工作流。
- 描述: 交叉分析：分析两个题目之间的关联关系，生成交叉统计表

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| survey_id | string | 是 | - | 问卷编号 (vid) |
| question_a | string | 是 | - | 第一个题目的索引号 |
| question_b | string | 是 | - | 第二个题目的索引号 |

### `sentiment-analysis`

- 用途: 指导对开放题文本做情感分类与主题提取。
- 描述: 开放题情感与主题分析：对填空题文本进行情感倾向和关键主题提取

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| survey_id | string | 是 | - | 问卷编号 (vid) |
| question_index | string | 否 | - | 指定分析的填空题题号索引（如不指定则分析所有开放题） |

### `survey-health-check`

- 用途: 面向完成率、流失率和异常回答的质量诊断模板。
- 描述: 问卷质量诊断：检查完成率、流失模式、异常回答和题目质量

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| survey_id | string | 是 | - | 问卷编号 (vid) |

### `comparative-analysis`

- 用途: 用于跨时段或跨问卷比较关键指标差异。
- 描述: 跨时段或跨问卷对比分析：比较多份问卷的关键指标差异与趋势

**参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| survey_ids | string | 是 | - | 问卷编号列表（逗号分隔，如：12345,67890,11111） |
| comparison_type | string | 否 | - | 对比类型：time（同一问卷不同时段）或 survey（不同问卷之间），默认 survey |

## Tool 示例

以下示例用于说明 MCP 调用载荷的典型结构，具体字段可按业务场景扩展。

### `create_survey`

```json
{
  "name": "create_survey",
  "arguments": {
    "title": "2026 Q2 客户满意度调研",
    "atype": 1,
    "desc": "收集企业客户对售后支持的满意度反馈",
    "publish": false,
    "questions": "[{\"q_index\":1,\"q_type\":3,\"q_subtype\":302,\"q_title\":\"您有多满意本次服务？\",\"items\":[{\"q_index\":1,\"item_index\":1,\"item_title\":\"1\"},{\"q_index\":1,\"item_index\":2,\"item_title\":\"2\"},{\"q_index\":1,\"item_index\":3,\"item_title\":\"3\"},{\"q_index\":1,\"item_index\":4,\"item_title\":\"4\"},{\"q_index\":1,\"item_index\":5,\"item_title\":\"5\"}]},{\"q_index\":2,\"q_type\":5,\"q_title\":\"请写下最想改进的一点\"}]"
  }
}
```

```json
{
  "result": true,
  "data": {
    "vid": 12345678,
    "title": "2026 Q2 客户满意度调研",
    "publish": false
  }
}
```

### `query_responses`

```json
{
  "name": "query_responses",
  "arguments": {
    "vid": 12345678,
    "page_index": 1,
    "page_size": 50,
    "starttime": "2026-03-01 00:00:00",
    "endtime": "2026-03-31 23:59:59"
  }
}
```

```json
{
  "result": true,
  "data": {
    "total": 2,
    "list": [
      {
        "jid": 90001,
        "vid": 12345678,
        "submit_time": "2026-03-10 09:31:22",
        "source": "wechat",
        "submitdata": "1$5}2$客服响应速度快"
      },
      {
        "jid": 90002,
        "vid": 12345678,
        "submit_time": "2026-03-11 14:08:10",
        "source": "web",
        "submitdata": "1$4}2$希望周末也能有人值班"
      }
    ]
  }
}
```

### `calculate_nps`

```json
{
  "name": "calculate_nps",
  "arguments": {
    "scores": [
      10,
      9,
      8,
      7,
      10,
      6,
      5,
      9,
      10,
      8
    ]
  }
}
```

```json
{
  "result": true,
  "data": {
    "total": 10,
    "promoters": 5,
    "passives": 3,
    "detractors": 2,
    "nps": 30,
    "rating": "一般"
  }
}
```

## 备注

- 含 `JSON 字符串` 描述的字段，需要由调用方先序列化后再传入。
- 含分页语义的查询接口通常支持 `page_index` / `page_size`；上限与默认值已在参数表中标出。
- `analytics` 模块中的 6 个工具均为本地计算，不依赖远程 OpenAPI 可用性。

