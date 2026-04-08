#!/usr/bin/env node
/**
 * 问卷网AI技能签名生成工具
 * 
 * 签名规则：
 * 1. 收集所有请求参数（不包括signature，如果存在会自动移除）
 * 2. 添加固定参数: appkey, web_site, timestamp
 * 3. 按参数名字母顺序升序排列
 * 4. 拼接所有参数值（按排序后的顺序）
 * 5. 末尾加上secret的值
 * 6. 对完整字符串进行MD5加密
 * 7. 得到32位小写签名结果
 * 
 * 最终请求参数包含4个固定参数:
 * - appkey: wjMRcjzM12BjqXjkme
 * - web_site: ai_skills
 * - timestamp: 当前时间戳（秒级）
 * - signature: MD5签名结果
 */

const crypto = require('crypto');
const { URL, URLSearchParams } = require('url');

// 固定配置
const CONFIG = {
  web_site: "ai_skills",
  appkey: "wjMRcjzM12BjqXjkme",
  secret: "DJFb6xHgmvnRqv52uSNGzMAVaFtUKFdF"
};

/**
 * 生成签名
 * @param {Object} params - 请求参数字典（如果包含signature会被自动移除）
 * @param {boolean} includeTimestamp - 是否自动添加时间戳
 * @returns {string} 32位小写MD5签名字符串
 */
function generateSignature(params, includeTimestamp = true) {
  // 复制参数，避免修改原对象
  const signParams = { ...params };
  
  // 添加固定参数
  signParams.web_site = CONFIG.web_site;
  signParams.appkey = CONFIG.appkey;
  
  // 添加时间戳（如果不存在且需要）
  if (includeTimestamp && !signParams.timestamp) {
    signParams.timestamp = String(Math.floor(Date.now() / 1000));
  }
  
  // 移除signature参数（如果存在）- 签名时不包含旧的signature
  delete signParams.signature;
  
  // 按参数名字母顺序升序排列
  const sortedKeys = Object.keys(signParams).sort();
  
  // 拼接参数值
  let valueStr = "";
  for (const key of sortedKeys) {
    valueStr += String(signParams[key]);
  }
  
  // 末尾加上secret
  const signString = valueStr + CONFIG.secret;
  
  // MD5加密
  const signature = crypto.createHash('md5').update(signString, 'utf-8').digest('hex');
  
  return signature;
}

/**
 * 解析URL中的参数
 * @param {string} url - 完整URL或查询字符串
 * @returns {Object} 参数字典
 */
function parseUrlParams(url) {
  // 如果只有查询字符串，添加一个dummy scheme
  let fullUrl = url;
  if (!url.includes("?") && !url.startsWith("http")) {
    fullUrl = "http://dummy.com/?" + url;
  }
  
  const parsed = new URL(fullUrl);
  const params = {};
  
  parsed.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  
  return params;
}

/**
 * 生成带签名的完整URL
 * @param {string} baseUrl - 基础URL（不含查询参数）
 * @param {Object} params - 额外参数
 * @returns {string} 带签名的完整URL
 */
function buildSignedUrl(baseUrl, params = {}) {
  // 生成签名
  const signature = generateSignature(params);
  
  // 构建完整参数
  const fullParams = { ...params };
  fullParams.web_site = CONFIG.web_site;
  fullParams.appkey = CONFIG.appkey;
  if (!fullParams.timestamp) {
    fullParams.timestamp = String(Math.floor(Date.now() / 1000));
  }
  fullParams.signature = signature;
  
  // 拼接URL
  const separator = baseUrl.includes("?") ? "&" : "?";
  const queryString = new URLSearchParams(fullParams).toString();
  return baseUrl + separator + queryString;
}

/**
 * 对已有URL进行签名
 * @param {string} url - 原始URL（可包含已有参数）
 * @returns {string} 带签名的完整URL
 */
function signUrl(url) {
  // 解析已有参数
  const params = parseUrlParams(url);
  
  // 获取基础URL
  let baseUrl = url;
  if (url.includes("?")) {
    baseUrl = url.split("?")[0];
  }
  
  return buildSignedUrl(baseUrl, params);
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  
  // 解析参数
  let url = null;
  const params = {};
  let format = "full";
  let timestamp = null;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === "--url" && i + 1 < args.length) {
      url = args[++i];
    } else if (arg === "--param" && i + 1 < args.length) {
      const param = args[++i];
      if (param.includes("=")) {
        const [key, value] = param.split("=");
        params[key] = value;
      } else {
        params[param] = "";
      }
    } else if (arg === "--format" && i + 1 < args.length) {
      format = args[++i];
      if (!["full", "url", "signature"].includes(format)) {
        console.error("错误: format 必须是 full, url 或 signature");
        process.exit(1);
      }
    } else if (arg === "--timestamp" && i + 1 < args.length) {
      timestamp = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      showHelp();
      process.exit(0);
    }
  }
  
  // 从URL解析参数
  if (url && url.includes("?")) {
    const urlParams = parseUrlParams(url);
    Object.assign(params, urlParams);
  }
  
  // 指定时间戳
  if (timestamp) {
    params.timestamp = timestamp;
  } else if (!params.timestamp) {
    params.timestamp = String(Math.floor(Date.now() / 1000));
  }
  
  // 生成签名
  const signature = generateSignature(params, false);
  
  // 输出结果
  if (format === "signature") {
    console.log(signature);
  } else if (format === "url") {
    const baseUrl = url && url.includes("?") ? url.split("?")[0] : url || "";
    if (baseUrl) {
      const fullParams = { ...params };
      fullParams.web_site = CONFIG.web_site;
      fullParams.appkey = CONFIG.appkey;
      fullParams.signature = signature;
      const queryString = new URLSearchParams(fullParams).toString();
      console.log(baseUrl + "?" + queryString);
    } else {
      console.error("错误: 使用--format url时必须提供--url参数");
      process.exit(1);
    }
  } else {
    // full 格式
    console.log("=".repeat(60));
    console.log("问卷网AI技能签名生成");
    console.log("=".repeat(60));
    console.log();
    console.log("【配置信息】");
    console.log(`  web_site: ${CONFIG.web_site}`);
    console.log(`  appkey: ${CONFIG.appkey}`);
    console.log(`  secret: ${CONFIG.secret.slice(0, 10)}...`);
    console.log();
    console.log("【请求参数】");
    // 添加固定参数用于显示
    const displayParams = { ...params };
    displayParams.web_site = CONFIG.web_site;
    displayParams.appkey = CONFIG.appkey;
    // 移除signature（如果存在）
    if (displayParams.signature) {
      console.log("  (移除了原有的signature参数)");
      delete displayParams.signature;
    }
    Object.keys(displayParams).sort().forEach(key => {
      console.log(`  ${key}: ${displayParams[key]}`);
    });
    console.log();
    console.log("【签名过程】");
    
    // 重新计算并显示中间步骤
    const signParams = { ...displayParams };
    const sortedItems = Object.entries(signParams).sort((a, b) => a[0].localeCompare(b[0]));
    
    console.log(`  1. 参数排序: ${sortedItems.map(([k]) => k).join(", ")}`);
    
    const valueStr = sortedItems.map(([_, v]) => String(v)).join("");
    console.log(`  2. 拼接值: ${valueStr}`);
    
    const signString = valueStr + CONFIG.secret;
    console.log(`  3. 加secret: ${signString.slice(0, 50)}...`);
    
    console.log(`  4. MD5结果: ${signature}`);
    console.log();
    console.log("=".repeat(60));
    console.log(`最终 signature: ${signature}`);
    console.log("=".repeat(60));
    console.log();
    console.log("【最终请求参数（共4个固定参数 + 业务参数）】");
    console.log(`  appkey=${CONFIG.appkey}`);
    console.log(`  web_site=${CONFIG.web_site}`);
    console.log(`  timestamp=${displayParams.timestamp || 'N/A'}`);
    console.log(`  signature=${signature}`);
    const otherKeys = Object.keys(displayParams).filter(k => !['appkey', 'web_site', 'timestamp'].includes(k));
    if (otherKeys.length > 0) {
      console.log("  [业务参数]");
      otherKeys.sort().forEach(k => {
        console.log(`    ${k}=${displayParams[k]}`);
      });
    }
  }
}

function showHelp() {
  console.log(`
生成问卷网AI技能API签名。最终请求参数会包含4个固定参数: appkey, web_site, timestamp, signature

用法: node generate_sign.js [选项]

选项:
  --url <url>           原始URL（可选）
  --param <key=value>   请求参数，格式: key=value，可多次使用
  --format <format>     输出格式: full=完整信息, url=完整URL, signature=仅签名
  --timestamp <ts>      指定时间戳（秒级），默认使用当前时间
  -h, --help            显示帮助信息

示例:
  # 生成签名（从URL解析参数）
  node generate_sign.js --url "https://api.example.com/test?user_id=123"

  # 指定参数生成签名
  node generate_sign.js --param user_id=123 --param action=get_list

  # 生成完整URL（自动添加appkey, web_site, timestamp, signature）
  node generate_sign.js --url "https://api.example.com/test" --param user_id=123 --format url

  # 仅输出生成的签名值
  node generate_sign.js --param project_id=abc123 --format signature

固定参数:
  appkey=wjMRcjzM12BjqXjkme
  web_site=ai_skills
  timestamp=当前时间戳（秒级）
  signature=MD5签名结果
`);
}

// 导出模块
module.exports = {
  generateSignature,
  parseUrlParams,
  buildSignedUrl,
  signUrl,
  CONFIG
};

// 如果是直接运行
if (require.main === module) {
  main();
}
