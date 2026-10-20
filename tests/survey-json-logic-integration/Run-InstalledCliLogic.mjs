import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// 只调用安装后 PATH 中的 wjx，不能绕过安装直接运行仓库 dist。
const origin = "http://tanhao.sojump.cn";
const outputRoot = resolve(process.argv[2] ?? ".tmp-installed-cli-dsl");
const profile = process.env.WJX_INSTALLED_TEST_PROFILE;
if (profile && !/^[A-Za-z0-9._-]+$/.test(profile)) throw Error("测试 profile 名称只能包含字母、数字、点、下划线和短横线");
mkdirSync(outputRoot, { recursive: true });

const cases = [];
const drafts = new Map();
const report = { origin, entry: "PATH:wjx", cases, drafts: [], cleanup: [], passed: 0, failed: 0 };
const stamp = new Date().toISOString().replace(/[^0-9]/g, "");
const userRules = [
  'if "2::1" then show "3"',
  'if "2::2" then show "4"',
  'if "2::3" or "3::3" or "4::3" then show "5"',
  'if "2::3" or "3::3" or "4::3" then show "6"',
  'if "2::3" or "3::3" or "4::3" then show "7"',
];

function check(value, message) { if (!value) throw Error(message); }
function equal(actual, expected, message) { check(JSON.stringify(actual) === JSON.stringify(expected), message); }
function dsl(...rules) { return { logic: `logic { ${rules.map(rule => `${rule};`).join(" ")} };` }; }
function statements(logic) {
  check(typeof logic === "string" && /^logic\s*\{[\s\S]*\}\s*;$/.test(logic), "查询必须包含完整 dsl.logic");
  return logic.replace(/^logic\s*\{/, "").replace(/\}\s*;$/, "").split(";").map(rule => rule.replace(/\s+/g, " ").trim()).filter(Boolean);
}
function jsonl(title, changed = false, legacyRelation = false) {
  return [
    { qtype: "问卷基础信息", title, introduction: changed ? "本地安装 CLI 完整更新说明" : "本地安装 CLI 回归草稿", atype: 1 },
    ...Array.from({ length: 6 }, (_, index) => ({
      qtype: "单选", title: `${changed ? "已更新" : "测试"}题目${index + 2}`,
      select: changed ? ["新选项A", "新选项B", "新选项C"] : ["A", "B", "C"],
      // 验证同时传入旧 JSON 关联字段时，dsl.logic 优先。
      ...(legacyRelation && index === 1 ? { relation: "测试题目2>>>B" } : {}),
    })),
  ].map(row => JSON.stringify(row)).join("\n");
}
function parseJson(text) { try { return JSON.parse(text.trim()); } catch { return undefined; } }
function safeCode(value) {
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : undefined;
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : undefined;
}
function safeVerification(value) {
  if (!value || typeof value !== "object") return undefined;
  return Object.fromEntries(["structure", "status", "count", "link"]
    .filter(key => typeof value[key] === "boolean").map(key => [key, value[key]]));
}
function safeWarnings(value) {
  if (!Array.isArray(value)) return undefined;
  // 只保留 SDK 的固定核验模板；未知上游消息可能带账号或响应内容，不写入结果。
  const sdkTemplate = /^(?:第 \d+ 道题|修改后的问卷|修改后的题目|问卷基础信息字段|分页或说明内容|保存后的 XML|更新后问卷|read-after-write |verified survey |survey status |survey review |no verified respondent |no verified |verified respondent )/;
  return value.slice(0, 20).filter(warning => typeof warning === "string" && sdkTemplate.test(warning))
    .map(warning => warning.slice(0, 300).replace(/https?:\/\/[^\s"'<>]+/gi, "[已移除链接]")
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[已移除邮箱]")
      .replace(/(?:Bearer\s+)?[A-Za-z0-9+/_=-]{32,}/g, "[已移除长标识]"));
}
function cliFailure(result) {
  const error = result.error?.error ?? {};
  const evidence = error.verification?.verification ? error.verification : error;
  return {
    exitCode: result.exitCode,
    timedOut: result.timedOut || undefined,
    code: safeCode(error.code),
    upstream: safeCode(error.errorcode),
    reason: /结构变更需要 allowBreakingChanges=true/.test(error.message ?? "") ? "structural-change-requires-opt-in" : undefined,
    outcome: ["unknown", "verified"].includes(error.outcome) ? error.outcome : undefined,
    verification: safeVerification(evidence.verification),
    diagnostics: Array.isArray(error.diagnostics) ? error.diagnostics.slice(0, 20).map(item => safeCode(item?.code)).filter(code => code !== undefined) : undefined,
    warnings: safeWarnings(evidence.warnings),
  };
}
function save() {
  report.drafts = [...drafts].map(([vid, value]) => ({ vid, label: value.label }));
  report.passed = cases.filter(item => item.status === "passed").length;
  report.failed = cases.filter(item => item.status === "failed").length;
  // 文件仅记录测试编号、断言和结果，不保存原始 API 响应、账号或链接。
  writeFileSync(resolve(outputRoot, "installed-cli-logic-results.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
async function run(args, input) {
  const allArgs = [...(profile ? ["--profile", profile] : []), ...args];
  check(allArgs.every(arg => /^[A-Za-z0-9_.-]+$/.test(arg)), "命令参数仅允许静态安全 token，请求内容必须经 stdin 传入");
  const env = { ...process.env, WJX_BASE_URL: origin };
  return new Promise((resolveResult, reject) => {
    const windows = process.platform === "win32";
    const child = spawn(windows ? "cmd.exe" : "wjx", windows ? ["/d", "/s", "/c", ["wjx", ...allArgs].join(" ")] : allArgs,
      { env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "", timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 150_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", () => { clearTimeout(timer); reject(Error("无法执行 PATH 中已安装的 wjx")); });
    child.on("close", exitCode => {
      clearTimeout(timer);
      resolveResult({ exitCode, output: parseJson(stdout), error: parseJson(stderr), stdout, stderr, timedOut });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input === undefined ? "" : JSON.stringify(input));
  });
}
async function command(operation, input, extra = []) {
  return run(["--stdin", "--yes", "--non-interactive", "--format", "json", ...extra, "survey", operation], input);
}
async function step(name, action) {
  try {
    await action();
    cases.push({ name, status: "passed" });
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    cases.push({ name, status: "failed", assertion: error instanceof Error ? error.message : "测试断言失败" });
    process.stdout.write(`FAIL ${name}\n`);
    throw error;
  } finally { save(); }
}
function requireSuccess(result, message) {
  check(!result.timedOut && result.exitCode === 0 && result.output?.ok === true, `${message} (${JSON.stringify(cliFailure(result))})`);
  return result.output.data;
}
function questionContent(data) {
  return { title: data.title, description: data.description, atype: data.atype,
    questions: data.questions.map(question => ({
      q_index: question.q_index, q_type: question.q_type, q_subtype: question.q_subtype,
      q_title: question.q_title, is_requir: question.is_requir, items: question.items,
    })) };
}
function immutableSnapshot(data) {
  return JSON.stringify({ ...questionContent(data), status: data.status, version: data.version, dsl: data.dsl, questions: data.questions });
}
async function get(vid) {
  const data = requireSuccess(await command("get", { vid, get_questions: true, get_items: true }), "问卷查询失败");
  check(Number(data.vid) === vid && Array.isArray(data.questions), "查询身份或题目结构不正确");
  for (const question of data.questions) check(!Object.hasOwn(question, "relation"), "查询仍返回已移除的 questions[].relation 字段");
  statements(data.dsl?.logic);
  const draft = drafts.get(vid);
  if (draft) draft.creator = [data.creater, data.creator, data.username].find(value => typeof value === "string" && value.trim());
  return data;
}
async function create(label, logic) {
  const input = { jsonl: jsonl(`安装 CLI DSL 回归 ${label} ${stamp}`, false, Boolean(logic)), publish: false, ...(logic ? { dsl: logic } : {}) };
  const result = await command("create", input);
  // 即使 CLI 报 unknown，也先保存已经返回的 vid，确保 finally 能回收；不重放创建。
  const vid = Number(result.output?.data?.vid ?? result.error?.error?.vid ?? result.error?.error?.verification?.vid);
  if (Number.isSafeInteger(vid) && vid > 0) { drafts.set(vid, { label }); save(); }
  const data = requireSuccess(result, "创建草稿失败，已停止重试");
  check(drafts.has(vid), "创建响应未返回可核验编号，已停止后续创建");
  check(data.verification?.structure === true && data.verification?.status === true, "创建后 CLI 结构或状态核验未通过");
  const saved = await get(vid);
  check(Number(saved.status) === 0, "测试问卷必须保持未发布草稿");
  equal(saved.questions.map(question => Number(question.q_index)), [2, 3, 4, 5, 6, 7], "六道题的原生编号不符合预期");
  return { vid, data: saved };
}
async function update(vid, input) {
  const data = requireSuccess(await command("update", { vid, ...input }), "更新失败");
  check(data.outcome === "verified" && data.verification?.structure === true && data.verification?.status === true, "CLI 更新读回未返回 verified");
  const saved = await get(vid);
  check(Number(saved.status) === 0, "修改后草稿被意外发布");
  return saved;
}
async function rejectUnchanged(vid, logic, expectedCode) {
  const before = immutableSnapshot(await get(vid));
  const result = await command("update", { vid, dsl: logic });
  check(result.exitCode === 1 && result.error?.ok === false, "非法逻辑应返回 API 拒绝");
  const diagnostics = result.error?.error?.diagnostics ?? [];
  check(diagnostics.some(item => item?.code === expectedCode), `非法逻辑应包含 ${expectedCode} 诊断`);
  equal(immutableSnapshot(await get(vid)), before, "非法逻辑拒绝后问卷内容、逻辑或版本发生变化");
}

let plain, linked;
try {
  await step("installed-cli-old-dsl-command-removed", async () => {
    const result = await run(["dsl", "query"]);
    check(result.exitCode === 2 && result.error?.error?.code === "INPUT_ERROR", "旧 dsl 命令仍存在或错误分类不正确");
  });
  await step("installed-cli-update-dry-run-action-1000109", async () => {
    const data = requireSuccess(await command("update", { vid: 42, dsl: dsl('if "2::1" then show "3"') }, ["--dry-run"]), "修改 dry-run 失败");
    const body = parseJson(data.plans?.[0]?.body ?? "");
    check(body?.action === "1000109" && !Object.hasOwn(body, "surveydatajson") && !Object.hasOwn(body, "publish"), "修改 action 或仅逻辑请求体不正确");
    check(new URL(data.plans[0].url).origin === origin, "CLI 没有使用专用测试站点");
  });
  await step("create-without-dsl-complete-empty-projection-no-relation", async () => {
    plain = await create("无逻辑", undefined);
    equal(statements(plain.data.dsl.logic), [], "无 DSL 创建应返回明确的完整空逻辑模块");
  });
  await step("create-user-or-example-dsl-precedence-and-complete-query", async () => {
    linked = await create("完整OR", dsl(...userRules));
    equal(statements(linked.data.dsl.logic), userRules, "用户完整 OR 示例未正确保存或查询缺少规则");
  });
  await step("logic-only-update-preserves-content-and-other-rules", async () => {
    const saved = await update(linked.vid, { dsl: dsl('if "2::2" then show "3"') });
    equal(questionContent(saved), questionContent(linked.data), "仅逻辑修改改变了题目内容");
    equal(statements(saved.dsl.logic), ['if "2::2" then show "3"', ...userRules.slice(1)], "仅逻辑更新没有保留其他规则");
  });
  await step("logic-only-add-single-condition", async () => {
    const before = await get(plain.vid);
    const saved = await update(plain.vid, { dsl: dsl('if "2::1" then show "3"') });
    equal(questionContent(saved), questionContent(before), "新增逻辑改变了原有题目");
    equal(statements(saved.dsl.logic), ['if "2::1" then show "3"'], "单条条件未保存");
  });
  await step("show-clears-last-rule-without-relation-field", async () => {
    const saved = await update(plain.vid, { dsl: dsl('show "3"') });
    equal(statements(saved.dsl.logic), [], "show 清除最后规则后应返回明确空模块");
    check(saved.questions.find(question => Number(question.q_index) === 3)?.is_hide === false, "清除条件后题目应显示");
  });
  await step("hide-verifies-complete-logic-projection", async () => {
    const saved = await update(plain.vid, { dsl: dsl('hide "3"') });
    const rules = statements(saved.dsl.logic);
    check(rules.includes('hide "3"') || rules.includes('raw attr "Relation" question "3" = "-1"'), "隐藏缺少正向逻辑证据");
    check(saved.questions.find(question => Number(question.q_index) === 3)?.is_hide === true, "题目隐藏标记不正确");
  });
  await step("show-restores-hidden-question-and-empty-projection", async () => {
    const saved = await update(plain.vid, { dsl: dsl('show "3"') });
    equal(statements(saved.dsl.logic), [], "恢复显示应清除隐藏规则");
    check(saved.questions.find(question => Number(question.q_index) === 3)?.is_hide === false, "恢复显示后仍隐藏");
  });
  await step("full-json-metadata-and-logic-update-without-structural-change", async () => {
    const before = await get(plain.vid);
    const title = `安装 CLI DSL 基础信息更新 ${stamp}`;
    const rows = jsonl(title).split("\n").map(line => JSON.parse(line));
    rows[0].introduction = "保持题目内容的完整 JSON 更新";
    const saved = await update(plain.vid, { jsonl: rows.map(row => JSON.stringify(row)).join("\n"), dsl: dsl('if "2::2" then show "3"') });
    check(saved.title === title && saved.description === rows[0].introduction, "普通完整 JSON 更新未保存标题说明");
    equal(questionContent(saved).questions, questionContent(before).questions, "仅改基础信息和逻辑时题目内容变化");
    equal(statements(saved.dsl.logic), ['if "2::2" then show "3"'], "普通完整 JSON 更新未保存逻辑");
  });
  const fullTitle = `安装 CLI DSL 完整更新 ${stamp}`;
  const fullInput = { jsonl: jsonl(fullTitle, true), dsl: dsl('if "2::3" then show "3"'), publish: false };
  await step("ambiguous-content-rebuild-requires-explicit-opt-in", async () => {
    const before = immutableSnapshot(await get(plain.vid));
    const rejected = await command("update", { vid: plain.vid, ...fullInput });
    check(rejected.exitCode === 1 && /结构变更需要 allowBreakingChanges=true/.test(rejected.error?.error?.message ?? ""),
      `批量改写选项应触发结构变更确认 (${JSON.stringify(cliFailure(rejected))})`);
    equal(immutableSnapshot(await get(plain.vid)), before, "缺少结构变更许可的请求改写了问卷");
  });
  await step("full-json-plus-logic-update-with-explicit-opt-in", async () => {
    // 多题同时修改选项文本会触发既有的保守结构保护，仅对本次创建的无答卷草稿明确授权。
    const saved = await update(plain.vid, { ...fullInput, allowBreakingChanges: true });
    check(saved.title === fullTitle && saved.description === "本地安装 CLI 完整更新说明", "完整更新的标题或说明丢失");
    equal(saved.questions.map(question => question.q_title), Array.from({ length: 6 }, (_, index) => `已更新题目${index + 2}`), "完整更新题干未保存");
    for (const question of saved.questions) equal(question.items.map(item => item.item_title), ["新选项A", "新选项B", "新选项C"], "完整更新选项未保存");
    equal(statements(saved.dsl.logic), ['if "2::3" then show "3"'], "完整 JSON 更新没有正确保存 DSL");
  });
  await step("invalid-reference-rejected-without-mutation", () => rejectUnchanged(plain.vid, dsl('if "999::1" then show "3"'), "DSL_LOGIC_REFERENCE"));
  await step("jump-compiles-and-cli-verifies-native-state", async () => {
    const saved = await update(plain.vid, { dsl: dsl('jump from "2" to "3"') });
    check(statements(saved.dsl.logic).includes('jump from "2" to "3"'), "有效跳转未保存到逻辑投影");
    const question = saved.questions.find(item => Number(item.q_index) === 2);
    check(question?.has_jump === true && Number(question.anytime_jump) === 3, "有效跳转的原生标记不正确");
  });
  await step("new-and-retained-jump-cycle-rejected-without-mutation", () => rejectUnchanged(plain.vid, dsl('jump from "3" to "2"'), "DSL_LOGIC_CYCLE"));
} catch {
  process.exitCode = 1;
} finally {
  for (const [vid, draft] of drafts) {
    try {
      const result = await command("delete", { vid, ...(draft.creator ? { username: draft.creator } : {}) });
      const data = requireSuccess(result, "测试草稿回收失败");
      check(data.outcome === "verified" && data.verification?.status === true, "CLI 未证实进入回收站");
      const saved = requireSuccess(await command("get", { vid }), "回收后状态读回失败");
      check(Number(saved.vid) === vid && Number(saved.status) === 3, "测试草稿未达到回收站 status=3");
      report.cleanup.push({ vid, status: "recycle-bin-verified", completely_deleted: false });
      process.stdout.write(`PASS cleanup-${draft.label}\n`);
    } catch (error) {
      report.cleanup.push({ vid, status: "failed", assertion: error instanceof Error ? error.message : "测试草稿回收失败" });
      process.stdout.write(`FAIL cleanup-${draft.label}\n`);
      process.exitCode = 1;
    } finally { save(); }
  }
  save();
  process.stdout.write(`${JSON.stringify({ passed: report.passed, failed: report.failed, cleanup: report.cleanup.map(item => ({ vid: item.vid, status: item.status })), report: resolve(outputRoot, "installed-cli-logic-results.json") })}\n`);
}
