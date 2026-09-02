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
import { registerApiCommands } from "./commands/api.js";
import { registerSchemaCommands } from "./commands/schema.js";
import { readStdin } from "./lib/stdin.js";
import { handleError, isCliErrorHandled, CliError } from "./lib/errors.js";
import { applyConfigToEnv } from "./lib/config.js";
import { getCompletions } from "./lib/completions.js";
import { validateOutputFormat } from "./lib/output.js";

// Load ~/.wjxrc config into process.env (env vars take precedence)
applyConfigToEnv();

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const program = new Command();

// Commander diagnostics are folded into the single ProblemEnvelope emitted by root lifecycle.
program.configureOutput({ writeErr: () => undefined });

program
  .name("wjx")
  .description("问卷星 (Wenjuanxing) CLI — AI Agent 原生命令行工具")
  .version(version)
  .option("--api-key <apiKey>", "WJX API Key（或设置 WJX_API_KEY 环境变量）")
  .option("--format <format>", "输出格式：json|pretty|table|ndjson|csv")
  .option("--stdin", "从 stdin 读取 JSON 参数")
  .option("--dry-run", "预览 API 请求（不实际发送）")
  .option("--yes", "确认执行高风险写操作")
  .option("--non-interactive", "禁止交互式确认；高风险操作必须显式带 --yes")
  .option("--profile <name>", "选择凭据 profile");

// Prevent Commander from calling process.exit on errors — we handle it ourselves
program.exitOverride();

// Global preAction hook: read stdin and merge with command opts
program.hook("preAction", async (thisCommand, actionCommand) => {
  const globalOpts = thisCommand.opts();
  validateOutputFormat(globalOpts);
  if (globalOpts.stdin) {
    const stdinData = await readStdin();
    if (Object.keys(stdinData).length > 0) {
      // Store stdin data on the action command for the runtime action to pick up
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
registerApiCommands(program);
registerSchemaCommands(program);

(async () => {
  try {
    // Hidden completion hook: --get-completions <point> <line...>
    const rawArgs = process.argv.slice(2);
    if (rawArgs.slice(1).some((arg) => arg === "--version" || arg === "-V")) {
      throw new CliError("INPUT_ERROR", "--version 只能作为根命令的第一个参数使用");
    }
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
    if (isCliErrorHandled(err)) return;
    // Commander throws CommanderError for --help, --version, missing args, etc.
    if (err instanceof CommanderError) {
      // help and version are normal exits
      if (err.code === "commander.helpDisplayed" || err.code === "commander.version") {
        process.exit(0);
      }
      try {
        handleError(err);
      } catch (handled) {
        if (!isCliErrorHandled(handled)) throw handled;
      }
      return;
    }
    try {
      handleError(err);
    } catch (handled) {
      if (!isCliErrorHandled(handled)) throw handled;
    }
  }
})();
