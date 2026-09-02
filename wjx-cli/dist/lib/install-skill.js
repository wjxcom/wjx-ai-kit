import { existsSync, readdirSync, lstatSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stderr } from "node:process";
import { createRequire } from "node:module";
import { copyDirectory, replaceTargetsAtomically } from "./install-transaction.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/** Resolve the bundled/ directory shipped with the wjx-cli package. */
function getBundledDir() {
    // dist/lib/install-skill.js → ../../bundled
    return join(__dirname, "..", "..", "bundled");
}
/** Get the current package version. */
export function getVersion() {
    const require = createRequire(import.meta.url);
    const { version } = require("../../package.json");
    return version;
}
function isFile(path) {
    try {
        return lstatSync(path).isFile();
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
function hasSkillDirectory(path) {
    try {
        // lstat keeps a symlinked destination from being treated as an installed
        // mirror and silently redirecting reads/writes outside the target root.
        if (!lstatSync(path).isDirectory())
            return false;
    }
    catch {
        return false;
    }
    return isFile(join(path, "SKILL.md"));
}
// These files belong to source/package workflows, not the bundled runtime
// Skill. Preserve them when a project installs the Skill into its own repo.
const PRESERVED_PROJECT_FILES = ["setup.sh", "package.json", "pack_skill.sh", ".gitignore"];
function copySkillForInstall(source, destination, existing) {
    const files = copyDirectory(source, destination);
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
function installationConflict(path, valid) {
    if (!pathExists(path) || valid)
        return undefined;
    try {
        // Empty directories are unambiguous remnants of an interrupted install
        // and can be repaired without risking user data. Non-empty paths require
        // an explicit --force so a regular install never deletes content.
        if (lstatSync(path).isDirectory() && readdirSync(path).length === 0)
            return undefined;
    }
    catch {
        // Fall through to the conflict message for inaccessible paths.
    }
    return `目标路径已存在但不是可识别的 Skill：${path}。如需替换请显式使用 --force`;
}
/**
 * Install wjx-cli-use skill files and agent definition to the target directory.
 *
 * @param targetDir - Project root directory (e.g. process.cwd())
 * @param options   - force: overwrite existing; silent: no stderr output
 */
export function installSkill(targetDir, options = {}) {
    const { force = false, silent = false, rootSource } = options;
    const version = getVersion();
    const bundledDir = getBundledDir();
    const agentSrc = join(bundledDir, "wjx-cli-expert.md");
    const skillSrc = join(bundledDir, "wjx-cli-use");
    if (!existsSync(bundledDir) || !isFile(agentSrc) || !hasSkillDirectory(skillSrc)) {
        const msg = "找不到 bundled 目录，安装可能不完整";
        return { status: "error", version, files: [], message: msg };
    }
    const agentDest = join(targetDir, ".claude", "agents", "wjx-cli-expert.md");
    const skillDest = join(targetDir, "skills", "wjx-cli-use");
    // Claude Code discovers skills under its conventional .claude/skills path.
    // Keep that mirror synchronized so Claude cannot load stale instructions.
    const claudeSkillDest = join(targetDir, ".claude", "skills", "wjx-cli-use");
    const agentExists = isFile(agentDest);
    const skillExists = hasSkillDirectory(skillDest);
    const claudeSkillExists = hasSkillDirectory(claudeSkillDest);
    const isUpdate = agentExists || skillExists || claudeSkillExists;
    if (!force) {
        const conflicts = [
            installationConflict(agentDest, agentExists),
            installationConflict(skillDest, skillExists),
            installationConflict(claudeSkillDest, claudeSkillExists),
        ].filter((message) => Boolean(message));
        if (conflicts.length > 0) {
            return { status: "error", version, files: [], message: conflicts.join("；") };
        }
    }
    if (isUpdate && !force && agentExists && skillExists && claudeSkillExists) {
        const msg = "技能已安装，使用 --force 覆盖或运行 skill update";
        if (!silent)
            stderr.write(`${msg}\n`);
        return { status: "skipped", version, files: [], message: msg };
    }
    const targets = [];
    if (force || !agentExists) {
        targets.push({ destination: agentDest, stage: (path) => {
                copyFileSync(agentSrc, path);
                return [path];
            } });
    }
    if (force || !skillExists) {
        targets.push({
            destination: skillDest,
            stage: (path) => copySkillForInstall(skillSrc, path, skillDest),
        });
    }
    if (force || !claudeSkillExists) {
        targets.push({ destination: claudeSkillDest, stage: (path) => copyDirectory(skillSrc, path) });
    }
    let files;
    try {
        files = replaceTargetsAtomically(targetDir, targets);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { status: "error", version, files: [], message: `技能安装失败: ${message}` };
    }
    const status = isUpdate ? "updated" : "installed";
    const action = isUpdate ? "已更新" : "已安装";
    const msg = `${action} wjx-cli-use 技能 (v${version})`;
    if (!silent) {
        const suffix = rootSource ? ` (from: ${rootSource})` : "";
        stderr.write(`Install root: ${targetDir}${suffix}\n`);
        stderr.write(`${msg}:\n`);
        stderr.write(`  ${files.length} generated files\n`);
    }
    return { status, version, files, message: msg };
}
/**
 * Update existing skill files. Returns error if not installed yet.
 */
export function updateSkill(targetDir, options = {}) {
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
//# sourceMappingURL=install-skill.js.map