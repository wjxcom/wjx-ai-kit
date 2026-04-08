# bind_mobile - 绑定手机号

当账号需要绑定手机号时，自动打开浏览器完成绑定流程，并自动轮询检查绑定状态。

## 功能

- 使用 JWT 换取临时绑定令牌（uid）
- 自动打开浏览器访问绑定页面
- **自动轮询检查绑定状态**，绑定成功后自动退出
- 支持跳过浏览器打开或跳过等待

## 使用场景

- 账号未绑定手机号，需要绑定后才能发布问卷
- 调用方检测到 `NOT_BIND_MOBILE` 错误时执行

## 流程

```
1. JWT 换取 uid
   POST /auth/mobile_bind/jwt_login/
   Authorization: Bearer <jwt_token>
   → 返回 uid 和有效期（默认600秒）

2. 打开浏览器访问绑定页面
   GET /auth/mobile_bind/?uid=<uid>
   → 用户在浏览器中完成绑定

3. 自动轮询检查绑定状态
   GET /auth/mobile_bind/status/?uid=<uid>
   Authorization: Bearer <jwt_token>
   → 返回绑定状态，绑定成功后自动退出
```

## 用法

### 自动绑定（推荐）

```bash
node scripts/bind_mobile.js
```

脚本会自动：
1. 读取本地 JWT（规则与 `references/auth.md` / `scripts/token_store.js` 一致）
2. 换取临时 uid
3. 打开默认浏览器访问绑定页面
4. **自动轮询检查绑定状态**，绑定成功后自动退出

### 只获取绑定链接

```bash
node scripts/bind_mobile.js --no-open
```

不自动打开浏览器，只输出绑定链接，用户手动复制到浏览器打开。

### 打开浏览器但不等待

```bash
node scripts/bind_mobile.js --no-wait
```

打开浏览器后，不自动轮询等待绑定完成。

## 参数

| 参数 | 说明 |
|------|------|
| `--no-open` | 不自动打开浏览器 |
| `--no-wait` | 不自动等待绑定完成 |
| `--json` | 以 JSON 格式输出结果 |
| `-h, --help` | 显示帮助信息 |

## 接口地址

| 接口 | 地址 |
|------|------|
| 换取 uid | `POST /auth/mobile_bind/jwt_login/` |
| 绑定页面 | `GET /auth/mobile_bind/?uid=<uid>` |
| 查询状态 | `GET /auth/mobile_bind/status/?uid=<uid>` |

**基础地址**: `https://www.wenjuan.com`

## 绑定页面

浏览器打开的页面包含：

- 手机号输入框
- 发送验证码按钮
- 验证码输入框
- 绑定按钮

绑定完成后，脚本会自动检测到绑定成功并退出。

## 状态查询返回

```json
{
  "status": 200,
  "status_code": 1,
  "data": {
    "is_bound": true,      // 是否已绑定
    "mobile": "138****1234", // 绑定的手机号（脱敏）
    "bind_status": "bound"   // 绑定状态: unbound/bound
  }
}
```
