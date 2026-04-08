#!/usr/bin/env node
/**
 * 问卷网 Skill 环境检查脚本
 * 仅检测 Node.js 版本与本地 npm 依赖；不检查问卷网登录、Token 或任何授权状态。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 最低 Node.js 版本要求
const MIN_NODE_VERSION = 18;

// 必需的依赖包
const REQUIRED_PACKAGES = [
  ["axios", "1.6.0"],
  ["open", "10.0.0"]
];

/**
 * 检查 Node.js 版本
 * @returns {boolean}
 */
function checkNodeVersion() {
  console.log("=".repeat(60));
  console.log("🔍 检查 Node.js 版本");
  console.log("=".repeat(60));
  
  const currentVersion = process.version;
  const majorVersion = parseInt(currentVersion.slice(1).split('.')[0], 10);
  
  console.log(`当前 Node.js 版本: ${currentVersion}`);
  console.log(`最低要求版本: ${MIN_NODE_VERSION}.0.0+`);
  
  if (majorVersion >= MIN_NODE_VERSION) {
    console.log(`✅ Node.js 版本符合要求\n`);
    return true;
  } else {
    console.log(`❌ Node.js 版本过低，请升级到 ${MIN_NODE_VERSION} 或更高版本\n`);
    return false;
  }
}

/**
 * 检查单个包是否已安装
 * @param {string} packageName
 * @param {string} minVersion
 * @returns {boolean}
 */
function checkPackage(packageName, minVersion) {
  try {
    // 尝试获取包信息
    const nodeModulesPath = path.join(__dirname, '..', 'node_modules', packageName, 'package.json');
    
    if (!fs.existsSync(nodeModulesPath)) {
      if (minVersion) {
        console.log(`  ❌ ${packageName.padEnd(15)} 未安装 (需要 >= ${minVersion})`);
      } else {
        console.log(`  ❌ ${packageName.padEnd(15)} 未安装`);
      }
      return false;
    }
    
    const pkg = JSON.parse(fs.readFileSync(nodeModulesPath, 'utf-8'));
    const version = pkg.version || "未知";
    
    if (minVersion) {
      // 简单版本比较
      function parseVersion(v) {
        return v.split('.').slice(0, 3).map(x => parseInt(x, 10) || 0);
      }
      
      try {
        const current = parseVersion(version);
        const required = parseVersion(minVersion);
        
        let isOk = true;
        for (let i = 0; i < Math.max(current.length, required.length); i++) {
          const c = current[i] || 0;
          const r = required[i] || 0;
          if (c > r) break;
          if (c < r) {
            isOk = false;
            break;
          }
        }
        
        if (isOk) {
          console.log(`  ✅ ${packageName.padEnd(15)} ${version.padEnd(10)} (>= ${minVersion})`);
          return true;
        } else {
          console.log(`  ❌ ${packageName.padEnd(15)} ${version.padEnd(10)} (需要 >= ${minVersion})`);
          return false;
        }
      } catch (e) {
        console.log(`  ✅ ${packageName.padEnd(15)} ${version.padEnd(10)}`);
        return true;
      }
    } else {
      console.log(`  ✅ ${packageName.padEnd(15)} ${version.padEnd(10)}`);
      return true;
    }
  } catch (error) {
    if (minVersion) {
      console.log(`  ❌ ${packageName.padEnd(15)} 未安装 (需要 >= ${minVersion})`);
    } else {
      console.log(`  ❌ ${packageName.padEnd(15)} 未安装`);
    }
    return false;
  }
}

/**
 * 检查依赖包
 * @returns {boolean}
 */
function checkDependencies() {
  console.log("=".repeat(60));
  console.log("🔍 检查依赖包");
  console.log("=".repeat(60));
  
  let allOk = true;
  for (const [packageName, minVer] of REQUIRED_PACKAGES) {
    if (!checkPackage(packageName, minVer)) {
      allOk = false;
    }
  }
  
  console.log();
  return allOk;
}

/**
 * 打印安装指南
 */
function printInstallGuide() {
  console.log("=".repeat(60));
  console.log("📦 安装指南");
  console.log("=".repeat(60));
  console.log();
  console.log("【安装 Node.js】");
  console.log();
  console.log("macOS:");
  console.log("  brew install node");
  console.log();
  console.log("Ubuntu/Debian:");
  console.log("  sudo apt update");
  console.log("  sudo apt install -y nodejs npm");
  console.log();
  console.log("CentOS/RHEL/Fedora:");
  console.log("  sudo dnf install -y nodejs npm");
  console.log("  # 或 CentOS 7: sudo yum install -y nodejs npm");
  console.log();
  console.log("Windows:");
  console.log("  # 使用 winget");
  console.log("  winget install OpenJS.NodeJS");
  console.log("  # 或访问 https://nodejs.org 下载安装");
  console.log();
  console.log("【安装依赖包】");
  console.log();
  console.log("  npm install");
  console.log();
}

/**
 * 主函数
 */
function main() {
  console.log("\n");
  console.log("=".repeat(60));
  console.log("🚀 问卷网 Skill 环境检查");
  console.log("=".repeat(60));
  console.log("（仅 Node.js 与依赖包；不检查登录/授权）");
  console.log();
  
  // 检查 Node.js 版本
  const nodeOk = checkNodeVersion();
  
  // 检查依赖包
  const depsOk = checkDependencies();
  
  // 输出结果
  console.log("=".repeat(60));
  if (nodeOk && depsOk) {
    console.log("✅ 环境检查通过（运行环境就绪；使用 API 前请自行完成登录）。");
    console.log("=".repeat(60));
    console.log();
    return 0;
  } else {
    console.log("❌ 环境检查未通过");
    console.log("=".repeat(60));
    console.log();
    printInstallGuide();
    return 1;
  }
}

// 导出模块
module.exports = {
  checkNodeVersion,
  checkDependencies,
  MIN_NODE_VERSION
};

// 如果是直接运行
if (require.main === module) {
  const exitCode = main();
  process.exit(exitCode);
}
