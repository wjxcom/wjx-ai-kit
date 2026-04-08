#!/usr/bin/env node
/**
 * get_report：查看报表 = 打开问卷网 /report/topic/{project_id}
 * 完整 URL：https://www.wenjuan.com/report/topic/{project_id}
 * 默认自动用系统浏览器打开该地址；传 --no-open 则只打印链接。
 */

const readline = require("readline");
const { resolveAccessToken } = require("./token_store");
const { openUrlBestEffort } = require("./open_url_cjs");
const { getProjects } = require("./list_projects");

/** 问卷网「查看报表」页基址，路径为 /report/topic/{project_id} */
const REPORT_HREF_PREFIX = "https://www.wenjuan.com/report/topic/";

function reportTopicUrl(projectId) {
  return `${REPORT_HREF_PREFIX}${projectId}`;
}

/** 从本地文件读取 JWT（逻辑见 token_store.js） */
async function getToken() {
  const t = await resolveAccessToken();
  return t || "";
}

/**
 * 在默认浏览器中打开 URL（与 login_auto / bind_mobile 共用 open_url_cjs）
 */
async function openInBrowser(url) {
  const ok = await openUrlBestEffort(url);
  if (!ok) {
    console.log(`\n⚠️ 无法自动打开浏览器，请手动访问：\n${url}\n`);
  }
}

/**
 * 未指定 project_id 时：拉取「我的问卷」列表并选择
 * @param {string} token
 * @param {string} keyword
 * @param {number} pageSize
 * @param {number|null} index1 - 1-based；仅在本页多条且**非交互**（无 TTY）时生效
 */
async function resolveProjectIdFromList(token, keyword, pageSize, index1) {
  const result = await getProjects(token, keyword, 1, pageSize);

  if (result.error) {
    throw new Error(result.error);
  }
  if (Number(result.status_code) !== 1) {
    const errMsg = result.err_msg || result.message || "未知错误";
    throw new Error(`获取项目列表失败: ${errMsg}`);
  }

  const data = result.data || {};
  const projects = data.list || [];
  if (projects.length === 0) {
    throw new Error(keyword ? `没有匹配「${keyword}」的项目` : "项目列表为空");
  }

  // 仅一条匹配：直接使用，不再询问（多条时必须由用户选择，不在交互环境下偷用默认序号）
  if (projects.length === 1) {
    return projects[0].project_id || "";
  }

  const tty = process.stdin.isTTY;
  const envIndex = process.env.WENJUAN_PROJECT_INDEX;
  const pick =
    index1 != null
      ? index1
      : envIndex != null && String(envIndex).trim() !== ""
        ? parseInt(String(envIndex).trim(), 10)
        : null;

  if (tty) {
    if (pick != null && !Number.isNaN(pick)) {
      console.log(`\n📌 当前页共 ${projects.length} 条匹配，已忽略 --index / WENJUAN_PROJECT_INDEX，请从列表中选择。\n`);
    }
  } else {
    if (pick == null || Number.isNaN(pick)) {
      throw new Error(
        "未指定 -p 且无法交互选择时，请使用：--index <n>（1-based）或环境变量 WENJUAN_PROJECT_INDEX"
      );
    }
    if (pick < 1 || pick > projects.length) {
      throw new Error(`--index 须在 1～${projects.length} 之间`);
    }
    return projects[pick - 1].project_id || "";
  }

  console.log(`\n📋 我的问卷（共 ${projects.length} 条，第 1/${data.total_pages || 1} 页）\n`);
  console.log(`${"序号".padEnd(4)} ${"标题".padEnd(32)} ${"项目ID".padEnd(26)} ${"状态"}`);
  console.log("-".repeat(78));
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const title = (p.title || "无标题").substring(0, 30).padEnd(32);
    const pid = (p.project_id || "").substring(0, 24).padEnd(26);
    const st = p.status || "";
    console.log(`${String(i + 1).padEnd(4)} ${title} ${pid} ${st}`);
  }
  console.log();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const choice = await new Promise((resolve) => {
    rl.question(`请选择项目序号 (1-${projects.length}): `, resolve);
  });
  rl.close();

  const idx = parseInt(choice, 10) - 1;
  if (idx < 0 || idx >= projects.length) {
    throw new Error("无效的序号");
  }
  return projects[idx].project_id || "";
}

async function main() {
  const args = process.argv.slice(2);

  let projectId = null;
  let keyword = "";
  let pageSize = 20;
  let index1 = null;
  let openBrowser = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if ((arg === "-p" || arg === "--project-id") && i + 1 < args.length) {
      projectId = args[++i];
    } else if ((arg === "-k" || arg === "--keyword") && i + 1 < args.length) {
      keyword = args[++i];
    } else if ((arg === "-n" || arg === "--page-size") && i + 1 < args.length) {
      pageSize = parseInt(args[++i], 10) || 20;
    } else if (arg === "--index" && i + 1 < args.length) {
      index1 = parseInt(args[++i], 10);
    } else if (arg === "--open") {
      openBrowser = true;
    } else if (arg === "--no-open") {
      openBrowser = false;
    } else if (arg === "-h" || arg === "--help") {
      showHelp();
      process.exit(0);
    }
  }

  const token = await getToken();
  if (!token) {
    console.error("错误: 未找到登录凭证，请先运行 login_auto.js 登录");
    process.exit(1);
  }

  try {
    if (!projectId) {
      console.log("未指定项目ID，从「我的问卷」列表中选择…");
      projectId = await resolveProjectIdFromList(token, keyword, pageSize, index1);
      console.log(`\n已选择项目ID: ${projectId}`);
    }

    const topicUrl = reportTopicUrl(projectId);
    console.log(`\n📎 查看报表 (/report/topic/${projectId}):`);
    console.log(`   ${topicUrl}`);

    if (openBrowser) {
      console.log("正在用默认浏览器打开报表页…");
      await openInBrowser(topicUrl);
    }
  } catch (error) {
    console.error(`❌ 错误: ${error.message}`);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
open_report.js — get_report（查看报表）

「查看报表」即打开问卷网页面 /report/topic/<project_id>
  完整 URL：https://www.wenjuan.com/report/topic/<project_id>
默认会自动用系统浏览器打开；若只要链接请加 --no-open。
原始答卷请用 scripts/export_data.js（不是本脚本）。

用法:
  node open_report.js [选项]

选项:
  -p, --project-id <id>   项目ID（不填则从「我的问卷」列表选择）
  -k, --keyword <word>    列表筛选标题关键词（与列表 API 一致）
  -n, --page-size <n>     列表每页条数，默认 20
  --index <n>             仅非交互+本页多条时有效（1-based）；交互终端下多条时会列清单，本参数被忽略
  --open                  显式打开浏览器（与默认行为相同，可省略）
  --no-open               只打印链接，不打开浏览器
  -h, --help              帮助

环境变量:
  WENJUAN_PROJECT_INDEX   与 --index 相同（仅非交互+多条时生效；交互多条时忽略）

示例:
  node open_report.js -p "abc123"              # 默认会打开浏览器
  node open_report.js -k "大学生" --no-open   # 多条时在终端选序号，再仅打印链接
  node open_report.js -k "满意度"             # 多条则选序号后打开报表页
`);
}

module.exports = {
  reportTopicUrl,
  getToken,
  openInBrowser,
};

if (require.main === module) {
  main();
}
