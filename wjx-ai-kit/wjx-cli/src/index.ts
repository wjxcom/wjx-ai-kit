#!/usr/bin/env node
import { Command, CommanderError } from "commander";
import { registerSurveyCommands } from "./commands/survey.js";
import { readStdin, mergeStdinWithOpts } from "./lib/stdin.js";
import { handleError } from "./lib/errors.js";

const program = new Command();

program
  .name("wjx")
  .description("问卷星 (Wenjuanxing) CLI — AI Agent 原生命令行工具")
  .version("0.1.0")
  .option("--token <token>", "WJX API Token（或设置 WJX_TOKEN 环境变量）")
  .option("--json", "JSON 输出（默认）")
  .option("--table", "表格输出")
  .option("--verbose", "详细输出")
  .option("--stdin", "从 stdin 读取 JSON 参数");

// Prevent Commander from calling process.exit on errors — we handle it ourselves
program.exitOverride();

// Global preAction hook: read stdin and merge with command opts
program.hook("preAction", async (thisCommand, actionCommand) => {
  const globalOpts = thisCommand.opts();
  if (globalOpts.stdin) {
    const stdinData = await readStdin();
    if (Object.keys(stdinData).length > 0) {
      // Store stdin data on the action command for executeCommand to pick up
      (actionCommand as unknown as Record<string, unknown>).__stdinData = stdinData;
    }
  }
});

registerSurveyCommands(program);

(async () => {
  try {
    await program.parseAsync();
  } catch (err) {
    // Commander throws CommanderError for --help, --version, missing args, etc.
    if (err instanceof CommanderError) {
      // help and version are normal exits
      if (err.code === "commander.helpDisplayed" || err.code === "commander.version") {
        process.exit(0);
      }
      // Missing required option, unknown option, etc. — treat as INPUT_ERROR
      handleError(err);
    }
    handleError(err);
  }
})();
