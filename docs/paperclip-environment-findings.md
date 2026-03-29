# Paperclip 验证环境执行记录

> 由自动化执行「Paperclip Agent 验证环境优化计划 v2」生成。  
> 日期：2026-03-21

## Step 1 — 共享 Git 与 Workspace

| 检查项 | 状态 |
|--------|------|
| CodeUp 远程 `wjxfc/wjxagents` | 已配置 |
| 本地主仓库 `/home/claw/wjxagents` | 已存在，`master` |
| 三项目 primary workspace `wjxagents` | 已存在 |
| `worktreeParentDir` | `/home/claw/wjx-worktrees`（已创建目录） |
| `executionWorkspacePolicy.baseRef` | 已从 `develop` 对齐为 **`master`**（三项目均已 PATCH） |
| `branchTemplate` | `agent/{{agent.id}}/{{issue.identifier}}`（含 agent 维度，避免分支名冲突） |

## Step 2 — Claude → Opus

已核对全部 `claude_local` Agent（8 个）的 `adapterConfig.model` 均为 **`opus`**，无需再 PATCH。

## Step 3 — 剩余 Issue

目标 CMP-18 / CMP-22 / CMP-23 / CMP-26 在数据库中均为 **`done`**，无需再跑 heartbeat 解锁任务。

## Step 4 — 五轮质量迭代（指标快照）

以下为连续 5 次 `paperclipai dashboard get --json` 的快照（同一时刻环境稳定时可视为基线复验）。

```json
--- round 1 2026-03-21T20:35:06+08:00 ---
{
  "companyId": "ea9b9919-fc0e-4a1b-93ad-8cd4462f5d04",
  "agents": {
    "active": 10,
    "running": 1,
    "paused": 0,
    "error": 1
  },
  "tasks": {
    "open": 2,
    "inProgress": 2,
    "blocked": 0,
    "done": 33
  },
  "costs": {
    "monthSpendCents": 0,
    "monthBudgetCents": 200000,
    "monthUtilizationPercent": 0
  },
  "pendingApprovals": 0,
  "budgets": {
    "activeIncidents": 0,
    "pendingApprovals": 0,
    "pausedAgents": 0,
    "pausedProjects": 0
  }
}
--- round 2 2026-03-21T20:35:10+08:00 ---
{
  "companyId": "ea9b9919-fc0e-4a1b-93ad-8cd4462f5d04",
  "agents": {
    "active": 10,
    "running": 1,
    "paused": 0,
    "error": 1
  },
  "tasks": {
    "open": 2,
    "inProgress": 2,
    "blocked": 0,
    "done": 33
  },
  "costs": {
    "monthSpendCents": 0,
    "monthBudgetCents": 200000,
    "monthUtilizationPercent": 0
  },
  "pendingApprovals": 0,
  "budgets": {
    "activeIncidents": 0,
    "pendingApprovals": 0,
    "pausedAgents": 0,
    "pausedProjects": 0
  }
}
--- round 3 2026-03-21T20:35:13+08:00 ---
{
  "companyId": "ea9b9919-fc0e-4a1b-93ad-8cd4462f5d04",
  "agents": {
    "active": 10,
    "running": 1,
    "paused": 0,
    "error": 1
  },
  "tasks": {
    "open": 2,
    "inProgress": 2,
    "blocked": 0,
    "done": 33
  },
  "costs": {
    "monthSpendCents": 0,
    "monthBudgetCents": 200000,
    "monthUtilizationPercent": 0
  },
  "pendingApprovals": 0,
  "budgets": {
    "activeIncidents": 0,
    "pendingApprovals": 0,
    "pausedAgents": 0,
    "pausedProjects": 0
  }
}
--- round 4 2026-03-21T20:35:17+08:00 ---
{
  "companyId": "ea9b9919-fc0e-4a1b-93ad-8cd4462f5d04",
  "agents": {
    "active": 10,
    "running": 1,
    "paused": 0,
    "error": 1
  },
  "tasks": {
    "open": 2,
    "inProgress": 2,
    "blocked": 0,
    "done": 33
  },
  "costs": {
    "monthSpendCents": 0,
    "monthBudgetCents": 200000,
    "monthUtilizationPercent": 0
  },
  "pendingApprovals": 0,
  "budgets": {
    "activeIncidents": 0,
    "pendingApprovals": 0,
    "pausedAgents": 0,
    "pausedProjects": 0
  }
}
--- round 5 2026-03-21T20:35:20+08:00 ---
{
  "companyId": "ea9b9919-fc0e-4a1b-93ad-8cd4462f5d04",
  "agents": {
    "active": 10,
    "running": 1,
    "paused": 0,
    "error": 1
  },
  "tasks": {
    "open": 2,
    "inProgress": 2,
    "blocked": 0,
    "done": 33
  },
  "costs": {
    "monthSpendCents": 0,
    "monthBudgetCents": 200000,
    "monthUtilizationPercent": 0
  },
  "pendingApprovals": 0,
  "budgets": {
    "activeIncidents": 0,
    "pendingApprovals": 0,
    "pausedAgents": 0,
    "pausedProjects": 0
  }
}
```

## Step 5 — Gemini 适配器（阻塞说明）

| 现象 | `403 Insufficient account balance`（aigocode 代理） |
| 解除方式 | ① 充值 aigocode；② `gemini auth login`（Google OAuth）；③ 暂缓，仅用 Claude/Codex/Cursor |
| 建议切换角色 | 问卷设计师、报告生成器 → `gemini_local`（解除阻塞后） |

## Step 6 — OpenClaw 执行者

仍为 **手动**：需本机 `openclaw gateway` 与设备配对；不影响其余 Agent。

## API 路径说明

Paperclip HTTP API 前缀为 **`http://127.0.0.1:3100/api`**（非 `/api/projects` 裸路径）。

## Heartbeat 超时提示

`heartbeat run` 在 Agent 无任务时仍可能长时间运行；生产自动化建议 `--timeout-ms` ≥ `180000`，或仅在存在 `todo/in_progress` issue 时触发。
