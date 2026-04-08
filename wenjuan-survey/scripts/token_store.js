/**
 * 问卷网 JWT 凭证路径与读取逻辑（单一来源）
 *
 * 默认用户级目录：环境变量 WENJUAN_TOKEN_DIR（若设置且非空），否则 ~/.wenjuan
 * 约定（未改凭证目录时）：扫码登录写入 ~/.wenjuan/token.json；原始数据导出默认目录 ~/.wenjuan/download/（见 export_data.js、references/auth.md）
 *
 * 读取顺序（与 references/auth.md 一致）：
 *   1. <skillRoot>/.wenjuan/auth.json 的 access_token
 *   2. <tokenDir>/token.json（支持 access_token、token、data.access_token）
 *   3. <tokenDir>/access_token 纯文本
 */

const fs = require("fs").promises;
const path = require("path");
const os = require("os");

/** Skill 根目录（scripts 的父目录），用于定位 .wenjuan/auth.json */
const SKILL_ROOT = path.join(__dirname, "..");

function getDefaultTokenDir() {
  const env = process.env.WENJUAN_TOKEN_DIR;
  if (env != null && String(env).trim() !== "") {
    return path.resolve(String(env).trim());
  }
  return path.join(os.homedir(), ".wenjuan");
}

/**
 * @param {string} [skillRoot]
 * @param {string|null|undefined} [tokenDir] 为 null/undefined 时用 getDefaultTokenDir()
 */
function pathsForSkill(skillRoot = SKILL_ROOT, tokenDir = undefined) {
  const dir =
    tokenDir != null && String(tokenDir).trim() !== ""
      ? path.resolve(String(tokenDir).trim())
      : getDefaultTokenDir();
  return {
    skillRoot,
    tokenDir: dir,
    projectAuthPath: path.join(skillRoot, ".wenjuan", "auth.json"),
    tokenJsonPath: path.join(dir, "token.json"),
    accessTokenPath: path.join(dir, "access_token"),
    deviceCodePath: path.join(dir, "device_code"),
  };
}

function extractAccessTokenFromJsonObject(data) {
  if (!data || typeof data !== "object") return "";
  const nested = data.data && typeof data.data === "object" ? data.data : null;
  const t =
    data.access_token ||
    data.token ||
    (nested && (nested.access_token || nested.token)) ||
    "";
  return String(t).trim();
}

/**
 * @param {{ skillRoot?: string, tokenDir?: string|null }} [opts]
 * @returns {Promise<string|null>}
 */
async function resolveAccessToken(opts = {}) {
  const { skillRoot = SKILL_ROOT, tokenDir } = opts;
  const p = pathsForSkill(skillRoot, tokenDir);

  try {
    const content = await fs.readFile(p.projectAuthPath, "utf-8");
    const data = JSON.parse(content);
    const t = extractAccessTokenFromJsonObject(data);
    if (t) return t;
  } catch (_) {}

  try {
    const content = await fs.readFile(p.tokenJsonPath, "utf-8");
    const data = JSON.parse(content.trim());
    const t = extractAccessTokenFromJsonObject(data);
    if (t) return t;
  } catch (_) {}

  try {
    const raw = await fs.readFile(p.accessTokenPath, "utf-8");
    const t = raw.trim();
    if (t) return t;
  } catch (_) {}

  return null;
}

/**
 * @param {{ skillRoot?: string, tokenDir?: string|null }} [opts]
 * @param {string} [message]
 * @returns {Promise<string>}
 */
async function requireAccessToken(opts = {}, message = "未找到 access_token，请先运行登录脚本") {
  const t = await resolveAccessToken(opts);
  if (!t) throw new Error(message);
  return t;
}

module.exports = {
  SKILL_ROOT,
  getDefaultTokenDir,
  pathsForSkill,
  resolveAccessToken,
  requireAccessToken,
  extractAccessTokenFromJsonObject,
};
