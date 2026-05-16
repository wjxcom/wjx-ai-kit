import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stderr } from "node:process";
import { spawnSync } from "node:child_process";
import type { InstallRootSource } from "./install-root.js";

export interface InstallPptSkillOptions {
  /** Overwrite existing skill files. */
  force?: boolean;
  /** Suppress all stderr output. */
  silent?: boolean;
  /** Skip the pip install step (skill files only). */
  skipPip?: boolean;
  /** 由 resolveInstallRoot 计算出的来源标签，用于打印 "Install root: X (from: Y)" */
  rootSource?: InstallRootSource;
}

export interface InstallPptSkillResult {
  status: "installed" | "updated" | "skipped" | "partial" | "error";
  version: string;
  files: string[];
  pipInstalled: boolean;
  message: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Resolve the bundled wjx-survey-ppt directory shipped with wjx-cli. */
function getBundledSkillDir(): string {
  // dist/lib/install-ppt-skill.js → ../../bundled/wjx-survey-ppt
  return join(__dirname, "..", "..", "bundled", "wjx-survey-ppt");
}

/** Read the skill's own package.json version (independent of wjx-cli version). */
function getSkillVersion(skillRoot: string): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(skillRoot, "package.json"), "utf-8"),
    );
    return (pkg.version as string) || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Recursively copy a directory, returning the list of copied files. */
function copyDirSync(src: string, dest: string): string[] {
  const copied: string[] = [];
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    // Skip Python bytecode caches and demo outputs
    if (entry.name === "__pycache__" || entry.name.startsWith("out")) continue;
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

/** Detect a working python executable (>= 3.10). Returns null if none. */
function detectPython(): string | null {
  for (const cmd of ["python3", "python"]) {
    const probe = spawnSync(cmd, ["--version"], { encoding: "utf-8" });
    if (probe.status !== 0) continue;
    const out = (probe.stdout || probe.stderr || "").trim();
    const match = out.match(/Python (\d+)\.(\d+)/);
    if (!match) continue;
    const major = Number(match[1]);
    const minor = Number(match[2]);
    if (major < 3 || (major === 3 && minor < 10)) continue;
    return cmd;
  }
  return null;
}

/** Check whether ppt_master_survey is importable in the current Python env. */
function isRendererInstalled(pythonCmd: string): boolean {
  const probe = spawnSync(pythonCmd, ["-c", "import ppt_master_survey"], {
    encoding: "utf-8",
  });
  return probe.status === 0;
}

/** Run `python -m pip install --upgrade ppt-master-survey`. Inherits stdio so user sees progress. */
function runPipInstall(pythonCmd: string, silent: boolean): boolean {
  const args = ["-m", "pip", "install", "--upgrade", "ppt-master-survey"];
  const result = spawnSync(pythonCmd, args, {
    stdio: silent ? "ignore" : "inherit",
  });
  return result.status === 0;
}

/**
 * jieba 是 P08 词云分词的可选依赖；缺失时回退到 N-gram，质量降级但不阻塞。
 * 装失败仅 stderr 警告，不改 overall status。
 */
function ensureJieba(pythonCmd: string, silent: boolean): boolean {
  const probe = spawnSync(pythonCmd, ["-c", "import jieba"], { encoding: "utf-8" });
  if (probe.status === 0) return true;
  const result = spawnSync(pythonCmd, ["-m", "pip", "install", "jieba"], {
    stdio: silent ? "ignore" : "inherit",
  });
  return result.status === 0;
}

/**
 * Install wjx-survey-ppt skill files and the ppt-master-survey PyPI package.
 *
 * - Skill files: copied to <targetDir>/skills/wjx-survey-ppt/
 * - PyPI package: installed via `python -m pip install ppt-master-survey`
 *
 * Either step's failure does not abort the other; the result reports both.
 */
export function installPptSkill(
  targetDir: string,
  options: InstallPptSkillOptions = {},
): InstallPptSkillResult {
  const { force = false, silent = false, skipPip = false, rootSource } = options;
  const skillSrc = getBundledSkillDir();
  const version = getSkillVersion(skillSrc);

  if (!existsSync(skillSrc)) {
    return {
      status: "error",
      version,
      files: [],
      pipInstalled: false,
      message: "找不到 bundled/wjx-survey-ppt 目录，wjx-cli 安装可能不完整",
    };
  }

  if (!silent) {
    const suffix = rootSource ? ` (from: ${rootSource})` : "";
    stderr.write(`Install root: ${targetDir}${suffix}\n`);
  }

  // ---------- Step 1: copy skill files ----------
  const skillDest = join(targetDir, "skills", "wjx-survey-ppt");
  const skillExists = existsSync(join(skillDest, "SKILL.md"));
  let copiedFiles: string[] = [];
  let copyStatus: "installed" | "updated" | "skipped";

  if (skillExists && !force) {
    copyStatus = "skipped";
    if (!silent) {
      stderr.write("wjx-survey-ppt 技能已安装，使用 --force 覆盖或运行 skill update-ppt\n");
    }
  } else {
    copiedFiles = copyDirSync(skillSrc, skillDest);
    copyStatus = skillExists ? "updated" : "installed";
    if (!silent) {
      const action = copyStatus === "updated" ? "已更新" : "已安装";
      stderr.write(`${action} wjx-survey-ppt 技能 (v${version}): skills/wjx-survey-ppt/ (${copiedFiles.length} files)\n`);
    }
  }

  // ---------- Step 2: pip install ppt-master-survey ----------
  let pipInstalled = false;
  let pipMessage = "";

  if (skipPip) {
    pipMessage = "跳过 pip 安装（--skip-pip）";
    if (!silent) stderr.write(`${pipMessage}\n`);
  } else {
    const pythonCmd = detectPython();
    if (!pythonCmd) {
      pipMessage = "未检测到 Python 3.10+，请安装后运行：python -m pip install ppt-master-survey";
      if (!silent) stderr.write(`${pipMessage}\n`);
    } else if (isRendererInstalled(pythonCmd)) {
      pipInstalled = true;
      pipMessage = "ppt-master-survey 已安装";
      if (!silent) stderr.write(`${pipMessage}\n`);
    } else {
      if (!silent) stderr.write(`安装 ppt-master-survey...\n`);
      const ok = runPipInstall(pythonCmd, silent);
      if (ok) {
        pipInstalled = true;
        pipMessage = "ppt-master-survey 安装成功";
        if (!silent) stderr.write(`${pipMessage}\n`);
      } else {
        pipMessage = `pip 安装失败，请手动运行：${pythonCmd} -m pip install ppt-master-survey`;
        if (!silent) stderr.write(`${pipMessage}\n`);
      }
    }
    if (pipInstalled && pythonCmd) {
      if (!silent) stderr.write(`安装 jieba（中文分词，用于 P08 词云）...\n`);
      const jiebaOk = ensureJieba(pythonCmd, silent);
      if (!silent) {
        stderr.write(jiebaOk
          ? `jieba 已就绪\n`
          : `jieba 安装失败（词云将回退到 N-gram，质量降级；不影响 PPT 主流程）\n`);
      }
    }
  }

  // ---------- Compose result ----------
  const overallStatus: InstallPptSkillResult["status"] = (() => {
    if (copyStatus === "skipped") {
      return "skipped";
    }
    if (pipInstalled || skipPip) {
      return copyStatus;
    }
    return "partial";
  })();

  const message =
    (copyStatus === "skipped"
      ? "技能已存在"
      : "技能" + (copyStatus === "updated" ? "已更新" : "已安装")) +
    "; " + pipMessage;

  return {
    status: overallStatus,
    version,
    files: copiedFiles,
    pipInstalled,
    message,
  };
}

/** Update existing wjx-survey-ppt skill (force overwrite). */
export function updatePptSkill(
  targetDir: string,
  options: Omit<InstallPptSkillOptions, "force"> = {},
): InstallPptSkillResult {
  const { silent = false } = options;
  const skillDest = join(targetDir, "skills", "wjx-survey-ppt", "SKILL.md");

  if (!existsSync(skillDest)) {
    const msg = "wjx-survey-ppt 技能尚未安装，请先运行 wjx skill install-ppt";
    if (!silent) stderr.write(`${msg}\n`);
    return {
      status: "error",
      version: getSkillVersion(getBundledSkillDir()),
      files: [],
      pipInstalled: false,
      message: msg,
    };
  }

  return installPptSkill(targetDir, {
    force: true,
    silent: options.silent,
    skipPip: options.skipPip,
    rootSource: options.rootSource,
  });
}
