#!/usr/bin/env node
/**
 * 问卷网 Skill 版本检查工具
 * 检查当前版本是否需要更新
 */

const axios = require('axios');
const path = require('path');

// API 地址
const BASE_URL = "https://www.wenjuan.com/app_api/skills/v1/version/check";

/** 与 package.json 同步；读失败时用兜底，避免与分发包版本不一致 */
function getEmbeddedCurrentVersion() {
  try {
    const pkg = require(path.join(__dirname, '..', 'package.json'));
    if (pkg && typeof pkg.version === 'string') return pkg.version;
  } catch (e) {
    /* ignore */
  }
  return '1.0.0';
}

const CURRENT_VERSION = getEmbeddedCurrentVersion();

/**
 * 检查版本更新
 * @param {string} currentVersion - 当前版本号，默认使用 CURRENT_VERSION
 * @returns {Promise<Object>} 版本检查响应数据
 */
async function checkVersion(currentVersion = null) {
  if (!currentVersion) {
    currentVersion = CURRENT_VERSION;
  }
  
  const params = {
    current_version: currentVersion
  };
  
  try {
    const response = await axios.get(BASE_URL, {
      params,
      timeout: 30000,
      headers: {
        'User-Agent': 'wenjuan-survey-skill/check_version (Node.js)',
        Accept: 'application/json',
      },
      validateStatus: (s) => s >= 200 && s < 500,
    });

    const result = response.data;
    if (!result || typeof result !== 'object') {
      return {
        error: `无效响应 (${response.status})，可能为网络拦截或非 JSON`,
      };
    }

    const ok = result.status_code === 1 || String(result.status_code) === '1';
    // 如果接口没有返回 current_version，补充进去
    if (ok && result.data) {
      result.data.current_version = currentVersion;
    }

    if (!ok && response.status >= 400) {
      return { error: `请求失败: ${response.status} ${response.statusText || ''}`.trim() };
    }

    return result;
  } catch (error) {
    if (error.response) {
      return { error: `请求失败: ${error.response.status} ${error.response.statusText}` };
    }
    return { error: `请求失败: ${error.message}` };
  }
}

/**
 * 比较版本号，判断当前版本是否低于最新版本
 * @param {string} current - 当前版本号
 * @param {string} latest - 最新版本号
 * @returns {boolean} 当前版本是否需要更新（current < latest）
 */
function compareVersions(current, latest) {
  /**
   * 将版本号转换为可比较的整数列表
   * @param {string} v
   * @returns {number[]}
   */
  function normalizeVersion(v) {
    // 移除前导v，并按 . 分割
    v = v.replace(/^[vV]/, '');
    const parts = v.split('.');
    return parts.map(p => {
      const num = parseInt(p, 10);
      return isNaN(num) ? 0 : num;
    });
  }
  
  try {
    const currentParts = normalizeVersion(current);
    const latestParts = normalizeVersion(latest);
    
    // 补齐长度
    const maxLen = Math.max(currentParts.length, latestParts.length);
    while (currentParts.length < maxLen) currentParts.push(0);
    while (latestParts.length < maxLen) latestParts.push(0);
    
    for (let i = 0; i < maxLen; i++) {
      if (currentParts[i] < latestParts[i]) return true;
      if (currentParts[i] > latestParts[i]) return false;
    }
    return false;
  } catch (error) {
    // 版本号解析失败时，假设不需要更新
    return false;
  }
}

/**
 * 显示版本信息
 * @param {Object} result
 * @param {boolean} autoCheck
 */
function displayVersionInfo(result, autoCheck = false) {
  if (result.error) {
    if (!autoCheck) {
      console.log(`❌ ${result.error}`);
    }
    return;
  }
  
  const ok = result.status_code === 1 || String(result.status_code) === '1';
  if (!ok) {
    const errMsg = result.err_msg || result.message || '未知错误';
    if (!autoCheck) {
      console.log(`❌ 版本检查失败: ${errMsg}`);
    }
    return;
  }
  
  const data = result.data || {};
  const current = data.current_version || CURRENT_VERSION;
  const latest = data.latest || "1.0.0";
  let hasUpdate = data.has_update || false;
  const releaseNote = data.release_note || "";
  const instruction = data.instruction || "";
  
  // 如果接口没有返回 has_update，自行计算
  if (!hasUpdate && current && latest) {
    hasUpdate = compareVersions(current, latest);
  }
  
  if (autoCheck) {
    // 自动检查模式：只在有更新时输出
    if (hasUpdate) {
      console.log("\n" + "=".repeat(60));
      console.log("📦 发现新版本！");
      console.log("=".repeat(60));
      console.log(`当前版本: ${current}`);
      console.log(`最新版本: ${latest}`);
      if (releaseNote) {
        console.log(`\n更新内容:\n${releaseNote}`);
      }
      if (instruction) {
        console.log(`\n更新说明:\n${instruction}`);
      }
      console.log("=".repeat(60));
    }
  } else {
    // 普通模式：完整输出
    console.log("\n" + "=".repeat(60));
    console.log("📦 版本检查");
    console.log("=".repeat(60));
    console.log(`当前版本: ${current}`);
    console.log(`最新版本: ${latest}`);
    
    if (hasUpdate) {
      console.log(`\n⚠️ 发现新版本！`);
      if (releaseNote) {
        console.log(`\n更新内容:\n${releaseNote}`);
      }
      if (instruction) {
        console.log(`\n更新说明:\n${instruction}`);
      }
    } else {
      console.log(`\n✅ 当前已是最新版本`);
    }
    
    console.log("=".repeat(60));
  }
}

/**
 * 判断是否需要更新
 * @param {Object} result - checkVersion 返回的结果
 * @returns {boolean}
 */
function shouldUpdate(result) {
  const ok = !result.error && (result.status_code === 1 || String(result.status_code) === '1');
  if (!ok) {
    return false;
  }
  
  const data = result.data || {};
  let hasUpdate = data.has_update || false;
  
  if (hasUpdate) {
    return true;
  }
  
  // 如果接口没有返回 has_update，自行计算
  const current = data.current_version || CURRENT_VERSION;
  const latest = data.latest || "1.0.0";
  return compareVersions(current, latest);
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  let version = null;
  let autoCheck = false;
  let outputJson = false;
  /** 为 true 时：有新版本才 exit 1（供 CI 严格失败）；默认 false，避免 Workerbuddy 等把「有更新」当成任务失败 */
  let failOnUpdate = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if ((arg === "-v" || arg === "--version") && i + 1 < args.length) {
      version = args[++i];
    } else if (arg === "-a" || arg === "--auto") {
      autoCheck = true;
    } else if (arg === "--json") {
      outputJson = true;
    } else if (arg === "--fail-on-update") {
      failOnUpdate = true;
    } else if (arg === "-h" || arg === "--help") {
      showHelp();
      process.exit(0);
    }
  }

  try {
    const result = await checkVersion(version);

    if (outputJson) {
      console.log(JSON.stringify(result, null, 2));
      if (result.error) process.exit(2);
      const ok = result.status_code === 1 || String(result.status_code) === '1';
      if (!ok) process.exit(2);
      if (failOnUpdate && shouldUpdate(result)) process.exit(1);
      return;
    }

    displayVersionInfo(result, autoCheck);

    if (result.error) {
      process.exit(2);
    }
    const ok = result.status_code === 1 || String(result.status_code) === '1';
    if (!ok) {
      process.exit(2);
    }

    if (failOnUpdate && shouldUpdate(result)) {
      process.exit(1);
    }
  } catch (error) {
    if (!autoCheck) {
      console.log(`❌ 错误: ${error.message}`);
    }
    process.exit(2);
  }
}

function showHelp() {
  console.log(`
问卷网 Skill 版本检查工具

用法: node check_version.js [选项]

选项:
  -v, --version <ver>  指定当前版本号，默认使用 package.json 的 version
  -a, --auto           自动检查模式，有更新时才输出
  --fail-on-update     有新版本时退出码 1（默认退出码 0，避免 Workerbuddy 等误判失败）
  --json               输出原始 JSON 响应
  -h, --help           显示帮助信息

退出码:
  0  检查完成（含「有新版本」提示）；或 --json 且成功
  1  仅当使用 --fail-on-update 且确有新版本
  2  网络错误、接口非成功或非 JSON

示例:
  # 检查版本
  node check_version.js
  
  # 指定当前版本检查
  node check_version.js --version 1.0.0
  
  # 自动检查模式（有更新时才输出）
  node check_version.js --auto
  
  # 输出原始 JSON 响应
  node check_version.js --json
  
  # CI：需要新版本时让流水线失败
  node check_version.js --fail-on-update
`);
}

// 导出模块
module.exports = {
  checkVersion,
  compareVersions,
  displayVersionInfo,
  shouldUpdate,
  CURRENT_VERSION
};

// 如果是直接运行
if (require.main === module) {
  main();
}
