# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-03-30

### Added

- **8 模块、50+ API 函数**，覆盖问卷星 OpenAPI 全部功能
  - Survey: 问卷 CRUD、状态管理、设置读写、标签、回收站、文件上传
  - Response: 答卷查询、下载、统计、代填、改分、360 报告、清空
  - Contacts: 联系人、管理员、部门、标签的增删改查
  - User System: 参与者管理、活动绑定、问卷分配查询
  - Multi-User: 子账号增删改恢复、列表查询
  - SSO: 子账号/用户体系/合作伙伴/问卷创建编辑的免登录链接生成
  - Analytics: 答卷解码、NPS、CSAT、异常检测、指标对比、推送解密
- **DSL 文本转换器**: `surveyToText` / `textToSurvey` 双向转换
- **`ParsedSurvey` / `ParsedQuestion` 类型** 用于 DSL 解析结果
- **`buildPreviewUrl`** 生成问卷预览 URL
- **`setCredentialProvider`** 支持自定义凭据获取逻辑
- **完整类型定义**: 所有输入/输出均有 TypeScript 类型
- **598 个测试** 全部通过
