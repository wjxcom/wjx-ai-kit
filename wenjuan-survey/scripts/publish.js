#!/usr/bin/env node
/**
 * 问卷网项目发布/停止工具
 * 控制问卷的收集状态，支持轮询审核状态
 */

const fs = require('fs');
const axios = require('axios');
const { resolveAccessToken } = require('./token_store');

// API 地址
const BASE_URL = "https://www.wenjuan.com/edit/api/update_project_status/?jwt=1";
const STATUS_URL = "https://www.wenjuan.com/project/api/status/";

/** GET /project/api/status/{id} → body.data.status（与 edit_project 的 status 不是同一套枚举） */
const STATUS_API_PUBLISHED = 0; // 发布
const STATUS_API_COLLECTING = 1; // 收集中（发布成功）
const STATUS_API_COMPLETE = 2; // 完成
const STATUS_API_PAUSED = 3; // 暂停收集
const STATUS_PENDING = 99; // 审核中
const STATUS_REJECTED = 100; // 审核不通过
const STATUS_API_DELETED = -1; // 永久删除
const STATUS_API_RECYCLE = -2; // 删除进回收站

/** 兼容旧名：发布轮询里「通过/收集中」与 1 一致 */
const STATUS_APPROVED = STATUS_API_COLLECTING;

// 轮询与倒计时配置
const POLL_INTERVAL_SEC = 2; // 每 2 秒拉取一次状态（循环获取项目/审核状态）
/** 排队提示：从发布轮询开始起算 15 分钟倒计时，并给出预计完成本地时刻（HH:mm） */
const QUEUE_PUBLISH_COUNTDOWN_SEC = 15 * 60;
const MAX_AUDIT_WAIT_SEC = 1800; // 最长等待 30 分钟

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 从本地文件读取 JWT（逻辑见 token_store.js） */
async function getToken() {
  const t = await resolveAccessToken();
  return t || "";
}

/**
 * 获取项目审核状态
 * @param {string} jwtToken - JWT认证令牌
 * @param {string} projectId - 项目ID
 */
async function getProjectStatus(jwtToken, projectId) {
  const headers = {
    "Authorization": `Bearer ${jwtToken}`,
    "Content-Type": "application/json"
  };
  
  const url = `${STATUS_URL}${projectId}`;
  
  try {
    const response = await axios.get(url, { headers, timeout: 10000 });
    return response.data;
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * 获取项目真实状态（通过项目详情API）
 * @param {string} jwtToken - JWT令牌
 * @param {string} projectId - 项目ID
 */
/**
 * 统一解析 edit_project GET 的 JSON（兼容 data 嵌套或偶发扁平结构）
 */
function normalizeEditProjectResponse(responseData) {
  if (!responseData || typeof responseData !== "object") {
    return { ok: false, project: null, error: "空响应" };
  }
  const sc = responseData.status_code;
  if (sc != null && Number(sc) !== 1) {
    return {
      ok: false,
      project: null,
      error:
        responseData.err_msg ||
        responseData.message ||
        `status_code=${sc}`,
    };
  }
  const d = responseData.data;
  if (d && typeof d === "object" && d.questionpage_list != null) {
    return { ok: true, project: d };
  }
  if (responseData.questionpage_list != null) {
    return { ok: true, project: responseData };
  }
  const project = d && typeof d === "object" ? d : {};
  return { ok: true, project };
}

/** 收集状态：0 编辑中 / 1 收集中 / 2 已停止 */
function resolveSurveyCollectStatus(project) {
  if (!project || typeof project !== "object") return undefined;
  if (project.status !== undefined && project.status !== null && project.status !== "") {
    const n = Number(project.status);
    return Number.isNaN(n) ? undefined : n;
  }
  if (
    project.proj_status !== undefined &&
    project.proj_status !== null &&
    project.proj_status !== ""
  ) {
    const n = Number(project.proj_status);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

async function getProjectRealStatus(jwtToken, projectId) {
  try {
    const { buildSignedUrl } = require('./generate_sign');
    const url = buildSignedUrl('https://www.wenjuan.com/app_api/edit/edit_project/', {
      project_id: projectId,
    });

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${jwtToken}` },
      timeout: 30000,
    });

    const norm = normalizeEditProjectResponse(response.data);
    if (!norm.ok) {
      return { success: false, error: norm.error || "获取项目失败" };
    }
    const st = resolveSurveyCollectStatus(norm.project);
    return {
      success: true,
      status: st,
      is_publish: st === 1,
      title: norm.project.title,
      short_id: norm.project.short_id,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 从 GET /project/api/status/{id} 的响应体解析 `data.status`。
 * 仅使用 `data.status`（无 audit_status）。
 * 语义：0 发布，1 收集中，2 完成，3 暂停收集，99 审核中，100 审核不通过，-1 永久删除，-2 回收站；
 * 200 为占位，返回 code=null 继续轮询。
 */
function parseAuditStatusCode(result) {
  if (!result || result.error) return { code: null, data: {} };

  const payload =
    result.data != null && typeof result.data === "object" && !Array.isArray(result.data)
      ? result.data
      : {};

  const raw = payload.status;
  if (raw === undefined || raw === null || raw === "") {
    return { code: null, data: payload };
  }

  const n = Number(raw);
  if (raw === 200 || raw === "200" || n === 200) {
    return { code: null, data: payload };
  }

  return { code: Number.isNaN(n) ? raw : n, data: payload };
}

function formatWaitCn(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m <= 0) return `${s} 秒`;
  return `${m} 分 ${s} 秒`;
}

/** 本地时刻 HH:mm（用于「预计 12:28 完成发布」） */
function formatClockHm(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 剩余秒数 → 「约 X 分 Y 秒」式中文（与 15 分钟倒计时配套） */
function formatRemainApproxCn(remainSec) {
  const sec = Math.max(0, Math.floor(remainSec));
  if (sec <= 0) return "0 秒";
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  if (mm <= 0) return `${ss} 秒`;
  if (ss === 0) return `${mm} 分钟`;
  return `${mm} 分 ${ss} 秒`;
}

/**
 * 发布后排队场景的统一用户提示（15 分钟倒计时 + 预计完成时刻）
 * @param {number} queueDeadlineMs - 开始轮询时设为 Date.now() + 15min
 */
function buildPublishQueuePatienceHint(queueDeadlineMs) {
  const remainSec = Math.max(0, Math.ceil((queueDeadlineMs - Date.now()) / 1000));
  const end = new Date(queueDeadlineMs);
  const hm = formatClockHm(end);
  if (remainSec <= 0) {
    return `当前发布项目较多，系统正在排队处理，已超过此前预计的 ${hm}，仍在处理中，请您耐心等候`;
  }
  return `当前发布项目较多，系统正在排队处理，剩余约 ${formatRemainApproxCn(remainSec)}，预计${hm}完成发布，请您耐心等候`;
}

/** 管道/非 TTY（Agent、CI、部分 GUI）下 stdout 常被全缓冲，长时间看不到轮询提示 */
function useImmediatePollLog() {
  return !process.stdout.isTTY || process.env.WENJUAN_SYNC_LOG === "1";
}

/**
 * 发布轮询专用输出：每行立即写入 fd1，便于 OpenClaw、WorkerBuddy 等实时展示。
 * 交互终端默认仍用 console.log；可设 WENJUAN_SYNC_LOG=1 强制同步写。
 */
function pollStatusOut(line) {
  const s = String(line).trimEnd();
  if (!s) return;
  const payload = `${s}\n`;
  if (useImmediatePollLog()) {
    try {
      fs.writeSync(1, payload);
      return;
    } catch {
      /* 忽略，退回 console */
    }
  }
  console.log(s);
}

function writePollStatusLine(text) {
  pollStatusOut(text);
}

function clearPollStatusLine() {
  /* 已改为逐行输出，不再用 \\r 擦行 */
}

/**
 * edit_project 详情里的收集态（status / proj_status），与 /project/api/status/ 的 data.status 枚举不同。
 */
function describeProjectRealStatus(realStatus) {
  if (!realStatus || !realStatus.success) {
    const err = (realStatus && realStatus.error) || "未知错误";
    return `项目详情: ⚠️ 获取失败（${err}）`;
  }
  const n = realStatus.status;
  const map = {
    0: "编辑中",
    1: "收集中（已发布）",
    2: "已停止",
    99: "审核中（待平台同步）",
  };
  const label =
    n === undefined || n === null || Number.isNaN(Number(n))
      ? "未返回（详情接口无 status/proj_status，请到问卷网后台核对）"
      : map[n] != null
        ? map[n]
        : `状态码 ${n}`;
  const short = realStatus.short_id ? ` short_id=${realStatus.short_id}` : "";
  return `项目详情: ${label}${short}`;
}

/** /project/api/status/ 的 data.status → 中文（与线上一致枚举） */
function describeStatusApiDataStatus(apiCode, payload) {
  const data = payload || {};
  const extraRaw =
    data.msg ||
    data.message ||
    data.audit_msg ||
    data.tip ||
    data.reject_reason ||
    data.reason ||
    "";
  const extra =
    extraRaw && String(extraRaw).trim()
      ? ` 「${String(extraRaw).trim().slice(0, 48)}${String(extraRaw).length > 48 ? "…" : ""}」`
      : "";

  if (apiCode === undefined || apiCode === null || apiCode === "") {
    return `状态接口: 处理中（未返回 data.status 或为 200 占位）${extra}`;
  }

  const labelMap = {
    0: "发布",
    1: "收集中（发布成功）",
    2: "完成",
    3: "暂停收集",
    99: "审核中",
    100: "审核不通过",
    "-1": "永久删除",
    "-2": "删除（回收站）",
  };
  const key = String(apiCode);
  const label = labelMap[key] != null ? labelMap[key] : `未知码 ${apiCode}`;
  return `状态接口: ${label}${extra}`;
}

/**
 * 轮询：循环获取项目详情 + 审核状态，直至已发布、驳回或超时；输出排队提示与 15 分钟倒计时
 */
async function pollAuditStatus(jwtToken, projectId) {
  pollStatusOut("");
  pollStatusOut("=".repeat(50));
  pollStatusOut("发布已提交，正在循环获取审核与项目状态（请勿关闭终端）");
  pollStatusOut("=".repeat(50));
  pollStatusOut(
    `说明: 每 ${POLL_INTERVAL_SEC} 秒一行 — 项目详情(edit_project) | 状态接口(/project/api/status data.status) | 排队提示 | 已等待时长`
  );
  pollStatusOut("");

  const queueDeadlineMs = Date.now() + QUEUE_PUBLISH_COUNTDOWN_SEC * 1000;
  let elapsed = 0;
  let printedAuditApproved = false;

  while (elapsed < MAX_AUDIT_WAIT_SEC) {
    const realStatus = await getProjectRealStatus(jwtToken, projectId);
    if (realStatus.success && realStatus.is_publish) {
      clearPollStatusLine();
      if (elapsed === 0) {
        pollStatusOut(
          `${describeProjectRealStatus(realStatus)} | 提示：详情已为收集中，本次发布无需排队审核。`
        );
      }
      pollStatusOut("✅ 项目已发布成功，当前为「收集中」。");
      return { success: true, status: "published", data: realStatus };
    }

    const auditResult = await getProjectStatus(jwtToken, projectId);
    const { code: auditCode, data: auditData } = parseAuditStatusCode(auditResult);

    const projLine = describeProjectRealStatus(realStatus);
    const auditLine = auditResult.error
      ? `状态接口: ⚠️ 请求失败（${auditResult.error}）`
      : describeStatusApiDataStatus(auditCode, auditData);

    if (auditResult.error) {
      const hint = `${buildPublishQueuePatienceHint(queueDeadlineMs)}（${POLL_INTERVAL_SEC} 秒后重试拉取状态接口）`;
      writePollStatusLine(
        `${projLine} | ${auditLine} | ${hint} | 已等待 ${formatWaitCn(elapsed)}`
      );
      await sleep(POLL_INTERVAL_SEC * 1000);
      elapsed += POLL_INTERVAL_SEC;
      continue;
    }

    let countdownHint = "";

    if (auditCode === STATUS_API_DELETED || auditCode === "-1") {
      clearPollStatusLine();
      pollStatusOut("❌ 状态接口：项目已永久删除。");
      return { success: false, status: "deleted", reason: "永久删除" };
    }
    if (auditCode === STATUS_API_RECYCLE || auditCode === "-2") {
      clearPollStatusLine();
      pollStatusOut("❌ 状态接口：项目已移入回收站。");
      return { success: false, status: "recycled", reason: "回收站" };
    }

    if (
      auditCode === STATUS_API_COLLECTING ||
      auditCode === 1 ||
      String(auditCode) === "1"
    ) {
      if (!printedAuditApproved) {
        clearPollStatusLine();
        pollStatusOut("✅ 状态接口为收集中（1），发布成功。");
        printedAuditApproved = true;
      }
      if (realStatus.success && realStatus.is_publish) {
        clearPollStatusLine();
        pollStatusOut("✅ 项目已发布成功，当前为「收集中」。");
        return { success: true, status: "published", data: realStatus };
      }
      if (realStatus.success) {
        clearPollStatusLine();
        pollStatusOut("✅ 状态接口已为收集中（1），详情接口同步中。");
        return {
          success: true,
          status: "published",
          data: { ...realStatus, is_publish: true },
        };
      }
      countdownHint = "状态接口已为收集中，等待详情接口同步…";
    } else if (
      auditCode === STATUS_REJECTED ||
      auditCode === 100 ||
      String(auditCode) === "100"
    ) {
      clearPollStatusLine();
      const rejectReason = auditData.reject_reason || auditData.reason || "未知原因";
      pollStatusOut("❌ 审核未通过（100）。");
      return { success: false, status: "rejected", reason: rejectReason };
    } else if (
      auditCode === STATUS_PENDING ||
      auditCode === 99 ||
      String(auditCode) === "99"
    ) {
      countdownHint = buildPublishQueuePatienceHint(queueDeadlineMs);
    } else if (auditCode === STATUS_API_PUBLISHED || auditCode === 0 || String(auditCode) === "0") {
      countdownHint =
        "状态接口为「发布」，等待进入收集中（1）或与详情接口同步…";
    } else if (auditCode === STATUS_API_PAUSED || auditCode === 3 || String(auditCode) === "3") {
      countdownHint = "状态接口为「暂停收集」，若正在发布请等待同步…";
    } else if (auditCode === STATUS_API_COMPLETE || auditCode === 2 || String(auditCode) === "2") {
      countdownHint = "状态接口为「完成」，请确认是否仍需收集答卷…";
    } else if (auditCode != null) {
      countdownHint = buildPublishQueuePatienceHint(queueDeadlineMs);
    } else {
      countdownHint = buildPublishQueuePatienceHint(queueDeadlineMs);
    }

    writePollStatusLine(
      `${projLine} | ${auditLine} | ${countdownHint} | 已等待 ${formatWaitCn(elapsed)}`
    );

    await sleep(POLL_INTERVAL_SEC * 1000);
    elapsed += POLL_INTERVAL_SEC;
  }

  clearPollStatusLine();
  return {
    success: false,
    status: "timeout",
    error: `等待审核超时（已轮询约 ${formatWaitCn(MAX_AUDIT_WAIT_SEC)}）`,
  };
}

/** 发布接口是否返回成功（兼容 status_code 与 status 两种字段） */
function isPublishApiSuccess(result) {
  if (!result || result.error) return false;
  return result.status_code === 1 || result.status === 200;
}

/**
 * 发布/停止项目（发布成功后会循环获取审核/项目状态直至正式发布或超时）
 * @param {string} projectId - 项目ID
 * @param {string} action - publish(发布) 或 stop(停止)
 * @param {string} jwtToken - JWT认证令牌
 */
async function publishProject(projectId, action, jwtToken) {
  const headers = {
    "Authorization": `Bearer ${jwtToken}`,
    "Content-Type": "application/json"
  };
  
  // status: 1 = 发布, 0 = 停止
  const status = action === "publish" ? 1 : 0;
  
  const payload = {
    proj_id: projectId,
    status: status,
    web_site: "wenjuan_web",
    source: "wenjuan_web",
    share_project: "off"
  };
  
  try {
    const response = await axios.post(BASE_URL, payload, { headers, timeout: 30000 });
    const result = response.data;
    
    if (action === "publish" && isPublishApiSuccess(result)) {
      const pollResult = await pollAuditStatus(jwtToken, projectId);
      return { ...result, poll_result: pollResult };
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
 * 解析结果为可读文本
 */
function parseResult(result) {
  // 处理包含审核轮询的结果
  if (result.poll_result) {
    const audit = result.poll_result;
    if (audit.success) {
      const sid = audit.data && audit.data.short_id;
      const link = sid ? ` 答题链接: https://www.wenjuan.com/s/${sid}` : "";
      return `✅ 项目发布成功（审核通过）${link}`;
    }
    const status = audit.status || "";
    if (status === "rejected") {
      const reason = audit.reason || "未知原因";
      return `❌ 审核不通过: ${reason}`;
    }
    if (status === "timeout") {
      return `⚠️ ${audit.error || "审核等待超时，请稍后在问卷网后台查看或重新发布"}`;
    }
    return `⚠️ 审核未完成: ${status}${audit.error ? `（${audit.error}）` : ""}`;
  }
  
  // 处理普通发布结果
  if (result.status === 200) {
    const data = result.data || {};
    const projStatus = data.proj_status;
    
    if (projStatus === 1) {
      let msg = "✅ 项目发布成功";
      if (data.first_publish === 1) {
        msg += "（首次发布）";
      }
      return msg;
    } else if (projStatus === 0) {
      return "✅ 项目已停止";
    } else {
      return `✅ 操作成功，当前状态: ${projStatus}`;
    }
  } else {
    const errMsg = result.err_msg || result.message || "未知错误";
    const errCode = result.err_code || "";
    
    if (errMsg.includes("NOT_BIND_MOBILE") || errMsg.includes("未绑定") || errMsg.includes("手机号")) {
      return `❌ 需要先绑定手机号: ${errMsg}`;
    }
    
    return `❌ 操作失败: ${errMsg}` + (errCode ? ` (错误码: ${errCode})` : "");
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  let projectId = null;
  let action = "publish";
  let outputJson = false;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if ((arg === "-p" || arg === "--project-id") && i + 1 < args.length) {
      projectId = args[++i];
    } else if ((arg === "-a" || arg === "--action") && i + 1 < args.length) {
      action = args[++i];
      if (!["publish", "stop"].includes(action)) {
        console.error("错误: action 必须是 publish 或 stop");
        process.exit(1);
      }
    } else if (arg === "--poll") {
      /* 发布后始终轮询，保留参数以兼容旧命令 */
    } else if (arg === "--json") {
      outputJson = true;
    } else if (arg === "-h" || arg === "--help") {
      showHelp();
      process.exit(0);
    }
  }
  
  if (!projectId) {
    console.error("错误: 必须提供项目ID (-p)");
    process.exit(1);
  }
  
  const token = await getToken();
  if (!token) {
    console.error("错误: 未找到登录凭证，请先运行 login_auto.js 登录");
    process.exit(1);
  }
  
  try {
    const result = await publishProject(projectId, action, token);
    
    if (outputJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(parseResult(result));
    }
    
    // 根据结果显示退出码
    if (result.error || (result.poll_result && !result.poll_result.success)) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ 错误: ${error.message}`);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
问卷网项目发布/停止工具

用法: node publish.js -p <project-id> [选项]

选项:
  -p, --project-id <id>   项目ID（必填）
  -a, --action <action>   操作: publish(发布)/stop(停止)，默认 publish
  --json                  输出原始JSON响应
  -h, --help              显示帮助信息

示例:
  # 发布项目（自动循环获取审核/项目状态直至正式发布或超时）
  node publish.js -p "abc123" -a publish
  
  # 停止项目
  node publish.js -p "abc123" -a stop
  
  # 输出JSON格式
  node publish.js -p "abc123" --json

发布后行为:
  publish 成功后会按固定间隔（默认每 2 秒）循环请求：
  - 项目详情（edit_project）：收集态是否与「收集中」一致
  - 状态接口（/project/api/status/ 的 data.status）：0 发布，1 收集中，2 完成，3 暂停收集，99 审核中，100 不通过，-1 永久删除，-2 回收站；200 为占位继续轮询
  每行：项目详情 | 状态接口 | 排队提示 | 已等待时长，最长约 30 分钟。
  环境变量 WENJUAN_SYNC_LOG=1：即使在本机 TTY 也强制每行同步写入 stdout（便于排查缓冲问题）。

OpenClaw / WorkerBuddy 等通过管道抓输出时，脚本会自动用同步写行，无需额外配置。
`);
}

// 导出模块
module.exports = {
  publishProject,
  getProjectStatus,
  getProjectRealStatus,
  pollAuditStatus,
  getToken,
  parseAuditStatusCode,
  normalizeEditProjectResponse,
  resolveSurveyCollectStatus,
  describeStatusApiDataStatus,
  STATUS_API_PUBLISHED,
  STATUS_API_COLLECTING,
  STATUS_API_COMPLETE,
  STATUS_API_PAUSED,
  STATUS_PENDING,
  STATUS_APPROVED,
  STATUS_REJECTED,
  STATUS_API_DELETED,
  STATUS_API_RECYCLE,
};

// 如果是直接运行
if (require.main === module) {
  main();
}
