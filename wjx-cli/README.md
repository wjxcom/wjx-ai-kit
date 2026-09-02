# wjx-cli

问卷星 AI Agent 原生命令行工具。它是 wjx-ai-kit 的默认入口，适用于终端、脚本、CI 和能执行 shell 的 AI 客户端。

## 安装

当前工作树版本为 `0.4.1`，尚未发布到 npm；registry 的 `latest` 仍是旧版。要使用当前源码，请在 monorepo 根目录执行：

```bash
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-cli
npm link ./wjx-cli
```

`0.4.1` 正式发布后，再使用下面的全局安装命令：

```bash
npm install -g wjx-cli
wjx init --api-key "你的问卷星 API Key"
wjx doctor
wjx survey list --format table
```

要求 Node.js 20+。私有化部署在初始化时追加 `--base-url`，例如 `wjx init --api-key "你的问卷星 API Key" --base-url "https://你的域名"`。多租户场景使用 `--profile <name>`，profile 的地址会按请求传给 SDK，不会与其他并发请求串用。API Key 请勿提交到仓库、日志或公共对话。

## 常用命令

```bash
wjx survey jsonl-template --raw > survey.jsonl
wjx survey create --file survey.jsonl
wjx survey preview-url --sid <sid>
wjx response query --vid 12345 --page_size 50
wjx response download --vid 12345 --suffix 0
wjx analytics nps --scores "[9,10,8,6,3]"
```

JSON 是默认输出；`--format table` 只用于人工查看；`--stdin` 接收 JSON 参数；`--dry-run` 以 `ok/data` envelope 在 stdout 返回脱敏请求计划，不发送 API 请求。

运行 `wjx update` 时，CLI 会先比较 registry 的 `latest` 与当前版本；远端版本不高于当前版本时只报告 `up-to-date`，不会执行安装，因此不会把尚未发布的本地版本降级。

当前命令以 `wjx --help` 为准，完整说明见 [CLI 快速开始](../wjx-docs/start/cli.md) 和 [CLI 命令参考](../wjx-docs/reference/cli.md)。问卷创建唯一使用 `survey create`；CLI 不提供 `create-by-text`、`create-by-json` 或旧 JSON 数组创建命令。旧 DSL 只能离线转换后再提交 JSONL。

## 开发

```bash
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-cli
npm test --workspace=wjx-cli
```

许可证：[MIT](../LICENSE)
