import { Command } from "commander";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stderr } from "node:process";
import { updateSkill, getVersion } from "../lib/install-skill.js";

export function registerUpdateCommands(program: Command): void {
  program
    .command("update")
    .description("自更新 wjx-cli 到最新版本")
    .option("--silent", "静默执行，不询问 skill update")
    .action(async (opts: { silent?: boolean }) => {
      const { silent = false } = opts;
      const oldVersion = getVersion();

      if (!silent) {
        stderr.write(`当前版本: v${oldVersion}\n`);
        stderr.write("正在更新 wjx-cli...\n");
      }

      let globalError: string | undefined;
      try {
        execSync("npm update wjx-cli -g", { stdio: silent ? "pipe" : "inherit" });
      } catch (e) {
        globalError = e instanceof Error ? e.message : String(e);
        // Fallback: try local update
        try {
          execSync("npm update wjx-cli", { stdio: silent ? "pipe" : "inherit" });
        } catch (err) {
          const msg = `更新失败: ${err instanceof Error ? err.message : String(err)}`;
          if (!silent) {
            if (globalError) stderr.write(`  全局更新失败: ${globalError}\n`);
            stderr.write(`${msg}\n`);
          } else {
            process.stdout.write(JSON.stringify({
              status: "error",
              oldVersion,
              message: msg,
            }) + "\n");
          }
          process.exitCode = 1;
          return;
        }
      }

      // Re-read version after update.
      // Note: due to Node.js module cache, this may still return the old version
      // in the same process. The user will see the actual new version on next run.
      const newVersion = getVersion();

      if (silent) {
        process.stdout.write(JSON.stringify({
          status: "updated",
          oldVersion,
          newVersion,
        }) + "\n");
        return;
      }

      stderr.write(`更新完成: v${oldVersion} → v${newVersion}\n`);

      // Only prompt for skill update if stdin is a TTY (not piped)
      if (!stdin.isTTY) return;

      const rl = createInterface({ input: stdin, output: stderr });
      try {
        const answer = await rl.question("是否同时更新技能？(y/n) ");
        if (answer.trim().toLowerCase() === "y") {
          const result = updateSkill(process.cwd());
          if (result.status === "error") {
            stderr.write("提示: 可运行 wjx skill install 先安装技能\n");
          }
        }
      } finally {
        rl.close();
      }
    });
}
