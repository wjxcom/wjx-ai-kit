# 故障排查

## `wjx doctor` 失败

确认 Node.js 版本、`WJX_API_KEY` 是否过期、`WJX_BASE_URL` 是否包含协议，并重新运行 `wjx init`。私有化部署先用浏览器确认域名可达。

## MCP 没有工具

检查客户端配置 JSON、构建路径和 stderr 日志；完全重启客户端。MCP 客户端应先完成 initialize，再调用 `list_surveys`。

## HTTP 返回 401

确认 `Authorization: Bearer` 的值与 `MCP_AUTH_TOKEN` 完全一致。当前实现把该值同时作为问卷星 API Key；不要配置一个任意的独立 token 后期待 API 调用仍能成功。

## 参数报错

运行 `wjx <command> --help`；CLI 当前使用 `--completely`、`--file_name`、`--file`、`--suffix`、`--jid` 等参数。旧文档中的同义参数已移除。
