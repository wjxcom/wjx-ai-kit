# wjx-cli 实现计划

## 概述

wjx-cli 是 wjx-ai-kit monorepo 中的命令行工具，直接调用 wjx-api-sdk 的 50+ 函数，为 AI Agent 和人类用户提供终端访问问卷星 OpenAPI 的能力。

## 架构

```
wjx <noun> <verb> [options]
```

- **默认输出**: JSON（管道友好）
- **可选输出**: `--table`（人类友好）
- **认证**: `--api-key` 参数 > `WJX_API_KEY` 环境变量 > `~/.wjxrc` 配置文件（`wjx init` 初始化）
- **CLI 框架**: Commander.js
- **依赖**: wjx-api-sdk（workspace 链接，已配置）

## 目录结构

```
wjx-cli/
  src/
    index.ts              # 入口，#!/usr/bin/env node + Commander program
    commands/
      init.ts             # wjx init（交互式配置向导）
      diagnostics.ts      # wjx whoami / wjx doctor
      survey.ts           # wjx survey <verb>
      response.ts         # wjx response <verb>
      contacts.ts         # wjx contacts <verb>
      department.ts       # wjx department <verb>
      admin.ts            # wjx admin <verb>
      tag.ts              # wjx tag <verb>
      user-system.ts      # wjx user-system <verb>
      account.ts          # wjx account <verb>
      sso.ts              # wjx sso <verb>
      analytics.ts        # wjx analytics <verb>
    lib/
      auth.ts             # API Key 读取（--api-key > env > ~/.wjxrc）
      config.ts           # ~/.wjxrc 配置文件读写 + applyConfigToEnv()
      command-helpers.ts  # executeCommand()、strictInt()、requireField()
      stdin.ts            # stdin JSON 读取 + source-aware merge
      output.ts           # JSON / table 格式化
      errors.ts           # 统一错误处理 + exit code
  tsconfig.json
  __tests__/
    survey.test.mjs       # 命令解析 + mock SDK 测试
    output.test.mjs       # 输出格式化测试
```

## 命令映射

### survey (14 verbs)
| 命令 | SDK 函数 | 必填参数 |
|------|---------|---------|
| `wjx survey create --title "标题"` | createSurvey | title |
| `wjx survey get --vid 123` | getSurvey | vid |
| `wjx survey list` | listSurveys | (无) |
| `wjx survey delete --vid 123 --username x` | deleteSurvey | vid, username |
| `wjx survey status --vid 123 --state 1` | updateSurveyStatus | vid, state |
| `wjx survey settings --vid 123` | getSurveySettings | vid |
| `wjx survey update-settings --vid 123` | updateSurveySettings | vid |
| `wjx survey tags --vid 123` | getQuestionTags | vid |
| `wjx survey tag-details --vid 123 --q_index 1` | getTagDetails | vid, q_index |
| `wjx survey clear-bin` | clearRecycleBin | (无) |
| `wjx survey upload --vid 123 --file x` | uploadFile | vid, base64/file |
| `wjx survey url --vid 123` | buildSurveyUrl | vid |

### response (11 verbs)
| 命令 | SDK 函数 | 必填参数 |
|------|---------|---------|
| `wjx response query --vid 123` | queryResponses | vid |
| `wjx response realtime --vid 123` | queryResponsesRealtime | vid |
| `wjx response download --vid 123` | downloadResponses | vid |
| `wjx response submit --vid 123 --data x` | submitResponse | vid, submitdata, inputcosttime |
| `wjx response modify --vid 123` | modifyResponse | vid |
| `wjx response clear --vid 123` | clearResponses | vid |
| `wjx response report --vid 123` | getReport | vid |
| `wjx response files --vid 123` | getFileLinks | vid |
| `wjx response winners --vid 123` | getWinners | vid |
| `wjx response 360-report --vid 123` | get360Report | vid |

### contacts (3 verbs)
| 命令 | SDK 函数 |
|------|---------|
| `wjx contacts query` | queryContacts |
| `wjx contacts add --data x` | addContacts |
| `wjx contacts delete --sampleids x` | deleteContacts |

### department (4 verbs)
| 命令 | SDK 函数 |
|------|---------|
| `wjx department list` | listDepartments |
| `wjx department add --name x` | addDepartment |
| `wjx department modify --id x` | modifyDepartment |
| `wjx department delete --id x` | deleteDepartment |

### admin (3 verbs)
| 命令 | SDK 函数 |
|------|---------|
| `wjx admin add --mobile x --roleid x` | addAdmin |
| `wjx admin delete --userid x` | deleteAdmin |
| `wjx admin restore --userid x` | restoreAdmin |

### tag (4 verbs)
| 命令 | SDK 函数 |
|------|---------|
| `wjx tag list` | listTags |
| `wjx tag add --name x` | addTag |
| `wjx tag modify --tagid x` | modifyTag |
| `wjx tag delete --tagid x` | deleteTag |

### user-system (6 verbs)
| 命令 | SDK 函数 |
|------|---------|
| `wjx user-system add-participants --vid x` | addParticipants |
| `wjx user-system modify-participants --vid x` | modifyParticipants |
| `wjx user-system delete-participants --vid x` | deleteParticipants |
| `wjx user-system bind --vid x` | bindActivity |
| `wjx user-system query-binding --vid x` | querySurveyBinding |
| `wjx user-system query-surveys --vid x` | queryUserSurveys |

### account (5 verbs)
| 命令 | SDK 函数 |
|------|---------|
| `wjx account list` | querySubAccounts |
| `wjx account add --username x` | addSubAccount |
| `wjx account modify --userid x` | modifySubAccount |
| `wjx account delete --userid x` | deleteSubAccount |
| `wjx account restore --userid x` | restoreSubAccount |

### sso (3 verbs)
| 命令 | SDK 函数 |
|------|---------|
| `wjx sso subaccount-url` | buildSsoSubaccountUrl |
| `wjx sso user-system-url` | buildSsoUserSystemUrl |
| `wjx sso partner-url` | buildSsoPartnerUrl |

### analytics (6 verbs)
| 命令 | SDK 函数 |
|------|---------|
| `wjx analytics decode --vid x` | decodeResponses |
| `wjx analytics nps --vid x` | calculateNps |
| `wjx analytics csat --vid x` | calculateCsat |
| `wjx analytics anomalies --vid x` | detectAnomalies |
| `wjx analytics compare --vid x` | compareMetrics |
| `wjx analytics decode-push --payload x` | decodePushPayload |

## 实现分期

### Phase 1: 基础框架 + survey 模块
1. 安装 commander 依赖
2. 创建 tsconfig.json
3. 实现 src/lib/auth.ts（token 读取）
4. 实现 src/lib/output.ts（JSON/table 格式化）
5. 实现 src/lib/errors.ts（统一错误处理）
6. 实现 src/index.ts（Commander program 入口）
7. 实现 src/commands/survey.ts（12 个 verb）
8. 编写测试
9. 验证：`wjx survey list` 真实调用测试环境

### Phase 2: response + contacts 系列
1. src/commands/response.ts（10 个 verb）
2. src/commands/contacts.ts（3 个 verb）
3. src/commands/department.ts（4 个 verb）
4. src/commands/admin.ts（3 个 verb）
5. src/commands/tag.ts（4 个 verb）
6. 测试

### Phase 3: 剩余模块
1. src/commands/user-system.ts（6 个 verb）
2. src/commands/account.ts（5 个 verb）
3. src/commands/sso.ts（3 个 verb）
4. src/commands/analytics.ts（6 个 verb）
5. 测试

### Phase 4: DX 增强（可选）
1. `wjx completion`（bash/zsh/fish 自动补全）
2. `wjx config`（配置文件管理）
3. `--dry-run` 预览
4. stdin 管道输入

## 每个命令的实现模式

所有命令遵循同一模式：

```typescript
import { Command } from "commander";
import { listSurveys } from "wjx-api-sdk";
import { getCredentials } from "../lib/auth.js";
import { formatOutput } from "../lib/output.js";
import { handleError } from "../lib/errors.js";

export function registerSurveyCommands(program: Command): void {
  const survey = program.command("survey").description("问卷管理");

  survey
    .command("list")
    .description("列出问卷")
    .option("--page <n>", "页码", parseInt)
    .option("--page_size <n>", "每页数量", parseInt)
    .action(async (opts) => {
      try {
      const creds = getCredentials(program.opts());
        const result = await listSurveys(
          { page: opts.page, page_size: opts.page_size },
          creds,
        );
        formatOutput(result, program.opts());
      } catch (e) {
        handleError(e);
      }
    });
}
```

## 测试环境

- `WJX_BASE_URL=https://tanhao.sojump.cn`
- apikey 在 `.env` 文件中（项目根目录或 wjx-mcp-server/.env）
- 验证命令：`WJX_BASE_URL=https://tanhao.sojump.cn WJX_API_KEY=<api_key> wjx survey list`

## 成功标准

1. `npm run build` 编译通过
2. `npm test` 全部通过
3. `wjx survey list` 真实调用测试环境返回数据
4. `wjx survey list --table` 输出人类可读表格
5. `wjx survey list | jq .` 管道输出有效 JSON
