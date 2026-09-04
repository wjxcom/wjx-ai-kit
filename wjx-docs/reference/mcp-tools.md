# MCP 工具参考

当前版本提供 63 个 Tool、8 个 Resource 和 15 个 Prompt。输入 schema 和描述以运行时能力发现结果为最终契约；MCP 只保证 CLI 的核心业务子集，工作站能力和有意不暴露的通用 API 见仓库 capability matrix。

## Tool 模块

| 模块 | 工具（完整清单） | 说明 |
| --- | --- | --- |
| survey（11） | `create_survey_by_json`, `get_survey`, `list_surveys`, `update_survey_status`, `get_survey_settings`, `update_survey_settings`, `delete_survey`, `get_question_tags`, `get_tag_details`, `upload_file`, `clear_recycle_bin` | 问卷创建、查询、设置和生命周期；新问卷统一使用 `create_survey_by_json` |
| response（11） | `query_responses`, `count_responses`, `query_responses_realtime`, `download_responses`, `get_report`, `submit_response`, `build_submit_template`, `get_winners`, `modify_response`, `get_360_report`, `clear_responses` | 答卷、规模计数、模板、报告和数据清理 |
| contacts（14） | `query_contacts`, `add_contacts`, `delete_contacts`, `add_admin`, `delete_admin`, `restore_admin`, `list_departments`, `add_department`, `modify_department`, `delete_department`, `list_tags`, `add_tag`, `modify_tag`, `delete_tag` | 通讯录、部门、标签和管理员 |
| user-system（6，兼容/已过时） | `add_participants`, `modify_participants`, `delete_participants`, `bind_activity`, `query_survey_binding`, `query_user_surveys` | 仅用于已有用户体系的兼容操作；不能通过创建接口新建 `atype=8` 用户体系问卷 |
| multi-user（5） | `add_sub_account`, `modify_sub_account`, `delete_sub_account`, `restore_sub_account`, `query_sub_accounts` | 子账号管理 |
| sso（5） | `sso_subaccount_url`, `sso_user_system_url`, `sso_partner_url`, `build_survey_url`, `build_preview_url` | 生成登录、编辑和填写链接；用户系统 SSO 仅配合已有系统使用 |
| analytics（6） | `decode_responses`, `decode_push_payload`, `calculate_nps`, `calculate_csat`, `detect_anomalies`, `compare_metrics` | 本地数据解码、推送解密和指标计算 |
| server（1） | `get_config` | 查看脱敏配置与运行环境 |

问卷创建支持 `create_survey_by_json`（JSONL）和 `create_survey_from_definition`（完整 XML DSL）。修改使用 `update_survey_from_definition`，查询 DSL 使用 `query_wjx_dsl`，DSL 预检使用 `generate_wjx_dsl`。

### 已过时的用户体系能力

用户体系仍提供 6 个工具，用于读取或维护历史系统；工具标题和描述已标记 `[已过时]`。新项目不要创建 `atype=8`，也不要把用户体系工作流当作通用问卷创建路径。只有用户明确提供已有的 `sysid`/`usid` 和参与者数据，并确认要维护旧系统时，才考虑使用这些工具。

工具的输入 schema 是运行时契约；无法确定字段时先调用 `get_survey` 或读取 Resource，不要猜编码。

## Resources（8）

| URI | 内容 |
| --- | --- |
| `wjx://reference/wjx-xml-dsl` | WJX XML DSL v1 生成、校验、创建和修改规范 |
| `wjx://reference/question-types` | `get_survey` 读取结果的 `q_type/q_subtype` 映射；JSONL 创建白名单以 SDK 和 `create_survey_by_json` 校验为准 |
| `wjx://reference/survey-types` | 问卷类型编码和创建限制 |
| `wjx://reference/survey-statuses` | 问卷状态码和合法转换 |
| `wjx://reference/response-format` | `submitdata` 编码格式 |
| `wjx://reference/analysis-methods` | NPS、CSAT、CES 公式和行业基准 |
| `wjx://reference/user-roles` | 子账号角色编码 |
| `wjx://reference/push-format` | 数据推送格式和加密说明 |

## Prompts（15）

Prompt 是可复用的工作流模板，不能替代工具权限检查。AI 按 XML DSL 规范生成内容后，可交给 DSL 工具提交；JSONL 入口仍独立保留。

| 分组 | 名称 |
| --- | --- |
| 通用/运维（6） | `design-survey`, `analyze-results`, `create-nps-survey`, `configure-webhook`, `anomaly-detection`, `user-system-workflow`（兼容/已过时） |
| 分析（6） | `nps-analysis`, `csat-analysis`, `cross-tabulation`, `sentiment-analysis`, `survey-health-check`, `comparative-analysis` |
| JSONL 生成（3，推荐） | `generate-survey-json`, `generate-exam-json`, `generate-form-json` |

不同 MCP 客户端可能只显示其支持的部分能力；需要完整列表时，请查看客户端的 `tools/list`、`resources/list` 和 `prompts/list` 结果。
