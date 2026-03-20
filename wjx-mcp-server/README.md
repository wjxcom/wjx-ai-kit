# WJX MCP Server

问卷星 (WJX) MCP Server — 通过 [Model Context Protocol](https://modelcontextprotocol.io/) 将问卷星 OpenAPI 能力暴露给 Claude 及其他 AI 客户端，让 AI 可以直接创建和管理问卷。

## 前置条件

- Node.js >= 18
- 问卷星 OpenAPI 开发凭据（`appid` 和 `appkey`，请联系问卷星客户顾问获取）

## 安装

```bash
cd wjx-mcp-server
npm install
npm run build
```

## 配置

设置以下环境变量：

| 环境变量 | 必需 | 说明 |
|----------|------|------|
| `WJX_APPID` | 是 | 问卷星 OpenAPI 开发 ID |
| `WJX_APPKEY` | 是 | 问卷星 OpenAPI 开发密钥 |

```bash
export WJX_APPID="your_appid"
export WJX_APPKEY="your_appkey"
```

## 使用方法

### 在 Claude Desktop 中使用

编辑 Claude Desktop 配置文件 `claude_desktop_config.json`：

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "wjx": {
      "command": "node",
      "args": ["path/to/wjx-mcp-server/dist/index.js"],
      "env": {
        "WJX_APPID": "your_appid",
        "WJX_APPKEY": "your_appkey"
      }
    }
  }
}
```

### 在 Claude Code 中使用

```bash
claude mcp add wjx -- node path/to/wjx-mcp-server/dist/index.js
```

或在 `.claude/settings.json` 中配置：

```json
{
  "mcpServers": {
    "wjx": {
      "command": "node",
      "args": ["path/to/wjx-mcp-server/dist/index.js"],
      "env": {
        "WJX_APPID": "your_appid",
        "WJX_APPKEY": "your_appkey"
      }
    }
  }
}
```

### 在其他 MCP 客户端中使用

本服务通过 stdio 传输协议通信，任何支持 MCP 的客户端均可接入。启动命令：

```bash
WJX_APPID=your_appid WJX_APPKEY=your_appkey node dist/index.js
```

## 支持的 Tools

### `create_survey` — 创建问卷

创建一份新的问卷星问卷。

**参数：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 问卷名称 |
| `atype` | number | 是 | 问卷类型（见下方类型表） |
| `desc` | string | 是 | 问卷描述 |
| `publish` | boolean | 否 | 是否立即发布，默认 `false` |
| `questions` | array | 是 | 题目列表 |

**问卷类型（`atype`）：**

| 值 | 类型 |
|----|------|
| 0 | 问卷调查 |
| 1 | 考试 / 测评 |
| 2 | 投票 |

**题目对象（`questions` 数组元素）通用属性：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `q_index` | number | 是 | 题目编号 |
| `q_type` | number | 是 | 题目类型（见下方题型表） |
| `q_title` | string | 是 | 问题标题 |
| `is_requir` | boolean | 否 | 是否必填，默认 `true` |
| `items` | array | 否 | 选项列表（选择题使用） |

**题目类型（`q_type`）：**

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

**选项对象（`items` 数组元素）属性：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `q_index` | number | 是 | 所属题目编号 |
| `item_index` | number | 是 | 选项编号 |
| `item_title` | string | 是 | 选项标题 |
| `item_selected` | boolean | 否 | 是否默认选中 |

**返回值：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `vid` | number | 问卷编号 |
| `sid` | string | 问卷短编号 |
| `status` | number | 问卷状态 |
| `pc_path` | string | PC 端问卷 URL 路径 |
| `mobile_path` | string | 移动端问卷 URL 路径 |
| `activity_domain` | string | 问卷访问域名 |

---

### `get_survey` — 获取问卷内容

根据问卷编号获取问卷详情，包括题目和选项信息。

**参数：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `get_questions` | boolean | 否 | 是否获取题目信息，默认 `true` |
| `get_items` | boolean | 否 | 是否获取选项信息，默认 `true` |

**返回值：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `vid` | number | 问卷编号 |
| `title` | string | 问卷名称 |
| `atype` | number | 问卷类型 |
| `status` | number | 问卷状态 |
| `answer_valid` | number | 有效答卷数 |
| `answer_total` | number | 答卷总数 |
| `questions` | array | 题目列表 |

## 示例

### 创建一份简单的满意度问卷

配置好 MCP Server 后，直接在 Claude 对话中说：

> 帮我创建一份客户满意度问卷，包含以下问题：
> 1. 您对我们的服务整体满意吗？（单选：非常满意/满意/一般/不满意）
> 2. 您最看重哪些方面？（多选：服务态度/响应速度/专业能力/价格）
> 3. 您有什么建议？（填空题）

Claude 将调用 `create_survey` Tool，传入参数大致如下：

```json
{
  "title": "客户满意度调查",
  "atype": 0,
  "desc": "感谢您的反馈，帮助我们持续改进服务质量。",
  "publish": false,
  "questions": [
    {
      "q_index": 1,
      "q_type": 3,
      "q_title": "您对我们的服务整体满意吗？",
      "is_requir": true,
      "items": [
        { "q_index": 1, "item_index": 1, "item_title": "非常满意" },
        { "q_index": 1, "item_index": 2, "item_title": "满意" },
        { "q_index": 1, "item_index": 3, "item_title": "一般" },
        { "q_index": 1, "item_index": 4, "item_title": "不满意" }
      ]
    },
    {
      "q_index": 2,
      "q_type": 4,
      "q_title": "您最看重哪些方面？（可多选）",
      "is_requir": true,
      "items": [
        { "q_index": 2, "item_index": 1, "item_title": "服务态度" },
        { "q_index": 2, "item_index": 2, "item_title": "响应速度" },
        { "q_index": 2, "item_index": 3, "item_title": "专业能力" },
        { "q_index": 2, "item_index": 4, "item_title": "价格" }
      ]
    },
    {
      "q_index": 3,
      "q_type": 5,
      "q_title": "您有什么建议？",
      "is_requir": false
    }
  ]
}
```

创建成功后会返回问卷编号和访问链接。

## 认证机制

本 MCP Server 内部自动处理问卷星 OpenAPI 的签名认证流程：

1. 使用 `WJX_APPID` 和 `WJX_APPKEY` 生成请求签名
2. 签名算法：将所有参数按 ASCII 排序后拼接参数值，末尾追加 `appkey`，计算 SHA1 哈希
3. 每次请求自动附加 Unix 时间戳（`ts`），请求有效期 30 秒

用户无需关心签名细节，配置好环境变量即可。

## 项目结构

```
wjx-mcp-server/
├── docs/
│   └── wjx-openapi-spec.md   # 问卷星 OpenAPI 接口文档
├── src/                       # TypeScript 源码（开发中）
│   └── index.ts               # MCP Server 入口
├── dist/                      # 编译产物
├── package.json
├── tsconfig.json
└── README.md
```

## 开发

```bash
# 安装依赖
npm install

# 编译
npm run build

# 开发模式（如有配置）
npm run dev
```

## 许可证

ISC
