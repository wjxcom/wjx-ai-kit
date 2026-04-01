# 新 Session 提示词

复制以下内容作为新 session 的第一条消息：

---

## 任务：实现 wjx-cli Phase 1

我要在 wjx-ai-kit monorepo 中实现 wjx-cli 命令行工具的 Phase 1。

### 上下文

- 工作目录：`wjx-ai-kit/wjx-cli/`
- 完整计划：读 `PLAN.md`（命令映射、目录结构、代码模式、分期策略）
- 项目指令：读 `CLAUDE.md`（技术栈、SDK 函数签名、测试环境、构建方法）
- SDK barrel 文件：`wjx-api-sdk/src/index.ts`
- SDK survey client 参考：`wjx-api-sdk/src/modules/survey/client.ts`
- SDK survey types 参考：`wjx-api-sdk/src/modules/survey/types.ts`

### 当前状态

- wjx-api-sdk v0.1.0 已完成（506 tests），wjx-mcp-server v0.1.0 已完成（216 tests）
- wjx-cli 是骨架：只有 package.json（已配 `wjx-api-sdk: "*"` workspace 依赖）
- 还没有 tsconfig.json、src/ 下无任何代码

### Phase 1 要做的事

1. 安装 commander 依赖：`cd wjx-ai-kit && npm install commander --workspace=wjx-cli`
2. 创建 `tsconfig.json`（参考 wjx-api-sdk 的 tsconfig）
3. 实现 `src/lib/auth.ts` — API Key 读取（env > --api-key 参数）
4. 实现 `src/lib/output.ts` — JSON（默认）/ table 格式化
5. 实现 `src/lib/errors.ts` — 统一错误处理 + process.exit(1)
6. 实现 `src/index.ts` — Commander program 入口 + 全局选项（--api-key, --json, --table, --verbose）
7. 实现 `src/commands/survey.ts` — 12 个 verb（create/get/list/delete/status/settings/update-settings/tags/tag-details/clear-bin/upload/url）
8. 添加 package.json test 脚本
9. 编写测试
10. 真实调用验证：`WJX_BASE_URL=https://tanhao.sojump.cn WJX_API_KEY=<从.env读> node dist/index.js survey list`

### 测试环境

- `WJX_BASE_URL=https://tanhao.sojump.cn`
- apikey 在 `.env` 中（检查 `wjx-ai-kit/wjx-mcp-server/.env` 或 `wjx-ai-kit/.env`）

### 成功标准

- `npm run build` 通过
- `npm test` 通过
- `wjx survey list` 真实返回数据
- `wjx survey list --table` 输出表格
- `wjx survey list | jq .` 输出有效 JSON

先读 PLAN.md 和 CLAUDE.md，然后开始实现。先从最小可运行版本开始（index.ts + auth.ts + output.ts + survey list），跑通一个完整链路后再补全剩余 verb。
