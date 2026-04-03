# Changelog

All notable changes to this project will be documented in this file.

## [0.1.3] - 2026-04-03

### Changed

- **移除 `username` 参数**: user-system 模块的 6 个接口（addParticipants、modifyParticipants、deleteParticipants、addUserMapping、deleteUserMapping、bindUserMapping）不再接受 `username`，与 C# 服务端对齐
- **移除 `clientIp` 凭据字段**: WjxCredentials 不再包含 clientIp
- **扩展 `additional_setting` 默认值**: getSurveySettings 默认从 `[1000-1005]` 扩展为 `[1000-1007]`（新增 1006=数据推送, 1007=文件夹）

### Fixed

- **评分量表 0 分被覆写**: text-to-survey 解析器不再将 `item_score=0` 视为未设置

## [0.1.2] - 2026-03-31

### Changed

- **环境变量重命名**: `WJX_TOKEN` → `WJX_API_KEY`
- **类型重命名**: `WjxCredentials.token` → `WjxCredentials.apiKey`
- 新增 `WJX_CORP_ID` 环境变量支持（通讯录相关操作）

## [0.1.1] - 2026-03-30

### Fixed

- DSL 解析器 `textToSurvey` 扩展支持 12 种题型标签（下拉框、评分单选、评分多选、排序题、判断题、比重题）
- 移除 `querySubAccounts`、`querySurveyBinding`、`queryUserSurveys` 中不存在的分页参数（`page_index`/`page_size`）
- `modifyParticipants` 新增 `auto_create_udept` 参数支持

## [0.1.0] - 2026-03-30

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
