import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const outputPath = path.join(root, "docs/api-reference.md");

const modules = [
  ["survey", "问卷管理", "问卷的创建、读取、设置与生命周期管理。"],
  ["response", "答卷管理", "答卷查询、下载、提交、修改与清空。"],
  ["analytics", "本地分析", "纯本地计算类工具，不调用问卷星远程 API。"],
  ["contacts", "通讯录", "企业通讯录成员、部门、标签与管理员管理。"],
  ["user-system", "用户系统", "参与者导入、修改、删除与问卷绑定查询。"],
  ["multi-user", "多账号", "主账号下的子账号生命周期管理。"],
  ["sso", "SSO / URL", "单点登录链接与问卷创建/编辑链接生成。"],
];

const promptFiles = [
  path.join(root, "src/prompts/index.ts"),
  path.join(root, "src/prompts/analysis.ts"),
];

const returnDescriptions = {
  create_survey: "返回创建结果，通常包含新建问卷的编号、接口状态以及是否已发布。",
  get_survey: "返回问卷详情对象，包含问卷基本信息，以及按参数决定是否带出题目与选项结构。",
  list_surveys: "返回分页问卷列表，包含当前页数据、总量或游标类分页信息。",
  update_survey_status: "返回状态更新结果，标识发布、暂停或删除动作是否执行成功。",
  get_survey_settings: "返回问卷配置详情，包含基础设置、时间设置、提交后行为、消息推送和 API 设置等字段。",
  update_survey_settings: "返回设置更新结果，以及服务端接受并保存配置的状态信息。",
  delete_survey: "返回删除结果，标识问卷是否已移入回收站或被彻底删除。",
  get_question_tags: "返回题目标签列表，包含标签编号、名称及关联统计信息。",
  get_tag_details: "返回指定标签下的题目明细，通常包含问卷信息、题号、题型与标签名称。",
  clear_recycle_bin: "返回清空结果，说明已彻底删除的问卷范围或指定 vid 的处理状态。",
  query_responses: "返回分页答卷明细列表，含提交时间、来源、IP、submitdata 及问卷相关元数据。",
  query_responses_realtime: "返回实时队列中的新答卷；成功读取后这些记录会从队列移除。",
  download_responses: "返回下载任务结果；同步场景提供下载地址，异步场景返回 taskid 与轮询状态。",
  get_report: "返回问卷统计报告，包含各题频次、均值、总分或其他聚合指标。",
  submit_response: "返回代填/导入答卷的提交结果，通常包含答卷编号、提交状态和错误信息。",
  get_file_links: "返回文件上传题的访问链接与下载链接集合。",
  get_winners: "返回中奖者分页列表，含奖品类型、发放状态和中奖人信息。",
  modify_response: "返回答卷修改结果，说明指定答卷是否已成功更新。",
  get_360_report: "返回 360 评估报告下载状态；异步未完成时给出 taskid，完成后给出下载地址。",
  clear_responses: "返回答卷清空结果，说明是否已删除全部答卷以及是否重置序号。",
  decode_responses: "返回本地解析结果，将 submitdata 拆解成结构化题目答案列表。",
  calculate_nps: "返回 NPS 计算结果，包含推荐者/被动者/贬损者人数、占比、NPS 分数与评级。",
  calculate_csat: "返回 CSAT 计算结果，包含满意率、满意人数、总样本数和分值分布。",
  detect_anomalies: "返回异常检测结果，列出疑似直线作答、异常速度或重复提交的记录。",
  compare_metrics: "返回两组指标的差值、变化率以及显著性标记。",
  decode_push_payload: "返回解密后的推送原文、解析后的 JSON 以及可选的签名校验结果。",
  query_contacts: "返回通讯录成员分页列表，可附带部门、联系方式和扩展字段。",
  add_contacts: "返回批量导入结果，包含成功/失败条目及对应原因。",
  manage_contacts: "返回更新或删除结果，标识各成员记录的处理状态。",
  add_admin: "返回新增管理员结果，通常包含管理员编号与角色信息。",
  delete_admin: "返回管理员删除结果。",
  restore_admin: "返回管理员恢复结果。",
  list_departments: "返回部门分页列表，包含部门编号、名称和父子层级信息。",
  add_department: "返回新建部门结果，通常包含部门编号与父部门关系。",
  modify_department: "返回部门修改结果。",
  delete_department: "返回部门删除结果。",
  list_tags: "返回标签列表，包含标签编号与名称。",
  add_tag: "返回新建标签结果，通常包含标签编号。",
  modify_tag: "返回标签修改结果。",
  delete_tag: "返回标签删除结果。",
  add_participants: "返回参与者批量添加结果，包含成功/失败统计和逐项错误信息。",
  modify_participants: "返回参与者批量修改结果，包含逐项处理状态。",
  delete_participants: "返回参与者批量删除结果，说明已删除用户及失败原因。",
  query_survey_binding: "返回问卷与用户系统的绑定列表，含参与者信息和分页数据。",
  query_user_surveys: "返回指定参与者关联的问卷列表和分页信息。",
  add_sub_account: "返回子账号创建结果，通常包含子账号编号或登录标识。",
  modify_sub_account: "返回子账号修改结果。",
  delete_sub_account: "返回子账号删除结果。",
  restore_sub_account: "返回子账号恢复结果。",
  query_sub_accounts: "返回子账号分页列表，包含角色、联系方式与状态。",
  sso_subaccount_url: "返回子账号 SSO 登录链接，以及可能的过期时间或签名相关信息。",
  sso_user_system_url: "返回用户系统参与者 SSO 登录链接。",
  sso_partner_url: "返回合作伙伴或代理商 SSO 登录链接。",
  build_survey_url: "返回可直接访问的问卷创建或编辑 URL。",
};

const resourceReturns = {
  "survey-types": "返回问卷类型编码字典，帮助调用方选择 atype。",
  "question-types": "返回题型与细分题型编码字典，便于构造 create_survey 的 questions。",
  "survey-statuses": "返回问卷状态和审核状态编码说明。",
  "analysis-methods": "返回 NPS、CSAT、CES 等分析方法说明与参考基准。",
  "response-format": "返回 submitdata 编码规则，说明题号、分隔符和多选格式。",
  "user-roles": "返回多账号子账号角色编码与含义映射。",
  "push-format": "返回问卷推送载荷格式、AES 解密与签名验证说明。",
};

const promptPurposes = {
  "design-survey": "帮助 AI 规划问卷结构，并产出可直接传给 create_survey 的 questions JSON。",
  "analyze-results": "指导 AI 组合 get_survey、get_report 与 query_responses 生成分析报告。",
  "create-nps-survey": "快速生成标准 NPS 问卷，并输出 create_survey 调用草稿。",
  "configure-webhook": "指导配置数据推送 URL、加密与签名验证，并串联 decode_push_payload。",
  "nps-analysis": "面向 NPS 场景的完整分析流程模板。",
  "csat-analysis": "面向满意度问卷的完整分析流程模板。",
  "cross-tabulation": "生成两道题之间的交叉分析工作流。",
  "sentiment-analysis": "指导对开放题文本做情感分类与主题提取。",
  "survey-health-check": "面向完成率、流失率和异常回答的质量诊断模板。",
  "comparative-analysis": "用于跨时段或跨问卷比较关键指标差异。",
};

function readSource(file) {
  const text = fs.readFileSync(file, "utf8");
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function getString(node, sf) {
  if (!node) return "";
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return node.getText(sf).replace(/\s+/g, " ").trim();
}

function getChainCalls(node) {
  const calls = [];
  let current = node;
  while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
    calls.push(current);
    if (ts.isIdentifier(current.expression.expression) && current.expression.expression.text === "z") {
      return { calls, base: current };
    }
    current = current.expression.expression;
  }
  return { calls, base: current };
}

function getLiteralText(node, sf) {
  if (!node) return "";
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return node.getText(sf).replace(/\s+/g, " ").trim();
}

function firstDescribe(node, sf) {
  const { calls } = getChainCalls(node);
  for (const call of calls) {
    if (call.expression.name.text === "describe") {
      return getLiteralText(call.arguments[0], sf);
    }
  }
  return "";
}

function firstDefault(node, sf) {
  const { calls } = getChainCalls(node);
  for (const call of calls) {
    if (call.expression.name.text === "default") {
      return call.arguments[0] ? call.arguments[0].getText(sf).trim() : "";
    }
  }
  return "";
}

function inferType(node, sf) {
  const { base } = getChainCalls(node);
  if (!ts.isCallExpression(base) || !ts.isPropertyAccessExpression(base.expression)) return "unknown";
  if (!ts.isIdentifier(base.expression.expression) || base.expression.expression.text !== "z") return "unknown";
  const typeName = base.expression.name.text;
  if (typeName === "enum") {
    const values = base.arguments[0] ? base.arguments[0].getText(sf).replace(/[\[\]]/g, "").replace(/"/g, "").trim() : "";
    return `enum(${values})`;
  }
  if (["string", "number", "boolean", "array", "record", "object", "union", "literal"].includes(typeName)) {
    return typeName;
  }
  return "unknown";
}

function hasChainCall(node, methodName) {
  const { calls } = getChainCalls(node);
  return calls.some((call) => call.expression.name.text === methodName);
}

function extractFields(obj, sf) {
  const items = [];
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = prop.name.getText(sf).replace(/^['"]|['"]$/g, "");
    const raw = prop.initializer.getText(sf);
    items.push({
      name,
      type: inferType(prop.initializer, sf),
      required: !hasChainCall(prop.initializer, "optional") && !hasChainCall(prop.initializer, "default"),
      defaultValue: firstDefault(prop.initializer, sf),
      description: firstDescribe(prop.initializer, sf),
      raw: raw.replace(/\s+/g, " ").trim(),
    });
  }
  return items;
}

function extractTools() {
  return modules.map(([key, title, summary]) => {
    const sf = readSource(path.join(root, `src/modules/${key}/tools.ts`));
    const tools = [];
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "registerTool") {
        const [nameArg, metaArg] = node.arguments;
        const tool = {
          name: getString(nameArg, sf),
          title: "",
          description: "",
          params: [],
        };
        if (metaArg && ts.isObjectLiteralExpression(metaArg)) {
          for (const prop of metaArg.properties) {
            if (!ts.isPropertyAssignment(prop)) continue;
            const propName = prop.name.getText(sf).replace(/^['"]|['"]$/g, "");
            if (propName === "title") tool.title = getString(prop.initializer, sf);
            if (propName === "description") tool.description = getString(prop.initializer, sf);
            if (propName === "inputSchema" && ts.isObjectLiteralExpression(prop.initializer)) {
              tool.params = extractFields(prop.initializer, sf);
            }
          }
        }
        tools.push(tool);
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
    return { key, title, summary, tools };
  });
}

function extractResources() {
  const sf = readSource(path.join(root, "src/resources/index.ts"));
  const items = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "resource") {
      const [nameArg, uriArg, metaArg] = node.arguments;
      const resource = {
        name: getString(nameArg, sf),
        uri: getString(uriArg, sf),
        description: "",
        mimeType: "",
      };
      if (metaArg && ts.isObjectLiteralExpression(metaArg)) {
        for (const prop of metaArg.properties) {
          if (!ts.isPropertyAssignment(prop)) continue;
          const propName = prop.name.getText(sf).replace(/^['"]|['"]$/g, "");
          if (propName === "description") resource.description = getString(prop.initializer, sf);
          if (propName === "mimeType") resource.mimeType = getString(prop.initializer, sf);
        }
      }
      items.push(resource);
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return items;
}

function extractPrompts() {
  const items = [];
  for (const file of promptFiles) {
    const sf = readSource(file);
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "prompt") {
        const [nameArg, descArg, schemaArg] = node.arguments;
        const prompt = {
          name: getString(nameArg, sf),
          description: getString(descArg, sf),
          params: [],
        };
        if (schemaArg && ts.isObjectLiteralExpression(schemaArg)) {
          prompt.params = extractFields(schemaArg, sf);
        }
        items.push(prompt);
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
  }
  return items;
}

function md(text) {
  return String(text ?? "")
    .replace(/\|/g, "\\|")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderParamTable(params) {
  if (!params.length) return "无参数。\n";
  const lines = [
    "| 字段 | 类型 | 必填 | 默认值 | 说明 |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const param of params) {
    lines.push(
      `| ${md(param.name)} | ${md(param.type)} | ${param.required ? "是" : "否"} | ${md(param.defaultValue || "-")} | ${md(param.description || param.raw)} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

const toolGroups = extractTools();
const resources = extractResources();
const prompts = extractPrompts();
const totalTools = toolGroups.reduce((sum, group) => sum + group.tools.length, 0);

const lines = [
  "# WJX MCP Server API 参考",
  "",
  "本文档根据 `src/modules/*/tools.ts`、`src/resources/index.ts` 与 `src/prompts/*.ts` 的源码定义整理，作为当前 MCP Server 能力清单。",
  "",
  "## 概览",
  "",
  `- Tools: ${totalTools} 个，分为 ${toolGroups.length} 个模块`,
  `- Resources: ${resources.length} 个`,
  `- Prompts: ${prompts.length} 个`,
  "- 参数字段、必填项与默认值以源码中的 Zod schema 为准",
  "- 返回值说明为调用语义摘要，实际响应字段仍以问卷星 OpenAPI 返回为准",
  "",
  "## Tools",
  "",
];

for (const group of toolGroups) {
  lines.push(`### ${group.title}`);
  lines.push("");
  lines.push(group.summary);
  lines.push("");
  for (const tool of group.tools) {
    lines.push(`#### \`${tool.name}\` - ${tool.title}`);
    lines.push("");
    lines.push(tool.description || "无描述。");
    lines.push("");
    lines.push("**参数**");
    lines.push("");
    lines.push(renderParamTable(tool.params).trimEnd());
    lines.push("");
    lines.push("**返回值说明**");
    lines.push("");
    lines.push(returnDescriptions[tool.name] || "返回该操作对应的结果对象与接口状态。");
    lines.push("");
  }
}

lines.push("## Resources");
lines.push("");
for (const resource of resources) {
  lines.push(`### \`${resource.name}\``);
  lines.push("");
  lines.push(`- URI 模式: \`${resource.uri}\``);
  lines.push(`- 描述: ${resource.description}`);
  lines.push(`- MIME Type: \`${resource.mimeType}\``);
  lines.push(`- 返回内容: ${resourceReturns[resource.name] || "返回该参考资源对应的 JSON 内容。"}`);
  lines.push("");
}

lines.push("## Prompts");
lines.push("");
for (const prompt of prompts) {
  lines.push(`### \`${prompt.name}\``);
  lines.push("");
  lines.push(`- 用途: ${promptPurposes[prompt.name] || prompt.description}`);
  lines.push(`- 描述: ${prompt.description}`);
  lines.push("");
  lines.push("**参数**");
  lines.push("");
  lines.push(renderParamTable(prompt.params).trimEnd());
  lines.push("");
}

lines.push("## Tool 示例");
lines.push("");
lines.push("以下示例用于说明 MCP 调用载荷的典型结构，具体字段可按业务场景扩展。");
lines.push("");
lines.push("### `create_survey`");
lines.push("");
lines.push("```json");
lines.push(JSON.stringify({
  name: "create_survey",
  arguments: {
    title: "2026 Q2 客户满意度调研",
    atype: 1,
    desc: "收集企业客户对售后支持的满意度反馈",
    publish: false,
    questions: "[{\"q_index\":1,\"q_type\":3,\"q_subtype\":302,\"q_title\":\"您有多满意本次服务？\",\"items\":[{\"q_index\":1,\"item_index\":1,\"item_title\":\"1\"},{\"q_index\":1,\"item_index\":2,\"item_title\":\"2\"},{\"q_index\":1,\"item_index\":3,\"item_title\":\"3\"},{\"q_index\":1,\"item_index\":4,\"item_title\":\"4\"},{\"q_index\":1,\"item_index\":5,\"item_title\":\"5\"}]},{\"q_index\":2,\"q_type\":5,\"q_title\":\"请写下最想改进的一点\"}]",
  },
}, null, 2));
lines.push("```");
lines.push("");
lines.push("```json");
lines.push(JSON.stringify({
  result: true,
  data: {
    vid: 12345678,
    title: "2026 Q2 客户满意度调研",
    publish: false,
  },
}, null, 2));
lines.push("```");
lines.push("");
lines.push("### `query_responses`");
lines.push("");
lines.push("```json");
lines.push(JSON.stringify({
  name: "query_responses",
  arguments: {
    vid: 12345678,
    page_index: 1,
    page_size: 50,
    starttime: "2026-03-01 00:00:00",
    endtime: "2026-03-31 23:59:59",
  },
}, null, 2));
lines.push("```");
lines.push("");
lines.push("```json");
lines.push(JSON.stringify({
  result: true,
  data: {
    total: 2,
    list: [
      {
        jid: 90001,
        vid: 12345678,
        submit_time: "2026-03-10 09:31:22",
        source: "wechat",
        submitdata: "1$5}2$客服响应速度快",
      },
      {
        jid: 90002,
        vid: 12345678,
        submit_time: "2026-03-11 14:08:10",
        source: "web",
        submitdata: "1$4}2$希望周末也能有人值班",
      },
    ],
  },
}, null, 2));
lines.push("```");
lines.push("");
lines.push("### `calculate_nps`");
lines.push("");
lines.push("```json");
lines.push(JSON.stringify({
  name: "calculate_nps",
  arguments: {
    scores: [10, 9, 8, 7, 10, 6, 5, 9, 10, 8],
  },
}, null, 2));
lines.push("```");
lines.push("");
lines.push("```json");
lines.push(JSON.stringify({
  result: true,
  data: {
    total: 10,
    promoters: 5,
    passives: 3,
    detractors: 2,
    nps: 30,
    rating: "一般",
  },
}, null, 2));
lines.push("```");
lines.push("");
lines.push("## 备注");
lines.push("");
lines.push("- 含 `JSON 字符串` 描述的字段，需要由调用方先序列化后再传入。");
lines.push("- 含分页语义的查询接口通常支持 `page_index` / `page_size`；上限与默认值已在参数表中标出。");
lines.push("- `analytics` 模块中的 6 个工具均为本地计算，不依赖远程 OpenAPI 可用性。");
lines.push("");

fs.writeFileSync(outputPath, `${lines.join("\n")}\n`);
console.log(`Generated ${outputPath}`);
