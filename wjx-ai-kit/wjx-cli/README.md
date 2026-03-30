# wjx-cli

> 问卷星命令行工具 — AI Agent 原生 CLI，支持 stdin pipe 和 JSON/表格输出。

[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-green)](https://nodejs.org/)

---

## 特性

- **AI Agent 友好** — JSON 输出默认，适合被 AI Agent 调用和解析
- **stdin pipe** — 支持 `echo '{"vid":123}' | wjx --stdin survey get`，参数通过管道传入
- **表格输出** — `--table` 切换为人类可读格式
- **11 大命令组** — survey、response、contacts、department、admin、tag、user-system、account、sso、analytics + 诊断工具
- **基于 wjx-api-sdk** — 直接调用 SDK，保证与 API 行为一致

---

## 安装

作为 `wjx-ai-kit` monorepo 的一部分：

```bash
cd wjxagents/wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-cli
```

### 全局安装（可选）

```bash
npm link --workspace=wjx-cli
wjx --help
```

---

## 认证

设置环境变量或使用 `--token` 参数：

```bash
# 环境变量（推荐）
export WJX_TOKEN=your_token

# 或通过参数
wjx --token your_token survey list
```

---

## 全局选项

| 选项 | 说明 |
|------|------|
| `--token <token>` | WJX API Token（或设置 `WJX_TOKEN`） |
| `--json` | JSON 输出（默认） |
| `--table` | 表格输出 |
| `--verbose` | 详细输出 |
| `--stdin` | 从 stdin 读取 JSON 参数 |
| `--version` | 显示版本号 |
| `--help` | 显示帮助信息 |

---

## 命令参考

### survey — 问卷管理

```bash
wjx survey list                          # 列出问卷
wjx survey list --page 1 --page_size 20  # 分页
wjx survey list --name_like "满意度"       # 搜索
wjx survey get --vid 12345               # 获取详情
wjx survey create --title "新问卷"         # 创建
wjx survey status --vid 12345 --state 1  # 发布（1=发布, 2=暂停, 3=删除）
wjx survey settings --vid 12345          # 获取设置
wjx survey update-settings --vid 12345 --api_setting '{"json":true}'
wjx survey delete --vid 12345 --username user1
wjx survey tags --username user1         # 题目标签
wjx survey tag-details --tag_id 100      # 标签详情
wjx survey clear-bin --username user1    # 清空回收站
wjx survey upload --file_name a.png --file "base64..."
wjx survey export-text --vid 12345       # 导出为纯文本
wjx survey export-text --vid 12345 --raw # 纯文本（不包裹 JSON）
wjx survey url --mode create --name "新问卷"  # 生成创建 URL
wjx survey url --mode edit --activity 12345   # 生成编辑 URL
```

### response — 答卷管理

```bash
wjx response count --vid 12345              # 获取答卷总数
wjx response query --vid 12345              # 查询答卷
wjx response realtime --vid 12345           # 实时查询最新答卷
wjx response download --vid 12345           # 下载答卷
wjx response submit --vid 12345 --inputcosttime 60 --submitdata "1$2"
wjx response modify --vid 12345 --jid 1 --answers "..."
wjx response clear --vid 12345 --username user1
wjx response report --vid 12345             # 统计报告
wjx response files --vid 12345 --file_keys "key1,key2"
wjx response winners --vid 12345            # 中奖名单
wjx response 360-report --vid 12345         # 360度报告
```

### contacts — 通讯录管理

```bash
wjx contacts query --uid user1              # 查询联系人
wjx contacts add --users '[{"name":"张三"}]' # 添加联系人
wjx contacts delete --uids "uid1,uid2"      # 删除联系人
```

### department — 部门管理

```bash
wjx department list                          # 列出部门
wjx department add --depts '[{"name":"研发"}]'
wjx department modify --depts '[{"id":1,"name":"技术"}]'
wjx department delete --depts '[{"id":1}]' --type 1
```

### admin — 管理员

```bash
wjx admin add --users '[{"uid":"u1","role":1}]'
wjx admin delete --uids "uid1,uid2"
wjx admin restore --uids "uid1"
```

### tag — 标签管理

```bash
wjx tag list                                 # 列出标签
wjx tag add --child_names '["VIP","普通"]'
wjx tag modify --tp_id 1 --child_names '["新VIP"]'
wjx tag delete --tags '[{"id":1}]' --type 1
```

### user-system — 用户体系

```bash
wjx user-system add-participants --username u1 --sysid 1 --participants '[...]'
wjx user-system modify-participants --username u1 --sysid 1 --participants '[...]'
wjx user-system delete-participants --username u1 --sysid 1 --uids "a,b"
wjx user-system bind --username u1 --sysid 1 --uids "a" --vid 12345
wjx user-system query-binding --username u1 --sysid 1
wjx user-system query-surveys --username u1 --sysid 1 --uid "a"
```

### account — 子账号管理

```bash
wjx account list                             # 查询子账号
wjx account add --subuser test1 --password pass123
wjx account modify --subuser test1 --email new@test.com
wjx account delete --subuser test1
wjx account restore --subuser test1
```

### sso — 单点登录

```bash
wjx sso subaccount-url --subuser test1       # 子账号SSO链接
wjx sso user-system-url --u admin --system_id 1 --uid user1
wjx sso partner-url --username partner1      # 代理商SSO链接
```

### analytics — 数据分析

```bash
wjx analytics decode --submitdata "1$2}2$hello"   # 解码答卷
wjx analytics nps --scores "[9,10,7,3,8]"          # NPS分数
wjx analytics csat --scores "[4,5,3,5,2]"          # CSAT分数
wjx analytics anomalies --responses '[...]'        # 异常检测
wjx analytics compare --set_a '{"score":80}' --set_b '{"score":90}'
wjx analytics decode-push --payload "..." --app_key "key"
```

### 诊断工具

```bash
wjx whoami                               # 验证 Token 并显示账号信息
wjx doctor                               # 环境诊断（Token、网络、SDK 版本）
```

---

## stdin pipe

通过 `--stdin` 从管道读取 JSON 参数，CLI 选项会覆盖 stdin 中的同名字段：

```bash
# 基本用法
echo '{"vid": 12345}' | wjx --stdin survey get

# 多字段
echo '{"page": 1, "page_size": 20}' | wjx --stdin survey list

# stdin + CLI 参数混合（CLI 优先）
echo '{"vid": 12345, "state": 1}' | wjx --stdin survey status --state 2
# state 使用 CLI 的值 2，vid 使用 stdin 的值 12345

# 配合 jq 使用
wjx survey list | jq '.data[0].vid' | xargs -I{} wjx survey get --vid {}
```

---

## 输出格式

### JSON（默认）

```bash
$ wjx survey list --page 1 --page_size 2
{
  "result": true,
  "data": [...],
  "total": 42
}
```

### 表格

```bash
$ wjx --table survey list --page 1 --page_size 2
vid     title              status
12345   客户满意度调查       1
12346   员工培训反馈         2
```

### 错误输出

错误以 JSON 格式输出到 stderr，进程以非零退出码退出：

```json
{"error": "API_ERROR", "message": "API request failed"}
```

---

## 环境变量

| 变量 | 必填 | 说明 |
|------|:----:|------|
| `WJX_TOKEN` | 是 | 问卷星 OpenAPI Bearer Token |
| `WJX_BASE_URL` | 否 | 自定义 API 基础域名（默认 `https://www.wjx.cn`） |

---

## 开发

```bash
cd wjx-ai-kit/wjx-cli

npm run build    # tsc 编译
npm test         # 运行测试
npm run clean    # 清理 dist/
```

---

## 许可证

[MIT](LICENSE)
