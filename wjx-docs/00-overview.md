# wjx-ai-kit：用 AI 重新定义问卷调研

> 问卷星官方开源 · TypeScript SDK + MCP Server + CLI 三合一工具包

---

## 一句话说清楚

**wjx-ai-kit** 是问卷星官方开源的 AI 开发工具包。它让你用自然语言创建问卷、用对话分析数据、用命令行自动化一切——把原来需要反复点击网页的问卷操作，变成 AI 可以直接完成的事。

---

## 为什么做这件事

问卷调研正在发生两个变化：

**第一，AI 正在重塑工作方式。** 当你可以对 Claude 说"帮我做一份员工满意度调查，包含 NPS 评分和 5 个维度的量表题"，它就能在 30 秒内创建一份专业问卷——没有人愿意再回到逐题拖拽的时代。

**第二，数据驱动需要 API 化。** 企业用户的问卷系统需要和 CRM、HRM、BI 打通，研究人员需要批量创建实验问卷、自动化数据回收。这些场景靠网页操作做不到，需要一套可编程的接口。

wjx-ai-kit 就是为这两个变化而生的：

```
你的 AI 助手 / 代码 / 脚本
        ↓
   wjx-ai-kit（SDK / MCP / CLI）
        ↓
    问卷星 OpenAPI
        ↓
  2.6 亿用户的调研平台
```

---

## 三个工具，一个目标

wjx-ai-kit 包含三个包，覆盖从 AI 对话到底层编程的全部场景：

### 🔌 MCP Server — 让 AI 直接操作问卷星

> "帮我创建一份 NPS 调查问卷，发布后统计结果"

MCP (Model Context Protocol) 是 Anthropic 提出的 AI 工具调用协议。wjx-mcp-server 实现了 **56 个工具**，让 Claude、Cursor、Windsurf 等 AI 客户端可以直接操作问卷星。

- **56 个 Tools**：创建问卷、查询答卷、管理通讯录、生成 SSO 链接、本地数据分析
- **8 个 Resources**：题型编码、DSL 语法、分析方法等参考资料，AI 随时查阅
- **19 个 Prompts**：NPS 分析、满意度调查、考试出题、异常检测等预设工作流
- **开箱即用**：配置 API Key，接入 Claude Desktop / Cursor / Claude Code 即可使用

**适合谁：** 使用 AI 编程工具的开发者、想用自然语言管理问卷的企业用户

### ⌨️ CLI — AI Agent 原生命令行

> `wjx survey create-by-text --file survey.txt --publish`

wjx-cli 是为 AI Agent 设计的命令行工具。69 个子命令覆盖问卷星全部 API 能力，输出结构化 JSON，天然适配 AI Agent 工作流和自动化脚本。

- **69 个子命令**：问卷、答卷、通讯录、部门、管理员、标签、用户体系、子账号、SSO、数据分析
- **AI Agent 友好**：JSON 输出 + 管道输入 + 结构化错误 + Shell 补全
- **Claude Code 技能**：`wjx skill install` 一键安装 AI Agent 技能包
- **Dry-Run 预览**：`--dry-run` 看到完整请求但不实际发送
- **9 个离线命令**：NPS、CSAT、异常检测等分析命令不需要 API Key

**适合谁：** AI Agent 开发者、自动化脚本编写者、命令行爱好者

### 📦 SDK — 零依赖 TypeScript 基础层

> `await createSurveyByText({ text: "满意度调查\n\n1. 评分[量表题]\n1~10" })`

wjx-api-sdk 是零运行时依赖的 TypeScript SDK，提供 60+ 类型安全的函数，覆盖问卷星 OpenAPI 全部能力。

- **零依赖**：只用 Node.js 内置 API（fetch + crypto），无第三方包
- **60+ 函数**：8 大模块完整覆盖（问卷、答卷、通讯录、用户体系、子账号、SSO、分析、DSL 转换）
- **DSL 双向转换**：纯文本 ↔ 问卷结构体，支持 27 种题型标签
- **本地分析引擎**：NPS/CSAT 计算、异常检测、数据解码，无需网络
- **可测试设计**：fetch 注入 + 凭据提供者模式，623 个测试零网络依赖

**适合谁：** 构建调研 SaaS 的开发者、需要集成问卷能力的系统、学术研究自动化

---

## 选择你的工具

不确定该用哪个？按你的使用方式选择：

```
你想怎么用问卷星？
│
├─ ⭐ 最快上手：让 AI 帮你装 ──→ Skill 包（一句话搞定）
│   └─ 发给 AI："帮我安装问卷星 Skill" → 详见 Skill 包入门指南
│
├─ 在 AI 对话中操作 ──→ 选择你的 AI 工具（见下方配置指南）
│   │
│   ├─ Claude Code ──→ 推荐：MCP + Agent + Skill（最佳体验）
│   ├─ Claude Desktop / Cursor / Windsurf / Cline / Trae / Copilot ...
│   │   └──→ MCP Server + Agent + Skill + CLI（四层能力全覆盖）
│   ├─ OpenClaw / KimiClaw / QClaw / LinClaw 等国产 Claw 工具
│   │   └──→ MCP Server + Agent + Skill + CLI（四层能力全覆盖）
│   ├─ Manus / WorkBuddy / QoderWork 等 AI 工作台
│   │   └──→ MCP Server + Agent + Skill + CLI（四层能力全覆盖）
│   │
│   └─ 不确定？先试 Skill 包，最简单；再配 MCP Server，能力更强
│
├─ 命令行 / 自动化脚本 ──→ CLI
│   └─ wjx skill install 一键安装 Agent 技能包
│
└─ 构建应用 / 系统集成 ──→ SDK
```

### 三层能力递进

wjx-ai-kit 不只是 MCP Server——它还提供 **Agent 定义** 和 **Skill 参考文档**，让 AI 从"能用工具"进化到"懂业务流程"：

| 层级 | 能力 | 说明 |
|------|------|------|
| **MCP 工具层** | 56 个 Tools + 8 Resources + 19 Prompts | 所有 MCP 客户端通用，AI 直接调用 |
| **Agent 层** | 2 个专家 Agent（MCP 专家 / CLI 专家） | 内置工作流和安全规范，自动编排多步操作 |
| **Skill 层** | 2 套渐进式参考文档 | Agent 按需读取参数细节，无需预加载全部知识 |

> **对比**：同类产品（如金数据 MCP）只有工具层。问卷星的 Agent + Skill 体系让 AI 不只是机械地执行命令，而是像一个问卷星专家一样主动规划工作流。

### Skill 市场

wjx-ai-kit 的 Skill 已上架主流 AI Skill 市场，你可以直接从市场安装：

| 市场 | 地址 | 安装方式 |
|------|------|----------|
| **Vercel Agent Skills** | [skills.sh/wjxcom/wjx-ai-kit](https://skills.sh/wjxcom/wjx-ai-kit) | `npx skills add wjxcom/wjx-ai-kit` |
| **ClawHub** | [clawhub.ai/skills](https://clawhub.ai/skills?q=wjx) | 在 ClawHub 搜索 "wjx" 安装 |

包含 2 个 Skill：**wjx-cli-use**（CLI 命令专家技能）和 **wjx-mcp-use**（MCP 工具专家技能）。

---

## AI 工具配置指南

在你常用的 AI 工具中接入问卷星。点击对应指南，5 分钟内完成配置。

| AI 工具 | 一句话说明 | 配置指南 |
|---------|----------|---------|
| **Claude Code** | Agent + Skill 完整支持，终端内完成一切 | [配置指南](./setup-claude-code.md) |
| **Claude Desktop** | 最简单的入门方式，对话即操作 | [配置指南](./setup-claude-desktop.md) |
| **Cursor** | AI 编程 + 问卷管理一体化 | [配置指南](./setup-cursor.md) |
| **Windsurf** | Cascade AI + 问卷星工具链 | [配置指南](./setup-windsurf.md) |
| **Cline** | VS Code 中的 AI Agent，自主完成问卷任务 | [配置指南](./setup-cline.md) |
| **GitHub Copilot** | Agent 模式下调用问卷星 MCP | [配置指南](./setup-copilot.md) |
| **Trae** | 字节跳动 AI IDE，中文体验友好 | [配置指南](./setup-trae.md) |
| **Gemini** | Google AI 生态接入 | [配置指南](./setup-gemini.md) |
| **Qoder** | 阿里巴巴 Agentic 编程平台 | [配置指南](./setup-qoder.md) |
| **OpenClaw** | 开源 AI 编程助手，Skills 系统 | [配置指南](./setup-openclaw.md) |
| **国产 Claw 系列** | KimiClaw、QClaw、LinClaw、MaxClaw、EasyClaw 等 | [配置指南](./setup-claw.md) |
| **AI 工作台** | Manus、WorkBuddy、QoderWork | [配置指南](./setup-workbench.md) |

---

## 快速体验

### 10 秒：让 AI 帮你安装（最快上手）

不用手动配置任何东西。把下面的话发给你的 AI 助手：

> 请帮我安装问卷星工具：
> 1. 运行 `npm install -g wjx-cli` 安装问卷星 CLI
> 2. 安装完成后，告诉我去这个链接获取 API Key：https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1 ，等我把 Key 发给你
> 3. 拿到我的 Key 后运行 `wjx init --api-key <我的Key>` 完成配置
> 4. 最后运行 `wjx doctor` 验证连接

AI 安装 CLI 后会让你获取 API Key。微信扫码登录后，把 Key 发给 AI（例如"这是 API Key：sk-wjx-xxx，请继续"），AI 就能帮你完成配置。

详见 [Skill 包入门指南](./skill-getting-started.md)。

### 30 秒：用 MCP Server 接入 AI 工具

如果你的 AI 工具支持 MCP（Claude Desktop、Cursor、Windsurf 等），MCP Server 能力更强：

```json
{
  "mcpServers": {
    "wjx": {
      "command": "npx",
      "args": ["wjx-mcp-server"],
      "env": { "WJX_API_KEY": "你的API Key" }
    }
  }
}
```

56 个工具 + 8 个参考资源 + 19 个预设 Prompt，AI 直接调用。

### 1 分钟：用命令行创建问卷

```bash
# 安装
npm install -g wjx-cli

# 配置（交互式或参数模式）
wjx init
# 或 wjx init --api-key 你的APIKey

# 环境检查
wjx doctor

# 用 DSL 文本创建问卷
wjx survey create-by-text --text "
客户满意度调查

1. 您愿意向朋友推荐我们吗？[量表题]
0~10

2. 请评价以下方面 [矩阵量表题]
行：
- 产品质量
- 服务态度
- 响应速度
列：
- 非常不满意
- 不满意
- 一般
- 满意
- 非常满意

3. 您有什么建议？[填空题]
"
```

### 5 分钟：用 SDK 构建自动化

```typescript
import {
  createSurveyByText,
  queryResponses,
  calculateNps,
  decodeResponses,
} from "wjx-api-sdk";

// 1. 用自然语言 DSL 创建问卷
const survey = await createSurveyByText({
  text: "NPS 调查\n\n1. 推荐意愿[量表题]\n0~10",
});
console.log(`问卷已创建: ${survey.data.vid}`);

// 2. 查询答卷数据
const responses = await queryResponses({
  vid: survey.data.vid,
  page_size: 100,
});

// 3. 解码并分析
for (const r of responses.data.list) {
  const decoded = decodeResponses(r.submitdata);
  console.log(decoded);
}

// 4. 计算 NPS
const nps = calculateNps([9, 10, 7, 3, 8, 10, 9, 6, 10, 8]);
console.log(`NPS: ${nps.score} (${nps.rating})`);
// NPS: 20 (一般)
```

---

## 能力全景

| 能力 | SDK | MCP Server | CLI |
|------|:---:|:----------:|:---:|
| 问卷创建/编辑/删除 | ✅ | ✅ | ✅ |
| DSL 文本创建问卷 | ✅ | ✅ | ✅ |
| 答卷查询/下载/提交 | ✅ | ✅ | ✅ |
| 统计报告 | ✅ | ✅ | ✅ |
| 通讯录管理 | ✅ | ✅ | ✅ |
| 部门/标签管理 | ✅ | ✅ | ✅ |
| 用户体系/参与者 | ✅ | ✅ | ✅ |
| 子账号管理 | ✅ | ✅ | ✅ |
| SSO 单点登录 | ✅ | ✅ | ✅ |
| NPS/CSAT 计算 | ✅ | ✅ | ✅ |
| 异常检测 | ✅ | ✅ | ✅ |
| Webhook 解密 | ✅ | ✅ | ✅ |
| AI Prompt 模板 | - | ✅ 19个 | - |
| AI 参考资源 | - | ✅ 8个 | - |
| Claude Code 技能 | - | - | ✅ |
| Shell 补全 | - | - | ✅ |
| Docker 部署 | - | ✅ | - |

---

## 技术亮点

### DSL：用纯文本定义问卷

不用写 JSON，不用拖拽控件。用一种直觉的文本格式描述问卷，支持 27 种题型：

```
员工满意度调查
这是一份关于工作体验的匿名调查
===

1. 您的部门 [下拉框]
技术部
产品部
市场部
运营部

2. 整体满意度 [量表题]
1~10

3. 请评价以下方面 [矩阵量表题]
行：
- 工作环境
- 团队协作
- 职业发展
- 薪酬福利
列：
- 非常不满意
- 不满意
- 一般
- 满意
- 非常满意

4. 改进建议 [填空题]
```

SDK 的 `textToSurvey()` 解析这段文本，`parsedQuestionsToWire()` 转为 API 格式，`createSurvey()` 提交到问卷星。三步合一就是 `createSurveyByText()` —— 一个函数搞定。

### 本地分析引擎：不上传数据也能分析

6 个分析函数完全在本地运行，数据不出你的机器：

- **NPS 计算**：自动分类推荐者/中立者/贬损者，给出评级（优秀/良好/一般/较差）
- **CSAT 计算**：支持 5 级和 7 级量表
- **异常检测**：识别秒答（<30% 中位时长）、直线作答、IP+内容重复
- **数据解码**：解析问卷星的 `submitdata` 编码格式
- **指标对比**：A/B 组差异分析，>10% 标记显著
- **Push 解密**：AES-128-CBC 回调数据解密 + SHA1 签名验证

### 零依赖 SDK

`package.json` 的 `dependencies` 是空的。整个 SDK 只用 Node.js 内置的 `fetch`（Node 20+）和 `crypto` 模块。这意味着：

- 没有供应链风险
- 安装速度极快
- 可以嵌入任何项目而不担心依赖冲突
- 623 个测试全部通过 fetch 注入模式运行，零网络调用

### 1000+ 测试

| 包 | 测试数 | 说明 |
|----|--------|------|
| wjx-api-sdk | ~623 | 全部通过 mock fetch，零网络依赖 |
| wjx-mcp-server | ~280 | 单元 + 集成测试 |
| wjx-cli | ~133 | 端到端测试 |
| **合计** | **~1036** | |

---

## 场景速览

### 场景 1：AI 自动创建调研问卷

> 你："帮我做一份关于远程办公体验的调查，15 个题，包含单选、量表和开放题"

Claude 通过 MCP Server 自动完成：拟定题目 → 生成 DSL → 调用 `create_survey_by_text` → 返回预览链接。全程 30 秒。

### 场景 2：自动化数据分析流水线

```bash
# 查询最新 100 条答卷 → 解码 → 统计 NPS
VID=12345
wjx response query --vid $VID --page_size 100 \
  | jq -r '.data.list[].submitdata' \
  | wjx analytics decode --submitdata - \
  | wjx analytics nps --scores -
```

### 场景 3：批量创建实验问卷

研究人员需要创建 20 个版本的问卷（不同题目顺序做 A/B 测试）：

```typescript
import { createSurveyByText } from "wjx-api-sdk";

for (const [i, variant] of variants.entries()) {
  const result = await createSurveyByText({
    text: variant,
    title: `实验组 ${i + 1}`,
  });
  console.log(`变体 ${i + 1}: vid=${result.data.vid}`);
}
```

### 场景 4：CRM 集成

SaaS 平台在用户完成购买后自动推送满意度调查：

```typescript
import { createSurveyByText, buildPreviewUrl, submitResponse } from "wjx-api-sdk";

// 创建问卷（一次性）
const survey = await createSurveyByText({ text: npsTemplate });

// 生成调查链接
const url = buildPreviewUrl({ vid: survey.data.vid, source: "crm" });

// 或直接代填提交
await submitResponse({
  vid: survey.data.vid,
  submitdata: "1$9",
  inputcosttime: 60,
});
```

### 场景 5：Webhook 实时回调

问卷提交后实时处理数据：

```typescript
import { decodePushPayload, calculateNps } from "wjx-api-sdk";

app.post("/webhook", (req, res) => {
  const { decrypted, signatureValid } = decodePushPayload(
    req.body.encrypt,
    process.env.WJX_API_KEY,
    req.headers["x-wjx-signature"],
    req.body,
  );

  if (signatureValid) {
    // 实时处理新答卷
    processNewResponse(decrypted);
  }
});
```

---

## 开始使用

| 你的角色 | 推荐起点 | 文档 |
|---------|----------|------|
| 刚接触，想最快上手 | Skill 包（让 AI 帮你装） | [Skill 包入门指南](./skill-getting-started.md) |
| 用 Claude Code 的开发者 | MCP + Agent + Skill | [Claude Code 配置指南](./setup-claude-code.md) |
| 用 Claude Desktop 的用户 | MCP Server | [Claude Desktop 配置指南](./setup-claude-desktop.md) |
| 用 Cursor / Windsurf 的开发者 | MCP Server | [Cursor](./setup-cursor.md) / [Windsurf](./setup-windsurf.md) 配置指南 |
| 用其他 AI 工具 | MCP Server | 见上方 [AI 工具配置指南](#ai-工具配置指南) |
| 想用命令行自动化的用户 | CLI | [CLI 入门指南](./cli-getting-started.md) |
| 构建 SaaS / 做系统集成 | SDK | [SDK 入门指南](./sdk-getting-started.md) |
| 做学术调研的研究人员 | CLI + SDK | [CLI 入门指南](./cli-getting-started.md) |
| 企业 IT / 远程部署 | MCP HTTP 模式 | [MCP 进阶指南](./mcp-advanced.md) |

---

## 参与贡献

wjx-ai-kit 是问卷星官方开源项目，采用 MIT 协议，欢迎社区贡献。

```bash
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
npm test --workspace=wjx-api-sdk  # 623 tests ✓
```

- GitHub: [github.com/wjxcom/wjx-ai-kit](https://github.com/wjxcom/wjx-ai-kit)
- Issues: [提交反馈](https://github.com/wjxcom/wjx-ai-kit/issues)
- npm: [wjx-api-sdk](https://www.npmjs.com/package/wjx-api-sdk) · [wjx-mcp-server](https://www.npmjs.com/package/wjx-mcp-server) · [wjx-cli](https://www.npmjs.com/package/wjx-cli)
- Skill 市场: [Vercel Agent Skills](https://skills.sh/wjxcom/wjx-ai-kit) · [ClawHub](https://clawhub.ai/skills?q=wjx)

---

## 深入了解

### 入门指南

- [Skill 包入门指南](./skill-getting-started.md) — 最快上手，让 AI 一句话帮你安装
- [MCP Server 入门指南](./mcp-getting-started.md) — 5 分钟接入 Claude/Cursor
- [CLI 入门指南](./cli-getting-started.md) — 命令行快速上手
- [SDK 入门指南](./sdk-getting-started.md) — TypeScript 开发快速上手

### AI 工具配置指南

- [Claude Code](./setup-claude-code.md) ⭐ — Agent + Skill 完整体验
- [Claude Desktop](./setup-claude-desktop.md) · [Cursor](./setup-cursor.md) · [Windsurf](./setup-windsurf.md) · [Cline](./setup-cline.md)
- [GitHub Copilot](./setup-copilot.md) · [Trae](./setup-trae.md) · [Gemini](./setup-gemini.md) · [Qoder](./setup-qoder.md)
- [OpenClaw](./setup-openclaw.md) · [国产 Claw 系列](./setup-claw.md)（KimiClaw、QClaw、LinClaw、MaxClaw、EasyClaw 等）
- [AI 工作台](./setup-workbench.md)（Manus、WorkBuddy、QoderWork）

### 进阶指南

- [MCP Server 进阶指南](./mcp-advanced.md) — 56 个工具深度用法、HTTP 部署、Docker
- [CLI 进阶指南](./cli-advanced.md) — 69 个命令完全攻略、Skill 系统
- [SDK 进阶指南](./sdk-advanced.md) — DSL 引擎、分析函数、Webhook 解密
