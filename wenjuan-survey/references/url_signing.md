# URL 查询签名（ai_skills / generate_sign）

**编辑类**（`app_api/edit/...`）、**报表下载**（`/report/api/download*`）与 **数据概况**（`/report/api/v2/overview/stats/...`）等请求的 URL 查询参数签名，均使用 `scripts/generate_sign.js` 中的同一 **`CONFIG`**（`web_site=ai_skills`、`appkey`、`secret`，MD5 `signature`）。

## `buildSignedUrl` 示例

```javascript
const { buildSignedUrl } = require('./scripts/generate_sign');

const baseUrl = "https://www.wenjuan.com/app_api/edit/xxx/";
const params = { project_id: "xxx" };
const fullUrl = buildSignedUrl(baseUrl, params);
// 自动添加：appkey, web_site, timestamp, signature
```

## 查询参数名

| 参数 | 说明 |
|------|------|
| `appkey` | 应用标识（与旧版报表 `app_key` 已统一为 ai_skills 的 `appkey`） |
| `web_site` | 固定为 `ai_skills` |
| `timestamp` | 秒级时间戳 |
| `signature` | 参与签名的参数按**名字母序**拼接**各参数值**后加 `secret` 再 MD5（小写 hex），逻辑见 `scripts/generate_sign.js` |

## 脚本引用

- `export_data.js` 的 **`buildUrlWithAuth`** 内部调用 **`buildSignedUrl`**
- `overview_stats.js` 复用 **`buildUrlWithAuth`**

更多见 [`overview_stats.md`](overview_stats.md)、[`export_data.md`](export_data.md)。
