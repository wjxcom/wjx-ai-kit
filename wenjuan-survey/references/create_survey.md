# create_survey - 创建问卷

创建并自动发布问卷。题目来源（**互斥，选一种**）：

## ⚠️ 趣味测试 / 活动题库：别停在「只生成 JSON」

很多人说的「自动创建」其实只做了 **在仓库里写入 `.json` 文件**。这 **不等于** 问卷网上已有项目，也 **没有** 发布。

| 阶段 | 含义 | 谁来做 |
|------|------|--------|
| 写文件 | 把 `question_list`（及可选 `survey_result`）存成 JSON | 编辑器 / AI 写 `examples/…json` |
| 导入（创建项目+题目） | 调 `POST …/textproject/`，题目进你的账号 | **`workflow_create_and_publish.js`** 或 **`import_project.js`** |
| 发布 | 调 `update_project_status`，变为「收集中」、有答题链接 | 同上脚本**后半段**（勿单独只跑前半段） |

**活动推广类需求的标准收尾**：生成 JSON 后 **必须执行**下面之一（并在终端看到「发布成功 / 收集中」），不要写完文件就结束。

**已登记的节日测评**（路径与标题已内置，Skill 根目录一条命令）：

```bash
cd "${SKILL_DIR}"
npm run publish:valentines    # examples/valentines_day_fun_assess_2026.json
npm run publish:labor         # examples/labor_day_fun_assess_2026.json
npm run publish:april-fools   # examples/april_fools_promo_assess_2026.json
npm run publish:singles-day   # examples/singles_day_fun_assess_2026.json
# 等价：node scripts/publish_preset.js valentines
```

**任意自定义题库**：

```bash
cd "${SKILL_DIR}"
node scripts/workflow_create_and_publish.js --file examples/你的题库.json --title "对外标题" --type assess
node scripts/import_project.js -f examples/你的题库.json
```

使用 **AI / Agent** 时：生成或更新上述 `examples/*.json` 后，应由 Agent **在会话内执行** `npm run publish:…` 或 `workflow_create_and_publish.js`，并展示完整终端输出；**不要**仅以「请用户本地手动运行」收尾——仅「生成题库」不算完成「问卷网自动创建+发布」。

---
1. **默认模板**：`--title` + `--type`，可选 `--scene`，按类型生成默认题目
2. **本地文件**：`-f` / `--file`，UTF-8 **题目 JSON**（`.json` 或 `.txt` 均可；**`.txt` 亦须为 JSON 内容**，非 JSON 的提纲须先转换）
3. **文本文件别名**：`--text-file` / `--text`，与 `--file` 相同，强调「保存成文件的 JSON 文本」
4. **链接**：`-u` / `--url`，对 **http(s)** 地址发起 GET，响应体须为与文件相同的 JSON（需可匿名访问，如 GitHub raw、已签名 URL 等）
5. **标准输入**：`--stdin`，从管道或重定向读取 UTF-8 JSON（例：`cat q.json \| node ... --stdin`）

自然语言提纲须先整理为符合 `project_json_structure_guide.md` 的题目 JSON，再使用文件 / 链接 / stdin 导入。

## 稿件支持的文档格式（txt / docx / xlsx / pdf）

`workflow_create_and_publish.js` 的 **`--file` / `--text-file` 仅接受 UTF-8 的题目 JSON**（扩展名常用 `.json` 或 `.txt`）。以下四种可作为**设计稿来源**，导入前须**先转为题目 JSON**（脚本不内置解析 docx/xlsx/pdf）。

| 格式 | 处理方式 |
|------|----------|
| **.txt** | 若文件内容已是合法 JSON → 可直接 `--file xxx.txt`。若为纯文本提纲 → 先按 `project_json_structure_guide.md` 整理成 JSON 再导入。 |
| **.docx** | 抽取正文 → 对照「单选 / 多选 / 打分 / 填空」等写成题目 JSON。详见下节。 |
| **.xlsx** | 用表格组织题干、题型、选项（如每行一题，或「题干 + 选项1/选项2…」列）。用 Excel 导出 CSV、或 Python `openpyxl` / `pandas` 读表后生成 `question_list` JSON。 |
| **.pdf** | 先抽取文本（如 `pdftotext`、`pdfplumber`、PyMuPDF）；再与 Word 稿相同，映射为题目 JSON。**扫描件 / 图片型 PDF** 需 OCR，本仓库脚本不提供 OCR。 |

统一落地命令（在得到 `questions.json` 之后）：

```bash
node "${SKILL_DIR}/scripts/workflow_create_and_publish.js" \
  --file questions.json \
  --title "问卷标题" \
  --type survey
```

### Word（.docx）

须先把文档正文变成题目 JSON，再走 **`--file`**（或 `--text-file` / `--stdin`）。

**推荐步骤：**

1. **抽取正文**：`.docx` 实为 ZIP，可用 Python 读 `word/document.xml` 拼接文本节点，或用 `pandoc -t plain 稿.docx` 等工具导出纯文本。  
   **Python 示例**（仅抽取可见文字，便于人工或 Agent 对照出题）：
   ```python
   import zipfile, xml.etree.ElementTree as ET
   W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
   with zipfile.ZipFile("稿.docx") as z:
       root = ET.fromstring(z.read("word/document.xml"))
   parts = []
   for t in root.iter(f"{{{W}}}t"):
       if t.text:
           parts.append(t.text)
       if t.tail:
           parts.append(t.tail)
   print("".join(parts))
   ```
2. **对照文档里的「单选 / 多选 / 打分 / 填空」**，按 `project_json_structure_guide.md` 写成 `question_list`（`en_name`、`option_list`、`custom_attr` 等与线上一致）。
3. **保存为 UTF-8 JSON**，再执行上文「统一落地命令」；`--type` 按稿选择：`survey` / `form` / `vote` / `assess`。

### Excel（.xlsx）

1. 约定列含义（示例）：`题干`、`题型`（单选/多选/填空/打分…）、`选项A`…`选项F`、是否必填等。  
2. 用脚本或 Agent 遍历行，映射为 `QUESTION_TYPE_SINGLE` / `QUESTION_TYPE_MULTIPLE` / `QUESTION_TYPE_BLANK` 等（见 `project_json_structure_guide.md`），输出 JSON 文件。  
3. 使用 **`--file`** 导入；表单类稿注意 **`--type form`**。

### PDF（.pdf）

1. **文本型 PDF**：`pdftotext 文件.pdf -`（poppler）或 Python `pdfplumber` / `pymupdf` 抽取全文。  
2. 将抽取结果当作「提纲」，与 docx 相同步骤生成题目 JSON。  
3. **纯扫描 PDF**：须先 OCR（如 Tesseract、商用 OCR 服务），再整理为 JSON；本 skill 流程不内置 OCR。

**本仓库示例（可与稿对照）：**

| 文件 | 说明 |
|------|------|
| `examples/college_pocket_money_from_docx.json` | 与「大学生零花钱调研」类 Word 稿 **9 题**一致（调研 `survey`） |
| `examples/university_pocket_money_survey.json` | 同主题 **扩展版**（在 docx 九题基础上多出若干题，可作题库参考） |
| `examples/graduation_mail_form.json` | 参照问卷网模板「毕业证、档案邮寄信息填写」结构自建的 **表单**（`form`） |

**新建时的类型参数（均走同一脚本，勿混用成 survey）**：

| 用户意图 | CLI `--type` |
|---------|--------------|
| 调研、满意度、一般问卷 | `survey`（常见默认） |
| 测评、趣味测试、打分与结果档 | `assess`（题目 JSON 须含 `answer_score`、`option_list[].custom_attr.score` 等，例见 `examples/april_fools_fun_quiz.json`） |
| 投票、评选、票选 | **`vote`** |
| 表单、报名、信息登记 | **`form`** |

若把 **投票 / 表单 / 测评** 误作成 `survey`，后台题型与能力不匹配，Agent 也可能未按「新建问卷」完整流程执行。四类均需 **`workflow_create_and_publish.js`** + 对应 **`--type`**。

## Token（凭证）

对应脚本为 `workflow_create_and_publish.js`，JWT 由 **`scripts/token_store.js`** 统一读取与 `references/auth.md` 一致（先 `.wenjuan/auth.json`，再用户级 `token.json` / `access_token`，默认目录 `~/.wenjuan` 或 `WENJUAN_TOKEN_DIR`）。

## 接口

```bash
POST /edit/api/textproject/          # 创建项目并导入题目
POST /edit/api/update_project_status/   # 发布项目
```

## 参数

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `--title` | string | 条件必填 | 问卷标题（使用默认模板时必填；JSON 导入时可选，用于覆盖标题） |
| `--type` | string | 条件必填 | 问卷类型：survey/vote/form/assess（使用默认模板时必填；题目列表 JSON 未写 `ptype` 时建议显式传入） |
| `--scene` | string | 否 | 场景描述，用于生成更贴合的题目 |
| `--file` / `-f` | string | 否 | 本地 JSON 文件路径 |
| `--text-file` / `--text` | string | 否 | 同 `--file`（内容为 UTF-8 JSON） |
| `--url` / `-u` | string | 否 | 可 GET 的 http(s) 链接，响应体为 JSON |
| `--stdin` | flag | 否 | 从标准输入读取 JSON（与 `--file`/`--url` 互斥） |

## 返回

### 成功返回

```json
{
  "success": true,
  "project_id": "5f8a9b2c3d4e5f6a7b8c9d0e",
  "short_id": "UZBZJvMs",
  "title": "员工满意度调研",
  "question_count": 4
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | bool | 是否成功 |
| `project_id` | string | 创建的项目 ID |
| `short_id` | string | 短链接 ID，用于生成答题链接 |
| `title` | string | 问卷标题 |
| `question_count` | int | 生成的题目数量 |

**答题链接格式**: `https://www.wenjuan.com/s/{short_id}`

示例: `https://www.wenjuan.com/s/UZBZJvMs`

### 失败返回

```json
{
  "success": false,
  "error": "错误信息",
  "project_id": "xxx"  // 部分失败时可能有此字段
}
```

| 错误信息 | 说明 | 解决方案 |
|----------|------|----------|
| `NEED_LOGIN` | 未登录 | 完成环境安装后执行 `login_auto.js`（或写入 `token_store` 所识别的凭证）；`setup.sh` 只准备 Node/依赖，不代替登录 |
| `NEED_BIND_MOBILE` | 未绑定手机号 | 脚本会自动提示绑定 |
| `CREATE_FAILED` | 创建失败 | 查看详细错误信息 |
| `PUBLISH_FAILED` | 发布失败 | 项目已创建，可手动发布 |

## 工作流程

```
1. 检查登录状态，如未登录自动引导登录
2. 准备题目：默认模板，或从 `--file` / `--text-file` / `--url` / `--stdin` 解析 JSON（稿为 txt/docx/xlsx/pdf 时见上文「稿件支持的文档格式」）
3. 调用 textproject API 创建项目并导入题目
4. 调用 update_project_status API 发布项目
5. 如遇 NOT_BIND_MOBILE 错误，自动引导绑定手机号后重试发布
6. 发布成功后始终轮询：需平台审核时轮询审核/项目状态；随后轮询项目详情直至状态稳定（含 short_id）
```

命令行中的 `--poll` / `--no-poll` / `-p`（旧「轮询」开关）**已忽略**，行为固定为上述轮询。

轮询时 **两套状态不要混用**：**项目详情**（`edit_project`）里常见 `status`：`0` 编辑中，`1` 收集中，`2` 已停止。**状态接口**（`/project/api/status/` 的 `data.status`）枚举见 [`publish_survey.md`](publish_survey.md)（含 `0` 发布、`1` 收集中、`2` 完成、`3` 暂停收集、`99/100`、`-1/-2` 等）。

## 默认题目模板

| 类型 | 生成的题目 |
|-----|-----------|
| survey | 性别（单选：男/女）、年级（单选：大一至研究生）、满意度评分（1-5分）、改进建议（多选） |
| vote | 单选投票题（选项A/B/C/D） |
| form | 姓名（填空）、手机号（填空）、邮箱（填空）、备注（填空） |
| assess | 单选题（带正确答案和分值） |

## CLI 调用示例

### 方式一：使用默认模板创建

```bash
# 创建调研问卷
node "${SKILL_DIR}/scripts/workflow_create_and_publish.js" \
  --title "员工满意度调研" \
  --type survey

# 创建投票
node "${SKILL_DIR}/scripts/workflow_create_and_publish.js" \
  --title "年度最佳评选" \
  --type vote

# 创建表单
node "${SKILL_DIR}/scripts/workflow_create_and_publish.js" \
  --title "活动报名表" \
  --type form

# 创建测评
node "${SKILL_DIR}/scripts/workflow_create_and_publish.js" \
  --title "产品知识测试" \
  --type assess
```

### 方式二：从本地 JSON 或文本文件导入

支持两种文件格式：

**格式1：题目列表**（推荐）
```json
[
  {
    "title": "您的性别",
    "en_name": "QUESTION_TYPE_SEX",
    "custom_attr": {"show_seq": "on"},
    "option_list": [
      {"title": "男", "is_open": false},
      {"title": "女", "is_open": false}
    ]
  },
  {
    "title": "您的建议",
    "en_name": "QUESTION_TYPE_BLANK",
    "custom_attr": {},
    "option_list": []
  }
]
```

**格式2：完整项目数据**
```json
{
  "title": "自定义问卷",
  "ptype": "survey",
  "question_list": [
    {
      "title": "题目1",
      "en_name": "QUESTION_TYPE_SINGLE",
      "option_list": [...]
    }
  ]
}
```

**从文件导入示例：**

```bash
# 从题目列表文件导入（需指定标题和类型）
node "${SKILL_DIR}/scripts/workflow_create_and_publish.js" \
  --file questions.json \
  --title "客户满意度调查" \
  --type survey

# 从完整项目数据文件导入（自动使用文件中的标题和类型）
node "${SKILL_DIR}/scripts/workflow_create_and_publish.js" \
  --file project.json

# 从测评题库 JSON 导入（必须 --type assess，否则按调查创建）
node "${SKILL_DIR}/scripts/workflow_create_and_publish.js" \
  --file examples/april_fools_fun_quiz.json \
  --title "愚人节趣味测试" \
  --type assess

# 投票（默认模板或自建 vote 题目 JSON，须 --type vote）
node "${SKILL_DIR}/scripts/workflow_create_and_publish.js" \
  --title "年度最佳评选" \
  --type vote

# 表单（默认模板或自建 form 题目 JSON，须 --type form）
node "${SKILL_DIR}/scripts/workflow_create_and_publish.js" \
  --title "活动报名表" \
  --type form

# 由 Word 稿转换得到的题目 JSON（示例：大学生零花钱调研）
node "${SKILL_DIR}/scripts/workflow_create_and_publish.js" \
  --file examples/college_pocket_money_from_docx.json \
  --title "大学生零花钱调研" \
  --type survey
```

### 方式三：从链接导入

链接须返回 **与本地文件相同结构** 的 JSON（仅支持 `http:` / `https:`，超时约 45s，响应体上限 5MB）。

```bash
node "${SKILL_DIR}/scripts/workflow_create_and_publish.js" \
  --url "https://example.com/path/questions.json" \
  --title "外链题库" \
  --type survey
```

### 方式四：从标准输入导入

```bash
cat questions.json | node "${SKILL_DIR}/scripts/workflow_create_and_publish.js" \
  --stdin \
  --title "管道导入" \
  --type survey
```

### 题目格式说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 题目标题 |
| `en_name` | string | 是 | 题型代码，见下表 |
| `custom_attr` | object | 否 | 自定义属性 |
| `option_list` | array | 条件 | 选项列表（选择题必填） |

**常用题型代码：**

| 题型 | en_name |
|------|---------|
| 单选题 | QUESTION_TYPE_SINGLE |
| 多选题 | QUESTION_TYPE_MULTIPLE |
| 填空题 | QUESTION_TYPE_BLANK |
| 性别 | QUESTION_TYPE_SEX |
| 评分题 | QUESTION_TYPE_SCORE |
| 矩阵单选 | QUESTION_TYPE_MATRIX_SINGLE |

更多题型请参考 `references/project_json_structure_guide.md`。

## 发布成功后：查看报表与导出数据

- **查看报表**：问卷网统计页为 `/report/topic/{project_id}`。使用 **`scripts/open_report.js`**（**get_report**）解析 `project_id`、打印链接并**默认打开浏览器**；筛选列表**多条时须在终端选择**，不会默认第 1 条；只需链接时加 **`--no-open`**。详见 [`get_report.md`](get_report.md)。
- **下载原始答卷**：使用 **`scripts/export_data.js`**，见 [`export_data.md`](export_data.md)。
