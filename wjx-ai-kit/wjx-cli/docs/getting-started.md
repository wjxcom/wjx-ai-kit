# wjx-cli 安装与快速开始

> 从零开始，5 分钟跑通第一个命令。
>
> 本教程假设你没有任何 Node.js 或命令行经验。每一步都会告诉你预期看到什么。

---

## 目录

- [这是什么](#这是什么)
- [第 1 步：安装 Node.js](#第-1-步安装-nodejs)
- [第 2 步：下载项目代码](#第-2-步下载项目代码)
- [第 3 步：安装依赖](#第-3-步安装依赖)
- [第 4 步：编译项目](#第-4-步编译项目)
- [第 5 步：获取问卷星 API Token](#第-5-步获取问卷星-api-token)
- [第 6 步：运行第一个命令](#第-6-步运行第一个命令)
- [第 7 步：设为全局命令（可选）](#第-7-步设为全局命令可选)
- [常用操作示例](#常用操作示例)
- [遇到问题？](#遇到问题)

---

## 这是什么

wjx-cli 是一个**命令行工具**，让你在终端里直接操作[问卷星](https://www.wjx.cn)：

- 查看你的问卷列表
- 创建新问卷
- 查询答卷数据
- 计算 NPS/CSAT 分数
- ...共 56 个功能

不需要打开浏览器，不需要写代码，一行命令搞定。

---

## 第 1 步：安装 Node.js

wjx-cli 需要 Node.js 20 或更高版本。

### 检查是否已安装

打开终端（macOS: Terminal / Windows: PowerShell / Linux: 任意终端），输入：

```bash
node --version
```

**如果看到类似这样的输出，说明已安装：**

```
v20.11.0
```

> 版本号 >= 20 就行。如果显示 `v18.x` 或更低，需要升级。

**如果提示 "command not found" 或 "不是内部命令"，需要安装：**

### macOS

```bash
# 方式 1：使用 Homebrew（推荐）
brew install node@20

# 方式 2：使用 nvm（Node 版本管理器）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc    # 或 source ~/.zshrc
nvm install 20
```

### Windows

访问 https://nodejs.org/ ，下载 LTS 版本，双击安装，一路"下一步"即可。

安装完成后**关闭并重新打开终端**，再次运行 `node --version` 确认。

### Linux (Ubuntu/Debian)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## 第 2 步：下载项目代码

### 方式 A：用 Git 克隆（推荐）

```bash
git clone <your-repo-url>
cd wjx-ai-kit
```

**预期输出：**

```
Cloning into 'wjx-ai-kit'...
remote: Enumerating objects: ...
...
Receiving objects: 100% ...
```

> 如果没有安装 Git，访问 https://git-scm.com/ 下载安装。

### 方式 B：直接下载 ZIP

在仓库页面点击 "Download ZIP"，解压后进入目录：

```bash
cd wjx-ai-kit    # 进入解压后的目录
```

---

## 第 3 步：安装依赖

在 `wjx-ai-kit` 目录下执行：

```bash
npm install
```

**预期输出（等待约 10-30 秒）：**

```
added 42 packages in 8s
```

> 数字可能略有不同，看到 `added XX packages` 就是成功了。

### 常见问题

**报错 `npm ERR! code EACCES`（权限不足）：**

```bash
# macOS / Linux：
sudo npm install

# 或者更好的方式，修复 npm 权限：
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install
```

**报错 `npm WARN deprecated`：**

这是依赖包的警告，不影响使用，可以忽略。

---

## 第 4 步：编译项目

wjx-cli 是用 TypeScript 写的，需要先编译成 JavaScript：

```bash
# 先编译 SDK（wjx-cli 依赖它）
npm run build --workspace=wjx-api-sdk

# 再编译 CLI
npm run build --workspace=wjx-cli
```

**预期输出：** 没有任何输出就是成功。如果有红色错误信息，检查 Node.js 版本是否 >= 20。

### 验证编译成功

```bash
node wjx-cli/dist/index.js --version
```

**预期输出：**

```
0.1.0
```

看到版本号就说明编译成功了。

---

## 第 5 步：获取问卷星 API Token

大多数命令需要问卷星 API Token 才能工作。Token 就是你的"通行证"，告诉问卷星"我是谁"。

### 如何获取

1. 登录 [问卷星](https://www.wjx.cn)
2. 进入 **账号设置 > API 自动登录**
3. 获取你的 Token（一串字母数字组成的密钥）

> 没有找到？联系问卷星客服或你的客户经理开通 OpenAPI 权限。

### 配置 Token

**方式 1：设置环境变量（推荐，设置一次后续所有命令自动使用）**

```bash
# macOS / Linux
export WJX_TOKEN=你的Token粘贴在这里

# Windows PowerShell
$env:WJX_TOKEN="你的Token粘贴在这里"
```

> 注意：`export` 只在当前终端窗口有效。关闭终端后需要重新设置。
> 要永久生效，把这行加到 `~/.bashrc` 或 `~/.zshrc` 文件末尾。

**方式 2：每次命令都带上 Token**

```bash
node wjx-cli/dist/index.js --token 你的Token survey list
```

**方式 3：写入 .env 文件**

在 `wjx-ai-kit` 目录下创建 `.env` 文件：

```bash
echo "WJX_TOKEN=你的Token粘贴在这里" > .env
```

---

## 第 6 步：运行第一个命令

### 6.1 环境诊断

先跑诊断命令，确认环境配置正确：

```bash
node wjx-cli/dist/index.js doctor
```

**预期输出（一切正常时）：**

```json
{
  "node_version": "v20.11.0",
  "token_set": true,
  "api_reachable": true,
  "sdk_version": "0.1.0"
}
```

> 如果 `token_set` 是 `false`，说明 Token 没配置好，回到第 5 步。
> 如果 `api_reachable` 是 `false`，说明网络连不上问卷星，检查网络。

### 6.2 查看问卷列表

```bash
node wjx-cli/dist/index.js survey list
```

**预期输出：**

```json
{
  "result": true,
  "data": {
    "total": 5,
    "activitys": {
      "12345": {
        "vid": 12345,
        "title": "客户满意度调查",
        "status": 1
      }
    }
  }
}
```

> 你会看到自己账号下的问卷列表。如果没有问卷，`activitys` 会是空的。

### 6.3 用表格格式查看（人类友好）

```bash
node wjx-cli/dist/index.js --table survey list
```

**预期输出：**

```
┌─────────┬───────┬────────────────┬────────┐
│ (index) │  vid  │     title      │ status │
├─────────┼───────┼────────────────┼────────┤
│    0    │ 12345 │ '客户满意度调查' │   1    │
└─────────┴───────┴────────────────┴────────┘
```

---

## 第 7 步：设为全局命令（可选）

每次都打 `node wjx-cli/dist/index.js` 太长了。可以设为全局命令：

```bash
npm link --workspace=wjx-cli
```

之后就可以直接用 `wjx` 命令：

```bash
# 之前
node wjx-cli/dist/index.js survey list

# 之后
wjx survey list
```

> 后续示例都使用 `wjx` 短命令。如果你没有做全局链接，把 `wjx` 替换成 `node wjx-cli/dist/index.js` 即可。

---

## 常用操作示例

### 查看帮助

```bash
# 查看所有命令
wjx --help

# 查看某个命令组的帮助
wjx survey --help

# 查看某个具体子命令的帮助
wjx survey create --help
```

### 问卷操作

```bash
# 列出所有问卷
wjx survey list

# 只看前 5 个
wjx survey list --page_size 5

# 按名称搜索
wjx survey list --name_like "满意度"

# 查看某个问卷的详情（把 12345 换成你的问卷 ID）
wjx survey get --vid 12345

# 创建一个新问卷
wjx survey create --title "我的第一个问卷"

# 将问卷导出为纯文本（方便阅读题目内容）
wjx survey export-text --vid 12345 --raw
```

### 答卷操作

```bash
# 查看某问卷的答卷总数
wjx response count --vid 12345

# 查询答卷数据
wjx response query --vid 12345

# 获取统计报告
wjx response report --vid 12345
```

### 本地数据分析（不需要 Token）

```bash
# 计算 NPS 分数
wjx analytics nps --scores "[9,10,7,3,8,10,9,6,8,10]"

# 计算客户满意度（CSAT）
wjx analytics csat --scores "[4,5,3,5,2,4,5]"

# 解码答卷提交数据
wjx analytics decode --submitdata "1$2}2$hello"
```

**NPS 输出示例：**

```json
{
  "total": 10,
  "promoters": 5,
  "passives": 3,
  "detractors": 2,
  "nps": 30,
  "rating": "Good"
}
```

### 生成 SSO 登录链接（不需要 Token）

```bash
# 生成子账号单点登录链接
wjx sso subaccount-url --subuser testuser
```

### 配合其他工具使用

```bash
# 用 jq 格式化输出（需要安装 jq）
wjx survey list | jq '.data.activitys'

# 导出问卷列表到文件
wjx survey list > my-surveys.json

# 用管道传参数
echo '{"vid": 12345}' | wjx --stdin survey get
```

---

## 遇到问题？

### "command not found: wjx"

你还没做全局链接。用完整路径运行：

```bash
node wjx-cli/dist/index.js survey list
```

或者做全局链接：

```bash
npm link --workspace=wjx-cli
```

### "WJX_TOKEN 未设置"

Token 没配好。设置环境变量：

```bash
export WJX_TOKEN=你的Token
```

### "Invalid integer: xxx"

整数参数只接受纯数字。比如 `--vid` 后面必须跟纯数字：

```bash
# 错误
wjx survey get --vid abc

# 正确
wjx survey get --vid 12345
```

### "Cannot find module" 编译错误

可能没有编译，或者编译顺序不对。重新编译：

```bash
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-cli
```

### API 返回错误

运行诊断命令查看详细信息：

```bash
wjx doctor
```

如需切换到测试环境：

```bash
export WJX_BASE_URL=https://your-test-server.com
```

### 更多帮助

- 完整命令参考：[README.md](../README.md)
- 错误码说明：[README.md 错误协议](../README.md#错误协议)
- 提交 Issue 反馈问题

---

## 下一步

- 阅读 [README.md](../README.md) 了解全部 56 个子命令
- 查看 [wjx-api-sdk](../../wjx-api-sdk/) 在你自己的 Node.js 项目中调用 API
- 查看 [wjx-mcp-server](../../wjx-mcp-server/) 接入 Claude / Cursor 等 AI 客户端
