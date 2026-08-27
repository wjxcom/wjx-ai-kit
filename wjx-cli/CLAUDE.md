# wjx-cli 项目指令

## 项目背景

wjx-cli 是 `wjx-ai-kit` monorepo 的第三个包，与 `wjx-api-sdk`、`wjx-mcp-server` 并列。
monorepo 根目录：`wjx-ai-kit/`，使用 npm workspaces。

当前包版本以各自 `package.json` 为准：SDK 0.3.1、MCP Server 0.3.1、CLI 0.3.5。
测试数量会随功能变化，使用各 workspace 的 `npm test` 获取实时结果。

## 关键文件

- SDK barrel：`wjx-api-sdk/src/index.ts`（公开导出以源码为准）
- SDK 类型示例：`wjx-api-sdk/src/modules/survey/types.ts`
- SDK client 示例：`wjx-api-sdk/src/modules/survey/client.ts`
- MCP tools 参考：`wjx-mcp-server/src/modules/survey/tools.ts`
- monorepo root：`wjx-ai-kit/package.json`

## 技术栈

- Node.js >= 20, TypeScript, ESM (`"type": "module"`)
- Commander.js（CLI 框架）
- wjx-api-sdk（workspace 依赖，已配置 `"wjx-api-sdk": "*"`）
- 认证：`~/.wjxrc` 配置文件（`wjx init`）/ `WJX_API_KEY` 环境变量 / `--api-key` 参数

## SDK 函数签名模式

所有 SDK 函数遵循统一的 3 参数模式：

```typescript
export async function listSurveys(
  input: ListSurveysInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<unknown>>
```

CLI 调用时只需传 input + credentials：
```typescript
const creds = { apiKey: process.env.WJX_API_KEY };
const result = await listSurveys({ page_index: 1 }, creds);
```

## 测试环境

- `WJX_BASE_URL` 可设为自定义域名（默认 `https://www.wjx.cn`）
- `WJX_API_KEY` 在 `.env` 文件中（检查 `wjx-ai-kit/wjx-mcp-server/.env` 或 `wjx-ai-kit/.env`）
- 真实 API 调用验证：`wjx survey list` 应返回问卷列表

## 编码规范

- 遵循 wjx-api-sdk 的代码风格（2 空格缩进、双引号、分号）
- 每个命令文件导出一个 `register*Commands(program: Command)` 函数
- 错误统一通过 `handleError(e)` 处理，非零 exit code
- JSON 输出默认，`--table` 可选
- 命令实现遵循 `CommandSpec` 与 Runtime 生命周期：解析/归一化/校验必须无网络，确认与 dry-run 在执行前完成，实际 SDK 调用和统一输出由 Runtime 负责。

## 构建和测试

```bash
cd wjx-ai-kit
npm install                    # workspace 安装（会装 commander）
cd wjx-cli
npm run build                  # tsc 编译
npm test                       # node --test
node dist/index.js survey list # 手动测试
```

## Git

- 当前分支：`develop`
- 远程：GitHub
- 提交后手动推送到 origin/develop
