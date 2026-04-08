#!/usr/bin/env node
/**
 * 问卷网手机号绑定工具
 * 绑定手机号以启用发布功能
 * 
 * 流程：
 * 1. JWT 换取 uid (POST /auth/mobile_bind/jwt_login/)
 * 2. 打开浏览器访问绑定页面 (GET /auth/mobile_bind/?uid=<uid>)
 */

const axios = require('axios');
const path = require('path');
const { resolveAccessToken, getDefaultTokenDir } = require('./token_store');
const { openUrlBestEffort, writeUrlForManualOpen } = require('./open_url_cjs');

// API 地址
const API_BASE_URL = "https://www.wenjuan.com";

/** 从本地文件读取 JWT（逻辑见 token_store.js） */
async function getToken() {
  const t = await resolveAccessToken();
  return t || "";
}

/**
 * 使用 JWT 换取 uid
 * @param {string} jwtToken - JWT认证令牌
 */
async function getUidFromJwt(jwtToken) {
  const headers = {
    "Authorization": `Bearer ${jwtToken}`,
    "Content-Type": "application/json"
  };
  
  try {
    const response = await axios.post(
      `${API_BASE_URL}/auth/mobile_bind/jwt_login/`,
      {},
      { headers, timeout: 30000 }
    );
    
    const result = response.data;
    if (result.status_code === 1 && result.data && result.data.uid) {
      return {
        success: true,
        uid: result.data.uid,
        expireSeconds: result.data.expire_seconds || 600
      };
    }
    
    return {
      success: false,
      error: result.err_code || "UNKNOWN_ERROR",
      errorMsg: result.err_msg || "获取 uid 失败"
    };
  } catch (error) {
    if (error.response) {
      return {
        success: false,
        error: `HTTP_${error.response.status}`,
        errorMsg: `请求失败: ${error.response.status} ${error.response.statusText}`
      };
    }
    return {
      success: false,
      error: "REQUEST_ERROR",
      errorMsg: error.message
    };
  }
}

/**
 * 查询绑定状态
 * @param {string} uid - 绑定令牌
 * @param {string} jwtToken - JWT认证令牌
 */
async function checkBindStatus(uid, jwtToken) {
  const headers = {
    "Authorization": `Bearer ${jwtToken}`,
    "Content-Type": "application/json"
  };
  
  try {
    const response = await axios.get(
      `${API_BASE_URL}/auth/mobile_bind/status/?uid=${uid}`,
      { headers, timeout: 10000 }
    );
    
    const result = response.data;
    if (result.status_code === 1 && result.data) {
      return {
        success: true,
        isBound: result.data.is_bound || false,
        mobile: result.data.mobile,
        bindStatus: result.data.bind_status || "unknown",
        raw: result.data
      };
    }
    
    return {
      success: false,
      error: result.err_code || "UNKNOWN_ERROR",
      errorMsg: result.err_msg || "查询绑定状态失败"
    };
  } catch (error) {
    if (error.response) {
      return {
        success: false,
        error: `HTTP_${error.response.status}`,
        errorMsg: `请求失败: ${error.response.status} ${error.response.statusText}`
      };
    }
    return {
      success: false,
      error: "REQUEST_ERROR",
      errorMsg: error.message
    };
  }
}

/**
 * 轮询等待绑定完成
 * @param {string} uid - 绑定令牌
 * @param {string} jwtToken - JWT认证令牌
 * @param {number} maxWaitTime - 最大等待时间（秒），默认 600 秒
 */
async function waitForBinding(uid, jwtToken, maxWaitTime = 600) {
  const pollInterval = 3000; // 每 3 秒检查一次
  const startTime = Date.now();
  let attempt = 0;
  
  console.log(`\n[4/4] 正在等待绑定完成（最长等待 ${maxWaitTime} 秒）...`);
  console.log("=".repeat(50));
  
  while (true) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    
    if (elapsed > maxWaitTime) {
      console.log("\n⚠️ 等待超时，绑定尚未完成");
      console.log("   您可以稍后重新运行此工具检查绑定状态");
      return { success: false, error: "TIMEOUT", errorMsg: "绑定等待超时" };
    }
    
    attempt++;
    const statusResult = await checkBindStatus(uid, jwtToken);
    
    if (!statusResult.success) {
      console.log(`  [${elapsed}s] 查询失败: ${statusResult.errorMsg}，3秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      continue;
    }
    
    if (statusResult.isBound) {
      console.log("\n✅ 绑定成功！");
      console.log(`   手机号: ${statusResult.mobile || '已隐藏'}`);
      console.log("=".repeat(50));
      return { success: true, mobile: statusResult.mobile };
    }
    
    // 显示进度
    const remaining = maxWaitTime - elapsed;
    if (attempt % 5 === 0) { // 每 15 秒显示一次
      console.log(`  [${elapsed}s] 等待中... (剩余 ${remaining} 秒)`);
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
}

async function persistBindUrlForManualOpen(bindUrl, tokenDir) {
  const dir =
    tokenDir != null && String(tokenDir).trim() !== ""
      ? path.resolve(String(tokenDir).trim())
      : getDefaultTokenDir();
  const file = await writeUrlForManualOpen(
    bindUrl,
    dir,
    "last_wenjuan_bind_url.txt"
  );
  console.log(`\n✓ 完整绑定链接已写入文件（Agent/远程终端请勿只复制折行半段）：\n   ${file}`);
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  let shouldOpenBrowser = true;
  let shouldWaitForBinding = true;
  let outputJson = false;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--no-open') {
      shouldOpenBrowser = false;
    } else if (arg === '--no-wait') {
      shouldWaitForBinding = false;
    } else if (arg === '--json') {
      outputJson = true;
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  }
  
  // 获取 token
  const token = await getToken();
  if (!token) {
    console.error("❌ 错误: 未找到登录凭证");
    console.error("   请先运行 login_auto.js 完成登录");
    process.exit(1);
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("问卷网手机号绑定工具");
  console.log("=".repeat(50));
  
  // 1. 获取 uid
  console.log("\n[1/3] 正在获取绑定令牌...");
  const uidResult = await getUidFromJwt(token);
  
  if (!uidResult.success) {
    console.error(`\n❌ 获取绑定令牌失败: ${uidResult.errorMsg}`);
    process.exit(1);
  }
  
  const uid = uidResult.uid;
  const expireSeconds = uidResult.expireSeconds;
  console.log(`✓ 获取成功，有效期 ${expireSeconds} 秒`);
  console.log(`  uid: ${uid}`);
  
  // 2. 构造绑定页面 URL
  const bindUrl = `${API_BASE_URL}/auth/mobile_bind/?uid=${uid}`;
  console.log(`\n[2/3] 绑定页面地址:`);
  console.log(`  ${bindUrl}`);
  
  if (!outputJson) {
    await persistBindUrlForManualOpen(bindUrl);
    console.log(
      "  [提示] 若未自动弹出浏览器（Workerbuddy/OpenClaw 等），请在本机打开上述文件中的完整链接"
    );
  }
  
  if (outputJson) {
    console.log(JSON.stringify({
      success: true,
      uid: uid,
      bind_url: bindUrl,
      expire_seconds: expireSeconds
    }, null, 2));
    return;
  }
  
  // 3. 打开浏览器（与微信扫码登录共用：npm open → rundll32/open/xdg-open）
  if (shouldOpenBrowser) {
    console.log("\n[3/3] 正在打开浏览器...");
    const opened = await openUrlBestEffort(bindUrl);
    if (opened) {
      console.log("✓ 已尝试在系统默认浏览器中打开绑定页面");
    } else {
      console.log("✗ 无法自动打开浏览器（常见于无图形界面的 Agent 环境）");
      console.log("\n请在本机浏览器中打开以下完整链接，或打开已写入的 last_wenjuan_bind_url.txt：");
      console.log(`\n${bindUrl}\n`);
    }
  } else {
    console.log("\n[3/3] 跳过浏览器打开（--no-open）");
    console.log("\n请在本机浏览器打开 last_wenjuan_bind_url.txt 内链接，或复制：");
    console.log(`\n${bindUrl}\n`);
  }
  
  console.log("=".repeat(50));
  console.log("请在浏览器中完成以下步骤：");
  console.log("1. 输入您的手机号");
  console.log("2. 点击发送验证码");
  console.log("3. 输入收到的验证码");
  console.log("4. 点击绑定按钮");
  console.log("=".repeat(50));
  
  // 4. 自动轮询等待绑定完成（如果启用）
  if (shouldWaitForBinding) {
    const bindResult = await waitForBinding(uid, token, uidResult.expireSeconds);
    
    if (bindResult.success) {
      console.log("\n🎉 手机号绑定完成！");
      console.log("   现在可以使用发布功能了。");
      process.exit(0);
    } else {
      console.log("\n⚠️ 绑定未完成或已超时");
      console.log("   请重新运行此工具完成绑定。");
      process.exit(1);
    }
  } else {
    console.log("\n⏸️ 跳过等待绑定完成");
    console.log("   请在浏览器中完成绑定后，即可使用发布功能。");
    process.exit(0);
  }
}

function showHelp() {
  console.log(`
问卷网手机号绑定工具

用法:
  node bind_mobile.js [选项]

选项:
  --no-open       不自动打开浏览器，只输出绑定链接
  --no-wait       不自动等待绑定完成（需手动检查）
  --json          以 JSON 格式输出结果
  -h, --help      显示帮助信息

示例:
  # 自动打开浏览器并等待绑定完成
  node bind_mobile.js
  
  # 只获取绑定链接，不打开浏览器
  node bind_mobile.js --no-open
  
  # 打开浏览器但不等待绑定完成
  node bind_mobile.js --no-wait
  
  # 输出 JSON 格式结果
  node bind_mobile.js --json

流程:
  1. 使用 JWT token 换取临时 uid
  2. 打开浏览器访问绑定页面
  3. 用户在浏览器中输入手机号和验证码完成绑定
  4. 自动轮询检查绑定状态，绑定成功后自动退出
`);
}

// 导出模块
module.exports = {
  getUidFromJwt,
  checkBindStatus,
  waitForBinding,
  getToken,
};

// 如果是直接运行
if (require.main === module) {
  main();
}
