#!/usr/bin/env node
/**
 * 问卷网项目信息归档（Hera /report/ajax/project_archive/）
 * 与 API 约定：POST，Query 含 pid + ai_skills 签名（appkey、web_site、timestamp、signature），表单 is_merge；JWT Bearer。
 * 详见 references/project_archive.md
 */

const axios = require("axios");
const { resolveAccessToken } = require("./token_store");
const { buildSignedUrl } = require("./generate_sign");

const BASE_URL = "https://www.wenjuan.com";
const ARCHIVE_PATH = "/report/ajax/project_archive/";

const DEFAULT_POLL_MS = 2500;
const DEFAULT_MAX_WAIT_MS = 5 * 60 * 1000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {unknown} data
 * @returns {{ ok: true } | { doing: true } | { ok: false, message: string, code?: unknown }}
 */
function parseArchiveResponse(data) {
  if (data == null || typeof data !== "object") {
    return { ok: false, message: "响应为空或格式异常" };
  }
  const st = data.status;
  const result = data.result;
  if (String(st) === "200" && result === "Success") {
    return { ok: true };
  }
  if (String(st) === "200" && result === "Doing") {
    return { doing: true };
  }
  const msg =
    data.message ||
    data.err_msg ||
    (typeof data.status === "number" ? `错误码 ${data.status}` : "归档失败");
  return { ok: false, message: msg, code: st };
}

/**
 * 单次调用归档接口
 * @param {string} accessToken JWT
 * @param {string} projectId
 * @param {number} [isMerge] 0 或 1
 */
async function postProjectArchive(accessToken, projectId, isMerge = 0) {
  // Query 须含 pid，并与 appkey、web_site、timestamp、signature 一并参与签名（同 generate_sign / export_data）
  const url = buildSignedUrl(`${BASE_URL}${ARCHIVE_PATH}`, { pid: projectId });
  const body = new URLSearchParams({
    is_merge: String(isMerge === 1 ? 1 : 0),
  }).toString();
  const response = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: 120000,
    validateStatus: () => true,
  });
  const data = response.data;
  if (typeof data === "string") {
    try {
      return parseArchiveResponse(JSON.parse(data));
    } catch {
      return { ok: false, message: `非 JSON 响应: ${data.slice(0, 200)}` };
    }
  }
  return parseArchiveResponse(data);
}

/**
 * 归档直至 Success 或失败；遇 Doing 则轮询
 * @param {string} accessToken
 * @param {string} projectId
 * @param {{ isMerge?: number, pollIntervalMs?: number, maxWaitMs?: number, log?: (s: string) => void }} [opts]
 */
async function pollArchiveUntilSuccess(accessToken, projectId, opts = {}) {
  const isMerge = opts.isMerge === 1 ? 1 : 0;
  const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_MS;
  const maxWaitMs = opts.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const log = opts.log || (() => {});

  const deadline = Date.now() + maxWaitMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    const r = await postProjectArchive(accessToken, projectId, isMerge);
    if (r.ok) {
      return { success: true, attempts: attempt };
    }
    if (r.doing) {
      log(`  归档进行中 (Doing)，${pollIntervalMs / 1000}s 后重试… (#${attempt})`);
      await sleep(pollIntervalMs);
      continue;
    }
    return { success: false, message: r.message, code: r.code, attempts: attempt };
  }

  return {
    success: false,
    message: "归档等待超时（持续返回 Doing 或未成功）",
    attempts: attempt,
  };
}

async function main() {
  const args = process.argv.slice(2);
  let projectId = null;
  let isMerge = 0;
  let tokenDir = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === "-p" || a === "--project-id") && args[i + 1]) {
      projectId = args[++i];
    } else if (a === "--merge") {
      isMerge = 1;
    } else if (a === "--token-dir" && args[i + 1]) {
      tokenDir = args[++i];
    } else if (a === "-h" || a === "--help") {
      console.log(`
用法: node project_archive.js -p <project_id> [选项]

项目信息归档（编辑问卷前通常需先归档，由 project_edit_guard 自动调用）

选项:
  -p, --project-id <id>   项目 ID（必填）
  --merge                 is_merge=1（合并历史版本答卷，耗时可更长）
  --token-dir <dir>       凭证目录（默认见 token_store / auth.md）
  -h, --help              帮助
`);
      process.exit(0);
    }
  }

  if (!projectId) {
    console.error("错误: 请提供 -p <project_id>");
    process.exit(1);
  }

  const token = await resolveAccessToken({
    tokenDir: tokenDir == null ? undefined : tokenDir,
  });
  if (!token) {
    console.error("错误: 未找到 JWT，请先登录（见 references/auth.md）");
    process.exit(1);
  }

  console.log(`正在归档项目 ${projectId} (is_merge=${isMerge})…`);
  const result = await pollArchiveUntilSuccess(token, projectId, {
    isMerge,
    log: console.log,
  });
  if (!result.success) {
    console.error(`❌ 归档失败: ${result.message}`);
    process.exit(1);
  }
  console.log(`✅ 归档成功 (尝试 ${result.attempts} 次)`);
}

module.exports = {
  BASE_URL,
  ARCHIVE_PATH,
  postProjectArchive,
  pollArchiveUntilSuccess,
  parseArchiveResponse,
};

if (require.main === module) {
  main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}
