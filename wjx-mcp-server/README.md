# WJX MCP Server

问卷星 (WJX) MCP Server — 通过 [Model Context Protocol](https://modelcontextprotocol.io/) 将问卷星 OpenAPI 能力暴露给 Claude 及其他 AI 客户端，让 AI 可以直接创建和管理问卷。

## 前置条件

- Node.js >= 20
- 问卷星 OpenAPI 开发凭据（`appid` 和 `appkey`，在后台 "API自动登录" 弹窗中获取，或联系客户顾问）

## 安装

```bash
cd wjx-mcp-server
npm install
npm run build
```

## 配置

复制 `.env.example` 为 `.env`，填入凭据：

```bash
cp .env.example .env
```

| 环境变量 | 必需 | 说明 |
|----------|------|------|
| `WJX_APP_ID` | 是 | 问卷星 OpenAPI 开发 ID |
| `WJX_APP_KEY` | 是 | 问卷星 OpenAPI 开发密钥 |

服务启动时会自动加载 `.env` 文件。

## 使用方法

### 在 Claude Code 中使用

```bash
claude mcp add wjx -- node /home/claw/wjxagents/wjx-mcp-server/dist/index.js
```

### 在 Claude Desktop 中使用

编辑配置文件：

```json
{
  "mcpServers": {
    "wjx": {
      "command": "node",
      "args": ["/home/claw/wjxagents/wjx-mcp-server/dist/index.js"],
      "env": {
        "WJX_APP_ID": "your_appid",
        "WJX_APP_KEY": "your_appkey"
      }
    }
  }
}
```

### 直接运行

```bash
WJX_APP_ID=your_appid WJX_APP_KEY=your_appkey node dist/index.js
```

## 支持的 Tools

### `create_survey` — 创建问卷

创建一份新的问卷星问卷。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 问卷名称 |
| `atype` | number | 是 | 问卷类型 |
| `desc` | string | 是 | 问卷描述 |
| `publish` | boolean | 否 | 是否立即发布，默认 `false` |
| `questions` | string | 是 | 题目列表的 JSON 字符串 |

### `get_survey` — 获取问卷内容

根据问卷编号获取问卷详情。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `get_questions` | boolean | 否 | 是否获取题目信息，默认 `true` |
| `get_items` | boolean | 否 | 是否获取选项信息，默认 `true` |

### `list_surveys` — 获取问卷列表

分页获取账户下的问卷列表。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `page_index` | number | 否 | 页码，默认 1 |
| `page_size` | number | 否 | 每页数量（1-300），默认 10 |
| `status` | number | 否 | 按状态筛选 |
| `atype` | number | 否 | 按类型筛选 |
| `name_like` | string | 否 | 按名称模糊搜索（最长10字符） |
| `sort` | number | 否 | 排序规则（0-5） |

### `update_survey_status` — 修改问卷状态

修改问卷的发布状态。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `state` | number | 是 | 1=发布, 2=暂停, 3=删除 |

## 问卷类型（`atype`）

| 值 | 类型 |
|----|------|
| 1 | 调查 |
| 2 | 测评 |
| 3 | 投票 |
| 6 | 考试 |
| 7 | 表单 |

## 题目类型（`q_type`）

| 值 | 类型 |
|----|------|
| 1 | 分页 |
| 2 | 段落说明 |
| 3 | 单选题 |
| 4 | 多选题 |
| 5 | 填空题 |
| 6 | 多项填空题 |
| 7 | 矩阵题 |
| 8 | 文件上传题 |
| 9 | 比重题 |
| 10 | 滑动条 |

## 验证与后台可见性

- 自动化测试或端到端验证在创建问卷后，常会调用 **`update_survey_status` 且 `state=3`（删除）** 做环境清理，因此你在问卷星后台「我的问卷」里**看不到**这些问卷是正常的。
- 若需要**长期保留**验证问卷：创建后**不要**对同一 `vid` 调用删除；或使用单独的测试用 `appid` / 测试子账号。

## 与 Paperclip / 资料范围

- MCP Server 的维护**优先依赖**问卷星 **OpenAPI 文档与行为真源**（见 `docs/wjx-openapi-spec.md`、错误码、题目 JSON 样例），**不需要**向仓库导入问卷星整库业务代码。

## 生产特性

- **请求签名**: SHA1 签名自动计算，30秒时间窗口
- **TraceID**: 每次请求自动附带 32 位 GUID，方便排查
- **请求超时**: 默认 15 秒，可配置
- **自动重试**: 读取类接口遇到 5xx/429 错误自动重试（最多 2 次，指数退避）；写入类接口不重试
- **`.env` 自动加载**: 无需额外依赖

## 开发

```bash
npm install          # 安装依赖
npm run build        # 编译
npm test             # 运行全部测试（单元 + 集成）
npm run test:unit    # 仅运行单元测试
npm run test:integration  # 仅运行集成测试
```

## 项目结构

```
wjx-mcp-server/
├── docs/
│   └── wjx-openapi-spec.md       # 问卷星 OpenAPI 接口文档
├── src/
│   ├── index.ts                   # 入口：loadEnvFile() + main()
│   ├── server.ts                  # createServer() + 模块注册
│   ├── helpers.ts                 # toolResult(), toolError()
│   ├── core/
│   │   ├── api-client.ts          # callWjxApi(), 重试/签名/超时
│   │   ├── sign.ts                # SHA1 签名算法
│   │   ├── constants.ts           # Action codes, API URLs
│   │   └── types.ts               # 公共类型定义
│   ├── modules/
│   │   ├── survey/                # 问卷管理 (10 tools)
│   │   ├── response/              # 答卷数据 (10 tools)
│   │   ├── user-system/           # 用户体系 (5 tools)
│   │   ├── multi-user/            # 多用户管理 (5 tools)
│   │   ├── contacts/              # 通讯录 (3 tools)
│   │   └── sso/                   # SSO 免登录 (4 tools)
│   ├── resources/                 # MCP Resources
│   └── prompts/                   # MCP Prompts (含分析模板)
├── __tests__/                     # 单元测试
├── tests/                         # 集成测试
├── .env.example                   # 环境变量模板
├── package.json
├── tsconfig.json
└── README.md
```

## 认证说明

- 签名算法：按 key 字母排序拼接 value，末尾追加 appkey，SHA1 哈希
- traceid 参与签名但仅在 URL query 中传递，不放入 POST body
- 30 秒有效期：每次请求包含 Unix 时间戳

| 凭据 | 说明 |
|------|------|
| `appid` | OpenAPI 开发 ID（数字，如 `3642599`） |
| `appkey` | 签名密钥（同 SSO 密钥） |
| 推送密钥 | 仅用于 Webhook 回调验证，与 OpenAPI 无关 |

## 许可证

ISC
