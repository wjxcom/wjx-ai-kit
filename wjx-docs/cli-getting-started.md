# CLI 入门指南：命令行操作问卷星

> 安装 → 配置 → 第一个问卷，5 分钟上手
>
> **CLI 是 wjx-ai-kit 的主入口**：任何能执行 shell 命令的 AI 工具都能用（不依赖 MCP 协议），升级只需 `npm update -g`，一次配完所有会话共享。

---

## 🚀 最快开始：让 AI 帮你装好（推荐）

打开你常用的 AI（Claude Code / Cursor / Windsurf / Cline / Trae / Copilot / Claw / Manus / WorkBuddy / QoderWork 等任何能在终端里执行命令的工具），把下面这段话发给它：

````text
请帮我安装并配置问卷星 CLI（wjx-cli）：
1. 检查 node --version >= 20，过低引导我升级
2. 执行 `npm install -g wjx-cli`
3. 让我去 https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1 微信扫码取 API Key（私有化部署用户把 www.wjx.cn 换成自己域名）
4. 拿到 Key 后执行 `wjx init --api-key <我的Key>`（私有化用户加 --base-url <我的域名>）
5. 跑 `wjx doctor` 验证连接
6. 跑 `wjx survey list --table` 列出我的问卷确认
````

下面是手动安装步骤。

---

## 什么是 wjx-cli

wjx-cli 是问卷星的命令行工具，67 个子命令覆盖问卷星全部 API 能力。它有两个特点：

1. **AI Agent 原生**：默认输出 JSON，支持管道输入，结构化错误码。Claude Code、Cursor 等 AI 工具可以直接调用。
2. **人类也好用**：`--table` 格式化输出、Shell 补全、`--dry-run` 预览、交互式配置向导。

---

## 安装

```bash
npm install -g wjx-cli
```

验证安装：

```bash
wjx --version
# wjx-cli/0.3.0
```

需要 Node.js >= 20。如果版本不够，运行 `wjx doctor` 会提示。

---

## 配置

### 方式 1：交互式配置（推荐新用户）

```bash
wjx init
```

按提示输入：
- **API Key**（必填）：微信扫码登录 [API Key 获取页](https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1) 获取
- **Base URL**（可选）：默认 `https://www.wjx.cn`
- **Corp ID**（可选）：企业通讯录 ID

配置保存到 `~/.wjxrc`。最后会询问是否安装 Claude Code 技能包。

### 方式 2：参数模式（适合 AI Agent 和 CI）

```bash
wjx init --api-key 你的APIKey
wjx init --api-key 你的APIKey --base-url https://your.domain.com --corp-id org001
```

不弹交互，直接保存。`--no-install-skill` 跳过技能安装。

### 方式 3：环境变量

```bash
export WJX_API_KEY=你的APIKey
```

### 认证优先级

`--api-key` 参数 > 环境变量 `WJX_API_KEY` > 配置文件 `~/.wjxrc`

---

## 环境检查

```bash
wjx doctor
```

输出示例：

```
✓ Node.js v22.0.0 (>= 20 required)
✓ Config file: ~/.wjxrc
✓ API Key: sk-****...****
✓ API connectivity: OK (12 surveys found)
✓ SDK version: wjx-api-sdk@0.3.0
```

---

## 第一个问卷

### 用 DSL 文本创建

```bash
wjx survey create-by-text --text "
客户满意度调查

1. 您愿意向朋友推荐我们吗？[量表题]
0~10

2. 您对以下方面的满意程度 [矩阵量表题]
行：
- 产品质量
- 服务态度
- 响应速度
列：
- 非常不满意
- 不满意
- 一般
- 满意
- 非常满意

3. 您有什么建议？[填空题]
"
```

也可以从文件创建：

```bash
wjx survey create-by-text --file survey.txt --publish
```

`--publish` 会在创建后自动发布问卷。

### 查看结果

```bash
# 列出问卷
wjx survey list

# 表格格式，人类友好
wjx --table survey list

# 获取问卷详情
wjx survey get --vid 12345

# 导出为纯文本
wjx survey export-text --vid 12345
```

---

## 常用命令速查

### 问卷生命周期

```bash
# 创建（唯一推荐：JSONL，覆盖 70+ 题型）
wjx survey create-by-json --file survey.jsonl --publish
# 已弃用命令（仅兼容保留）
# wjx survey create-by-text --text "..." --publish
# wjx survey create --title "新问卷" --questions '[...]'

# 查看
wjx survey list --name_like "满意度"
wjx survey get --vid 12345
wjx survey settings --vid 12345

# 管理
wjx survey status --vid 12345 --state 1    # 发布
wjx survey status --vid 12345 --state 2    # 暂停
wjx survey delete --vid 12345              # 删除

# 链接
wjx survey url --mode edit --activity 12345    # 编辑链接
```

### 答卷操作

```bash
# 统计
wjx response count --vid 12345
wjx response report --vid 12345

# 查询
wjx response query --vid 12345 --page_size 50
wjx response query --vid 12345 --start_date 2026-04-01

# 下载
wjx response download --vid 12345

# 代填提交
wjx response submit --vid 12345 --inputcosttime 60 --submitdata "1\$9"
```

### 本地分析（不需要 API Key）

```bash
# NPS 计算
wjx analytics nps --scores "[9,10,7,3,8,10,9]"

# CSAT 计算
wjx analytics csat --scores "[4,5,3,5,2]"
wjx analytics csat --scores "[5,6,7,4,5]" --scale 7-point

# 解码答卷数据
wjx analytics decode --submitdata "1\$2}2\$hello world"

# 异常检测
wjx analytics anomalies --responses '[{"duration":5,"answers":"1,1,1,1"},{"duration":120,"answers":"3,2,4,1"}]'
```

### 通讯录和账号

```bash
# 通讯录
wjx contacts query --uid user001
wjx contacts add --data '[{"name":"张三","mobile":"13800138000"}]'

# 部门
wjx department list
wjx department add --data '[{"dpath":"研发部/后端组"}]'

# 子账号
wjx account list
wjx account add --username test1 --password Pass123 --role 2

# SSO（不需要 API Key）
wjx sso subaccount-url --subuser test1
```

---

## 全局选项

每个命令都支持以下选项：

| 选项 | 说明 |
|------|------|
| `--api-key <key>` | 临时指定 API Key |
| `--table` | 表格格式输出（默认 JSON） |
| `--dry-run` | 预览请求但不发送 |
| `--stdin` | 从管道读取 JSON 参数 |
| `--json` | 强制 JSON 输出 |
| `--version` | 显示版本号 |
| `--help` | 显示帮助 |

### Dry-Run 示例

```bash
wjx survey list --dry-run
```

输出：
```
[DRY-RUN] POST https://www.wjx.cn/openapi/survey/list
Headers: { authorization: "Bearer sk-****" }
Body: { "page_index": 1, "page_size": 10 }
```

看到完整请求但不实际发送，适合调试和学习 API。

---

## Shell 补全

### 一键安装

```bash
wjx completion install
```

自动检测你的 shell（bash/zsh/fish），写入对应配置文件。重新打开终端后，输入 `wjx` 按 Tab 即可补全命令和选项。

### 手动安装

```bash
# Bash
wjx completion bash >> ~/.bashrc

# Zsh
wjx completion zsh >> ~/.zshrc

# Fish
wjx completion fish > ~/.config/fish/completions/wjx.fish
```

---

## AI Agent 集成

### Claude Code 技能安装

```bash
wjx skill install
```

> 也可从 [Vercel Agent Skills](https://skills.sh/wjxcom/wjx-ai-kit) 安装：`npx skills add wjxcom/wjx-ai-kit`，或在 [ClawHub](https://clawhub.ai/skills?q=wjx) 市场搜索 "wjx" 安装。

安装后，Claude Code 会获得一个 `wjx-cli-expert` Agent，能够：
- 理解你的自然语言需求
- 自动选择正确的 wjx 命令
- 执行命令并解读结果
- 处理错误和重试

### 在 AI Agent 中使用

wjx-cli 的设计让 AI Agent 可以直接解析输出：

```python
import subprocess, json

result = subprocess.run(
    ["wjx", "survey", "list"],
    capture_output=True, text=True
)

if result.returncode == 0:
    data = json.loads(result.stdout)
    surveys = data["data"]["activitys"]
else:
    error = json.loads(result.stderr)
    print(f"错误: {error['message']}")
```

退出码约定：
- `0` — 成功
- `1` — API/认证错误
- `2` — 输入参数错误

---

## 内置参考文档

不用翻网页，直接查看参考资料：

```bash
wjx reference dsl              # DSL 文本格式语法
wjx reference question-types   # 题型编码表
wjx reference survey           # 问卷命令参考
wjx reference response         # 答卷命令参考
wjx reference analytics        # 分析命令参考
```

---

## 自我更新

```bash
wjx update
```

检查 npm 上的最新版本，有更新则自动安装。更新后会询问是否同步更新技能包。

---

## 常见问题

**Q: 命令报 "API Key is required"**

运行 `wjx doctor` 检查配置。确保已执行 `wjx init` 或设置了 `WJX_API_KEY` 环境变量。

**Q: 创建问卷时 DSL 格式报错**

用 `wjx reference dsl` 查看语法参考。常见问题：
- 量表题用 `1~10`（波浪号），不是 `1-10`
- 矩阵题的行和列需要 `行：` 和 `列：` 前缀
- 多项填空题的标题中需要包含 `{_}` 占位符

**Q: 如何批量操作**

用管道和 jq 组合：

```bash
# 列出所有问卷的 vid
wjx survey list --page_size 100 | jq -r '.data.activitys | to_entries[].value.vid'

# 批量暂停
for vid in $(wjx survey list | jq -r '.data.activitys | to_entries[].value.vid'); do
  wjx survey status --vid $vid --state 2
done
```

---

## 下一步

- [CLI 进阶指南](./cli-advanced.md) — 管道组合、自动化脚本、技能系统深度用法
- [MCP 入门指南](./mcp-getting-started.md) — 用 AI 对话操作问卷星
- [SDK 入门指南](./sdk-getting-started.md) — TypeScript 编程接入
- [总纲](./00-overview.md) — 全景概览
