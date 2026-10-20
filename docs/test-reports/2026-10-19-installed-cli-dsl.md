# 本地 CLI 重新安装及 DSL 实测

日期：2026-10-19。代码版本：`957a029`。本轮使用安装到 PATH 的全局 `wjx` 执行实际站点请求。

## 卸载与本地安装

先执行 `npm uninstall -g wjx-cli`，确认 `wjx` 命令已移除、本地源码仍在。随后依次构建 SDK 和 CLI，执行 `npm link ./wjx-cli --offline --no-audit --no-fund`。

安装后 `wjx --version` 返回 `0.4.4`。全局 npm 包链接到 `D:\workspace\Github\wjx-ai-kit\wjx-cli`，依赖解析到本地 `wjx-api-sdk\dist\index.js`。`survey create` 和 `survey update` 均提供 `--dsl` 参数，修改动作使用 `1000109`。

## 测试结果

| 验证范围 | 结果 |
|---|---:|
| 安装后命令检查：旧 DSL 命令移除、修改 dry-run 请求 | 2/2 |
| 安装后全局 CLI 调用测试站点的创建／修改／查询流程 | 13/13 |
| 本地 CLI 定向回归与 HTTP fixture | 21/21 |

真实请求使用既有本机凭据，目标站点为 `http://tanhao.sojump.cn`。覆盖无 DSL 创建、用户完整 OR 示例、DSL 优先于旧 JSON 关联字段、仅修改逻辑时保留内容及其他规则、隐藏与恢复显示、清除最后规则、完整 JSON 与 DSL 更新、跳转、非法引用和新旧跳转循环拒绝。

查询确认不再返回新增的 `questions[].relation`，逻辑从实际 XML 提取为完整 `dsl.logic`，无规则时返回明确空模块。成功的修改由安装后的 CLI 读回确认 `outcome=verified`；非法引用、循环和未授权结构改写均验证原内容与版本未改变。

批量修改多道题或多个选项文本会触发既有的保守结构保护。本轮首次完整更新用例未显式授权，因此被正确拒绝；随后分别验证了默认拒绝、原题目不变的普通完整更新，以及专用无答卷草稿传 `allowBreakingChanges=true` 后的完整更新成功。未修改产品代码或放宽保护。

## 草稿清理与复跑

三次测试运行共创建 6 份草稿：`220127`、`220121`、`220123`、`220069`、`220068`、`220071`。全部保持未发布，并在测试结束后移入回收站，逐份读回确认 `status=3`。未执行彻底删除。

- [最终 15 项结果](2026-10-19-installed-cli-dsl/results.json)
- [全部草稿清理确认](2026-10-19-installed-cli-dsl/cleanup-results.json)
- [可复跑脚本](../../tests/survey-json-logic-integration/Run-InstalledCliLogic.mjs)

```powershell
node .\tests\survey-json-logic-integration\Run-InstalledCliLogic.mjs
```

脚本通过全局 `wjx` 和 stdin 提交请求，使用已有配置，不保存凭据或原始响应。本轮未做浏览器逐题点击测试。
