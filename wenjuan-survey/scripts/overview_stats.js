#!/usr/bin/env node
/**
 * 数据概况：GET /report/api/v2/overview/stats/{pid}/
 * 即时查看答卷数、今日答卷、浏览量、完成率等（与 Hera stats v2 文档一致）
 * 详见 references/overview_stats.md
 */

const axios = require("axios");
const { resolveAccessToken } = require("./token_store");
const { buildUrlWithAuth } = require("./export_data");

const BASE_URL = "https://www.wenjuan.com";

/** 与 export_data 下载原始数据一致：web_site / app_key / secret 签名查询串 */
function statsUrl(projectId) {
  const pid = encodeURIComponent(String(projectId).trim());
  const basePath = `${BASE_URL}/report/api/v2/overview/stats/${pid}/`;
  return buildUrlWithAuth(basePath);
}

function isV2Success(body) {
  if (!body || typeof body !== "object") return false;
  return String(body.status) === "200";
}

/**
 * @param {string} accessToken JWT
 * @param {string} projectId
 * @returns {Promise<{ ok: true, data: object } | { ok: false, message: string, code?: unknown }>}
 */
async function fetchOverviewStats(accessToken, projectId) {
  const url = statsUrl(projectId); // 已含 app_key、web_site、timestamp、signature
  let response;
  try {
    response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: 60000,
      validateStatus: () => true,
    });
  } catch (e) {
    return { ok: false, message: e.message || String(e) };
  }

  let body = response.data;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return { ok: false, message: `非 JSON 响应: ${body.slice(0, 200)}` };
    }
  }

  if (isV2Success(body)) {
    return { ok: true, data: body.data && typeof body.data === "object" ? body.data : {} };
  }

  const msg =
    (body && body.message) ||
    `请求失败 HTTP ${response.status}`;
  return { ok: false, message: msg, code: body && body.status };
}

/**
 * @param {object} data API data 字段
 * @param {string} [projectId]
 */
function formatOverviewText(data, projectId = "") {
  const d = data || {};
  const lines = [];
  lines.push("=".repeat(50));
  lines.push("📊 数据概况（报表统计 v2）");
  lines.push("=".repeat(50));
  if (projectId) lines.push(`项目 ID: ${projectId}`);
  lines.push(`有效答卷总数: ${d.rspd_count != null ? d.rspd_count : "—"}`);
  lines.push(`今日答卷: ${d.today_count != null ? d.today_count : "—"}`);
  lines.push(`总浏览量: ${d.scan_count != null ? d.scan_count : "—"}`);
  const rate = d.finished_rate;
  lines.push(
    `完成率: ${rate != null && rate !== "" ? `${rate}%` : "—"}`
  );
  lines.push(`平均答卷用时: ${d.avg_rspd_time || "—"}`);
  lines.push(`首份答卷时间: ${d.rspd_begin_time || "—"}`);
  lines.push(`末份答卷时间: ${d.rspd_end_time || "—"}`);
  lines.push("=".repeat(50));
  return lines.join("\n");
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let projectId = null;
  let jsonOut = false;
  let tokenDir = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-h" || a === "--help") {
      return { help: true };
    }
    if ((a === "-p" || a === "--project-id") && args[i + 1]) {
      projectId = args[++i];
      continue;
    }
    if (a === "--json") {
      jsonOut = true;
      continue;
    }
    if (a === "--token-dir" && args[i + 1]) {
      tokenDir = args[++i];
      continue;
    }
    if (a.startsWith("-")) {
      return { error: `未知选项: ${a}` };
    }
    if (!projectId) {
      projectId = a;
    } else {
      return { error: "只能指定一个项目 ID"};
    }
  }

  return { projectId, jsonOut, tokenDir };
}

function showHelp() {
  console.log(`
数据概况 — 即时查看问卷收集情况（答卷数、浏览量、完成率等）

用法:
  node overview_stats.js <project_id> [选项]
  node overview_stats.js -p <project_id> [选项]

选项:
  --json              输出原始 JSON（含 status/message/data）
  --token-dir <dir>   凭证目录（默认见 token_store / auth.md）
  -h, --help          帮助

接口: GET https://www.wenjuan.com/report/api/v2/overview/stats/{pid}/
  查询参数与签名与 generate_sign（ai_skills）/ export_data 一致: appkey、web_site、timestamp、signature
文档: references/overview_stats.md
`);
}

async function main() {
  const parsed = parseArgs(process.argv);
  if (parsed.help) {
    showHelp();
    process.exit(0);
  }
  if (parsed.error) {
    console.error(`错误: ${parsed.error}`);
    showHelp();
    process.exit(1);
  }
  if (!parsed.projectId) {
    console.error("错误: 请提供项目 ID（位置参数或 -p）");
    showHelp();
    process.exit(1);
  }

  const token = await resolveAccessToken({
    tokenDir: parsed.tokenDir == null ? undefined : parsed.tokenDir,
  });
  if (!token) {
    console.error("错误: 未找到 JWT，请先登录（见 references/auth.md）");
    process.exit(1);
  }

  const result = await fetchOverviewStats(token, parsed.projectId);
  if (!result.ok) {
    console.error(`❌ ${result.message}${result.code != null ? ` (code: ${result.code})` : ""}`);
    process.exit(1);
  }

  if (parsed.jsonOut) {
    console.log(
      JSON.stringify(
        {
          status: "200",
          message: "Success",
          data: result.data,
        },
        null,
        2
      )
    );
  } else {
    console.log(formatOverviewText(result.data, parsed.projectId));
  }
}

module.exports = {
  BASE_URL,
  statsUrl,
  fetchOverviewStats,
  formatOverviewText,
  isV2Success,
};

if (require.main === module) {
  main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}
