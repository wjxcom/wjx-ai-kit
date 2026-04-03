# Security Policy

## Reporting a Vulnerability

如果你发现安全漏洞，请**不要**通过公开 Issue 报告。

请通过以下方式联系我们：

- 在 [Codeup](https://codeup.aliyun.com/6445da2d020eabef3107e22e/wjxfc/wjxagents) 上创建私密 Issue

我们会在收到报告后尽快确认并处理。

## Security Best Practices

使用本项目时请注意：

- **不要将 API Key 提交到代码仓库** — 使用环境变量或 `~/.wjxrc` 配置文件
- **HTTP 模式务必设置 `MCP_AUTH_TOKEN`** — 防止未授权访问
- **定期轮换 API Key** — 尤其在团队成员变更后
