# wjx-ai-kit

问卷星官方开源 AI 工具包：SDK 提供共享业务基础层，CLI 是完整的主入口，MCP Server 提供面向原生 MCP 客户端的核心业务子集。

## 从这里开始

| 需求 | 文档 |
| --- | --- |
| 终端、脚本、CI，或不确定客户端是否支持 MCP | [CLI 快速开始](wjx-docs/start/cli.md) |
| Claude Desktop/Code、Cursor 等 MCP 客户端 | [MCP 快速开始](wjx-docs/start/mcp.md) |
| Node.js/TypeScript 程序集成 | [SDK 快速开始](wjx-docs/start/sdk.md) |
| 直接按目标完成工作 | [文档总览](wjx-docs/index.md) |
| 需要一个浏览器可打开的单页 | [wjx-kit.html](wjx-docs/wjx-kit.html) |

CLI 是默认入口：它不要求客户端支持 MCP，适合 AI Agent、自动化脚本和人工终端操作。MCP 处于 secondary / maintenance-mode 定位，只覆盖核心业务子集；初始化、诊断、profile、补全、参考/schema、更新和 Skill 安装保持 CLI-only。SDK 用于程序化集成；Agent/Skill 只是工作流层，不是独立 API 层。完整差异见 [能力矩阵](capabilities/capability-matrix.json)。

## 安装

当前稳定版本为 `0.4.1`，三个工作区包均已发布到 npm，registry 的 `latest` 指向 `0.4.1`。直接安装 CLI：

> 通过 AI 安装并启用 wjx-cli：先执行 `npm install -g wjx-cli@latest`，成功后再执行 `wjx skill install --force`；安装后命令名是 `wjx`，请用 `wjx --version` 验证，不要运行 `wjx-cli --version`。

```bash
npm install -g wjx-cli@latest
wjx skill install --force
wjx init --api-key "你的问卷星 API Key"
wjx doctor
```

### 让 AI 自动完成安装

把下面整段话发给你的 AI 助手。它应按顺序执行，拿到 API Key 前暂停等待，不要跳过最后的连接验收：

```text
请帮我安装并配置问卷星 CLI（wjx-cli）：

1. 检查 Node.js 是否 >= 20（运行 `node --version`），版本过低请引导我升级到 https://nodejs.org

2. 先执行 `npm install -g wjx-cli@latest`，成功后再执行 `wjx skill install --force`，同时安装 CLI 和 wjx-cli-use 技能。npm 包名是 `wjx-cli`，安装后的命令名是 `wjx`；运行 `wjx --version` 验证，不要运行 `wjx-cli --version`

3. 引导我获取问卷星 API Key：
   - 公网用户：让我访问 https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1，微信扫码登录后复制 Key
   - 私有化部署用户：把上面的 www.wjx.cn 换成我的域名（例如 xxx.sojump.cn）
   等我把 Key 发给你（可能还会附带域名）

4. 拿到 Key 后执行 `wjx init --api-key <我的Key>`；私有化部署用户加 `--base-url https://<我的域名>`。不要在回复、日志或文件中回显完整 API Key

5. 运行 `wjx doctor` 验证连接，应确认 API Key 已配置且网络/API 检查通过

6. 最后运行 `wjx survey list --format table` 做一次人工验收，看到真实列表就说明接好了；这一步只用于人类查看，不要用表格推断总数、分页或填写链接
```

需要从源码开发时，再克隆仓库并构建工作区：

```bash
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-cli
```

API Key 请从问卷星后台获取，不要提交到仓库、日志或公共对话。私有化部署在初始化时追加 `--base-url`：`wjx init --api-key "你的问卷星 API Key" --base-url "https://你的域名"`。

## 创建和分析

```bash
wjx survey jsonl-template --raw > survey.jsonl
wjx survey create --file survey.jsonl
wjx response report --vid 12345
wjx response query --vid 12345 --page_size 50
```

新项目只使用 JSONL 创建问卷；DSL 仅用于读取和离线迁移，见 [DSL 兼容](wjx-docs/legacy/dsl.md)。

## 开发

```bash
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-mcp-server
npm run build --workspace=wjx-cli
npm test --workspace=wjx-api-sdk
npm test --workspace=wjx-mcp-server
npm test --workspace=wjx-cli
```

完整文档请从 [文档总览](wjx-docs/index.md) 开始；需要浏览器打开的单页版本见 [wjx-kit.html](wjx-docs/wjx-kit.html)。

## 许可证

[MIT](LICENSE)
