import { stderr } from "node:process";
import { installSkill, updateSkill } from "../lib/install-skill.js";
export function registerSkillCommands(program) {
    const skill = program
        .command("skill")
        .description("管理 Claude Code 技能");
    skill
        .command("install")
        .description("安装 wjx-cli-use 技能到当前目录")
        .option("--force", "强制覆盖已有文件")
        .option("--silent", "静默执行，仅输出 JSON 结果")
        .action((opts) => {
        const result = installSkill(process.cwd(), {
            force: opts.force,
            silent: opts.silent,
        });
        if (opts.silent) {
            process.stdout.write(JSON.stringify(result) + "\n");
        }
        else if (result.status === "error") {
            stderr.write(`${result.message}\n`);
        }
        if (result.status === "error") {
            process.exitCode = 1;
        }
    });
    skill
        .command("update")
        .description("更新已安装的 wjx-cli-use 技能")
        .option("--silent", "静默执行，仅输出 JSON 结果")
        .action((opts) => {
        const result = updateSkill(process.cwd(), {
            silent: opts.silent,
        });
        if (opts.silent) {
            process.stdout.write(JSON.stringify(result) + "\n");
        }
        else if (result.status === "error") {
            stderr.write(`${result.message}\n`);
        }
        if (result.status === "error") {
            process.exitCode = 1;
        }
    });
}
//# sourceMappingURL=skill.js.map