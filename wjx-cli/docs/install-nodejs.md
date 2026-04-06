# 安装 Node.js

> wjx-cli 需要 Node.js **20 或更高版本**。

---

## 检查是否已安装

打开终端（macOS: Terminal / Windows: PowerShell / Linux: 任意终端），输入：

```bash
node --version
```

**看到类似这样的输出，说明已安装：**

```
v20.11.0
```

> 版本号 >= 20 就行。如果显示 `v18.x` 或更低，需要升级。

**如果提示 "command not found" 或 "不是内部命令"，按下面的方式安装。**

---

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

访问 https://nodejs.org/ ，下载 LTS 版本，双击安装，一路"下一步"即可。

安装完成后**关闭并重新打开终端**，再次运行 `node --version` 确认。

## Linux (Ubuntu/Debian)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

安装完成后，回到 [快速开始教程](getting-started.md) 继续。
