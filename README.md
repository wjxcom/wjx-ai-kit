# wjx-ai-kit

问卷星官方开源 AI 工具包：CLI、TypeScript SDK 和 MCP Server，共享同一套 API 能力。

## 从这里开始

| 需求 | 文档 |
| --- | --- |
| 终端、脚本、CI，或不确定客户端是否支持 MCP | [CLI 快速开始](wjx-docs/start/cli.md) |
| Claude Desktop/Code、Cursor 等 MCP 客户端 | [MCP 快速开始](wjx-docs/start/mcp.md) |
| Node.js/TypeScript 程序集成 | [SDK 快速开始](wjx-docs/start/sdk.md) |
| 直接按目标完成工作 | [文档总览](wjx-docs/index.md) |
| 需要一个浏览器可打开的单页 | [wjx-kit.html](wjx-docs/wjx-kit.html) |

CLI 是默认入口：它不要求客户端支持 MCP，适合 AI Agent、自动化脚本和人工终端操作。MCP 是原生 MCP 客户端的可选增强；SDK 用于程序化集成。Agent/Skill 只是工作流层，不是并列产品。

## 安装

```bash
npm install -g wjx-cli
wjx init --api-key "你的问卷星 API Key"
wjx doctor
```

API Key 请从问卷星后台获取，不要提交到仓库、日志或公共对话。私有化部署追加 `--base-url https://你的域名`。

## 创建和分析

```bash
wjx survey jsonl-template --raw > survey.jsonl
wjx survey create-by-json --file survey.jsonl
wjx response report --vid 12345
wjx response query --vid 12345 --page_size 100
```

新项目使用 JSONL/JSON 创建问卷；DSL 仅为兼容路径，见 [DSL 兼容](wjx-docs/legacy/dsl.md)。

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
