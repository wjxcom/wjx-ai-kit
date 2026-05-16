import { Command } from "commander";
import { stderr } from "node:process";
import { installSkill, updateSkill } from "../lib/install-skill.js";
import { installPptSkill, updatePptSkill } from "../lib/install-ppt-skill.js";
import { resolveInstallRoot } from "../lib/install-root.js";

interface SkillCmdOpts {
  force?: boolean;
  silent?: boolean;
  skipPip?: boolean;
  targetDir?: string;
}

const TARGET_DIR_DESC =
  "显式指定安装根目录（不传时按 WJX_INSTALL_ROOT → 已知客户端环境变量 → cwd 解析）";

export function registerSkillCommands(program: Command): void {
  const skill = program
    .command("skill")
    .description("管理 Claude Code 技能");

  skill
    .command("install")
    .description("安装 wjx-cli-use 技能到当前目录")
    .option("--force", "强制覆盖已有文件")
    .option("--silent", "静默执行，仅输出 JSON 结果")
    .option("--target-dir <path>", TARGET_DIR_DESC)
    .action((opts: SkillCmdOpts) => {
      const { root, source } = resolveInstallRoot({ targetDir: opts.targetDir });
      const result = installSkill(root, {
        force: opts.force,
        silent: opts.silent,
        rootSource: source,
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
    .option("--target-dir <path>", TARGET_DIR_DESC)
    .action((opts: SkillCmdOpts) => {
      const { root, source } = resolveInstallRoot({ targetDir: opts.targetDir });
      const result = updateSkill(root, {
        silent: opts.silent,
        rootSource: source,
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
    .option("--target-dir <path>", TARGET_DIR_DESC)
    .action((opts: SkillCmdOpts) => {
      const { root, source } = resolveInstallRoot({ targetDir: opts.targetDir });
      const result = installPptSkill(root, {
        force: opts.force,
        silent: opts.silent,
        skipPip: opts.skipPip,
        rootSource: source,
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
    .option("--target-dir <path>", TARGET_DIR_DESC)
    .action((opts: SkillCmdOpts) => {
      const { root, source } = resolveInstallRoot({ targetDir: opts.targetDir });
      const result = updatePptSkill(root, {
        silent: opts.silent,
        skipPip: opts.skipPip,
        rootSource: source,
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
