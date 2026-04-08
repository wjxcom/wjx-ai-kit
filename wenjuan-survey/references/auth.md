# 认证说明

问卷网接口需要双重认证：签名 + JWT Token

## 签名认证

每个请求 URL 需包含以下参数：

| 参数 | 说明 |
|-----|------|
| `appkey` | 应用标识 |
| `web_site` | 网站标识 |
| `timestamp` | 当前时间戳（秒） |
| `signature` | MD5 签名 |

签名计算：
1. 将所有业务参数按字母顺序排序
2. 拼接成 `key1=value1&key2=value2` 格式
3. 拼接 `&key=密钥`
4. MD5 加密，转大写

## JWT Token 认证

请求头需携带：

```
Authorization: Bearer <access_token>
```

## Token 获取方式

**目前仅支持微信扫码登录一种方式。**

### 微信扫码登录

一键完成问卷网微信扫码登录：**默认始终尝试用系统默认浏览器打开扫码页**；**仅当自动打开报错/失败时**，再打印链接并写入文件，由用户手动复制到浏览器（扫码与后续轮询不变）。

#### 默认行为（推荐）

1. 获取二维码后 **自动打开浏览器**。
2. 若 `open` 包或系统命令失败，终端会提示 **手动复制链接**，并把完整 URL 写入 **`~/.wenjuan/last_wenjuan_login_url.txt`**（若使用 `--token-dir` 则在该目录下），避免终端折行导致参数丢失。
3. 无论浏览器是自动打开还是手动打开，脚本都用同一 **`device_code`** 轮询 `/login/token`，直到登录成功或超时。

#### 无图形环境（Workerbuddy / CI / SSH）

- **仍请直接运行** `node "${SKILL_DIR}/scripts/login_auto.js"`：脚本**始终会尝试**唤起浏览器；子进程在纯 SSH 里可能看似成功但无窗口，此时请用获取二维码后已写入的 **`last_wenjuan_login_url.txt`**，把**整行链接**复制到**有浏览器的本机**扫码即可。

链接很长且带查询参数，**不要只复制终端里被折行的半段**；请优先用 **`last_wenjuan_login_url.txt`** 或整行复制。

**手动打开链接扫码后，如何拿到登录成功？**  
脚本在获取二维码后会用同一 **`device_code`** 持续请求 `/login/token`，与浏览器是否由脚本打开无关。请在浏览器完成微信扫码后 **保持运行登录脚本的终端不要关**，直至终端出现「登录成功」并写入 `token.json`。只要二维码未过期，接口返回的等待类状态不会中断轮询；仅当明确提示二维码过期、设备码无效等时才会提前结束。

#### 一键登录（有桌面、推荐）

```bash
node "${SKILL_DIR}/scripts/login_auto.js"
```

执行流程：
1. 获取微信登录二维码
2. **默认**用系统浏览器打开登录链接显示二维码
3. 用户微信扫码并确认登录
4. **自动轮询**获取 access_token
5. **自动保存**到本地文件

#### 检查登录状态

```bash
node "${SKILL_DIR}/scripts/login_auto.js" --check
```

#### 完整登录流程示例

```bash
$ node "${SKILL_DIR}/scripts/login_auto.js"

==================================================
问卷网微信扫码登录
==================================================

[1/4] 正在获取登录二维码...
✓ 设备码已保存: /Users/xxx/.wenjuan/device_code

[2/4] 正在自动打开浏览器（若失败将改为下方手动链接方式，不影响后续扫码与轮询）...
✓ 已在浏览器中打开二维码页面

[3/4] 等待扫码登录...
==================================================
请使用微信扫描二维码登录
==================================================
  等待中... (15s / 300s) 请扫码

✓ 登录成功！（耗时 18 秒）

[4/4] 正在保存登录凭证...
✓ 凭证已保存到: /Users/xxx/.wenjuan
  - token.json: 完整凭证信息
  - access_token: 访问令牌
  - refresh_token: 刷新令牌

==================================================
✓ 登录流程完成！
==================================================

Access Token: eyJhbGciOiJIUzI1NiIsInR5cCI6...
Refresh Token: rt_xxxxxxxxxxxxxxxx...
```

#### 其他选项

```bash
# 指定存储目录
node "${SKILL_DIR}/scripts/login_auto.js" --token-dir /path/to/tokens

# 设置最大等待时间（默认300秒）
node "${SKILL_DIR}/scripts/login_auto.js" --max-time 600
```

### 方式二：直接传入已有 Token

如果已有有效的 access_token，可直接写入文件：

```bash
# 写入 token
echo "your_access_token" > ~/.wenjuan/access_token

# 验证
node "${SKILL_DIR}/scripts/login_auto.js" --check
```

**注意**：问卷网暂未开放账号密码登录接口，只能通过微信扫码获取 Token。

## 清除本机登录态（手动）

本 Skill **不再提供** `clear_auth.js`。若需**删除本机保存的登录态**（换账号、共享机器收尾、排查鉴权等），请**自行删除**下列文件（删除前请确认路径，避免误删其它数据）：

1. **用户级凭证目录**（默认 `~/.wenjuan`，或你设置的 `WENJUAN_TOKEN_DIR`）下的：  
   `token.json`、`access_token`、`refresh_token`、`device_code`、`last_wenjuan_login_url.txt`（存在则删）。
2. **Skill 根目录**下 `.wenjuan/auth.json`（若存在）。

**通常不要删除**：`project_struct/`、`download/` 等（与导出/缓存相关，与 JWT 无关）。

示例（默认凭证目录；请按本机实际目录调整）：

```bash
rm -f ~/.wenjuan/token.json ~/.wenjuan/access_token ~/.wenjuan/refresh_token \
      ~/.wenjuan/device_code ~/.wenjuan/last_wenjuan_login_url.txt
# 若曾在项目内保存过授权：
rm -f "${SKILL_DIR}/.wenjuan/auth.json"
```

## 登录凭证存储

### 约定路径（默认）

在未设置 **`WENJUAN_TOKEN_DIR`**、且未传 **`--token-dir`** 时，与本 Skill 相关的常用位置为：

| 用途 | 路径 |
|------|------|
| **授权登录后主凭证**（扫码登录成功后写入的 JSON） | **`~/.wenjuan/token.json`**（同目录还会写 `access_token`、`refresh_token` 等） |
| **原始数据（导出 xlsx）默认保存目录** | **`~/.wenjuan/download/`**（`export_data.js` 使用，目录不存在时会创建） |

若设置了 `WENJUAN_TOKEN_DIR` 或本次指定了 `--token-dir`，则把上表中的 **`~/.wenjuan`** 换成该「凭证目录」；导出默认目录为 **`<凭证目录>/download/`**。

登录成功后，凭证可能保存在以下两处（**脚本读 Token 时优先使用项目目录下的文件**）：

1. **项目目录**（与 `wenjuan-survey` 同级或在其内的工程）：`wenjuan-survey/.wenjuan/auth.json`  
   - 由 `login_auto.js` 在登录结束时写入，适合把 Skill 拷进项目内、只保留一份凭证的场景。
2. **用户级凭证目录**（默认 `~/.wenjuan/`，见下表）：可由环境变量 **`WENJUAN_TOKEN_DIR`** 指向其他目录；传 `--token-dir` 的脚本会以参数覆盖本次运行的用户级目录（不改变 `auth.json` 的优先规则）。

**统一实现**：`scripts/token_store.js` 中的 `resolveAccessToken` / `getDefaultTokenDir`（各业务脚本均通过此模块或封装函数读取，避免各处逻辑分叉）。

多数脚本的读取顺序为：

1. **Skill 根目录下** `.wenjuan/auth.json`（即 `scripts` 的父目录下的 `.wenjuan`，文档中常写作 `wenjuan-survey/.wenjuan/auth.json`）
2. **用户级目录**下的 `token.json`
3. **用户级目录**下的 `access_token`（纯文本）

因此仅存在项目内 `auth.json` 时也可正常调用创建/删除/编辑题目等接口。

### 用户主目录结构

默认用户级目录：`~/.wenjuan/`（未设置 `WENJUAN_TOKEN_DIR` 时）

```
~/.wenjuan/
├── device_code           # 设备码
├── token.json            # 扫码登录后的完整凭证（主文件）
│   ├── access_token
│   ├── refresh_token
│   ├── device_code
│   └── login_time        # 登录时间
├── access_token          # 访问令牌（纯文本，方便读取）
├── refresh_token         # 刷新令牌（纯文本）
└── download/             # 原始数据导出默认目录（export_data 下载的 xlsx）
```

### token.json 结构

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "rt_xxxxxxxxxxxx...",
  "device_code": "abc123...",
  "login_time": "2026-03-29T08:30:00"
}
```

## API 接口说明

### 获取二维码
- URL: `https://www.wenjuan.com/login/qrcode`
- 方法: POST
- 返回: `device_code`, `qrcode_url`
- **必须使用默认浏览器打开** `qrcode_url`

### 获取 Token
- URL: `https://www.wenjuan.com/login/token`
- 方法: POST
- 参数: `device_code`
- 返回: `access_token`, `refresh_token`

## Token 刷新

Token 过期时返回 401 错误，需重新执行扫码登录流程。

运行检查命令确认状态：
```bash
node "${SKILL_DIR}/scripts/login_auto.js" --check
```

如果显示未登录或已过期，重新执行登录即可。

## 故障排除

### 浏览器未自动打开

如果默认浏览器未能自动打开，脚本会显示错误并提示手动操作：

```
❌ 浏览器自动打开失败

请手动复制以下链接到浏览器地址栏打开:
https://open.weixin.qq.com/connect/qrconnect?...

打开后使用微信扫码登录，然后按回车键继续...
```

### 登录超时

- 检查网络连接
- 确认二维码未过期
- 尝试增加等待时间：`--max-time 600`

### 扫码后无响应

- 确保点击了"确认登录"按钮
- 检查网络连接
- 重新运行脚本获取新二维码

## 注意事项

1. **必须使用浏览器打开**：登录流程强制使用系统默认浏览器打开登录链接
2. **扫码时效**：二维码有效期约 5 分钟，超时请重新运行脚本
3. **浏览器权限**：首次使用可能需要允许 Node.js 打开浏览器
4. **网络环境**：确保能访问 `www.wenjuan.com`
5. **Token 有效期**：access_token 有效期通常为 7 天，过期需重新登录
