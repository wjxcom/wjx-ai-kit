#!/usr/bin/env node
/**
 * 问卷网题目删除工具
 * 删除问卷中的题目
 */

const axios = require('axios');
const readline = require('readline');
const { requireAccessToken } = require('./token_store');
const { generateSignature, CONFIG } = require('./generate_sign');
const { ensureReadyForEdit } = require('./project_edit_guard');

const BASE_URL = "https://www.wenjuan.com/app_api/edit/delete_question/";

async function getToken() {
  return requireAccessToken({}, "未找到 access_token");
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
 * 删除题目（内部先 ensureReadyForEdit：停收 + 归档，禁止调用方绕过）
 */
async function deleteQuestion(projectId, questionId) {
  await ensureReadyForEdit(projectId, { log: console.log });

  const token = await getToken();
  
  const businessParams = {
    project_id: projectId,
    question_id: questionId,
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
      return { status: error.response.status, error: error.response.statusText, data: error.response.data };
    }
    return { status: -1, error: error.message };
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  let projectId = null;
  let questionId = null;
  let force = false;
  let outputJson = false;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if ((arg === "-p" || arg === "--project-id") && i + 1 < args.length) {
      projectId = args[++i];
    } else if ((arg === "-q" || arg === "--question-id") && i + 1 < args.length) {
      questionId = args[++i];
    } else if (arg === "--force" || arg === "-f") {
      force = true;
    } else if (arg === "--json") {
      outputJson = true;
    } else if (arg === "-h" || arg === "--help") {
      showHelp();
      process.exit(0);
    }
  }
  
  if (!projectId || !questionId) {
    console.error("错误: 必须提供项目ID (-p) 和题目ID (-q)");
    console.error("用法: node delete_question.js -p <project_id> -q <question_id> [--force]");
    process.exit(1);
  }
  
  // 确认删除
  if (!force) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    try {
      const answer = await new Promise((resolve) => {
        rl.question(`确认删除题目 ${questionId}? [y/N]: `, resolve);
      });
      
      if (!answer.trim().toLowerCase().match(/^y(es)?$/)) {
        console.log("已取消删除");
        process.exit(0);
      }
    } finally {
      rl.close();
    }
  }
  
  try {
    const result = await deleteQuestion(projectId, questionId);
    
    if (outputJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const ok = Number(result.status_code) === 1;
      if (ok) {
        console.log("✅ 题目删除成功！");
      } else {
        const msg = result.err_msg || result.message || result.error || "未知错误";
        console.error(`❌ 删除失败: ${msg}`);
        if (result.data) {
          console.error("详情:", JSON.stringify(result.data, null, 2).substring(0, 500));
        }
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(`❌ 错误: ${error.message}`);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
问卷网题目删除工具

用法: node delete_question.js -p <project-id> -q <question-id> [选项]

选项:
  -p, --project-id <id>     项目ID（必填）
  -q, --question-id <id>    题目ID（必填）
  -f, --force               强制删除，不提示确认
  --json                    输出原始JSON响应
  -h, --help                显示帮助信息

示例:
  # 删除题目（会提示确认）
  node delete_question.js -p "abc123" -q "q123"
  
  # 强制删除（不提示）
  node delete_question.js -p "abc123" -q "q123" --force
`);
}

// 导出模块
module.exports = {
  deleteQuestion
};

// 如果是直接运行
if (require.main === module) {
  main().catch((err) => {
    console.error(`❌ ${err.message || err}`);
    process.exit(1);
  });
}
