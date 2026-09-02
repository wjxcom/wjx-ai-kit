# wjx-cli

问卷星 AI Agent 原生命令行工具。它是 wjx-ai-kit 的默认入口，适用于终端、脚本、CI 和能执行 shell 的 AI 客户端。

## 安装

当前稳定版本为 `0.4.1`，已发布到 npm，registry 的 `latest` 指向 `0.4.1`：

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

从源码开发时，在 monorepo 根目录执行：

```bash
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-cli
npm link ./wjx-cli
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

运行 `wjx update` 时，CLI 会先比较 registry 的 `latest` 与当前版本；远端版本不高于当前版本时只报告 `up-to-date`，不会执行安装，因此不会把本地版本降级。

当前命令以 `wjx --help` 为准，完整说明见 [CLI 快速开始](../wjx-docs/start/cli.md) 和 [CLI 命令参考](../wjx-docs/reference/cli.md)。问卷创建唯一使用 `survey create`；CLI 不提供 `create-by-text`、`create-by-json` 或旧 JSON 数组创建命令。旧 DSL 只能离线转换后再提交 JSONL。

## 开发

```bash
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-cli
npm test --workspace=wjx-cli
```

许可证：[MIT](../LICENSE)
