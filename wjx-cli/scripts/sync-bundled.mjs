#!/usr/bin/env node
/**
 * 把 wjx-skills/ 和 wjx-agents/ 下的真源同步到 wjx-cli/bundled/。
 *
 * bundled/ 是 npm 发布产物里的副本，必须跟 source 保持一致；长期手工 copy
 * 会漂移（实测：bundled/wjx-cli-expert.md 一度比 wjx-agents/ 真源落后一个
 * 重要 commit "JSON-first 收紧"，导致 npm 装出来的 subagent 还在推老路径）。
 *
 * 这个脚本是 npm-publish 流程 Phase 1.8 的一步，也可独立跑。
 *
 * 跑：node scripts/sync-bundled.mjs（或 npm run sync-bundled）
 *
 * 两类 target：
 *   - SYNC_DIRS：目录级（递归复制 + exclude 规则）
 *   - SYNC_FILES：单文件（原子替换）
 *
 * 安全护栏：
 *   - SYNC_DIRS 的 source 非排除文件数 < MIN_SOURCE_FILES 时 abort，避免
 *     源被误删/未 checkout 时静默清空 bundled
 *   - source 不存在或文件数异常时直接 abort
 *   - 有漂移时先把旧目标复制到临时备份，再通过同目录 rename 原子替换
 */

import {
  mkdirSync,
  readdirSync,
  copyFileSync,
  cpSync,
  statSync,
  rmSync,
  existsSync,
  readFileSync,
  renameSync,
  mkdtempSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(CLI_ROOT, "..");

const CLI_SKILL_RUNTIME_EXCLUDES = [
  "__pycache__",
  "examples",
  "pack_skill.sh",
  "setup.sh",
  "package.json",
  ".gitignore",
  ".DS_Store",
];

// 目录级 sync target。skills/ 保留可分发的 setup/package 文件；Claude
// 和 npm bundled 只需要运行时 Skill 与 references/，沿用历史排除规则。
const SYNC_DIRS = [
  {
    name: "wjx-cli-use-skills",
    src: resolve(REPO_ROOT, "wjx-skills/wjx-cli-use"),
    dest: resolve(REPO_ROOT, "skills/wjx-cli-use"),
    exclude: [],
  },
  {
    name: "wjx-cli-use-claude",
    src: resolve(REPO_ROOT, "wjx-skills/wjx-cli-use"),
    dest: resolve(REPO_ROOT, ".claude/skills/wjx-cli-use"),
    exclude: CLI_SKILL_RUNTIME_EXCLUDES,
  },
  {
    name: "wjx-cli-use",
    src: resolve(REPO_ROOT, "wjx-skills/wjx-cli-use"),
    dest: resolve(CLI_ROOT, "bundled/wjx-cli-use"),
    exclude: CLI_SKILL_RUNTIME_EXCLUDES,
  },
  {
    name: "wjx-survey-ppt",
    src: resolve(REPO_ROOT, "wjx-skills/wjx-survey-ppt"),
    dest: resolve(CLI_ROOT, "bundled/wjx-survey-ppt"),
    exclude: [
      "__pycache__",
      "_pdf_preview",
      "survey-ppt-workdir",
      "scripts",
      "tests",
      "examples",      // PDF 演示文件，运行时不需要，bundled 不带
      ".gitignore",
      ".DS_Store",
    ],
    excludePatterns: [
      /^ws-/, // ws-93913, ws-199802 等本地实测 workdir
      /^out-/, // out-warm 等渲染输出
      /\.pyc$/,
      /\.zip$/,
    ],
  },
];

// 单文件 sync target（subagent 定义直接落 bundled 根）
const SYNC_FILES = [
  {
    name: "wjx-cli-expert.md",
    src: resolve(REPO_ROOT, "wjx-agents/wjx-cli-expert/wjx-cli-expert.md"),
    dest: resolve(CLI_ROOT, "bundled/wjx-cli-expert.md"),
  },
];

// source 非排除文件数下限。任何真实 skill 都 >= 3（SKILL.md + references/ 至少 1 + ...）。
// 低于这个数量 = 源被误删 / 未 checkout / 被 mv 走，拒绝执行避免清空 bundled。
const MIN_SOURCE_FILES = 3;

function shouldExclude(name, target) {
  if (target.exclude?.includes(name)) return true;
  if (target.excludePatterns?.some((re) => re.test(name))) return true;
  return false;
}

function countSourceFiles(src, target) {
  let count = 0;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (shouldExclude(entry.name, target)) continue;
    if (entry.isDirectory()) {
      count += countSourceFiles(join(src, entry.name), target);
    } else if (entry.isFile()) {
      count += 1;
    }
  }
  return count;
}

/** Normalize only line endings for the content identity used by checks. */
function normalizedFileBuffer(path) {
  const buffer = readFileSync(path);
  // Binary assets are not currently part of the CLI Skill, but preserving
  // buffers containing NUL bytes avoids changing their identity if one is
  // added to a future target.
  if (buffer.includes(0)) return buffer;
  return Buffer.from(buffer.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
}

function hashFile(path) {
  return createHash("sha256").update(normalizedFileBuffer(path)).digest("hex");
}

function copyDirRecursive(src, dest, target) {
  let count = 0;
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (shouldExclude(entry.name, target)) continue;
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath, target);
    } else if (entry.isFile()) {
      copyFileSync(srcPath, destPath);
      count += 1;
    }
  }
  return count;
}

function collectSourceSnapshot(src, target, prefix = "") {
  const snapshot = new Map();
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (shouldExclude(entry.name, target)) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const sourcePath = join(src, entry.name);
    if (entry.isDirectory()) {
      for (const [path, hash] of collectSourceSnapshot(sourcePath, target, relative)) snapshot.set(path, hash);
    } else if (entry.isFile()) {
      snapshot.set(relative, hashFile(sourcePath));
    }
  }
  return snapshot;
}

function collectBundleSnapshot(dest, prefix = "") {
  const snapshot = new Map();
  if (!existsSync(dest)) return snapshot;
  for (const entry of readdirSync(dest, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const targetPath = join(dest, entry.name);
    if (entry.isDirectory()) for (const [path, hash] of collectBundleSnapshot(targetPath, relative)) snapshot.set(path, hash);
    else if (entry.isFile()) snapshot.set(relative, hashFile(targetPath));
  }
  return snapshot;
}

function compareSnapshots(source, bundle) {
  const differences = [];
  for (const path of new Set([...source.keys(), ...bundle.keys()])) {
    if (source.get(path) !== bundle.get(path)) differences.push(path);
  }
  return differences.sort();
}

function validateSourceDir(target) {
  if (!existsSync(target.src)) throw new Error(`[sync-bundled] source 不存在: ${target.src}`);
  if (!statSync(target.src).isDirectory()) throw new Error(`[sync-bundled] source 不是目录: ${target.src}`);

  // 护栏必须发生在任何 staging/替换操作之前。
  const srcCount = countSourceFiles(target.src, target);
  if (srcCount < MIN_SOURCE_FILES) {
    throw new Error(
      `[sync-bundled] ${target.name}: source 仅 ${srcCount} 文件 ` +
        `(< ${MIN_SOURCE_FILES})。source 可能损坏或未 checkout，拒绝执行。\n` +
        `[sync-bundled] source 路径: ${target.src}`,
    );
  }
  return srcCount;
}

function checkDir(target) {
  const srcCount = validateSourceDir(target);
  if (existsSync(target.dest) && !statSync(target.dest).isDirectory()) {
    throw new Error(`[sync-bundled] ${target.name}: destination is not a directory: ${target.dest}`);
  }
  const differences = compareSnapshots(collectSourceSnapshot(target.src, target), collectBundleSnapshot(target.dest));
  if (differences.length) throw new Error(`[sync-bundled] ${target.name}: drift detected: ${differences.join(", ")}`);
  return srcCount;
}

function randomSuffix() {
  return `${Date.now()}-${process.pid}-${randomUUID().slice(0, 8)}`;
}

function safeName(value) {
  return String(value || "target").replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function backupRootFor(target) {
  return resolve(target.backupRoot || join(tmpdir(), "wjx-sync-bundled-backups"));
}

const TRANSIENT_RENAME_CODES = new Set(["EPERM", "EACCES", "EBUSY"]);

function sleepSync(milliseconds) {
  if (milliseconds <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

/** Windows can briefly hold a directory handle after a sibling rename. */
function renameWithRetry(source, destination, renameFn = renameSync, options = {}) {
  const maxAttempts = Number.isSafeInteger(options.maxAttempts) && options.maxAttempts > 0
    ? options.maxAttempts
    : 8;
  const delayMs = Number.isSafeInteger(options.delayMs) && options.delayMs >= 0
    ? options.delayMs
    : 25;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return renameFn(source, destination);
    } catch (error) {
      if (!TRANSIENT_RENAME_CODES.has(error?.code) || attempt === maxAttempts) throw error;
      sleepSync(delayMs * Math.min(attempt, 4));
    }
  }
}

/** Preserve an existing target byte-for-byte before moving it out of the way. */
function backupExisting(target, destination) {
  const root = backupRootFor(target);
  const container = join(root, `${safeName(target.name)}-${randomSuffix()}`);
  mkdirSync(root, { recursive: true });
  mkdirSync(container, { recursive: true });
  const backupPath = join(container, basename(destination));
  cpSync(destination, backupPath, { recursive: true, force: false, errorOnExist: true });
  return backupPath;
}

function replaceAtomically(stagedPath, destination, target) {
  const destinationParent = dirname(destination);
  mkdirSync(destinationParent, { recursive: true });
  let previousPath;
  let backupPath;
  if (existsSync(destination)) {
    backupPath = backupExisting(target, destination);
    // A sibling path keeps the final rename on one filesystem and works for
    // both files and directories on Windows.
    previousPath = join(destinationParent, `.${basename(destination)}.previous-${randomSuffix()}`);
    renameWithRetry(destination, previousPath);
  }

  try {
    renameWithRetry(stagedPath, destination);
  } catch (error) {
    // Restore the original target if installation failed after it was moved.
    try {
      if (existsSync(destination)) rmSync(destination, { recursive: true, force: true });
      if (previousPath && existsSync(previousPath)) renameWithRetry(previousPath, destination);
    } catch (restoreError) {
      throw new Error(
        `[sync-bundled] failed to install ${destination}; restore also failed: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
        { cause: error },
      );
    }
    throw error;
  }

  if (previousPath && existsSync(previousPath)) {
    // The byte-for-byte backup is already durable. Remove only the temporary
    // moved copy after the new target is in place.
    rmSync(previousPath, { recursive: true, force: true });
  }
  return backupPath;
}

function syncDir(target) {
  const srcCount = validateSourceDir(target);
  if (existsSync(target.dest) && !statSync(target.dest).isDirectory()) {
    throw new Error(`[sync-bundled] ${target.name}: destination is not a directory: ${target.dest}`);
  }
  const sourceSnapshot = collectSourceSnapshot(target.src, target);
  const destinationSnapshot = collectBundleSnapshot(target.dest);
  const differences = compareSnapshots(sourceSnapshot, destinationSnapshot);
  if (!differences.length) {
    console.log(`[sync-bundled] ${target.name}: up to date (${srcCount} files)`);
    return srcCount;
  }

  const parent = dirname(target.dest);
  mkdirSync(parent, { recursive: true });
  const stagingPath = mkdtempSync(join(parent, `.${basename(target.dest)}.staging-`));
  try {
    const count = copyDirRecursive(target.src, stagingPath, target);
    const backupPath = replaceAtomically(stagingPath, target.dest, target);
    console.log(`[sync-bundled] ${target.name}: ${count} files → ${target.dest}`);
    if (backupPath) console.log(`[sync-bundled] ${target.name}: previous target backed up at ${backupPath}`);
    return count;
  } catch (error) {
    if (existsSync(stagingPath)) rmSync(stagingPath, { recursive: true, force: true });
    throw error;
  }
}

function syncFile(target) {
  if (!existsSync(target.src) || !statSync(target.src).isFile()) throw new Error(`[sync-bundled] source 不存在或不是文件: ${target.src}`);
  if (existsSync(target.dest) && statSync(target.dest).isDirectory()) throw new Error(`[sync-bundled] ${target.name}: destination is a directory: ${target.dest}`);
  if (existsSync(target.dest) && hashFile(target.src) === hashFile(target.dest)) {
    console.log(`[sync-bundled] ${target.name}: up to date`);
    return 1;
  }

  const parent = dirname(target.dest);
  mkdirSync(parent, { recursive: true });
  const stagingDir = mkdtempSync(join(parent, `.${basename(target.dest)}.staging-`));
  const stagedPath = join(stagingDir, basename(target.dest));
  try {
    copyFileSync(target.src, stagedPath);
    const backupPath = replaceAtomically(stagedPath, target.dest, target);
    rmSync(stagingDir, { recursive: true, force: true });
    console.log(`[sync-bundled] ${target.name}: 1 file → ${target.dest}`);
    if (backupPath) console.log(`[sync-bundled] ${target.name}: previous target backed up at ${backupPath}`);
    return 1;
  } catch (error) {
    if (existsSync(stagingDir)) rmSync(stagingDir, { recursive: true, force: true });
    throw error;
  }
}

function main() {
  console.log(`[sync-bundled] repo root: ${REPO_ROOT}`);
  if (process.argv.includes("--check")) {
    for (const target of SYNC_DIRS) checkDir(target);
    for (const target of SYNC_FILES) {
      if (!existsSync(target.src) || !statSync(target.src).isFile()) throw new Error(`[sync-bundled] source 不存在或不是文件: ${target.src}`);
      if (!existsSync(target.dest) || !statSync(target.dest).isFile() || hashFile(target.src) !== hashFile(target.dest)) throw new Error(`[sync-bundled] ${target.name}: drift detected`);
    }
    console.log(`[sync-bundled] check passed`);
    return;
  }
  for (const target of SYNC_DIRS) syncDir(target);
  for (const target of SYNC_FILES) syncFile(target);
  console.log(`[sync-bundled] 完成`);
}

// 仅在直接执行时跑 main；被 import 时只暴露内部 fn 给测试用
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main();
}

export { syncDir, syncFile, countSourceFiles, shouldExclude, renameWithRetry, SYNC_DIRS, SYNC_FILES, collectSourceSnapshot, collectBundleSnapshot, compareSnapshots, hashFile, normalizedFileBuffer };
