import { Command } from "commander";
import { callWjxApi } from "wjx-api-sdk";
import { getCredentials } from "../lib/auth.js";
import { formatOutput } from "../lib/output.js";
import { handleError, CliError, ensureApiSuccess } from "../lib/errors.js";
import { findCatalogEntry } from "../catalog/catalog.js";
import { buildRequestPlan } from "../lib/runtime/request-plan.js";
import { readInput } from "../lib/runtime/fileio.js";
import { getMerged } from "../lib/command-helpers.js";
import { createRuntimeContext } from "../lib/runtime/context.js";
import { ensureConfirmation } from "../lib/runtime/confirmation.js";
import { getCommandMetadata } from "../lib/command-metadata.js";
import { resolveProfile } from "../lib/profiles.js";

function parseJson(value: unknown, field: string): Record<string, unknown> {
  if (value === undefined || value === null || value === "") return {};
  try {
    const parsed = typeof value === "string" ? JSON.parse(readInput(value)) : value;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  }
  catch { throw new CliError("INPUT_ERROR", `${field} 必须是 JSON、@file 或对象`); }
}

export function registerApiCommands(program: Command): void {
  program.command("api").description("通过静态 Catalog 调用 WJX action")
    .requiredOption("--service <service>", "服务名")
    .requiredOption("--action <action>", "Catalog action id")
    .option("--params <json>", "参数 JSON、@file")
    .option("--body <json>", "请求体 JSON、@file")
    .action(async (_opts, actionCommand) => {
      try {
        const opts = getMerged(actionCommand);
        const found = findCatalogEntry(String(opts.action ?? ""));
        const service = String(opts.service ?? "");
        const action = String(opts.action ?? "");
        if (!found || found.service !== service) throw new CliError("INPUT_ERROR", `未知或不允许的 action: ${service}/${action}`);
        const commandPath = found.command ?? found.id;
        const body = { ...parseJson(opts.params, "params"), ...parseJson(opts.body, "body"), action: found.action };
        const context = createRuntimeContext({
          profile: { ...resolveProfile({ profile: program.opts().profile }) },
        });
        await ensureConfirmation({
          command: commandPath,
          metadata: getCommandMetadata(commandPath),
          input: body,
          options: {
            yes: program.opts().yes === true,
            nonInteractive: program.opts().nonInteractive === true,
            dryRun: program.opts().dryRun === true,
          },
          policy: context.policy,
          inputStream: context.streams.stdin,
          outputStream: context.streams.stderr,
        });
        if (program.opts().dryRun) {
          formatOutput({
            kind: "dry-run",
            plans: [buildRequestPlan({ service: found.service, action: found.action, body })],
          }, program.opts());
          return;
        }
        const credentials = getCredentials(program.opts());
        const result = await callWjxApi(body, { credentials });
        ensureApiSuccess(result);
        formatOutput(result, program.opts());
      } catch (error) { handleError(error); }
    });
}
