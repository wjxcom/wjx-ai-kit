#!/usr/bin/env node
/**
 * 问卷网项目列表获取工具
 * 支持模糊搜索、分页获取、交互式浏览
 */

const axios = require('axios');
const readline = require('readline');

// API 地址
const BASE_URL = "https://www.wenjuan.com/app_api/skills/v1/projects/simple";

/**
 * 获取项目列表
 * @param {string} jwtToken - JWT认证令牌
 * @param {string} keyword - 标题模糊搜索关键词
 * @param {number} page - 页码，默认1
 * @param {number} pageSize - 每页条数，默认10
 * @returns {Promise<Object>} 项目列表数据
 */
async function getProjects(jwtToken, keyword = "", page = 1, pageSize = 10) {
  const headers = {
    "Authorization": `Bearer ${jwtToken}`,
    "Content-Type": "application/json"
  };
  
  // 手动构建 URL，确保 jwt=1 放在最前面
  let url = `${BASE_URL}?jwt=1&page=${page}&page_size=${pageSize}`;
  if (keyword) {
    url += `&keyword=${encodeURIComponent(keyword)}`;
  }
  
  try {
    const response = await axios.get(url, { headers, timeout: 30000 });
    return response.data;
  } catch (error) {
    if (error.response) {
      return { error: `请求失败: ${error.response.status} ${error.response.statusText}` };
    }
    return { error: `请求失败: ${error.message}` };
  }
}

/**
 * 展示项目列表
 * @param {Array} projects - 项目数组
 * @param {number} page - 当前页码
 * @param {number} total - 总数
 * @param {number} totalPages - 总页数
 */
function displayProjects(projects, page, total, totalPages) {
  console.log(`\n📋 项目列表 (第 ${page}/${totalPages} 页，共 ${total} 条)\n`);
  console.log("=".repeat(60));
  
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const title = p.title || "无标题";
    const projId = p.project_id || "";
    const shortId = p.short_id || "";
    const status = p.status || "未知";
    const createTime = p.create_time || "";
    
    // 根据状态显示图标
    let statusIcon = "⚪";
    if (status === "未发布") statusIcon = "⏸️";
    else if (status === "收集中") statusIcon = "🟢";
    
    console.log(`\n[${i + 1}] ${statusIcon} ${title}`);
    console.log(`    Project ID: ${projId}`);
    if (shortId) {
      console.log(`    答题链接: https://www.wenjuan.com/s/${shortId}`);
    }
    console.log(`    状态: ${status}`);
    if (createTime) {
      console.log(`    创建时间: ${createTime}`);
    }
  }
  
  console.log("\n" + "=".repeat(60));
}

/**
 * 交互式浏览项目列表
 * @param {string} jwtToken - JWT认证令牌
 * @param {string} keyword - 搜索关键词
 * @param {number} pageSize - 每页条数
 */
async function interactiveList(jwtToken, keyword = "", pageSize = 10) {
  let currentPage = 1;
  
  while (true) {
    // 获取当前页数据
    const result = await getProjects(jwtToken, keyword, currentPage, pageSize);
    
    if (result.error) {
      console.log(`❌ ${result.error}`);
      return;
    }
    
    if (result.status_code !== 1) {
      const errMsg = result.err_msg || result.message || '未知错误';
      console.log(`❌ 获取失败: ${errMsg}`);
      return;
    }
    
    const data = result.data || {};
    const projects = data.list || [];
    const total = data.total || 0;
    const totalPages = data.total_pages || 1;
    
    if (projects.length === 0) {
      console.log("📭 暂无项目");
      return;
    }
    
    // 完整展示当前页
    displayProjects(projects, currentPage, total, totalPages);
    
    // 判断是否还有下一页
    if (currentPage >= totalPages) {
      console.log(`\n✅ 已展示所有 ${total} 条项目`);
      break;
    }
    
    // 询问是否展示下一页
    const remaining = total - currentPage * pageSize;
    console.log(`\n💡 还有 ${remaining} 条项目`);
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    try {
      const answer = await new Promise((resolve) => {
        rl.question(`\n是否查看下一页? (第 ${currentPage + 1}/${totalPages} 页) [y/n]: `, resolve);
      });
      
      const userInput = answer.trim().toLowerCase();
      
      if (userInput === 'y' || userInput === 'yes' || userInput === '是' || userInput === '1' || userInput === 'ok') {
        currentPage++;
        console.log(`\n正在加载第 ${currentPage} 页...\n`);
      } else {
        console.log(`\n已退出，共浏览 ${currentPage * projects.length} 条项目`);
        break;
      }
    } catch (error) {
      console.log("\n\n已退出");
      break;
    } finally {
      rl.close();
    }
  }
}

/**
 * 单次获取指定页（非交互式）
 * @param {string} jwtToken - JWT认证令牌
 * @param {string} keyword - 搜索关键词
 * @param {number} page - 页码
 * @param {number} pageSize - 每页条数
 */
async function singlePageList(jwtToken, keyword = "", page = 1, pageSize = 10) {
  const result = await getProjects(jwtToken, keyword, page, pageSize);
  
  if (result.error) {
    console.log(`❌ ${result.error}`);
    return;
  }
  
  if (result.status_code !== 1) {
    const errMsg = result.err_msg || result.message || '未知错误';
    console.log(`❌ 获取失败: ${errMsg}`);
    return;
  }
  
  const data = result.data || {};
  const projects = data.list || [];
  const total = data.total || 0;
  const totalPages = data.total_pages || 1;
  const currentPage = data.page || page;
  
  if (projects.length === 0) {
    console.log("📭 暂无项目");
    return;
  }
  
  displayProjects(projects, currentPage, total, totalPages);
  
  // 提示下一页
  if (currentPage < totalPages) {
    const remaining = total - currentPage * pageSize;
    console.log(`\n💡 还有 ${remaining} 条项目`);
    console.log(`   使用 --page ${currentPage + 1} 获取下一页`);
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  // 解析参数
  let token = null;
  let keyword = "";
  let page = 1;
  let pageSize = 10;
  let interactive = false;
  let outputJson = false;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if ((arg === "-t" || arg === "--token") && i + 1 < args.length) {
      token = args[++i];
    } else if ((arg === "-k" || arg === "--keyword") && i + 1 < args.length) {
      keyword = args[++i];
    } else if ((arg === "-p" || arg === "--page") && i + 1 < args.length) {
      page = parseInt(args[++i], 10);
    } else if ((arg === "-n" || arg === "--page-size") && i + 1 < args.length) {
      pageSize = parseInt(args[++i], 10);
    } else if (arg === "-i" || arg === "--interactive") {
      interactive = true;
    } else if (arg === "--json") {
      outputJson = true;
    } else if (arg === "-h" || arg === "--help") {
      showHelp();
      process.exit(0);
    }
  }
  
  if (!token) {
    console.error("错误: 必须提供 JWT Token (-t)");
    process.exit(1);
  }
  
  try {
    if (outputJson) {
      // 输出JSON
      const result = await getProjects(token, keyword, page, pageSize);
      console.log(JSON.stringify(result, null, 2));
    } else if (interactive) {
      // 交互式浏览
      await interactiveList(token, keyword, pageSize);
    } else {
      // 单次获取
      await singlePageList(token, keyword, page, pageSize);
    }
  } catch (error) {
    console.error(`❌ 错误: ${error.message}`);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
问卷网项目列表获取工具

用法: node list_projects.js -t <token> [选项]

选项:
  -t, --token <token>     JWT Token（必填）
  -k, --keyword <word>    标题模糊搜索关键词
  -p, --page <num>        页码，默认1
  -n, --page-size <num>   每页条数，默认10
  -i, --interactive       交互式浏览，展示完10条后询问是否下一页
  --json                  输出原始JSON响应
  -h, --help              显示帮助信息

示例:
  # 交互式浏览（推荐）
  node list_projects.js -t "your_jwt_token" -i
  
  # 获取指定页
  node list_projects.js -t "your_jwt_token" -p 2
  
  # 搜索项目
  node list_projects.js -t "your_jwt_token" -k "大学生" -i
  
  # 每页20条
  node list_projects.js -t "your_jwt_token" -n 20 -i
`);
}

// 导出模块
module.exports = {
  getProjects,
  displayProjects,
  interactiveList,
  singlePageList
};

// 如果是直接运行
if (require.main === module) {
  main();
}
