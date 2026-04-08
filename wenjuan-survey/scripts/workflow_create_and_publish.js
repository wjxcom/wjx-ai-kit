#!/usr/bin/env node
/**
 * 问卷创建并发布工作流
 * 一键完成：创建项目 → 导入题目 → 发布项目
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const { resolveAccessToken } = require('./token_store');

// API 地址
const IMPORT_URL = "https://www.wenjuan.com/edit/api/textproject/?jwt=1";
const PUBLISH_URL = "https://www.wenjuan.com/edit/api/update_project_status/?jwt=1";

// 项目类型映射
const PROJECT_TYPES = {
  survey: { type_id: "51dd234e9b9fbe6646bf4dcc", p_type: null },
  form: { type_id: "536b5a38f7405b4d51ca75c6", p_type: 1 },
  vote: { type_id: "5c0651e0a320fc9d0bb6aefb", p_type: null },
  assess: { type_id: "54b638e0f7405b3dc0db45fb", p_type: 2 }
};

// 基础配置
const SCRIPT_DIR = __dirname;
const WENJUAN_DIR = path.join(SCRIPT_DIR, '..');

/**
 * 运行子 skill 的脚本
 * @param {string} skillName
 * @param {string} scriptPath
 * @param {Array<string>} args
 * @returns {Object}
 */
async function runSkillScript(skillName, scriptPath, args = []) {
  const scriptFullPath = path.join(WENJUAN_DIR, skillName, scriptPath);
  
  try {
    await fs.access(scriptFullPath);
  } catch (error) {
    return {
      success: false,
      error: `脚本不存在: ${scriptFullPath}`
    };
  }
  
  const cmd = ["node", scriptFullPath, ...args];
  
  try {
    const result = execSync(cmd.join(' '), {
      encoding: 'utf-8',
      cwd: WENJUAN_DIR,
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    return {
      success: true,
      stdout: result,
      stderr: '',
      returncode: 0
    };
  } catch (error) {
    if (error.status === 'ETIMEDOUT') {
      return { success: false, error: "执行超时" };
    }
    return {
      success: false,
      error: error.message,
      stderr: error.stderr || '',
      returncode: error.status || 1
    };
  }
}

/** 从本地文件读取 JWT（逻辑见 token_store.js） */
async function getToken() {
  const t = await resolveAccessToken();
  return t || "";
}

/**
 * 检查是否已登录
 */
async function checkLogin() {
  const token = await getToken();
  return Boolean(token && token.length > 10);
}

/**
 * 执行登录流程
 */
async function doLogin() {
  console.log("\n🔐 需要登录，正在打开登录页面...");
  
  const loginScript = path.join(__dirname, "login_auto.js");
  
  try {
    const result = execSync(`node "${loginScript}"`, {
      encoding: 'utf-8',
      timeout: 120000,
      stdio: 'inherit'
    });
    console.log("✅ 登录成功");
    return true;
  } catch (error) {
    console.log(`❌ 登录失败: ${error.message || '未知错误'}`);
    return false;
  }
}

/**
 * 根据项目类型生成默认题目
 * @param {string} ptype
 * @param {string} scene
 * @returns {Array}
 */
function generateDefaultQuestions(ptype, scene = null) {
  let questions = [];
  
  if (ptype === "survey") {
    questions = [
      {
        title: "您的性别",
        en_name: "QUESTION_TYPE_SEX",
        custom_attr: { show_seq: "on" },
        option_list: [
          { title: "男", is_open: false, custom_attr: {} },
          { title: "女", is_open: false, custom_attr: {} }
        ]
      },
      {
        title: "您的年级",
        en_name: "QUESTION_TYPE_SINGLE",
        custom_attr: { show_seq: "on" },
        option_list: [
          { title: "大一", is_open: false, custom_attr: {} },
          { title: "大二", is_open: false, custom_attr: {} },
          { title: "大三", is_open: false, custom_attr: {} },
          { title: "大四", is_open: false, custom_attr: {} },
          { title: "研究生及以上", is_open: false, custom_attr: {} }
        ]
      },
      {
        title: "您对学校生活的整体满意度",
        en_name: "QUESTION_TYPE_SCORE",
        custom_attr: {
          show_seq: "on",
          disp_type: "scale",
          min_answer_num: 1,
          max_answer_num: 5,
          desc_left: "非常不满意",
          desc_right: "非常满意"
        },
        option_list: [{ title: "评分", is_open: false, custom_attr: {} }]
      },
      {
        title: "您希望学校改进的方面（可多选）",
        en_name: "QUESTION_TYPE_MULTIPLE",
        custom_attr: { show_seq: "on" },
        option_list: [
          { title: "教学质量", is_open: false, custom_attr: {} },
          { title: "食堂餐饮", is_open: false, custom_attr: {} },
          { title: "宿舍环境", is_open: false, custom_attr: {} },
          { title: "校园设施", is_open: false, custom_attr: {} },
          { title: "社团活动", is_open: false, custom_attr: {} }
        ]
      },
      {
        title: "其他建议或意见",
        en_name: "QUESTION_TYPE_BLANK",
        custom_attr: { show_seq: "on", blank_type: "multi" },
        option_list: [{ title: "请填写", is_open: false, custom_attr: {} }]
      }
    ];
  } else if (ptype === "vote") {
    questions = [
      {
        title: "请为您支持的选项投票",
        en_name: "QUESTION_TYPE_SINGLE",
        custom_attr: { show_seq: "on" },
        option_list: [
          { title: "选项 A", is_open: false, custom_attr: {} },
          { title: "选项 B", is_open: false, custom_attr: {} },
          { title: "选项 C", is_open: false, custom_attr: {} }
        ]
      }
    ];
  } else if (ptype === "form") {
    questions = [
      {
        title: "姓名",
        en_name: "QUESTION_TYPE_BLANK",
        custom_attr: { show_seq: "on", disp_type: "name" },
        option_list: [{ title: "姓名", is_open: false, custom_attr: {} }]
      },
      {
        title: "手机号",
        en_name: "QUESTION_TYPE_BLANK",
        custom_attr: { show_seq: "on", disp_type: "mobile" },
        option_list: [{ title: "手机号", is_open: false, custom_attr: {} }]
      }
    ];
  } else if (ptype === "assess") {
    questions = [
      {
        title: "第一题：这是一个示例单选题",
        en_name: "QUESTION_TYPE_SINGLE",
        custom_attr: { show_seq: "on", total_score: 10, answer_score: "on" },
        option_list: [
          { title: "A. 正确答案", is_open: false, custom_attr: { is_correct: "1", score: 10 } },
          { title: "B. 错误答案", is_open: false, custom_attr: { score: 0 } },
          { title: "C. 错误答案", is_open: false, custom_attr: { score: 0 } }
        ]
      }
    ];
  }
  
  return questions;
}

/** 完整项目 JSON 中可一并提交 textproject 的字段（与 question_list 同文件时自动带上） */
function extractProjectExtras(fileData) {
  if (!fileData || typeof fileData !== "object" || Array.isArray(fileData)) {
    return {};
  }
  const keys = ["survey_result", "welcome", "cover", "phone_cover_url"];
  const out = {};
  for (const k of keys) {
    if (fileData[k] != null && fileData[k] !== "") {
      out[k] = fileData[k];
    }
  }
  return out;
}

/**
 * 创建项目并导入题目
 * 通过 textproject API 一步完成
 * @param {string} title
 * @param {string} ptype
 * @param {Array} questions
 * @param {Record<string, unknown>} [projectExtras] 如 survey_result、welcome（来自完整项目 JSON）
 */
async function createAndImportProject(title, ptype, questions, projectExtras = {}) {
  const jwtToken = await getToken();
  if (!jwtToken) {
    return { success: false, error: "NEED_LOGIN", message: "需要登录" };
  }
  
  const typeInfo = PROJECT_TYPES[ptype] || PROJECT_TYPES.survey;
  
  const projectData = {
    title: title,
    type_id: typeInfo.type_id,
    p_type: typeInfo.p_type,
    ai_source: 11,
    import_type: "0",
    question_list: questions,
    ...projectExtras,
  };
  
  const headers = {
    "Authorization": `Bearer ${jwtToken}`,
    "Content-Type": "application/json"
  };
  
  try {
    // 提交导入请求
    const response = await axios.post(IMPORT_URL, { project_json: projectData }, { headers });
    const result = response.data;
    
    if (result.status_code !== 1) {
      const err = result.message || "导入请求失败";
      if (err.toLowerCase().includes("token") || err.includes("登录") || err.includes("Unauthorized")) {
        return { success: false, error: "NEED_LOGIN", message: err };
      }
      return { success: false, error: "CREATE_FAILED", message: err };
    }
    
    const fingerprint = result.data && result.data.fingerprint;
    if (!fingerprint) {
      return { success: false, error: "CREATE_FAILED", message: "未获取到 fingerprint" };
    }
    
    // 轮询查询导入状态
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResp = await axios.get(`${IMPORT_URL}&fingerprint=${fingerprint}`, { headers });
      const status = statusResp.data;
      const data = status.data || {};
      
      if (!data.continue_poll) {
        const projectId = data.project_id;
        if (projectId) {
          return {
            success: true,
            project_id: projectId,
            short_id: data.short_id || ""
          };
        } else {
          return {
            success: false,
            error: "CREATE_FAILED",
            message: "导入失败"
          };
        }
      }
      
      console.log(`   导入中... (${i + 1}/30)`);
    }
    
    return { success: false, error: "CREATE_FAILED", message: "导入超时" };
  } catch (error) {
    return { success: false, error: "CREATE_FAILED", message: error.message };
  }
}

/**
 * 直接调用 API 发布项目
 * @param {string} projectId
 */
async function publishProjectApi(projectId) {
  const jwtToken = await getToken();
  if (!jwtToken) {
    return { success: false, error: "NEED_LOGIN", message: "需要登录" };
  }
  
  const headers = {
    "Authorization": `Bearer ${jwtToken}`,
    "Content-Type": "application/json"
  };
  
  const data = {
    proj_id: projectId,
    status: 1,
    web_site: "wenjuan_web",
    source: "wenjuan_web",
    share_project: "off"
  };
  
  try {
    const response = await axios.post(PUBLISH_URL, data, { headers });
    const result = response.data;
    
    // 检查 status_code
    if (result.status_code === 1) {
      // 检查是否有更新错误信息（如"问卷违规!"表示需要审核）
      const updateErrMsg = result.data?.update_err_msg;
      if (updateErrMsg) {
        // 需要审核的情况，返回成功但带有提示
        if (updateErrMsg.includes("违规") || updateErrMsg.includes("审核") || updateErrMsg.includes("审查")) {
          return { 
            success: true, 
            pending: true, 
            message: `问卷已提交，${updateErrMsg}，请等待审核通过` 
          };
        }
        // 检查是否是需要绑定手机号的错误
        if (updateErrMsg.includes("NOT_BIND_MOBILE") || updateErrMsg.includes("未绑定") || updateErrMsg.includes("手机号")) {
          return { success: false, error: "NEED_BIND_MOBILE", message: updateErrMsg };
        }
        // 其他错误
        return { success: false, error: "PUBLISH_FAILED", message: updateErrMsg };
      }
      // 正常发布成功
      return { success: true };
    }
    
    // status_code 不为 1，处理错误
    const err = result.err_msg || result.message || "未知错误";
    const errCode = result.err_code || "";
    
    if (err.includes("NOT_BIND_MOBILE") || err.includes("未绑定") || err.includes("手机号")) {
      return { success: false, error: "NEED_BIND_MOBILE", message: err };
    }
    
    return { success: false, error: "PUBLISH_FAILED", message: `${err} (code: ${errCode})` };
  } catch (error) {
    // 检查错误消息是否包含"未绑定手机号"
    const errMsg = error.message || "";
    const responseData = error.response?.data;
    const responseMsg = typeof responseData === 'string' ? responseData : (responseData?.message || responseData?.err_msg || "");
    
    if (errMsg.includes("NOT_BIND_MOBILE") || errMsg.includes("未绑定") || errMsg.includes("手机号") ||
        responseMsg.includes("NOT_BIND_MOBILE") || responseMsg.includes("未绑定") || responseMsg.includes("手机号")) {
      return { success: false, error: "NEED_BIND_MOBILE", message: responseMsg || errMsg || "用户未绑定手机号" };
    }
    
    return { success: false, error: "PUBLISH_FAILED", message: error.message };
  }
}

/**
 * 执行手机号绑定
 * 调用 bind_mobile.js 完成绑定流程
 */
async function bindMobile() {
  console.log("\n📱 需要绑定手机号，正在启动绑定流程...");
  
  // 动态导入 bind_mobile 模块
  const bindMobileModule = require('./bind_mobile.js');
  
  // 获取 token
  const token = await bindMobileModule.getToken();
  if (!token) {
    console.log("❌ 未找到登录凭证，无法绑定手机号");
    return false;
  }
  
  // 1. 获取 uid
  console.log("[1/3] 正在获取绑定令牌...");
  const uidResult = await bindMobileModule.getUidFromJwt(token);
  if (!uidResult.success) {
    console.log(`❌ 获取绑定令牌失败: ${uidResult.errorMsg}`);
    return false;
  }
  
  const uid = uidResult.uid;
  console.log(`✓ 获取成功，有效期 ${uidResult.expireSeconds} 秒`);
  
  // 2. 打开浏览器
  const bindUrl = `https://www.wenjuan.com/auth/mobile_bind/?uid=${uid}`;
  console.log(`\n[2/3] 绑定页面地址: ${bindUrl}`);
  console.log("\n正在打开浏览器...");

  const { openUrlBestEffort, writeUrlForManualOpen } = require("./open_url_cjs");
  const { getDefaultTokenDir } = require("./token_store");

  try {
    const dir = getDefaultTokenDir();
    await writeUrlForManualOpen(bindUrl, dir, "last_wenjuan_bind_url.txt");
    console.log(
      `  [提示] 绑定链接已写入 ${path.join(dir, "last_wenjuan_bind_url.txt")}（无图形界面时请在本机打开该文件）`
    );
  } catch (e) {
    console.log(`  （写入绑定链接文件失败: ${e.message}）`);
  }

  const opened = await openUrlBestEffort(bindUrl);
  if (opened) {
    console.log("✓ 已尝试在系统默认浏览器中打开绑定页面");
  } else {
    console.log("✗ 无法自动打开浏览器，请在本机打开上述文件或复制链接");
  }
  
  // 3. 等待绑定完成
  console.log("\n[3/3] 请在浏览器中完成绑定...");
  console.log("=".repeat(50));
  console.log("1. 输入您的手机号");
  console.log("2. 点击发送验证码");
  console.log("3. 输入收到的验证码");
  console.log("4. 点击绑定按钮");
  console.log("=".repeat(50));
  console.log("\n正在自动检测绑定状态...");
  
  const bindResult = await bindMobileModule.waitForBinding(uid, token, uidResult.expireSeconds);
  
  if (bindResult.success) {
    console.log("\n🎉 手机号绑定成功！");
    return true;
  } else {
    console.log("\n⚠️ 绑定未完成或已超时");
    return false;
  }
}

/**
 * 获取项目真实状态（通过项目详情API）
 * @param {string} projectId - 项目ID
 * @returns {Object} { status: 0=编辑中/1=收集中/2=已停止, is_publish: boolean }
 */
async function getProjectRealStatus(projectId) {
  const jwtToken = await getToken();
  if (!jwtToken) {
    return { success: false, error: "NEED_LOGIN" };
  }
  const { getProjectRealStatus: gpr } = require("./publish");
  return gpr(jwtToken, projectId);
}

/**
 * 轮询审核/发布状态（与 publish.js 逻辑一致：固定间隔 + 15 分钟排队提示与预计完成时刻）
 * @param {string} projectId - 项目ID
 */
async function pollAuditStatus(projectId) {
  const jwtToken = await getToken();
  if (!jwtToken) {
    console.log("❌ 无法获取登录凭证，无法轮询审核状态");
    return { success: false, error: "NEED_LOGIN" };
  }
  const { pollAuditStatus: pollPublish } = require("./publish");
  const r = await pollPublish(jwtToken, projectId);
  if (r.success && r.status === "published" && r.data && r.data.short_id) {
    return { success: true, status: "published", short_id: r.data.short_id };
  }
  return r;
}

/**
 * 轮询等待项目状态稳定
 * 等待项目状态变为发布成功或稳定状态
 * @param {string} projectId - 项目ID
 * @param {number} maxWaitSeconds - 最大等待秒数（默认60秒）
 * @returns {Object} { success: boolean, status: number, statusText: string, short_id: string }
 */
async function waitForProjectStatus(projectId, maxWaitSeconds = 120) {
  const jwtToken = await getToken();
  if (!jwtToken) {
    return { success: false, error: "NEED_LOGIN" };
  }
  
  const interval = 3; // 每3秒检查一次
  const maxAttempts = Math.ceil(maxWaitSeconds / interval);
  
  const statusTextMap = {
    0: "编辑中",
    1: "收集中（已发布）",
    2: "已停止",
    99: "审核中"
  };
  
  let lastStatus = null;
  let stableCount = 0; // 状态稳定计数
  let remaining = maxWaitSeconds; // 倒计时
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { buildSignedUrl } = require('./generate_sign');
      const url = buildSignedUrl('https://www.wenjuan.com/app_api/edit/edit_project/', { 
        project_id: projectId 
      });
      
      const response = await axios.get(url, {
        headers: { "Authorization": `Bearer ${jwtToken}` },
        timeout: 10000
      });

      const {
        normalizeEditProjectResponse,
        resolveSurveyCollectStatus,
      } = require("./publish");
      const norm = normalizeEditProjectResponse(response.data);
      const data = norm.ok ? norm.project : {};
      const currentStatus = resolveSurveyCollectStatus(data);
      const shortId = data.short_id || "";
      
      // 检查状态是否稳定（连续2次相同）
      if (currentStatus === lastStatus) {
        stableCount++;
      } else {
        stableCount = 0;
        lastStatus = currentStatus;
      }
      
      // 显示倒计时、当前项目状态与短链（便于对照发布结果）
      const statusDesc =
        currentStatus === undefined || currentStatus === null
          ? "未返回状态"
          : statusTextMap[currentStatus] || `状态码:${currentStatus}`;
      const shortPart = shortId ? ` | 短链ID: ${shortId}` : "";
      if (remaining > 0) {
        process.stdout.write(
          `\r   ⏳ 等待状态稳定... 剩余 ${remaining} 秒 | 项目: ${statusDesc}${shortPart}`
        );
        remaining -= interval;
      } else {
        process.stdout.write(
          `\r   ⏳ 等待状态稳定... 请稍候 | 项目: ${statusDesc}${shortPart}        `
        );
      }
      
      // 如果状态是已发布，立即返回
      if (currentStatus === 1) {
        return {
          success: true,
          status: currentStatus,
          statusText: statusTextMap[1],
          short_id: shortId,
          title: data.title
        };
      }
      
      // 如果状态稳定了（连续2次相同）
      if (stableCount >= 1) {
        return {
          success: true,
          status: currentStatus,
          statusText: statusDesc,
          short_id: shortId,
          title: data.title
        };
      }
      
      await new Promise(resolve => setTimeout(resolve, interval * 1000));
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        return { success: false, error: "获取状态失败: " + error.message };
      }
      process.stdout.write(`\r   ⚠️ 获取状态失败，重试中... 剩余 ${remaining} 秒    `);
      await new Promise(resolve => setTimeout(resolve, interval * 1000));
      remaining -= interval;
    }
  }
  
  return { success: false, error: "等待状态超时" };
}

/**
 * 对已存在的 project_id：发布 → 需绑定时引导 bind_mobile → 审核轮询 → 等待状态稳定（与 workflow 后半段一致）。
 * `import_project.js` 默认在导入成功后调用本函数，实现与 workflow 相同的「自动发布」。
 */
async function publishProjectFullFlow(projectId) {
  console.log("\n🚀 自动发布项目...");
  let publishResult = await publishProjectApi(projectId);

  if (!publishResult.success) {
    if (publishResult.error === "NEED_BIND_MOBILE") {
      if (await bindMobile()) {
        publishResult = await publishProjectApi(projectId);
      } else {
        return {
          success: false,
          error: "绑定手机号失败",
          project_id: projectId,
        };
      }
    }

    if (!publishResult.success) {
      return {
        success: false,
        error: publishResult.message || publishResult.error || "发布失败",
        project_id: projectId,
      };
    }
  }

  if (publishResult.pending) {
    console.log("   ⏳ " + publishResult.message);

    const auditResult = await pollAuditStatus(projectId);
    if (auditResult.success) {
      publishResult.pending = false;
      console.log("\n   ✅ 审核通过，项目已正式发布！");
    } else if (auditResult.status === "rejected") {
      return {
        success: false,
        error: "审核不通过",
        reason: auditResult.reason,
        project_id: projectId,
      };
    } else {
      return {
        success: false,
        error: auditResult.error || "审核等待超时或失败",
        project_id: projectId,
      };
    }
  } else {
    console.log("   ✅ 项目发布成功！");
  }

  console.log("\n📊 等待项目状态稳定...");
  const finalStatus = await waitForProjectStatus(projectId, 120);
  process.stdout.write("\n");
  if (finalStatus.success) {
    console.log(`   ✅ 项目状态: ${finalStatus.statusText}`);
    if (finalStatus.short_id) {
      console.log(`   📎 短链接: https://www.wenjuan.com/s/${finalStatus.short_id}`);
    }
  } else {
    console.log(`   ⚠️ ${finalStatus.error || "获取状态超时"}`);
  }

  return {
    success: true,
    project_id: projectId,
    short_id: finalStatus.short_id || "",
    pending: publishResult.pending || false,
  };
}

function stripBom(s) {
  if (typeof s !== "string") return s;
  return s.replace(/^\uFEFF/, "");
}

/**
 * 解析导入的 JSON：题目数组或完整项目对象
 * @returns {{ questions: any[], fileTitle: string, fileType: string } | { error: string }}
 */
function parseImportedPayload(fileData, title, ptype) {
  if (Array.isArray(fileData)) {
    return {
      questions: fileData,
      fileTitle: title || "导入的问卷",
      fileType: ptype || "survey",
      projectExtras: {},
    };
  }
  if (typeof fileData === "object" && fileData !== null) {
    return {
      questions: fileData.question_list || fileData.questions || [],
      fileTitle: title || fileData.title || "导入的问卷",
      fileType: ptype || fileData.ptype || "survey",
      projectExtras: extractProjectExtras(fileData),
    };
  }
  return { error: "文件格式错误：必须是题目列表或项目对象" };
}

/**
 * 从 http(s) URL 拉取 JSON（题目列表或完整项目对象）
 */
async function fetchJsonFromUrl(urlStr) {
  let parsedUrl;
  try {
    parsedUrl = new URL(urlStr);
  } catch {
    throw new Error("无效的 URL");
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("仅支持 http/https 链接");
  }
  const response = await axios.get(urlStr, {
    timeout: 45000,
    maxContentLength: 5 * 1024 * 1024,
    responseType: "text",
    headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" },
    validateStatus: (status) => status >= 200 && status < 300,
  });
  const raw = stripBom(String(response.data || ""));
  try {
    return JSON.parse(raw.trim());
  } catch (e) {
    throw new Error(`链接内容不是合法 JSON: ${e.message}`);
  }
}

function readStdinUtf8() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(chunks.join("")));
    process.stdin.on("error", reject);
    process.stdin.resume();
  });
}

/**
 * 完整工作流：创建并发布问卷
 * @param {string} title
 * @param {string} ptype
 * @param {string} scene
 * @param {string} filePath
 * @param {{ sourceUrl?: string, textFilePath?: string, useStdin?: boolean }} [importOptions]
 */
async function workflowCreateAndPublish(
  title = null,
  ptype = null,
  scene = null,
  filePath = null,
  importOptions = {}
) {
  const {
    sourceUrl = null,
    textFilePath = null,
    useStdin = false,
  } = importOptions;
  const importPath = filePath || textFilePath || null;
  console.log("=".repeat(60));
  console.log("📝 问卷创建并发布工作流");
  console.log("=".repeat(60));
  
  // 步骤 0: 检查登录
  const isLoggedIn = await checkLogin();
  if (!isLoggedIn) {
    console.log("\n🔐 检查登录状态...");
    if (!(await doLogin())) {
      return { success: false, error: "登录失败，无法继续" };
    }
  } else {
    console.log("\n✅ 登录状态正常");
  }
  
  // 步骤 1: 准备题目数据
  let questions;
  let fileTitle;
  let fileType;
  let projectExtras = {};

  const logImportedMeta = () => {
    console.log(`   标题: ${fileTitle}`);
    console.log(`   类型: ${fileType}`);
    console.log(`   题目数量: ${questions.length}`);
  };

  if (sourceUrl) {
    console.log(`\n🌐 从链接导入题目: ${sourceUrl}`);
    try {
      const fileData = await fetchJsonFromUrl(sourceUrl);
      const parsed = parseImportedPayload(fileData, title, ptype);
      if (parsed.error) {
        return { success: false, error: parsed.error };
      }
      ({ questions, fileTitle, fileType, projectExtras } = parsed);
      logImportedMeta();
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  } else if (useStdin) {
    console.log("\n📄 从标准输入读取题目 JSON（UTF-8）");
    try {
      const content = stripBom(await readStdinUtf8());
      const fileData = JSON.parse(content.trim());
      const parsed = parseImportedPayload(fileData, title, ptype);
      if (parsed.error) {
        return { success: false, error: parsed.error };
      }
      ({ questions, fileTitle, fileType, projectExtras } = parsed);
      logImportedMeta();
    } catch (error) {
      if (error instanceof SyntaxError) {
        return { success: false, error: `JSON解析错误: ${error.message}` };
      }
      return { success: false, error: `读取 stdin 失败: ${error.message}` };
    }
  } else if (importPath) {
    const label = textFilePath && !filePath ? "文本文件" : "本地文件";
    console.log(`\n📂 从${label}导入: ${importPath}`);
    try {
      const content = stripBom(await fs.readFile(importPath, "utf-8"));
      const fileData = JSON.parse(content.trim());
      const parsed = parseImportedPayload(fileData, title, ptype);
      if (parsed.error) {
        return { success: false, error: parsed.error };
      }
      ({ questions, fileTitle, fileType, projectExtras } = parsed);
      logImportedMeta();
    } catch (error) {
      if (error.code === "ENOENT") {
        return { success: false, error: `文件不存在: ${importPath}` };
      }
      if (error instanceof SyntaxError) {
        return { success: false, error: `JSON解析错误: ${error.message}` };
      }
      return { success: false, error: `读取文件失败: ${error.message}` };
    }
  } else {
    // 生成默认题目
    questions = generateDefaultQuestions(ptype, scene);
    fileTitle = title;
    fileType = ptype;
    console.log("\n📋 使用默认题目模板");
    console.log(`   标题: ${fileTitle}`);
    console.log(`   类型: ${fileType}`);
    console.log(`   题目数量: ${questions.length}`);
  }
  
  // 步骤 2: 创建项目并导入题目
  console.log("\n📋 步骤 1/3: 创建项目并导入题目...");
  if (projectExtras && Object.keys(projectExtras).length > 0) {
    console.log(`   附加字段: ${Object.keys(projectExtras).join(", ")}`);
  }

  let createResult = await createAndImportProject(
    fileTitle,
    fileType,
    questions,
    projectExtras
  );
  if (!createResult.success) {
    if (createResult.error === "NEED_LOGIN") {
      if (await doLogin()) {
        createResult = await createAndImportProject(
          fileTitle,
          fileType,
          questions,
          projectExtras
        );
        if (!createResult.success) {
          return createResult;
        }
      } else {
        return { success: false, error: "登录失败" };
      }
    } else {
      return createResult;
    }
  }
  
  const projectId = createResult.project_id;
  const shortId = createResult.short_id || "";
  console.log("✅ 项目创建成功");
  console.log(`   项目ID: ${projectId}`);
  if (shortId) {
    console.log(`   短链接ID: ${shortId}`);
  }
  
  // 步骤 3: 发布项目
  console.log("\n🚀 步骤 2/3: 发布项目...");
  let publishResult = await publishProjectApi(projectId);
  
  // 处理发布结果
  if (!publishResult.success) {
    if (publishResult.error === "NEED_BIND_MOBILE") {
      if (await bindMobile()) {
        publishResult = await publishProjectApi(projectId);
      } else {
        console.log("\n⚠️ 项目已创建但未发布");
        console.log(`   项目ID: ${projectId}`);
        console.log("   请手动绑定手机号后重新发布");
        return {
          success: false,
          error: "绑定手机号失败",
          project_id: projectId
        };
      }
    }
    
    if (!publishResult.success) {
      console.log(`\n⚠️ 项目已创建但发布失败: ${publishResult.message}`);
      console.log(`   项目ID: ${projectId}`);
      console.log("   请检查错误后手动发布");
      return {
        success: false,
        error: publishResult.message,
        project_id: projectId
      };
    }
  }
  
  // 检查是否需要审核（进入审核流时循环拉取审核/项目状态直至发布或失败）
  if (publishResult.pending) {
    console.log("   ⏳ " + publishResult.message);
    
    const auditResult = await pollAuditStatus(projectId);
    if (auditResult.success) {
      publishResult.pending = false;
      console.log("\n   ✅ 审核通过，项目已正式发布！");
    } else if (auditResult.status === "rejected") {
      console.log(`\n   ❌ 审核不通过: ${auditResult.reason}`);
      return {
        success: false,
        error: "审核不通过",
        reason: auditResult.reason,
        project_id: projectId
      };
    } else {
      console.log(
        `\n   ⚠️ 审核未完成: ${auditResult.error || auditResult.status || "未知"}`
      );
      return {
        success: false,
        error: auditResult.error || "审核等待超时或失败",
        project_id: projectId
      };
    }
  } else {
    console.log("   ✅ 项目发布成功！");
  }
  
  // 步骤 4: 发布后始终轮询项目详情，直到状态稳定并拿到最新 short_id 等
  console.log("\n📊 步骤 3/3: 等待项目状态稳定...");
  const finalStatus = await waitForProjectStatus(projectId, 120);
  if (finalStatus.success) {
    console.log(`   ✅ 项目状态: ${finalStatus.statusText}`);
    if (finalStatus.short_id) {
      console.log(`   📎 短链接: https://www.wenjuan.com/s/${finalStatus.short_id}`);
    }
  } else {
    console.log(`   ⚠️ ${finalStatus.error || '获取状态超时'}`);
  }
  
  // 成功
  console.log("\n" + "=".repeat(60));
  if (publishResult.pending) {
    console.log("🎉 问卷创建成功，等待审核！");
  } else {
    console.log("🎉 问卷创建并发布成功！");
  }
  console.log("=".repeat(60));
  console.log(`📋 项目标题: ${fileTitle}`);
  console.log(`🔗 项目ID: ${projectId}`);
  console.log(`📝 题目数量: ${questions.length}`);
  if (shortId) {
    console.log(`\n📎 答题链接: https://www.wenjuan.com/s/${shortId}`);
  }
  if (publishResult.pending) {
    console.log(`\n⏳ 状态: 审核中，请等待平台审核通过`);
  }
  console.log(`\n💡 提示: 使用以下命令查看项目列表`);
  console.log(`   node scripts/list_projects.js`);
  
  return {
    success: true,
    project_id: projectId,
    short_id: shortId,
    title: fileTitle,
    question_count: questions.length,
    pending: publishResult.pending || false
  };
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  let title = null;
  let type = null;
  let scene = null;
  let filePath = null;
  let textFilePath = null;
  let sourceUrl = null;
  let useStdin = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if ((arg === "--title" || arg === "-t") && i + 1 < args.length) {
      title = args[++i];
    } else if (arg === "--type" && i + 1 < args.length) {
      type = args[++i];
      if (!["survey", "vote", "form", "assess"].includes(type)) {
        console.error("错误: type 必须是 survey, vote, form 或 assess");
        process.exit(1);
      }
    } else if ((arg === "--scene" || arg === "-s") && i + 1 < args.length) {
      scene = args[++i];
    } else if ((arg === "--file" || arg === "-f") && i + 1 < args.length) {
      filePath = args[++i];
    } else if ((arg === "--text-file" || arg === "--text") && i + 1 < args.length) {
      textFilePath = args[++i];
    } else if ((arg === "--url" || arg === "-u") && i + 1 < args.length) {
      sourceUrl = args[++i];
    } else if (arg === "--stdin") {
      useStdin = true;
    } else if (arg === "--poll" || arg === "-p" || arg === "--no-poll") {
      /* 发布后始终轮询；保留参数解析以兼容旧命令行 */
    } else if (arg === "-h" || arg === "--help") {
      showHelp();
      process.exit(0);
    }
  }
  
  const importPath = filePath || textFilePath || null;
  const importModes =
    (sourceUrl ? 1 : 0) + (useStdin ? 1 : 0) + (importPath ? 1 : 0);
  if (importModes > 1) {
    console.error("错误: --url、--stdin、--file/--text-file 仅能选一种");
    process.exit(1);
  }
  if (filePath && textFilePath) {
    console.error("错误: --file 与 --text-file 不能同时使用");
    process.exit(1);
  }

  // 验证参数：无导入源时须标题+类型（默认模板）
  if (!sourceUrl && !useStdin && !importPath) {
    if (!title || !type) {
      console.error("错误: 使用默认模板创建时，--title 和 --type 为必填参数");
      showHelp();
      process.exit(1);
    }
  }

  const result = await workflowCreateAndPublish(title, type, scene, filePath, {
    sourceUrl,
    textFilePath,
    useStdin,
  });
  
  if (!result.success) {
    console.log(`\n❌ 工作流执行失败: ${result.error}`);
    process.exit(1);
  }
  
  process.exit(0);
}

function showHelp() {
  console.log(`
问卷创建并发布工作流 - 一键完成创建、导入、发布

用法: node workflow_create_and_publish.js [选项]

选项:
  --title <title>       问卷标题（默认模板时必填；从 JSON 导入时可选，用于覆盖）
  --type <type>         问卷类型: survey(调研)/vote(投票)/form(表单)/assess(测评)
  --scene <desc>        场景描述（可选，用于生成更贴合的题目）
  -f, --file <path>     从本地 JSON 文件导入（题目列表或完整项目对象）
  --text-file <path>    同 --file，便于强调「文本文件」；内容须为 UTF-8 JSON
  -u, --url <url>       从 http(s) 链接拉取 JSON 后导入（格式同文件）
  --stdin               从标准输入读取 UTF-8 JSON（适合管道/重定向）
  -h, --help            显示帮助信息

示例:
  # 方式一：使用默认题目模板创建
  # 创建一个调研问卷
  node workflow_create_and_publish.js --title "员工满意度调研" --type survey
  
  # 创建一个投票
  node workflow_create_and_publish.js --title "年度最佳员工评选" --type vote
  
  # 创建一个表单
  node workflow_create_and_publish.js --title "活动报名表" --type form
  
  # 创建一个测评
  node workflow_create_and_publish.js --title "产品知识测试" --type assess

  # 方式二：从本地 JSON / 文本文件导入（扩展名可为 .json 或 .txt，内容均为 JSON）
  node workflow_create_and_publish.js --file questions.json --title "我的问卷" --type survey
  node workflow_create_and_publish.js --text-file outline.txt --title "我的问卷" --type survey
  node workflow_create_and_publish.js --file project.json

  # 方式三：从链接拉取 JSON（如 GitHub raw、对象存储等，须可匿名 GET）
  node workflow_create_and_publish.js --url "https://example.com/questions.json" --type assess

  # 方式四：从标准输入读入 JSON
  cat questions.json | node workflow_create_and_publish.js --stdin --title "管道导入" --type survey

发布后行为:
  发布成功后会自动循环获取状态接口与项目详情直至稳定或超时（见 publish.js）。
  - 状态接口 /project/api/status/ 的 data.status：0 发布，1 收集中，2 完成，3 暂停收集，99 审核中，100 不通过，-1 永久删除，-2 回收站（详见 references/publish_survey.md）
  - 项目详情 edit_project 的 status：0 编辑中，1 收集中，2 已停止（与上表不同枚举）
`);
}

// 导出模块
module.exports = {
  workflowCreateAndPublish,
  createAndImportProject,
  publishProjectApi,
  publishProjectFullFlow,
  getProjectRealStatus,
  pollAuditStatus,
  waitForProjectStatus,
  generateDefaultQuestions,
  fetchJsonFromUrl,
  parseImportedPayload,
};

// 如果是直接运行
if (require.main === module) {
  main();
}
