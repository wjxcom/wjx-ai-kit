#!/usr/bin/env node
/**
 * 问卷网微信自动登录脚本
 * - 自动获取二维码
 * - 始终尝试自动打开系统默认浏览器；失败时再提示手动复制链接（链接文件在获取二维码后即写入）
 * - 循环轮询获取 token
 * - 自动保存凭证
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { openUrlBestEffort, writeUrlForManualOpen } = require("./open_url_cjs");
const readline = require('readline');
const { getDefaultTokenDir } = require('./token_store');

// API 地址
// 注意：必须使用 www.wenjuan.com 域名
const QRCODE_URL = "https://www.wenjuan.com/login/qrcode";
const TOKEN_URL = "https://www.wenjuan.com/login/token";

// 默认配置（目录逻辑见 token_store.js / getDefaultTokenDir）
const POLL_INTERVAL = 3000; // 轮询间隔（毫秒）
/** 未传 --max-time 时，与 CLI 默认 300 秒一致（毫秒） */
const DEFAULT_MAX_POLL_MS = 300 * 1000;

/**
 * 问卷网登录管理器
 */
class WenjuanLogin {
  constructor(tokenDir = null, options = {}) {
    this.tokenDir =
      tokenDir != null && String(tokenDir).trim() !== ""
        ? path.resolve(String(tokenDir).trim())
        : getDefaultTokenDir();
    this.deviceCode = null;
    this.qrcodeUrl = null;
    this.session = axios.create();
    this.maxPollTime =
      options.maxPollTime != null ? options.maxPollTime : DEFAULT_MAX_POLL_MS;
  }

  /**
   * 获取登录二维码
   */
  async getQrcode() {
    console.log("[1/4] 正在获取登录二维码...");
    console.log(`  [请求] POST ${QRCODE_URL}`);
    
    try {
      const response = await this.session.post(QRCODE_URL, {}, { timeout: 30000 });
      const data = response.data;
      
      console.log(`  [响应] ${JSON.stringify(data, null, 2)}`);
      
      if (data.status_code !== 1 && data.code !== 0) {
        const errorMsg = data.message || data.error || '未知错误';
        console.error(`✗ 获取二维码失败: ${errorMsg}`);
        return false;
      }
      
      const result = data.data || {};
      this.deviceCode = result.device_code;
      this.qrcodeUrl = result.qrcode_url;
      
      if (!this.deviceCode || !this.qrcodeUrl) {
        console.error("✗ 响应中缺少必要字段");
        return false;
      }
      
      // 保存 device_code
      await fs.mkdir(this.tokenDir, { recursive: true });
      const deviceCodeFile = path.join(this.tokenDir, "device_code");
      await fs.writeFile(deviceCodeFile, this.deviceCode, 'utf-8');
      
      console.log(`✓ 设备码已保存: ${deviceCodeFile}`);
      console.log(`  device_code: ${this.deviceCode}`);
      
      try {
        await writeUrlForManualOpen(
          this.qrcodeUrl,
          this.tokenDir,
          "last_wenjuan_login_url.txt"
        );
        const loginFile = path.join(this.tokenDir, "last_wenjuan_login_url.txt");
        console.log(
          `  [提示] 完整扫码链接已写入: ${loginFile}（Workerbuddy/OpenClaw/SSH 等若未弹出浏览器，请在本机打开该文件内整行链接）`
        );
      } catch (e) {
        console.log(`  [提示] 写入扫码链接文件失败: ${e.message}，将依赖下方打印或自动打开浏览器`);
      }

      console.log("  [提示] 下一步将尝试用系统默认浏览器打开扫码页（失败时会打印链接，亦可用上方文件）");
      return true;
      
    } catch (error) {
      console.error(`✗ 请求失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 使用默认浏览器打开登录链接；失败则打印完整 URL（链接文件已在获取二维码后写入）
   */
  async openBrowser() {
    console.log("[2/4] 正在自动打开浏览器（若失败将改为下方手动链接方式，不影响后续扫码与轮询）...");
    
    let browserOpened = false;
    
    try {
      browserOpened = await openUrlBestEffort(this.qrcodeUrl);
      if (browserOpened) {
        console.log("✓ 已在浏览器中打开二维码页面");
      } else {
        console.log("✗ 自动打开失败（open 包与系统命令均不可用或失败）");
      }
    } catch (error) {
      console.log(`✗ 打开浏览器异常: ${error.message}`);
    }
    
    // 如果浏览器自动打开失败，提示用户手动操作
    if (!browserOpened) {
      console.log("\n" + "=".repeat(50));
      console.log("❌ 浏览器自动打开失败");
      console.log("=".repeat(50));
      console.log("\n请手动复制以下链接到浏览器地址栏打开（须完整一行，查询参数不可缺）：");
      console.log(`\n${this.qrcodeUrl}\n`);
      console.log("=".repeat(50));
      console.log(
        `（同一链接已保存在: ${path.join(this.tokenDir, "last_wenjuan_login_url.txt")}）`
      );
    } else {
      console.log("\n" + "=".repeat(50));
      console.log("📱 请使用微信扫描二维码");
      console.log("=".repeat(50));
    }
    
    return true; // 继续执行，不管浏览器是否成功打开
  }

  /**
   * 从 /login/token 响应中取出 access_token（兼容多种字段位置）
   */
  _extractAccessToken(data) {
    if (!data || typeof data !== "object") return null;
    const d = data.data;
    if (d && typeof d === "object" && d.access_token) return d.access_token;
    if (data.access_token) return data.access_token;
    return null;
  }

  /**
   * 是否应停止轮询（二维码过期、设备码作废等）；其余情况继续等到超时
   */
  _isFatalTokenPollError(data) {
    if (!data || typeof data !== "object") return false;
    const text = `${data.message || ""} ${data.err_msg || ""} ${data.msg || ""} ${data.error || ""}`.toLowerCase();
    const fatalHints = [
      "二维码已过期",
      "二维码过期",
      "qrcode expired",
      "设备码无效",
      "device_code",
      "device code invalid",
      "授权已拒绝",
      "access_denied",
    ];
    return fatalHints.some((h) => text.includes(h.toLowerCase()));
  }

  /**
   * 轮询获取 token（自动打开失败或手动复制链接后扫码，均依赖同一 device_code 轮询，逻辑相同）
   */
  async pollToken() {
    console.log("[3/4] 等待扫码登录...");
    console.log("=".repeat(50));
    console.log("请使用微信扫描二维码登录");
    console.log("=".repeat(50));
    console.log(
      "说明：若上一步是手动复制链接到浏览器，扫码成功后**无需再开终端**；请保持本窗口运行直至出现「登录成功」。"
    );

    const startTime = Date.now();
    let attempt = 0;
    const verboseUntil = 3; // 前几次打印完整 JSON，便于排错

    while (true) {
      const elapsed = Date.now() - startTime;
      if (elapsed > this.maxPollTime) {
        console.log(`\n✗ 登录超时（超过${this.maxPollTime / 1000}秒），请重新运行脚本`);
        return null;
      }

      attempt++;
      try {
        const sec = Math.floor(elapsed / 1000);
        const maxSec = Math.floor(this.maxPollTime / 1000);
        console.log(`\n  [请求 #${attempt}] POST ${TOKEN_URL}  (${sec}s / ${maxSec}s)`);
        console.log(`  [参数] device_code=${this.deviceCode}`);

        const response = await this.session.post(
          TOKEN_URL,
          { device_code: this.deviceCode },
          {
            timeout: 30000,
            headers: { "Content-Type": "application/json" },
          }
        );

        const data = response.data;

        if (attempt <= verboseUntil) {
          console.log(`  [响应] ${JSON.stringify(data, null, 2)}`);
        } else if (attempt % 5 === 0) {
          const code = data.status_code ?? data.code;
          console.log(`  [响应摘要] code=${JSON.stringify(code)} has_token=${Boolean(this._extractAccessToken(data))}`);
        }

        const accessToken = this._extractAccessToken(data);

        if (accessToken) {
          console.log(`\n✓ 登录成功！（耗时 ${Math.floor(elapsed / 1000)} 秒）`);
          return {
            access_token: accessToken,
            refresh_token: (data.data && data.data.refresh_token) || null,
            device_code: this.deviceCode,
            login_time: new Date().toISOString(),
          };
        }

        if (this._isFatalTokenPollError(data)) {
          const errorMsg =
            data.message || data.err_msg || data.error || "登录流程已无法继续";
          console.log(`\n✗ 获取 token 终止: ${errorMsg}`);
          return null;
        }

        // 未拿到 token 且非明确致命错误：继续轮询（兼容接口返回多种等待态 code，避免手动扫码后因未知 code 提前退出）
        console.log(
          `  等待扫码中… (${sec}s / ${maxSec}s) 请在浏览器打开的页面用微信扫码并确认登录`
        );
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      } catch (error) {
        console.log(`\n! 请求出错: ${error.message}，3秒后重试...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  /**
   * 保存 token 到本地
   * @param {Object} tokenData
   */
  async saveToken(tokenData) {
    console.log("[4/4] 正在保存登录凭证...");
    
    try {
      // 1. 保存到用户目录（默认位置）
      await fs.mkdir(this.tokenDir, { recursive: true });
      
      const tokenFile = path.join(this.tokenDir, "token.json");
      await fs.writeFile(tokenFile, JSON.stringify(tokenData, null, 2), 'utf-8');
      
      const accessTokenFile = path.join(this.tokenDir, "access_token");
      await fs.writeFile(accessTokenFile, tokenData.access_token, 'utf-8');
      
      if (tokenData.refresh_token) {
        const refreshTokenFile = path.join(this.tokenDir, "refresh_token");
        await fs.writeFile(refreshTokenFile, tokenData.refresh_token, 'utf-8');
      }
      
      console.log(`✓ 凭证已保存到: ${this.tokenDir}`);
      
      // 2. 保存到项目目录（skill 使用）
      const scriptDir = __dirname;
      const projectTokenDir = path.join(scriptDir, '..', '.wenjuan');
      await fs.mkdir(projectTokenDir, { recursive: true });
      
      const projectAuthFile = path.join(projectTokenDir, "auth.json");
      const authData = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        device_code: this.deviceCode,
        login_time: new Date().toISOString()
      };
      await fs.writeFile(projectAuthFile, JSON.stringify(authData, null, 2), 'utf-8');
      
      console.log(`✓ 凭证已保存到项目目录: ${projectAuthFile}`);
      console.log(`  - access_token: 访问令牌`);
      console.log(`  - refresh_token: 刷新令牌`);
      
      return true;
      
    } catch (error) {
      console.error(`✗ 保存凭证失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 执行完整登录流程：始终尝试自动打开浏览器；打开失败时凭已写入的链接与终端输出手动打开
   */
  async login() {
    console.log("=".repeat(50));
    console.log("问卷网微信扫码登录");
    console.log("=".repeat(50));
    console.log();
    
    // 1. 获取二维码
    if (!(await this.getQrcode())) {
      return false;
    }
    
    console.log();
    
    // 2. 打开浏览器（始终尝试）
    await this.openBrowser();
    
    console.log();
    
    // 3. 轮询获取 token
    const tokenData = await this.pollToken();
    if (!tokenData) {
      return false;
    }
    
    console.log();
    
    // 4. 保存 token
    if (!(await this.saveToken(tokenData))) {
      return false;
    }
    
    console.log();
    console.log("=".repeat(50));
    console.log("✓ 登录流程完成！");
    console.log("=".repeat(50));
    console.log(`\nAccess Token: ${tokenData.access_token.slice(0, 30)}...`);
    if (tokenData.refresh_token) {
      console.log(`Refresh Token: ${tokenData.refresh_token.slice(0, 30)}...`);
    }
    
    return true;
  }

  /**
   * 检查当前登录状态
   */
  async checkLoginStatus() {
    const tokenFile = path.join(this.tokenDir, "token.json");
    
    try {
      const content = await fs.readFile(tokenFile, 'utf-8');
      const tokenData = JSON.parse(content);
      
      // 检查 token 是否过期（简化检查，实际应该调用 API 验证）
      const loginTime = tokenData.login_time;
      if (loginTime) {
        const loginDt = new Date(loginTime);
        const elapsed = (Date.now() - loginDt.getTime()) / 1000;
        // 假设 token 有效期为 7 天
        if (elapsed > 7 * 24 * 3600) {
          return { valid: false, reason: "token 可能已过期", data: tokenData };
        }
      }
      
      return { valid: true, data: tokenData };
      
    } catch (error) {
      return null;
    }
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  let tokenDir = null;
  let checkOnly = false;
  let maxTime = 300;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if ((arg === "--token-dir" || arg === "-t") && i + 1 < args.length) {
      tokenDir = args[++i];
    } else if (arg === "--check" || arg === "-c") {
      checkOnly = true;
    } else if ((arg === "--max-time" || arg === "-m") && i + 1 < args.length) {
      maxTime = parseInt(args[++i], 10);
    } else if (arg === "-h" || arg === "--help") {
      showHelp();
      process.exit(0);
    }
  }

  const loginManager = new WenjuanLogin(tokenDir, {
    maxPollTime: maxTime * 1000,
  });
  
  if (checkOnly) {
    // 检查登录状态
    const status = await loginManager.checkLoginStatus();
    if (status) {
      if (status.valid) {
        console.log("✓ 已登录");
        console.log(`  Access Token: ${status.data.access_token.slice(0, 30)}...`);
        console.log(`  登录时间: ${status.data.login_time || '未知'}`);
      } else {
        console.log(`! ${status.reason}`);
        console.log("  请重新运行脚本登录");
      }
    } else {
      console.log("✗ 未登录");
    }
    return;
  }
  
  // 执行登录
  await loginManager.login();
}

function showHelp() {
  console.log(`
问卷网微信自动登录

用法: node login_auto.js [选项]

选项:
  -t, --token-dir <dir>  凭证存储目录
  -c, --check            检查登录状态
  -m, --max-time <sec>   最大等待时间（秒）
  -h, --help             显示帮助信息

说明:
  会始终尝试自动打开系统默认浏览器；若 open/系统命令失败，会自动打印链接并写入
  <token-dir>/last_wenjuan_login_url.txt，扫码与轮询不受影响。
  链接较长，半选复制易丢参数，请用该文件或整行复制。
`);
}

// 导出模块
module.exports = {
  WenjuanLogin,
  QRCODE_URL,
  TOKEN_URL
};

// 如果是直接运行
if (require.main === module) {
  main();
}
