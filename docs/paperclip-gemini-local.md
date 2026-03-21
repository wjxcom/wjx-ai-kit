# Paperclip + Gemini（gemini_local）说明

## 版本

- `paperclipai` CLI：**2026.318.0**（`npm view paperclipai version`）
- 运行时已注册 `@paperclipai/adapter-gemini-local`，但 **`@paperclipai/shared` 的 `AGENT_ADAPTER_TYPES` 曾未包含 `gemini_local`**，导致 `PATCH /api/agents/:id` 校验报 `Invalid enum value`——这与 **aigocode 余额** 无关，属于 **发布包枚举遗漏**。

## 本环境已做处理

0. 可重复执行仓库脚本（等价于下方手工步骤）：  
   `bash scripts/patch-paperclip-gemini-enum.sh`

1. 在本地 npx 缓存的 `@paperclipai/shared/dist/constants.js` 中，于 `AGENT_ADAPTER_TYPES` 数组末尾增加 **`"gemini_local"`**（两处缓存路径需一致）：
   - `~/.npm/_npx/43414d9b790239bb/node_modules/@paperclipai/shared/dist/constants.js`
   - `~/.npm/_npx/0aa74679bec75e15/node_modules/@paperclipai/shared/dist/constants.js`
2. **重启** `paperclipai run`，使进程重新加载 `shared`。
3. 已通过 API 将以下 Agent 切换为 **`gemini_local`**（`model: gemini-2.5-pro`，`cwd: /home/claw/wjxagents`，`timeoutSec: 900`）：
   - **问卷设计师** `2fcd825f-1dea-4993-94d3-57fdcb2bcf8e`
   - **报告生成器** `b8354d18-89ef-4fd5-be48-5517146301a4`
4. 已清除 **问卷设计师**、**质量评估师** 上过时的 `metadata`（原「gemini 未发布」说明）。

> **升级注意**：下次 `npx` 重新拉取依赖可能覆盖 `constants.js`，若 API 再次拒绝 `gemini_local`，需重复上述补丁或等待上游在 `@paperclipai/shared` 中正式加入枚举。

## Gemini CLI 本机检测结果

在 headless 模式下执行：

```bash
gemini -p "Say OK" -m gemini-2.5-flash-lite -o text --approval-mode plan
```

若报错 **`503` / `No available Gemini accounts`**，请在 **运行 Paperclip 的同一台机器** 上完成：

- `gemini auth login`，或  
- 配置 `GEMINI_API_KEY` / `GOOGLE_API_KEY`（见 Gemini CLI 文档）。

否则 `gemini_local` Agent 的 heartbeat 会在调用 CLI 时失败。

## Heartbeat 实测（本机）

对 **问卷设计师** 执行 `paperclipai heartbeat run` 后，日志显示已走 **Gemini CLI**，但因 **`No available Gemini accounts`（503）** 重试直至超时——说明 **Paperclip → gemini_local 适配器链路已通**，缺的是 **本机 Gemini 账号 / API Key 登录**。

## 上游期望

建议在 [paperclip](https://github.com/paperclipai/paperclip) 侧将 `gemini_local` 纳入 `AGENT_ADAPTER_TYPES`，避免每个实例手工改 `node_modules`。
