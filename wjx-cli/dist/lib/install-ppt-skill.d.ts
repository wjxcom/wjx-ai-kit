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
/**
 * Install wjx-survey-ppt skill files and the ppt-master-survey PyPI package.
 *
 * - Skill files: copied to <targetDir>/skills/wjx-survey-ppt/
 * - PyPI package: installed via `python -m pip install ppt-master-survey`
 *
 * Either step's failure does not abort the other; the result reports both.
 */
export declare function installPptSkill(targetDir: string, options?: InstallPptSkillOptions): InstallPptSkillResult;
/** Update existing wjx-survey-ppt skill (force overwrite). */
export declare function updatePptSkill(targetDir: string, options?: Omit<InstallPptSkillOptions, "force">): InstallPptSkillResult;
