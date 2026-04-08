#!/usr/bin/env node
/**
 * 问卷网题目编辑工具 (Node.js 版本)
 * 支持题目标题编辑、选项的增删改、矩阵行编辑等
 * 
 * 执行流程:
 * 1. 获取存储的 JWT token
 * 2. 获取项目最新结构
 * 3. 检查项目状态，如果收集中则停止项目
 * 4. 生成 API 签名
 * 5. 执行题目编辑操作
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const { requireAccessToken, getDefaultTokenDir } = require('./token_store');
const readline = require('readline');
const { generateSignature, CONFIG } = require('./generate_sign');

const API_URL = "https://www.wenjuan.com/app_api/edit/edit_question/";

// 错误码映射表
const ERROR_CODE_MAP = {
  10003: "参数错误（如缺少 question_struct）",
  10026: "项目已删除，禁止编辑",
  11004: "修改进行中（项目编辑锁占用，需稍后重试）",
  11027: "商品题库存小于冻结库存（仅商品题）",
  20034: "题目不存在",
  30027: "题目为隐藏题等，不可操作",
  30066: "选项已参与显示逻辑，不能删除",
  30024: "选项用于答题回执条件，不能删除",
  30019: "选项已关联其它题目且设了逻辑，不能删除",
  30020: "选项设了配额，需先删配额",
  30143: "选项数量超过上限",
  30038: "已参与按题型随机抽题，不能切换题型",
  30033: "项目开启随机抽题等与跳题逻辑冲突",
  30032: "项目开启打乱顺序等与跳题逻辑冲突",
  30039: "项目开启练习模式等与跳题逻辑冲突",
  30040: "项目开启答题卡等与跳题逻辑冲突",
  30061: "题目已用于排行榜：禁止单选改多选",
  30062: "题目已用于排行榜：禁止开启答案分值",
};

/**
 * 格式化错误信息
 */
function formatError(errCode, errMsg = "") {
  const codeDesc = ERROR_CODE_MAP[errCode] || "未知错误";
  if (errMsg) {
    return `[${errCode}] ${codeDesc}: ${errMsg}`;
  }
  return `[${errCode}] ${codeDesc}`;
}

async function loadToken() {
  return requireAccessToken();
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
 * 发送 HTTP 请求
 */
async function makeRequest(params, method = "POST", token) {
  const headers = {
    "Authorization": `Bearer ${token}`,
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"
  };

  try {
    if (method === "GET") {
      const response = await axios.get(API_URL, { params, headers, timeout: 30000 });
      return response.data;
    } else {
      const encodedParams = new URLSearchParams(params).toString();
      headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
      const response = await axios.post(API_URL, encodedParams, { headers, timeout: 30000 });
      return response.data;
    }
  } catch (error) {
    if (error.response) {
      return { status: error.response.status, error: error.response.statusText, ...error.response.data };
    }
    return { status: -1, error: error.message };
  }
}

/**
 * 辅助函数：提取 OID
 */
function extractOid(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.$oid || '';
  return '';
}

/**
 * 辅助函数：将 HTML 标题转为纯文本
 */
function titleToText(title) {
  if (!title) return '';
  return title.replace(/<[^>]+>/g, '').trim();
}

/**
 * 辅助函数：从 cid 提取序号
 */
function seqFromCid(cid) {
  if (!cid) return 0;
  const match = cid.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * 从题目结构中移除 title_as_txt（题干、选项、矩阵行），避免部分接口在同时带 title 与 title_as_txt 时报 500。
 */
function stripTitleAsTxtDeep(struct) {
  if (!struct || typeof struct !== "object") return struct;
  const out = JSON.parse(JSON.stringify(struct));
  delete out.title_as_txt;
  if (Array.isArray(out.option_list)) {
    out.option_list = out.option_list.map((opt) => {
      const o = { ...opt };
      delete o.title_as_txt;
      return o;
    });
  }
  if (Array.isArray(out.matrixrow_list)) {
    out.matrixrow_list = out.matrixrow_list.map((row) => {
      const r = { ...row };
      delete r.title_as_txt;
      return r;
    });
  }
  return out;
}

/**
 * 题目编辑器类
 */
class QuestionEditor {
  constructor() {
    this.token = null;
  }

  async init() {
    this.token = await loadToken();
  }

  /**
   * 获取题目详情
   */
  async getQuestion(projectId, questionId) {
    const params = buildSignedParams({
      project_id: projectId,
      question_id: questionId
    });

    const result = await makeRequest(params, "GET", this.token);

    if (result.status_code === 1 && result.data) {
      return result.data;
    } else {
      const errCode = result.err_code || '';
      const errMsg = result.err_msg || result.message || result.error || '未知错误';
      throw new Error(`获取题目失败: ${formatError(errCode, errMsg)}`);
    }
  }

  /**
   * 更新题目（失败时自动去掉 title_as_txt 重试一次，兼容平台对字段组合的校验差异）
   * 每次提交前强制执行 ensureReadyForEdit（停收 + 归档），禁止调用方绕过。
   */
  async updateQuestion(projectId, questionId, questionStruct) {
    const { ensureReadyForEdit } = require("./project_edit_guard");
    await ensureReadyForEdit(projectId, { log: console.log });

    const post = async (struct) => {
      const params = buildSignedParams({
        project_id: projectId,
        question_id: questionId,
        question_struct: JSON.stringify(struct),
      });
      return makeRequest(params, "POST", this.token);
    };

    let result = await post(questionStruct);

    if (Number(result.status_code) !== 1) {
      const stripped = stripTitleAsTxtDeep(questionStruct);
      result = await post(stripped);
    }

    if (Number(result.status_code) === 1) {
      return result.data || {};
    }
    const errCode = result.err_code || result.status || "";
    const errMsg = result.err_msg || result.message || result.error || "未知错误";
    throw new Error(`更新题目失败: ${formatError(errCode, errMsg)}`);
  }

  /**
   * 将题目数据转换为 question_struct 格式
   */
  _toQuestionStruct(questionData) {
    const questionId = questionData.question_id || extractOid(questionData._id);
    const titleText = questionData.title_as_txt || titleToText(questionData.title);
    const titleHtml = questionData.title && questionData.title.includes('<') 
      ? questionData.title 
      : `<p>${titleText}</p>`;

    // 必须包含 project_id 和 questionpage_id，否则 API 会返回 500
    const struct = {
      _id: { $oid: questionId },
      project_id: questionData.project_id || questionData.proj_id,
      questionpage_id: questionData.questionpage_id || questionData.page_id,
      cid: questionData.cid || 'Q1',
      title: titleHtml,
      title_as_txt: titleText,
      question_type: questionData.question_type || 2,
      is_required: questionData.is_required !== undefined ? questionData.is_required : 1,
      seq: questionData.seq || seqFromCid(questionData.cid) || 1,
      custom_attr: questionData.custom_attr || {},
      option_id_list: questionData.option_id_list || [],
      option_list: [],
      matrixrow_list: [],
      matrixrow_id_list: questionData.matrixrow_id_list || [],
      extra_option_list: questionData.extra_option_list || [],
      extra_option_id_list: questionData.extra_option_id_list || [],
      jumpconstraint_list2: questionData.jumpconstraint_list2 || [],
      has_open_option: questionData.has_open_option || false,
    };

    // 添加可选字段
    ['option_group_list', 'question_max_score', 'question_min_score'].forEach(field => {
      if (field in questionData) {
        struct[field] = questionData[field];
      }
    });

    // 处理选项列表
    (questionData.option_list || []).forEach((opt, idx) => {
      const optionId = opt.option_id || extractOid(opt._id);
      const optStruct = {
        _id: { $oid: optionId },
        cid: opt.cid || `A${idx + 1}`,
        title: opt.title || '',
        title_as_txt: opt.title_as_txt || titleToText(opt.title || ''),
        question_id: questionId,
        custom_attr: opt.custom_attr || {},
        seq: opt.seq || idx + 1,
      };
      ['is_open', 'has_other', 'is_answer'].forEach(field => {
        if (field in opt) optStruct[field] = opt[field];
      });
      struct.option_list.push(optStruct);
    });

    // 处理矩阵行列表
    (questionData.matrixrow_list || []).forEach((row, idx) => {
      const rowId = row.matrixrow_id || extractOid(row._id);
      const rowStruct = {
        _id: { $oid: rowId },
        cid: row.cid || `R${idx + 1}`,
        title: row.title || '',
        title_as_txt: row.title_as_txt || titleToText(row.title || ''),
        question_id: questionId,
        custom_attr: row.custom_attr || {},
        seq: row.seq || idx + 1,
      };
      if ('is_open' in row) rowStruct.is_open = row.is_open;
      struct.matrixrow_list.push(rowStruct);
    });

    return struct;
  }

  /**
   * 编辑题目标题
   */
  async editTitle(projectId, questionId, title) {
    const question = await this.getQuestion(projectId, questionId);
    const questionStruct = this._toQuestionStruct(question);

    questionStruct.title = `<p>${title}</p>`;
    delete questionStruct.title_as_txt;
    (questionStruct.option_list || []).forEach((opt) => {
      delete opt.title_as_txt;
    });
    (questionStruct.matrixrow_list || []).forEach((row) => {
      delete row.title_as_txt;
    });

    return await this.updateQuestion(projectId, questionId, questionStruct);
  }

  /**
   * 编辑选项
   */
  async editOption(projectId, questionId, optionId, newTitle, customAttr = null) {
    const question = await this.getQuestion(projectId, questionId);
    const questionStruct = this._toQuestionStruct(question);

    let found = false;
    for (const option of questionStruct.option_list) {
      const optionOid = extractOid(option._id);
      if (optionOid === optionId) {
        option.title = `<p>${newTitle}</p>`;
        option.title_as_txt = newTitle;
        if (customAttr) {
          if (!option.custom_attr) option.custom_attr = {};
          Object.assign(option.custom_attr, customAttr);
        }
        found = true;
        break;
      }
    }

    if (!found) {
      throw new Error(`选项 ${optionId} 不存在`);
    }

    return await this.updateQuestion(projectId, questionId, questionStruct);
  }

  /**
   * 删除选项
   */
  async deleteOption(projectId, questionId, optionId) {
    const question = await this.getQuestion(projectId, questionId);
    const questionStruct = this._toQuestionStruct(question);

    const originalCount = questionStruct.option_list.length;
    questionStruct.option_list = questionStruct.option_list.filter(
      opt => extractOid(opt._id) !== optionId
    );

    if (questionStruct.option_list.length === originalCount) {
      throw new Error(`选项 ${optionId} 不存在`);
    }

    // 重新排序
    questionStruct.option_list.forEach((option, i) => {
      option.seq = i + 1;
    });

    return await this.updateQuestion(projectId, questionId, questionStruct);
  }

  /**
   * 新增选项
   */
  async addOption(projectId, questionId, title, isAnswer = false, score = 0, customAttr = null) {
    const question = await this.getQuestion(projectId, questionId);
    const questionStruct = this._toQuestionStruct(question);

    const optionList = questionStruct.option_list;
    const maxSeq = Math.max(...optionList.map(opt => opt.seq || 0), 0);

    // 生成新 cid
    let maxCidNum = 0;
    for (const opt of optionList) {
      const match = (opt.cid || '').match(/(\d+)$/);
      if (match) maxCidNum = Math.max(maxCidNum, parseInt(match[1], 10));
    }
    const newCid = `A${maxCidNum + 1}`;

    // 构建 custom_attr
    const optCustomAttr = { score };
    if (isAnswer) optCustomAttr.is_correct = "1";
    if (customAttr) Object.assign(optCustomAttr, customAttr);

    // 创建新选项
    const newOption = {
      cid: newCid,
      title: `<p>${title}</p>`,
      title_as_txt: title,
      seq: maxSeq + 1,
      custom_attr: optCustomAttr,
      has_other: 0,
      is_open: false,
      is_answer: isAnswer ? 1 : 0
    };

    if (!questionStruct.option_list) questionStruct.option_list = [];
    questionStruct.option_list.push(newOption);

    return await this.updateQuestion(projectId, questionId, questionStruct);
  }

  /**
   * 编辑矩阵行
   */
  async editMatrixRow(projectId, questionId, rowId, newTitle) {
    const question = await this.getQuestion(projectId, questionId);
    const questionStruct = this._toQuestionStruct(question);

    let found = false;
    for (const row of questionStruct.matrixrow_list) {
      const rowOid = extractOid(row._id);
      if (rowOid === rowId) {
        row.title = `<p>${newTitle}</p>`;
        row.title_as_txt = newTitle;
        found = true;
        break;
      }
    }

    if (!found) {
      throw new Error(`矩阵行 ${rowId} 不存在`);
    }

    return await this.updateQuestion(projectId, questionId, questionStruct);
  }

  /**
   * 删除矩阵行
   */
  async deleteMatrixRow(projectId, questionId, rowId) {
    const question = await this.getQuestion(projectId, questionId);
    const questionStruct = this._toQuestionStruct(question);

    const originalCount = questionStruct.matrixrow_list.length;
    questionStruct.matrixrow_list = questionStruct.matrixrow_list.filter(
      row => extractOid(row._id) !== rowId
    );

    if (questionStruct.matrixrow_list.length === originalCount) {
      throw new Error(`矩阵行 ${rowId} 不存在`);
    }

    // 重新排序
    questionStruct.matrixrow_list.forEach((row, i) => {
      row.seq = i + 1;
    });

    return await this.updateQuestion(projectId, questionId, questionStruct);
  }

  /**
   * 新增矩阵行
   */
  async addMatrixRow(projectId, questionId, title) {
    const question = await this.getQuestion(projectId, questionId);
    const questionStruct = this._toQuestionStruct(question);

    const rowList = questionStruct.matrixrow_list;
    const maxSeq = Math.max(...rowList.map(row => row.seq || 0), 0);

    // 生成新 cid
    let maxCidNum = 0;
    for (const row of rowList) {
      const match = (row.cid || '').match(/(\d+)$/);
      if (match) maxCidNum = Math.max(maxCidNum, parseInt(match[1], 10));
    }
    const newCid = `R${maxCidNum + 1}`;

    // 创建新矩阵行
    const newRow = {
      cid: newCid,
      title: `<p>${title}</p>`,
      title_as_txt: title,
      seq: maxSeq + 1,
      is_open: false,
      custom_attr: {}
    };

    if (!questionStruct.matrixrow_list) questionStruct.matrixrow_list = [];
    questionStruct.matrixrow_list.push(newRow);

    return await this.updateQuestion(projectId, questionId, questionStruct);
  }
}

/**
 * 列出项目题目
 */
async function listQuestions(projectId) {
  console.log("\n📋 项目题目列表");
  console.log("=".repeat(60));

  const token = await loadToken();
  const scriptDir = __dirname;
  const fetchScript = path.join(scriptDir, 'fetch_project.js');
  
  try {
    execSync(`node "${fetchScript}" --project-id "${projectId}" --json`, {
      cwd: path.join(scriptDir, '..'),
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    const projectFile = path.join(getDefaultTokenDir(), "project_struct", `${projectId}.json`);
    const content = await fs.readFile(projectFile, 'utf-8');
    const projectData = JSON.parse(content);

    const questions = [];
    for (const page of projectData.questionpage_list || []) {
      for (const q of page.question_list || []) {
        const qId = q.question_id || extractOid(q._id);
        const qTitle = q.title_as_txt || titleToText(q.title) || "无标题";
        const qType = q.question_type || '未知';
        questions.push({ id: qId, title: qTitle, type: qType });
      }
    }

    console.log(`\n项目: ${projectData.title || 'N/A'}`);
    console.log(`共 ${questions.length} 道题目:\n`);

    questions.forEach((q, i) => {
      const displayTitle = q.title.length > 40 ? q.title.substring(0, 40) + '...' : q.title;
      console.log(`[${i + 1}] ${displayTitle}`);
      console.log(`    Question ID: ${q.id}`);
      console.log(`    Type: ${q.type}`);
    });

    console.log("\n" + "=".repeat(60));
    console.log("使用: node edit_question.js <project_id> <question_id> [操作]");
  } catch (error) {
    console.error(`✗ 获取题目列表失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
问卷网题目编辑工具 - 自动处理项目状态

执行流程:
  1. 获取项目最新结构
  2. 检查项目状态，如果收集中则停止项目
  3. 执行题目编辑操作

用法: node edit_question.js <project_id> <question_id> [选项]

参数:
  project_id              项目ID
  question_id             题目ID

选项:
  --edit-title <title>    编辑题目标题
  --edit-option <id>      编辑选项（需配合 --option-title）
  --option-title <title>  选项新标题
  --delete-option <id>    删除选项
  --add-option <title>    新增选项
  --is-answer             新增选项设为正确答案
  --score <score>         选项分值（默认0）
  --edit-matrix-row <id>  编辑矩阵行（需配合 --row-title）
  --row-title <title>     矩阵行新标题
  --delete-matrix-row <id> 删除矩阵行
  --add-matrix-row <title> 新增矩阵行
  -l, --list              列出项目所有题目
  -h, --help              显示帮助信息

示例:
  # 编辑题目标题
  node edit_question.js 69cf1d8e20c788db0daa198e 69cf1d8f20c788db0daa1992 --edit-title "新的题目"

  # 列出题目
  node edit_question.js 69cf1d8e20c788db0daa198e -l

  # 编辑选项
  node edit_question.js <project_id> <question_id> --edit-option <option_id> --option-title "新选项"

  # 删除选项
  node edit_question.js <project_id> <question_id> --delete-option <option_id>

  # 新增选项（设为正确答案，得5分）
  node edit_question.js <project_id> <question_id> --add-option "正确答案" --is-answer --score 5

  # 编辑矩阵行
  node edit_question.js <project_id> <question_id> --edit-matrix-row <row_id> --row-title "新行标题"
`);
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  // 解析参数
  let projectId = null;
  let questionId = null;
  let listMode = false;
  const actions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '-h' || arg === '--help') {
      showHelp();
      process.exit(0);
    } else if (arg === '-l' || arg === '--list') {
      listMode = true;
    } else if (arg === '--edit-title' && i + 1 < args.length) {
      actions.editTitle = args[++i];
    } else if (arg === '--edit-option' && i + 1 < args.length) {
      actions.editOption = args[++i];
    } else if (arg === '--option-title' && i + 1 < args.length) {
      actions.optionTitle = args[++i];
    } else if (arg === '--delete-option' && i + 1 < args.length) {
      actions.deleteOption = args[++i];
    } else if (arg === '--add-option' && i + 1 < args.length) {
      actions.addOption = args[++i];
    } else if (arg === '--is-answer') {
      actions.isAnswer = true;
    } else if (arg === '--score' && i + 1 < args.length) {
      actions.score = parseInt(args[++i], 10);
    } else if (arg === '--edit-matrix-row' && i + 1 < args.length) {
      actions.editMatrixRow = args[++i];
    } else if (arg === '--row-title' && i + 1 < args.length) {
      actions.rowTitle = args[++i];
    } else if (arg === '--delete-matrix-row' && i + 1 < args.length) {
      actions.deleteMatrixRow = args[++i];
    } else if (arg === '--add-matrix-row' && i + 1 < args.length) {
      actions.addMatrixRow = args[++i];
    } else if (!arg.startsWith('-') && !projectId) {
      projectId = arg;
    } else if (!arg.startsWith('-') && projectId && !questionId) {
      questionId = arg;
    }
  }

  // 列出题目模式
  if (listMode) {
    if (!projectId) {
      console.error("错误: 列出题目需要 project_id");
      process.exit(1);
    }
    await listQuestions(projectId);
    process.exit(0);
  }

  // 验证参数
  if (!projectId) {
    console.error("错误: 请提供 project_id");
    showHelp();
    process.exit(1);
  }

  if (!questionId) {
    console.error("错误: 请提供 question_id");
    showHelp();
    process.exit(1);
  }

  // 确定操作
  const actionKeys = Object.keys(actions).filter(k => 
    ['editTitle', 'editOption', 'deleteOption', 'addOption', 
     'editMatrixRow', 'deleteMatrixRow', 'addMatrixRow'].includes(k)
  );

  if (actionKeys.length === 0) {
    console.error("错误: 请指定一个操作");
    showHelp();
    process.exit(1);
  }

  if (actionKeys.length > 1) {
    console.error(`错误: 一次只能执行一个操作`);
    process.exit(1);
  }

  // 验证参数组合
  if (actions.editOption && !actions.optionTitle) {
    console.error("错误: 使用 --edit-option 时必须同时指定 --option-title");
    process.exit(1);
  }

  if (actions.editMatrixRow && !actions.rowTitle) {
    console.error("错误: 使用 --edit-matrix-row 时必须同时指定 --row-title");
    process.exit(1);
  }

  // 执行操作
  const editor = new QuestionEditor();
  await editor.init();

  try {
    const action = actionKeys[0];

    switch (action) {
      case 'editTitle':
        console.log(`\n正在编辑题目标题...`);
        console.log(`  项目ID: ${projectId}`);
        console.log(`  题目ID: ${questionId}`);
        console.log(`  新标题: ${actions.editTitle}`);
        
        await editor.editTitle(projectId, questionId, actions.editTitle);
        console.log(`\n✓ 标题修改成功！`);
        break;

      case 'editOption':
        console.log(`\n正在编辑选项...`);
        console.log(`  项目ID: ${projectId}`);
        console.log(`  题目ID: ${questionId}`);
        console.log(`  选项ID: ${actions.editOption}`);
        console.log(`  新标题: ${actions.optionTitle}`);
        
        await editor.editOption(projectId, questionId, actions.editOption, actions.optionTitle);
        console.log(`\n✓ 选项修改成功！`);
        break;

      case 'deleteOption':
        console.log(`\n正在删除选项...`);
        console.log(`  项目ID: ${projectId}`);
        console.log(`  题目ID: ${questionId}`);
        console.log(`  选项ID: ${actions.deleteOption}`);
        
        await editor.deleteOption(projectId, questionId, actions.deleteOption);
        console.log(`\n✓ 选项删除成功！`);
        break;

      case 'addOption':
        console.log(`\n正在新增选项...`);
        console.log(`  项目ID: ${projectId}`);
        console.log(`  题目ID: ${questionId}`);
        console.log(`  选项标题: ${actions.addOption}`);
        console.log(`  是否答案: ${actions.isAnswer ? '是' : '否'}`);
        if (actions.score > 0) console.log(`  分值: ${actions.score}`);
        
        await editor.addOption(projectId, questionId, actions.addOption, actions.isAnswer, actions.score || 0);
        console.log(`\n✓ 选项添加成功！`);
        break;

      case 'editMatrixRow':
        console.log(`\n正在编辑矩阵行...`);
        console.log(`  项目ID: ${projectId}`);
        console.log(`  题目ID: ${questionId}`);
        console.log(`  矩阵行ID: ${actions.editMatrixRow}`);
        console.log(`  新标题: ${actions.rowTitle}`);
        
        await editor.editMatrixRow(projectId, questionId, actions.editMatrixRow, actions.rowTitle);
        console.log(`\n✓ 矩阵行修改成功！`);
        break;

      case 'deleteMatrixRow':
        console.log(`\n正在删除矩阵行...`);
        console.log(`  项目ID: ${projectId}`);
        console.log(`  题目ID: ${questionId}`);
        console.log(`  矩阵行ID: ${actions.deleteMatrixRow}`);
        
        await editor.deleteMatrixRow(projectId, questionId, actions.deleteMatrixRow);
        console.log(`\n✓ 矩阵行删除成功！`);
        break;

      case 'addMatrixRow':
        console.log(`\n正在新增矩阵行...`);
        console.log(`  项目ID: ${projectId}`);
        console.log(`  题目ID: ${questionId}`);
        console.log(`  行标题: ${actions.addMatrixRow}`);
        
        await editor.addMatrixRow(projectId, questionId, actions.addMatrixRow);
        console.log(`\n✓ 矩阵行添加成功！`);
        break;
    }
  } catch (error) {
    console.error(`\n✗ 操作失败: ${error.message}`);
    process.exit(1);
  }
}

// 导出模块
module.exports = {
  QuestionEditor,
  formatError,
  loadToken
};

// 如果是直接运行
if (require.main === module) {
  main().catch(error => {
    console.error("❌ 错误:", error.message);
    process.exit(1);
  });
}
