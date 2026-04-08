#!/usr/bin/env node
/**
 * 问卷网项目获取工具
 * 
 * 通过 GET /app_api/edit/edit_project/ 接口获取项目的完整结构。
 * 
 * 用法:
 *     node fetch_project.js --project-id <project_id>
 *     node fetch_project.js --project-id <project_id> --output my_project.json
 *     node fetch_project.js --project-id <project_id> --stats
 *
 * 默认保存路径:
 *     <getDefaultTokenDir()>/project_struct/<project_id>.json（未设 WENJUAN_TOKEN_DIR 时即 ~/.wenjuan/...）
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { buildSignedUrl } = require('./generate_sign');
const { resolveAccessToken, getDefaultTokenDir } = require('./token_store');

function defaultProjectStructDir() {
  return path.join(getDefaultTokenDir(), "project_struct");
}

// API 配置
const API_BASE_URL = "https://www.wenjuan.com";

/** 从文件加载 access_token（逻辑见 token_store.js） */
async function loadAccessToken(tokenDir = null) {
  return resolveAccessToken({
    tokenDir: tokenDir == null ? undefined : tokenDir,
  });
}

/**
 * 获取项目完整结构
 */
async function fetchProject(projectId, accessToken, verbose = true) {
  const baseUrl = `${API_BASE_URL}/app_api/edit/edit_project/`;
  
  // 构造请求参数
  const params = {
    project_id: projectId,
  };
  
  // 生成签名并构建完整 URL
  const fullUrl = buildSignedUrl(baseUrl, params);
  
  // 构造请求头（JWT）
  const headers = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  
  // 打印详细请求信息
  if (verbose) {
    console.log("\n" + "-".repeat(50));
    console.log("【请求详情】");
    console.log("-".repeat(50));
    console.log(`请求方法: GET`);
    console.log(`请求URL: ${baseUrl}`);
    console.log(`\n请求参数:`);
    const urlObj = new URL(fullUrl);
    const searchParams = urlObj.searchParams;
    const sortedKeys = Array.from(searchParams.keys()).sort();
    for (const key of sortedKeys) {
      let value = searchParams.get(key);
      // 隐藏 signature 部分内容
      if (key === "signature" && value.length > 10) {
        value = value.slice(0, 10) + "..." + value.slice(-5);
      }
      console.log(`  ${key}: ${value}`);
    }
    console.log(`\n请求头:`);
    for (const [key, value] of Object.entries(headers)) {
      let displayValue = value;
      // 隐藏 token 大部分内容
      if (key === "Authorization" && value.length > 20) {
        displayValue = value.slice(0, 20) + "...";
      }
      console.log(`  ${key}: ${displayValue}`);
    }
    console.log("-".repeat(50));
  }

  try {
    const response = await axios.get(fullUrl, { 
      headers, 
      timeout: 60000 
    });
    const result = response.data;

    if (result.status_code === 1) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      return {
        success: false,
        error: result.err_code || "UNKNOWN_ERROR",
        error_msg: result.err_msg || "",
      };
    }
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: "REQUEST_TIMEOUT",
        error_msg: "请求超时，请稍后重试",
      };
    }
    return {
      success: false,
      error: "REQUEST_ERROR",
      error_msg: error.message,
    };
  }
}

/**
 * 获取项目统计信息
 */
async function getProjectStats(projectId, accessToken, verbose = false) {
  const result = await fetchProject(projectId, accessToken, verbose);

  if (!result.success) {
    return result;
  }

  const data = result.data;
  const pages = data.questionpage_list || [];

  // 统计题目数量和类型
  let totalQuestions = 0;
  const questionTypes = {};

  for (const page of pages) {
    const questions = page.question_list || [];
    totalQuestions += questions.length;

    for (const q of questions) {
      const qType = q.question_type || "unknown";
      questionTypes[qType] = (questionTypes[qType] || 0) + 1;
    }
  }

  return {
    success: true,
    project_id: data.project_id || data._id,
    title: data.title || "",
    title_as_txt: data.title_as_txt || "",
    ptype_enname: data.ptype_enname || "",
    scene_type: data.scene_type || "",
    total_pages: pages.length,
    total_questions: totalQuestions,
    question_types: questionTypes,
    pages: pages.map(p => ({
      page_id: p.page_id,
      page_seq: p.page_seq,
      question_count: (p.question_list || []).length,
    })),
  };
}

/**
 * 保存项目数据到默认路径
 */
async function saveProjectToDefaultPath(projectData, projectId = null) {
  // 优先使用传入的 project_id，否则从数据中提取
  // 后端返回的是 _id 而不是 project_id
  const fileId = projectId || projectData.project_id || projectData._id;
  if (!fileId) {
    throw new Error("项目数据缺少 project_id/_id 字段");
  }

  // 创建保存目录
  await fs.mkdir(defaultProjectStructDir(), { recursive: true });

  // 保存文件路径
  const savePath = path.join(defaultProjectStructDir(), `${fileId}.json`);

  // 保存数据
  await fs.writeFile(savePath, JSON.stringify(projectData, null, 2), 'utf-8');

  return savePath;
}

/**
 * 打印项目统计信息
 */
function printProjectStats(stats) {
  if (!stats.success) {
    console.log(`\n❌ 获取失败: ${stats.error || 'Unknown'}`);
    if (stats.error_msg) {
      console.log(`   详情: ${stats.error_msg}`);
    }
    return;
  }

  console.log("\n" + "=".repeat(50));
  console.log("项目统计信息");
  console.log("=".repeat(50));

  console.log(`\n项目标题: ${stats.title_as_txt || stats.title || 'N/A'}`);
  console.log(`项目ID: ${stats.project_id || 'N/A'}`);
  console.log(`项目类型: ${stats.ptype_enname || 'N/A'}`);
  console.log(`场景类型: ${stats.scene_type || 'N/A'}`);

  console.log(`\n页面结构:`);
  for (const page of stats.pages || []) {
    console.log(`  第${page.page_seq}页 (${page.page_id}): ${page.question_count} 题`);
  }

  console.log(`\n题目统计:`);
  for (const [qType, count] of Object.entries(stats.question_types || {})) {
    console.log(`  ${qType}: ${count}`);
  }
  console.log(`  共计: ${stats.total_questions || 0} 题`);
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  let projectId = null;
  let outputFile = null;
  let showStats = false;
  let verbose = false;
  let token = null;
  let tokenDir = null;

  // 解析参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--project-id' || arg === '-p') && i + 1 < args.length) {
      projectId = args[++i];
    } else if ((arg === '--output' || arg === '-o') && i + 1 < args.length) {
      outputFile = args[++i];
    } else if (arg === '--stats') {
      showStats = true;
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === '--token' && i + 1 < args.length) {
      token = args[++i];
    } else if (arg === '--token-dir' && i + 1 < args.length) {
      tokenDir = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  }

  if (!projectId) {
    console.error("错误: 必须提供项目ID (--project-id)");
    showHelp();
    process.exit(1);
  }

  // 加载 token
  let accessToken = token;
  if (!accessToken && tokenDir) {
    accessToken = await loadAccessToken(tokenDir);
  } else if (!accessToken) {
    accessToken = await loadAccessToken();
  }

  console.log("\n" + "=".repeat(50));
  console.log("问卷网项目获取工具");
  console.log("=".repeat(50));

  if (showStats) {
    // 仅显示统计信息
    console.log(`\n正在获取项目统计信息...`);
    const stats = await getProjectStats(projectId, accessToken, verbose);
    printProjectStats(stats);
  } else {
    // 获取完整数据
    console.log(`\n正在获取项目数据...`);
    const result = await fetchProject(projectId, accessToken, verbose);

    if (result.success) {
      const data = result.data;
      console.log(`✓ 项目标题: ${data.title_as_txt || data.title || 'N/A'}`);
      console.log(`  项目类型: ${data.ptype_enname || 'N/A'}`);

      const pages = data.questionpage_list || [];
      const totalQuestions = pages.reduce((sum, p) => sum + (p.question_list || []).length, 0);
      console.log(`  题目数量: ${totalQuestions}`);
      console.log(`  页面数量: ${pages.length}`);

      // 保存到文件（仅在成功时保存）
      if (outputFile) {
        // 使用指定路径
        await fs.writeFile(outputFile, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`\n✓ 项目数据已保存到: ${outputFile}`);
      } else {
        // 保存到默认路径
        try {
          const savePath = await saveProjectToDefaultPath(data, projectId);
          console.log(`\n✓ 项目数据已保存到: ${savePath}`);
        } catch (e) {
          console.log(`\n❌ 保存失败: ${e.message}`);
          process.exit(1);
        }
      }
    } else {
      // 获取失败，不保存任何文件
      console.log(`\n❌ 获取失败: ${result.error || 'Unknown'}`);
      if (result.error_msg) {
        console.log(`   详情: ${result.error_msg}`);
      }
      console.log("\n✗ 由于获取失败，未保存任何文件");
      process.exit(1);
    }
  }
}

function showHelp() {
  console.log(`
问卷网项目获取工具

用法:
  node fetch_project.js --project-id <project_id>
  node fetch_project.js --project-id <project_id> --output my_project.json
  node fetch_project.js --project-id <project_id> --stats

选项:
  -p, --project-id <id>   项目ID（必填）
  -o, --output <file>     输出文件路径（默认: <凭证目录>/project_struct/<project_id>.json，见 token_store）
  --stats                 仅显示统计信息
  -v, --verbose           显示详细请求信息
  --token <token>         JWT access_token（默认按 token_store：auth.json → token.json → access_token）
  --token-dir <dir>       用户级凭证目录（默认 ~/.wenjuan 或环境变量 WENJUAN_TOKEN_DIR）
  -h, --help              显示帮助信息

示例:
  node fetch_project.js -p 5f8a9b2c3d4e5f6a7b8c9d0e
  node fetch_project.js -p 5f8a9b2c3d4e5f6a7b8c9d0e -o my_project.json
  node fetch_project.js -p 5f8a9b2c3d4e5f6a7b8c9d0e --stats
`);
}

// 导出模块
module.exports = {
  fetchProject,
  getProjectStats,
  loadAccessToken,
};

// 如果是直接运行
if (require.main === module) {
  main();
}
