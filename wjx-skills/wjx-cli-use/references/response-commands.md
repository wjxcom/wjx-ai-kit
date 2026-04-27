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

**题号**：服务端按 `getSurvey` 返回的原始 `q_index` 严格校验——"问卷基础信息"元数据占 `q_index=1`，真实题目从 2 开始。**手算很容易错**，直接用 `wjx response submit-template --vid <问卷ID>` 拿模板，里面给的就是服务端认可的题号。

**选项序号**：1-based（从 1 数到 N）。

| 分隔符 | 含义 |
|--------|------|
| `}` | 题目之间分隔 |
| `$` | 题号与答案分隔 |
| `\|` | 多选 / 排序 / 矩阵多选的列之间分隔 |
| `,` | 矩阵题的多行之间分隔 |
| `!` | 矩阵题的「行号!列号」内部分隔 |

**1-based 速记**：
- 题号一律用 `submit-template` 返回值——服务端要的是 raw `q_index`，元数据占 1，真实题目从 2 起。
- 选项序号 1-based：第 1 个选项是 1，以此类推。即使问卷里删过某个选项导致 item_index 不连续，模板生成时也会按 1, 2, 3... 重排——直接按你看到的 placeholder 顺序填。

示例（单题）：
- 单选：`1$1`（第 1 题选第 1 个选项）
- 多选：`2$1|3`（第 2 题选第 1 和第 3 个选项，用 `|` 分隔）
- 填空：`3$答案文本`
- 量表：`4$8`（第 4 题选 8 分）
- 排序：`5$2|3|1`（第 5 题排序：第 1 名是选项 2，第 2 名是选项 3，第 3 名是选项 1。注意：排序题用 `|` 分隔的是名次顺序）

矩阵题示例（**每题 3 条可复制**，题号 `N` 用 submit-template 返回的真实 q_index 替换）：

```bash
# 矩阵单选（q_subtype=702）：3 行，每行选 1 列
# 含义：第 N 题第1行选第1列、第2行选第3列、第3行选第2列
N$1!1,2!3,3!2

# 矩阵多选（q_subtype=703）：3 行，每行可选多列
# 含义：第 N 题第1行选第1+2列、第2行选第3列、第3行选第1+4列
N$1!1|2,2!3,3!1|4

# 矩阵量表（q_subtype=701）：等同矩阵单选写法（行!分值）
# 含义：第 N 题第1行打5分、第2行打4分、第3行打3分
N$1!5,2!4,3!3
```

**多题拼接**：上面每题用 `}` 接起来。假设问卷有一道单选（q_index=2）+ 一道多选（q_index=3）+ 一道矩阵单选（q_index=4）：
```
2$1}3$1|3}4$1!1,2!3,3!2
```

**忘了格式？** 直接跑 `wjx response submit-template --vid <问卷ID>`：返回每题的 1-based placeholder + hint，AI 改成真实答案即可一键 submit。

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

**推荐流程（AI Agent 一定走这条路）**：
```bash
# 1. 拉模板：拿到每题 1-based placeholder
wjx response submit-template --vid 12345 > template.json

# 2. 把 template.json 里的 submitdata 字段改成真实答案，存成 submitdata.txt
#    （或直接用 --raw 模式拿纯字符串：wjx response submit-template --vid 12345 --raw > submitdata.txt）

# 3. 用 --submitdata-file 提交，绕开 PowerShell/bash 的 $ 变量展开陷阱
wjx response submit --vid 12345 --inputcosttime 30 --submitdata-file submitdata.txt
```

**直接传字符串（不推荐，易踩 shell 转义坑）**：
```bash
# Linux/macOS bash：转义 $
wjx response submit --vid 12345 --submitdata "1\$1}2\$hello" --inputcosttime 30
# Windows PowerShell：必须用单引号（双引号会让 $1/$2 被当变量吞掉）
wjx response submit --vid 12345 --submitdata '1$1}2$hello' --inputcosttime 30
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--vid <n>` | 是 | 问卷编号 |
| `--inputcosttime <n>` | 是 | 填写耗时（秒），必须 >1 否则视为机器提交 |
| `--submitdata <s>` | 二选一 | 答卷数据，格式：`题号$答案}题号$答案`（按 1, 2, 3... 写） |
| `--submitdata-file <path>` | 二选一 | 从文件读 submitdata（推荐：彻底绕开 shell `$` 转义） |
| `--udsid <n>` | 否 | 自定义来源编号 |
| `--sojumpparm <s>` | 否 | 自定义链接参数 |
| `--submittime <s>` | 否 | 提交时间（日期时间字符串，默认当前） |
| `--jpmversion <n>` | 否 | 问卷版本号；不传时自动从 getSurvey 取 |
| `--no-auto-version` | 否 | 关闭自动获取 jpmversion |

**$ sanity check**：CLI 会在提交前检查 submitdata 里至少含一个 `$`。如果一个都没有，立即报 INPUT_ERROR——这几乎必然意味着 shell 把 `$1/$2` 当变量吞掉了，请改用 `--submitdata-file` 或单引号包裹。

## wjx response submit-template

根据问卷结构拉一份 submitdata 模板，给每题生成 **1-based placeholder + hint**，AI 改成真实答案后即可一键 submit。

```bash
# JSON 包裹（默认，含每题 hint）：
wjx response submit-template --vid 12345

# 直接吐 submitdata 字符串，便于重定向到文件：
wjx response submit-template --vid 12345 --raw > submitdata.txt
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--vid <n>` | 是 | 问卷编号 |
| `--raw` | 否 | 直接输出 submitdata 字符串（不包裹 JSON） |

输出（JSON 模式）：
```json
{
  "vid": 12345,
  "title": "...",
  "submitdata": "1$1}2$1|2}3$__请填写__}4$1!1,2!1,3!1",
  "questions": [
    { "q_index": 1, "q_type": 3, "q_title": "性别", "placeholder": "1$1", "hint": "选项序号（1-based）..." },
    { "q_index": 2, "q_type": 4, "q_title": "爱好", "placeholder": "2$1|2", "hint": "多选：用 | 分隔..." },
    { "q_index": 3, "q_type": 5, "q_title": "建议", "placeholder": "3$__请填写__", "hint": "填空：直接写答案文本" },
    { "q_index": 4, "q_type": 7, "q_subtype": 702, "q_title": "评估", "placeholder": "4$1!1,2!1,3!1", "hint": "矩阵单选：行号!列号..." }
  ],
  "next_step": "把每题 placeholder 改成真实答案，存为 submitdata.txt 后运行：wjx response submit --vid 12345 --inputcosttime 30 --submitdata-file submitdata.txt"
}
```

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
