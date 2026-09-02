import { existsSync, mkdirSync, copyFileSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stderr } from "node:process";
import { createRequire } from "node:module";
import type { InstallRootSource } from "./install-root.js";

export interface InstallSkillOptions {
  force?: boolean;
  silent?: boolean;
  /** 由 resolveInstallRoot 计算出的来源标签，用于打印 "Install root: X (from: Y)" */
  rootSource?: InstallRootSource;
}

export interface InstallSkillResult {
  status: "installed" | "updated" | "skipped" | "error";
  version: string;
  files: string[];
  message: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Resolve the bundled/ directory shipped with the wjx-cli package. */
function getBundledDir(): string {
  // dist/lib/install-skill.js → ../../bundled
  return join(__dirname, "..", "..", "bundled");
}

/** Get the current package version. */
export function getVersion(): string {
  const require = createRequire(import.meta.url);
  const { version } = require("../../package.json");
  return version as string;
}

/** Recursively copy a directory. */
function copyDirSync(src: string, dest: string): string[] {
  const copied: string[] = [];
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copied.push(...copyDirSync(srcPath, destPath));
    } else {
      copyFileSync(srcPath, destPath);
      copied.push(destPath);
    }
  }
  return copied;
}

/** Replace a generated skill mirror so removed files cannot survive an update. */
function replaceDirSync(src: string, dest: string): string[] {
  rmSync(dest, { recursive: true, force: true });
  return copyDirSync(src, dest);
}

/**
 * Install wjx-cli-use skill files and agent definition to the target directory.
 *
 * @param targetDir - Project root directory (e.g. process.cwd())
 * @param options   - force: overwrite existing; silent: no stderr output
 */
export function installSkill(
  targetDir: string,
  options: InstallSkillOptions = {},
): InstallSkillResult {
  const { force = false, silent = false, rootSource } = options;
  const version = getVersion();
  const bundledDir = getBundledDir();

  if (!existsSync(bundledDir)) {
    const msg = "找不到 bundled 目录，安装可能不完整";
    return { status: "error", version, files: [], message: msg };
  }

  if (!silent) {
    const suffix = rootSource ? ` (from: ${rootSource})` : "";
    stderr.write(`Install root: ${targetDir}${suffix}\n`);
  }

  const agentSrc = join(bundledDir, "wjx-cli-expert.md");
  const skillSrc = join(bundledDir, "wjx-cli-use");
  const agentDest = join(targetDir, ".claude", "agents", "wjx-cli-expert.md");
  const skillDest = join(targetDir, "skills", "wjx-cli-use");
  // Claude Code discovers skills under its conventional .claude/skills path.
  // Keep that mirror synchronized so Claude cannot load stale instructions.
  const claudeSkillDest = join(targetDir, ".claude", "skills", "wjx-cli-use");

  const agentExists = existsSync(agentDest);
  const skillExists = existsSync(join(skillDest, "SKILL.md"));
  const claudeSkillExists = existsSync(claudeSkillDest);
  const isUpdate = agentExists || skillExists || claudeSkillExists;

  if (isUpdate && !force) {
    const msg = "技能已安装，使用 --force 覆盖或运行 skill update";
    if (!silent) stderr.write(`${msg}\n`);
    return { status: "skipped", version, files: [], message: msg };
  }

  const files: string[] = [];

  // Copy agent definition
  mkdirSync(dirname(agentDest), { recursive: true });
  copyFileSync(agentSrc, agentDest);
  files.push(agentDest);

  // Copy skill files
  const skillFiles = copyDirSync(skillSrc, skillDest);
  files.push(...skillFiles);
  // Claude Code discovers skills under `.claude/skills`. Always refresh this
  // mirror, including on first install, so reinstalling from any client path
  // cannot leave Claude loading an older skill copy.
  const claudeSkillFiles = replaceDirSync(skillSrc, claudeSkillDest);
  files.push(...claudeSkillFiles);

  const status = isUpdate ? "updated" : "installed";
  const action = isUpdate ? "已更新" : "已安装";
  const msg = `${action} wjx-cli-use 技能 (v${version})`;

  if (!silent) {
    stderr.write(`${msg}:\n`);
    stderr.write(`  .claude/agents/wjx-cli-expert.md\n`);
    stderr.write(`  skills/wjx-cli-use/ (${skillFiles.length} files)\n`);
    stderr.write(`  .claude/skills/wjx-cli-use/ (synchronized mirror, ${claudeSkillFiles.length} files)\n`);
  }

  return { status, version, files, message: msg };
}

/**
 * Update existing skill files. Returns error if not installed yet.
 */
export function updateSkill(
  targetDir: string,
  options: Omit<InstallSkillOptions, "force"> = {},
): InstallSkillResult {
  const { silent = false, rootSource } = options;
  const version = getVersion();
  const agentDest = join(targetDir, ".claude", "agents", "wjx-cli-expert.md");
  const skillDest = join(targetDir, "skills", "wjx-cli-use", "SKILL.md");
  const claudeSkillDest = join(targetDir, ".claude", "skills", "wjx-cli-use");

  if (!existsSync(agentDest) && !existsSync(skillDest) && !existsSync(claudeSkillDest)) {
    const msg = "技能尚未安装，请先运行 wjx skill install";
    return { status: "error", version, files: [], message: msg };
  }

  return installSkill(targetDir, { force: true, silent, rootSource });
}
