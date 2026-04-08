# 版本检查

检查问卷网 Skill 的当前版本是否需要更新。

## 接口说明

- **URL**: `https://www.wenjuan.com/app_api/skills/v1/version/check`
- **方法**: GET
- **认证**: 不需要签名或 JWT Token

## 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `current_version` | string | 否 | 当前版本号；脚本默认传 **package.json 的 `version`** |

## 响应数据结构

```json
{
  "status": 200,
  "status_code": 1,
  "data": {
    "current_version": "",
    "release_note": "",
    "instruction": "",
    "has_update": false,
    "latest": "1.0.0"
  }
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | int | HTTP 状态码 |
| `status_code` | int | 业务状态码，1 表示成功 |
| `data.current_version` | string | 当前版本号（请求传入） |
| `data.latest` | string | 最新版本号 |
| `data.has_update` | bool | 是否有更新可用 |
| `data.release_note` | string | 版本更新说明 |
| `data.instruction` | string | 更新操作指令/提示 |

## 更新判断逻辑

1. 调用接口获取版本信息
2. 检查 `has_update` 字段
   - 如果为 `true`，表示有更新
   - 如果为 `false` 或未返回，可自行比较 `current_version` 和 `latest`
3. 如有更新，遵循 `instruction` 指令进行更新，或提示用户更新

## 退出码（Workerbuddy / CI）

| 码 | 含义 |
|----|------|
| **0** | 检查流程正常结束（**包括**提示「有新版本」）；Workerbuddy 应视为成功 |
| **1** | 仅在使用 **`--fail-on-update`** 且服务端判定有新版本时 |
| **2** | 网络失败、HTTP 错误或非成功业务码 |

默认**不再**因「有新版本」而退出 1，避免无图形/自动化环境把版本提示当成任务失败。若流水线需要在过时版本上失败，请加 **`--fail-on-update`**。

## 使用示例

### 命令行工具

```bash
# 检查版本
node "${SKILL_DIR}/scripts/check_version.js"

# 指定当前版本检查
node "${SKILL_DIR}/scripts/check_version.js" --version 1.0.0

# 自动检查（有更新时才输出）
node "${SKILL_DIR}/scripts/check_version.js" --auto

# 输出原始 JSON
node "${SKILL_DIR}/scripts/check_version.js" --json

# 有新版本时令进程退出 1（CI 严格模式）
node "${SKILL_DIR}/scripts/check_version.js" --fail-on-update
```

### JavaScript 代码

```javascript
const { checkVersion, shouldUpdate } = require('./scripts/check_version');

// 检查版本
const result = await checkVersion();

// 判断是否需要更新
if (shouldUpdate(result)) {
    const data = result.data;
    console.log(`发现新版本: ${data.latest}`);
    console.log(`当前版本: ${data.current_version}`);
    console.log(`更新内容: ${data.release_note}`);
    if (data.instruction) {
        console.log(`更新指引: ${data.instruction}`);
    }
} else {
    console.log("当前已是最新版本");
}
```

### Agent / 集成环境

- **建议**：每天首次会话可运行 `node scripts/check_version.js`（或 `--auto` 有更新才输出）；**默认退出码 0**，勿把「有新版本」当任务失败（除非 CI 使用 `--fail-on-update`）。
- **提示用户**：展示当前版与最新版、`release_note`；**优先展示接口返回的 `instruction`**；勿默认用户已安装 Git 或固定目录名。
- **更新途径（择一）**：Cursor/技能市场重新安装；ZIP（`pack_skill.sh` 生成 `wenjuan-survey-skill-*.zip`）覆盖解压；**仅在用户确认是 Git 克隆且有 Git 时**建议在 Skill 根目录 `git pull`。

## 版本号比较规则

版本号按数字分段比较，支持格式：`x.x.x.x`

- `1.0.0` < `1.0.1`
- `1.0.1` < `1.1.0`
- `1.1.0` < `2.0.0`

## 分发打包

更新 `package.json` / `SKILL.md` frontmatter / `scripts/check_version.js` 中的 **`CURRENT_VERSION`** 保持一致后，可在 Skill 根目录执行：

```bash
./scripts/pack_skill.sh
```

将在**上一级目录**生成 `wenjuan-survey-skill-<version>.zip`（`version` 取自 `package.json`），已排除 `node_modules`、`examples`、`downloads` 与本地 `.wenjuan`（避免打包凭证与本地样例/导出文件）；解压后需在目标环境执行 `npm install`。

## 注意事项

1. 版本检查接口**不需要认证**，可直接调用
2. 脚本默认把 **package.json 的 `version`** 作为 `current_version` 传给接口
3. `instruction` 字段可能包含具体的更新操作指引
4. 建议定期调用此接口检查更新；在 **Workerbuddy** 等环境若曾出现「检查失败」，多为旧版脚本在**有新版本时退出码为 1**，请更新 skill 或改用当前默认退出策略
