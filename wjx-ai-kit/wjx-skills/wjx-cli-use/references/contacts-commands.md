# 通讯录、部门、管理员、标签、子账号与 SSO 参考

> 通讯录相关操作需要 `WJX_CORP_ID`（通过 `wjx init` 配置或环境变量）。
> 所有通讯录命令支持 `--corpid <s>` 覆盖默认值。

## 目录

- [Contacts 模块](#contacts-模块) — query, add, delete
- [Department 模块](#department-模块) — list, add, modify, delete
- [Admin 模块](#admin-模块) — add, delete, restore
- [Tag 模块](#tag-模块) — list, add, modify, delete
- [Account 模块（子账号）](#account-模块子账号) — list, add, modify, delete, restore
- [SSO 模块](#sso-模块) — subaccount-url, user-system-url, partner-url
- [User-System 模块（已过时）](#user-system-模块已过时) — add/modify/delete-participants, bind, query

## Contacts 模块

### wjx contacts query

```bash
wjx contacts query --uid user001
wjx contacts query --uid user001 --corpid CORP123
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--uid <s>` | 是 | 用户编号（唯一标识） |
| `--corpid <s>` | 否 | 通讯录编号 |

### wjx contacts add

批量添加或更新联系人（最多 100 人）。userid 已存在则更新。

```bash
wjx contacts add --users '[{"userid":"u1","name":"Alice","mobile":"13800000001","email":"a@b.com","department":"研发部/后端","tags":"学历/本科"}]'
wjx contacts add --users '[...]' --auto_create_udept --auto_create_tag
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--users <json>` | 是 | 用户列表 JSON 数组 |
| `--corpid <s>` | 否 | 通讯录编号 |
| `--auto_create_udept` | 否 | 自动创建不存在的部门 |
| `--auto_create_tag` | 否 | 自动创建不存在的标签 |

**users 数组每项字段**：`userid`(必填), `name`(必填), `nickname`, `mobile`, `email`, `department`(用/分隔层级), `tags`(格式:组/标签), `birthday`, `gender`(0=保密/1=男/2=女), `pwd`

### wjx contacts delete

批量删除联系人（**不可逆**）。

```bash
wjx contacts delete --uids "user001,user002"
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--uids <s>` | 是 | 用户编号列表，逗号分隔 |
| `--corpid <s>` | 否 | 通讯录编号 |

---

## Department 模块

### wjx department list

```bash
wjx department list
wjx department list --corpid CORP123
```

### wjx department add

```bash
wjx department add --depts '["研发部/后端", "产品部"]'
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--depts <json>` | 是 | 部门路径 JSON 数组，用 / 分隔层级 |
| `--corpid <s>` | 否 | 通讯录编号 |

### wjx department modify

```bash
wjx department modify --depts '[{"id":"dept123","name":"新名称","order":10}]'
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--depts <json>` | 是 | 部门对象 JSON 数组，每项含 id(必填), name, order(>0 且 <999999) |
| `--corpid <s>` | 否 | 通讯录编号 |

### wjx department delete

```bash
wjx department delete --type 1 --depts '["dept123"]'
wjx department delete --type 2 --depts '["研发部"]' --del_child
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--type <s>` | 是 | "1"=按 ID 删除, "2"=按名称删除 |
| `--depts <json>` | 是 | 部门标识 JSON 数组（ID 或名称） |
| `--corpid <s>` | 否 | 通讯录编号 |
| `--del_child` | 否 | 同时删除子部门 |

---

## Admin 模块

### wjx admin add

批量添加或修改管理员（最多 100 人）。

```bash
wjx admin add --users '[{"userid":"u1","role":2}]'
wjx admin add --users '[{"userid":"u1","role":0,"confidential":true,"effective_date":"2026-12-31","remark":"临时管理员"}]'
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--users <json>` | 是 | 管理员 JSON 数组 |
| `--corpid <s>` | 否 | 通讯录编号 |

**users 数组每项字段**：`userid`(必填), `role`(必填: 0=系统管理员, 1=分组管理员, 2=问卷管理员, 3=统计查看, 4=完整查看, 5=部门管理员), `confidential`(是否保密), `effective_date`(有效期 yyyy-MM-dd), `remark`(备注, 最多 50 字)

### wjx admin delete

```bash
wjx admin delete --uids "u1,u2"
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--uids <s>` | 是 | 管理员用户编号，逗号分隔（最多 100） |
| `--corpid <s>` | 否 | 通讯录编号 |

### wjx admin restore

```bash
wjx admin restore --uids "u1,u2"
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--uids <s>` | 是 | 管理员用户编号，逗号分隔（最多 100） |
| `--corpid <s>` | 否 | 通讯录编号 |

---

## Tag 模块

### wjx tag list

```bash
wjx tag list
```

### wjx tag add

```bash
wjx tag add --child_names '["学历/本科", "学历/硕士", "年龄/18-35"]'
wjx tag add --child_names '["职级/初级", "职级/高级"]' --is_radio   # 单选标签组
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--child_names <json>` | 是 | 标签路径 JSON 数组，格式 "组/标签名" |
| `--corpid <s>` | 否 | 通讯录编号 |
| `--is_radio` | 否 | 标签组为单选（默认多选） |

### wjx tag modify

```bash
wjx tag modify --tp_id "tag123" --tp_name "新组名"
wjx tag modify --tp_id "tag123" --child_names '[{"id":"child1","name":"新标签名"}]'
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--tp_id <s>` | 是 | 标签组 ID（从 tag list 获取） |
| `--tp_name <s>` | 否 | 新标签组名称 |
| `--child_names <json>` | 否 | 子标签 JSON 数组，每项含 id 和 name |
| `--corpid <s>` | 否 | 通讯录编号 |

### wjx tag delete

```bash
wjx tag delete --type 1 --tags '["tag123"]'
wjx tag delete --type 2 --tags '["学历"]'
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--type <s>` | 是 | "1"=按 ID, "2"=按名称 |
| `--tags <json>` | 是 | 标签标识 JSON 数组 |
| `--corpid <s>` | 否 | 通讯录编号 |

---

## Account 模块（子账号管理）

### wjx account list

```bash
wjx account list
wjx account list --role 2 --name_like "张"
```

| Flag | 说明 |
|------|------|
| `--subuser <s>` | 精确匹配用户名 |
| `--name_like <s>` | 名称模糊搜索（最多 10 字符） |
| `--role <n>` | 按角色筛选 |
| `--group <n>` | 按分组筛选 |
| `--page_index <n>` | 页码 |
| `--page_size <n>` | 每页数量 |
| `--mobile <s>` | 按手机号筛选 |

### wjx account add

```bash
wjx account add --subuser user1 --password pass123 --role 1
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--subuser <s>` | 是 | 子账号用户名 |
| `--password <s>` | 否 | 密码 |
| `--mobile <s>` | 否 | 手机号 |
| `--email <s>` | 否 | 邮箱 |
| `--role <n>` | 否 | 1=系统管理员, 2=问卷管理员, 3=统计查看, 4=完整查看 |
| `--group <n>` | 否 | 分组 ID |

### wjx account modify

```bash
wjx account modify --subuser user1 --role 2
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--subuser <s>` | 是 | 子账号用户名 |
| `--mobile <s>` | 否 | 手机号 |
| `--email <s>` | 否 | 邮箱 |
| `--role <n>` | 否 | 角色（1-4） |
| `--group <n>` | 否 | 分组 ID |

注意：不支持修改密码。

### wjx account delete

```bash
wjx account delete --subuser user1
```

### wjx account restore

```bash
wjx account restore --subuser user1 --mobile 13800000001
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--subuser <s>` | 是 | 子账号用户名 |
| `--mobile <s>` | 否 | 手机号 |
| `--email <s>` | 否 | 邮箱 |

---

## SSO 模块（本地 URL 生成，无需 API Key）

### wjx sso subaccount-url

生成子账号免密登录链接。

```bash
wjx sso subaccount-url --subuser admin1
wjx sso subaccount-url --subuser admin1 --role_id 2 --url "https://example.com/dashboard"
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--subuser <s>` | 是 | 子账号用户名 |
| `--mobile <s>` | 否 | 手机号 |
| `--email <s>` | 否 | 邮箱 |
| `--role_id <n>` | 否 | 角色 ID（1-4） |
| `--url <s>` | 否 | 登录后跳转地址 |
| `--admin <n>` | 否 | 设为 1 以主账号身份登录 |

### wjx sso user-system-url

生成用户系统参与者登录链接。

```bash
wjx sso user-system-url --u admin --system_id 100 --uid user001
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--u <s>` | 是 | 账户用户名 |
| `--system_id <n>` | 是 | 用户系统 ID |
| `--uid <s>` | 是 | 参与者 ID |
| `--uname <s>` | 否 | 参与者姓名 |
| `--udept <s>` | 否 | 参与者部门 |
| `--uextf <s>` | 否 | 扩展字段 |
| `--upass <s>` | 否 | 密码 |
| `--is_login <n>` | 否 | 是否登录（0 或 1） |
| `--activity <n>` | 否 | 跳转到的问卷编号 |
| `--return_url <s>` | 否 | 返回地址 |

### wjx sso partner-url

生成合作伙伴登录链接。

```bash
wjx sso partner-url --username partner1
```

| Flag | 必填 | 说明 |
|------|------|------|
| `--username <s>` | 是 | 合作伙伴用户名 |
| `--mobile <s>` | 否 | 手机号 |
| `--subuser <s>` | 否 | 子账号用户名 |

---

## User-System 模块（已过时）

> 这些命令已标记 Deprecated，优先使用通讯录模块。仅在用户明确要求时使用。

```bash
wjx user-system add-participants --sysid 100 --users '[{"uid":"u1","uname":"Alice","upass":"123"}]'
wjx user-system modify-participants --sysid 100 --users '[...]'
wjx user-system delete-participants --sysid 100 --uids '["u1","u2"]'
wjx user-system bind --vid 12345 --sysid 100 --uids '["u1"]'
wjx user-system query-binding --vid 12345 --sysid 100
wjx user-system query-surveys --sysid 100 --uid u1
```
