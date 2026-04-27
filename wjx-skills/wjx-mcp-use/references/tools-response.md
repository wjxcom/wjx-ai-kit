# 答卷数据工具详解（9 tools）

## query_responses — 答卷查询

查询问卷的答卷数据，支持分页、时间范围、条件筛选。返回答卷明细包括提交时间、来源、IP、各题答案等。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `valid` | boolean | 否 | 是否查询有效答卷（默认 true） |
| `page_index` | number | 否 | 分页页码（默认 1） |
| `page_size` | number | 否 | 每页答卷数（默认 10，最大 50） |
| `sort` | number | 否 | 排序：0=升序, 1=降序 |
| `min_index` | number | 否 | 最小答卷序号，返回大于此序号的答卷 |
| `jid` | string | 否 | 答卷编号，逗号分隔，最多 50 个 |
| `sojumpparm` | string | 否 | 自定义链接参数，逗号分隔，最多 50 个 |
| `qid` | string | 否 | 指定返回的题目编号，逗号分隔，最多 50 个 |
| `begin_time` | number | 否 | 开始时间（Unix 毫秒时间戳） |
| `end_time` | number | 否 | 结束时间（Unix 毫秒时间戳） |
| `file_view_expires` | number | 否 | 文件链接有效期（小时，默认 1） |
| `query_note` | boolean | 否 | 是否查询标注信息 |
| `distinct_user` | boolean | 否 | 是否仅返回用户最新答卷 |
| `distinct_sojumpparm` | boolean | 否 | 是否仅返回自定义参数最新答卷 |
| `conds` | string | 否 | 题目查询条件 JSON 字符串，最多 2 个条件，AND 关系 |

## query_responses_realtime — 实时查询（队列模式）

查询成功的答卷将从队列移除，无法二次查询。需联系客服开通白名单。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `count` | number | 否 | 每次获取的答卷数量 |

## download_responses — 批量下载答卷

支持 CSV/SAV/Word 格式。超过 3000 条自动转为异步任务，返回 taskid 用于轮询。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `taskid` | string | 否 | 异步任务 ID（轮询下载状态用） |
| `valid` | boolean | 否 | 是否查询有效答卷（默认 true） |
| `query_count` | number | 否 | 最大答卷条数 |
| `begin_time` | number | 否 | 开始时间（Unix 毫秒时间戳） |
| `end_time` | number | 否 | 结束时间（Unix 毫秒时间戳） |
| `min_index` | number | 否 | 最小答卷序号 |
| `qid` | string | 否 | 指定问题列表，逗号分隔，最多 50 个 |
| `sort` | number | 否 | 排序：0=升序, 1=降序 |
| `query_type` | number | 否 | 查询方式：0=按文本, 1=按分数, 2=按序号 |
| `suffix` | number | 否 | 文件格式：0=CSV, 1=SAV, 2=Word |
| `query_record` | boolean | 否 | 仅查询参与作答记录 |

## get_report — 统计报告查询

获取各题选项频次统计、平均分、总分等聚合数据。建议显式传 `valid: true`。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `valid` | boolean | 否 | 是否查询有效答卷（默认 true，建议显式传递） |
| `min_index` | number | 否 | 最小答卷序号 |
| `jid` | string | 否 | 答卷编号，逗号分隔，最多 50 个 |
| `sojumpparm` | string | 否 | 自定义链接参数 |
| `begin_time` | number | 否 | 开始时间（Unix 毫秒时间戳） |
| `end_time` | number | 否 | 结束时间（Unix 毫秒时间戳） |
| `distinct_user` | boolean | 否 | 是否仅用户最新答卷 |
| `distinct_sojumpparm` | boolean | 否 | 是否仅自定义参数最新答卷 |
| `conds` | string | 否 | 题目查询条件 JSON 字符串 |

## submit_response — 答卷提交（代填/导入）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `inputcosttime` | number | 是 | 填写时间（秒），需 >1 秒 |
| `submitdata` | string | 是 | 答卷内容，格式：`题号$答案}题号$答案` |
| `udsid` | number | 否 | 自定义来源编号 |
| `sojumpparm` | string | 否 | 自定义链接参数 |
| `submittime` | string | 否 | 提交时间（日期时间字符串） |

### submitdata 编码格式

**题号**：必须用 `get_survey` 返回的原始 `q_index`——"问卷基础信息"元数据占 `q_index=1`，真实题目从 2 开始。**不要**按"第几题"自己数 1, 2, 3，会与服务端 q_index 错位被拒。

**选项序号**：1-based（从 1 数到 N）。

| 分隔符 | 含义 |
|--------|------|
| `}` | 题目之间分隔 |
| `$` | 题号与答案分隔 |
| `\|` | 多选 / 排序 / 矩阵多选的列之间分隔 |
| `,` | 矩阵题的多行之间分隔 |
| `!` | 矩阵题的「行号!列号」内部分隔 |

**单题示例**（`Q` 是 `get_survey` 返回的 `q_index`，通常从 2 起）：

```
单选:    Q$1          # 选第 1 个选项
多选:    Q$1|3        # 选第 1 和第 3 个选项
填空:    Q$答案文本
量表:    Q$8          # 选 8 分
排序:    Q$2|3|1      # 选项 2 第 1 名、选项 3 第 2 名、选项 1 第 3 名
多项填空: Q$空1|空2|空3
滑动条:  Q$5
```

**矩阵题示例**（每题 3 条可复制；3 行的情况）：

```
矩阵单选 (q_subtype=702):  Q$1!1,2!3,3!2          # 第 1 行选第 1 列、第 2 行选第 3 列、第 3 行选第 2 列
矩阵多选 (q_subtype=703):  Q$1!1|2,2!3,3!1|4      # 同一行多个列用 | 拼
矩阵量表 (q_subtype=701):  Q$1!5,2!4,3!3          # 行号!分值
```

> 矩阵题的"行数"来自 `get_survey` 返回的 `item_rows.length`；`items` 是**列头**（列选项），不是行——切勿用 `items.length` 当行数，会少算或多算。

**多题拼接**：用 `}` 接起来。假设 vid=N 的问卷返回 q_index=2 的单选 + q_index=3 的多选 + q_index=4 的矩阵单选：

```
2$1}3$1|3}4$1!1,2!3,3!2
```

### 推荐流程

```
1. get_survey({ vid, get_questions: true, get_items: true }) — 拿题目结构
2. 按每题 q_index 拼 submitdata（不要凭"第几题"数）
3. submit_response({ vid, inputcosttime: 30, submitdata }) — 自动注入 jpmversion
```

## get_winners — 获取中奖者信息

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `atype` | number | 否 | 奖品类型：0=其他, 1=微信红包, -1=不限 |
| `awardstatus` | number | 否 | 发放状态：0=未发放, 1=已发放, -1=不限 |
| `page_index` | number | 否 | 页码（默认 1） |
| `page_size` | number | 否 | 每页数量（1-100，默认 10） |

## modify_response — 修改答卷

当前仅支持修改考试问卷的主观题分数（type=1）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `jid` | number | 是 | 答卷编号 |
| `type` | 1 | 是 | 修改类型（目前仅支持 1=修改分数） |
| `answers` | string | 是 | 分数修改 JSON，格式：`{"题号":"分数"}`。**注意**：题号是内部题号（q_index * 10000），不是序号 |

## get_360_report — 360度评估报告下载

异步模式：首次调用可能返回 status=0 和 taskid，需再次调用传入 taskid 轮询。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `taskid` | string | 否 | 异步任务 ID |

## clear_responses — 清空答卷数据（不可逆！）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | 是 | 用户名 |
| `vid` | number | 是 | 问卷编号 |
| `reset_to_zero` | boolean | 是 | 是否将答卷序号重置为 0 |

## 分析方法参考

### NPS（净推荐值）

- 公式：`NPS = 推荐者比例 - 贬损者比例`
- 量表：0-10 分
- 分类：9-10=推荐者, 7-8=被动者, 0-6=贬损者
- 基准：>70 优秀, 50-70 良好, 0-50 一般, <0 较差

### CSAT（客户满意度）

- 公式：`CSAT = 满意回答数 / 总回答数 × 100%`
- 量表：1-5 分或 1-7 分
- 基准：>90% 优秀, 75-90% 良好, 50-75% 一般, <50% 较差

### CES（客户费力度）

- 公式：`CES = 所有回答的平均分`（1-7 量表）
- 分数越低越好
- 基准：<2 优秀, 2-3 良好, 3-5 一般, >5 较差
