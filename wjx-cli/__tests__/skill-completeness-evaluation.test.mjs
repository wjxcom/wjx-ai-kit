import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FRAMEWORK_ONLY_JSONL_QTYPES, JSONL_SUPPORTED_QTYPES } from "wjx-api-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, "..", "dist", "index.js");
const NO_CONFIG = { WJX_CONFIG_PATH: resolve(__dirname, "..", "__complete_eval_no_config__") };
const SKILL = resolve(__dirname, "..", "..", "wjx-skills", "wjx-cli-use", "SKILL.md");
const QUESTION_TYPES = resolve(__dirname, "..", "..", "wjx-skills", "wjx-cli-use", "references", "question-types.md");
const MANIFEST = resolve(__dirname, "..", "manifest", "commands.json");

function runCli(args, { env = {}, input, timeout = 15_000 } = {}) {
  return new Promise((done) => {
    const child = execFile(process.execPath, [CLI, ...args], {
      env: { ...process.env, ...NO_CONFIG, ...env },
      encoding: "utf8",
      timeout,
    }, (error, stdout, stderr) => done({
      code: error ? error.code ?? 1 : 0,
      stdout: stdout || "",
      stderr: stderr || "",
    }));
    if (input !== undefined) {
      child.stdin.end(input);
    }
  });
}

function jsonl(...rows) {
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

function parseSuccess(result) {
  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.equal(result.stderr.trim(), "", result.stderr);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.ok, true, result.stdout);
  return envelope.data;
}

function parseProblem(result) {
  assert.notEqual(result.code, 0, "expected command to fail");
  assert.equal(result.stdout.trim(), "", result.stdout);
  const envelope = JSON.parse(result.stderr);
  assert.equal(envelope.ok, false, result.stderr);
  return envelope.error;
}

function sampleQuestion(qtype) {
  const question = { qtype, title: `覆盖 ${qtype}` };
  if (qtype === "NPS量表") {
    question.select = Array.from({ length: 11 }, (_, index) => String(index));
    question.minvaluetext = "不推荐";
    question.maxvaluetext = "强烈推荐";
  } else if ([
    "矩阵单选", "矩阵多选", "矩阵量表", "矩阵滑动条", "矩阵数值题",
    "Kano模型", "SUS模型", "价格断裂点", "选项分类", "文字点睛",
  ].includes(qtype)) {
    question.rowtitle = ["项目一", "项目二"];
    question.select = ["低", "中", "高"];
    question.columntitle = ["列一", "列二"];
  } else if (qtype === "矩阵填空") {
    question.rowtitle = ["项目一", "项目二"];
    question.columntitle = ["姓名", "备注"];
  } else if (qtype === "联合分析") {
    question.mdattr = ["价格低/包装A", "价格中/包装B", "价格高/包装C"];
  } else if (qtype === "层次分析") {
    question.rowtitle = ["价格", "品质", "品牌"];
  } else if (qtype === "循环评价") {
    question.rowtitle = ["品牌一", "品牌二"];
    question.columntitle = ["满意度", "购买意愿"];
  } else if (qtype === "PSM模型") {
    question.rowtitle = ["太便宜", "便宜", "贵", "太贵"];
    question.minvalue = "1";
    question.maxvalue = "999";
  } else if (["表格组合", "表格组合题"].includes(qtype)) {
    question.rowtitle = ["姓名", "角色"];
    question.types = ["文本", "下拉"];
    question.selects = [[], ["研发", "产品"]];
  } else if (["表格数值", "表格数值题", "表格填空", "表格填空题", "表格下拉框"].includes(qtype)) {
    question.rowtitle = ["字段一", "字段二"];
    question.columntitle = ["列一", "列二"];
    if (qtype === "表格下拉框") question.selects = [["选项一", "选项二"], ["选项三", "选项四"]];
  } else if (["自增表格", "表格自增题"].includes(qtype)) {
    question.rowtitle = ["姓名", "联系方式"];
    question.columntitle = ["列一", "列二"];
    question.selects = [["", "工作日|周末"]];
    question.min_rows = 1;
    question.max_rows = 5;
  } else if (["多项文件题", "多项简答题"].includes(qtype)) {
    question.rowtitle = ["项目一", "项目二"];
    question.columntitle = ["内容"];
  } else if (["滑动条", "矩阵滑动条"].includes(qtype)) {
    question.minvalue = "0";
    question.maxvalue = "10";
  } else if (qtype === "比重题") {
    question.rowtitle = ["项目一", "项目二"];
    question.total = 100;
  } else if (["BWS", "MaxDiff", "Maxdiff", "图片PK", "BPTO模型", "心理学实验"].includes(qtype)) {
    question.mdattr = ["属性一", "属性二", "属性三"];
  } else if (qtype === "热力图") {
    question.heatbg = "/images/ai/demo.png";
  } else if (qtype === "多级下拉") {
    question.leveldata = ["浙江省/杭州市/西湖区", "江苏省/南京市/玄武区"];
  } else if (qtype === "门店选择") {
    question.stores = ["门店一", "门店二"];
  } else if (["情景随机", "商品题", "预约题", "货架题", "CATI调研"].includes(qtype)) {
    question.select = ["选项一", "选项二", "选项三"];
  } else if (qtype === "AI访谈") {
    question.rowtitle = ["问题一", "问题二"];
    question.columntitle = ["回答"];
  } else if (qtype === "VlookUp问卷关联") {
    question.rowtitle = ["关联键", "关联值"];
    question.columntitle = ["内容"];
  } else if (qtype === "品牌漏斗") {
    question.brands = ["品牌一", "品牌二"];
  } else if (["基本信息", "邮寄地址", "企业信息"].includes(qtype)) {
    question.rowtitle = ["字段一", "字段二"];
    question.columntitle = ["内容"];
  } else if (qtype === "多项填空") {
    question.title = "字段一 {_}，字段二 {_}";
  } else if (["普通选择题", "单选", "多选", "下拉框", "排序", "量表题", "评分单选", "评分多选", "评价题", "投票单选", "投票多选", "考试单选", "考试判断", "考试多选"].includes(qtype)) {
    question.select = ["选项一", "选项二"];
  } else if (qtype === "考试单项填空") {
    question.title = "中国的首都是 {_}";
    question.correctselect = "北京";
  } else if (qtype === "考试多项填空") {
    question.title = "姓名 {_}，班级 {_}";
    question.answerlists = [
      { correctselect: "张三", quizscore: "2" },
      { correctselect: "三年二班", quizscore: "3" },
    ];
  }
  if (qtype.startsWith("考试") && !["考试单项填空", "考试多项填空"].includes(qtype)) {
    question.correctselect = ["1"];
    question.quizscore = "1";
  }
  return question;
}

function parsePlanBody(data) {
  assert.equal(data.kind, "dry-run");
  assert.ok(data.plans.length >= 1);
  return JSON.parse(data.plans[0].body);
}

const STRUCTURAL_QTYPES_WITHOUT_QUESTION_ROWS = new Set([
  "分页栏",
  "段落说明",
  "折叠栏目",
  "轮播图",
]);

function normalizeReturnedQuestionTitle(title) {
  return String(title)
    .replace(/\{_+\}/g, "{_}")
    .replace(/_+$/g, "");
}

function assertCreatedQuestionWasReturned(qtype, question, data, vid) {
  const returnedQuestions = Array.isArray(data?.questions) ? data.questions : [];
  assert.ok(returnedQuestions.length > 0, `${qtype}: get ${vid} returned no question rows`);

  // These layout elements are accepted in JSONL but represented by the
  // service as page metadata, not entries in the questions array. The
  // anchor row above still proves the survey was readable after creation.
  if (STRUCTURAL_QTYPES_WITHOUT_QUESTION_ROWS.has(qtype)) return;

  // Brand funnel expands into a service-owned three-question template.
  if (qtype === "品牌漏斗") {
    const expandedQuestions = returnedQuestions.filter((item) => item?.q_title !== "清理锚点");
    assert.ok(expandedQuestions.length >= 3, `${qtype}: get ${vid} did not expand the funnel template`);
    return;
  }

  const expectedTitle = normalizeReturnedQuestionTitle(question.title);
  assert.ok(
    returnedQuestions.some((item) => normalizeReturnedQuestionTitle(item?.q_title ?? item?.title) === expectedTitle),
    `${qtype}: get ${vid} did not return the created question title ${JSON.stringify(question.title)}`,
  );
}

test("every documented qtype has an executable JSONL dry-run contract", async () => {
  const docs = await readFile(QUESTION_TYPES, "utf8");
  const qtypes = [...JSONL_SUPPORTED_QTYPES];
  assert.ok(qtypes.length >= 90, `only ${qtypes.length} qtypes are available`);
  const undocumented = qtypes.filter((qtype) => !docs.includes(qtype));
  assert.deepEqual(undocumented, [], "every implementation qtype must be documented in the Skill reference");

  const tempDir = await mkdtemp(resolve(process.env.TEMP ?? ".", "wjx-qtype-eval-"));
  try {
    for (const qtype of qtypes.sort()) {
      const file = resolve(tempDir, `${Buffer.from(qtype).toString("hex")}.jsonl`);
      const atype = qtype.startsWith("考试") ? 6 : qtype.startsWith("投票") ? 3 : 1;
      const question = qtype === "问卷基础信息"
        ? { qtype: "单选", title: "元数据题型锚点", select: ["是", "否"] }
        : sampleQuestion(qtype);
      const metadata = { qtype: "问卷基础信息", title: `qtype ${qtype}`, atype };
      await writeFile(file, jsonl(
        metadata,
        question,
        { qtype: "单选", title: "锚点", select: ["是", "否"] },
      ), "utf8");
      const result = await runCli(["--dry-run", "survey", "create", "--file", file]);
      const body = parsePlanBody(parseSuccess(result));
      assert.equal(String(body.action), "1000106", qtype);
      const wireRows = String(body.surveydatajson).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
      const wireQuestion = wireRows.find((row) => row.qtype === qtype);
      assert.ok(wireQuestion, qtype);
      const expectedQuestion = qtype === "问卷基础信息" ? metadata : question;
      for (const [key, value] of Object.entries(expectedQuestion)) {
        assert.deepEqual(wireQuestion[key], value, `${qtype}.${key} was not preserved`);
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

function parseEnvelope(result) {
  const raw = result.stdout.trim() || result.stderr.trim();
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`CLI returned non-JSON output (exit ${result.code}): ${raw.slice(0, 300)}`);
  }
}

function findVid(value) {
  const queue = [value];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (!Array.isArray(current)) {
      for (const key of ["vid", "activity", "activity_id", "activityid"]) {
        const candidate = current[key];
        const numeric = typeof candidate === "number" ? candidate : Number(candidate);
        if (Number.isInteger(numeric) && numeric > 0) return numeric;
      }
    }
    for (const child of Object.values(current)) {
      if (child && typeof child === "object") queue.push(child);
    }
  }
  return undefined;
}

function findVidsByTitle(value, titlePrefix) {
  const vids = new Set();
  const queue = [value];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (!Array.isArray(current) && typeof current.title === "string" && current.title.startsWith(titlePrefix)) {
      const vid = findVid(current);
      if (vid) vids.add(vid);
    }
    for (const child of Object.values(current)) {
      if (child && typeof child === "object") queue.push(child);
    }
  }
  return vids;
}

test("every supported qtype completes a real create/get/delete workflow", {
  skip: process.env.WJX_REAL_QTYPE_EVAL !== "1",
}, async () => {
  const configPath = process.env.WJX_CONFIG_PATH ?? resolve(process.env.USERPROFILE ?? ".", ".wjxrc");
  const username = process.env.WJX_USERNAME?.trim();
  assert.ok(username, "WJX_USERNAME is required for cleanup of real qtype surveys");

  const requestedQtypes = process.env.WJX_REAL_QTYPE_ONLY
    ?.split(",")
    .map((qtype) => qtype.trim())
    .filter(Boolean);
  const qtypes = [...JSONL_SUPPORTED_QTYPES]
    .filter((qtype) => !requestedQtypes || requestedQtypes.includes(qtype))
    .sort();
  assert.ok(qtypes.length > 0, "WJX_REAL_QTYPE_ONLY did not select a supported qtype");
  const runPrefix = `QTE${Date.now().toString(36).slice(-5)}`;
  const failures = [];
  const cleanupFailures = [];
  const statuses = [];
  const realEnv = { WJX_CONFIG_PATH: configPath };

  async function discoverCreatedVids() {
    const listed = await runCli(["survey", "list", "--name_like", runPrefix], { env: realEnv, timeout: 60_000 });
    if (listed.code !== 0) return new Set();
    const envelope = parseEnvelope(listed);
    return findVidsByTitle(envelope.data, runPrefix);
  }

  for (const [index, qtype] of qtypes.entries()) {
    const title = `${runPrefix}-${String(index + 1).padStart(3, "0")}`;
    const atype = qtype.startsWith("考试") ? 6 : qtype.startsWith("投票") ? 3 : 1;
    const question = qtype === "问卷基础信息"
      ? { qtype: "单选", title: "锚点题", select: ["是", "否"] }
      : sampleQuestion(qtype);
    const jsonlText = jsonl(
      { qtype: "问卷基础信息", title, atype },
      question,
      { qtype: "单选", title: "清理锚点", select: ["是", "否"] },
    );
    const vids = new Set();
    try {
      const created = await runCli(["survey", "create", "--jsonl", jsonlText], { env: realEnv, timeout: 60_000 });
      const createEnvelope = parseEnvelope(created);
      assert.equal(created.code, 0, `${qtype}: ${created.stderr || created.stdout}`);
      assert.equal(createEnvelope.ok, true, `${qtype}: ${created.stdout}`);
      const vid = findVid(createEnvelope.data);
      if (vid) vids.add(vid);
      if (!vid) {
        for (const discovered of await discoverCreatedVids()) vids.add(discovered);
      }
      assert.ok(vids.size > 0, `${qtype}: create response did not contain a vid`);

      for (const createdVid of vids) {
        const fetched = await runCli([
          "survey", "get", "--vid", String(createdVid), "--get_questions", "--get_items", "--showtitle",
        ], { env: realEnv, timeout: 60_000 });
        const getEnvelope = parseEnvelope(fetched);
        assert.equal(fetched.code, 0, `${qtype}: get ${createdVid} failed: ${fetched.stderr}`);
        assert.equal(getEnvelope.ok, true, `${qtype}: get ${createdVid} returned an error`);
        assertCreatedQuestionWasReturned(qtype, question, getEnvelope.data, createdVid);
        const status = getEnvelope.data?.status;
        statuses.push({ qtype, vid: createdVid, status });
        if (typeof status === "number") {
          if (FRAMEWORK_ONLY_JSONL_QTYPES.has(qtype)) assert.equal(status, 0, `${qtype} must default to draft`);
          else assert.notEqual(status, 0, `${qtype} must default to published`);
        }
      }
    } catch (error) {
      failures.push({ qtype, message: error instanceof Error ? error.message : String(error) });
    } finally {
      if (vids.size === 0) {
        try {
          for (const discovered of await discoverCreatedVids()) vids.add(discovered);
        } catch (error) {
          cleanupFailures.push({ qtype, message: `discover: ${error instanceof Error ? error.message : String(error)}` });
        }
      }
      for (const vid of vids) {
        const deleted = await runCli([
          "--yes", "survey", "delete", "--vid", String(vid), "--username", username, "--completely",
        ], { env: realEnv, timeout: 60_000 });
        if (deleted.code !== 0) {
          cleanupFailures.push({ qtype, vid, message: deleted.stderr || deleted.stdout });
        }
      }
    }
  }

  // A normal list includes status=4 records that the service retains for
  // audit. Only status=3 recycle-bin records indicate incomplete cleanup.
  const remainingResult = await runCli([
    "survey", "list", "--name_like", runPrefix, "--status", "3",
  ], { env: realEnv, timeout: 60_000 });
  const remaining = remainingResult.code === 0
    ? findVidsByTitle(parseEnvelope(remainingResult).data, runPrefix)
    : new Set();
  if (remaining.size > 0) cleanupFailures.push({ qtype: "all", message: `remaining vids: ${[...remaining].join(",")}` });
  assert.deepEqual(failures, [], `real qtype failures: ${JSON.stringify(failures)}`);
  assert.deepEqual(cleanupFailures, [], `real qtype cleanup failures: ${JSON.stringify(cleanupFailures)}`);
  assert.equal(statuses.length, qtypes.length, "every qtype must have one verified survey status");
});

test("Skill documents all ten Agent rules and executable guidance anchors", async () => {
  const skill = await readFile(SKILL, "utf8");
  for (let index = 0; index <= 10; index += 1) {
    assert.match(skill, new RegExp(`规则\\s*${index}(?:[：:]|\\b)`), `missing rule ${index}`);
  }
  for (const phrase of [
    "创建任何新问卷",
    "禁止**自行拼成",
    "不要使用 `--format table`",
    "不要只复述错误信息",
    "失败 ≥ 10%",
    "逐页查询",
  ]) assert.ok(skill.includes(phrase), `missing executable guidance: ${phrase}`);
});

test("Skill command overview covers every API and shortcut command in the manifest", async () => {
  const [skill, manifestText] = await Promise.all([
    readFile(SKILL, "utf8"),
    readFile(MANIFEST, "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  const expected = new Map();
  for (const entry of manifest.commands) {
    if (entry.source !== "api" && entry.source !== "shortcut") continue;
    const separator = entry.id.indexOf(".");
    if (separator < 0) continue;
    const group = entry.id.slice(0, separator);
    const command = entry.id.slice(separator + 1);
    if (!expected.has(group)) expected.set(group, new Set());
    expected.get(group).add(command);
  }

  const overview = new Map();
  for (const match of skill.matchAll(/^\|\s*`([^`]+)`\s*\|\s*([^|]+)\|/gm)) {
    const group = match[1].trim();
    const commands = match[2]
      .split(",")
      .map((command) => command.trim().replace(/`/g, "").replace(/（.*$/, ""))
      .filter(Boolean);
    overview.set(group, new Set(commands));
  }

  const missing = [];
  for (const [group, commands] of expected) {
    const documented = overview.get(group) ?? new Set();
    for (const command of commands) {
      if (!documented.has(command)) missing.push(`${group} ${command}`);
    }
  }
  assert.deepEqual(missing, [], "Skill command overview is missing manifest commands");
});

test("input-source precedence is deterministic and documented for JSONL and submitdata", async () => {
  const tempDir = await mkdtemp(resolve(process.env.TEMP ?? ".", "wjx-source-eval-"));
  try {
    const file = resolve(tempDir, "source.jsonl");
    await writeFile(file, jsonl(
      { qtype: "问卷基础信息", title: "文件标题", atype: 1 },
      { qtype: "单选", title: "文件题目", select: ["A", "B"] },
    ), "utf8");
    const inline = jsonl(
      { qtype: "问卷基础信息", title: "内联标题", atype: 1 },
      { qtype: "单选", title: "内联题目", select: ["A", "B"] },
    );
    const result = await runCli(["--dry-run", "survey", "create", "--jsonl", inline, "--file", file]);
    const body = parsePlanBody(parseSuccess(result));
    assert.match(body.surveydatajson, /内联标题/);
    assert.doesNotMatch(body.surveydatajson, /文件标题/);

    const submitFile = resolve(tempDir, "submitdata.txt");
    await writeFile(submitFile, "1$from-file", "utf8");
    const submit = await runCli(["--dry-run", "response", "submit", "--vid", "42", "--inputcosttime", "30", "--submitdata", "1$from-inline", "--submitdata-file", submitFile]);
    const submitBody = parsePlanBody(parseSuccess(submit));
    assert.equal(submitBody.submitdata, "1$from-file");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("network failures remain structured API errors and never leak stack traces", async () => {
  const result = await runCli(["survey", "list"], {
    env: { WJX_API_KEY: "network-eval-key", WJX_API_URL: "http://127.0.0.1:1/openapi/default.aspx" },
    timeout: 5_000,
  });
  const problem = parseProblem(result);
  assert.equal(problem.code, "API_ERROR");
  assert.doesNotMatch(result.stderr, /at .*wjx-cli|node_modules[\\/]wjx-api-sdk/);
});
