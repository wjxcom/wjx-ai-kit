# 分析命令参考

> 所有分析命令**本地运行**，无需 API Key 或网络连接。
> 所有命令支持 `--stdin` 传入 JSON 参数。

## wjx analytics decode

解码答卷提交数据（submitdata 格式）。

```bash
wjx analytics decode --submitdata "1\$1}2\$3|4}3\$hello"
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--submitdata <s>` | 是 | 提交数据字符串 |

### submitdata 编码格式

| 分隔符 | 含义 |
|--------|------|
| `}` | 题目之间分隔 |
| `$` | 题号与答案分隔 |
| `\|` | 多选选项之间分隔 |

示例：`1$1}2$3|4}3$hello` → 第1题选1，第2题选3和4，第3题填"hello"

## wjx analytics nps

计算 Net Promoter Score（净推荐值）。

```bash
wjx analytics nps --scores "[9,10,7,3,8,10,9,6,8,10]"
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--scores <json>` | 是 | 评分 JSON 数组（0-10 分） |

**NPS = 推荐者% - 贬损者%**（范围 -100 ~ +100）

| 类别 | 分数范围 |
|------|---------|
| 推荐者 (Promoters) | 9-10 |
| 被动者 (Passives) | 7-8 |
| 贬损者 (Detractors) | 0-6 |

| 评级 | NPS 范围 |
|------|---------|
| 优秀 | > 70 |
| 良好 | 50-70 |
| 一般 | 0-50 |
| 较差 | < 0 |

## wjx analytics csat

计算 Customer Satisfaction Score（客户满意度）。

```bash
wjx analytics csat --scores "[4,5,3,5,2,4,5]"
wjx analytics csat --scores "[6,7,5,7,3,6,7]" --scale "7-point"
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--scores <json>` | 是 | 评分 JSON 数组 |
| `--scale <s>` | 否 | 量表类型：`"5-point"`（默认）或 `"7-point"` |

**CLI 返回的 `csat` = 满意人数 / 总人数**（范围 0-1，是比例值而非百分数；展示为百分比时再乘以 100%）

例如，`--scores '[4,5,3,2]'` 返回 `"csat": 0.5`，表示满意度为 50%。

| 量表 | 满意阈值 |
|------|---------|
| 5-point | 4-5 分 |
| 7-point | 5-7 分 |

| 评级 | CSAT 范围 |
|------|----------|
| 优秀 | > 90% |
| 良好 | 75-90% |
| 一般 | 50-75% |
| 较差 | < 50% |

## wjx analytics anomalies

检测异常答卷模式。

```bash
wjx analytics anomalies --responses '[{"jid":10001,"submitdata":"1$1}2$1}3$1","inputcosttime":120,"ip":"192.168.1.10"},{"jid":10002,"submitdata":"1$2}2$3}3$4","inputcosttime":120,"ip":"192.168.1.11"},{"jid":10003,"submitdata":"1$3}2$3}3$3","inputcosttime":10,"ip":"192.168.1.12"}]'
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--responses <json>` | 是 | 答卷数据 JSON 数组 |

当前实现检测 3 种异常模式：
1. **直线作答** — 所有题目选同一个答案
2. **速度异常** — 完成时间 < 中位数的 30%
3. **IP+内容重复** — 同一 IP 提交完全相同的答卷内容

`--responses` 中每个答卷对象支持以下字段：

| 字段 | 说明 |
|------|------|
| `id` / `jid` | 答卷标识；两者都缺失时使用输入序号 |
| `answers` | 已解码的答案数组 |
| `submitdata` | 问卷星原始答卷字符串；未提供 `answers` 时由 CLI 自动解码 |
| `duration_seconds` | 已规范化的答题耗时（秒） |
| `inputcosttime` | 问卷星 API 的答题耗时（秒）；未提供 `duration_seconds` 时使用 |
| `ip` | 客户端 IP；用于 IP+内容重复检测 |

## wjx analytics compare

对比两组指标数据。

```bash
wjx analytics compare --set_a '{"nps":45,"csat":0.78}' --set_b '{"nps":52,"csat":0.85}'
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--set_a <json>` | 是 | 指标集 A JSON 对象（`{"指标名":数值}`） |
| `--set_b <json>` | 是 | 指标集 B JSON 对象（`{"指标名":数值}`） |

显著性阈值：|变化率| > 10% 视为显著变化。

## wjx analytics decode-push

解码问卷星 Webhook 推送回调数据。

```bash
wjx analytics decode-push --payload '<加密数据>' --app_key '<AppKey>'
wjx analytics decode-push --payload '<加密数据>' --app_key '<AppKey>' --signature '<签名>' --raw_body '<原始请求体>'
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--payload <s>` | 是 | 加密数据 |
| `--app_key <s>` | 是 | AppKey |
| `--signature <s>` | 否 | X-Wjx-Signature 签名（用于验证） |
| `--raw_body <s>` | 否 | 原始请求体（用于签名验证） |

### Webhook 推送字段

| 字段 | 说明 |
|------|------|
| vid | 问卷编号 |
| jid | 答卷编号 |
| submitdata | 编码的答卷数据 |
| submittime | 提交时间 |
| source | 来源（1=PC, 2=手机, 3=微信） |
| ip | 客户端 IP |

### 加密方式

Webhook 数据使用 AES-128-CBC 加密：
- Key = MD5(appKey) 前 16 字符
- Padding: PKCS7
- IV = 密文前 16 字节
- 签名验证：通过 X-Wjx-Signature 头进行 SHA1 验证

---

## CES 参考（Customer Effort Score，客户费力度）

非 CLI 命令，但分析时常用的参考指标：
- 量表：1-7（越低越好，表示客户越省力）
- 优秀：< 2，良好：2-3，一般：3-5，较差：> 5
