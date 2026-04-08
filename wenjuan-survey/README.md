# 📋 问卷网 Skill

[问卷网](https://www.wenjuan.com) 的 Skill 技能包，支持问卷的创建、导入、发布、查询、编辑、报表与数据导出。

## ✨ 功能特性

- **创建并发布问卷** — 支持主题以及本地文本一键创建 + 导入 + 发布并轮询审核/状态
- **获取项目列表** — 分页查询「我的问卷」
- **获取问卷结构** — 查看项目详情（标题、页面、题目、选项等）
- **更新项目与题目** — 修改标题/文案、编辑或删除题目、新增题目
- **发布与停收** — 发布、停止收集等状态变更（亦包含在工作流内）
- **查看报表与数据** — 打开报表页、导出原始数据、查看回收概况统计（如有配置）

## 📦 项目结构

```
wenjuan-survey/
├── SKILL.md                 # Skill 定义（AI Agent 优先阅读）
├── setup.sh                 # 环境检测与依赖安装
├── package.json
├── references/              # 能力参考文档
│   ├── auth.md
│   ├── create_survey.md
│   ├── list_projects.md
│   ├── fetch_project.md
│   ├── update_project.md
│   ├── create_question.md
│   ├── update_question.md
│   ├── delete_question.md
│   ├── publish_survey.md
│   ├── get_report.md
│   ├── export_data.md
│   ├── overview_stats.md
│   ├── bind_mobile.md
│   ├── check_env.md
│   ├── version_check.md
│   └── ...                  # 其余见目录
├── scripts/                 # 可执行脚本
│   ├── login_auto.js
│   ├── workflow_create_and_publish.js
│   ├── import_project.js
│   ├── list_projects.js
│   ├── fetch_project.js
│   ├── update_project.js
│   ├── create_question.js
│   ├── edit_question.js
│   ├── delete_question.js
│   ├── publish.js
│   ├── open_report.js
│   ├── export_data.js
│   ├── overview_stats.js
│   ├── bind_mobile.js
│   └── ...
└── README.md
```

## 🚀 快速开始

### 前置依赖

- [Node.js](https://nodejs.org) `>= 18`
- 可访问 [问卷网](https://www.wenjuan.com)

推荐使用一键环境脚本（检测 Node、安装 `npm` 依赖）：

```bash
bash ./setup.sh
```

或手动安装依赖：

```bash
npm install
```

### 登录授权

微信扫码登录，凭证会写入 `~/.wenjuan/` 与项目内 `.wenjuan/auth.json`。详见 [references/auth.md](references/auth.md)。

```bash
node scripts/login_auto.js --max-time 300
```

### 验证环境（不检查登录）

```bash
node scripts/check_env.js
```

## 🔧 工具列表

以 **Skill 能力名** 对应 **实现脚本** 与 **参考文档**（Agent / 人工均可直接打开 `references`）。


| 能力                | 说明                                                       | 参考文档                                                |
| ----------------- | -------------------------------------------------------- | --------------------------------------------------- |
| `create_survey`   | 创建并发布：默认模板或题目 JSON；工作流见 `workflow_create_and_publish.js` | [create_survey.md](references/create_survey.md)     |
| `import_project`  | 仅按「完整项目 JSON」导入（需含 `title`、`question_list` 等）            | （脚本 `import_project.js`，流程见 create_survey）          |
| `list_projects`   | 获取我的问卷列表                                                 | [list_projects.md](references/list_projects.md)     |
| `fetch_project`   | 获取项目详细结构                                                 | [fetch_project.md](references/fetch_project.md)     |
| `update_project`  | 更新项目信息（标题、欢迎语、结束语等）                                      | [update_project.md](references/update_project.md)   |
| `create_question` | 在项目中新增题目                                                 | [create_question.md](references/create_question.md) |
| `update_question` | 更新单题（`edit_question.js`）                                 | [update_question.md](references/update_question.md) |
| `delete_question` | 删除题目                                                     | [delete_question.md](references/delete_question.md) |
| `publish_survey`  | 发布 / 停止收集等                                               | [publish_survey.md](references/publish_survey.md)   |
| `get_report`      | 查看报表（`open_report.js`，可控制是否唤起浏览器）                        | [get_report.md](references/get_report.md)           |
| `export_data`     | 导出原始答题数据                                                 | [export_data.md](references/export_data.md)         |
| `overview_stats`  | 回收概况（答卷数、浏览、完成率等，视账号与接口而定）                               | [overview_stats.md](references/overview_stats.md)   |
| `bind_mobile`     | 绑定手机号（部分发布场景需要）                                          | [bind_mobile.md](references/bind_mobile.md)         |
| `check_version`   | 检查 Skill 版本说明                                            | [version_check.md](references/version_check.md)     |
| `check_env`       | 检查 Node 与依赖安装                                            | [check_env.md](references/check_env.md)             |


### 调用示例

```bash
# 登录（扫码）
node scripts/login_auto.js --max-time 300

# 一键：创建 + 导入题目 + 发布（题目文件为「题目数组」或完整项目 JSON，见 create_survey 文档）
node scripts/workflow_create_and_publish.js \
  --file questions.json \
  --title "我的问卷" \
  --type survey

# 项目列表（需 JWT，可从 .wenjuan/auth.json 读取 access_token）
node scripts/list_projects.js -t "<access_token>" -p 1 -n 20

# 获取项目结构（参数以 fetch_project 文档为准）
node scripts/fetch_project.js --help

# 导入完整项目 JSON（非「仅工作流」场景时使用）
node scripts/import_project.js -f project.json
```

更多参数与边界（`--url`、`--stdin`、`--type` 等）见 [references/create_survey.md](references/create_survey.md)。

## 📝 项目类型（对应 `--type`）


| `--type` | 场景      | 说明                  |
| -------- | ------- | ------------------- |
| `survey` | 调研      | 通用问卷调查              |
| `vote`   | 投票 / 评选 | 投票类项目               |
| `form`   | 表单      | 报名、登记、信息收集          |
| `assess` | 测评 / 考试 | 打分、测验类（题目结构需符合测评规范） |


## 📐 数据模型（简要）

问卷网侧以「项目（Project）」为核心，脚本与 JSON 导入通常包含：

```
项目（Project）
├── 基本信息：title、type_id、p_type、status …
├── question_list[]（题目）
│   ├── title、en_name（题型）
│   ├── custom_attr（展示与题型相关配置）
│   └── option_list[]（选项；部分题型固定占位）
└── …
```

字段与题型细节见 [references/project_json_structure_guide.md](references/project_json_structure_guide.md) 及各 `references`。

## 🔗 URL 说明

- **答题链接**（有短链 id 时）：`https://www.wenjuan.com/s/{short_id}`
- **报表**（按项目 id）：`https://www.wenjuan.com/report/topic/{project_id}`（具体以平台与 `open_report.js` 为准）

从链接或控制台输出中取得 `project_id` / `short_id` 后，即可配合 `fetch_project`、`open_report`、`export_data` 等脚本使用。

## 🤖 AI Agent 集成

本 Skill 以 **文档 + 脚本** 方式集成：

1. **入口**：阅读根目录 [SKILL.md](SKILL.md) 与 [references/](references/) 中对应能力的 `.md`
2. **执行**：在仓库目录下通过 `node scripts/<脚本>.js` 调用（登录态见 `.wenjuan/auth.json`）
3. **建议流程**：凡是「新建/导入/发布」，优先 [references/create_survey.md](references/create_survey.md) 中的 `workflow_create_and_publish.js` 工作流

## ❓ 常见问题


| 现象 / 错误                     | 说明                           | 处理建议                                                  |
| --------------------------- | ---------------------------- | ----------------------------------------------------- |
| `认证失败` / `10001` / Token 无效 | 登录态过期或未登录                    | 重新执行 `node scripts/login_auto.js`                     |
| 发布提示绑定手机号                   | 平台风控或账号要求                    | 按 [bind_mobile.md](references/bind_mobile.md) 完成绑定后重试 |
| 发布后长时间「审核中」                 | 平台审核队列                       | 工作流会轮询；也可在网页端查看审核状态                                   |
| 列表脚本要求 `-t`                 | `list_projects.js` 需显式传入 JWT | 从 `.wenjuan/auth.json` 读取 `access_token` 传入           |


## 📄 许可

本项目代码许可见 [package.json](package.json) 中的 `license` 字段。问卷网平台版权归问卷网所有。使用请遵守 [问卷网](https://www.wenjuan.com) 服务条款与当地法律法规。