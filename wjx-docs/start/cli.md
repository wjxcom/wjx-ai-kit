# CLI 快速开始

本页只完成一条可验证路径：安装、配置凭据、列出问卷。

## 前置条件

- Node.js 20 或更高版本
- 问卷星 OpenAPI API Key。请在问卷星后台获取，不要把 Key 提交到代码仓库或公共对话。

如果尚未安装 Node.js：Windows/macOS 可从 [Node.js 官方下载页](https://nodejs.org/) 安装 LTS 版本；macOS 也可使用 `brew install node@20`，Ubuntu/Debian 可按 NodeSource 的 Node 20 安装说明配置。安装后重新打开终端并运行 `node --version`，确认版本为 20 或更高。

## 安装与配置

当前工作树版本为 `0.4.1`，尚未发布到 npm；registry 的 `latest` 仍是 `0.3.5`，不能用它运行本页的新命令。发布前请从源码构建：

```bash
node --version
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-cli
npm link ./wjx-cli
wjx init --api-key "你的 API Key"
```

`0.4.1` 正式发布后，安装方式改为 `npm install -g wjx-cli`，再继续执行下面的配置命令。

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

创建请求会携带当前 CLI 名称和版本。若服务端要求升级，CLI 会返回结构化 `UPGRADE_REQUIRED` 错误，并在 `error.hint` 中给出最低版本和升级命令；低于 `0.4.1` 的旧 CLI 需要先更新后再创建。

## Windows 提示

PowerShell、macOS 和 Linux 都支持 CLI。跨平台脚本使用 `wjx ...` 命令和 `--file`，不要复制只适用于 Bash 的 `export`、`$(...)` 或 `for ...; do` 片段。
