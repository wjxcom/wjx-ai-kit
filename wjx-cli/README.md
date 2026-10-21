# wjx-cli

问卷星 AI Agent 原生命令行工具。它是 wjx-ai-kit 的默认入口，适用于终端、脚本、CI 和能执行 shell 的 AI 客户端。

## 安装

当前源码版本为 `0.4.5`。发布到 npm 后，registry 的 `latest` 将指向 `0.4.5`：

> 通过 AI 安装并启用 wjx-cli：先执行 `npm install -g wjx-cli@latest`，成功后再执行 `wjx skill install --force`；安装后命令名是 `wjx`，请用 `wjx --version` 验证，不要运行 `wjx-cli --version`。

```bash
npm install -g wjx-cli@latest
wjx skill install --force
wjx init --api-key "你的问卷星 API Key"
wjx doctor
```

### 让 AI 自动完成安装

把下面整段话发给你的 AI 助手。它应按顺序执行，拿到 API Key 前暂停等待，不要跳过最后的连接验收：

```text
请帮我安装并配置问卷星 CLI（wjx-cli）：

0. 预检当前操作系统和 shell。检查 `node --version`、`npm --version`，并在命令可用时先检查 `wjx --version`。Windows 还要用 `Get-Command node,npm,wjx -ErrorAction SilentlyContinue`、`where.exe node`、`where.exe npm`、`where.exe wjx`，并检查 `C:\Program Files\nodejs\node.exe` 和 `%LOCALAPPDATA%\Programs\nodejs\node.exe`。同时记录 `npm prefix -g`，确认 npm 全局 bin 在当前 PATH。一个 shell 报“找不到命令”不能证明软件未安装。

1. 若绝对路径能找到 Node.js，直接用该路径验证版本；若只是当前 shell 的 PATH 未刷新，刷新 PATH 或启动新的 shell 后重新检查。只有确认 Node.js 不存在时才引导我从 https://nodejs.org 安装 LTS；版本低于 20 时停止并引导升级。不要在证据不足时运行 winget、安装器或后台安装进程。安装/升级后必须在新进程再次验证 `node --version` 和 `npm --version`。

2. Node.js >= 20 且 npm 可用后，先检查 `wjx --version`。若 wjx 已存在且版本 >= 0.4.1，跳过重复安装；若 wjx 缺失、版本过低或执行失败，才执行 `npm install -g wjx-cli@latest`。npm 包名是 `wjx-cli`，安装后的命令名是 `wjx`；npm 退出码为 0 不等于安装完成，必须刷新 PATH（如有需要）并再次运行 `wjx --version`。每个命令都要读取自身的真实退出码，不要用 `head`/`tail` 管道的退出码代替。禁止运行 `wjx-cli --version`。确认 CLI 可执行后，再执行 `wjx skill install --force`，并确认技能文件已落盘。

3. 引导我获取问卷星 API Key：
   - 公网用户：让我访问 https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1，微信扫码登录后复制 Key
   - 私有化部署用户：把上面的 www.wjx.cn 换成我的域名（例如 xxx.sojump.cn），登录链接和后续 `--base-url` 必须使用同一个域名
   等我把 Key 发给你（可能还会附带域名）。未收到 Key 前暂停，不要猜测、伪造或从其他文件读取凭据。

4. 拿到 Key 后执行 `wjx init --api-key <我的Key>`；私有化部署用户加 `--base-url https://<我的域名>`。不要在回复、日志或文件中回显完整 API Key，只允许显示脱敏状态。

5. 运行 `wjx doctor` 验证连接；逐项确认 API Key 已配置、Base URL 正确、网络/API 检查通过。任一步失败都不得口述“安装成功”，先报告实际失败阶段和下一步。

6. 最后运行 `wjx survey list --format table` 做一次人工验收，看到真实列表才说明接好了；这一步只用于人类查看，不要用表格推断总数、分页或填写链接。
```

从源码开发时，在 monorepo 根目录执行：

```bash
git clone https://github.com/wjxcom/wjx-ai-kit.git
cd wjx-ai-kit
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-cli
npm link ./wjx-cli
```

要求 Node.js 20+。私有化部署在初始化时追加 `--base-url`，例如 `wjx init --api-key "你的问卷星 API Key" --base-url "https://你的域名"`。多租户场景使用 `--profile <name>`，profile 的地址会按请求传给 SDK，不会与其他并发请求串用。API Key 请勿提交到仓库、日志或公共对话。

## 常用命令

```bash
wjx survey jsonl-template --raw > survey.jsonl
wjx survey create --file survey.jsonl
wjx survey preview-url --sid <sid>
wjx response query --vid 12345 --page_size 50
wjx response download --vid 12345 --suffix 0
wjx analytics nps --scores "[9,10,8,6,3]"
```

JSON 是默认输出；`--format table` 只用于人工查看；`--stdin` 接收 JSON 参数；`--dry-run` 以 `ok/data` envelope 在 stdout 返回脱敏请求计划，不发送 API 请求。

运行 `wjx update` 时，CLI 会先比较 registry 的 `latest` 与当前版本；远端版本不高于当前版本时只报告 `up-to-date`，不会执行安装，因此不会把本地版本降级。



## 开发

```bash
npm install
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-cli
npm test --workspace=wjx-cli
```

许可证：[MIT](../LICENSE)


## Survey JSON 与逻辑

问卷创建统一使用 Survey JSON（JSONL），修改使用同一内容格式。涉及题目关联时增加可选节点：

```json
{"dsl":{"logic":"logic { if \"2::1\" then show \"3\"; };"}}
```

完整请求的 `jsonl` 是 JSONL 字符串；`dsl` 是对象，只包含 `logic`。无逻辑时省略 `dsl`。已有 `relation/referselect` 字段继续保留，冲突时 DSL 优先。

SDK 使用 `createSurveyByJson` / `updateSurveyByJson`；CLI 使用 `survey create` / `survey update`；MCP 使用 `create_survey_by_json` / `update_survey_by_json`。普通查询 `getSurvey` / `survey get` / `get_survey` 从实际 XML 返回可编辑的 `dsl.logic`。

仅修改逻辑时提交 `vid + dsl`；修改题目时提交 `vid + jsonl`，可同时提交 `dsl`。修改不会隐式重新发布或迁移创建者。修改请求执行一次，之后从普通查询验证实际保存结果。

服务端将 DSL 解析并转换为 XML 的 Relation、ItemRelation、AnytimeJumpto、ReferTopic 等原生逻辑属性。XML 中不保存 DSL 原文或新增的 DSL 节点。仅修改逻辑时在原 XML 上更新对应属性，保留题目、选项、分页、设置和扩展数据。

```text
创建：Survey JSON -> 题目 XML；dsl.logic -> 原生 XML 逻辑；校验后保存 XML
修改逻辑：实际 XML -> dsl.logic -> AI 修改 -> 原生 XML 逻辑 -> 更新原 XML
```

CLI 示例：

```powershell
wjx survey create --file survey.jsonl --dsl '{"logic":"logic { if \"2::1\" then show \"3\"; };"}'
wjx survey get --vid 12345
wjx --yes survey update --vid 12345 --dsl '{"logic":"logic { if \"2::2\" then show \"3\"; };"}'
wjx --yes survey update --vid 12345 --file survey.jsonl
```

修改问卷结构时，已有的答卷索引保护继续生效；无答卷问卷确需结构变更时显式使用 `--allow-breaking-changes`（SDK 为 `allowBreakingChanges`，MCP 为 `allow_breaking_changes`）。
