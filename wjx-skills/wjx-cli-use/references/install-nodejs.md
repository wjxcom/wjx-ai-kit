# 安装 Node.js

> wjx-cli 需要 Node.js **20 或更高版本**。

## 先确认真实安装状态

“当前终端找不到命令”不等于 Node.js 没有安装。先在当前 shell 运行：

```bash
node --version
npm --version
```

Windows PowerShell 再运行：

```powershell
Get-Command node,npm -ErrorAction SilentlyContinue
where.exe node
where.exe npm
Test-Path "$env:ProgramFiles\nodejs\node.exe"
Test-Path "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
```

如果常见绝对路径存在但 `node` 不在 PATH，直接用该路径验证版本，然后刷新 PATH 或关闭并重新打开终端。PowerShell 可重新读取用户和机器 PATH：

```powershell
$env:Path = [Environment]::GetEnvironmentVariable("Path", "User") + ";" + [Environment]::GetEnvironmentVariable("Path", "Machine")
& "$env:ProgramFiles\nodejs\node.exe" --version
& "$env:ProgramFiles\nodejs\npm.cmd" --version
```

同时确认 npm 全局目录可见：

```bash
npm prefix -g
```

如果 `wjx` 已存在，也先运行 `wjx --version`；不要因为一个 shell 报错就重复安装 Node.js 或 CLI。

## 版本判断

看到 `v20.x` 或更高即可。版本低于 20 时停止 wjx-cli 流程并升级；Node.js 不存在时安装 LTS。安装器启动成功不代表安装完成，安装后必须在新进程再次运行 `node --version` 和 `npm --version`。

## macOS

```bash
# 方式 1：使用 Homebrew（推荐）
brew install node@20

# 方式 2：使用 nvm（Node 版本管理器）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc    # 或 source ~/.zshrc
nvm install 20
```

## Windows

访问 https://nodejs.org/，下载 LTS 版本并完成安装。除非用户明确授权，不要在无法确认安装状态时自动运行 winget、安装器或后台安装进程。安装完成后关闭并重新打开终端，按上面的 PowerShell 检查命令确认 Node.js 和 npm 均可执行。

## Linux (Ubuntu/Debian)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

安装后重新打开 shell，再验证 Node.js 版本和 npm 全局目录。确认 Node.js >= 20 且 npm 可用后，才继续安装或升级 wjx-cli。
