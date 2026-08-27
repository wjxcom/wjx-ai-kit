import { Command } from "commander";
import { callWjxApi } from "wjx-api-sdk";
import { getCredentials } from "../lib/auth.js";
import { formatOutput } from "../lib/output.js";
import { handleError, CliError } from "../lib/errors.js";
import { findCatalogEntry } from "../catalog/catalog.js";
import { buildRequestPlan } from "../lib/runtime/request-plan.js";
import { readInput } from "../lib/runtime/fileio.js";

function parseJson(value: string | undefined, field: string): Record<string, unknown> {
  if (!value) return {};
  try { const parsed = JSON.parse(readInput(value)); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); return parsed as Record<string, unknown>; }
  catch { throw new CliError("INPUT_ERROR", `${field} 必须是 JSON、@file 或对象`); }
}

export function registerApiCommands(program: Command): void {
  program.command("api").description("通过静态 Catalog 调用 WJX action")
    .requiredOption("--service <service>", "服务名")
    .requiredOption("--action <action>", "Catalog action id")
    .option("--params <json>", "参数 JSON、@file")
    .option("--body <json>", "请求体 JSON、@file")
    .action(async (opts) => {
      try {
        const found = findCatalogEntry(opts.action);
        if (!found || found.service !== opts.service) throw new CliError("INPUT_ERROR", `未知或不允许的 action: ${opts.service}/${opts.action}`);
        const body = { ...parseJson(opts.params, "params"), ...parseJson(opts.body, "body"), action: found.action };
        const credentials = getCredentials(program.opts());
        if (program.opts().dryRun) {
          process.stderr.write(`${JSON.stringify({ dry_run: true, request: buildRequestPlan({ service: found.service, action: found.action, credentials, body }) }, null, 2)}\n`);
          return;
        }
        const result = await callWjxApi(body, { credentials });
        formatOutput(result, program.opts());
      } catch (error) { handleError(error); }
    });
}
