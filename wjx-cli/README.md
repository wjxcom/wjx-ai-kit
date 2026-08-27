# wjx-cli

问卷星 AI Agent 原生命令行工具。它是 wjx-ai-kit 的默认入口，适用于终端、脚本、CI 和能执行 shell 的 AI 客户端。

## 安装

```bash
npm install -g wjx-cli
wjx init --api-key "你的问卷星 API Key"
wjx doctor
wjx survey list --table
```

要求 Node.js 20+。私有化部署追加 `--base-url https://你的域名`。API Key 请勿提交到仓库、日志或公共对话。

## 常用命令

```bash
wjx survey jsonl-template --raw > survey.jsonl
wjx survey create-by-json --file survey.jsonl
wjx response query --vid 12345 --page_size 100
wjx response download --vid 12345 --suffix 0
wjx analytics nps --scores "[9,10,8,6,3]"
```

JSON 是默认输出；`--table` 只用于人工查看；`--stdin` 接收 JSON 参数；`--dry-run` 预览请求。

当前命令以 `wjx --help` 为准，完整说明见 [CLI 快速开始](../wjx-docs/start/cli.md) 和 [CLI 命令参考](../wjx-docs/reference/cli.md)。问卷创建新代码使用 JSONL；`create-by-text` 仅为 DSL 兼容入口。

## 开发

```bash
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-cli
npm test --workspace=wjx-cli
```

许可证：[MIT](../LICENSE)
