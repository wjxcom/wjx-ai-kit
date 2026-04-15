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
/** Get the current package version. */
export declare function getVersion(): string;
/**
 * Install wjx-cli-use skill files and agent definition to the target directory.
 *
 * @param targetDir - Project root directory (e.g. process.cwd())
 * @param options   - force: overwrite existing; silent: no stderr output
 */
export declare function installSkill(targetDir: string, options?: InstallSkillOptions): InstallSkillResult;
/**
 * Update existing skill files. Returns error if not installed yet.
 */
export declare function updateSkill(targetDir: string, options?: Omit<InstallSkillOptions, "force">): InstallSkillResult;
