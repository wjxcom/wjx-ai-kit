# wjx-cli-expert

问卷星 CLI 专家子 Agent —— 通过 `wjx` 命令行工具完成问卷创建、数据回收、分析等全部操作。

## 设计理念

本 Agent 遵循**渐进式披露**原则：

1. **Agent 定义（`wjx-cli-expert.md`）** — 职责、工作原则和安全规范
2. **Skill（`skills/wjx-cli-use/SKILL.md`）** — 命令总览、核心工作流和 Agent 行为规则
3. **References（`skills/wjx-cli-use/references/`）** — 详细参数，按需加载

Agent 不重复 Skill 中的命令参数内容，而是在需要时读取对应的 reference 文件。

## 与 wjx-mcp-expert 的区别

| | wjx-mcp-expert | wjx-cli-expert |
|---|---|---|
| **交互方式** | MCP 工具调用 | `wjx` 命令行执行 |
| **适用场景** | 支持 MCP 的 AI 客户端 | 任意终端 / CI / 通用 Agent |
| **依赖** | wjx-mcp-server 运行中 | `wjx-cli >= 0.4.1` |

## 前置条件

### 一键安装（推荐）

当前源码版本为 `0.4.4`。发布到 npm 后可直接安装 CLI：

> 通过 AI 安装并启用 wjx-cli：先执行 `npm install -g wjx-cli@latest`，成功后再执行 `wjx skill install --force`；安装后命令名是 `wjx`，请用 `wjx --version` 验证，不要运行 `wjx-cli --version`。

```bash
npm install -g wjx-cli@latest
wjx skill install --force
wjx init
wjx doctor
```

需要 AI 自动完成安装时，可直接发送下面的完整任务提示；AI 应按顺序执行，在拿到 API Key 前暂停等待，并执行最后的列表验收：

```text
请帮我安装并配置问卷星 CLI（wjx-cli）：

0. 预检当前操作系统和 shell。检查 `node --version`、`npm --version`，并在命令可用时先检查 `wjx --version`。Windows 还要用 `Get-Command node,npm,wjx -ErrorAction SilentlyContinue`、`where.exe node`、`where.exe npm`、`where.exe wjx`，并检查 `C:\Program Files\nodejs\node.exe` 和 `%LOCALAPPDATA%\Programs\nodejs\node.exe`。同时记录 `npm prefix -g`，确认 npm 全局 bin 在当前 PATH。一个 shell 报“找不到命令”不能证明软件未安装。

1. 若绝对路径能找到 Node.js，直接用该路径验证版本；若只是当前 shell 的 PATH 未刷新，刷新 PATH 或启动新的 shell 后重新检查。只有确认 Node.js 不存在时才引导我从 https://nodejs.org 安装 LTS；版本低于 20 时停止并引导升级。不要在证据不足时运行 winget、安装器或后台安装进程。安装/升级后必须在新进程再次验证 `node --version` 和 `npm --version`。

2. Node.js >= 20 且 npm 可用后，先检查 `wjx --version`。若 wjx 已存在且版本 >= 0.4.1，跳过重复安装；若 wjx 缺失、版本过低或执行失败，才执行 `npm install -g wjx-cli@latest`。npm 包名是 `wjx-cli`，安装后的命令名是 `wjx`；npm 退出码为 0 不等于安装完成，必须刷新 PATH（如有需要）并再次运行 `wjx --version`。每个命令都要读取自身的真实退出码，不要用 `head`/`tail` 管道的退出码代替。禁止运行 `wjx-cli --version`。确认 CLI 可执行后，再执行 `wjx skill install --force`，并确认技能文件已落盘。

3. 引导我获取问卷星 API Key：
   - 公网用户：让我访问 https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1，微信扫码登录后复制 Key
   - 私有化部署用户：把上面的 www.wjx.cn 换成我的域名（例如 xxx.sojump.cn），登录链接和后续 `--base-url` 必须使用同一个域名
   等我把 Key 发给你（可能还会附带域名）。未收到 Key 前暂停，不要猜测、伪造或从其他文件读取凭据。

4. 拿到 Key 后执行 `wjx init --api-key <我的Key>`；私有化部署用户加 `--base-url https://<我的域名>`。不要在回复、日志或文件中回显完整 API Key，只允许显示脱敏状态。

5. 运行 `wjx doctor` 验证连接；逐项确认 API Key 已配置、Base URL 正确、网络/API 检查通过。任一步失败都不得口述“安装成功”，先报告实际失败阶段和下一步。

6. 最后运行 `wjx survey list --format table` 做一次人工验收，看到真实列表才说明接好了；这一步只用于人类查看，不要用表格推断总数、分页或填写链接。
```

从源码开发时才执行下面的构建命令：

```bash
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-cli
npm link ./wjx-cli
```

构建完成后，使用 `wjx init` 配置 API Key，再运行 `wjx skill install` 自动部署 Agent 和 Skill。

`skill install` 会自动完成：
- 创建 `.claude/agents/wjx-cli-expert.md`（Agent 定义）
- 复制 `skills/wjx-cli-use/`（通用 Skill 目录）
- 同步 `.claude/skills/wjx-cli-use/`（Claude Code 自动发现的 Skill 镜像）

### 手动安装

如果无法使用 npm，可下载 [wjx-cli-use-skill-latest.zip](https://pubdz.paperol.cn/wjx-ai-kit/skills/wjx-cli-use-skill-latest.zip)，解压后将 `wjx-cli-use` 目录放到项目根目录的 `skills/` 下，并将 `wjx-cli-expert.md` 复制到 `.claude/agents/`；使用 Claude Code 时还应将同一目录同步到 `.claude/skills/wjx-cli-use/`。

> **注意：** Agent 通过相对路径 `skills/wjx-cli-use/` 引用 Skill 文件，因此 `skills/` 目录必须位于项目根目录下。

## 使用方式

### 方式一：Claude Code 中委派

```
请使用 wjx-cli-expert Agent 帮我创建一份客户满意度调查问卷
```

### 方式二：命令行直接指定

```bash
claude --agent wjx-cli-expert "创建一份英语考试问卷，包含单选、多选、判断和填空题"
```

### 方式三：团队协作

```
创建一个团队，让 wjx-cli-expert agent 负责问卷操作，我来审核内容。
```

## 典型场景

**创建考试问卷：**
子 Agent 读取 `references/question-types.md` 学习 JSONL 的中文 `qtype` 和字段 → `wjx survey create --file survey.jsonl --dry-run` 预览 → 创建 → 返回编辑链接

**分析问卷数据：**
`response report` 概览 → `response query` 明细 → `analytics nps/csat` 计算 → `analytics anomalies` 检测异常

**批量导入通讯录：**
读取数据文件 → 查阅 `references/contacts-commands.md` 确认参数 → `contacts add` 导入 → `contacts query` 验证

## 文件说明

```
wjx-cli-expert/
├── README.md              ← 本文件
└── wjx-cli-expert.md      ← Agent 定义（复制到 .claude/agents/ 使用）
```
