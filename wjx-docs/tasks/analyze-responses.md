# 分析答卷

## CLI 流程

```bash
wjx response count --vid 12345
wjx response report --vid 12345
wjx response query --vid 12345 --page_size 50
wjx analytics nps --scores "[9,10,8,6,3]"
```

先获取问卷结构，再解释答案编码。`response query` 默认返回结构化 JSON；大量数据请分页读取，不要一次把全部答卷放入模型上下文。

## MCP 流程

让 AI 依次调用 `get_survey`、`get_report`、`query_responses`，再根据目标选择本地分析 Tool，例如 `calculate_nps`、`calculate_csat`、`detect_anomalies` 或 `compare_metrics`。

## 结果说明

报告应区分原始回收量、有效答卷、完成率和抽样口径；NPS 使用 0-10 分组，CSAT 标明 5 或 7 分量表。异常检测结果是提示，不是自动删除依据。

更多参数见 [CLI 命令](../reference/cli.md) 和 [MCP 工具](../reference/mcp-tools.md)。
