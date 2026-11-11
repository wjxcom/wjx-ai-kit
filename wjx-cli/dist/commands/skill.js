import { installSkill, updateSkill } from "../lib/install-skill.js";
import { installPptSkill, updatePptSkill } from "../lib/install-ppt-skill.js";
import { resolveInstallRoot } from "../lib/install-root.js";
import { CliError } from "../lib/errors.js";
import { executeRuntimeLocal } from "../lib/runtime/executor.js";
const TARGET_DIR_DESC = "显式指定安装根目录（不传时按 WJX_INSTALL_ROOT → 已知客户端环境变量 → cwd 解析）";
export function registerSkillCommands(program) {
    const skill = program
        .command("skill")
        .description("管理 Claude Code 技能");
    skill
        .command("install")
        .description("安装 wjx-cli-use 技能到当前目录")
        .option("--force", "强制覆盖已有文件")
        .option("--silent", "静默执行，仅输出 JSON 结果")
        .option("--target-dir <path>", TARGET_DIR_DESC)
        .action(async (_opts, cmd) => {
        await executeRuntimeLocal(program, cmd, (input) => {
            const values = input;
            const { root, source } = resolveInstallRoot({ targetDir: values.targetDir });
            const result = installSkill(root, {
                force: values.force,
                silent: values.silent,
                rootSource: source,
            });
            if (result.status === "error") {
                throw new CliError("INPUT_ERROR", result.message);
            }
            return result;
        }, {
            dryRun: (input) => ({ command: "skill.install", force: input.force, silent: input.silent, targetDir: input.targetDir }),
            emit: (_result, input) => input.silent === true,
        });
    });
    skill
        .command("update")
        .description("更新已安装的 wjx-cli-use 技能")
        .option("--silent", "静默执行，仅输出 JSON 结果")
        .option("--target-dir <path>", TARGET_DIR_DESC)
        .action(async (_opts, cmd) => {
        await executeRuntimeLocal(program, cmd, (input) => {
            const values = input;
            const { root, source } = resolveInstallRoot({ targetDir: values.targetDir });
            const result = updateSkill(root, {
                silent: values.silent,
                rootSource: source,
            });
            if (result.status === "error") {
                throw new CliError("INPUT_ERROR", result.message);
            }
            return result;
        }, {
            dryRun: (input) => ({ command: "skill.update", silent: input.silent, targetDir: input.targetDir }),
            emit: (_result, input) => input.silent === true,
        });
    });
    skill
        .command("install-ppt")
        .description("安装 wjx-survey-ppt 技能（含 pip install ppt-master-survey）")
        .option("--force", "强制覆盖已有文件")
        .option("--silent", "静默执行，仅输出 JSON 结果")
        .option("--skip-pip", "跳过 pip 安装步骤，仅复制 skill 文件")
        .option("--target-dir <path>", TARGET_DIR_DESC)
        .action(async (_opts, cmd) => {
        await executeRuntimeLocal(program, cmd, (input) => {
            const values = input;
            const { root, source } = resolveInstallRoot({ targetDir: values.targetDir });
            const result = installPptSkill(root, {
                force: values.force,
                silent: values.silent,
                skipPip: values.skipPip,
                rootSource: source,
            });
            if (result.status === "error") {
                throw new CliError("INPUT_ERROR", result.message);
            }
            if (result.status === "partial") {
                throw new CliError("INPUT_ERROR", result.message, {
                    status: result.status,
                    pip_installed: result.pipInstalled,
                });
            }
            return result;
        }, {
            dryRun: (input) => ({ command: "skill.install-ppt", force: input.force, silent: input.silent, skipPip: input.skipPip, targetDir: input.targetDir }),
            emit: (_result, input) => input.silent === true,
        });
    });
    skill
        .command("update-ppt")
        .description("更新已安装的 wjx-survey-ppt 技能")
        .option("--silent", "静默执行，仅输出 JSON 结果")
        .option("--skip-pip", "跳过 pip 升级步骤")
        .option("--target-dir <path>", TARGET_DIR_DESC)
        .action(async (_opts, cmd) => {
        await executeRuntimeLocal(program, cmd, (input) => {
            const values = input;
            const { root, source } = resolveInstallRoot({ targetDir: values.targetDir });
            const result = updatePptSkill(root, {
                silent: values.silent,
                skipPip: values.skipPip,
                rootSource: source,
            });
            if (result.status === "error") {
                throw new CliError("INPUT_ERROR", result.message);
            }
            if (result.status === "partial") {
                throw new CliError("INPUT_ERROR", result.message, {
                    status: result.status,
                    pip_installed: result.pipInstalled,
                });
            }
            return result;
        }, {
            dryRun: (input) => ({ command: "skill.update-ppt", silent: input.silent, skipPip: input.skipPip, targetDir: input.targetDir }),
            emit: (_result, input) => input.silent === true,
        });
    });
}
//# sourceMappingURL=skill.js.map