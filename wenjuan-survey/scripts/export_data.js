#!/usr/bin/env node
/**
 * 导出问卷原始数据
 * 原始数据、文本数据、一题一列、Excel格式
 * 与 export_data.py 行为一致
 */

const fs = require("fs").promises;
const { createWriteStream } = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const axios = require("axios");
const { openUrlBestEffort } = require("./open_url_cjs");
const { getDefaultTokenDir, resolveAccessToken } = require("./token_store");
const { buildSignedUrl, CONFIG, generateSignature } = require("./generate_sign");

const BASE_URL = "https://www.wenjuan.com";
const DOWNLOAD_API = `${BASE_URL}/report/api/download`;
const INFO_API = `${BASE_URL}/report/api/download/infos`;
const FILTER_COUNT_API = `${BASE_URL}/report/api/download/filter_count`;

/** 与编辑类接口一致：报表下载 / 数据概况均走 ai_skills（`generate_sign.js` 的 CONFIG） */
const API_CONFIG = {
  web_site: CONFIG.web_site,
  appkey: CONFIG.appkey,
  secret: CONFIG.secret,
  /** @deprecated 旧字段名，等同于 appkey */
  get app_key() {
    return CONFIG.appkey;
  },
};

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_TIME_SEC = 600;

/**
 * 为报表请求 URL 追加与 AI 技能相同的签名查询串（appkey、web_site、timestamp、signature）
 * @param {string} baseUrl
 * @param {Record<string, string|number>|null} [extraParams] 如 infos 需传 project_id
 */
function buildUrlWithAuth(baseUrl, extraParams = null) {
  const params =
    extraParams && typeof extraParams === "object" ? { ...extraParams } : {};
  return buildSignedUrl(baseUrl, params);
}

async function getJwtToken(tokenDir = null) {
  const t = await resolveAccessToken({
    tokenDir: tokenDir == null ? undefined : tokenDir,
  });
  if (!t) {
    console.error("错误: 未找到登录凭证，请先运行 wenjuan-login（或与各脚本一致的 token 路径，见 token_store.js / references/auth.md）");
    process.exit(1);
  }
  return t;
}

function getAuthHeaders(jwtToken) {
  return {
    Authorization: `Bearer ${jwtToken}`,
    "Content-Type": "application/json",
  };
}

function isApiOk(result) {
  return result.status_code === 1 || String(result.code) === "200";
}

async function getFilterCount(jwtToken, projectId) {
  const url = buildUrlWithAuth(FILTER_COUNT_API);
  const headers = getAuthHeaders(jwtToken);
  const body = {
    project_id: projectId,
    client_type: 1,
    source: 1,
    filter_template: {},
  };
  try {
    const response = await axios.post(url, body, { headers });
    const result = response.data;
    if (isApiOk(result)) {
      const d = result.data || {};
      return d.filter_count != null ? d.filter_count : 0;
    }
  } catch (e) {
    console.error(`  获取数据量失败: ${e.message}`);
  }
  return 0;
}

async function createDownloadTask(jwtToken, projectId) {
  const url = buildUrlWithAuth(DOWNLOAD_API);
  const headers = getAuthHeaders(jwtToken);
  const data = {
    project_id: projectId,
    download_type: 1,
    sub_type: 3,
    client_type: 1,
    source: 1,
    file_type: [1],
    data_type: 1,
    is_merge: true,
    ext: {
      data_content: "raw",
      data_format: "text",
      display_mode: "one_question_one_column",
    },
  };
  try {
    const response = await axios.post(url, data, { headers });
    const result = response.data;
    if (isApiOk(result)) {
      return true;
    }
    if (result.code === "10100") {
      console.log("  该项目已有任务正在下载中，请稍后再试");
    } else {
      const errMsg = result.err_msg || result.msg || "未知错误";
      const errCode = result.err_code != null ? result.err_code : result.code;
      console.log(`  创建任务失败: ${errMsg} (code: ${errCode})`);
    }
  } catch (e) {
    console.log(`  创建任务请求失败: ${e.message}`);
  }
  return false;
}

async function getDownloadInfos(jwtToken, projectId) {
  const url = buildUrlWithAuth(INFO_API, { project_id: projectId });
  const headers = getAuthHeaders(jwtToken);
  try {
    const response = await axios.get(url, { headers });
    const result = response.data;
    if (isApiOk(result)) {
      const d = result.data || {};
      return d.task_list || d.list || [];
    }
  } catch (e) {
    // ignore
  }
  return [];
}

async function downloadFile(fileUrl, outputPath) {
  try {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const response = await axios.get(fileUrl, {
      responseType: "stream",
      timeout: 60000,
    });
    await pipeline(response.data, createWriteStream(outputPath));
    return true;
  } catch (e) {
    console.log(`  下载失败: ${e.message}`);
    return false;
  }
}

async function openReportPage(projectId) {
  const reportUrl = `${BASE_URL}/report/topic/${projectId}`;
  console.log(`\n正在打开报表页面: ${reportUrl}`);
  const ok = await openUrlBestEffort(reportUrl);
  if (!ok) {
    console.log("⚠️ 打开浏览器失败（可手动访问上述链接）");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 导出原始数据主流程（与 export_data.export_data 一致）
 * @param {string} projectId
 * @param {string} outputDir 目录路径
 * @param {number} timeoutSec 轮询超时（秒）
 */
async function exportData(projectId, outputDir, timeoutSec, tokenDir = null) {
  const jwtToken = await getJwtToken(tokenDir);

  console.log("=".repeat(50));
  console.log("导出问卷原始数据");
  console.log("=".repeat(50));
  console.log(`项目ID: ${projectId}`);
  console.log(`输出目录: ${outputDir}`);
  console.log("");

  console.log("1. 检查数据量...");
  const dataCount = await getFilterCount(jwtToken, projectId);
  console.log(`   答卷数量: ${dataCount.toLocaleString()}`);

  if (dataCount === 0) {
    console.log("\n❌ 该项目暂无答卷数据");
    return;
  }

  console.log("\n2. 创建导出任务...");
  const created = await createDownloadTask(jwtToken, projectId);
  if (!created) {
    process.exit(1);
  }
  console.log("   ✅ 任务创建成功");

  console.log(`\n3. 等待导出完成（最多等待${timeoutSec}秒）...`);
  const startTime = Date.now();
  let downloaded = false;

  while ((Date.now() - startTime) / 1000 < timeoutSec) {
    await sleep(POLL_INTERVAL_MS);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    process.stdout.write(`   已等待 ${elapsed} 秒...\r`);

    const tasks = await getDownloadInfos(jwtToken, projectId);

    for (const task of tasks) {
      const status = task.status;
      const fileUrl = task.download_url;

      if (status === 1 && fileUrl) {
        console.log("\n   ✅ 导出完成！");
        console.log(`   文件名: ${task.display_name || "未知"}`);

        const timestamp = Math.floor(Date.now() / 1000);
        const filename = `${projectId}_${timestamp}.xlsx`;
        const outputPath = path.join(outputDir, filename);

        console.log("\n4. 下载文件...");
        console.log(`   保存路径: ${outputPath}`);

        const ok = await downloadFile(fileUrl, outputPath);
        if (ok) {
          console.log("   ✅ 下载成功");
          const stat = await fs.stat(outputPath);
          console.log(`   文件大小: ${(stat.size / 1024).toFixed(2)} KB`);
          downloaded = true;
        } else {
          console.log("   ❌ 下载失败");
        }
        break;
      }
      if (status === 2) {
        console.log("\n   ❌ 导出任务失败");
        process.exit(1);
      }
      if (status === 4) {
        console.log("\n   ⚠️ 无数据可导出");
        process.exit(0);
      }
    }

    if (downloaded) {
      break;
    }
  }

  if (!downloaded) {
    console.log("\n   ⏱️ 等待超时，请稍后通过页面下载");
    await openReportPage(projectId);
    process.exit(1);
  }

  console.log("\n" + "=".repeat(50));
  console.log("✅ 导出完成！");
  console.log("=".repeat(50));
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let projectId = null;
  let tokenDir = null;
  let outputDir = path.join(getDefaultTokenDir(), "download");
  let timeout = MAX_POLL_TIME_SEC;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
      return { help: true };
    }
    if (arg === "--token-dir" && i + 1 < args.length) {
      tokenDir = args[++i];
      continue;
    }
    if ((arg === "-o" || arg === "--output") && i + 1 < args.length) {
      outputDir = path.resolve(args[++i]);
      continue;
    }
    if ((arg === "-t" || arg === "--timeout") && i + 1 < args.length) {
      const t = parseInt(args[++i], 10);
      if (!Number.isFinite(t) || t < 1) {
        console.error("错误: --timeout 须为正整数");
        process.exit(1);
      }
      timeout = t;
      continue;
    }
    if (arg.startsWith("-")) {
      console.error(`错误: 未知选项 ${arg}`);
      process.exit(1);
    }
    if (projectId != null) {
      console.error("错误: 只能提供一个项目ID");
      process.exit(1);
    }
    projectId = arg;
  }

  return { projectId, outputDir, timeout, tokenDir };
}

function showHelp() {
  console.log(`
导出问卷原始数据（文本、一题一列、xlsx），与 export_data.py 一致

用法: node export_data.js <project_id> [选项]

参数:
  project_id              项目ID（必填，第一个位置参数）

选项:
  -o, --output <dir>      下载目录 (默认 <凭证目录>/download；未设 WENJUAN_TOKEN_DIR 时为 ~/.wenjuan/download/)
  --token-dir <dir>       与 login_auto 等一致，指定用户级凭证目录（内含 token.json）
  -t, --timeout <秒>      轮询超时时间 (默认: ${MAX_POLL_TIME_SEC})
  -h, --help              显示帮助信息

示例:
  node export_data.js "abc123"
  node export_data.js "abc123" -o ./downloads -t 300
`);
}

async function main() {
  const parsed = parseArgs(process.argv);
  if (parsed.help) {
    showHelp();
    process.exit(0);
  }
  if (!parsed.projectId) {
    console.error("错误: 必须提供项目ID（第一个位置参数）");
    showHelp();
    process.exit(1);
  }
  await exportData(
    parsed.projectId,
    parsed.outputDir,
    parsed.timeout,
    parsed.tokenDir
  );
}

module.exports = {
  exportData,
  getJwtToken,
  getFilterCount,
  createDownloadTask,
  getDownloadInfos,
  downloadFile,
  buildUrlWithAuth,
  generateSignature,
  API_CONFIG,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(`❌ 错误: ${err.message}`);
    process.exit(1);
  });
}
