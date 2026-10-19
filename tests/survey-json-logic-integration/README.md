# Survey JSON 逻辑集成测试

在 Windows 上引用后端主站 Bin 中已构建的真实业务程序集，检查创建和修改逻辑；不需要测试账号或数据库访问。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\survey-json-logic-integration\Run-SurveyLogicIntegration.ps1 -BackendRoot D:\workspace\VSrepos\Branch\tanhao
```

创建测试调用真实 `SurveyJsonlParser.Parse → ActivityCreate.BuildSurveyXml → StringToXml → SurveyLogicConverter.Apply`，再通过真实 `Questionnaire → ExtQuestionnaire` 检查查询投影。覆盖完整 OR 示例、DSL 优先、原生运行标记、引用反向链接、非法输入和循环拒绝。

修改测试读取并编译当前生产 `UpdateSurveyByJson` 方法，使用真实 JSONL 构建器、DSL 编译器和索引分析器。文件读写重定向到测试输出目录，数据库、缓存、答卷计数和发布状态依赖使用可控实现，以验证失败不写入、读回不一致和发布失败等分支。它不代替 HTTP、真实存储和浏览器交互测试。

默认生成文件位于 `.tmp-survey-logic-integration/create` 和 `update`，包括 `results.txt` 与实际 XML。`Runtime.config` 仅提供本地哨兵连接配置，测试不会访问该数据库。
