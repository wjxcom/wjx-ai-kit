# 常见错误与排查

## API 错误码

| 错误信息 / result | 原因 | 解决方案 |
|------------------|------|---------|
| `result: false` + "appkey error" | API Key 错误或过期 | 调用 `get_config` 确认 key，引导用户重新获取 |
| `result: false` + "sign error" | 签名计算错误（通常是 key 格式问题） | 确认 API Key 是否完整复制，无多余空格 |
| `result: false` + "activity not found" | 问卷 vid 不存在或无权限 | 用 `list_surveys` 确认 vid 是否正确 |
| `result: false` + "no permission" | 当前 key 无权操作该问卷 | 确认问卷归属账号与 API Key 匹配 |
| `result: false` + "corp_id required" | 通讯录操作需企业 ID | 引导用户在 MCP 配置中加 `WJX_CORP_ID` 环境变量 |
| 网络超时 / fetch failed | 网络不通或 base_url 错误 | `get_config` 查看 base_url 是否正确 |

## 配置问题

| 现象 | 排查步骤 |
|------|---------|
| get_config 显示 api_key "(未设置)" | 检查 MCP 配置中 `WJX_API_KEY` 环境变量，或 `~/.wjxrc` 文件 |
| get_config 显示 base_url 是默认值但用户用自定义域名 | 在 MCP 配置中加 `WJX_BASE_URL` 环境变量，或用 `wjx init --base-url` 写入 `~/.wjxrc` |
| 工具调用返回空数据 | 确认问卷已发布（state=1），且有答卷数据 |
| create_survey_by_text 题目丢失 | 检查 DSL 文本格式：题号 + 题目 + [题型标签]，选项各占一行 |

## 自定义域名

部分用户使用 `xxx.sojump.cn` 而非 `www.wjx.cn`。如果 API 调用失败：

1. 调用 `get_config` 查看 `base_url`
2. 如果是默认值 `https://www.wjx.cn` 但用户声明使用其他域名，需要配置 `WJX_BASE_URL`
3. 配置方式：在 AI 工具的 MCP 配置中添加环境变量 `"WJX_BASE_URL": "https://xxx.sojump.cn"`

## 考试问卷限制

考试问卷（atype=6）通过 `create_survey_by_text` 创建后：
- 题目和选项会正常创建
- **正确答案和每题分值无法通过 API 设置**
- 创建后应提供编辑链接（`build_survey_url({ mode: "edit", activity: vid })`），指引用户在网页端配置答案与评分
