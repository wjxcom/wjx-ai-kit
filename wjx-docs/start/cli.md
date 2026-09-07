# CLI 快速开始

本页只完成一条可验证路径：安装、配置凭据、列出问卷。

## 前置条件

- Node.js 20 或更高版本
- 问卷星 OpenAPI API Key。请在问卷星后台获取，不要把 Key 提交到代码仓库或公共对话。

如果尚未安装 Node.js：Windows/macOS 可从 [Node.js 官方下载页](https://nodejs.org/) 安装 LTS 版本；macOS 也可使用 `brew install node@20`，Ubuntu/Debian 可按 NodeSource 的 Node 20 安装说明配置。安装后重新打开终端并运行 `node --version`，确认版本为 20 或更高。

## 安装与配置

当前稳定版本为 `0.4.3`，已发布到 npm，registry 的 `latest` 指向 `0.4.3`。直接安装：

> 通过 AI 安装并启用 wjx-cli：先执行 `npm install -g wjx-cli@latest`，成功后再执行 `wjx skill install --force`；安装后命令名是 `wjx`，请用 `wjx --version` 验证，不要运行 `wjx-cli --version`。

```bash
npm install -g wjx-cli@latest
wjx skill install --force
wjx init --api-key "你的 API Key"
```

## 让 AI 自动完成安装

如果希望由 AI 代为执行安装、配置和验收，把下面整段提示发给 AI。AI 应按可验证的状态机执行：先确认实际环境，再按需安装；拿到 API Key 前暂停等待，不要跳过最后的列表验收：

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

需要从源码开发时，才按仓库 README 构建并链接 CLI。

私有化部署追加基础地址：

```bash
wjx init --api-key "你的 API Key" --base-url "https://你的域名"
```

`wjx init` 默认写入用户级配置；也可以只设置 `WJX_API_KEY` 和 `WJX_BASE_URL` 环境变量。检查连接：

```bash
wjx doctor
wjx survey list --format table
```

看到真实问卷列表即配置成功。JSON 是默认输出格式，脚本中建议保留默认格式并用 `--format table` 仅用于人工查看。

## 第一个任务

用 JSONL 创建问卷（推荐路径）：

```bash
wjx survey jsonl-template --raw > survey.jsonl
# 编辑 survey.jsonl 后：
wjx survey create --file survey.jsonl --publish
```

命令的完整选项见 [CLI 命令参考](../reference/cli.md)；按目标操作见 [创建问卷](../tasks/create-survey.md)。

创建请求会携带当前 CLI 名称和版本。若服务端以结构化信号要求升级，CLI 会返回 `UPGRADE_REQUIRED`；服务端提供最低版本或升级命令时，`error.hint` 才会包含对应信息。低于 `0.4.1` 的旧 CLI 需要先更新后再创建。

创建成功后优先使用 `wjx survey preview-url --sid <sid>` 或创建/列表响应中的服务端填写路径生成答卷人链接。`wjx survey preview-url --vid <vid>` 只为旧脚本保留兼容 fallback，输出是未经过服务端 `sid`/路径验证的推导地址，不能作为已确认的公开填写链接；编辑链接仍使用 `wjx survey url --mode edit --activity <vid>`。

## Windows 提示

PowerShell、macOS 和 Linux 都支持 CLI。跨平台脚本使用 `wjx ...` 命令和 `--file`，不要复制只适用于 Bash 的 `export`、`$(...)` 或 `for ...; do` 片段。
