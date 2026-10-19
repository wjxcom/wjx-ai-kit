# 创建与修改问卷的逻辑模块测试

测试日期：2026-10-19。创建 action 为 `1000106`，修改 action 为 `1000109`，查询使用普通 `1000001`。

本轮实际调用了测试站点 `http://tanhao.sojump.cn`，使用专门创建的草稿核对保存后的题目、原生关联字段与 `dsl.logic` 读回。发现的问题已修复并复测；未向请求、测试文件或报告中写入账号凭据。

## 最终结果

| 验证层级 | 结果 | 核对内容 |
|---|---:|---|
| 测试站点 HTTP 与查询断言 | 13/13 | 带逻辑／无逻辑创建，修改、清除、隐藏、跳转，完整 JSON＋逻辑更新，失败不改写 |
| 真实创建与查询转换 | 19/19 | 真实业务程序集生成 XML，再经真实查询模型投影；包含用户完整 OR 示例 |
| 真实修改方法与可控存储 | 24/24 | 编译当前生产更新方法，验证保存、权限、索引、失败和发布分支 |
| Model 回归 | 78/78 | 逻辑语义、引用、循环、原生运行标记、XML 保留与索引保护 |
| 后端边界与组合契约 | 29/29 | JSON 输入、路由、权限、配额和既有存储链路 |
| SDK 全量 | 615/615 | 输入、传输、不可重放写入及读回核验 |
| SDK／CLI／MCP 定向回归 | 35/35 | 本轮新增的内容核验、显隐证据和调用点行为，包含 SDK 用例 |

构建、C# 5 集成编译、能力矩阵、manifest、Agent 契约和文档检查通过。各层用例有交叉，不将这些数量相加作为独立业务场景数。

## 测试站点实测

创建的测试草稿为 `220117` 和 `220118`，全程未发布、未收集答卷。测试完成后已移入回收站，删除读回结果均为 `verified`，未执行彻底删除。

| 场景 | 实际读回 |
|---|---|
| 用户 OR 示例创建 | Q3：`Relation=2,1`；Q4：`2,2`；Q5／Q6／Q7：`2,3$3,3$4,3` |
| 无 DSL 创建 | 六道题均无关联，查询不返回额外逻辑模块 |
| 仅修改逻辑 | 请求成功并返回 `verified`，题目与选项保持 |
| 无条件 `show` | 目标 `relation` 明确为空，其他规则保留 |
| `hide` | 目标 `relation=-1`、`is_hide=true`，读回核验通过 |
| 跳转 | Q2 的 `has_jump=true`、`anytime_jump=3` |
| 完整 JSON＋DSL | 标题、说明、题干和选项正确；Q3 关联为 `2,3`，无索引破坏 |
| 新旧跳转组成循环 | 返回 `46007 / DSL_LOGIC_CYCLE`；版本、题目和逻辑均未变 |
| 引用不存在题目 | 返回 `46007 / DSL_LOGIC_REFERENCE`；版本、题目和逻辑均未变 |

实测断言与脱敏快照：

- [HTTP 结果](2026-10-19-survey-json-logic/live-results.json)
- [查询快照](2026-10-19-survey-json-logic/live-query-snapshots.json)
- [草稿清理确认](2026-10-19-survey-json-logic/cleanup-results.json)

## 发现并修复的问题

1. DSL 只生成关联／跳转属性，却缺少答题页依赖的 `HasRefer`、`HasJump`、`HasItemRelation` 和引用反向链接。现同步添加、清除和重定向这些原生标记；内容重建也继承新题目对应的引用根标记。
2. 更新只校验新传入的跳转，遗漏与保留旧规则合并后的循环。现校验最终克隆 XML，失败不覆盖原文档。
3. 条件隐藏、通用条件跳转和缺少选项号的条件可能静默改变含义。当前无法可靠表达的条件操作明确拒绝；已有明确原生编码的选项跳转继续支持。
4. 完整 JSON 更新会移动非题目节点，并忽略 JSONL 中的新问卷标题。现按原位置替换题目，保留扩展节点，并处理标题覆盖和缺省规则。
5. 标准 `qtype=问卷基础信息` 的说明在解析时被丢弃。现正确提取说明，保持既有题号，验证保存到 XML `Desc` 和普通查询 `description`。
6. 客户端可能将陈旧题干／选项误报为修改成功，或将成功的显隐修改误报为未知。现核对实际内容和原生关联证据；`Relation=0` 不作为显示成功证据，未知高级字段明确返回未验证。

## 实际 XML 证据与复跑

- [完整 OR 创建 XML](2026-10-19-survey-json-logic/create-user-logic.xml)
- [选项跳转 XML](2026-10-19-survey-json-logic/create-option-jump.xml)
- [仅隐藏逻辑 XML](2026-10-19-survey-json-logic/create-hidden-only.xml)
- [选项显示 XML](2026-10-19-survey-json-logic/create-option-display.xml)
- [选项引用 XML](2026-10-19-survey-json-logic/create-option-reference.xml)
- [完整内容与逻辑修改 XML](2026-10-19-survey-json-logic/update-content-and-logic.xml)
- [创建集成结果](2026-10-19-survey-json-logic/create-results.txt)
- [修改集成结果](2026-10-19-survey-json-logic/update-results.txt)

这些 XML 由本地真实业务程序集生成，使用本地测试编号；HTTP 保存证据为前述测试站点查询快照。XML 中保存原生逻辑属性，没有 DSL 原文或额外 DSL 存储节点。

可复跑的源码和入口位于 [集成测试目录](../../tests/survey-json-logic-integration/README.md)：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\survey-json-logic-integration\Run-SurveyLogicIntegration.ps1 -BackendRoot D:\workspace\VSrepos\Branch\tanhao
```

该入口不访问真实数据库或 HTTP：创建和 XML／查询转换使用真实程序集；修改使用当前生产方法，存储与发布依赖可控，以覆盖故障分支。真实接口保存已在上述独立 HTTP 实测中验证。

本轮未做浏览器逐题点击，也未验证所有高级题型的交互。创建响应中的填写链接使用 HTTPS，而当前测试配置为 HTTP，因此 CLI 链接校验给出警告；未把填写链接和页面交互计入通过项。
