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
 *   - SYNC_DIRS：目录级（清空 dest 整体复制 + exclude 规则）
 *   - SYNC_FILES：单文件（直接 copy）
 *
 * 安全护栏：
 *   - SYNC_DIRS 的 source 非排除文件数 < MIN_SOURCE_FILES 时 abort，避免
 *     源被误删/未 checkout 时静默清空 bundled
 *   - source 不存在直接 exit 1
 */

import {
  mkdirSync,
  readdirSync,
  copyFileSync,
  statSync,
  rmSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(CLI_ROOT, "..");

// 目录级 sync target（清空 dest 后整体 copy）
const SYNC_DIRS = [
  {
    name: "wjx-cli-use",
    src: resolve(REPO_ROOT, "wjx-skills/wjx-cli-use"),
    dest: resolve(CLI_ROOT, "bundled/wjx-cli-use"),
    exclude: [
      "__pycache__",
      "examples",
      "pack_skill.sh",
      "setup.sh",
      "package.json",
      ".gitignore",
      ".DS_Store",
    ],
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
      snapshot.set(relative, createHash("sha256").update(readFileSync(sourcePath)).digest("hex"));
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
    else if (entry.isFile()) snapshot.set(relative, createHash("sha256").update(readFileSync(targetPath)).digest("hex"));
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

function checkDir(target) {
  if (!existsSync(target.src) || !statSync(target.src).isDirectory()) throw new Error(`[sync-bundled] invalid source: ${target.src}`);
  const srcCount = countSourceFiles(target.src, target);
  if (srcCount < MIN_SOURCE_FILES) throw new Error(`[sync-bundled] ${target.name}: source only ${srcCount} files (< ${MIN_SOURCE_FILES})`);
  const differences = compareSnapshots(collectSourceSnapshot(target.src, target), collectBundleSnapshot(target.dest));
  if (differences.length) throw new Error(`[sync-bundled] ${target.name}: drift detected: ${differences.join(", ")}`);
}

function syncDir(target) {
  if (!existsSync(target.src)) {
    console.error(`[sync-bundled] source 不存在: ${target.src}`);
    process.exit(1);
  }
  const srcStat = statSync(target.src);
  if (!srcStat.isDirectory()) {
    console.error(`[sync-bundled] source 不是目录: ${target.src}`);
    process.exit(1);
  }

  // 护栏：源文件少于 MIN_SOURCE_FILES = 异常状态，不要清空 bundled
  const srcCount = countSourceFiles(target.src, target);
  if (srcCount < MIN_SOURCE_FILES) {
    console.error(
      `[sync-bundled] ${target.name}: source 仅 ${srcCount} 文件 ` +
        `(< ${MIN_SOURCE_FILES})。source 可能损坏或未 checkout，拒绝执行。`,
    );
    console.error(`[sync-bundled] source 路径: ${target.src}`);
    process.exit(1);
  }

  if (existsSync(target.dest)) {
    rmSync(target.dest, { recursive: true, force: true });
  }
  const count = copyDirRecursive(target.src, target.dest, target);
  console.log(`[sync-bundled] ${target.name}: ${count} files → ${target.dest}`);
}

function syncFile(target) {
  if (!existsSync(target.src)) {
    console.error(`[sync-bundled] source 不存在: ${target.src}`);
    process.exit(1);
  }
  mkdirSync(dirname(target.dest), { recursive: true });
  copyFileSync(target.src, target.dest);
  console.log(`[sync-bundled] ${target.name}: 1 file → ${target.dest}`);
}

function main() {
  console.log(`[sync-bundled] repo root: ${REPO_ROOT}`);
  if (process.argv.includes("--check")) {
    for (const target of SYNC_DIRS) checkDir(target);
    for (const target of SYNC_FILES) {
      if (!existsSync(target.dest) || createHash("sha256").update(readFileSync(target.src)).digest("hex") !== createHash("sha256").update(readFileSync(target.dest)).digest("hex")) throw new Error(`[sync-bundled] ${target.name}: drift detected`);
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

export { syncDir, syncFile, countSourceFiles, shouldExclude, SYNC_DIRS, SYNC_FILES, collectSourceSnapshot, collectBundleSnapshot, compareSnapshots };
