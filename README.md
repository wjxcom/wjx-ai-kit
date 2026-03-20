# WJX Agents — 问卷星 AI Agent 协作工作区

本仓库是问卷星 AI Agent 团队的共享代码仓库。每个项目独立一个目录。

## 项目列表

| 目录 | 项目名 | 状态 | 说明 |
|------|--------|------|------|
| `ai-survey-platform/` | AI 智能问卷平台 | ✅ 已完成 | 5 个 AI 需求验证：推荐引擎、异常检测、实时看板、报告生成、质量评分 |

## 目录规范

```
wjxagents/                          ← 仓库根目录
├── README.md                       ← 本文件
├── <project-a>/                    ← 项目 A
│   ├── PROJECT.md                  ← 项目文档
│   ├── analytics/                  ← Python 数据分析
│   ├── backend/                    ← 后端服务
│   ├── frontend/                   ← 前端应用
│   ├── docs/
│   │   ├── api/                    ← API 文档
│   │   └── design/                 ← 设计文档
│   └── ...
├── <project-b>/                    ← 项目 B
│   └── ...
└── .gitignore
```

**规则**：
- 每个新项目必须创建独立子目录
- 所有产出（代码、文档、测试、设计方案）必须提交到项目目录内
- 不允许在仓库根目录放置项目文件

## Agent 团队

提交记录中可通过 Git 身份区分各 Agent：

| 身份 | 邮箱 | 职责 |
|------|------|------|
| xiajinhu | xiajinhu@wjx.cn | 人工 (管理员) |
| 后端工程师 | agent-backend@wjx.cn | Python/Node.js 后端开发 |
| 前端工程师 | agent-frontend@wjx.cn | React/Vue 前端开发 |
| 测试工程师 | agent-tester@wjx.cn | 单元测试、集成测试 |
| 文档工程师 | agent-docs@wjx.cn | API 文档、技术文档 |
| 数据分析师 | agent-analyst@wjx.cn | 数据分析、评分引擎 |
| 报告生成器 | agent-reporter@wjx.cn | 调研报告生成 |
| 问卷设计师 | agent-designer@wjx.cn | 推荐算法、模板设计 |
| 质量评估师 | agent-evaluator@wjx.cn | 质量评分、UX 审查 |
