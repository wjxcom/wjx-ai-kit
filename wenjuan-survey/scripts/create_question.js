#!/usr/bin/env node
/**
 * 问卷网题目创建工具 V2 (Node.js 版本)
 * 完整工作流程：获取项目→检查状态→智能创建题目
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { requireAccessToken, getDefaultTokenDir } = require('./token_store');
const readline = require('readline');
const { generateSignature, CONFIG } = require('./generate_sign');
const { isProjectCollecting, ensureReadyForEdit } = require('./project_edit_guard');

const BASE_URL = "https://www.wenjuan.com/app_api/edit/create_question/";

async function getToken() {
  return requireAccessToken();
}

/**
 * 获取项目最新结构
 */
async function fetchProject(projectId) {
  try {
    const scriptDir = __dirname;
    const fetchScript = path.join(scriptDir, 'fetch_project.js');
    
    execSync(`node "${fetchScript}" --project-id "${projectId}" --json`, {
      cwd: path.join(scriptDir, '..'),
      stdio: 'pipe',
      encoding: 'utf-8'
    });

    const projectFile = path.join(getDefaultTokenDir(), "project_struct", `${projectId}.json`);
    const content = await fs.readFile(projectFile, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * 分析项目场景
 * 返回: [场景类型, 建议题型]
 * 场景类型: assess(测评), survey(调查), form(表单)
 */
function analyzeProjectScene(projectInfo) {
  const ptype = projectInfo.ptype_enname || 'survey';
  const sceneType = projectInfo.scene_type || 'questionnaire';

  if (ptype === 'assess' || sceneType === 'exam') {
    return ['assess', 'single'];
  } else if (ptype === 'form') {
    return ['form', 'fill'];
  } else {
    return ['survey', 'single'];
  }
}

/**
 * 构建带签名的参数
 */
function buildSignedParams(params) {
  const timestamp = String(Math.floor(Date.now() / 1000));

  const signInput = { ...params, timestamp };
  const signature = generateSignature(signInput, false);

  return {
    ...params,
    appkey: CONFIG.appkey,
    web_site: CONFIG.web_site,
    timestamp,
    signature,
  };
}

/**
 * 调用创建题目接口
 */
async function createQuestionApi(projectId, questionpageId, questionStruct, index) {
  await ensureReadyForEdit(projectId, { log: console.log });

  const token = await getToken();

  // 接口要求 question_struct JSON 字符串内必须含 project_id、questionpage_id（与外层参数一致）
  const struct = { ...questionStruct, project_id: projectId, questionpage_id: questionpageId };
  if (!struct.project_id || !struct.questionpage_id) {
    return { status_code: 0, err_code: "INVALID_PARAM", err_msg: "缺少 project_id 或 questionpage_id" };
  }
  const questionStructJson = JSON.stringify(struct);

  const businessParams = {
    project_id: projectId,
    questionpage_id: questionpageId,
    question_struct: questionStructJson,
    index: String(index),
  };

  const fullParams = buildSignedParams(businessParams);
  const encodedParams = new URLSearchParams(fullParams).toString();

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Authorization": `Bearer ${token}`,
  };

  try {
    const response = await axios.post(BASE_URL, encodedParams, { headers, timeout: 30000 });
    return response.data;
  } catch (error) {
    if (error.response) {
      return { status: error.response.status, error: error.response.statusText };
    }
    return { status: -1, error: error.message };
  }
}

// ==================== 题型结构 ====================

/**
 * 调查项目-单选题
 */
function createSingleChoiceSurvey(title, options, projectId = "", questionpageId = "") {
  const question = {
    project_id: projectId,
    questionpage_id: questionpageId,
    title,
    question_type: 2,
    custom_attr: {
      show_seq: "on",
      show_option_number: "on"
    },
    option_list: options.map(opt => ({ title: opt, custom_attr: {} }))
  };
  return question;
}

/**
 * 测评项目-单选题（含分值）
 */
function createSingleChoiceAssess(title, options, score = 5.0, projectId = "", questionpageId = "") {
  const question = {
    project_id: projectId,
    questionpage_id: questionpageId,
    title,
    question_type: 2,
    question_max_score: score,
    question_min_score: 0,
    custom_attr: {
      calculation: "only_one",
      total_score: score,
      answer_score: "on",
      show_seq: "on",
      show_option_number: "on"
    },
    option_list: options.map(opt => ({
      title: opt,
      is_open: false,
      custom_attr: { score: 0.0 }
    }))
  };

  return question;
}

/**
 * 调查项目-多选题
 */
function createMultiChoiceSurvey(title, options, projectId = "", questionpageId = "") {
  const question = {
    project_id: projectId,
    questionpage_id: questionpageId,
    title,
    question_type: 3,
    custom_attr: {
      calculation: "select",
      show_seq: "on",
      show_option_number: "on"
    },
    option_list: options.map(opt => ({ title: opt, custom_attr: {} }))
  };
  return question;
}

/**
 * 填空题
 */
function createFillBlank(title, blankType = "single", projectId = "", questionpageId = "") {
  const question = {
    project_id: projectId,
    questionpage_id: questionpageId,
    title,
    question_type: 6,
    custom_attr: {
      blank_type: blankType,
      show_seq: "on"
    },
    option_list: [{
      title: "填空1",
      is_open: false,
      custom_attr: { text_row: 1, text_col: 20 }
    }]
  };
  return question;
}

/**
 * 判断题
 */
function createJudgeChoice(title = "判断题", projectId = "", questionpageId = "") {
  const question = {
    project_id: projectId,
    questionpage_id: questionpageId,
    title,
    question_type: 2,
    custom_attr: {
      disp_type: "judge",
      show_seq: "on"
    },
    option_list: [
      { title: "是", is_open: false, custom_attr: {} },
      { title: "否", is_open: false, custom_attr: {} }
    ]
  };
  return question;
}

// ==================== 智能题目生成 ====================

function stripHtml(s) {
  return String(s || "").replace(/<[^>]+>/g, "");
}

/** 题干 / 选项文案去重规范化 */
function normalizeTitleForDedupe(s) {
  return stripHtml(String(s || ""))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getQuestionPlainTitle(q) {
  const raw = q.title_as_txt != null ? q.title_as_txt : q.title;
  const t = typeof raw === "string" ? raw : raw != null ? String(raw) : "";
  return stripHtml(t).replace(/\s+/g, " ").trim();
}

function iterateAllQuestions(projectInfo) {
  const out = [];
  for (const page of projectInfo.questionpage_list || []) {
    for (const q of page.question_list || []) out.push(q);
  }
  return out;
}

/** 已有题干集合（全部分页） */
function collectExistingTitles(projectInfo) {
  const set = new Set();
  for (const q of iterateAllQuestions(projectInfo)) {
    const n = normalizeTitleForDedupe(getQuestionPlainTitle(q));
    if (n) set.add(n);
  }
  return set;
}

/** 已有选择题选项文案（用于新题选项避让） */
function collectExistingOptionFingerprints(projectInfo) {
  const set = new Set();
  for (const q of iterateAllQuestions(projectInfo)) {
    for (const opt of q.option_list || []) {
      const raw = opt.title_as_txt != null ? opt.title_as_txt : opt.title;
      const t = typeof raw === "string" ? raw : raw != null ? String(raw) : "";
      const n = normalizeTitleForDedupe(t);
      if (n) set.add(n);
    }
  }
  return set;
}

/** 从最新项目结构提取主题与上下文（标题、卷首说明、已有题摘要） */
function deriveThemeLabel(projectInfo) {
  let raw = stripHtml((projectInfo.title_as_txt || projectInfo.title || "").trim());
  if (!raw) raw = stripHtml(String(projectInfo.name || "").trim());
  raw = raw.replace(/^请输入问卷标题\s*/i, "").trim();
  if (!raw) raw = "本问卷";
  const begin = stripHtml(projectInfo.begin_desc || projectInfo.begin_intro || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  if ((raw === "本问卷" || raw.length < 2) && begin.length >= 4) {
    raw = begin.length > 36 ? begin.slice(0, 33) + "…" : begin;
  }
  if (raw.length > 36) raw = raw.slice(0, 33) + "…";
  return raw;
}

function buildGenerationContext(projectInfo) {
  const themeLabel = deriveThemeLabel(projectInfo);
  const beginSnippet = stripHtml(projectInfo.begin_desc || projectInfo.begin_intro || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 56);
  const allQ = iterateAllQuestions(projectInfo);
  const recentTitles = allQ.map(getQuestionPlainTitle).filter(Boolean).slice(-5);
  return {
    themeLabel,
    beginSnippet,
    recentTitles,
    existingTitles: collectExistingTitles(projectInfo),
    optionFingerprints: collectExistingOptionFingerprints(projectInfo),
    existingCount: allQ.length,
  };
}

/** 最近一题题干缩略，用于新题措辞呼应 */
function recentLead(recentTitles, maxLen = 18) {
  if (!recentTitles.length) return "";
  const last = recentTitles[recentTitles.length - 1];
  if (last.length <= maxLen) return last;
  return last.slice(0, maxLen - 1) + "…";
}

/** 避免新题选项与全卷已有选项字面重复 */
function ensureOptionsNotConflicting(options, fingerprints) {
  if (!options || !fingerprints) return options;
  const pool = [
    "暂不涉及",
    "有待进一步了解",
    "希望后续补充",
    "以上均未涵盖",
    "视情况而定",
    "需要更多信息",
    "暂无偏好",
    "其他说明",
  ];
  let pi = 0;
  return options.map((o, idx) => {
    let x = String(o);
    if (!fingerprints.has(normalizeTitleForDedupe(x))) return x;
    while (pi < pool.length) {
      const c = pool[pi++];
      if (!fingerprints.has(normalizeTitleForDedupe(c))) return c;
    }
    return `${x}（${idx + 1}）`;
  });
}

/**
 * 依据项目场景 + 生成上下文构造候选题（题干嵌主题，必要时呼应卷首与前一题）
 * @returns {{ type: string, title: string, options: string[]|null }[]}
 */
function buildContextualCandidates(scene, ctx) {
  const t = ctx.themeLabel;
  const b = ctx.beginSnippet && ctx.beginSnippet.length >= 6 ? ctx.beginSnippet : "";
  const rq = recentLead(ctx.recentTitles);
  const tail = rq ? `结合您前一题「${rq}」` : "";

  if (scene === "assess") {
    return [
      {
        type: "single",
        title: b
          ? `关于「${t}」（${b.length > 20 ? b.slice(0, 17) + "…" : b}），下列描述最符合您的是？`
          : `关于「${t}」，下列描述最符合您的是？`,
        options: ["完全同意", "比较同意", "一般", "不太同意", "完全不同意"],
      },
      {
        type: "multi",
        title: tail
          ? `${tail}，与「${t}」相关的能力中您具备哪些？（可多选）`
          : `与「${t}」相关的能力或素养中，您认为自身具备哪些？（可多选）`,
        options: ["理论知识", "实操经验", "沟通协作", "分析解决问题", "其他"],
      },
      { type: "judge", title: `您是否已完成「${t}」要求的学习或准备？`, options: null },
      { type: "fill", title: `请简述您对「${t}」的理解或学习体会：`, options: null },
      {
        type: "single",
        title: `您对「${t}」相关内容的掌握程度自评是？`,
        options: ["优秀", "良好", "中等", "及格", "需加强"],
      },
    ];
  }
  if (scene === "form") {
    return [
      { type: "fill", title: `「${t}」—— 姓名`, options: null },
      { type: "fill", title: `「${t}」—— 联系电话`, options: null },
      { type: "fill", title: `「${t}」—— 电子邮箱`, options: null },
      { type: "fill", title: `「${t}」—— 单位 / 组织名称`, options: null },
      { type: "fill", title: `「${t}」—— 其他需要说明的信息`, options: null },
    ];
  }
  return [
    {
      type: "single",
      title: b
        ? `关于「${t}」（说明：${b.length > 22 ? b.slice(0, 19) + "…" : b}），您的总体满意程度是？`
        : `您对「${t}」的整体满意度是？`,
      options: ["非常满意", "满意", "一般", "不满意", "非常不满意"],
    },
    {
      type: "multi",
      title: tail
        ? `${tail}，在「${t}」相关事项中您认为还有哪些方面值得关注？（可多选）`
        : `关于「${t}」，您认为哪些方面值得关注？（可多选）`,
      options: ["内容清晰度", "流程便捷性", "反馈及时性", "信息完整性", "其他"],
    },
    { type: "fill", title: `请留下您对「${t}」的意见或建议：`, options: null },
    {
      type: "single",
      title: `您认为「${t}」最需要在哪些方面改进？`,
      options: ["内容质量", "流程与体验", "服务态度", "时效与效率", "暂无需改进"],
    },
    {
      type: "fill",
      title: rq
        ? `承接上文，关于「${t}」与「${rq}」，您是否还有其他补充？`
        : `与「${t}」相关，是否还有其他想补充说明的内容？`,
      options: null,
    },
    { type: "judge", title: `您是否愿意再次参与与「${t}」类似的调研？`, options: null },
  ];
}

function pickNonDuplicateCandidate(candidates, existingSet, preferredType, rotationStart) {
  const want = preferredType && preferredType !== "auto" ? preferredType : null;
  let pool = want ? candidates.filter((c) => c.type === want) : [...candidates];
  if (want && pool.length === 0) pool = [...candidates];
  const len = Math.max(pool.length, 1);
  const start = Math.abs(rotationStart || 0) % len;
  const rotated = [...pool.slice(start), ...pool.slice(0, start)];
  for (const c of rotated) {
    if (!existingSet.has(normalizeTitleForDedupe(c.title))) return { ...c };
  }
  const base = pool[0] || candidates[0];
  let n = 2;
  let candidateTitle = `${base.title}（${n}）`;
  while (existingSet.has(normalizeTitleForDedupe(candidateTitle))) {
    n += 1;
    candidateTitle = `${base.title}（${n}）`;
  }
  return { ...base, title: candidateTitle };
}

function defaultOptionsForType(finalType) {
  if (finalType === "fill" || finalType === "judge") return null;
  return ["选项A", "选项B", "选项C"];
}

/**
 * 根据最新项目结构智能生成题目（未传 title 时：主题 + 卷首/已有题上下文，题干与选项避让重复）
 * @param {Set<string>} [existingTitleSet] 不传则用 projectInfo 计算
 * @param {object} [generationContext] 不传则内部 buildGenerationContext(projectInfo)
 */
function generateSmartQuestion(
  scene,
  projectInfo,
  title = null,
  qType = null,
  projectId = "",
  questionpageId = "",
  existingTitleSet = null,
  generationContext = null
) {
  const ctx = generationContext || buildGenerationContext(projectInfo);
  const existingSet =
    existingTitleSet instanceof Set ? existingTitleSet : ctx.existingTitles;
  const existingCount = ctx.existingCount;
  const candidates = buildContextualCandidates(scene, ctx);

  const explicitTitle = title != null && String(title).trim() !== "";

  let finalType;
  let finalTitle;
  let finalOptions;

  if (explicitTitle) {
    finalTitle = String(title).trim();
    finalType =
      qType && qType !== "auto"
        ? qType
        : candidates[existingCount % candidates.length].type;
    const optSource = candidates.find((c) => c.type === finalType);
    finalOptions =
      optSource && optSource.options != null
        ? optSource.options
        : defaultOptionsForType(finalType);
  } else {
    const preferred = qType && qType !== "auto" ? qType : null;
    const picked = pickNonDuplicateCandidate(
      candidates,
      existingSet,
      preferred,
      existingCount
    );
    finalType = picked.type;
    finalTitle = picked.title;
    finalOptions =
      picked.options != null ? picked.options : defaultOptionsForType(finalType);
  }

  if (finalOptions && Array.isArray(finalOptions)) {
    finalOptions = ensureOptionsNotConflicting(finalOptions, ctx.optionFingerprints);
  }

  if (finalType === "single") {
    const opts = finalOptions || ["选项A", "选项B", "选项C"];
    if (scene === "assess") {
      return [
        createSingleChoiceAssess(finalTitle, opts, 5.0, projectId, questionpageId),
        "单选题（测评）",
      ];
    }
    return [createSingleChoiceSurvey(finalTitle, opts, projectId, questionpageId), "单选题"];
  }
  if (finalType === "multi") {
    const opts = finalOptions || ["选项A", "选项B", "选项C", "选项D"];
    return [createMultiChoiceSurvey(finalTitle, opts, projectId, questionpageId), "多选题"];
  }
  if (finalType === "fill") {
    return [createFillBlank(finalTitle, "single", projectId, questionpageId), "填空题"];
  }
  if (finalType === "judge") {
    return [createJudgeChoice(finalTitle, projectId, questionpageId), "判断题"];
  }
  const opts = finalOptions || ["选项A", "选项B", "选项C"];
  return [createSingleChoiceSurvey(finalTitle, opts, projectId, questionpageId), "单选题"];
}

/**
 * 获取项目列表
 */
async function listProjects() {
  try {
    const token = await getToken();
    const scriptDir = __dirname;
    const listScript = path.join(scriptDir, 'list_projects.js');
    
    const result = execSync(`node "${listScript}" -t "${token}" -n 20 --json`, {
      cwd: path.join(scriptDir, '..'),
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    const data = JSON.parse(result);
    return data.data?.list || [];
  } catch (error) {
    return [];
  }
}

/**
 * 让用户从列表中选择项目
 */
async function selectProject() {
  console.log("\n未指定项目ID，正在获取项目列表...");
  const projects = await listProjects();

  if (!projects.length) {
    console.error("❌ 错误: 无法获取项目列表或列表为空");
    process.exit(1);
  }

  console.log(`\n找到 ${projects.length} 个项目:\n`);
  console.log(`${'序号'.padEnd(4)} ${'项目标题'.padEnd(30)} ${'项目ID'.padEnd(26)} ${'状态'.padEnd(8)}`);
  console.log("-".repeat(70));

  for (let i = 0; i < Math.min(projects.length, 20); i++) {
    const proj = projects[i];
    const title = (proj.title || "未命名").substring(0, 28).padEnd(30);
    
    let pid;
    if (proj._id && typeof proj._id === 'object') {
      pid = (proj._id.$oid || "N/A").substring(0, 24).padEnd(26);
    } else {
      pid = String(proj._id || "N/A").substring(0, 24).padEnd(26);
    }
    
    const status = (isProjectCollecting(proj) ? "收集中" : "未发布").padEnd(8);
    console.log(`${String(i + 1).padEnd(4)} ${title} ${pid} ${status}`);
  }

  console.log();
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  while (true) {
    try {
      const choice = await new Promise((resolve) => {
        rl.question(`请选择项目序号 (1-${Math.min(projects.length, 20)}): `, resolve);
      });
      
      const idx = parseInt(choice, 10) - 1;
      if (idx >= 0 && idx < Math.min(projects.length, 20)) {
        const proj = projects[idx];
        rl.close();
        if (proj._id && typeof proj._id === 'object') {
          return proj._id.$oid;
        } else {
          return String(proj._id);
        }
      } else {
        console.log("❌ 无效的序号，请重新选择");
      }
    } catch (error) {
      if (error.message === 'cancelled') {
        console.log("\n已取消");
        process.exit(0);
      }
      console.log("❌ 请输入数字");
    }
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
问卷网题目创建工具 V2 - 智能创建题目

用法: node create_question.js [project_id] [选项]

参数:
  project_id              项目ID（可选，不传则从列表选择）

选项:
  --type <type>           题型: auto(自动)/single(单选)/multi(多选)/fill(填空)/judge(判断)
  --title <title>         题目标题（可选；不传则按最新项目结构中的项目信息与已有题目生成，去重）
  --options <options>     选项，逗号分隔（可选）
  --index <index>         插入位置，0-based（默认末尾）
  -h, --help              显示帮助信息

示例:
  # 从列表中选择项目，智能添加题目
  node create_question.js

  # 指定项目ID，智能添加题目
  node create_question.js 69cf1ec220c788db14aa18e8

  # 指定项目ID和题型
  node create_question.js 69cf1ec220c788db14aa18e8 --type single --title "您的性别？"

  # 指定完整题目内容
  node create_question.js 69cf1ec220c788db14aa18e8 --type multi --title "喜欢的颜色？" --options "红,绿,蓝"
`);
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  // 解析参数
  let projectId = null;
  let type = "auto";
  let title = null;
  let optionsStr = null;
  let index = null;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '-h' || arg === '--help') {
      showHelp();
      process.exit(0);
    } else if (arg === '--type' && i + 1 < args.length) {
      type = args[++i];
    } else if (arg === '--title' && i + 1 < args.length) {
      title = args[++i];
    } else if (arg === '--options' && i + 1 < args.length) {
      optionsStr = args[++i];
    } else if (arg === '--index' && i + 1 < args.length) {
      index = parseInt(args[++i], 10);
    } else if (!arg.startsWith('-') && !projectId) {
      projectId = arg;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("问卷网题目创建工具 V2");
  console.log("=".repeat(50));

  // 获取项目ID
  if (!projectId) {
    projectId = await selectProject();
    console.log(`\n已选择项目: ${projectId}`);
  }

  // 1. 获取项目信息
  console.log("\n[1/4] 获取项目信息...");
  let projectInfo = await fetchProject(projectId);
  if (!projectInfo) {
    console.error(`❌ 错误: 无法获取项目 ${projectId} 的信息`);
    process.exit(1);
  }

  const projectTitle = projectInfo.title || "未命名";
  const ptype = projectInfo.ptype_enname || "survey";
  console.log(`  项目标题: ${projectTitle}`);
  console.log(`  项目类型: ${ptype}`);

  // 2. 分析场景（停收 + 归档在 createQuestionApi 内强制执行）
  console.log("\n[2/4] 分析项目场景...");
  const [scene] = analyzeProjectScene(projectInfo);
  console.log(`  项目场景: ${scene}`);

  // 获取分页ID
  let questionpageId = null;
  if (projectInfo.questionpage_id_list && projectInfo.questionpage_id_list.length > 0) {
    questionpageId = projectInfo.questionpage_id_list[0];
  } else if (projectInfo.questionpage_list && projectInfo.questionpage_list.length > 0) {
    const firstPage = projectInfo.questionpage_list[0];
    const rawPid = firstPage._id;
    questionpageId =
      (typeof rawPid === "object" && rawPid && rawPid.$oid) ||
      (typeof rawPid === "string" ? rawPid : null) ||
      firstPage.page_id ||
      firstPage.questionpage_id;
  }

  if (!questionpageId) {
    console.error("❌ 错误: 无法获取分页ID");
    process.exit(1);
  }

  // 3. 拉取最新结构：插入位置 + 基于项目信息与已有题目生成题干/选项（未传 --title 时）
  console.log("\n[3/4] 获取最新项目结构并生成题目...");
  const latestProjectInfo = await fetchProject(projectId);
  const baseInfo = latestProjectInfo || projectInfo;
  const genCtx = buildGenerationContext(baseInfo);
  const titleSet = genCtx.existingTitles;
  const latestQuestions = baseInfo.questionpage_list?.[0]?.question_list || [];
  const finalIndex = index !== null ? index : latestQuestions.length;
  console.log(`  当前题目数: ${latestQuestions.length}, 新题目插入位置: ${finalIndex}`);
  console.log(`  生成上下文主题: ${genCtx.themeLabel}`);

  const options = optionsStr ? optionsStr.split(",") : null;
  const qType = type !== "auto" ? type : null;
  const explicitTitle = title != null && String(title).trim() !== "";
  if (explicitTitle && titleSet.has(normalizeTitleForDedupe(title))) {
    console.error("❌ 错误: 项目中已存在相同或近似的题干，请更换 --title 后再试");
    process.exit(1);
  }

  const [questionStruct, qtypeDesc] = generateSmartQuestion(
    scene,
    baseInfo,
    title,
    qType,
    projectId,
    questionpageId,
    titleSet,
    genCtx
  );

  // 若通过 --options 传入选项：单选/多选按列表完整重建 option_list（不再受模板槽位数限制）
  if (options && options.length > 0 && questionStruct.option_list) {
    const trimmed = options.map(o => String(o).trim()).filter(Boolean);
    const qt = questionStruct.question_type;
    if (qt === 3) {
      questionStruct.option_list = trimmed.map(t => ({ title: t, custom_attr: {} }));
    } else if (qt === 2) {
      const assessOpts =
        questionStruct.custom_attr &&
        (questionStruct.custom_attr.answer_score === "on" || questionStruct.question_max_score != null);
      if (assessOpts) {
        questionStruct.option_list = trimmed.map(t => ({
          title: t,
          is_open: false,
          custom_attr: { score: 0.0 },
        }));
      } else {
        questionStruct.option_list = trimmed.map(t => ({ title: t, custom_attr: {} }));
      }
    } else {
      for (let i = 0; i < trimmed.length; i++) {
        if (i < questionStruct.option_list.length) {
          questionStruct.option_list[i].title = trimmed[i];
        }
      }
    }
  }

  console.log(`  题型: ${qtypeDesc}`);
  console.log(`  标题: ${questionStruct.title}`);
  if (questionStruct.option_list) {
    console.log(`  选项: ${questionStruct.option_list.map(opt => opt.title)}`);
  }

  console.log("\n[4/4] 停收 + 归档后创建题目…");
  const result = await createQuestionApi(projectId, questionpageId, questionStruct, finalIndex);

  if (result.status_code === 1) {
    console.log("\n✅ 题目创建成功");
    if (result.data) {
      const qid = result.data._id?.$oid;
      if (qid) {
        console.log(`  题目ID: ${qid}`);
      }
    }
  } else {
    const errCode = result.err_code || 'Unknown';
    const errMsg = result.err_msg || result.error || '未知错误';
    console.error(`\n❌ 创建失败 [${errCode}]: ${errMsg}`);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    console.error("❌ 错误:", error.message);
    process.exit(1);
  });
}

// 导出模块
module.exports = {
  createSingleChoiceSurvey,
  createSingleChoiceAssess,
  createMultiChoiceSurvey,
  createFillBlank,
  createJudgeChoice,
  generateSmartQuestion,
  fetchProject,
  createQuestionApi,
  normalizeTitleForDedupe,
  collectExistingTitles,
  buildGenerationContext,
  buildContextualCandidates,
  ensureOptionsNotConflicting,
};
