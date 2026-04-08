/**
 * 编辑/删题/改项目前：
 * 1) 拉取项目结构；若「收集中」则先 stop；
 * 2) 调用项目归档接口直至成功（Doing 则轮询），与 Hera project_archive 一致；
 * 3) 再次拉取结构落盘。
 * 问卷网项目 JSON 常见为顶层 status===1 或 proj_status===1 表示收集中。
 *
 * **禁止绕过**：修改项目信息、题目、选项或删除题目时，须通过本模块 `ensureReadyForEdit`
 *（已由 `update_project.js`、`edit_question.js` 的 `updateQuestion`、`create_question.js` 的 `createQuestionApi`、
 * `delete_question.js` 的 `deleteQuestion` 在提交前统一调用）。不得在 Agent 或自定义脚本中通过
 * 覆盖方法、只调底层 API 等方式跳过停收与归档。
 */

const path = require("path");
const fs = require("fs").promises;
const { getDefaultTokenDir, resolveAccessToken } = require("./token_store");
const { execSync } = require("child_process");
const { pollArchiveUntilSuccess } = require("./project_archive");

/**
 * @param {object} projectData fetch_project 落盘的根对象
 * @returns {boolean}
 */
function isProjectCollecting(projectData) {
  if (!projectData || typeof projectData !== "object") return false;
  const ps = projectData.proj_status;
  if (ps === 1 || String(ps) === "1") return true;
  const st = projectData.status;
  if (st === 1 || String(st) === "1") return true;
  return false;
}

async function readFetchedProject(projectId) {
  const file = path.join(
    getDefaultTokenDir(),
    "project_struct",
    `${projectId}.json`
  );
  const content = await fs.readFile(file, "utf-8");
  return JSON.parse(content);
}

function runFetchProject(projectId) {
  const scriptDir = __dirname;
  const fetchScript = path.join(scriptDir, "fetch_project.js");
  const cwd = path.join(scriptDir, "..");
  execSync(`node "${fetchScript}" --project-id "${projectId}" --json`, {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
  });
}

function runPublishStop(projectId) {
  const scriptDir = __dirname;
  const publishScript = path.join(scriptDir, "publish.js");
  const cwd = path.join(scriptDir, "..");
  execSync(`node "${publishScript}" -p "${projectId}" -a stop`, {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
  });
}

/**
 * 编辑前完整前置：必要时停止收集 + 项目归档成功（方可改题/改项/改项目信息）。
 * @param {string} projectId
 * @param {{ log?: (s: string) => void, isMerge?: number, tokenDir?: string|null }} [opts]
 */
async function ensureReadyForEdit(projectId, opts = {}) {
  const log = opts.log || console.log;
  const isMerge = opts.isMerge === 1 ? 1 : 0;
  const tokenDir = opts.tokenDir;

  runFetchProject(projectId);
  let projectData = await readFetchedProject(projectId);
  const title =
    projectData.title_as_txt || projectData.title || projectData.name || "N/A";

  log("\n" + "=".repeat(50));
  log("【前置检查】编辑前：停止收集 + 项目归档");
  log("=".repeat(50));
  log(`  项目: ${title}`);
  log(`  收集中: ${isProjectCollecting(projectData) ? "是" : "否"}`);

  if (isProjectCollecting(projectData)) {
    log("\n⚠️  项目正在收集中，正在停止收集…");
    runPublishStop(projectId);
    log("✓ 已停止收集");
    runFetchProject(projectId);
    projectData = await readFetchedProject(projectId);
  } else {
    log("✓ 项目未在收集中");
  }

  const token = await resolveAccessToken({
    tokenDir: tokenDir == null ? undefined : tokenDir,
  });
  if (!token) {
    throw new Error(
      "未找到 access_token，无法归档项目；请先登录（见 references/auth.md）"
    );
  }

  log("\n📦 正在执行项目信息归档（归档成功后方可编辑）…");
  const arch = await pollArchiveUntilSuccess(token, projectId, {
    isMerge,
    log: (s) => log(s),
  });
  if (!arch.success) {
    throw new Error(arch.message || "项目归档失败");
  }
  log(`✓ 项目归档成功（${arch.attempts} 次请求）`);

  runFetchProject(projectId);
  log("✓ 已刷新本地项目结构，可继续编辑操作");
}

/** @deprecated 语义与 ensureReadyForEdit 相同，保留别名 */
const ensureStoppedForEdit = ensureReadyForEdit;

module.exports = {
  isProjectCollecting,
  ensureReadyForEdit,
  ensureStoppedForEdit,
  readFetchedProject,
  runFetchProject,
};
