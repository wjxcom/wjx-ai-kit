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

当前工作树版本为 `0.4.1`，尚未发布到 npm；registry 的 `latest` 仍是旧版。要使用当前源码，请先构建工作区：

```bash
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-cli
npm link ./wjx-cli
```

`0.4.1` 正式发布后，才使用下面的全局安装命令：

```bash
npm install -g wjx-cli
wjx init --api-key "你的问卷星 API Key"
wjx doctor
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
