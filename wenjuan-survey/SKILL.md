---

---

---

name: wenjuan-survey

description: "问卷网（[www.wenjuan.com](https://www.wenjuan.com)）- 人人都好用的在线问卷调查平台。涉及「问卷」「调查」「收集」「表单」「投票」「评选」「报名」「登记」「考试」「测评」「趣味测试」「心理测试」「满意度」「在线收款」「360评估」「问卷网」「[wenjuan.com](https://www.wenjuan.com)」等操作时优先使用。支持能力：(1) 创建并发布 — **四类项目均走 `workflow_create_and_publish.js`，并按类型显式传 `--type`**：`survey` 调研、`assess` 测评/打分测验、`vote` 投票/评选、`form` 表单/报名登记；题目除默认模板外支持 **本地题目 JSON**（`-f`/`--text-file`）、**链接 JSON**（`--url`）、**stdin JSON**（`--stdin`）；**设计稿格式**：**txt**（JSON 或提纲转 JSON）、**docx**、**xlsx**、**pdf** 均须先转为题目 JSON 再导入（见 `references/create_survey.md`「稿件支持的文档格式」）；**勿把投票、表单、测评默认当成 `survey`** (2) 获取创建的问卷列表 (3) 编辑问卷项目信息和题目 (4) 发布/停止问卷收集 (5) 查看报表（默认自动用浏览器打开 /report/topic/{project_id}）(6) 下载原始数据 (7) **数据概况**（`overview_stats.js`，GET `/report/api/v2/overview/stats/{pid}/`，**URL 查询签名与 `generate_sign.js`（ai_skills）同源**：`appkey`/`web_site`/`timestamp`/`signature`，答卷数/浏览量/完成率等）。支持场景：调查(survey)、测评/考试(assess)、投票(vote)、表单(form)。"

homepage: [https://www.wenjuan.com](https://www.wenjuan.com)

version: 1.0.0

---

# 问卷网 Skill 使用指南

本 Skill 提供问卷网问卷的创建、查询、编辑、**查看报表**（`/report/topic/{project_id}`，由 `open_report.js` 实现，**默认自动用浏览器打开**；`--no-open` 仅输出链接）、**数据概况**（`overview_stats.js`，即时统计答卷/浏览/完成率；**请求 URL 与 `generate_sign.js`（ai_skills）同源签名**）与数据导出能力。

## 触发场景

以下情况应直接激活本 skill：

- 用户提到「问卷」「调查」「收集」「表单」「投票」「评选」「报名」「登记」「考试」「测评」「趣味测试」「心理测试」「打分测试」「满意度」「在线收款」「360评估」「问卷网」「[wenjuan.com](https://www.wenjuan.com)」等关键词

- 用户说「帮我做个调查」「创建一个投票」「**做个表单/报名表**」「新建问卷」「新建测评问卷」「做个趣味测试」等

- **新建问卷统一流程**：凡「新建/创建」类需求，优先执行 **`workflow_create_and_publish.js`**（登录 → 创建并导入 → 发布 → 轮询审核）。**注意**：把题目写成 `examples/*.json` 只是本地稿；**必须再运行该脚本（或 `import_project.js`）** 才会在问卷网导入并发布；趣味测试/活动推广类 **勿在「写完 JSON」处停止**。**Agent**：写完或改完已登记的活动 JSON 后，应在同一会话内执行 **`npm run publish:valentines` / `publish:labor` / `publish:april-fools` / `publish:april-fools-fun` / `publish:singles-day`**（Skill 根目录，见 `package.json`）或等价 `node scripts/publish_preset.js …`，并汇报终端结果；勿把长 `node … --file …` 仅作为「用户请自跑」的说明。题目来源四选一：**(A) 主题/场景默认模板**（`--title` + `--type`，可选 `--scene`）**(B) 本地题目 JSON**（`-f` / `--text-file`，`.json` 或内容为 JSON 的 `.txt`）**(C) 链接**（`-u` / `--url`，http(s) 可访问的题目 JSON）**(D) 标准输入**（`--stdin`，管道/重定向 JSON）。**设计稿**可为 **txt / docx / xlsx / pdf**：除「已是 JSON 的 txt」外，均须先转为题目 JSON 再 `--file`（见 `references/create_survey.md`「稿件支持的文档格式」）。并按类型传参：
  - **调研**：`--type survey`（可省略，默认多为 survey）
  - **测评/打分/趣味测试结果**：`--type assess`
  - **投票/评选**：`--type vote`
  - **表单/报名/信息登记**：`--type form`
  **不要**把投票、表单、测评误作成 `survey`，否则题型与后台能力不匹配。

### 模糊场景


| 用户表述        | 处理方式                                                    |
| ----------- | ------------------------------------------------------- |
| 「帮我做个投票」/「评选」/「票选」 | **`workflow_create_and_publish.js`** + **`--type vote`** + `--title`（或 `--file` / `--url` / `--stdin` 等 JSON）；见 `references/create_survey.md` |
| 「做个表单」/「报名表」/「信息登记」/「收集联系人」 | **`workflow_create_and_publish.js`** + **`--type form`** + `--title`（或 JSON 导入）；见 `references/create_survey.md` |
| 「做个考试」/「做个调研」   | **`workflow_create_and_publish.js`** + **`--type survey`**（或默认 survey）+ `--title` / JSON 导入 |
| 「做个测评」/「新建测评问卷」/「趣味测试带结果」 | **`workflow_create_and_publish.js`** + **`--type assess`** + 题目 JSON（选项含 `score`）或默认测评模板；见 `references/create_survey.md` |
| 「按这个链接里的题目建问卷」/「从 URL 导入」 | **`workflow_create_and_publish.js`** + **`--url`** + 按需 **`--type`** / **`--title`**（链接体为题目 JSON） |
| 「把下面文本/JSON 建成问卷」 | 将提纲整理为题目 JSON 后 **`--file`** / **`--text-file`** / **`--stdin`** + 正确 **`--type`** |
| 「按 Word / Excel / PDF / 文档里的题目建问卷」 | **txt**：提纲或 JSON → 整理为题目 JSON；**docx / xlsx / pdf**：按 `references/create_survey.md`「稿件支持的文档格式」抽取或读表 → 题目 JSON → **`workflow_create_and_publish.js`** + **`--file`** + 正确 **`--type`**；docx 示例见 `examples/college_pocket_money_from_docx.json` |
| 「收集一下大家的意见」 | 直接使用本 skill                                             |
| 「查看我的问卷」    | 调用 list_projects 获取列表                                   |
| 「编辑问卷的第X题」  | 先 list_projects 选择，再 fetch_project 获取结构，再用 **edit_question.js**（`references/update_question.md`）编辑题目 |
| 「修改问卷标题」     | 使用 update_project 修改标题                     |
| 「查看问卷结构」     | 使用 fetch_project 获取详细结构                   |
| 「需要绑定手机号」   | 使用 bind_mobile 完成手机号绑定                   |
| 「看看问卷的回答」   | **查看报表**＝打开 `https://www.wenjuan.com/report/topic/{project_id}`，使用 get_report（`open_report.js`，默认自动用浏览器打开；不要弹窗时加 `--no-open`） |
| 「下载问卷数据」    | 调用 export_data 导出数据                                     |
| 「回收多少份」「数据概况」「完成率多少」 | 调用 **overview_stats**（`overview_stats.js`），或再看报表页 `open_report.js` |
| 「退出登录」「清空授权」「删掉 token」 | **手动删除**本机凭证文件（见 `references/auth.md`「清除本机登录态（手动）」） |


## 功能列表与参考文档


| 功能名称            | 功能说明                 | 参考文档                            |
| --------------- | -------------------- | ------------------------------- |
| create_survey   | 创建并发布：**一律** `workflow_create_and_publish.js`；题目来源：默认模板 / `--file` / `--text-file` / `--url` / `--stdin`（题目 JSON）；**稿：txt / docx / xlsx / pdf** 先转 JSON；**调研** `--type survey`、**测评** `--type assess`、**投票** `--type vote`、**表单** `--type form`（投票/表单/测评均勿默认成 survey） | `references/create_survey.md`   |
| list_projects   | 获取我的问卷列表             | `references/list_projects.md`   |
| fetch_project   | 获取项目详细结构（题目、页面等）     | `references/fetch_project.md`   |
| update_project  | 更新项目信息（标题、欢迎语、结束语）  | `references/update_project.md`  |
| create_question | 在问卷中新增题目             | `references/create_question.md` |
| update_question | 更新问卷中的某道题目（`edit_question.js`） | `references/update_question.md` |
| delete_question | 删除问卷中的题目             | `references/delete_question.md` |
| publish_survey  | 发布/停止问卷收集            | `references/publish_survey.md`  |
| get_report      | 查看报表：默认浏览器打开 `/report/topic/{project_id}`（`open_report.js`；列表多条时须交互选；`--no-open` 仅打印） | `references/get_report.md`      |
| export_data     | 下载原始答题数据             | `references/export_data.md`     |
| overview_stats  | 数据概况：答卷数、今日答卷、浏览量、完成率等（Stats v2 GET；**查询签名与 `generate_sign.js` / `export_data` 一致**） | `references/overview_stats.md`  |
| bind_mobile     | 绑定手机号（发布前需要）        | `references/bind_mobile.md`     |
| check_version   | 检查 Skill 版本更新          | `references/version_check.md`   |
| check_env       | 仅检查 Node.js 与 npm 依赖（**不检查**登录/授权） | `references/check_env.md`       |


## 核心工作流

### 工作流 1：新建问卷

使用 `workflow_create_and_publish.js`（或等价步骤）时：

```
1. 检查/获取登录凭证
2. 创建项目并导入题目（textproject / 默认模板，或 `--file` / `--text-file` / `--url` / `--stdin` 的题目 JSON；**稿为 txt/docx/xlsx/pdf 时**先转为 JSON，见 `references/create_survey.md`「稿件支持的文档格式」）
   • 调研：--type survey（常见默认）
   • 测评/打分测验：--type assess（题目须含 score 等测评结构）
   • 投票/评选：--type vote
   • 表单/报名登记：--type form
3. 发布项目（update_project_status）
4. 如遇 NOT_BIND_MOBILE，先 bind_mobile 再重试发布
5. 发布成功后自动轮询审核与项目状态，直至稳定或超时（不可关闭）
```

一键命令示例见 `references/create_survey.md`。**调研 / 测评 / 投票 / 表单**共用本脚本，**仅 `--type`（及题目 JSON）不同**。

### 工作流 2：编辑问卷

```
1. 执行鉴权检查
2. 调用 list_projects 展示列表，用户选择项目
3. 调用 fetch_project 获取问卷完整结构
4. 如需修改项目信息（标题/欢迎语/结束语）→ 调用 update_project
5. 如需编辑题目 → 调用 **edit_question.js**（文档见 update_question）
6. 如需新增题目 → 调用 create_question.js
7. 如需删除题目 → 调用 delete_question.js
```

**⚠️ 重要**：编辑问卷结构或项目信息前，工作流会先 **停止收集**（若当前为收集中），再调用 **项目归档**（`POST /report/ajax/project_archive/`：Query 含 `pid` 与 ai_skills 签名，见 `references/project_archive.md`），**归档成功后**才执行改题/改项。也可手动先 `publish_survey(action=stop)`；编辑完成后不会自动重新发布，如需恢复收集请手动 `publish_survey(action=publish)`。

### 工作流 3：查看数据（数据概况 / 报表页 / 原始导出）

```
1. 执行鉴权检查
2. 调用 list_projects 选择项目（或已知 project_id）
3. 若只需即时数字概况（答卷数、今日答卷、浏览量、完成率等）→ 调用 overview_stats（`overview_stats.js`；接口 URL 已带与 **generate_sign（ai_skills）** 一致的 `appkey`/`web_site`/签名）
4. 若需报表可视化页面 → 调用 get_report（`open_report.js`）打开 `/report/topic/{project_id}`（`--no-open` 仅打印链接）
5. 如需原始数据 → 调用 export_data
```

## 环境准备

本 Skill 需要 **Node.js 18+** 环境。

### 快速安装（推荐）

```bash
./setup.sh -y    # 自动安装 Node.js 和依赖
```

一键完成：检测 Node.js → 自动安装（如需要）→ 打印当前 npm registry（不修改源）→ 安装依赖 → 验证环境。**`setup.sh` 成功结束时的输出只说明 Node/依赖已就绪，不会引导「接下来去登录」；需要调用问卷网接口时再按 `references/auth.md` 完成登录。**

**支持系统：** macOS, Ubuntu/Debian, CentOS/RHEL/Fedora, Arch Linux, openSUSE, Alpine, Windows

**Workerbuddy / 无图形界面登录问卷网：** 执行 **`node scripts/login_auto.js`**，脚本会**始终尝试自动打开浏览器**；若在 Agent 环境无可见窗口，请使用获取二维码后已写入的 **`last_wenjuan_login_url.txt`** 内整行链接，在**本机浏览器**扫码。扫码后**不要关运行脚本的终端**，直至出现登录成功。详见 `references/auth.md`。

### 其他选项

```bash
./setup.sh       # 交互式安装
./setup.sh -c    # 仅检查环境
./setup.sh -v    # 验证安装
./setup.sh -h    # 显示帮助
```

### 详细说明

- 环境要求、手动安装步骤、常见问题 → 详见 [`references/check_env.md`](references/check_env.md)
- 二次验证环境 → 使用 `check_env` 工具

## 版本更新检查

**建议触发时机：每天第一次打开时自动检查**

检查当前 Skill 版本是否需要更新：

```bash
node scripts/check_version.js
```

### 快速使用

| 命令 | 说明 |
|------|------|
| `node scripts/check_version.js` | 检查版本，显示完整信息；**默认退出码 0**（含「有新版本」提示），Workerbuddy 不应判为失败 |
| `node scripts/check_version.js --auto` | 自动模式，有更新时才输出 |
| `node scripts/check_version.js --json` | 输出原始 JSON 格式 |
| `node scripts/check_version.js --fail-on-update` | 有新版本时退出码 1（仅 CI 需要严格失败时使用） |

### 发现新版本处理

当检测到新版本时，**提示用户安装最新版本**：

```javascript
const { checkVersion, shouldUpdate } = require('./scripts/check_version');

const result = await checkVersion();

if (shouldUpdate(result)) {
    const data = result.data;
    console.log(`📦 发现新版本: ${data.latest}`);
    console.log(`当前版本: ${data.current_version}`);
    console.log(`\n更新内容:\n${data.release_note}`);
    // 服务端下发的更新说明（优先遵循）
    if (data.instruction) {
        console.log(`\n更新指引:\n${data.instruction}`);
    }
}
```

**提示方式**：
- 在对话开始时显示更新提示
- 告知用户当前版本和最新版本号
- **优先展示接口返回的 `instruction`**；不要默认用户已安装 Git 或目录名为某一固定文件夹

**更新途径（按实际分发方式选一种，互不假设）**：
- **Cursor / 技能市场 / 插件**：在对应入口重新安装或拉取新版 Skill，通常**不需要**也**不能保证**本机有 `git`。
- **ZIP 包**（如 `pack_skill.sh` 生成的 `wenjuan-survey-skill-*.zip`）：下载新版压缩包并解压覆盖或替换原目录。
- **Git 克隆**：仅在用户确认本机有 Git 且当前目录是克隆下来的仓库时，才建议在 **Skill 根目录**（例如本仓库名为 `wenjuan-survey`，以你本机路径为准）执行 `git pull`。

详细说明 → 详见 [`references/version_check.md`](references/version_check.md)

## 数据模型

```
问卷（Project）
├── 基本信息：project_id, title, ptype_enname, scene_type, status
├── 设置：begin_desc(欢迎语), end_desc(结束语), appearance_themenum
├── 页面列表（Pages[]）
│   └── 题目列表（Questions[]）
│       ├── 基本属性：question_id, question_type, title, is_required
│       ├── 选项列表（Options[]）：option_id, title, is_open
│       └── 矩阵行（MatrixRows[]）：title
└── 查看报表 ← `https://www.wenjuan.com/report/topic/{project_id}`（`get_report` / `open_report.js`）；**数据概况** ← `overview_stats.js`（`/report/api/v2/overview/stats/{pid}/`，**签名同** `generate_sign.js`）；原始答卷 ← `export_data`
```

## 签名认证说明

**编辑类**（`app_api/edit/...`）、**报表下载**（`/report/api/download*`）与 **数据概况**（`/report/api/v2/overview/stats/...`）的 URL 查询签名，均使用 `scripts/generate_sign.js` 中的同一 **`CONFIG`**（`web_site=ai_skills`、`appkey`、`secret`，MD5 `signature`）。

### 用法示例（`buildSignedUrl`）

```javascript
const { buildSignedUrl } = require('./scripts/generate_sign');

const baseUrl = "https://www.wenjuan.com/app_api/edit/xxx/";
const params = { project_id: "xxx" };
const fullUrl = buildSignedUrl(baseUrl, params);
// 自动添加：appkey, web_site, timestamp, signature
```

**查询参数名**：

- `appkey`：应用标识（与旧版报表 `app_key` 已统一为 ai_skills 的 `appkey`）
- `web_site`：固定为 `ai_skills`
- `timestamp`：秒级时间戳
- `signature`：参与签名的参数按名字母序拼接**各参数值**后加 `secret` 再 MD5（小写 hex），逻辑见 `generate_sign.js`

**报表脚本**：`export_data.js` 的 **`buildUrlWithAuth`** 内部调用 **`buildSignedUrl`**；`overview_stats.js` 复用 **`buildUrlWithAuth`**。详见 [`references/overview_stats.md`](references/overview_stats.md)。

## 常见错误码

### 认证相关

**⚠️ 遇到以下错误码时，需要重新执行扫码登录：**


| 错误码                    | 错误信息                     | 说明           | 解决方案            |
| ---------------------- | ------------------------ | ------------ | --------------- |
| 20004                  | USER_NOT_EXIST           | 用户不存在        | 重新扫码登录          |
| 20055                  | JWT_EXPIRED              | jwt_token 过期 | **重新扫码登录**      |
| 20056                  | CAN_NOT_GET_MID_FROM_JWT | jwt 获取不到 mid | **重新扫码登录**      |
| 20057                  | JWT_DECODE_ERROR         | jwt 解析失败     | **重新扫码登录**      |
| 20058                  | GET_JWT_ERROR            | 获取JWT错误      | **重新扫码登录**或稍后重试 |
| `401` / `Unauthorized` | -                        | Token 失效或过期  | **重新扫码登录**      |


### 项目相关


| 错误码/错误信息                                      | 说明        | 解决方案                                 |
| --------------------------------------------- | --------- | ------------------------------------ |
| `NOT_BIND_MOBILE`                             | 未绑定手机号    | 运行 `bind_mobile.js` 完成绑定后再发布           |
| `PROJECT_PUBLISHED` / `PROJECT_EDIT_DISABLED` | 项目收集中无法编辑 | 先调用 publish_survey(action=stop) 停止收集 |
| `PROJECT_NOT_FOUND`                           | 项目不存在     | 检查 project_id 是否正确                   |


### 题目相关


| 错误码/错误信息             | 说明    | 解决方案                |
| -------------------- | ----- | ------------------- |
| `QUESTION_NOT_FOUND` | 题目不存在 | 检查 question_id 是否正确 |
| `INVALID_PARAM`      | 参数错误  | 检查请求参数格式和内容         |


### 其他


| 错误码/错误信息          | 说明     | 解决方案          |
| ----------------- | ------ | ------------- |
| `SIGNATURE_ERROR` | 签名错误   | 检查签名计算逻辑或密钥配置 |
| `RATE_LIMIT`      | 请求过于频繁 | 稍后重试          |


## 注意事项

1. **编辑前停止收集 + 项目归档**：脚本通过 `ensureReadyForEdit` 自动处理——收集中则先 stop，再调归档接口直至成功；归档未完成则不会继续编辑（详见 `references/project_archive.md`）。**禁止绕过**：修改项目信息、题目或选项时，**不得**通过覆盖 `QuestionEditor` 方法、直接 `require` 后只调 `updateProject`/`updateQuestion`/`createQuestionApi` 的旧路径、或手写 `edit_project`/`edit_question` 请求等方式跳过上述步骤；须使用 **`update_project.js`、`edit_question.js`、`create_question.js`、`delete_question.js` 的官方 CLI 或模块导出函数**（其内部已统一停收 + 归档）。若归档报权限错误，应在问卷网侧解决权限，而不是在会话内跳过守卫。
2. **Token 有效期**：access_token 有过期时间，失效后需重新登录
3. **发布需绑定手机号**：首次发布项目时可能需要先绑定手机号
4. **签名时效**：签名使用当前时间戳，有效期较短，每次请求需重新生成
5. **运行环境**：功能脚本均为 **Node.js（.js）**；JWT 的目录与读取顺序由 `scripts/token_store.js` 统一实现（工程内 `.wenjuan/auth.json` 优先，其次用户级目录下的 `token.json` / `access_token`；用户级目录默认为 `~/.wenjuan`，可用环境变量 `WENJUAN_TOKEN_DIR` 或各脚本 `--token-dir` 覆盖）。详见 `references/auth.md`。
6. **默认路径（约定）**：扫码登录后主凭证 **`~/.wenjuan/token.json`**；原始数据导出默认目录 **`~/.wenjuan/download/`**（均可被 `WENJUAN_TOKEN_DIR` / `--token-dir`、`-o` 覆盖，见 `references/auth.md`）。

## 目录结构

```
wenjuan-survey/
├── SKILL.md                    # 本文档
├── setup.sh                    # 环境检测与安装脚本
├── package.json                # Node.js 依赖包列表
├── package-lock.json           # npm 锁定文件
├── node_modules/               # 依赖包目录
├── scripts/                    # 所有功能脚本
│   ├── workflow_create_and_publish.js
│   ├── publish_preset.js       # 节日测评一键发布（npm run publish:*）
│   ├── list_projects.js
│   ├── fetch_project.js        # 获取项目详细结构
│   ├── update_project.js       # 更新项目信息
│   ├── publish.js
│   ├── project_edit_guard.js   # 编辑前：stop（若收集中）+ 项目归档成功
│   ├── project_archive.js      # 项目归档 API 封装（可被 guard / CLI 调用）
│   ├── bind_mobile.js          # 绑定手机号
│   ├── create_question.js
│   ├── edit_question.js
│   ├── delete_question.js
│   ├── export_data.js
│   ├── overview_stats.js       # 数据概况（Stats v2）
│   ├── open_report.js          # get_report：查看报表，默认打开浏览器
│   ├── generate_sign.js
│   ├── token_store.js          # JWT 路径与读取顺序（单一来源）
│   ├── login_auto.js
│   ├── check_version.js        # 版本检查
│   ├── pack_skill.sh           # 打分发包（zip，排除 node_modules / examples / downloads / .wenjuan）
│   └── check_env.js            # 环境验证（需先装Node.js）
├── references/                 # 各功能详细文档
│   ├── auth.md
│   ├── create_survey.md
│   ├── list_projects.md
│   ├── fetch_project.md        # 获取项目结构文档
│   ├── update_project.md       # 更新项目信息文档
│   ├── bind_mobile.md          # 绑定手机号文档
│   ├── create_question.md
│   ├── update_question.md
│   ├── delete_question.md
│   ├── project_archive.md      # 项目归档接口与编辑工作流
│   ├── publish_survey.md
│   ├── get_report.md           # 查看报表定义与用法
│   ├── export_data.md
│   ├── overview_stats.md       # 数据概况 API 与用法
│   ├── version_check.md
│   ├── check_env.md
│   ├── skill_overview.md       # 触发/工作流/错误码等总览（与本文档互补）
│   └── url_signing.md          # URL 查询签名说明
└── examples/                   # 示例文件
    ├── sample_questions.json   # 题目列表示例
    ├── sample_project.json     # 完整项目数据示例
    ├── university_student_survey.json
    └── i_love_shanghai_survey.json
```
