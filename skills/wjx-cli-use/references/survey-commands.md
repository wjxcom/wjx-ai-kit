# 问卷命令参考

> **全参数访问**: CLI 的显式 flags 是常用参数的子集。要使用 SDK 支持的全部参数，可通过 `--stdin` 传入 JSON：
> ```bash
> echo '{"vid":12345,"get_questions":true,"get_items":true}' | wjx survey get --stdin
> ```

## wjx survey create

用 JSONL 格式创建问卷（**唯一使用的创建方式**，覆盖 70+ 题型）。每个非空行是一个完整 JSON 对象，首行必须是 `qtype` 为 `问卷基础信息` 的元数据。

```bash
wjx survey jsonl-template --type 1 --raw > survey.jsonl
# 编辑 survey.jsonl 后创建
wjx survey create --file survey.jsonl
wjx survey create --file survey.jsonl --type 6 --publish
wjx survey create --file survey.jsonl --dry-run    # 预览解析结果
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--file <path>` | 推荐 | 从文件读取原始 JSONL，最不易受 shell 转义影响 |
| `--jsonl <s>` | 与 `--file` 二选一 | 直接传入 JSONL 字符串 |
| `--stdin` | 与上述来源二选一 | 全局选项；从 stdin 读取一个包含 `jsonl` 字段的 JSON 参数对象 |
| `--title <s>` | 否 | 覆盖 JSONL 中的问卷标题 |
| `--type <n>` | 否 | 1=调查, 2=测评, 3=投票, 4=360度评估, 5=360评估无测评关系, 6=考试, 7=表单, 9=教学评估, 10=量表, 11=民主评议（默认 1；8 用户体系不能新建） |
| `--optional_titles <json>` | 否 | 允许设为选填的题目标题 JSON 数组 |
| `--publish` | 否 | 显式要求创建后立即发布；未传时普通题型默认发布，纯框架题型默认保持草稿 |
| `--creater <s>` | 否 | 创建者子账号 |
| `--dry-run` | 否 | 预览解析结果，不实际创建 |

### JSONL 格式

```jsonl
{"qtype":"问卷基础信息","title":"服务满意度调查","introduction":"感谢您的参与","atype":1}
{"qtype":"单选","title":"您对本次服务是否满意？","select":["满意","一般","不满意"]}
{"qtype":"矩阵单选","title":"请评价以下方面","rowtitle":["响应速度","服务态度"],"select":["差","一般","好"]}
```

关键规则：

- 第一行使用 `qtype:"问卷基础信息"`；不要使用 `_meta`。
- 题型使用中文字符串 `qtype`；不要传 `q_type`、`q_subtype`、`q_title`、`items` 等旧接口结构。
- 普通选择题的选项写入 `select`，矩阵题的行和列分别写入 `rowtitle`、`select`。
- 默认题目必答。仅当题目标题同时列入 `--optional_titles` 时，才写 `"requir":false`。
- 先运行 `wjx survey jsonl-template --type <n> --raw`，从当前 CLI 模板开始生成调查、投票、考试、表单或量表。

### 发布策略

普通题型在未指定 `--publish` 时默认立即发布。下列纯框架题型只有骨架，必须在问卷星编辑页补充素材或配置，未指定 `--publish` 时 SDK 会以草稿创建：`折叠栏目`、`轮播图`、`AI追问`、`AI处理`、`AI访谈`、`图片OCR`、`VlookUp问卷关联`、`分页计时器`。

创建后请先获取问卷详情和编辑入口，完成二次编辑并由用户明确要求发布时，再使用发布操作；AI 不得为这些题型自行追加 `--publish`。

完整字段、中文题型名和示例见 [question-types.md](question-types.md)。

### 通过 stdin 传参

`--stdin` 读取的是一个 JSON 参数对象，**不是**原始 JSONL 文本。优先使用 `--file`。必须使用 stdin 时，将完整 JSONL 编码为对象的 `jsonl` 字符串：

```bash
printf '%s\n' '{"jsonl":"{\"qtype\":\"问卷基础信息\",\"title\":\"客户需求调查\",\"atype\":1}\n{\"qtype\":\"单选\",\"title\":\"请选择使用频率\",\"select\":[\"每天\",\"每周\"]}"}' \
  | wjx survey create --stdin --dry-run
```

### 创建响应中的填写地址字段

`create` 成功后先保留并结构化解析完整 JSON 响应。当前 CLI 只格式化服务端原始字段，不会自动从这些字段派生 `fill_url`；不要把字段不存在误判成没有填写地址，也不要因此用 `vid` 猜路径。常见字段含义如下（字段可能位于响应的 `data` 或问卷记录对象中）：

| 字段 | 含义 | 用途 |
|------|------|------|
| `vid` | 后台问卷编号 | 定位问卷、后续 API 操作；不能直接放入填写路径 |
| `sid` | 服务端生成的填写短编号 | 校验公开填写地址中的标识 |
| `activity_domain` | 服务端返回的填写域名 | 作为 URL 的 base，不要擅自替换为其他域名 |
| `pc_path` | 服务端返回的电脑端填写路径 | 有效时优先用于桌面端填写地址 |
| `mobile_path` | 服务端返回的移动端填写路径 | 没有 `pc_path` 时可使用 |
| `fill_url` | API/CLI 已归一化的填写地址（可能不存在） | 存在且通过校验时可直接使用 |

当响应没有可用的 `fill_url` 时，只用同一条记录返回的域名和路径组合地址；等价于：

```js
const fillUrl = new URL(record.pc_path || record.mobile_path, record.activity_domain).toString();
```

组合前必须确认 `activity_domain` 是 API 返回的合法 `http(s)` 域名，`path` 是 API 返回且以允许的填写路由（例如 `/m/`、`/vm/` 或 `/jq/`）开头，并核对路径中的公开标识是短 `sid`。路径不能是把数字 `vid` 插入这些路由得出的猜测值；字段缺失或校验失败时，报告“服务端未提供可验证的填写路径”。不要从 `survey get` 或 `survey url --help` 探索填写地址。

获取刚创建问卷的推荐流程：

1. 保存 `create` 的完整 JSON 成功响应，不要用 `head` 截断或用文本搜索提取字段。
2. 在创建响应中先查找已归一化的 `fill_url`；没有时，用同一记录的 `activity_domain` 与 `pc_path`/`mobile_path` 按上面的规则组合并校验。
3. 如果创建响应没有可验证路径，取其中的 `vid`/`sid`，保持筛选和排序条件不变，按 `survey list` 的 `page_index`、`page_size`、`total_count` 逐页查找相同 `vid` 的记录，再从该记录读取短路径。
4. 列表中也没有服务端路径时，明确报告暂时无法取得填写链接；不要改用编辑地址、创建地址或数字 `vid` 路径。

## wjx survey list

查询问卷列表。

列表返回的 `activitys` 记录通常包含 `vid`、`sid`、`activity_domain`、`pc_path`、`mobile_path` 等原始字段，实际版本可能没有 `fill_url`。填写地址优先使用 API/CLI 已提供并通过校验的 `fill_url`；否则按上一节用同一记录的 `activity_domain` 与 `pc_path`（或 `mobile_path`）组合。**禁止**用数字 `vid` 自行拼接 `/m/<vid>.aspx`、`/vm/<vid>.aspx` 或 `/jq/<vid>.aspx`。

```bash
wjx survey list
wjx survey list --name_like "满意度" --status 1
```

| Flag | 说明 |
|------|------|
| `--page <n>` | 页码（默认 1） |
| `--page_size <n>` | 每页数量（默认 10） |
| `--status <n>` | 状态筛选：0=未发布, 1=已发布, 2=已暂停, 3=已删除, 5=被审核 |
| `--atype <n>` | 类型筛选：1=调查, 2=测评, 3=投票, 4=360度评估, 5=360评估无测评关系, 6=考试, 7=表单, 8=用户体系, 9=教学评估, 10=量表, 11=民主评议 |
| `--name_like <s>` | 名称模糊搜索（最多 10 字符） |

**--stdin 可用的额外参数**: `sort`(0-5 排序), `creater`(子账号筛选), `folder`(文件夹), `is_xingbiao`(星标), `query_all`(包含子账号问卷，仍然分页), `verify_status`(审核状态), `time_type`(0=不按时间查询（默认）/1=按问卷开始时间/2=按问卷创建时间), `begin_time`/`end_time`(毫秒时间戳)

### 分页响应与 AI 处理规则

成功响应的分页结构如下，`activitys` 是以问卷编号为键的对象：

```json
{
  "ok": true,
  "data": {
    "page_index": 1,
    "page_size": 10,
    "total_count": 23,
    "sort": 1,
    "activitys": {
      "12345": {
        "vid": 12345,
        "title": "示例问卷",
        "sid": "AbC123x",
        "activity_domain": "https://www.wjx.cn",
        "pc_path": "/vm/AbC123x.aspx",
        "mobile_path": "/m/AbC123x.aspx"
      }
    }
  }
}
```

上例中的路径表示服务端原样返回的字段，仅用于说明响应结构；不得把 `AbC123x` 替换成数字 `vid`，也不得脱离 API 响应套用路径模板。

- 将 `total_count` 作为当前筛选条件下的问卷总数，将 `Object.keys(activitys).length` 作为本页实际数量。
- 普通列表请求可以只展示当前页，但必须报告总数和页码：总页数为 `Math.ceil(total_count / page_size)`。
- 用户要求全部结果时，保持所有筛选和排序参数不变，查询第 1 页到总页数，并核对累计数量等于 `total_count`。
- 不要把 `--query_all` 当作自动翻页开关；它只扩大账号查询范围。
- 不要为问卷列表使用 `--format table`，该模式只展示部分问卷行，可能隐藏 `sid`、域名、填写路径以及 `total_count`、`page_index`、`page_size`，不能用于机器解析或链接查找。
- 使用 JSON 解析器读取完整响应，不要用 `head` 截断 JSON 或用 `grep` 搜索字段。为刚创建的问卷找链接时，先用创建响应里的 `vid`/`sid`；仅在创建响应没有可验证路径时按页定位目标记录。

## wjx survey get

获取问卷详情。

```bash
wjx survey get --vid 12345
# 获取 DSL 文本请使用独立的导出命令
wjx survey export-text --vid 12345 --raw
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--vid <n>` | 是 | 问卷编号 |

**--stdin 可用的额外参数**: `get_questions`(获取题目), `get_items`(获取选项), `get_exts`(获取问答选项), `get_setting`(获取题目设置), `get_page_cut`(获取分页信息), `get_tags`(获取标签), `showtitle`(返回标题)。`survey get` 只返回结构化 JSON；需要旧 DSL 文本时使用 `survey export-text --vid <vid> --raw`。

`survey get` 用于读取问卷内容、设置或题目详情，不是获取填写地址的必经步骤。填写地址应先使用创建响应或列表记录中的 `fill_url`/`activity_domain`/`pc_path`/`mobile_path`。

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

### 候选字段速查（按业务模块猜值）

OpenAPI 没有正式公开 settings 各 JSON 的全部字段。下表是从问卷星管理后台 / 公开抓包总结的常见字段，**不保证服务端一定接受**——遇到不生效时按"调试方法"自行确认：

| 业务诉求 | 字段所在 setting | 候选字段（按推测可能性排序） |
|----------|------------------|------------------------------|
| 开启验证码（防机器答卷） | `api_setting` 或 `msg_setting` | `is_open_yzm` / `yzm_enable` / `open_captcha` / `captcha_enable` |
| 开启智能验证（无感） | `api_setting` | `nv_enable` / `enable_nvc` / `smart_verify` |
| 限制单 IP 答卷次数 | `api_setting` | `ip_limit` / `ip_max_times` / `ip_limit_count` |
| 限制单微信号 | `api_setting` | `wx_limit` / `weixin_limit` |
| 防多次提交 | `api_setting` | `cookie_limit` / `device_limit` |
| 隐藏问卷星 logo | `api_setting` | `hide_logo` / `is_hide_logo` |
| 强制必答 | `api_setting` | `must_answer` / `force_required` |
| 答题进度条 | `api_setting` | `show_process` / `show_progress` |
| 微信 OA 推送通知 | `msg_setting` | `oa_enable` / `wx_notify` |
| 提交后发邮件 | `msg_setting` | `email_enable` / `notify_email` |

**调试方法**：
```bash
# 1) 在问卷星网页端先把目标功能打开/调好；
# 2) 用 settings 查当前值，找出与默认不同的字段：
wjx survey settings --vid 12345

# 3) 把那个字段对应的 JSON 整段塞回 update-settings：
wjx survey update-settings --vid 12345 --api_setting '{"is_open_yzm":1,"nv_enable":1}'

# 4) 再 settings 一次确认服务端是否落库；如果没生效，多半是字段名不对——
#    再回到第 2 步对比，或换上表的候选名重试。
```

> 同一业务在不同问卷类型/账户版本下字段名可能不同；上表只是候选，真实接受的字段以服务端 settings 返回为准。如果有命中的字段值，欢迎提 PR 补到这里。

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

只生成问卷的创建或后台编辑链接（无需 API 签名），**不会生成答卷人填写链接**。填写链接必须来自 API 返回的短 `sid` 和填写路径，不能用本命令探查或推导。

```bash
wjx survey url --mode create --name "新问卷"
wjx survey url --mode edit --activity 12345
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--mode <s>` | 否 | "create"（默认）或 "edit" |
| `--name <s>` | 否 | 问卷名称（create 模式） |
| `--activity <n>` | edit 模式是 | 问卷编号（edit 模式） |

三类地址的用途：

| 地址类型 | 来源 | 面向对象 |
|------|------|------|
| 填写地址 | 创建/列表响应的 `fill_url`，或 `activity_domain` + `pc_path`/`mobile_path` | 答卷人 |
| 编辑地址 | `wjx survey url --mode edit --activity <vid>` | 问卷管理员 |
| 创建地址 | `wjx survey url --mode create --name <name>` | 创建问卷的管理页面 |

## wjx survey preview-url

生成答卷人使用的填写/预览链接。优先传 API 返回的 `sid`；只有没有 `sid` 时才传正整数 `vid`，同时传入两者时以 `sid` 为准。

```bash
wjx survey preview-url --sid <sid>
wjx survey preview-url --vid 12345
```

该命令不是后台编辑链接；编辑问卷请使用 `wjx survey url --mode edit --activity <vid>`。不要自行用数字 `vid` 拼接 `/m/`、`/vm/` 或 `/jq/` 路径。

## 其他 Survey 命令

| 命令 | 用法 |
|------|------|
| `wjx survey tags --username user` | 获取题目标签列表 |
| `wjx survey tag-details --tag_id 123` | 获取标签下的题目详情 |
| `wjx survey clear-bin --username user` | 清空回收站（可选 `--vid N` 指定问卷） |
| `wjx survey upload --file_name img.png --file <base64>` | 上传文件（png/jpg/gif/bmp/webp，~4MB） |
