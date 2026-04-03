# 其他工具详解

## 通讯录（14 tools）

> 通讯录操作需要 `WJX_CORP_ID`。所有通讯录工具的 `corpid` 参数均可选，未提供时使用环境变量。

### query_contacts — 查询联系人

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `corpid` | string | 否 | 通讯录编号 |
| `uid` | string | 是 | 用户编号（唯一标识） |

### add_contacts — 批量添加/更新联系人（最多 100 人）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `corpid` | string | 否 | 通讯录编号 |
| `users` | string | 是 | 用户列表 JSON 数组。每项字段：`userid`(必填), `name`(必填), `nickname`, `mobile`, `email`, `department`(用/分隔层级), `tags`(格式:组/标签), `birthday`, `gender`(0=保密/1=男/2=女), `pwd` |
| `auto_create_udept` | boolean | 否 | 自动创建不存在的部门 |
| `auto_create_tag` | boolean | 否 | 自动创建不存在的标签 |

### delete_contacts — 批量删除联系人（不可逆）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `corpid` | string | 否 | 通讯录编号 |
| `uids` | string | 是 | 用户编号列表，逗号分隔 |

### add_admin — 添加/修改管理员（最多 100 人）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `corpid` | string | 否 | 通讯录编号 |
| `users` | string | 是 | 管理员列表 JSON 数组。每项：`userid`(必填), `role`(必填: 0=系统管理员,1=分组管理员,2=问卷管理员,3=统计查看,4=完整查看,5=部门管理员), `confidential`, `effective_date`(yyyy-MM-dd), `remark`(最多50字) |

### delete_admin — 删除管理员

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `corpid` | string | 否 | 通讯录编号 |
| `uids` | string | 是 | 管理员用户编号，逗号分隔，最多 100 个 |

### restore_admin — 恢复管理员

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `corpid` | string | 否 | 通讯录编号 |
| `uids` | string | 是 | 管理员用户编号，逗号分隔，最多 100 个 |

### list_departments — 查询部门列表

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `corpid` | string | 否 | 通讯录编号 |

### add_department — 添加部门

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `corpid` | string | 否 | 通讯录编号 |
| `depts` | string | 是 | 部门路径列表 JSON 数组，如 `["研发部/后端", "产品部"]` |

### modify_department — 修改部门（最多 100 条）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `corpid` | string | 否 | 通讯录编号 |
| `depts` | string | 是 | 部门列表 JSON 数组，每项：`id`(部门ID), `name`, `order`(>0且<999999) |

### delete_department — 删除部门

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `corpid` | string | 否 | 通讯录编号 |
| `type` | string | 是 | 删除方式："1"=按ID, "2"=按名称 |
| `depts` | string | 是 | 部门标识列表 JSON 数组 |
| `del_child` | boolean | 否 | 是否同时删除子部门 |

### list_tags — 查询标签列表

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `corpid` | string | 否 | 通讯录编号 |

### add_tag — 添加标签

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `corpid` | string | 否 | 通讯录编号 |
| `child_names` | string | 是 | 标签列表 JSON 数组，格式 `["组/标签"]`，如 `["学历/本科", "学历/硕士"]` |
| `is_radio` | boolean | 否 | 标签组是否单选（默认多选） |

### modify_tag — 修改标签

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `corpid` | string | 否 | 通讯录编号 |
| `tp_id` | string | 是 | 标签组 ID（从 list_tags 获取） |
| `tp_name` | string | 否 | 新标签组名称 |
| `child_names` | string | 否 | 子标签 JSON 数组，每项含 `id` 和 `name` |

### delete_tag — 删除标签

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `corpid` | string | 否 | 通讯录编号 |
| `type` | string | 是 | 删除方式："1"=按ID, "2"=按名称 |
| `tags` | string | 是 | 标签标识列表 JSON 数组 |

---

## 子账号管理（5 tools）

### add_sub_account — 创建子账号

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `subuser` | string | 是 | 子账号用户名 |
| `password` | string | 否 | 密码 |
| `mobile` | string | 否 | 手机号 |
| `email` | string | 否 | 邮箱 |
| `role` | number | 否 | 角色：1=系统管理员, 2=问卷管理员, 3=统计查看, 4=完整查看 |
| `group` | number | 否 | 分组 ID |

### modify_sub_account — 修改子账号

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `subuser` | string | 是 | 子账号用户名 |
| `mobile` | string | 否 | 手机号 |
| `email` | string | 否 | 邮箱 |
| `role` | number | 否 | 角色（1-4） |
| `group` | number | 否 | 分组 ID |

### delete_sub_account — 删除子账号

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `subuser` | string | 是 | 子账号用户名 |

### restore_sub_account — 恢复子账号

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `subuser` | string | 是 | 子账号用户名 |
| `mobile` | string | 否 | 手机号 |
| `email` | string | 否 | 邮箱 |

### query_sub_accounts — 查询子账号列表

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `subuser` | string | 否 | 精确匹配用户名 |
| `name_like` | string | 否 | 名称模糊搜索（最长 10 字符） |
| `role` | number | 否 | 按角色筛选 |
| `group` | number | 否 | 按分组筛选 |
| `status` | boolean | 否 | 按状态筛选 |
| `mobile` | string | 否 | 按手机号筛选 |

---

## SSO 链接生成（5 tools）

### sso_subaccount_url — 子账号 SSO 登录链接

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `subuser` | string | 是 | 子账号用户名 |
| `mobile` | string | 否 | 手机号 |
| `email` | string | 否 | 邮箱 |
| `role_id` | number | 否 | 角色 ID（1-4） |
| `url` | string | 否 | 登录后跳转地址 |
| `admin` | number | 否 | 设为 1 以主账号身份登录 |

### sso_user_system_url — 用户系统 SSO 链接

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `u` | string | 是 | 账户用户名 |
| `user_system` | number | 是 | 用户系统标志（固定为 1） |
| `system_id` | number | 是 | 用户系统 ID |
| `uid` | string | 是 | 参与者 ID |
| `uname` | string | 否 | 参与者姓名 |
| `udept` | string | 否 | 参与者部门 |
| `uextf` | string | 否 | 扩展字段 |
| `upass` | string | 否 | 密码 |
| `is_login` | number | 否 | 是否登录（0 或 1） |
| `activity` | number | 否 | 跳转到的问卷编号 |
| `return_url` | string | 否 | 返回地址 |

### sso_partner_url — 合作伙伴 SSO 登录链接

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | 是 | 合作伙伴账号用户名 |
| `mobile` | string | 否 | 手机号 |
| `subuser` | string | 否 | 子账号用户名 |

### build_survey_url — 问卷创建/编辑链接（无需签名）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `mode` | "create" \| "edit" | 是 | 模式 |
| `name` | string | 否 | 问卷名称（仅创建模式） |
| `qt` | number | 否 | 问卷类型（仅创建模式） |
| `osa` | number | 否 | 设为 1 自动发布（仅创建模式） |
| `redirect_url` | string | 否 | 操作后跳转地址 |
| `activity` | number | 否 | 问卷编号（编辑模式必填） |
| `editmode` | number | 否 | 编辑模式 |
| `runprotect` | number | 否 | 运行保护标志 |

### build_preview_url — 问卷预览链接

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |

返回问卷的预览 URL，可在浏览器中查看问卷效果。

---

## 分析计算（5 tools，纯本地计算，无需 API Key）

### decode_responses — 解码 submitdata 格式

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `submitdata` | string | 是 | 原始 submitdata 字符串 |

### calculate_nps — 计算 NPS 净推荐值

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `scores` | number[] | 是 | 0-10 评分数组 |

### calculate_csat — 计算 CSAT 满意度

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `scores` | number[] | 是 | 评分数组（1-5 或 1-7） |
| `scale_type` | "5-point" \| "7-point" | 否 | 量表类型（默认 5-point） |

### detect_anomalies — 检测异常答卷

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `responses` | object[] | 是 | 答卷记录数组，每项含 `id`, `answers`(答案数组), `duration_seconds`(答题时长), `ip` |

检测规则：直线作答（所有答案相同）、速度异常（<中位数 30%）、IP+内容重复。

### compare_metrics — 对比指标数据

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `set_a` | Record<string, number> | 是 | 指标集 A |
| `set_b` | Record<string, number> | 是 | 指标集 B |

输出差值、变化率和显著性标记（|变化率|>10% 为显著）。

---

## 用户体系（6 tools）

### add_participants — 批量添加参与者

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `users` | string | 是 | 参与者列表 JSON 数组，每项含 `uid`, `uname`, `upass`, `udept`, `uextf` |
| `usid` | number | 是 | 用户系统 ID |

### modify_participants — 批量修改参与者

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `users` | string | 是 | 参与者列表 JSON 数组 |
| `usid` | number | 是 | 用户系统 ID |
| `auto_create_udept` | boolean | 否 | 自动创建不存在的部门 |

### delete_participants — 批量删除参与者（不可逆）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `uids` | string | 是 | 参与者 ID 列表 JSON 数组 |
| `usid` | number | 是 | 用户系统 ID |

### bind_activity — 绑定问卷到用户体系

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `usid` | number | 是 | 用户系统 ID |
| `uids` | string | 是 | 参与者 ID 列表 JSON 数组 |
| `answer_times` | number | 否 | 作答次数限制（0=不限） |
| `can_chg_answer` | boolean | 否 | 是否允许修改答案 |
| `can_view_result` | boolean | 否 | 是否允许查看结果 |
| `can_hide_qlist` | number | 否 | 是否隐藏问卷列表（0/1） |

### query_survey_binding — 查询问卷用户绑定

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `vid` | number | 是 | 问卷编号 |
| `usid` | number | 是 | 用户系统 ID |
| `join_status` | number | 否 | 参与状态筛选（0=全部） |
| `day` | string | 否 | 按日筛选（yyyyMMdd） |
| `week` | string | 否 | 按周筛选（yyyyWW） |
| `month` | string | 否 | 按月筛选（yyyyMM） |
| `force_join_times` | boolean | 否 | 是否获取参与次数 |

### query_user_surveys — 查询用户关联问卷

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `uid` | string | 是 | 参与者 ID |
| `usid` | number | 是 | 用户系统 ID |
