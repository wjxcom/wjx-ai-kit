# wjx-cli 快速开始

> 一行命令安装，一行命令配置。

---

## 安装

前提：已安装 [Node.js 20+](install-nodejs.md)。

```bash
npm install -g wjx-cli
```

验证：

```bash
wjx --version
```

看到版本号就说明装好了。

---

## 配置

```bash
wjx init
```

按提示输入 API Key、Base URL、Corp ID，配置保存到 `~/.wjxrc`。

```
问卷星 CLI 配置向导
配置文件: ~/.wjxrc

* WJX_API_KEY: sk-wjx-xxxxxxxx
  WJX_BASE_URL [https://www.wjx.cn]:
  WJX_CORP_ID:

验证 API Key... OK

已保存到 ~/.wjxrc
提示: 也可以直接编辑该文件修改配置。
```

- `*` 标记必填项，无星号为可选
- 方括号内为当前值，直接回车保留
- 已配置过的项会脱敏显示当前值

### 获取 API Key

1. 登录 [问卷星](https://www.wjx.cn)
2. 进入 **账号设置 > API 自动登录**
3. 复制 API Key（一串字母数字组成的密钥）

> 没有找到？联系问卷星客服或客户经理开通 OpenAPI 权限。

### 其他配置方式

除了 `wjx init`，还可以通过环境变量或命令行参数配置：

```bash
# 环境变量
export WJX_API_KEY=你的ApiKey

# 命令行参数（单次使用）
wjx --api-key 你的ApiKey survey list

# 直接编辑配置文件
vi ~/.wjxrc
```

凭据解析优先级：`--api-key` 参数 > 环境变量 > `~/.wjxrc` 配置文件。

---

## 运行第一个命令

```bash
# 环境诊断
wjx doctor

# 查看问卷列表
wjx survey list

# 表格格式（人类友好）
wjx --table survey list
```

---

## 常用示例

```bash
# 查看帮助
wjx --help
wjx survey --help

# 问卷操作
wjx survey list                          # 列出所有问卷
wjx survey list --name_like "满意度"      # 按名称搜索
wjx survey get --vid 12345               # 查看问卷详情
wjx survey create --title "我的问卷"      # 创建新问卷
wjx survey export-text --vid 12345 --raw # 导出为纯文本

# 答卷操作
wjx response count --vid 12345           # 答卷总数
wjx response query --vid 12345           # 查询答卷
wjx response report --vid 12345          # 统计报告

# 本地分析（不需要 API Key）
wjx analytics nps --scores "[9,10,7,3,8,10,9,6,8,10]"
wjx analytics csat --scores "[4,5,3,5,2,4,5]"

# 管道和导出
wjx survey list | jq '.data.activitys'
wjx survey list > my-surveys.json
```

---

## 遇到问题？

| 报错 | 解决 |
|------|------|
| `command not found: wjx` | 重新运行 `npm install -g wjx-cli` |
| `WJX_API_KEY 未设置` | 运行 `wjx init` 配置 |
| `Invalid integer: xxx` | `--vid` 后面只接纯数字 |
| API 返回错误 | 运行 `wjx doctor` 查看诊断 |

---

## 下一步

- [README.md](../README.md) — 全部 56 个子命令参考
- [wjx-api-sdk](../../wjx-api-sdk/) — 在 Node.js 项目中调用 API
- [wjx-mcp-server](../../wjx-mcp-server/) — 接入 Claude / Cursor 等 AI 客户端
