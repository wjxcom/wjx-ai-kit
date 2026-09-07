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

当前稳定版本为 `0.4.3`，三个工作区包均已发布到 npm，registry 的 `latest` 指向 `0.4.3`。直接安装 CLI：

> 通过 AI 安装并启用 wjx-cli：先执行 `npm install -g wjx-cli@latest`，成功后再执行 `wjx skill install --force`；安装后命令名是 `wjx`，请用 `wjx --version` 验证，不要运行 `wjx-cli --version`。

```bash
npm install -g wjx-cli@latest
wjx skill install --force
wjx init --api-key "你的问卷星 API Key"
wjx doctor
```

### 让 AI 自动完成安装

把下面整段话发给你的 AI 助手。它应按可验证的状态机执行：先确认实际环境，再按需安装；拿到 API Key 前暂停等待，不要跳过最后的连接验收：

```text
请帮我安装并配置问卷星 CLI（wjx-cli）。严格按下面状态机执行；每一步都要拿到可验证结果后再继续：

0. 预检当前操作系统和 shell。检查 `node --version`、`npm --version`，并在命令可用时先检查 `wjx --version`。Windows 还要用 `Get-Command node,npm,wjx -ErrorAction SilentlyContinue`、`where.exe node`、`where.exe npm`、`where.exe wjx`，并检查 `C:\Program Files\nodejs\node.exe` 和 `%LOCALAPPDATA%\Programs\nodejs\node.exe`。同时记录 `npm prefix -g`，确认 npm 全局 bin 在当前 PATH。一个 shell 报“找不到命令”不能证明软件未安装。

1. 若绝对路径能找到 Node.js，直接用该路径验证版本；若只是当前 shell 的 PATH 未刷新，刷新 PATH 或启动新的 shell 后重新检查。只有确认 Node.js 不存在时才引导我从 https://nodejs.org 安装 LTS；版本低于 20 时停止并引导升级。不要在证据不足时运行 winget、安装器或后台安装进程。安装/升级后必须在新进程再次验证 `node --version` 和 `npm --version`。

2. Node.js >= 20 且 npm 可用后，先检查 `wjx --version`。若 wjx 已存在且版本 >= 0.4.1，跳过重复安装；若 wjx 缺失、版本过低或执行失败，才执行 `npm install -g wjx-cli@latest`。npm 包名是 `wjx-cli`，安装后的命令名是 `wjx`；npm 退出码为 0 不等于安装完成，必须刷新 PATH（如有需要）并再次运行 `wjx --version`。每个命令都要读取自身的真实退出码，不要用 `head`/`tail` 管道的退出码代替。禁止运行 `wjx-cli --version`。确认 CLI 可执行后，再执行 `wjx skill install --force`，并确认技能文件已落盘。

3. 引导我获取问卷星 API Key：
   - 公网用户：让我访问 https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1，微信扫码登录后复制 Key
   - 私有化部署用户：把上面的 www.wjx.cn 换成我的域名（例如 xxx.sojump.cn），登录链接和后续 `--base-url` 必须使用同一个域名
   等我把 Key 发给你（可能还会附带域名）。未收到 Key 前暂停，不要猜测、伪造或从其他文件读取凭据。

4. 拿到 Key 后执行 `wjx init --api-key <我的Key>`；私有化部署用户加 `--base-url https://<我的域名>`。不要在回复、日志或文件中回显完整 API Key，只允许显示脱敏状态。

5. 运行 `wjx doctor` 验证连接；逐项确认 API Key 已配置、Base URL 正确、网络/API 检查通过。任一步失败都不得口述“安装成功”，先报告实际失败阶段和下一步。

6. 最后运行 `wjx survey list --format table` 做一次人工验收，看到真实列表才说明接好了；这一步只用于人类查看，不要用表格推断总数、分页或填写链接。
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
