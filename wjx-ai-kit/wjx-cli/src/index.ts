#!/usr/bin/env node
import { createRequire } from "node:module";
import { Command, CommanderError } from "commander";
import { registerSurveyCommands } from "./commands/survey.js";
import { registerDiagnosticCommands } from "./commands/diagnostics.js";
import { registerResponseCommands } from "./commands/response.js";
import { registerContactsCommands } from "./commands/contacts.js";
import { registerDepartmentCommands } from "./commands/department.js";
import { registerAdminCommands } from "./commands/admin.js";
import { registerTagCommands } from "./commands/tag.js";
import { registerUserSystemCommands } from "./commands/user-system.js";
import { registerAccountCommands } from "./commands/account.js";
import { registerSsoCommands } from "./commands/sso.js";
import { registerAnalyticsCommands } from "./commands/analytics.js";
import { registerInitCommands } from "./commands/init.js";
import { registerCompletionCommands } from "./commands/completion.js";
import { registerReferenceCommands } from "./commands/reference.js";
import { registerSkillCommands } from "./commands/skill.js";
import { registerUpdateCommands } from "./commands/update.js";
import { readStdin, mergeStdinWithOpts } from "./lib/stdin.js";
import { handleError } from "./lib/errors.js";
import { applyConfigToEnv } from "./lib/config.js";
import { getCompletions } from "./lib/completions.js";

// Load ~/.wjxrc config into process.env (env vars take precedence)
applyConfigToEnv();

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const program = new Command();

program
  .name("wjx")
  .description("问卷星 (Wenjuanxing) CLI — AI Agent 原生命令行工具")
  .version(version)
  .option("--api-key <apiKey>", "WJX API Key（或设置 WJX_API_KEY 环境变量）")
  .option("--json", "JSON 输出（默认）")
  .option("--table", "表格输出")
  .option("--stdin", "从 stdin 读取 JSON 参数")
  .option("--dry-run", "预览 API 请求（不实际发送）");

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
registerDiagnosticCommands(program);
registerResponseCommands(program);
registerContactsCommands(program);
registerDepartmentCommands(program);
registerAdminCommands(program);
registerTagCommands(program);
registerUserSystemCommands(program);
registerAccountCommands(program);
registerSsoCommands(program);
registerAnalyticsCommands(program);
registerInitCommands(program);
registerCompletionCommands(program);
registerReferenceCommands(program);
registerSkillCommands(program);
registerUpdateCommands(program);

(async () => {
  try {
    // Hidden completion hook: --get-completions <point> <line...>
    const rawArgs = process.argv.slice(2);
    const gcIdx = rawArgs.indexOf("--get-completions");
    if (gcIdx !== -1 && rawArgs[gcIdx + 1] !== undefined) {
      const point = parseInt(rawArgs[gcIdx + 1], 10);
      const line = rawArgs.slice(gcIdx + 2).join(" ");
      const results = getCompletions(program, point, line);
      if (results.length > 0) {
        process.stdout.write(results.join("\n") + "\n");
      }
      process.exit(0);
    }

    await program.parseAsync();
  } catch (err) {
    // Commander throws CommanderError for --help, --version, missing args, etc.
    if (err instanceof CommanderError) {
      // help and version are normal exits
      if (err.code === "commander.helpDisplayed" || err.code === "commander.version") {
        process.exit(0);
      }
      handleError(err);
      return;
    }
    handleError(err);
  }
})();
