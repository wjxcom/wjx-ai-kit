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
3. 已通过 API 将以下 Agent 切换为 **`gemini_local`**（**统一模型**：优先 `gemini-3.1-pro`；若本机/账号不可用则使用 **`gemini-3.1-pro-preview`**。当前配置为 **`gemini-3.1-pro-preview`**（实测 `3.1-pro` 曾返回 503，`preview` 在 `cwd=/home/claw/wjxagents` 下 headless 返回 OK），`cwd: /home/claw/wjxagents`，`timeoutSec: 900`）：
   - **问卷设计师** `2fcd825f-1dea-4993-94d3-57fdcb2bcf8e`
   - **报告生成器** `b8354d18-89ef-4fd5-be48-5517146301a4`
4. 已清除 **问卷设计师**、**质量评估师** 上过时的 `metadata`（原「gemini 未发布」说明）。

> **升级注意**：下次 `npx` 重新拉取依赖可能覆盖 `constants.js`，若 API 再次拒绝 `gemini_local`，需重复上述补丁或等待上游在 `@paperclipai/shared` 中正式加入枚举。

## Gemini CLI 本机检测结果

在 headless 模式下执行：

```bash
cd /home/claw/wjxagents
gemini -p "Reply only: OK" -m gemini-3.1-pro-preview -o text --approval-mode plan
# 若需正式版：-m gemini-3.1-pro（账号需有可用配额；否则常见 503）
```

若报错 **`503` / `No available Gemini accounts`**，请在 **运行 Paperclip 的同一台机器** 上完成 `gemini auth login` 或配置 API Key。

## 全链路验证（本机）

1. **CLI**：在 `cd /home/claw/wjxagents` 下  
   `gemini -p "Reply only: OK" -m gemini-3.1-pro-preview -o text --approval-mode plan` → **exit 0**，输出含 **`OK`**。  
   同环境 `-m gemini-3.1-pro` 曾出现 **503**（无可用账号/路由），故 Agent 统一用 **preview**；若你方 **pro 稳定可用**，可将 `adapterConfig.model` 改为 `gemini-3.1-pro`。  
2. **Paperclip API**：`PATCH` 后 `GET /api/agents/:id` → `adapterType=gemini_local`，`model=gemini-3.1-pro-preview`。  
3. **Heartbeat**：  
   - **问卷设计师** `2fcd825f-...`：`heartbeat run --timeout-ms 120000` → **`succeeded`**（日志 `init.model` 为 `gemini-3.1-pro-preview`，inbox 空则正常退出）。  
   - **报告生成器** `b8354d18-...`：若遇 **旧 session** 异常，先 `POST /api/agents/<id>/runtime-state/reset-session`；再跑 heartbeat → **`succeeded`**（`--model gemini-3.1-pro-preview`）。

## 上游期望

建议在 [paperclip](https://github.com/paperclipai/paperclip) 侧将 `gemini_local` 纳入 `AGENT_ADAPTER_TYPES`，避免每个实例手工改 `node_modules`。
