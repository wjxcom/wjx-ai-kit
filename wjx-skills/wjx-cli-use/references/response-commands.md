# 答卷命令参考

> **全参数访问**: 以下列出的是 CLI 显式 flags。SDK 支持的额外参数可通过 `--stdin` 传入 JSON。

## wjx response query

查询答卷明细数据，支持分页、时间范围、条件筛选。

```bash
wjx response query --vid 12345
wjx response query --vid 12345 --page_size 50 --sort 1 --begin_time 1700000000000
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--vid <n>` | 是 | 问卷编号 |
| `--page_index <n>` | 否 | 页码（默认 1） |
| `--page_size <n>` | 否 | 每页数量（1-50，默认 10） |
| `--sort <n>` | 否 | 0=升序, 1=降序 |
| `--min_index <n>` | 否 | 最小答卷序号，返回 > 此序号的答卷 |
| `--jid <s>` | 否 | 答卷编号，逗号分隔（最多 50） |
| `--sojumpparm <s>` | 否 | 自定义链接参数，逗号分隔（最多 50） |
| `--qid <s>` | 否 | 指定返回的题目编号，逗号分隔（最多 50） |
| `--begin_time <n>` | 否 | 开始时间（Unix 毫秒时间戳） |
| `--end_time <n>` | 否 | 结束时间（Unix 毫秒时间戳） |
| `--file_view_expires <n>` | 否 | 文件链接有效期（小时，默认 1） |
| `--query_note` | 否 | 包含标注信息 |
| `--distinct_user` | 否 | 每用户只返回最新答卷 |
| `--distinct_sojumpparm` | 否 | 每自定义参数只返回最新答卷 |
| `--conds <json>` | 否 | 题目查询条件 JSON（最多 2 个，AND 关系） |

**--stdin 额外参数**: `valid`(是否有效答卷，默认 true)

### submitdata 编码格式

答卷数据使用编码格式 `题号$答案}题号$答案`：

| 分隔符 | 含义 |
|--------|------|
| `}` | 题目之间分隔 |
| `$` | 题号与答案分隔 |
| `\|` | 多选选项之间分隔 |

示例：
- 单选：`1$1`（第1题选第1个选项）
- 多选：`2$1|3`（第2题选第1和第3个选项）
- 填空：`3$答案文本`
- 量表：`4$8`（第4题选8分）
- 排序：`5$2,3,1`（第5题排序：选项2第1名、选项3第2名、选项1第3名，按排名顺序用英文逗号分隔所有选项序号。注意：排序题用逗号，多选题用竖线`|`）

## wjx response report

获取统计报告（频次、均值、汇总）。**建议作为数据分析的第一步**。

```bash
wjx response report --vid 12345
wjx response report --vid 12345 --begin_time 1700000000000 --end_time 1700100000000
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--vid <n>` | 是 | 问卷编号 |
| `--min_index <n>` | 否 | 最小答卷序号 |
| `--jid <s>` | 否 | 答卷编号，逗号分隔（最多 50） |
| `--sojumpparm <s>` | 否 | 自定义链接参数 |
| `--begin_time <n>` | 否 | 开始时间（Unix 毫秒时间戳） |
| `--end_time <n>` | 否 | 结束时间（Unix 毫秒时间戳） |
| `--distinct_user` | 否 | 每用户只取最新答卷 |
| `--distinct_sojumpparm` | 否 | 每自定义参数只取最新 |
| `--conds <json>` | 否 | 题目查询条件 JSON |

**--stdin 额外参数**: `valid`(是否有效答卷，默认 true)

## wjx response download

批量下载答卷。超过 3000 条自动转异步任务，需用 taskid 轮询。

```bash
wjx response download --vid 12345
wjx response download --vid 12345 --suffix 1   # SAV 格式
wjx response download --vid 12345 --taskid "abc123"   # 轮询异步任务
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--vid <n>` | 是 | 问卷编号 |
| `--taskid <s>` | 否 | 异步任务 ID（轮询状态用） |
| `--query_count <n>` | 否 | 最大答卷条数 |
| `--begin_time <n>` | 否 | 开始时间（Unix 毫秒时间戳） |
| `--end_time <n>` | 否 | 结束时间（Unix 毫秒时间戳） |
| `--min_index <n>` | 否 | 最小答卷序号 |
| `--qid <s>` | 否 | 指定题目，逗号分隔（最多 50） |
| `--sort <n>` | 否 | 0=升序, 1=降序 |
| `--query_type <n>` | 否 | 0=按文本, 1=按分数, 2=按序号 |
| `--suffix <n>` | 否 | 格式：0=CSV（默认）, 1=SAV, 2=Word |
| `--query_record` | 否 | 仅查询参与作答记录 |

**--stdin 额外参数**: `valid`(是否有效答卷)

## wjx response submit

提交答卷（代填/数据导入）。

```bash
wjx response submit --vid 12345 --submitdata "1\$1}2\$hello" --inputcosttime 30
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--vid <n>` | 是 | 问卷编号 |
| `--inputcosttime <n>` | 是 | 填写耗时（秒），必须 >1 否则视为机器提交 |
| `--submitdata <s>` | 是 | 答卷数据，格式：`题号$答案}题号$答案` |
| `--udsid <n>` | 否 | 自定义来源编号 |
| `--sojumpparm <s>` | 否 | 自定义链接参数 |
| `--submittime <s>` | 否 | 提交时间（日期时间字符串，默认当前） |

## wjx response modify

修改答卷。当前仅支持修改考试主观题分数。

```bash
wjx response modify --vid 12345 --jid 67890 --answers '{"10000":"85","20000":"90"}'
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--vid <n>` | 是 | 问卷编号 |
| `--jid <n>` | 是 | 答卷编号 |
| `--answers <json>` | 是 | 分数 JSON：`{"题号":"分数"}`。**重要**：题号是内部编号（q_index × 10000），如第1题=10000，第2题=20000 |

## wjx response clear

清空答卷数据（**不可逆！**）。

```bash
wjx response clear --username admin --vid 12345 --reset_to_zero
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--username <s>` | 是 | 用户名 |
| `--vid <n>` | 是 | 问卷编号 |
| `--reset_to_zero` | 否 | 将答卷序号重置为 0 |

## wjx response count

获取答卷总数。

```bash
wjx response count --vid 12345
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--vid <n>` | 是 | 问卷编号 |

输出格式：`{ "result": true, "data": { "vid": N, "total_count": N, "join_times": N } }`

## 其他 Response 命令

| 命令 | 说明 |
|------|------|
| `wjx response realtime --vid N` | 实时队列查询（需白名单），可选 `--count N` |
| `wjx response winners --vid N` | 中奖者信息，可选 `--atype N`(0=其他/1=红包/-1=不限) `--awardstatus N`(0=未发/1=已发) `--page_index N` `--page_size N` |
| `wjx response 360-report --vid N` | 360度报告下载（异步：首次返回 taskid，再次调用 `--taskid <id>` 轮询） |
