# Survey JSON 逻辑集成测试

在 Windows 上引用后端主站 Bin 中已构建的真实业务程序集，检查创建和修改逻辑；不需要测试账号或数据库访问。

```powershell
npm run build --workspace=wjx-api-sdk
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\survey-json-logic-integration\Run-SurveyLogicIntegration.ps1 -BackendRoot D:\workspace\VSrepos\Branch\tanhao
```

创建测试调用真实 `SurveyJsonlParser.Parse → ActivityCreate.BuildSurveyXml → StringToXml → SurveyLogicConverter.Apply`，再通过真实 `Questionnaire → ExtQuestionnaire` 检查查询投影。覆盖完整 OR 示例、DSL 优先、原生运行标记、引用反向链接、非法输入和循环拒绝。

查询投影不包含新增的 `questions[].relation`。OpenAPI 在查询题目时返回完整 `dsl.logic`，无规则时明确返回 `logic {\n};`。Node.js 用例将真实程序集生成的查询结果交给 SDK，验证条件显示、清除最后一条规则、隐藏和原生 `Relation=0`，并确保缺失逻辑投影不能误判为保存成功。

修改测试读取并编译当前生产 `UpdateSurveyByJson` 方法，使用真实 JSONL 构建器、DSL 编译器和索引分析器。文件读写重定向到测试输出目录，数据库、缓存、答卷计数和发布状态依赖使用可控实现，以验证失败不写入、读回不一致和发布失败等分支。它不代替 HTTP、真实存储和浏览器交互测试。

默认生成文件位于 `.tmp-survey-logic-integration/create` 和 `update`，包括 `results.txt` 与实际 XML。`Runtime.config` 仅提供本地哨兵连接配置，测试不会访问该数据库。

## 测试安装后的全局 CLI

先构建并从当前仓库安装 CLI，然后运行：

```powershell
node .\tests\survey-json-logic-integration\Run-InstalledCliLogic.mjs
```

该入口只调用 PATH 中已安装的 `wjx`，使用已有凭据访问 `http://tanhao.sojump.cn`，请求经 stdin 传入。它创建两份专用草稿，验证用户完整 OR 示例、JSON 逻辑与 DSL 的优先级、仅逻辑修改、显隐、清除最后一条规则、完整 JSON 更新和非法逻辑拒绝。测试结束在 `finally` 中将草稿移入回收站，并读回核对 `status=3`。

结果默认写入 `.tmp-installed-cli-dsl/installed-cli-logic-results.json`，只记录断言、问卷编号与清理状态。可用首个位置参数指定输出目录，用 `WJX_INSTALLED_TEST_PROFILE` 选择已有 profile；脚本不保存凭据或原始接口响应。
