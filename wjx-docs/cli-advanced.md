# CLI 进阶指南：67 个命令完全攻略

> 管道组合、自动化脚本、DSL 高级用法、AI Skill 系统

---

## DSL 高级用法

### 完整题型示例

```
企业年度员工满意度调查
本问卷匿名填写，调查结果仅用于管理改进
===

1. 您所在的部门 [下拉框]
技术部
产品部
市场部
运营部
人力资源部
财务部

2. 您的工作年限 [单选题]
1 年以下
1-3 年
3-5 年
5-10 年
10 年以上

3. 整体工作满意度 [量表题]
1~10

4. 请评价以下方面 [矩阵量表题]
行：
- 工作环境
- 团队协作
- 职业发展机会
- 薪酬福利
- 工作生活平衡
- 直属上级管理
列：
- 非常不满意
- 不满意
- 一般
- 满意
- 非常满意

5. 你认为公司最需要改进的方面 [多选题]
沟通机制
培训发展
办公环境
薪酬体系
晋升通道
企业文化

6. 以下因素对你留任的影响程度 [比重题]
薪酬福利
职业发展
工作氛围
公司前景

7. 请为公司提供具体建议 [填空题]
```

保存为 `satisfaction.txt`，创建并发布：

```bash
wjx survey create-by-text --file satisfaction.txt --publish
```

### 考试问卷

```bash
wjx survey create-by-text --file exam.txt --type 6 --publish
```

`--type 6` 指定为考试类型。考试题使用和普通题相同的 DSL 标签，区别在问卷级别。

### 从已有问卷导出再编辑

```bash
# 导出为 DSL 文本
wjx survey export-text --vid 12345 --raw > my-survey.txt

# 编辑 my-survey.txt（修改题目、新增选项等）

# 用修改后的文本创建新问卷
wjx survey create-by-text --file my-survey.txt
```

这是一个强大的"复制-修改"工作流，适合基于模板批量创建变体问卷。

---

## 管道和组合技

### stdin 管道输入

`--stdin` 从管道读取 JSON 参数，CLI 显式参数优先级更高：

```bash
# 基本用法
echo '{"vid": 12345}' | wjx --stdin survey get

# 参数覆盖：--page_size 覆盖 stdin 中的同名字段
echo '{"vid": 12345, "page_size": 10}' | wjx --stdin response query --page_size 50
```

### jq 组合

```bash
# 获取第一个问卷的 vid
VID=$(wjx survey list | jq -r '.data.activitys | to_entries[0].value.vid')

# 查看该问卷的答卷数
wjx response count --vid $VID | jq '.data.total'

# 获取所有答卷的 submitdata
wjx response query --vid $VID --page_size 100 \
  | jq -r '.data.list[].submitdata'

# 提取所有问卷名和 ID 为 CSV
wjx survey list --page_size 100 \
  | jq -r '.data.activitys | to_entries[] | [.value.vid, .value.aname] | @csv'
```

### 批量操作脚本

```bash
#!/bin/bash
# 暂停所有收集中的问卷

wjx survey list --page_size 100 --status 1 \
  | jq -r '.data.activitys | to_entries[].value.vid' \
  | while read vid; do
      echo "暂停问卷 $vid..."
      wjx survey status --vid "$vid" --state 2
    done
```

### A/B 测试批量创建

```bash
#!/bin/bash
# 从模板创建多个变体

for i in 1 2 3 4 5; do
  sed "s/{{variant}}/$i/g" template.txt \
    | wjx --stdin survey create-by-text --publish
  echo "变体 $i 创建完成"
done
```

---

## 67 个命令完整参考

### 问卷管理 (14)

| 命令 | 说明 | 关键参数 |
|------|------|----------|
| `survey list` | 列表查询 | `--name_like` `--status` `--atype` `--page_size` |
| `survey get` | 获取详情 | `--vid` |
| `survey create-by-json` | 唯一推荐：JSONL 创建，覆盖 70+ 题型 | `--jsonl` `--file` `--title` `--type` `--publish` |
| `survey create-by-text` | 已弃用：DSL 创建（仅兼容保留） | `--text` `--file` `--type` `--publish` |
| `survey create` | 已弃用：老 JSON 创建（仅兼容保留） | `--title` `--questions` `--source_vid` |
| `survey delete` | 删除 | `--vid` `--permanent` |
| `survey status` | 修改状态 | `--vid` `--state (1=发布/2=暂停/3=删除)` |
| `survey settings` | 获取设置 | `--vid` |
| `survey update-settings` | 修改设置 | `--vid` + 设置字段 |
| `survey tags` | 获取标签 | - |
| `survey tag-details` | 标签详情 | `--tag_id` |
| `survey clear-bin` | 清空回收站 | `--vid`（可选，不指定则清空全部） |
| `survey upload` | 上传文件 | `--base64` `--filename` |
| `survey export-text` | 导出文本 | `--vid` `--raw` |
| `survey url` | 生成 URL | `--mode (create/edit)` `--activity` |

### 答卷管理 (10)

| 命令 | 说明 | 关键参数 |
|------|------|----------|
| `response count` | 答卷计数 | `--vid` |
| `response query` | 分页查询 | `--vid` `--page_size` `--start_date` `--conditions` |
| `response realtime` | 实时查询 | `--vid` |
| `response download` | 批量下载 | `--vid` `--format (csv/sav/word)` |
| `response submit` | 代填提交 | `--vid` `--submitdata` `--inputcosttime` |
| `response modify` | 修改答卷 | `--vid` `--response_id` |
| `response clear` | 清空答卷 | `--vid`（不可逆） |
| `response report` | 统计报告 | `--vid` |
| `response winners` | 抽奖结果 | `--vid` |
| `response 360-report` | 360 报告 | `--vid` |

### 通讯录 (3)

| 命令 | 说明 | 关键参数 |
|------|------|----------|
| `contacts query` | 查询联系人 | `--uid` |
| `contacts add` | 添加联系人 | `--data '[{name, mobile, ...}]'` |
| `contacts delete` | 删除联系人 | `--uids '["uid1","uid2"]'` |

### 部门 (4)

| 命令 | 说明 | 关键参数 |
|------|------|----------|
| `department list` | 列出部门 | - |
| `department add` | 添加部门 | `--data '[{"dpath":"研发部/后端"}]'` |
| `department modify` | 修改部门 | `--data '[{...}]'` |
| `department delete` | 删除部门 | `--data '[{...}]'` `--include_children` |

### 管理员 (3)

| 命令 | 说明 | 关键参数 |
|------|------|----------|
| `admin add` | 添加管理员 | `--data '[{"uid":"...","role":1}]'` |
| `admin delete` | 删除管理员 | `--uids '["uid1"]'` |
| `admin restore` | 恢复管理员 | `--uids '["uid1"]'` |

### 标签 (4)

| 命令 | 说明 | 关键参数 |
|------|------|----------|
| `tag list` | 列出标签 | - |
| `tag add` | 添加标签 | `--group_name` `--data '["标签1"]'` |
| `tag modify` | 修改标签 | `--tag_group_id` |
| `tag delete` | 删除标签 | `--data '[{...}]'` |

### 用户体系 (6)

| 命令 | 说明 | 关键参数 |
|------|------|----------|
| `user-system add-participants` | 添加参与者 | `--system_id` `--data` |
| `user-system modify-participants` | 修改参与者 | `--system_id` `--data` |
| `user-system delete-participants` | 删除参与者 | `--system_id` `--uids` |
| `user-system bind` | 绑定问卷 | `--system_id` `--vid` |
| `user-system query-binding` | 查询绑定 | `--system_id` `--vid` |
| `user-system query-surveys` | 查询用户问卷 | `--system_id` `--uid` |

### 子账号 (5)

| 命令 | 说明 | 关键参数 |
|------|------|----------|
| `account list` | 列出子账号 | `--mobile` |
| `account add` | 添加子账号 | `--username` `--password` `--role` |
| `account modify` | 修改子账号 | `--username` + 修改字段 |
| `account delete` | 删除子账号 | `--username` |
| `account restore` | 恢复子账号 | `--username` |

### SSO（不需要 API Key）(3)

| 命令 | 说明 | 关键参数 |
|------|------|----------|
| `sso subaccount-url` | 子账号 SSO | `--subuser` |
| `sso user-system-url` | 用户体系 SSO | `--u` `--system_id` `--uid` |
| `sso partner-url` | 合作伙伴 SSO | `--partnerid` |

### 数据分析（不需要 API Key）(6)

| 命令 | 说明 | 关键参数 |
|------|------|----------|
| `analytics decode` | 解码答卷 | `--submitdata` |
| `analytics nps` | NPS 计算 | `--scores '[9,10,7,3]'` |
| `analytics csat` | CSAT 计算 | `--scores` `--scale` |
| `analytics anomalies` | 异常检测 | `--responses` |
| `analytics compare` | 指标对比 | `--set_a` `--set_b` |
| `analytics decode-push` | 解密推送 | `--encrypted` `--app_key` |

### 系统命令 (11)

| 命令 | 说明 |
|------|------|
| `init` | 配置向导 |
| `whoami` | 验证身份 |
| `doctor` | 环境诊断 |
| `reference <topic>` | 查看参考文档 |
| `completion bash/zsh/fish` | 生成补全脚本 |
| `completion install` | 安装补全 |
| `skill install` | 安装 Claude Code 技能 |
| `skill update` | 更新技能 |
| `update` | 自我更新 |

---

## AI Skill 系统深度解析

### 安装结构

`wjx skill install` 安装以下文件到当前项目（也可从 [Vercel Agent Skills](https://skills.sh/wjxcom/wjx-ai-kit) 或 [ClawHub](https://clawhub.ai/skills?q=wjx) 市场安装）：

```
项目根目录/
├── .claude/agents/
│   └── wjx-cli-expert.md      # Claude Code Agent 定义
└── skills/wjx-cli-use/
    ├── SKILL.md                # 技能主文档（命令概览 + 核心工作流）
    └── references/
        ├── dsl-syntax.md       # DSL 语法参考
        ├── survey-commands.md  # 问卷命令参数
        ├── response-commands.md # 答卷命令参数
        ├── contacts-commands.md # 通讯录/账号命令参数
        ├── analytics-commands.md # 分析命令参考
        └── question-types.md   # 题型编码表
```

### 三层渐进式架构

AI Agent 不会一次加载所有文档。它按需读取：

1. **Agent 定义**（约 80 行）：职责范围、安全规则、工作原则
2. **SKILL.md**（约 110 行）：命令总览、核心工作流、枚举值
3. **References**（按需加载）：只在需要具体参数细节时才读取对应文件

这样设计最大化利用了 AI 的上下文窗口——大部分任务只需要前两层就够了。

### 使用场景

安装技能后，在 Claude Code 中可以这样用：

```
"帮我创建一份 NPS 调查问卷"
→ Claude Code 自动识别需要使用 wjx-cli-expert
→ 读取 SKILL.md 了解可用命令
→ 选择 wjx survey create-by-text
→ 需要 DSL 语法细节时读取 references/dsl-syntax.md
→ 生成 DSL 文本并执行命令
→ 返回问卷 ID 和预览链接
```

---

## 错误处理

### 结构化错误

所有错误输出到 stderr，格式统一：

```json
{
  "error": true,
  "message": "API Key is required",
  "code": "AUTH_ERROR",
  "exitCode": 1
}
```

| 退出码 | 错误码 | 含义 |
|--------|--------|------|
| 0 | - | 成功 |
| 1 | `API_ERROR` / `AUTH_ERROR` | API 调用失败或认证错误 |
| 2 | `INPUT_ERROR` | 参数格式错误 |

### 在脚本中处理错误

```bash
if wjx survey get --vid 12345 > /tmp/survey.json 2>/tmp/error.json; then
  echo "成功: $(jq -r '.data.aname' /tmp/survey.json)"
else
  echo "失败: $(jq -r '.message' /tmp/error.json)"
fi
```

---

## 实战案例

### 案例 1：每日答卷监控脚本

```bash
#!/bin/bash
# daily-monitor.sh - 每天检查答卷增量

VID=12345
TODAY=$(date +%Y-%m-%d)
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)

# 获取今日答卷数
COUNT=$(wjx response query --vid $VID --start_date $YESTERDAY --end_date $TODAY \
  | jq '.data.total')

echo "[$TODAY] 问卷 $VID 新增答卷: $COUNT 份"

# 超过 100 份时运行异常检测
if [ "$COUNT" -gt 100 ]; then
  RESPONSES=$(wjx response query --vid $VID --start_date $YESTERDAY --page_size 100)
  echo "$RESPONSES" | wjx --stdin analytics anomalies
fi
```

### 案例 2：通讯录批量导入

```bash
# 从 CSV 转 JSON 后导入
cat employees.csv | python3 -c "
import csv, json, sys
reader = csv.DictReader(sys.stdin)
contacts = [{'name': r['姓名'], 'mobile': r['手机'], 'dpath': r['部门']} for r in reader]
print(json.dumps(contacts))
" | wjx --stdin contacts add
```

### 案例 3：CI/CD 中的问卷测试

```yaml
# GitHub Actions
- name: 验证问卷创建
  run: |
    wjx init --api-key ${{ secrets.WJX_API_KEY }} --no-install-skill
    wjx survey create-by-text --text "CI测试\n\n1. 测试题[单选题]\nA\nB" --dry-run
    wjx doctor
```

---

## 下一步

- [CLI 入门指南](./cli-getting-started.md) — 快速上手
- [MCP 入门指南](./mcp-getting-started.md) — AI 对话操作
- [SDK 入门指南](./sdk-getting-started.md) — TypeScript 编程
- [总纲](./00-overview.md) — 全景概览
