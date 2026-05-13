import { Command } from "commander";
import { stderr } from "node:process";
import { installSkill, updateSkill } from "../lib/install-skill.js";
import { installPptSkill, updatePptSkill } from "../lib/install-ppt-skill.js";

export function registerSkillCommands(program: Command): void {
  const skill = program
    .command("skill")
    .description("管理 Claude Code 技能");

  skill
    .command("install")
    .description("安装 wjx-cli-use 技能到当前目录")
    .option("--force", "强制覆盖已有文件")
    .option("--silent", "静默执行，仅输出 JSON 结果")
    .action((opts: { force?: boolean; silent?: boolean }) => {
      const result = installSkill(process.cwd(), {
        force: opts.force,
        silent: opts.silent,
      });
      if (opts.silent) {
        process.stdout.write(JSON.stringify(result) + "\n");
      } else if (result.status === "error") {
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
    .action((opts: { silent?: boolean }) => {
      const result = updateSkill(process.cwd(), {
        silent: opts.silent,
      });
      if (opts.silent) {
        process.stdout.write(JSON.stringify(result) + "\n");
      } else if (result.status === "error") {
        stderr.write(`${result.message}\n`);
      }
      if (result.status === "error") {
        process.exitCode = 1;
      }
    });

  skill
    .command("install-ppt")
    .description("安装 wjx-survey-ppt 技能（含 pip install ppt-master-survey）")
    .option("--force", "强制覆盖已有文件")
    .option("--silent", "静默执行，仅输出 JSON 结果")
    .option("--skip-pip", "跳过 pip 安装步骤，仅复制 skill 文件")
    .action((opts: { force?: boolean; silent?: boolean; skipPip?: boolean }) => {
      const result = installPptSkill(process.cwd(), {
        force: opts.force,
        silent: opts.silent,
        skipPip: opts.skipPip,
      });
      if (opts.silent) {
        process.stdout.write(JSON.stringify(result) + "\n");
      } else if (result.status === "error") {
        stderr.write(`${result.message}\n`);
      }
      if (result.status === "error") {
        process.exitCode = 1;
      }
    });

  skill
    .command("update-ppt")
    .description("更新已安装的 wjx-survey-ppt 技能")
    .option("--silent", "静默执行，仅输出 JSON 结果")
    .option("--skip-pip", "跳过 pip 升级步骤")
    .action((opts: { silent?: boolean; skipPip?: boolean }) => {
      const result = updatePptSkill(process.cwd(), {
        silent: opts.silent,
        skipPip: opts.skipPip,
      });
      if (opts.silent) {
        process.stdout.write(JSON.stringify(result) + "\n");
      } else if (result.status === "error") {
        stderr.write(`${result.message}\n`);
      }
      if (result.status === "error") {
        process.exitCode = 1;
      }
    });
}
