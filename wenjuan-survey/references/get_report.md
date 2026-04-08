# get_report — 查看报表

**定义（本 Skill）**：**查看报表**仅指在浏览器中访问问卷网项目统计页，其路径为 **`/report/topic/{project_id}`**，完整 URL 为：

`https://www.wenjuan.com/report/topic/{project_id}`

（需在问卷网保持登录。）

对应脚本：**`scripts/open_report.js`**（实现 get_report）。脚本会解析 `project_id`（可选从「我的问卷」列表选择）、在终端打印上述链接，并**默认用系统默认浏览器自动打开**该地址；若只需链接、不弹浏览器，请加 **`--no-open`**。

### 实现约定（与 `open_report.js` 一致）

| 项 | 说明 |
|----|------|
| 报表页基址 | 脚本内为 `https://www.wenjuan.com/report/topic/`（拼接 `project_id` 即完整 URL） |
| 默认行为 | **`openBrowser === true`**：成功解析项目后即调用 `open` 包，失败则按系统执行 `open` / `xdg-open` / `cmd start` |
| 关闭自动打开 | 传入 **`--no-open`** |
| 导出/复用 | `module.exports`：`reportTopicUrl`、`getToken`、`openInBrowser`（无 HTTP 报表接口） |
| 仅要数字概况 | 使用 **`overview_stats.js`**（[`overview_stats.md`](overview_stats.md)），不打开浏览器 |
| 列表择项 | 当前页**仅 1 条**：直接使用。**多条** 且标准输入为 **TTY**：**必须**在终端选序号，**不**使用 `--index` / `WENJUAN_PROJECT_INDEX` 默认第几条（若误传会提示已忽略）。**多条** 且 **非 TTY**（如 CI）：必须提供 **`--index` 或 `WENJUAN_PROJECT_INDEX`**。 |

终端会先打印两行：`查看报表 (/report/topic/{id}):` 与缩进的完整 URL，再尝试打开浏览器（除非 `--no-open`）。

## 报表页地址

| 项 | 说明 |
|----|------|
| **路径** | `/report/topic/{project_id}` |
| **完整 URL** | `https://www.wenjuan.com/report/topic/{project_id}` |
| **用途** | 在问卷网产品内查看该项目的回收与统计视图（以官网为准） |

脚本执行顺序：

1. 读取 Token（见下）  
2. 若未传 `-p`：调用与 **`list_projects.js` 相同的数据源**（`getProjects`），拉取第 **1** 页列表并筛选关键词（若有 `-k`）；按上表规则解析 **唯一** `project_id`（单条直接定、多条交互或 `--index`）  
3. 解析得到 `project_id` 后，**始终**在终端打印 `report/topic/{project_id}` 的完整 URL  
4. **默认**：用**跨平台**方式打开默认浏览器（见下「打开浏览器」）；若带了 **`--no-open`** 则跳过本步  
5. 打开失败时终端会提示手动复制链接  

## 打开浏览器（默认开启）

不同操作系统由脚本分层处理，与登录脚本的策略一致：

1. **优先**：使用 npm 依赖 **`open`**（已随 `package.json` 安装），内部处理 macOS、Windows、Linux 以及 **WSL** 等常见环境差异。  
2. **回退**：若 `open` 抛错，再按 `process.platform` 调用：
   - **darwin**：`open <url>`
   - **win32**：`cmd /c start "" <url>`（`windowsHide` 降低闪窗）
   - **其它**（多为 Linux）：`xdg-open <url>`

若仍失败，终端会打印报表 URL，请手动粘贴到浏览器。

## Token

由 `scripts/token_store.js` 统一解析，顺序与 `references/auth.md` 一致：

1. Skill 根目录 `.wenjuan/auth.json` 中的 `access_token`（及兼容字段）  
2. 用户级凭证目录（默认 `~/.wenjuan`，可由 `WENJUAN_TOKEN_DIR` 覆盖）下的 `token.json`，再尝试同目录的 `access_token` 纯文本  

未找到 Token 时，`open_report.js` 退出并提示运行 `login_auto.js`。（列表与选择项目依赖 Token。）

## CLI 参数

| 参数 | 说明 |
|------|------|
| `-p, --project-id <id>` | 项目 ID。**省略时**按「实现约定」从本页列表择项。 |
| `-k, --keyword <word>` | 列表**标题模糊筛选**，与 `list_projects` 行为一致。 |
| `-n, --page-size <n>` | 拉取列表时每页条数，**默认 20**。当前实现**只拉取第 1 页**；若目标问卷不在首页，请用 `-k` 搜标题或改用 `-p`。 |
| `--index <n>` | 未指定 `-p`、本页**多条**且 stdin **非 TTY** 时必填（或改用环境变量）；**从 1 开始**。交互终端下多条时**无效**（须从清单中选）。 |
| `--open` | 显式要求打开浏览器（与默认行为相同，可省略）。 |
| `--no-open` | 只打印链接，**不**打开浏览器。 |
| `-h, --help` | 显示内置帮助。 |

### 非交互环境

标准输入**不是 TTY** 且**未**指定 `-p` 时：

- 若当前页筛选结果**仅 1 条**：可直接使用该 `project_id`。  
- 若**多条**：必须提供 **`--index <n>`** 或 **`WENJUAN_PROJECT_INDEX`**（1-based），否则会报错退出。

## CLI 示例

```bash
SKILL_DIR="wenjuan-survey"

# 指定项目：打印链接并默认打开浏览器
node "${SKILL_DIR}/scripts/open_report.js" -p "<project_id>"

# 只要链接、不打开浏览器（如 CI）
node "${SKILL_DIR}/scripts/open_report.js" -p "<project_id>" --no-open

# 交互：从「我的问卷」选一条后自动打开报表页
node "${SKILL_DIR}/scripts/open_report.js"

# 关键词筛选；多条时在终端输入序号（交互）；单条则直接进入报表
node "${SKILL_DIR}/scripts/open_report.js" -k "大学生"

# CI / 无图形界面：环境变量选列表第 2 项，且 --no-open 避免弹出浏览器
export WENJUAN_PROJECT_INDEX=2
node "${SKILL_DIR}/scripts/open_report.js" -k "调研" --no-open
```

## 与 export_data 的区别

- **get_report（`open_report.js`）**：**查看报表**，即在浏览器中打开 **`/report/topic/{project_id}`**（默认自动打开；`--no-open` 仅输出链接）。详见上文「实现约定」。  
- **export_data**：通过报表 **`/report/api/download`** 异步任务下载**原始答卷 xlsx**（文本、一题一列），不是仅打开报表页，适合备份或自建统计。说明见 [`export_data.md`](export_data.md)。

## 依赖

- `open`（默认用其跨平台打开浏览器）、`list_projects.js`（`getProjects`）  
- 需已登录问卷网并保持 Token 有效  
