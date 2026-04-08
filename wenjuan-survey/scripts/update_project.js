#!/usr/bin/env node
/**
 * 问卷网项目信息修改工具
 * 
 * 通过 POST /app_api/edit/edit_project/ 接口修改项目基本信息。
 * 支持修改：标题、欢迎语（begin_desc）、结束语（end_desc）
 * 
 * 用法:
 *     node update_project.js --project-id <project_id> --title <title>
 *     node update_project.js --project-id <project_id> --begin-desc <desc>
 *     node update_project.js --project-id <project_id> --end-desc <desc>
 *     node update_project.js --project-id <project_id> --title <title> --begin-desc <desc> --end-desc <desc>
 */

const axios = require('axios');
const fs = require('fs').promises;
const { generateSignature, CONFIG } = require('./generate_sign');
const { ensureReadyForEdit } = require('./project_edit_guard');
const { resolveAccessToken } = require('./token_store');

// API 配置
const API_BASE_URL = "https://www.wenjuan.com";

/** 从文件加载 access_token（逻辑见 token_store.js） */
async function loadAccessToken(tokenDir = null) {
  return resolveAccessToken({
    tokenDir: tokenDir == null ? undefined : tokenDir,
  });
}

/**
 * 生成签名参数
 */
function generateSignatureParams(params) {
  // 复制参数用于签名（包含业务参数）
  const signParams = { ...params };
  
  // 生成签名（generateSignature 会自动添加 appkey, web_site, timestamp）
  const signature = generateSignature(signParams, true);
  
  // 获取当前时间戳
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  return {
    appkey: CONFIG.appkey,
    web_site: CONFIG.web_site,
    timestamp: timestamp,
    signature: signature,
  };
}

/**
 * 修改项目基本信息
 * 当确有标题/欢迎语/结束语等字段待更新时，在 POST 前先执行 ensureReadyForEdit（停收 + 归档），禁止调用方绕过。
 * @param {string|null|undefined} [tokenDir] 凭证目录，与 ensureReadyForEdit 一致
 */
async function updateProject(projectId, updates, accessToken, verbose = false, tokenDir = null) {
  const { title, beginDesc, endDesc } = updates;
  
  // 构造业务参数
  const params = {
    project_id: projectId,
  };
  
  // 只添加非空参数
  if (title !== undefined && title !== null) {
    params.title = title;
  }
  if (beginDesc !== undefined && beginDesc !== null) {
    params.begin_desc = beginDesc;
  }
  if (endDesc !== undefined && endDesc !== null) {
    params.end_desc = endDesc;
  }
  
  // 如果没有要修改的字段，直接返回（不调停收/归档）
  if (Object.keys(params).length === 1) {  // 只有 project_id
    return {
      success: true,
      data: {},
      message: "没有提供要修改的字段",
    };
  }

  await ensureReadyForEdit(projectId, {
    tokenDir: tokenDir === null || tokenDir === undefined ? undefined : tokenDir,
  });
  
  // 生成签名参数
  const signatureParams = generateSignatureParams(params);
  
  // 合并参数（业务参数 + 签名参数）
  const fullParams = { ...params, ...signatureParams };
  
  // 构造请求 URL
  const url = `${API_BASE_URL}/app_api/edit/edit_project/`;
  
  // 构造请求头
  const headers = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  
  // 打印详细请求信息
  if (verbose) {
    console.log("\n" + "-".repeat(50));
    console.log("【请求详情】");
    console.log("-".repeat(50));
    console.log(`请求方法: POST`);
    console.log(`请求URL: ${url}`);
    console.log(`\n业务参数:`);
    for (const [key, value] of Object.entries(params)) {
      let displayValue = value;
      // 截断过长的值
      if (String(displayValue).length > 50) {
        displayValue = String(displayValue).slice(0, 50) + "...";
      }
      console.log(`  ${key}: ${displayValue}`);
    }
    console.log(`\n签名参数:`);
    for (const key of ["appkey", "web_site", "timestamp", "signature"]) {
      let value = signatureParams[key] || "N/A";
      if (key === "signature" && String(value).length > 10) {
        value = String(value).slice(0, 10) + "..." + String(value).slice(-5);
      }
      console.log(`  ${key}: ${value}`);
    }
    console.log(`\n请求头:`);
    for (const [key, value] of Object.entries(headers)) {
      let displayValue = value;
      if (key === "Authorization" && value.length > 20) {
        displayValue = value.slice(0, 20) + "...";
      }
      console.log(`  ${key}: ${displayValue}`);
    }
    console.log("-".repeat(50));
  }

  try {
    // POST 请求（表单格式）
    const response = await axios.post(url, new URLSearchParams(fullParams), { 
      headers, 
      timeout: 60000 
    });
    const result = response.data;

    if (result.status_code === 1) {
      return {
        success: true,
        data: result.data || {},
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
 * 打印修改结果
 */
function printUpdateResult(result) {
  if (!result.success) {
    console.log(`\n❌ 修改失败: ${result.error || 'Unknown'}`);
    if (result.error_msg) {
      console.log(`   详情: ${result.error_msg}`);
    }
    return;
  }

  const data = result.data || {};
  
  if (!data || Object.keys(data).length === 0) {
    if (result.message) {
      console.log(`\n⚠️ ${result.message}`);
    } else {
      console.log(`\n✓ 修改成功（无返回数据）`);
    }
    return;
  }

  console.log("\n✓ 修改成功！");
  console.log("\n更新后的信息:");
  
  if (data.title) {
    console.log(`  标题: ${data.title}`);
  }
  if (data.begin_desc) {
    let desc = data.begin_desc;
    if (desc.length > 50) {
      desc = desc.slice(0, 50) + "...";
    }
    console.log(`  欢迎语: ${desc}`);
  }
  if (data.end_desc) {
    let desc = data.end_desc;
    if (desc.length > 50) {
      desc = desc.slice(0, 50) + "...";
    }
    console.log(`  结束语: ${desc}`);
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  let projectId = null;
  let title = null;
  let beginDesc = null;
  let endDesc = null;
  let verbose = false;
  let token = null;
  let tokenDir = null;

  // 解析参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--project-id' || arg === '-p') && i + 1 < args.length) {
      projectId = args[++i];
    } else if ((arg === '--title' || arg === '-t') && i + 1 < args.length) {
      title = args[++i];
    } else if (arg === '--begin-desc' && i + 1 < args.length) {
      beginDesc = args[++i];
    } else if (arg === '--end-desc' && i + 1 < args.length) {
      endDesc = args[++i];
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

  // 检查是否有要修改的字段
  if (!title && beginDesc === null && endDesc === null) {
    console.log("\n⚠️ 警告: 没有提供任何要修改的字段");
    console.log("   请使用 --title、--begin-desc 或 --end-desc 指定要修改的内容");
    console.log("\n使用 --help 查看帮助信息");
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
  console.log("问卷网项目信息修改工具");
  console.log("=".repeat(50));
  console.log(`\n正在修改项目信息...`);

  // 停收 + 归档在 updateProject 内强制执行，勿在外部重复或跳过
  const result = await updateProject(
    projectId,
    { title, beginDesc, endDesc },
    accessToken,
    verbose,
    tokenDir
  );

  // 打印结果
  printUpdateResult(result);

  // 退出码
  if (!result.success) {
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
问卷网项目信息修改工具

用法:
  # 修改标题
  node update_project.js --project-id xxx --title "新标题"
  
  # 修改欢迎语
  node update_project.js --project-id xxx --begin-desc "欢迎语"
  
  # 修改结束语
  node update_project.js --project-id xxx --end-desc "结束语"
  
  # 同时修改多个字段
  node update_project.js --project-id xxx --title "新标题" --begin-desc "欢迎" --end-desc "谢谢"

选项:
  -p, --project-id <id>   项目ID（必填）
  -t, --title <title>     项目标题（可选）
  --begin-desc <desc>     欢迎语/开始描述（可选）
  --end-desc <desc>       结束语（可选）
  -v, --verbose           显示详细请求信息
  --token <token>         JWT access_token（默认按 token_store：auth.json → token.json → access_token）
  --token-dir <dir>       用户级凭证目录（默认 ~/.wenjuan 或环境变量 WENJUAN_TOKEN_DIR）
  -h, --help              显示帮助信息

如何获取项目ID:
  如果不知道项目ID，可以通过 list_projects 脚本查询：
  node scripts/list_projects.js
`);
}

// 导出模块
module.exports = {
  updateProject,
  loadAccessToken,
};

// 如果是直接运行
if (require.main === module) {
  main().catch((e) => {
    console.error(`错误: ${e.message || e}`);
    process.exit(1);
  });
}
