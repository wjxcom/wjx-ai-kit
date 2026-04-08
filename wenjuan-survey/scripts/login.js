#!/usr/bin/env node
/**
 * 问卷网登录脚本（简化版）
 * - 获取二维码
 * - 打开浏览器
 * - 轮询获取 token
 * - 保存凭证
 */

const { WenjuanLogin } = require('./login_auto');

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  let tokenDir = null;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if ((arg === "--token-dir" || arg === "-t") && i + 1 < args.length) {
      tokenDir = args[++i];
    } else if (arg === "-h" || arg === "--help") {
      showHelp();
      process.exit(0);
    }
  }
  
  const loginManager = new WenjuanLogin(tokenDir);
  const success = await loginManager.login();
  
  if (!success) {
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
问卷网登录脚本

用法: node login.js [选项]

选项:
  -t, --token-dir <dir>   凭证存储目录
  -h, --help              显示帮助信息

示例:
  # 执行登录
  node login.js
  
  # 指定凭证目录
  node login.js -t /path/to/token/dir
`);
}

// 如果是直接运行
if (require.main === module) {
  main();
}
