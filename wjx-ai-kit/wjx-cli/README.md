# wjx-cli

> 问卷星 (Wenjuanxing) CLI — AI Agent 原生命令行工具

[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-green)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/wjx-cli)](https://www.npmjs.com/package/wjx-cli)
[![tests](https://img.shields.io/badge/tests-82%20passing-brightgreen)](__tests__/cli.test.mjs)

wjx-cli 是 [`wjx-ai-kit`](../) monorepo 的命令行入口，将 [wjx-api-sdk](../wjx-api-sdk/) 的 50+ 函数直接暴露为终端命令。设计目标：**让 AI Agent 和人类开发者都能用一行命令操作问卷星 OpenAPI**。

---

## 目录

- [特性](#特性)
- [**快速开始**](#快速开始)
- [安装](#安装)
- [认证](#认证)
- [架构](#架构)
- [全局选项](#全局选项)
- [命令参考](#命令参考)
  - [survey — 问卷管理](#survey--问卷管理)
  - [response — 答卷管理](#response--答卷管理)
  - [contacts — 通讯录](#contacts--通讯录)
  - [department — 部门管理](#department--部门管理)
  - [admin — 管理员](#admin--管理员)
  - [tag — 标签管理](#tag--标签管理)
  - [user-system — 用户体系](#user-system--用户体系)
  - [account — 子账号管理](#account--子账号管理)
  - [sso — 单点登录](#sso--单点登录)
  - [analytics — 数据分析](#analytics--数据分析)
  - [配置与诊断](#配置与诊断)
- [stdin 管道输入](#stdin-管道输入)
- [输出格式](#输出格式)
- [错误协议](#错误协议)
- [Agent 集成指南](#agent-集成指南)
- [环境变量](#环境变量)
- [开发](#开发)
- [常见问题](#常见问题)
- [相关项目](#相关项目)
- [许可证](#许可证)

---

## 特性

- **AI Agent 原生** — 默认 JSON stdout + 结构化 JSON stderr，退出码区分错误类型，适合程序解析
- **stdin pipe** — `echo '{"vid":123}' | wjx --stdin survey get`，参数通过管道传入
- **表格输出** — `--table` 切换为人类可读的 `console.table` 格式
- **56 个子命令** — 覆盖问卷、答卷、通讯录、部门、管理员、标签、用户体系、子账号、SSO、数据分析
- **9 个本地命令** — SSO URL 生成和 analytics 计算无需 API Key，离线可用
- **基于 wjx-api-sdk** — 直接调用 SDK 函数，类型安全，行为与 API 一致

---

## 快速开始

```bash
npm install -g wjx-cli
wjx init                  # 交互式配置 API Key、Base URL、Corp ID
wjx doctor                # 环境诊断
wjx survey list           # 查看问卷列表
```

> **新手？** 阅读 [快速开始教程](docs/getting-started.md)，含 [Node.js 安装指引](docs/install-nodejs.md)。

---

## 前置条件

- **Node.js >= 20**（[安装指引](docs/install-nodejs.md)）
- **问卷星 OpenAPI API Key**（[申请方式](https://www.wjx.cn/openapi/)）

---

## 安装

```bash
npm install -g wjx-cli
```

### 从源码安装（开发者）

```bash
git clone <your-repo-url>
cd wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-cli
npm link --workspace=wjx-cli
```

---

## 认证

大多数命令需要问卷星 API Key（SSO 和 analytics 命令除外）。

凭据解析优先级：`--api-key` 参数 > 环境变量 > `~/.wjxrc` 配置文件。

```bash
# 方式 1：交互式配置（推荐，首次使用）
wjx init

# 方式 2：环境变量
export WJX_API_KEY=your_api_key

# 方式 3：命令行参数
wjx --api-key your_api_key survey list

# 方式 4：直接编辑配置文件
cat ~/.wjxrc
# {"apiKey":"your_api_key","baseUrl":"https://www.wjx.cn","corpId":"orgXXX"}
```

---

## 架构

```
wjx-ai-kit/                     # monorepo root
├── wjx-api-sdk/                 # TypeScript SDK（50+ 函数，零依赖）
├── wjx-mcp-server/              # MCP Server（56 tools，供 Claude/Cursor 使用）
└── wjx-cli/                     # ← 本项目
    ├── src/
    │   ├── index.ts             # Commander 入口 + 全局 preAction hook
    │   ├── commands/            # 12 个命令模块（每模块 1 个 register 函数）
    │   │   ├── init.ts          # wjx init 交互式配置向导
    │   │   ├── survey.ts        # 14 subcommands
    │   │   ├── response.ts      # 11 subcommands
    │   │   ├── contacts.ts      # 3 subcommands
    │   │   ├── department.ts    # 4 subcommands
    │   │   ├── admin.ts         # 3 subcommands
    │   │   ├── tag.ts           # 4 subcommands
    │   │   ├── user-system.ts   # 6 subcommands
    │   │   ├── account.ts       # 5 subcommands
    │   │   ├── sso.ts           # 3 subcommands（无需 API Key）
    │   │   ├── analytics.ts     # 6 subcommands（本地计算，无需 API Key）
    │   │   └── diagnostics.ts   # 2 subcommands（whoami + doctor）
    │   └── lib/
    │       ├── config.ts           # ~/.wjxrc 配置文件读写 + applyConfigToEnv
    │       ├── command-helpers.ts  # executeCommand + strictInt + requireField
    │       ├── auth.ts             # API Key 获取（--api-key > env > config）
    │       ├── output.ts           # JSON / table 格式化
    │       ├── errors.ts           # CliError + exit code 路由
    │       └── stdin.ts            # stdin JSON 读取 + source-aware merge
    └── __tests__/
        └── cli.test.mjs         # 82 个端到端测试
```

**数据流：** `CLI args / stdin` → `Commander parse` → `executeCommand()` → `wjx-api-sdk function` → `stdout JSON / stderr error`

---

## 全局选项

| 选项 | 说明 |
|------|------|
| `--api-key <apiKey>` | WJX API Key（或设置 `WJX_API_KEY` 环境变量） |
| `--json` | JSON 输出（默认） |
| `--table` | 表格输出（`console.table` 格式） |
| `--verbose` | 详细输出 |
| `--stdin` | 从 stdin 读取 JSON 参数（见 [stdin 管道输入](#stdin-管道输入)） |
| `--version` | 显示版本号 |
| `--help` | 显示帮助信息 |

---

## 命令参考

### survey — 问卷管理

14 个子命令，覆盖问卷的完整生命周期。

```bash
wjx survey list                          # 列出问卷
wjx survey get --vid 12345               # 获取详情
wjx survey create --title "新问卷"         # 创建问卷
wjx survey status --vid 12345 --state 1  # 发布（1=发布, 2=暂停, 3=删除）
wjx survey export-text --vid 12345       # 导出为纯文本
wjx survey url --mode create             # 生成创建/编辑 URL
```

<details>
<summary>全部选项参考</summary>

| 子命令 | 选项 | 必填 | 类型 | 说明 |
|--------|------|:----:|------|------|
| **list** | `--page` | | int | 页码 |
| | `--page_size` | | int | 每页数量 |
| | `--status` | | int | 状态筛选 |
| | `--atype` | | int | 问卷类型 |
| | `--name_like` | | string | 名称模糊搜索 |
| **get** | `--vid` | **是** | int | 问卷 ID |
| **create** | `--title` | **是** | string | 问卷标题 |
| | `--type` | | int | 问卷类型（默认 0） |
| | `--description` | | string | 问卷描述 |
| | `--questions` | | json | 题目 JSON 数组 |
| | `--source_vid` | | string | 复制源问卷 ID |
| | `--publish` | | flag | 创建后立即发布 |
| **delete** | `--vid` | **是** | int | 问卷 ID |
| | `--username` | **是** | string | 用户名 |
| | `--completely` | | flag | 彻底删除（不进回收站） |
| **status** | `--vid` | **是** | int | 问卷 ID |
| | `--state` | **是** | int | 目标状态（1=发布, 2=暂停, 3=删除） |
| **settings** | `--vid` | **是** | int | 问卷 ID |
| **update-settings** | `--vid` | **是** | int | 问卷 ID |
| | `--api_setting` | | json | API 设置 |
| | `--after_submit_setting` | | json | 提交后设置 |
| | `--msg_setting` | | json | 消息设置 |
| | `--sojumpparm_setting` | | json | 参数设置 |
| | `--time_setting` | | json | 时间设置 |
| **tags** | `--username` | **是** | string | 用户名 |
| **tag-details** | `--tag_id` | **是** | int | 标签 ID |
| **clear-bin** | `--username` | **是** | string | 用户名 |
| | `--vid` | | int | 指定问卷 ID（不填则清空全部） |
| **upload** | `--file_name` | **是** | string | 文件名 |
| | `--file` | **是** | string | 文件 Base64 内容 |
| **export-text** | `--vid` | **是** | int | 问卷 ID |
| | `--raw` | | flag | 输出纯文本（不包裹 JSON） |
| **url** | `--mode` | | string | `create` 或 `edit`（默认 create） |
| | `--name` | | string | 问卷名称（create 模式） |
| | `--activity` | | int | 问卷 vid（edit 模式必填） |

</details>

### response — 答卷管理

11 个子命令，管理答卷数据的查询、提交、下载和统计。

```bash
wjx response count --vid 12345              # 获取答卷总数
wjx response query --vid 12345              # 查询答卷
wjx response realtime --vid 12345           # 实时最新答卷
wjx response download --vid 12345           # 下载答卷
wjx response submit --vid 12345 --inputcosttime 60 --submitdata "1$2"
wjx response report --vid 12345             # 统计报告
```

<details>
<summary>全部选项参考</summary>

| 子命令 | 选项 | 必填 | 类型 | 说明 |
|--------|------|:----:|------|------|
| **count** | `--vid` | **是** | int | 问卷 ID |
| **query** | `--vid` | **是** | int | 问卷 ID |
| | `--page_index` | | int | 页码 |
| | `--page_size` | | int | 每页数量 |
| | `--sort` | | int | 排序 |
| | `--min_index` | | int | 最小序号 |
| | `--jid` | | string | 答卷 ID |
| | `--sojumpparm` | | string | 自定义参数 |
| | `--qid` | | string | 题目 ID |
| | `--begin_time` | | int | 开始时间 |
| | `--end_time` | | int | 结束时间 |
| | `--file_view_expires` | | int | 文件链接有效期 |
| | `--query_note` | | flag | 查询备注 |
| | `--distinct_user` | | flag | 去重用户 |
| | `--distinct_sojumpparm` | | flag | 去重参数 |
| | `--conds` | | string | 查询条件 |
| **realtime** | `--vid` | **是** | int | 问卷 ID |
| | `--count` | | int | 返回数量 |
| **download** | `--vid` | **是** | int | 问卷 ID |
| | `--taskid` | | string | 任务 ID |
| | `--query_count` | | int | 查询数量 |
| | `--begin_time` | | int | 开始时间 |
| | `--end_time` | | int | 结束时间 |
| | `--min_index` | | int | 最小序号 |
| | `--qid` | | string | 题目 ID |
| | `--sort` | | int | 排序 |
| | `--query_type` | | int | 查询类型 |
| | `--suffix` | | int | 文件后缀 |
| | `--query_record` | | flag | 查询记录 |
| **submit** | `--vid` | **是** | int | 问卷 ID |
| | `--inputcosttime` | **是** | int | 填写耗时（秒） |
| | `--submitdata` | **是** | string | 提交数据 |
| | `--udsid` | | int | 用户系统 ID |
| | `--sojumpparm` | | string | 自定义参数 |
| | `--submittime` | | string | 提交时间 |
| **modify** | `--vid` | **是** | int | 问卷 ID |
| | `--jid` | **是** | int | 答卷 ID |
| | `--answers` | **是** | string | 答案数据 |
| **clear** | `--username` | **是** | string | 用户名 |
| | `--vid` | **是** | int | 问卷 ID |
| | `--reset_to_zero` | | flag | 重置序号 |
| **report** | `--vid` | **是** | int | 问卷 ID |
| | `--min_index` | | int | 最小序号 |
| | `--jid` | | string | 答卷 ID |
| | `--sojumpparm` | | string | 自定义参数 |
| | `--begin_time` | | int | 开始时间 |
| | `--end_time` | | int | 结束时间 |
| | `--distinct_user` | | flag | 去重用户 |
| | `--distinct_sojumpparm` | | flag | 去重参数 |
| | `--conds` | | string | 查询条件 |
| **files** | `--vid` | **是** | int | 问卷 ID |
| | `--file_keys` | **是** | string | 文件 Key 列表 |
| | `--file_view_expires` | | int | 链接有效期 |
| **winners** | `--vid` | **是** | int | 问卷 ID |
| | `--atype` | | int | 活动类型 |
| | `--awardstatus` | | int | 领奖状态 |
| | `--page_index` | | int | 页码 |
| | `--page_size` | | int | 每页数量 |
| **360-report** | `--vid` | **是** | int | 问卷 ID |
| | `--taskid` | | string | 任务 ID |

</details>

### contacts — 通讯录

```bash
wjx contacts query --uid user1              # 查询联系人
wjx contacts add --users '[{"name":"张三"}]' # 添加联系人
wjx contacts delete --uids "uid1,uid2"      # 删除联系人
```

| 子命令 | 选项 | 必填 | 类型 | 说明 |
|--------|------|:----:|------|------|
| **query** | `--uid` | **是** | string | 用户 ID |
| | `--corpid` | | string | 企业 ID |
| **add** | `--users` | **是** | json | 用户 JSON 数组 |
| | `--corpid` | | string | 企业 ID |
| | `--auto_create_udept` | | flag | 自动创建部门 |
| | `--auto_create_tag` | | flag | 自动创建标签 |
| **delete** | `--uids` | **是** | string | 用户 ID 列表（逗号分隔） |
| | `--corpid` | | string | 企业 ID |

### department — 部门管理

```bash
wjx department list                           # 列出部门
wjx department add --depts '[{"name":"研发"}]'
wjx department modify --depts '[{"id":1,"name":"技术"}]'
wjx department delete --depts '[{"id":1}]' --type 1
```

| 子命令 | 选项 | 必填 | 类型 | 说明 |
|--------|------|:----:|------|------|
| **list** | `--corpid` | | string | 企业 ID |
| **add** | `--depts` | **是** | json | 部门路径 JSON 数组 |
| | `--corpid` | | string | 企业 ID |
| **modify** | `--depts` | **是** | json | 部门对象 JSON 数组 |
| | `--corpid` | | string | 企业 ID |
| **delete** | `--type` | **是** | string | 类型（1=按ID, 2=按名称） |
| | `--depts` | **是** | json | 部门标识 JSON 数组 |
| | `--corpid` | | string | 企业 ID |
| | `--del_child` | | flag | 同时删除子部门 |

### admin — 管理员

```bash
wjx admin add --users '[{"uid":"u1","role":1}]'
wjx admin delete --uids "uid1,uid2"
wjx admin restore --uids "uid1"
```

| 子命令 | 选项 | 必填 | 类型 | 说明 |
|--------|------|:----:|------|------|
| **add** | `--users` | **是** | json | 管理员 JSON 数组 |
| | `--corpid` | | string | 企业 ID |
| **delete** | `--uids` | **是** | string | 用户 ID 列表（逗号分隔） |
| | `--corpid` | | string | 企业 ID |
| **restore** | `--uids` | **是** | string | 用户 ID 列表（逗号分隔） |
| | `--corpid` | | string | 企业 ID |

### tag — 标签管理

```bash
wjx tag list                                  # 列出标签
wjx tag add --child_names '["VIP","普通"]'
wjx tag modify --tp_id 1 --child_names '["新VIP"]'
wjx tag delete --tags '[{"id":1}]' --type 1
```

| 子命令 | 选项 | 必填 | 类型 | 说明 |
|--------|------|:----:|------|------|
| **list** | `--corpid` | | string | 企业 ID |
| **add** | `--child_names` | **是** | json | 标签路径 JSON 数组 |
| | `--corpid` | | string | 企业 ID |
| | `--is_radio` | | flag | 单选标签 |
| **modify** | `--tp_id` | **是** | string | 标签组 ID |
| | `--tp_name` | | string | 标签组名称 |
| | `--child_names` | | json | 标签对象 JSON 数组 |
| | `--corpid` | | string | 企业 ID |
| **delete** | `--type` | **是** | string | 类型（1=按ID, 2=按名称） |
| | `--tags` | **是** | json | 标签标识 JSON 数组 |
| | `--corpid` | | string | 企业 ID |

### user-system — 用户体系

6 个子命令，管理用户系统中的参与者和问卷绑定。

```bash
wjx user-system add-participants --username u1 --sysid 1 --users '[...]'
wjx user-system bind --username u1 --sysid 1 --uids "a" --vid 12345
wjx user-system query-binding --username u1 --sysid 1 --vid 12345
wjx user-system query-surveys --username u1 --sysid 1 --uid "a"
```

<details>
<summary>全部选项参考</summary>

| 子命令 | 选项 | 必填 | 类型 | 说明 |
|--------|------|:----:|------|------|
| **add-participants** | `--username` | **是** | string | 用户名 |
| | `--users` | **是** | json | 参与者 JSON |
| | `--sysid` | **是** | int | 系统 ID |
| **modify-participants** | `--username` | **是** | string | 用户名 |
| | `--users` | **是** | json | 参与者 JSON |
| | `--sysid` | **是** | int | 系统 ID |
| **delete-participants** | `--username` | **是** | string | 用户名 |
| | `--uids` | **是** | json | 用户 ID JSON 数组 |
| | `--sysid` | **是** | int | 系统 ID |
| **bind** | `--username` | **是** | string | 用户名 |
| | `--vid` | **是** | int | 问卷 ID |
| | `--sysid` | **是** | int | 系统 ID |
| | `--uids` | **是** | string | 参与者 ID 列表 |
| | `--answer_times` | | int | 可答次数 |
| | `--can_chg_answer` | | flag | 允许修改答案 |
| | `--can_view_result` | | flag | 允许查看结果 |
| | `--can_hide_qlist` | | int | 隐藏问卷列表 |
| **query-binding** | `--username` | **是** | string | 用户名 |
| | `--vid` | **是** | int | 问卷 ID |
| | `--sysid` | **是** | int | 系统 ID |
| | `--page_index` | | int | 页码 |
| | `--page_size` | | int | 每页数量 |
| | `--join_status` | | int | 参与状态 |
| | `--day` | | string | 按天筛选 |
| | `--week` | | string | 按周筛选 |
| | `--month` | | string | 按月筛选 |
| | `--force_join_times` | | flag | 强制参与次数 |
| **query-surveys** | `--username` | **是** | string | 用户名 |
| | `--uid` | **是** | string | 参与者 ID |
| | `--sysid` | **是** | int | 系统 ID |
| | `--page_index` | | int | 页码 |
| | `--page_size` | | int | 每页数量 |

</details>

### account — 子账号管理

```bash
wjx account list                              # 查询子账号
wjx account add --subuser test1 --password pass123
wjx account modify --subuser test1 --email new@test.com
wjx account delete --subuser test1
wjx account restore --subuser test1
```

<details>
<summary>全部选项参考</summary>

| 子命令 | 选项 | 必填 | 类型 | 说明 |
|--------|------|:----:|------|------|
| **list** | `--subuser` | | string | 子账号用户名 |
| | `--name_like` | | string | 名称模糊搜索 |
| | `--role` | | int | 角色 |
| | `--group` | | int | 分组 |
| | `--page_index` | | int | 页码 |
| | `--page_size` | | int | 每页数量 |
| | `--mobile` | | string | 手机号 |
| **add** | `--subuser` | **是** | string | 子账号用户名 |
| | `--password` | | string | 密码 |
| | `--mobile` | | string | 手机号 |
| | `--email` | | string | 邮箱 |
| | `--role` | | int | 角色 |
| | `--group` | | int | 分组 |
| **modify** | `--subuser` | **是** | string | 子账号用户名 |
| | `--mobile` | | string | 手机号 |
| | `--email` | | string | 邮箱 |
| | `--role` | | int | 角色 |
| | `--group` | | int | 分组 |
| **delete** | `--subuser` | **是** | string | 子账号用户名 |
| **restore** | `--subuser` | **是** | string | 子账号用户名 |
| | `--mobile` | | string | 手机号 |
| | `--email` | | string | 邮箱 |

</details>

### sso — 单点登录

> **无需 API Key** — SSO 命令在本地生成 URL，不调用 API。

```bash
wjx sso subaccount-url --subuser test1       # 子账号 SSO 链接
wjx sso user-system-url --u admin --system_id 1 --uid user1
wjx sso partner-url --username partner1      # 代理商 SSO 链接
```

<details>
<summary>全部选项参考</summary>

| 子命令 | 选项 | 必填 | 类型 | 说明 |
|--------|------|:----:|------|------|
| **subaccount-url** | `--subuser` | **是** | string | 子账号用户名 |
| | `--mobile` | | string | 手机号 |
| | `--email` | | string | 邮箱 |
| | `--role_id` | | int | 角色 ID |
| | `--url` | | string | 登录后跳转 URL |
| | `--admin` | | int | 主账号登录（1） |
| **user-system-url** | `--u` | **是** | string | 账号用户名 |
| | `--system_id` | **是** | int | 用户系统 ID |
| | `--uid` | **是** | string | 参与者 ID |
| | `--uname` | | string | 参与者名称 |
| | `--udept` | | string | 参与者部门 |
| | `--uextf` | | string | 扩展字段 |
| | `--upass` | | string | 密码 |
| | `--is_login` | | int | 是否登录（0/1） |
| | `--activity` | | int | 跳转问卷 vid |
| | `--return_url` | | string | 返回 URL |
| **partner-url** | `--username` | **是** | string | 代理商用户名 |
| | `--mobile` | | string | 手机号 |
| | `--subuser` | | string | 子账号用户名 |

</details>

### analytics — 数据分析

> **无需 API Key** — analytics 命令在本地执行计算，不调用 API。

```bash
wjx analytics decode --submitdata "1$2}2$hello"     # 解码答卷提交数据
wjx analytics nps --scores "[9,10,7,3,8,10,9]"      # 计算 NPS 分数
wjx analytics csat --scores "[4,5,3,5,2]"            # 计算 CSAT 分数
wjx analytics csat --scores "[5,6,4]" --scale 7-point
wjx analytics anomalies --responses '[...]'          # 异常答卷检测
wjx analytics compare --set_a '{"score":80}' --set_b '{"score":90}'
wjx analytics decode-push --payload "..." --app_key "key"
```

| 子命令 | 选项 | 必填 | 类型 | 说明 |
|--------|------|:----:|------|------|
| **decode** | `--submitdata` | **是** | string | 提交数据字符串 |
| **nps** | `--scores` | **是** | json | 评分 JSON 数组（0-10） |
| **csat** | `--scores` | **是** | json | 评分 JSON 数组 |
| | `--scale` | | string | 量表类型：`5-point` 或 `7-point`（默认 5-point） |
| **anomalies** | `--responses` | **是** | json | 答卷数据 JSON 数组 |
| **compare** | `--set_a` | **是** | json | 指标集 A JSON 对象 |
| | `--set_b` | **是** | json | 指标集 B JSON 对象 |
| **decode-push** | `--payload` | **是** | string | 加密推送数据 |
| | `--app_key` | **是** | string | AppKey |
| | `--signature` | | string | 签名 |
| | `--raw_body` | | string | 原始请求体 |

### 配置与诊断

```bash
wjx init      # 交互式引导配置（API Key、Base URL、Corp ID → ~/.wjxrc）
wjx whoami    # 验证 API Key 并显示账号信息
wjx doctor    # 环境诊断（配置文件、Node 版本、API Key、API 连接、SDK 版本）
```

---

## stdin 管道输入

通过 `--stdin` 标志从管道读取 JSON 参数。CLI 显式指定的选项优先于 stdin 中的同名字段（source-aware merge）。

```bash
# 基本用法
echo '{"vid": 12345}' | wjx --stdin survey get

# 多字段
echo '{"page": 1, "page_size": 20}' | wjx --stdin survey list

# CLI 参数覆盖 stdin（source-aware：只有 CLI 显式指定的值才会覆盖）
echo '{"vid": 12345, "state": 1}' | wjx --stdin survey status --state 2
# → state=2（CLI 显式指定），vid=12345（来自 stdin）

# 配合 jq 链式调用
wjx survey list | jq '.data[0].vid' | xargs -I{} wjx survey get --vid {}

# Agent 工作流：先查问卷，再导出文本
VID=$(wjx survey list | jq -r '.data.activitys | to_entries[0].value.vid')
wjx survey export-text --vid "$VID" --raw
```

**规则：**
- stdin 必须是 JSON 对象（不能是数组或原始值）
- 空 stdin 不报错，等同于不使用 `--stdin`
- 非法 JSON → `INPUT_ERROR` exit 2

---

## 输出格式

### JSON（默认）

成功时输出到 stdout：

```bash
$ wjx survey url --mode create
{
  "url": "https://www.wjx.cn/..."
}
```

### 表格

```bash
$ wjx --table survey list
┌─────────┬───────┬──────────────┬────────┐
│ (index) │  vid  │    title     │ status │
├─────────┼───────┼──────────────┼────────┤
│    0    │ 12345 │ '客户满意度'  │   1    │
└─────────┴───────┴──────────────┴────────┘
```

### 错误

错误输出到 **stderr**（stdout 为空），详见下方 [错误协议](#错误协议)。

---

## 错误协议

wjx-cli 使用结构化 JSON 错误输出，方便 AI Agent 和自动化脚本解析。

### stderr JSON Schema

```json
{
  "error": true,
  "message": "错误描述（人类可读）",
  "code": "API_ERROR | AUTH_ERROR | INPUT_ERROR",
  "exitCode": 1
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `error` | `boolean` | 恒为 `true` |
| `message` | `string` | 错误描述 |
| `code` | `string` | 错误分类（见下表） |
| `exitCode` | `number` | 进程退出码 |

### 退出码

| 退出码 | 错误码 | 含义 | 典型场景 |
|:------:|--------|------|----------|
| **0** | — | 成功 | 命令正常完成 |
| **1** | `API_ERROR` | API 错误 | 网络错误、API 返回失败 |
| **1** | `AUTH_ERROR` | 认证错误 | API Key 缺失或无效 |
| **2** | `INPUT_ERROR` | 输入错误 | 缺少必填参数、无效整数、JSON 解析失败 |

### 示例

```bash
# 缺少 API Key → exit 1, AUTH_ERROR
$ wjx survey list 2>&1 >/dev/null
{"error":true,"message":"WJX_API_KEY 未设置。请通过 --api-key 参数、WJX_API_KEY 环境变量、或运行 wjx init 配置。","code":"AUTH_ERROR","exitCode":1}

# 缺少必填参数 → exit 2, INPUT_ERROR
$ wjx survey get 2>&1 >/dev/null
{"error":true,"message":"Missing required option: --vid","code":"INPUT_ERROR","exitCode":2}

# 无效整数 → exit 2, INPUT_ERROR
$ wjx survey get --vid abc 2>&1 >/dev/null
{"error":true,"message":"Invalid integer: \"abc\"","code":"INPUT_ERROR","exitCode":2}
```

### Agent 错误处理模式

```python
import subprocess, json

result = subprocess.run(["wjx", "survey", "get", "--vid", "12345"],
                        capture_output=True, text=True)

if result.returncode == 0:
    data = json.loads(result.stdout)
elif result.returncode == 2:
    # 输入错误 — 修正参数后重试
    err = json.loads(result.stderr)
    print(f"Bad input: {err['message']}")
elif result.returncode == 1:
    # API/认证错误 — 检查 API Key 或稍后重试
    err = json.loads(result.stderr)
    print(f"API error: {err['message']}")
```

---

## Agent 集成指南

wjx-cli 的设计目标是成为 AI Agent 的问卷星 API 操作工具。以下是典型集成模式。

### 作为 LLM Tool 使用

```json
{
  "type": "function",
  "function": {
    "name": "wjx_survey_list",
    "description": "列出问卷星中的所有问卷",
    "parameters": {
      "type": "object",
      "properties": {
        "page": { "type": "integer", "description": "页码" },
        "page_size": { "type": "integer", "description": "每页数量" }
      }
    }
  }
}
```

Agent 实现:

```python
def execute_wjx_tool(name, args):
    cmd = ["wjx"] + name.replace("wjx_", "").replace("_", " ").split()
    for k, v in args.items():
        cmd.extend([f"--{k}", str(v)])
    result = subprocess.run(cmd, capture_output=True, text=True)
    return json.loads(result.stdout) if result.returncode == 0 \
           else json.loads(result.stderr)
```

### stdin pipe 批量操作

```bash
# 批量查询多个问卷的答卷数
for vid in 12345 12346 12347; do
  echo "{\"vid\": $vid}" | wjx --stdin response count
done

# 结合 jq 构造复杂参数
echo '{"title":"调查","type":0,"questions":"[]"}' | wjx --stdin survey create
```

### 与 wjx-mcp-server 的关系

| 场景 | 推荐工具 |
|------|----------|
| Claude Desktop / Cursor 等 MCP 客户端 | `wjx-mcp-server` |
| 终端 / shell 脚本 / CI/CD | `wjx-cli` |
| 自定义 Agent（Python/Node/Go） | `wjx-cli`（子进程）或 `wjx-api-sdk`（直接导入） |
| 需要 56 个 MCP tools + resources + prompts | `wjx-mcp-server` |
| 需要简单的 JSON in / JSON out | `wjx-cli` |

---

## 环境变量

| 变量 | 必填 | 说明 | 默认值 |
|------|:----:|------|--------|
| `WJX_API_KEY` | 是* | 问卷星 OpenAPI API Key | — |
| `WJX_CORP_ID` | 否 | 企业通讯录 ID（通讯录相关操作需要） | — |
| `WJX_BASE_URL` | 否 | 自定义 API 基础域名 | `https://www.wjx.cn` |

\* SSO 和 analytics 命令不需要 API Key。

以上环境变量也可以通过 `wjx init` 写入 `~/.wjxrc` 配置文件，CLI 启动时自动加载。凭据解析优先级：`--api-key` 参数 > 环境变量 > 配置文件。

---

## 开发

```bash
cd wjx-ai-kit/wjx-cli

npm run build    # TypeScript 编译 → dist/
npm test         # 构建 + 运行 82 个测试
npm run clean    # 清理 dist/

# 手动测试
node dist/index.js --help
node dist/index.js survey url --mode create
WJX_API_KEY=xxx node dist/index.js survey list
```

### 项目结构

```
src/
├── index.ts              # 入口 + Commander program
├── commands/             # 12 个命令模块
│   └── *.ts              # 每个文件导出 register*Commands(program)
└── lib/
    ├── config.ts          # ~/.wjxrc 配置文件读写
    ├── command-helpers.ts # executeCommand / strictInt / requireField
    ├── auth.ts            # API Key 获取（--api-key > env > config）
    ├── output.ts          # JSON / table 输出
    ├── errors.ts          # CliError + 退出码路由
    └── stdin.ts           # stdin 读取 + source-aware merge
```

### 添加新命令

1. 在 `wjx-api-sdk` 中确认 SDK 函数已导出
2. 创建 `src/commands/<module>.ts`，导出 `register<Module>Commands(program)`
3. 在 `src/index.ts` 中注册
4. 在 `__tests__/cli.test.mjs` 中添加测试
5. `npm test` 验证

---

## 常见问题

### `AUTH_ERROR: WJX_API_KEY 未设置`

运行交互式配置，或手动设置环境变量：

```bash
wjx init                                   # 交互式配置（推荐）
# 或
export WJX_API_KEY=your_api_key            # 环境变量
# 或
wjx --api-key your_api_key survey list     # 命令行参数
```

### `INPUT_ERROR: Invalid integer: "abc"`

整数参数必须是纯数字，不接受 `123abc` 或 `12.5` 等值。

### `INPUT_ERROR: stdin JSON must be an object`

`--stdin` 只接受 JSON 对象，不接受数组或原始值：

```bash
# 错误
echo '[1,2,3]' | wjx --stdin survey list

# 正确
echo '{"page":1}' | wjx --stdin survey list
```

### API 连接问题

运行诊断：

```bash
wjx doctor
```

如需指向测试环境：

```bash
export WJX_BASE_URL=https://your-test-server.com
```

---

## 相关项目

| 项目 | 说明 |
|------|------|
| [wjx-ai-kit](../) | Monorepo 根目录 |
| [wjx-api-sdk](../wjx-api-sdk/) | TypeScript SDK（50+ 函数，零依赖） |
| [wjx-mcp-server](../wjx-mcp-server/) | MCP Server（56 tools，供 Claude/Cursor 使用） |

---

## 许可证

[MIT](LICENSE)
