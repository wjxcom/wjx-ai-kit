# 导出答卷

## 导出文件

```bash
wjx response download --vid 12345 --suffix 0
```

`--suffix`：`0` CSV、`1` SAV、`2` Word。服务端返回异步任务时，命令会按实现支持的方式处理 `taskid`；不要把旧文档中的 `--format` 或 `--response_id` 当作参数。

## 查询单份答卷

```bash
wjx response query --vid 12345 --jid 67890
```

答卷 ID 参数是 `--jid`。导出后再使用 `wjx analytics decode --submitdata <字符串>` 检查编码，或在 SDK 中调用 `decodeResponses`。

## 数据处理建议

- API Key、答卷文件和日志都按敏感数据处理。
- 大文件优先保存到受控目录，再交给分析程序。
- 需要持续同步时使用 Webhook；格式和解密见 [认证与安全](../concepts/authentication.md)。
