---
name: wjx-survey-ppt
description: "将问卷星问卷的回收数据自动生成为可演示的 PPT 报告。Use when the user mentions: 问卷报告/问卷PPT/问卷分析报告/调查报告/满意度报告/NPS报告/把问卷做成PPT/导出PPT/生成幻灯片 — or asks to convert a survey result into a slide deck. 与 wjx-cli-use 配合：先用 wjx-cli 拉取问卷结构与答卷数据，再调 ppt-master-survey 渲染引擎生成 .pptx 文件，全程不需要用户手动导出数据。"
---

# wjx-survey-ppt 使用指南

把问卷星的问卷答卷数据，端到端生成一份可直接演示的 PPT 报告。

**典型用户输入**：
- 「把问卷 12345 做成 PPT」
- 「这个 NPS 问卷出一份分析报告」
- 「帮我把上周那个满意度调查的结果做成幻灯片」

**核心管线**（三层）：
```
wjx-cli 拉数据  →  AI 填槽生成 SVG  →  ppt-master-survey 渲染 PPTX
   Layer 1            Layer 2                Layer 3
```

---

## AI Agent 行为准则（必读）

### 规则 0：依赖前置检查（强制）

执行 skill 工作流前，**必须**先确认 3 项依赖都满足，缺哪项就先帮用户补哪项，**不要**直接进入数据拉取/渲染流程。

| 依赖 | 检测命令 | 缺失时的处理 |
|---|---|---|
| `wjx` CLI | `wjx --version` | 先按 wjx-cli-use skill 的安装流程走 |
| `python` ≥ 3.10 | `python --version` | 引导用户装 Python（参见 `references/install-python.md`） |
| `ppt-master-svg2pptx` 命令 | `python -m ppt_master_survey --help` 或 `ppt-master-svg2pptx --help` | `pip install ppt-master-survey`，**由 AI 在后台执行**，不要让用户自己敲 |

如果 `wjx` 已配置但未登录（API Key 缺失/失效），按 wjx-cli-use 规则 5 处理。

### 规则 1：用户说"做 PPT"= 一次性完成全流程

收到诸如「把问卷 X 做成 PPT」的请求，**一次性**完成：拉数据 → 生成 SVG → 渲染 PPTX → 给文件路径。中途不要让用户做选择题，除非：
- 数据量异常（< 5 份答卷 / > 100 万份答卷）
- 题型有 skill 不支持的（如签名题、文件题，需告知会跳过）
- 问卷未发布或答卷为空（必须先告知，不要硬出空 PPT）

### 规则 2：故事线固定，不要改写结构

Phase 1 MVP 只支持**一种**叙事结构（10 页通用业务报告）：

```
P01 封面（问卷标题 + 时间窗口 + 样本量）
P02 执行摘要（3 个关键发现，AI 总结）
P03 样本概览（回收量 / 完成率 / 平均答题时长）
P04 单选题分布 TopN（自动选 2-3 道有代表性的）
P05 多选题分布
P06 量表/评分题（NPS 检测到则单独成页）
P07 矩阵题热力图（如有）
P08 开放题词云/关键词
P09 关键洞察（AI 综合分析）
P10 附录（问卷链接 + 数据导出说明）
```

**不要**根据用户描述临时改变页数、删页或加页。需要不同结构的请求就告知"目前固定结构，自定义模板在 Phase 2"。

### 规则 3：SVG 用填槽模板，不要现写

`templates/slide_layouts/` 下提供了每页的 SVG 模板，AI 的工作是**读取模板里的 `{{占位符}}` → 用数据替换 → 写到 project 目录**。**不要**自己从零写 SVG 元素树，原因：
- 现写 SVG 容易出 viewBox/尺寸错误，渲染翻车
- 现写没法保证视觉一致（字体/颜色/间距）
- ppt-master 对 SVG 有严格要求（`<text>` 必须 flatten tspan、`<use>` 必须 expand），模板已处理

如果某页模板不存在（比如矩阵题没数据），跳过那页，**不要**用其他模板顶替。

### 规则 4：渲染必须走 PyPI 包，不要直接 import

调用 ppt-master-survey 渲染只能通过 console_script `ppt-master-svg2pptx` 或 `python -m ppt_master_survey`。**不要**：
- `from svg_to_pptx import ...`（可能找不到模块，依赖 sys.path 注入）
- 直接复制 ppt-master 源码到 skill 里
- 调用 `python /path/to/svg_to_pptx.py`（路径不可移植）

### 规则 5：输出文件路径必须返回给用户

渲染完成后**必须**给出：
- pptx 绝对路径（用户能直接打开）
- 页数 + 文件大小
- 如有跳过的页/题，明确列出

正确：「报告已生成，10 页，1.2MB：`D:/.../survey-report-2026-05-06.pptx`」
错误：「报告已生成」（缺路径）

### 规则 6：失败要给可操作的下一步

任何环节失败都不能只甩错误堆栈，必须给用户：
1. 失败的具体环节（拉数据 / 生成 SVG / 渲染 PPTX）
2. 可能原因（最多 3 条）
3. 立刻能做的一件事

例：「PPT 渲染失败：`UnicodeEncodeError: cp1252`。原因：Windows 控制台编码冲突。请告诉我重试一次（skill 会强制 UTF-8 环境变量）。」

### 规则 7：面向用户说自然语言，不说 CLI 命令

跟 wjx-cli-use 一致——用户视角的对话不出现命令行。AI 在后台跑命令，对用户呈现**结果**而非过程。

---

## 快速路由

### 推荐：分步式工作流（4 阶段确认，正式交付场景）

每阶段产出一份可编辑 JSON / 样章，**Agent 在阶段间介入修改 + 让用户确认**，最大化避免一锤子失败。

```
data → outline → preview → final
 |        |          |         |
 |        |          |         └─ 完整 PPTX（消费带 AI 解读的 outline.json）
 |        |          └─ 封面 + 一张代表图 SVG 样章（让用户确认主题风格）
 |        └─ outline.json：哪些页 / 顺序 / 标题 / ai_summary（让用户/agent 确认结构 + 文字）
 └─ data.json：raw 数据（不可改）
```

| Stage | 命令 | Agent 在此阶段应做的事 |
|---|---|---|
| **data** | `python -m wjx_survey_ppt --vid X --workdir Y --stage data` | 拉数据落 `Y/data.json`；之后立即询问用户"开始生成大纲？" |
| **outline** | `python -m wjx_survey_ppt --workdir Y --stage outline --theme T` | 生成 `Y/outline.json` 后，**Agent 读 data.json 回填 ai_findings / ai_insights / 各 ai_summary**；让用户检查页面清单、可改 include/order/title/theme |
| **preview** | `python -m wjx_survey_ppt --workdir Y --stage preview` | 把封面 + Top1 图表的 SVG 样章落到 `Y/preview/`；让用户在浏览器/AI 里看主题风格是否合适，不合适回头改 outline.json 的 theme 字段 |
| **final** | `python -m wjx_survey_ppt --workdir Y --stage final` | 出全本 PPT 前会按 `data.json` 里的 vid 重新从 wjx-cli 刷新问卷/答卷/默认报告数据；若刷新后数据变化且 outline 的 AI 解读基于旧数据，会停止生成并要求基于最新 data.json 更新解读 |

### 一步法（探索/快速预览场景）

| 用户意图 | skill 入口 |
|---|---|
| 「把问卷 X 做成 PPT」 | `python -m wjx_survey_ppt --vid X` |
| 「用这份数据生成 PPT」（用户给 JSON 文件） | `python -m wjx_survey_ppt --data-file path.json` |
| 「换温暖风格」/「极简黑白」 | 加 `--theme warm` / `--theme minimal` |
| 「检查环境是否齐全」 | `python -m wjx_survey_ppt --check` |
| 「先看会包含哪些页」 | `python -m wjx_survey_ppt --vid X --plan-only` |

一步法不走 outline 阶段，AI 解读由 skill 内置规则引擎兜底（文字偏机械）。**用户期待"漂亮报告"时一律走分步法**。

> 注：上述 `python -m` 命令是 skill 内部脚本的统一入口，AI **不要**把命令展示给用户，对用户呈现进展不展示命令。

## 主题选择

skill 内置 **8 套**视觉主题，通过 `--theme <name>` 切换，默认 `business`：

| 主题 | 视觉气质 | 标杆参考 | 适用场景 |
|---|---|---|---|
| `business`（默认） | 深蓝咨询风 + 节制配色 | McKinsey | 企业内审 / to B 调研 |
| `consulting` | 黑底白字 + 橘红强调 / smart simplicity | BCG / Bain | 战略咨询、决策汇报 |
| `editorial` | 衬线大标题 + 巨幅留白 | 财新、白皮书 | 行业研究观察、深度阅读型 |
| `minimal` | 极简黑白灰、无装饰 | JJPPT | 学术、内审、设计偏好 |
| `warm` | 暖砖红 + 米色 | 99PPT 餐饮 | 零售、餐饮、文旅、亲子 |
| `soft` | 莫兰迪低饱和 | 千图莫兰迪 | 教育、心理、女性消费 |
| `tech-dark` | 深底霓虹色 / 未来感 | 互联网 SaaS 产品年报 | AI/SaaS、互联网产品调研 |
| `gov-red` | 朱红 + 金黄 / 庄重 | LFPPT 政务 | 党政机关、国企汇报 |

主题选择规则（按用户输入关键词启发式判断，**不主动追问**）：

- 商务稳重 / 企业内审 / 咨询 → `business`（默认）
- 战略 / 决策 / 高层汇报 / 黑色调 → `consulting`
- 财经 / 白皮书 / 研究观察 / 杂志感 → `editorial`
- 极简 / 黑白 / 学术 → `minimal`
- 餐饮 / 零售 / 文旅 / 亲子 / 暖色 → `warm`
- 教育 / 心理 / 女性消费 / 柔和 → `soft`
- 互联网 / SaaS / AI 产品 / 科技 / 深色 → `tech-dark`
- 党政 / 政务 / 国企 / 庄重红色 → `gov-red`
- 用户**明确指定**主题名 → 直接使用
- 在 outline 阶段，用户不满意可在 outline.json 改 theme 后重跑 preview / final

---

## 输入路径

### 路径 A：从 vid 全自动（默认）

用户只给问卷 ID。skill 自动：

1. `wjx survey get --vid X --json` → 拿题目结构与 `answer_valid`；**PPT 样本量以 `answer_valid` 为权威有效答卷数**
2. `wjx response count --vid X --json` → 仅作诊断对照；`total_count/join_times` 不得直接当 PPT 样本量
3. `wjx response report --vid X --json` → 拿默认聚合数据（单选/多选/量表/矩阵的分布）
4. 若默认报告分布总数与 `answer_valid` 不一致 → 自动回退 `wjx response query` 分页明细聚合，避免把失败/废卷计入 PPT
5. `wjx response 360-report --vid X --json` → 拿详细数据（开放题原文、答题时长）
6. 如检测到 0~10 量表题 → `wjx analytics nps --json` 算 NPS
7. 如检测到 1~5/1~7 量表题 → `wjx analytics csat --json` 算 CSAT

所有结果合并成统一 `data.json`，喂给 Layer 2。

### 路径 B：从 JSON 文件（高级）

用户提供 `data-file path.json`，跳过 Layer 1。**JSON 格式必须遵守 `references/data-schema.md` 定义**，否则 skill 会报错并指出哪个字段不合规。

适用场景：
- 线下纸质问卷录入的 Excel 转成 JSON
- 跨平台数据（外部工具的导出）
- 离线测试 / 可重复演示

---

## 工作流（分步式 4 阶段，正式交付场景）

### Step 0：依赖检查

跑 `python -m wjx_survey_ppt --check`。失败任一项**立即停止**主流程，按规则 0 处理。

---

### Stage 1：data — 拉数据落地

```
python -m wjx_survey_ppt --vid X --workdir Y --stage data
```

内部依次调 wjx-cli 子命令（survey get / response count 诊断 / response report / 必要时 response query 分页回退 / 360-report / analytics nps|csat），归一化为 `Y/data.json`。样本量以 `survey.answer_valid` 为准；`response count` 只用于发现口径差异。

完整 schema 见 `references/data-schema.md`，关键字段：
```json
{
  "survey": { "title": "...", "vid": "...", "type": 1 },
  "response": { "total": 606, "completed": 606, "avg_time": null },
  "questions": [...],
  "analytics": { "nps": {...}, "csat": [...] },
  "nps_cross_tab": {...},
  "ai_findings": [],          // ← Stage 2 让 agent 填
  "ai_insights": [],
  "ai_page_summaries": {}
}
```

**Agent 在 Stage 1 之后**应当问用户："数据拉到了，X 题、Y 份答卷。要开始生成大纲吗？"

---

### Stage 2：outline — 生成大纲并由 AI 注入解读

```
python -m wjx_survey_ppt --workdir Y --stage outline --theme business
```

产出 `Y/outline.json`，结构：
```json
{
  "theme": "business",
  "_themes_available": ["business","consulting","editorial","gov-red","minimal","soft","tech-dark","warm"],
  "pages": [
    {"name":"P01_Cover","type":"cover","include":true,"title":"..."},
    {"name":"P02_Executive_Summary","type":"exec_summary","include":true,"ai_findings":[]},
    {"name":"P04_Single_Choice","type":"single","qid":"6","include":true,"title":"...","ai_summary":""},
    {"name":"P09_Insights","type":"insights","include":true,"ai_insights":[]},
    ...
  ]
}
```

**Agent 在 Stage 2 必做**：

1. 读 `Y/outline.json` 与 `Y/data.json`
2. 围绕 3 类字段写自然语言，**就地修改** outline.json：

   | 字段 | 位置 | 数量 | 单条字数 | 风格 |
   |---|---|---|---|---|
   | `ai_findings`（在 P02 页对象内） | array | 3 条 | ≤ 56 | 事实+数字，不带主观判断 |
   | `ai_insights`（在 P09 页对象内） | array | 3 条 | ≤ 54 | 事实+解读+行动建议 |
   | `ai_summary`（每个 chart 页对象内） | string | 1 条 | ≤ 76 | 解读 + 1 句行动建议 |

3. 解读时聚焦的事实层级（参照问卷星默认报告口径）：
   - **单选/多选**：Top 选项的占比落差、是否存在长尾、有无明显倾向
   - **量表/CSAT**：分布形态（集中/分散/双峰）、与中性值的偏离
   - **NPS**：score 落在哪个区间（<0 / 0–30 / 30–50 / 50–70 / >70）、贬损者是否偏高、与中国市场参考值（约 30）对照
   - **矩阵**：哪个维度（行）评价最低/最高、是否一致
   - **NPS 分类比较**：组间差异最大的两组、差距是否值得追因
   - **样本量 < 30** 时**必须**附"置信度有限"提醒

4. 把 outline 给用户看，问："以下 N 页是否合适？要跳过/调整哪页？"
   - 用户改 `include: false` 跳页
   - 用户调整 pages 数组顺序
   - 用户改 `title` 重写每页标题

---

### Stage 3：preview — 风格样章

```
python -m wjx_survey_ppt --workdir Y --stage preview
```

产出 `Y/preview/*.svg`：封面 + 各类型代表图各一张（单选/多选/NPS 仪表/矩阵热力/NPS 分类）。

**Agent 在 Stage 3** 让用户看 SVG 文件（在浏览器或 AI 客户端打开），问："主题颜色是否合适？"
- 不合适 → 改 outline.json 的 `theme` 字段，回到 Stage 3 重跑
- 合适 → 进 Stage 4

---

### Stage 4：final — 生成完整 PPT

```
python -m wjx_survey_ppt --workdir Y --stage final
```

产出 `Y/output.pptx`。skill 自动应用 outline.json：
- 生成前按 `data.json.survey.vid` 重新拉取最新数据并覆盖 `data.json`，确保 PPT 使用最新问卷结构、有效答卷数、默认报告和明细聚合
- 若最新数据与生成 outline 时的数据不一致，且 outline 已有 AI 解读，默认停止生成；Agent 必须重新读取最新 `data.json` 并更新 `outline.json` 后再出 PPT
- 按 outline 的 `pages` 顺序排页
- 跳过 `include: false` 的页
- 各页文字用 outline 里的 `title` / `ai_findings` / `ai_insights` / `ai_summary`
- 全局应用 outline 的 `theme`

---

## 一步法工作流（探索/快速预览）

不需要分步确认时，直接：
```
python -m wjx_survey_ppt --vid X --workdir Y [--theme T]
```
内部按 data → 默认 outline → final 一气呵成。AI 解读字段缺失时回退到内置规则引擎（措辞偏机械）。**正式交付一律走分步式**。

### Step 5：返回结果

回复用户：文件路径 + 页数 + 跳过项（如有）。**不**展示中间命令。

---

## 常见错误与处理

| 错误信息 | 原因 | 处理 |
|---|---|---|
| `wjx: command not found` | wjx-cli 未安装 | 引导跑 wjx-cli-use 的 setup.sh |
| `ModuleNotFoundError: ppt_master_survey` | PyPI 包未装 | 后台跑 `pip install ppt-master-survey` |
| `API Key is required` | wjx 未配置 | 按 wjx-cli-use 规则 5 处理 |
| `UnicodeEncodeError: cp1252` | Windows 中文路径 | skill 已内置 UTF-8 注入，重跑一次即可 |
| `vid is required` / `survey not found` | 问卷 ID 错或不属于当前账号 | 让用户确认 vid，或用 `wjx survey list` 找 |
| `no responses` | 问卷无答卷 | 告知用户先收集数据再生成报告 |
| `template not found: P0X` | 内置模板缺失（不应发生） | 这是 bug，让用户报告 |

---

## 参考文件（按需读取）

- `references/data-schema.md` — Layer 1 输出 / Layer 2 输入的统一 JSON schema
- `references/slot-filling.md` — SVG 模板占位符语法、填槽规则、列表/条件展开
- `references/install-python.md` — 各平台安装 Python 3.10+ 的指南
- `references/troubleshooting.md` — 渲染失败、字体丢失、PPT 打开异常等专项排查

---

## 与其他 skill 的关系

| skill | 用途 | 与本 skill 的关系 |
|---|---|---|
| `wjx-cli-use` | 操作问卷星（建问卷/拉答卷/管通讯录） | **依赖**：本 skill 在 Layer 1 调用其暴露的 wjx-cli 命令 |
| `wjx-mcp-use` | 通过 MCP 协议操作问卷星 | 不依赖；MCP 用户可单独使用 |
| `ppt-master`（上游） | 通用 AI 驱动的 PPT 生成 | **裁剪**：本 skill 只用其 svg_to_pptx 渲染引擎，不引入 AI 内容生成层 |

需要做更通用的 PPT（不限于问卷报告），让用户直接用 `ppt-master` skill；本 skill 是问卷场景的窄而深路径。
