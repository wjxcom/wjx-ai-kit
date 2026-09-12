# 问卷逻辑 DSL 一致性问题记录

目标版本：0.4.4 之后的下一个版本。

本记录来自 2026-09-11 对问卷逻辑相关 DSL、JSONL 创建能力、CLI/MCP Skill、Resource、Prompt 和文档的只读审查。0.4.4 先完成版本同步与发布；以下问题保留到下一个版本集中修复。

## P1

- 创建接口明确拒绝的题型仍被部分文档描述为可创建。涉及 `矩阵数值题`、`VlookUp问卷关联`、`多项文件题`、`多项简答题`、`当前语音`。下个版本需要统一改成“可读取既有问卷或由 Web 编辑器配置，当前 JSONL 创建接口拒绝”。
- MCP JSONL 题型 Resource 对 `VlookUp问卷关联` 同时出现 advanced create、framework draft、read-only/web-editor 三种互斥状态。下个版本需要只保留一个明确状态。
- DSL 文档把 `get_survey` JSON 描述成可修改入口，但当前 SDK/CLI/MCP 只有读取和部分专用设置接口。下个版本需要改成“可读取；没有通用逻辑修改接口”。
- MCP 创建工具和 Prompt 宣称或鼓励 `relation` / `referselect`，但没有语法定义、客户端校验和读回验证闭环。下个版本需要降级为未验证透传字段，或补齐完整闭环后再宣称支持。
- DSL 导出与 DSL 参考对矩阵列描述不一致。当前导出器只输出矩阵行，列信息可能丢失；下个版本需要在导出、参考和迁移说明中明确不可逆风险，并尽量输出可得的 `col_items`。

## P2

- `randomchoice` 被部分 JSONL/Skill 文档描述为随机选项支持，但能力矩阵仍将随机化标为 intentional gap。下个版本需要统一为“历史或服务端字段，当前没有完整可验证工作流”。
- DSL 题型映射表没有覆盖导出器实际可能输出的全部标签，例如分页、段落、矩阵滑动条、矩阵数值、表格变体、多项文件、多项简答。下个版本需要补齐导出标签、历史输入标签和 JSONL qtype 的双向映射。
- 公式指南存在字符串引号要求与 `IF` 示例不一致，以及快速路由失效锚点。下个版本需要统一示例并补齐或删除失效章节链接。
- 旧 DSL 迁移文档没有显式提醒 DSL 不是无损迁移格式。下个版本需要列出分支逻辑、验证规则、评分权重、随机化、配额、piping、部分矩阵列和高级题型配置的人工复核清单。

## 验收标准

- `npm run documentation:check`
- `npm run docs:check`
- `npm run capability:check`
- SDK、MCP、CLI 对应测试通过
- MCP/CLI Prompt 与 Resource 不再宣称未验证的问卷逻辑能力
- DSL 读取、导出、迁移和 JSONL 创建边界在 README、wjx-docs、Skill、MCP Resource 中保持一致
