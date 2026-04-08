# 环境检查与准备

本 Skill 需要 **Node.js 18+** 环境。

## 快速开始（推荐）

一键自动检测并安装 Node.js 和依赖包：

```bash
./setup.sh -y    # 自动安装（无需确认）
./setup.sh       # 交互式安装
```

执行后会自动完成：
1. 检测 Node.js 18+ 是否已安装
2. 如未安装，自动安装 Node.js
3. 检测 npm 包管理器
4. 打印当前 npm registry（**不修改**全局源；镜像请自行 `npm config` 配置）
5. 安装所需的 npm 依赖包（**执行前**会输出安装与安全风险提示）
6. 验证安装结果

**说明**：`setup.sh` 成功结束时只汇报环境与依赖就绪，**不会**在终端引导登录或列举业务命令；登录与 Token 见 `references/auth.md`。清除登录态请按 `auth.md` 手动删除凭证文件（**无** `clear_auth.js`）。

**支持的系统：**
- macOS 10.15+ (通过 Homebrew)
- Ubuntu 18.04+ / Debian 9+
- CentOS 7+ / RHEL 7+ / Fedora 30+
- Arch Linux / Manjaro
- openSUSE
- Alpine Linux

### 脚本选项

```bash
./setup.sh -y    # 自动安装缺失的环境（无需确认，推荐）
./setup.sh       # 交互式安装（检测后询问是否安装）
./setup.sh -c    # 仅检查环境，不安装
./setup.sh -v    # 验证安装是否完整
./setup.sh -h    # 显示帮助
```

## 手动安装（备选）

如果一键脚本无法使用，或你想手动安装：

### 1. 安装 Node.js

**macOS (10.15+)：**
```bash
# Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node
```

**Linux：**

*Ubuntu/Debian：*
```bash
# 使用 NodeSource 安装最新版本
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

*CentOS/RHEL/Fedora：*
```bash
# 使用 NodeSource 安装最新版本
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
# Fedora/CentOS 8+/RHEL 8+
sudo dnf install -y nodejs
# CentOS 7/RHEL 7
sudo yum install -y nodejs
```

*Arch Linux：*
```bash
sudo pacman -S nodejs npm
```

*其他系统：*
- openSUSE: `sudo zypper install -y nodejs npm`
- Alpine: `apk add --no-cache nodejs npm`

**Windows (10/11)：**
```powershell
winget install OpenJS.NodeJS
```

### 2. 安装依赖

```bash
npm install
```

（`npm` 源由本机全局配置决定；本 Skill 的 `setup.sh` **不会**执行 `npm config set registry`。）

### 3. 验证环境

```bash
./setup.sh -v
```

## 环境验证脚本

**注意：此脚本需要在 Node.js 安装后才能运行**，主要用于二次验证环境配置。

此脚本用于检测当前 Node.js 环境是否满足问卷网 Skill 的运行要求。

## 功能说明

该脚本会检查以下内容：

1. **Node.js 版本**：是否 >= 18
2. **依赖包**：是否安装了所需的第三方库（如 axios, open）

**不会检查**：问卷网账号登录状态、用户级凭证目录（默认 `~/.wenjuan` 或 `WENJUAN_TOKEN_DIR`）下的 `token.json` / `access_token` 或任何授权/Token。环境就绪与是否已登录无关；调用业务脚本前请按需完成登录（见 `references/auth.md`）。

## 使用方法

### 快速检查

```bash
node "${SKILL_DIR}/scripts/check_env.js"
```

### 输出示例

**环境正常：**

```
============================================================
🚀 问卷网 Skill 环境检查
============================================================
（仅 Node.js 与依赖包；不检查登录/授权）

============================================================
🔍 检查 Node.js 版本
============================================================
当前 Node.js 版本: v20.10.0
最低要求版本: 18.0.0+
✅ Node.js 版本符合要求

============================================================
🔍 检查依赖包
============================================================
  ✅ axios           1.6.2      (>= 1.6.0)
  ✅ open            10.0.0     (>= 10.0.0)

============================================================
✅ 环境检查通过（运行环境就绪；使用 API 前请自行完成登录）。
============================================================
```

**环境异常：**

```
============================================================
🚀 问卷网 Skill 环境检查
============================================================
（仅 Node.js 与依赖包；不检查登录/授权）

============================================================
🔍 检查 Node.js 版本
============================================================
当前 Node.js 版本: v16.20.0
最低要求版本: 18.0.0+
❌ Node.js 版本过低，请升级到 18 或更高版本

============================================================
🔍 检查依赖包
============================================================
  ❌ axios           未安装 (需要 >= 1.6.0)
  ❌ open            未安装 (需要 >= 10.0.0)

============================================================
❌ 环境检查未通过
============================================================

📦 安装指南
============================================================

【安装 Node.js】

macOS:
  brew install node

Ubuntu/Debian:
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs

CentOS/RHEL/Fedora:
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
  sudo yum install -y nodejs

Windows:
  winget install OpenJS.NodeJS

【安装依赖包】

  npm install
```

## 环境要求

| 项目 | 要求 | 说明 |
|------|------|------|
| Node.js | >= 18 | 推荐使用 Node.js 20+ |
| axios | >= 1.6.0 | HTTP 请求库 |
| open | >= 10.0.0 | 浏览器打开工具 |

## 常见问题

### Node.js 已安装但提示未找到

某些系统可能将 Node.js 安装为 `node` 而不是 `nodejs`，尝试：

```bash
node --version
```

如果显示版本号，说明 Node.js 已正确安装。

### npm 未找到

如果 Node.js 已安装但 npm 未安装：

```bash
# macOS
brew install node

# Ubuntu/Debian
sudo apt install -y npm

# CentOS/RHEL
sudo yum install -y npm

# 或使用 NodeSource 安装（推荐，会同时安装 npm）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 权限不足

如果安装依赖时提示权限不足：

```bash
# 方式一：使用 --prefix 参数指定本地目录
npm install --prefix ./node_modules

# 方式二：使用 nvm 管理 Node.js 版本（推荐）
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
# 安装 Node.js
nvm install 20
nvm use 20
```

## 建议

1. **首次使用前先运行环境检查**，确保环境就绪
2. **遇到问题优先查看安装指南**，按照对应系统的命令安装
3. **使用 nvm 管理 Node.js 版本**可以避免权限问题
