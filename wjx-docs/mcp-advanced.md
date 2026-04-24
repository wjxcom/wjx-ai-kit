# MCP Server 进阶指南：58 个工具完全攻略

> HTTP 部署、Docker、多租户、自动化工作流、全部工具深度用法

---

## HTTP 模式部署

默认的 stdio 模式适合本地 AI 客户端。如果你需要团队共享或远程访问，可以启用 HTTP 模式。

### 启动 HTTP 服务

```bash
# 环境变量方式
MCP_TRANSPORT=http PORT=3000 MCP_AUTH_TOKEN=your_secret npx wjx-mcp-server

# 或命令行参数
npx wjx-mcp-server --http
```

### 端点说明

| 端点 | 方法 | 说明 |
|------|------|------|
| `/mcp` | POST | MCP 消息端点（需要 Bearer Token） |
| `/health` | GET | 健康检查（公开，返回 `{"status":"ok"}`） |

### 认证

设置 `MCP_AUTH_TOKEN` 后，所有 `/mcp` 请求需要携带 Bearer Token：

```
Authorization: Bearer your_secret
```

### 多租户模式

HTTP 模式天然支持多租户。每个请求的 Bearer Token 会被用作该请求的问卷星 API Key。不同客户端可以用各自的 API Key 访问同一个 MCP Server。

服务端通过 Node.js AsyncLocalStorage 将每个请求的凭据穿透到所有 SDK 调用，互不干扰。

```
客户端 A（API Key A）──→ POST /mcp ──→ MCP Server ──→ 用 Key A 调用问卷星
客户端 B（API Key B）──→ POST /mcp ──→ MCP Server ──→ 用 Key B 调用问卷星
```

---

## Docker 部署

### 构建镜像

需要从 monorepo 根目录构建（因为 SDK 是 workspace 依赖）：

```bash
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit
docker build -f wjx-mcp-server/Dockerfile -t wjx-mcp-server .
```

### 运行

```bash
docker run -d \
  --name wjx-mcp \
  -p 3000:3000 \
  -e WJX_API_KEY=your_api_key \
  -e MCP_AUTH_TOKEN=your_secret \
  wjx-mcp-server
```

内置健康检查（每 30 秒探测 `/health`），适合 Kubernetes 和 Docker Compose。

### Docker Compose 示例

```yaml
services:
  wjx-mcp:
    build:
      context: .
      dockerfile: wjx-mcp-server/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - WJX_API_KEY=${WJX_API_KEY}
      - MCP_AUTH_TOKEN=${MCP_AUTH_TOKEN}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

---

## 全部工具详解

### 问卷管理模块（13 项）

#### `create_survey` — 创建问卷（JSON 模式）

用结构化 JSON 创建问卷。适合精确控制题目结构的场景。

```
参数：
- aname (string, 必填): 问卷标题
- questions (array): 题目 JSON 数组
- source_vid (number): 从已有问卷复制
- atype (number): 问卷类型（1=调查 6=考试 7=表单）
- adesc (string): 问卷描述
- publish (boolean): 创建后自动发布
```

#### `create_survey_by_json` — 创建问卷（JSONL 模式，唯一推荐）

所有问卷创建一律使用本工具，覆盖 70+ 题型（含矩阵/比重/滑块/文件上传/排序），每行一道题。

```
参数：
- jsonl (string, 必填): JSONL 格式问卷文本（首行可选 `{"_meta":{"title":"...","description":"..."}}`）
- title (string): 覆盖 JSONL 中的问卷标题
- atype (number): 问卷类型（1=调查 6=考试 7=表单）
- publish (boolean): 创建后自动发布
- creater (string): 创建者子账号
```

字段编码见 [题型参考](#题型参考)。

#### `create_survey_by_text` — 创建问卷（DSL 文本模式，已弃用）

> **已弃用**：新项目请改用 `create_survey_by_json`。本工具仅为兼容保留。

```
参数：
- text (string, 必填): DSL 格式的问卷文本
- atype (number): 问卷类型
- publish (boolean): 创建后自动发布
```

DSL 支持的题型标签：

| 类别 | 标签 |
|------|------|
| 选择题 | `[单选题]` `[多选题]` `[下拉框]` `[判断题]` |
| 评分题 | `[量表题]` `[评分单选]` `[评分多选]` `[滑动条]` |
| 矩阵题 | `[矩阵量表题]` `[矩阵单选题]` `[矩阵多选题]` `[矩阵填空题]` |
| 填空题 | `[填空题]` `[简答题]` `[多项填空题]` |
| 特殊题 | `[排序题]` `[比重题]` `[文件上传]` `[绘图题]` |
| 考试题 | `[考试多项填空]` `[考试完形填空]` `[情景题]` |
| 结构 | `[多级下拉题]` `[商品题]` |

#### `get_survey` — 获取问卷详情

```
参数：
- vid (number, 必填): 问卷 ID
- format (string): 输出格式，"json"（默认）或 "dsl"（纯文本格式）
```

`format=dsl` 返回人类可读的文本格式，适合 AI 理解问卷内容。

#### `list_surveys` — 获取问卷列表

```
参数：
- page_index (number): 页码（默认 1）
- page_size (number): 每页数量（默认 10，最大 100）
- status (number): 状态过滤（0=未发布 1=收集中 2=已暂停 3=已删除）
- atype (number): 类型过滤
- name_like (string): 名称模糊搜索
- start_date / end_date (string): 时间范围
- folder_id (number): 文件夹 ID
- sort_by / sort_order: 排序
```

#### `update_survey_status` — 修改问卷状态

```
参数：
- vid (number, 必填): 问卷 ID
- state (number, 必填): 目标状态（1=发布 2=暂停 3=删除）
```

#### 其他问卷工具

- `get_survey_settings` / `update_survey_settings` — 获取/修改问卷设置
- `delete_survey` — 删除问卷（可选永久删除）
- `get_question_tags` / `get_tag_details` — 题目标签管理
- `clear_recycle_bin` — 清空回收站
- `upload_file` — 上传图片文件（Base64）

### 答卷管理模块（9 项）

#### `query_responses` — 查询答卷

最常用的答卷工具，支持丰富的过滤条件。

```
参数：
- vid (number, 必填): 问卷 ID
- page_index / page_size: 分页
- start_date / end_date: 时间范围
- conditions (string): 条件筛选（如 "Q1=选项A"）
- dedup (boolean): 去重
- order_by (string): 排序
```

#### `get_report` — 统计报告

返回每道题的频率分布、平均分、标准差等统计数据。

```
参数：
- vid (number, 必填): 问卷 ID
```

#### `download_responses` — 批量下载

```
参数：
- vid (number, 必填): 问卷 ID
- format (string): 格式（csv/sav/word）
```

超过 3000 条自动切换为异步下载模式（120 秒超时）。

#### 其他答卷工具

- `query_responses_realtime` — 实时增量查询（消费式，需白名单）
- `submit_response` — 代填提交答卷
- `get_winners` — 抽奖中奖者查询
- `modify_response` — 修改答卷（如调整考试主观题分数）
- `get_360_report` — 360 度评估报告（异步任务）
- `clear_responses` — 清空全部答卷（不可逆）

### 通讯录管理模块（14 项）

企业通讯录的完整 CRUD，覆盖联系人、部门、管理员、标签四个维度。需要设置 `WJX_CORP_ID`。

| 维度 | 工具 |
|------|------|
| 联系人 | `query_contacts` `add_contacts` `delete_contacts` |
| 管理员 | `add_admin` `delete_admin` `restore_admin` |
| 部门 | `list_departments` `add_department` `modify_department` `delete_department` |
| 标签 | `list_tags` `add_tag` `modify_tag` `delete_tag` |

### SSO 单点登录模块（5 项）

生成免密登录 URL，纯本地计算，无需 API 调用。

| 工具 | 用途 |
|------|------|
| `sso_subaccount_url` | 子账号 SSO 登录（自动创建或登录已有账号） |
| `sso_user_system_url` | 用户体系参与者 SSO 登录 |
| `sso_partner_url` | 合作伙伴/代理商 SSO 登录 |
| `build_survey_url` | 生成问卷创建或编辑页面 URL |
| `build_preview_url` | 生成答卷填写页面 URL |

### 数据分析模块（5 项）

**全部在本地运行，数据不离开你的机器。** 无需 API Key。

#### `calculate_nps` — NPS 计算

```
输入: scores (number[]): 0-10 评分数组
输出: score (-100~100), rating (优秀/良好/一般/较差),
      promoters/passives/detractors 各组 {count, ratio}
```

行业基准：

| 评级 | 分值 | 含义 |
|------|------|------|
| 优秀 | > 70 | 用户强烈推荐 |
| 良好 | 50-70 | 用户倾向推荐 |
| 一般 | 0-50 | 有改进空间 |
| 较差 | < 0 | 需要紧急改进 |

#### `calculate_csat` — CSAT 计算

```
输入: scores (number[]): 评分数组
      scaleType ("5-point" | "7-point"): 量表类型
输出: csat (0-1 比率), satisfiedCount, total, distribution
```

#### `detect_anomalies` — 异常检测

三种检测策略：
1. **直线作答**：连续选择相同答案（如全选 A）
2. **秒答检测**：答题时间 < 中位时长的 30%
3. **重复检测**：相同 IP + 相似答案内容

#### `decode_responses` — 答卷解码

解析问卷星的 submitdata 编码格式（`题号$答案}题号$答案`）为结构化数据。

#### `compare_metrics` — 指标对比

A/B 组或时间段对比，差异 >10% 标记为显著。

### 用户体系模块（6 项）

> **注意**：用户体系相关工具已标记为 `[已过时]`，问卷星官方建议新项目优先使用通讯录（Contacts）模块。存量项目仍可调用。

| 工具 | 用途 |
|------|------|
| `add_participants` | 批量添加参与者（单次最多 100 人），支持自动创建部门 |
| `modify_participants` | 批量修改参与者信息 |
| `delete_participants` | 批量删除参与者（不可恢复） |
| `bind_activity` | 将问卷绑定到用户体系并分配参与者，支持限制作答次数、允许修改答案、查看结果等 |
| `query_survey_binding` | 查询问卷-用户绑定关系，支持按日/周/月和参与状态筛选 |
| `query_user_surveys` | 查询某参与者关联的问卷列表 |

### 子账号管理模块（5 项）

主账号下的多用户管理，支持 4 种角色：1=系统管理员 / 2=问卷管理员 / 3=统计结果查看员 / 4=完整结果查看员。

| 工具 | 用途 |
|------|------|
| `add_sub_account` | 创建子账号，可指定角色和分组 |
| `modify_sub_account` | 修改子账号信息（手机、邮箱、角色、分组，不支持改密码） |
| `delete_sub_account` | 删除子账号（可通过 `restore_sub_account` 恢复） |
| `restore_sub_account` | 恢复已删除的子账号，可同时更新手机/邮箱 |
| `query_sub_accounts` | 查询子账号列表，支持按用户名、名称模糊匹配、角色、分组、状态、手机过滤 |

---

## 自动化工作流示例

### 工作流 1：每周 NPS 监控

对 Claude 说：

> "帮我分析问卷 12345 最近 7 天的 NPS 数据。
> 1. 先查询本周的答卷
> 2. 提取所有 NPS 评分题的分数
> 3. 计算 NPS 得分
> 4. 和上周数据做对比
> 5. 如果下降超过 10 分，找出贬损者的开放题反馈"

Claude 会自动调用 `query_responses` → `decode_responses` → `calculate_nps` → `compare_metrics` → `query_responses`（筛选贬损者），输出完整分析报告。

### 工作流 2：从文档出考试题

> "用这份《信息安全管理制度》出一套考试题：
> - 10 道单选题
> - 5 道多选题
> - 5 道判断题
> 创建为考试类型问卷，发布后给我链接"

Claude 使用 `generate-exam-from-document` prompt → 生成 JSONL → `create_survey_by_json`（atype=6）→ `update_survey_status`（发布）→ `build_preview_url`（生成链接）。

### 工作流 3：批量创建 + SSO 分发

> "帮我做以下事情：
> 1. 创建一份客户满意度调查
> 2. 给子账号 sales01 生成 SSO 登录链接
> 3. 查看通讯录里市场部的联系人"

Claude 分步调用多个工具完成跨模块操作。

### 工作流 4：问卷质量诊断

> "对问卷 12345 做一次完整的质量检查"

使用 `survey-health-check` prompt，Claude 自动执行：
1. 获取问卷结构 → 检查题目设计质量
2. 获取统计报告 → 分析完成率和弃答率
3. 查询答卷样本 → 运行异常检测
4. 输出 0-100 健康分 + 具体改进建议

---

## 高级配置

### 自定义 API 端点

私有部署或测试环境可以覆盖任意 URL：

```bash
# 全局覆盖
WJX_BASE_URL=https://your-private-wjx.com

# 单个端点覆盖
WJX_API_URL=https://custom-api.example.com/openapi
WJX_CONTACTS_API_URL=https://custom-contacts.example.com
```

### 会话管理

HTTP 模式默认有状态（`MCP_SESSION=stateful`），通过 `mcp-session-id` 头维护会话。

设置 `MCP_SESSION=stateless` 可关闭会话跟踪，适合无状态负载均衡部署。

### .env 文件

MCP Server 有内置的 .env 解析器（不依赖 dotenv），按以下顺序查找：

1. 当前工作目录下的 `.env`
2. wjx-mcp-server 包目录下的 `.env`

环境变量优先于 .env 文件。

---

## API 核心机制

### 请求签名

所有 API 请求自动进行 SHA1 签名：
1. 将参数 key 按字母排序
2. 拼接非空 value
3. 末尾追加 API Key
4. SHA1 哈希生成签名

签名时间窗口 30 秒，服务端自动校验。

### 重试策略

| 操作类型 | 重试次数 | 说明 |
|----------|---------|------|
| 读取操作 | 最多 2 次 | 429/5xx 触发重试，指数退避 + 随机抖动 |
| 写入操作 | 0 次 | 防止重复创建/删除 |

### 超时设置

| 操作 | 超时 |
|------|------|
| 常规请求 | 15 秒 |
| 批量下载 / 360 报告 | 120 秒 |

### 请求追踪

每个请求自动生成 UUID traceID，附加在 URL 查询参数中，用于问题排查。

---

## 下一步

- [MCP 入门指南](./mcp-getting-started.md) — 5 分钟快速接入
- [CLI 入门指南](./cli-getting-started.md) — 命令行工具
- [SDK 进阶指南](./sdk-advanced.md) — 底层 SDK 高级用法
- [总纲](./00-overview.md) — 全景概览
