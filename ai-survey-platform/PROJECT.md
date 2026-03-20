# WJX Agents — Paperclip AI Agent 协作验证项目

## 项目概述

本项目是**问卷星 (Wenjuanxing)** 利用 **Paperclip AI** 多 Agent 协作平台完成的一次端到端验证。通过 12 个 AI Agent（覆盖 CEO/CTO/CPO 管理层 + 8 个执行层角色），自主完成了 5 个 AI 相关需求的拆解、分配、编码、测试和文档工作。

**验证目标**：验证多 Agent A2A（Agent-to-Agent）协作在实际产品研发场景中的可行性和产出质量。

**核心数据**：
- 21 个任务完成 / 26 个总任务 (5 个因重复取消) — **完成率 100%**
- 3962 行代码产出（仓库内）+ 2769 行设计文档（workspace 内）
- 涉及 4 种 AI 模型后端：Claude Opus、GPT-5.4 (Codex)、Claude Opus via Cursor、Gemini (待接入)

---

## 5 个验证需求

### 需求 1：AI 智能问卷推荐引擎

**目标**：设计一个根据用户画像和历史行为，智能推荐问卷模板的引擎。

| 任务 | 负责 Agent | 产出 |
|------|-----------|------|
| CMP-1 推荐引擎整体设计 | 首席产品官 (CPO) | 产品方案 |
| CMP-6 推荐算法架构设计 | 问卷设计师 | `recommendation-algorithm-architecture.md` (830 行) — 三种策略 + 冷启动方案 |
| CMP-7 用户画像数据方案 | 数据分析师 | `user_profile_data_plan.md` (266 行) — 画像维度与评估指标 |
| CMP-8 推荐质量评估框架 | 质量评估师 | `recommendation-quality-evaluation-framework.md` (244 行) |
| CMP-24 数据分析脚本 | 后端工程师 | Python 数据分析实现 |

**推荐算法三策略**：
1. 基于内容的协同过滤（问卷标签 + 用户行为向量余弦相似度）
2. 基于用户的协同过滤（相似用户偏好迁移）
3. 混合策略（加权融合 + 冷启动兜底）

---

### 需求 2：问卷答题异常检测

**目标**：开发 Python 脚本，自动检测问卷中的刷票、机器人、敷衍作答等异常行为。

| 任务 | 负责 Agent | 产出 |
|------|-----------|------|
| CMP-2 异常检测需求设计 | CTO | 需求拆解 |
| CMP-13 异常检测脚本实现 | 后端工程师 (Codex) | `analytics/anomaly_detection.py` (352 行) |
| CMP-18 单元测试 | 测试工程师 (Claude Opus) | `analytics/test_anomaly_detector.py` (764 行) |

**四种检测模式**：

| 检测器 | 原理 | 关键参数 |
|--------|------|---------|
| 答题时间异常 | 答题时长 < 阈值视为刷题 | `min_seconds_per_question` |
| 连续相同选项 | 连续 N 题选同一选项 | `max_consecutive_same` |
| 重复提交 | 同 IP/设备指纹多次提交 | `max_submissions_per_ip` |
| 答案相似度 | 开放题 TF-IDF + 余弦相似度 | `similarity_threshold` |

**测试覆盖**：764 行测试代码，覆盖 4 种检测器 × 正常/异常/边界数据。

---

### 需求 3：问卷数据实时可视化看板

**目标**：开发前后端完整的实时统计看板，支持问卷答题进度、各题型分布、趋势图的可视化展示。

| 任务 | 负责 Agent | 产出 |
|------|-----------|------|
| CMP-3 看板需求设计 | CTO | 需求拆解与分配 |
| CMP-19 API 契约定义 | 后端工程师 (Codex) | `backend/src/types/survey-realtime-stats.ts` (55 行) |
| CMP-20 API 端点实现 | 后端工程师 (Codex) | `backend/src/services/realtimeStatsService.ts` (216 行) + 路由 |
| CMP-21 React 看板组件 | 前端工程师 (Cursor) | 6 个 React 组件 (1076 行) |
| CMP-22 前后端测试 | 测试工程师 (Claude Opus) | `frontend/__tests__/` (427 行) + `backend/__tests__/` (366 行) |
| CMP-23 API 文档 | 文档工程师 (Claude Opus) | `docs/api/survey-realtime-stats.md` (264 行) |

**前端组件架构**：

```
SurveyDashboard (主控制器, 轮询刷新)
├── ProgressBar      — 答题进度条 (目标/已答/完成率)
├── PieChart         — 单选题选项分布饼图
├── BarChart         — 量表题分值分布柱状图
└── TimelineChart    — 答题趋势时间线折线图
```

**API 端点**：`GET /api/surveys/{id}/realtime-stats`
- 返回：总量/已答/完成率 + 各题统计 + 时间线数据
- 支持题型：单选 (singleChoice)、多选 (multiChoice)、量表 (scale)、开放题 (openText)

---

### 需求 4：AI 驱动调研报告自动生成

**目标**：构建从原始问卷数据到 Markdown 格式调研报告的自动化流水线。

| 任务 | 负责 Agent | 产出 |
|------|-----------|------|
| CMP-4 流水线设计 | CEO → CPO 路由 | 需求拆解 |
| CMP-25 报告生成模块 | 后端工程师 (Codex) | Markdown 报告生成引擎 |
| CMP-26 流水线测试 | 测试工程师 (Claude Opus) | 66 个测试用例, 100% 覆盖 |

**流水线四阶段**：
1. **数据加载** (data_loader) — CSV/JSON 数据导入与清洗
2. **统计分析** (analyzer) — 描述统计 + 交叉分析 + NPS 计算
3. **图表生成** (chart_generator) — matplotlib 可视化
4. **报告输出** (report_generator) — Markdown 模板渲染

---

### 需求 5：问卷质量自动评分系统

**目标**：设计并实现多维度问卷质量评分体系，自动评估问卷设计质量并给出改进建议。

| 任务 | 负责 Agent | 产出 |
|------|-----------|------|
| CMP-5 评分系统设计 | CPO | 产品方案 |
| CMP-9 评分模型设计 | 质量评估师 | `questionnaire-quality-scoring-model.md` (420 行) |
| CMP-10 评分引擎实现 | 数据分析师 (Codex) | `scoring_engine.py` (209 行) + 测试 |
| CMP-11 报告模板设计 | 报告生成器 | `scoring-report-template.md` (1009 行) |

**四维度评分体系**：

| 维度 | 权重 | 评估内容 |
|------|------|---------|
| 结构完整性 | 30% | 题目数量合理性、逻辑跳转、分页设计 |
| 题目质量 | 30% | 表述清晰度、选项互斥完备、量表平衡性 |
| 用户体验 | 25% | 预计时长、移动端适配、进度提示 |
| 数据价值 | 15% | 分析维度覆盖、交叉分析可能性、关键指标含量 |

---

## Agent 协作架构

```
                    ┌──────────────┐
                    │  首席执行官    │  Claude Opus
                    │  (CEO)       │  战略路由
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │ 首席技术官 │  │ 首席产品官 │  │ OpenClaw │
       │ (CTO)    │  │ (CPO)    │  │ 执行者    │
       │ Claude   │  │ Claude   │  │ (待对接)  │
       └────┬─────┘  └────┬─────┘  └──────────┘
            │              │
     ┌──────┼──────┐  ┌───┼────────┬──────────┐
     ▼      ▼      ▼  ▼   ▼        ▼          ▼
  后端    前端    测试  问卷  数据     质量       报告
  工程师  工程师  工程师 设计师 分析师   评估师     生成器
  Codex  Cursor Claude Claude Codex  Claude    Claude
  5.4    Opus   Opus   Opus   5.4    Opus      Opus
```

---

## 代码仓库结构

```
wjxagents/
├── analytics/                     # Python 数据分析模块
│   ├── anomaly_detection.py       # 问卷异常检测 (4 种检测器)
│   ├── test_anomaly_detection.py  # 基础测试
│   └── test_anomaly_detector.py   # 完整测试 (764 行)
│
├── backend/                       # Node.js/Express API
│   ├── src/
│   │   ├── index.ts               # Express 入口
│   │   ├── routes/
│   │   │   └── realtimeStats.ts   # 实时统计路由
│   │   ├── services/
│   │   │   └── realtimeStatsService.ts  # 统计聚合服务 (216 行)
│   │   └── types/
│   │       └── survey-realtime-stats.ts # TypeScript 类型定义
│   └── __tests__/
│       └── realtimeStats.test.ts  # API 测试 (366 行)
│
├── frontend/                      # React 前端
│   ├── src/
│   │   ├── components/
│   │   │   └── survey-dashboard/  # 看板组件集 (6 个组件, 1076 行)
│   │   ├── types/                 # 前端类型定义
│   │   └── mocks/                 # Mock 数据
│   └── __tests__/
│       └── surveyDashboard.test.tsx  # 组件测试 (427 行)
│
├── docs/
│   └── api/
│       └── survey-realtime-stats.md  # API 文档 (264 行)
│
├── package.json
└── README.md
```

---

## 技术栈

| 层 | 技术 |
|---|------|
| 后端 | Node.js + Express + TypeScript |
| 前端 | React + TypeScript |
| 数据分析 | Python 3.12 + pandas + scikit-learn + matplotlib |
| 测试 | pytest (Python), Jest/Vitest (TypeScript/React) |
| AI Agent 平台 | Paperclip AI (v2026.318.0) |
| 代码托管 | 阿里云 Codeup (wjxagents.git) |

---

## 设计文档索引

以下设计文档位于各 Agent 的 workspace 目录中：

| 文档 | 作者 | 行数 | 路径 |
|------|------|------|------|
| AI 智能问卷推荐引擎 — 算法架构设计 | 问卷设计师 | 830 | `workspaces/2fcd.../recommendation-algorithm-architecture.md` |
| 问卷质量评分报告模板与改进建议 | 报告生成器 | 1009 | `workspaces/b835.../scoring-report-template.md` |
| 问卷质量评分模型设计 (4 维度) | 质量评估师 | 420 | `workspaces/b2ce.../questionnaire-quality-scoring-model.md` |
| 用户画像数据方案与评估指标 | 数据分析师 | 266 | `workspaces/009e.../user_profile_data_plan.md` |
| 推荐结果质量评估框架与 UX 审查标准 | 首席产品官 | 244 | `workspaces/7496.../recommendation-quality-evaluation-framework.md` |
| 问卷实时统计 API 文档 | 文档工程师 | 264 | `docs/api/survey-realtime-stats.md` (已入仓库) |

---

## 验证结论

### 成果

1. **全自主协作可行**：CEO 路由 → CTO/CPO 拆解 → 执行层编码/测试/文档，全链路无人工干预
2. **多模型混合有效**：Claude Opus (创意+分析) + Codex GPT-5.4 (编码) + Cursor Opus (前端) 各司其职
3. **产出质量可用**：代码含类型定义、错误处理、单元测试；设计文档含完整方案和评估体系
4. **测试覆盖充分**：异常检测 764 行测试 / 看板 793 行测试 / 报告流水线 66 用例 100% 覆盖

### 待改进

1. **Git worktree 隔离未完全生效**：部分任务仍在 agent home 目录执行，未使用 git worktree 分支隔离
2. **Gemini 适配器未接入**：服务端 adapterType 枚举缺少 `gemini_local`，需升级 Paperclip
3. **Agent 间代码引用**：测试工程师需跨 workspace 查找源码，效率有损耗
4. **OpenClaw 执行者未对接**：openclaw_gateway WebSocket 连接需手动配置

### 关键指标

| 指标 | 值 |
|------|-----|
| 总任务数 | 26 |
| 完成任务 | 21 (5 个因重复取消) |
| 完成率 | 100% |
| 代码行数 | 3,962 行 (仓库内) |
| 设计文档 | 2,769 行 (workspace 内) |
| 参与 Agent | 11 (+ 1 待对接) |
| 迭代轮次 | 30 + 5 (质量迭代) |
