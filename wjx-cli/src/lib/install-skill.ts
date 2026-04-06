import { existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stderr } from "node:process";
import { createRequire } from "node:module";

export interface InstallSkillOptions {
  force?: boolean;
  silent?: boolean;
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
  const { force = false, silent = false } = options;
  const version = getVersion();
  const bundledDir = getBundledDir();

  if (!existsSync(bundledDir)) {
    const msg = "找不到 bundled 目录，安装可能不完整";
    return { status: "error", version, files: [], message: msg };
  }

  const agentSrc = join(bundledDir, "wjx-cli-expert.md");
  const skillSrc = join(bundledDir, "wjx-cli-use");
  const agentDest = join(targetDir, ".claude", "agents", "wjx-cli-expert.md");
  const skillDest = join(targetDir, "wjx-skills", "wjx-cli-use");

  const agentExists = existsSync(agentDest);
  const skillExists = existsSync(join(skillDest, "SKILL.md"));
  const isUpdate = agentExists || skillExists;

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
  files.push(...copyDirSync(skillSrc, skillDest));

  const status = isUpdate ? "updated" : "installed";
  const action = isUpdate ? "已更新" : "已安装";
  const msg = `${action} wjx-cli-use 技能 (v${version})`;

  if (!silent) {
    stderr.write(`${msg}:\n`);
    stderr.write(`  .claude/agents/wjx-cli-expert.md\n`);
    stderr.write(`  wjx-skills/wjx-cli-use/ (${files.length - 1} files)\n`);
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
  const { silent = false } = options;
  const version = getVersion();
  const agentDest = join(targetDir, ".claude", "agents", "wjx-cli-expert.md");
  const skillDest = join(targetDir, "wjx-skills", "wjx-cli-use", "SKILL.md");

  if (!existsSync(agentDest) && !existsSync(skillDest)) {
    const msg = "技能尚未安装，请先运行 wjx skill install";
    if (!silent) stderr.write(`${msg}\n`);
    return { status: "error", version, files: [], message: msg };
  }

  return installSkill(targetDir, { force: true, silent });
}
