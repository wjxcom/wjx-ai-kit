# 旧 DSL 方案迁移

完整 XML DSL 的独立接口已删除，创建与修改统一为 Survey JSON，逻辑通过可选 dsl.logic 提交，由服务端转换成 XML 原生属性。

当前接口与流程见 [题目逻辑与 Survey JSON](../reference/wjx-xml-dsl-v1.md)。
