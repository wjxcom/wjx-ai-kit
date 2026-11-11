import { existsSync, readFileSync, readdirSync, lstatSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stderr } from "node:process";
import { spawnSync } from "node:child_process";
import { copyDirectory, replaceTargetsAtomically } from "./install-transaction.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/** Resolve the bundled wjx-survey-ppt directory shipped with wjx-cli. */
function getBundledSkillDir() {
    // dist/lib/install-ppt-skill.js → ../../bundled/wjx-survey-ppt
    return join(__dirname, "..", "..", "bundled", "wjx-survey-ppt");
}
/** Read the skill's own package.json version (independent of wjx-cli version). */
function getSkillVersion(skillRoot) {
    try {
        const pkg = JSON.parse(readFileSync(join(skillRoot, "package.json"), "utf-8"));
        return pkg.version || "0.0.0";
    }
    catch {
        return "0.0.0";
    }
}
function isFile(path) {
    try {
        return lstatSync(path).isFile();
    }
    catch {
        return false;
    }
}
function isDirectory(path) {
    try {
        return lstatSync(path).isDirectory();
    }
    catch {
        return false;
    }
}
function pathExists(path) {
    try {
        lstatSync(path);
        return true;
    }
    catch {
        return false;
    }
}
function installationConflict(path, valid) {
    if (!pathExists(path) || valid)
        return undefined;
    try {
        if (lstatSync(path).isDirectory() && readdirSync(path).length === 0)
            return undefined;
    }
    catch {
        // Fall through to the conflict message for inaccessible paths.
    }
    return `目标路径已存在但不是可识别的 Skill：${path}。如需替换请显式使用 --force`;
}
function hasSkillDirectory(path) {
    try {
        if (!lstatSync(path).isDirectory())
            return false;
    }
    catch {
        return false;
    }
    return isFile(join(path, "SKILL.md"));
}
// Preserve source/package workflow files when a project uses the installer
// inside its own checked-in Skill directory.
const PRESERVED_PROJECT_FILES = ["setup.sh", "package.json", "pack_skill.sh", ".gitignore"];
function copyPptSkillForInstall(source, destination, existing) {
    const files = copyDirectory(source, destination, (name) => name === "__pycache__" || name.startsWith("out"));
    for (const name of PRESERVED_PROJECT_FILES) {
        const sourcePath = join(existing, name);
        if (!isFile(sourcePath))
            continue;
        const destinationPath = join(destination, name);
        copyFileSync(sourcePath, destinationPath);
        files.push(destinationPath);
    }
    return files;
}
/** Detect a working python executable (>= 3.10). Returns null if none. */
function detectPython() {
    for (const cmd of ["python3", "python"]) {
        const probe = spawnSync(cmd, ["--version"], { encoding: "utf-8" });
        if (probe.status !== 0)
            continue;
        const out = (probe.stdout || probe.stderr || "").trim();
        const match = out.match(/Python (\d+)\.(\d+)/);
        if (!match)
            continue;
        const major = Number(match[1]);
        const minor = Number(match[2]);
        if (major < 3 || (major === 3 && minor < 10))
            continue;
        return cmd;
    }
    return null;
}
/** Check whether the renderer import and its module entry point both work. */
function isRendererInstalled(pythonCmd) {
    const importProbe = spawnSync(pythonCmd, ["-c", "import ppt_master_survey"], {
        encoding: "utf-8",
        stdio: "ignore",
    });
    if (importProbe.status !== 0)
        return false;
    const entrypointProbe = spawnSync(pythonCmd, ["-m", "ppt_master_survey", "--help"], {
        encoding: "utf-8",
        stdio: "ignore",
    });
    return entrypointProbe.status === 0;
}
/** Run `python -m pip install --upgrade ppt-master-survey`. Inherits stdio so user sees progress. */
function runPipInstall(pythonCmd, silent) {
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
function ensureJieba(pythonCmd, silent) {
    const probe = spawnSync(pythonCmd, ["-c", "import jieba"], { encoding: "utf-8" });
    if (probe.status === 0)
        return true;
    const result = spawnSync(pythonCmd, ["-m", "pip", "install", "jieba"], {
        stdio: silent ? "ignore" : "inherit",
    });
    return result.status === 0;
}
/**
 * Install wjx-survey-ppt skill files and the ppt-master-survey PyPI package.
 *
 * - Skill files: copied to <targetDir>/skills/wjx-survey-ppt/ and mirrored to
 *   <targetDir>/.claude/skills/wjx-survey-ppt/
 * - PyPI package: installed via `python -m pip install ppt-master-survey`
 *
 * Either step's failure does not abort the other; the result reports both.
 */
export function installPptSkill(targetDir, options = {}) {
    const { force = false, silent = false, skipPip = false, rootSource } = options;
    const skillSrc = getBundledSkillDir();
    const version = getSkillVersion(skillSrc);
    if (!isDirectory(skillSrc) || !hasSkillDirectory(skillSrc)) {
        return {
            status: "error",
            version,
            files: [],
            pipInstalled: false,
            message: "找不到 bundled/wjx-survey-ppt 目录，wjx-cli 安装可能不完整",
        };
    }
    // ---------- Step 1: copy skill files ----------
    const skillDest = join(targetDir, "skills", "wjx-survey-ppt");
    const claudeSkillDest = join(targetDir, ".claude", "skills", "wjx-survey-ppt");
    const skillExists = hasSkillDirectory(skillDest);
    const claudeSkillExists = hasSkillDirectory(claudeSkillDest);
    const alreadyInstalled = skillExists || claudeSkillExists;
    if (!force) {
        const conflicts = [
            installationConflict(skillDest, skillExists),
            installationConflict(claudeSkillDest, claudeSkillExists),
        ].filter((message) => Boolean(message));
        if (conflicts.length > 0) {
            return {
                status: "error",
                version,
                files: [],
                pipInstalled: false,
                message: conflicts.join("；"),
            };
        }
    }
    let copiedFiles = [];
    let copyStatus;
    if (alreadyInstalled && !force && skillExists && claudeSkillExists) {
        copyStatus = "skipped";
        if (!silent) {
            stderr.write("wjx-survey-ppt 技能已安装，使用 --force 覆盖或运行 skill update-ppt\n");
        }
    }
    else {
        const targets = [];
        if (force || !skillExists) {
            targets.push({ destination: skillDest, stage: (path) => copyPptSkillForInstall(skillSrc, path, skillDest) });
        }
        if (force || !claudeSkillExists) {
            targets.push({ destination: claudeSkillDest, stage: (path) => copyDirectory(skillSrc, path, (name) => name === "__pycache__" || name.startsWith("out")) });
        }
        try {
            copiedFiles = replaceTargetsAtomically(targetDir, targets);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                status: "error",
                version,
                files: [],
                pipInstalled: false,
                message: `wjx-survey-ppt 技能安装失败: ${message}`,
            };
        }
        copyStatus = alreadyInstalled ? "updated" : "installed";
        if (!silent) {
            const suffix = rootSource ? ` (from: ${rootSource})` : "";
            stderr.write(`Install root: ${targetDir}${suffix}\n`);
            const action = copyStatus === "updated" ? "已更新" : "已安装";
            stderr.write(`${action} wjx-survey-ppt 技能 (v${version}): skills/wjx-survey-ppt/ + .claude/skills/wjx-survey-ppt/ (${copiedFiles.length} files)\n`);
        }
    }
    // ---------- Step 2: pip install ppt-master-survey ----------
    let pipInstalled = false;
    let pipMessage = "";
    if (skipPip) {
        pipMessage = "跳过 pip 安装（--skip-pip）";
        if (!silent)
            stderr.write(`${pipMessage}\n`);
    }
    else {
        const pythonCmd = detectPython();
        if (!pythonCmd) {
            pipMessage = "未检测到 Python 3.10+，请安装后运行：python -m pip install ppt-master-survey";
            if (!silent)
                stderr.write(`${pipMessage}\n`);
        }
        else if (isRendererInstalled(pythonCmd)) {
            pipInstalled = true;
            pipMessage = "ppt-master-survey 已安装";
            if (!silent)
                stderr.write(`${pipMessage}\n`);
        }
        else {
            if (!silent)
                stderr.write(`安装 ppt-master-survey...\n`);
            const ok = runPipInstall(pythonCmd, silent);
            if (ok) {
                pipInstalled = true;
                pipMessage = "ppt-master-survey 安装成功";
                if (!silent)
                    stderr.write(`${pipMessage}\n`);
            }
            else {
                pipMessage = `pip 安装失败，请手动运行：${pythonCmd} -m pip install ppt-master-survey`;
                if (!silent)
                    stderr.write(`${pipMessage}\n`);
            }
        }
        if (pipInstalled && pythonCmd) {
            if (!silent)
                stderr.write(`安装 jieba（中文分词，用于 P08 词云）...\n`);
            const jiebaOk = ensureJieba(pythonCmd, silent);
            if (!silent) {
                stderr.write(jiebaOk
                    ? `jieba 已就绪\n`
                    : `jieba 安装失败（词云将回退到 N-gram，质量降级；不影响 PPT 主流程）\n`);
            }
        }
    }
    // ---------- Compose result ----------
    const overallStatus = (() => {
        if (!skipPip && !pipInstalled)
            return "partial";
        return copyStatus;
    })();
    const message = (copyStatus === "skipped"
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
export function updatePptSkill(targetDir, options = {}) {
    const { silent = false } = options;
    const skillDest = join(targetDir, "skills", "wjx-survey-ppt", "SKILL.md");
    const claudeSkillDest = join(targetDir, ".claude", "skills", "wjx-survey-ppt", "SKILL.md");
    if (!existsSync(skillDest) && !existsSync(claudeSkillDest)) {
        const msg = "wjx-survey-ppt 技能尚未安装，请先运行 wjx skill install-ppt";
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
//# sourceMappingURL=install-ppt-skill.js.map