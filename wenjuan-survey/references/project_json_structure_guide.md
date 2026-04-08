# 问卷网项目 JSON 结构生成指南

> 本文档用于指导 AI 生成符合问卷网 API 要求的 `project_json` 数据结构

---

## 一、项目根结构 (project_json)

```json
{
  "title": "string",           // 必填，问卷标题（最长100字）
  "type_id": "string",         // 必填，场景类型ID（见类型对照表）
  "p_type": null | 1 | 2,      // 必填，null=问卷, 1=表单, 2=测评
  "welcome": "string",         // 可选，欢迎语
  "cover": "string",           // 可选，项目配图，base64编码，如："data:image/png;base64,..."
  "phone_cover_url": "string", // 可选，移动端封面，base64编码
  "question_list": [],         // 必填，题目列表（最大300题）
  "import_type": "0" | "1",    // 可选，0=创建项目(默认), 1=导入到已有项目
  "project_id": "string",      // 条件，import_type=1时必填
  "folder_id": "string",       // 可选，文件夹ID
  "ai_source": 11,             // 可选，AI创建标识，固定11
  "survey_result": "string"    // 可选，结束语设置，JSON字符串转义
}
```

---

## 二、项目类型对照表

| 项目类型 | p_type | type_id |
|---------|--------|---------|
| 普通问卷 | `null` | `51dd234e9b9fbe6646bf4dcc` |
| 表单 | `1` | `536b5a38f7405b4d51ca75c6` |
| 考试测评 | `2` | `54b638e0f7405b3dc0db45fb` |
| 投票 | `null` | `5c0651e0a320fc9d0bb6aefb` |
| 满意度 | `null` | `51dd234e9b9fbe6646bf4dcf` |
| 360评估 | `null` | `536b5a38f7405b4d51ca75cf` |
| 知识竞赛 | `2` | `62d7a10fd40fd4ce536d0b0b` |
| 付费问卷 | `1` | `536b5a38f7405b4d51ca75cd` |

---

## 三、题目通用结构

每道题必须包含以下字段：

```json
{
  "title": "题目文本",
  "en_name": "QUESTION_TYPE_XXX",
  "custom_attr": {},
  "option_list": []
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | ✅ | 题目内容 |
| `en_name` | string | ✅ | 题型标识（见题型对照表） |
| `custom_attr` | object | ✅ | 自定义属性（可为空对象 `{}`） |
| `option_list` | array | ✅ | 选项列表（无选项传空数组 `[]`） |

### 选项结构 (option_list 元素)

```json
{
  "title": "选项文本",
  "is_open": false,
  "custom_attr": {}
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | ✅ | 选项内容 |
| `is_open` | boolean | 否 | 是否允许填空（默认 false） |
| `custom_attr` | object | 否 | 选项自定义属性 |

---

## 四、题型对照表及生成规则

> **参考样例项目（线上下落）**：以下「`edit_project` 返回」字段来自问卷网编辑接口实测，用于与「导入 JSON 写 `option_list: []`」对照。  
> - 普通问卷：`project_id` **`69d257be4d1e8d523899937b`**（`survey`，14 题）  
> - 考试测评：`project_id` **`69d2570bef3af30a3376fd24`**（`assess`，15 题）  
> 汇总表见 **第十二节**。

### 1. 单选题 (QUESTION_TYPE_SINGLE)

**适用场景**：单选、下拉单选、判断题

**规则**：
- 必须有 2 个及以上选项
- 选项存于 `option_list`

**变体设置**：
- 下拉单选：`custom_attr.disp_type = "dropdown"`
- **判断题**：`custom_attr.disp_type = "judge"`。历史文档曾写 `option_list = []`；**线上下落为单选题 `question_type: 2`，固定 2 条选项**（如「是」「否」），测评需在选项上标 **`is_correct` / `score`**（与项目 `69d2570b…` 一致）。

**线上下落（判断题，测评）**：`question_type: 2`，`custom_attr.disp_type: "judge"`，`option_list` 长度 **2**；正确项 `custom_attr.is_correct: "1"` 与分值，错误项可 `score: 0`。

**导入 JSON 推荐（判断题 · 测评）**：
```json
{
  "title": "判断题",
  "en_name": "QUESTION_TYPE_SINGLE",
  "custom_attr": {
    "disp_type": "judge",
    "show_seq": "on",
    "total_score": 5
  },
  "option_list": [
    {"title": "是", "is_open": false, "custom_attr": {"is_correct": "1", "score": 5}},
    {"title": "否", "is_open": false, "custom_attr": {"score": 0}}
  ]
}
```

**示例（普通单选）**：
```json
{
  "title": "您的性别是？",
  "en_name": "QUESTION_TYPE_SINGLE",
  "custom_attr": {},
  "option_list": [
    {"title": "男", "is_open": false, "custom_attr": {}},
    {"title": "女", "is_open": false, "custom_attr": {}}
  ]
}
```

---

### 2. 多选题 (QUESTION_TYPE_MULTIPLE)

**适用场景**：可多选的选择题

**规则**：
- 必须有 2 个及以上选项
- 可通过 `custom_attr` 设置最少/最多选择数

**custom_attr 可选值**：
- `min_answer_num`: 最少选择数量
- `max_answer_num`: 最多选择数量

**示例**：
```json
{
  "title": "您喜欢哪些颜色？（可多选）",
  "en_name": "QUESTION_TYPE_MULTIPLE",
  "custom_attr": {
    "min_answer_num": 1,
    "max_answer_num": 3
  },
  "option_list": [
    {"title": "红色", "is_open": false, "custom_attr": {}},
    {"title": "蓝色", "is_open": false, "custom_attr": {}},
    {"title": "绿色", "is_open": false, "custom_attr": {}},
    {"title": "其他", "is_open": true, "custom_attr": {}}
  ]
}
```

---

### 3. 填空题 (QUESTION_TYPE_BLANK)

**适用场景**：单行文本、多行文本输入

**规则**：
- **兼容**：`option_list` 可传 `[]`（历史写法）。
- **线上下落**：`question_type: 6`，**始终有 1 条**占位选项（常见 `title` 为「填空1」），`custom_attr` 含 `text_row`、`text_col`；**测评**中该选项常带 **`score`**（与项目 `69d2570b…` 一致）。
- 通过 `custom_attr.blank_type` 区分单行/多行

**custom_attr 可选值**：
- `blank_type`: `"single"` (单行) | `"multiple"` (多行)

**导入 JSON 推荐（与线上一致）**：单行/多行均带 **1 项** `option_list`，并设置 `text_row` / `text_col`；测评再加选项级 `score`。

**示例**：
```json
// 单行填空（问卷）
{
  "title": "填空题",
  "en_name": "QUESTION_TYPE_BLANK",
  "custom_attr": {"blank_type": "single", "show_seq": "on"},
  "option_list": [
    {"title": "填空1", "is_open": false, "custom_attr": {"text_row": 1, "text_col": 20}}
  ]
}

// 多行填空（兼容空数组仍可尝试导入）
{
  "title": "请留下您的建议：",
  "en_name": "QUESTION_TYPE_BLANK",
  "custom_attr": {"blank_type": "multiple"},
  "option_list": []
}

// 测评填空（单空 + 分值）
{
  "title": "填空",
  "en_name": "QUESTION_TYPE_BLANK",
  "custom_attr": {"blank_type": "single", "show_seq": "on", "total_score": 5},
  "option_list": [
    {"title": "填空1", "is_open": false, "custom_attr": {"score": 5, "text_row": 1, "text_col": 20}}
  ]
}
```

---

### 4. 多项填空题 (QUESTION_TYPE_MULTIPLE_BLANK)

**适用场景**：多个填空项（如联系方式各字段）

**规则**：
- 每个填空项作为 `option_list` 的一个元素
- 每个选项的 `title` 为填空项标签

**示例**：
```json
{
  "title": "请填写您的联系方式",
  "en_name": "QUESTION_TYPE_MULTIPLE_BLANK",
  "custom_attr": {},
  "option_list": [
    {"title": "手机号码", "is_open": false, "custom_attr": {}},
    {"title": "电子邮箱", "is_open": false, "custom_attr": {}},
    {"title": "微信号", "is_open": false, "custom_attr": {}}
  ]
}
```

---

### 5. 打分题 (QUESTION_TYPE_SCORE)

**适用场景**：评分、NPS 评分

**规则**：
- **兼容**：`option_list` 可传 `[]`。
- **线上下落**：`question_type: 50`，**固定 1 条**占位选项（常见 `title`「选项1」），具体刻度由题目 `custom_attr` 控制。
- NPS：`custom_attr.disp_type = "nps_score"`，常见 **`min_answer_num: 0`**、**`max_answer_num: 10`**（项目 `69d257be…`）。
- 普通量表（如 1～5 星）：常见 **`min_answer_num: 1`**、**`max_answer_num: 5`**，可有 **`magnitude_scale: 1`**（项目 `69d257be…`）。

**导入 JSON 推荐**：
```json
// NPS（0–10）
{
  "title": "您向朋友或同事推荐我们的可能性有多大？",
  "en_name": "QUESTION_TYPE_SCORE",
  "custom_attr": {
    "disp_type": "nps_score",
    "show_seq": "on",
    "min_answer_num": 0,
    "max_answer_num": 10
  },
  "option_list": [
    {"title": "选项1", "is_open": false, "custom_attr": {}}
  ]
}

// 普通打分（如 1～5 分）
{
  "title": "请给本项打分",
  "en_name": "QUESTION_TYPE_SCORE",
  "custom_attr": {
    "show_seq": "on",
    "min_answer_num": 1,
    "max_answer_num": 5,
    "magnitude_scale": 1
  },
  "option_list": [
    {"title": "选项1", "is_open": false, "custom_attr": {}}
  ]
}
```

---

### 6. 矩阵单选题 (QUESTION_TYPE_MATRIX_SINGLE)

**适用场景**：矩阵形式的单选（如满意度评价）

**规则**：
- `option_list` 存放矩阵列选项（评价等级）
- 矩阵行（评价维度）需另外通过子题或 custom_attr 设置

**示例**：
```json
{
  "title": "请评价以下各项满意度",
  "en_name": "QUESTION_TYPE_MATRIX_SINGLE",
  "custom_attr": {},
  "option_list": [
    {"title": "非常不满意", "is_open": false, "custom_attr": {}},
    {"title": "不满意", "is_open": false, "custom_attr": {}},
    {"title": "一般", "is_open": false, "custom_attr": {}},
    {"title": "满意", "is_open": false, "custom_attr": {}},
    {"title": "非常满意", "is_open": false, "custom_attr": {}}
  ]
}
```

---

### 7. 矩阵多选题 (QUESTION_TYPE_MATRIX_MULTIPLE)

**适用场景**：矩阵形式的多选

**规则**：
- 与矩阵单选类似，`en_name` 不同

**示例**：
```json
{
  "title": "您使用过以下哪些功能？（可多选）",
  "en_name": "QUESTION_TYPE_MATRIX_MULTIPLE",
  "custom_attr": {},
  "option_list": [
    {"title": "功能A", "is_open": false, "custom_attr": {}},
    {"title": "功能B", "is_open": false, "custom_attr": {}},
    {"title": "功能C", "is_open": false, "custom_attr": {}}
  ]
}
```

---

### 8. 排序题 (QUESTION_TYPE_SORT)

**适用场景**：拖拽排序

**规则**：
- 选项为待排序项
- 答题时用户拖拽调整顺序

**示例**：
```json
{
  "title": "请按喜好程度排序",
  "en_name": "QUESTION_TYPE_SORT",
  "custom_attr": {},
  "option_list": [
    {"title": "选项A", "is_open": false, "custom_attr": {}},
    {"title": "选项B", "is_open": false, "custom_attr": {}},
    {"title": "选项C", "is_open": false, "custom_attr": {}},
    {"title": "选项D", "is_open": false, "custom_attr": {}}
  ]
}
```

---

### 9. 文字说明题 (QUESTION_TYPE_DESC)

**适用场景**：问卷说明、段落文字

**规则**：
- 只显示文字，无需回答
- `option_list` 传空数组

**示例**：
```json
{
  "title": "以下是问卷说明，请注意阅读...",
  "en_name": "QUESTION_TYPE_DESC",
  "custom_attr": {},
  "option_list": []
}
```

---

### 10. 下拉级联题 (QUESTION_TYPE_CASCADE)

**适用场景**：省市区三级联动等

**规则**：
- `custom_attr.disp_type = "cascader"`
- `option_list` 传空数组

**注意（textproject 导入）**：仅写 `QUESTION_TYPE_CASCADE` + 空 `option_list` 时，实测可能落为 **`question_type: 8` 且无选项**，答题端出现「未找到结果」。**无官方级联数据源时**，不要用本题型凑「两个下拉」——应改为 **两道 `QUESTION_TYPE_SINGLE` + `disp_type: dropdown`**（见 `examples/template_survey_uzbzjvlxdv_clone.json` 修正方式）。

**示例**：
```json
{
  "title": "请选择您的地址",
  "en_name": "QUESTION_TYPE_CASCADE",
  "custom_attr": {"disp_type": "cascader"},
  "option_list": []
}
```

---

### 11. 上传题 (QUESTION_TYPE_UPLOAD)

**适用场景**：文件上传、图片上传

**规则**：
- 文件上传：`custom_attr.disp_type = "upload_file"`
- 图片上传：使用 `QUESTION_TYPE_IMAGE_UPLOAD`，`custom_attr.disp_type = "image_upload"`
- **线上下落**：`question_type: 95`，**各 1 条**选项；文件常见 `title`「选择文件上传」，图片常见「请上传图片」。测评场景题目上可有 `answer_score: "on"`、`upload_num`、`upload_size` 等（项目 `69d257be…`）。

**导入 JSON 推荐**：
```json
// 文件上传
{
  "title": "请上传文件",
  "en_name": "QUESTION_TYPE_UPLOAD",
  "custom_attr": {"disp_type": "upload_file", "show_seq": "on"},
  "option_list": [
    {"title": "选择文件上传", "is_open": false, "custom_attr": {}}
  ]
}

// 图片上传
{
  "title": "请上传图片",
  "en_name": "QUESTION_TYPE_IMAGE_UPLOAD",
  "custom_attr": {"disp_type": "image_upload", "show_seq": "on"},
  "option_list": [
    {"title": "请上传图片", "is_open": false, "custom_attr": {}}
  ]
}
```

---

### 12. 地址题 (QUESTION_TYPE_ADDRESS)

**适用场景**：地址填写

**规则**：
- `custom_attr.disp_type = "address"`
- **线上下落**：`question_type: 8`（与普通填空 6 不同），常见 **`drop_type: "address"`**，**固定 4 条**选项：`省份`、`城市`、`区/县`、`详细地址`（项目 `69d2570b…`）。

**导入 JSON 推荐**：
```json
{
  "title": "地址",
  "en_name": "QUESTION_TYPE_ADDRESS",
  "custom_attr": {"disp_type": "address", "drop_type": "address"},
  "option_list": [
    {"title": "省份", "is_open": false, "custom_attr": {}},
    {"title": "城市", "is_open": false, "custom_attr": {}},
    {"title": "区/县", "is_open": false, "custom_attr": {}},
    {"title": "详细地址", "is_open": false, "custom_attr": {}}
  ]
}
```

**兼容**：`option_list: []` 仍可能被部分导入路径接受，但与线上一致时建议用上一段四选项结构。

---

### 13. 手写签名题 (QUESTION_TYPE_SIGNATURE)

**适用场景**：电子签名

**规则**：
- `custom_attr.disp_type = "signature"`
- **线上下落**：`question_type: 95`，**1 条**选项（常见 `title`「填空1」）（项目 `69d257be…`）。

**导入 JSON 推荐**：
```json
{
  "title": "签名",
  "en_name": "QUESTION_TYPE_SIGNATURE",
  "custom_attr": {"disp_type": "signature", "show_seq": "on"},
  "option_list": [
    {"title": "填空1", "is_open": false, "custom_attr": {}}
  ]
}
```

---

### 14. 分页题 (QUESTION_TYPE_SPLIT_PAGE)

**适用场景**：问卷分页

**规则**：
- `custom_attr.disp_type = "page_break"`
- `option_list` 传空数组

**示例**：
```json
{
  "title": "分页",
  "en_name": "QUESTION_TYPE_SPLIT_PAGE",
  "custom_attr": {"disp_type": "page_break"},
  "option_list": []
}
```

---

## 五、预设信息题（自动验证格式）

| 题型 | en_name | 说明 |
|------|---------|------|
| 性别 | `QUESTION_TYPE_SEX` | 线上下落多为单选 `question_type: 2`，**2 项** 男/女 |
| 手机 | `QUESTION_TYPE_MOBILE` | 常为填空 `6` + **1 项** + `checkmethod: mobile` |
| 邮箱 | `QUESTION_TYPE_EMAIL` | 常为填空 `6` + **1 项** + `checkmethod: email` |
| 日期 | `QUESTION_TYPE_DATE` | 线上下落多为 `question_type: 95` + **1 项** |
| 时间 | 编辑器中的时间题 | 线上下落 `question_type: 95` + **2 项**（时/分），见 §5.2 |
| 姓名 | `QUESTION_TYPE_NAME` | 填空 `6` + **1 项** |
| 年龄 / 学历 | 编辑器预设 | 多为单选 `2` + **多条** 固定选项，见 §5.2 |
| 学号 / 班级 / 部门 | 多用 `QUESTION_TYPE_BLANK` + `content_type` | 见 §5.3 |
| 工号 | `QUESTION_TYPE_BLANK` + `disp_type: employee_id` 等 | 见 §5.3 |
| 身份证 | `QUESTION_TYPE_ID_CARD` 或见 §5.1 推荐 | 身份证号格式校验 |

**通用规则（导入 JSON）**：
- 历史写法多为 `option_list: []`；**与线上一致、避免结构残缺**时，请按 **§5.1～§5.4** 与 **第十二节** 使用**非空** `option_list`。
- 手机/邮箱等须设置 `custom_attr.disp_type` 或选项级 `checkmethod`（见 §5.2）。

### 5.1 身份证：线上下落结构（`edit_project` 返回）

导入成功后，在编辑接口中「身份证号」题常见结构为 **填空题骨架 + 身份证校验**，而非单独枚举题型：

| 位置 | 字段 | 典型值 | 说明 |
|------|------|--------|------|
| 题目 | `question_type` | `6` | 与填空题一致 |
| 题目 | `custom_attr.content_type` | `"id_card"` | 标记为身份证控件 |
| 题目 | `custom_attr.show_seq` / `total_score` | 视项目而定 | 与其它题一致 |
| 选项（1 条） | `title` | 如 `"填空1"` | 占位展示文案，后台可改 |
| 选项 | `custom_attr.checkmethod` | `"id_num"` | 触发身份证号校验 |
| 选项 | `custom_attr.text_row` / `text_col` | 如 `1` / `10` | 输入框行列 |

**导入 JSON 推荐写法（与线上一致、避免 `option_list: []` 导致结构不完整）**：使用 **`QUESTION_TYPE_BLANK`**，并带上 **`content_type` + 单选项 + `checkmethod`**：

```json
{
  "title": "身份证号",
  "en_name": "QUESTION_TYPE_BLANK",
  "custom_attr": {
    "show_seq": "on",
    "content_type": "id_card"
  },
  "option_list": [
    {
      "title": "身份证号",
      "is_open": false,
      "custom_attr": {
        "checkmethod": "id_num",
        "text_row": 1,
        "text_col": 10
      }
    }
  ]
}
```

**兼容写法**：`QUESTION_TYPE_ID_CARD` + `option_list: []` 在部分导入路径下可能无法生成上述选项与 `content_type`，**表单类项目优先采用上一段推荐写法**。

### 5.2 姓名 / 手机 / 邮箱 / 日期 / 时间 / 性别 / 年龄 / 学历（线上下落与推荐导入）

以下线上下落字段来自项目 **`69d257be…`（问卷）**、**`69d2570b…`（测评）** 的 `edit_project` 实测。

| 预设能力 | 典型 `question_type` | `option_list` 条数 | 题目 `custom_attr` 要点 | 选项 `custom_attr` 要点 |
|----------|---------------------|-------------------|---------------------------|---------------------------|
| 姓名 | `6`（填空） | **1** | `disp_type: "name"` | `text_row` / `text_col`；测评可加 **`score`** |
| 手机 | `6` | **1** | `disp_type: "mobile"`，常配合 `blank_type: "single"` | **`checkmethod: "mobile"`** + 行列 |
| 邮箱 | `6` | **1** | `disp_type: "email"` | **`checkmethod: "email"`** + 行列 |
| 日期 | `95` | **1** | `disp_type: "date"` | 常为 `{}`；测评选项可带 **`score: 0`** |
| 时间 | `95` | **2** | `disp_type: "time"` | 两条分别为「时」「分」，测评可各带 **`score`** |
| 性别 | `2`（单选） | **2** | `disp_type: "sex"`，`content_type: "sex"` | 男/女；测评选项可带 **`score`** |
| 年龄 | `2` | **多条**（如 7 档） | `disp_type: "age"`，`content_type: "age"` | 各档文案 + 测评 **`score`** |
| 学历 | `2` | **多条**（如 6 档） | `disp_type: "education"`，`content_type: "education"` | 各档文案 + 测评 **`score`** |

**导入 JSON 推荐示例（手机 · 单选项）**：
```json
{
  "title": "手机",
  "en_name": "QUESTION_TYPE_MOBILE",
  "custom_attr": {"disp_type": "mobile", "blank_type": "single", "show_seq": "on"},
  "option_list": [
    {
      "title": "填空1",
      "is_open": false,
      "custom_attr": {"checkmethod": "mobile", "text_row": 1, "text_col": 20}
    }
  ]
}
```

**日期 / 时间（`QUESTION_TYPE_DATE` 等，线上下落为 `question_type: 95`）**：
```json
{
  "title": "日期",
  "en_name": "QUESTION_TYPE_DATE",
  "custom_attr": {"disp_type": "date", "show_seq": "on"},
  "option_list": [
    {"title": "日期", "is_open": false, "custom_attr": {}}
  ]
}
```
时间题须 **2 项**：`{"title": "时", ...}`、`{"title": "分", ...}`（与样例项目一致）。

### 5.3 学号 / 工号 / 班级 / 部门（测评常见，`question_type: 6`）

线上下落均为 **1 条**占位选项，`title` 多为「填空1」，题目侧用 **`content_type`** 或 **`disp_type`** 区分（项目 **`69d2570b…`**）：

| 题干场景 | 题目 `custom_attr` | 选项 `custom_attr`（测评） |
|----------|-------------------|---------------------------|
| 学号 | `content_type: "student_id"` | `score`、`text_row`、`text_col` |
| 工号 | `disp_type: "employee_id"`，可配合 `blank_type: "single"` | 同上 |
| 班级 | `content_type: "classes"` | 同上 |
| 部门 | `content_type: "department"` | 同上 |

**导入 JSON 推荐（学号示例）**：
```json
{
  "title": "学号",
  "en_name": "QUESTION_TYPE_BLANK",
  "custom_attr": {"content_type": "student_id", "total_score": 0},
  "option_list": [
    {"title": "填空1", "is_open": false, "custom_attr": {"score": 0, "text_row": 1, "text_col": 10}}
  ]
}
```

### 5.4 地理位置多格（`disp_type: geographical_multiple_blank`）

测评样例「所在位置」：**`question_type: 95`**，`custom_attr.disp_type: "geographical_multiple_blank"`，**3 条**选项，常见 `name_en` 为 **`address` / `longitude` / `latitude`**（项目 **`69d2570b…`**）。导入时宜按三格分别建 `option_list` 三项并在 `custom_attr` 中携带对应 `name_en`（若导入接口支持）。

**示例**：
```json
{
  "title": "所在位置",
  "en_name": "QUESTION_TYPE_MULTIPLE_BLANK",
  "custom_attr": {"disp_type": "geographical_multiple_blank", "total_score": 0},
  "option_list": [
    {"title": "填空1", "is_open": false, "custom_attr": {"name_en": "address"}},
    {"title": "填空2", "is_open": false, "custom_attr": {"name_en": "longitude"}},
    {"title": "填空3", "is_open": false, "custom_attr": {"name_en": "latitude"}}
  ]
}
```

**注意**：`edit_project` 中该题 `question_type` 为 **95**，与 `QUESTION_TYPE_MULTIPLE_BLANK` 的导入映射未必一致；若导入失败，以 **`fetch_project` 回包** 或官方模板为准调整 `en_name`。

**兼容 · 仍可使用空 `option_list` 的示例（部分题型）**：
```json
// 手机号（历史写法）
{
  "title": "您的手机号码",
  "en_name": "QUESTION_TYPE_MOBILE",
  "custom_attr": {"disp_type": "mobile"},
  "option_list": []
}

// 日期（历史写法）
{
  "title": "请选择日期",
  "en_name": "QUESTION_TYPE_DATE",
  "custom_attr": {},
  "option_list": []
}
```

---

## 六、考试测评题（带正确答案）

**适用场景**：考试、测验、知识竞赛

**规则**：
- `p_type` 必须为 `2`
- `type_id` 使用考试测评类型
- 每题设置 `custom_attr`：
  - `calculation`: `"auto_score"` (自动计分)
  - `answer_analysis`: 答案解析文本
  - `answer_score`: `"on"` (开启计分)
  - `total_score`: 题目总分
- 选项设置 `custom_attr.is_correct`: `"1"` (正确) / `"0"` (错误)
- 选项设置 `custom_attr.score`: 选项分值

**单选题示例**：
```json
{
  "title": "Python的创建者是？",
  "en_name": "QUESTION_TYPE_SINGLE",
  "custom_attr": {
    "calculation": "auto_score",
    "answer_analysis": "Python由Guido van Rossum于1991年创建",
    "answer_score": "on",
    "total_score": 10
  },
  "option_list": [
    {"title": "Guido van Rossum", "is_open": false, "custom_attr": {"is_correct": "1", "score": "10"}},
    {"title": "James Gosling", "is_open": false, "custom_attr": {"is_correct": "0"}},
    {"title": "Brendan Eich", "is_open": false, "custom_attr": {"is_correct": "0"}},
    {"title": "Dennis Ritchie", "is_open": false, "custom_attr": {"is_correct": "0"}}
  ]
}
```

**多选题示例**：
```json
{
  "title": "以下哪些是Python的数据类型？",
  "en_name": "QUESTION_TYPE_MULTIPLE",
  "custom_attr": {
    "calculation": "auto_score",
    "answer_analysis": "list、dict、tuple是Python基础数据类型",
    "answer_score": "on",
    "total_score": 10
  },
  "option_list": [
    {"title": "list", "is_open": false, "custom_attr": {"is_correct": "1", "score": "5"}},
    {"title": "dict", "is_open": false, "custom_attr": {"is_correct": "1", "score": "5"}},
    {"title": "tuple", "is_open": false, "custom_attr": {"is_correct": "1", "score": "5"}},
    {"title": "array", "is_open": false, "custom_attr": {"is_correct": "0"}}
  ]
}
```

**填空题示例**：
```json
{
  "title": "Python的输出函数是______",
  "en_name": "QUESTION_TYPE_BLANK",
  "custom_attr": {
    "blank_type": "single",
    "calculation": "auto_score",
    "answer_analysis": "print是Python的输出函数",
    "answer_score": "on",
    "total_score": 5
  },
  "option_list": [
    {"title": "print", "is_open": false, "custom_attr": {"is_correct": "1"}}
  ]
}
```

---

## 七、结束语设置 (survey_result)

**规则**：
- 类型为 JSON 字符串（需 `JSON.stringify` 后转义）
- 根据分值范围显示不同结束语
- `scope`: [最小值, 最大值]
- `content`: 显示内容

**示例**：
```json
{
  "survey_result": "[{\"scope\":[0,60], \"content\": \"还需加油\"},{\"scope\":[60, 80], \"content\": \"真厉害\"}]"
}
```

---

## 八、完整生成示例

### 生成普通问卷

**输入需求**：
> 创建一个客户满意度调查问卷，包含：
> 1. 性别（单选）
> 2. 年龄段（下拉单选）
> 3. 满意度评价（矩阵单选）
> 4. 建议（多行填空）

**生成输出**：
```json
{
  "title": "客户满意度调查",
  "type_id": "51dd234e9b9fbe6646bf4dcc",
  "p_type": null,
  "welcome": "感谢您参与本次调查",
  "cover": "",
  "phone_cover_url": "",
  "question_list": [
    {
      "title": "您的性别是？",
      "en_name": "QUESTION_TYPE_SINGLE",
      "custom_attr": {},
      "option_list": [
        {"title": "男", "is_open": false, "custom_attr": {}},
        {"title": "女", "is_open": false, "custom_attr": {}}
      ]
    },
    {
      "title": "请选择您的年龄段",
      "en_name": "QUESTION_TYPE_SINGLE",
      "custom_attr": {"disp_type": "dropdown"},
      "option_list": [
        {"title": "18岁以下", "is_open": false, "custom_attr": {}},
        {"title": "18-25岁", "is_open": false, "custom_attr": {}},
        {"title": "26-35岁", "is_open": false, "custom_attr": {}},
        {"title": "36-50岁", "is_open": false, "custom_attr": {}},
        {"title": "50岁以上", "is_open": false, "custom_attr": {}}
      ]
    },
    {
      "title": "请评价以下各项满意度",
      "en_name": "QUESTION_TYPE_MATRIX_SINGLE",
      "custom_attr": {},
      "option_list": [
        {"title": "非常不满意", "is_open": false, "custom_attr": {}},
        {"title": "不满意", "is_open": false, "custom_attr": {}},
        {"title": "一般", "is_open": false, "custom_attr": {}},
        {"title": "满意", "is_open": false, "custom_attr": {}},
        {"title": "非常满意", "is_open": false, "custom_attr": {}}
      ]
    },
    {
      "title": "您有什么建议？",
      "en_name": "QUESTION_TYPE_BLANK",
      "custom_attr": {"blank_type": "multiple"},
      "option_list": []
    }
  ],
  "import_type": "0",
  "ai_source": 11
}
```

---

## 九、校验清单

生成 JSON 后检查：

- [ ] `title` 不超过 100 字
- [ ] `type_id` 和 `p_type` 匹配（参考类型对照表）
- [ ] `question_list` 不超过 300 题
- [ ] 每题包含 `title`, `en_name`, `custom_attr`, `option_list`
- [ ] `en_name` 使用正确的题型标识
- [ ] 单选/多选题 `option_list` 至少有 2 个选项
- [ ] 普通填空题可用 `[]` 作兼容；**与线上一致**时建议 1 项占位 + `text_row`/`text_col`（见 §3、第十二节）
- [ ] **身份证**按 §5.1；**打分 / 上传 / 签名 / 日期**等建议按 §4 各小节与第十二节带占位选项
- [ ] **判断题（测评）**须 2 项且含 `is_correct`/`score`（见 §4 ·1）
- [ ] **地址题**建议 4 项（省/市/区/详细）（见 §4 ·12）
- [ ] 考试题 `p_type = 2` 且选项有 `is_correct` 标记
- [ ] `survey_result` 是 JSON 字符串（非对象）

---

## 十、题型选择速查表

| 需求描述 | en_name |
|---------|---------|
| 单选（圆点） | QUESTION_TYPE_SINGLE |
| 下拉单选 | QUESTION_TYPE_SINGLE + disp_type: dropdown |
| 判断题 | QUESTION_TYPE_SINGLE + disp_type: judge + **2 项**选项（是/否，测评带 `is_correct`/`score`） |
| 多选（方框） | QUESTION_TYPE_MULTIPLE |
| 单行填空 | QUESTION_TYPE_BLANK + blank_type: single |
| 多行填空 | QUESTION_TYPE_BLANK + blank_type: multiple |
| 多项填空（多个输入框） | QUESTION_TYPE_MULTIPLE_BLANK |
| 打分（星星） | QUESTION_TYPE_SCORE + **1 项**占位选项（见 §5 打分题） |
| NPS评分（0-10） | QUESTION_TYPE_SCORE + disp_type: nps_score + **1 项** + min/max 0～10 |
| 矩阵单选 | QUESTION_TYPE_MATRIX_SINGLE |
| 矩阵多选 | QUESTION_TYPE_MATRIX_MULTIPLE |
| 拖拽排序 | QUESTION_TYPE_SORT |
| 文字说明 | QUESTION_TYPE_DESC |
| 省市区级联 | QUESTION_TYPE_CASCADE + disp_type: cascader |
| 文件上传 | QUESTION_TYPE_UPLOAD + disp_type: upload_file + **1 项** |
| 图片上传 | QUESTION_TYPE_IMAGE_UPLOAD + disp_type: image_upload + **1 项** |
| 地址填写 | QUESTION_TYPE_ADDRESS + disp_type: address + **4 项**（省/市/区/详细） |
| 手写签名 | QUESTION_TYPE_SIGNATURE + disp_type: signature + **1 项** |
| 日期 | QUESTION_TYPE_DATE + `disp_type: date` + **1 项**（见 §5.2） |
| 时间 | 编辑器时间题 + `disp_type: time` + **2 项**（时/分，见 §5.2） |
| 分页 | QUESTION_TYPE_SPLIT_PAGE + disp_type: page_break |
| 性别 | QUESTION_TYPE_SEX + **2 项**（男/女，见 §5.2） |
| 手机号 | QUESTION_TYPE_MOBILE + disp_type: mobile + **1 项** + `checkmethod: mobile` |
| 邮箱 | QUESTION_TYPE_EMAIL + **1 项** + `checkmethod: email` |
| 姓名 | QUESTION_TYPE_NAME + **1 项**占位（见 §5.2） |
| 学号/工号/班级/部门 | 见 §5.3（多为 `QUESTION_TYPE_BLANK` + `content_type` / `disp_type`） |
| 身份证 | **推荐**：`QUESTION_TYPE_BLANK` + `content_type: id_card` + `option_list` 一条且 `checkmethod: id_num`（见 §5.1）；兼容：`QUESTION_TYPE_ID_CARD` |

---

## 十一、本文档中约定 `option_list` 为空数组 `[]` 的题型

以下仅整理 **本指南前文仍保留的兼容写法**（「可传 `[]` 尝试导入」）。**实测线上下落**多为 **非空 `option_list`**，请以 **第十二节** 及第四节、第五节各小节「线上下落 / 推荐导入」为准；**判断题**线上下落为 **2 项**，不再视为空选项题型。

| 章节 | en_name（或条件） | 说明 |
|------|-------------------|------|
| 四 ·3 填空 | `QUESTION_TYPE_BLANK`（普通单行/多行） | 兼容 `[]`；**推荐 1 项**，见 §3 |
| 四 ·5 打分 | `QUESTION_TYPE_SCORE` | 兼容 `[]`；**推荐 1 项**，见 §5 小节 |
| 四 ·9 说明 | `QUESTION_TYPE_DESC` | 仅展示文案，通常无答题选项 |
| 四 ·10 级联 | `QUESTION_TYPE_CASCADE` + `disp_type: cascader` | 级联数据由平台加载 |
| 四 ·11 上传 | `QUESTION_TYPE_UPLOAD` / `QUESTION_TYPE_IMAGE_UPLOAD` | 兼容 `[]`；**推荐各 1 项**，见 §11 |
| 四 ·12 地址 | `QUESTION_TYPE_ADDRESS` | 兼容 `[]`；**推荐 4 项**，见 §12 |
| 四 ·13 签名 | `QUESTION_TYPE_SIGNATURE` | 兼容 `[]`；**推荐 1 项**，见 §13 |
| 四 ·14 分页 | `QUESTION_TYPE_SPLIT_PAGE` + `disp_type: page_break` | 分页符 |
| 五、预设 | 手机/邮箱/日期等 | 兼容 `[]`；**推荐**见 §5.2 |
| 五、预设 | `QUESTION_TYPE_ID_CARD`（仅兼容） | 见 §5.1 **推荐非空** |

**须带选项（节选）**：普通单选/多选（含 **判断题 2 项**）、多项填空、矩阵单选/多选、排序题；第六节考试填空；§5.2 性别/年龄/学历多选项。

---

## 十二、线上下落 `question_type` 与 `option_list` 对照（参考项目）

以下为 **`GET …/edit_project/`** 返回中的典型形态，源项目：

- **`69d257be4d1e8d523899937b`**（`survey`）
- **`69d2570bef3af30a3376fd24`**（`assess`）

导入 JSON 的 `en_name` 与下列 **`question_type`（数字）** 为不同层级的标识，对照用于核对「为何本地写 `[]` 线上却有选项」。

| 场景（题干示例） | `question_type` | `option_list` 条数 | 题目 `custom_attr` 要点 | 选项侧要点 |
|------------------|-----------------|-------------------|---------------------------|------------|
| 单行填空 | `6` | **1** | `blank_type: single` 等 | `text_row`、`text_col` |
| 判断题 | `2` | **2** | `disp_type: judge` | `is_correct`、`score`（测评） |
| 姓名 | `6` | **1** | `disp_type: name` | 行列；测评 `score` |
| 手机 | `6` | **1** | `disp_type: mobile` | **`checkmethod: mobile`** |
| 邮箱 | `6` | **1** | `disp_type: email` | **`checkmethod: email`** |
| 学号 | `6` | **1** | `content_type: student_id` | 测评 `score` + 行列 |
| 工号 | `6` | **1** | `disp_type: employee_id` | 同上 |
| 班级 | `6` | **1** | `content_type: classes` | 同上 |
| 部门 | `6` | **1** | `content_type: department` | 同上 |
| 性别 | `2` | **2** | `disp_type: sex`，`content_type: sex` | 男/女；测评 `score` |
| 年龄 | `2` | **多** | `disp_type: age`，`content_type: age` | 各档 + 测评 `score` |
| 学历 | `2` | **多** | `disp_type: education` | 各档 + 测评 `score` |
| NPS | `50` | **1** | `disp_type: nps_score`，`min/max_answer_num` | 占位项 |
| 量表打分（如 1～5） | `50` | **1** | `min_answer_num: 1`，`max: 5`，`magnitude_scale` 等 | 占位项 |
| 文件上传 | `95` | **1** | `disp_type: upload_file` | `title` 如「选择文件上传」 |
| 图片上传 | `95` | **1** | `disp_type: image_upload` | `title` 如「请上传图片」 |
| 日期 | `95` | **1** | `disp_type: date` | 常为 `{}` |
| 时间 | `95` | **2** | `disp_type: time` | 「时」「分」 |
| 签名 | `95` | **1** | `disp_type: signature` | 占位「填空1」等 |
| 地理三格 | `95` | **3** | `disp_type: geographical_multiple_blank` | `name_en`: address/longitude/latitude |
| 地址（四级） | `8` | **4** | `disp_type: address`，`drop_type: address` | 省/市/区/详细地址 |

**说明**：同一 `question_type: 95` 对应多种 UI，需以题目 **`custom_attr.disp_type`** 区分；身份证题见 **§5.1**（`question_type: 6` + `content_type: id_card` + `checkmethod: id_num`）。

---
